/**
 * Uji ANIMASI GERAKAN HERO: gerak ke semua arah harus halus & natural.
 * Dijalankan di jsdom dengan bundle asli; pemain digerakkan lewat
 * player.update(dt, move, game) langsung (tanpa input DOM).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const BUNDLE = process.env.PHAGOS_BUNDLE || path.join(ROOT, '.tmp-bundle.js');

/**
 * Uji ANIMASI GERAKAN HERO (UI-REBUILD P8).
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom
 *   PHAGOS_BUNDLE=.tmp-bundle.js node tools/verify-animasi.mjs
 *
 * Yang diuji: berbalik arah harus lewat transisi (bukan flip instan), langkah
 * & condong mengikuti arah (kiri/kanan/atas/bawah/diagonal), dan nilai BOB
 * tidak boleh melompat antar frame.
 */
const errors = [];
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
const API = window.__IMUNVERSE;
const { game } = API;
// matikan loop supaya posisi tidak berubah di luar kendali
window.requestAnimationFrame = () => 0;
await sleep(100);

const hasil = {};
const cek = (nama, ok, info = '') => { hasil[nama] = ok ? 'OK' : 'GAGAL — ' + info; if (!ok) errors.push(`${nama}: ${info}`); };

game.startRun('macrophage');
await sleep(200);
const p = game.run.player;
const DT = 1 / 60;
const arah = {
  kanan: { x: 1, y: 0 },
  kiri: { x: -1, y: 0 },
  atas: { x: 0, y: -1 },
  bawah: { x: 0, y: 1 },
  'kanan-atas': { x: 0.707, y: -0.707 },
  'kiri-bawah': { x: -0.707, y: 0.707 },
};
let T = 0; // waktu render (detik) — sama basisnya dengan game.render(…, time)
const bob = (f) => Math.sin(f.t * 2.1) * 1.1 + f.move * ((1 - Math.cos(f.wp * 2)) / 2) * 3.4; // rumus identik game.js
const jalan = (v, detik) => {
  const n = Math.round(detik / DT);
  const rekam = [];
  for (let i = 0; i < n; i++) {
    p.update(DT, { x: v.x, y: v.y, magnitude: Math.hypot(v.x, v.y) }, game);
    T += DT;
    rekam.push({ t: T, flip: p.animFlip, move: p.moveAmt, lean: p.lean, depth: p.depth, wp: p.walkPhase });
  }
  return rekam;
};
const diam = (detik) => {
  const n = Math.round(detik / DT);
  const rekam = [];
  for (let i = 0; i < n; i++) {
    p.update(DT, { x: 0, y: 0, magnitude: 0 }, game);
    T += DT;
    rekam.push({ t: T, flip: p.animFlip, move: p.moveAmt, lean: p.lean, depth: p.depth, wp: p.walkPhase });
  }
  return rekam;
};

// 1. berbalik arah: flip harus lewat nilai antara (tidak melompat 1 → -1)
diam(0.4);
const rKanan = jalan(arah.kanan, 0.6);
const rKiri = jalan(arah.kiri, 0.8);
const sederhana = rKanan.concat(rKiri).map((f) => f.flip);
const antara = sederhana.filter((f) => Math.abs(f) < 0.9 && Math.abs(f) > 0.05).length;
cek('berbalik arah lewat transisi (tidak instan)', antara >= 5, `frame antara=${antara}, contoh=${sederhana.slice(-14).map((v) => v.toFixed(2)).join(',')}`);
const loncatan = Math.max(...sederhana.slice(1).map((f, i) => Math.abs(f - sederhana[i])));
cek('flip tidak meloncat >0.55 per frame', loncatan < 0.55, 'loncatan maks=' + loncatan.toFixed(3));
cek('flip akhir mengarah kiri', rKiri[rKiri.length - 1].flip < -0.85, 'flip=' + rKiri[rKiri.length - 1].flip.toFixed(3));

// 2. moveAmt naik/turun perlahan (bob tidak melompat saat berhenti)
const mNaik = rKanan.map((f) => f.move);
const loncatMove = Math.max(...mNaik.slice(1).map((v, i) => Math.abs(v - mNaik[i])));
// target tercapai dalam >=8 frame (~0,13 dtk) = transisi terasa, bukan kaku
cek('moveAmt naik perlahan (≤0.13/frame)', loncatMove <= 0.13, 'loncatan=' + loncatMove.toFixed(4));
const rStop = diam(0.6);
const loncatStop = Math.max(...rStop.slice(1).map((f, i) => Math.abs(f.move - rStop[i].move)));
cek('moveAmt turun perlahan (≤0.13/frame)', loncatStop <= 0.13, 'loncatan=' + loncatStop.toFixed(4));
// YANG terlihat pemain adalah nilai BOB — itu yang tidak boleh melompat
// urutan TANPA CELAH: diam → jalan → berhenti (semua frame bersambung)
const rKontinyu = diam(0.5).concat(jalan(arah.kanan, 0.8), diam(0.8));
const rentetan = rKontinyu.map(bob);
const loncatBob = Math.max(...rentetan.slice(1).map((v, i) => Math.abs(v - rentetan[i])));
cek('bob tidak melompat (≤1 px/frame)', loncatBob <= 1.0, 'loncatan bob=' + loncatBob.toFixed(3) + 'px');
const bobMaks = Math.max(...rentetan.map(Math.abs));
cek('bob bergerak saat jalan (>2 px)', bobMaks > 2, 'bob maks=' + bobMaks.toFixed(2));
cek('moveAmt turun ke ~0 saat diam', rStop[rStop.length - 1].move < 0.02, 'moveAmt=' + rStop[rStop.length - 1].move.toFixed(4));

// 3. arah vertikal: depth harus beda tanda atas vs bawah
diam(0.5);
const rAtas = jalan(arah.atas, 0.7);
const dAtas = rAtas[rAtas.length - 1].depth;
diam(0.5);
const rBawah = jalan(arah.bawah, 0.7);
const dBawah = rBawah[rBawah.length - 1].depth;
cek('gerak atas/bawah terdeteksi (depth beda arah)', dAtas < -0.3 && dBawah > 0.3, `depth atas=${dAtas.toFixed(3)} bawah=${dBawah.toFixed(3)}`);

// 4. condong searah jalan kiri vs kanan
diam(0.5);
const rKanan2 = jalan(arah.kanan, 0.8);
const leanKanan = rKanan2[rKanan2.length - 1].lean;
diam(0.6);
const rKiri2 = jalan(arah.kiri, 0.8);
const leanKiri = rKiri2[rKiri2.length - 1].lean;
cek('condong kiri/kanan berlawanan arah', leanKanan > 0.05 && leanKiri < -0.05, `kanan=${leanKanan.toFixed(3)} kiri=${leanKiri.toFixed(3)}`);

// 5. diagonal: semua komponen hidup
diam(0.5);
const rDiag = jalan(arah['kanan-atas'], 0.8);
const fd = rDiag[rDiag.length - 1];
cek('diagonal: condong + depth sekaligus', fd.lean > 0.02 && fd.depth < -0.02, `lean=${fd.lean.toFixed(3)} depth=${fd.depth.toFixed(3)}`);

// 6. tidak ada NaN & render tetap jalan
const adaNaN = [fd.flip, fd.move, fd.lean, fd.depth].some((v) => !Number.isFinite(v));
cek('tidak ada NaN pada state animasi', !adaNaN, JSON.stringify(fd));
try { game.update(DT); game.render(DT, 3000); } catch (e) { errors.push('render: ' + e.stack); }
cek('render tidak error', true);

console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 10)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
