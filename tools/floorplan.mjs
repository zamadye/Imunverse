#!/usr/bin/env node
/** floorplan.mjs — QA FONDASI: raster SDF arena jadi denah (tanpa render game).
 * Putih/warna = lantai (sdf<0), hitam = dinding. Label = id + shape tiap room.
 * Jawab: apakah bentuk tiap room BENAR ada dan beda satu sama lain? */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { Arena } from '../js/arena/arena.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lab = JSON.parse(readFileSync(path.join(ROOT, 'data/lumen-labyrinth.json'), 'utf8'));
const arena = new Arena(lab, null, null, null);
const rooms = [...arena.rooms.values()];
const x0 = Math.min(...rooms.map((r) => r.x - r.r)) - 60;
const x1 = Math.max(...rooms.map((r) => r.x + r.r)) + 60;
const y0 = Math.min(...rooms.map((r) => r.y - r.r)) - 60;
const y1 = Math.max(...rooms.map((r) => r.y + r.r)) + 60;
const STEP = 4, SC = 3; // sel 4 unit -> 3px
const NX = Math.ceil((x1 - x0) / STEP), NY = Math.ceil((y1 - y0) / STEP);
const SHAPE_COL = {
  cavity: '#8d8d8d', sac: '#e74c3c', coil: '#f39c12', nodes: '#9b59b6',
  dual: '#e91e63', pair: '#a0522d', leaf: '#27ae60', hexdrain: '#f1c40f',
  cluster: '#3498db', alveoli: '#1abc9c', haustra: '#d35400',
};
const cv = createCanvas(NX * SC, NY * SC), g = cv.getContext('2d');
g.fillStyle = '#0a0a0c'; g.fillRect(0, 0, cv.width, cv.height);
const owner = (x, y) => {
  let best = null, bd = 1e9;
  for (const r of rooms) { const dd = Math.hypot(x - r.x, y - r.y) - r.r; if (dd < bd) { bd = dd; best = r; } }
  return bd < 90 ? best : null;
};
for (let iy = 0; iy < NY; iy++) {
  for (let ix = 0; ix < NX; ix++) {
    const x = x0 + ix * STEP, y = y0 + iy * STEP;
    if (arena.sdf(x, y, false) >= 0) continue;
    const o = owner(x, y);
    g.fillStyle = o ? (SHAPE_COL[o.shape] || '#ffffff') : '#5a4a52';
    g.fillRect(ix * SC, iy * SC, SC, SC);
  }
}
// lingkaran nominal tiap room (putih tipis) + label id:shape + hazard
const W2S = (x, y) => [(x - x0) / STEP * SC, (y - y0) / STEP * SC];
g.font = '11px sans-serif'; g.textAlign = 'center';
for (const r of rooms) {
  const [cx, cy] = W2S(r.x, r.y);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1;
  g.beginPath(); g.arc(cx, cy, r.r / STEP * SC, 0, 7); g.stroke();
  if (r.hazard) { g.fillStyle = '#ff2'; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill(); }
  if (r.id === arena.route[0]) { g.strokeStyle = '#0f6'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 10, 0, 7); g.stroke(); }
  if (r.id === arena.route[arena.route.length - 1]) { g.strokeStyle = '#fc0'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 10, 0, 7); g.stroke(); }
  g.lineWidth = 3; g.strokeStyle = '#000';
  g.strokeText(`${r.id}:${r.shape || '?'}`, cx, cy - r.r / STEP * SC - 4);
  g.fillStyle = '#fff'; g.fillText(`${r.id}:${r.shape || '?'}`, cx, cy - r.r / STEP * SC - 4);
}
mkdirSync(path.join(ROOT, 'shots/v2'), { recursive: true });
const out = path.join(ROOT, 'shots/v2', 'qa-floorplan.png');
writeFileSync(out, await cv.encode('png'));
console.log('OK', out, `${cv.width}x${cv.height}`);
