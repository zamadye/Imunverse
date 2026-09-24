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
