#!/usr/bin/env node
/**
 * audit-arena-prod.mjs — AUDIT KELAYAKAN PRODUCTION ARENA V2 (model + data).
 * Jujur: yang bisa dibuktikan di sandbox (Node, tanpa GPU/device):
 *  1. konektivitas lumen START→GOAL + semua room terjangkau (BFS via SDF)
 *  2. jalur waypoint BFS punya clearance hero (r=15) di tiap segmen
 *  3. segel lockdown menutup koridor (seals > 0 saat lockdown)
 *  4. cakupan hazard per room + granularitasnya
 *  5. jarak warna antar frame zona (proksi "beda dalam 3 detik")
 * Yang TIDAK bisa dibuktikan di sini: 60fps device, audio terdengar, GL.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Arena } from '../js/arena/arena.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lab = JSON.parse(readFileSync(path.join(ROOT, 'data/lumen-labyrinth.json'), 'utf8'));
const arena = new Arena(lab, null, null, null);
const HERO_R = 15;
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

// ---- 1+2. BFS konektivitas via SDF (kondisi pintu TERBUKA = sealed false) ----
const rooms = [...arena.rooms.values()];
const x0 = Math.min(...rooms.map((r) => r.x - r.r)) - 60;
const x1 = Math.max(...rooms.map((r) => r.x + r.r)) + 60;
const y0 = Math.min(...rooms.map((r) => r.y - r.r)) - 60;
const y1 = Math.max(...rooms.map((r) => r.y + r.r)) + 60;
const STEP = 16; // < diameter hero (30) agar tak ada celah palsu
const NX = Math.ceil((x1 - x0) / STEP), NY = Math.ceil((y1 - y0) / STEP);
const open = (ix, iy) => {
  if (ix < 0 || iy < 0 || ix >= NX || iy >= NY) return false;
  return arena.sdf(x0 + ix * STEP, y0 + iy * STEP, false) < -HERO_R;
};
const route = arena.route || [];
const startRoom = arena.rooms.get(route[0]);
const goalRoom = arena.rooms.get(route[route.length - 1]);
const toIx = (x) => Math.round((x - x0) / STEP), toIy = (y) => Math.round((y - y0) / STEP);
const key = (ix, iy) => iy * NX + ix;
const prev = new Map();
const q = [[toIx(startRoom.x), toIy(startRoom.y)]];
prev.set(key(q[0][0], q[0][1]), -1);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
while (q.length) {
  const [cx, cy] = q.pop();
  for (const [dx, dy] of DIRS) {
    const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
    if (!prev.has(k) && open(nx, ny)) { prev.set(k, key(cx, cy)); q.push([nx, ny]); }
  }
}
const reached = (r) => prev.has(key(toIx(r.x), toIy(r.y)));
const unreached = rooms.filter((r) => !reached(r)).map((r) => r.id);
ok(reached(startRoom) && reached(goalRoom), `START(${route[0]})→GOAL(${route[route.length - 1]}) terhubung (grid ${NX}×${NY})`);
ok(unreached.length === 0, `semua ${rooms.length} room terjangkau hero jalan-kaki${unreached.length ? ' — GAGAL: ' + unreached.join(',') : ''}`);
// clearance tiap room: muat hero di tengah?
const tight = rooms.filter((r) => arena.sdf(r.x, r.y, false) > -HERO_R).map((r) => `${r.id}(${arena.sdf(r.x, r.y, false).toFixed(0)})`);
ok(tight.length === 0, `semua room muat hero r=${HERO_R} di tengah${tight.length ? ' — SEMPIT: ' + tight.join(',') : ''}`);
// waypoint BFS START→GOAL: tiap segmen clearance penuh?
let wp = [], k = key(toIx(goalRoom.x), toIy(goalRoom.y));
if (prev.has(k)) { while (k !== -1) { wp.push(k); k = prev.get(k); } wp.reverse(); }
let minClear = Infinity;
for (let i = 0; i < wp.length; i += 4) {
  const ix = wp[i] % NX, iy = Math.floor(wp[i] / NX);
  minClear = Math.min(minClear, -arena.sdf(x0 + ix * STEP, y0 + iy * STEP, false));
}
ok(wp.length > 0 && minClear > HERO_R, `jalur START→GOAL: ${wp.length} waypoint, clearance min ${minClear === Infinity ? '?' : minClear.toFixed(0)}px`);

// ---- 3. segel lockdown ----
const sealsN = arena.seals.length; // state awal = lockdown
ok(sealsN > 0, `segel lockdown menutup koridor (seals=${sealsN})`);

// ---- 4. hazard ----
const hzRooms = rooms.filter((r) => r.hazard);
console.log(`INFO  room ber-hazard: ${hzRooms.length}/${rooms.length} (${hzRooms.map((r) => `${r.id}:${r.hazard.type}`).join(', ') || '-'})`);
const hzTypes = new Set(hzRooms.map((r) => r.hazard.type));
ok(hzTypes.has('acid') && hzTypes.has('mucus'), `ragam hazard: ${[...hzTypes].join(',') || 'KOSONG'}`);
for (const r of rooms) {
  const got = arena.hazardAt(r.x, r.y);
  if (!!got !== !!r.hazard) { ok(false, `hazardAt(${r.id}) tak konsisten data`); break; }
}
console.log('INFO  hazardAt = granularitas SE-ROOM (bukan kolam); visual pool hanya ilustrasi tengah room');

// ---- 5. jarak warna antar frame zona ----
try {
  const { loadImage, createCanvas } = await import('@napi-rs/canvas');
  const files = ['snap-08-zone-heart.png', 'snap-08-zone-lung.png', 'snap-08-zone-capillary.png', 'snap-08-zone-usus.png'];
  const means = [];
  for (const f of files) {
    const img = await loadImage(readFileSync(path.join(ROOT, 'shots/v2', f)));
    const cv = createCanvas(64, 64), g = cv.getContext('2d');
    g.drawImage(img, 0, 0, 64, 64);
    const d = g.getImageData(0, 0, 64, 64).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    means.push({ f, r: r / n, g: gg / n, b: b / n });
  }
  let minD = Infinity, pair = '';
  for (let i = 0; i < means.length; i++) for (let j = i + 1; j < means.length; j++) {
    const a = means[i], c = means[j];
    const dist = Math.hypot(a.r - c.r, a.g - c.g, a.b - c.b);
    if (dist < minD) { minD = dist; pair = `${a.f.replace('snap-08-zone-', '').replace('.png', '')}↔${c.f.replace('snap-08-zone-', '').replace('.png', '')}`; }
  }
  ok(minD > 24, `jarak warna RGB antar zona: min ${minD.toFixed(0)} (${pair}) — ambang beda sekilas = 24`);
} catch (e) { console.log(`SKIP  jarak warna: ${e.message}`); }

console.log(fails === 0 ? 'AUDIT-MODEL=LULUS' : `AUDIT-MODEL=${fails}-GAGAL`);
process.exit(fails === 0 ? 0 : 1);
