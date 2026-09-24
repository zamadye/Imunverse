/**
 * render2d.js — RENDERER 2D ARENA V2, ditulis dari nol.
 * Kosakata: rongga organ bernapas + motif dinding per-organ (0 cobble,
 * 1 silia, 2 striasi, 3 rugae, 4 mielin, 5 nodul) + kolam hazard + beat
 * lockdown/swarm/purified/open. Palet selalu dari data room (pal.*).
 */
import { heartbeat, cameraOf, worldViewBox } from '../render/background.js';
import { roomSeed, lobeMod } from './arena.js';

const TAU = Math.PI * 2;
const HAZ = { acid: '150,255,90', mucus: '255,207,110', bile: '205,220,90' };

function palOf(room) {
  const p = (room && room.pal) || {};
  return {
    fill: p.fill || '132,20,24',
    deep: p.deep || '58,8,10',
    glow: p.glow || '255,96,70',
    hot: p.glowHot || '255,220,190',
  };
}

function hash1(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Motif dinding di pita [0.80R, 0.98R]. */
function motifRing(g, q, R, m, pal, t, seed) {
  const G = `rgba(${pal.glow},`, H = `rgba(${pal.hot},`;
  const rb = R * 0.89;
  g.save();
  g.lineCap = 'round';
  if (m === 1) { // silia paru: jumbai radial berdenyut
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU + seed * 2;
      const wv = 0.5 + 0.5 * Math.sin(k * 0.85 + t * 3.1 + seed * 7);
      g.strokeStyle = G + (0.22 + 0.5 * wv).toFixed(2) + ')';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(q.x + Math.cos(a) * rb * 0.9, q.y + Math.sin(a) * rb * 0.9);
      g.lineTo(q.x + Math.cos(a) * rb * 1.07, q.y + Math.sin(a) * rb * 1.07);
      g.stroke();
    }
  } else if (m === 2) { // striasi jantung: tali konsentris
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = (k % 2 ? H : G) + '0.40)';
      g.lineWidth = Math.max(2, R * 0.018);
      g.beginPath(); g.arc(q.x, q.y, rb * (0.87 + k * 0.07), 0, TAU); g.stroke();
    }
  } else if (m === 3) { // rugae usus/lambung: lipatan tebal hanyut
    for (let k = 0; k < 5; k++) {
      const a0 = (k / 5) * TAU + seed * 3 + t * 0.1;
      g.strokeStyle = G + '0.36)';
      g.lineWidth = R * 0.12;
      g.beginPath(); g.arc(q.x, q.y, rb * 0.94, a0, a0 + 1.0); g.stroke();
    }
  } else if (m === 4) { // mielin saraf: segmen + pulsa sinyal
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * TAU + seed;
      g.strokeStyle = k % 2 ? 'rgba(255,190,140,0.38)' : G + '0.28)';
      g.lineWidth = R * 0.09;
      g.beginPath(); g.arc(q.x, q.y, rb * 0.95, a0, a0 + TAU / 12 * 0.8); g.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const a = seed * 9 + t * 1.5 + k * Math.PI;
      g.strokeStyle = H + '0.85)';
      g.lineWidth = Math.max(2, R * 0.03);
      g.beginPath(); g.arc(q.x, q.y, rb * 0.95, a, a + 0.55); g.stroke();
    }
  } else if (m === 5) { // nodul ginjal: gugus bintik berkelip
    for (let k = 0; k < 20; k++) {
      const h1 = hash1(seed * 91 + k * 3.3), h2 = hash1(seed * 57 + k * 7.9);
      const a = h1 * TAU, rr = rb * (0.83 + h2 * 0.22);
      const tw = 0.5 + 0.5 * Math.sin(t * 2.3 + k * 1.7 + seed * 5);
      g.fillStyle = G + (0.18 + 0.52 * tw).toFixed(2) + ')';
      g.beginPath();
      g.arc(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr, Math.max(1.2, R * 0.015), 0, TAU);
      g.fill();
    }
  } else { // cobble kapiler: kerikil selang-seling
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * TAU + seed * 5;
      g.strokeStyle = k % 2 ? G + '0.32)' : H + '0.20)';
      g.lineWidth = R * 0.14;
      g.beginPath(); g.arc(q.x, q.y, rb * 0.93, a0, a0 + TAU / 8 * 0.88); g.stroke();
    }
  }
  g.restore();
}

/** Kalikan triplet "r,g,b" dengan k (clamp 0..255). */
function shade(trip, k) {
  const v = String(trip).split(',').map(Number);
  return v.map((c) => Math.max(0, Math.min(255, Math.round(c * k)))).join(',');
}

/** Id room route-berikutnya dari sudut pandang room id (navigasi junction). */
function routeNextId(arena, id) {
  const route = arena.route || [];
  const i = route.indexOf(id);
  if (i >= 0 && route[i + 1]) return route[i + 1];
  if (i > 0) return route[i - 1];
  const nb = arena.neighbors ? arena.neighbors(id) : [];
  return nb[0] || null;
}

/** Atmosfer layar mengikuti organ room aktif — identitas zona < 3 detik. */
function atmosphere(g, w, h, organ, pal, t, beat) {
  const G = `rgba(${pal.glow},`, H = `rgba(${pal.hot},`;
  if (organ === 'jantung') { // denyut: 2 cincin mengembang selaras detak
    for (let k = 0; k < 2; k++) {
      const ph = ((t * 0.55 + k * 0.5) % 1);
      g.strokeStyle = G + ((1 - ph) * 0.22).toFixed(2) + ')';
      g.lineWidth = 3;
      g.beginPath(); g.arc(w / 2, h / 2, 60 + ph * Math.max(w, h) * 0.6, 0, TAU); g.stroke();
    }
  } else if (organ === 'paru' || organ === 'goal') { // kabut / mote naik
    for (let k = 0; k < 9; k++) {
      const hx = hash1(k * 7.7) * w, spd = organ === 'goal' ? 26 : 9;
      const yy = ((hash1(k * 3.1) * h + (organ === 'goal' ? -t * spd : t * spd)) % (h + 80) + h + 80) % (h + 80) - 40;
      const xx = hx + Math.sin(t * 0.5 + k * 2.2) * 26;
      g.fillStyle = G + '0.10)';
      g.beginPath(); g.ellipse(xx, yy, 34 + hash1(k) * 40, 14 + hash1(k * 2) * 16, 0, 0, TAU); g.fill();
    }
  } else if (organ === 'saraf') { // percik statis berkedip
    for (let k = 0; k < 10; k++) {
      if (hash1(k * 13.7 + Math.floor(t * 6)) < 0.55) continue;
      const xx = hash1(k * 5.3) * w, yy = hash1(k * 9.1) * h;
      g.strokeStyle = H + '0.30)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(xx - 7, yy); g.lineTo(xx + 7, yy); g.stroke();
    }
  } else if (organ === 'usus_halus' || organ === 'lambung' || organ === 'usus_besar') { // lipatan hanyut
    for (let k = 0; k < 4; k++) {
      const yy = h * (0.18 + k * 0.22) + Math.sin(t * 0.7 + k * 1.9) * 10;
      g.strokeStyle = G + '0.12)'; g.lineWidth = 16 + k * 5;
      g.beginPath();
      for (let xx = -20; xx <= w + 20; xx += 40) {
        const y2 = yy + Math.sin(xx * 0.02 + t * 0.9 + k) * 9;
        if (xx === -20) g.moveTo(xx, y2); else g.lineTo(xx, y2);
      }
      g.stroke();
    }
  } else { // kapiler/darah/ginjal/limfe/dll: sel hanyut diagonal
    for (let k = 0; k < 14; k++) {
      const xx = ((hash1(k * 3.7) * (w + 60) + t * 22) % (w + 60)) - 30;
      const yy = ((hash1(k * 8.9) * (h + 60) + t * 13) % (h + 60)) - 30;
      g.fillStyle = G + '0.13)';
      g.beginPath(); g.arc(xx, yy, 5 + hash1(k * 1.3) * 9, 0, TAU); g.fill();
    }
  }
}

/** Path dinding lobed (radius = lobeMod) — identik dengan SDF. */
function lobePath(g, qx, qy, R, seed, scale = 1, N = 56) {
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const rr = R * scale * lobeMod(a, seed);
    const px = qx + Math.cos(a) * rr, py = qy + Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
}

/** Pita sel: bintik tekstur sepanjang busur dinding. */
function cellBand(g, qx, qy, R, seed, trip, n = 42) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + seed;
    const rr = R * (0.90 + hash1(seed * 131 + k * 1.7) * 0.08) * lobeMod(a, seed);
    g.fillStyle = `rgba(${trip},${(0.25 + hash1(seed * 77 + k * 3.3) * 0.4).toFixed(2)})`;
    g.beginPath();
    g.arc(qx + Math.cos(a) * rr, qy + Math.sin(a) * rr, Math.max(1, R * (0.012 + hash1(k * 9.1 + seed) * 0.02)), 0, TAU);
    g.fill();
  }
}

/** Serat busur di luar dinding (lapis jaringan). */
function fiberArcs(g, qx, qy, R, seed, trip) {
  g.save(); g.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    const a0 = seed * 7 + (k / 7) * TAU;
    g.strokeStyle = `rgba(${trip},0.20)`;
    g.lineWidth = Math.max(1, R * 0.012);
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = a0 + (i / 12) * 0.9;
      const rr = R * 1.05 * lobeMod(a, seed);
      const px = qx + Math.cos(a) * rr, py = qy + Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
  }
  g.restore();
}

/** Rim membran tebal: garis gelap + glow + garis panas. */
function membraneRim(g, qx, qy, R, seed, pal) {
  g.save(); g.lineJoin = 'round';
  lobePath(g, qx, qy, R, seed, 1.0);
  g.strokeStyle = `rgba(${pal.deep},0.9)`; g.lineWidth = Math.max(3, R * 0.075); g.stroke();
  lobePath(g, qx, qy, R, seed, 0.985);
  g.strokeStyle = `rgba(${pal.glow},0.5)`; g.lineWidth = Math.max(1.5, R * 0.028); g.stroke();
  lobePath(g, qx, qy, R, seed, 0.94);
  g.strokeStyle = `rgba(${pal.hot},0.55)`; g.lineWidth = Math.max(1, R * 0.012); g.stroke();
  g.restore();
}

/** Satu kantung rongga: bloom + dinding lobed + interior + pita + motif + rim. */
function paintBlob(g, pr, b, R0, pal, m, t, seed, opts) {
  const q = pr(b.x, b.y), R = R0 * q.s;
  if (R < 3) return;
  const dim = opts.dim == null ? 1 : opts.dim;
  const beat = opts.beat || 0;
  g.fillStyle = `rgba(${pal.glow},${(0.09 + beat * 0.06) * dim})`;
  g.beginPath(); g.arc(q.x, q.y, R * 1.22, 0, TAU); g.fill();
  lobePath(g, q.x, q.y, R, seed, 1.0);
  g.fillStyle = `rgba(${pal.deep},${0.94 * dim})`; g.fill();
  lobePath(g, q.x, q.y, R, seed, 0.965);
  g.fillStyle = `rgba(${pal.fill},${0.6 * dim})`; g.fill();
  lobePath(g, q.x, q.y, R, seed, 0.88);
  const gIn = g.createRadialGradient(q.x, q.y, 1, q.x, q.y, R * 0.88);
  gIn.addColorStop(0, `rgba(${pal.hot},${0.55 * dim})`);
  gIn.addColorStop(0.45, `rgba(${pal.fill},${0.5 * dim})`);
  gIn.addColorStop(1, `rgba(${pal.deep},${0.95 * dim})`);
  g.fillStyle = gIn; g.fill();
  cellBand(g, q.x, q.y, R, seed, pal.fill);
  fiberArcs(g, q.x, q.y, R, seed, pal.glow);
  if (!opts.junction) motifRing(g, q, R, m, pal, t, seed);
  membraneRim(g, q.x, q.y, R, seed, pal);
}

/** Room koil (usus): tabung sinusoidal + rugae tegak lurus. */
function paintCoil(g, pr, n, pal, t, seed, beat, br) {
  const qc = pr(n.x, n.y);
  const wR = n.coilR * br * qc.s;
  if (wR < 2 || !n.coilSegs) return;
  const pts = n.coilSegs.map((sg) => pr(sg.x0, sg.y0));
  const last = n.coilSegs[n.coilSegs.length - 1];
  pts.push(pr(last.x1, last.y1));
  const trace = () => {
    g.beginPath();
    pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
  };
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = `rgba(${pal.glow},${0.10 + beat * 0.06})`; g.lineWidth = wR * 2.6; trace(); g.stroke();
  g.strokeStyle = `rgba(${pal.deep},0.94)`; g.lineWidth = wR * 2.1; trace(); g.stroke();
  g.strokeStyle = `rgba(${pal.fill},0.75)`; g.lineWidth = wR * 1.7; trace(); g.stroke();
  g.strokeStyle = `rgba(${pal.hot},${0.35 + beat * 0.2})`; g.lineWidth = wR * 0.8; trace(); g.stroke();
  g.strokeStyle = `rgba(${pal.glow},0.4)`; g.lineWidth = Math.max(1.5, wR * 0.1);
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
    let d = 34 - (acc % 34);
    while (d < L) {
      const px = a.x + (b.x - a.x) * (d / L), py = a.y + (b.y - a.y) * (d / L);
      g.beginPath();
      g.moveTo(px - nx * wR * 0.8, py - ny * wR * 0.8);
      g.lineTo(px + nx * wR * 0.8, py + ny * wR * 0.8);
      g.stroke();
      d += 34;
    }
    acc += L;
  }
  g.restore();
}

/** Berkas cahaya diagonal dari atas (depth). */
function lightShaft(g, w, h, pal, t) {
  const sway = Math.sin(t * 0.4) * w * 0.03;
  const g2 = g.createLinearGradient(w * 0.3 + sway, 0, w * 0.55 + sway, h);
  g2.addColorStop(0, `rgba(${pal.hot},0.10)`);
  g2.addColorStop(1, `rgba(${pal.hot},0)`);
  g.fillStyle = g2;
  g.beginPath();
  g.moveTo(w * 0.30 + sway, 0); g.lineTo(w * 0.52 + sway, 0);
  g.lineTo(w * 0.72 + sway, h); g.lineTo(w * 0.42 + sway, h);
  g.closePath(); g.fill();
}

/** Sulur foreground gelap di tepi layar (blur-palsu 3 pass). */
function foreTendrils(g, w, h, t) {
  const arms = [
    { x: -w * 0.05, y: h * 1.05, r: w * 0.35, a0: -1.2 },
    { x: w * 1.05, y: h * 1.02, r: w * 0.30, a0: -1.9 },
    { x: w * 1.02, y: -h * 0.05, r: w * 0.26, a0: 1.6 },
  ];
  g.save(); g.lineCap = 'round';
  arms.forEach((arm, k) => {
    const wob = Math.sin(t * 0.6 + k * 2.1) * 0.08;
    for (const [lw, al] of [[64, 0.10], [44, 0.16], [26, 0.28]]) {
      g.strokeStyle = `rgba(8,2,5,${al})`;
      g.lineWidth = lw;
      g.beginPath(); g.arc(arm.x, arm.y, arm.r, arm.a0 + wob, arm.a0 + wob + 1.1); g.stroke();
    }
  });
  g.restore();
}

/** Mote melayang (partikel depth). */
function moteLayer(g, w, h, t, trip) {
  for (let k = 0; k < 22; k++) {
    const xx = ((hash1(k * 3.3) * (w + 40) + t * (8 + hash1(k) * 14)) % (w + 40)) - 20;
    const yy = ((hash1(k * 7.9) * (h + 40) - t * (5 + hash1(k * 2) * 9)) % (h + 40) + h + 40) % (h + 40) - 20;
    g.fillStyle = `rgba(${trip},${(0.10 + hash1(k * 5.1) * 0.16).toFixed(2)})`;
    g.beginPath(); g.arc(xx, yy, 1 + hash1(k * 1.7) * 2.4, 0, TAU); g.fill();
  }
}

function portal(g, q, R, t, rgb, big, tag) {
  // Portal START/GOAL (slice 5): pendar + inti + 3 cincin (1 berputar) +
  // label dunia statis + sorot vertikal (goal). Murni visual.
  const pul = 0.5 + 0.5 * Math.sin(t * 2.2);
  const glow = g.createRadialGradient(q.x, q.y, R * 0.2, q.x, q.y, R * 1.9);
  glow.addColorStop(0, `rgba(${rgb},${0.30 + pul * 0.14})`);
  glow.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = glow;
  g.beginPath(); g.arc(q.x, q.y, R * 1.9, 0, TAU); g.fill();
  const core = g.createRadialGradient(q.x, q.y, 1, q.x, q.y, R * 0.55);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.5, `rgba(${rgb},0.75)`);
  core.addColorStop(1, `rgba(${rgb},0.08)`);
  g.fillStyle = core;
  g.beginPath(); g.arc(q.x, q.y, R * 0.55, 0, TAU); g.fill();
  g.strokeStyle = `rgba(${rgb},${0.55 + pul * 0.25})`;
  g.lineWidth = Math.max(2, R * 0.06);
  g.beginPath(); g.arc(q.x, q.y, R, 0, TAU); g.stroke();
  g.strokeStyle = `rgba(${rgb},0.35)`;
  g.lineWidth = Math.max(1, R * 0.03);
  g.beginPath(); g.arc(q.x, q.y, R * 1.25, 0, TAU); g.stroke();
  g.strokeStyle = `rgba(255,255,255,${0.5 + pul * 0.3})`;
  g.lineWidth = Math.max(1.5, R * 0.045);
  g.setLineDash([R * 0.35, R * 0.28]);
  g.lineDashOffset = -t * (20 + R * 0.2);
  g.beginPath(); g.arc(q.x, q.y, R * 0.78, 0, TAU); g.stroke();
  g.setLineDash([]);
  if (tag && R > 14) {
    g.font = '700 11px system-ui,sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'top';
    g.lineWidth = 3; g.strokeStyle = 'rgba(10,2,5,0.85)';
    g.strokeText(tag, q.x, q.y + R * 1.35);
    g.fillStyle = '#fff';
    g.fillText(tag, q.x, q.y + R * 1.35);
  }
  if (big) {
    const bg2 = g.createLinearGradient(q.x, q.y - R * 5.5, q.x, q.y);
    bg2.addColorStop(0, `rgba(${rgb},0)`);
    bg2.addColorStop(1, `rgba(${rgb},${0.22 + pul * 0.16})`);
    g.fillStyle = bg2;
    g.fillRect(q.x - R * 0.22, q.y - R * 5.5, R * 0.44, R * 5.5);
  }
}
function paintRidges(g, pr, n, pal, beat) {
  // Rabung rugae (S7a): dinding kapsul tebal + sorot tepi. Cermin SDF.
  g.save(); g.lineCap = 'round';
  for (const r of n.ridges) {
    const a = pr(r.x0, r.y0), b = pr(r.x1, r.y1);
    const s = (a.s + b.s) / 2, w = Math.max(2, r.w * 2 * s);
    const trace = () => { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); };
    g.strokeStyle = 'rgba(18,3,7,0.92)'; g.lineWidth = w * 1.18; trace(); g.stroke();
    g.strokeStyle = `rgba(${pal.deep},0.95)`; g.lineWidth = w; trace(); g.stroke();
    g.strokeStyle = `rgba(${pal.fill},0.9)`; g.lineWidth = w * 0.60; trace(); g.stroke();
    g.strokeStyle = `rgba(${pal.hot},${0.55 + beat * 0.25})`; g.lineWidth = Math.max(2, w * 0.16); trace(); g.stroke();
  }
  g.restore();
}
function paintTri(g, pr, t, R0, pal, beat) {
  // Ruang segitiga haustra (S7b): tepi gelap + isi + rim. Cermin sdfTri.
  const A = pr(t.ax, t.ay), Bp = pr(t.bx, t.by), C = pr(t.cx, t.cy);
  const gx = (A.x + Bp.x + C.x) / 3, gy = (A.y + Bp.y + C.y) / 3;
  const trace = (k) => {
    g.beginPath();
    g.moveTo(gx + (A.x - gx) * k, gy + (A.y - gy) * k);
    g.lineTo(gx + (Bp.x - gx) * k, gy + (Bp.y - gy) * k);
    g.lineTo(gx + (C.x - gx) * k, gy + (C.y - gy) * k);
    g.closePath();
  };
  g.save(); g.lineJoin = 'round';
  trace(1.0); g.strokeStyle = 'rgba(18,3,7,0.92)'; g.lineWidth = Math.max(3, R0 * 0.035); g.stroke();
  trace(1.0); g.fillStyle = `rgba(${pal.deep},0.96)`; g.fill();
  trace(0.84); g.fillStyle = `rgba(${pal.fill},0.85)`; g.fill();
  trace(0.84); g.strokeStyle = `rgba(${pal.hot},${0.4 + beat * 0.2})`; g.lineWidth = 2; g.stroke();
  g.restore();
}
function paintHex(g, pr, n, R0, pal, beat) {
  // Ruang heksagon lobulus (S7c): tepi + isi + 3 pintu sudut. Cermin sdfHex.
  const h = n.hex, v = [];
  for (let k = 0; k < 6; k++) {
    const a = h.rot + Math.PI / 2 + (k / 6) * TAU;
    v.push(pr(h.x + Math.cos(a) * h.R, h.y + Math.sin(a) * h.R));
  }
  const cx = v.reduce((s, p) => s + p.x, 0) / 6, cy = v.reduce((s, p) => s + p.y, 0) / 6;
  const trace = (k) => {
    g.beginPath();
    v.forEach((p, i) => (i === 0
      ? g.moveTo(cx + (p.x - cx) * k, cy + (p.y - cy) * k)
      : g.lineTo(cx + (p.x - cx) * k, cy + (p.y - cy) * k)));
    g.closePath();
  };
  g.save(); g.lineJoin = 'round';
  trace(1.0); g.strokeStyle = 'rgba(18,3,7,0.92)'; g.lineWidth = Math.max(3, R0 * 0.035); g.stroke();
  trace(1.0); g.fillStyle = `rgba(${pal.deep},0.96)`; g.fill();
  trace(0.88); g.fillStyle = `rgba(${pal.fill},0.85)`; g.fill();
  trace(0.88); g.strokeStyle = `rgba(${pal.hot},${0.4 + beat * 0.2})`; g.lineWidth = 2; g.stroke();
  g.strokeStyle = `rgba(${pal.hot},0.8)`; g.lineWidth = 3;
  for (const k of [0, 2, 4]) {
    g.beginPath(); g.arc(v[k].x, v[k].y, Math.max(6, R0 * 0.06), 0, TAU); g.stroke();
  }
  g.restore();
}
function paintDrain(g, pr, dr, pal, time) {
  // Tirisan vena sentral (S7c): lubang + spiral putar. Lantai (arus).
  const q = pr(dr.x, dr.y), R = dr.R * q.s;
  if (R < 3) return;
  g.save();
  const pit = g.createRadialGradient(q.x, q.y, 1, q.x, q.y, R);
  pit.addColorStop(0, 'rgba(8,1,3,0.95)');
  pit.addColorStop(0.55, `rgba(${pal.deep},0.9)`);
  pit.addColorStop(1, `rgba(${pal.deep},0)`);
  g.fillStyle = pit;
  g.beginPath(); g.arc(q.x, q.y, R, 0, TAU); g.fill();
  g.strokeStyle = `rgba(${pal.glow},0.55)`; g.lineWidth = Math.max(1.5, R * 0.05);
  for (let a = 0; a < 3; a++) {
    const a0 = time * 1.4 + (a / 3) * TAU;
    g.beginPath();
    for (let s = 0; s <= 10; s++) {
      const rr = R * (0.15 + 0.75 * (s / 10)), aa = a0 + (s / 10) * 2.2;
      const X = q.x + Math.cos(aa) * rr, Y = q.y + Math.sin(aa) * rr;
      if (s === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
    }
    g.stroke();
  }
  g.restore();
}
export function drawArena2D(ctx, P, arena, time) {
  const w = P.w, h = P.h;
  const pr = (x, y) => P.project(x, y);
  const cam = cameraOf(P);
  const box = worldViewBox(cam, w, h, 90, 0);
  const inBox = (x, y, m) => x > box.x0 - m && x < box.x1 + m && y > box.y0 - m && y < box.y1 + m;
  const beat = heartbeat(time, arena.bpm || 72);
  ctx.save();
  // ---- latar: warna mengikuti pal organ room aktif + pola atmosfer ----
  const focus = (arena.active && arena.active()) || null;
  const fpal = palOf(focus);
  const forgan = (focus && focus.organ) || '';
  const bg = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h) * 0.75);
  bg.addColorStop(0, `rgb(${shade(fpal.deep, 1.5)})`);
  bg.addColorStop(0.55, `rgb(${shade(fpal.deep, 0.8)})`);
  bg.addColorStop(1, '#070204');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  atmosphere(ctx, w, h, forgan, fpal, time, beat);
  lightShaft(ctx, w, h, fpal, time);
  // ---- koridor: tabung 3 lapis ----
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const passes = [
    { k: 1.45, st: 'rgba(44,7,12,0.92)' },
    { k: 1.06, st: 'rgba(148,42,60,0.85)' },
    { k: 0.5, st: `rgba(255,168,112,${0.32 + beat * 0.14})` },
  ];
  for (const ps of passes) {
    ctx.strokeStyle = ps.st;
    for (const s of arena.segs) {
      if (!inBox((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, s.w * 2 + 40)) continue;
      const a = pr(s.x0, s.y0), b = pr(s.x1, s.y1);
      ctx.lineWidth = Math.max(1, s.w * 2 * ps.k * ((a.s + b.s) / 2));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  // ---- arus koridor: dash mengalir searah segmen (jujur thd currentAt) ----
  ctx.strokeStyle = 'rgba(255,200,160,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 16]);
  ctx.lineDashOffset = -time * 34;
  for (const s of arena.segs) {
    if (!inBox((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, s.w * 2 + 40)) continue;
    const a = pr(s.x0, s.y0), b = pr(s.x1, s.y1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // ---- sungai cahaya: inti terang + pulsa berjalan ----
  for (const s of arena.segs) {
    if (!inBox((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, s.w * 2 + 40)) continue;
    const a = pr(s.x0, s.y0), b = pr(s.x1, s.y1);
    const sm = (a.s + b.s) / 2;
    ctx.strokeStyle = `rgba(255,214,170,${0.30 + beat * 0.15})`;
    ctx.lineWidth = Math.max(1, s.w * 0.5 * sm);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,240,210,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([26, 110]);
  ctx.lineDashOffset = -time * 95;
  for (const s of arena.segs) {
    if (!inBox((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, s.w * 2 + 40)) continue;
    const a = pr(s.x0, s.y0), b = pr(s.x1, s.y1);
    ctx.lineWidth = Math.max(1.5, s.w * 0.34 * ((a.s + b.s) / 2));
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // ---- pilar: massa gelap ber-rim ----
  for (const p of arena.pillars) {
    if (!inBox(p.x, p.y, p.r + 30)) continue;
    const q = pr(p.x, p.y), R = p.r * q.s;
    if (R < 2) continue;
    ctx.fillStyle = 'rgba(28,5,10,0.92)';
    ctx.beginPath(); ctx.arc(q.x, q.y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,140,110,${0.28 + beat * 0.15})`;
    ctx.lineWidth = Math.max(1.5, R * 0.05);
    ctx.beginPath(); ctx.arc(q.x, q.y, R * 0.96, 0, TAU); ctx.stroke();
  }
  // ---- rooms ----
  const rooms = [...arena.rooms.values()];
  const route = arena.route || [];
  const rIdx = route.indexOf(arena.activeId);
  const labelOk = new Set([arena.activeId, route[0], route[route.length - 1]]);
  if (rIdx >= 0 && route[rIdx + 1]) labelOk.add(route[rIdx + 1]);
  const state = arena.state || 'lockdown';
  const shock = arena.shock || 0;
  for (const n of rooms) {
    if (!inBox(n.x, n.y, n.r + 60)) continue;
    const q = pr(n.x, n.y), R = n.r * q.s;
    if (R < 3) continue;
    const pal = palOf(n);
    const seed = roomSeed(n);
    const isActive = n.id === arena.activeId;
    const Rb = R * (1 + 0.022 * Math.sin(time * (arena.bpm || 72) / 60 * TAU + seed * 6));
    const dim = n.junction ? 0.55 : 1;
    const br = Rb / R; // faktor napas (seragam semua blob)
    if (n.shape === 'coil') {
      paintCoil(ctx, pr, n, pal, time, seed, beat, br);
    } else {
      if (n.tris) for (const t of n.tris) paintTri(ctx, pr, t, R, pal, beat);
      if (n.hex) paintHex(ctx, pr, n, R, pal, beat);
      if (n.drain) paintDrain(ctx, pr, n.drain, pal, time);
      for (const b of n.blobs) {
        paintBlob(ctx, pr, b, b.r * br, pal, n.motif, time, b.seed, { beat, dim, junction: !!n.junction });
      }
      if (n.shape !== 'cavity') {
        ctx.strokeStyle = `rgba(${pal.hot},0.28)`;
        ctx.setLineDash([10, 12]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(q.x, q.y, Rb * 1.03, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (n.ridges) paintRidges(ctx, pr, n, pal, beat);
    if (n.junction) {
      // penunjuk rute: segitiga di tepi junction ke arah room route-berikutnya
      const nxRoom = arena.node && arena.node(routeNextId(arena, n.id));
      if (nxRoom) {
        const na = Math.atan2(nxRoom.y - n.y, nxRoom.x - n.x);
        const tx = q.x + Math.cos(na) * Rb * 1.14, ty = q.y + Math.sin(na) * Rb * 1.14;
        const ts = Math.max(4, R * 0.09);
        ctx.fillStyle = `rgba(${pal.hot},0.75)`;
        ctx.beginPath();
        ctx.moveTo(tx + Math.cos(na) * ts, ty + Math.sin(na) * ts);
        ctx.lineTo(tx + Math.cos(na + 2.5) * ts, ty + Math.sin(na + 2.5) * ts);
        ctx.lineTo(tx + Math.cos(na - 2.5) * ts, ty + Math.sin(na - 2.5) * ts);
        ctx.closePath(); ctx.fill();
      }
    }
    // kolam hazard (di blob pertama / tengah koil — selalu di dalam lumen)
    if (n.hazard && HAZ[n.hazard.type]) {
      const hc = HAZ[n.hazard.type];
      const ha = seed * TAU + 0.7;
      let hb = q, hbR = Rb;
      if (n.shape === 'coil' && n.coilSegs) {
        const ms = n.coilSegs[n.coilSegs.length >> 1];
        hb = pr((ms.x0 + ms.x1) / 2, (ms.y0 + ms.y1) / 2); hbR = n.coilR * 2 * hb.s;
      } else if (n.blobs && n.blobs[0]) {
        const b0 = n.blobs[0];
        hb = pr(b0.x, b0.y); hbR = b0.r * br * hb.s;
      }
      const hx = hb.x + Math.cos(ha) * hbR * 0.3, hy = hb.y + Math.sin(ha) * hbR * 0.3;
      const hR = hbR * 0.42 * (1 + 0.08 * Math.sin(time * 2.2 + seed * 9));
      ctx.fillStyle = `rgba(${hc},0.32)`;
      ctx.beginPath(); ctx.arc(hx, hy, hR, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${hc},0.6)`;
      ctx.lineWidth = Math.max(1.5, R * 0.012);
      ctx.beginPath(); ctx.arc(hx, hy, hR, 0, TAU); ctx.stroke();
      for (let b = 0; b < 3; b++) {
        const ba = seed * 20 + b * 2.1 + time * 0.9;
        ctx.fillStyle = `rgba(${hc},0.5)`;
        ctx.beginPath();
        ctx.arc(hx + Math.cos(ba) * hR * 0.55, hy + Math.sin(ba) * hR * 0.55, Math.max(1, R * 0.02), 0, TAU);
        ctx.fill();
      }
    }
    if (n.cleared && !isActive) {
      ctx.strokeStyle = 'rgba(255,215,140,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q.x, q.y, Rb * 1.05, 0, TAU); ctx.stroke();
    }
    // beat room aktif
    if (isActive) {
      if (state === 'lockdown') {
        ctx.strokeStyle = 'rgba(255,70,60,0.8)';
        ctx.lineWidth = Math.max(2, R * 0.02);
        ctx.setLineDash([Rb * 0.12, Rb * 0.07]);
        ctx.lineDashOffset = -time * 46;
        ctx.beginPath(); ctx.arc(q.x, q.y, Rb * 1.04, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      } else if (state === 'swarm') {
        const fl = 0.5 + 0.5 * Math.sin(time * 9);
        for (const v of arena.vents || []) {
          const a = v.a || 0;
          ctx.fillStyle = `rgba(255,80,50,${0.35 + fl * 0.3})`;
          ctx.beginPath();
          ctx.moveTo(q.x + Math.cos(a - 0.16) * Rb * 0.8, q.y + Math.sin(a - 0.16) * Rb * 0.8);
          ctx.lineTo(q.x + Math.cos(a) * Rb * 1.12, q.y + Math.sin(a) * Rb * 1.12);
          ctx.lineTo(q.x + Math.cos(a + 0.16) * Rb * 0.8, q.y + Math.sin(a + 0.16) * Rb * 0.8);
          ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = `rgba(255,90,60,${0.55 + fl * 0.3})`;
        ctx.lineWidth = Math.max(2, R * 0.022);
        ctx.beginPath(); ctx.arc(q.x, q.y, Rb * 1.03, 0, TAU); ctx.stroke();
      } else if (state === 'purified') {
        ctx.strokeStyle = `rgba(255,222,150,${Math.max(0, 1 - shock) * 0.85})`;
        ctx.lineWidth = Math.max(2, 7 * (1 - shock) + 1);
        ctx.beginPath(); ctx.arc(q.x, q.y, Rb * (0.4 + shock * 1.5), 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(255,236,190,${Math.max(0, 1 - shock) * 0.3})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, Rb * 0.78, 0, TAU); ctx.fill();
      } else if (state === 'open') {
        const da = arena.doorAngle || 0;
        const dg = ctx.createRadialGradient(q.x, q.y, Rb * 0.7, q.x, q.y, Rb * 1.15);
        dg.addColorStop(0, 'rgba(255,224,180,0)');
        dg.addColorStop(1, `rgba(${pal.hot},${0.5 + beat * 0.25})`);
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.arc(q.x, q.y, Rb * 1.15, da - 0.34, da + 0.34);
        ctx.closePath(); ctx.fill();
      }
    }
    if (n.label && labelOk.has(n.id) && R > 26) {
      ctx.font = '600 12px system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const ly = q.y - Rb * 1.06 - 4;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,2,5,0.85)';
      ctx.strokeText(n.label, q.x, ly);
      ctx.fillStyle = isActive ? '#ffe6c8' : '#d8b8a8';
      ctx.fillText(n.label, q.x, ly);
    }
  }
  // portal START/GOAL di ujung route (slice 5, ganti suar goal)
  const ends = [
    { id: route[0], rgb: '80,230,200', k: 0.30, tag: 'START', big: false },
    { id: route[route.length - 1], rgb: '255,205,120', k: 0.40, tag: 'GOAL', big: true },
  ];
  for (const e of ends) {
    const n = e.id != null && arena.rooms.get(e.id);
    if (!n || !inBox(n.x, n.y, n.r + 200)) continue;
    const q = pr(n.x, n.y), R = n.r * q.s * e.k;
    if (R > 4) portal(ctx, q, R, time, e.rgb, e.big, e.tag);
  }
  // foreground depth: sulur tepi + mote (di atas room, di bawah vignette)
  foreTendrils(ctx, w, h, time);
  moteLayer(ctx, w, h, time, fpal.glow);
  // vignette state
  if (state === 'swarm') {
    const fl = 0.5 + 0.5 * Math.sin(time * 9);
    ctx.fillStyle = `rgba(190,26,18,${0.1 + fl * 0.06})`;
    ctx.fillRect(0, 0, w, h);
  } else if (state === 'lockdown') {
    ctx.fillStyle = 'rgba(120,10,20,0.10)'; ctx.fillRect(0, 0, w, h);
  } else if (state === 'purified') {
    ctx.fillStyle = `rgba(255,230,170,${Math.max(0, 1 - shock) * 0.1})`;
    ctx.fillRect(0, 0, w, h);
  } else if (state === 'open') {
    ctx.fillStyle = 'rgba(255,200,150,0.05)'; ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}
