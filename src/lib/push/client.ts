"use client";

import { getSupabase, supabaseConfigured } from "@/lib/data/supabase-client";

/** Marca local: este aparelho recebe os lembretes pelo servidor (o app não repete o aviso). */
const ACTIVE_KEY = "forge:push:active";

export type PushAvailability =
  | "ready" // pode ativar
  | "needs-install" // iPhone/iPad fora do app instalado
  | "needs-account" // sem login: o servidor não tem os dados
  | "local-only" // versão sem conta: não há servidor
  | "denied" // notificações bloqueadas
  | "unsupported";

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export function pushAvailability(loggedIn: boolean): PushAvailability {
  if (typeof window === "undefined") return "unsupported";
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!hasApis) return "unsupported";
  if (!supabaseConfigured) return "local-only";
  if (!loggedIn) return "needs-account";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

export function pushMarkedActive(): boolean {
  try {
    return localStorage.getItem(ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

function mark(on: boolean) {
  try {
    if (on) localStorage.setItem(ACTIVE_KEY, "1");
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* sem armazenamento local */
  }
}

/** Service worker pronto, com limite de tempo (em desenvolvimento ele não é registrado). */
async function registration(timeoutMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export class PushError extends Error {
  constructor(
    public code: "denied" | "not-ready" | "no-worker" | "failed",
    message: string,
  ) {
    super(message);
  }
}

/** Confere se este aparelho ainda está inscrito (a marca local pode ficar velha). */
export async function pushIsActive(): Promise<boolean> {
  const reg = await registration(1500);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  const active = !!sub && Notification.permission === "granted" && pushMarkedActive();
  if (!active && pushMarkedActive()) mark(false);
  return active;
}

/** Pede permissão, inscreve o aparelho e salva no Supabase. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new PushError("denied", "As notificações não foram permitidas.");
  const reg = await registration();
  if (!reg) throw new PushError("no-worker", "Abra o FORGE pelo site publicado ou pelo app instalado para ativar as notificações.");

  const supabase = getSupabase();
  const { data: publicKey, error } = await supabase.rpc("forge_push_public_key");
  if (error || !publicKey) throw new PushError("not-ready", "O envio de notificações ainda está sendo preparado. Tente de novo em alguns minutos.");

  let sub = await reg.pushManager.getSubscription();
  const key = keyBytes(publicKey as string);
  if (sub) {
    // Inscrição feita com outra chave: refaz.
    const current = sub.options.applicationServerKey;
    const same = current && new Uint8Array(current).every((b, i) => b === key[i]);
    if (!same) {
      await sub.unsubscribe().catch(() => undefined);
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

  const json = sub.toJSON();
  const res = await supabase.rpc("forge_push_subscribe", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (res.error) throw new PushError("failed", "Não foi possível salvar este aparelho. Confira a conexão e tente de novo.");
  mark(true);
}

/** Remove este aparelho (usado ao desativar e ao sair da conta). */
export async function disablePush(): Promise<void> {
  mark(false);
  const reg = await registration(1500);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  if (supabaseConfigured) await getSupabase().rpc("forge_push_unsubscribe", { p_endpoint: sub.endpoint }).then(undefined, () => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/** Notificação local, para conferir som e permissão. */
export async function testNotification(): Promise<boolean> {
  const reg = await registration(1500);
  if (!reg || Notification.permission !== "granted") return false;
  return reg.showNotification("Hora de beber água", {
    body: "Assim vão chegar os seus lembretes.",
    tag: "forge-test",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    data: { url: "/alimentacao" },
  }).then(
    () => true,
    () => false,
  );
}

/** Mostra uma notificação do sistema pelo service worker (funciona também no Android). */
export async function showLocalNotification(title: string, body: string): Promise<boolean> {
  const reg = await registration(1500);
  if (!reg || Notification.permission !== "granted") return false;
  try {
    await reg.showNotification(title, { body, tag: "forge-water", icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", data: { url: "/alimentacao" } });
    return true;
  } catch {
    return false;
  }
}

/** Avisa o servidor que um lembrete foi mostrado na tela, para não repetir em outro aparelho. */
export function noteReminderShown(loggedIn: boolean) {
  if (!supabaseConfigured || !loggedIn) return;
  void getSupabase().rpc("forge_note_water_reminder").then(undefined, () => undefined);
}
