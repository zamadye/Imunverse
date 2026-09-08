/**
 * cine-banner.js — VIDEO CINEMATIC banner home (Fase 15).
 *
 * Loop 6 detik ala trailer: pasukan imun (T-Bolt) melawan virus —
 * tembakan homing, ledakan partikel, shockwave ultimate, screen shake,
 * spawn virus baru. Digambar prosedural Canvas 2D (palet pastel game),
 * tanpa aset video → ringan & selalu tajam. Loop hanya saat dashboard
 * tampil & slide banner 1 terlihat (startBannerCine/stopBannerCine).
 */

import { t as tr } from '../systems/i18n.js'; // alias: hindari shadow dgn param waktu frame
let rafId = 0;
let running = false;

const TEAL = '#35b3a0';
const TEAL_DEEP = '#1f7a70';
const GOLD = '#f5c64f';
const RED = '#f0685a';
const PURPLE = '#a06fd0';
const INK = '#123f3a';

function blob(ctx, x, y, r, color, squash = 1) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.2, x, y, r);
  g.addColorStop(0, mix(color, '#ffffff', 0.45));
  g.addColorStop(1, mix(color, '#000000', 0.18));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r / Math.sqrt(squash), r * Math.sqrt(squash), 0, 0, Math.PI * 2);
  ctx.fill();
}

function face(ctx, x, y, r, mood) {
  ctx.fillStyle = INK;
  const ex = r * 0.36, ey = -r * 0.12, er = Math.max(1.4, r * 0.11);
  if (mood === 'dead') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.4, r * 0.09);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * ex - er, y + ey - er); ctx.lineTo(x + s * ex + er, y + ey + er);
      ctx.moveTo(x + s * ex + er, y + ey - er); ctx.lineTo(x + s * ex - er, y + ey + er);
      ctx.stroke();
    }
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + s * ex, y + ey, er, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.4, r * 0.1);
  ctx.beginPath();
  if (mood === 'angry') { ctx.arc(x, y + r * 0.28, r * 0.26, Math.PI * 1.15, Math.PI * 1.85); }
  else if (mood === 'ouch') { ctx.arc(x, y + r * 0.42, r * 0.22, Math.PI * 1.1, Math.PI * 1.9); }
  else { ctx.arc(x, y + r * 0.14, r * 0.3, Math.PI * 0.15, Math.PI * 0.85); }
  ctx.stroke();
  if (mood === 'angry') {
    ctx.lineWidth = Math.max(1.6, r * 0.12);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * ex - s * er * 1.6, y + ey - er * 2.6);
      ctx.lineTo(x + s * ex + s * er * 1.2, y + ey - er * 1.2);
      ctx.stroke();
    }
  }
}

function spikeRing(ctx, x, y, r, n, rot, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI * 2) / n;
    const sx = x + Math.cos(a) * r * 1.02, sy = y + Math.sin(a) * r * 1.02;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * r * 0.26, sy + Math.sin(a) * r * 0.26);
    ctx.lineTo(sx + Math.cos(a + 0.5) * r * 0.12, sy + Math.sin(a + 0.5) * r * 0.12);
    ctx.lineTo(sx + Math.cos(a - 0.5) * r * 0.12, sy + Math.sin(a - 0.5) * r * 0.12);
    ctx.closePath();
    ctx.fill();
  }
}

function mix(hex, hex2, k) {
  const p = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = p(hex), b = p(hex2);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;
}

/**
 * Mulai cinematic di elemen canvas. Aman dipanggil ulang.
 */
// E2 poin 4: SPRITE GAME ASLI di cinematic home — pemain melihat karakter
// yang sama dengan yang dimainkan (hero Mako + virus/bakteri musuh nyata),
// bukan lingkaran abstrak. Dimuat sekali, digambar tiap frame.
const CINE_SPRITES = {};
function cineImg(path) {
  if (!CINE_SPRITES[path]) {
    const im = new Image();
    im.src = path;
    CINE_SPRITES[path] = im;
  }
  return CINE_SPRITES[path];
}
/** Gambar sprite karakter: berdiri di titik (x, y-tengah), tinggi h, squash napas. */
function drawChar(ctx, img, x, y, h, squash = 1, flip = false, tilt = 0) {
  if (!img.complete || !img.naturalWidth) return false;
  const w = h * (img.naturalWidth / img.naturalHeight);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale((flip ? -1 : 1) / Math.sqrt(squash), Math.sqrt(squash));
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

export function startBannerCine(canvas) {
  if (!canvas) return;
  if (running) stopBannerCine(); // Fase 15: ganti instance — jangan biarkan start dibatalkan diam-diam
  running = true;
  // pre-load pemain & musuh (sprite gameplay asli)
  const HERO_IDLE = cineImg('assets/sprites/hero_macrophage_idle.png');
  const HERO_ATK = cineImg('assets/sprites/hero_macrophage_attack.png');
  const VIRUS_A = cineImg('assets/sprites/enemy_virus.png');
  const VIRUS_B = cineImg('assets/sprites/enemy_bakteri.png');
  const VIRUS_C = cineImg('assets/sprites/enemy_virion.png');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = Math.round(rect.width * DPR);
    canvas.height = Math.round(rect.height * DPR);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // E1 poin 3: AMBIENCE ORGAN — dunia dalam tubuh yang hidup: sel darah
  // merah mengalir, plasma dots, dinding pembuluh berdenyut ikut detak
  // jantung. Ini yang membuat panggung terasa "real imun & organ", bukan
  // lantai pastel kosong.
  const rbc = []; // red blood cells drift
  for (let i = 0; i < 9; i++) {
    rbc.push({ u: Math.random(), v: 0.12 + Math.random() * 0.76, s: 0.5 + Math.random() * 0.7, sp: 0.35 + Math.random() * 0.5, ph: Math.random() * 7 });
  }
  const plasma = [];
  for (let i = 0; i < 22; i++) {
    plasma.push({ u: Math.random(), v: Math.random(), r: 0.6 + Math.random() * 1.8, sp: 0.15 + Math.random() * 0.3 });
  }

  // Partikel sederhana
  const parts = [];
  const burst = (x, y, color, n, sp) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      parts.push({ x, y, vx: Math.cos(a) * sp * (0.4 + Math.random()), vy: Math.sin(a) * sp * (0.4 + Math.random()), r: 1.5 + Math.random() * 2.5, life: 1, color });
    }
  };

  let t0 = performance.now();
  const LOOP = 6000;

  const frame = (now) => {
    if (!running) return;
    const W = canvas.width, H = canvas.height;
    const t = ((now - t0) % LOOP) / LOOP; // 0..1
    const T = t * LOOP; // ms dalam loop

    // E1 poin 3: INTERIOR PEMBULUH DARAH — gradien organ hangat + detak
    // jantung (seluruh dunia "berdenyut" halus 72 bpm) = hook biologis nyata.
    const beat = Math.pow(Math.max(0, Math.sin(now / 833 * Math.PI * 2)), 6); // ~72bpm
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, mix('#f3d9cf', '#f6c9bd', beat * 0.5));
    bg.addColorStop(0.5, mix('#eecfc4', '#f0bfb3', beat * 0.5));
    bg.addColorStop(1, mix('#e2bdb2', '#e6aca0', beat * 0.5));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // DINDING PEMBULUH atas & bawah — lengkung organik berdenyut
    ctx.fillStyle = mix('#d89a8c', '#e08a7a', beat * 0.6);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += W / 14) {
      ctx.lineTo(x, H * (0.1 + beat * 0.012) + Math.sin(x / W * 6.3 + now / 900) * H * 0.035);
    }
    ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 14) {
      ctx.lineTo(x, H * (0.9 - beat * 0.012) + Math.sin(x / W * 6.3 + now / 1100 + 2) * H * 0.035);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // SEL DARAH MERAH mengalir (donat bikonkaf khas eritrosit)
    for (const c of rbc) {
      c.u += c.sp * 0.0016;
      if (c.u > 1.1) { c.u = -0.1; c.v = 0.12 + Math.random() * 0.76; }
      const rx = c.u * W, ry = c.v * H + Math.sin(now / 700 + c.ph) * H * 0.02;
      const rr = H * 0.055 * c.s;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#e0655a';
      ctx.beginPath(); ctx.ellipse(rx, ry, rr, rr * 0.72, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c94f45';
      ctx.beginPath(); ctx.ellipse(rx, ry, rr * 0.45, rr * 0.3, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // plankton plasma halus
    ctx.fillStyle = 'rgba(255,246,238,0.5)';
    for (const pp of plasma) {
      pp.u += pp.sp * 0.0012;
      if (pp.u > 1.05) pp.u = -0.05;
      ctx.beginPath(); ctx.arc(pp.u * W, pp.v * H, pp.r * DPR, 0, Math.PI * 2); ctx.fill();
    }
    // vignette organik — fokus mata ke tengah panggung
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(120,40,30,0)');
    vg.addColorStop(1, 'rgba(120,40,30,0.22)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // SCREEN SHAKE + PUNCH-ZOOM saat momen epic (E1 poin 3: impact terasa)
    const shake = T > 2350 && T < 2550 ? (2550 - T) / 200 : T > 4450 && T < 4700 ? (4700 - T) / 250 : 0;
    const punch = 1 + shake * 0.045;
    ctx.setTransform(punch, 0, 0, punch,
      (Math.random() - 0.5) * shake * 10 * DPR - (punch - 1) * W / 2,
      (Math.random() - 0.5) * shake * 10 * DPR - (punch - 1) * H / 2);
    // IMPACT FLASH — frame putih 1-2 frame saat ledakan (bahasa film aksi)
    if ((T > 2350 && T < 2420) || (T > 4550 && T < 4620)) {
      ctx.fillStyle = `rgba(255,244,230,${T % 100 < 50 ? 0.32 : 0.12})`;
      ctx.fillRect(-W, -H, W * 3, H * 3);
    }

    const cx = W * 0.5, cy = H * 0.54;
    const pr = H * 0.21; // radius hero — sinematik

    // ---- timeline virus ----
    // Virus A: masuk 0-1.4s, tertembak 1.6-2.4s → pop
    const va = {
      x: W * 0.9 - Math.min(1, T / 1400) * W * 0.16,
      y: H * 0.34 + Math.sin(now / 120) * 4 * DPR,
      r: pr * 0.52,
      alive: T < 2450,
    };
    // Virus B: mengejar 0.8-4.4s → pop saat ultimate
    const chase = Math.min(1, Math.max(0, (T - 800) / 3600));
    const vb = {
      x: W * 0.97 - chase * W * 0.3,
      y: H * 0.72 - chase * H * 0.1,
      r: pr * 0.46,
      alive: T < 4600,
    };
    // Virus C (kecil): muncul 4.8s → loop baru
    const vc = { x: W * 0.88, y: H * 0.24, r: pr * 0.34, alive: T > 4800 || T < 300 };

    const dashX = T > 2900 && T < 3600 ? Math.sin((T - 2900) / 700 * Math.PI) * W * 0.09 : 0;
    const px = cx + dashX;
    const py = cy - Math.abs(Math.sin(now / 300)) * 3 * DPR;

    // bayangan
    ctx.fillStyle = 'rgba(18,63,58,0.14)';
    for (const v of [va, vb]) if (v.alive) {
      ctx.beginPath(); ctx.ellipse(v.x, v.y + v.r * 1.15, v.r * 0.8, v.r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(px, py + pr * 1.12, pr * 0.9, pr * 0.26, 0, 0, Math.PI * 2); ctx.fill();

    // ---- ULTIMATE shockwave (4.4-5.2s) ----
    if (T > 4450 && T < 5300) {
      const k = (T - 4450) / 850;
      ctx.strokeStyle = mix(GOLD, '#ffffff', k * 0.6);
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = (1 - k) * 10 * DPR + 2;
      ctx.beginPath();
      ctx.arc(px, py, k * W * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ---- charge glow + tembakan homing (1.5-2.4s) ----
    let shotA = null;
    if (T > 1500 && T < 2450) {
      const k = (T - 1500) / 950;
      shotA = Math.atan2(va.y - py, va.x - px);
      // muzzle glow
      const g = ctx.createRadialGradient(px + Math.cos(shotA) * pr, py + Math.sin(shotA) * pr, 1, px, py, pr * (1 + k * 0.4));
      g.addColorStop(0, 'rgba(255,224,130,0.85)');
      g.addColorStop(1, 'rgba(255,224,130,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, pr * (1 + k * 0.4), 0, Math.PI * 2); ctx.fill();
      // proyektil homing
      for (let i = -1; i <= 1; i++) {
        const kk = Math.min(1, Math.max(0, k * 1.25 - Math.abs(i) * 0.16));
        if (kk <= 0 || kk >= 1) continue;
        const sx = px + Math.cos(shotA + i * 0.35) * (pr + kk * (va.x - px) * 0.92);
        const sy = py + Math.sin(shotA + i * 0.35) * (pr + kk * (va.y - py) * 0.92);
        ctx.fillStyle = GOLD;
        ctx.beginPath(); ctx.arc(sx, sy, 4.4 * DPR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,198,79,0.55)';
        ctx.lineWidth = 2 * DPR;
        ctx.beginPath(); ctx.moveTo(sx - Math.cos(shotA) * 12 * DPR, sy - Math.sin(shotA) * 12 * DPR); ctx.lineTo(sx, sy); ctx.stroke();
      }
    }

    // ---- LEDAKAN virus A (2.35-2.6s) ----
    if (T > 2350 && T < 2700) {
      const k = (T - 2350) / 350;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = RED;
      ctx.lineWidth = 4 * DPR;
      ctx.beginPath(); ctx.arc(va.x, va.y, va.r * (1 + k * 1.6), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ---- HERO: sprite Mako asli — pose attack saat menembak/ultimate ----
    const squash = 1 + Math.sin(now / 260) * 0.04;
    const heroAttacking = (T > 1500 && T < 2600) || (T > 4300 && T < 5100);
    const heroImg = heroAttacking ? HERO_ATK : HERO_IDLE;
    const heroTilt = T > 2900 && T < 3600 ? Math.sin((T - 2900) / 700 * Math.PI) * 0.18 : 0;
    if (!drawChar(ctx, heroImg, px, py, pr * 2.3, squash, false, heroTilt)) {
      blob(ctx, px, py, pr, TEAL, squash); // fallback saat sprite belum termuat
      face(ctx, px, py, pr, 'happy');
    }
    // aura charge menjelang ultimate
    if (T > 4000 && T < 4600) {
      const k = (T - 4000) / 600;
      ctx.strokeStyle = mix(TEAL, GOLD, k);
      ctx.globalAlpha = 0.5 + Math.sin(now / 60) * 0.3;
      ctx.lineWidth = 3 * DPR;
      ctx.beginPath(); ctx.arc(px, py, pr * (1.18 + Math.sin(now / 90) * 0.06), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ---- VIRUS: sprite musuh gameplay asli (virus, bakteri, virion) ----
    for (const [v, img, color] of [[va, VIRUS_A, RED], [vb, VIRUS_B, PURPLE], [vc, VIRUS_C, RED]]) {
      if (!v.alive) continue;
      const wob = 1 + Math.sin(now / 170 + v.x) * 0.06;
      const hurt = v === va && T > 2100; // kena tembak → gemetar
      const shakeX = hurt ? (Math.random() - 0.5) * 4 * DPR : 0;
      const tilt = Math.sin(now / 300 + v.y) * 0.08 + (hurt ? (Math.random() - 0.5) * 0.2 : 0);
      if (!drawChar(ctx, img, v.x + shakeX, v.y, v.r * 2.2, wob, true, tilt)) {
        spikeRing(ctx, v.x, v.y, v.r, 9, now / 700, mix(color, '#000000', 0.12));
        blob(ctx, v.x, v.y, v.r, color, wob);
        face(ctx, v.x, v.y, v.r, hurt ? 'ouch' : 'angry');
      }
    }

    // HP mini di atas musuh
    ctx.font = `900 ${9 * DPR}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (const v of [vb, vc]) if (v.alive) {
      ctx.fillStyle = 'rgba(18,63,58,0.5)';
      ctx.fillRect(v.x - v.r, v.y - v.r - 10 * DPR, v.r * 2, 4 * DPR);
      ctx.fillStyle = GOLD;
      ctx.fillRect(v.x - v.r, v.y - v.r - 10 * DPR, v.r * 2 * (v === vb ? 1 - chase * 0.9 : 0.6), 4 * DPR);
    }

    // Partikel
    ctx.noCtxAlert = 1;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 0.02;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * DPR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (T > 2350 && T < 2365) burst(va.x, va.y, RED, 16, 3 * DPR);
    if (T > 4550 && T < 4565) { burst(vb.x, vb.y, PURPLE, 18, 3.4 * DPR); burst(px, py, GOLD, 22, 4 * DPR); }

    // Judul kecil sinematik — bug trailer kanan-bawah (bebas badge & kartu)
    ctx.globalAlpha = 0.5 + Math.min(0.3, T / 1200 * 0.3);
    ctx.fillStyle = INK;
    ctx.font = `900 ${11 * DPR}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(tr('⬡ IMUNVERSE'), W - 12 * DPR, H - 16 * DPR);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;

    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
    },
  };
}

export function stopBannerCine() {
  running = false;
  cancelAnimationFrame(rafId);
}
