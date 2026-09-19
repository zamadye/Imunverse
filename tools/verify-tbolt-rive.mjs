/**
 * Verify the visible TBolt Rive package used by gameplay.
 * Mirrors tools/verify-rive.mjs (Mako): the official Rive CLI performs the
 * import/build validation; the inspector result confirms the visible images,
 * meshes, bones, animations, and state-machine controls are all present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PROJECT = path.join(ROOT, 'assets', 'character-anim-src', 'tbolt');
const RIV = path.join(PROJECT, 'tbolt-rive-draft.riv');
const errors = [];
const results = {};
const check = (name, ok, detail = '') => {
  results[name] = ok ? 'OK' : `GAGAL — ${detail}`;
  if (!ok) errors.push(`${name}: ${detail}`);
};

check('TBolt Rive source exists', fs.existsSync(path.join(PROJECT, 'scene.rml')) && fs.existsSync(path.join(PROJECT, 'rive.yaml')));
check('compiled visible TBolt .riv exists', fs.existsSync(RIV) && fs.statSync(RIV).size > 500_000, `${RIV} missing or too small`);

const verify = spawnSync(process.execPath, [path.join(ROOT, 'tools/rive/run.mjs'), PROJECT, '--verify'], {
  cwd: ROOT,
  encoding: 'utf8',
});
check('official Rive CLI verifies TBolt', verify.status === 0, (verify.stderr || verify.stdout || '').trim().split('\n').slice(-2).join(' '));

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
  const artboard = (report.artboards || []).find((a) => a.name === 'TBolt');
  check('TBolt artboard is visible-sized', !!artboard && artboard.width === 1024 && artboard.height === 1024);
  const all = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    all.push(node);
    for (const child of node.children || []) walk(child);
  };
  walk(artboard);
  const count = (type) => all.filter((node) => node.type === type).length;
  const names = new Set(all.map((node) => node.name).filter(Boolean));
  const parents = new Map();
  const mapParents = (node, parent) => {
    if (!node || typeof node !== 'object') return;
    parents.set(node, parent || null);
    for (const child of node.children || []) mapParents(child, node);
  };
  mapParents(artboard, null);
  const byName = (name) => all.find((node) => node.name === name);
  const parentName = (name) => { const p = parents.get(byName(name)); return p ? p.name : null; };
  check('21 visible image layers', count('Image') === 21, `found ${count('Image')}`);
  check('21 deformable image meshes', count('Mesh') === 21, `found ${count('Mesh')}`);
  check('23 hierarchical bones (17 roots + 6 chain)', count('RootBone') === 17 && count('Bone') === 6, `roots=${count('RootBone')} chain=${count('Bone')}`);
  check('elbows nest under shoulders', parentName('elbow_rBone') === 'shoulder_rBone' && parentName('elbow_lBone') === 'shoulder_lBone');
  check('knees nest under hips', parentName('knee_rBone') === 'hip_rBone' && parentName('knee_lBone') === 'hip_lBone');
  check('blades ride under elbows', parentName('blade_rBone') === 'elbow_rBone' && parentName('blade_lBone') === 'elbow_lBone');
  check('tail chain nests tip-to-tip', parentName('tail_2Bone') === 'tail_1Bone' && parentName('tail_3Bone') === 'tail_2Bone');
  check('visor/scanner ride under neck', parentName('visorBone') === 'neckBone' && parentName('scannerBone') === 'neckBone');
  const imageOrder = all.filter((node) => node.type === 'Image').map((node) => node.name);
  check('draw order is front-to-back (seal first)', imageOrder[0] === 'seal' && imageOrder[imageOrder.length - 1] === 'arm_upper_l', imageOrder.join(','));
  check('seven gameplay animations', ['idle', 'walk', 'attack', 'skill_lockon', 'skill_execute', 'hit', 'death'].every((name) => names.has(name)));
  const animation = (name) => all.find((node) => node.type === 'LinearAnimation' && node.name === name);
  check('VFX pulse animation is authored', !!animation('vfxPulse'));
  check('five Equip stage animations', ['equip0', 'equip1', 'equip2', 'equip3', 'equipDeath'].every((name) => !!animation(name)));
  const targetIds = (node) => new Set((node?.children || []).filter((child) => child.type === 'KeyedObject').map((child) => child.objectId));
  const walkTargets = targetIds(animation('walk'));
  const attackTargets = targetIds(animation('attack'));
  const lockonTargets = targetIds(animation('skill_lockon'));
  const executeTargets = targetIds(animation('skill_execute'));
  const deathTargets = targetIds(animation('death'));
  check('walk keys legs/arms/torso/tail bones', [40, 41, 44, 45, 47, 48, 50, 51, 52, 53, 54, 55, 56, 57].every((id) => walkTargets.has(`0:${id}`)), [...walkTargets].join(','));
  check('attack keys elbow + wrist-lock + bolt FX', ['0:45', '0:46', '0:49', '0:60', '0:218'].every((id) => attackTargets.has(id)), [...attackTargets].join(','));
  check('lockon keys scanner bone + reticle', ['0:43', '0:61', '0:219'].every((id) => lockonTargets.has(id)), [...lockonTargets].join(','));
  check('execute keys blade stab + slash', ['0:46', '0:62', '0:220'].every((id) => executeTargets.has(id)), [...executeTargets].join(','));
  check('death has bone motion plus visible fade', ['0:40', '0:41', '0:200', '0:201'].every((id) => deathTargets.has(id)), [...deathTargets].join(','));
  check('equip1 gates visor+scanner', ['0:212', '0:213'].every((id) => targetIds(animation('equip1')).has(id)));
  check('equip2 gates blades+core', ['0:214', '0:215', '0:216'].every((id) => targetIds(animation('equip2')).has(id)));
  check('equip3 gates seal', targetIds(animation('equip3')).has('0:217'));
  check('two state-machine layers (Main + Equip)', count('StateMachineLayer') === 2, `found ${count('StateMachineLayer')}`);
  check('stage number conditions gate Equip', count('TransitionNumberCondition') === 6, `found ${count('TransitionNumberCondition')}`);
  check('13 animation states', count('AnimationState') === 13, `found ${count('AnimationState')}`);
  check('state machine inputs are wired', ['moving', 'attack', 'skill_lockon', 'execute', 'hit', 'death', 'damage', 'hitStop', 'vfx', 'stage'].every((name) => names.has(name)));
  check('state machine is linked to artboard', all.some((node) => node.type === 'StateMachine' && node.name === 'TBoltStateMachine'));
  check('no inspector problems', (report.problems || []).length === 0, JSON.stringify(report.problems || []));
}

console.log(JSON.stringify(results, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const error of errors) console.log('- ' + error);
process.exit(errors.length ? 1 : 0);
