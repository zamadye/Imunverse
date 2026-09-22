/**
 * world-map.js — LAPISAN SNAP MACRO: peta tubuh SELURUH organ, prosedural
 * tanpa aset, meniru bahasa visual ARENA_ZOOM_OUT_REFERENCE_.png:
 *   • daging merah dalam sebagai latar + vignette
 *   • chamber organ BERLOBUS dengan palet per organ + rim scallop + koil dalam
 *     (usus bergelung, paru bercabang, dll.) + pelat label seperti referensi
 *   • pembuluh berkelok: arteri merah / vena biru / limfe hijau + arus dash
 *   • rute teal START→GOAL menyala dengan aliran
 *   • denyut 60–75 BPM lembut pada chamber
 * Digambar SAAT macro aktif (intro run / tahan M); gameplay micro tetap
 * koridor organ (organ-corridor.js). Sumber data: data/body-map.json.
 */
import { heartbeat } from './background.js';

const TAU = Math.PI * 2;
function hash1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

const VESSEL_COL = {
  artery: { body: '196,52,72', edge: '120,24,40', flow: '255,190,180' },
  vein: { body: '70,104,196', edge: '34,52,120', flow: '180,210,255' },
  lymph: { body: '96,196,150', edge: '40,110,80', flow: '210,255,230' },
  route: { body: '52,196,214', edge: '20,110,130', flow: '220,255,255' },
};

/** Konversi koordinat ternormalisasi (0..1) ke dunia (y flip: referensi atas=GOAL). */
function makeXY(def) {
  const W = def.world.w, H = def.world.h;
  return (nx, ny) => ({ x: nx * W, y: (1 - ny) * H });
}

function chamberPath(ctx, o, xy, beat, pr) {
  const c = pr(...Object.values(xy(o.x, o.y)));
  const N = 30;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const lob = 1 + Math.sin(a * (2 + o.coil) + o.x * 9) * 0.09 + Math.sin(a * (5 + o.coil) - o.y * 7) * 0.045;
    const rx = o.rx * 2600 * lob * (1 + beat * 0.02), ry = o.ry * 3600 * lob * (1 + beat * 0.02);
    const q = pr(xy(o.x, o.y).x + Math.cos(a) * rx, xy(o.x, o.y).y + Math.sin(a) * ry);
    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
  }
  ctx.closePath();
  void c;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} P proyektor kamera
 * @param {object} def isi data/body-map.json
 * @param {number} time detik
 */
export function drawWorldMap(ctx, P, def, time, states = null, extra = null) {
  if (!def) return;
  const xy = makeXY(def);
  const pr = (x, y) => P.project(x, y);
  const w = P.w, h = P.h;
  const beat = heartbeat(time, 68);
  const s0 = pr(0, 0).s;

  // ---------- 1. DAGING LATAR ----------
  const bg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.8);
  bg.addColorStop(0, 'rgb(146,32,52)');
  bg.addColorStop(0.55, 'rgb(110,22,40)');
  bg.addColorStop(1, 'rgb(58,10,24)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // lipatan daging samar (blob gelap besar)
  for (let k = 0; k < 10; k++) {
    const hx = hash1(k * 3.7), hy = hash1(k * 9.1 + 4);
    const q = pr(hx * def.world.w, hy * def.world.h);
    const r = (240 + hash1(k) * 320) * s0;
    ctx.fillStyle = 'rgba(70,12,28,0.35)';
    ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.7, hx * 3, 0, TAU); ctx.fill();
  }

  // ---------- 2. PEMBUULUH BERKELOK ----------
  for (const v of def.vessels) {
    const col = VESSEL_COL[v.kind] || VESSEL_COL.vein;
    const pts = v.points.map(([nx, ny]) => { const p = xy(nx, ny); return pr(p.x, p.y); });
    if (pts.length < 2) continue;
    const tube = (widthPx, style, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = style; ctx.lineWidth = Math.max(1, widthPx);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      // kelokan halus lewat quadratic midpoint
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    const rw = v.r * s0;
    tube(rw * 2.5, `rgb(${col.edge})`, 0.9);
    tube(rw * 1.9, `rgb(${col.body})`, 0.95);
    tube(rw * 1.1, `rgba(255,255,255,0.14)`, 1);
    // arus chảy dash
    ctx.setLineDash([14 * s0, 26 * s0]);
    ctx.lineDashOffset = -time * (v.kind === 'route' ? 90 : 60) * s0;
    tube(rw * 0.5, `rgba(${col.flow},0.8)`, 0.85);
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }

  // ---------- 3. CHAMBER ORGAN BERLOBUS ----------
  for (const o of def.organs) {
    const pal = o.palette;
    // bayangan dalam
    ctx.save();
    chamberPath(ctx, o, xy, beat, pr);
    ctx.translate(3 * s0, 5 * s0);
    ctx.fillStyle = `rgba(${pal.deep},0.75)`;
    ctx.fill();
    ctx.restore();
    // badan chamber
    chamberPath(ctx, o, xy, beat, pr);
    const c0 = xy(o.x, o.y); const pc = pr(c0.x, c0.y);
    const g = ctx.createRadialGradient(pc.x, pc.y, 4, pc.x, pc.y, o.rx * 2600 * s0 * 1.5);
    g.addColorStop(0, `rgb(${pal.rim})`);
    g.addColorStop(0.45, `rgb(${pal.fill})`);
    g.addColorStop(1, `rgb(${pal.deep})`);
    ctx.fillStyle = g;
    ctx.fill();
    // koil/tekstur dalam (usus bergelung, paru bercabang)
    ctx.strokeStyle = `rgba(${pal.deep},0.55)`;
    ctx.lineWidth = Math.max(1, 7 * s0);
    const turns = 2 + o.coil;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const a = t * TAU * turns;
      const rr = (0.25 + 0.6 * t);
      const q = pr(c0.x + Math.cos(a) * o.rx * 2600 * rr * 0.8, c0.y + Math.sin(a) * o.ry * 3600 * rr * 0.8);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    // rim scallop (pinggiran berombak terang)
    const N = 30;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const lob = 1 + Math.sin(a * (2 + o.coil) + o.x * 9) * 0.09 + Math.sin(a * (5 + o.coil) - o.y * 7) * 0.045;
      const q = pr(c0.x + Math.cos(a) * o.rx * 2600 * lob, c0.y + Math.sin(a) * o.ry * 3600 * lob);
      ctx.fillStyle = `rgba(${pal.rim},${0.5 + beat * 0.15})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.2, 9 * s0), 0, TAU); ctx.fill();
    }
    // pelat label (gaya referensi)
    const fs = Math.max(7, 13 * s0);
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    const tw = ctx.measureText(o.label).width;
    const lx = pc.x - tw / 2 - fs * 0.6, ly = pc.y - fs * 0.9;
    ctx.fillStyle = 'rgba(20,10,16,0.72)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(lx, ly, tw + fs * 1.2, fs * 1.8, fs * 0.5); else ctx.rect(lx, ly, tw + fs * 1.2, fs * 1.8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,244,0.95)';
    ctx.fillText(o.label, lx + fs * 0.6, ly + fs * 1.3);
    // ---- PENANDA STATUS ARENA (spec owner): MAP = denah navigasi ----
    // cleared = hijau ✓ | active = cincin teal berdenyut | locked = gembok redup
    const st = states ? states[o.id] : null;
    if (st === 'locked') {
      chamberPath(ctx, o, xy, beat, pr);
      ctx.fillStyle = 'rgba(16,4,10,0.5)';
      ctx.fill();
      const bx = pc.x + o.rx * 2600 * s0 * 0.62, by = pc.y - o.ry * 3600 * s0 * 0.62;
      const br = Math.max(8, 20 * s0);
      ctx.strokeStyle = 'rgba(255,120,110,0.75)'; ctx.lineWidth = Math.max(1, 2.4 * s0);
      ctx.beginPath(); ctx.arc(bx, by - br * 0.35, br * 0.5, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = 'rgba(255,90,80,0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx - br * 0.72, by - br * 0.35, br * 1.44, br * 1.15, br * 0.3);
      else ctx.rect(bx - br * 0.72, by - br * 0.35, br * 1.44, br * 1.15);
      ctx.fill();
    } else if (st === 'cleared') {
      const bx = pc.x + o.rx * 2600 * s0 * 0.62, by = pc.y - o.ry * 3600 * s0 * 0.62;
      const br = Math.max(8, 20 * s0);
      ctx.fillStyle = 'rgba(90,235,170,0.9)';
      ctx.beginPath(); ctx.arc(bx, by, br * 0.8, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(12,40,28,0.95)'; ctx.lineWidth = Math.max(1.2, br * 0.28);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bx - br * 0.36, by + br * 0.02);
      ctx.lineTo(bx - br * 0.08, by + br * 0.32);
      ctx.lineTo(bx + br * 0.4, by - br * 0.28);
      ctx.stroke();
    } else if (st === 'active') {
      const pr2 = 0.5 + 0.5 * Math.sin(time * 4.5);
      ctx.strokeStyle = `rgba(90,240,220,${0.55 + 0.4 * pr2})`;
      ctx.lineWidth = Math.max(1.5, (3 + 2 * pr2) * s0);
      chamberPath(ctx, o, xy, beat, pr);
      ctx.stroke();
      const fs2 = Math.max(10, 15 * s0);
      ctx.font = `800 ${fs2}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(140,255,235,${0.8 + 0.2 * pr2})`;
      ctx.fillText('ARENA AKTIF — KATUP TERKUNCI', pc.x, pc.y + o.ry * 3600 * s0 + fs2 * 1.7);
      ctx.textAlign = 'left';
    }
  }

  // ---------- 4. BADGE START / GOAL ----------
  for (const key of ['start', 'goal']) {
    const a = def.anchors[key];
    if (!a) continue;
    const p0 = xy(a.x, a.y); const q = pr(p0.x, p0.y);
    const r = Math.max(6, 26 * s0);
    const col = key === 'start' ? '64,170,230' : '240,190,60';
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 2.2);
    g.addColorStop(0, `rgba(${col},0.95)`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(q.x, q.y, r * 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgb(${col})`;
    ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(16,10,14,0.9)';
    ctx.font = `800 ${Math.max(6, 11 * s0)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(a.label, q.x, q.y + r * 0.35);
    ctx.textAlign = 'left';
  }

  // ---- 5. GRAF RUANG ala minimap Pathogenic: node blob per zona + connector ----
  if (extra && extra.route && extra.journey) {
    const jn = extra.journey;
    const xy2 = makeXY(def);
    const posOf = [];
    const stateOf = [];
    if (extra.lab && extra.lab.routeIds) {
      // LABIRIN: node route fisik = sumber kebenaran denah
      for (const id of extra.lab.routeIds) {
        const org = (def.organs || []).find((o) => o.id === id);
        if (!org) continue;
        posOf.push(xy2(org.x, org.y));
        stateOf.push((extra.lab.states || {})[id] || 'locked');
      }
    } else {
      const seen = {};
      for (let i = 0; i < extra.route.length; i++) {
        const z = extra.route[i];
        const org = (def.organs || []).find((o) => o.id === z.arenaId);
        const bx = org ? org.x : 0.5, by = org ? org.y : 0.5;
        const k = seen[z.arenaId] = (seen[z.arenaId] || 0) + 1;
        const tot = extra.route.filter((r) => r.arenaId === z.arenaId).length;
        const off = (k - (tot + 1) / 2) * 0.055;
        posOf.push(xy2(bx + off, by - off * 0.6));
        stateOf.push(i < jn.index ? 'cleared' : i === jn.index ? 'active' : 'locked');
      }
    }
    // connector tipis berarus
    ctx.save();
    ctx.strokeStyle = 'rgba(120,240,230,0.5)';
    ctx.lineWidth = Math.max(1.5, 26 * s0);
    ctx.setLineDash([60 * s0, 90 * s0]);
    ctx.lineDashOffset = -time * 70 * s0;
    ctx.beginPath();
    for (let i = 0; i < posOf.length; i++) {
      const q = pr(posOf[i].x, posOf[i].y);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // node blob asimetris per zona
    for (let i = 0; i < posOf.length; i++) {
      const q = pr(posOf[i].x, posOf[i].y);
      const st = stateOf[i];
      const rn = Math.max(5, (st === 'active' ? 300 : 230) * s0);
      ctx.beginPath();
      for (let k2 = 0; k2 <= 22; k2++) {
        const a2 = (k2 / 22) * TAU;
        const lb = 1 + Math.sin(a2 * 3 + i * 1.7) * 0.22 + Math.sin(a2 * 5 - i) * 0.10;
        const px2 = q.x + Math.cos(a2) * rn * lb, py2 = q.y + Math.sin(a2) * rn * lb * 0.82;
        if (k2 === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.closePath();
      if (st === 'cleared') { ctx.fillStyle = 'rgba(90,235,170,0.85)'; ctx.fill(); }
      else if (st === 'active') {
        ctx.fillStyle = 'rgba(40,180,170,0.9)'; ctx.fill();
        ctx.strokeStyle = `rgba(160,255,240,${0.6 + 0.4 * Math.sin(time * 5)})`;
        ctx.lineWidth = Math.max(1.5, 40 * s0); ctx.stroke();
      } else { ctx.fillStyle = 'rgba(70,16,28,0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,110,100,0.5)'; ctx.lineWidth = Math.max(1, 20 * s0); ctx.stroke(); }
    }
    ctx.restore();
  }

  // vignette makro
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(20,4,10,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

/** Bounding box dunia peta (untuk auto-fit kamera macro). */
export function worldMapBounds(def) {
  if (!def) return null;
  return { w: def.world.w, h: def.world.h, cx: def.world.w / 2, cy: def.world.h / 2 };
}
