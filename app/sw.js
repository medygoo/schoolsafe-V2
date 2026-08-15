"use strict";

const CACHE_VERSION = "schoolsafe-v2-shell-4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles-original.css",
  "./v3-theme.css",
  "./app.js",
  "./i18n.js",
  "./offline-sync.js",
  "./manifest.webmanifest",
  "./lucide.min.js",
  "./jspdf.umd.min.js",
  "./schoolsafe-logo.png",
  "./schoolsafe-hero-reference.png",
  "./login-kid-1.jpg",
  "./login-kid-2.jpg",
  "./login-kid-3.jpg",
  "./login-kid-4.jpg",
  "./login-kid-5.jpg",
  "./login-kid-6.jpg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_VERSION).then(function (cache) {
    return cache.addAll(APP_SHELL);
  }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(Promise.all([
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE_VERSION;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }),
    self.clients.claim()
  ]));
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(function (response) {
      var copy = response.clone();
      caches.open(CACHE_VERSION).then(function (cache) { cache.put("./index.html", copy); });
      return response;
    }).catch(function () {
      return caches.match("./index.html");
    }));
    return;
  }

  event.respondWith(caches.match(event.request).then(function (cached) {
    if (cached) return cached;
    return fetch(event.request).then(function (response) {
      if (!response || response.status !== 200) return response;
      var copy = response.clone();
      caches.open(CACHE_VERSION).then(function (cache) { cache.put(event.request, copy); });
      return response;
    });
  }));
});

self.addEventListener("sync", function (event) {
  if (event.tag !== "schoolsafe-sync") return;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
    clients.forEach(function (client) {
      client.postMessage({ type: "SCHOOLSAFE_SYNC_REQUEST" });
    });
  }));
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
