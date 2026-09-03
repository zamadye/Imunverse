/**
 * background.js — Latar dunia prosedural: interior tubuh / aliran limfa.
 * Dot & membran digambar deterministik dari hash koordinat grid (parallax),
 * jadi infinite world tanpa butuh tile/aset.
 */

import { drawCircle, drawPulseGlow } from './shape-renderer.js';

function hash2(ix, iy) {
  // deterministic pseudo-random 0..1 dari koordinat grid
  let h = ix * 374761393 + iy * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}

/**
 * Gambar latar relatif kamera.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} camX camY posisi kamera
 * @param {number} w h ukuran viewport CSS
 * @param {number} time waktu game (untuk pulse)
 */
export function drawBackground(ctx, camX, camY, w, h, time) {
  // dasar gradien tubuh
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#081524');
  g.addColorStop(0.5, '#0a1a2c');
  g.addColorStop(1, '#07121e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  drawDotLayer(ctx, camX, camY, w, h, time, 0.35, 150, 'rgba(120,220,255,0.10)', 2.4);
  drawDotLayer(ctx, camX, camY, w, h, time, 0.6, 110, 'rgba(90,180,230,0.14)', 3.4);
  drawMembraneLayer(ctx, camX, camY, w, h, time);
}

/** Lapisan titik kecil parallax. */
function drawDotLayer(ctx, camX, camY, w, h, time, parallax, spacing, color, size) {
  const ox = camX * parallax;
  const oy = camY * parallax;
  const x0 = Math.floor((ox - w / 2) / spacing) - 1;
  const x1 = Math.floor((ox + w / 2) / spacing) + 1;
  const y0 = Math.floor((oy - h / 2) / spacing) - 1;
  const y1 = Math.floor((oy + h / 2) / spacing) + 1;

  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      const r1 = hash2(ix, iy);
      if (r1 < 0.45) continue; // tidak semua sel berisi dot
      const jx = (hash2(ix + 91, iy - 17) - 0.5) * spacing * 0.7;
      const jy = (hash2(ix - 40, iy + 63) - 0.5) * spacing * 0.7;
      const wx = ix * spacing + jx - ox + w / 2;
      const wy = iy * spacing + jy - oy + h / 2;
      const s = size * (0.5 + hash2(ix + 7, iy + 3));
      const phase = r1 * 10;
      const pulse = 0.6 + 0.4 * Math.sin(time * 1.6 + phase);
      drawCircle(ctx, wx, wy, s * pulse, color, 0.5 + pulse * 0.5);
    }
  }
}

/** Lapisan membran besar sangat samar (sel-sel jauh di latar). */
function drawMembraneLayer(ctx, camX, camY, w, h, time) {
  const parallax = 0.16;
  const spacing = 460;
  const ox = camX * parallax;
  const oy = camY * parallax;
  const x0 = Math.floor((ox - w / 2) / spacing) - 1;
  const x1 = Math.floor((ox + w / 2) / spacing) + 1;
  const y0 = Math.floor((oy - h / 2) / spacing) - 1;
  const y1 = Math.floor((oy + h / 2) / spacing) + 1;

  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      const r1 = hash2(ix * 3 + 11, iy * 5 - 7);
      const wx = ix * spacing + (r1 - 0.5) * 160 - ox + w / 2;
      const wy = iy * spacing + (hash2(ix - 5, iy + 9) - 0.5) * 160 - oy + h / 2;
      const R = 120 + r1 * 140;
      const phase = r1 * 20;
      const pulse = 0.75 + 0.25 * Math.sin(time * 0.9 + phase);

      ctx.strokeStyle = `rgba(70,160,210,${0.05 + r1 * 0.05})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wy, R * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // inti samar
      drawPulseGlow(ctx, wx, wy, 18, '#2e7d9e', time, phase, 0.4);
    }
  }
}
