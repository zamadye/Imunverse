/**
 * verify-ecosystem-assets.mjs — static validator for Art Director asset pass.
 *
 * Checks that additive post-pivot visual assets exist and that building art
 * covers every tower unlock id from the Agent 8 linkage summary recorded in
 * src/buildings/data/colony-buildings-art.json.
 *
 * Catatan 13 Sep 2026: cek keberadaan `assets/ART_BIBLE.md` dan
 * `src/core/MIGRATION_BRIEF.md` DIHAPUS karena kedua dokumen lama itu ikut
 * dibersihkan (hanya README.md akar dan 2 dokumen docs/ dari paket v2.0 yang
 * dipertahankan). Isi keduanya tidak pernah di-parse di sini — hanya
 * keberadaannya yang dulu diperiksa — sehingga sisa validator tetap utuh.
 * Penunjuk `artBible` dan `migrationReference` di tiga berkas JSON spek seni
 * (di bawah folder src) serta di tools/gen_ecosystem_assets.py kini mengarah
 * ke berkas yang tidak ada.
 */
import fs from 'node:fs';

const fail = (msg) => { throw new Error(msg); };
const ok = (msg) => console.log(`✓ ${msg}`);
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p) || fail(`missing: ${p}`);

exists('tools/gen_ecosystem_assets.py');

const heroes = read('data/heroes.json').heroes || [];
const enemies = read('data/enemies.json').enemies || [];
const heroSpec = read('src/characters/data/hero-tower-poses.json').items || [];
const enemySpec = read('src/enemies/data/pathogen-path-style.json').items || [];
const buildingDoc = read('src/buildings/data/colony-buildings-art.json');
const buildingSpec = buildingDoc.items || [];
const towerUnlockCoverage = buildingDoc.towerUnlockCoverage || {};

if (heroSpec.length !== heroes.length) fail(`hero tower spec count ${heroSpec.length} != heroes ${heroes.length}`);
if (enemySpec.length !== enemies.length) fail(`enemy path spec count ${enemySpec.length} != enemies ${enemies.length}`);
if (buildingSpec.length !== 7) fail(`building art spec count ${buildingSpec.length} != 7`);

for (const item of heroSpec) {
  if (!item.heroId || !item.towerId) fail(`hero spec missing id/towerId: ${JSON.stringify(item)}`);
  for (const [state, sprite] of Object.entries(item.towerSprites || {})) {
    exists(sprite);
    if (!sprite.includes(`${item.heroId}_tower_${state}.png`)) fail(`unexpected tower sprite name for ${item.heroId}/${state}: ${sprite}`);
  }
}
ok(`${heroSpec.length} hero specs × 3 tower states`);

for (const item of enemySpec) {
  if (!item.enemyId || !item.family) fail(`enemy spec missing id/family: ${JSON.stringify(item)}`);
  exists(item.pathSprite);
}
ok(`${enemySpec.length} pathogen path sprites`);

for (const item of buildingSpec) {
  if (!item.buildingId || !item.visualMetaphor) fail(`building spec missing identity: ${JSON.stringify(item)}`);
  const sprites = item.sprites || {};
  for (const state of ['stage1', 'stage2', 'stage3']) exists(sprites[state]);
}
ok(`${buildingSpec.length} colony buildings × 3 growth stages`);

const covered = new Set(buildingSpec.flatMap((b) => b.coveredTowerUnlocks || []));
const required = Object.keys(towerUnlockCoverage);
const missing = required.filter((towerId) => !covered.has(towerId));
if (missing.length) fail(`building art does not cover tower unlocks: ${missing.join(', ')}`);
ok(`${covered.size}/${required.length} tower unlock ids covered by colony buildings`);

for (const artifact of [
  'assets/heroes/reference/hero_tower_reference_sheet.png',
  'assets/enemies/reference/pathogen_path_reference_sheet.png',
  'assets/buildings/reference/colony_buildings_reference_sheet.png',
]) exists(artifact);
ok('reference sheets present');

// Bukti review berupa SCREENSHOT adalah artefak yang dihasilkan ulang oleh
// e2e (scripts/e2e-*.mjs menulis ke shots/), bukan aset sumber. Seluruh isi
// shots/ dibersihkan pada 13 Sep 2026, jadi keberadaannya diturunkan menjadi
// peringatan — tiga reference sheet di atas tetap fatal.
const reviewShot = 'shots/review/art-ecosystem-asset-system.png';
if (fs.existsSync(reviewShot)) ok('review screenshot present');
else console.log(`! review screenshot belum dibuat: ${reviewShot} (jalankan e2e untuk menghasilkannya ulang)`);

console.log('ASSET_ECOSYSTEM_VERIFY', JSON.stringify({
  heroTowerFrames: heroSpec.length * 3,
  pathogenPathSprites: enemySpec.length,
  buildingStageSprites: buildingSpec.length * 3,
  coveredTowerUnlocks: covered.size,
}));
