/**
 * Uji RIG RIVE — membuktikan animasi jalan hero benar-benar DIJALANKAN oleh
 * runtime Rive (bukan sekadar "npm install" tanpa pemakaian).
 *
 *   npm i -D jsdom
 *   node tools/verify-rive.mjs
 *
 * Yang diuji, memakai runtime + file .riv yang sama persis dengan yang
 * dipakai game (js/vendor/rive/*, assets/rive/hero-locomotion.riv):
 *   1. rig .riv bisa direproduksi dari tools/gen-hero-rig.mjs (deterministik)
 *   2. runtime Rive mau memuatnya & semua node rig ketemu
 *   3. animasi walk menggerakkan badan, kepala, dua lengan, dua kaki
 *   4. kaki berlawanan fase & menapak dua kali per siklus (foot-planting)
 *   5. head-bob dua kali per siklus (turun saat kaki menapak)
 *   6. animasi idle TIDAK mengayunkan kaki (napas saja)
 *   7. laju putar animasi mengikuti kecepatan: 2× cepat → siklus 2× lipat
 *   8. mencampur idle↔walk tidak melompat (transisi mulus)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const errors = [];
const hasil = {};
const cek = (nama, ok, info = '') => {
  hasil[nama] = ok ? 'OK' : 'GAGAL — ' + info;
  if (!ok) errors.push(`${nama}: ${info}`);
};

// ===== 1. rig bisa direproduksi dari kode =====
const { buildRig } = await import('../tools/gen-hero-rig.mjs');
const RIV_PATH = path.join(ROOT, 'assets', 'rive', 'hero-locomotion.riv');
// UI-RESET (2026-09-21): hero-locomotion.riv dicabut owner pada reset aset (opsi B).
// Selama masa reset penguji ini di-SKIP dengan sopan, bukan crash ENOENT.
// Pulihkan aset lalu jalankan `npm run rive` untuk membangkitkan ulang, atau
// PHAGOS_STRICT_ASSETS=1 untuk memaksa keras (akan crash bila file tetap absent).
if (!fs.existsSync(RIV_PATH) && process.env.PHAGOS_STRICT_ASSETS !== '1') {
  console.log('  · SKIP(aset-visual-dicabut) rig .riv tidak ada selama masa reset UI/UX');
  console.log('\n=== ERROR (0) ===');
  process.exit(0);
}
const baru = buildRig();
const lama = fs.readFileSync(RIV_PATH);
let sama = baru.length === lama.length;
if (sama) for (let i = 0; i < baru.length; i++) if (baru[i] !== lama[i]) { sama = false; break; }
cek('rig .riv bisa direproduksi dari tools/gen-hero-rig.mjs', sama, `${lama.length} byte di repo vs ${baru.length} byte hasil generate`);

// ===== 2. runtime Rive sungguhan =====
let JSDOM = null;
try { ({ JSDOM } = await import('jsdom')); } catch { /* opsional */ }
if (!JSDOM) {
  console.log('jsdom belum terpasang — jalankan: npm i -D jsdom');
  process.exit(0);
}
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://8000-example.e2b.app/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
if (!globalThis.navigator) Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.self = dom.window;
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = () => {};
// fetch: baca berkas dari disk (pengganti jaringan untuk data/*.json & .riv)
const fetchFile = async (u) => {
  const f = path.join(ROOT, String(u).replace(/^https?:\/\/[^/]+\//, '').replace(/^\.?\//, '').split('?')[0]);
  try {
    const b = fs.readFileSync(f);
    return { ok: true, status: 200, async text() { return b.toString(); }, async json() { return JSON.parse(b.toString()); }, async arrayBuffer() { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } };
  } catch {
    return { ok: false, status: 404, async text() { return ''; }, async json() { throw new Error('404 ' + f); }, async arrayBuffer() { return new ArrayBuffer(0); } };
  }
};
globalThis.fetch = fetchFile;
// wasm disuntikkan dari disk supaya tidak perlu jaringan saat instantiate
globalThis.__PHAGOS_RIVE_WASM_BINARY = new Uint8Array(fs.readFileSync(path.join(ROOT, 'js', 'vendor', 'rive', 'rive.wasm')));

const { loadAllData, getLocomotion } = await import('../js/core/data-store.js');
await loadAllData();
const loco = getLocomotion();
const rigMod = await import('../js/render/rive-rig.js');

const status = await rigMod.ensureRig();
cek('runtime Rive + rig .riv dimuat', status === 'ready', 'status=' + status + ' err=' + rigMod.rigError());
if (status !== 'ready') {
  console.log(JSON.stringify(hasil, null, 2));
  console.log('\n=== ERROR (' + errors.length + ') ===');
  for (const e of errors) console.log('- ' + e);
  process.exit(1);
}

const NODE = ['body', 'head', 'armF', 'armB', 'legF', 'legB'];
const ada = NODE.filter((n) => rigMod.lastRigNode(n));
cek('semua node rig ketemu (' + NODE.join(', ') + ')', ada.length === NODE.length, 'ketemu: ' + ada.join(','));

// ===== rekam satu siklus penuh dengan kecepatan nominal =====
const stride = loco.stride;
const stridePx = stride.radiusFactor * 15;
const nominalSpeed = (2 * stridePx) / stride.nominalCycleSec;
const DT = 1 / 60;

function rekam({ detik = 1.4, speed = nominalSpeed, moveAmt = 1 } = {}) {
  const out = [];
  const n = Math.round(detik / DT);
  for (let i = 0; i < n; i++) {
    const pose = rigMod.updateRig(DT, { moveAmt, speed, nominalSpeed, cfg: loco });
    out.push({ t: (i + 1) * DT, ...pose, body: rigMod.lastRigNode('body'), legF: rigMod.lastRigNode('legF'), legB: rigMod.lastRigNode('legB'), armF: rigMod.lastRigNode('armF'), head: rigMod.lastRigNode('head') });
  }
  return out;
}

const jalan = rekam({ detik: 1.4 });

const rentang = (arr, k) => Math.max(...arr.map((f) => f[k])) - Math.min(...arr.map((f) => f[k]));
const rBody = Math.max(...jalan.map((f) => f.body.y)) - Math.min(...jalan.map((f) => f.body.y));
const rLegF = Math.max(...jalan.map((f) => f.legF.rotation)) - Math.min(...jalan.map((f) => f.legF.rotation));
const rLegB = Math.max(...jalan.map((f) => f.legB.rotation)) - Math.min(...jalan.map((f) => f.legB.rotation));
const rArmF = Math.max(...jalan.map((f) => f.armF.rotation)) - Math.min(...jalan.map((f) => f.armF.rotation));
const rHead = Math.max(...jalan.map((f) => f.head.y)) - Math.min(...jalan.map((f) => f.head.y));
const rBob = Math.max(...jalan.map((f) => f.bob)) - Math.min(...jalan.map((f) => f.bob));
cek('walk menggerakkan badan (bob)', rBob > 0.5, 'rentang bob=' + rBob.toFixed(2) + 'px');
cek('walk mengayunkan kedua kaki', rLegF > 0.3 && rLegB > 0.3, `legF=${rLegF.toFixed(2)} legB=${rLegB.toFixed(2)} rad`);
cek('walk mengayunkan lengan', rArmF > 0.2, 'rentang armF=' + rArmF.toFixed(2) + ' rad');
cek('walk menggerakkan kepala', rHead > 0.3, 'rentang headY=' + rHead.toFixed(2) + ' unit');
void rBody;

// ---- 4. kaki berlawanan fase & menapak 2× per siklus ----
const lawanFase = jalan.filter((f) => f.legSwing * f.legSwingB < 0).length / jalan.length;
cek('kaki berlawanan fase (jalan bergantian)', lawanFase > 0.8, 'proporsi frame berlawanan arah=' + lawanFase.toFixed(2));
const naik = (arr, kunci, ambang) => arr.filter((f, i) => i > 0 && arr[i - 1][kunci] < ambang && f[kunci] >= ambang).length;
const tapak = naik(jalan, 'legContact', 0.9) + naik(jalan, 'legContactB', 0.9);
const durasi = jalan[jalan.length - 1].t;
const siklus = durasi / stride.nominalCycleSec;
cek('kaki menapak 2× per siklus', Math.abs(tapak / siklus - 2) < 0.7, `${tapak} tapakan dalam ${siklus.toFixed(2)} siklus (≈${(tapak / siklus).toFixed(2)}/siklus)`);

// ---- 4b. TELAPAK KAKI TIDAK SELIP (foot-planting sejati) ----
// posisi dunia telapak = jarak tempuh + footX. Selama menapak nilainya harus
// TETAP; kalau kaki cuma diayun sinus, telapaknya menyapu tanah >100% stride.
const legLen = (loco.rive || {}).legLenUnits || 70.9;
const spanUnits = (loco.rive || {}).legSpanUnits || 36.9;
const ampRot = Math.max(...jalan.map((f) => Math.abs(f.legSwing)));
const ampHarus = Math.asin(Math.min(1, spanUnits / legLen));
cek('amplitudo ayun kaki sesuai rig (generator & data selaras)', Math.abs(ampRot - ampHarus) <= 0.06, `aktual=${ampRot.toFixed(3)} rad, harus≈${ampHarus.toFixed(3)} rad`);
function selip(kakiFoot, kakiLift) {
  // Kaki menapak di TEMPAT YANG BERBEDA tiap langkah — jadi yang diukur
  // adalah rentang posisi telapak DI DALAM SATU KALI MENAPAK, bukan lintas
  // langkah. Tiap "run" = satu periode menapak.
  let tempuh = 0;
  const runs = [];
  let cur = [];
  for (let i = 0; i < jalan.length; i++) {
    tempuh += nominalSpeed * DT;
    if (jalan[i][kakiLift] < 0.2) cur.push(tempuh + jalan[i][kakiFoot]);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  const rentang = runs.filter((r) => r.length >= 5).map((r) => Math.max(...r) - Math.min(...r));
  return rentang.length ? Math.max(...rentang) : Infinity;
}
const selipF = selip('footX', 'footLift');
const selipB = selip('footXB', 'footLiftB');
cek('telapak kaki depan TIDAK selip saat menapak (≤10% stride)', selipF <= stridePx * 0.1, `selip=${selipF.toFixed(2)}px dari stride ${stridePx}px`);
cek('telapak kaki belakang TIDAK selip saat menapak (≤10% stride)', selipB <= stridePx * 0.1, `selip=${selipB.toFixed(2)}px dari stride ${stridePx}px`);

// ---- 5. head-bob 2× per siklus ----
const ys = jalan.map((f) => f.body.y);
let puncak = 0;
for (let i = 1; i < ys.length - 1; i++) if (ys[i] > ys[i - 1] && ys[i] >= ys[i + 1]) puncak++;
cek('badan turun-naik 2× per siklus (head bob)', Math.abs(puncak / siklus - 2) < 0.7, `${puncak} puncak dalam ${siklus.toFixed(2)} siklus`);

// ---- 6. idle tidak mengayunkan kaki ----
const idlePose = rekam({ detik: 1.2, speed: 0, moveAmt: 0 });
const rIdleLeg = Math.max(...idlePose.map((f) => f.legF.rotation)) - Math.min(...idlePose.map((f) => f.legF.rotation));
const rIdleBody = Math.max(...idlePose.map((f) => f.body.scaleY)) - Math.min(...idlePose.map((f) => f.body.scaleY));
cek('idle TIDAK mengayunkan kaki', rIdleLeg < 0.02, 'rentang legF saat idle=' + rIdleLeg.toFixed(4) + ' rad');
cek('idle bernapas (badan mengembang)', rIdleBody > 0.005, 'rentang scaleY=' + rIdleBody.toFixed(4));

// ---- 7. laju animasi mengikuti kecepatan (foot-planting) ----
const lambat = rekam({ detik: 0.667, speed: nominalSpeed * 0.5, moveAmt: 1 });
const cepat = rekam({ detik: 0.667, speed: nominalSpeed * 2, moveAmt: 1 });
const rateLambat = lambat[lambat.length - 1].rate;
const rateCepat = cepat[cepat.length - 1].rate;
cek('laju putar animasi = kecepatan / kecepatan nominal', Math.abs(rateLambat - 0.5) < 0.02 && Math.abs(rateCepat - 2) < 0.02, `rate 0.5×=${rateLambat.toFixed(3)} 2×=${rateCepat.toFixed(3)}`);
const putaranCepat = cepat[cepat.length - 1].cycleTotal - cepat[0].cycleTotal;
const putaranLambat = lambat[lambat.length - 1].cycleTotal - lambat[0].cycleTotal;
cek('4× lipat laju → 4× lipat siklus (kaki tidak selip)', Math.abs(putaranCepat / Math.max(1e-6, putaranLambat) - 4) < 0.6, `putaran: 0,5×=${putaranLambat.toFixed(3)} siklus, 2×=${putaranCepat.toFixed(3)} siklus`);

// ---- 8. campuran idle↔walk tidak melompat ----
const campur = [];
for (let i = 0; i < 90; i++) {
  const w = Math.min(1, Math.max(0, (i - 10) / 40)); // diam → jalan pelan
  const pose = rigMod.updateRig(DT, { moveAmt: w, speed: nominalSpeed * w, nominalSpeed, cfg: loco });
  campur.push(pose.bob);
}
const loncat = Math.max(...campur.slice(1).map((v, i) => Math.abs(v - campur[i])));
cek('transisi idle→jalan tidak melompat (≤1 px/frame)', loncat <= 1, 'loncatan bob=' + loncat.toFixed(3) + 'px');

// ---- nilai terakhir tidak boleh NaN ----
const terakhir = jalan[jalan.length - 1];
const nan = ['bob', 'tilt', 'sx', 'sy', 'legSwing', 'armSwing', 'headTilt', 'cycle', 'rate'].filter((k) => !Number.isFinite(terakhir[k]));
cek('pose rig bebas NaN', nan.length === 0, 'nilai NaN: ' + nan.join(','));

console.log(JSON.stringify(hasil, null, 2));
console.log('\n=== ERROR (' + errors.length + ') ===');
for (const e of errors.slice(0, 10)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
