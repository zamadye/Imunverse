/**
 * Uji ANIMASI GERAKAN HERO: gerak ke semua arah harus halus & natural.
 * Dijalankan di jsdom dengan bundle asli; pemain digerakkan lewat
 * player.update(dt, move, game) langsung (tanpa input DOM).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const BUNDLE = process.env.PHAGOS_BUNDLE || path.join(ROOT, '.tmp-bundle.js');

/** Harness jsdom bersama untuk penguji runtime (bundle asli, tanpa browser). */
let JSDOM = null;
try { ({ JSDOM } = await import('jsdom')); } catch { /* jsdom opsional */ }
if (!JSDOM) { console.log('jsdom belum terpasang — jalankan: npm i -D jsdom'); process.exit(0); }
if (!fs.existsSync(BUNDLE)) {
  console.log(`bundle belum ada — jalankan: npx esbuild --bundle js/main.js --outfile=${BUNDLE} --format=iife`);
  process.exit(0);
}
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'https://8000-example.e2b.app/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;

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
    return { ok: false, status: 404, async text() { return ''; }, async json() { throw new Error('404'); }, async arrayBuffer() { return new ArrayBuffer(0); } };
  }
};
const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
const node = () => new Proxy({}, {
  get(t, p) { if (p in t) return t[p]; if (p === 'connect') return (t[p] = (d) => d); if (/^(disconnect|start|stop)$/.test(p)) return (t[p] = () => undefined); return (t[p] = param()); },
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
await sleep(1200);
// matikan loop supaya posisi tidak berubah di luar kendali
window.requestAnimationFrame = () => 0;
await sleep(100);


export { window, dom, sleep };
const API = window.__IMUNVERSE;
export { API };
export const game = API ? API.game : null;
