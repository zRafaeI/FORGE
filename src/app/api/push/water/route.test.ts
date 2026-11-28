import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent: { endpoint: string; payload: string }[] = [];
vi.mock("web-push", () => ({
  sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
    sent.push({ endpoint: sub.endpoint, payload });
    return { statusCode: 201 };
  }),
  generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }),
}));

const created = "2026-11-01T12:00:00.000Z";
const dailyJob = {
  userId: "u1",
  lastDay: null,
  reminder: { enabled: true, time: "19:00" },
  habits: [{ id: "h1", title: "Ler 10 páginas", category: "estudos", recurrence: { type: "daily" }, createdAt: created, updatedAt: created }],
  activities: [],
  checkIns: [],
  subscriptions: [{ endpoint: "https://push.example/u1", p256dh: "k", auth: "a", time_zone: "America/Sao_Paulo" }],
};
const calls: { fn: string; body: unknown }[] = [];

beforeEach(() => {
  sent.length = 0;
  calls.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemplo.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_teste";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-28T19:30:00-03:00"));
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const fn = String(url).split("/rpc/")[1]?.split("?")[0] ?? "";
    calls.push({ fn, body: init?.body ? JSON.parse(String(init.body)) : null });
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    if (fn === "forge_push_jobs") return json({ vapid_public: "BGM5CUDrYFugl91GKNMyHHNdm0J-5mxcxmbuKdm4Q3oJvOua0fid2z1v1qNC1ATb4P5_7eeFKp7xfu2wuDKQP1U", vapid_private: "priv", targets: [] });
    if (fn === "forge_daily_push_jobs") return json([dailyJob]);
    if (fn === "forge_feedback_jobs" || fn === "forge_challenge_push_jobs") return json(null);
    return json(null);
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("POST /api/push/water — lembrete diário", () => {
  it("manda o lembrete de quem ainda tem algo pendente e registra o dia", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("https://forge-seven-psi.vercel.app/api/push/water", { method: "POST", headers: { authorization: "Bearer segredo" } }));
    const out = await res.json();
    expect(out.daily).toBe(1);
    expect(sent).toHaveLength(1);
    const p = JSON.parse(sent[0].payload);
    expect(p).toMatchObject({ kind: "daily", tag: "forge-daily", url: "/", body: "Falta só “Ler 10 páginas” para fechar o dia." });
    const done = calls.find((c) => c.fn === "forge_daily_push_done");
    expect(done?.body).toEqual({ p_secret: "segredo", p_items: [{ userId: "u1", day: "2026-11-28" }] });
  });
  it("sem segredo, recusa", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("https://x/api/push/water", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});
