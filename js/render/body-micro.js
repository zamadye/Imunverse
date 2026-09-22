/**
 * body-micro.js — RENDERER GAMEPLAY DUNIA KONTINU (migrasi chamber peta).
 *
 * Menggambar potongan peta tubuh di sekitar kamera pada zoom gameplay dengan
 * kosakata visual VIDEO REFERENSI (sama dengan organ-corridor & world-map):
 *   • daging latar crimson ber-vignette + jaringan sel berspekular,
 *   • pembuluh = tabung berlapis (bayangan marun → badan crimson → lumen
 *     amber → fringe scallop → sel kobalt di punggung),
 *   • chamber organ = rongga backlit berlobus + cincin coil + fringe scallop
 *     + kelenjar emas + rim bayangan dalam,
 *   • MULUT PERSIMPANGAN terbuka: fringe/sel dilewati di titik yang tertutup
 *     primitif lain (union lumen) — tidak ada pintu buntu,
 *   • kabut hangat + vignette sinematik.
 *
 * Semua geometri dari `world` (js/systems/body-world.js) — satu sumber
 * kebenaran dengan collision/reflection/spawn.
 */
import { heartbeat, cameraOf, worldViewBox } from './background.js';

const TAU = Math.PI * 2;
function hash1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

const MEAT = { cell: '122,40,66', cellLight: '214,120,152', cellDark: '46,8,20' };

function cellTissue(g, w, h, cam, pr) {
  const tile = 52;
  const a = pr(cam.x, cam.y), b = pr(cam.x + tile, cam.y), c = pr(cam.x, cam.y + tile);
  const sx = (b.x - a.x) / tile, sy = (c.y - a.y) / tile;
  if (!(sx > 0) || !(sy > 0)) return;
  const ox = a.x - cam.x * sx, oy = a.y - cam.y * sy;
  const pw = tile * sx, ph = tile * sy;
  const [cr, cg, cb] = MEAT.cell.split(',').map(Number);
  const [lr, lg, lb] = MEAT.cellLight.split(',').map(Number);
  const x0 = Math.floor((-ox) / pw) - 1, y0 = Math.floor((-oy) / ph) - 1;
  const nx = Math.ceil(w / pw) + 2, ny = Math.ceil(h / ph) + 2;
  for (let j = y0; j < y0 + ny; j++) {
    for (let i = x0; i < x0 + nx; i++) {
      const jx = (j % 2) ? 0.5 : 0;
      const hsh = hash1(i * 3.7 + j * 9.1), hsh2 = hash1(i * 1.3 - j * 5.9);
      const cx = ox + (i + jx) * pw + pw * 0.5 + (hsh2 - 0.5) * pw * 0.3;
      const cy = oy + j * ph + ph * 0.5 + (hsh - 0.5) * ph * 0.3;
      const t = 0.35 + hsh * 0.65;
      const mix = (u, v, k) => Math.round(u + (v - u) * k);
      const dr = mix(cr * 0.30, lr, t * 0.85), dg = mix(cg * 0.30, lg, t * 0.85), db = mix(cb * 0.30, lb, t * 0.85);
      const rx = pw * (0.62 + hsh2 * 0.2), ry = ph * (0.5 + hsh * 0.22);
      g.fillStyle = `rgb(${dr},${dg},${db})`;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, (hsh - 0.5) * 0.8, 0, TAU); g.fill();
      g.strokeStyle = `rgba(8,4,14,${0.30 + hsh * 0.14})`;
      g.lineWidth = Math.max(1, pw * 0.10);
      g.beginPath(); g.ellipse(cx, cy, rx, ry, (hsh - 0.5) * 0.8, 0, TAU); g.stroke();
      g.fillStyle = `rgba(${lr},${lg},${lb},${0.12 + hsh * 0.2})`;
      g.beginPath(); g.ellipse(cx, cy - ry * 0.32, rx * 0.62, ry * 0.34, (hsh - 0.5) * 0.8, 0, TAU); g.fill();
      if (hsh > 0.6) {
        g.fillStyle = `rgba(255,255,255,${0.08 + (hsh - 0.6) * 0.3})`;
        g.beginPath(); g.ellipse(cx - rx * 0.25, cy - ry * 0.42, rx * 0.15, ry * 0.11, 0, 0, TAU); g.fill();
      }
    }
  }
}

/** sampling halus poligon pembuluh (quadratic midpoint, seperti world-map). */
function vesselSamples(v, XY, stepPx = 26) {
  const raw = v.points.map(([nx, ny]) => XY(nx, ny));
  const out = [raw[0]];
  for (let i = 0; i + 1 < raw.length; i++) {
    const p = raw[i], q = raw[i + 1];
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n = Math.max(1, Math.round(d / stepPx));
    for (let k = 1; k <= n; k++) out.push([p[0] + (q[0] - p[0]) * (k / n), p[1] + (q[1] - p[1]) * (k / n)]);
  }
  return out;
}

export function drawBodyMicro(ctx, P, world, time) {
  if (!world) return;
  const def = world.def;
  const W = def.world.w, H = def.world.h;
  const XY = (nx, ny) => [nx * W, (1 - ny) * H];
  const w = P.w, h = P.h;
  const cam = cameraOf(P);
  const vb = worldViewBox(cam, w, h, 120, 160);
  const pr = (x, y) => P.project(x, y);
  const s0 = pr(cam.x, cam.y).s;
  const beat = heartbeat(time, 68);

  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // ---------- 1. DAGING LATAR + JARINGAN SEL ----------
  const bg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.8);
  bg.addColorStop(0, 'rgb(122,26,44)');
  bg.addColorStop(0.55, 'rgb(88,18,34)');
  bg.addColorStop(1, 'rgb(46,8,20)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  cellTissue(ctx, w, h, cam, pr);

  const inView = (x, y, pad) => x > vb.x0 - pad && x < vb.x1 + pad && y > vb.y0 - pad && y < vb.y1 + pad;

  // ---------- 2. PEMBUULUH: tabung berlapis gaya video ----------
  for (const v of def.vessels) {
    const pts = vesselSamples(v, XY).filter(([x, y]) => inView(x, y, 200));
    if (pts.length < 2) continue;
    const sp = pts.map(([x, y]) => pr(x, y));
    const rw = v.r * s0;
    const stroke = (wid, style, alpha = 1) => {
      ctx.globalAlpha = alpha; ctx.strokeStyle = style; ctx.lineWidth = Math.max(1, wid);
      ctx.beginPath();
      for (let i = 0; i < sp.length; i++) (i ? ctx.lineTo(sp[i].x, sp[i].y) : ctx.moveTo(sp[i].x, sp[i].y));
      ctx.stroke(); ctx.globalAlpha = 1;
    };
    stroke(rw * 2.7, 'rgba(28,6,14,0.62)');          // bayangan marun punggung
    stroke(rw * 2.1, v.kind === 'route' ? 'rgba(64,150,150,0.85)' : 'rgba(176,40,56,0.95)');
    stroke(rw * 1.5, 'rgba(255,186,110,0.92)');      // lumen amber backlit
    stroke(rw * 0.55, `rgba(255,236,190,${0.5 + beat * 0.2})`);
    // fringe scallop kedua tepi + sel kobalt di punggung; MULUT ke chamber terbuka
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = pts[i];
      const [x2, y2] = pts[Math.min(pts.length - 1, i + 1)];
      const dx = x2 - x, dy = y2 - y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      for (const sgn of [1, -1]) {
        const fx = x + nx * sgn * v.r, fy = y + ny * sgn * v.r;
        if (world.sdf(fx, fy) < -v.r * 0.55) continue; // di dalam chamber = mulut, lewat
        const q = pr(fx, fy);
        const rr = v.r * 0.34 * q.s * (0.8 + hash1(i * 1.7 + sgn) * 0.5);
        ctx.fillStyle = 'rgba(206,44,48,0.95)';
        ctx.beginPath(); ctx.arc(q.x, q.y, rr, 0, TAU); ctx.fill();
        if (i % 4 === 0) {
          const bx = x + nx * sgn * v.r * 1.55, by = y + ny * sgn * v.r * 1.55;
          const qb = pr(bx, by);
          ctx.fillStyle = 'rgba(64,96,168,0.85)';
          ctx.beginPath(); ctx.arc(qb.x, qb.y, rr * 1.15, 0, TAU); ctx.fill();
        }
      }
    }
  }

  // ---------- 3. CHAMBER ORGAN: rongga backlit berlobus ----------
  for (const o of def.organs) {
    const [cx, cy] = XY(o.x, o.y);
    const rx = o.rx * W, ry = o.ry * H;
    if (!inView(cx, cy, Math.max(rx, ry) + 200)) continue;
    const pal = o.palette || { fill: '214,110,90', rim: '255,170,150', deep: '140,50,44' };
    const lob = (scale, wob, phase) => {
      ctx.beginPath();
      for (let a = 0; a <= TAU + 0.001; a += TAU / 30) {
        const k = 1 + Math.sin(a * 5 + phase) * wob + Math.sin(a * 9 - phase) * wob * 0.5;
        const x = cx + Math.cos(a) * rx * scale * k;
        const y = cy + Math.sin(a) * ry * scale * k;
        const q = pr(x, y);
        if (a === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.closePath();
    };
    // rim bayangan luar (dinding tebal)
    ctx.fillStyle = 'rgba(28,6,14,0.55)'; lob(1.22, 0.07, 1.3); ctx.fill();
    // fringe scallop SEBELUM rongga supaya menonjol keluar; mulut pembuluh terbuka
    const nF = 34;
    for (let k = 0; k < nF; k++) {
      const a = (k / nF) * TAU;
      const fx = cx + Math.cos(a) * rx * 1.06, fy = cy + Math.sin(a) * ry * 1.06;
      if (world.sdf(fx, fy) < -o.rx * W * 0.12) continue; // mulut pembuluh → lubang
      const q = pr(fx, fy);
      const rr = rx * 0.10 * q.s * (0.8 + hash1(k * 2.3 + o.x * 9) * 0.5);
      ctx.fillStyle = `rgba(${pal.deep},0.95)`;
      ctx.beginPath(); ctx.arc(q.x, q.y, rr * 1.15, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(${pal.rim},0.9)`;
      ctx.beginPath(); ctx.arc(q.x - rr * 0.2, q.y - rr * 0.25, rr * 0.8, 0, TAU); ctx.fill();
    }
    // rongga backlit
    const c0 = pr(cx, cy);
    const g = ctx.createRadialGradient(c0.x, c0.y - ry * 0.4 * s0, Math.max(4, rx * 0.15 * s0), c0.x, c0.y, Math.max(rx, ry) * 1.15 * s0);
    g.addColorStop(0, `rgba(255,232,168,${0.92 + beat * 0.05})`);
    g.addColorStop(0.45, `rgba(${pal.fill},0.9)`);
    g.addColorStop(1, `rgba(${pal.deep},0.95)`);
    ctx.fillStyle = g; lob(1.0, 0.06, 0.7); ctx.fill();
    // sunburst lembut dari puncak rongga
    ctx.save(); lob(1.0, 0.06, 0.7); ctx.clip();
    const top = pr(cx, cy - ry);
    for (let r = 0; r < 10; r++) {
      const a0 = (r / 10) * Math.PI * 2, a1 = a0 + Math.PI / 10;
      ctx.fillStyle = `rgba(255,236,190,${(r % 2) ? 0.14 : 0.03})`;
      ctx.beginPath(); ctx.moveTo(top.x, top.y);
      ctx.arc(top.x, top.y, Math.max(rx, ry) * 2.2 * s0, a0, a1); ctx.closePath(); ctx.fill();
    }
    // coil dalam (gelungan organ) + kabut hangat
    ctx.strokeStyle = `rgba(${pal.deep},0.5)`;
    ctx.lineWidth = Math.max(1.5, 5 * s0);
    for (let ring = 1; ring <= 2; ring++) { lob(1 - ring * 0.28, 0.10, ring * 2.1); ctx.stroke(); }
    for (let bi = 0; bi < 3; bi++) {
      const hh = hash1(bi * 5.1 + o.y * 7);
      const bx = cx + (hh - 0.5) * rx, by = cy + (hash1(bi * 3.3) - 0.5) * ry;
      const q = pr(bx, by);
      const hg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rx * 0.5 * q.s);
      hg.addColorStop(0, 'rgba(255,150,60,0.16)'); hg.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(q.x, q.y, rx * 0.5 * q.s, 0, TAU); ctx.fill();
    }
    // kelenjar emas tertanam
    for (let k = 0; k < 4; k++) {
      const hh = hash1(k * 7.7 + o.x * 13);
      const a = hh * TAU;
      const q = pr(cx + Math.cos(a) * rx * 0.8, cy + Math.sin(a) * ry * 0.8);
      const sz = 10 * q.s * (0.7 + hh * 0.7);
      const gg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, sz * 2.2);
      gg.addColorStop(0, `rgba(255,238,158,${0.8 + beat * 0.1})`);
      gg.addColorStop(0.4, 'rgba(255,206,84,0.55)');
      gg.addColorStop(1, 'rgba(255,206,84,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(q.x, q.y, sz * 2.2, 0, TAU); ctx.fill();
    }
    // rim bayangan dalam rongga
    ctx.strokeStyle = 'rgba(38,10,8,0.30)';
    ctx.lineWidth = Math.max(8, rx * 0.16 * s0);
    lob(1.0, 0.06, 0.7); ctx.stroke();
    ctx.restore();
  }

  // ---------- 4. VIGNETTE SINEMATIK ----------
  const vgn = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.74);
  vgn.addColorStop(0, 'rgba(16,4,10,0)');
  vgn.addColorStop(1, 'rgba(16,4,10,0.42)');
  ctx.fillStyle = vgn; ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

/**
 * FALLBACK Canvas 2D untuk ARENA tertutup (bila WebGL2 tiada): cincin membran
 * terdeformasi + interior backlit + tissue sederhana. Bahasa visual sama dgn
 * body-gl.js versi shader, tanpa efek per-piksel lanjutan.
 */
export function drawChamberCanvas(ctx, P, chamber, time) {
  if (!chamber) return;
  const w = P.w, h = P.h;
  const pr = (x, y) => P.project(x, y);
  const beat = heartbeat(time, chamber.bpm || 72);
  ctx.save();
  // tissue latar
  const bg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.8);
  bg.addColorStop(0, 'rgb(96,20,38)'); bg.addColorStop(1, 'rgb(40,8,18)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // interior backlit
  const c0 = pr(chamber.cx, chamber.cy);
  const N = 48;
  const path = (scale = 1) => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const k = i % N;
      const a = (k / N) * Math.PI * 2;
      const r = chamber.points[k].r * scale;
      const q = pr(chamber.cx + Math.cos(a) * r, chamber.cy + Math.sin(a) * r);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.closePath();
  };
  const g = ctx.createRadialGradient(c0.x, c0.y, 10, c0.x, c0.y, chamber.R * 1.15 * c0.s);
  g.addColorStop(0, `rgba(255,232,168,${0.9 + beat * 0.05})`);
  g.addColorStop(0.55, 'rgba(255,176,96,0.9)');
  g.addColorStop(1, 'rgba(186,84,52,0.95)');
  ctx.fillStyle = g; path(1); ctx.fill();
  // PILAR internal: massa gelap ber-rim (ruang non-konveks)
  for (const pi of chamber.pillars || []) {
    const q = pr(pi.x, pi.y);
    const g2 = ctx.createRadialGradient(q.x, q.y, 1, q.x, q.y, pi.r * q.s * 1.25);
    g2.addColorStop(0, 'rgba(24,7,14,0.95)');
    g2.addColorStop(0.8, 'rgba(48,12,22,0.95)');
    g2.addColorStop(1, 'rgba(255,110,95,0.30)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(q.x, q.y, pi.r * q.s * 1.15, 0, TAU); ctx.fill();
  }
  // pita membran glossy + bayangan punggung
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(28,6,14,0.65)'; ctx.lineWidth = Math.max(6, 34 * c0.s); path(1.04); ctx.stroke();
  ctx.strokeStyle = 'rgba(196,30,44,0.95)'; ctx.lineWidth = Math.max(4, 18 * c0.s); path(1); ctx.stroke();
  ctx.strokeStyle = `rgba(255,150,140,${0.4 + beat * 0.15})`; ctx.lineWidth = Math.max(1.5, 4 * c0.s); path(0.97); ctx.stroke();
  // pintu terbuka
  if (chamber.openAmt > 0.05) {
    const a = chamber.doorAngle;
    const r = chamber.radiusAt(a);
    const q = pr(chamber.cx + Math.cos(a) * r, chamber.cy + Math.sin(a) * r);
    const gg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 90 * q.s);
    gg.addColorStop(0, `rgba(80,230,210,${0.75 * chamber.openAmt})`);
    gg.addColorStop(1, 'rgba(80,230,210,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(q.x, q.y, 90 * q.s, 0, TAU); ctx.fill();
  }
  // vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.74);
  vg.addColorStop(0, 'rgba(16,4,10,0)'); vg.addColorStop(1, 'rgba(16,4,10,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
