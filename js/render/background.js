/**
 * background.js — Latar gameplay ala reference user:
 * "air tubuh" teal dengan arena heksagon cream di pusat dunia (player
 * memulai di tengah arena), siluet terumbu/sel organik parallax, dan
 * gelembung yang naik pelan. Semua prosedural (tanpa aset) & deterministik.
 */

function hash2(ix, iy) {
  let h = ix * 374761393 + iy * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}

/** Path heksagon membulat di sekitar (cx, cy) dengan radius R. */
function roundHexPath(ctx, cx, cy, R, round) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (Math.PI / 3) * i;
    pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
  }
  // poligon membulat: quad antar titik dengan arc di sudut
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % 6];
    const x0 = p0[0] + (p1[0] - p0[0]) * 0.5;
    const y0 = p0[1] + (p1[1] - p0[1]) * 0.5;
    if (i === 0) ctx.moveTo(x0, y0);
    const q = pts[(i + 2) % 6];
    const x1 = p1[0] + (q[0] - p1[0]) * 0.5;
    const y1 = p1[1] + (q[1] - p1[1]) * 0.5;
    ctx.arcTo(p1[0], p1[1], x1, y1, round);
  }
  ctx.closePath();
}

/**
 * Gambar latar (screen-space). camX/camY = posisi kamera; w/h = viewport.
 */
export function drawBackground(ctx, camX, camY, w, h, time) {
  // ---- dasar gradien air tubuh (teal) ----
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2b9284');
  g.addColorStop(0.55, '#23857a');
  g.addColorStop(1, '#1d7268');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  drawReefLayer(ctx, camX, camY, w, h, 0.22, 760, 'rgba(21,92,84,0.5)', time, 0);
  drawBubbleLayer(ctx, camX, camY, w, h, time, 0.5, 190, 'rgba(255,255,255,0.10)', 5);
  drawReefLayer(ctx, camX, camY, w, h, 0.4, 560, 'rgba(140,205,170,0.20)', time, 31);
  drawBubbleLayer(ctx, camX, camY, w, h, time, 0.72, 130, 'rgba(255,255,255,0.16)', 8);

  // ---- arena heksagon cream di pusat dunia ----
  drawArena(ctx, camX, camY, w, h, time);

  // ---- vignette lembut tepi layar ----
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(16,64,58,0)');
  vg.addColorStop(1, 'rgba(16,64,58,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

/** Siluet "terumbu"/sel organik besar sebagai bentuk blob tumpuk. */
function drawReefLayer(ctx, camX, camY, w, h, parallax, spacing, color, time, seedShift) {
  const ox = camX * parallax;
  const oy = camY * parallax;
  const x0 = Math.floor((ox - w / 2) / spacing) - 1;
  const x1 = Math.floor((ox + w / 2) / spacing) + 1;
  const y0 = Math.floor((oy - h / 2) / spacing) - 1;
  const y1 = Math.floor((oy + h / 2) / spacing) + 1;

  ctx.fillStyle = color;
  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      const r1 = hash2(ix * 3 + seedShift, iy * 5 - seedShift);
      if (r1 < 0.3) continue; // tidak semua sel berisi
      const wx = ix * spacing + (r1 - 0.5) * spacing * 0.6 - ox + w / 2;
      const wy = iy * spacing + (hash2(ix - seedShift, iy + 9) - 0.5) * spacing * 0.6 - oy + h / 2;
      const R = spacing * (0.28 + r1 * 0.24);
      // cluster 3 lingkaran = blob organik
      ctx.beginPath();
      ctx.arc(wx, wy, R, 0, Math.PI * 2);
      ctx.arc(wx + R * 0.7, wy + R * 0.25, R * 0.72, 0, Math.PI * 2);
      ctx.arc(wx - R * 0.55, wy + R * 0.5, R * 0.6, 0, Math.PI * 2);
      ctx.fill();
      // "korol" kecil di atasnya
      ctx.beginPath();
      ctx.arc(wx + R * 0.2, wy - R * 0.9, R * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Gelembung kecil naik pelan (offset sinus berbasis time). */
function drawBubbleLayer(ctx, camX, camY, w, h, time, parallax, spacing, color, size) {
  const ox = camX * parallax;
  const oy = camY * parallax;
  const drift = (time * 12) % spacing; // naik perlahan
  const x0 = Math.floor((ox - w / 2) / spacing) - 1;
  const x1 = Math.floor((ox + w / 2) / spacing) + 1;
  const y0 = Math.floor((oy - h / 2 - drift) / spacing) - 1;
  const y1 = Math.floor((oy + h / 2 - drift) / spacing) + 1;

  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      const r1 = hash2(ix + 91, iy - 17);
      if (r1 < 0.42) continue;
      const wx = ix * spacing + (r1 - 0.5) * spacing * 0.7 - ox + w / 2;
      const wy = iy * spacing + (hash2(ix - 40, iy + 63) - 0.5) * spacing * 0.7 - oy - drift + h / 2;
      const sway = Math.sin(time * 1.4 + r1 * 9) * 6;
      const s = size * (0.5 + r1 * 0.9);
      ctx.globalAlpha = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2 + r1 * 20));
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(wx + sway, wy, s, 0, Math.PI * 2);
      ctx.fill();
      // kilau bubble
      ctx.globalAlpha *= 0.9;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(wx + sway - s * 0.3, wy - s * 0.35, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Arena heksagon cream tempat pertempuran dimulai (pusat dunia = 0,0). */
function drawArena(ctx, camX, camY, w, h, time) {
  const cx = -camX + w / 2;
  const cy = -camY + h / 2;
  const R = 560;
  // culling kasar: skip bila arena jauh di luar layar
  if (cx < -R - 200 || cx > w + R + 200 || cy < -R - 200 || cy > h + R + 200) return;

  // bayangan/bibir arena (ring teal muda di bawah)
  ctx.fillStyle = 'rgba(190,228,214,0.85)';
  roundHexPath(ctx, cx, cy + 14, R + 34, 90);
  ctx.fill();
  ctx.fillStyle = 'rgba(154,208,186,0.9)';
  roundHexPath(ctx, cx, cy + 6, R + 16, 84);
  ctx.fill();

  // lantai cream
  ctx.fillStyle = '#faf1dc';
  roundHexPath(ctx, cx, cy, R, 80);
  ctx.fill();

  // bercak organik lembut deterministik di lantai arena
  const spots = 26;
  for (let i = 0; i < spots; i++) {
    const a = hash2(i * 7 + 1, i * 3 + 2) * Math.PI * 2;
    const rr = hash2(i * 11 + 5, i * 13 + 7) * (R * 0.82);
    const sx = cx + Math.cos(a) * rr;
    const sy = cy + Math.sin(a) * rr;
    const srad = 18 + hash2(i + 40, i + 41) * 46;
    const pulse = 0.75 + 0.25 * Math.sin(time * 0.8 + i * 1.7);
    ctx.fillStyle = i % 3 === 0 ? `rgba(169,215,149,${0.16 * pulse})` : `rgba(191,227,216,${0.22 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, srad * pulse, srad * 0.8 * pulse, a, 0, Math.PI * 2);
    ctx.fill();
  }

  // garis tepi dalam tipis
  ctx.strokeStyle = 'rgba(31,122,112,0.18)';
  ctx.lineWidth = 3;
  roundHexPath(ctx, cx, cy, R - 10, 76);
  ctx.stroke();
}
