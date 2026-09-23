/*
 * Service worker de la carte — Joliba (A4, cercle 1 : lecture hors ligne)
 *
 * Portée VOLONTAIREMENT étroite. Ne sont servis depuis le cache que :
 *   - les pages de carte (`/r/<établissement>/table`, `/menu/<établissement>`) : réseau
 *     d'abord, cache si le réseau ne répond pas — un client hors ligne relit la dernière carte ;
 *   - les fichiers versionnés (`/assets/…`, noms à empreinte, donc immuables) : cache d'abord ;
 *   - les photos de plats : cache d'abord, avec un plafond.
 *
 * Tout le reste — l'application du personnel, l'authentification, les API, le scan d'un QR —
 * passe au réseau sans que ce fichier y touche. Un écran de caisse servi depuis un cache
 * mentirait.
 */
const PAGES = "joliba-pages-v1";
const ASSETS = "joliba-assets-v1";
const PHOTOS = "joliba-photos-v1";
const KEEP = [PAGES, ASSETS, PHOTOS];
const MAX_PHOTOS = 200;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

function isMenuPage(url) {
  return /^\/r\/[a-z0-9-]+\/table$/.test(url.pathname) || /^\/menu\/[a-z0-9-]+$/.test(url.pathname);
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  // La clé ignore `?plat=` : c'est la même carte.
  const key = new URL(request.url);
  key.search = "";
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("délai")), NETWORK_TIMEOUT_MS)),
    ]);
    if (response.ok) await cache.put(key.href, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(key.href);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(cacheName, request, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Jamais une réponse opaque : Chrome réserve ~7 Mo de quota pour CHACUNE. Les photos sont
  // demandées en CORS (`crossOrigin` sur l'image), le stockage Convex y répond.
  if (response.ok) {
    await cache.put(request, response.clone());
    if (limit) {
      const keys = await cache.keys();
      for (const old of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(old);
    }
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (request.mode === "navigate" && isMenuPage(url)) event.respondWith(networkFirst(request));
    else if (url.pathname.startsWith("/assets/")) event.respondWith(cacheFirst(ASSETS, request));
    return;
  }
  // Photos servies par le stockage Convex : même identifiant, même fichier, pour toujours.
  if (request.destination === "image" && request.mode === "cors" && url.pathname.startsWith("/api/storage/")) {
    event.respondWith(cacheFirst(PHOTOS, request, MAX_PHOTOS));
  }
});
