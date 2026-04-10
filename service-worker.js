const CACHE_NAME = "bip-logger-shell-v20260410-1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./review.html",
  "./editor.html",
  "./manifest.webmanifest?v=20260410-1",
  "./pwa.js?v=20260410-1",
  "./styles.css?v=20260410-1",
  "./app.js?v=20260410-1",
  "./review.js?v=20260410-1",
  "./editor.js?v=20260410-1",
  "./icons/app-icon.svg",
  "./icons/app-icon-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(event.request));
    return;
  }

  event.respondWith(handleAssetRequest(event.request));
});

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse =
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match("./index.html", { ignoreSearch: true })) ||
      (await caches.match("./", { ignoreSearch: true }));
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const fallbackResponse = await caches.match(request, { ignoreSearch: true });
    if (fallbackResponse) {
      return fallbackResponse;
    }
    throw error;
  }
}
