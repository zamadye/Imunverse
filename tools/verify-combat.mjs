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
const { loadAllData, getMutations: getMutationsData } = await import('../js/core/data-store.js');
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

// ---------- 8. PAYLOAD ARCHETYPE: data & penimpaan per hero (§17) ----------
const tanpaPayload = attacks.archetypes.filter((a) => !a.payload || Object.keys(a.payload).length === 0);
cek('8 archetype punya payload terdata', tanpaPayload.length === 0, tanpaPayload.map((a) => a.id).join(','));
const belumJalan = attacks.archetypes.filter((a) => a.status !== 'implemented');
cek('8 archetype SERANGAH berstatus implemented', belumJalan.length === 0, belumJalan.map((a) => a.id).join(','));
const tanpaTele = attacks.archetypes.filter((a) => !(a.telegraphSec > 0));
cek('tiap archetype punya telegraph > 0 dtk', tanpaTele.length === 0, tanpaTele.map((a) => a.id).join(','));
// SATU archetype harus terasa BEDA antar hero: area Makrofag (cincin besar,
// moderat) vs area Neutrofil (sempit tapi tajam) — angka ada di heroes.json.
const ppMakro = heroes.find((h) => h.id === 'macrophage').patternParams || {};
const ppNetro = heroes.find((h) => h.id === 'neutrophil').patternParams || {};
cek('satu archetype dibedakan per hero (area Makrofag ≠ area Neutrofil)',
  (ppMakro.radiusMult || 0) > (ppNetro.radiusMult || 0) && (ppNetro.dmgMult || 0) > (ppMakro.dmgMult || 0),
  `makro r${ppMakro.radiusMult}/d${ppMakro.dmgMult} vs netro r${ppNetro.radiusMult}/d${ppNetro.dmgMult}`);

// ---------- 9. EKSEKUSI ARCHETYPE DI RUNTIME (§17 + §19) ----------
const { beginAttack, updateAttack, updateSummons, archetypeForHero, mutationAttackMods, describeAttackChange } = await import('../js/systems/attack-archetype.js');
const { dealMembraneDamage } = await import('../js/systems/membrane-system.js');

/** Siapkan run uji memakai objek game NYATA (tanpa menjalankan game.update). */
function siapkan(heroId, posisiMusuh) {
  game.startRun(heroId);
  const run = game.run;
  run.enemies.length = 0;
  run.projectiles.length = 0;
  run.summons = [];
  run.membrane.clouds.length = 0;
  run.player.x = 0; run.player.y = 0; run.player.facing = 0; run.player.alive = true;
  const buah = [];
  for (const [x, y] of posisiMusuh) {
    const e = new Enemy(defBakteri, x, y, { hpScale: 6, speedScale: 1 });
    e.maxHP = 5000; e.hp = 5000;
    run.enemies.push(e);
    buah.push(e);
  }
  run.collision.rebuildEnemyGrid(run.enemies);
  return { run, musuh: buah };
}
const STATS = { contactDps: 30, pulseRadius: 130 };
/** Jalankan archetype sampai selesai; kembalikan potongan state penting. */
function jalankan(heroId, posisiMusuh, detik = 1.2) {
  const { run, musuh } = siapkan(heroId, posisiMusuh);
  const hp0 = musuh.map((e) => e.hp);
  const atk = beginAttack(game, { stats: STATS });
  const fase = [atk && atk.phase];
  const langkah = Math.round(detik * 60);
  let frameEksekusi = -1;
  for (let i = 0; i < langkah; i++) {
    const sebelum = run.attack && run.attack.phase;
    updateAttack(game, 1 / 60);
    const sesudah = run.attack && run.attack.phase;
    if (sesudah !== sebelum) fase.push(sesudah);
    if (sesudah === 'execution' && frameEksekusi < 0) frameEksekusi = i;
  }
  return {
    run, musuh, hp0, hp1: musuh.map((e) => e.hp), fase, frameEksekusi,
    atk, proyektil: run.projectiles.slice(), awan: run.membrane.clouds.slice(), summon: run.summons.slice(),
  };
}

// 9a. RANTAI FASE wajib: anticipation → telegraph → execution → impact → recovery
const rArea = jalankan('macrophage', [[60, 0]]);
cek('PULSE menjalankan archetype hero (area Makrofag)', rArea.atk && rArea.atk.id === 'area', String(rArea.atk && rArea.atk.id));
const urutan = rArea.fase.filter((f) => f && f !== 'done');
cek('rantai fase: anticipation→telegraph→execution→impact→recovery',
  urutan.join('>') === 'anticipation>telegraph>execution>impact>recovery', urutan.join('>'));

// 9b. TELEGRAPH: bentuk sudah terbaca & BELUM ada damage sebelum execution
const cfgArea = attacks.archetypes.find((a) => a.id === 'area');
const frameTele = Math.round((0.12 + Math.max(0.25, cfgArea.telegraphSec)) * 60);
const { run: runT, musuh: musuhT } = siapkan('macrophage', [[60, 0]]);
beginAttack(game, { stats: STATS });
for (let i = 0; i < frameTele - 3; i++) updateAttack(game, 1 / 60);
const hpSaatTelegraph = musuhT[0].hp;
const faseSaatTelegraph = runT.attack.phase;
for (let i = 0; i < 12; i++) updateAttack(game, 1 / 60);
const hpSetelahEksekusi = musuhT[0].hp;
cek('bentuk serangan sudah tergambar saat telegraph (belum melukai)',
  faseSaatTelegraph === 'telegraph' && hpSaatTelegraph === 5000,
  `fase=${faseSaatTelegraph}, hp=${hpSaatTelegraph}`);
cek('damage archetype jatuh SETELAH telegraph', hpSetelahEksekusi < hpSaatTelegraph, `${hpSaatTelegraph} → ${Math.round(hpSetelahEksekusi)}`);
cek('archetype area melukai musuh di dalam cincin', rArea.hp1[0] < rArea.hp0[0], `${Math.round(rArea.hp0[0])} → ${Math.round(rArea.hp1[0])}`);
const rAreaLuar = jalankan('macrophage', [[900, 900]]);
cek('archetype area TIDAK melukai musuh di luar cincin', rAreaLuar.hp1[0] === rAreaLuar.hp0[0], `hp=${Math.round(rAreaLuar.hp1[0])}`);

// 9c. BEAM (TCD8): lurus ke depan, tidak ke belakang
// musuh depan DIBUAT lebih dekat supaya jelas yang jadi sasaran (arah dikunci
// pada musuh terdekat saat telegraph), lalu musuh belakang ditempatkan tetap
// dalam jangkauan jarak tapi di belakang hero — bentuknya harus meleset.
const rBeam = jalankan('tcd8', [[120, 0], [-150, 0]]);
cek('beam melukai musuh di depan', rBeam.hp1[0] < rBeam.hp0[0], `${Math.round(rBeam.hp0[0])} → ${Math.round(rBeam.hp1[0])}`);
cek('beam TIDAK melukai musuh di belakang', rBeam.hp1[1] === rBeam.hp0[1], `hp belakang=${Math.round(rBeam.hp1[1])}`);

// 9d. MELEE (Sel NK): busur di depan saja
const rMelee = jalankan('nkcell', [[60, 0], [-80, 0]]);
cek('melee mengenai busur di depan', rMelee.hp1[0] < rMelee.hp0[0], `${Math.round(rMelee.hp0[0])} → ${Math.round(rMelee.hp1[0])}`);
cek('melee TIDAK mengenai yang di belakang', rMelee.hp1[1] === rMelee.hp0[1], `hp belakang=${Math.round(rMelee.hp1[1])}`);

// 9e. CHAIN (Dendritik): melompat & meluruh
const rChain = jalankan('dendritic', [[70, 0], [150, 0], [230, 0]]);
const turun = [0, 1, 2].map((i) => rChain.hp0[i] - rChain.hp1[i]);
cek('chain mengenai ≥2 musuh berurutan', turun.filter((d) => d > 0).length >= 2, turun.map((d) => Math.round(d)).join(','));
cek('damage chain meluruh antar lompatan', turun[0] > 0 && (turun[2] === 0 || turun[2] < turun[0]), turun.map((d) => Math.round(d)).join(' → '));

// 9f. PROJECTILE (Eos) & HOMING (Sel B): benar-benar meluncurkan proyektil
const rProj = jalankan('eosinophil', [[300, 0]]);
cek('projectile meluncurkan proyektil', rProj.proyektil.length >= 3, `proyektil=${rProj.proyektil.length}`);
const rHom = jalankan('bcell', [[300, 40]]);
cek('homing meluncurkan proyektil pengejar', rHom.proyektil.length >= 3 && rHom.proyektil.every((p) => (p.turnRate || 0) > 0), `proyektil=${rHom.proyektil.length}`);

// 9g. ZONE (Basofil): medan tinggal di lantai & melukai yang berada di dalam
const rZone = jalankan('basophil', [[200, 0]]);
cek('zone meninggalkan medan di lantai', rZone.awan.length === 1 && rZone.awan[0].life > 0, `awan=${rZone.awan.length}`);
const awan = rZone.awan[0];
if (awan) {
  const { run: runZ, musuh: musuhZ } = siapkan('basophil', [[Math.round(awan.x), Math.round(awan.y)]]);
  runZ.membrane.clouds.push({ ...awan, t: 0 });
  runZ.collision.rebuildEnemyGrid(runZ.enemies);
  const hpAwalZ = musuhZ[0].hp;
  dealMembraneDamage(game, musuhZ[0], awan.dps * 0.25, { sourceKind: 'cloud', noCrit: true });
  cek('medan zone melukai musuh di dalamnya', musuhZ[0].hp < hpAwalZ, `${Math.round(hpAwalZ)} → ${Math.round(musuhZ[0].hp)}`);
}

// 9h. SUMMON (TCD4): entitas muncul & punya umur
const rSum = jalankan('tcd4', [[300, 0]], 0.9);
cek('summon memanggil entitas', rSum.summon.length >= 1, `entitas=${rSum.summon.length}`);
if (rSum.summon.length) {
  const s0 = rSum.summon[0];
  for (let i = 0; i < Math.round((s0.life + 0.5) * 60); i++) updateSummons(game, 1 / 60);
  cek('entitas summon habis masa hidupnya', rSum.run.summons.length === 0, `sisa=${rSum.run.summons.length}`);
}

// 9i. SETIAP hero menjalankan archetype-nya sendiri (tidak ada yang kosong)
const kosong = heroes.filter((h) => {
  const id = archetypeForHero(h);
  return !id || !attacks.archetypes.find((a) => a.id === id);
});
cek('11 hero terpetakan ke archetype yang ada', kosong.length === 0, kosong.map((h) => h.id).join(','));

// 9j. SMOKE TEST jalur nyata: PULSE tombol → archetype → menggambar, tanpa error
try {
  game.startRun('tcd8');
  game.triggerPulse();
  for (let i = 0; i < 90; i++) { updateAttack(game, 1 / 60); updateSummons(game, 1 / 60); }
  game.render(1 / 60, 1000);
  cek('PULSE + archetype + render tanpa error', true);
} catch (err) {
  cek('PULSE + archetype + render tanpa error', false, String(err && err.message || err));
}

// ---------- 10. SUPPORT: aura penguat musuh (§15) ----------
const defKanker = daftar.find((e) => e.id === 'sel_kanker');
cek('Sel Kanker membawa aura support', !!defKanker.aura && defKanker.archetypeSecondary === 'support',
  `aura=${!!defKanker.aura}, sekunder=${defKanker.archetypeSecondary}`);
const waves = baca('data/waves.json');
cek('affix elite "aura" terdaftar', (waves.elite.affixes || []).includes('aura') && !!waves.elite.affixParams.aura,
  (waves.elite.affixes || []).join(','));
cek('semua 9 archetype ancaman berstatus implemented',
  enemyArche.archetypes.filter((a) => a.status === 'implemented').length === 9,
  enemyArche.archetypes.map((a) => `${a.id}:${a.status}`).join(' '));

const pendukung = new Enemy(defKanker, 0, 0, { hpScale: 1, speedScale: 1 });
const terbantu = new Enemy(defBakteri, 60, 0, { hpScale: 4, speedScale: 1 });
const runAura = { enemies: [pendukung, terbantu], player: { x: 9999, y: 9999, radius: 15 }, effects: null, time: 0, collision: null };
const gameAura = { run: runAura, damagePlayer() {}, provokeEnemy() {} };
const pemainJauh2 = { x: 9999, y: 9999, radius: 15 };
// (a) selama telegraph: BELUM ada buff
const teleCfg = defKanker.aura.telegraphSec;
for (let i = 0; i < Math.ceil(teleCfg * 60) - 4; i++) pendukung.update(1 / 60, pemainJauh2, 0, gameAura);
cek('aura support menelegraph dulu (belum menguatkan)', terbantu.auraBuffT === 0 && terbantu.auraDmgMult === 1,
  `buffT=${terbantu.auraBuffT}, dmgMult=${terbantu.auraDmgMult}`);
// (b) setelah telegraph: buff menyala ke musuh di radius
for (let i = 0; i < 12; i++) pendukung.update(1 / 60, pemainJauh2, 0, gameAura);
cek('aura menguatkan musuh di sekitarnya', terbantu.auraBuffT > 0 && terbantu.auraDmgMult > 1 && terbantu.auraDr > 0,
  `buffT=${terbantu.auraBuffT.toFixed(2)}, dmg×${terbantu.auraDmgMult}, dr=${terbantu.auraDr}`);
// (c) buff membuat musuh menahan lebih banyak damage
const polos = new Enemy(defBakteri, 0, 0, { hpScale: 4, speedScale: 1 });
const pukulan = 40;
polos.takeDamage(pukulan);
const hilangPolos = polos.maxHP - polos.hp;
const berbuff = new Enemy(defBakteri, 0, 0, { hpScale: 4, speedScale: 1 });
berbuff.auraBuffT = 3; berbuff.auraDr = terbantu.auraDr; berbuff.auraDmgMult = terbantu.auraDmgMult;
berbuff.takeDamage(pukulan);
const hilangBuff = berbuff.maxHP - berbuff.hp;
cek('musuh ber-aura menahan lebih banyak damage', hilangBuff < hilangPolos, `polos -${hilangPolos} vs aura -${Math.round(hilangBuff)}`);
// (d) buff berakhir sesuai durasi
const durasi = defKanker.aura.durationSec;
for (let i = 0; i < Math.ceil((durasi + 0.2) * 60); i++) terbantu.update(1 / 60, pemainJauh2, 0, gameAura);
cek('buff aura berakhir sesuai durasi', terbantu.auraBuffT === 0 && terbantu.auraDmgMult === 1, `buffT=${terbantu.auraBuffT}`);
// (e) dukungan bisa digagalkan: bekukan pendukungnya
const pendukung2 = new Enemy(defKanker, 0, 0, { hpScale: 1, speedScale: 1 });
const terbantu2 = new Enemy(defBakteri, 50, 0, { hpScale: 4, speedScale: 1 });
const gameAura2 = { run: { enemies: [pendukung2, terbantu2], player: { x: 9999, y: 9999, radius: 15 }, effects: null, time: 0 }, damagePlayer() {}, provokeEnemy() {} };
pendukung2.frozen = 5;
for (let i = 0; i < Math.ceil((defKanker.aura.pulseSec + teleCfg + 0.5) * 60); i++) pendukung2.update(1 / 60, pemainJauh2, 0, gameAura2);
cek('membekukan pendukung menggagalkan aura', terbantu2.auraBuffT === 0, `buffT=${terbantu2.auraBuffT}`);


// ---------- 11. P2 — MUTASI MENGUBAH CARA BERTEMPUR (bukan hanya angka) ----------
/** Jalankan archetype dengan mutasi aktif (run.activeMutations = sumber nyata). */
function jalankanMutasi(heroId, posisiMusuh, mutasi = [], detik = 1.2) {
  const { run, musuh } = siapkan(heroId, posisiMusuh);
  run.activeMutations = mutasi.slice();
  const hp0 = musuh.map((e) => e.hp);
  const atk = beginAttack(game, { stats: STATS });
  const langkah = Math.round(detik * 60);
  for (let i = 0; i < langkah; i++) updateAttack(game, 1 / 60);
  return { run, musuh, hp0, hp1: musuh.map((e) => e.hp), atk, id: atk && atk.id };
}

// (a) mutasi MENIMPA angka payload: Nova memperlebar cincin Makrofag (1,45 → 1,6)
const dasar200 = jalankanMutasi('macrophage', [[200, 0]], []);
const nova200 = jalankanMutasi('macrophage', [[200, 0]], ['nova']);
cek('mutasi menimpa angka payload (radius area Makrofag melebar)',
  dasar200.hp1[0] === dasar200.hp0[0] && nova200.hp1[0] < nova200.hp0[0],
  `tanpa mutasi -${Math.round(dasar200.hp0[0] - dasar200.hp1[0])} | nova -${Math.round(nova200.hp0[0] - nova200.hp1[0])}`);

// (b) mutasi MENGUBAH BENTUK serangan: Reaksi Berantai mengubah proyektil → chain
const panah = jalankanMutasi('eosinophil', [[60, 0], [140, 0]], []);
const berantai = jalankanMutasi('eosinophil', [[60, 0], [140, 0]], ['rantai']);
cek('mutasi mengubah BENTUK serangan (proyektil → chain)',
  panah.id === 'projectile' && berantai.id === 'chain', `${panah.id} → ${berantai.id}`);

// (c) perubahan bentuk terasa di arena: melee (depan saja) → area (sekeliling)
const nkBiasa = jalankanMutasi('nkcell', [[60, 0], [-80, 0]], []);
const nkNova = jalankanMutasi('nkcell', [[60, 0], [-80, 0]], ['nova']);
const belakangBiasa = Math.round(nkBiasa.hp0[1] - nkBiasa.hp1[1]);
const belakangNova = Math.round(nkNova.hp0[1] - nkNova.hp1[1]);
cek('perubahan bentuk terasa (melee depan saja → area sekeliling)',
  nkBiasa.id === 'melee' && nkNova.id === 'area' && belakangBiasa === 0 && belakangNova > 0,
  `${nkBiasa.id}→${nkNova.id}, belakang ${belakangBiasa} vs ${belakangNova}`);

// (d) pengali damage global mutasi (Auto-Pulse menembak lebih lemah per tembakan)
const dasarDmg = jalankanMutasi('macrophage', [[60, 0]], []);
const autoDmg = jalankanMutasi('macrophage', [[60, 0]], ['medan_pulsa']);
const dmgDasar = Math.round(dasarDmg.hp0[0] - dasarDmg.hp1[0]);
const dmgAuto = Math.round(autoDmg.hp0[0] - autoDmg.hp1[0]);
cek('mutasi mengubah damage serangan (auto-pulse lebih lemah per tembakan)',
  dmgAuto > 0 && dmgAuto < dmgDasar, `dasar -${dmgDasar} vs auto-pulse -${dmgAuto}`);

// (e) regresi: mutasi TANPA blok attack tidak mengubah serangan sedikit pun
const regenDmg = jalankanMutasi('macrophage', [[60, 0]], ['regenerasi']);
const regenJauh = jalankanMutasi('macrophage', [[200, 0]], ['regenerasi']);
cek('mutasi tanpa blok attack tidak mengubah serangan',
  Math.round(regenDmg.hp0[0] - regenDmg.hp1[0]) === dmgDasar && regenJauh.hp1[0] === regenJauh.hp0[0],
  `-${Math.round(regenDmg.hp0[0] - regenDmg.hp1[0])} vs dasar -${dmgDasar}`);

// (f) kontrak data: semua blok attack mutasi berbentuk benar & archetype-nya ada
const daftarMutasi = getMutationsData().mutations || [];
const idArchetype = new Set((attacks.archetypes || []).map((a) => a.id));
const berAttack = daftarMutasi.filter((m) => m.attack);
const salahBentuk = berAttack.filter((m) => {
  const a = m.attack;
  const fd = a.archetypeFrom && Object.values(a.archetypeFrom).some((v) => !idArchetype.has(v));
  const fp = a.payload && Object.keys(a.payload).some((k) => !idArchetype.has(k));
  const fm = typeof a.dmgMult === 'number' && !(a.dmgMult > 0);
  return fd || fp || fm;
});
cek('semua blok attack mutasi valid (archetype & angka benar)',
  berAttack.length >= 12 && salahBentuk.length === 0,
  `${berAttack.length} mutasi ber-blok attack, ${salahBentuk.length} salah: ${salahBentuk.map((m) => m.id).join(',')}`);

// (g) mods terbaca dari run (sumber tunggal: run.activeMutations)
const { run: runMods } = siapkan('macrophage', []);
runMods.activeMutations = ['nova', 'medan_pulsa'];
const mods = mutationAttackMods(runMods);
cek('mods mutasi terbaca dari run.activeMutations',
  mods.ids.length === 2 && Math.abs(mods.dmgMult - 0.85) < 1e-6 && !!mods.archetypeFrom.melee && !!mods.payload.area,
  `ids=${mods.ids.join('+')} dmgMult=${mods.dmgMult}`);

// (h) teks kartu mutasi diturunkan dari blok attack (bukan dikarang di UI)
const heroMakro = heroes.find((h) => h.id === 'macrophage');
const teksNova = describeAttackChange(daftarMutasi.find((m) => m.id === 'nova'), heroMakro);
const teksRegen = describeAttackChange(daftarMutasi.find((m) => m.id === 'regenerasi'), heroMakro);
cek('teks kartu mutasi turun dari blok attack (bukan dikarang)',
  teksNova.includes('radius ×1.6') && teksNova.includes('damage ×2') && teksRegen === '',
  `nova="${teksNova}" | regenerasi="${teksRegen}"`);

// ---------- 12. P2 — POHON EVOLUSI + SINEMATIK MUTASI (§9) ----------
const {
  evoStageFor, evoSprite, evoProgress, signatureMutations, evoCounts, evoStatMult,
} = await import('../js/systems/evolution-system.js');
// Sinematik dipakai game.js di DALAM bundle — ambil instance yang SAMA lewat
// window.__IMUNVERSE.mutationCinematic supaya uji jalur nyata tidak bohong.
const CINE = (API && API.mutationCinematic) || await import('../js/systems/mutation-cinematic.js');
const { startMutationCinematic, updateMutationCinematic, cineActive, cinePhase, cineDuration, skipCinematic, resetCinematic } = CINE;
const evoData = baca('data/evolutions.json');

// (a) pohon: BASE → MUT1 → MUT2 → APEX, ambang jumlah mutasi naik
const idTahap = evoData.stages.map((s) => s.id);
const ambangNaik = evoData.stages.every((s, i) => i === 0 || (s.minMutations || 0) > (evoData.stages[i - 1].minMutations || 0));
cek('pohon evolusi BASE → MUT1 → MUT2 → APEX terurut',
  idTahap.join('>') === 'base>mut1>mut2>apex' && ambangNaik,
  `${idTahap.join('>')} | ambang ${evoData.stages.map((s) => s.minMutations).join(',')}`);

// (b) tiap hero punya jalur KHAS (≥2 mutasi yang menyentuh archetype-nya)
const sigKecil = heroes.filter((h) => (evoData.heroes[h.id]?.signature || []).length < 2);
const sigNyata = heroes.every((h) => (evoData.heroes[h.id]?.signature || []).every((id) => {
  const atk = (daftarMutasi.find((m) => m.id === id) || {}).attack || {};
  const arch = h.identity.attackArchetype;
  return !!(atk.payload && atk.payload[arch]) || !!(atk.archetypeFrom && atk.archetypeFrom[arch]);
}));
cek('tiap hero punya ≥2 mutasi khas archetype-nya',
  sigKecil.length === 0 && sigNyata, `${sigKecil.length} hero kurang, nyata=${sigNyata}`);

// (c) tahap run mengikuti jumlah mutasi (sumber tunggal: run.activeMutations)
const heroMak = heroes.find((h) => h.id === 'macrophage');
const sigMak = signatureMutations(heroMak);
const runPalsu = (ids) => ({ activeMutations: ids, heroDef: heroMak });
const nonSig = daftarMutasi.map((m) => m.id).filter((id) => !sigMak.includes(id));
cek('tahap naik mengikuti jumlah mutasi',
  evoStageFor(runPalsu([]), heroMak).id === 'base'
  && evoStageFor(runPalsu(['berduri']), heroMak).id === 'mut1'
  && evoStageFor(runPalsu(['berduri', 'elastis', 'nova']), heroMak).id === 'mut2'
  && evoStageFor(runPalsu(nonSig.slice(0, 5)), heroMak).id === 'mut2',
  `0=${evoStageFor(runPalsu([]), heroMak).id} 1=${evoStageFor(runPalsu(['berduri']), heroMak).id} 5non-sig=${evoStageFor(runPalsu(nonSig.slice(0, 5)), heroMak).id}`);

// (d) APEX butuh mutasi khas, bukan sekadar banyak mutasi
const apexRun = runPalsu([sigMak[0], sigMak[1], ...nonSig.slice(0, 3)]);
cek('APEX butuh mutasi khas hero (bukan sekadar ≥5 mutasi)',
  evoStageFor(apexRun, heroMak).id === 'apex' && evoCounts(apexRun, heroMak).signature >= 2,
  `${evoStageFor(apexRun, heroMak).id} khas=${evoCounts(apexRun, heroMak).signature}`);

// (e) foto karakter mengikuti tahap (bukan overlay)
const sprBase = evoSprite(runPalsu([]), heroMak);
const sprMut1 = evoSprite(runPalsu(['berduri']), heroMak);
const sprApex = evoSprite(apexRun, heroMak);
cek('foto karakter mengikuti tahap evolusi',
  sprBase === heroMak.spriteIdle && sprMut1 === heroMak.spriteMut1Idle && sprApex === heroMak.spriteMut2Idle,
  `${sprBase} → ${sprMut1} → ${sprApex}`);
cek('foto tahap benar-benar ada di assets',
  fs.existsSync(path.join(ROOT, sprMut1)) && fs.existsSync(path.join(ROOT, sprApex)),
  `${sprMut1} & ${sprApex}`);

// (f) pengali stat tahap & kemajuan ke tahap berikutnya
const mApex = evoStatMult(apexRun, heroMak);
const prog = evoProgress(runPalsu(['berduri']), heroMak);
cek('pengali stat & kemajuan tahap terbaca',
  mApex.damage > 1 && mApex.maxHP > 1 && prog.id === 'mut1' && prog.needMutations > 0,
  `apex dmg×${mApex.damage} hp×${mApex.maxHP} | mut1 butuh ${prog.needMutations} lagi`);

// (g) sinematik: urutan fase pause → charge → break → reveal → resume
resetCinematic();
let selesai = 0;
startMutationCinematic({ from: sprBase, to: sprMut1, name: 'Uji', stageName: 'MUT1', onDone: () => { selesai += 1; } });
const faseCine = [cinePhase()];
for (let i = 0; i < Math.ceil((cineDuration() + 0.1) * 60); i++) {
  updateMutationCinematic(1 / 60);
  const f = cinePhase();
  if (f && f !== faseCine[faseCine.length - 1]) faseCine.push(f);
}
cek('sinematik mutasi: jeda → energi → pecah → bentuk baru → lanjut',
  faseCine.slice(0, 5).join('>') === 'pause>charge>break>reveal>resume' && !cineActive() && selesai === 1,
  `${faseCine.join('>')} | onDone ${selesai}x`);

// (h) LEWATI itu VALID: tetap selesai, mutasi tidak hilang, onDone sekali
resetCinematic();
let selesai2 = 0;
startMutationCinematic({ from: sprBase, to: sprMut1, name: 'Uji', onDone: () => { selesai2 += 1; } });
for (let i = 0; i < 20; i++) updateMutationCinematic(1 / 60); // lewati ambang 0,2 dtk
const dilewati = skipCinematic();
cek('LEWATI sinematik valid (adegan selesai, onDone sekali)',
  dilewati && !cineActive() && selesai2 === 1, `skip=${dilewati} onDone=${selesai2}`);

// (i) jalur nyata: memilih mutasi di game menjalankan adegan + tahap naik
const { rollMutationChoices } = await import('../js/systems/mutation-system.js');
const { STATE, setLevelUpOpen } = await import('../js/core/state-manager.js');
resetCinematic();
game.startRun('macrophage');
const runEvo = game.run;
runEvo.bioPoints = 999;
const kartu = rollMutationChoices(runEvo).find((c) => c.isMutation && !c.lockedByBio);
runEvo.currentChoices = [kartu];
setLevelUpOpen(true);
game.chooseLevelUp(kartu.id);
const jalan = cineActive();
const tahapSetelah = runEvo.evoStage && runEvo.evoStage.id;
for (let i = 0; i < Math.ceil((cineDuration() + 0.2) * 60); i++) updateMutationCinematic(1 / 60);
cek('memilih mutasi menjalankan adegan & menaikkan tahap (jalur nyata)',
  jalan && runEvo.activeMutations.includes(kartu.id) && tahapSetelah === 'mut1'
  && !cineActive() && STATE.paused === false,
  `adegan=${jalan} mutasi=${runEvo.activeMutations.join(',')} tahap=${tahapSetelah} paused=${STATE.paused}`);
resetCinematic();

console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 15)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
