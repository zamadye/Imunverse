/**
 * pathogen-attire.js — SILUET BERDURI per keluarga patogen (analisis Pathogenic:
 * musuh terbaca dari siluet + protrusi, bukan blob bulat). Digambar DI DALAM
 * transform billboard musuh (satuan dunia, origin di badan):
 *   virus    → crown knob (corona)      bakteri → pili duri pendek
 *   parasit  → kait meliuk panjang      spora   → jarum radial halus
 *   sel_kanker→ benjolan tak rata        protozoa→ fringe silia + flagelum
 *   toksin   → 3 duri besar             default → duri pendek
 * Murni presentasi — tidak menyentuh stat/combat.
 */
const TAU = Math.PI * 2;

const CFG = {
  virus:      { n: 12, kind: 'knob',  len: 0.55, wid: 0.10, col: '214,84,94' },
  bakteri:    { n: 9,  kind: 'thorn', len: 0.38, wid: 0.16, col: '186,92,60' },
  bakteri_gp: { n: 10, kind: 'thorn', len: 0.42, wid: 0.15, col: '196,120,70' },
  bakteri_gn: { n: 8,  kind: 'thorn', len: 0.36, wid: 0.15, col: '170,110,80' },
  parasit:    { n: 5,  kind: 'hook',  len: 0.85, wid: 0.12, col: '196,84,120' },
  spora:      { n: 16, kind: 'needle', len: 0.52, wid: 0.05, col: '160,140,90' },
  sel_kanker: { n: 7,  kind: 'lump',  len: 0.50, wid: 0.30, col: '150,70,110' },
  protozoa:   { n: 22, kind: 'cilia', len: 0.30, wid: 0.04, col: '120,150,110' },
  toksin:     { n: 3,  kind: 'thorn', len: 0.75, wid: 0.26, col: '170,70,140' },
};

const BODY = {
  virus:      { mem: '150,84,190',  core: '240,210,255', edge: '80,30,110' },
  bakteri:    { mem: '196,84,72',    core: '255,205,170', edge: '110,26,26' },
  bakteri_gp: { mem: '206,110,64',   core: '255,220,170', edge: '120,40,20' },
  bakteri_gn: { mem: '186,120,84',   core: '255,225,190', edge: '110,50,30' },
  parasit:    { mem: '196,84,130',   core: '255,200,220', edge: '110,26,60' },
  spora:      { mem: '160,150,90',   core: '250,240,190', edge: '90,80,30' },
  sel_kanker: { mem: '150,70,120',   core: '250,190,220', edge: '80,20,60' },
  protozoa:   { mem: '110,160,110',  core: '220,255,210', edge: '40,80,40' },
  toksin:     { mem: '180,70,150',   core: '255,200,240', edge: '100,20,80' },
};

/**
 * BADAN PATOGEN vektor (sprite foto pensiun sejak reset aset): membran blob
 * berdenyut + inti/organel + gloss basah — siluet per keluarga via spike attire.
 * @param {CanvasRenderingContext2D} ctx dalam transform billboard musuh
 */
export function drawPathogenBody(ctx, e, t) {
  const id = (e.def && e.def.id) || '';
  const pal = BODY[id] || BODY[id.replace(/_\w+$/, '')] || BODY.bakteri;
  const R = e.radius || 14;
  const ph = e.weavePhase || 0;
  ctx.save();
  // membran blob ber-imbang (soft-body feel)
  ctx.beginPath();
  const NPT = 16;
  for (let i = 0; i <= NPT; i++) {
    const a = (i / NPT) * TAU;
    const rr = R * (1 + 0.12 * Math.sin(3 * a + t * 2.2 + ph * 7) + 0.07 * Math.sin(5 * a - t * 1.7 - ph * 3));
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.94;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.15, 0, 0, R * 1.25);
  g.addColorStop(0, `rgba(${pal.core},0.95)`);
  g.addColorStop(0.45, `rgba(${pal.mem},0.95)`);
  g.addColorStop(1, `rgba(${pal.edge},0.95)`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = `rgba(${pal.edge},0.9)`;
  ctx.lineWidth = Math.max(1.2, R * 0.12);
  ctx.stroke();
  // inti + organel
  ctx.fillStyle = `rgba(${pal.edge},0.75)`;
  ctx.beginPath(); ctx.arc(R * 0.12, R * 0.08, R * 0.34, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(${pal.core},0.8)`;
  ctx.beginPath(); ctx.arc(-R * 0.3, -R * 0.22, R * 0.14, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(R * 0.34, -R * 0.3, R * 0.10, 0, TAU); ctx.fill();
  // gloss basah
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, R * 0.10);
  ctx.beginPath(); ctx.arc(-R * 0.15, -R * 0.2, R * 0.55, Math.PI * 1.05, Math.PI * 1.65); ctx.stroke();
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx dalam transform billboard musuh
 * @param {object} e enemy aktif (punya .radius, .def.id, .weavePhase)
 * @param {number} t detik global
 */
export function drawPathogenSpikes(ctx, e, t) {
  const id = (e.def && e.def.id) || '';
  const base = CFG[id] || CFG[id.replace(/_\w+$/, '')] || { n: 8, kind: 'thorn', len: 0.32, wid: 0.14, col: '180,90,80' };
  const R = e.radius || 14;
  const r0 = R * 0.92;
  const wob = Math.sin(t * 5 + (e.weavePhase || 0) * 7) * 0.06;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < base.n; i++) {
    const a = (i / base.n) * TAU + wob * (i % 2 ? 1 : -1);
    const ux = Math.cos(a), uy = Math.sin(a);
    const L = R * base.len * (base.kind === 'lump' ? 0.7 + 0.6 * Math.abs(Math.sin(i * 2.7)) : 1);
    ctx.strokeStyle = `rgba(${base.col},0.9)`;
    ctx.fillStyle = `rgba(${base.col},0.9)`;
    if (base.kind === 'knob') {
      ctx.lineWidth = Math.max(1.2, R * 0.09);
      ctx.beginPath();
      ctx.moveTo(ux * r0, uy * r0);
      ctx.lineTo(ux * (r0 + L), uy * (r0 + L));
      ctx.stroke();
      ctx.beginPath(); ctx.arc(ux * (r0 + L), uy * (r0 + L), R * 0.11, 0, TAU); ctx.fill();
    } else if (base.kind === 'cilia') {
      const sw = Math.sin(t * 9 + i * 0.9) * 0.35;
      ctx.lineWidth = Math.max(0.8, R * 0.05);
      ctx.beginPath();
      ctx.moveTo(ux * r0, uy * r0);
      ctx.quadraticCurveTo(
        ux * (r0 + L * 0.6) - uy * sw * L, uy * (r0 + L * 0.6) + ux * sw * L,
        ux * (r0 + L) - uy * sw * L * 1.6, uy * (r0 + L) + ux * sw * L * 1.6);
      ctx.stroke();
    } else if (base.kind === 'hook') {
      ctx.lineWidth = Math.max(1.6, R * 0.14);
      ctx.beginPath();
      ctx.moveTo(ux * r0, uy * r0);
      ctx.quadraticCurveTo(
        ux * (r0 + L * 0.7) - uy * L * 0.5, uy * (r0 + L * 0.7) + ux * L * 0.5,
        ux * (r0 + L) - uy * L * 0.15, uy * (r0 + L) + ux * L * 0.15);
      ctx.stroke();
    } else if (base.kind === 'lump') {
      ctx.beginPath();
      ctx.ellipse(ux * (r0 + L * 0.35), uy * (r0 + L * 0.35), L * 0.55, R * base.wid, a, 0, TAU);
      ctx.fill();
    } else { // thorn / needle
      const w = R * base.wid;
      ctx.beginPath();
      ctx.moveTo(ux * r0 - uy * w, uy * r0 + ux * w);
      ctx.lineTo(ux * (r0 + L), uy * (r0 + L));
      ctx.lineTo(ux * r0 + uy * w, uy * r0 - ux * w);
      ctx.closePath();
      ctx.fill();
    }
  }
  // flagelum protozoa: ekor panjang meliuk
  if (base.kind === 'cilia') {
    ctx.strokeStyle = `rgba(${base.col},0.85)`;
    ctx.lineWidth = Math.max(1.2, R * 0.10);
    ctx.beginPath();
    ctx.moveTo(-r0 * 0.2, r0);
    ctx.quadraticCurveTo(-R * 0.6 + Math.sin(t * 7) * R * 0.4, r0 + R * 0.9,
      Math.sin(t * 5) * R * 0.7, r0 + R * 1.7);
    ctx.stroke();
  }
  ctx.restore();
}
