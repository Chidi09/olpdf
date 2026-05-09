const APP_SHELL_CACHE = "app-shell-v1";
const API_CACHE = "api-v1";
const THUMBNAIL_CACHE = "page-thumbnails-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method === "GET" && (request.destination === "document" || request.destination === "script" || request.destination === "style")) {
    event.respondWith(
      caches.open(APP_SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          // Offline and not yet cached — nothing we can do.
          return Response.error();
        }
      }),
    );
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const cache = await caches.open(API_CACHE);
          cache.put(request, response.clone());
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(API_CACHE);
          const cached = await cache.match(request);
          return cached || Response.error();
        }),
    );
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/thumbnail/")) {
    event.respondWith(caches.open(THUMBNAIL_CACHE).then((cache) => cache.match(request).then((hit) => hit || fetch(request))));
  }
});
