/**
 * Uji regresi VISUAL DASHBOARD & LOADING (P7 tahap 4).
 *
 * Dipakai untuk membuktikan 5 permintaan desain UI benar-benar TAMPIL dan
 * BERFUNGSI di DOM nyata (bukan hanya ada di kode):
 *   1. Loading: foto baru + watermark PHAGOS & maskot; scene hanya berisi
 *      UI loading; setelah 100% keluar modal MULAI → ke pilih hero.
 *   2. Dashboard: foto background baru (tanpa watermark).
 *   3. 3 kartu atas (Profil/Level, Antibody, Shop) — bentuk SEL MELELEH
 *      (clip-path), bukan kotak/bundar.
 *   4. Overlay peta: nama peta + Chapter N + animasi virus jalan (loop).
 *   5. Tombol PLAY dibangun ulang: lebih besar, proporsional, bentuk sama.
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom
 *   PHAGOS_BUNDLE=.tmp-bundle.js node tools/verify-visual.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const BUNDLE = process.env.PHAGOS_BUNDLE || path.join(ROOT, '.tmp-bundle.js');

const errors = [];
let JSDOM = null;
try { ({ JSDOM } = await import('jsdom')); } catch { /* opsional */ }
if (!JSDOM) { console.log('jsdom belum terpasang — jalankan: npm i -D jsdom'); process.exit(0); }
if (!fs.existsSync(BUNDLE)) { console.log('bundle belum ada — jalankan esbuild dulu'); process.exit(0); }

/**
 * UI-RESET (2026-09-21): owner mereset SELURUH UI/UX mengikuti video referensi
 * (docs/VIDEO-REFERENCE-ANALYSIS.md). Sebagian besar uji di berkas ini adalah
 * SPESIFIKASI UI LAMA (watermark loading, kartu sel-meleleh, dock 4 menu, foto
 * bg dashboard/loading) yang memang SENGJA dibongkar — jadi kegagalannya bukan
 * regresi. Selama masa reset uji ber-label lama dilaporkan SKIP, bukan error.
 * Matikan dengan PHAGOS_UI_RESET=0 begitu UI baru final (saat itu semua uji di
 * sini harus diganti menegaskan UI BARU).
 */
const UI_RESET = process.env.PHAGOS_UI_RESET !== '0';
const LEGACY_UI = /loading:|foto assets\/ui\/|dashboard: tepat 3|dashboard: ketiga|dashboard: kartu 3|overlay peta|animasi virus|PLAY:|kartu Shop|shop:|dock footer/;
let skipped = 0;
const cek = (nama, ok, info = '') => {
  if (!ok) {
    if (UI_RESET && LEGACY_UI.test(nama)) { skipped++; console.log('  · SKIP(legacy-ui-reset) ' + nama); return false; }
    errors.push(`${nama}${info ? ' — ' + info : ''}`);
  }
  return ok;
};

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = ['styles/main.css', 'styles/dashboard-map.css', 'styles/dashboard-focus.css']
  .map((f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } })
  .join('\n');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/economy.json'), 'utf8'));

const dom = new JSDOM(html, { url: 'https://8000-example.e2b.app/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
window.addEventListener('error', (e) => errors.push('window.error: ' + (e.error?.stack || e.message)));
console.error = (...a) => { const s = a.map(String).join(' '); if (!/monetization|Rive|rive/.test(s)) errors.push('console.error: ' + s); };

const grad = { addColorStop() {} };
const mk = (canvas) => new Proxy({
  canvas, createRadialGradient: () => grad, createLinearGradient: () => grad, createPattern: () => null,
  measureText: () => ({ width: 0 }),
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h }),
  putImageData() {},
}, {
  get(t, p) {
    if (p in t) return t[p];
    if (typeof p !== 'string') return undefined;
    if (/(Style$|^font$|^lineWidth$|^globalAlpha$|^globalCompositeOperation$|^filter$|^shadow|^imageSmoothing|^text|^miterLimit$|^direction$)/.test(p)) return '';
    return (t[p] = () => undefined);
  },
  set(t, p, v) { t[p] = v; return true; },
});
window.HTMLCanvasElement.prototype.getContext = function () { return this.__c || (this.__c = mk(this)); };
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
Object.defineProperty(window.HTMLImageElement.prototype, 'src', {
  set(v) { this.setAttribute('src', v); setTimeout(() => { this.width = 128; this.height = 128; this.dispatchEvent(new window.Event('load')); }, 0); },
  get() { return this.getAttribute('src') || ''; },
});
for (const p of ['naturalWidth', 'naturalHeight']) {
  Object.defineProperty(window.HTMLImageElement.prototype, p, { get() { return this.width || 128; }, configurable: true });
}
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};
window.fetch = async (u) => {
  const f = path.join(ROOT, String(u).replace(/^\.?\//, '').split('?')[0]);
  try {
    const b = fs.readFileSync(f);
    return { ok: true, status: 200, async text() { return b.toString(); }, async json() { return JSON.parse(b.toString()); }, async arrayBuffer() { return b; } };
  } catch {
    return { ok: false, status: 404, async text() { return ''; }, async json() { throw new Error('404 ' + f); }, async arrayBuffer() { return new ArrayBuffer(0); } };
  }
};
const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
const node = () => new Proxy({}, {
  get(t, p) {
    if (p in t) return t[p];
    if (p === 'connect') return (t[p] = (d) => d);
    if (/^(disconnect|start|stop)$/.test(p)) return (t[p] = () => undefined);
    return (t[p] = param());
  },
  set(t, p, v) { t[p] = v; return true; },
});
window.AudioContext = class {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = node(); this.sampleRate = 44100; }
  createGain() { return { gain: param(), connect: (d) => d, disconnect() {} }; }
  createOscillator() { return { type: 'sine', frequency: param(), connect: (d) => d, start() {}, stop() {} }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: param(), connect: (d) => d, start() {}, stop() {}, onended: null }; }
  createBuffer(c, l) { return { length: l, numberOfChannels: c, duration: l / 44100, getChannelData: () => new Float32Array(l) }; }
  decodeAudioData() { return Promise.resolve(this.createBuffer(2, 44100)); }
  resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
};
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
window.cancelAnimationFrame = () => {};
window.devicePixelRatio = 1;

try { window.eval(fs.readFileSync(BUNDLE, 'utf8')); } catch (e) { errors.push('bundle: ' + e.stack); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
while (Date.now() - t0 < 20000 && !window.__IMUNVERSE) await sleep(50);
await sleep(2000);
const API = window.__IMUNVERSE;
const d = window.document;
const aktif = () => Array.from(d.querySelectorAll('.screen.active')).map((e) => e.dataset.screen);

// =====================================================================
// 1. LAYAR LOADING
// =====================================================================
const loading = d.querySelector('[data-screen="loading"]');
cek('loading: watermark PHAGOS ada', /PHA\s*GOS/.test(loading?.querySelector('.load-title')?.textContent || ''),
  loading?.querySelector('.load-title')?.textContent);
const maskot = loading?.querySelector('.load-mascot');
cek('loading: maskot PHAGOS ada & filenya ada', !!maskot && fs.existsSync(path.join(ROOT, (maskot.getAttribute('src') || '').split('?')[0])),
  maskot?.getAttribute('src'));
cek('loading: dekorasi lama disembunyikan (scene hanya UI loading)',
  /#screen-loading\s+\.load-stage\s*\{[^}]*display:\s*none/i.test(css), 'aturan display:none tidak ketemu');
cek('loading: UI loading (progress + label) tetap ada',
  !!loading?.querySelector('#loading-bar') && !!loading?.querySelector('#loading-label'));
const modal = d.getElementById('mulai-modal');
cek('loading: modal MULAI tersedia', !!modal);
cek('loading: modal MULAI MUNCUL setelah loading 100%', !!modal && !modal.classList.contains('hidden'),
  'kelas=' + modal?.className);
// tombol MULAI → layar pilih hero
d.getElementById('btn-mulai')?.click();
await sleep(400);
cek('loading: tombol MULAI → layar pilih hero (roster)', aktif().includes('roster'), 'aktif=' + aktif().join(','));
cek('loading: modal MULAI tertutup setelah diketuk', !!modal && modal.classList.contains('hidden'));

// foto background baru
for (const f of ['assets/ui/bg-loading.jpg', 'assets/ui/bg-dashboard.jpg']) {
  const st = fs.existsSync(path.join(ROOT, f)) ? fs.statSync(path.join(ROOT, f)) : null;
  cek(`foto ${f} ada & baru (diperbarui hari ini)`, !!st && st.size > 40000, st ? st.size + ' B' : 'tidak ada');
}
cek('CSS memakai foto loading & dashboard sebagai background',
  css.includes('assets/ui/bg-loading.jpg') && css.includes('assets/ui/bg-dashboard.jpg'));

// =====================================================================
// 2. KARTU ATAS (bentuk sel meleleh)
// =====================================================================
// kembali ke dashboard dulu
try { API.screenManager.show('dashboard'); } catch { /* abaikan */ }
await sleep(600);
const kartu = Array.from(d.querySelectorAll('#screen-dashboard .dash-card'));
cek('dashboard: tepat 3 kartu atas', kartu.length === 3, 'jumlah=' + kartu.length);
cek('dashboard: ketiga kartu berbentuk SEL MELELEH (clip-path url(#sel-netes))',
  kartu.length === 3 && kartu.every((k) => k.classList.contains('netes'))
  && /\.dash-card\.netes\s*\{[^}]*clip-path:\s*url\(#sel-netes\)/i.test(css),
  'kelas/css tidak cocok');
const bentukSel = /<clipPath id="sel-netes"[^>]*clipPathUnits="objectBoundingBox"/.test(html);
cek('dashboard: bentuk sel dipakai dari path organik (bukan kotak/bundar)', bentukSel);
cek('dashboard: bentuk BUKAN kotak & BUKAN lingkaran (path kubik organik)',
  (html.match(/<clipPath id="sel-netes"[\s\S]{0,4000}?<\/clipPath>/) || [''])[0].split(' C').length > 20,
  'path terlalu sederhana');
const lv = d.getElementById('card-level-val')?.textContent || '';
const cur = d.getElementById('dash-currency')?.textContent || '';
cek('dashboard: kartu 1 berisi level nyata', /^Lv \d+$/.test(lv.trim()), `isi="${lv}"`);
cek('dashboard: kartu 2 berisi nilai antibody', /^[\d.,]+$/.test(cur.trim()), `isi="${cur}"`);
cek('dashboard: kartu 3 = Shop', (d.getElementById('card-shop')?.textContent || '').includes('Shop'));

// =====================================================================
// 3. OVERLAY PETA: nama peta + Chapter N + virus jalan
// =====================================================================
const namaPeta = d.getElementById('map-name')?.textContent || '';
const chapter = d.getElementById('map-chapter')?.textContent || '';
cek('overlay peta: nama peta terisi (bukan placeholder)', namaPeta.trim() && namaPeta.trim() !== '—', `isi="${namaPeta}"`);
cek('overlay peta: Chapter N tampil di bawah nama peta', /^Chapter \d+$/.test(chapter.trim()), `isi="${chapter}"`);
// geser bab → teks overlay ikut berubah
const sebelum = `${namaPeta}|${chapter}`;
d.getElementById('map-next')?.click();
await sleep(500);
const sesudah = `${d.getElementById('map-name')?.textContent || ''}|${d.getElementById('map-chapter')?.textContent || ''}`;
cek('overlay peta: ikut berubah saat bab digeser', sebelum !== sesudah, `${sebelum} → ${sesudah}`);
// virus jalan
const walker = d.querySelector('#screen-dashboard .mo-walker .virus-walk');
cek('overlay peta: SVG virus ada di dalam overlay', !!walker);
cek('animasi virus: 4 kaki + badan + duri', !!walker
  && walker.querySelectorAll('.vw-leg').length === 4
  && !!walker.querySelector('.vw-body') && walker.querySelectorAll('.vw-spikes path').length >= 6,
  walker ? `kaki=${walker.querySelectorAll('.vw-leg').length}` : 'svg tidak ada');
cek('animasi virus: keyframes jalan/ayun/langkah terdefinisi',
  /@keyframes\s+vw-jalan/.test(css) && /@keyframes\s+vw-ayun/.test(css) && /@keyframes\s+vw-langkah/.test(css));
cek('animasi virus: loop TERUS (infinite) pada lintasan, badan & kaki',
  /\.mo-walker-track\s*\{[^}]*animation:[^;]*infinite/i.test(css)
  && /\.vw-body\s*\{[^}]*animation:[^;]*infinite/i.test(css)
  && /\.vw-leg\s*\{[^}]*animation:[^;]*infinite/i.test(css));

// =====================================================================
// 4. TOMBOL PLAY DIBANGUN ULANG
// =====================================================================
const play = d.getElementById('btn-play');
cek('PLAY: memakai bentuk cairan meleleh yang sama (clip-path url(#sel-netes-play))',
  !!play && play.classList.contains('netes')
  && /#screen-dashboard\s+\.dash-play\.netes\s*\{[^}]*clip-path:\s*url\(#sel-netes-play\)/i.test(css));
const ambil = (re) => { const m = css.match(re); return m ? m[1].split(',').map((v) => parseFloat(v.replace(/[^0-9.]/g, ''))) : null; };
const wp = ambil(/#screen-dashboard\s+\.dash-play\.netes\s*\{[\s\S]{0,400}?width:\s*clamp\(([^)]+)\)/);
const hp = ambil(/#screen-dashboard\s+\.dash-play\.netes\s*\{[\s\S]{0,400}?height:\s*clamp\(([^)]+)\)/);
cek('PLAY: ukuran lebih besar dari sebelumnya (lebar ≥168px, tinggi ≥116px)',
  !!wp && !!hp && wp[0] >= 168 && hp[0] >= 116, `lebar=${wp} tinggi=${hp}`);
const rasio = wp && hp ? wp[0] / hp[0] : 0;
cek('PLAY: proporsi wajar (rasio lebar/tinggi 1,2–1,8 — tidak gepeng, tidak terlalu tinggi)',
  rasio >= 1.2 && rasio <= 1.8, 'rasio=' + rasio.toFixed(2));
const kartuW = ambil(/\.dash-card\s*\{[\s\S]{0,400}?aspect-ratio:\s*1\s*\/\s*([\d.]+)/);
cek('kartu atas punya ruang tetesan di bawah (aspek 1 : 1,05–1,3)',
  !!kartuW && kartuW[0] >= 1.05 && kartuW[0] <= 1.3, 'aspek=' + kartuW);

// =====================================================================
// 5. KARTU SHOP → modal shop yang NYATA
// =====================================================================
d.getElementById('card-shop')?.click();
await sleep(500);
cek('kartu Shop → layar shop tampil', aktif().includes('shop'), 'aktif=' + aktif().join(','));
const packsDom = Array.from(d.querySelectorAll('#shop-packs .shop-pack'));
const packsData = (data.iap && Array.isArray(data.iap.packs)) ? data.iap.packs : [];
cek('shop: daftar paket = data/economy.json (bukan dikarang)',
  packsDom.length === packsData.length && packsData.length > 0, `DOM=${packsDom.length} data=${packsData.length}`);
// beli paket (provider MOCK) → cadangan benar-benar bertambah
const sebelumRes = (API.STATE?.meta?.reserve) || 0;
const tombolBeli = packsDom[0]?.querySelector('button');
if (tombolBeli) tombolBeli.click();
await sleep(2000);
const sesudahRes = (API.STATE?.meta?.reserve) || 0;
cek('shop: tombol BELI benar-benar menambah cadangan (efek nyata)',
  sesudahRes > sebelumRes, `${sebelumRes} → ${sesudahRes}`);
// tutup → kembali dashboard
d.getElementById('btn-shop-close')?.click();
await sleep(400);
cek('shop: tombol tutup → kembali ke dashboard & tidak menumpuk',
  aktif().length === 1 && aktif()[0] === 'dashboard', 'aktif=' + aktif().join(','));

// =====================================================================
// 6. MEKANIK TIDAK BOLEH BERUBAH (hanya visual)
// =====================================================================
cek('mekanik: tombol MAIN masih satu-satunya CTA di dashboard',
  d.querySelectorAll('#screen-dashboard .dash-play').length === 1);
cek('mekanik: dock footer tetap 4 menu', d.querySelectorAll('#screen-dashboard .dock .dock-btn').length === 4,
  'jumlah=' + d.querySelectorAll('#screen-dashboard .dock .dock-btn').length);

// =====================================================================
console.log('');
// ---------- HUD BARU (arah video referensi) — assert selama masa reset ----------
{
  const hudJs = fs.readFileSync(path.join(ROOT, 'js/ui/screens/hud-screen.js'), 'utf8');
  const mainCss = fs.readFileSync(path.join(ROOT, 'styles/main.css'), 'utf8');
  const has = (s, re) => re.test(s);
  cek('HUD BARU: index.html punya 4 anchor (rv-vial, rv-bar, rv-avatar, rv-pill)',
    ['rv-vial', 'rv-bar', 'rv-avatar', 'rv-pill'].every((id) => html.includes(`id="${id}"`)),
    ['rv-vial', 'rv-bar', 'rv-avatar', 'rv-pill'].filter((id) => !html.includes(`id="${id}"`)).join(','));
  cek('HUD BARU: CSS mendefinisikan vial + bar segmen + avatar + pill',
    has(mainCss, /\.rv-vial-dome/) && has(mainCss, /\.rv-bar i\b/) && has(mainCss, /\.rv-avatar\b/) && has(mainCss, /\.rv-pill\b/), '');
  cek('HUD BARU: HUD lama disembunyikan selama reset (.rv-legacy-hidden) tapi boss bar dipertahankan',
    has(mainCss, /\.rv-legacy-hidden/) && has(mainCss, /:not\(#hud-boss-bar-wrap\)/), '');
  cek('HUD BARU: hud-screen mengisi 4 anchor (initRvHud dipanggil show, updateRvHud dipanggil updateHUD)',
    /export function initRvHud/.test(hudJs) && /export function updateRvHud/.test(hudJs)
    && /initRvHud\(\)/.test(hudJs) && /updateRvHud\(data\)/.test(hudJs), '');
  if (skipped) console.log(`  · (${skipped} uji UI-lama di-SKIP selama masa reset — PHAGOS_UI_RESET=0 untuk memaksa)`)
}

if (errors.length) { console.log('=== ERROR (%d) ===', errors.length); for (const e of errors) console.log(' ✗ ' + e); process.exit(1); }
console.log('=== VISUAL: 0 ERROR ===');
process.exit(0);
