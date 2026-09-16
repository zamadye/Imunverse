/**
 * sw.js — Sprint 6.35: Service Worker offline-first PHAGOS (PWA).
 * Precache app shell + runtime cache-first untuk semua GET same-origin
 * (data JSON, sprite, audio). Naikkan CACHE_VER tiap rilis agar klien
 * mengambil aset baru.
 */
// Bump for the Mako V2 art import so an installed PWA cannot keep the
// legacy hero sprite/data shell after the runtime path changes.
const CACHE_VER = 'phagos-v1-mako-v2';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/main.css',
  './styles/dashboard-focus.css',
  './js/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VER)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => {}), // offline saat install pertama = coba lagi nanti
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VER).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // CDN/bayar: biarkan network
  event.respondWith(
    caches.match(req, { ignoreSearch: false }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VER).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        // Navigasi saat offline total → fallback shell bila ada
        if (req.mode === 'navigate') return caches.match('./index.html');
        throw new Error('offline');
      });
    }),
  );
});
