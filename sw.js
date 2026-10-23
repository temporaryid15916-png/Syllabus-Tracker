const CACHE_NAME = "syllabus-tracker-v10";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./splash.png"
];

let pomoTimer = null;
let pomoNotificationData = null;


// ============================================================
// INSTALL
// ============================================================

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

  self.skipWaiting();
});


// ============================================================
// ACTIVATE
// ============================================================

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});


// ============================================================
// FETCH
// ============================================================

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // HTML / navigation
  if (
    event.request.mode === "navigate" ||
    event.request.destination === "document"
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {

          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }

          return networkResponse;
        })
        .catch(async () => {

          const cache = await caches.open(CACHE_NAME);

          const exact = await cache.match(event.request);

          if (exact) return exact;

          const index = await cache.match("./index.html");

          if (index) return index;

          return cache.match("./");
        })
    );

    return;
  }


  // Static files: cache first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {

          if (
            networkResponse &&
            networkResponse.ok &&
            event.request.url.startsWith("http")
          ) {
            const copy = networkResponse.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          return new Response(
            "",
            {
              status: 404,
              statusText: "Offline"
            }
          );
        });
    })
  );
});


// ============================================================
// POMODORO MESSAGE SYSTEM
// ============================================================

self.addEventListener("message", (event) => {

  const data = event.data || {};

  const type = data.type;
  const payload = data.payload || {};


  // ----------------------------------------------------------
  // UPDATE POMODORO BACKGROUND NOTIFICATION
  // ----------------------------------------------------------

  if (type === "POMODORO_UPDATE") {

    clearPomodoroTimer();


    const title =
      payload.title ||
      "🍅 Pomodoro";

    const body =
      payload.body ||
      "Pomodoro session is running";


    pomoNotificationData = {
      title,
      body
    };


    /*
      The HTML sends the remaining time like:

      "24:32 remaining • Physics 1st Paper · Chapter"

      We extract MM:SS from that text and schedule
      a completion notification.

      This is best-effort background support. Android Chrome
      may suspend service workers, but whenever the worker
      remains alive this timer will fire independently of
      the page UI.
    */

    const match = body.match(/(\d{1,3}):(\d{2})\s+remaining/);

    if (match) {

      const minutes = Number(match[1]);
      const seconds = Number(match[2]);

      const remainingMs =
        (minutes * 60 + seconds) * 1000;


      if (remainingMs > 0) {

        pomoTimer = setTimeout(() => {

          const finishTitle =
            title.includes("Break")
              ? "⏰ Break Finished!"
              : "🎉 Focus Complete!";


          const finishBody =
            title.includes("Break")
              ? "Your break is finished. Ready for the next focus session?"
              : "Awesome job! Your Pomodoro focus session is complete. Time for a break!";


          showPomodoroNotification(
            finishTitle,
            finishBody
          );

          pomoTimer = null;

        }, remainingMs);
      }
    }


    /*
      Also show/update a notification immediately.
      This gives Android a visible notification while
      Pomodoro is running.
    */

    event.waitUntil(
      showPomodoroNotification(
        title,
        body
      )
    );


    return;
  }


  // ----------------------------------------------------------
  // STOP POMODORO
  // ----------------------------------------------------------

  if (type === "POMODORO_STOP") {

    clearPomodoroTimer();

    pomoNotificationData = null;

    /*
      We intentionally do not force-close all notifications
      here because Android notification behavior differs by
      browser/version.
    */

    return;
  }
});


// ============================================================
// CLEAR POMODORO TIMER
// ============================================================

function clearPomodoroTimer() {

  if (pomoTimer !== null) {

    clearTimeout(pomoTimer);

    pomoTimer = null;
  }
}


// ============================================================
// SHOW POMODORO NOTIFICATION
// ============================================================

function showPomodoroNotification(title, body) {

  return self.registration.showNotification(
    title,
    {
      body: body,

      icon: "./icon-192.png",

      badge: "./icon-192.png",

      tag: "syllabus-pomodoro",

      renotify: true,

      requireInteraction: false,

      vibrate: [
        300,
        150,
        300,
        150,
        500
      ],

      data: {
        url: "./index.html"
      },

      actions: [
        {
          action: "open",
          title: "Open Syllabus Tracker"
        }
      ]
    }
  );
}


// ============================================================
// NOTIFICATION CLICK
// ============================================================

self.addEventListener("notificationclick", (event) => {

  event.notification.close();

  event.waitUntil(

    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientList) => {

      // If tracker is already open, focus it
      for (const client of clientList) {

        if (
          client.url.includes("/Syllabus-Tracker/") &&
          "focus" in client
        ) {
          return client.focus();
        }
      }


      // Otherwise open the tracker
      if (clients.openWindow) {
        return clients.openWindow("./index.html");
      }

    })

  );
});


// ============================================================
// NOTIFICATION CLOSE
// ============================================================

self.addEventListener("notificationclose", () => {
  // Nothing required here.
});
