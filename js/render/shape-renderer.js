/**
 * shape-renderer.js — Fungsi gambar reusable untuk elemen DINAMIS
 * (proyektil, particle, glow pulse, health bar, dsb) via Canvas 2D shape-code.
 * Karakter (hero/musuh/item) digambar lewat drawImage() sprite — lihat
 * sprite-loader.js. Semua fungsi menerima ctx sebagai parameter pertama.
 */

/** Lingkaran terisi. */
export function drawCircle(ctx, x, y, r, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Proyektil: kapsul bercahaya searah heading + trail pendek.
 */
export function drawProjectile(ctx, p, time) {
  const tail = 10;
  const tx = p.x - Math.cos(p.angle) * tail;
  const ty = p.y - Math.sin(p.angle) * tail;

  // trail
  ctx.strokeStyle = p.color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = p.radius * 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  // inti proyektil
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.globalAlpha = 1;

  // kilau denyut halus
  drawPulseGlow(ctx, p.x, p.y, p.radius * 1.6, p.color, time, p.uid);
}

/**
 * Particle: titik memudar mengikuti sisa umur.
 */
export function drawParticle(ctx, particle) {
  const t = Math.max(0, particle.life / particle.maxLife);
  ctx.globalAlpha = t;
  ctx.fillStyle = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size * (0.5 + t * 0.5), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Glow pulse: lingkaran glow yang radius & opacity-nya berdenyut dengan sin(time).
 * `phase` dipakai untuk mendesinkronkan antar objek.
 */
export function drawPulseGlow(ctx, x, y, baseRadius, color, time, phase = 0, intensity = 1) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 5 + phase * 1.7);
  const r = baseRadius * (0.85 + pulse * 0.35);
  const alpha = (0.12 + pulse * 0.22) * intensity;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
  g.addColorStop(0, colorWithAlpha(color, alpha));
  g.addColorStop(1, colorWithAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Health bar di atas entitas (dunia). Otomatis sembunyi bila HP penuh
 * (kecuali `alwaysVisible`).
 */
export function drawHealthBar(ctx, x, y, width, height, pct, color = '#7ae582', alwaysVisible = false) {
  if (pct >= 1 && !alwaysVisible) return;
  const w = width;
  const h = height;
  const px = x - w / 2;
  const py = y - h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(px - 1, py - 1, w + 2, h + 2);
  ctx.fillStyle = '#26313d';
  ctx.fillRect(px, py, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(px, py, w * Math.max(0, Math.min(1, pct)), h);
  // garis kilau tipis di atas
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(px, py, w * Math.max(0, Math.min(1, pct)), Math.max(1, h * 0.28));
}

/**
 * Efek tebasan melee: arc yang mengembang & memudar.
 */
export function drawSwipeArc(ctx, fx) {
  const t = 1 - fx.life / fx.maxLife; // 0..1 progress
  const alpha = fx.life / fx.maxLife;
  const r = fx.radius * (0.75 + t * 0.45);
  const half = fx.arc / 2;
  ctx.globalAlpha = alpha * 0.75;
  ctx.strokeStyle = fx.color;
  ctx.lineWidth = 10 * alpha + 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r, fx.angle - half, fx.angle + half);
  ctx.stroke();
  // isi arc tipis
  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle = fx.color;
  ctx.beginPath();
  ctx.moveTo(fx.x, fx.y);
  ctx.arc(fx.x, fx.y, r * 0.9, fx.angle - half, fx.angle + half);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Efek ledakan boss: cincin mengembang.
 */
export function drawBlastRing(ctx, fx) {
  const t = 1 - fx.life / fx.maxLife;
  const r = fx.radius * (0.3 + t * 0.9);
  ctx.globalAlpha = (1 - t) * 0.8;
  ctx.strokeStyle = fx.color;
  ctx.lineWidth = 8 * (1 - t) + 2;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = (1 - t) * 0.25;
  ctx.fillStyle = fx.color;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Telegraph AOE boss: lingkaran bahaya yang "mengisi" selama telegraph,
 * digambar dari state musuh boss (dipanggil renderer).
 */
export function drawTelegraph(ctx, enemy, cfg) {
  const st = enemy.areaState;
  if (st.phase !== 'telegraph') return;
  const progress = 1 - st.telegraphT / cfg.telegraphTime; // 0..1
  const x = enemy.x;
  const y = enemy.y;
  const r = cfg.radius;

  // area bahaya
  ctx.globalAlpha = 0.14 + Math.sin(progress * Math.PI) * 0.12;
  ctx.fillStyle = '#ff4059';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // cincin luar
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#ff4059';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // cincin progress mengisi
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#ffd93d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Joystick virtual (digambar hanya saat aktif) — memakai aset PNG
 * fx_joystick_base.png & fx_joystick_knob.png lewat drawSprite.
 */
export function drawJoystick(ctx, joy, maxRadius, drawImageFn) {
  if (!joy.active) return;
  const base = 'assets/sprites/fx_joystick_base.png';
  const knob = 'assets/sprites/fx_joystick_knob.png';
  drawImageFn(base, joy.originX, joy.originY, maxRadius * 2.3);
  // knob (dibatasi radius)
  let dx = joy.x - joy.originX;
  let dy = joy.y - joy.originY;
  const len = Math.hypot(dx, dy);
  if (len > maxRadius) {
    dx = (dx / len) * maxRadius;
    dy = (dy / len) * maxRadius;
  }
  drawImageFn(knob, joy.originX + dx, joy.originY + dy, maxRadius * 0.85);
}

/**
 * Angka damage mengambang (world-space).
 */
export function drawDamageNumber(ctx, n, time) {
  const t = Math.max(0, n.life / n.maxLife);
  const pop = 1 + (1 - t) * 0.25;
  ctx.globalAlpha = Math.min(1, t * 1.6);
  ctx.font = `900 ${Math.round(n.size * pop)}px Nunito, "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(18,63,58,0.85)';
  ctx.strokeText(n.text, n.x, n.y);
  ctx.fillStyle = n.color;
  ctx.fillText(n.text, n.x, n.y);
  ctx.globalAlpha = 1;
}

/**
 * Bintang hit damage (aset fx_hit.png) — membesar & memudar.
 */
export function drawHitSpark(ctx, fx, drawImageFn) {
  const t = 1 - fx.life / fx.maxLife; // 0..1
  const alpha = fx.life / fx.maxLife;
  const size = (fx.big ? 52 : 34) * (0.7 + t * 0.6);
  ctx.globalAlpha = alpha;
  drawImageFn('assets/sprites/fx_hit.png', fx.x, fx.y, size, fx.rot + t * 0.8);
  ctx.globalAlpha = 1;
}

/**
 * Panah penunjuk arah boss di tepi layar bila boss di luar pandangan.
 * camX/camY = posisi kamera; w/h = ukuran viewport CSS.
 */
export function drawBossIndicator(ctx, boss, camX, camY, w, h, time) {
  const sx = boss.x - camX + w / 2;
  const sy = boss.y - camY + h / 2;
  const margin = 46;
  if (sx > margin && sx < w - margin && sy > margin && sy < h - margin) return; // masih terlihat

  const cx = w / 2;
  const cy = h / 2;
  const angle = Math.atan2(sy - cy, sx - cx);
  // posisi di tepi layar (dengan margin)
  const edgeX = cx + Math.cos(angle) * (Math.min(w, h) / 2 - 26);
  const edgeY = cy + Math.sin(angle) * (Math.min(h, w) / 2 - 26);

  const pulse = 0.6 + 0.4 * Math.sin(time * 6);
  ctx.save();
  ctx.translate(edgeX, edgeY);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.5 + pulse * 0.5;
  ctx.fillStyle = '#ff4059';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Minimap bulat di HUD. */
export function drawMinimap(ctx, canvas, run, player, mapRadius) {
  const w = canvas.width;
  const h = canvas.height;
  const scale = (w / 2 - 6) / mapRadius;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 2, 0, Math.PI * 2);
  ctx.clip();

  // nutrisi
  ctx.fillStyle = 'rgba(255,217,61,0.5)';
  for (const p of run.pickups) {
    const dx = (p.x - player.x) * scale;
    const dy = (p.y - player.y) * scale;
    if (Math.abs(dx) > cx || Math.abs(dy) > cy) continue;
    ctx.fillRect(cx + dx - 1, cy + dy - 1, 2, 2);
  }
  // musuh
  for (const e of run.enemies) {
    if (!e.alive) continue;
    const dx = (e.x - player.x) * scale;
    const dy = (e.y - player.y) * scale;
    if (Math.abs(dx) > cx || Math.abs(dy) > cy) continue;
    ctx.fillStyle = e.isBoss ? '#ff4059' : 'rgba(255,107,107,0.85)';
    const s = e.isBoss ? 5 : 2.5;
    ctx.fillRect(cx + dx - s / 2, cy + dy - s / 2, s, s);
  }
  // player
  ctx.fillStyle = '#e8f6f3';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ------------------------------------------------------------------
// Util warna
// ------------------------------------------------------------------
const colorCache = new Map();

/** Ubah '#rrggbb' + alpha jadi rgba() string (di-cache). */
export function colorWithAlpha(hex, alpha) {
  const key = hex + '|' + alpha.toFixed(2);
  if (colorCache.has(key)) return colorCache.get(key);
  let r = 255, g = 255, b = 255;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (m) {
    const int = parseInt(m[1], 16);
    r = (int >> 16) & 255;
    g = (int >> 8) & 255;
    b = int & 255;
  }
  const out = `rgba(${r},${g},${b},${alpha})`;
  colorCache.set(key, out);
  return out;
}
