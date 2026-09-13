#!/usr/bin/env node
/**
 * scripts/unit-fase2-pwa.mjs — uji headless Fase 2.6 (PWA)
 *
 * Memeriksa yang tidak butuh browser:
 *   • manifest.json sah, field wajib ada, semua ikon ada DI DISK dengan dimensi
 *     yang sama dengan yang diklaim (dibaca dari header IHDR PNG)
 *   • sw.js ada, nama cache ikut BUILD (?v=), daftar precache benar-benar ada,
 *     berkas besar tidak ikut di-cache, navigasi punya fallback offline
 *   • index.html menautkan manifest + apple-touch-icon (iOS butuh PNG)
 *   • tabel kebenaran shouldPromptInstall(): setelah run ke-3, sekali, ditolak
 *     permanen, tidak muncul bila sudah terpasang/standalone, dan jalur iOS
 *
 *   node scripts/unit-fase2-pwa.mjs      # atau: npm run test:fase2pwa
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/* ---------- shim ---------- */
const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
  matchMedia: () => ({ matches: false }),
  navigator: { userAgent: 'node' },
  addEventListener: () => {},
};
globalThis.localStorage = globalThis.window.localStorage;
globalThis.location = { protocol: 'https:', hostname: 'test.local', href: 'https://test.local/' };
// Catatan: Node 22 sudah punya `navigator` global bawaan (getter-only) — biarkan,
// isIos()/isStandalone() membaca userAgent-nya dan aman untuk pengujian ini.

const results = [];
const check = (label, cond, detail = '') => {
  results.push({ label, ok: !!cond, detail });
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

/* ---------- 1. manifest ---------- */

console.log('\n=== 1. manifest.json ===');
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
check('name & short_name ada', !!manifest.name && !!manifest.short_name);
check('start_url & scope relatif', manifest.start_url === './index.html' && manifest.scope === './');
check('display standalone', manifest.display === 'standalone');
check('orientation landscape (game ber-gerbang landscape)', manifest.orientation === 'landscape');
check('warna dari design system', manifest.background_color === '#fdf6e3' && manifest.theme_color === '#fdf6e3');

/** Baca dimensi dari header IHDR sebuah PNG (tanpa dependensi). */
function pngSize(path) {
  const b = readFileSync(path);
  if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] };
}

let maskable = 0;
for (const icon of manifest.icons) {
  const path = icon.src;
  const [w, h] = icon.sizes.split('x').map(Number);
  const real = existsSync(path) ? pngSize(path) : null;
  check(`ikon ${path} ada & ${w}×${h} sesuai klaim`, !!real && real.w === w && real.h === h, real ? `${real.w}×${real.h}` : 'tidak ada');
  if (icon.purpose === 'maskable') maskable += 1;
}
check('ada varian maskable (Android memotong ikon)', maskable >= 1);

const apple = pngSize('assets/icons/pwa/apple-touch-icon.png');
check('apple-touch-icon.png 180×180 (iOS mengabaikan ikon manifest)', !!apple && apple.w === 180 && apple.h === 180, apple ? `${apple.w}×${apple.h}` : 'tidak ada');

/* ---------- 2. service worker ---------- */

console.log('\n=== 2. sw.js ===');
const swRaw = readFileSync('sw.js', 'utf8');
const sw = swRaw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 '); // sadar-komentar
check('nama cache ikut BUILD dari ?v=', /CACHE = `imunverse-\$\{BUILD\}`/.test(sw) && sw.includes("searchParams.get('v')"));
check('cache lama dihapus saat activate', sw.includes("k !== CACHE") && sw.includes('caches.delete'));
check('navigasi network-first + fallback index.html', sw.includes("req.mode === 'navigate'") && sw.includes("caches.match('./index.html')"));
check('hanya same-origin & GET', sw.includes('url.origin !== self.location.origin') && sw.includes("req.method !== 'GET'"));
check('berkas besar/irrelevant tidak di-cache', sw.includes('/files.zip') && sw.includes('/shots/') && sw.includes('/image-search/'));
check('save tidak disentuh (tidak ada localStorage di SW)', !sw.includes('localStorage'));

const precache = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
const entries = (precache ? precache[1] : '').match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) || [];
check('daftar precache tidak kosong', entries.length >= 4, entries.join(', '));
for (const e of entries) {
  const path = e === './' ? 'index.html' : e.replace(/^\.\//, '');
  check(`precache ${e} ada di disk`, existsSync(path));
}

/* ---------- 3. index.html ---------- */

console.log('\n=== 3. index.html ===');
const html = readFileSync('index.html', 'utf8');
check('menautkan manifest.json', /<link rel="manifest" href="manifest\.json"/.test(html));
check('apple-touch-icon tertaut', /rel="apple-touch-icon"/.test(html));
check('theme-color ada', /name="theme-color"/.test(html));

/* ---------- 4. keputusan prompt (murni) ---------- */

console.log('\n=== 4. shouldPromptInstall(): sekali, setelah run ke-3, tolak permanen ===');
const { createDefaultMeta, mergeMetaDefaults } = await import('../js/core/state-manager.js');
const pwa = await import('../js/systems/pwa-system.js');
const mk = (runs, extra = {}) => {
  const m = mergeMetaDefaults(createDefaultMeta());
  m.stats.totalRuns = runs;
  Object.assign(m, extra);
  return m;
};
const envChrome = { canPrompt: true, ios: false, standalone: false };

check('run 0/1/2 ditolak dengan alasan jelas', !pwa.shouldPromptInstall(mk(2), envChrome).show && pwa.shouldPromptInstall(mk(2), envChrome).reason.includes('run ke-3'));
check('run ke-3 + prompt native → tampil', pwa.shouldPromptInstall(mk(3), envChrome).show === true);
check('run ke-3 tanpa prompt native & bukan iOS → tidak tampil', pwa.shouldPromptInstall(mk(3), { canPrompt: false, ios: false, standalone: false }).show === false);
const ios = pwa.shouldPromptInstall(mk(3), { canPrompt: false, ios: true, standalone: false });
check('iOS tanpa prompt native → tampil sebagai petunjuk manual', ios.show === true && ios.ios === true);
check('sudah standalone → tidak tampil', pwa.shouldPromptInstall(mk(9), { canPrompt: true, ios: false, standalone: true }).show === false);

const m1 = mk(5);
pwa.markPrompted(m1);
check('setelah ditawarkan sekali tidak muncul lagi', m1.pwa.promptedAt > 0 && pwa.shouldPromptInstall(m1, envChrome).show === false);
const m2 = mk(5);
pwa.markDeclined(m2);
check('penolakan permanen', m2.pwa.declined === true && pwa.shouldPromptInstall(m2, envChrome).show === false);
const m3 = mk(5);
pwa.markInstalled(m3);
check('sudah terpasang → tidak ditawarkan', m3.pwa.installed === true && pwa.shouldPromptInstall(m3, envChrome).show === false);
check('save lama tanpa field pwa tetap aman (deep-merge)', mergeMetaDefaults(JSON.parse(JSON.stringify({ currency: 5 }))).pwa.promptedAt === 0);

/* ---------- hasil ---------- */

const fail = results.filter((r) => !r.ok);
console.log(`\n--- Hasil: ${results.length - fail.length}/${results.length} lolos ---`);
if (fail.length) {
  for (const f of fail) console.log(`  GAGAL: ${f.label}${f.detail ? ` (${f.detail})` : ''}`);
  process.exit(1);
}
console.log('UNIT_FASE2_PWA_PASS');
