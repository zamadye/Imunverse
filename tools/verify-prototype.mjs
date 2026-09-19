/**
 * Uji PROTOTIPE MAKHLUK (pendekatan ② — rigged 2D, dipanggang Godot).
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom
 *   PHAGOS_BUNDLE=.tmp-bundle.js node tools/verify-prototype.mjs
 *
 * Yang dibuktikan:
 *   1. Data hasil PANGGANGAN GODOT ada & waras (8 keadaan × 24 frame).
 *   2. FOOT PLANTING benar: saat menapak ujung kaki bergerak MUNDUR (badan
 *      maju) dan tingginya konstan — bukan menyapu.
 *   3. Perender menggambar semua keadaan × 8 arah TANPA NaN dan tanpa error.
 *   4. ARAH 360° benar-benar mengubah hasil gambar, dan bertetangga lebih
 *      mirip daripada berlawanan (bukan memilih salah satu dari 4 tampang).
 *   5. Mode gambar TIDAK menyentuh mekanik: posisi/HP identik untuk tiap mode.
 *   6. Lab prototipe bisa dibuka & menggambar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { API, game, sleep } from './harness.mjs';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const errors = [];
const hasil = {};
const cek = (nama, ok, info = '') => {
  hasil[nama] = (ok ? 'OK' : 'GAGAL — ') + (info ? ' · ' + info : '');
  if (!ok) errors.push(`${nama}: ${info}`);
};
if (!API || !game) { console.log('bundle/harness belum siap'); process.exit(1); }

// ---------- 0. MODE BAWAAN HARUS MENAMPILKAN FOTO HERO ASLI ----------
// Keluhan pemain: karakter yang tampil cuma blob vektor bulat, bukan foto
// hero yang sudah digenerate. 'makhluk' (blob prosedural) hanya prototipe
// eksperimen — mode bawaan WAJIB 'foto' supaya artwork asli yang terlihat.
const modeBawaan = API.hero.heroMode();
cek('mode BAWAAN = foto (foto hero asli yang tampil, bukan blob vektor)',
  modeBawaan === 'foto', 'mode=' + modeBawaan);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const kodeMain = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
for (const id of ['btn-proto-lab', 'btn-proto-mode']) {
  cek(`kendali layar ${id} ada di index.html & dipasang di main.js`,
    html.includes(`id="${id}"`) && kodeMain.includes(`'${id}'`),
    `html=${html.includes(`id="${id}"`)} main=${kodeMain.includes(`'${id}'`)}`);
}

const CRE = API.creature;
const HERO = API.hero;
cek('permukaan prototipe terpasang', !!(CRE && HERO), JSON.stringify(Object.keys(API)));

// ---------- 1. DATA HASIL PANGGANGAN ----------
const panggang = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/creature-rigs.json'), 'utf8'));
const ID = 'macrophage';
const c = (panggang.creatures || {})[ID];
const KEADAAN = ['idle', 'walk', 'turn', 'attack', 'skill', 'hit', 'death', 'mutate'];
cek('8 keadaan × 24 frame hasil panggang Godot',
  !!c && KEADAAN.every((s) => c.states[s] && c.states[s].frames && c.states[s].frames.length === panggang.frames)
  && /Godot/i.test(panggang.sumber || ''),
  c ? KEADAAN.filter((s) => !c.states[s]).join(',') || `${KEADAAN.length} keadaan × ${panggang.frames}` : 'tidak ada');

const semuaFrame = KEADAAN.flatMap((s) => c.states[s].frames);
const nan = semuaFrame.filter((f) => !Number.isFinite(f.core.sx) || !Number.isFinite(f.core.sy)
  || !Number.isFinite(f.front) || !Number.isFinite(f.wob)
  || f.limbs.some((l) => !Number.isFinite(l.x) || !Number.isFinite(l.y)));
cek('semua kanal terhingga (tidak ada NaN)', nan.length === 0, `${nan.length}/${semuaFrame.length} bermasalah`);

// ---------- 2. FOOT PLANTING ----------
const jalan = c.states.walk.frames;
const TANAH = 0.42;
let menapakBaik = 0, menapakTotal = 0, tinggiBerubah = 0;
for (let i = 0; i < jalan.length; i++) {
  const a = jalan[i], b = jalan[(i + 1) % jalan.length];
  for (let k = 0; k < a.limbs.length; k++) {
    const la = a.limbs[k], lb = b.limbs[k];
    if (la.plant && lb.plant) {
      menapakTotal++;
      if (lb.x <= la.x + 1e-6) menapakBaik++;         // ujung MUNDUR = menapak
      if (Math.abs(lb.y - la.y) > 1e-6) tinggiBerubah++;   // tinggi tidak boleh berubah
    }
  }
}
cek('FOOT PLANTING: ujung kaki bergerak mundur saat menapak',
  menapakTotal > 20 && menapakBaik === menapakTotal, `${menapakBaik}/${menapakTotal} transisi benar`);
cek('FOOT PLANTING: tinggi ujung konstan saat menapak (tidak menyapu)',
  tinggiBerubah === 0, `${tinggiBerubah} transisi berubah tinggi`);
const tapak = jalan.map((f) => f.limbs.filter((l) => l.plant).length);
cek('gaya berjalan: 2–5 kaki menapak setiap saat (tripod, bukan meluncur)',
  Math.min(...tapak) >= 2 && Math.max(...tapak) <= 5,
  `min=${Math.min(...tapak)} maks=${Math.max(...tapak)} dari ${jalan[0].limbs.length} kaki`);

// ---------- 3 & 4. PERENDER: semua keadaan × 8 arah ----------
/** ctx perekam: menghitung operasi & mendeteksi NaN. */
function ctxRekam() {
  const rec = { ops: 0, nan: 0, tanda: [] };
  const cekAngka = (...v) => { if (v.some((n) => typeof n === 'number' && !Number.isFinite(n))) rec.nan++; };
  const grad = { addColorStop() {} };
  const base = {
    canvas: { width: 220, height: 190 },
    createLinearGradient: (...a) => { cekAngka(...a); return grad; },
    createRadialGradient: (...a) => { cekAngka(...a); return grad; },
    createPattern: () => null,
    measureText: () => ({ width: 0 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(4), width: w, height: h }),
    putImageData() {},
    save() { rec.ops++; }, restore() { rec.ops++; },
    translate(...a) { cekAngka(...a); rec.ops++; },
    rotate(...a) { cekAngka(...a); rec.ops++; },
    scale(...a) { cekAngka(...a); rec.ops++; },
    transform(...a) { cekAngka(...a); rec.ops++; },
    setTransform(...a) { cekAngka(...a); rec.ops++; },
    beginPath() { rec.ops++; }, closePath() { rec.ops++; },
    moveTo(...a) { cekAngka(...a); rec.tanda.push(a[0], a[1]); rec.ops++; },
    lineTo(...a) { cekAngka(...a); rec.tanda.push(a[0], a[1]); rec.ops++; },
    quadraticCurveTo(...a) { cekAngka(...a); const n = a.length; rec.tanda.push(a[n - 2], a[n - 1]); rec.ops++; },
    arc(...a) { cekAngka(...a); rec.tanda.push(a[0], a[1]); rec.ops++; },
    ellipse(...a) { cekAngka(...a); rec.tanda.push(a[0], a[1]); rec.ops++; },
    fill() { rec.ops++; }, stroke() { rec.ops++; }, clip() { rec.ops++; },
    fillRect(...a) { cekAngka(...a); rec.ops++; }, clearRect(...a) { cekAngka(...a); rec.ops++; },
    fillText() { rec.ops++; },
    drawImage(...a) { cekAngka(a[1], a[2], a[3], a[4]); rec.ops++; },
  };
  const ctx = new Proxy(base, {
    get(t, p) { if (p in t) return t[p]; if (typeof p !== 'string') return undefined; if (/Style$|^font$|^lineWidth$|^globalAlpha$/.test(p)) return ''; return (t[p] = () => undefined); },
    set(t, p, v) { t[p] = v; return true; },
  });
  return { ctx, rec };
}

const ARAH = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
let gagalGambar = 0, totalNaN = 0, kosong = 0;
for (const s of KEADAAN) {
  for (let i = 0; i < ARAH.length; i++) {
    const { ctx, rec } = ctxRekam();
    try {
      CRE.drawCreature(ctx, { id: ID, state: s, u: 0.35, x: 110, y: 90, size: 110, facing: ARAH[i], time: 1.2 });
    } catch (e) { gagalGambar++; errors.push(`gambar ${s}@${i}: ${e.message}`); continue; }
    totalNaN += rec.nan;
    if (rec.ops < 20) { kosong++; errors.push(`${s}@arah${i}: hanya ${rec.ops} operasi gambar`); }
  }
}
cek('perender menggambar 8 keadaan × 8 arah tanpa error', gagalGambar === 0, `${gagalGambar} gagal`);
cek('tidak ada koordinat NaN di semua keadaan & arah', totalNaN === 0, `${totalNaN} angka tidak terhingga`);
cek('setiap keadaan benar-benar menggambar bentuk (bukan kosong)', kosong === 0, `${kosong} kasus kosong`);

// ---------- 4. ARAH: kontinu (tanpa "pop") & benar-benar berpengaruh ----------
/** sidik ruang (petak 16×16) dari satu arah — kebal terhadap urutan gambar. */
const sidikArah = (sudut) => {
  const { ctx, rec } = ctxRekam();
  CRE.drawCreature(ctx, { id: ID, state: 'walk', u: 0.25, x: 110, y: 90, size: 110, facing: sudut, time: 1.0 });
  const sel = new Set();
  for (let k = 0; k + 1 < rec.tanda.length; k += 2) {
    const gx = Math.floor(rec.tanda[k] / (220 / 16));
    const gy = Math.floor(rec.tanda[k + 1] / (190 / 16));
    if (gx >= 0 && gx < 16 && gy >= 0 && gy < 16) sel.add(gy * 16 + gx);
  }
  return sel;
};
const jarak = (a, b) => {                 // 0 = identik, 1 = tak ada irisan
  let irisan = 0;
  for (const v of a) if (b.has(v)) irisan++;
  const gab = a.size + b.size - irisan;
  return gab ? 1 - irisan / gab : 0;
};
const LANGKAH = 72;                        // sapu 360° tiap 5°
const sapu = [];
for (let i = 0; i < LANGKAH; i++) sapu.push(sidikArah((i / LANGKAH) * Math.PI * 2));
const unikArah = new Set(sapu.map((s) => [...s].sort((x, y) => x - y).join(','))).size;
cek('arah menghasilkan banyak bentuk berbeda (bukan 4 tampang)',
  unikArah >= 24, `${unikArah} bentuk unik dari ${LANGKAH} arah`);
const berurutan = sapu.map((s, i) => jarak(s, sapu[(i + 1) % LANGKAH]));
const urut = berurutan.slice().sort((a, b) => a - b);
const median = urut[Math.floor(urut.length / 2)];
const maks = Math.max(...berurutan);
cek('PUTARAN 360° KONTINU — tidak ada lompatan bentuk antar 5°',
  maks <= 0.45, `lompatan maks=${maks.toFixed(3)} (median=${median.toFixed(3)})`);
cek('tidak ada "pop": lompatan terbesar ≤ 3× lompatan tengah',
  maks <= Math.max(0.25, median * 3), `maks=${maks.toFixed(3)} vs 3×median=${(median * 3).toFixed(3)}`);
const sisiDepan = jarak(sapu[0], sapu[Math.floor(LANGKAH / 4)]);   // samping vs menghadap
cek('arah BENAR-BENAR berpengaruh (samping ≠ depan)',
  sisiDepan > Math.max(0.3, median * 3), `jarak samping→depan=${sisiDepan.toFixed(3)} vs median=${median.toFixed(3)}`);

// ---------- 4b. BENAR-BENAR TAMPIL DI ARENA (bukan hanya fungsi dipanggil) ----------
// Uji ini memakai game.render() sungguhan dengan ctx perekam, lalu MEMBANDINGKAN
// jumlah geometri antar mode. Kalau prototipe tidak pernah tampil, angkanya sama.
function ctxHitung() {
  const rec = { drawImage: 0, path: 0, nan: 0 };
  const cekN = (...v) => { if (v.some((n) => typeof n === 'number' && !Number.isFinite(n))) rec.nan++; };
  const grad = { addColorStop() {} };
  const base = {
    canvas: { width: 400, height: 300 },
    createLinearGradient: (...a) => { cekN(...a); return grad; },
    createRadialGradient: (...a) => { cekN(...a); return grad; },
    createPattern: () => null, measureText: () => ({ width: 0 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(4), width: w, height: h }),
    putImageData() {},
    save() {}, restore() {}, translate(...a) { cekN(...a); }, rotate(...a) { cekN(...a); },
    scale(...a) { cekN(...a); }, transform(...a) { cekN(...a); }, setTransform(...a) { cekN(...a); },
    resetTransform() {}, beginPath() {}, closePath() {},
    moveTo(...a) { cekN(...a); rec.path++; }, lineTo(...a) { cekN(...a); rec.path++; },
    quadraticCurveTo(...a) { cekN(...a); rec.path++; }, bezierCurveTo(...a) { cekN(...a); rec.path++; },
    arc(...a) { cekN(...a); rec.path++; }, ellipse(...a) { cekN(...a); rec.path++; },
    rect(...a) { cekN(...a); rec.path++; }, roundRect(...a) { cekN(...a); }, arcTo(...a) { cekN(...a); },
    fill() {}, stroke() {}, clip() {}, fillRect(...a) { cekN(...a); }, clearRect(...a) { cekN(...a); },
    strokeRect(...a) { cekN(...a); }, fillText() {}, strokeText() {},
    drawImage(...a) { cekN(a[1], a[2], a[3], a[4]); rec.drawImage++; },
  };
  return { ctx: new Proxy(base, {
    get(t, p) { if (p in t) return t[p]; if (typeof p !== 'string') return undefined; if (/Style$|^font$|^line|^global|^text|^filter$|^shadow|^imageSmoothing|^miterLimit$|^direction$|^letterSpacing$|^wordSpacing$/.test(p)) return ''; return (t[p] = () => undefined); },
    set(t, p, v) { t[p] = v; return true; },
  }), rec };
}
const hitungArena = async (mode) => {
  API.hero.setHeroMode(mode);
  game.startRun('macrophage');
  await sleep(50);
  const pl = game.run.player;
  for (let i = 0; i < 40; i++) pl.update(1 / 60, { x: 1, y: 0, magnitude: 1 }, game);
  const { ctx, rec } = ctxHitung();
  game.ctx = ctx; game.viewW = 400; game.viewH = 300; game.dpr = 1;
  game.render(16, 2000);
  return rec;
};
const rFoto = await hitungArena('foto');
const rMakhluk = await hitungArena('makhluk');
const rBawaan = await hitungArena(modeBawaan);
cek('arena: mode bawaan menggambar FOTO HERO ASLI (drawImage > 0)',
  rBawaan.drawImage > 0, `drawImage bawaan=${rBawaan.drawImage}`);
cek('arena: mode makhluk (eksperimen) tetap menggambar GEOMETRI berbeda dari foto',
  rMakhluk.path > rFoto.path + 40,
  `path foto=${rFoto.path} vs makhluk=${rMakhluk.path} (selisih ${rMakhluk.path - rFoto.path})`);
cek('arena: foto hero TIDAK digambar saat mode makhluk aktif',
  rMakhluk.drawImage < rFoto.drawImage,
  `drawImage foto=${rFoto.drawImage} vs makhluk=${rMakhluk.drawImage}`);
cek('arena: render tanpa NaN di mode bawaan', rBawaan.nan === 0, `${rBawaan.nan} angka tidak terhingga`);

// ---------- 4c. POSISI & UKURAN DI LAYAR (harus sejajar dengan alas lama) ----------
// Foto lama: bawahnya di y + 0,5×S (S = ukuran sprite). Makhluk harus
// menapak di garis yang SAMA supaya tidak melayang atau tenggelam.
const S = 100;
const { ctx: cUkur, rec: rUkur } = ctxRekam();
CRE.drawCreature(cUkur, { id: ID, state: 'idle', u: 0.2, x: 0, y: 0, size: S, facing: 0, time: 0.5 });
const xs = rUkur.tanda.filter((_, i) => i % 2 === 0);
const ys = rUkur.tanda.filter((_, i) => i % 2 === 1);
const bbox = {
  kiri: Math.min(...xs), kanan: Math.max(...xs),
  atas: Math.min(...ys), bawah: Math.max(...ys),
};
cek('makhluk menapak di garis alas yang sama dengan foto lama (0,42×S ± 0,06×S)',
  Math.abs(bbox.bawah - 0.42 * S) <= 0.06 * S, `bawah=${bbox.bawah.toFixed(1)} (harap ≈${(0.42 * S).toFixed(1)})`);
cek('ukuran makhluk wajar (lebar 0,8–1,8 × S, tinggi 0,6–1,4 × S)',
  (bbox.kanan - bbox.kiri) >= 0.8 * S && (bbox.kanan - bbox.kiri) <= 1.8 * S
  && (bbox.bawah - bbox.atas) >= 0.6 * S && (bbox.bawah - bbox.atas) <= 1.4 * S,
  `lebar=${(bbox.kanan - bbox.kiri).toFixed(1)} tinggi=${(bbox.bawah - bbox.atas).toFixed(1)} (S=${S})`);

// ---------- 5. MODE TIDAK MENYENTUH MEKANIK ----------
const modeAsal = HERO.heroMode();
const jejak = {};
for (const m of HERO.heroModes()) {
  HERO.setHeroMode(m);
  game.startRun(ID);
  await sleep(30);
  const p = game.run.player;
  p.x = 0; p.y = 0; p.hp = p.maxHP;
  for (let i = 0; i < 90; i++) p.update(1 / 60, { x: 0.7, y: -0.7, magnitude: 1 }, game);
  jejak[m] = { x: +p.x.toFixed(6), y: +p.y.toFixed(6), hp: +p.hp.toFixed(6), alive: p.alive };
  try { game.render(16, 1200 + i0); } catch (e) { errors.push(`render mode ${m}: ${e.message}`); }
}
var i0 = 0;
const kunci = Object.keys(jejak);
const sama = kunci.every((m) => JSON.stringify(jejak[m]) === JSON.stringify(jejak[kunci[0]]));
cek('mekanik TIDAK berubah oleh mode gambar (posisi & HP identik)',
  sama, kunci.map((m) => `${m}=${jejak[m].x},${jejak[m].y}`).join(' | '));

// ---------- 6. lab prototipe ----------
try {
  HERO.bukaLab(ID);
  await sleep(120);
  const terbuka = HERO.labTerbuka();
  HERO.tutupLab();
  cek('lab prototipe bisa dibuka & ditutup', terbuka === true, 'labTerbuka=' + terbuka);
} catch (e) {
  cek('lab prototipe bisa dibuka & ditutup', false, e.message);
}
HERO.setHeroMode(modeAsal);

// ---------- 7. keadaan animasi: prioritas & progres ----------
game.startRun(ID);
await sleep(30);
const p = game.run.player;
const st = HERO.heroAnimState(p, game.run, 1.0, 1 / 60);
cek('keadaan animasi terbaca dari pemain (idle saat diam)', st.state === 'idle', 'state=' + st.state);
p.moveAmt = 1; p.walkPhase = 1.2;
const st2 = HERO.heroAnimState(p, game.run, 1.0, 1 / 60);
cek('keadaan berubah jadi jalan saat bergerak', st2.state === 'walk', 'state=' + st2.state);

console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 12)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
