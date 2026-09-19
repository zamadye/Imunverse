/**
 * Uji P6 — GAME FEEL (PHAGOS_V2_REBUILD.txt §18–§20).
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom
 *   PHAGOS_BUNDLE=.tmp-bundle.js node tools/verify-gamefeel.mjs
 *
 * Yang dijamin:
 *   1. Tangga dampak normal → heavy → elite → ultimate → bossEvent NAIK
 *      konsisten di getar, hit-stop, durasi flash, squash (§20).
 *   2. Setiap hit menyalakan 5 kanal sekaligus: ANIMATION (squash) + VFX +
 *      SFX + ENEMY REACTION (flash/stagger) + CAMERA (§20).
 *   3. Boss: reaksi lebih lama, TANPA stagger & knockback (tetap terbaca).
 *   4. Keramaian terkendali: angka damage, partikel, getar, dan SFX
 *      dibatasi — "layar tidak kacau saat ramai".
 *   5. Telegraph musuh & keterbacaan serangan (§18–§19) terpenuhi dari data.
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
const GF = API.gameFeel;
const STATE = API.STATE;
cek('sutradara game feel terpasang di game', !!GF, JSON.stringify(Object.keys(API)));

const gf = baca('data/gamefeel.json');
const serangan = baca('data/attacks.json');
const kodeEnemy = fs.readFileSync(path.join(ROOT, 'js/entities/enemy.js'), 'utf8');
const kodeRender = fs.readFileSync(path.join(ROOT, 'js/render/sprite-loader.js'), 'utf8');

// ---------- 1. TANGGA DAMPAK (§20) ----------
const T = GF.TIER_ORDER;
const naik = (kunci) => T.every((t, i) => i === 0 || (gf.tiers[t][kunci] ?? 0) > (gf.tiers[T[i - 1]][kunci] ?? 0));
cek('tangga getar kamera naik: normal → bossEvent (§20)',
  T.length === 5 && naik('shake'), T.map((t) => `${t}:${gf.tiers[t].shake}`).join(' '));
cek('tangga hit-stop & durasi flash naik per tingkat (§20)',
  naik('killSec') && naik('flashSec') && naik('squash'),
  `kill=${T.map((t) => gf.tiers[t].killSec).join('/')} flash=${T.map((t) => gf.tiers[t].flashSec).join('/')}`);
cek('hierarki: dampak biasa minimal, boss sinematik (§20)',
  gf.tiers.normal.shake <= 0.05 && gf.tiers.bossEvent.shake >= 0.5
  && gf.tiers.normal.hitSec === 0,
  `normal=${gf.tiers.normal.shake} boss=${gf.tiers.bossEvent.shake} hitSecNormal=${gf.tiers.normal.hitSec}`);

// ---------- 2. RUNTIME: 5 KANAL MENYALA BERSAMAAN ----------
game.startRun('macrophage');
const run = game.run;
await sleep(60);
// Spawn TERARAH dari data (bukan mengandalkan RNG wave): satu musuh biasa,
// satu elite, satu boss — entitas nyata, bukan tiruan.
const defs = API.getData().enemies.enemies;
const idBiasa = (defs.find((d) => !d.elite && !d.isBoss) || {}).id;
const idElite = (defs.find((d) => d.elite) || {}).id;
const idBoss = (defs.find((d) => d.isBoss) || {}).id;
const spawn = (id, boss = false) => {
  const before = run.enemies.length;
  game.spawnEnemy(id, boss);
  return run.enemies[run.enemies.length - 1] || (before >= 0 ? null : null);
};
const MUSUH = spawn(idBiasa, false);
const ELITE = spawn(idElite, false);
const BOSS = spawn(idBoss, true);

const ukur = (e, opts = {}) => {
  if (!e) return null;
  const sebelum = { trauma: run.camera.shakeTrauma, num: run.effects.numbers.length, fx: run.effects.effects.length };
  const dampak = GF.applyHitImpact(game, e, opts);
  return {
    tier: dampak.tier,
    flash: e.hitFlash,
    flashDur: e.flashDur,
    squashT: e.squashT,
    squashAmt: e.squashAmt,
    stagger: (e.slowT || 0) > 0 ? e.slowT : 0,
    traumaNaik: run.camera.shakeTrauma - sebelum.trauma,
    vfxNaik: run.effects.effects.length - sebelum.fx,
    tierCfg: dampak.tierCfg,
  };
};

// reset getar & jeda supaya tiap tingkat terukur bersih
const bersihkan = () => { run.camera.shakeTrauma = 0; run.lastImpactShakeAt = -999; run.time += 1; };
bersihkan(); const n1 = ukur(MUSUH, {});
bersihkan(); const n2 = ukur(MUSUH, { crit: true });
bersihkan(); const e1 = ukur(ELITE, {});
bersihkan(); const b1 = ukur(BOSS, {});
cek('hit biasa = tingkat NORMAL: flash + squash, TANPA stagger & tanpa jeda',
  !!n1 && n1.tier === 'normal' && n1.flash > 0 && n1.squashT > 0 && n1.stagger === 0,
  JSON.stringify(n1 && { tier: n1.tier, flash: n1.flash, squash: n1.squashT, stagger: n1.stagger }));
cek('crit = tingkat HEAVY: flash lebih lama + musuh terhuyung (stagger)',
  !!n2 && n2.tier === 'heavy' && n2.flashDur > n1.flashDur && n2.stagger > 0
  && n2.squashAmt > n1.squashAmt,
  JSON.stringify(n2 && { tier: n2.tier, flash: n2.flashDur, stagger: n2.stagger, squash: n2.squashAmt }));
cek('elite = tingkat ELITE: reaksi & stagger di atas heavy',
  !!e1 && e1.tier === 'elite' && e1.flashDur >= n2.flashDur && e1.stagger >= n2.stagger
  && e1.tierCfg.shake > n2.tierCfg.shake,
  JSON.stringify(e1 && { tier: e1.tier, flash: e1.flashDur, stagger: e1.stagger, shake: e1.tierCfg.shake }));
cek('boss = tingkat BOSS EVENT: flash terlama, TANPA stagger (tetap mengancam)',
  !!b1 && b1.tier === 'bossEvent' && b1.flashDur > e1.flashDur && b1.stagger === 0
  && b1.tierCfg.shake > e1.tierCfg.shake,
  JSON.stringify(b1 && { tier: b1.tier, flash: b1.flashDur, stagger: b1.stagger, shake: b1.tierCfg.shake }));
cek('boss imun knockback (tetap terbaca, §20)',
  gf.knockback.bossImmune === true, `bossImmune=${gf.knockback.bossImmune}`);

// ---------- 2b. SATU HIT = 5 KANAL §20 (ANIMASI+VFX+SFX+REAKSI+KAMERA) -----
{
  const e = MUSUH;
  // reset jeda SFX & getar supaya pengukuran bersih
  run._gameFeel = { ...(run._gameFeel || {}), sfx: {} };
  run.lastImpactShakeAt = -999;
  run.time += 1;
  run.camera.shakeTrauma = 0;
  const sebelum = { fx: run.effects.effects.length, trauma: run.camera.shakeTrauma };
  let bunyi = 0;
  const asli = API.audio ? API.audio.crit.bind(API.audio) : null;
  if (API.audio) API.audio.crit = () => { bunyi++; };
  // jalur NYATA: spawnHitFeedback memanggil sutradara + memunculkan VFX
  const d = GF.applyHitImpact(game, e, { crit: true });
  run.effects.spawnSpark(e.x, e.y, true);
  run.effects.spawnImpact(e.x, e.y, '#ff9f43', { big: true, crit: true });
  const lima = {
    animasi: (e.squashT || 0) > 0,                                   // squash
    vfx: run.effects.effects.length - sebelum.fx,                    // spark/impact dipanggil game
    sfx: bunyi,
    reaksi: (e.hitFlash || 0) > 0 && (e.slowT || 0) > 0,             // flash + stagger
    kamera: run.camera.shakeTrauma - sebelum.trauma,
  };
  if (API.audio) API.audio.crit = asli;
  // VFX sesungguhnya dipanggil game.spawnHitFeedback (jalur pemain) — pastikan
  // jalur itu juga menyalakan kelima kanal, bukan hanya sutradaranya.
  run._gameFeel.sfx = {};
  run.lastImpactShakeAt = -999;
  run.time += 1;
  run.camera.shakeTrauma = 0;
  bunyi = 0;
  if (API.audio) API.audio.crit = () => { bunyi++; };
  const fx0 = run.effects.effects.length;
  game.spawnHitFeedback(e, 42, false, true, { sourceKind: 'melee' });
  const lewatGame = {
    vfx: run.effects.effects.length - fx0,
    sfx: bunyi,
    kamera: run.camera.shakeTrauma,
    squash: (e.squashT || 0) > 0,
  };
  if (API.audio) API.audio.crit = asli;
  cek('satu hit menyalakan 5 kanal: animasi+VFX+SFX+reaksi+kamera (§20)',
    lima.animasi && lima.sfx >= 1 && lima.reaksi && lima.kamera > 0 && d.tier === 'heavy',
    JSON.stringify(lima));
  cek('jalur nyata spawnHitFeedback juga 5 kanal (tidak ada kanal yang putus)',
    lewatGame.vfx >= 1 && lewatGame.sfx >= 1 && lewatGame.kamera > 0 && lewatGame.squash,
    JSON.stringify(lewatGame));
}

// ---------- 3. KAMERA: CAP & THROTTLE ----------
run.camera.shakeTrauma = 0;
for (let i = 0; i < 50; i++) GF.addImpactShake(game, 0.65, { throttle: false });
const traumaCap = gf.camera.traumaCap;
cek('getar kamera di-cap walau dampak beruntun (§20: tidak membuat mual)',
  run.camera.shakeTrauma <= traumaCap + 1e-6 && run.camera.shakeTrauma > 0,
  `trauma=${run.camera.shakeTrauma.toFixed(3)} cap=${traumaCap}`);
run.camera.shakeTrauma = 0;
run.time += 1;
run.lastImpactShakeAt = -999;
const pertama = GF.addImpactShake(game, gf.tiers.normal.shake);
const kedua = GF.addImpactShake(game, gf.tiers.normal.shake);
cek('getar kecil ber-throttle (keroyokan tidak menggetarkan layar terus)',
  pertama > 0 && kedua === 0, `pertama=${pertama} kedua=${kedua}`);

// ---------- 4. KERAMAIAN: ANGKA · PARTIKEL · SFX ----------
// angka damage: budget per detik
game.startRun('macrophage');
const run2 = game.run;
run2.enemies.length = 0;
run2._gameFeel = null; // reset token
GF.updateGameFeel(run2, 0);
let boleh = 0;
for (let i = 0; i < 200; i++) if (GF.numberAllowed(run2)) boleh++;
const capAngka = gf.crowd.numbersMax;
cek('angka damage dibatasi budget & kapasitas layar (tidak menumpuk)',
  boleh > 0 && boleh <= capAngka, `angka dalam 1 frame=${boleh} (maks ${capAngka})`);
GF.updateGameFeel(run2, 1);
cek('budget angka terisi ulang per detik (§20: tetap terbaca saat ramai)',
  GF.numberAllowed(run2) === true, 'token tidak terisi ulang');

// skala keramaian: partikel & getar mengecil saat musuh banyak
const sepi = GF.crowdScale({ enemies: [] });
const ramai = GF.crowdScale({ enemies: Array.from({ length: gf.crowd.busyEnemyCount }, () => ({ alive: true })) });
cek('partikel & getar mengecil saat layar ramai (§20: VFX tidak bikin kacau)',
  sepi.particles === 1 && ramai.particles <= gf.crowd.particleScale + 1e-6
  && ramai.shake <= gf.crowd.shakeScale + 1e-6 && ramai.busy === true,
  `sepi=${sepi.particles.toFixed(2)}/${sepi.shake.toFixed(2)} ramai=${ramai.particles.toFixed(2)}/${ramai.shake.toFixed(2)}`);
cek('jumlah partikel mengikuti skala keramaian',
  GF.particleBudget({ enemies: Array.from({ length: gf.crowd.busyEnemyCount }, () => ({ alive: true })) }, 20) < 20,
  `budget=${GF.particleBudget({ enemies: Array.from({ length: gf.crowd.busyEnemyCount }, () => ({ alive: true })) }, 20)}`);

// SFX ber-throttle: hit beruntun tidak membanjiri telinga.
// Yang diintai HARUS instance audio yang dipakai bundle (window.__IMUNVERSE.audio).
const audioMod = API.audio || null;
const hitungan = { hit: 0 };
if (audioMod) {
  const asli = audioMod.hit.bind(audioMod);
  audioMod.hit = () => { hitungan.hit++; };
  run2._gameFeel = null;
  for (let i = 0; i < 60; i++) GF.playSfx(run2, 'hit');
  const jeda = gf.crowd.sfxThrottleMs.hit;
  const batas = Math.ceil(1000 / jeda) + 2;
  cek('SFX hit ber-throttle: 60 hit tidak jadi 60 bunyi (§20)',
    hitungan.hit > 0 && hitungan.hit <= batas, `bunyi=${hitungan.hit} (batas ${batas} @${jeda}ms)`);
  audioMod.hit = asli;
} else {
  cek('SFX hit ber-throttle: 60 hit tidak jadi 60 bunyi (§20)', false, 'audio bundel tidak terekspos');
}

// 40 kill dalam satu frame: layar & log tidak meledak
game.startRun('macrophage');
const run3 = game.run;
const korban = [];
for (let i = 0; i < 40; i++) {
  game.spawnEnemy(idBiasa, false);
  const e = run3.enemies[run3.enemies.length - 1];
  if (!e) break;
  korban.push(e);
}
let errorKill = '';
try {
  for (const e of korban) { e.hp = 0; game.onEnemyKilled(e, 'melee'); }
} catch (err) { errorKill = String(err && err.message); }
// label "+N ANTIBODI" ikut budget yang sama (tidak 40 label sekaligus)
const angkaHidup = run3.effects.numbers.length;
const partikelHidup = run3.effects.particles.length;
const teksMaks = gf.crowd.numbersMax + gf.crowd.labelsMax;
cek('40 kill sekaligus: tidak error & layar tetap terkendali (§20)',
  errorKill === '' && korban.length >= 20 && angkaHidup <= teksMaks && partikelHidup <= 400
  && run3.camera.shakeTrauma <= gf.camera.traumaCap + 1e-6,
  `kill=${korban.length} teks=${angkaHidup}/${teksMaks} partikel=${partikelHidup} trauma=${run3.camera.shakeTrauma.toFixed(2)} err="${errorKill}"`);

// ---------- 5. TELEGRAPH & KETERBACAAN (§18–§19) ----------
const arketipe = serangan.archetypes || [];
const punyaBentuk = arketipe.length >= 5 && arketipe.every((a) => a.shape && a.readable && typeof a.telegraphSec === 'number');
cek('tiap arketipe serangan punya BENTUK & tanda bahaya terbaca tanpa angka (§18)',
  punyaBentuk, `${arketipe.length} arketipe: ${arketipe.map((a) => a.id).join(',')}`);
const bentukUnik = new Set(arketipe.map((a) => a.shape)).size === arketipe.length;
cek('bentuk tiap arketipe BERBEDA (terbaca sekilas, §18)', bentukUnik,
  arketipe.map((a) => `${a.id}:${a.shape}`).join(' '));
const telegraphCukup = arketipe.every((a) => a.telegraphSec >= 0.18);
cek('telegraph serangan cukup untuk dihindari (§19)',
  telegraphCukup && arketipe.some((a) => a.telegraphSec >= 0.45),
  arketipe.map((a) => `${a.id}:${a.telegraphSec}`).join(' '));
const telegraphMusuh = /atkPhase = 'windup'|windupOverride/.test(kodeEnemy)
  && baca('data/combat.json').contactAttack.windup >= 0.2;
cek('serangan musuh bertelegraph sebelum mengenai (§19)', telegraphMusuh,
  `windup=${baca('data/combat.json').contactAttack.windup}`);

// ---------- 6. SQUASH DI-ANGKUT KE RENDERER (ANIMATION, §20) ----------
cek('squash benar-benar dipakai renderer (drawSprite scaleX/scaleY)',
  /opts\.scaleX/.test(kodeRender) && /e\.squashT/.test(fs.readFileSync(path.join(ROOT, 'js/core/game.js'), 'utf8')),
  'squash tidak sampai ke renderer');
cek('death pop bertingkat (normal < elite < boss)',
  GF.deathPopFor(false, false).scaleTo < GF.deathPopFor(false, true).scaleTo
  && GF.deathPopFor(false, true).scaleTo < GF.deathPopFor(true, false).scaleTo,
  `${GF.deathPopFor(false, false).scaleTo} < ${GF.deathPopFor(false, true).scaleTo} < ${GF.deathPopFor(true, false).scaleTo}`);

console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 15)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
