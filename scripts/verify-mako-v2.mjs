/**
 * verify-mako-v2.mjs — asset-only validator for the Mako V2 art batch.
 * Does not inspect or modify gameplay logic.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const manifestPath = path.join(ROOT, 'assets/sprites/mako_v2/manifest.json');
const fail = (msg) => { throw new Error(msg); };
const ok = (msg) => console.log(`PASS ${msg}`);

if (!fs.existsSync(manifestPath)) fail('manifest Mako V2 hilang');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.heroId !== 'macrophage') fail(`heroId salah: ${manifest.heroId}`);
if (manifest.direction !== 'v2_belly_devourer') fail(`direction salah: ${manifest.direction}`);
if (manifest.stages?.length !== 5) fail(`stage count ${manifest.stages?.length} != 5`);
if (manifest.mutations?.length !== 18) fail(`mutation count ${manifest.mutations?.length} != 18`);
if (manifest.skins?.length !== 5) fail(`skin count ${manifest.skins?.length} != 5`);

function checkPng(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) fail(`asset hilang: ${rel}`);
  const b = fs.readFileSync(full);
  if (b.length < 100) fail(`asset terlalu kecil: ${rel}`);
  if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`bukan PNG: ${rel}`);
  // PNG IHDR byte 25 is color type; 6 = RGBA, required for transparent art.
  if (b[25] !== 6) fail(`PNG bukan RGBA/transparan: ${rel}`);
}

const stateNames = ['idle', 'attack', 'upgrade'];
for (const stage of manifest.stages) {
  if (stage.stage < 0 || stage.stage > 4) fail(`stage invalid: ${stage.stage}`);
  for (const state of stateNames) checkPng(stage.states[state]);
}
ok('5 evolution stages × 3 states = 15 RGBA PNG');

for (const mutation of manifest.mutations) checkPng(mutation.path);
ok('18 mutation overlays = 18 RGBA PNG');

for (const skin of manifest.skins) checkPng(skin.path);
ok('5 skin previews = 5 RGBA PNG');

const stageWaves = manifest.stages.map((s) => s.wave);
if (JSON.stringify(stageWaves) !== JSON.stringify([1, 2, 4, 7, 10])) fail(`wave milestones salah: ${stageWaves}`);
ok(`wave milestones ${stageWaves.join(' → ')}`);

console.log('MAKO_V2_ART_VERIFY', JSON.stringify({
  stages: manifest.stages.length,
  states: stateNames.length,
  mutations: manifest.mutations.length,
  skins: manifest.skins.length,
  totalPng: manifest.stages.length * stateNames.length + manifest.mutations.length + manifest.skins.length,
}));
