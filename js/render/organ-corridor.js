/**
 * organ-corridor.js — perender dinding organ gaya VIDEO REFERENSI
 * (`Character_and_arena_reference.mp4`, analisis: docs/VIDEO-REFERENCE-ANALYSIS.md).
 *
 * Bahasa visual yang ditiru dari video (bukan pixel-art pilot lama):
 *   • INTERIOR BACKLIT  — ruang bermain TERANG amber menyala dari belakang/atas;
 *                         ini kebalikan dari model "lantai gelap" pilot px.
 *   • PITA MEMBRAN      — garis collision = pita cokelat-tan licin melengkung.
 *   • SCUTE MERAH       — deret pelat/pill crimson menancap di tepi dalam pita.
 *   • JARINGAN SEL SISIK— pita luar tebal bertekstur sel heksagonal, berkode
 *                         warna per organ (teal / crimson / violet).
 *   • KELENJAR EMAS     — titik emas menyala tertanam di sepanjang dinding.
 *   • FRILL             — cluster duri merah sesekali.
 *   • CHORDAE           — filamen pucat bercabang melintang di ruang terbuka
 *                         (parallax lunak, TIDAK solid).
 *
 * Digambar SETELAH latar dan SEBELUM entitas, memakai proyektor kamera yang sama
 * (P.project). Semua geometri diturunkan dari `run.arenaShape` (arena-shape.js)
 * sehingga dinding visual = dinding collision, satu sumber kebenaran.
 * Tidak ada state, tidak ada aset PNG — murni prosedural dari `shape.wall`.
 */
import { PERSP } from './camera.js';
import { heartbeat, cameraOf, worldViewBox } from './background.js';
import { wallPolyline } from '../systems/arena-shape.js';

const TAU = Math.PI * 2;

/** Default vocabulary dinding (organ apa pun bisa menimpa per-field di data). */
const W_DEF = {
  interior: { glow: '255,186,104', glowHot: '255,232,168', edge: '214,116,58', mottle: '196,120,84' },
  ribbon: { color: '152,98,64', dark: '92,54,34', width: 24, under: '196,72,132' },
  sunburst: { rays: 12, alpha: 0.22, spin: 0.02 },
  scutes: { color: '206,44,48', light: '242,104,88', dark: '122,18,26', size: 24, every: 44 },
  tissue: { cell: '52,116,166', cellDark: '24,58,98', cellLight: '122,196,226', band: 120, scale: 46 },
  glands: { color: '255,206,84', glow: '255,238,158', every: 430, size: 16 },
  frills: { color: '198,36,44', every: 300, len: 24 },
  chords: { color: '234,208,170', every: 380, alpha: 0.3, width: 3 },
  vessel: '64,88,190', vesselArt: '232,74,84', flow: '255,200,180',
  vesselCount: 2, bpm: 72,
};

function hash1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function deep(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    out[k] = (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]))
      ? deep(base[k] && typeof base[k] === 'object' ? base[k] : {}, over[k])
      : over[k];
  }
  return out;
}

/**
 * ZONA WARNA ORGAN (mandat owner: "sekreatif mungkin warna & bentuk tiap organ").
 * `shape.def.wall.zones` = [{t0,t1, interior:{...}, tissue:{...}, scutes:{...}, ...}]
 * dengan t = 0 di dasar organ s/d 1 di puncak. Zona menimpa vocabulary default
 * sebagian saja (deep-merge), sehingga satu arena bisa berganti karakter warna
 * sepanjang tubuhnya (mis. jantung: bilik crimson -> katup emas -> serambi ungu).
 */
function zoneAt(cfg, t) {
  const zs = cfg.zones;
  if (!zs || !zs.length) return cfg;
  for (const z of zs) {
    if (t >= (z.t0 ?? 0) && t < (z.t1 ?? 1)) {
      const { t0, t1, ...over } = z; void t0; void t1;
      return deep(cfg, over);
    }
  }
  return cfg;
}
function tOf(shape, y) {
  if (!shape || !shape.height) return 0.5;
  return Math.max(0, Math.min(1, (shape.bottomY - y) / shape.height));
}

/**
 * OPEN-WORLD: apakah titik dinding (x,y) milik lajur L sebenarnya adalah PINTU
 * ke lajur lain? Bila ya, dinding TIDAK digambar di situ sehingga persimpangan
 * terbaca (dan terasa) sebagai bukaan yang bisa dilewati, bukan buntu.
 */
function isJunctionOpening(shape, L, x, y) {
  if (!shape || !shape.lanes) return false;
  for (const O of shape.lanes) {
    if (O === L) continue;
    if (y <= O.topY + 8 || y >= O.bottomY - 8) continue;
    if (Math.abs(x - O.centerAt(y)) <= O.halfAt(y) - 10) return true;
  }
  return false;
}

let _off = null;
function offscreen(w, h) {
  if (typeof document === 'undefined') return null;
  if (!_off) _off = document.createElement('canvas');
  if (_off.width !== w || _off.height !== h) { _off.width = w; _off.height = h; }
  return _off;
}

/**
 * Tekstur JARINGAN SEL SISIK di ruang layar (tile dunia lewat proyeksi afinitas).
 * Sel digambar sebagai blob membulat bertumpuk dengan jitter warna deterministik
 * supaya terbaca seperti sisik/heksagonal organik, bukan pola kotak.
 */
function drawScaleTissue(g, w, h, cfg, cam, pr, shape) {
  const tile = cfg.tissue.scale || 46;
  const a = pr(cam.x, cam.y), b = pr(cam.x + tile, cam.y), c = pr(cam.x, cam.y + tile);
  const sx = (b.x - a.x) / tile, sy = (c.y - a.y) / tile;
  if (!(sx > 0) || !(sy > 0)) return;
  const ox = a.x - cam.x * sx, oy = a.y - cam.y * sy;
  const pw = tile * sx, ph = tile * sy;
  const [lr0, lg0, lb0] = cfg.tissue.cellLight.split(',').map(Number);
  const x0 = Math.floor((-ox) / pw) - 1, y0 = Math.floor((-oy) / ph) - 1;
  const nx = Math.ceil(w / pw) + 2, ny = Math.ceil(h / ph) + 2;
  for (let j = y0; j < y0 + ny; j++) {
    for (let i = x0; i < x0 + nx; i++) {
      // offset baris genap/ganjil supaya menyerupai susunan sisik
      const jx = (j % 2) ? 0.5 : 0;
      const hsh = hash1(i * 3.7 + j * 9.1);
      const hsh2 = hash1(i * 1.3 - j * 5.9);
      const cx = ox + (i + jx) * pw + pw * 0.5 + (hsh2 - 0.5) * pw * 0.3;
      const cy = oy + j * ph + ph * 0.5 + (hsh - 0.5) * ph * 0.3;
      // warna sel mengikuti ZONA organ pada tinggi dunia baris sel ini
      const worldY = cam.y + (cy - a.y) / sy;
      const zc = zoneAt(cfg, tOf(shape, worldY));
      const [cr, cg, cb] = zc.tissue.cell.split(',').map(Number);
      const [lr, lg, lb] = (zc.tissue.cellLight || cfg.tissue.cellLight).split(',').map(Number);
      const t = 0.35 + hsh * 0.65; // campur cellDark..cellLight
      const mix = (u, v, k) => Math.round(u + (v - u) * k);
      const dr = mix(cr * 0.30, lr, t * 0.85), dg = mix(cg * 0.30, lg, t * 0.85), db = mix(cb * 0.30, lb, t * 0.85);
      const rx = pw * (0.62 + hsh2 * 0.2), ry = ph * (0.5 + hsh * 0.22);
      g.fillStyle = `rgb(${dr},${dg},${db})`;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, (hsh - 0.5) * 0.8, 0, TAU); g.fill();
      // kilau tipis di sisi atas sel (cahaya datang dari dalam rongga)
      g.fillStyle = `rgba(${lr},${lg},${lb},${0.14 + hsh * 0.2})`;
      g.beginPath(); g.ellipse(cx, cy - ry * 0.32, rx * 0.62, ry * 0.34, (hsh - 0.5) * 0.8, 0, TAU); g.fill();
      void lr0; void lg0; void lb0;
    }
  }
}

/**
 * INTERIOR BACKLIT: gradasi amber menyala mengisi rongga lajur. Terang di
 * tengah/atas, menghangat & menggelap mendekati dinding — persis video.
 */
function drawBacklitInterior(ctx, cfg, lanes, beat, tAtY, timeRef) {
  const it = cfg.interior;
  for (const e of lanes) {
    const q = e.Lp[Math.floor(e.Lp.length / 2)], r = e.Rp[Math.floor(e.Rp.length / 2)];
    const cx = (q.x + r.x) / 2, halfW = Math.max(1, Math.abs(r.x - q.x) / 2);
    // gradasi lateral: tepi hangat-gelap, tengah menyala
    const gr = ctx.createLinearGradient(q.x, 0, r.x, 0);
    gr.addColorStop(0, `rgba(${it.edge},0.92)`);
    gr.addColorStop(0.22, `rgba(${it.glow},0.86)`);
    gr.addColorStop(0.5, `rgba(${it.glowHot},${0.9 + beat * 0.06})`);
    gr.addColorStop(0.78, `rgba(${it.glow},0.86)`);
    gr.addColorStop(1, `rgba(${it.edge},0.92)`);
    ctx.fillStyle = gr;
    ctx.beginPath();
    for (let i = 0; i < e.Lp.length; i++) ctx.lineTo(e.Lp[i].x, e.Lp[i].y);
    for (let i = e.Rp.length - 1; i >= 0; i--) ctx.lineTo(e.Rp[i].x, e.Rp[i].y);
    ctx.closePath(); ctx.fill();
    // kabut cahaya vertikal (sumber cahaya dari atas/behind)
    const top = e.Lp[0].y, bot = e.Lp[e.Lp.length - 1].y;
    const vg = ctx.createLinearGradient(0, top, 0, bot);
    vg.addColorStop(0, `rgba(${it.glowHot},0.5)`);
    vg.addColorStop(0.45, `rgba(${it.glowHot},0.06)`);
    vg.addColorStop(1, `rgba(${it.mottle},0.34)`);
    ctx.fillStyle = vg;
    ctx.beginPath();
    for (let i = 0; i < e.Lp.length; i++) ctx.lineTo(e.Lp[i].x, e.Lp[i].y);
    for (let i = e.Rp.length - 1; i >= 0; i--) ctx.lineTo(e.Rp[i].x, e.Rp[i].y);
    ctx.closePath(); ctx.fill();
    // ZONA ORGAN: pita warna vertikal (t layar -> t organ) supaya satu arena
    // bisa berganti karakter warna sepanjang tubuhnya (kreativitas per organ).
    if (tAtY && cfg.zones && cfg.zones.length) {
      const N = 14;
      const zg = ctx.createLinearGradient(0, top, 0, bot);
      for (let k = 0; k <= N; k++) {
        const zc = zoneAt(cfg, tAtY(top + (bot - top) * (k / N)));
        zg.addColorStop(k / N, `rgba(${zc.interior.glow},0.30)`);
      }
      ctx.fillStyle = zg;
      ctx.beginPath();
      for (let i = 0; i < e.Lp.length; i++) ctx.lineTo(e.Lp[i].x, e.Lp[i].y);
      for (let i = e.Rp.length - 1; i >= 0; i--) ctx.lineTo(e.Rp[i].x, e.Rp[i].y);
      ctx.closePath(); ctx.fill();
    }
    // SUNBURST: berkas cahaya radial dari atas rongga (khas video referensi)
    const sb = cfg.sunburst || {};
    const nR = Math.max(6, sb.rays || 14);
    const ox = cx, oy = top - halfW * 1.4;
    const rad = Math.max(halfW * 3, bot - top);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(Math.sin(timeRef * (sb.spin || 0.02)) * 0.06);
    for (let r = 0; r < nR; r++) {
      const a0 = (r / nR) * Math.PI * 2, a1 = a0 + Math.PI / nR;
      ctx.fillStyle = `rgba(${it.glowHot},${(r % 2) ? (sb.alpha || 0.17) : (sb.alpha || 0.17) * 0.18})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rad, a0, a1); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    void cx; void halfW;
  }
}

/**
 * MASSA ORGAN gaya VIDEO: awan cokelat-mauve bersiluet SCALLOP (lobus membulat
 * berderet seperti pinggiran awan), belang dalam gelap, rim terang di sisi atas.
 */
function drawOrganMasses(ctx, cfg, L, pr, y0, y1, time) {
  const every = 820;
  const ys = Math.floor((y0 - 80) / every) * every;
  for (let y = ys; y <= y1 + 80; y += every) {
    const hsh = hash1(y * 0.21 + 3.1);
    if (hsh < 0.35) continue;
    const yy = y + (hsh - 0.5) * every * 0.5;
    if (yy < L.topY + 80 || yy > L.bottomY - 80) continue;
    const c = L.centerAt(yy), hw = L.halfAt(yy);
    const mx = c + (hash1(y * 0.77) - 0.5) * hw * 0.7;
    const R = hw * (0.34 + hash1(y * 0.31) * 0.2);
    const p = pr(mx, yy);
    const rs = R * p.s;
    const N = 16;
    const lob = (i) => 1 + Math.sin(i * 2.399 + y * 0.01) * 0.16 + Math.sin(i * 5.13 - y * 0.007) * 0.08;
    // badan awan: lingkaran lobus keliling + inti
    ctx.fillStyle = 'rgba(138,94,88,0.78)';
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const rr = rs * lob(i);
      const x = p.x + Math.cos(a) * rr, yv = p.y + Math.sin(a) * rr * PERSP.YS;
      ctx.moveTo(x + rs * 0.42, yv);
      ctx.arc(x, yv, rs * 0.42, 0, TAU);
    }
    ctx.moveTo(p.x + rs * 0.9, p.y);
    ctx.arc(p.x, p.y, rs * 0.9, 0, TAU);
    ctx.fill();
    // belang dalam gelap
    ctx.fillStyle = 'rgba(102,64,62,0.5)';
    for (let k = 0; k < 6; k++) {
      const hh = hash1(y * 0.13 + k * 7.7);
      ctx.beginPath();
      ctx.ellipse(p.x + (hh - 0.5) * rs * 1.1, p.y + (hash1(k * 3.3 + y) - 0.5) * rs * 0.7, rs * 0.24, rs * 0.15, hh * 3, 0, TAU);
      ctx.fill();
    }
    // rim terang di punggung lobus sisi atas (cahaya interior dari belakang)
    ctx.strokeStyle = 'rgba(236,196,168,0.4)';
    ctx.lineWidth = Math.max(1, 3 * p.s);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      if (Math.sin(a) > 0.15) continue; // hanya sisi atas
      const rr = rs * lob(i);
      const x = p.x + Math.cos(a) * rr, yv = p.y + Math.sin(a) * rr * PERSP.YS;
      ctx.beginPath(); ctx.arc(x, yv, rs * 0.42, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    }
    void time;
  }
}

/**
 * CHORDAE gaya VIDEO: pilar/tiang TAN meruncing yang menopang massa dari dinding
 * (seperti dahan pohon), plus cabang kecil — bukan filamen tipis transparan.
 */
function drawChordae(ctx, cfg, L, pr, y0, y1, time) {
  if (!cfg.chords || cfg.chords.every <= 0) return;
  const every = cfg.chords.every;
  const col = cfg.chords.color;
  const ys = Math.floor((y0 - 60) / every) * every;
  for (let y = ys; y <= y1 + 60; y += every) {
    const hsh = hash1(y * 0.53 + 11.7);
    const yy = y + (hsh - 0.5) * every * 0.6;
    if (yy < L.topY + 40 || yy > L.bottomY - 40) continue;
    const c = L.centerAt(yy), hw = L.halfAt(yy);
    const sway = Math.sin(time * 0.5 + y * 0.02) * 8;
    for (const dir of [1, -1]) {
      if (hash1(y * 0.31 + dir) < 0.35) continue;
      const baseW = pr(c - dir * hw, yy);
      const tipW = pr(c - dir * hw * (0.25 + hsh * 0.3), yy + 150 + hsh * 120 + sway);
      const w0 = Math.max(1.5, 9 * baseW.s), w1 = Math.max(1, 3.5 * tipW.s);
      // pilar meruncing: quad dari lebar dasar ke lebar ujung
      const nx = (tipW.y - baseW.y), ny = -(tipW.x - baseW.x);
      const nl = Math.hypot(nx, ny) || 1;
      const ux = nx / nl, uy = ny / nl;
      ctx.fillStyle = `rgba(${col},${0.5 + hsh * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(baseW.x + ux * w0, baseW.y + uy * w0);
      ctx.lineTo(tipW.x + ux * w1, tipW.y + uy * w1);
      ctx.lineTo(tipW.x - ux * w1, tipW.y - uy * w1);
      ctx.lineTo(baseW.x - ux * w0, baseW.y - uy * w0);
      ctx.closePath(); ctx.fill();
      // cabang kecil di tengah pilar
      if (hsh > 0.45) {
        const mx = (baseW.x + tipW.x) / 2, my = (baseW.y + tipW.y) / 2;
        const e2 = pr(c - dir * hw * 0.55, yy + 90);
        ctx.strokeStyle = `rgba(${col},0.45)`;
        ctx.lineWidth = Math.max(1, 2.5 * baseW.s);
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo((mx + e2.x) / 2, (my + e2.y) / 2 + 10, e2.x, e2.y); ctx.stroke();
      }
    }
  }
}

/**
 * Dinding per sisi: pita membran licin + deret scute merah + kelenjar emas +
 * frill duri. Digambar DI ATAS interior, mengikuti kontur collision persis.
 */
function drawWallBand(ctx, cfg, L, side, dir, pr, y0, y1, beat, sMid, shape, tAtY) {
  const pts = side.map(([x, y]) => pr(x, y));
  if (pts.length < 2) return;
  const zcAt = (yy) => zoneAt(cfg, tAtY ? tAtY(pr(L.centerAt(yy), yy).y) : 0.5);

  // --- OPEN-WORLD: pecah kontur jadi run-run; titik yang sebenarnya PINTU ke
  //     lajur lain DILUBANGI supaya persimpangan terbaca & terasa bisa dilewati.
  const runs = [];
  let cur = [];
  for (let i = 0; i < side.length; i++) {
    if (isJunctionOpening(shape, L, side[i][0], side[i][1])) {
      if (cur.length > 1) runs.push(cur);
      cur = [];
    } else cur.push(i);
  }
  if (cur.length > 1) runs.push(cur);

  const strokeIdx = (idxs, style, wPx, inset) => {
    if (idxs.length < 2) return;
    ctx.strokeStyle = style; ctx.lineWidth = Math.max(1, wPx);
    ctx.beginPath();
    for (let k = 0; k < idxs.length; k++) {
      const i = idxs[k];
      const q = inset ? pr(side[i][0] - dir * inset, side[i][1]) : pts[i];
      if (k === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  };

  // --- 1. PITA MEMBRAN per run (licin mengikuti kontur) ---
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const run of runs) {
    const zc = zcAt(side[run[0]][1]);
    const rb = zc.ribbon;
    strokeIdx(run, `rgba(${rb.dark},1)`, (rb.width + 10) * sMid, 0);
    strokeIdx(run, `rgba(${rb.color},1)`, rb.width * sMid, 0);
    // kilau tipis di sisi dalam pita (cahaya interior memantul)
    strokeIdx(run, `rgba(255,214,150,${0.22 + beat * 0.1})`, 3 * sMid, rb.width * 0.42);
    // bibir pintu: tepian run yang bersebelahan lubang diberi kilau lembut
    // supaya bukaan persimpangan terbaca sebagai portal, bukan patahan.
    for (const i of [run[0], run[run.length - 1]]) {
      const p = pts[i];
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26 * sMid);
      g.addColorStop(0, `rgba(255,226,168,${0.30 + beat * 0.12})`);
      g.addColorStop(1, 'rgba(255,226,168,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, 26 * sMid, 0, TAU); ctx.fill();
    }
  }

  // --- 1b. PITA MAGENTA di punggung membran (lapisan antara fringe & sisik,
  //     persis video: merah fringe -> magenta -> teal sisik) ---
  for (const run of runs) {
    const zc = zcAt(side[run[0]][1]);
    const ub = (zc.ribbon.under || '196,72,132');
    strokeIdx(run, `rgba(${ub},0.9)`, (cfg.ribbon.width + 26) * sMid, -dir * (cfg.ribbon.width * 0.9));
  }

  // --- 2. FRINGE SCALLOP VIDEO: deret bulus crimson BERSEMBOLAN menancap di
  //     garis collision (pinggiran berombak kontinu, bukan pill terpisah) ---
  const sc0 = cfg.scutes;
  const stepF = Math.max(10, sc0.every * 0.5);
  const yF = Math.floor((Math.max(L.topY, y0) - 40) / stepF) * stepF;
  for (let y = yF; y <= Math.min(L.bottomY, y1) + 40; y += stepF) {
    const yy = Math.max(L.topY, Math.min(L.bottomY, y));
    const c = L.centerAt(yy), hw = L.halfAt(yy);
    const x = c - dir * hw;
    if (isJunctionOpening(shape, L, x, yy)) continue; // pintu: tanpa fringe
    const sc = zcAt(yy).scutes;
    const p = pr(x, yy);
    const r = (sc.size * 0.62) * p.s;
    // bulus badan (setengah menonjol ke rongga → pinggiran berombak)
    ctx.fillStyle = `rgba(${sc.color},1)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    // bayangan bawah bulus (depth tumpukan)
    ctx.fillStyle = `rgba(${sc.dark || '120,20,28'},0.55)`;
    ctx.beginPath(); ctx.arc(p.x + dir * r * 0.18, p.y + r * 0.3, r * 0.82, 0, Math.PI); ctx.fill();
    // kilau punggung bulus (cahaya interior)
    ctx.fillStyle = `rgba(${sc.light},${0.42 + beat * 0.22})`;
    ctx.beginPath(); ctx.arc(p.x - dir * r * 0.16, p.y - r * 0.34, r * 0.42, 0, TAU); ctx.fill();
  }

  // --- 3. KELENJAR: titik menyala tertanam, sesekali (warna per zona) ---
  const ge = Math.max(60, cfg.glands.every);
  const gy = Math.floor((Math.max(L.topY, y0) - 60) / ge) * ge;
  for (let y = gy; y <= Math.min(L.bottomY, y1) + 60; y += ge) {
    const hsh = hash1(y * 0.41 + dir * 5.5);
    if (hsh < 0.4) continue;
    const yy = Math.max(L.topY, Math.min(L.bottomY, y + (hsh - 0.5) * ge * 0.5));
    const c = L.centerAt(yy), hw = L.halfAt(yy);
    if (isJunctionOpening(shape, L, c - dir * (hw - 4), yy)) continue;
    const gl = zcAt(yy).glands;
    const p = pr(c - dir * (hw - 4), yy);
    const sz = (gl.size * (0.7 + hsh * 0.8)) * p.s;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 2.4);
    g.addColorStop(0, `rgba(${gl.glow},${0.85 + beat * 0.1})`);
    g.addColorStop(0.35, `rgba(${gl.color},0.6)`);
    g.addColorStop(1, `rgba(${gl.color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, sz * 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${gl.glow},0.95)`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * 0.62, sz * 0.5, 0, 0, TAU); ctx.fill();
  }

  // --- 4. FRILL: cluster duri sesekali (warna per zona) ---
  const fe = Math.max(60, cfg.frills.every);
  const fy = Math.floor((Math.max(L.topY, y0) - 60) / fe) * fe;
  for (let y = fy; y <= Math.min(L.bottomY, y1) + 60; y += fe) {
    const hsh = hash1(y * 0.29 - dir * 3.3);
    if (hsh < 0.55) continue;
    const yy = Math.max(L.topY, Math.min(L.bottomY, y));
    const c = L.centerAt(yy), hw = L.halfAt(yy);
    if (isJunctionOpening(shape, L, c - dir * hw, yy)) continue;
    const fr = zcAt(yy).frills;
    const base = pr(c - dir * hw, yy);
    ctx.strokeStyle = `rgba(${fr.color},0.9)`;
    ctx.lineWidth = Math.max(1, 2.2 * sMid);
    for (let k = 0; k < 4; k++) {
      const ang = (k - 1.5) * 0.34 + (hsh - 0.5);
      const len = fr.len * (0.7 + hash1(y + k) * 0.6) * base.s;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(base.x - dir * Math.cos(ang) * len * 0.4, base.y + Math.sin(ang) * len);
      ctx.stroke();
    }
  }
}

/** Pembuluh tertanam di pita jaringan (vena biru / arteri merah, aliran naik). */
function drawVessels(ctx, cfg, L, side, dir, pr, y0, y1, beat, sMid, time) {
  const nV = Math.max(0, cfg.vesselCount | 0);
  for (let v = 0; v < nV; v++) {
    const artery = (v % 2) === 1;
    const off2 = 34 + v * 26 + hash1(v * 7 + dir) * 8;
    const amp = 8 + v * 3;
    const col = artery ? cfg.vesselArt : cfg.vessel;
    const lw = Math.max(1.2, (artery ? 4.2 : 5.4) * sMid * (1 + beat * 0.25 * (artery ? 1 : 0.3)));
    ctx.beginPath();
    for (let i = 0; i < side.length; i++) {
      const y = side[i][1];
      const c = L.centerAt(y), hw = L.halfAt(y);
      const x = c - dir * (hw + off2) + Math.sin(y * 0.02 + v * 1.7 + dir) * amp;
      const q = pr(x, y);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.globalAlpha = 0.55; ctx.strokeStyle = `rgba(${col},1)`; ctx.lineWidth = lw; ctx.setLineDash([]); ctx.stroke();
    ctx.globalAlpha = 0.75; ctx.strokeStyle = `rgba(${cfg.flow},1)`; ctx.lineWidth = Math.max(1, lw * 0.42);
    ctx.setLineDash([10 * sMid, 26 * sMid]);
    ctx.lineDashOffset = (time * (artery ? 120 : 70) + v * 13) * sMid * PERSP.YS;
    ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
  }
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
  const cfg = deep(W_DEF, (shape.def && shape.def.wall) || {});
  const cam = cameraOf(P);
  const vb = worldViewBox(cam, w, h, 80, 120);
  const y0 = Math.max(shape.topY, vb.y0), y1 = Math.min(shape.bottomY, vb.y1);
  if (y1 < y0) return;
  const beat = heartbeat(time, cfg.bpm);
  const step = 36;
  const pr = (x, y) => P.project(x, y);
  const sMid = pr(shape.centerAt((y0 + y1) / 2), (y0 + y1) / 2).s;
  // peta y-layar -> t organ (0 dasar .. 1 puncak) untuk pewarnaan zona
  const a0 = pr(cam.x, cam.y);
  const aC = pr(cam.x, cam.y + 100);
  const syEff = Math.max(1e-6, (aC.y - a0.y) / 100);
  const tAtY = (sy) => tOf(shape, cam.y + (sy - a0.y) / syEff);
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

  const lanes = shape.lanes.map((L) => {
    const poly = wallPolyline(shape, y0 - step, y1 + step, step, L);
    return { L, poly, Lp: poly.left.map(([x, y]) => pr(x, y)), Rp: poly.right.map(([x, y]) => pr(x, y)) };
  }).filter((e) => e.Lp.length >= 2);
  if (!lanes.length) return;

  const lanePath = (g, e, padPx = 0) => {
    g.beginPath();
    for (let i = 0; i < e.Lp.length; i++) g.lineTo(e.Lp[i].x - padPx, e.Lp[i].y);
    for (let i = e.Rp.length - 1; i >= 0; i--) g.lineTo(e.Rp[i].x + padPx, e.Rp[i].y);
    g.closePath();
  };

  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // ---------- 1. JARINGAN LUAR (sisik) = layar DIKURANGI gabungan lajur ----------
  const off = offscreen(Math.ceil(w * dpr), Math.ceil(h * dpr));
  if (off) {
    const g = off.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    // dasar gelap di bawah sisik supaya celah tidak bocor terang
    const [dr, dg, db] = cfg.tissue.cellDark.split(',').map(Number);
    g.fillStyle = `rgb(${dr},${dg},${db})`;
    g.fillRect(0, 0, w, h);
    drawScaleTissue(g, w, h, cfg, cam, pr, shape);
    // pembuluh tertanam di jaringan (di luar rongga)
    g.save();
    for (const e of lanes) for (const [side, dir] of [[e.poly.left, 1], [e.poly.right, -1]]) {
      drawVessels(g, cfg, e.L, side, dir, pr, y0, y1, beat, sMid, time);
    }
    g.restore();
    // gradasi tepi: jaringan makin gelap menjauh dari rongga (vignette luar)
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    // lubangi rongga
    g.globalCompositeOperation = 'destination-out';
    for (const e of lanes) { lanePath(g, e); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, w, h);
  } else {
    // cadangan tanpa DOM (penguji jsdom)
    const e = lanes[0];
    ctx.fillStyle = `rgba(${cfg.tissue.cellDark},1)`;
    for (const [pts, dir] of [[e.Lp, -1], [e.Rp, 1]]) {
      ctx.beginPath();
      ctx.moveTo(dir < 0 ? -4000 : w + 4000, pts[0].y - 2000);
      for (const q of pts) ctx.lineTo(q.x, q.y);
      ctx.lineTo(dir < 0 ? -4000 : w + 4000, pts[pts.length - 1].y + 2000);
      ctx.closePath(); ctx.fill();
    }
  }

  // ---------- 2. INTERIOR BACKLIT (dikip ke gabungan lajur) ----------
  ctx.save();
  ctx.beginPath();
  for (const e of lanes) {
    ctx.moveTo(e.Lp[0].x, e.Lp[0].y);
    for (let i = 1; i < e.Lp.length; i++) ctx.lineTo(e.Lp[i].x, e.Lp[i].y);
    for (let i = e.Rp.length - 1; i >= 0; i--) ctx.lineTo(e.Rp[i].x, e.Rp[i].y);
    ctx.closePath();
  }
  ctx.clip();
  drawBacklitInterior(ctx, cfg, lanes, beat, tAtY, time);
  for (const e of lanes) drawOrganMasses(ctx, cfg, e.L, pr, y0, y1, time);
  for (const e of lanes) drawChordae(ctx, cfg, e.L, pr, y0, y1, time);
  ctx.restore();

  // ---------- 3. DINDING: membran + scute + kelenjar + frill ----------
  for (const e of lanes) {
    for (const [side, dir] of [[e.poly.left, 1], [e.poly.right, -1]]) {
      drawWallBand(ctx, cfg, e.L, side, dir, pr, y0, y1, beat, sMid, shape, tAtY);
    }
  }

  ctx.restore();
}
