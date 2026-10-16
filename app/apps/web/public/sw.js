// Dr.Ink Booking service worker.
// Deliberately minimal: it only touches page navigations so it can never
// interfere with Convex's websocket / API traffic or static asset loading.
// Its job is (a) satisfy the installability criteria and (b) show a graceful
// offline screen (and the last-seen page) when the network is gone.
const CACHE = "drink-shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Offline · Dr.Ink</title></head>
<body style="margin:0;height:100dvh;display:grid;place-items:center;background:#000;color:#fff;font-family:system-ui,sans-serif">
<div style="text-align:center;padding:24px">
<h1 style="font-weight:600;font-size:20px;margin:0 0 8px">You're offline</h1>
<p style="opacity:.65;margin:0">Reconnect to use Dr.Ink Booking.</p>
</div></body></html>`;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(request);
        return cached ?? new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })(),
  );
});
