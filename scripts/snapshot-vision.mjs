/**
 * snapshot-vision.mjs — VISION SNAPSHOT headless (pengganti Playwright yang
 * tidak bisa dipasang di sandbox: CDN Chromium diblokir).
 *
 * Menjalankan BUNDLE ASLI game di jsdom (pola tools/harness.mjs) tetapi ctx
 * canvas ditukar ke canvas PIXEL NYATA (@napi-rs/canvas), sehingga keluaran
 * berupa PNG sungguhan dari renderer asli — bukan ctx rekaman.
 *
 * Pakai:
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   SNAP_TAG=after  node scripts/snapshot-vision.mjs
 *   SNAP_ROOT=<worktree-lama> SNAP_BUNDLE=<bundle-lama> SNAP_TAG=before node scripts/snapshot-vision.mjs
 *
 * Env: SNAP_ROOT (default repo ini) · SNAP_BUNDLE · SNAP_TAG · SNAP_OUT
 * Keluaran: <OUT>/<tag>-arena.png, <tag>-arena-2.png, <tag>-hero-crop.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, Image as NapiImage } from '@napi-rs/canvas';

const ROOT = process.env.SNAP_ROOT || path.dirname(path.dirname(new URL(import.meta.url).pathname));
const BUNDLE = process.env.SNAP_BUNDLE || path.join(ROOT, '.tmp-bundle.js');
const TAG = process.env.SNAP_TAG || 'after';
const OUT = process.env.SNAP_OUT || path.join(ROOT, 'docs', 'vision-snapshots');
const W = Number(process.env.SNAP_W || 960);
const H = Number(process.env.SNAP_H || 540);

const { JSDOM } = await import('jsdom');
if (!fs.existsSync(BUNDLE)) { console.error('bundle belum ada'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'https://snapshot.local/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- sumber gambar yang bisa diterima ctx nyata ---------- */
const unwrapSrc = (s) => {
  if (!s) return s;
  if (s.__nimg) return s.__nimg;           // <img> jsdom yang sudah dimuat napi
  if (s.__rc) return s.__rc;               // elemen <canvas> jsdom
  return s;                                // canvas/Image napi langsung
};
const wrapCtx = (ctx) => new Proxy(ctx, {
  get(t, p) {
    const v = t[p];
    if (p === 'drawImage') return (...a) => { a[0] = unwrapSrc(a[0]); return t.drawImage(...a); };
    if (typeof v === 'function') return v.bind(t);
    return v;
  },
  set(t, p, v) { t[p] = v; return true; },
});
const mkNapi = (w, h) => {
  const c = createCanvas(w, h);
  const g0 = c.getContext.bind(c);
  c.getContext = (kind) => wrapCtx(g0(kind));
  return c;
};

/* ---------- elemen <canvas> jsdom -> canvas napi ---------- */
window.HTMLCanvasElement.prototype.getContext = function () {
  if (!this.__rc) this.__rc = mkNapi(this.width || W, this.height || H);
  if (this.__rc.width !== (this.width || W)) this.__rc.width = this.width || W;
  if (this.__rc.height !== (this.height || H)) this.__rc.height = this.height || H;
  return this.__rc.getContext('2d');
};
/* ---------- document.createElement('canvas') -> canvas napi (offscreen) ---------- */
const origCreate = window.document.createElement.bind(window.document);
window.document.createElement = (tag, ...a) => (String(tag).toLowerCase() === 'canvas' ? mkNapi(300, 150) : origCreate(tag, ...a));

/* ---------- <img>: muat file nyata lewat napi supaya bisa di-drawImage ---------- */
Object.defineProperty(window.HTMLImageElement.prototype, 'src', {
  set(v) {
    this.setAttribute('src', v);
    setTimeout(() => {
      try {
        const p = path.join(ROOT, String(v).split('?')[0].replace(/^\.?\/+/, ''));
        this.__nimg = new NapiImage();
        this.__nimg.src = fs.readFileSync(p);
        this.width = this.__nimg.width; this.height = this.__nimg.height;
      } catch { this.width = 128; this.height = 128; }
      this.dispatchEvent(new window.Event('load'));
    }, 0);
  },
  get() { return this.getAttribute('src') || ''; },
});
for (const p of ['naturalWidth', 'naturalHeight']) {
  Object.defineProperty(window.HTMLImageElement.prototype, p, { get() { return this.width || 128; }, configurable: true });
}
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

/* ---------- fetch -> berkas lokal ---------- */
window.fetch = async (u) => {
  const f = path.join(ROOT, String(u).replace(/^\.?\/+/, '').split('?')[0]);
  try {
    const b = fs.readFileSync(f);
    return { ok: true, status: 200, async text() { return b.toString(); }, async json() { return JSON.parse(b.toString()); }, async arrayBuffer() { return b; } };
  } catch {
    return { ok: false, status: 404, async text() { return ''; }, async json() { throw new Error('404'); }, async arrayBuffer() { return new ArrayBuffer(0); } };
  }
};
const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
window.AudioContext = class {
  constructor() { this.state = 'running'; this.destination = {}; this.currentTime = 0; }
  createGain() { return param(); }
  createOscillator() { return { frequency: param(), type: '', connect() {}, start() {}, stop() {} }; }
  createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
  createBuffer() { return { getChannelData: () => new Float32Array(128) }; }
  createBiquadFilter() { return { frequency: param(), type: '', Q: param(), connect() {} }; }
  createDynamicsCompressor() { return { threshold: param(), connect() {} }; }
  resume() { return Promise.resolve(); }
};
window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
window.cancelAnimationFrame = () => {};
window.devicePixelRatio = 1;

/* ---------- jalankan bundle ---------- */
window.eval(fs.readFileSync(BUNDLE, 'utf8'));
const t0 = Date.now();
while (Date.now() - t0 < 25000 && !window.__IMUNVERSE) await sleep(50);
const API = window.__IMUNVERSE;
if (!API) { console.error('bundle tidak mengekspos __IMUNVERSE'); process.exit(1); }
await sleep(600);

/* ---------- mulai run & biarkan loop merender ---------- */
API.game.startRun('macrophage');
await sleep(2600);
const gameCanvas = window.document.getElementById('game');
const rc = gameCanvas && gameCanvas.__rc;
if (!rc) { console.error('canvas #game tidak punya ctx napi'); process.exit(1); }
rc.toBuffer ? fs.writeFileSync(path.join(OUT, `${TAG}-arena.png`), rc.toBuffer('image/png')) : null;

/* crop hero di tengah layar */
const crop = mkNapi(480, 360);
const cg = crop.getContext('2d');
cg.drawImage(rc, Math.max(0, (rc.width - 480) / 2), Math.max(0, (rc.height - 360) / 2), 480, 360, 0, 0, 480, 360);
fs.writeFileSync(path.join(OUT, `${TAG}-hero-crop.png`), crop.toBuffer('image/png'));

/* momen kedua */
await sleep(2400);
fs.writeFileSync(path.join(OUT, `${TAG}-arena-2.png`), rc.toBuffer('image/png'));

console.log(`SNAPSHOT_OK tag=${TAG} out=${OUT} canvas=${rc.width}x${rc.height}`);
process.exit(0);
