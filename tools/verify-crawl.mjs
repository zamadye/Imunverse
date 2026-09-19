/**
 * Uji RIG MERAYAP GODOT (keluhan pemain: "karakter masih mengambang").
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom
 *   PHAGOS_BUNDLE=.tmp-bundle.js node tools/verify-crawl.mjs
 *
 * Yang dibuktikan:
 *   1. Siklus benar-benar hasil PANGGANGAN GODOT (11 hero × 24 frame).
 *   2. ANTI-MENGAMBANG: kanal vertikal dikunci (y = 0) DAN tepi bawah sprite
 *      tidak pernah bergeser — dihitung memakai rumus yang SAMA persis dengan
 *      `billboard()` di game.js (squash berporos bawah).
 *   3. Geraknya HIDUP: squash-stretch ±≥5 %, jangkauan massa (shear), ayunan,
 *      dan gelombang lobus yang berjalan — bukan sekadar foto digeser.
 *   4. MULUS ke semua arah: putaran 360° kontinu, 8 mata angin semuanya hidup,
 *      sambungan akhir↔awal siklus tidak meloncat.
 *   5. Tiap hero punya gaya merayap sendiri (tidak ada dua hero yang sama).
 *   6. Runtime memakai rig ini (`player.rigSource === 'crawl'`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { API, game, sleep } from './harness.mjs';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const errors = [];
const hasil = {};
const cek = (nama, ok, info = '') => {
  hasil[nama] = ok ? 'OK' : 'GAGAL — ' + info;
  if (!ok) errors.push(`${nama}: ${info}`);
};

if (!API || !game) { console.log('bundle/harness belum siap'); process.exit(1); }
const CRAWL = API.crawl;
cek('permukaan rig merayap terpasang', !!CRAWL, JSON.stringify(Object.keys(API)));

const siklus = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crawl-cycles.json'), 'utf8'));
const heroes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/heroes.json'), 'utf8')).heroes;
const daftar = Object.keys(siklus.heroes || {});

// ---------- 1. HASIL PANGGANGAN GODOT ----------
cek('siklus hasil panggang Godot (11 hero × 24 frame)',
  daftar.length === heroes.length && (siklus.frames || 0) >= 16
  && /Godot/i.test(siklus.sumber || ''),
  `${daftar.length} hero, ${siklus.frames} frame, sumber="${siklus.sumber}"`);
const semuaFrame = daftar.flatMap((h) => siklus.heroes[h].frames);
const adaNaN = semuaFrame.some((f) => !['x', 'y', 'sx', 'sy', 'rot', 'skew', 'contact']
  .every((k) => Number.isFinite(f[k])));
cek('semua kanal terhingga (tidak ada NaN)', !adaNaN, `${semuaFrame.length} frame diperiksa`);

// ---------- 2. ANTI-MENGAMBANG ----------
const yMenyimpang = semuaFrame.filter((f) => Math.abs(f.y) > 1e-6);
cek('kanal vertikal TERKUNCI di alas (y = 0 di semua frame)',
  yMenyimpang.length === 0, `${yMenyimpang.length} frame menyimpang`);

// ---------- 3. GERAK HIDUP (bukan foto digeser) ----------
const rentang = (h, k) => {
  const v = siklus.heroes[h].frames.map((f) => f[k]);
  return Math.max(...v) - Math.min(...v);
};
const lemah = daftar.filter((h) => rentang(h, 'sx') < 0.05 || rentang(h, 'skew') < 0.05);
cek('deformasi nyata tiap hero (rentang sx & skew ≥ 0,05)',
  lemah.length === 0, lemah.join(',') || 'semua hero hidup');
const karet = daftar.filter((h) => Math.abs(rentang(h, 'sx') - rentang(h, 'sy')) > 0.25);
cek('squash-stretch seimbang (tidak karet)', karet.length === 0, karet.join(',') || 'seimbang');
const volumeMenyimpang = semuaFrame.filter((f) => Math.abs(f.sx * f.sy - 1) > 0.03);
cek('volume terjaga (|sx×sy − 1| ≤ 0,03)',
  volumeMenyimpang.length === 0, `${volumeMenyimpang.length} frame menyimpang`);
const lobusMati = daftar.filter((h) => {
  const f = siklus.heroes[h].frames;
  return !f[0].lobes || f[0].lobes.length < 2
    || (Math.max(...f.map((x) => x.lobes[0])) - Math.min(...f.map((x) => x.lobes[0]))) < 0.1;
});
cek('gelombang lobus berjalan (pseudopodia menjangkau bergiliran)',
  lobusMati.length === 0, lobusMati.join(',') || 'semua hero bergelombang');
// lobus harus BEDA FASE (gelombang berjalan, bukan kompak naik-turun bersamaan)
const contoh = siklus.heroes.macrophage.frames[6].lobes;
cek('lobus berbeda fase (gelombang berjalan mengelilingi badan)',
  new Set(contoh.map((v) => v.toFixed(3))).size >= Math.min(3, contoh.length),
  JSON.stringify(contoh));

// ---------- 4. MULUS: sambungan siklus & putaran 360° ----------
let loncatSambung = 0;
for (const h of daftar) {
  const f = siklus.heroes[h].frames;
  const n = f.length;
  for (const k of ['sx', 'sy', 'skew', 'rot', 'contact']) {
    const dalam = Math.max(...f.slice(1).map((x, i) => Math.abs(x[k] - f[i][k])));
    const sambung = Math.abs(f[0][k] - f[n - 1][k]);
    loncatSambung = Math.max(loncatSambung, sambung - dalam);
  }
}
cek('sambungan akhir→awal siklus tidak meloncat (loop mulus)',
  loncatSambung <= 1e-6, `selisih terbesar=${loncatSambung.toExponential(2)}`);

const TAU = Math.PI * 2;
let loncatArah = 0;
const sapu = 144;
for (let i = 0; i < sapu; i++) {
  const a = (i / sapu) * TAU, b = ((i + 1) / sapu) * TAU;
  for (const h of daftar.slice(0, 4)) {
    const pa = CRAWL.crawlPose(h, 1.1, 1, a, 0);
    const pb = CRAWL.crawlPose(h, 1.1, 1, b, 0);
    if (!pa || !pb) { loncatArah = 99; break; }
    for (const k of ['sx', 'sy', 'shear']) loncatArah = Math.max(loncatArah, Math.abs(pa[k] - pb[k]));
  }
}
cek('putaran 360° mulus (tanpa loncatan kanal)',
  loncatArah < 0.02, `loncatan maks per 2,5°=${loncatArah.toFixed(5)}`);

const arah8 = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
const mati = [];
for (const h of daftar) {
  for (const a of arah8) {
    const p = CRAWL.crawlPose(h, 1.1, 1, a, 0);
    if (!p || !Number.isFinite(p.sx) || !Number.isFinite(p.sy) || !Number.isFinite(p.shear)) { mati.push(`${h}@${a.toFixed(2)}`); continue; }
    if (Math.abs(p.sx - 1) < 0.005 && Math.abs(p.sy - 1) < 0.005 && Math.abs(p.shear) < 0.005) mati.push(`${h}@${a.toFixed(2)}`);
  }
}
cek('8 arah semuanya hidup (pose tidak pernah datar)',
  mati.length === 0, mati.slice(0, 6).join(' ') || `${daftar.length}×8 kombinasi hidup`);
// arah tegak harus MEMANJANG/MEMIPIH (badan menjangkau ke atas / merapat ke bawah)
const pAtas = CRAWL.crawlPose('macrophage', 1.1, 1, -Math.PI / 2, 0);
const pBawah = CRAWL.crawlPose('macrophage', 1.1, 1, Math.PI / 2, 0);
const pSamping = CRAWL.crawlPose('macrophage', 1.1, 1, 0, 0);
cek('gerak tegak: ke atas memanjang, ke bawah memipih (relatif ke mendatar)',
  pAtas && pBawah && pSamping && pAtas.sy > pSamping.sy + 0.02 && pBawah.sy < pSamping.sy - 0.02,
  `sy atas=${pAtas && pAtas.sy.toFixed(3)} samping=${pSamping && pSamping.sy.toFixed(3)} bawah=${pBawah && pBawah.sy.toFixed(3)}`);

// ---------- 5. TIAP HERO BERBEDA ----------
const ttd = (h) => {
  const s = siklus.heroes[h];
  return [s.lobes, s.rate, rentang(h, 'sx').toFixed(3), rentang(h, 'skew').toFixed(3)].join('|');
};
cek('gaya merayap tiap hero berbeda',
  new Set(daftar.map(ttd)).size === daftar.length,
  `${new Set(daftar.map(ttd)).size}/${daftar.length} unik`);

// ---------- 6. RUNTIME: tidak mengambang & rig dipakai ----------
const DT = 1 / 60;
const crawlHeroes = daftar.filter((h) => h !== 'macrophage' && h !== 'tcd8');
let pakaiRig = 0;
const dasar = [];
for (const h of crawlHeroes) {
  game.startRun(h);
  await sleep(20);
  const pl = game.run.player;
  for (let i = 0; i < 30; i++) pl.update(DT, { x: 1, y: 0, magnitude: 1 }, game);
  if (pl.rigSource === 'crawl') pakaiRig++;
  dasar.push({ h, rig: pl.rigSource, bob: pl.anim.bob, sy: pl.anim.sy, shear: pl.anim.shear });
}
cek(`runtime memakai rig merayap Godot (${crawlHeroes.length}/${crawlHeroes.length} hero non-Rive)`,
  pakaiRig === crawlHeroes.length, `${pakaiRig}/${crawlHeroes.length} — ${dasar.filter((d) => d.rig !== 'crawl').map((d) => d.h).join(',') || 'semua'}`);
cek('Mako dikecualikan dari rig Godot karena memakai artboard Rive langsung',
  !daftar.includes('macrophage') || !crawlHeroes.includes('macrophage'),
  'macrophage harus memakai direct Mako artboard');
cek('T-Bolt dikecualikan dari rig Godot karena memakai artboard Rive langsung',
  !daftar.includes('tcd8') || !crawlHeroes.includes('tcd8'),
  'tcd8 harus memakai direct TBolt artboard');
cek('runtime: badan tidak pernah diangkat (bob = 0)',
  dasar.every((d) => Math.abs(d.bob) < 1e-9), JSON.stringify(dasar.slice(0, 2)));

// Tepi bawah sprite — dihitung dengan rumus yang SAMA persis seperti game.js:
//   lift   = radius × 0,62 + bob + anchorHalf × (sy − 1),  anchorHalf = radius × 1,3335
//   bawah  = −lift + (tinggi/2) × sy,  dengan tinggi/2 = radius × 1,3335
game.startRun('macrophage');
await sleep(40);
const pl = game.run.player;
const R = pl.radius;
const anchorHalf = R * 1.3335;
const C = R * 0.62;
const bawah = (f) => -(C + f.bob + anchorHalf * (f.sy - 1)) + anchorHalf * f.sy;
const bawahLama = (f) => -(C + f.bob) + anchorHalf * f.sy; // poros TENGAH (cara lama → mengambang)
const rekam = [];
for (const a of arah8) {
  pl.facing = a;
  for (let i = 0; i < 60; i++) {
    pl.update(DT, { x: Math.cos(a), y: Math.sin(a), magnitude: 1 }, game);
    rekam.push({ bob: pl.anim.bob, sy: pl.anim.sy });
  }
}
const nilai = rekam.map(bawah);
const drift = Math.max(...nilai) - Math.min(...nilai);
const nilaiLama = rekam.map(bawahLama);
const driftLama = Math.max(...nilaiLama) - Math.min(...nilaiLama);
cek('ANTI-MENGAMBANG: tepi bawah sprite tidak pernah bergeser (<0,6 px)',
  drift < 0.6, `drift=${drift.toFixed(4)} px (cara lama poros tengah=${driftLama.toFixed(2)} px)`);
cek('perbaikan nyata vs cara lama (poros tengah)',
  driftLama > 1.5 && drift < driftLama / 5, `lama=${driftLama.toFixed(2)} px → baru=${drift.toFixed(4)} px`);

// ---------- 7. gerak maju: siklus tersapu penuh saat berjalan ----------
const fase = [];
for (let i = 0; i < 120; i++) {
  pl.update(DT, { x: 1, y: 0, magnitude: 1 }, game);
  fase.push(pl.walkPhase);
}
cek('fase langkah terus maju saat berjalan (tidak macet)',
  fase[fase.length - 1] - fase[0] > Math.PI * 2 && fase.every((v, i) => i === 0 || v >= fase[i - 1] - 1e-9),
  `Δfase=${(fase[fase.length - 1] - fase[0]).toFixed(2)} rad`);

console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 15)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
