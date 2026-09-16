/**
 * Uji CORE COMBAT V2 (P1): identitas hero, bahasa serangan, dan telegraph.
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom
 *   PHAGOS_BUNDLE=.tmp-bundle.js node tools/verify-combat.mjs
 *
 * Yang dijamin (PHAGOS_V2_REBUILD.txt §12-§20):
 *   1. Setiap hero punya strength / weakness / combat identity / scaling identity,
 *      dan TIDAK ADA hero yang menang di semuanya (§14).
 *   2. Archetype serangan benar-benar berjalan: CHAIN milik Dendritic harus
 *      mengenai >1 musuh dalam sekali tembak (§17).
 *   3. Telegraph betul-betul ada di data: fase serangan & windup kontak (§19).
 */
import fs from 'node:fs';
import path from 'node:path';
import { window, sleep, API, game } from './harness.mjs';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const errors = [];
const hasil = {};
const cek = (nama, ok, info = '') => {
  hasil[nama] = ok ? 'OK' : 'GAGAL — ' + info;
  if (!ok) errors.push(`${nama}: ${info}`);
};
const baca = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

// Modul Node (impor langsung) butuh datanya sendiri — bundle jsdom punya
// instance modul terpisah. Sediakan fetch sederhana ke berkas lokal.
globalThis.fetch = async (u) => {
  const f = path.join(ROOT, String(u).replace(/^\.?\//, '').split('?')[0]);
  try {
    const t = fs.readFileSync(f, 'utf8');
    return { ok: true, status: 200, async json() { return JSON.parse(t); }, async text() { return t; } };
  } catch { return { ok: false, status: 404, async json() { throw new Error('404 ' + f); }, async text() { return ''; } }; }
};
const { loadAllData } = await import('../js/core/data-store.js');
await loadAllData();

const heroes = baca('data/heroes.json').heroes;
const attacks = baca('data/attacks.json');
const combat = baca('data/combat.json');
const enemies = baca('data/enemies.json');
const enemyArche = baca('data/enemy-archetypes.json');

// ---------- 1. IDENTITAS HERO (§12–§14) ----------
const ARCHE = ['projectile', 'homing', 'melee', 'area', 'beam', 'chain', 'zone', 'summon'];
const tanpaId = heroes.filter((h) => !h.identity || !h.identity.combatIdentity || !h.identity.scalingIdentity);
cek('11 hero punya identitas', heroes.length === 11 && tanpaId.length === 0, `${tanpaId.length} hero tanpa identitas`);

const lemah = heroes.filter((h) => (h.identity?.strength || []).length < 2 || (h.identity?.weakness || []).length < 2);
cek('tiap hero punya kekuatan & kelemahan (≥2)', lemah.length === 0, lemah.map((h) => h.id).join(', '));

const archeAneh = heroes.filter((h) => !ARCHE.includes(h.identity?.attackArchetype));
cek('archetype serangan hero valid (8 archetype)', archeAneh.length === 0, archeAneh.map((h) => h.id).join(', '));

const terpakai = new Set(heroes.map((h) => h.identity?.attackArchetype));
cek('archetype tersebar (≥7 dari 8)', terpakai.size >= 7, `terpakai ${terpakai.size}/8`);

// §14: tidak boleh ada hero terbaik absolut (puncak di HP, damage DAN speed)
const puncak = (k) => Math.max(...heroes.map((h) => h.baseStats[k] || 0));
const maxHP = puncak('maxHP'); const maxDmg = puncak('damage'); const maxSpd = puncak('speed');
const dominan = heroes.filter((h) => h.baseStats.maxHP === maxHP && h.baseStats.damage === maxDmg && h.baseStats.speed === maxSpd);
cek('tidak ada hero terbaik absolut (§14)', dominan.length === 0, dominan.map((h) => h.id).join(', '));

// ---------- 2. TELEGRAPH (§19) ----------
const fase = attacks.telegraphPhases || {};
const tahap = ['anticipation', 'telegraph', 'execution', 'impact', 'recovery'];
const faseKurang = tahap.filter((t) => !(fase[t] > 0));
cek('fase telegraph lengkap & >0', faseKurang.length === 0, 'kurang: ' + faseKurang.join(', '));
cek('windup serangan kontak >0 (combat.json)', (combat.contactAttack?.windup || 0) > 0, String(combat.contactAttack?.windup));
const bossTele = (enemies.enemies || []).filter((e) => e.areaAttack).map((e) => e.areaAttack.telegraphTime || 0);
cek('boss punya telegraph AOE >0', bossTele.length > 0 && bossTele.every((t) => t > 0), bossTele.join(', '));

// ---------- 3. CHAIN BENAR-BENAR JALAN (§17) ----------
// Uji unit pada sistem nyata (tanpa bergantung pada keacakan gelombang):
// satu proyektil dengan chainHops harus mengenai >1 musuh dan mencatat lompatan.
const { CollisionSystem } = await import('../js/systems/collision-system.js');
const { Projectile } = await import('../js/entities/projectile.js');

const col = new CollisionSystem(96);
let uid = 0;
const musuh = [];
for (let i = 0; i < 3; i++) {
  const e = { uid: ++uid, x: 100 + i * 26, y: 100, radius: 14, alive: true, hp: 1000 };
  musuh.push(e);
}
col.rebuildEnemyGrid(musuh); // API nyata collision: grid diisi ulang tiap frame
const kenaUid = [];
const proj = new Projectile({
  pattern: 'homing', x: 100, y: 100, angle: 0, speed: 300, damage: 20,
  pierce: 3, chainHops: 2, chainRadius: 120, chainDecay: 0.4,
});
const dmgPerKena = [];
col.handleProjectileHits([proj], (pr, e) => {
  kenaUid.push(e.uid);
  dmgPerKena.push(Math.round(pr.damage));
  e.hp -= pr.damage;
  return false;
});
// satu pemanggilan = satu frame; ulangi sampai proyektil habis/mati
let frame = 0;
while (proj.alive && frame < 20) {
  proj.update(1 / 60, { findNearestEnemy: (x, y, r, f) => col.findNearestEnemy(x, y, r, f) });
  col.rebuildEnemyGrid(musuh.filter((e) => e.alive));
  col.handleProjectileHits([proj], (pr, e) => { kenaUid.push(e.uid); dmgPerKena.push(Math.round(pr.damage)); e.hp -= pr.damage; return false; });
  frame++;
}
const unik = new Set(kenaUid);
cek('satu proyektil chain mengenai >1 musuh', unik.size >= 2, `kena ${unik.size} musuh (uid: ${[...unik].join(',')})`);
cek('proyektil mencatat lompatan rantai', (proj.chainLinks || 0) >= 1, `chainLinks=${proj.chainLinks || 0}`);
cek('damage meluruh tiap lompatan', dmgPerKena.length >= 2 && dmgPerKena[1] < dmgPerKena[0], dmgPerKena.join(' → '));
const peluruhan = (attacks.archetypes.find((a) => a.id === 'chain') || {}).decay;
cek('peluruhan rantai terbaca dari data (0<p<1)', typeof peluruhan === 'number' && peluruhan > 0 && peluruhan < 1, String(peluruhan));
cek('chain dipakai Dendritic lewat pola ranged_chain', heroes.find((h) => h.id === 'dendritic').attackPattern === 'ranged_chain', heroes.find((h) => h.id === 'dendritic').attackPattern);

// ---------- 4. HERO LAIN TIDAK BERUBAH ARAHNYA ----------
const pola = Object.fromEntries(heroes.map((h) => [h.id, h.attackPattern]));
cek('pola serangan hero lain tak berubah', pola.macrophage === 'ranged_pierce' && pola.nkcell === 'melee_swipe' && pola.tcd8 === 'ranged_pierce',
  JSON.stringify({ macrophage: pola.macrophage, nkcell: pola.nkcell, tcd8: pola.tcd8 }));
cek('hanya Dendritic yang memakai ranged_chain',
  Object.entries(pola).filter(([, v]) => v === 'ranged_chain').map(([k]) => k).join(',') === 'dendritic',
  Object.entries(pola).filter(([, v]) => v === 'ranged_chain').map(([k]) => k).join(','));


// ---------- 5. IDENTITAS ANCAMAN MUSUH (§15) ----------
const A_MUSUH = enemyArche.archetypes.map((a) => a.id);
cek('9 archetype ancaman terdefinisi', A_MUSUH.length === 9 && new Set(A_MUSUH).size === 9, A_MUSUH.join(','));
const tanpaAncaman = enemyArche.archetypes.filter((a) => !a.threat || !a.counter || !a.status);
cek('tiap archetype punya ancaman & jawaban', tanpaAncaman.length === 0, tanpaAncaman.map((a) => a.id).join(','));
const daftar = enemies.enemies || [];
const musuhAneh = daftar.filter((e) => !A_MUSUH.includes(e.archetype));
cek('13 patogen punya archetype valid', daftar.length === 13 && musuhAneh.length === 0, `${daftar.length} musuh, aneh: ${musuhAneh.map((e) => e.id).join(',')}`);
const terwujud = enemyArche.archetypes.filter((a) => a.status === 'implemented').length;
cek('mayoritas archetype sudah berjalan di runtime', terwujud >= 8, `${terwujud}/9`);

// ---------- 6. REGENERATIVE BENAR-BENAR JALAN (§15) ----------
const { Enemy } = await import('../js/entities/enemy.js');
const defProtozoa = daftar.find((e) => e.id === 'protozoa');
const eRegen = new Enemy(defProtozoa, 0, 0, { hpScale: 1, speedScale: 1 });
eRegen.takeDamage(Math.round(eRegen.maxHP * 0.5));
const hpLuka = eRegen.hp;
const pemainJauh = { x: 9999, y: 9999, radius: 15 };
for (let i = 0; i < 60; i++) eRegen.update(1 / 60, pemainJauh, 0, null); // 1 dtk → belum pulih (delay 2.5)
const hp1d = eRegen.hp;
for (let i = 0; i < 180; i++) eRegen.update(1 / 60, pemainJauh, 0, null); // total 4 dtk → pulih
const hp4d = eRegen.hp;
cek('regen menunggu delay dulu (telegraph kekuatan musuh)', Math.abs(hp1d - hpLuka) < 0.01, `${hpLuka} → ${hp1d}`);
cek('regen memulihkan HP setelah delay', hp4d > hpLuka, `${hpLuka} → ${Math.round(hp4d)}`);
eRegen.takeDamage(5);
const hpSetelahPukul = eRegen.hp;
for (let i = 0; i < 60; i++) eRegen.update(1 / 60, pemainJauh, 0, null);
cek('damage memotong regenerasi', Math.abs(eRegen.hp - hpSetelahPukul) < 0.01, `${hpSetelahPukul} → ${Math.round(eRegen.hp)}`);

// ---------- 7. RANGED: telegraph sebelum meludah (§19) ----------
const defBakteri = daftar.find((e) => e.id === 'bakteri');
const eRanged = new Enemy(defBakteri, 0, 0, { hpScale: 1, speedScale: 1 });
eRanged.armShooter();
cek('mode peludah tersedia (ranged archetype)', !!eRanged.shooter, String(eRanged.shooter));
let tembakan = 0; let telegraphDulu = false; let pernahTelegraph = false;
const gamePalsu = {
  tryEnemyShoot() { tembakan += 1; return true; },
  effects: null,
  packAggro() {},
};
const pemain = { x: 300, y: 0, radius: 15 };
for (let i = 0; i < 600; i++) {
  eRanged.update(1 / 60, pemain, i / 60, gamePalsu);
  if (eRanged.attackSpriteHint) pernahTelegraph = true;
  if (tembakan > 0 && pernahTelegraph) { telegraphDulu = true; break; }
}
cek('peludah menembak ke pemain', tembakan > 0, `tembakan=${tembakan}`);
cek('peludah memberi telegraph sebelum tembakan', telegraphDulu, `telegraph=${pernahTelegraph}, tembakan=${tembakan}`);

console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 15)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
