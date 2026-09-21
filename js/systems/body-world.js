/**
 * body-world.js — GEOMETRI DUNIA KONTINU (migrasi gameplay ke peta tubuh).
 *
 * Satu dunia tunggal dari `data/body-map.json`: chamber organ (elips berlobus)
 * + pembuluh (rantai kapsul) = SATU lumen terhubung. Zona perjalanan tidak
 * lagi dipasang per-arena: zona = POSISI pemain di peta (anchor per zona).
 *
 * Konvensi koordinat sama dengan renderer peta (js/render/world-map.js):
 *   px = (nx * world.w, (1 - ny) * world.h)   // ny=0 puncak peta data
 *
 * API:
 *   buildBodyWorld(def) -> world {
 *     def, w, h,
 *     insideLumen(x,y), sdf(x,y), reflect(ent, rad),
 *     chamberAt(x,y), vesselKindAt(x,y,maxD),
 *     spawnRing(x,y,r0,r1,preferBelow), anchorPx(name), zoneAnchorPx(zone),
 *     reachabilityGrid(step)  // untuk guard: satu komponen terhubung
 *   }
 *
 * Tidak ada state global; murni fungsi dari data. Mekanik inti (loop, ekonomi,
 * mutasi) tidak disentuh — dunia hanya menjawab "di mana boleh berdiri".
 */

const CELL = 240;

function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx, qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/** SDF kasar satu primitif: negatif di dalam lumen, positif di daging. */
function sdfPrim(p, prim) {
  if (prim.type === 'ellipse') {
    const k = Math.hypot((p.x - prim.cx) / prim.rx, (p.y - prim.cy) / prim.ry);
    return (k - 1) * Math.min(prim.rx, prim.ry);
  }
  let d = Infinity;
  for (const s of prim.segs) {
    const dd = segDist(p.x, p.y, s[0], s[1], s[2], s[3]);
    if (dd < d) d = dd;
  }
  return d - prim.r;
}

export function buildBodyWorld(def) {
  if (!def || !def.world) return null;
  const W = def.world.w, H = def.world.h;
  const XY = (nx, ny) => [nx * W, (1 - ny) * H];

  const prims = [];
  for (const o of def.organs || []) {
    const [cx, cy] = XY(o.x, o.y);
    prims.push({
      type: 'ellipse', cx, cy, rx: o.rx * W, ry: o.ry * H,
      organ: o.id, palette: o.palette, label: o.label,
    });
  }
  for (const v of def.vessels || []) {
    const pts = (v.points || []).map(([nx, ny]) => XY(nx, ny));
    const segs = [];
    for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
    if (segs.length) prims.push({ type: 'caps', segs, r: v.r || 40, vessel: v.id, kind: v.kind });
  }

  // spatial hash sel->primitif (bbox diperbesar) supaya sdf O(1)-ish
  const grid = new Map();
  const key = (ix, iy) => ix + ',' + iy;
  const stamp = (x0, y0, x1, y1, idx) => {
    const ix0 = Math.floor(x0 / CELL), ix1 = Math.floor(x1 / CELL);
    const iy0 = Math.floor(y0 / CELL), iy1 = Math.floor(y1 / CELL);
    for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) {
      const k = key(ix, iy);
      let a = grid.get(k); if (!a) { a = []; grid.set(k, a); }
      a.push(idx);
    }
  };
  prims.forEach((p, i) => {
    if (p.type === 'ellipse') stamp(p.cx - p.rx, p.cy - p.ry, p.cx + p.rx, p.cy + p.ry, i);
    else {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const s of p.segs) {
        x0 = Math.min(x0, s[0], s[2]); y0 = Math.min(y0, s[1], s[3]);
        x1 = Math.max(x1, s[0], s[2]); y1 = Math.max(y1, s[1], s[3]);
      }
      stamp(x0 - p.r, y0 - p.r, x1 + p.r, y1 + p.r, i);
    }
  });
  const near = (x, y) => {
    const a = grid.get(key(Math.floor(x / CELL), Math.floor(y / CELL)));
    return a || null;
  };

  function sdf(x, y) {
    const p = { x, y };
    const idx = near(x, y);
    let d = Infinity;
    if (idx) { for (const i of idx) { const dd = sdfPrim(p, prims[i]); if (dd < d) d = dd; } }
    if (d === Infinity) { // sel kosong: cari lewat semua primitif (jarak jauh)
      for (const prim of prims) { const dd = sdfPrim(p, prim); if (dd < d) d = dd; }
    }
    return d;
  }
  const insideLumen = (x, y) => sdf(x, y) < 0;

  function normalAt(x, y) {
    const e = 6;
    let nx = sdf(x + e, y) - sdf(x - e, y);
    let ny = sdf(x, y + e) - sdf(x, y - e);
    const L = Math.hypot(nx, ny) || 1;
    return { x: nx / L, y: ny / L };
  }

  /** Pantul elastis: entitas di daging (atau menempel tepi) didorong ke lumen. */
  function reflect(ent, rad = 14) {
    if (!ent) return false;
    let s = sdf(ent.x, ent.y);
    if (s <= -rad) return false;
    // iteratif: gradien union bisa kasar di antara dua primitif — ulangi
    // sampai benar-benar di dalam lumen (maks 6 langkah, konvergen cepat).
    for (let k = 0; k < 6 && s > -rad; k++) {
      const n = normalAt(ent.x, ent.y);
      const pen = s + rad + 0.5;
      ent.x -= n.x * pen; ent.y -= n.y * pen;
      const vx = ent.vx || 0, vy = ent.vy || 0;
      const vn = vx * n.x + vy * n.y;
      if (vn > 0) { ent.vx = vx - 1.6 * vn * n.x; ent.vy = vy - 1.6 * vn * n.y; }
      s = sdf(ent.x, ent.y);
    }
    return true;
  }

  function chamberAt(x, y) {
    for (const p of prims) {
      if (p.type !== 'ellipse') continue;
      const k = Math.hypot((x - p.cx) / p.rx, (y - p.cy) / p.ry);
      if (k <= 1) return p.organ;
    }
    return null;
  }
  function vesselKindAt(x, y, maxD = 90) {
    let best = null, bd = maxD;
    for (const p of prims) {
      if (p.type !== 'caps') continue;
      const d = sdfPrim({ x, y }, p);
      if (d < bd) { bd = d; best = p.kind; }
    }
    return best;
  }

  function spawnRing(x, y, r0 = 260, r1 = 620, preferBelow = true) {
    const tryAng = (a, d) => ({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
    for (let k = 0; k < 26; k++) {
      const below = preferBelow && k < 16;
      const a = below
        ? Math.PI * (0.17 + Math.random() * 0.66)           // sektor bawah
        : Math.random() * Math.PI * 2;
      const d = r0 + Math.random() * (r1 - r0);
      const q = tryAng(a, d);
      if (q.x > 20 && q.x < W - 20 && q.y > 20 && q.y < H - 20 && sdf(q.x, q.y) < -24) return q;
    }
    return { x, y: Math.max(20, Math.min(H - 20, y - 200)) };
  }

  const anchorPx = (name) => {
    const a = (def.anchors || {})[name];
    if (!a) return null;
    const [x, y] = XY(a.x, a.y);
    return { x, y };
  };
  const zoneAnchorPx = (zone) => {
    if (!zone || !zone.anchor) return null;
    const [x, y] = XY(zone.anchor.x, zone.anchor.y);
    return { x, y, r: (zone.homeR || 0.08) * Math.min(W, H) * 1.6 };
  };

  /** Grid keterjangkauan (guard): BFS di mask lumen dari satu titik awal. */
  function reachabilityGrid(step = 40) {
    const cols = Math.ceil(W / step), rows = Math.ceil(H / step);
    const solid = new Uint8Array(cols * rows);
    for (let iy = 0; iy < rows; iy++) for (let ix = 0; ix < cols; ix++) {
      solid[iy * cols + ix] = sdf(ix * step + step / 2, iy * step + step / 2) < -8 ? 0 : 1;
    }
    return { cols, rows, step, solid };
  }

  return {
    def, w: W, h: H, prims, sdf, insideLumen, reflect, chamberAt, vesselKindAt,
    spawnRing, anchorPx, zoneAnchorPx, reachabilityGrid,
  };
}
