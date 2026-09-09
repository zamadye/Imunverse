/** test-map-culling.mjs — MAP AGENT regresi issue #12 (node, tanpa browser).
 * Membuktikan: tiap titik dunia yang terproyeksi dalam viewport+margin PASTI
 * di dalam kotak kandidat enumerasi grid (tak ada fitur visible terlewat).
 * Cakupan: 5 map × 6 pose kamera (±jauh) × 2 viewport × 6 mod (zoom/punch/shake).
 * Kontrol negatif: formula kotak LAMA (skala origin) WAJIB gagal di skenario
 * repro issue — membuktikan tes ini bertaji. Exit 1 bila ada FAIL.
 * Jalankan: node scripts/test-map-culling.mjs */
import { readFileSync } from 'node:fs';
import { Camera } from '../js/render/camera.js';
import { cameraOf, worldViewBox, featBounds, setArenaPalette, drawArena3D } from '../js/render/background.js';

const arenas = JSON.parse(readFileSync('data/arenas.json', 'utf8')).arenas;
let fails = 0, checks = 0, scanned = 0;
const log = (k, ok, d = '') => { checks++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${k}${d ? ' ' + d : ''}`); };
const onScreen = (sx, sy, w, h, m) => sx > -m && sx < w + m && sy > -m && sy < h + m;

const POSES = [[0, 0], [0, -1000], [0, 1500], [-2500, 800], [3000, -3000], [1200, 600]];
const VIEWPORTS = [[844, 390], [1920, 1080]];
const MODS = [
  { n: 'std', z: 1.16, p: 1, shx: 0, shy: 0 },
  { n: 'zoomOut', z: 0.7, p: 1, shx: 0, shy: 0 },
  { n: 'zoomIn', z: 1.5, p: 1, shx: 0, shy: 0 },
  { n: 'punch', z: 1.16, p: 1.2, shx: 0, shy: 0 },
  { n: 'shake', z: 1.16, p: 1, shx: 100, shy: -60 },
  { n: 'combo', z: 0.7, p: 1.2, shx: 100, shy: -60 },
];
const STEP = 30;

// ctx boneka: semua method no-op, semua properti bisa di-set
const spyCtx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });

for (const arena of arenas) {
  const feats = (arena.palette.ground?.features || []).filter((f) => f.type !== 'flowcell');
  if (!feats.length) { log(`cull-${arena.id}-nofeats`, true, 'skip'); continue; }
  setArenaPalette(arena.palette);
  let worst = { viol: 0, cells: 0, at: '' }; scanned = 0;
  for (const [cx, cy] of POSES) for (const [w, h] of VIEWPORTS) for (const mod of MODS) {
    const cam = new Camera();
    cam.reset(cx, cy);
    cam.zoom = mod.z; cam.punchScale = mod.p; cam.shakeX = mod.shx; cam.shakeY = mod.shy;
    const P = cam.makeProjector(w, h);
    const cc = cameraOf(P);
    const boxes = feats.map((f) => {
      const B = featBounds(f, cc.sMin);
      return { f, B, box: worldViewBox(cc, w, h, B.m, B.reach) };
    });
    // union + halo 2 sel
    const spMax = Math.max(...feats.map((f) => f.spacing || 300));
    const halo = 2 * spMax;
    const rx0 = Math.min(...boxes.map((b) => b.box.x0)) - halo;
    const rx1 = Math.max(...boxes.map((b) => b.box.x1)) + halo;
    const ry0 = Math.min(...boxes.map((b) => b.box.y0)) - halo;
    const ry1 = Math.max(...boxes.map((b) => b.box.y1)) + halo;
    let viol = 0, minS = Infinity, vEx = null;
    for (let wx = rx0; wx <= rx1; wx += STEP) for (let wy = ry0; wy <= ry1; wy += STEP) {
      scanned++;
      const q = P.project(wx, wy);
      for (const { B, box } of boxes) {
        if (!onScreen(q.x, q.y, w, h, B.m)) continue;
        if (q.s < minS) minS = q.s;
        if (wx < box.x0 || wx > box.x1 || wy < box.y0 || wy > box.y1) { viol++; if (!vEx) vEx = `(${wx.toFixed(0)},${wy.toFixed(0)})→(${(q.x).toFixed(0)},${(q.y).toFixed(0)})`; }
      }
    }
    // invarian inti: sMin ≤ skala tiap titik on-screen
    if (!(cc.sMin <= minS + 1e-9)) { viol++; vEx = vEx || `sMin ${cc.sMin} > minS ${minS}`; }
    // penjaga ledakan sel enumerasi
    let cells = 0;
    for (const { f, box } of boxes) {
      const sp = f.spacing || 300;
      cells += ((box.x1 - box.x0) / sp + 3) * ((box.y1 - box.y0) / sp + 3);
    }
    if (cells > 30000) { viol++; vEx = vEx || `cells ${Math.round(cells)}`; }
    if (cells > worst.cells) worst.cells = Math.round(cells);
    if (viol > worst.viol) worst = { viol, cells: worst.cells, at: `cam(${cx},${cy}) ${w}x${h} ${mod.n} ${vEx || ''}` };
  }
  log(`cull-${arena.id}-complete`, worst.viol === 0, worst.viol ? `${worst.viol} @ ${worst.at}` : `titik=${scanned} maxCells~${worst.cells}`);
  // smoke drawArena3D (nol-throw) — skenario issue + spawn
  try {
    for (const [cx, cy] of [[0, -1000], [0, 0]]) {
      const cam = new Camera(); cam.reset(cx, cy);
      drawArena3D(spyCtx, cam.makeProjector(1920, 1080), 1.7);
    }
    log(`cull-${arena.id}-smoke`, true);
  } catch (e) { log(`cull-${arena.id}-smoke`, false, e.message); }
}

// ---- kontrol negatif: formula LAMA wajib gagal di skenario repro issue ----
{
  const arena = arenas.find((a) => a.id === 'limfe');
  const f = arena.palette.ground.features.find((x) => x.type === 'blotch');
  const cam = new Camera(); cam.reset(0, -1000);
  const P = cam.makeProjector(1920, 1080);
  const q0 = P.project(0, 0); // skala origin (formula lama)
  const ccx = -(q0.x - 1920 / 2) / q0.s, ccy = -(q0.y - 1080 / 2) / (q0.s * 0.58);
  const mx = (1920 / 2 + 160) / q0.s, my = (1080 / 2 + 160) / (q0.s * 0.58);
  const old = { x0: ccx - mx, x1: ccx + mx, y0: ccy - my, y1: ccy + my };
  let miss = 0;
  for (let wx = old.x0 - 600; wx <= old.x1 + 600; wx += STEP)
    for (let wy = old.y0 - 600; wy <= old.y1 + 600; wy += STEP) {
      scanned++;
      const q = P.project(wx, wy);
      if (onScreen(q.x, q.y, 1920, 1080, 160) && (wx < old.x0 || wx > old.x1 || wy < old.y0 || wy > old.y1)) miss++;
    }
  log('cull-negcontrol-oldbox-fails', miss > 0, `titik-terlewat-formula-lama=${miss}`);
}
console.log(`--- ${checks - fails}/${checks} PASS ---`);
process.exitCode = fails ? 1 : 0;
