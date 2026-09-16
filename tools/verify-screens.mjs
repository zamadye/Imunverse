/**
 * Uji regresi LAYAR: setelah MAIN, yang aktif harus HUD saja — dashboard
 * (atau layar menu lain) tidak boleh ikut tampil menutupi gameplay.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const BUNDLE = process.env.PHAGOS_BUNDLE || path.join(ROOT, '.tmp-bundle.js');

/**
 * Uji regresi LAYAR — menu tidak boleh menutupi gameplay.
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom
 *   PHAGOS_BUNDLE=.tmp-bundle.js node tools/verify-screens.mjs
 *
 * Latar belakang: `#screen-dashboard { display:flex }` (selektor ID) pernah
 * menimpa `.screen { display:none }`, jadi dashboard SELALU tampil dan — karena
 * anak-anaknya ber-z-index 2 — menutupi gameplay/HUD setelah tombol MAIN.
 */
const errors = [];
let JSDOM = null;
try { ({ JSDOM } = await import('jsdom')); } catch { /* jsdom opsional */ }
if (!JSDOM) {
  console.log('jsdom belum terpasang — jalankan: npm i -D jsdom');
  process.exit(0);
}
if (!fs.existsSync(BUNDLE)) {
  console.log(`bundle belum ada — jalankan: npx esbuild --bundle js/main.js --outfile=${BUNDLE} --format=iife`);
  process.exit(0);
}
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'https://8000-example.e2b.app/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
window.addEventListener('error', (e) => errors.push('window.error: ' + (e.error?.stack || e.message)));
const realErr = console.error;
console.error = (...a) => errors.push('console.error: ' + a.map(String).join(' '));

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
let rid = 0;
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
window.cancelAnimationFrame = () => {};
window.devicePixelRatio = 1;

try { window.eval(fs.readFileSync(BUNDLE, 'utf8')); } catch (e) { errors.push('bundle: ' + e.stack); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
while (Date.now() - t0 < 20000 && !window.__IMUNVERSE) await sleep(50);
await sleep(1500);
const API = window.__IMUNVERSE;
const d = window.document;
const aktif = () => Array.from(d.querySelectorAll('.screen.active')).map((e) => e.dataset.screen);
const layar = (id) => d.querySelector(`[data-screen="${id}"]`);

const hasil = {};
const cek = (nama, ok, info) => { hasil[nama] = ok ? 'OK' : 'GAGAL — ' + info; if (!ok) errors.push(`${nama}: ${info}`); };

// 1. dashboard tampil sendiri
API.screenManager.show('dashboard');
await sleep(400);
cek('dashboard tampil', aktif().includes('dashboard') && aktif().length === 1, 'aktif=' + aktif());

// 1b. Peta tubuh: geser → label ikut, MAIN menolak bab terkunci
{
  const dots = Array.from(d.querySelectorAll('#map-dots .map-dot'));
  const pos0 = d.getElementById('map-pos')?.textContent?.trim();
  d.getElementById('map-next')?.click();
  await sleep(350);
  const pos1 = d.getElementById('map-pos')?.textContent?.trim();
  cek('geser bab mengubah posisi', pos0 !== pos1, `${pos0} → ${pos1}`);
  const sub = d.getElementById('play-sub')?.textContent?.trim();
  cek('label MAIN mengikuti bab', /Bab 2/.test(sub || ''), 'label=' + sub);
  const dotsLast = dots[dots.length - 1];
  dotsLast?.click();
  await sleep(300);
  const subAkhir = d.getElementById('play-sub')?.textContent?.trim() || '';
  cek('bab jauh ditandai terkunci', /Terkunci/.test(subAkhir), 'label=' + subAkhir);
  const sebelum = API.STATE.meta.selectedChapter;
  d.getElementById('btn-play')?.click();
  await sleep(400);
  cek('MAIN menolak bab terkunci', API.STATE.meta.selectedChapter === sebelum && !aktif().includes('hud'),
    `selectedChapter ${sebelum} → ${API.STATE.meta.selectedChapter}, aktif=${aktif()}`);
  dots[0]?.click();
  await sleep(300);
}

// 1c. Modal misi dari footer
{
  d.getElementById('dock-missions')?.click();
  await sleep(250);
  cek('modal misi terbuka', aktif().includes('missions'), 'aktif=' + aktif());
  const tab = Array.from(d.querySelectorAll('#screen-missions .miss-tab'));
  tab[2]?.click();
  await sleep(200);
  cek('tab prestasi', (d.getElementById('missions-title')?.textContent || '').includes('PRESTASI'), 'judul=' + d.getElementById('missions-title')?.textContent);
  d.getElementById('miss-close')?.click();
  await sleep(250);
  cek('modal misi tertutup', !aktif().includes('missions'), 'aktif=' + aktif());
}

// 2. TEKAN MAIN → gameplay (HUD) saja
d.getElementById('btn-play')?.click();
await sleep(900);
const st = aktif();
cek('MAIN → HUD', st.includes('hud'), 'aktif=' + st);
cek('MAIN → dashboard tidak aktif', !st.includes('dashboard'), 'aktif=' + st);
cek('MAIN → cuma satu layar utama', st.filter((s) => s !== 'hud').length === 0, 'aktif=' + st);
cek('run jalan', !!API.game.run, 'run=' + !!API.game.run);
cek('STATE.screen = gameplay', API.STATE.screen === 'gameplay', 'STATE.screen=' + API.STATE.screen);

// 3. CSS: dashboard tidak boleh terlihat saat tidak aktif
const cssKompak = fs.readFileSync(path.join(ROOT, 'styles/dashboard-map.css'), 'utf8');
const aturanDashboard = /#screen-dashboard\.active\s*\{[^}]*display:\s*flex/;
cek('CSS dashboard hanya tampil saat .active', aturanDashboard.test(cssKompak) && !/^#screen-dashboard\s*\{[^}]*display:/m.test(cssKompak), 'aturan #screen-dashboard masih memaksa display');

// 4. kembali ke dashboard setelah run berakhir
try { API.game.finishRun(true); } catch (e) { errors.push('finishRun: ' + e.message); }
await sleep(900);
const st2 = aktif();
cek('akhiri run → layar hasil', st2.length >= 1, 'aktif=' + st2);
API.screenManager.show('dashboard');
await sleep(400);
// dashboard bisa mengalihkan ke layar kapsul sambutan bila ada yang tertunda
const a2 = aktif();
const menuSah = a2.length === 1 && ['dashboard', 'capsule'].includes(a2[0]);
cek('kembali ke menu (dashboard/kapsul)', menuSah, 'aktif=' + a2);

// 5. tiap layar menu: hanya satu yang aktif
for (const id of ['roster', 'campaign', 'upgrade', 'bag', 'codex', 'bp', 'prep', 'shop', 'profile']) {
  API.screenManager.show(id);
  await sleep(150);
  const a = aktif();
  if (a.length !== 1 || a[0] !== id) { errors.push(`layar ${id}: aktif=${a}`); hasil['layar ' + id] = 'GAGAL — aktif=' + a; }
  else hasil['layar ' + id] = 'OK';
}

console.error = realErr;
console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 15)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
