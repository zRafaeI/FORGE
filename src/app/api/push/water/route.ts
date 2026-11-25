import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as webpush from "web-push";
import { waterPushFor, type PushNutrition } from "@/lib/logic/water-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  time_zone: string;
}
interface Target {
  user_id: string;
  last_sent_at: string | null;
  nutrition: PushNutrition | null;
  subscriptions: Subscription[] | null;
}
interface Jobs {
  vapid_public: string | null;
  vapid_private: string | null;
  targets: Target[];
}

/**
 * Chamado pelo agendador do Supabase (pg_cron) a cada 5 minutos.
 * O segredo vem no cabeçalho e é conferido pelo próprio banco; este código não guarda segredo nenhum
 * e usa só a chave pública do Supabase.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!url || !key) return Response.json({ error: "supabase not configured" }, { status: 500 });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let { data, error } = await db.rpc("forge_push_jobs", { p_secret: secret });
  if (error) return Response.json({ error: "forbidden" }, { status: 403 });
  let jobs = data as Jobs;

  // Primeira execução: cria o par de chaves de envio e guarda no banco.
  if (!jobs.vapid_public || !jobs.vapid_private) {
    const keys = webpush.generateVAPIDKeys();
    const init = await db.rpc("forge_push_init_keys", { p_secret: secret, p_public: keys.publicKey, p_private: keys.privateKey });
    if (init.error) return Response.json({ error: "could not store keys" }, { status: 500 });
    ({ data, error } = await db.rpc("forge_push_jobs", { p_secret: secret }));
    if (error) return Response.json({ error: "forbidden" }, { status: 403 });
    jobs = data as Jobs;
  }

  // O "assunto" das chaves precisa ser https (Apple e Google conferem).
  const origin = new URL(req.url).origin;
  const subject = origin.startsWith("https://") ? origin : "https://forge-seven-psi.vercel.app";
  const vapid = { subject, publicKey: jobs.vapid_public!, privateKey: jobs.vapid_private! };
  const now = new Date();
  const sent: string[] = [];
  const gone: string[] = [];
  let delivered = 0;

  await Promise.all(
    jobs.targets.map(async (t) => {
      const subs = t.subscriptions ?? [];
      if (!subs.length) return;
      const decision = waterPushFor({
        nutrition: t.nutrition,
        timeZone: subs[0].time_zone,
        now,
        lastSentAt: t.last_sent_at ? new Date(t.last_sent_at) : null,
      });
      if (!decision.due) return;
      const payload = JSON.stringify({ title: decision.title, body: decision.body, tag: "forge-water", url: "/alimentacao", kind: "water" });
      let ok = false;
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
              vapidDetails: vapid,
              TTL: 30 * 60,
              urgency: "normal",
              topic: "forge-water",
            });
            ok = true;
            delivered++;
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) gone.push(s.endpoint);
            else console.error("push: falha ao enviar", status ?? "", (err as Error).message);
          }
        }),
      );
      if (ok) sent.push(t.user_id);
    }),
  );

  if (sent.length || gone.length) await db.rpc("forge_push_done", { p_secret: secret, p_sent: sent, p_gone: gone });

  // Mensagens novas do botão de sugestões: avisa o dono do app.
  const feedback = await notifyFeedback(db, secret, vapid);

  return Response.json({ checked: jobs.targets.length, sent: sent.length, delivered, removed: gone.length, feedback });
}

interface FeedbackJobs {
  pending: { id: number; kind: "sugestao" | "problema" | "elogio"; message: string }[];
  subscriptions: { endpoint: string; p256dh: string; auth: string }[];
}

const FEEDBACK_TITLE = { sugestao: "💡 Nova sugestão no FORGE", problema: "🐞 Novo problema relatado no FORGE", elogio: "💚 Novo elogio no FORGE" };

async function notifyFeedback(
  db: SupabaseClient,
  secret: string,
  vapid: { subject: string; publicKey: string; privateKey: string },
): Promise<number> {
  const { data, error } = await db.rpc("forge_feedback_jobs", { p_secret: secret });
  if (error || !data) return 0; // feedback.sql ainda não foi rodado
  const jobs = data as FeedbackJobs;
  if (!jobs.pending.length || !jobs.subscriptions.length) return 0;

  const one = jobs.pending.length === 1 ? jobs.pending[0] : null;
  const payload = JSON.stringify({
    title: one ? FEEDBACK_TITLE[one.kind] : `📬 ${jobs.pending.length} mensagens novas no FORGE`,
    body: one ? one.message : jobs.pending.map((p) => p.message).join(" · ").slice(0, 160),
    tag: "forge-feedback",
    url: "https://supabase.com/dashboard/project/fmtcpylfrrjhjcrwfyai/editor",
    kind: "feedback",
  });
  let ok = false;
  await Promise.all(
    jobs.subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          vapidDetails: vapid,
          TTL: 24 * 60 * 60,
          urgency: "normal",
          topic: "forge-feedback",
        });
        ok = true;
      } catch (err) {
        console.error("push: falha ao avisar sugestão", (err as { statusCode?: number }).statusCode ?? "", (err as Error).message);
      }
    }),
  );
  if (ok) await db.rpc("forge_feedback_notified", { p_secret: secret, p_ids: jobs.pending.map((p) => p.id) });
  return ok ? jobs.pending.length : 0;
}
