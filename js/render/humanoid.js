/**
 * humanoid.js — Fase 12d: karakter humanoid chibi (kepala, badan, 2 tangan,
 * 2 kaki, ekspresi wajah) — digambar PROSEDURAL per frame di Canvas 2D dengan
 * shading volume (gradasi radial) sehingga tampil "3D" di atas proyektor
 * kamera miring. HANYA VISUAL: tidak ada logika gameplay di sini.
 *
 * Animasi (param masukan):
 *  - phase  : fase jalan (dari player.walkPhase / waktu) → kaki & tangan berayun
 *  - moving : true saat berjalan (ayunan besar) vs idle (nafas + goyang)
 *  - attackT: sisa waktu swap sprite serangan (0..1) → lengan depan mencetak
 *  - swingT : sisa animasi swing tombol SERANG (0..1) → tebasan
 *  - flip   : arah hadap (1 kanan, -1 kiri) — seluruh figur dicerminkan
 *  - flash  : 0..1 hit flash → warna dicampur putih
 */

/** Mix warna hex → rgb string. */
function hx(c) {
  const n = parseInt((c || '#888888').slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mixc(a, b, k) {
  const A = hx(a);
  const B = hx(b || '#ffffff');
  const f = Math.max(0, Math.min(1, k));
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * f)},${Math.round(A[1] + (B[1] - A[1]) * f)},${Math.round(A[2] + (B[2] - A[2]) * f)})`;
}

/** Proporsi tubuh per build (dalam satuan r = radius footprint karakter). */
const BUILDS = {
  big:      { bodyW: 2.05, headR: 0.86, legW: 0.52, armW: 0.46, legH: 0.95, armL: 0.88 },
  athletic: { bodyW: 1.72, headR: 0.76, legW: 0.42, armW: 0.37, legH: 1.16, armL: 1.0 },
  slim:     { bodyW: 1.42, headR: 0.72, legW: 0.36, armW: 0.31, legH: 1.26, armL: 0.96 },
  compact:  { bodyW: 1.62, headR: 0.8,  legW: 0.4,  armW: 0.35, legH: 0.9,  armL: 0.84 },
  medium:   { bodyW: 1.6,  headR: 0.78, legW: 0.4,  armW: 0.34, legH: 1.05, armL: 0.92 },
};

/** Kapsul: garis bulat ujung (outline gelap + isi). */
function capsule(ctx, x1, y1, x2, y2, w, fill, outline) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = w + Math.max(1.6, w * 0.28);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

/** Lingkaran bergradasi radial (kesan volume 3D). */
function ball(ctx, x, y, r, base, opts = {}) {
  const hi = opts.hi || mixc(base, '#ffffff', 0.42);
  const lo = opts.lo || mixc(base, '#000000', 0.22);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r * 1.05);
  g.addColorStop(0, hi);
  g.addColorStop(0.62, base);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (opts.outline !== false) {
    ctx.strokeStyle = opts.outline || mixc(base, '#000000', 0.45);
    ctx.lineWidth = Math.max(1.4, r * 0.14);
    ctx.stroke();
  }
}

/** Torso kapsul vertikal bergradasi. */
function torso(ctx, x, y, w, h, base) {
  const hi = mixc(base, '#ffffff', 0.38);
  const lo = mixc(base, '#000000', 0.2);
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, hi);
  g.addColorStop(0.55, base);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.strokeStyle = mixc(base, '#000000', 0.45);
  ctx.lineWidth = Math.max(1.5, w * 0.08);
  ctx.beginPath();
  const rw = w / 2;
  ctx.roundRect ? ctx.roundRect(x - rw, y - h / 2, w, h, rw) : ctx.rect(x - rw, y - h / 2, w, h);
  ctx.fill();
  ctx.stroke();
}

/** Wajah: mata + alis + mulut. mood: happy | determined | angry | dim */
function face(ctx, hx0, hy, hr, mood, accent, blink = 0) {
  const ex = hr * 0.34;
  const ey = hy - hr * 0.02;
  const ew = hr * 0.2;
  const dark = '#22303a';
  if (mood === 'dim') {
    // mata glow redup (Nyx)
    for (const s of [-1, 1]) {
      ctx.fillStyle = accent || '#b08cff';
      ctx.beginPath();
      ctx.arc(hx0 + s * ex, ey, hr * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (const s of [-1, 1]) {
      if (blink > 0.85) {
        ctx.strokeStyle = dark;
        ctx.lineWidth = Math.max(1.2, hr * 0.08);
        ctx.beginPath();
        ctx.moveTo(hx0 + s * ex - ew, ey);
        ctx.lineTo(hx0 + s * ex + ew, ey);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(hx0 + s * ex, ey, ew, hr * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(hx0 + s * ex + hr * 0.07, ey + hr * 0.02, hr * 0.105, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (mood === 'angry') {
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1.3, hr * 0.1);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx0 + s * (ex - ew), ey - hr * 0.3);
        ctx.lineTo(hx0 + s * (ex + ew), ey - hr * 0.16);
        ctx.stroke();
      }
    }
  }
  // mulut
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1.2, hr * 0.09);
  const my = hy + hr * 0.36;
  ctx.beginPath();
  if (mood === 'angry') ctx.arc(hx0, my + hr * 0.22, hr * 0.22, Math.PI * 1.15, Math.PI * 1.85);
  else if (mood === 'determined') { ctx.moveTo(hx0 - hr * 0.16, my); ctx.lineTo(hx0 + hr * 0.16, my); }
  else ctx.arc(hx0, my - hr * 0.1, hr * 0.26, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

/* =====================================================================
   TRAIT HERO — aksesori kepala/tubuh/tangan sesuai ciri khas (tabel pemilik)
   ===================================================================== */
const TRAITS = {
  mako(ctx, P) {
    // Mulut lebar + perut buncit (accent kuning)
    ctx.strokeStyle = P.dark;
    ctx.lineWidth = Math.max(1.6, P.hr * 0.1);
    ctx.beginPath();
    ctx.arc(P.hx, P.hy + P.hr * 0.3, P.hr * 0.42, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
    ctx.fillStyle = mixc(P.accent, '#000000', 0.1);
    ctx.beginPath();
    ctx.ellipse(P.bx, P.by + P.th * 0.28, P.bw * 0.32, P.th * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  dendri(ctx, P) {
    // Visor analitik + tentakel bercabang di belakang kepala
    ctx.fillStyle = mixc(P.accent, '#000000', 0.05);
    ctx.strokeStyle = P.dark;
    ctx.lineWidth = Math.max(1.2, P.hr * 0.08);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(P.hx - P.hr * 0.78, P.hy - P.hr * 0.16, P.hr * 1.56, P.hr * 0.4, P.hr * 0.18);
    else ctx.rect(P.hx - P.hr * 0.78, P.hy - P.hr * 0.16, P.hr * 1.56, P.hr * 0.4);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = mixc(P.primary, '#ffffff', 0.55);
    ctx.lineWidth = Math.max(1.2, P.hr * 0.07);
    ctx.beginPath();
    ctx.moveTo(P.hx - P.hr * 0.6, P.hy - P.hr * 0.02);
    ctx.lineTo(P.hx + P.hr * 0.6, P.hy - P.hr * 0.02);
    ctx.stroke();
    // tentakel
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const sway = Math.sin(P.t * 2.4 + i * 1.7) * P.hr * 0.3;
      ctx.strokeStyle = mixc(P.primary, '#000000', 0.12);
      ctx.lineWidth = P.hr * 0.16;
      ctx.beginPath();
      ctx.moveTo(-P.hr * 0.55, P.hy - P.hr * 0.3 + i * P.hr * 0.28);
      ctx.quadraticCurveTo(-P.hr * 1.4, P.hy - P.hr * 0.5 + i * P.hr * 0.3, -P.hr * (1.7 + i * 0.14) , P.hy + sway + i * P.hr * 0.34 - P.hr * 0.3);
      ctx.stroke();
    }
  },
  neutron(ctx, P) {
    // Helm polisi + lencana; perisai digambar di tangan belakang (see shieldBack)
    ctx.fillStyle = mixc(P.primary, '#000000', 0.1);
    ctx.beginPath();
    ctx.arc(P.hx, P.hy - P.hr * 0.18, P.hr * 1.02, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = mixc(P.accent, '#000000', 0.0);
    ctx.fillRect(P.hx - P.hr * 1.06, P.hy - P.hr * 0.26, P.hr * 2.12, P.hr * 0.16);
    ctx.fillRect(P.hx, P.hy - P.hr * 0.28, P.hr * 1.24, P.hr * 0.12); // brim ke depan
    // lencana bintang di dada
    ctx.fillStyle = P.accent;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / 5;
      const a2 = a + Math.PI / 5;
      const rr = P.hr * 0.2;
      ctx.lineTo(P.bx + Math.cos(a) * rr, P.by - P.th * 0.16 + Math.sin(a) * rr);
      ctx.lineTo(P.bx + Math.cos(a2) * rr * 0.45, P.by - P.th * 0.16 + Math.sin(a2) * rr * 0.45);
    }
    ctx.closePath();
    ctx.fill();
  },
  eos(ctx, P) {
    // Rambut bergelombang + tombak di tangan depan (spear digambar PENERIMA weapon)
    ctx.fillStyle = P.accent;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(P.hx - P.hr * 0.5 + i * P.hr * 0.34, P.hy - P.hr * 0.72 - Math.sin(i) * P.hr * 0.08, P.hr * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = mixc(P.accent, '#000000', 0.15);
    ctx.beginPath();
    ctx.arc(P.hx - P.hr * 0.62, P.hy - P.hr * 0.3, P.hr * 0.34, 0, Math.PI * 2);
    ctx.fill();
  },
  baso(ctx, P) {
    // Jas lab putih (panel depan) + rambut ungu + tabung di tangan
    ctx.fillStyle = '#f7fbff';
    ctx.strokeStyle = '#c9d6e4';
    ctx.lineWidth = Math.max(1.2, P.bw * 0.05);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(P.bx - P.bw * 0.42, P.by - P.th * 0.42, P.bw * 0.84, P.th * 0.86, P.bw * 0.2);
    else ctx.rect(P.bx - P.bw * 0.42, P.by - P.th * 0.42, P.bw * 0.84, P.th * 0.86);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c9d6e4';
    ctx.beginPath(); ctx.moveTo(P.bx, P.by - P.th * 0.4); ctx.lineTo(P.bx, P.by + P.th * 0.42); ctx.stroke();
    // rambut ungu
    ctx.fillStyle = mixc(P.accent, '#000000', 0.1);
    ctx.beginPath();
    ctx.arc(P.hx - P.hr * 0.2, P.hy - P.hr * 0.62, P.hr * 0.42, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
  },
  mastia(ctx, P) {
    // Granula di tubuh (titik accent) — perisai besar lewat shieldFront
    ctx.fillStyle = mixc(P.accent, '#000000', 0.08);
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4;
      ctx.beginPath();
      ctx.arc(P.bx + Math.cos(a) * P.bw * 0.24, P.by + Math.sin(a) * P.th * 0.24, P.hr * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  tcd8(ctx, P) {
    // Visor listrik + emblem petir di dada + lengan depan modifikasi (fist besar)
    ctx.fillStyle = P.accent;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(P.hx - P.hr * 0.72, P.hy - P.hr * 0.14, P.hr * 1.44, P.hr * 0.34, P.hr * 0.16);
    else ctx.rect(P.hx - P.hr * 0.72, P.hy - P.hr * 0.14, P.hr * 1.44, P.hr * 0.34);
    ctx.fill();
    ctx.fillStyle = '#fff6c2';
    ctx.beginPath();
    ctx.moveTo(P.bx + P.hr * 0.1, P.by - P.th * 0.3);
    ctx.lineTo(P.bx - P.hr * 0.16, P.by + P.hr * 0.02);
    ctx.lineTo(P.bx + P.hr * 0.02, P.by + P.hr * 0.02);
    ctx.lineTo(P.bx - P.hr * 0.08, P.by + P.th * 0.3);
    ctx.lineTo(P.bx + P.hr * 0.22, P.by - P.hr * 0.06);
    ctx.lineTo(P.bx + P.hr * 0.04, P.by - P.hr * 0.06);
    ctx.closePath();
    ctx.fill();
  },
  helia(ctx, P) {
    // Mahkota komandan + jubah (cape lewat capeBack) + tongkat (weapon staff)
    ctx.fillStyle = mixc(P.accent, '#f0b428', 0.5);
    ctx.strokeStyle = '#a97a10';
    ctx.lineWidth = Math.max(1, P.hr * 0.06);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x0 = P.hx - P.hr * 0.5 + i * P.hr * 0.5;
      ctx.moveTo(x0 - P.hr * 0.2, P.hy - P.hr * 0.82);
      ctx.lineTo(x0, P.hy - P.hr * 1.22);
      ctx.lineTo(x0 + P.hr * 0.2, P.hy - P.hr * 0.82);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  },
  treg(ctx, P) {
    // Krag putih + emblem timbangan keadilan di dada
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(P.hx - P.hr * 0.5, P.hy + P.hr * 0.72);
    ctx.lineTo(P.hx, P.hy + P.hr * 1.0);
    ctx.lineTo(P.hx + P.hr * 0.5, P.hy + P.hr * 0.72);
    ctx.lineTo(P.hx, P.hy + P.hr * 0.55);
    ctx.closePath();
    ctx.fill();
    // timbangan: tiang + 2 piring
    ctx.strokeStyle = '#d9b23a';
    ctx.lineWidth = Math.max(1.2, P.hr * 0.08);
    const sy = P.by - P.th * 0.2;
    ctx.beginPath();
    ctx.moveTo(P.bx, sy - P.hr * 0.16); ctx.lineTo(P.bx, sy + P.hr * 0.16);
    ctx.moveTo(P.bx - P.hr * 0.26, sy - P.hr * 0.1); ctx.lineTo(P.bx + P.hr * 0.26, sy - P.hr * 0.1);
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(P.bx + s * P.hr * 0.26, sy - P.hr * 0.02, P.hr * 0.12, 0, Math.PI);
      ctx.stroke();
    }
  },
  bella(ctx, P) {
    // Beret miring + celemek (panel depan) — kuas & palet lewat weapon
    ctx.fillStyle = P.accent;
    ctx.beginPath();
    ctx.ellipse(P.hx - P.hr * 0.12, P.hy - P.hr * 0.78, P.hr * 0.72, P.hr * 0.34, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(P.bx - P.bw * 0.26, P.by - P.th * 0.3, P.bw * 0.52, P.th * 0.74, P.bw * 0.14);
    else ctx.rect(P.bx - P.bw * 0.26, P.by - P.th * 0.3, P.bw * 0.52, P.th * 0.74);
    ctx.fill();
  },
  nyx(ctx, P) {
    // Tudung ninja + mata redup (face dim) — pisau sitokin lewat weapon dagger
    ctx.fillStyle = mixc(P.primary, '#000000', 0.45);
    ctx.beginPath();
    ctx.arc(P.hx, P.hy - P.hr * 0.1, P.hr * 1.04, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    ctx.fillRect(P.hx - P.hr * 1.02, P.hy - P.hr * 0.18, P.hr * 2.04, P.hr * 0.3);
    // pita scarf
    ctx.fillStyle = P.accent;
    ctx.fillRect(P.hx - P.hr * 0.6, P.hy + P.hr * 0.72, P.hr * 1.2, P.hr * 0.18);
  },
};

/** Bentuk musuh — monster humanoid (tetap kaki+tangan+wajah). */
const FORMS = {
  spike(ctx, P) {
    // Basic Virus: bola duri kecil
    const spikes = 8;
    ctx.fillStyle = P.primary;
    ctx.strokeStyle = P.dark;
    ctx.lineWidth = Math.max(1.4, P.r * 0.08);
    ctx.beginPath();
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (Math.PI * 2 * i) / (spikes * 2) + P.t * 0.4;
      const rr = (i % 2 === 0 ? P.r * 1.28 : P.r) * P.fist;
      const px = P.bx + Math.cos(a) * rr;
      const py = P.by - P.th * 0.1 + Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    P.headR = 0; // wajah di badan
    P.faceAt = { x: P.bx, y: P.by - P.th * 0.16, r: P.r * 0.72 };
  },
  runner(ctx, P) {
    // Fast Bacteria: ramping condong depan, kaki panjang
    ctx.save();
    ctx.rotate(0.16);
    torso(ctx, P.bx, P.by - P.th * 0.05, P.bw * 0.92, P.th * 1.24, P.primary);
    ctx.restore();
    P.headR = P.hr;
    P.faceAt = null; // kepala standar tetap digambar
  },
  tank(ctx, P) {
    // Tank Bacterium: besar + pelat perisai dada
    torso(ctx, P.bx, P.by, P.bw * 1.34, P.th * 1.16, P.primary);
    ctx.fillStyle = mixc(P.accent, '#000000', 0.05);
    ctx.strokeStyle = P.dark;
    ctx.lineWidth = Math.max(1.4, P.r * 0.07);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(P.bx - P.bw * 0.3, P.by - P.th * 0.34, P.bw * 0.6, P.th * 0.72, P.bw * 0.14);
    else ctx.rect(P.bx - P.bw * 0.3, P.by - P.th * 0.34, P.bw * 0.6, P.th * 0.72);
    ctx.fill(); ctx.stroke();
    // bilah helm
    ctx.fillStyle = mixc(P.primary, '#000000', 0.25);
    ctx.beginPath();
    ctx.arc(P.hx, P.hy - P.hr * 0.15, P.hr * 1.03, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    P.faceAt = null;
  },
  splitter(ctx, P) {
    // Splitter: tak stabil — bergetar + retakan
    const jx = Math.sin(P.t * 41) * P.r * 0.07;
    const wob = 1 + Math.sin(P.t * 9) * 0.1;
    ctx.save();
    ctx.translate(jx, 0);
    torso(ctx, P.bx, P.by, P.bw * wob, P.th * wob, P.primary);
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = Math.max(1.2, P.r * 0.08);
    ctx.beginPath();
    ctx.moveTo(P.bx - P.bw * 0.2, P.by - P.th * 0.3);
    ctx.lineTo(P.bx + P.bw * 0.05, P.by);
    ctx.lineTo(P.bx - P.bw * 0.12, P.by + P.th * 0.3);
    ctx.stroke();
    ctx.restore();
    P.faceAt = { x: P.bx + jx, y: P.by - P.th * 0.14, r: P.r * 0.62 };
  },
  boss(ctx, P) {
    // Boss: SANGAT besar, tubuh gelap + aura merah + mahkota duri
    const aura = ctx.createRadialGradient(P.bx, P.by - P.th * 0.1, P.r * 0.3, P.bx, P.by - P.th * 0.1, P.r * 2.4);
    aura.addColorStop(0, 'rgba(255,46,77,0.4)');
    aura.addColorStop(1, 'rgba(255,46,77,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(P.bx, P.by - P.th * 0.1, P.r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    torso(ctx, P.bx, P.by, P.bw * 1.3, P.th * 1.2, mixc(P.primary, '#1a0d12', 0.55));
    // mahkota duri merah di kepala
    ctx.fillStyle = '#ff2e4d';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(P.hx + i * P.hr * 0.52 - P.hr * 0.16, P.hy - P.hr * 0.78);
      ctx.lineTo(P.hx + i * P.hr * 0.52, P.hy - P.hr * (1.34 + (i === 0 ? 0.16 : 0)));
      ctx.lineTo(P.hx + i * P.hr * 0.52 + P.hr * 0.16, P.hy - P.hr * 0.78);
      ctx.closePath();
      ctx.fill();
    }
    P.faceAt = null;
    P.dimEyes = '#ff2e4d';
  },
};

/* =====================================================================
   Figur utama
   ===================================================================== */
/**
 * @param {object} o {x,y,r, primary, accent, build, trait, form, phase, moving,
 *                    attackT, swingT, t, flip, float, mood, fist, weapon,
 *                    shieldFront, shieldBack, cape, shoulderPads, flash}
 */
export function drawFigure(ctx, o) {
  const B = BUILDS[o.build] || BUILDS.medium;
  const r = o.r;
  const flash = Math.max(0, Math.min(1, o.flash || 0));
  const P = {
    r,
    primary: flash ? mixc(o.primary, '#ffffff', flash * 0.8) : o.primary,
    accent: flash ? mixc(o.accent || o.primary, '#ffffff', flash * 0.8) : (o.accent || mixc(o.primary, '#ffffff', 0.35)),
    t: o.t || 0,
    fist: o.fist || 1,
  };
  P.dark = mixc(P.primary, '#000000', 0.45);
  P.hi = mixc(P.primary, '#ffffff', 0.4);

  const phase = o.phase || 0;
  const moving = !!o.moving;
  const t = P.t;
  const bob = moving ? Math.abs(Math.cos(phase)) * r * 0.12 : Math.sin(t * 2.1) * r * 0.05;
  const lean = moving ? 0.05 : Math.sin(t * 1.4) * 0.02;

  const legH = B.legH * r;
  const th = B.bodyW === undefined ? 1.2 * r : 1.18 * r;
  const bw = B.bodyW * r;
  const headR = B.headR * r;
  const hipY = -legH - bob;           // dalam koordinat lokal (0 = tanah)
  const by = hipY - th / 2;           // pusat torso
  const headY = hipY - th - headR * 0.72;

  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.flip || 1, 1);
  ctx.rotate(lean * 0.5);

  // ---- CAPE (belakang semua) ----
  if (o.cape) {
    const wav = Math.sin(t * 3) * r * 0.14;
    ctx.fillStyle = o.cape;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.34, by - th * 0.42);
    ctx.quadraticCurveTo(-bw * 0.9 - wav, by, -bw * 0.62 + wav, hipY + legH * 0.5);
    ctx.lineTo(-bw * 0.1, hipY + legH * 0.42);
    ctx.closePath();
    ctx.fill();
  }

  // ---- KAKI (2) — musuh melayang (float) tidak punya kaki ----
  const swing = moving ? Math.sin(phase) * 0.55 : Math.sin(t * 1.7) * 0.05;
  const legW = B.legW * r;
  if (!o.float) {
  for (const s of [-1, 1]) {
    const a = swing * s;
    const hx0 = s * bw * 0.22;
    const fx = hx0 + Math.sin(a) * legH * 0.55;
    const footY = -Math.max(0, Math.sin(a)) * legH * 0.3; // kaki terangkat saat mengayun
    capsule(ctx, hx0, hipY, fx, footY, legW, mixc(P.primary, '#000000', 0.22), P.dark);
    // sepatu
    ctx.fillStyle = mixc(P.accent, '#000000', 0.25);
    ctx.beginPath();
    ctx.ellipse(fx + legW * 0.12, footY, legW * 0.72, legW * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  }

  // ---- BADAN ----
  P.bx = 0; P.by = by; P.bw = bw; P.th = th;
  P.hr = headR; P.hx = 0; P.hy = headY;
  P.faceAt = null; P.dimEyes = null;

  if (o.form && FORMS[o.form]) {
    FORMS[o.form](ctx, P);
  } else {
    torso(ctx, 0, by, bw, th, P.primary);
    if (o.shoulderPads) {
      ctx.fillStyle = P.accent;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * bw * 0.44, by - th * 0.42, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---- TANGAN (2): belakang lalu depan ----
  const shY = by - th * 0.34;
  const armW = B.armW * r;
  const armL = B.armL * r;
  const armSwing = moving ? -Math.sin(phase) * 0.5 : Math.sin(t * 1.7 + 1) * 0.06;
  let aFront = 0.22 + armSwing * 0.4;
  if (o.attackT > 0) aFront = -2.1 * (o.attackT) + 0.5 * (1 - o.attackT);
  else if (o.swingT > 0) aFront = -1.6 * (o.swingT) + 0.4 * (1 - o.swingT);
  const aBack = 0.3 - armSwing * 0.4;

  const hand = (ang, side) => {
    const sx = side * (bw * 0.5 - armW * 0.3);
    const hx2 = sx + Math.sin(ang) * armL;
    const hy2 = shY + Math.cos(ang) * armL;
    capsule(ctx, sx, shY, hx2, hy2, armW, P.hi, P.dark);
    const fistR = armW * (o.trait === 'tcd8' && side > 0 ? 0.85 : 0.62);
    ball(ctx, hx2, hy2, fistR, P.hi, { outline: P.dark });
    return { x: hx2, y: hy2 };
  };

  const handBack = hand(aBack + 0.15, -1);
  // perisai belakang (Neutron/Treg)
  if (o.shieldBack) {
    ctx.fillStyle = mixc(P.accent, '#ffffff', 0.25);
    ctx.strokeStyle = P.dark;
    ctx.lineWidth = Math.max(1.4, r * 0.08);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-bw * 0.86, shY - r * 0.1, r * 0.5, r * 1.15, r * 0.16);
    else ctx.rect(-bw * 0.86, shY - r * 0.1, r * 0.5, r * 1.15);
    ctx.fill(); ctx.stroke();
  }

  const handFront = hand(aFront, 1);
  // senjata di tangan depan
  const wep = o.weapon;
  if (wep === 'sword' || wep === 'dagger' || wep === 'spear' || wep === 'staff' || wep === 'brush') {
    ctx.save();
    ctx.translate(handFront.x, handFront.y);
    ctx.rotate(aFront < 0 ? -0.9 : 0.5);
    const L = wep === 'spear' ? r * 2.4 : wep === 'staff' ? r * 1.9 : r * (wep === 'sword' ? 1.6 : 0.95);
    ctx.strokeStyle = wep === 'staff' ? '#8a5a2a' : '#d9e4ec';
    ctx.lineWidth = Math.max(1.6, r * 0.13);
    ctx.beginPath(); ctx.moveTo(0, r * 0.2); ctx.lineTo(0, -L); ctx.stroke();
    if (wep === 'sword' || wep === 'dagger' || wep === 'spear') {
      ctx.fillStyle = wep === 'spear' ? P.accent : '#eef4f8';
      ctx.beginPath();
      ctx.moveTo(0, -L - r * (wep === 'spear' ? 0.34 : 0.3));
      ctx.lineTo(r * 0.16, -L + r * 0.12);
      ctx.lineTo(-r * 0.16, -L + r * 0.12);
      ctx.closePath();
      ctx.fill();
    }
    if (wep === 'staff') { ball(ctx, 0, -L - r * 0.14, r * 0.2, P.accent, {}); }
    if (wep === 'brush') { ctx.fillStyle = P.accent; ctx.beginPath(); ctx.ellipse(0, -L, r * 0.13, r * 0.24, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  // perisai depan besar (Mastia/Treg)
  if (o.shieldFront) {
    ctx.fillStyle = mixc(P.accent, '#ffffff', 0.15);
    ctx.strokeStyle = P.dark;
    ctx.lineWidth = Math.max(1.6, r * 0.1);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bw * 0.34, shY - r * 0.34, r * 0.62, r * 1.5, r * 0.2);
    else ctx.rect(bw * 0.34, shY - r * 0.34, r * 0.62, r * 1.5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.primary;
    ctx.beginPath(); ctx.arc(bw * 0.34 + r * 0.31, shY + r * 0.4, r * 0.18, 0, Math.PI * 2); ctx.fill();
  }

  // ---- KEPALA ----
  if (P.faceAt) {
    // bentuk musuh yang wajahnya di badan (spike/splitter)
    face(ctx, P.faceAt.x, P.faceAt.y, P.faceAt.r, o.mood || 'angry', P.dimEyes || P.accent, Math.sin(t * 3 + phase) > 0.94 ? 1 : 0);
  } else if (!o.form || o.form === 'runner' || o.form === 'tank' || o.form === 'boss') {
    ball(ctx, 0, headY, headR, P.primary, {});
    P.faceAt = null;
    const mood = o.mood || 'happy';
    if (mood === 'dim') face(ctx, 0, headY, headR, 'dim', P.dimEyes || P.accent, 0);
    else face(ctx, 0, headY, headR, mood, P.accent, Math.sin(t * 2.6 + phase * 0.3) > 0.96 ? 1 : 0);
  }

  // ---- TRAIT aksesori (di atas kepala/badan) ----
  if (o.trait && TRAITS[o.trait]) TRAITS[o.trait](ctx, P);

  ctx.restore();
}
