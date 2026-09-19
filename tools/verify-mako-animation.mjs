#!/usr/bin/env node
/**
 * Verify the Mako animation contract before frame art is wired into runtime.
 * Default mode validates the manifest and reports the expected missing frame
 * count. Pass --require-frames after generation to make missing frames fail.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/mako-animation.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const requiredDirections = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
const requiredStates = ['idle', 'walk', 'attack', 'devour', 'hit', 'death'];
const errors = [];
const missing = [];

if (manifest.heroId !== 'macrophage') errors.push('heroId must be macrophage');
if (manifest.frameSpec?.width !== 256 || manifest.frameSpec?.height !== 256) errors.push('frame size must be 256x256');
if (manifest.frameSpec?.format !== 'png' || manifest.frameSpec?.colorType !== 'RGBA') errors.push('frame format must be PNG RGBA');
if (JSON.stringify(manifest.directions) !== JSON.stringify(requiredDirections)) errors.push('direction order is not the canonical 8-direction order');
for (const state of requiredStates) {
  const cfg = manifest.states?.[state];
  if (!cfg) { errors.push(`missing state ${state}`); continue; }
  if (!Number.isInteger(cfg.framesPerDirection) || cfg.framesPerDirection < 1) errors.push(`${state}: invalid framesPerDirection`);
  if (!Number.isFinite(cfg.fps) || cfg.fps <= 0) errors.push(`${state}: invalid fps`);
  const seen = new Set();
  for (const direction of requiredDirections) {
    const entry = cfg.directions?.find((d) => d.direction === direction);
    if (!entry) { errors.push(`${state}: missing direction ${direction}`); continue; }
    if (entry.frames?.length !== cfg.framesPerDirection) errors.push(`${state}/${direction}: wrong frame count`);
    for (const file of entry.frames || []) {
      if (seen.has(file)) errors.push(`${state}: duplicate frame path ${file}`);
      seen.add(file);
      if (!fs.existsSync(path.join(root, file))) missing.push(file);
    }
  }
}
for (const state of ['attack', 'devour']) {
  let previous = -1;
  for (const event of manifest.events?.[state] || []) {
    if (!(event.at > previous && event.at >= 0 && event.at <= 1)) errors.push(`${state}: events must be strictly increasing in 0..1`);
    previous = event.at;
    if (!event.id || !event.effect) errors.push(`${state}: event needs id and effect`);
    if (event.effect && !manifest.effects?.[event.effect]) errors.push(`${state}: missing effect definition ${event.effect}`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `FAIL ${e}`).join('\n'));
  process.exit(1);
}
const expected = requiredStates.reduce((sum, state) => sum + manifest.states[state].framesPerDirection * requiredDirections.length, 0);
console.log(`PASS Mako animation manifest (${expected} frame paths, ${Object.values(manifest.events).flat().length} sync events)`);
console.log(`INFO frames present ${expected - missing.length}/${expected}; missing ${missing.length}`);
if (process.argv.includes('--require-frames') && missing.length) {
  console.error('FAIL animation frames are required but not all have been generated');
  process.exit(1);
}
