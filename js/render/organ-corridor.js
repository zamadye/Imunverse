/**
 * organ-corridor.js — perender PILOT "Organ Ascent": dinding organ berbentuk
 * siluet + serat otot berdenyut + pembuluh darah mengalir + korda tendinea.
 *
 * Digambar SETELAH tekstur tanah (drawArena3D) dan SEBELUM entitas, memakai
 * proyektor kamera yang sama (P.project) sehingga dinding ikut perspektif
 * pseudo-3D (yang jauh di atas mengecil). Semua geometri diturunkan dari
 * `run.arenaShape` (arena-shape.js) — dinding visual = dinding collision,
 * satu sumber kebenaran.
 *
 * Lapisan (bawah → atas):
 *   1. Jaringan luar   — area di luar siluet (gelap, padat) + gradasi tepi
 *   2. Serat otot      — pita striasi mengikuti kontur dinding, berdenyut (bpm)
 *   3. Pembuluh        — 2–3 urat per sisi (vena biru / arteri merah), aliran
 *                        naik (lineDashOffset) — bahasa visual "mendaki"
 *   4. Korda tendinea  — tali tipis menjulur dari dinding ke dalam bilik
 *   5. Rim             — kilau tepi dinding (batas jelas terbaca saat bermain)
 *
 * Tidak ada state, tidak ada aset — murni prosedural dari data `shape.wall`.
 */
import { PERSP } from './camera.js';
import { heartbeat, cameraOf, worldViewBox } from './background.js';
import { wallPolyline } from '../systems/arena-shape.js';

const TAU = Math.PI * 2;
const W_DEF = {
  tissue: '96,22,30', tissueFar: '58,10,16', muscle: '178,56,66', muscleLight: '222,120,120',
  vessel: '64,88,190', vesselArt: '232,74,84', flow: '255,190,180', rim: '255,170,160',
  fiberSpacing: 46, vesselCount: 3, cordEvery: 260, bpm: 72,
};

function hash1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} P   proyektor kamera (makeProjector)
 * @param {object} run run aktif (butuh arenaShape)
 * @param {number} time detik
 */
export function drawOrganCorridor(ctx, P, run, time) {
  const shape = run.arenaShape;
  if (!shape) return;
  const w = P.w, h = P.h;
  const cfg = { ...W_DEF, ...((shape.def && shape.def.wall) || {}) };
  const cam = cameraOf(P);
  const vb = worldViewBox(cam, w, h, 80, 120);
  const y0 = Math.max(shape.topY, vb.y0), y1 = Math.min(shape.bottomY, vb.y1);
  if (y1 < y0) return;
  const beat = heartbeat(time, cfg.bpm);
  const step = 36;
  const poly = wallPolyline(shape, y0 - step, y1 + step, step);
  const pr = (x, y) => P.project(x, y);
  const proj = (arr) => arr.map(([x, y]) => pr(x, y));
  const L = proj(poly.left), R = proj(poly.right);
  if (L.length < 2) return;
  const sMid = pr(shape.centerAt((y0 + y1) / 2), (y0 + y1) / 2).s;
  const yTopVisible = y0 <= shape.topY + step;
  const yBotVisible = y1 >= shape.bottomY - step;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ---------- 1. JARINGAN LUAR (di luar siluet) ----------
  const farEdge = 4000;
  const sideFill = (pts, dir) => {
    ctx.beginPath();
    ctx.moveTo(dir < 0 ? -farEdge : w + farEdge, pts[0].y - 2000);
    for (const q of pts) ctx.lineTo(q.x, q.y);
    ctx.lineTo(dir < 0 ? -farEdge : w + farEdge, pts[pts.length - 1].y + 2000);
    ctx.closePath();
  };
  const tissueGrad = (pts, dir) => {
    const q = pts[Math.floor(pts.length / 2)];
    const span = 240 * sMid;
    const g = ctx.createLinearGradient(q.x, 0, q.x + dir * span, 0);
    g.addColorStop(0, `rgba(${cfg.tissue},0.96)`);
    g.addColorStop(1, `rgba(${cfg.tissueFar},1)`);
    return g;
  };
  ctx.fillStyle = tissueGrad(L, -1); sideFill(L, -1); ctx.fill();
  ctx.fillStyle = tissueGrad(R, 1); sideFill(R, 1); ctx.fill();
  // tutup atas/bawah koridor (ujung aorta / apeks)
  if (yTopVisible || yBotVisible) {
    ctx.fillStyle = `rgba(${cfg.tissueFar},1)`;
    if (yTopVisible) {
      const a = pr(shape.centerAt(shape.topY) - shape.halfAt(shape.topY), shape.topY);
      const b = pr(shape.centerAt(shape.topY) + shape.halfAt(shape.topY), shape.topY);
      ctx.beginPath(); ctx.moveTo(-farEdge, -farEdge); ctx.lineTo(w + farEdge, -farEdge);
      ctx.lineTo(w + farEdge, b.y); ctx.lineTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.lineTo(-farEdge, a.y); ctx.closePath(); ctx.fill();
    }
    if (yBotVisible) {
      const a = pr(shape.centerAt(shape.bottomY) - shape.halfAt(shape.bottomY), shape.bottomY);
      const b = pr(shape.centerAt(shape.bottomY) + shape.halfAt(shape.bottomY), shape.bottomY);
      ctx.beginPath(); ctx.moveTo(-farEdge, h + farEdge); ctx.lineTo(w + farEdge, h + farEdge);
      ctx.lineTo(w + farEdge, b.y); ctx.lineTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.lineTo(-farEdge, a.y); ctx.closePath(); ctx.fill();
    }
  }
  // bayangan dalam di kaki dinding (memberi "tebal")
  for (const [pts, dir] of [[L, 1], [R, -1]]) {
    const q = pts[Math.floor(pts.length / 2)];
    const g = ctx.createLinearGradient(q.x, 0, q.x + dir * 70 * sMid, 0);
    g.addColorStop(0, `rgba(${cfg.tissueFar},0.55)`);
    g.addColorStop(1, `rgba(${cfg.tissueFar},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x + dir * 70 * sMid, pts[i].y);
    ctx.closePath(); ctx.fill();
  }

  // ---------- 2. SERAT OTOT (striasi mengikuti dinding, berdenyut) ----------
  const bandW = 62 + beat * 10;              // lebar pita otot (unit dunia)
  const fiberSp = cfg.fiberSpacing;
  for (const [side, dir] of [[poly.left, 1], [poly.right, -1]]) {
    // pita dasar otot
    ctx.beginPath();
    for (let i = 0; i < side.length; i++) { const q = pr(side[i][0], side[i][1]); ctx.lineTo(q.x, q.y); }
    for (let i = side.length - 1; i >= 0; i--) { const q = pr(side[i][0] + dir * bandW, side[i][1]); ctx.lineTo(q.x, q.y); }
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = `rgba(${cfg.muscle},1)`;
    ctx.fill();
    // striasi miring: garis pendek melintang pita, berjalan (crawl) pelan
    ctx.globalAlpha = 0.55 + beat * 0.25;
    ctx.strokeStyle = `rgba(${cfg.muscleLight},1)`;
    ctx.lineWidth = Math.max(1, 3 * sMid);
    ctx.beginPath();
    const yStart = Math.floor((y0 - step) / fiberSp) * fiberSp;
    for (let y = yStart; y <= y1 + step; y += fiberSp) {
      const yy = Math.max(shape.topY, Math.min(shape.bottomY, y + Math.sin(time * 0.7 + y * 0.01) * 4));
      const c = shape.centerAt(yy), hw = shape.halfAt(yy);
      const x0 = c - dir * hw;               // di dinding
      const wob = hash1(y * 0.013 + dir) * 10;
      const a = pr(x0 + dir * 6, yy + 10 + wob);
      const b = pr(x0 + dir * (bandW - 8), yy - 16 - wob);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ---------- 3. PEMBULUH (urat) — aliran naik ----------
  const nV = Math.max(1, cfg.vesselCount | 0);
  for (const [side, dir] of [[poly.left, 1], [poly.right, -1]]) {
    for (let v = 0; v < nV; v++) {
      const artery = (v % 2) === 1;
      const off = 14 + v * 20 + hash1(v * 7 + dir) * 6;   // jarak dari dinding (dunia)
      const amp = 8 + v * 3;
      const col = artery ? cfg.vesselArt : cfg.vessel;
      const lw = Math.max(1.2, (artery ? 4.2 : 5.4) * sMid * (1 + beat * 0.25 * (artery ? 1 : 0.3)));
      ctx.beginPath();
      for (let i = 0; i < side.length; i++) {
        const y = side[i][1];
        const c = shape.centerAt(y), hw = shape.halfAt(y);
        const x = c - dir * hw + dir * (off + bandW * 0.15) + Math.sin(y * 0.02 + v * 1.7 + dir) * amp;
        const q = pr(x, y);
        if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = `rgba(${col},1)`;
      ctx.lineWidth = lw;
      ctx.setLineDash([]);
      ctx.stroke();
      // aliran: butir terang berjalan NAIK (offset dash negatif = maju ke atas
      // karena garis digambar dari atas ke bawah)
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = `rgba(${cfg.flow},1)`;
      ctx.lineWidth = Math.max(1, lw * 0.42);
      const dashL = 10 * sMid, gapL = 26 * sMid;
      ctx.setLineDash([dashL, gapL]);
      ctx.lineDashOffset = (time * (artery ? 120 : 70) + v * 13) * sMid * PERSP.YS;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
  }
  ctx.globalAlpha = 1;

  // ---------- 4. KORDA TENDINEA — tali dari dinding ke dalam bilik ----------
  const cordEvery = cfg.cordEvery;
  ctx.strokeStyle = `rgba(${cfg.rim},1)`;
  const yc0 = Math.floor((y0 - step) / cordEvery) * cordEvery;
  for (let y = yc0; y <= y1 + step; y += cordEvery) {
    const r = hash1(y * 0.37);
    const dir = r < 0.5 ? 1 : -1;
    const yy = y + (r - 0.5) * cordEvery * 0.6;
    if (yy < shape.topY + 60 || yy > shape.bottomY - 60) continue;
    const c = shape.centerAt(yy), hw = shape.halfAt(yy);
    const len = hw * (0.28 + hash1(y * 0.11) * 0.22);
    const x0 = c - dir * hw + dir * bandW * 0.6;
    const sway = Math.sin(time * 1.3 + y * 0.03) * 12 + beat * 8 * dir;
    const a = pr(x0, yy), m = pr(x0 + dir * len * 0.55, yy + sway * 0.5 - 18), b = pr(x0 + dir * len, yy + sway);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, 2.4 * sMid);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(m.x, m.y, b.x, b.y); ctx.stroke();
    // ujung papiler (nodul kecil)
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = `rgba(${cfg.muscleLight},1)`;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, 6 * sMid, 4 * sMid * PERSP.YS * 2, 0, 0, TAU); ctx.fill();
  }

  // ---------- 5. RIM — tepi dinding ----------
  ctx.globalAlpha = 0.28 + beat * 0.22;
  ctx.strokeStyle = `rgba(${cfg.rim},1)`;
  ctx.lineWidth = Math.max(1.5, 3 * sMid);
  for (const pts of [L, R]) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) { if (i === 0) ctx.moveTo(pts[i].x, pts[i].y); else ctx.lineTo(pts[i].x, pts[i].y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
