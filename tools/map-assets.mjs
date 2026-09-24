#!/usr/bin/env node
/**
 * map-assets.mjs — PETA semua referensi aset repo.
 *
 * Sumber yang dipindai:
 *   1. Impor JS statis + dinamis (js/**, non-vendor) + fetch('literal')
 *   2. SEMUA string ber-ekstensi aset di data/*.json (field sprite/audio/
 *      floor/wallTex/cordProps/dll — tanpa asumsi nama field)
 *   3. index.html (script/link/img/audio/video/source/srcset)
 *   4. url(...) di semua CSS
 *   5. EXTRA_PRELOAD sprite-loader (via impor modul)
 *
 * Output: docs/ASSET-MAP.md + ringkasan console.
 *   node tools/map-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const ASSET_EXT = /\.(png|jpe?g|webp|gif|svg|mp3|wav|ogg|m4a|mp4|json|riv|rivos|wasm|woff2?|ttf|otf|css|js|html|webmanifest)(\?|#|$)/i;
const refs = new Map(); // key: relPath -> {ref, kinds:Set, srcs:Set}

function normRef(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let r = raw.trim().replace(/\\/g, '/');
  if (!r || /^(https?:)?\/\/|^data:|^#|^mailto:|^tel:/i.test(r)) return null;
  r = r.split('?')[0].split('#')[0].trim();
  if (!r || !ASSET_EXT.test(r)) return null;
  if (/\s/.test(r)) return null; // kalimat narasi JSON, bukan path
  return r;
}
function add(src, raw, kind) {
  const r = normRef(raw);
  if (!r) return;
  let rel;
  // JSON/HTML/preload memakai path root-relative (assets/...) — JANGAN
  // ditempel ke direktori sumber (bug: data/assets/* palsu).
  const rooted = !r.startsWith('.') && kind !== 'css-url';
  if (r.startsWith('/')) rel = r.replace(/^\/+/, '');
  else if (rooted) rel = r;
  else rel = path.normalize(path.join(path.dirname(src), r)).replace(/\\/g, '/');
  if (rel.startsWith('..')) return; // keluar repo — abaikan
  let e = refs.get(rel);
  if (!e) { e = { ref: rel, kinds: new Set(), srcs: new Set() }; refs.set(rel, e); }
  e.kinds.add(kind);
  if (e.srcs.size < 6) e.srcs.add(src);
}

function walk(dir, exts, cb) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'vendor') continue;
    const f = path.join(dir, name);
    const st = fs.statSync(f);
    if (st.isDirectory()) { walk(f, exts, cb); continue; }
    if (exts.some((e) => name.endsWith(e))) cb(f);
  }
}

// 1) JS
walk(path.join(ROOT, 'js'), ['.js'], (f) => {
  const src = path.relative(ROOT, f);
  const s = fs.readFileSync(f, 'utf8');
  for (const re of [
    /import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]/g,
    /fetch\(\s*[`'"]([^`'"]+)[`'"]/g,
  ]) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(s))) add(src, m[1], 'js-import');
  }
});
// 2) JSON: semua string aset
walk(path.join(ROOT, 'data'), ['.json'], (f) => {
  const src = path.relative(ROOT, f);
  let json;
  try { json = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return; }
  const visit = (v) => {
    if (typeof v === 'string') add(src, v, 'json-field');
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(json);
});
// 3) index.html (+ html lain)
walk(ROOT, ['.html'], (f) => {
  if (f.includes('node_modules')) return;
  const src = path.relative(ROOT, f);
  const s = fs.readFileSync(f, 'utf8');
  for (const re of [/(?:src|href|poster)\s*=\s*["']([^"']+)["']/g, /content\s*=\s*["']([^"']+\.(?:png|jpe?g))["']/g]) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(s))) add(src, m[1], 'html-ref');
  }
});
// 4) CSS url()
walk(ROOT, ['.css'], (f) => {
  if (f.includes('node_modules')) return;
  const src = path.relative(ROOT, f);
  const s = fs.readFileSync(f, 'utf8');
  const re = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
  let m;
  while ((m = re.exec(s))) add(src, m[1], 'css-url');
});
// 5) EXTRA_PRELOAD
try {
  const sl = await import(pathToFileURL(path.join(ROOT, 'js/render/sprite-loader.js')).href);
  const paths = new Set();
  if (Array.isArray(sl.EXTRA_PRELOAD)) sl.EXTRA_PRELOAD.forEach((p) => paths.add(p));
  if (typeof sl.collectSpritePaths === 'function') {
    const data = {};
    for (const jf of fs.readdirSync(path.join(ROOT, 'data'))) {
      if (!jf.endsWith('.json')) continue;
      try { data[path.basename(jf, '.json')] = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', jf), 'utf8')); } catch { /* abaikan */ }
    }
    // collectSpritePaths butuh bentuk data terisi — panggil defensif
    try {
      for (const p of sl.collectSpritePaths({
        heroes: data.heroes || { heroes: [] }, enemies: data.enemies || { enemies: [] },
        nutrients: data.nutrients || { nutrients: [] }, evolutions: data.evolutions || {},
        arenas: data.arenas || { arenas: [] },
      })) paths.add(p);
    } catch { /* abaikan */ }
  }
  for (const p of paths) add('js/render/sprite-loader.js:preload', p, 'sprite-preload');
} catch (e) { console.log('[warn] sprite-loader tak bisa diimpor:', e.message); }

// klasifikasi + cek disk
const rows = [...refs.values()].map((e) => {
  const abs = path.join(ROOT, e.ref);
  let exists = false, size = 0;
  try { const st = fs.statSync(abs); exists = st.isFile(); size = st.size; } catch { /* hilang */ }
  const ext = (e.ref.split('.').pop() || '').toLowerCase();
  const cat = /png|jpe?g|webp|gif|svg/.test(ext) ? 'gambar'
    : /mp3|wav|ogg|m4a|mp4/.test(ext) ? 'audio/video'
    : ext === 'json' ? 'data-json'
    : ext === 'js' ? 'modul-js'
    : /css|html/.test(ext) ? 'web'
    : /riv|wasm/.test(ext) ? 'rive/wasm'
    : /woff|ttf|otf/.test(ext) ? 'font' : 'lain';
  return { ...e, exists, size, cat };
});
const found = rows.filter((r) => r.exists), missing = rows.filter((r) => !r.exists);
const byCat = (arr) => {
  const m = {};
  for (const r of arr) m[r.cat] = (m[r.cat] || 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ');
};

let md = `# PETA ASET — ${new Date().toISOString().slice(0, 10)}\n\n`;
md += `Sumber: \`node tools/map-assets.mjs\` (impor JS + field JSON + HTML + CSS + sprite-preload).\n\n`;
md += `**Total referensi unik: ${rows.length} — ADA ${found.length} (${byCat(found)}) · HILANG ${missing.length} (${byCat(missing)})**\n\n`;
md += `## HILANG (404 di browser)\n\n| path | kategori | dirujuk dari |\n|---|---|---|\n`;
for (const r of missing.sort((a, b) => a.ref.localeCompare(b.ref))) {
  md += `| \`${r.ref}\` | ${r.cat} | ${[...r.srcs].slice(0, 3).join(', ')} |\n`;
}
md += `\n## ADA (10 terbesar)\n\n| path | ukuran | dirujuk dari |\n|---|---|---|\n`;
for (const r of found.sort((a, b) => b.size - a.size).slice(0, 10)) {
  md += `| \`${r.ref}\` | ${(r.size / 1024).toFixed(0)} KB | ${[...r.srcs].slice(0, 2).join(', ')} |\n`;
}
fs.writeFileSync(path.join(ROOT, 'docs/ASSET-MAP.md'), md);

console.log(`referensi unik = ${rows.length}`);
console.log(`ADA ${found.length} (${byCat(found)})`);
console.log(`HILANG ${missing.length} (${byCat(missing)})`);
console.log('→ docs/ASSET-MAP.md');
