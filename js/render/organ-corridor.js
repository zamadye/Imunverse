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
import { getSprite } from './sprite-loader.js';

const W_DEF = {
  tissue: '96,22,30', tissueFar: '58,10,16', muscle: '178,56,66', muscleLight: '222,120,120',
  vessel: '64,88,190', vesselArt: '232,74,84', flow: '255,190,180', rim: '255,170,160',
  fiberSpacing: 46, vesselCount: 3, cordEvery: 260, bpm: 72,
};

/**
 * Lantai bertekstur: tile PNG dalam ruang DUNIA (ikut kamera & skala proyeksi),
 * diklip ke gabungan lajur (clip sudah aktif saat dipanggil). Di atasnya:
 * vignette lateral gelap (dinding terasa menaungi) + rim tipis.
 */
function drawTiledFloor(ctx, P, cfg, lanes, y0, y1, sMid, beat) {
  const entry = getSprite(cfg.floor);
  if (!entry || !entry.image || entry.isPlaceholder) return;
  const img = entry.image;
  const tileW = cfg.floorTile || 512; // ukuran satu tile dalam unit dunia
  const cam = cameraOf(P);
  const w = P.w, h = P.h;
  // gambar tile pada ruang layar melalui proyeksi titik-titik sudut (top-down: afinitas cukup)
  const a = P.project(cam.x, cam.y), b = P.project(cam.x + tileW, cam.y), c = P.project(cam.x, cam.y + tileW);
  const sx = (b.x - a.x) / tileW, sy = (c.y - a.y) / tileW;
  if (!(sx > 0) || !(sy > 0)) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  ctx.scale(dpr, dpr);
  const ox = a.x - cam.x * sx, oy = a.y - cam.y * sy; // layar = dunia*s + o
  const pw = tileW * sx, ph = tileW * sy;
  const x0 = Math.floor((-ox) / pw) * pw + ox - pw, y0s = Math.floor((-oy) / ph) * ph + oy - ph;
  ctx.globalAlpha = cfg.floorAlpha == null ? 1 : cfg.floorAlpha;
  ctx.imageSmoothingEnabled = true;
  for (let y = y0s; y < h + ph; y += ph) for (let x = x0; x < w + pw; x += pw) ctx.drawImage(img, x, y, pw + 1, ph + 1);
  // vignette lateral: tepi lajur lebih gelap (dinding menaungi), tengah terang
  ctx.globalAlpha = 1;
  for (const e of lanes) {
    const q = e.Lp[Math.floor(e.Lp.length / 2)], r = e.Rp[Math.floor(e.Rp.length / 2)];
    const gr = ctx.createLinearGradient(q.x, 0, r.x, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.18, 'rgba(0,0,0,0.12)');
    gr.addColorStop(0.5, `rgba(255,120,110,${0.03 + beat * 0.04})`);
    gr.addColorStop(0.82, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    for (let i = 0; i < e.Lp.length; i++) ctx.lineTo(e.Lp[i].x, e.Lp[i].y);
    for (let i = e.Rp.length - 1; i >= 0; i--) ctx.lineTo(e.Rp[i].x, e.Rp[i].y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function hash1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} P   proyektor kamera (makeProjector)
 * @param {object} run run aktif (butuh arenaShape)
 * @param {number} time detik
 */
let _off = null;
function offscreen(w, h) {
  if (typeof document === 'undefined') return null;
  if (!_off) _off = document.createElement('canvas');
  if (_off.width !== w || _off.height !== h) { _off.width = w; _off.height = h; }
  return _off;
}

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
  const pr = (x, y) => P.project(x, y);
  const sMid = pr(shape.centerAt((y0 + y1) / 2), (y0 + y1) / 2).s;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

  // kontur tiap lajur yang terlihat
  const lanes = shape.lanes.map((L) => {
    const poly = wallPolyline(shape, y0 - step, y1 + step, step, L);
    return { L, poly, Lp: poly.left.map(([x, y]) => pr(x, y)), Rp: poly.right.map(([x, y]) => pr(x, y)) };
  }).filter((e) => e.Lp.length >= 2);
  if (!lanes.length) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ---------- 1. JARINGAN LUAR = seluruh layar DIKURANGI gabungan lajur ----------
  // (offscreen: isi jaringan penuh, lubangi tiap lajur dengan destination-out —
  //  benar untuk cabang yang saling tumpang tindih; even-odd akan bocor.)
  const lanePath = (g, e, padPx = 0) => {
    g.beginPath();
    for (let i = 0; i < e.Lp.length; i++) g.lineTo(e.Lp[i].x - padPx, e.Lp[i].y);
    for (let i = e.Rp.length - 1; i >= 0; i--) g.lineTo(e.Rp[i].x + padPx, e.Rp[i].y);
    g.closePath();
  };
  const off = offscreen(Math.ceil(w * dpr), Math.ceil(h * dpr));
  if (off) {
    const g = off.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    const tg = g.createLinearGradient(0, 0, 0, h);
    tg.addColorStop(0, `rgba(${cfg.tissueFar},1)`);
    tg.addColorStop(1, `rgba(${cfg.tissue},1)`);
    g.fillStyle = tg;
    g.fillRect(0, 0, w, h);
    // PILOT PX: tekstur DINDING otot (tile ruang dunia) di atas gradasi jaringan
    if (cfg.wallTex) {
      try {
        const wt = getSprite(cfg.wallTex);
        if (wt && wt.image && !wt.isPlaceholder) {
          const cam2 = cam, tileW = cfg.wallTile || 512;
          const a = pr(cam2.x, cam2.y), b = pr(cam2.x + tileW, cam2.y), c2 = pr(cam2.x, cam2.y + tileW);
          const sx = (b.x - a.x) / tileW, sy = (c2.y - a.y) / tileW;
          if (sx > 0 && sy > 0) {
            const ox = a.x - cam2.x * sx, oy = a.y - cam2.y * sy, pw = tileW * sx, ph = tileW * sy;
            const xs = Math.floor((-ox) / pw) * pw + ox - pw, ys = Math.floor((-oy) / ph) * ph + oy - ph;
            g.globalAlpha = cfg.wallAlpha == null ? 0.9 : cfg.wallAlpha;
            for (let y = ys; y < h + ph; y += ph) for (let x = xs; x < w + pw; x += pw) g.drawImage(wt.image, x, y, pw + 1, ph + 1);
            g.globalAlpha = 1;
          }
        }
      } catch { /* abaikan */ }
    }
    // rim digambar DI LUAR lajur (dilubangi setelahnya → tidak pernah melintasi rongga cabang lain)
    g.globalAlpha = 0.28 + beat * 0.22;
    g.strokeStyle = `rgba(${cfg.rim},1)`;
    g.lineWidth = Math.max(3, 6 * sMid);
    g.lineJoin = 'round';
    for (const e of lanes) for (const pts of [e.Lp, e.Rp]) {
      g.beginPath();
      for (let i = 0; i < pts.length; i++) { if (i === 0) g.moveTo(pts[i].x, pts[i].y); else g.lineTo(pts[i].x, pts[i].y); }
      g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-out';
    for (const e of lanes) { lanePath(g, e); g.fill(); }
    // tepi lembut: gradasi gelap 70 unit ke dalam lajur (memberi "tebal" dinding)
    g.globalCompositeOperation = 'source-over';
    for (const e of lanes) {
      g.save();
      lanePath(g, e); g.clip();
      for (const [pts, dir] of [[e.Lp, 1], [e.Rp, -1]]) {
        const q = pts[Math.floor(pts.length / 2)];
        const gr = g.createLinearGradient(q.x, 0, q.x + dir * (cfg.floor ? 110 : 70) * sMid, 0);
        gr.addColorStop(0, `rgba(0,0,0,${cfg.floor ? 0.85 : 0.55})`);
        gr.addColorStop(1, `rgba(${cfg.tissueFar},0)`);
        g.fillStyle = gr;
        g.beginPath();
        for (let i = 0; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
        for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i].x + dir * 70 * sMid, pts[i].y);
        g.closePath(); g.fill();
      }
      g.restore();
    }
    ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, w, h);
  } else {
    // cadangan tanpa DOM (penguji jsdom): isi sisi kiri/kanan lajur utama saja
    const e = lanes[0];
    ctx.fillStyle = `rgba(${cfg.tissue},1)`;
    for (const [pts, dir] of [[e.Lp, -1], [e.Rp, 1]]) {
      ctx.beginPath();
      ctx.moveTo(dir < 0 ? -4000 : w + 4000, pts[0].y - 2000);
      for (const q of pts) ctx.lineTo(q.x, q.y);
      ctx.lineTo(dir < 0 ? -4000 : w + 4000, pts[pts.length - 1].y + 2000);
      ctx.closePath(); ctx.fill();
    }
  }

  // Lapisan dinding digambar per lajur, DIKLIP ke gabungan lajur supaya pita
  // otot satu cabang tidak menutupi rongga cabang lain.
  ctx.save();
  ctx.beginPath();
  for (const e of lanes) {
    ctx.moveTo(e.Lp[0].x, e.Lp[0].y);
    for (let i = 1; i < e.Lp.length; i++) ctx.lineTo(e.Lp[i].x, e.Lp[i].y);
    for (let i = e.Rp.length - 1; i >= 0; i--) ctx.lineTo(e.Rp[i].x, e.Rp[i].y);
    ctx.closePath();
  }
  ctx.clip();

  // ---------- 1b. LANTAI ORGAN (opsional: wall.floor = path tekstur tile) ----------
  // Standar roguelike: tanah GELAP bertekstur halus supaya sprite terang terbaca.
  if (cfg.floor) {
    try { drawTiledFloor(ctx, P, cfg, lanes, y0, y1, sMid, beat); } catch { /* abaikan: tekstur belum siap */ }
  }
  const bandW = 62 + beat * 10;
  const fiberSp = cfg.fiberSpacing;
  const nV = Math.max(1, cfg.vesselCount | 0);
  for (const e of lanes) {
    const L = e.L;
    // ---------- 2. SERAT OTOT ----------
    for (const [side, dir] of [[e.poly.left, 1], [e.poly.right, -1]]) {
      ctx.beginPath();
      for (let i = 0; i < side.length; i++) { const q = pr(side[i][0], side[i][1]); ctx.lineTo(q.x, q.y); }
      for (let i = side.length - 1; i >= 0; i--) { const q = pr(side[i][0] + dir * bandW, side[i][1]); ctx.lineTo(q.x, q.y); }
      ctx.closePath();
      ctx.globalAlpha = cfg.floor ? 0.35 : 0.85;
      ctx.fillStyle = `rgba(${cfg.muscle},1)`;
      ctx.fill();
      ctx.globalAlpha = (cfg.floor ? 0.25 : 0.55) + beat * 0.25;
      ctx.strokeStyle = `rgba(${cfg.muscleLight},1)`;
      ctx.lineWidth = Math.max(1, 3 * sMid);
      ctx.beginPath();
      const yStart = Math.floor((Math.max(L.topY, y0) - step) / fiberSp) * fiberSp;
      for (let y = yStart; y <= Math.min(L.bottomY, y1) + step; y += fiberSp) {
        const yy = Math.max(L.topY, Math.min(L.bottomY, y + Math.sin(time * 0.7 + y * 0.01) * 4));
        const c = L.centerAt(yy), hw = L.halfAt(yy);
        const x0 = c - dir * hw;
        const wob = hash1(y * 0.013 + dir) * 10;
        const a = pr(x0 + dir * 6, yy + 10 + wob);
        const b = pr(x0 + dir * (bandW - 8), yy - 16 - wob);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ---------- 3. PEMBULUH — aliran naik ----------
    for (const [side, dir] of [[e.poly.left, 1], [e.poly.right, -1]]) {
      for (let v = 0; v < nV; v++) {
        const artery = (v % 2) === 1;
        const off2 = 14 + v * 20 + hash1(v * 7 + dir) * 6;
        const amp = 8 + v * 3;
        const col = artery ? cfg.vesselArt : cfg.vessel;
        const lw = Math.max(1.2, (artery ? 4.2 : 5.4) * sMid * (1 + beat * 0.25 * (artery ? 1 : 0.3)));
        ctx.beginPath();
        for (let i = 0; i < side.length; i++) {
          const y = side[i][1];
          const c = L.centerAt(y), hw = L.halfAt(y);
          const x = c - dir * hw + dir * (off2 + bandW * 0.15) + Math.sin(y * 0.02 + v * 1.7 + dir) * amp;
          const q = pr(x, y);
          if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        }
        // PILOT PX: pembuluh TERTANAM — selubung gelap (alur) lalu inti redup
        if (cfg.floor) {
          ctx.globalAlpha = 0.6; ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = lw * 1.8; ctx.setLineDash([]); ctx.stroke();
        }
        ctx.globalAlpha = cfg.floor ? 0.5 : 0.55;
        ctx.strokeStyle = `rgba(${col},1)`;
        ctx.lineWidth = lw;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.globalAlpha = cfg.floor ? 0.35 : 0.75;
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

    // ---------- 4. KORDA / TONJOLAN (opsional: cordEvery > 0) ----------
    const cordEvery = cfg.cordEvery;
    if (cordEvery > 0) {
      ctx.strokeStyle = `rgba(${cfg.rim},1)`;
      const yc0 = Math.floor((y0 - step) / cordEvery) * cordEvery;
      for (let y = yc0; y <= y1 + step; y += cordEvery) {
        const r = hash1(y * 0.37);
        const dir = r < 0.5 ? 1 : -1;
        const yy = y + (r - 0.5) * cordEvery * 0.6;
        if (yy < L.topY + 60 || yy > L.bottomY - 60) continue;
        const c = L.centerAt(yy), hw = L.halfAt(yy);
        const len = hw * (cfg.cordProps ? (0.04 + hash1(y * 0.11) * 0.16) : (0.28 + hash1(y * 0.11) * 0.22));
        const x0 = c - dir * hw + dir * bandW * (cfg.cordProps ? 0.35 : 0.6);
        const sway = Math.sin(time * 1.3 + y * 0.03) * 12 + beat * 8 * dir;
        const a = pr(x0, yy), m = pr(x0 + dir * len * 0.55, yy + sway * 0.5 - 18), b = pr(x0 + dir * len, yy + sway);
        // PILOT PX: korda = PROP sprite bervolume (bayangan + gambar), bukan garis.
        const propPath = cfg.cordProps && cfg.cordProps.length ? cfg.cordProps[Math.floor(hash1(y * 0.53) * cfg.cordProps.length) % cfg.cordProps.length] : null;
        const pe = propPath ? getSprite(propPath) : null;
        if (pe && pe.image && !pe.isPlaceholder) {
          const sz = (cfg.cordSize || 120) * (0.8 + hash1(y * 0.71) * 0.5) * b.s;
          ctx.globalAlpha = 0.45; ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.ellipse(b.x, b.y + sz * 0.06, sz * 0.42, sz * 0.16, 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.save(); ctx.translate(b.x, b.y); if (dir < 0) ctx.scale(-1, 1);
          ctx.drawImage(pe.image, -sz / 2, -sz * 0.78, sz, sz);
          ctx.restore();
        } else {
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = Math.max(1, 2.4 * sMid);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(m.x, m.y, b.x, b.y); ctx.stroke();
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = `rgba(${cfg.muscleLight},1)`;
          ctx.beginPath(); ctx.ellipse(b.x, b.y, 6 * sMid, 4 * sMid * PERSP.YS * 2, 0, 0, TAU); ctx.fill();
        }
      }
    }
  }
  ctx.restore(); // clip gabungan lajur

  // ---------- 5. RIM: sudah digambar di lapisan jaringan luar (offscreen) ----------
  if (!off) {
    ctx.globalAlpha = 0.28 + beat * 0.22;
    ctx.strokeStyle = `rgba(${cfg.rim},1)`;
    ctx.lineWidth = Math.max(1.5, 3 * sMid);
    for (const e of lanes) for (const pts of [e.Lp, e.Rp]) {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) { if (i === 0) ctx.moveTo(pts[i].x, pts[i].y); else ctx.lineTo(pts[i].x, pts[i].y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
