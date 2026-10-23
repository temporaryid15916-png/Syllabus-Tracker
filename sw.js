const CACHE_NAME = "syllabus-tracker-v9";
const APP_FILES = [
"./",
"./index.html",
"./manifest.webmanifest"
];
// INSTALL
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
// ACTIVATE
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
// FETCH
self.addEventListener("fetch", (event) => {
if (event.request.method !== "GET") return;
if (event.request.mode === "navigate" || event.request.destination === "document") {
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
event.respondWith(
caches.match(event.request).then((cachedResponse) => {
if (cachedResponse) return cachedResponse;
return fetch(event.request)
.then((networkResponse) => {
if (networkResponse && networkResponse.ok && event.request.url.startsWith("http")) {
const copy = networkResponse.clone();
caches.open(CACHE_NAME).then((cache) => {
cache.put(event.request, copy);
});
}
return networkResponse;
})
.catch(() => new Response("", { status: 404, statusText: "Offline" }));
})
);
})
