/**
 * Verify the visible Mako Rive package used by gameplay.
 *
 * This intentionally checks the direct-artboard path, not the retired
 * transform-only hero rig. The official Rive CLI performs the import/build
 * validation; the inspector result confirms the visible images, meshes, bones,
 * animations, and state-machine controls are all present in the same file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PROJECT = path.join(ROOT, 'assets', 'character-anim-src', 'mako');
const RIV = path.join(PROJECT, 'mako-rive-draft.riv');
const errors = [];
const results = {};
const check = (name, ok, detail = '') => {
  results[name] = ok ? 'OK' : `GAGAL — ${detail}`;
  if (!ok) errors.push(`${name}: ${detail}`);
};

check('Mako Rive source exists', fs.existsSync(path.join(PROJECT, 'scene.rml')) && fs.existsSync(path.join(PROJECT, 'rive.yaml')));
check('compiled visible Mako .riv exists', fs.existsSync(RIV) && fs.statSync(RIV).size > 500_000, `${RIV} missing or too small`);

const verify = spawnSync(process.execPath, [path.join(ROOT, 'tools/rive/run.mjs'), PROJECT, '--verify'], {
  cwd: ROOT,
  encoding: 'utf8',
});
check('official Rive CLI verifies Mako', verify.status === 0, (verify.stderr || verify.stdout || '').trim().split('\n').slice(-2).join(' '));

const inspect = spawnSync(process.execPath, [path.join(ROOT, 'tools/rive/run.mjs'), 'inspect', PROJECT, '--json'], {
  cwd: ROOT,
  encoding: 'utf8',
});
let report = null;
try {
  const jsonStart = (inspect.stdout || '').indexOf('{');
  report = JSON.parse((inspect.stdout || '').slice(jsonStart));
} catch (error) {
  check('Rive inspector returns JSON', false, error.message);
}

if (report) {
  const artboard = (report.artboards || []).find((a) => a.name === 'Mako');
  check('Mako artboard is visible-sized', !!artboard && artboard.width === 1024 && artboard.height === 1024);
  const all = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    all.push(node);
    for (const child of node.children || []) walk(child);
  };
  walk(artboard);
  const count = (type) => all.filter((node) => node.type === type).length;
  const names = new Set(all.map((node) => node.name).filter(Boolean));
  check('8 visible image layers', count('Image') === 8, `found ${count('Image')}`);
  check('8 deformable image meshes', count('Mesh') === 8, `found ${count('Mesh')}`);
  check('8 root bones', count('RootBone') === 8, `found ${count('RootBone')}`);
  check('six gameplay animations', ['idle', 'walk', 'attack', 'devour', 'hit', 'death'].every((name) => names.has(name)));
  const animation = (name) => all.find((node) => node.type === 'LinearAnimation' && node.name === name);
  check('VFX pulse animation is authored', !!animation('vfxPulse'));
  const targetIds = (node) => new Set((node?.children || []).filter((child) => child.type === 'KeyedObject').map((child) => child.objectId));
  const walkTargets = targetIds(animation('walk'));
  const attackTargets = targetIds(animation('attack'));
  const deathTargets = targetIds(animation('death'));
  check('walk keys bones for visible deformation', [40, 41, 42, 44, 45, 46].every((id) => walkTargets.has(`0:${id}`)), [...walkTargets].join(','));
  check('one-shot keys arm/body bones', attackTargets.has('0:45') && attackTargets.has('0:42'), [...attackTargets].join(','));
  check('death has bone motion plus visible fade', deathTargets.has('0:42') && deathTargets.has('0:207'), [...deathTargets].join(','));
  check('state machine inputs are wired', ['moving', 'attack', 'devour', 'hit', 'death', 'damage', 'heal', 'hitStop', 'vfx'].every((name) => names.has(name)));
  check('state machine is linked to artboard', all.some((node) => node.type === 'StateMachine' && node.name === 'MakoStateMachine'));
  check('no inspector problems', (report.problems || []).length === 0, JSON.stringify(report.problems || []));
}

console.log(JSON.stringify(results, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const error of errors) console.log('- ' + error);
process.exit(errors.length ? 1 : 0);
