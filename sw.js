
/* Syllabus Tracker service worker — network-first, versioned cache. */
const params = new URL(self.location.href).searchParams;
const BUILD = params.get('v') || '2026-11-03-bugfix-a';
const CACHE_NAME = `syllabus-tracker-${BUILD}`;
const APP_SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async path => {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (response.ok) await cache.put(path, response.clone());
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key =>
        key.startsWith('syllabus-tracker-') &&
        key !== CACHE_NAME
      )
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  // Pomodoro background notification updates from the page
  if (data.type === 'POMODORO_UPDATE') {
    const payload = data.payload || {};
    const title = payload.title || 'Pomodoro';
    const body = payload.body || '';
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag: 'syllabus-pomodoro',
        renotify: true,
        silent: false,
        data: { source: 'pomodoro' }
      }).catch(() => {})
    );
    return;
  }
  if (data.type === 'POMODORO_STOP') {
    event.waitUntil(
      self.registration.getNotifications({ tag: 'syllabus-pomodoro' })
        .then(list => Promise.all(list.map(n => n.close())))
        .catch(() => {})
    );
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow('./index.html');
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept requests to other origins.
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  const isHtml =
    /\.html?$/i.test(url.pathname) ||
    url.pathname.endsWith('/');

  if (isNavigation || isHtml) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const fresh = await fetch(request, {
          cache: 'no-store'
        });

        if (fresh && fresh.ok) {
          await cache.put(request, fresh.clone());

          if (
            url.pathname.endsWith('/') ||
            url.pathname.endsWith('/index.html')
          ) {
            await cache.put('./', fresh.clone());
            await cache.put('./index.html', fresh.clone());
          }
        }

        return fresh;
      } catch (_) {
        return (
          await cache.match(request) ||
          await cache.match('./index.html') ||
          Response.error()
        );
      }
    })());

    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    try {
      const fresh = await fetch(request, {
        cache: 'no-store'
      });

      if (fresh && fresh.ok) {
        await cache.put(request, fresh.clone());
      }

      return fresh;
    } catch (_) {
      return (
        await cache.match(request) ||
        Response.error()
      );
    }
  })());
});
