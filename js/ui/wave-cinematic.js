/**
 * wave-cinematic.js — E2 poin 6: CINEMATIC KEMENANGAN WAVE PENTING.
 *
 * Tiap wave milestone (kelipatan bossWaveEvery) selesai, gameplay dijeda dan
 * diputar video ilustrasi prosedural ±8 detik dengan tiga babak (canvas,
 * sprite gameplay asli — bukan lingkaran abstrak):
 *   BABAK 1 (0–2.6s) : imun DISERANG — virus mengepung, hero terdesak+merah.
 *   BABAK 2 (2.6–5.4s): imun MELAWAN & MENANG — dash + shockwave, virus pop.
 *   BABAK 3 (5.4–8s) : ancaman baru — SILUET VIRUS RAKSASA bangkit menjulang
 *                      dari kegelapan, mata menyala... layar memudar.
 * Selesai → kembali ke gameplay → RIA menyambut (dipasang pemanggil).
 * Bisa di-skip (tap / LEWATI). Non-recursive: hanya untuk wave milestone.
 */

const SPR = {};
function img(path) {
  if (!SPR[path]) { const im = new Image(); im.src = path; SPR[path] = im; }
  return SPR[path];
}

function drawSpr(ctx, im, x, y, h, opts = {}) {
  if (!im.complete || !im.naturalWidth) return;
  const w = h * (im.naturalWidth / im.naturalHeight);
  ctx.save();
  ctx.translate(x, y);
  if (opts.tilt) ctx.rotate(opts.tilt);
  const sq = opts.squash || 1;
  ctx.scale((opts.flip ? -1 : 1) / Math.sqrt(sq), Math.sqrt(sq));
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  if (opts.silhouette) ctx.filter = 'brightness(0.12) saturate(0.4)';
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
}

let playing = false;

/** Apakah cinematic wave sedang tayang (dipakai untuk menahan presenter dll). */
export function waveCineActive() { return playing; }

/**
 * Putar cinematic kemenangan wave. Pemanggil bertanggung jawab pause/resume.
 * @param {number} wave nomor wave yang baru selesai
 * @param {Function} onDone dipanggil setelah overlay tertutup
 */
export function playWaveCinematic(wave, onDone) {
  if (playing) { onDone && onDone(); return; }
  playing = true;

  const HERO = img('assets/sprites/hero_macrophage_idle.png');
  const HERO_ATK = img('assets/sprites/hero_macrophage_attack.png');
  const V1 = img('assets/sprites/enemy_virus.png');
  const V2 = img('assets/sprites/enemy_bakteri.png');
  const V3 = img('assets/sprites/enemy_virion.png');
  const BIG = img('assets/sprites/enemy_sel_kanker.png'); // ancaman raksasa babak 3

  const layer = document.createElement('div');
  layer.id = 'wave-cine-layer';
  layer.innerHTML = `
    <canvas id="wave-cine-canvas"></canvas>
    <div class="wave-cine-title" id="wave-cine-title"></div>
    <button class="wave-cine-skip" id="wave-cine-skip">LEWATI</button>`;
  document.body.appendChild(layer);
  const canvas = layer.querySelector('#wave-cine-canvas');
  const titleEl = layer.querySelector('#wave-cine-title');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const fit = () => {
    canvas.width = Math.round(window.innerWidth * DPR);
    canvas.height = Math.round(window.innerHeight * DPR);
  };
  fit();

  const DUR = 8000;
  let raf = 0;
  let closed = false;
  const t0 = performance.now();
  const parts = [];
  const burst = (x, y, color, n, sp) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      parts.push({ x, y, vx: Math.cos(a) * sp * (0.4 + Math.random()), vy: Math.sin(a) * sp * (0.4 + Math.random()), r: 2 + Math.random() * 3, life: 1, color });
    }
  };
  let burstDone = { a: false, b: false, c: false };

  const close = () => {
    if (closed) return;
    closed = true;
    playing = false;
    cancelAnimationFrame(raf);
    layer.classList.add('out');
    setTimeout(() => { layer.remove(); onDone && onDone(); }, 260);
  };
  layer.querySelector('#wave-cine-skip').addEventListener('click', close);

  const frame = (now) => {
    if (closed) return;
    const T = now - t0;
    if (T >= DUR) { close(); return; }
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H * 0.56;
    const hr = Math.min(W, H) * 0.17; // ukuran hero

    // latar gelap sinematik + vignette merah saat diserang
    const attacked = T < 2600;
    const bg = ctx.createRadialGradient(cx, cy, H * 0.1, cx, cy, H * 0.9);
    bg.addColorStop(0, attacked ? '#3d1f24' : T < 5400 ? '#173f39' : '#0b1517');
    bg.addColorStop(1, '#080f10');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // letterbox bar atas-bawah (bahasa film)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H * 0.08);
    ctx.fillRect(0, H * 0.92, W, H * 0.08);

    // shake babak 1 (dipukul) & momen ledakan babak 2
    let shx = 0, shy = 0;
    if ((T > 500 && T < 2400) || (T > 3600 && T < 4400)) {
      const k = T < 2600 ? 0.5 : 1;
      shx = (Math.random() - 0.5) * 8 * DPR * k;
      shy = (Math.random() - 0.5) * 8 * DPR * k;
    }
    ctx.setTransform(1, 0, 0, 1, shx, shy);

    if (T < 2600) {
      // ===== BABAK 1: DISERANG — virus mengepung dan memukul =====
      titleEl.textContent = `WAVE ${wave} — PASUKAN TERDESAK...`;
      const k = Math.min(1, T / 900);
      const ring = [ [V1, -1, 0.85], [V2, 1, 1.0], [V3, -0.55, 0.7], [V1, 0.55, 0.75] ];
      ring.forEach(([im, side, scale], i) => {
        const dist = hr * (3.6 - k * 1.9) * scale;
        const ang = side * (0.5 + i * 0.42);
        const lunge = Math.max(0, Math.sin((T - 500) / 260 + i * 1.7)) * hr * 0.35;
        drawSpr(ctx, im, cx + Math.cos(ang) * (dist - lunge), cy + Math.sin(ang) * (dist - lunge) * 0.5,
          hr * 1.5 * scale, { flip: side > 0, tilt: Math.sin(T / 200 + i) * 0.12 });
      });
      // hero terdesak: mengecil, merah berkedip saat kena pukul
      const hitFlash = T > 500 && Math.sin(T / 130) > 0.55;
      drawSpr(ctx, HERO, cx, cy + Math.sin(T / 150) * 3 * DPR, hr * 2 * (1 - k * 0.08), { squash: 1.06, tilt: Math.sin(T / 180) * 0.06 });
      if (hitFlash) {
        ctx.fillStyle = 'rgba(240,104,90,0.28)';
        ctx.beginPath(); ctx.arc(cx, cy, hr * 1.35, 0, Math.PI * 2); ctx.fill();
      }
    } else if (T < 5400) {
      // ===== BABAK 2: MELAWAN & MENANG — shockwave, virus pop satu-satu =====
      titleEl.textContent = 'IMUN BANGKIT MELAWAN!';
      const k = (T - 2600) / 2800;
      // shockwave emas mengembang
      if (T > 3400) {
        const kk = Math.min(1, (T - 3400) / 900);
        ctx.strokeStyle = `rgba(245,198,79,${1 - kk})`;
        ctx.lineWidth = (1 - kk) * 14 * DPR + 2;
        ctx.beginPath(); ctx.arc(cx, cy, kk * W * 0.55, 0, Math.PI * 2); ctx.stroke();
      }
      // virus terpental keluar + pop berurutan
      const foes = [ [V1, -1, 0.85, 3000, 'a'], [V2, 1, 1.0, 3600, 'b'], [V3, -0.55, 0.7, 4200, 'c'] ];
      for (const [im, side, scale, popT, key] of foes) {
        if (T < popT) {
          const fly = Math.max(0, (T - 2600) / (popT - 2600));
          const ang = side * 0.6;
          drawSpr(ctx, im, cx + Math.cos(ang) * hr * (2 + fly * 3.5), cy + Math.sin(ang) * hr * (1 + fly * 1.2),
            hr * 1.5 * scale, { flip: side > 0, tilt: fly * side * 1.6, alpha: 1 - fly * 0.25 });
        } else if (!burstDone[key]) {
          burstDone[key] = true;
          const ang = side * 0.6;
          burst(cx + Math.cos(ang) * hr * 5.5, cy + Math.sin(ang) * hr * 2.2, '#f0685a', 26, 5 * DPR);
        }
      }
      // hero maju gagah, pose attack, membesar
      drawSpr(ctx, HERO_ATK, cx, cy, hr * 2 * (1 + k * 0.25), { squash: 1 + Math.sin(T / 120) * 0.05 });
      if (T > 4600) {
        titleEl.textContent = 'ARENA BERSIH — KEMENANGAN!';
        ctx.fillStyle = `rgba(245,198,79,${0.5 + Math.sin(T / 90) * 0.3})`;
        ctx.font = `900 ${22 * DPR}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('★', cx, cy - hr * 1.9);
      }
    } else {
      // ===== BABAK 3: ANCAMAN BARU — raksasa bangkit dari kegelapan =====
      const k = Math.min(1, (T - 5400) / 1400);
      titleEl.textContent = 'TAPI... SESUATU YANG LEBIH BESAR DATANG';
      // hero kecil di kiri-bawah, menoleh
      drawSpr(ctx, HERO, W * 0.24, H * 0.72, hr * 1.5, { tilt: -0.06 });
      // siluet raksasa naik dari bawah-kanan, menjulang
      const bigH = hr * (3 + k * 4.5);
      drawSpr(ctx, BIG, W * 0.68, H * (1.05 - k * 0.5), bigH, { silhouette: k < 0.82, flip: true, squash: 1 + Math.sin(T / 300) * 0.03, alpha: Math.min(1, k * 1.6) });
      // mata menyala merah
      if (k > 0.45) {
        const glow = 0.4 + Math.sin(T / 110) * 0.3;
        ctx.fillStyle = `rgba(255,64,64,${glow})`;
        for (const dx of [-0.055, 0.055]) {
          ctx.beginPath();
          ctx.arc(W * (0.68 + dx), H * (1.05 - k * 0.5) - bigH * 0.18, 5 * DPR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // fade-out akhir
      if (T > 7300) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(0,0,0,${(T - 7300) / 700})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // partikel
    ctx.setTransform(1, 0, 0, 1, shx, shy);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 0.018;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * DPR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
