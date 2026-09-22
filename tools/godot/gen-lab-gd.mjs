/**
 * gen-lab-gd.mjs — SATU SUMBER: graph labirin JS -> konstanta GDScript
 * (godot/arena/lab_data.gd) agar slice Godot parity dengan game JS.
 *   node tools/godot/gen-lab-gd.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.dirname(path.dirname(path.dirname(new URL(import.meta.url).pathname)));
const lab = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lumen-labyrinth.json'), 'utf8'));
const byId = new Map(lab.nodes.map((n) => [n.id, n]));
const edges = lab.edges.map((e) => {
  const A = byId.get(e.a), B = byId.get(e.b);
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  const dx = B.x - A.x, dy = B.y - A.y; const L = Math.hypot(dx, dy) || 1;
  const b = e.bend || 0;
  const pts = [[A.x, A.y], [mx - (dy / L) * b * 0.5, my + (dx / L) * b * 0.5], [mx - (dy / L) * b, my + (dx / L) * b], [B.x, B.y]];
  return { a: e.a, b: e.b, w: (lab.corridorWidth || 68) / 2, pts };
});
const gd = `# lab_data.gd — GENERATED oleh tools/godot/gen-lab-gd.mjs dari
# data/lumen-labyrinth.json. JANGAN edit manual.
extends RefCounted

const NODES := [
${lab.nodes.map((n) => `  { "id": "${n.id}", "x": ${n.x}.0, "y": ${n.y}.0, "r": ${n.r}.0, "junction": ${n.junction ? 'true' : 'false'}, "enemies": ${n.enemies ?? 5}, "hazard": "${n.hazard ? n.hazard.type : ''}" },`).join('\n')}
]

const EDGES := [
${edges.map((e) => `  { "a": "${e.a}", "b": "${e.b}", "w": ${e.w}.0, "pts": [${e.pts.map((p) => `Vector2(${p[0]}, ${p[1]})`).join(', ')}] },`).join('\n')}
]

const ROUTE := [${lab.route.map((r) => `"${r}"`).join(', ')}]
`;
fs.writeFileSync(path.join(ROOT, 'godot/arena/lab_data.gd'), gd);
console.log('GEN_LAB_GD_OK', lab.nodes.length, 'nodes', edges.length, 'edges');
