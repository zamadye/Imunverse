/**
 * bake-creature.mjs — panggang RIG MAKHLUK (pendekatan ②) memakai Godot headless.
 *
 *   node tools/godot/bake-creature.mjs
 *
 * data/character-rigs.json (spesimen anatomi) → tools/godot/rig/creature-src.json
 *   → Godot menjalankan rig/bake_creature.gd → data/creature-rigs.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIREK = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const ROOT = path.dirname(DIREK);
const RIG = path.join(DIREK, 'godot', 'rig');
const SRC = path.join(ROOT, 'data', 'character-rigs.json');
const HASIL = path.join(ROOT, 'data', 'creature-rigs.json');

if (!fs.existsSync(SRC)) { console.error('data/character-rigs.json tidak ada'); process.exit(2); }
fs.copyFileSync(SRC, path.join(RIG, 'creature-src.json'));
if (!fs.existsSync(path.join(DIREK, 'godot', 'engine', 'godot.web.template_release.wasm32.nothreads.wasm'))) {
  console.error('mesin Godot belum terpasang — jalankan: node tools/godot/install.mjs'); process.exit(2);
}

let out = '';
try {
  out = execFileSync(process.execPath, [
    path.join(DIREK, 'godot', 'run.mjs'), RIG,
    '--headless', '--path', RIG, '--script', 'res://bake_creature.gd',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
} catch (e) { process.stderr.write((e && e.stderr) || String(e)); process.exit(1); }

const baris = out.split('\n').find((l) => l.startsWith('BAKE_JSON:'));
if (!baris) { console.error('Godot tidak mengeluarkan BAKE_JSON:\n' + out.slice(-3000)); process.exit(1); }
const data = JSON.parse(baris.slice('BAKE_JSON:'.length));
fs.writeFileSync(HASIL, JSON.stringify(data, null, 2) + '\n');
for (const cid of Object.keys(data.creatures)) {
  const c = data.creatures[cid];
  console.log(`TERPANGGANG ✔ ${cid} — ${Object.keys(c.states).length} keadaan × ${data.frames} frame → data/creature-rigs.json`);
  for (const [nama, st] of Object.entries(c.states)) {
    const f = st.frames[Math.floor(st.frames.length / 3)];
    const menapak = f.limbs.filter((l) => l.plant).length;
    console.log(`   ${nama.padEnd(7)} loop=${st.loop ? 'ya' : 'tidak'} dur=${st.dur}s | core sx=${f.core.sx} sy=${f.core.sy} rot=${f.core.rot} front=${f.front} wob=${f.wob} menapak=${menapak}/${f.limbs.length}`);
  }
}
