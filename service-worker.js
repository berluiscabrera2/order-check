"use strict";

const CACHE_PREFIX = "order-check-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1.10.2`;
const APP_ROOT = "/order-check/";
const APP_SHELL = [
  APP_ROOT,
  `${APP_ROOT}index.html`,
  `${APP_ROOT}styles.css`,
  `${APP_ROOT}core.js`,
  `${APP_ROOT}app.js`,
  `${APP_ROOT}manifest.webmanifest`,
  `${APP_ROOT}icons/icon-192.png`,
  `${APP_ROOT}icons/icon-512.png`,
  `${APP_ROOT}icons/apple-touch-icon.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(APP_ROOT)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) {
          return cached;
        }
        if (request.mode === "navigate") {
          return caches.match(`${APP_ROOT}index.html`);
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }),
  );
});
