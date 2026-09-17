/**
 * VERIFIKASI FOTO MUTASI — apakah 44 foto yang dibangkitkan benar-benar
 * berfungsi & berjalan normal di dalam game.
 *
 * Dua lapis:
 *  A. Berkas: struktur PNG valid (signature/IHDR/CRC), 256×256 RGBA, bisa
 *     di-decode, tanpa sisa latar magenta, isi tidak kosong.
 *  B. Runtime (jsdom + bundle asli): game MEMILIH foto yang tepat per hero &
 *     per tier/pose, file benar-benar termuat (bukan placeholder), dan
 *     ukuran/posisi karakter tidak melompat saat berganti mutasi, dibalik
 *     kiri/kanan, atau saat bob naik-turun.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readPng, contentMetrics, magentaPixels } from './png.mjs';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const BUNDLE = process.env.PHAGOS_BUNDLE || path.join(ROOT, '.tmp-bundle.js');
const OUT = process.env.PHAGOS_REPORT || path.join(ROOT, 'tools', 'mutation-art', 'VERIFY-REPORT.json');

/**
 * VERIFIKASI FOTO MUTASI (44 foto: 11 hero x 2 tingkat x 2 pose).
 *
 *   node tools/verify-mutation-photos.mjs
 *
 * Bagian A (berkas) SELALU jalan — cuma butuh Node.
 * Bagian B (runtime) & C (kartu level-up) butuh bundle + jsdom:
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom            # atau: npm i jsdom (sekali)
 *   node tools/verify-mutation-photos.mjs
 *
 * Keluar dengan kode 1 bila ada yang tidak beres.
 */

const errors = [];
const report = { berkas: {}, runtime: {}, ringkasan: {} };

// ============================ A. PEMERIKSAAN BERKAS ============================
const heroes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/heroes.json'), 'utf8')).heroes;
const FIELDS = ['spriteMut1Idle', 'spriteMut1Attack', 'spriteMut2Idle', 'spriteMut2Attack'];

const fileRows = [];
let fileFails = 0;
for (const h of heroes) {
  const base = path.join(ROOT, h.spriteIdle);
  const basePng = readPng(base);
  const baseM = contentMetrics(basePng.rgba, basePng.w, basePng.h);
  const row = { hero: h.id, base: { size: `${basePng.w}x${basePng.h}`, tinggi: +baseM.height.toFixed(3), dasar: +baseM.bottom.toFixed(3), pusat: +baseM.cx.toFixed(3) }, foto: [] };
  if (!basePng.ok) { errors.push(`sprite dasar ${h.id}: ${basePng.errs.join(', ')}`); fileFails++; }
  for (const f of FIELDS) {
    const rel = h[f];
    const p = path.join(ROOT, rel);
    const cell = { field: f, file: rel };
    if (!fs.existsSync(p)) { cell.status = 'TIDAK ADA'; errors.push(`${rel} tidak ada`); fileFails++; row.foto.push(cell); continue; }
    const png = readPng(p);
    cell.size = `${png.w}x${png.h}`;
    cell.pngValid = png.ok;
    cell.crcOK = png.crcOK;
    if (!png.ok) { cell.status = 'PNG RUSAK'; errors.push(`${rel}: ${png.errs.join(', ')}`); fileFails++; row.foto.push(cell); continue; }
    if (png.w !== 256 || png.h !== 256) { cell.status = 'UKURAN SALAH'; errors.push(`${rel}: ${png.w}x${png.h} (harus 256x256)`); fileFails++; }
    const m = contentMetrics(png.rgba, png.w, png.h);
    const mag = magentaPixels(png.rgba);
    cell.tutupan = +(m.coverage * 100).toFixed(1);
    cell.magenta = mag;
    cell.tinggi = +m.height.toFixed(3);
    cell.dasar = +m.bottom.toFixed(3);
    cell.pusat = +m.cx.toFixed(3);
    // acuan = rata-rata pose idle & serang sprite dasar (sesuai build script)
    cell.dTinggi = +Math.abs(m.height - baseM.height).toFixed(3);
    cell.dDasar = +Math.abs(m.bottom - baseM.bottom).toFixed(3);
    cell.dPusat = +Math.abs(m.cx - baseM.cx).toFixed(3);
    const bad = [];
    if (mag > 0) bad.push(`magenta ${mag}px`);
    if (m.coverage < 0.08) bad.push(`isi cuma ${(m.coverage * 100).toFixed(1)}%`);
    if (m.coverage > 0.60) bad.push(`isi ${(m.coverage * 100).toFixed(1)}% (terlalu penuh)`);
    if (!png.crcOK) bad.push('CRC tidak cocok');
    cell.status = bad.length ? 'PERIKSA: ' + bad.join(', ') : 'OK';
    if (bad.length) { errors.push(`${rel}: ${bad.join(', ')}`); fileFails++; }
    row.foto.push(cell);
  }
  fileRows.push(row);
}
report.berkas = { hero: fileRows.length, foto: fileRows.length * 4, gagal: fileFails };

// ============================ B. PEMERIKSAAN RUNTIME ============================
let JSDOM = null;
try { ({ JSDOM } = await import('jsdom')); } catch { /* jsdom opsional */ }
let dom = null;
let window = null;
try {
  dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
    url: 'https://8000-example.e2b.app/', pretendToBeVisual: true, runScripts: 'outside-only',
  });
  window = dom.window;
} catch (e) {
  console.log('\n=== B/C. RUNTIME: dilewati (' + (JSDOM ? e.message : 'jsdom belum terpasang') + ') ===');
}
if (!window) {
  console.log('\n=== B/C. RUNTIME: dilewati (jsdom belum terpasang) ===');
  console.log('  npm i -D jsdom, lalu jalankan ulang untuk memeriksa pemakaian foto di dalam game.');
} else if (!fs.existsSync(BUNDLE)) {
  console.log(`\n=== B/C. RUNTIME: dilewati (bundle ${BUNDLE} belum ada) ===`);
  console.log('  npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife');
  JSDOM = null;
}

if (!JSDOM) {
  report.ringkasan = { fotoBerkas: report.berkas.foto, berkasGagal: fileFails, runtime: 'dilewati', totalError: errors.length };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\n=== ERROR (${errors.length}) ===`);
  for (const e of errors.slice(0, 30)) console.log('- ' + e);
  process.exit(errors.length ? 1 : 0);
}

window.addEventListener('error', (e) => errors.push('window.error: ' + (e.error?.stack || e.message)));
const realWarn = console.warn;
const realErr = console.error;
console.error = (...a) => { const s = a.map(String).join(' '); if (/placeholder|tidak di-preload|sprite tidak ditemukan/.test(s)) errors.push('sprite fallback: ' + s); };

// --- ctx palsu: catat drawImage + matriks transform (untuk deteksi flip) ---
const draws = [];
function makeCtx(canvas) {
  const st = { m: [1, 0, 0, 1, 0, 0], stack: [] };
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const grad = { addColorStop() {} };
  const base = {
    canvas,
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    createConicGradient: () => grad,
    createPattern: () => null,
    measureText: () => ({ width: 0 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h }),
    putImageData() {},
    save() { st.stack.push(st.m.slice()); },
    restore() { const p = st.stack.pop(); if (p) st.m = p; },
    translate(x, y) { st.m = mul(st.m, [1, 0, 0, 1, x, y]); },
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); st.m = mul(st.m, [c, s, -s, c, 0, 0]); },
    scale(x, y) { st.m = mul(st.m, [x, 0, 0, y, 0, 0]); },
    setTransform(a, b, c, d, e, f) { st.m = [a, b, c, d, e, f]; },
    resetTransform() { st.m = [1, 0, 0, 1, 0, 0]; },
    transform(a, b, c, d, e, f) { st.m = mul(st.m, [a, b, c, d, e, f]); },
    drawImage(img, dx, dy, dw, dh) {
      const m = st.m;
      const cx = m[0] * (dx + (dw || 0) / 2) + m[2] * (dy + (dh || 0) / 2) + m[4];
      const cy = m[1] * (dx + (dw || 0) / 2) + m[3] * (dy + (dh || 0) / 2) + m[5];
      const det = m[0] * m[3] - m[1] * m[2];
      const k = Math.sqrt(Math.abs(det)); // faktor skala (kebal rotasi)
      const w = k * (dw || 0);
      const h = k * (dh || 0);
      draws.push({
        src: String(img?.src || img?.__src || '').split('?')[0].replace(/^https?:\/\/[^/]+\//, ''),
        wImg: img?.naturalWidth || img?.width || 0,
        hImg: img?.naturalHeight || img?.height || 0,
        cx, cy, w, h,
        flip: (m[0] * m[3] - m[1] * m[2]) < 0 ? -1 : 1,
      });
    },
    _st: st,
  };
  const styleProps = /(Style$|^font$|^lineWidth$|^lineCap$|^lineJoin$|^globalAlpha$|^globalCompositeOperation$|^filter$|^shadow|^imageSmoothing|^textAlign$|^textBaseline$|^miterLimit$|^letterSpacing$|^wordSpacing$|^direction$)/;
  return new Proxy(base, {
    get(t, p) {
      if (p in t) return t[p];
      if (typeof p !== 'string') return undefined;
      if (styleProps.test(p)) return '';
      return (t[p] = () => undefined);
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
window.HTMLCanvasElement.prototype.getContext = function () {
  if (!this.__ctx) this.__ctx = makeCtx(this);
  return this.__ctx;
};
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

// --- Image: DEKODE berkas asli. Gagal → onerror (loader jatuh ke placeholder) ---
const loaded = new Map();
Object.defineProperty(window.HTMLImageElement.prototype, 'src', {
  set(v) {
    this.setAttribute('src', v);
    const rel = String(v).split('?')[0].replace(/^https?:\/\/[^/]+\//, '').replace(/^\.?\//, '');
    const file = path.join(ROOT, decodeURIComponent(rel));
    setTimeout(() => {
      let info = loaded.get(file);
      if (info === undefined) {
        try { info = readPng(file, { decode: false }); } catch (e) { info = { ok: false, errs: [e.message] }; }
        loaded.set(file, info);
      }
      if (info?.ok && info.w) {
        this.width = info.w;   // naturalWidth/naturalHeight mengikuti width/height
        this.height = info.h;
        this.dispatchEvent(new window.Event('load'));
      } else {
        this.dispatchEvent(new window.Event('error'));
      }
    }, 0);
  },
  get() { return this.getAttribute('src') || ''; },
});
for (const p of ['naturalWidth', 'naturalHeight']) {
  Object.defineProperty(window.HTMLImageElement.prototype, p, { get() { return this.width || 0; }, configurable: true });
}
window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () {};
window.fetch = async (url) => {
  const u = String(url).replace(/^\.?\//, '').split('?')[0].split('#')[0];
  const file = path.join(ROOT, decodeURIComponent(u));
  try {
    const buf = fs.readFileSync(file);
    return { ok: true, status: 200, url, async text() { return buf.toString('utf8'); }, async json() { return JSON.parse(buf.toString('utf8')); },
      async arrayBuffer() { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); } };
  } catch {
    return { ok: false, status: 404, url, async text() { return ''; }, async json() { throw new Error('404 ' + u); }, async arrayBuffer() { return new ArrayBuffer(0); } };
  }
};
const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {}, setValueCurveAtTime() {} });
function genericNode() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (typeof p !== 'string') return undefined;
      if (p === 'connect') return (t[p] = (d) => d);
      if (/^(disconnect|start|stop)$/.test(p)) return (t[p] = () => undefined);
      return (t[p] = param());
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
window.AudioContext = class {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = genericNode(); this.sampleRate = 44100; }
  createGain() { const g = { gain: param(), connect: (d) => d, disconnect() {} }; return g; }
  createOscillator() { return { type: 'sine', frequency: param(), connect: (d) => d, start() {}, stop() {}, onended: null }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: param(), connect: (d) => d, start() {}, stop() {}, onended: null, detune: param() }; }
  createBuffer(ch, len) { return { length: len, numberOfChannels: ch, duration: len / 44100, getChannelData: () => new Float32Array(len) }; }
  decodeAudioData() { return Promise.resolve(this.createBuffer(2, 44100)); }
  resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
};
let rafId = 0;
window.requestAnimationFrame = (cb) => { const id = ++rafId; setTimeout(() => cb(Date.now()), 16); return id; };
window.cancelAnimationFrame = () => {};
window.devicePixelRatio = 1;

// --- jalankan bundle ---
try { window.eval(fs.readFileSync(BUNDLE, 'utf8')); } catch (e) { errors.push('bundle throw: ' + e.stack); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
while (Date.now() - t0 < 15000 && !window.__IMUNVERSE) await sleep(50);
await sleep(1500);
// Hentikan loop game: verifikasi butuh posisi pemain & kamera yang IDENTIK
// antar kasus, jadi perbedaan yang terukur murni karena ganti foto mutasi.
window.requestAnimationFrame = () => 0;
await sleep(120);
const API = window.__IMUNVERSE;
if (!API) errors.push('game tidak pernah siap (__IMUNVERSE tidak ada)');

const mutData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/mutations.json'), 'utf8'));
const muts = mutData.mutations || mutData;
const tierIds = (t) => muts.filter((m) => (m.tier || 1) === t).map((m) => m.id);
const tier1 = tierIds(1);
const tier3 = tierIds(2).concat(tierIds(3));

const runtimeRows = [];
if (API?.game) {
  const { game } = API;
  // P7: TUNGGU sampai semua foto mutasi benar-benar terdekode. Sebelumnya tes
  // menunggu 1,5 detik tetap — itu kadang selesai SEBELUM ~250 sprite selesai
  // dibaca, sehingga hero yang diukur PERTAMA tampak memakai foto dasar (dan
  // tertangkap sebagai "foto tidak berubah" palsu).
  const butuh = [];
  for (const h of heroes) {
    for (const k of ['spriteIdle', 'spriteAttack', 'spriteMut1Idle', 'spriteMut1Attack', 'spriteMut2Idle', 'spriteMut2Attack']) {
      if (h[k]) butuh.push(h[k]);
    }
  }
  let siap = false;
  for (let i = 0; i < 150 && !siap; i++) {
    siap = butuh.every((p) => API.sprites?.has(p));
    if (!siap) await sleep(100);
  }
  if (!siap) {
    const st = API.sprites?.stats?.() || {};
    errors.push(`foto belum siap: ${butuh.filter((p) => !API.sprites.has(p)).length}/${butuh.length} belum termuat (cache=${st.loaded}, placeholder=${st.placeholder})`);
  }
  for (const h of heroes) {
    const row = { hero: h.id, langkah: [] };
    try {
      game.startRun(h.id);
      await sleep(60);
      const player = game.run?.player;
      if (!player) { row.langkah.push({ kasus: 'mulai run', hasil: 'GAGAL: player tidak ada' }); errors.push(`${h.id}: player tidak ada`); runtimeRows.push(row); continue; }
      // kunci squash/bob agar ukuran bisa dibandingkan
      const fixed = () => { player.squash = 0; player.iframes = 0; player.attackFlash = 0; player.facing = 0; player.moving = false; };
      // render SAJA (tanpa update) supaya posisi pemain & kamera identik antar
      // kasus → perbedaan yang terukur murni karena ganti foto mutasi.
      const renderCase = async (label, mutIds, { attack = false, facing = 0, time = 5000, flip = null } = {}) => {
        fixed();
        game.run.activeMutations = mutIds;
        // Tahap evolusi (BASE → MUT1 → MUT2 → APEX) disimpan di run.evoStage
        // dan hanya diperbarui saat pemain MEMILIH mutasi (game.chooseLevelUp).
        // Tes ini menyetel activeMutations langsung, jadi tahapnya harus
        // dihitung ulang — bila tidak, renderer akan tetap memakai foto BASE
        // dan tes melaporkan "foto tidak berubah" palsu.
        game.run.evoStage = null;
        player.attackFlash = attack ? 0.12 : 0; // detik (bukan piksel)
        player.swing = 0;
        player.facing = facing;
        // flip sekarang DIHALUSKAN (animFlip lewat 0 saat berbalik) — jalankan
        // beberapa tick update tanpa input supaya balikannya selesai sebelum
        // kita mengukur (tanpa ini flip masih ≈ +1 dan tes keliru).
        for (let _i = 0; _i < 40; _i++) {
          player.update(1 / 60, { x: 0, y: 0, magnitude: 0 }, game);
          player.attackFlash = attack ? 0.12 : 0; // update mengurangi timer
        }
        // Facing dibalik lewat animFlip yang DIHALUSKAN, dan update TANPA input
        // akan mengembalikan facing ke 0 — jadi untuk kasus "menghadap kiri"
        // kita kunci keadaan balikannya SETELAH tick (itulah keadaan mapan saat
        // pemain benar-benar berjalan ke kiri).
        if (flip != null) { player.facing = flip < 0 ? Math.PI : 0; player.animFlip = flip; }
        draws.length = 0;
        game.render(16, time);
        await sleep(10);
        const mine = draws.filter((d) => d.src.includes(`hero_${h.id}_`) || d.src.includes(`hero_${h.id}.`));
        const last = mine[mine.length - 1] || null;

        row.langkah.push({ kasus: label, file: last?.src || '(tidak digambar)', w: last ? +last.w.toFixed(2) : null, h: last ? +last.h.toFixed(2) : null, cx: last ? +last.cx.toFixed(2) : null, dasar: last ? +(last.cy + last.h / 2).toFixed(2) : null, flip: last?.flip, img: last ? `${last.wImg}x${last.hImg}` : null });
        return last;
      };
      const expPath = (p) => p; // path di data/heroes.json sudah relatif root
      const a = await renderCase('tanpa mutasi (dasar)', []);
      const b = await renderCase('tier 1 idle', tier1.slice(0, 1));
      const c = await renderCase('tier 1 serang', tier1.slice(0, 1), { attack: true });
      const d = await renderCase('tier 2/3 idle', tier3.slice(0, 3));
      const e = await renderCase('tier 2/3 serang', tier3.slice(0, 3), { attack: true });
      const f = await renderCase('tier 2/3 menghadap kiri', tier3.slice(0, 3), { facing: Math.PI, flip: -1 });
      const g2 = await renderCase('tier 2/3 bob (waktu beda)', tier3.slice(0, 3), { time: 6400 });

      const expect = {
        'tanpa mutasi (dasar)': expPath(h.spriteIdle),
        'tier 1 idle': expPath(h.spriteMut1Idle),
        'tier 1 serang': expPath(h.spriteMut1Attack),
        'tier 2/3 idle': expPath(h.spriteMut2Idle),
        'tier 2/3 serang': expPath(h.spriteMut2Attack),
        'tier 2/3 menghadap kiri': expPath(h.spriteMut2Idle),
        'tier 2/3 bob (waktu beda)': expPath(h.spriteMut2Idle),
      };
      for (const s of row.langkah) {
        const want = expect[s.kasus];
        if (!want) continue;
        if (s.file !== want) { s.status = `SALAH: diharapkan ${want}`; errors.push(`${h.id} ${s.kasus}: gambar ${s.file}, diharapkan ${want}`); }
        else s.status = 'OK';
        const isBase = s.kasus.startsWith('tanpa mutasi');
        if (!isBase && s.img && s.img !== '256x256') { s.status += ` | ukuran gambar ${s.img}`; errors.push(`${h.id} ${s.kasus}: ukuran ${s.img}`); }
      }
      // Kelompok IDLE: dasar ↔ mut1 ↔ mut2 — posisi & ukuran harus identik.
      const idle = [a, b, d].filter(Boolean);
      const serang = [c, e].filter(Boolean);
      const sizes = [a, b, c, d, e, f].filter(Boolean).map((x) => x.w);
      const dW = sizes.length > 1 ? Math.max(...sizes) - Math.min(...sizes) : null;
      const spread = (arr, key) => {
        const v = arr.map((x) => x[key]);
        return v.length > 1 ? Math.max(...v) - Math.min(...v) : 0;
      };
      const dCx = spread(idle, 'cx');
      const dCy = spread(idle, 'cy');
      const dCxSerang = spread(serang, 'cx');
      const dCySerang = spread(serang, 'cy');
      const dFlipCx = f && d ? Math.abs(f.cx - d.cx) : null;
      const dFlipCy = f && d ? Math.abs(f.cy - d.cy) : null;
      // P7: badan kini BERPOROS DI GARIS BAWAH (anti mengambang). Konsekuensinya
      // pusat-y WAJAR bergerak saat badan memipih/memanjang — yang harus tetap
      // kaku (supaya ganti foto tidak melompat) adalah GARIS BAWAH-nya.
      const spreadKunci = (arr, kunci) => {
        const v = arr.map((x) => x[kunci]).filter((v) => typeof v === 'number');
        return v.length > 1 ? Math.max(...v) - Math.min(...v) : 0;
      };
      const dDasarIdle = spreadKunci(idle, 'dasar');
      const dDasarSerang = spreadKunci(serang, 'dasar');
      const dFlipDasar = f && d ? Math.abs((f.dasar == null ? 0 : f.dasar) - (d.dasar == null ? 0 : d.dasar)) : null;
      const bobDasar = g2 && d ? Math.abs((g2.dasar == null ? 0 : g2.dasar) - (d.dasar == null ? 0 : d.dasar)) : null;
      row.delta = {
        lebar: dW == null ? null : +dW.toFixed(2),
        idlePusatX: +dCx.toFixed(2),
        idlePusatY: +dCy.toFixed(2),
        serangPusatX: +dCxSerang.toFixed(2),
        serangPusatY: +dCySerang.toFixed(2),
        balikPusatX: dFlipCx == null ? null : +dFlipCx.toFixed(2),
        balikPusatY: dFlipCy == null ? null : +dFlipCy.toFixed(2),
        idleGarisBawah: +dDasarIdle.toFixed(2),
        serangGarisBawah: +dDasarSerang.toFixed(2),
        balikGarisBawah: dFlipDasar == null ? null : +dFlipDasar.toFixed(2),
        bobGarisBawah: bobDasar == null ? null : +bobDasar.toFixed(2),
        flipKiri: f?.flip === -1 ? 'OK' : `flip=${f?.flip}`,
        bobNaikTurun: g2 && d ? +Math.abs(g2.cy - d.cy).toFixed(2) : null,
        bobGeserSamping: g2 && d ? +Math.abs(g2.cx - d.cx).toFixed(2) : null,
        bobUkuran: g2 && d ? +Math.abs(g2.w - d.w).toFixed(2) : null,
      };
      const cek = (nama, nilai, batas) => {
        if (nilai == null) return;
        if (nilai > batas) errors.push(`${h.id}: ${nama} berubah ${nilai}px (batas ${batas})`);
      };
      cek('lebar antar mutasi', dW, 0.5);
      cek('pusat-x idle antar mutasi', dCx, 0.5);
      // P7: pusat-y boleh bergerak ≤3 px — itu deformasi berporos bawah
      // (badan memipih/memanjang), BUKAN foto bergeser.
      cek('pusat-y idle antar mutasi (deformasi wajar)', dCy, 3.0);
      cek('pusat-x pose serang', dCxSerang, 0.5);
      cek('pusat-y pose serang (deformasi wajar)', dCySerang, 3.0);
      cek('pusat-x saat dibalik', dFlipCx, 0.5);
      cek('pusat-y saat dibalik (deformasi wajar)', dFlipCy, 3.0);
      // Garis bawah = telapak sel. Inilah yang harus KAKU: kalau ini bergeser,
      // berarti foto melompat (penjepit frame gagal) atau badan mengambang.
      cek('garis bawah idle antar mutasi', dDasarIdle, 0.5);
      cek('garis bawah pose serang', dDasarSerang, 0.5);
      cek('garis bawah saat dibalik', dFlipDasar, 0.5);
      cek('garis bawah diam saat bob (ANTI MENGAMBANG)', bobDasar, 0.6);
      cek('geser samping saat bob', row.delta.bobGeserSamping, 0.5);
      cek('ukuran berubah saat bob', row.delta.bobUkuran, 0.5);
      if (f?.flip !== -1) errors.push(`${h.id}: menghadap kiri tidak membalik sprite`);
      if (row.delta.bobNaikTurun != null && row.delta.bobNaikTurun > 12) {
        errors.push(`${h.id}: bob vertikal ${row.delta.bobNaikTurun}px terlalu besar`);
      }
    } catch (e) {
      errors.push(`${h.id}: ${e.stack || e.message}`);
      row.error = String(e.message || e);
    }
    runtimeRows.push(row);
  }
}
// ---- C. KARTU LEVEL-UP: foto dipakai sebagai potret adegan & ikon kartu ----
if (API?.game) {
  const { game } = API;
  const levelupRows = [];
  const mutData2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/mutations.json'), 'utf8'));
  const all2 = mutData2.mutations || mutData2;
  for (const h of heroes) {
    const row = { hero: h.id, potret: null, kartu: {} };
    try {
      game.startRun(h.id);
      await sleep(40);
      const buat = (tier) => {
        const tierN = all2.filter((m) => (m.tier || 1) === tier);
        return (tierN[0] ? [tierN[0]] : []).map((m) => ({ id: m.id, name: m.name, tier: m.tier, isMutation: true }));
      };
      const cekLayar = async (tier) => {
        // pakai layar dari bundle (bukan impor modul terpisah) supaya state sama
        API.screenManager.show('levelup', { level: 2, choices: buat(tier) });
        await sleep(60);
        const img = window.document.getElementById('levelup-hero');
        const cards = Array.from(window.document.querySelectorAll('#levelup-choices .mut-form'));
        return { potret: img ? String(img.getAttribute('src') || img.src).split('?')[0] : null, kartu: cards.map((c) => String(c.getAttribute('src') || '').split('?')[0]) };
      };
      // tier 1: potret adegan = foto mut1
      game.run.activeMutations = (all2.filter((m) => (m.tier || 1) === 1).slice(0, 1)).map((m) => m.id);
      const t1 = await cekLayar(1);
      row.potretTier1 = t1.potret;
      row.kartuTier1 = t1.kartu[0] || null;
      game.run.activeMutations = all2.filter((m) => (m.tier || 1) >= 2).slice(0, 2).map((m) => m.id);
      const t2 = await cekLayar(2);
      row.potretTier2 = t2.potret;
      row.kartuTier2 = t2.kartu[0] || null;
      const want1 = h.spriteMut1Idle, want2 = h.spriteMut2Idle;
      if (row.potretTier1 !== want1) { row.status = `potret tier1 ${row.potretTier1} ≠ ${want1}`; errors.push(`${h.id}: potret level-up tier 1 = ${row.potretTier1}, diharapkan ${want1}`); }
      else if (row.potretTier2 !== want2) { row.status = `potret tier2 ${row.potretTier2} ≠ ${want2}`; errors.push(`${h.id}: potret level-up tier 2 = ${row.potretTier2}, diharapkan ${want2}`); }
      else if (row.kartuTier1 !== want1) { row.status = `kartu tier1 ${row.kartuTier1} ≠ ${want1}`; errors.push(`${h.id}: ikon kartu tier 1 = ${row.kartuTier1}, diharapkan ${want1}`); }
      else if (row.kartuTier2 !== want2) { row.status = `kartu tier2 ${row.kartuTier2} ≠ ${want2}`; errors.push(`${h.id}: ikon kartu tier 2 = ${row.kartuTier2}, diharapkan ${want2}`); }
      else row.status = 'OK';
    } catch (e) {
      row.status = 'GAGAL: ' + (e.message || e);
      errors.push(`${h.id} level-up: ${e.stack || e.message}`);
    }
    levelupRows.push(row);
  }
  report.levelup = levelupRows;
}

report.runtime = { hero: runtimeRows.length, baris: runtimeRows };

// ============================ LAPORAN ============================
console.error = realErr;
console.warn = realWarn;
report.ringkasan = {
  fotoBerkas: report.berkas.foto,
  berkasGagal: fileFails,
  heroDiuji: runtimeRows.length,
  kasusDiuji: runtimeRows.reduce((n, r) => n + r.langkah.length, 0),
  totalError: errors.length,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

console.log('=== A. BERKAS (PNG 256x256, RGBA, CRC, magenta, isi) ===');
for (const r of fileRows) {
  const bad = r.foto.filter((c) => c.status !== 'OK');
  console.log(`  ${r.hero.padEnd(11)} dasar ${r.base.size} t=${r.base.tinggi} d=${r.base.dasar} c=${r.base.pusat} | foto ${r.foto.length - bad.length}/${r.foto.length} OK` +
    (bad.length ? '  << ' + bad.map((c) => c.field + ': ' + c.status).join('; ') : ''));
}
console.log('\n=== B. RUNTIME (pilihan foto + tidak melompat) ===');
for (const r of runtimeRows) {
  const wrong = r.langkah.filter((s) => s.status && s.status !== 'OK');
  console.log(`  ${r.hero.padEnd(11)} ${r.langkah.length - wrong.length}/${r.langkah.length} sesuai | Δlebar=${r.delta?.lebar} Δidle=(${r.delta?.idlePusatX},${r.delta?.idlePusatY}) Δserang=(${r.delta?.serangPusatX},${r.delta?.serangPusatY}) Δbalik=(${r.delta?.balikPusatX},${r.delta?.balikPusatY}) flip=${r.delta?.flipKiri} bob=(${r.delta?.bobGeserSamping},${r.delta?.bobNaikTurun})` +
    (wrong.length ? '\n      << ' + wrong.map((s) => `${s.kasus}: ${s.status}`).join('; ') : ''));
}
if (report.levelup) {
  console.log('\n=== C. KARTU LEVEL-UP (potret adegan + ikon kartu) ===');
  for (const r of report.levelup) console.log(`  ${r.hero.padEnd(11)} ${r.status}`);
}
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 30)) console.log('- ' + e);
console.log(`\nlaporan lengkap: ${OUT}`);
process.exit(errors.length ? 1 : 0);
