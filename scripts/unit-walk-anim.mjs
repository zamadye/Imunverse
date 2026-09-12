/**
 * unit-walk-anim.mjs — Unit test logika walk-anim.js (tanpa browser).
 * Memverifikasi kontrak 8-arah: snap 45°, mirror W/NW/SW, frame, tempo per arah.
 * Jalankan: node scripts/unit-walk-anim.mjs  (exit 1 bila ada FAIL)
 */
import { snapDirIndex, resolveDirection, walkFrame, dirCycleSpeed, DIR8 } from '../js/render/walk-anim.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const log = (k, v, extra) => {
  if (v === false) fails += 1;
  console.log(`${v ? 'PASS' : 'FAIL'} ${k}${extra ? ' ' + extra : ''}`);
};
const deg = (d) => (d * Math.PI) / 180;
const wa = JSON.parse(readFileSync(path.join(ROOT, 'data/walk-anim.json'), 'utf8'));
const dirs = wa.sheetDirections;
log('data-sheetDirections-5', dirs.length === 5, dirs.join(','));

// ---- snap 45°: pusat tiap oktan + sudut negatif ----
const expect = [
  [0, 'E'], [45, 'SE'], [90, 'S'], [135, 'SW'],
  [180, 'W'], [-135, 'NW'], [-90, 'N'], [315, 'NE'], [-180, 'W'],
];
let snapOk = true; let snapDetail = [];
for (const [d, name] of expect) {
  const got = DIR8[snapDirIndex(deg(d))];
  if (got !== name) { snapOk = false; snapDetail.push(`${d}→${got}(${name})`); }
}
log('snap-pusat-oktan', snapOk, snapDetail.join(' '));
// batas: tepat di tengah dua arah → round naik (deterministik)
log('snap-batas-22.5→SE', DIR8[snapDirIndex(deg(22.5))] === 'SE');
log('snap-batas-67.5→S', DIR8[snapDirIndex(deg(67.5))] === 'S');
log('snap-putaran-penuh', DIR8[snapDirIndex(deg(360))] === 'E');

// ---- mirror: W=E, NW=NE, SW=SE (kolom benar, mirror=true); yang lain false ----
const m = (n) => resolveDirection(DIR8.indexOf(n), dirs);
log('mirror-W→E', m('W').mirror === true && m('W').col === dirs.indexOf('E'), JSON.stringify(m('W')));
log('mirror-NW→NE', m('NW').mirror === true && m('NW').col === dirs.indexOf('NE'), JSON.stringify(m('NW')));
log('mirror-SW→SE', m('SW').mirror === true && m('SW').col === dirs.indexOf('SE'), JSON.stringify(m('SW')));
log('no-mirror-E/NE/N/SE/S', ['E', 'NE', 'N', 'SE', 'S'].every((n) => m(n).mirror === false));

// ---- frame: fase [0..1) → 0..frames-1, deterministik, fase negatif aman ----
const F = wa.frames;
log('frame-count', F === 4, `F=${F}`);
log('frame-batas', walkFrame(0, F) === 0 && walkFrame(0.25, F) === 1 && walkFrame(0.5, F) === 2 && walkFrame(0.75, F) === 3,
  [0, .25, .5, .75].map((p) => walkFrame(p, F)).join(','));
log('frame-wrap', walkFrame(1, F) === 0 && walkFrame(1.5, F) === 2, `walkFrame(1)=${walkFrame(1,F)} walkFrame(1.5)=${walkFrame(1.5,F)}`);
log('frame-negatif', walkFrame(-0.5, F) === 2, `walkFrame(-0.5)=${walkFrame(-0.5, F)}`);
log('frame-jepit', walkFrame(0.9999, F) === 3);

// ---- tempo per arah: mirror mengwarisi sumber; N/S lebih cepat dari E ----
const ds = wa.dirSpeed;
log('dirSpeed-sumber', dirCycleSpeed(DIR8.indexOf('W'), ds) === ds.E);
log('dirSpeed-NW', dirCycleSpeed(DIR8.indexOf('NW'), ds) === ds.NE);
log('dirSpeed-SW', dirCycleSpeed(DIR8.indexOf('SW'), ds) === ds.SE);
log('dirSpeed-side-lambat', ds.E < ds.N && ds.E < ds.S, `E=${ds.E} N=${ds.N} S=${ds.S}`);
log('dirSpeed-semua-ada', dirs.every((d) => Number.isFinite(ds[d]) && ds[d] > 0), JSON.stringify(ds));

// ---- kontrak art↔runtime: urutan kolom GENERATOR harus = sheetDirections data ----
// (bila beda, arah yang digambar tidak cocok dengan yang diminta — bug diam-diam)
const genSrc = readFileSync(path.join(ROOT, 'tools/gen_walk_sprites.py'), 'utf8');
const mCols = genSrc.match(/COLS\s*=\s*\[([^\]]+)\]/);
const genCols = mCols ? [...mCols[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : null;
log('kontrak-kolom-generator', genCols && JSON.stringify(genCols) === JSON.stringify(dirs),
  `gen=[${genCols}] data=[${dirs}]`);

// ---- integrasi data: sheet ada di disk, jumlah cocok ----
const fs = await import('node:fs');
const sheets = [...Object.values(wa.heroes), ...Object.values(wa.enemies)];
log('sheet-11+13', Object.keys(wa.heroes).length === 11 && Object.keys(wa.enemies).length === 13);
const missing = sheets.filter((s) => !fs.existsSync(path.join(ROOT, s.sheet)));
log('sheet-di-disk', missing.length === 0, missing.join(' '));
log('fps-terisi', sheets.every((s) => Number.isFinite(s.fps) && s.fps > 0));

console.log(fails === 0 ? '\nSEMUA UNIT WALK-ANIM LULUS ✔' : `\nGAGAL: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
