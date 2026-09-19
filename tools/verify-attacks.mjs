/**
 * Uji P7 — IDENTITAS SERANGAN (PHAGOS_V2_REBUILD.txt §18–§19, V2 §17).
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom
 *   PHAGOS_BUNDLE=.tmp-bundle.js node tools/verify-attacks.mjs
 *
 * Yang dijamin:
 *   1. Tiap hero punya TANDA TANGAN serangan sendiri — walau archetype-nya
 *      sama (mis. 3 hero ber-archetype area), warna/ukuran/jumlah/lajunya
 *      berbeda. Keluhan user: "jenis serangan character masih sama semua".
 *   2. Tanda tangan benar-benar dipakai runtime (bukan hanya data).
 *   3. Serangan berjalan melalui ANTICIPATION → TELEGRAPH → EXECUTION (§19).
 *   4. Mutasi mengubah angka serangan (bukan hanya nama) — V2 §17.
 *   5. Telegraph tiap arketipe cukup untuk dihindari (§19).
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
const baca = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

globalThis.fetch = async (u) => {
  const f = path.join(ROOT, String(u).replace(/^\.?\//, '').split('?')[0]);
  try {
    const t = fs.readFileSync(f, 'utf8');
    return { ok: true, status: 200, async json() { return JSON.parse(t); }, async text() { return t; } };
  } catch { return { ok: false, status: 404, async json() { throw new Error('404 ' + f); }, async text() { return ''; } }; }
};

if (!API || !game) { console.log('bundle/harness belum siap'); process.exit(1); }
const A = API.attacks;
cek('permukaan serangan terpasang', !!A, JSON.stringify(Object.keys(API)));

const heroes = baca('data/heroes.json').heroes;
const serangan = baca('data/attacks.json');
const muts = baca('data/mutations.json').mutations;
const sigs = serangan.heroSignatures || {};

// ---------- 1. SETIAP HERO PUNYA TANDA TANGAN ----------
const tanpaSig = heroes.filter((h) => !sigs[h.id]);
cek('tiap hero punya tanda tangan serangan (data)', tanpaSig.length === 0,
  tanpaSig.map((h) => h.id).join(',') || 'lengkap');

const kunci = (h) => {
  const s = sigs[h.id] || {};
  return [s.tint, s.sizeMult || 1, s.countMult || 1, s.speedMult || 1, s.label].join('|');
};
const unik = new Set(heroes.map(kunci));
cek('tanda tangan tiap hero BERBEDA (tidak ada dua hero yang sama rasanya)',
  unik.size === heroes.length, `${unik.size}/${heroes.length} unik`);
const warnaUnik = new Set(heroes.map((h) => (sigs[h.id] || {}).tint).filter(Boolean));
cek('warna serangan berbeda per hero (keterbacaan identitas, §18)',
  warnaUnik.size >= 9, `${warnaUnik.size} warna unik dari ${heroes.length} hero`);

// hero yang berbagi archetype HARUS tetap berbeda
const perArketipe = {};
for (const h of heroes) {
  const a = (h.identity || {}).attackArchetype || '?';
  (perArketipe[a] = perArketipe[a] || []).push(h.id);
}
const kembar = Object.entries(perArketipe)
  .filter(([, ids]) => ids.length > 1)
  .filter(([, ids]) => new Set(ids.map((id) => kunci({ id }))).size !== ids.length);
cek('hero yang berbagi archetype TETAP terasa beda', kembar.length === 0,
  kembar.map(([a, ids]) => `${a}:${ids.join('/')}`).join(' ') || 'aman');

// ---------- 2. RUNTIME: tanda tangan benar-benar dipakai ----------
game.startRun('macrophage');
const run = game.run;
await sleep(60);
const jejak = [];
for (const def of heroes) {
  run.heroDef = def;
  run.attack = null;
  const atk = A.beginAttack(game, {});
  if (!atk) { jejak.push({ id: def.id, gagal: true }); continue; }
  jejak.push({
    id: def.id,
    archetype: atk.id,
    color: atk.color,
    label: (atk.cfg && (atk.cfg.signatureLabel || atk.cfg.label)) || '',
    payload: JSON.stringify(atk.cfg && atk.cfg.payload ? atk.cfg.payload : {}),
  });
}
run.attack = null;
const gagal = jejak.filter((j) => j.gagal);
const cetak = (j) => `${j.archetype}|${j.color}|${j.payload}`;
const unikRuntime = new Set(jejak.filter((j) => !j.gagal).map(cetak));
cek('runtime: tiap hero menghasilkan parameter serangan berbeda',
  gagal.length === 0 && unikRuntime.size >= heroes.length - 1,
  `unik=${unikRuntime.size}/${heroes.length} gagal=${gagal.map((g) => g.id).join(',') || '-'}`);
const warnaRuntime = new Set(jejak.filter((j) => !j.gagal).map((j) => j.color));
cek('runtime: warna serangan mengikuti tanda tangan hero',
  warnaRuntime.size >= 9, `${warnaRuntime.size} warna: ${[...warnaRuntime].slice(0, 4).join(' ')}`);
// dua hero se-archetype: payload-nya harus beda
const areaIds = (perArketipe.area || []).slice(0, 2);
if (areaIds.length === 2) {
  const pa = jejak.find((j) => j.id === areaIds[0]);
  const pb = jejak.find((j) => j.id === areaIds[1]);
  cek(`runtime: dua hero se-archetype (${areaIds.join(' vs ')}) payload-nya beda`,
    !!pa && !!pb && pa.payload !== pb.payload && pa.color !== pb.color,
    `${pa && pa.payload} vs ${pb && pb.payload}`);
}

// ---------- 3. SERANGAN BERJALAN: anticipation → telegraph → execution ----------
run.heroDef = heroes.find((h) => h.id === 'tcd8') || heroes[0];
game.spawnEnemy('bakteri', false);
const musuh = run.enemies[run.enemies.length - 1];
if (musuh) { musuh.x = run.player.x + 60; musuh.y = run.player.y; }
const atk = A.beginAttack(game, {});
const fase = [];
if (atk) {
  for (let i = 0; i < 400 && !atk.done; i++) {
    const f = atk.phase;
    if (fase[fase.length - 1] !== f) fase.push(f);
    A.updateAttack(game, 1 / 60);
    if (musuh && !musuh.alive) break;
  }
}
cek('serangan melewati ANTICIPATION → TELEGRAPH → EXECUTION (§19)',
  fase[0] === 'anticipation' && fase.includes('telegraph') && fase.includes('execution'),
  fase.join(' → ') || 'tidak berjalan');

// ---------- 4. MUTASI MENGUBAH ANGKA SERANGAN (V2 §17) ----------
// Catatan: teks perubahan bergantung archetype hero — mutasi yang menyentuh
// payload `area` hanya menghasilkan teks untuk hero ber-archetype area.
const denganAttack = muts.filter((m) => m.attack && (m.attack.payload || m.attack.archetypeFrom));
const berdampak = denganAttack.filter((m) => heroes.some((h) => (A.describeAttackChange(m, h) || '').length > 0));
const contoh = [];
for (const m of berdampak.slice(0, 3)) {
  const h = heroes.find((x) => (A.describeAttackChange(m, x) || '').length > 0);
  contoh.push(`${m.name} (${h && h.id}): ${A.describeAttackChange(m, h)}`);
}
cek('mutasi mengubah CARA bertempur (angka/bentuk), bukan hanya nama',
  denganAttack.length >= 5 && berdampak.length >= 5,
  `${berdampak.length}/${denganAttack.length} mutasi berdampak; ${contoh.join(' · ') || '-'}`);

// ---------- 5. TELEGRAPH CUKUP (§19) ----------
const arketipe = serangan.archetypes || [];
const tele = arketipe.map((a) => a.telegraphSec);
cek('telegraph tiap arketipe ≥ 0,18 dtk (pemain sempat menghindar, §19)',
  tele.length > 0 && Math.min(...tele) >= 0.18, `min=${Math.min(...tele)} dari ${arketipe.length}`);

console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 15)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
