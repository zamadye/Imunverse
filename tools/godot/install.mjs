/**
 * install.mjs — PASANG GODOT 4.7.2 DI SANDBOX (tanpa unduhan langsung).
 *
 * Mengapa begini: di sandbox ini unduhan langsung dari GitHub Releases
 * (objects.githubusercontent.com) dan downloads.tuxfamily.org DIBLOKIR,
 * tetapi registry npm BISA diakses. Karena itu Godot diambil sebagai
 * paket npm (`@ringozz/godot-web-wasm32`) yang berisi mesin Godot 4.7.2
 * sudah terkompilasi ke WebAssembly, lalu dibongkar (pack → unpack).
 *
 *   node tools/godot/install.mjs
 *
 * Hasil: tools/godot/engine/ (jangan di-commit — lihat .gitignore)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const PKG = '@ringozz/godot-web-wasm32';
const VER = '4.7.2-626';
const OUT = path.join(ROOT, 'tools', 'godot', 'engine');
const TMP = path.join(ROOT, '.tmp-godot');

const log = (m) => console.log('[godot:install]', m);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

// 1) pack & unpack — satu-satunya jalur yang tembus registry
log(`npm pack ${PKG}@${VER} …`);
execFileSync('npm', ['pack', `${PKG}@${VER}`, '--silent'], { cwd: TMP, stdio: ['ignore', 'pipe', 'pipe'] });
const tgz = fs.readdirSync(TMP).find((f) => f.endsWith('.tgz'));
if (!tgz) throw new Error('tarball npm tidak ditemukan');
log(`terunduh: ${tgz} (${(fs.statSync(path.join(TMP, tgz)).size / 1e6).toFixed(1)} MB)`);
execFileSync('tar', ['-xzf', path.join(TMP, tgz), '-C', TMP], { stdio: 'inherit' });

// 2) salin mesin (js glue + wasm) lalu jadikan ESM agar bisa di-import Node
const gen = path.join(TMP, 'package', 'gen');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const JS = 'godot.web.template_release.wasm32.nothreads.js';
const WASM = 'godot.web.template_release.wasm32.nothreads.wasm';
for (const f of [JS, WASM]) {
  const src = path.join(gen, f);
  if (!fs.existsSync(src)) throw new Error(`berkas mesin tidak ada: ${f}`);
  fs.copyFileSync(src, path.join(OUT, f));
}
// glue dikirim sebagai ES module (`export default Godot`) → perlu ekstensi .mjs
fs.copyFileSync(path.join(OUT, JS), path.join(OUT, 'godot.mjs'));
fs.copyFileSync(path.join(TMP, 'package', 'package.json'), path.join(OUT, 'package.json'));
try {
  fs.copyFileSync(path.join(TMP, 'package', 'README.md'), path.join(OUT, 'README-upstream.md'));
} catch { /* tidak penting */ }

fs.rmSync(TMP, { recursive: true, force: true });
log(`mesin siap: ${OUT}`);

// 3) bukti nyata: Godot harus menjawab --version
execFileSync('node', [path.join(ROOT, 'tools', 'godot', 'run.mjs'), '--version-only'], { stdio: 'inherit' });
log('SELESAI ✔');
