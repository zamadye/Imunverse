/**
 * render2d.js — RENDERER 2D ARENA V2, ditulis dari nol.
 * Kosakata: rongga organ bernapas + motif dinding per-organ (0 cobble,
 * 1 silia, 2 striasi, 3 rugae, 4 mielin, 5 nodul) + kolam hazard + beat
 * lockdown/swarm/purified/open. Palet selalu dari data room (pal.*).
 */
import { heartbeat, cameraOf, worldViewBox } from '../render/background.js';
import { roomSeed } from './arena.js';

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

export function drawArena2D(ctx, P, arena, time) {
  const w = P.w, h = P.h;
  const pr = (x, y) => P.project(x, y);
  const cam = cameraOf(P);
  const box = worldViewBox(cam, w, h, 90, 0);
  const inBox = (x, y, m) => x > box.x0 - m && x < box.x1 + m && y > box.y0 - m && y < box.y1 + m;
  const beat = heartbeat(time, arena.bpm || 72);
  ctx.save();
  // ---- latar: near-black + bintik sel samar ----
  const bg = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h) * 0.75);
  bg.addColorStop(0, '#17060c'); bg.addColorStop(1, '#070204');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(150,60,80,0.16)';
  const cell = 64;
  const ox = ((cam.x % cell) + cell) % cell, oy = ((cam.y % cell) + cell) % cell;
  for (let yy = -cell; yy < h + cell; yy += cell) {
    for (let xx = -cell; xx < w + cell; xx += cell) {
      const hx = hash1(xx * 0.37 + cam.x) - 0.5, hy = hash1(yy * 0.53 + cam.y) - 0.5;
      ctx.beginPath();
      ctx.arc(xx - ox + hx * 22, yy - oy + hy * 22, 7 + hash1(xx + yy) * 9, 0, TAU);
      ctx.fill();
    }
  }
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
    ctx.fillStyle = `rgba(${pal.glow},${(0.09 + beat * 0.06) * dim})`;
    ctx.beginPath(); ctx.arc(q.x, q.y, Rb * 1.22, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${pal.deep},${0.94 * dim})`;
    ctx.beginPath(); ctx.arc(q.x, q.y, Rb, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${pal.fill},${0.6 * dim})`;
    ctx.beginPath(); ctx.arc(q.x, q.y, Rb * 0.985, 0, TAU); ctx.fill();
    if (!n.junction) motifRing(ctx, q, Rb, n.motif, pal, time, seed);
    else {
      ctx.strokeStyle = `rgba(${pal.glow},0.35)`;
      ctx.setLineDash([6, 7]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q.x, q.y, Rb * 0.9, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = `rgba(${pal.hot},${(0.5 + beat * 0.25) * dim})`;
    ctx.lineWidth = Math.max(1.5, R * 0.014);
    ctx.beginPath(); ctx.arc(q.x, q.y, Rb * 0.78, 0, TAU); ctx.stroke();
    const gIn = ctx.createRadialGradient(q.x, q.y, 1, q.x, q.y, Rb * 0.78);
    gIn.addColorStop(0, `rgba(${pal.hot},${0.55 * dim})`);
    gIn.addColorStop(0.45, `rgba(${pal.fill},${0.5 * dim})`);
    gIn.addColorStop(1, `rgba(${pal.deep},${0.95 * dim})`);
    ctx.fillStyle = gIn;
    ctx.beginPath(); ctx.arc(q.x, q.y, Rb * 0.78, 0, TAU); ctx.fill();
    // kolam hazard
    if (n.hazard && HAZ[n.hazard.type]) {
      const hc = HAZ[n.hazard.type];
      const ha = seed * TAU + 0.7;
      const hx = q.x + Math.cos(ha) * Rb * 0.3, hy = q.y + Math.sin(ha) * Rb * 0.3;
      const hR = Rb * 0.42 * (1 + 0.08 * Math.sin(time * 2.2 + seed * 9));
      ctx.fillStyle = `rgba(${hc},0.32)`;
      ctx.beginPath(); ctx.arc(hx, hy, hR, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${hc},0.6)`;
      ctx.lineWidth = Math.max(1.5, R * 0.012);
      ctx.beginPath(); ctx.arc(hx, hy, hR, 0, TAU); ctx.stroke();
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
  // suar goal
  const goal = rooms[rooms.length - 1];
  if (goal && inBox(goal.x, goal.y, goal.r + 200)) {
    const q = pr(goal.x, goal.y), R = goal.r * q.s;
    if (R > 4) {
      const pul = 0.5 + 0.5 * Math.sin(time * 2.5);
      const bg2 = ctx.createLinearGradient(q.x, q.y - R * 2.6, q.x, q.y);
      bg2.addColorStop(0, 'rgba(255,240,200,0)');
      bg2.addColorStop(1, `rgba(255,240,200,${0.25 + pul * 0.2})`);
      ctx.fillStyle = bg2;
      ctx.fillRect(q.x - R * 0.1, q.y - R * 2.6, R * 0.2, R * 2.6);
    }
  }
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
