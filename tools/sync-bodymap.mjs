/**
 * sync-bodymap.mjs — SATU SUMBER: data/body-map.json (denah SNAP MACRO)
 * diregenerasi dari data/lumen-labyrinth.json sehingga peta macro = ruang
 * main micro yang sama (spec owner: zoom macro->micro seamless).
 *   node tools/sync-bodymap.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const lab = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lumen-labyrinth.json'), 'utf8'));
const xs = lab.nodes.map((n) => n.x), ys = lab.nodes.map((n) => n.y);
const minX = Math.min(...xs) - 160, maxX = Math.max(...xs) + 160;
const minY = Math.min(...ys) - 160, maxY = Math.max(...ys) + 160;
const W = maxX - minX, H = maxY - minY;
const nx = (x) => Number((((x - minX) / W)).toFixed(4));
const ny = (y) => Number((1 - ((y - minY) / H)).toFixed(4)); // drawWorldMap flip-Y: orientasi akhir = foto ref (START bawah)
const organs = lab.nodes.filter((n) => !n.junction).map((n) => ({
  id: n.id,
  label: (n.label || n.organ).toUpperCase(),
  x: nx(n.x), y: ny(n.y),
  rx: Number((n.r / W).toFixed(3)), ry: Number((n.r / H).toFixed(3)),
  coil: n.big ? 0 : (n.organ === 'usus_halus' || n.organ === 'usus_besar' ? 3 : 1),
  hue: n.organ,
  palette: { fill: n.pal.fill, rim: n.pal.glowHot, deep: n.pal.deep },
  zoom: n.big ? 0.8 : 0.66,
  big: !!n.big,
}));
const nodeById = new Map(lab.nodes.map((n) => [n.id, n]));
const vessels = lab.edges.map((e, i) => {
  const A = nodeById.get(e.a), B = nodeById.get(e.b);
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  const dx = B.x - A.x, dy = B.y - A.y; const L = Math.hypot(dx, dy) || 1;
  const b = e.bend || 0;
  const pts = [[A.x, A.y], [mx - (dy / L) * b * 0.5, my + (dx / L) * b * 0.5], [mx - (dy / L) * b, my + (dx / L) * b], [B.x, B.y]];
  return { id: `lumen_${e.a}_${e.b}`, kind: e.cross ? 'vein' : 'artery', r: 34, points: pts.map(([x, y]) => [nx(x), ny(y)]) };
});
const start = nodeById.get(lab.route[0]);
const goal = nodeById.get(lab.route[lab.route.length - 1]);
const out = {
  doc: 'Denah SNAP MACRO = proyeksi labirin lumen (SATU SUMBER: data/lumen-labyrinth.json). Diregenerasi oleh tools/sync-bodymap.mjs — jangan edit manual.',
  world: { w: Math.round(W), h: Math.round(H) },
  anchors: { start: { x: nx(start.x), y: ny(start.y), label: 'START' }, goal: { x: nx(goal.x), y: ny(goal.y), label: 'GOAL' } },
  organs,
  vessels,
};
fs.writeFileSync(path.join(ROOT, 'data/body-map.json'), JSON.stringify(out, null, 2) + '\n');
console.log('SYNC_BODYMAP_OK', organs.length, 'organs', vessels.length, 'vessels', W + 'x' + H);
