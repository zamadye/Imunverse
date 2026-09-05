/**
 * camera.js — Kamera follow player dengan smoothing + screen shake.
 * Semua entity dirender relatif terhadap offset kamera:
 *   screenX = worldX - camX + viewportW/2
 */

import { drawBossIndicator } from './shape-renderer.js';

/**
 * PERSP — parameter proyeksi pseudo-3D ala MOBA (Fase 12b):
 * - YS  : squash vertikal ground-plane (kamera miring dari atas)
 * - F/K : perspektif kedalaman — entitas di bawah layar (dekat) lebih besar,
 *         di atas layar (jauh) lebih kecil → peta punya kedalaman.
 */
export const PERSP = { F: 1700, K: 1.35, YS: 0.58, MIN: 0.66, MAX: 1.85 };

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.shakeTrauma = 0;      // 0..1
    this.shakeX = 0;
    this.shakeY = 0;
    this._follows = false;
    this.zoom = 1.16; // Fase 12: karakter lebih besar & jelas di layar
  }

  reset(tx, ty) {
    this.x = tx;
    this.y = ty;
    this.shakeTrauma = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this._follows = true;
  }

  /** Follow target dengan exponential smoothing (frame-rate independent). */
  follow(tx, ty, dt, snap = false) {
    if (snap || !this._follows) {
      this.x = tx;
      this.y = ty;
      this._follows = true;
      return;
    }
    const t = 1 - Math.exp(-8 * dt); // smoothing stabil di semua framerate
    this.x += (tx - this.x) * t;
    this.y += (ty - this.y) * t;
  }

  /**
   * Tambah guncangan (0..1). Dipanggil saat player kena damage besar /
   * boss muncul / boss blast.
   */
  addShake(amount) {
    this.shakeTrauma = Math.min(1, this.shakeTrauma + amount);
  }

  update(dt) {
    // Trauma meluruh; offset shake proporsional kuadrat trauma (terasa lebih alami)
    if (this.shakeTrauma > 0) {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - 1.6 * dt);
      const s = this.shakeTrauma * this.shakeTrauma * 16;
      this.shakeX = (Math.random() * 2 - 1) * s;
      this.shakeY = (Math.random() * 2 - 1) * s;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  /** Terapkan transform kamera ke ctx (w/h = ukuran viewport CSS px). */
  apply(ctx, w, h) {
    // Fallback transform rata (dipakai layar non-gameplay); gameplay memakai makeProjector().
    ctx.translate(Math.round(w / 2 + this.shakeX), Math.round(h / 2 + this.shakeY));
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /**
   * Fase 12b — Projector pseudo-3D: world (x,y) → layar.
   *   scale(dy) = F/(F − dy·K)   → makin dekat kamera (bawah) makin besar
   *   screenY   = tengah + dy·scale·YS → ground dimampetkan (kamera miring)
   * Billboard (sprite karakter) TIDAK disquash — mereka "berdiri" di ground.
   */
  makeProjector(w, h) {
    const cam = this;
    return {
      w, h,
      project(wx, wy) {
        const dx = wx - cam.x + cam.shakeX;
        const dy = wy - cam.y + cam.shakeY;
        let persp = PERSP.F / (PERSP.F - dy * PERSP.K);
        persp = Math.max(PERSP.MIN, Math.min(PERSP.MAX, persp));
        const s = persp * cam.zoom;
        return { x: w / 2 + dx * s, y: h / 2 + dy * s * PERSP.YS, s, persp };
      },
    };
  }

  /** Simpan posisi layar player terproyeksi (untuk aim di player.js). */
  setPlayerScreen(p) { this.playerScreen = p; }
  getPlayerScreen() { return this.playerScreen || null; }

  /** Konversi koordinat dunia → layar (dipakai elemen screen-space). */
  worldToScreen(wx, wy, w, h) {
    const dx = wx - this.x + this.shakeX;
    const dy = wy - this.y + this.shakeY;
    let persp = PERSP.F / (PERSP.F - dy * PERSP.K);
    persp = Math.max(PERSP.MIN, Math.min(PERSP.MAX, persp));
    const s = persp * this.zoom;
    return { x: w / 2 + dx * s, y: h / 2 + dy * s * PERSP.YS };
  }

  /**
   * Panah indikator boss di tepi layar bila boss di luar viewport.
   */
  drawBossIndicatorIfOffscreen(ctx, boss, w, h, time) {
    if (!boss || !boss.alive) return;
    drawBossIndicator(ctx, boss, this.x, this.y, w, h, time);
  }
}
