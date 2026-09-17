/**
 * run.mjs — jalankan Godot headless di Node.
 *
 *   node tools/godot/run.mjs <folder-project> [--headless] --path <jalur-di-memfs> --script res://nama.gd
 *   node tools/godot/run.mjs --version-only
 *
 * Berkas project disalin ke MEMFS (sistem berkas virtual Emscripten) dengan
 * `copyToFS`, jadi jalur yang dipakai Godot TETAP jalur host-nya.
 * Keluaran GDScript ditangkap lewat print() → stdout Node.
 */
import fs from 'node:fs';
import path from 'node:path';
import './shim.mjs';
import Godot from './engine/godot.mjs';

const ENGINE = path.join(path.dirname(new URL(import.meta.url).pathname), 'engine');
const WASM = path.join(ENGINE, 'godot.web.template_release.wasm32.nothreads.wasm');
if (!fs.existsSync(WASM)) {
  console.error('mesin belum terpasang — jalankan: node tools/godot/install.mjs');
  process.exit(2);
}

const hanyaVersi = process.argv.includes('--version-only');
const projDir = hanyaVersi ? null : process.argv[2];
const args = (hanyaVersi ? ['--headless', '--version'] : process.argv.slice(3)).filter((a) => a !== undefined);

const wasmBinary = fs.readFileSync(WASM);
const M = await Godot({
  wasmBinary,
  print: (s) => process.stdout.write(s + '\n'),
  printErr: (s) => process.stderr.write('[godot:err] ' + s + '\n'),
  onAbort: (w) => process.stderr.write('[godot:abort] ' + w + '\n'),
});

if (projDir && fs.existsSync(projDir)) {
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else M.copyToFS(p, fs.readFileSync(p));
    }
  };
  walk(projDir);
}

let code = 0;
try {
  code = M.callMain(args) || 0;
} catch (e) {
  process.stderr.write('[godot:throw] ' + ((e && e.message) || e) + '\n');
  code = 1;
}
process.exit(code);
