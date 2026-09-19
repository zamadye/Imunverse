#!/usr/bin/env node
/**
 * Verify the prepared Mako separable layers before Rive authoring.
 * This intentionally validates source preparation only; it does not claim that
 * a Rive artboard or animation exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const dir = path.join(root, 'assets/character-anim-src/mako/parts');
const manifestPath = path.join(dir, 'parts-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];

if (manifest.status !== 'prepared-concept-layers') errors.push('parts manifest must remain marked prepared-concept-layers until Rive review');
if (manifest.targetRive?.notReadyForRuntime !== true) errors.push('targetRive.notReadyForRuntime must remain true before artboard review');
if (manifest.sourceSpec?.width !== 512 || manifest.sourceSpec?.height !== 512) errors.push('part source size must be 512x512');
if (manifest.sourceSpec?.colorType !== 'RGBA') errors.push('part source color type must be RGBA');

const parts = manifest.parts || [];
const ids = new Set();
const files = new Set();
for (const part of parts) {
  if (ids.has(part.id)) errors.push(`duplicate part id ${part.id}`);
  ids.add(part.id);
  if (files.has(part.file)) errors.push(`duplicate part file ${part.file}`);
  files.add(part.file);
  const filePath = path.join(dir, part.file);
  if (!fs.existsSync(filePath)) {
    errors.push(`missing part file ${part.file}`);
    continue;
  }
  const png = fs.readFileSync(filePath);
  if (png.readUInt32BE(0) !== 0x89504e47 || png.readUInt32BE(4) !== 0x0d0a1a0a) {
    errors.push(`${part.file} is not a PNG`);
    continue;
  }
  if (png[25] !== 6) errors.push(`${part.file} must use PNG color type 6 (RGBA)`);
  const identify = spawnSync('identify', ['-format', '%wx%h %[opaque]', filePath], { encoding: 'utf8' });
  if (identify.status !== 0) {
    errors.push(`${part.file} could not be inspected with ImageMagick`);
  } else {
    const [size, opaque] = identify.stdout.trim().split(/\s+/);
    if (size !== '512x512') errors.push(`${part.file} must be 512x512 (got ${size})`);
    if (opaque === 'true') errors.push(`${part.file} has no transparent pixels`);
  }
  const placement = part.artboardPlacement;
  if (!placement || !Array.isArray(placement.pivot) || placement.pivot.length !== 2) errors.push(`${part.id} needs an artboard placement pivot`);
  if (!part.mesh?.enabled) errors.push(`${part.id} must be marked for mesh deformation`);
}

const order = manifest.layerOrderBackToFront || [];
if (order.length !== parts.length || new Set(order).size !== order.length || order.some((id) => !ids.has(id))) {
  errors.push('layerOrderBackToFront must contain every part exactly once');
}

if (errors.length) {
  console.error(errors.map((error) => `FAIL ${error}`).join('\n'));
  process.exit(1);
}
console.log(`PASS Mako part preparation (${parts.length} RGBA layers, ${manifest.bones?.length || 0} planned bones)`);
console.log('INFO Rive artboard, meshes, state machine, and gameplay rendering are still pending review');
