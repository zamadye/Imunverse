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

/**
 * UI-RESET (2026-09-21): owner mencabut SELURUH aset visual untuk reset UI/UX
 * total — lihat docs/UI-UX-RESET-AUDIT.md §4 opsi B. Selama masa reset, "sprite
 * hilang" adalah kondisi YANG DIHARAPKAN, bukan regresi, jadi diturunkan jadi
 * INFO. Semua pemeriksaan lain (import antar modul, validitas JSON, regresi CSS
 * #screen-*, referensi index.html) TETAP STRICT.
 *
 * Matikan dengan `PHAGOS_STRICT_ASSETS=1 node scripts/check-imports.mjs`, atau
 * balik konstanta ini ke false begitu aset UI baru sudah masuk — pada titik itu
 * pemeriksaan sprite harus keras lagi.
 */
const UI_RESET_ASSETS_ABSENT = process.env.PHAGOS_STRICT_ASSETS !== '1';
const info = (msg) => console.log('  ·', msg);

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
const optionalSpritePaths = new Set(); // foto mutasi: boleh belum ada (fallback sprite dasar)
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
          // UI-REBUILD P8: foto bentuk mutasi per hero ikut diperiksa, tapi
          // bersifat OPSIONAL (belum semua hero punya foto) → kumpulan terpisah.
          if (['sprite', 'spriteIdle', 'spriteAttack'].includes(k) && typeof v === 'string') {
            spritePaths.add(v);
          }
          if (['spriteMut1Idle', 'spriteMut1Attack', 'spriteMut2Idle', 'spriteMut2Attack'].includes(k) && typeof v === 'string') {
            optionalSpritePaths.add(v);
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

// — Regresi layar: aturan ID #screen-* yang memaksa display tanpa .active —
// Selektor ID menang dari `.screen { display:none }` → layar itu akan SELALU
// terlihat dan menutupi layar lain (pernah: dashboard menutupi gameplay).
console.log('— CSS layar —');
{
  const cssFiles = ['styles/main.css', 'styles/dashboard-focus.css', 'styles/portrait.css', 'styles/dashboard-map.css'];
  let masalah = 0;
  for (const rel of cssFiles) {
    const p2 = path.join(ROOT, rel);
    if (!fs.existsSync(p2)) continue;
    const css = fs.readFileSync(p2, 'utf8');
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const sel = m[1].trim().split('\n').pop().trim();
      if (!/^#screen-[a-z0-9-]+$/i.test(sel)) continue;
      if (/display\s*:/.test(m[2])) {
        fail(`${rel}: ${sel} mengatur "display" tanpa .active — layar akan selalu tampil & menutupi layar lain`);
        masalah++;
      }
    }
  }
  if (!masalah) ok('aturan #screen-* aman (display hanya saat .active)');
}

console.log('— Sprite assets —');
const missingSprites = [];
// Laporkan foto mutasi yang BELUM ada sebagai INFO (bukan kegagalan).
let mutReady = 0;
for (const sp of optionalSpritePaths) {
  const p = path.join(ROOT, sp);
  if (fs.existsSync(p)) mutReady += 1;
}
if (optionalSpritePaths.size > 0) {
  const total = optionalSpritePaths.size;
  ok(mutReady === total
    ? `foto mutasi: LENGKAP ${mutReady}/${total}`
    : `foto mutasi: ${mutReady}/${total} tersedia (sisanya pakai sprite dasar)`);
}

for (const sp of spritePaths) {
  const p = path.join(ROOT, sp);
  if (!fs.existsSync(p)) {
    if (UI_RESET_ASSETS_ABSENT) missingSprites.push(sp);
    else fail(`sprite hilang: ${sp}`);
  }
}
if (UI_RESET_ASSETS_ABSENT && missingSprites.length) {
  info(`UI-RESET: ${missingSprites.length}/${spritePaths.size} sprite belum ada (aset visual dicabut owner — diharapkan, lihat docs/UI-UX-RESET-AUDIT.md). Pakai PHAGOS_STRICT_ASSETS=1 untuk memaksa keras.`);
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
