
"use strict";

const CACHE = "bikecare-cache-v3";

const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icon.svg"
];

function isLocalRequest(request) {
  const url = new URL(request.url);

  return (
    url.origin === self.location.origin &&
    url.protocol === self.location.protocol
  );
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(async cache => {
        for (const file of FILES) {
          try {
            await cache.add(file);
          } catch (error) {
            console.warn("Не успях да кеширам:", file, error);
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("bikecare-cache-") &&
              key !== CACHE
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (
    request.method !== "GET" ||
    !isLocalRequest(request)
  ) {
    return;
  }

  const url = new URL(request.url);

  if (url.pathname.includes("/rest/v1/") ||
      url.pathname.includes("/auth/v1/")) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    try {
      const response = await fetch(request);

      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      const cached = await cache.match(request);

      if (cached) return cached;

      if (request.mode === "navigate") {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }

      return new Response("Няма връзка с интернет.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
