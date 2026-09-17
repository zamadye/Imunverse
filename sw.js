/**
 * sw.js — Sprint 6.35: Service Worker offline-first PHAGOS (PWA).
 * Precache app shell + runtime cache-first untuk semua GET same-origin
 * (data JSON, sprite, audio). Naikkan CACHE_VER tiap rilis agar klien
 * mengambil aset baru.
 */
const CACHE_VER = 'phagos-v15';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/main.css',
  './styles/dashboard-focus.css',
  './styles/dashboard-map.css',
  './styles/portrait.css',
  './js/main.js',
  // Rig lokomosi Rive (4,7 KB) — runtime wasm-nya di-cache saat dipakai
  './assets/rive/hero-locomotion.riv',
  // Latar foto dashboard & loading (UI-REBUILD P8)
  './assets/ui/bg-dashboard.jpg',
  './assets/ui/bg-loading.jpg',
  // Musik CC0 (data/audio.json) — diputar saat menu & run
  './assets/audio/music/bgm_menu.mp3',
  './assets/audio/music/bgm_run.mp3',
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
    // ignoreSearch:true — aset diminta dengan cache-buster `?v=BUILD`; tanpa
    // ini setiap bump versi menghasilkan entri cache baru dan precache sia-sia.
    caches.match(req, { ignoreSearch: true }).then((hit) => {
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
