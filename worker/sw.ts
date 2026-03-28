declare const self: ServiceWorkerGlobalScope;

const CACHE = {
  static: "static-v1",
  pages: "pages-v1",
  api: "api-v1",
  misc: "misc-v1",
} as const;

const OFFLINE_FALLBACK = "/offline";
const OFFLINE_RESPONSE = (): Response => new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });

// ── Install ──────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Pre-cache app shell routes + offline fallback
  event.waitUntil(
    caches.open(CACHE.pages).then((cache) =>
      cache.addAll([OFFLINE_FALLBACK, "/notes", "/todos"]),
    ),
  );
});

// ── Activate ─────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      const valid = new Set(Object.values(CACHE));
      return Promise.all(names.filter((n) => !valid.has(n)).map((n) => caches.delete(n)));
    }).then(() => self.clients.claim()),
  );
});

// ── Fetch ────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET (POST/PUT/DELETE go straight to network)
  if (request.method !== "GET") return;

  // Route to the right strategy
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithFallback(request, CACHE.pages));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, CACHE.static));
  } else if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, CACHE.api));
  } else {
    event.respondWith(staleWhileRevalidate(request, CACHE.misc));
  }
});

// ── Cache Maintenance ────────────────────────────────────────────────

async function trimCache(cacheName: string, maxEntries: number): Promise<void> {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    for (const key of keys.slice(0, keys.length - maxEntries)) {
      await cache.delete(key);
    }
  }
}

// ── Strategies ───────────────────────────────────────────────────────

/** Navigation: network-first, fall back to cache, then offline page. */
async function networkFirstWithFallback(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match(OFFLINE_FALLBACK);
    if (fallback) return fallback;
    return OFFLINE_RESPONSE();
  }
}

/** API / data: network-first, fall back to cache. */
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      void trimCache(cacheName, 20);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? OFFLINE_RESPONSE();
  }
}

/** Static assets: cache-first (hashed filenames = immutable). */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return OFFLINE_RESPONSE();
  }
}

/** Everything else: serve from cache immediately, update in background. */
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
      void trimCache(cacheName, 50);
    }
    return response;
  }).catch(() => undefined);

  return cached ?? (await fetchPromise) ?? OFFLINE_RESPONSE();
}
