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
 * Mude VERSION só quando a lógica deste arquivo mudar; o conteúdo do app se atualiza sozinho.
 */
const VERSION = "v1";
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
  "/configuracoes",
];
const STATIC = ["/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

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

async function networkFirst(request, url) {
  const cache = await caches.open(PAGES);
  const key = pageKey(request, url);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === "basic") cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(key)) || (request.mode === "navigate" ? await cache.match("/") : undefined);
    if (hit) return hit;
    throw err;
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

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, false));
  } else if (request.mode === "navigate" || request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(networkFirst(request, url));
  } else {
    event.respondWith(cacheFirst(request, true));
  }
});
