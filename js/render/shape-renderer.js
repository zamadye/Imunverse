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
  // knob (dibatasi radius)
  let dx = joy.x - joy.originX;
  let dy = joy.y - joy.originY;
  const len = Math.hypot(dx, dy);
  if (len > maxRadius) {
    dx = (dx / len) * maxRadius;
    dy = (dy / len) * maxRadius;
  }
  // UI/UX BUILD 42: sprite dasar (alpha maks 0,69, teal muda) nyaris lenyap di
  // lantai krem → pemain tidak melihat umpan balik arah. Gambar CINCIN dasar
  // kontras + PANAH arah di tepi cincin sebelum sprite (sprite tetap dipakai).
  ctx.save();
  ctx.translate(joy.originX, joy.originY);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,253,244,0.95)';
  ctx.fillStyle = 'rgba(18,63,58,0.22)';
  ctx.beginPath();
  ctx.arc(0, 0, maxRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(18,63,58,0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, maxRadius + 4, 0, Math.PI * 2);
  ctx.stroke();
  if (len > 6) {
    // panah arah (segitiga) di tepi cincin — arah gerak terbaca dari sudut mata
    const a = Math.atan2(dy, dx);
    ctx.rotate(a);
    ctx.translate(maxRadius + 12, 0);
    ctx.fillStyle = '#fffdf4';
    ctx.strokeStyle = 'rgba(18,63,58,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(9, 0); ctx.lineTo(-6, 8); ctx.lineTo(-3, 0); ctx.lineTo(-6, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  drawImageFn(base, joy.originX, joy.originY, maxRadius * 2.3);
  drawImageFn(knob, joy.originX + dx, joy.originY + dy, maxRadius * 0.85);
}

/**
 * Angka damage mengambang (world-space).
 */
export function drawDamageNumber(ctx, n, time) {
  const t = Math.max(0, n.life / n.maxLife);
  const pop = 1 + (1 - t) * 0.35;
  ctx.globalAlpha = Math.min(1, t * 1.6);
  ctx.font = `900 ${Math.round(n.size * pop * 1.3)}px Nunito, "Segoe UI", system-ui, sans-serif`;
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
 * Impact pulse: ring kompresi per hit landing + 6 garis radial pendek.
 * Shape-only agar aman pada 100+ entity; memberi "landing moment" sebelum
 * musuh mati, berbeda dari death-pop/kill-fx.
 */
export function drawImpactPulse(ctx, fx) {
  const t = 1 - fx.life / fx.maxLife;
  const alpha = Math.max(0, fx.life / fx.maxLife);
  const big = fx.big || fx.crit;
  const base = big ? 28 : 19;
  const r = base * (0.55 + t * (big ? 1.4 : 1.05));
  const col = fx.absorbed ? '#cfd8e3' : (fx.crit ? '#ff9f43' : fx.color);

  // inner snap flash
  ctx.globalAlpha = alpha * (big ? 0.42 : 0.26);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r * 0.34, 0, Math.PI * 2);
  ctx.fill();

  // expanding ring
  ctx.globalAlpha = alpha * (big ? 0.95 : 0.72);
  ctx.strokeStyle = col;
  ctx.lineWidth = (big ? 4.5 : 3) * alpha + 0.8;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
  ctx.stroke();

  // radial ticks — terbaca sebagai benturan, bukan sekadar glow statis
  const ticks = big ? 8 : 6;
  ctx.lineCap = 'round';
  ctx.lineWidth = big ? 2.5 : 1.8;
  for (let i = 0; i < ticks; i++) {
    const a = fx.rot + (Math.PI * 2 * i) / ticks;
    const r1 = r * 0.92;
    const r2 = r * (1.22 + 0.24 * t);
    ctx.beginPath();
    ctx.moveTo(fx.x + Math.cos(a) * r1, fx.y + Math.sin(a) * r1);
    ctx.lineTo(fx.x + Math.cos(a) * r2, fx.y + Math.sin(a) * r2);
    ctx.stroke();
  }

  drawCharacterHitSignature(ctx, fx, r, t, alpha, col);
  ctx.globalAlpha = 1;
}

function drawSkillYGlyph(ctx, x, y, len, color, rot = 0, width = 2.2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, len * 0.42);
  ctx.lineTo(0, -len * 0.08);
  ctx.lineTo(-len * 0.33, -len * 0.44);
  ctx.moveTo(0, -len * 0.08);
  ctx.lineTo(len * 0.33, -len * 0.44);
  ctx.stroke();
  ctx.restore();
}

function drawSkillShieldGlyph(ctx, x, y, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.86, y - r * 0.42, x + r * 0.52, y + r * 0.62);
  ctx.quadraticCurveTo(x, y + r * 0.98, x - r * 0.52, y + r * 0.62);
  ctx.quadraticCurveTo(x - r * 0.86, y - r * 0.42, x, y - r);
  ctx.stroke();
}

/**
 * Per-target Character hit signature: trail/impact kecil per archetype.
 * Digambar di dalam impact pulse yang sudah ada supaya setiap hit punya
 * identitas biologis tanpa menambah object VFX tambahan atau biaya partikel.
 */
function drawCharacterHitSignature(ctx, fx, r, t, alpha, impactColor) {
  const archetype = fx.archetype || 'generic';
  const col = fx.absorbed ? impactColor : (fx.equityColor || impactColor || '#ffd93d');
  const hero = fx.heroColor || impactColor || '#35d0ba';
  const x = fx.x;
  const y = fx.y;
  const angle = Number.isFinite(fx.hitAngle) ? fx.hitAngle : (fx.rot || 0);
  const trail = Math.max(r * 0.72, (fx.targetRadius || 18) * 0.42);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.translate(-x, -y);

  // Arah lokal: +X = arah datang hit menuju target, -X = jejak masuk.
  if (archetype === 'antibody') {
    ctx.globalAlpha = alpha * 0.8;
    for (const off of [-0.42, 0.42]) {
      drawSkillYGlyph(ctx, x - trail * 0.32, y + off * r * 0.46, r * 0.5, col, Math.PI / 2, 2.2);
    }
    ctx.globalAlpha = alpha * 0.34;
    ctx.strokeStyle = hero;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - trail * 1.05, y);
    ctx.quadraticCurveTo(x - trail * 0.55, y - r * 0.28, x + r * 0.28, y);
    ctx.stroke();
  } else if (archetype === 'phagocyte') {
    ctx.globalAlpha = alpha * 0.76;
    ctx.strokeStyle = col;
    ctx.lineWidth = 4.2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x - trail * 0.78, y + side * r * 0.48);
      ctx.quadraticCurveTo(x - trail * 0.18, y + side * r * (0.88 - t * 0.28), x + r * 0.4, y + side * r * 0.2);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * 0.24;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x - r * 0.1, y, r * (0.42 + t * 0.12), 0, Math.PI * 2);
    ctx.fill();
  } else if (archetype === 'dendritic' || archetype === 'net') {
    ctx.globalAlpha = alpha * 0.66;
    ctx.strokeStyle = col;
    ctx.lineWidth = archetype === 'net' ? 1.9 : 2.3;
    for (const off of [-0.52, 0, 0.52]) {
      ctx.beginPath();
      ctx.moveTo(x - trail * 1.15, y + off * r * 0.5);
      ctx.lineTo(x + r * 0.42, y - off * r * 0.18);
      if (archetype === 'dendritic') {
        ctx.moveTo(x - trail * 0.4, y + off * r * 0.18);
        ctx.lineTo(x - trail * 0.05, y + off * r * 0.72);
      }
      ctx.stroke();
    }
    if (archetype === 'net') {
      ctx.globalAlpha = alpha * 0.36;
      ctx.setLineDash([3, 4]);
      for (const off of [-0.32, 0.32]) {
        ctx.beginPath();
        ctx.moveTo(x - trail * 0.9, y + off * r);
        ctx.quadraticCurveTo(x - trail * 0.2, y - off * r * 0.9, x + r * 0.48, y + off * r * 0.42);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  } else if (archetype === 'cytotoxic' || archetype === 'nk_spike' || archetype === 'granule_lance') {
    ctx.globalAlpha = alpha * 0.82;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = archetype === 'granule_lance' ? 3.4 : 2.8;
    for (const off of [-0.36, 0, 0.36]) {
      ctx.beginPath();
      ctx.moveTo(x - trail * 1.22, y + off * r * 0.62);
      ctx.lineTo(x + r * (0.62 + t * 0.22), y);
      ctx.stroke();
    }
    const spikes = archetype === 'nk_spike' ? 5 : 3;
    for (let i = 0; i < spikes; i++) {
      const px = x - trail * (0.82 - i * 0.22);
      ctx.beginPath();
      ctx.moveTo(px, y - r * 0.32);
      ctx.lineTo(px + r * 0.26, y);
      ctx.lineTo(px, y + r * 0.32);
      ctx.closePath();
      ctx.fill();
    }
  } else if (archetype === 'vesicle_cloud' || archetype === 'granule_tank') {
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = col;
    const n = archetype === 'granule_tank' ? 7 : 6;
    for (let i = 0; i < n; i++) {
      const px = x - trail * (0.92 - (i % 3) * 0.28);
      const py = y + (i - (n - 1) / 2) * r * 0.18;
      ctx.beginPath();
      ctx.arc(px, py, 2.4 + (i % 2) * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha * 0.42;
    ctx.strokeStyle = hero;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.66, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
  } else if (archetype === 'helper') {
    ctx.globalAlpha = alpha * 0.72;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(x - trail * 0.92, y);
    ctx.lineTo(x + r * 0.56, y);
    ctx.moveTo(x - r * 0.12, y - r * 0.45);
    ctx.lineTo(x - r * 0.12, y + r * 0.45);
    ctx.stroke();
    ctx.fillStyle = hero;
    for (const off of [-0.45, 0.45]) {
      ctx.beginPath();
      ctx.arc(x - trail * 0.48, y + off * r * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (archetype === 'regulator') {
    ctx.globalAlpha = alpha * 0.75;
    drawSkillShieldGlyph(ctx, x, y, r * 0.62, col);
    ctx.globalAlpha = alpha * 0.38;
    ctx.strokeStyle = hero;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x - trail * 0.92, y - r * 0.38);
    ctx.lineTo(x - trail * 0.22, y);
    ctx.lineTo(x - trail * 0.92, y + r * 0.38);
    ctx.stroke();
  } else {
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x - trail, y);
    ctx.lineTo(x + r * 0.42, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Character Agent skill signature: motif biologis per archetype hero.
 * Murni VFX cast/payoff; tidak mengubah efek/damage/cooldown skill.
 */
function drawCharacterSkillSignature(ctx, fx, r, t, alpha, mode = 'charge') {
  const archetype = fx.archetype || 'generic';
  const col = fx.equityColor || fx.color || '#ffd93d';
  const hero = fx.heroColor || fx.color || '#35d0ba';
  const seed = fx.seed || 0;
  const spin = seed + t * (mode === 'payoff' ? 2.4 : 1.25);
  const x = fx.x;
  const y = fx.y;
  const count = fx.ult ? 12 : 8;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (archetype === 'antibody') {
    const n = fx.ult ? 5 : 3;
    ctx.globalAlpha = alpha * (mode === 'payoff' ? 0.82 : 0.62);
    for (let i = 0; i < n; i++) {
      const a = spin + (Math.PI * 2 * i) / n;
      const rr = r * (mode === 'payoff' ? 0.62 + t * 0.18 : 0.52);
      drawSkillYGlyph(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * 0.34, col, a + Math.PI / 2, fx.ult ? 3 : 2.1);
    }
  } else if (archetype === 'phagocyte') {
    ctx.globalAlpha = alpha * 0.72;
    ctx.strokeStyle = col;
    ctx.lineWidth = fx.ult ? 7 : 5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * r * 0.12, y + r * 0.1);
      ctx.quadraticCurveTo(x + side * r * (0.55 + 0.2 * t), y + r * (0.38 - 0.18 * t), x + side * r * 0.95, y - r * 0.18);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r * (0.28 + t * 0.1), 0, Math.PI * 2);
    ctx.fill();
  } else if (archetype === 'dendritic' || archetype === 'net') {
    ctx.globalAlpha = alpha * 0.66;
    ctx.strokeStyle = col;
    ctx.lineWidth = fx.ult ? 3.2 : 2.3;
    for (let i = 0; i < count; i++) {
      const a = spin + (Math.PI * 2 * i) / count;
      const r1 = r * 0.18;
      const r2 = r * (0.62 + 0.22 * t);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
      if (archetype === 'dendritic') {
        const bx = x + Math.cos(a) * r2 * 0.72;
        const by = y + Math.sin(a) * r2 * 0.72;
        ctx.moveTo(bx, by);
        ctx.lineTo(x + Math.cos(a + 0.42) * r2, y + Math.sin(a + 0.42) * r2);
      }
      ctx.stroke();
    }
    if (archetype === 'net') {
      ctx.globalAlpha = alpha * 0.38;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x - r * 0.65, y + i * r * 0.16);
        ctx.quadraticCurveTo(x, y - r * 0.5 + i * 3, x + r * 0.65, y - i * r * 0.16);
        ctx.stroke();
      }
    }
  } else if (archetype === 'cytotoxic' || archetype === 'nk_spike' || archetype === 'granule_lance') {
    ctx.globalAlpha = alpha * 0.72;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = fx.ult ? 4 : 2.5;
    const n = fx.ult ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const a = spin + (Math.PI * 2 * i) / n;
      const r1 = r * 0.38;
      const r2 = r * (0.78 + 0.22 * t);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
      ctx.stroke();
      if (archetype === 'granule_lance' && i % 2 === 0) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r2, y + Math.sin(a) * r2, fx.ult ? 3.4 : 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (archetype === 'vesicle_cloud' || archetype === 'granule_tank') {
    ctx.globalAlpha = alpha * 0.68;
    ctx.fillStyle = col;
    const n = fx.ult ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const a = spin + (Math.PI * 2 * i) / n;
      const rr = r * (0.38 + (i % 3) * 0.08 + t * 0.16);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, fx.ult ? 4.4 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.26;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * rr - 1.2, y + Math.sin(a) * rr - 1.2, fx.ult ? 1.8 : 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.68;
      ctx.fillStyle = col;
    }
  } else if (archetype === 'helper') {
    ctx.globalAlpha = alpha * 0.74;
    ctx.strokeStyle = col;
    ctx.lineWidth = fx.ult ? 4.4 : 3;
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.58);
    ctx.lineTo(x, y - r * (0.62 + t * 0.22));
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y - r * (0.72 + t * 0.18), fx.ult ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hero;
    ctx.globalAlpha = alpha * 0.42;
    ctx.beginPath();
    ctx.arc(x, y, r * (0.62 + t * 0.2), 0, Math.PI * 2);
    ctx.stroke();
  } else if (archetype === 'regulator') {
    ctx.globalAlpha = alpha * 0.72;
    drawSkillShieldGlyph(ctx, x, y, r * (0.48 + t * 0.16), col);
    ctx.globalAlpha = alpha * 0.36;
    drawSkillShieldGlyph(ctx, x, y, r * (0.66 + t * 0.18), hero);
  } else {
    ctx.globalAlpha = alpha * 0.46;
    ctx.strokeStyle = col;
    ctx.lineWidth = fx.ult ? 3 : 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(x, y, r * (0.54 + t * 0.2), spin, spin + Math.PI * 1.7);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Skill charge micro-buildup: cincin mengecil ke badan hero dan arc berputar.
 * Efek ini menggantikan kebutuhan frame tambahan karena aset sekarang hanya
 * punya 1 idle PNG + 1 attack PNG per hero.
 */
export function drawAbilityCharge(ctx, fx) {
  const t = 1 - fx.life / fx.maxLife;
  const alpha = Math.max(0, fx.life / fx.maxLife);
  const r = fx.radius * (1.08 - t * 0.42);
  const col = fx.color || '#ffd93d';
  const pulse = 0.5 + 0.5 * Math.sin((t * 18 + fx.seed) * Math.PI);

  // soft aura menuju pusat
  const g = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, r * 1.9);
  g.addColorStop(0, colorWithAlpha(col, (fx.ult ? 0.24 : 0.16) * alpha));
  g.addColorStop(1, colorWithAlpha(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r * 1.9, 0, Math.PI * 2);
  ctx.fill();

  // ring kontraksi
  ctx.globalAlpha = alpha * (fx.ult ? 0.95 : 0.78);
  ctx.strokeStyle = col;
  ctx.lineWidth = fx.ult ? 4 : 2.6;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r, fx.seed + t * 3.2, fx.seed + t * 3.2 + Math.PI * 1.72);
  ctx.stroke();
  ctx.setLineDash([]);

  drawCharacterSkillSignature(ctx, fx, r, t, alpha, 'charge');

  // inti putih kecil saat hampir trigger
  ctx.globalAlpha = alpha * pulse * (fx.ult ? 0.55 : 0.38);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, Math.max(2, r * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Skill payoff: cincin ekspansi + rays setelah skill aktif terpicu. */
export function drawAbilityPayoff(ctx, fx) {
  const t = 1 - fx.life / fx.maxLife;
  const alpha = Math.max(0, fx.life / fx.maxLife);
  const col = fx.color || '#ffd93d';
  const r = fx.radius * (0.25 + t * 0.92);

  ctx.globalAlpha = alpha * (fx.ult ? 0.86 : 0.6);
  ctx.strokeStyle = col;
  ctx.lineWidth = (fx.ult ? 7 : 4) * alpha + 1;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
  ctx.stroke();

  const rays = fx.ult ? 12 : 8;
  ctx.lineCap = 'round';
  ctx.lineWidth = fx.ult ? 3 : 2;
  for (let i = 0; i < rays; i++) {
    const a = fx.seed + (Math.PI * 2 * i) / rays + t * (fx.ult ? 0.8 : 0.35);
    const r1 = r * 0.58;
    const r2 = r * (0.92 + 0.16 * alpha);
    ctx.beginPath();
    ctx.moveTo(fx.x + Math.cos(a) * r1, fx.y + Math.sin(a) * r1);
    ctx.lineTo(fx.x + Math.cos(a) * r2, fx.y + Math.sin(a) * r2);
    ctx.stroke();
  }

  drawCharacterSkillSignature(ctx, fx, r, t, alpha, 'payoff');

  ctx.globalAlpha = alpha * (fx.ult ? 0.22 : 0.13);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
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

/**
 * F26 — Panah "cari sarang": menunjuk sarang/musuh terdekat saat TIDAK ada
 * patogen di layar. Inti gameplay MMORPG: imun yang mencari virus.
 */
export function drawNestHint(ctx, run, camX, camY, w, h, time) {
  if (!run || !run.enemies) return;
  const margin = 60;
  let nearest = null;
  let nearestD = Infinity;
  for (const e of run.enemies) {
    if (!e.alive || e.isBoss) continue;
    const sx = e.x - camX + w / 2;
    const sy = e.y - camY + h / 2;
    const onScreen = sx > margin && sx < w - margin && sy > margin && sy < h - margin;
    if (onScreen) return; // masih ada patogen terlihat → panah tak perlu
    const d = (e.x - camX) ** 2 + (e.y - camY) ** 2;
    if (d < nearestD) { nearestD = d; nearest = e; }
  }
  if (!nearest) return;
  const cx = w / 2;
  const cy = h / 2;
  const sx = nearest.x - camX + w / 2;
  const sy = nearest.y - camY + h / 2;
  const angle = Math.atan2(sy - cy, sx - cx);
  const edgeX = cx + Math.cos(angle) * (Math.min(w, h) / 2 - 22);
  const edgeY = cy + Math.sin(angle) * (Math.min(h, w) / 2 - 22);
  const pulse = 0.6 + 0.4 * Math.sin(time * 5);
  ctx.save();
  ctx.translate(edgeX, edgeY);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.45 + pulse * 0.55;
  ctx.fillStyle = '#f5c64f'; // emas = petunjuk jelajah (beda dari merah boss)
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(-8, -8);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 8);
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

/**
 * VFX kematian musuh sesuai tier evolusi hero — terlihat jelas beda antar
 * tier: ring pop (common), slash ganda (uncommon), spiral angin (rare),
 * petir menyambar (epic), petir + ring emas (legendary), kristal beku.
 */
export function drawKillFx(ctx, fx, time) {
  const t = 1 - fx.life / fx.maxLife; // 0..1 progress
  const alpha = 1 - t;

  if (fx.kind === 'ring' || fx.kind === 'legend') {
    const r = (fx.kind === 'legend' ? 46 : 30) * (0.3 + t * 1.4);
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 5 * alpha + 1.5;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // titik-titik keluar
    for (let i = 0; i < 6; i++) {
      const a = fx.seed + (Math.PI * 2 * i) / 6;
      const rr = r * 1.25;
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = fx.color;
      ctx.beginPath();
      ctx.arc(fx.x + Math.cos(a) * rr, fx.y + Math.sin(a) * rr, 3.2 * alpha + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (fx.kind === 'slash') {
    const r = 40 * (0.5 + t * 1.1);
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 7 * alpha + 2;
    ctx.lineCap = 'round';
    for (const off of [0, Math.PI * 0.7]) {
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r * (0.8 + off * 0.12), fx.seed + off + t * 2.2, fx.seed + off + t * 2.2 + 1.4);
      ctx.stroke();
    }
  }

  if (fx.kind === 'wind') {
    // 3 spiral angin memuai
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 5 * alpha + 1.5;
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let s = 0; s <= 12; s++) {
        const tt = s / 12;
        const a = fx.seed + (arm * Math.PI * 2) / 3 + tt * 2.6 + t * 3.4;
        const rr = 12 + tt * 70 * (0.4 + t * 0.9);
        const x = fx.x + Math.cos(a) * rr;
        const y = fx.y + Math.sin(a) * rr;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  if (fx.kind === 'bolt' || fx.kind === 'legend') {
    // Petir: poliline zig-zag dari atas + flash
    const boltH = 90;
    const segs = 7;
    const endY = fx.y + 6;
    const startY = fx.y - boltH;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = fx.kind === 'legend' ? '#ffe082' : fx.color;
    ctx.lineWidth = 4.5 * alpha + 1;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(fx.x + Math.sin(fx.seed * 7.3) * 10, startY);
    for (let i = 1; i <= segs; i++) {
      const tt = i / segs;
      const y = startY + (endY - startY) * tt;
      const jitter = i === segs ? 0 : Math.sin(fx.seed * 3.1 + i * 9.7) * 13;
      ctx.lineTo(fx.x + jitter, y);
    }
    ctx.stroke();
    // flash lembut di titik sambar
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, 18 * (0.6 + t), 0, Math.PI * 2);
    ctx.fill();
    if (fx.kind === 'legend') {
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = '#f5c64f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 52 * (0.4 + t), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (fx.kind === 'frost') {
    // Kristal es 6 arah mengembang
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 4 * alpha + 1.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = fx.seed + (Math.PI * i) / 3;
      const r1 = 16 + t * 26;
      const r2 = 34 + t * 96;
      ctx.beginPath();
      ctx.moveTo(fx.x + Math.cos(a) * r1, fx.y + Math.sin(a) * r1);
      ctx.lineTo(fx.x + Math.cos(a) * r2, fx.y + Math.sin(a) * r2);
      // cabang kecil V
      const bx = fx.x + Math.cos(a) * r2 * 0.72;
      const by = fx.y + Math.sin(a) * r2 * 0.72;
      for (const da of [-0.5, 0.5]) {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + da) * 14, by + Math.sin(a + da) * 14);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = fx.color;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, 40 + t * 110, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}
