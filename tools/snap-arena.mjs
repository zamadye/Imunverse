#!/usr/bin/env node
/**
 * snap-arena.mjs — snapshot VISION arena nyata tanpa Chromium.
 *
 * Latar: sandbox ini tidak bisa menjalankan Chromium (CDN browser diblokir,
 * library sistem browser tidak ada). Sebagai gantinya game boot ASLI
 * (js/main.js) dijalankan di Node + jsdom, dengan Canvas 2D dirender oleh
 * Skia — mesin grafis yang SAMA dipakai Chromium — via @napi-rs/canvas.
 * Piksel yang dihasilkan setara render Canvas2D Chromium (jalur fallback 2D;
 * lapisan enhancement WebGL/body-gl nonaktif dan TERCATAT sebagai batas).
 *
 *   npm i --no-save @napi-rs/canvas   # sekali saja (tidak masuk package.json)
 *   npm run snap            # = node tools/snap-arena.mjs [outDir]
 *
 * Alur ≈ tools/shoot-arena.mjs + ekstra: dashboard, lockdown, swarm (+ deret
 * 4 frame gerak), close-up patogen, purified, open-door, denah map, dan
 * lompat zona (heart/lung/capillary) + dump status HUD DOM.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import napi from '@napi-rs/canvas';

const { createCanvas, loadImage } = napi;
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT = process.argv[2] || 'shots';
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- jsdom --
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'http://127.0.0.1:8123/', pretendToBeVisual: true, runScripts: 'outside-only',
});
const { window } = dom;
for (const k of ['window', 'document', 'navigator', 'location', 'localStorage',
  'HTMLElement', 'HTMLCanvasElement', 'HTMLImageElement', 'HTMLMediaElement',
  'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'TouchEvent',
  'MutationObserver', 'DOMParser', 'XMLSerializer', 'FormData', 'Blob',
  'requestAnimationFrame', 'cancelAnimationFrame']) {
  try { if (window[k] !== undefined) globalThis[k] = window[k]; } catch { /* abaikan */ }
}
globalThis.window = window;
globalThis.document = window.document;
globalThis.self = window;
Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
globalThis.matchMedia = window.matchMedia;
// Paksa fallback analitik Rive secara bersih (runtime .riv butuh browser):
globalThis.WebAssembly = undefined;
try { window.WebAssembly = undefined; } catch { /* abaikan */ }

// ---------------------------------------------------------- rAF manual --
let nowMs = 0;
const rafQ = [];
let rafId = 0;
const requestAnimationFrame = (cb) => { rafQ.push(cb); return ++rafId; };
const cancelAnimationFrame = () => {};
window.requestAnimationFrame = requestAnimationFrame;
window.cancelAnimationFrame = cancelAnimationFrame;
globalThis.requestAnimationFrame = requestAnimationFrame;
globalThis.cancelAnimationFrame = cancelAnimationFrame;

async function frames(n, dtms = 1000 / 60) {
  for (let i = 0; i < n; i++) {
    nowMs += dtms;
    const q = rafQ.splice(0, rafQ.length);
    for (const cb of q) {
      try { cb(nowMs); } catch (e) { console.error('[raf]', e && e.message ? e.message : e); }
    }
    if (i % 5 === 4) await new Promise((r) => setImmediate(r));
  }
}

// ---------------------------------------------------------------- fetch --
const nativeFetch = globalThis.fetch;
async function repoFetch(u, opts) {
  const s = String(u);
  if (/^https?:\/\//.test(s) && !s.includes('127.0.0.1')) return nativeFetch(s, opts);
  const rel = decodeURIComponent(s.replace(/^https?:\/\/[^/]+\//, '').split('?')[0]).replace(/^\//, '');
  const f = path.join(ROOT, rel);
  if (!rel || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    return { ok: false, status: 404, json: async () => { throw new Error('nf'); }, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
  }
  const buf = fs.readFileSync(f);
  return {
    ok: true, status: 200,
    json: async () => JSON.parse(buf.toString('utf8')),
    text: async () => buf.toString('utf8'),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}
globalThis.fetch = repoFetch;
window.fetch = repoFetch;

// --------------------------------------------------------------- audio --
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

// -------------------------------------------------------------- canvas --
function backing(el) {
  const w = Math.max(1, el.width || 300), h = Math.max(1, el.height || 150);
  if (!el._napi || el._napi.width !== w || el._napi.height !== h) {
    el._napi = createCanvas(w, h); // resize = reset state (seperti browser)
  }
  return el._napi;
}
function resolveSrc(s) {
  if (!s) return s;
  if (s instanceof window.HTMLCanvasElement) return backing(s);
  if (s && s._napiImg) return s._napiImg;
  return s;
}
function stableCtx(el) {
  return new Proxy({}, {
    get(_t, p) {
      if (p === 'canvas') return el;
      const rc = backing(el).getContext('2d');
      const v = rc[p];
      if (typeof v === 'function') {
        if (p === 'drawImage') return (img, ...a) => rc.drawImage(resolveSrc(img), ...a);
        if (p === 'createPattern') return (img, rep) => rc.createPattern(resolveSrc(img), rep);
        return v.bind(rc);
      }
      return v;
    },
    set(_t, p, v) { backing(el).getContext('2d')[p] = v; return true; },
  });
}
const canvasProto = window.HTMLCanvasElement.prototype;
canvasProto.getContext = function (type) {
  const t = String(type).toLowerCase();
  if (t === '2d') {
    if (!this._ctx2d) this._ctx2d = stableCtx(this);
    return this._ctx2d;
  }
  return null; // webgl → paksa jalur 2D (dicatat di laporan)
};
canvasProto.toDataURL = function (...a) { return backing(this).toDataURL(...a); };
canvasProto.toBuffer = function (...a) { return backing(this).toBuffer(...a); };

// --------------------------------------------------------------- Image --
class FakeImage {
  constructor() {
    this._img = null; this.onload = null; this.onerror = null;
    this.complete = false; this.width = 0; this.height = 0;
    this.naturalWidth = 0; this.naturalHeight = 0; this._src = '';
  }
  set src(v) { this._src = String(v); this._load(); }
  get src() { return this._src; }
  get _napiImg() { return this._img; }
  async _load() {
    try {
      const u = this._src.split('?')[0];
      let img;
      if (u.startsWith('data:')) {
        img = await loadImage(Buffer.from(u.split(',')[1] || '', 'base64'));
      } else {
        const rel = decodeURIComponent(u.replace(/^https?:\/\/[^/]+\//, '').replace(/^\//, ''));
        img = await loadImage(path.join(ROOT, rel));
      }
      this._img = img;
      this.width = this.naturalWidth = img.width;
      this.height = this.naturalHeight = img.height;
      this.complete = true;
      if (this.onload) this.onload();
    } catch (e) {
      if (this.onerror) this.onerror(e);
    }
  }
}
window.Image = FakeImage;
globalThis.Image = FakeImage;

// ---------------------------------------------------------- boot game --
let spriteFallbacks = 0;
let chamberCanvasErrors = 0;
const origWarn = console.warn;
console.warn = (...a) => {
  const s = String(a[0]);
  if (s.includes('sprite-loader')) spriteFallbacks++;
  if (s.includes('[phagos] chamberCanvas')) chamberCanvasErrors++;
  else origWarn(...a);
};

// Guard P0: statistik piksel (mean/sd) dari sampling kasar.
function frameStats() {
  const cv = backing(canvasEl);
  const g = cv.getContext('2d');
  const d = g.getImageData(0, 0, cv.width, cv.height).data;
  let n = 0, mean = 0, m2 = 0;
  for (let i = 0; i < d.length; i += 64) {
    const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
    n++; const delta = v - mean; mean += delta / n; m2 += delta * (v - mean);
  }
  return { mean, sd: Math.sqrt(m2 / Math.max(1, n)) };
}
const p0stats = {};
function shotP0(name, key) {
  shot(name);
  p0stats[key] = frameStats();
  p0stats[key].foes = (window.__IMUNVERSE.game.run.enemies || []).length;
  console.log(`[p0] ${key}: mean=${p0stats[key].mean.toFixed(1)} sd=${p0stats[key].sd.toFixed(1)} foes=${p0stats[key].foes}`);
}

await import(pathToFileURL(path.join(ROOT, 'js/main.js')).href);
const t0 = Date.now();
while (!window.__IMUNVERSE && Date.now() - t0 < 60000) await frames(10);
if (!window.__IMUNVERSE) { console.error('BOOT GAGAL: __IMUNVERSE tidak muncul'); process.exit(2); }
await frames(30);
console.log('[boot] OK, sprite fallback =', spriteFallbacks);
try {
  const sl = await import(pathToFileURL(path.join(ROOT, 'js/render/sprite-loader.js')).href);
  console.log('[boot] spriteStats =', JSON.stringify(sl.spriteStats ? sl.spriteStats() : null));
} catch (e) { console.log('[boot] spriteStats gagal:', e.message); }

const G = window.__IMUNVERSE;
const canvasEl = document.getElementById('game');
function shot(name) {
  const f = path.join(OUT, name);
  fs.writeFileSync(f, backing(canvasEl).toBuffer('image/png'));
  console.log('[shot]', f);
}
const chamber = () => G.game.run && G.game.run.chamber;
const st = () => { const c = chamber(); return c ? `${c.state} z=${G.game.run.zone || '?'}` : 'no-chamber'; };
const jst = () => {
  const j = G.game.run && G.game.run.journey;
  return j ? `idx=${j.index} zid=${j.zoneId} ph=${j.phase} lm=${JSON.stringify(j.landmark)} next=${j.nextIndex}` : 'no-journey';
};

// 0. dashboard (menu)
await frames(60);
shot('snap-00-dashboard.png');

// 1. mulai run → lockdown
if (process.env.ARENA_V1 === '1') { window.__ARENA_V1 = true; console.log('[info] ARENA V1 (legacy) aktif'); }
else { console.log('[info] ARENA V2 aktif (default)'); }
G.game.startRun('macrophage');
G.STATE.screen = 'gameplay';
G.game.run.introT = 10;
await frames(150);
console.log('[info] chamber =', st(), '| journey =', jst());
shotP0('snap-01-lockdown.png', 'lockdown');

// 2. tunggu swarm + deret gerak 4 frame
{
  const t1 = Date.now();
  while ((chamber() || {}).state !== 'swarm' && Date.now() - t1 < 45000) await frames(10);
}
await frames(240);
console.log('[info] chamber =', st(), '| enemies =', (G.game.run.enemies || []).length, '| journey =', jst());
try { const e0 = (G.game.run.enemies || [])[0]; console.log('[info] enemy0 =', e0 ? JSON.stringify({ fam: e0.family, kind: e0.kind, stealth: e0.stealth, r: e0.r, hp: e0.hp }) : 'none'); } catch (e) {}
shotP0('snap-02-swarm.png', 'swarm');
for (let i = 0; i < 4; i++) { await frames(6); shot(`snap-03-motion-${i}.png`); }

// 3. close-up patogen (beku + zoom)
G.game._origUpdate = G.game.update;
G.game.update = () => {};
G.game.run.camera.setCorridorZoom(1.0);
G.game.run.camera.corridorScale = G.game.run.camera.corridorTarget;
await frames(50);
shot('snap-04-pathogen-closeup.png');
if (G.game._origUpdate) { G.game.update = G.game._origUpdate; delete G.game._origUpdate; }

// 4. basmi → purified → open
for (const e of G.game.run.enemies) if (e.takeDamage) e.takeDamage(99999);
await frames(55);
console.log('[info] chamber =', st(), '| journey =', jst());
shotP0('snap-05-purified.png', 'purified');
{
  const t1 = Date.now();
  while (((chamber() || {}).state !== 'open' && (chamber() || {}).openAmt < 0.5) && Date.now() - t1 < 30000) await frames(10);
}
await frames(35);
shotP0('snap-06-open-door.png', 'open');

// 5. denah map (tahan 'map')
G.game.input.keys.add('map');
await frames(75);
shot('snap-07-map-denah.png');
G.game.input.keys.delete('map');

// 6. lompat zona: heart, lung, capillary (sudut lebar)
try {
  const { _jumpToZone } = await import(pathToFileURL(path.join(ROOT, 'js/systems/world-journey.js')).href);
  const NODE_FOR_ZONE = { heart: 'jantung', lung: 'paru', capillary: 'kapiler', usus_halus: 'usus_halus' };
  for (const [zid, nm] of [['heart', 'heart'], ['lung', 'lung'], ['capillary', 'capillary'], ['usus_halus', 'usus']]) {
    _jumpToZone(G.game, zid);
    // _jumpToZone hanya membalik flag journey — pindahkan juga pemain ke room
    // labirin yang cocok supaya activeId + kamera mengikuti (verifikasi F2).
    try {
      const lab = chamber();
      const n = lab && lab.nodes && lab.nodes.get(NODE_FOR_ZONE[zid]);
      const pl = G.game.run.player;
      if (n && pl) {
        pl.x = n.x; pl.y = n.y;
        if (pl.vx != null) { pl.vx = 0; pl.vy = 0; }
        if (pl.tx != null) { pl.tx = n.x; pl.ty = n.y; }
      }
    } catch { /* abaikan */ }
    await frames(120);
    console.log('[info] zona =', zid, 'chamber =', st(), '| active =', chamber() && chamber().activeId, '| journey =', jst());
    shot(`snap-08-zone-${nm}.png`);
  }
} catch (e) { console.log('[info] jump zona gagal:', e.message); }
// 6b. teleport verifikasi bentuk: goal (slice 5) + lambung (S7a)
for (const [nid, nm] of [['goal', 'snap-09-goal-portal.png'], ['lambung', 'snap-10-lambung-sac.png'], ['usus_besar', 'snap-11-usus-besar-haustra.png'], ['hati', 'snap-12-hati-hexdrain.png'], ['paru', 'snap-13-paru-cluster.png'], ['pankreas', 'snap-14-pankreas-duct.png']]) {
  try {
    const lab = chamber();
    const n = lab && lab.nodes && lab.nodes.get(nid);
    const pl = G.game.run.player;
    if (n && pl) {
      pl.x = n.x; pl.y = n.y;
      if (pl.vx != null) { pl.vx = 0; pl.vy = 0; }
      if (pl.tx != null) { pl.tx = n.x; pl.ty = n.y; }
    }
    await frames(120);
    console.log('[info] teleport =', nid, chamber() && chamber().activeId);
    shot(nm);
  } catch (e) { console.log('[info] snap', nid, 'gagal:', e.message); }
}

// 7. dump status HUD DOM (tidak ter-render di canvas → analisis terpisah)
{
  const hud = {};
  for (const el of document.querySelectorAll('[id*="hud"],[id*="HUD"],[id*="phago"],[id*="toast"],[id*="meter"],[id*="vial"]')) {
    hud[el.id] = { hidden: el.classList.contains('hidden'), text: (el.textContent || '').trim().slice(0, 120) };
  }
  hud.__screen = G.STATE.screen;
  hud.__run = { enemies: (G.game.run.enemies || []).length, wave: G.game.run.wave, zone: G.game.run.zone, hp: G.game.run.player && G.game.run.player.hp };
  fs.writeFileSync(path.join(OUT, 'hud-dom.json'), JSON.stringify(hud, null, 1));
  console.log('[dump] hud-dom.json');
}
// Guard P0 (roadmap Fase A): nol crash chamber + antar-state BERBEDA.
{
  const errs = [];
  if (chamberCanvasErrors > 0) errs.push(`chamberCanvas crash x${chamberCanvasErrors}`);
  const ks = ['lockdown', 'swarm', 'purified', 'open'];
  for (const k of ks) if ((p0stats[k] || {}).sd < 12) errs.push(`${k} nyaris-flat (sd<12)`);
  for (let i = 0; i < ks.length - 1; i++) {
    const d = Math.abs(p0stats[ks[i]].mean - p0stats[ks[i + 1]].mean);
    const df = Math.abs((p0stats[ks[i]].foes || 0) - (p0stats[ks[i + 1]].foes || 0));
    // Pasca-HAPUS owner: beda piksel boleh nol bila jumlah musuh beda (bukti state sim).
    if (d < 0.4 && df === 0) errs.push(`${ks[i]}~${ks[i + 1]} identik (dMean<0.4, musuh sama)`);
  }
  console.log('[p0] chamberCanvasErrors =', chamberCanvasErrors);
  console.log(`P0_GUARD=${errs.length === 0 ? 'PASS' : 'FAIL'}` + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  if (errs.length) process.exitCode = 1;
}
console.log('[done] snapshot di', OUT);
process.exit(0);
