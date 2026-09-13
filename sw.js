/**
 * sw.js — SERVICE WORKER Imunverse (Fase 2.6)
 *
 * Tugasnya satu: membuat game tetap bisa dibuka dan dimainkan tanpa jaringan,
 * sehingga aplikasi yang dipasang ke home screen benar-benar mandiri — dan
 * sekaligus menyelamatkan penyimpanan dari penghapusan 7 hari WebKit di iOS
 * (aplikasi terpasang dikecualikan; lihat docs/rekomendasi-struktur-imunverse.md
 * §"PWA + prompt pasang").
 *
 * Aturan yang dijaga:
 *   • Nama cache menyertakan BUILD yang ikut sebagai `?v=` saat registrasi
 *     (js/main.js memanggil register(`sw.js?v=${BUILD}`)). Build baru = cache
 *     baru, dan cache lama DIHAPUS saat activate — jadi tidak mungkin pemain
 *     mencampur aset lama dan baru setelah update.
 *   • Aset disimpan stale-while-revalidate. URL aset membawa `?v=BUILD`
 *     (data-store.js:91, index.html), jadi kunci cache ikut berubah tiap build.
 *   • Navigasi = network-first dengan fallback ke index.html tersimpan
 *     (inilah yang membuat mode offline bekerja).
 *   • Berkas besar/irrelevant TIDAK pernah di-cache (files.zip 10 MB, hasil
 *     e2e, tooling) supaya kuota penyimpanan pemain tidak termakan.
 *   • Save TIDAK pernah disentuh: progres ada di localStorage, bukan di cache.
 */

const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `imunverse-${BUILD}`;

/** Cangkang aplikasi: yang wajib ada bahkan sebelum jaringan dicoba. */
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './styles/main.css',
  './styles/dashboard-focus.css',
  './js/main.js',
];

/** Jangan pernah di-cache: besar, atau bukan bagian dari game. */
const NEVER_CACHE = [
  '/files.zip',
  '/image-search/',
  '/shots/',
  '/screenshots/',
  '/tools/',
  '/scripts/',
  '/docs/',
  '/.git/',
  '/.arena-tmp/',
  '/node_modules/',
  '/.github/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('imunverse-') && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // CDN/eksternal: biarkan lewat
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p) || url.pathname.endsWith(p))) return;

  // Navigasi: network-first, fallback offline ke cangkang tersimpan.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Aset: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((hit) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || refresh;
    })
  );
});
