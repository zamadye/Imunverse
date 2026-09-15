/**
 * cutscene-2d.js — R3 (Narrative-Cinematic): renderer 2.5D layered.
 *
 * Spesifikasi story doc 7.1: "2D layered (parallax 3 layer) + partikel +
 * limited animation + VO — alih-alih full 3D cinematic (mahal & tidak perlu)".
 * Dipakai untuk: transisi antar-chapter, reveal boss bab 5, DAN fallback
 * otomatis pembuka/epilog saat WebGL tidak tersedia di device.
 *
 * Sprite = aset game yang SAMA (sprite-loader cache) → konsisten reference
 * sheet Character Agent. Partikel: RIA (sinyal abstrak biru-hijau, doc §3),
 * virion, sel darah. Semua prosedural (0 KB payload scene).
 *
 * API: createCutscene2D(canvas, sceneDef, opts) → { start, stop }
 *   opts = { speakers, onFrame(t), onEnd() }
 */

import { getSprite } from '../render/sprite-loader.js';

const EASE = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// Partikel kontinyu antar shot (state per scene)
function makeParticles(cfg = {}) {
  const n = (n) => {
    const a = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { a[i * 2] = Math.random() * 2 - 1; a[i * 2 + 1] = Math.random() * 2 - 1; }
    return a;
  };
  return {
    ria: n(cfg.riaCount || 300),
    vir: n(cfg.virCount || 150),
    bld: n(cfg.bldCount || 120),
    t: 0,
  };
}
function stepParticles(p, dt, speed) {
  p.t += dt;
  // sel darah mengalir ke kiri (aliran pembuluh)
  for (let i = 0; i < p.bld.length / 2; i++) {
    p.bld[i * 2] -= dt * (0.08 + (i % 5) * 0.02) * speed;
    if (p.bld[i * 2] < -1.15) p.bld[i * 2] = 1.15;
    p.bld[i * 2 + 1] += Math.sin(p.t * 0.7 + i) * dt * 0.01;
  }
  // virion melayang acak
  for (let i = 0; i < p.vir.length / 2; i++) {
    p.vir[i * 2] += Math.cos(p.t * 0.5 + i * 1.7) * dt * 0.05 * speed;
    p.vir[i * 2 + 1] += Math.sin(p.t * 0.4 + i * 2.3) * dt * 0.05 * speed;
    if (p.vir[i * 2] > 1.2) p.vir[i * 2] = -1.2; if (p.vir[i * 2] < -1.2) p.vir[i * 2] = 1.2;
    if (p.vir[i * 2 + 1] > 1.2) p.vir[i * 2 + 1] = -1.2; if (p.vir[i * 2 + 1] < -1.2) p.vir[i * 2 + 1] = 1.2;
  }
  // RIA: spiral orbit halus (muncul saat riaOn)
  for (let i = 0; i < p.ria.length / 2; i++) {
    const ang = p.t * (0.25 + (i % 7) * 0.05) + i;
    const r = 0.25 + (i % 11) * 0.06;
    p.ria[i * 2] = Math.cos(ang) * r;
    p.ria[i * 2 + 1] = Math.sin(ang * 1.3) * r * 0.7;
  }
}

// ---------------------------------------------------------------- lingkungan
function paintEnv(ctx, env, W, H, t) {
  if (env === 'ruang' || env === 'ruang_malam') {
    const malam = env === 'ruang_malam';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (malam) { g.addColorStop(0, '#2b3a55'); g.addColorStop(1, '#1a2438'); }
    else { g.addColorStop(0, '#fdf6e3'); g.addColorStop(1, '#f6e7cf'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // jendela + cahaya
    ctx.save();
    ctx.fillStyle = malam ? 'rgba(140,170,220,0.10)' : 'rgba(255,240,200,0.5)';
    ctx.fillRect(W * 0.68, H * 0.12, W * 0.2, H * 0.4);
    ctx.strokeStyle = malam ? 'rgba(160,190,235,0.3)' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 4;
    ctx.strokeRect(W * 0.68, H * 0.12, W * 0.2, H * 0.4);
    ctx.beginPath();
    ctx.moveTo(W * 0.78, H * 0.12); ctx.lineTo(W * 0.78, H * 0.52);
    ctx.moveTo(W * 0.68, H * 0.32); ctx.lineTo(W * 0.88, H * 0.32);
    ctx.stroke();
    // lantai
    ctx.fillStyle = malam ? '#141c2e' : '#e2c9a4';
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
    ctx.restore();
  } else if (env === 'mikro' || env === 'mikro_gelap' || env === 'kamar_rs') {
    if (env === 'kamar_rs') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#fff6e6'); g.addColorStop(1, '#ffe9cf');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f3d9b8'; ctx.fillRect(0, H * 0.75, W, H * 0.25);
      // jendela pagi besar
      ctx.fillStyle = 'rgba(255,236,180,0.85)';
      ctx.fillRect(W * 0.08, H * 0.1, W * 0.3, H * 0.42);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
      ctx.strokeRect(W * 0.08, H * 0.1, W * 0.3, H * 0.42);
    } else {
      const gelap = env === 'mikro_gelap';
      const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.05, W / 2, H / 2, W * 0.75);
      if (gelap) { g.addColorStop(0, '#3a1020'); g.addColorStop(1, '#150409'); }
      else { g.addColorStop(0, '#57182a'); g.addColorStop(1, '#200812'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // anyaman pembuluh darah
      ctx.save();
      ctx.strokeStyle = gelap ? 'rgba(200,80,120,0.10)' : 'rgba(255,120,140,0.14)';
      ctx.lineWidth = W * 0.03;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(W / 2 + Math.sin(t * 0.3 + i) * 8, H / 2, W * (0.32 + i * 0.2), H * (0.18 + i * 0.1), Math.sin(t * 0.1 + i) * 0.1, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function paintProp(ctx, type, W, H, t, opt = {}) {
  const cx = W / 2, cy = H / 2;
  switch (type) {
    case 'bed':
      ctx.save();
      ctx.fillStyle = '#8fae9f'; ctx.fillRect(cx - W * 0.18, cy + H * 0.05, W * 0.36, H * 0.16);
      ctx.fillStyle = '#f5f0e6'; ctx.fillRect(cx - W * 0.18, cy + H * 0.05, W * 0.36, H * 0.05);
      ctx.fillStyle = '#7a9a8c'; ctx.fillRect(cx - W * 0.19, cy + H * 0.21, W * 0.38, H * 0.03);
      ctx.restore();
      break;
    case 'hand': {
      // tangan Inang + luka (shot 1 — muncul pelan)
      const a = Math.min(1, Math.max(0, (opt.t - (opt.tFrom ?? opt.t)) / 0.6));
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = '#e8b98f';
      ctx.beginPath(); ctx.ellipse(cx + W * 0.04, cy + H * 0.12, W * 0.09, H * 0.045, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.beginPath(); ctx.ellipse(cx + W * 0.05, cy + H * 0.115, W * 0.02, H * 0.012, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      break;
    }
    case 'bed_big':
      ctx.save();
      ctx.fillStyle = '#8fae9f'; ctx.fillRect(-W * 0.2, cy + H * 0.1, W * 0.5, H * 0.4);
      ctx.fillStyle = '#f5f0e6'; ctx.fillRect(-W * 0.2, cy + H * 0.1, W * 0.5, H * 0.12);
      ctx.restore();
      break;
    case 'wound2d': {
      const cxW = W * 0.06, cyW = H * -0.05;
      const pulse = opt.pulse ? 1 + 0.25 * Math.sin(t * 4) : 1;
      ctx.save();
      const g = ctx.createRadialGradient(cxW, cyW, 2, cxW, cyW, W * 0.07 * pulse);
      g.addColorStop(0, '#ff6b5e'); g.addColorStop(0.5, '#c0392b'); g.addColorStop(1, 'rgba(120,20,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cxW, cyW, W * 0.07 * pulse, W * 0.045 * pulse, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,150,150,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cxW, cyW, W * 0.09 * pulse, W * 0.06 * pulse, 0.4, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'virionAhead': {
      // sel virion mendekat di depan (match-cut target)
      const p = Math.min(1, Math.max(0, (opt.t - opt.t0) / Math.max(0.01, (opt.t1 - opt.t0))));
      const r = W * (0.3 * (1 - p) + 0.08);
      const x = cx + W * 0.35 * (1 - p), y = cy + H * 0.1 * (1 - p);
      ctx.save();
      ctx.fillStyle = 'rgba(255,70,90,0.85)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,140,0.7)'; ctx.lineWidth = r * 0.12;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        ctx.lineTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'heatShimmer':
      ctx.save(); ctx.globalAlpha = 0.12 + 0.05 * Math.sin(t * 2);
      ctx.strokeStyle = '#ffb36b'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 14) {
          const y = H * (0.2 + i * 0.12) + Math.sin(x * 0.05 + t * 3 + i) * 8;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      break;
    case 'toxicDrift':
      ctx.save(); ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#7dd63f';
      for (let i = 0; i < 10; i++) {
        const x = ((i * 173 + t * 40) % (W + 60)) - 30;
        const y = H * (0.15 + (i % 5) * 0.16) + Math.sin(t + i) * 10;
        ctx.beginPath(); ctx.arc(x, y, 5 + (i % 4) * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      break;
    case 'staticFuzz':
      ctx.save(); ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#ffe082';
      for (let i = 0; i < 40; i++) {
        const x = (i * 97 + Math.sin(t * 7 + i) * 30) % W;
        const y = (i * 61 + Math.cos(t * 5 + i) * 30) % H;
        ctx.fillRect(x, y, 3, 3);
      }
      ctx.restore();
      break;
    case 'stormDrift':
      ctx.save(); ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#c58bff'; ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const x = ((i * 211 + t * 120) % (W + 100)) - 50;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 60, H); ctx.stroke();
      }
      ctx.restore();
      break;
    case 'shadowMass': {
      // Bayang Dalam — massa sel salah tumbuh (abstrak, pulse gelap)
      const pulse = 1 + 0.08 * Math.sin(t * 1.2);
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, W * 0.3 * pulse);
      g.addColorStop(0, 'rgba(20,5,15,0.95)'); g.addColorStop(0.7, 'rgba(60,10,40,0.6)'); g.addColorStop(1, 'rgba(60,10,40,0)');
      ctx.save(); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, W * 0.3 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(180,60,120,0.35)';
      for (let i = 0; i < 5; i++) {
        const a = t * 0.4 + (i / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * W * 0.18, cy + Math.sin(a) * W * 0.14, 14, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'bed_rs':
      ctx.save();
      ctx.fillStyle = '#d8e6ef'; ctx.fillRect(cx - W * 0.06, cy + H * 0.06, W * 0.34, H * 0.2);
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - W * 0.06, cy + H * 0.06, W * 0.34, H * 0.06);
      ctx.fillStyle = '#b9ccd8'; ctx.fillRect(cx - W * 0.07, cy + H * 0.26, W * 0.36, H * 0.03);
      ctx.fillStyle = '#9db4c4'; ctx.fillRect(cx + W * 0.3, cy - H * 0.06, W * 0.02, H * 0.3);
      ctx.restore();
      break;
    case 'inang2d': {
      // Inang (pasien) — silhouette lembut di ranjang (reveal penuh; tanpa aset
      // karakter → bentuk abstrak disengaja, konsist dgn gaya doc §3)
      const p = opt.pulse ? 1 + 0.06 * Math.sin(t * 2) : 1;
      ctx.save();
      const bx = cx + W * 0.08, by = cy + H * 0.1;
      ctx.fillStyle = `rgba(90,60,70,${opt.pulse ? 0.75 : 0.6})`;
      ctx.beginPath(); ctx.arc(bx, by - H * 0.055 * p, H * 0.05 * p, 0, Math.PI * 2); ctx.fill(); // kepala
      ctx.beginPath(); ctx.ellipse(bx + W * 0.05, by + H * 0.01, W * 0.075 * p, H * 0.045 * p, -0.2, 0, Math.PI * 2); ctx.fill(); // bahu
      if (opt.pulse) {
        const g = ctx.createRadialGradient(bx, by, 5, bx, by, W * 0.16);
        g.addColorStop(0, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, by, W * 0.16, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'sunbeam2d':
      ctx.save(); ctx.globalAlpha = 0.25 + 0.08 * Math.sin(t * 0.8);
      const g = ctx.createLinearGradient(W * 0.1, H * 0.1, W * 0.55, H * 0.75);
      g.addColorStop(0, 'rgba(255,230,170,0.9)'); g.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(W * 0.08, H * 0.1); ctx.lineTo(W * 0.38, H * 0.1);
      ctx.lineTo(W * 0.6, H * 0.85); ctx.lineTo(W * 0.2, H * 0.95);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
  }
}

// ---------------------------------------------------------------- aktor
function drawActor(ctx, who, x, y, s, t, breath, W, H, speakers) {
  const size = s * Math.min(W, H) * 2.2;
  const bob = Math.sin(t * 2.2) * size * 0.02 * (breath ? 1 : 0.4);
  const spk = speakers[who];
  const entry = spk ? getSprite(spk.sprite) : null;
  if (entry && entry.image && entry.image.width) {
    ctx.drawImage(entry.image, x * W - size / 2, y * H - size / 2 + bob, size, size);
  } else {
    // fallback: blob berwarna aksen speaker
    ctx.save();
    ctx.fillStyle = spk ? spk.accent : '#888';
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(x * W, y * H + bob, size * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- pemain
export function createCutscene2D(canvas, scene, opts) {
  const { speakers, onFrame, onEnd } = opts;
  const ctx = canvas.getContext('2d');
  const particles = makeParticles();
  let running = false;
  let startT = 0;
  let lastT = 0;
  let rafId = null;
  const shots = scene.shots2d;
  const total = shots.length ? shots[shots.length - 1].t1 : 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function shotAt(t) {
    for (const s of shots) if (t < s.t1) return { s, k: (t - s.t0) / (s.t1 - s.t0) };
    const last = shots[shots.length - 1];
    return { s: last, k: 1 };
  }

  function frame(now) {
    if (!running) return;
    const t = (now - startT) / 1000;
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const W = window.innerWidth, H = window.innerHeight;
    const { s, k } = shotAt(t);
    const e = EASE(Math.min(1, k));

    stepParticles(particles, dt, 1);

    // lingkungan
    paintEnv(ctx, s.env, W, H, t);

    // transform kamera (zoom + pan)
    const z = s.cam.zoom ? lerp(s.cam.zoom[0], s.cam.zoom[1], e) : 1;
    const px = s.cam.pan ? lerp(s.cam.pan[0], s.cam.pan[2], e) : 0;
    const py = s.cam.pan ? lerp(s.cam.pan[1], s.cam.pan[3], e) : 0;
    ctx.save();
    ctx.translate(W / 2 + px * W, H / 2 + py * H);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);

    // partikel belakang (sel darah + virion) utk env mikro
    if (s.env === 'mikro' || s.env === 'mikro_gelap') {
      ctx.save();
      for (let i = 0; i < particles.bld.length / 2; i++) {
        const x = (particles.bld[i * 2] + 1.15) / 2.3 * W;
        const y = (particles.bld[i * 2 + 1] + 1.15) / 2.3 * H;
        ctx.fillStyle = `rgba(255,150,170,${0.16 + (i % 3) * 0.05})`;
        ctx.beginPath(); ctx.ellipse(x, y, 5 + (i % 4) * 2, 3.5 + (i % 3) * 1.5, 0.4, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < particles.vir.length / 2; i++) {
        const x = (particles.vir[i * 2] + 1.2) / 2.4 * W;
        const y = (particles.vir[i * 2 + 1] + 1.2) / 2.4 * H;
        const r = 4 + (i % 5) * 2;
        ctx.fillStyle = 'rgba(255,90,110,0.75)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,110,0.45)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - r * 1.5, y); ctx.lineTo(x + r * 1.5, y);
        ctx.moveTo(x, y - r * 1.5); ctx.lineTo(x, y + r * 1.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // props
    for (const pr of s.props || []) {
      if (pr.tFrom !== undefined && t < pr.tFrom) continue;
      paintProp(ctx, pr.type, W, H, t, { ...pr, t, t0: s.t0, t1: s.t1 });
    }

    // aktor
    for (const a of s.actors || []) {
      let ax = a.x, ay = a.y;
      if (a.walkFrom !== undefined) { // masuk dari kiri
        const wp = Math.min(1, Math.max(0, (t - s.t0) / 4));
        ax = lerp(a.walkFrom, a.x, EASE(wp));
      }
      drawActor(ctx, a.who, ax, ay, a.s || 0.4, t, true, W, H, speakers);
    }

    // RIA = partikel (muncul saat shot.riaOn)
    if (s.riaOn !== undefined && t >= s.riaOn) {
      const glow = Math.min(1, (t - s.riaOn) / 1.5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cx = W * 0.5, cy = H * 0.42;
      for (let i = 0; i < particles.ria.length / 2; i++) {
        const x = cx + particles.ria[i * 2] * W * 0.28;
        const y = cy + particles.ria[i * 2 + 1] * H * 0.24;
        const a = (0.2 + 0.6 * Math.abs(Math.sin(t * 2 + i))) * glow;
        ctx.fillStyle = `rgba(${i % 3 ? 120 : 90},240,220,${a})`;
        ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 4) * 0.7, 0, Math.PI * 2); ctx.fill();
      }
      // inti sinyal
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, W * 0.09);
      g.addColorStop(0, `rgba(160,255,235,${0.5 * glow})`);
      g.addColorStop(1, 'rgba(160,255,235,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, W * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore(); // kamera

    // match-cut flash
    if (s.matchcut) {
      const mp = Math.min(1, Math.max(0, (t - s.t0) / 0.35));
      const flash = 1 - EASE(mp);
      if (flash > 0.01) {
        ctx.save();
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.95})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
    // fade putih final (epilog)
    if (s.fadeWhite) {
      const fp = Math.min(1, Math.max(0, (t - s.t0) / (s.t1 - s.t0)));
      if (fp > 0.6) {
        const a = (fp - 0.6) / 0.4;
        ctx.save();
        ctx.fillStyle = `rgba(255,252,240,${a * a})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    // letterbox
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H * 0.055);
    ctx.fillRect(0, H - H * 0.055, W, H * 0.055);

    if (onFrame) onFrame(t, s);

    if (t >= total) {
      running = false;
      if (onEnd) onEnd();
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  return {
    start() {
      resize();
      window.addEventListener('resize', resize);
      running = true;
      startT = performance.now();
      lastT = startT;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    },
  };
}
