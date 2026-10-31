/* Syllabus Tracker service worker — network-first for pages so normal mobile refresh gets latest HTML */
const CACHE = "syllabus-static-v2026-10-31-e";
const STATIC = ["./","./icon-192.png","./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Always network-first for HTML / navigation so refresh gets the newest app.
  const isNav = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  const isAppShell =
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/") ||
    /Syllabus-Tracker\/?$/i.test(url.pathname);

  if (isNav || isAppShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./")))
    );
    return;
  }

  // Other assets: cache-first, then network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
    })
  );
});

// Pomodoro notification messages from the page
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "POMODORO_UPDATE" && data.payload) {
    const p = data.payload;
    self.registration.showNotification(p.title || "Pomodoro", {
      body: p.body || "",
      tag: "syllabus-pomodoro",
      renotify: true,
      vibrate: [200, 100, 200]
    }).catch(() => {});
  }
  if (data.type === "POMODORO_STOP") {
    self.registration.getNotifications({ tag: "syllabus-pomodoro" })
      .then((list) => list.forEach((n) => n.close()))
      .catch(() => {});
  }
  if (data.type === "SKIP_WAITING") self.skipWaiting();
});
