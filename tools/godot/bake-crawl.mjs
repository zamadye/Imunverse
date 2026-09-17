/**
 * bake-crawl.mjs — panggang siklus merayap hero memakai GODOT 4.7.2 headless.
 *
 *   node tools/godot/bake-crawl.mjs
 *
 * Alur:
 *   1. data/crawl.json (satu-satunya sumber angka) disalin ke
 *      tools/godot/rig/crawl-src.json
 *   2. Godot dijalankan headless menjalankan rig/bake_crawl.gd
 *   3. Keluaran `BAKE_JSON:{...}` ditangkap → ditulis ke data/crawl-cycles.json
 *
 * Kalau mesin belum terpasang: `node tools/godot/install.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIREK = path.dirname(path.dirname(new URL(import.meta.url).pathname)); // /tools
const ROOT = path.dirname(DIREK);
const RIG = path.join(DIREK, 'godot', 'rig');
const SRC = path.join(ROOT, 'data', 'crawl.json');
const HASIL = path.join(ROOT, 'data', 'crawl-cycles.json');

if (!fs.existsSync(SRC)) { console.error('data/crawl.json tidak ada'); process.exit(2); }
fs.copyFileSync(SRC, path.join(RIG, 'crawl-src.json'));

const engine = path.join(DIREK, 'godot', 'engine', 'godot.web.template_release.wasm32.nothreads.wasm');
if (!fs.existsSync(engine)) {
  console.error('mesin Godot belum terpasang — jalankan: node tools/godot/install.mjs');
  process.exit(2);
}

let out = '';
try {
  out = execFileSync(process.execPath, [
    path.join(DIREK, 'godot', 'run.mjs'), RIG,
    '--headless', '--path', RIG, '--script', 'res://bake_crawl.gd',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  process.stderr.write((e && e.stderr) || String(e));
  process.exit(1);
}

const baris = out.split('\n').find((l) => l.startsWith('BAKE_JSON:'));
if (!baris) { console.error('Godot tidak mengeluarkan BAKE_JSON:\n' + out.slice(-3000)); process.exit(1); }
const data = JSON.parse(baris.slice('BAKE_JSON:'.length));

const heroes = Object.keys(data.heroes);
fs.writeFileSync(HASIL, JSON.stringify(data, null, 2) + '\n');
console.log(`TERPANGGANG ✔ ${heroes.length} hero × ${data.frames} frame → data/crawl-cycles.json`);
for (const h of heroes) {
  const hf = data.heroes[h];
  const f0 = hf.frames[0];
  console.log(`  ${h.padEnd(12)} lobus=${hf.lobes} rate=${hf.rate} style=${hf.style} `
    + `| frame0 sx=${f0.sx} sy=${f0.sy} skew=${f0.skew} y=${f0.y} contact=${f0.contact}`);
}
