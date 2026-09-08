/**
 * check-imports.mjs — Validasi statis proyek Imunverse:
 *  1. Semua path import relatif antar modul JS valid (file ada).
 *  2. Semua file data JSON valid & bisa di-parse.
 *  3. Semua path sprite yang direferensikan data JSON ada di disk.
 *  4. Referensi asset di index.html ada.
 * Jalankan: node scripts/check-imports.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
const fail = (msg) => { console.error('  ✗', msg); errors++; };
const ok = (msg) => console.log('  ✓', msg);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

console.log('— Import antar modul —');
const jsFiles = walk(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
const importRe = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|export\s[^'"]*?from\s*)['"](\.[^'"]+)['"]/g;
for (const file of jsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = importRe.exec(src))) {
    const target = path.resolve(path.dirname(file), m[1]);
    if (!fs.existsSync(target)) fail(`${path.relative(ROOT, file)} → ${m[1]} (tidak ada)`);
  }
}
ok(`${jsFiles.length} file JS diperiksa`);

console.log('— Data JSON —');
const dataDir = path.join(ROOT, 'data');
const spritePaths = new Set();
for (const name of fs.readdirSync(dataDir)) {
  if (!name.endsWith('.json')) continue;
  const p = path.join(dataDir, name);
  try {
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    // kumpulkan path sprite
    const scan = (obj) => {
      if (Array.isArray(obj)) { obj.forEach(scan); return; }
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          if (['sprite', 'spriteIdle', 'spriteAttack'].includes(k) && typeof v === 'string') {
            spritePaths.add(v);
          }
          scan(v);
        }
      }
    };
    scan(json);
    ok(`${name} valid`);
  } catch (e) {
    fail(`${name}: ${e.message}`);
  }
}

console.log('— Sprite assets —');
for (const sp of spritePaths) {
  const p = path.join(ROOT, sp);
  if (!fs.existsSync(p)) fail(`sprite hilang: ${sp}`);
}
ok(`${spritePaths.size} path sprite diperiksa`);

console.log('— Referensi index.html —');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const ref of ['styles/main.css', 'js/main.js']) {
  if (!fs.existsSync(path.join(ROOT, ref))) fail(`hilang: ${ref}`);
}
ok('index.html OK');

if (errors > 0) {
  console.error(`\nGAGAL: ${errors} masalah ditemukan.`);
  process.exit(1);
}
console.log('\nSemua pemeriksaan lolos ✔');
