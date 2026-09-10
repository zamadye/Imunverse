/**
 * verify-ecosystem-assets.mjs — static validator for Art Director asset pass.
 *
 * Checks that additive post-pivot visual assets exist and that building art
 * covers every tower unlock id from the Agent 8 linkage summary recorded in
 * src/core/MIGRATION_BRIEF.md / src/buildings/data/colony-buildings-art.json.
 */
import fs from 'node:fs';

const fail = (msg) => { throw new Error(msg); };
const ok = (msg) => console.log(`✓ ${msg}`);
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p) || fail(`missing: ${p}`);

exists('assets/ART_BIBLE.md');
exists('src/core/MIGRATION_BRIEF.md');
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
  'shots/review/art-ecosystem-asset-system.png',
]) exists(artifact);
ok('reference/review sheets present');

console.log('ASSET_ECOSYSTEM_VERIFY', JSON.stringify({
  heroTowerFrames: heroSpec.length * 3,
  pathogenPathSprites: enemySpec.length,
  buildingStageSprites: buildingSpec.length * 3,
  coveredTowerUnlocks: covered.size,
}));
