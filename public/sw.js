/*
 * FORGE — service worker (app instalável e uso offline).
 *
 * Estratégias:
 * - Páginas (navegação e dados de rota do Next): rede primeiro, cópia salva se offline.
 *   Assim cada deploy chega na hora para quem está online.
 * - /_next/static/* (nomes com hash, imutáveis): cache primeiro.
 * - Demais arquivos do próprio site (ícones, manifesto): cache primeiro com atualização em segundo plano.
 * - Outros domínios (Supabase) e /_vercel/* (Analytics): nunca interceptados.
 *
 * - Notificações push: lembretes de água enviados pelo servidor, mesmo com o app fechado.
 *
 * Mude VERSION só quando a lógica deste arquivo mudar; o conteúdo do app se atualiza sozinho.
 */
const VERSION = "v5";
const PAGES = `forge-pages-${VERSION}`;
const ASSETS = `forge-assets-${VERSION}`;

const ROUTES = [
  "/",
  "/rotina",
  "/habitos",
  "/treinamento",
  "/alimentacao",
  "/estudos",
  "/fe",
  "/financas",
  "/evolucao",
  "/desafios",
  "/configuracoes",
  "/apoiar",
  "/privacidade",
];
const STATIC = ["/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/icons/badge-96.png"];

/** Guarda as telas e os arquivos que cada uma usa, para funcionarem offline desde o primeiro acesso. */
async function precache() {
  const pages = await caches.open(PAGES);
  const assets = await caches.open(ASSETS);
  const assetUrls = new Set(STATIC);
  await Promise.all(
    ROUTES.map(async (route) => {
      try {
        const res = await fetch(route, { credentials: "same-origin", cache: "no-cache" });
        if (!res.ok) return;
        const html = await res.clone().text();
        await pages.put(route, res);
        for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)) assetUrls.add(m[0]);
      } catch {
        /* sem rede durante a instalação: as telas entram no cache quando forem visitadas */
      }
    }),
  );
  await Promise.all(
    [...assetUrls].map((url) =>
      assets.match(url).then((hit) => hit || fetch(url).then((r) => (r.ok ? assets.put(url, r) : undefined)).catch(() => undefined)),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("forge-") && k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Chave de cache para páginas: ignora parâmetros (ex.: ?_rsc=...) mas separa HTML de dados de rota. */
function pageKey(request, url) {
  const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  return `${url.pathname}${isRsc ? "?__rsc" : ""}`;
}

/** Quanto esperar a rede antes de usar a cópia guardada (sinal fraco não pode travar o app). */
const NAVIGATE_TIMEOUT = 2500;
const DATA_TIMEOUT = 1500;

async function networkFirst(request, url) {
  const cache = await caches.open(PAGES);
  const key = pageKey(request, url);
  const fallback = async () => (await cache.match(key)) || (request.mode === "navigate" ? await cache.match("/") : undefined);

  const network = fetch(request).then((res) => {
    if (res.ok && res.type === "basic") cache.put(key, res.clone());
    return res;
  });

  let timer;
  const timeout = new Promise((resolve) => (timer = setTimeout(() => resolve("timeout"), request.mode === "navigate" ? NAVIGATE_TIMEOUT : DATA_TIMEOUT)));
  try {
    const first = await Promise.race([network, timeout]);
    if (first !== "timeout") return first;
    // A rede está lenta: mostra a cópia guardada e deixa a resposta atualizar o cache quando chegar.
    const hit = await fallback();
    network.catch(() => undefined);
    if (hit) return hit;
    // Troca de tela sem cópia dos dados: devolve erro para o app abrir a página inteira, que tem cópia.
    if (request.mode !== "navigate") return Response.error();
    return await network;
  } catch (err) {
    const hit = await fallback();
    if (hit) return hit;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function cacheFirst(request, revalidate) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request, { ignoreSearch: true });
  const fetching = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (hit) {
    if (revalidate) void fetching;
    return hit;
  }
  const res = await fetching;
  return res || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase e afins: direto para a rede
  if (url.pathname.startsWith("/_vercel/") || url.pathname === "/sw.js") return;
  // Vídeo é pedido em pedaços (Range), principalmente no iPhone: vai direto para a rede.
  if (request.headers.has("range") || /\.(mp4|webm)$/.test(url.pathname)) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, false));
  } else if (request.mode === "navigate" || request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(networkFirst(request, url));
  } else {
    event.respondWith(cacheFirst(request, true));
  }
});

/* ── Notificações ─────────────────────────────────────────────────────────── */

const IOS = /iPhone|iPad|iPod/.test(self.navigator.userAgent);

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "FORGE";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = windows.filter((c) => c.visibilityState === "visible");
      for (const c of visible) c.postMessage({ type: "forge-push", payload });
      // Lembrete de água com o FORGE aberto e em foco: o aviso aparece dentro do app.
      // No iPhone a notificação é sempre exibida (o sistema exige).
      if (payload.kind === "water" && !IOS && windows.some((c) => c.focused)) return;
      await self.registration.showNotification(title, {
        body: payload.body || "",
        tag: payload.tag || "forge",
        renotify: true,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        vibrate: [180, 90, 180],
        data: { url: payload.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Link externo (ex.: painel do Supabase): abre em nova janela.
      if (new URL(target).origin !== self.location.origin) {
        await self.clients.openWindow(target);
        return;
      }
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if (existing.url !== target && "navigate" in existing) await existing.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
