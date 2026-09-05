/**
 * camera.js — Kamera follow player dengan smoothing + screen shake.
 * Semua entity dirender relatif terhadap offset kamera:
 *   screenX = worldX - camX + viewportW/2
 */

import { drawBossIndicator } from './shape-renderer.js';

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
    // Fase 12: zoom di sekitar pusat layar — semua entitas dunia ikut membesar
    ctx.translate(Math.round(w / 2 + this.shakeX), Math.round(h / 2 + this.shakeY));
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /** Konversi koordinat dunia → layar (dipakai elemen screen-space). */
  worldToScreen(wx, wy, w, h) {
    return {
      x: (wx - this.x) * this.zoom + w / 2,
      y: (wy - this.y) * this.zoom + h / 2,
    };
  }

  /**
   * Panah indikator boss di tepi layar bila boss di luar viewport.
   */
  drawBossIndicatorIfOffscreen(ctx, boss, w, h, time) {
    if (!boss || !boss.alive) return;
    drawBossIndicator(ctx, boss, this.x, this.y, w, h, time);
  }
}
