const CACHE_NAME = "syllabus-tracker-v6";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./icon-192.png",
  "./icon-512.png"
];


// ================================
// INSTALL
// ================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const file of APP_FILES) {
        try {
          await cache.add(file);
        } catch (error) {
          console.warn("Could not cache:", file, error);
        }
      }
    })
  );

  // Activate the new service worker immediately
  self.skipWaiting();
});


// ================================
// ACTIVATE
// ================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});


// ================================
// FETCH
// ================================
self.addEventListener("fetch", (event) => {

  // Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }


  // =====================================
  // HTML PAGE / NAVIGATION
  // =====================================
  if (
    event.request.mode === "navigate" ||
    event.request.destination === "document"
  ) {

    event.respondWith(

      // First try internet
      fetch(event.request)

        .then((networkResponse) => {

          // Save latest online version
          if (networkResponse && networkResponse.ok) {

            const copy = networkResponse.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }

          return networkResponse;
        })

        // If internet fails → use cached version
        .catch(async () => {

          const cache = await caches.open(CACHE_NAME);

          // Try exact requested page
          const exactPage = await cache.match(event.request);

          if (exactPage) {
            return exactPage;
          }

          // Try index.html
          const indexPage = await cache.match("./index.html");

          if (indexPage) {
            return indexPage;
          }

          // Try root
          const rootPage = await cache.match("./");

          if (rootPage) {
            return rootPage;
          }

          // Last-resort offline page
          return new Response(
            `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <title>Syllabus Tracker</title>
            </head>

            <body>
              <h2>Syllabus Tracker</h2>
              <p>Offline mode is not ready yet.</p>
              <p>Please open the app once while you are online.</p>
            </body>
            </html>
            `,
            {
              status: 200,
              headers: {
                "Content-Type": "text/html; charset=utf-8"
              }
            }
          );
        })
    );

    return;
  }


  // =====================================
  // CSS / JS / IMAGES / OTHER FILES
  // =====================================

  event.respondWith(

    // First check cache
    caches.match(event.request)

      .then((cachedResponse) => {

        if (cachedResponse) {
          return cachedResponse;
        }


        // Not in cache → get from internet
        return fetch(event.request)

          .then((networkResponse) => {

            if (networkResponse && networkResponse.ok) {

              const copy = networkResponse.clone();

              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, copy);
              });
            }

            return networkResponse;
          })

          // If internet unavailable
          .catch(() => {

            return caches.match("./index.html");
          });
      })
  );
});
