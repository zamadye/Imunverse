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

/**
 * ZONE_ZOOM — tuning epic zoom kamera per zona (MAP scope).
 * BOSS: zoom saat boss dekat (jarak dunia < BOSS_RANGE).
 * DANGER: zoom saat player berdiri di zona bahaya (hazard/inflamasi).
 * Nilai = pengali zoom efektif; smoothing di Camera.update (masuk sinematik,
 * keluar cepat). Satu sumber — dipakai game.js + tes.
 */
export const ZONE_ZOOM = { BOSS: 1.18, DANGER: 1.1, BOSS_RANGE: 520, DANGER_PAD: 30, MAX: 1.35 };

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.shakeTrauma = 0;      // 0..1
    this.shakeX = 0;
    this.shakeY = 0;
    this._follows = false;
    this.zoom = 1.16; // Fase 12: karakter lebih besar & jelas di layar
    // R6 Modul D: layer punch-zoom (doc §5.4) — di ATAS follow/shake,
    // tidak menggantikan keduanya. punchScale dikalikan ke zoom efektif.
    this.punchAmp = 0;
    this.punchDur = 0;
    this.punchT = 0;
    this.punchScale = 1;
    // MAP: layer epic zoom zona — di ATAS punch, easing sinematik menuju
    // zoneTarget (diset tiap frame oleh game.js dari posisi zona).
    this.zoneScale = 1;
    this.zoneTarget = 1;
  }

  reset(tx, ty) {
    this.x = tx;
    this.y = ty;
    this.shakeTrauma = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this._follows = true;
    this.punchAmp = 0;
    this.punchT = 0;
    this.punchScale = 1;
    this.zoneScale = 1;
    this.zoneTarget = 1;
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
   * R6 Modul D (Tag-Cascade): punch-zoom singkat — zoom masuk `amp`
   * (mis. 0.09 = 9%) lalu meluruh ease-out kembali ke 1 selama `dur` detik
   * (doc §5.3 T3: 8-10%, 250-300 ms). Punch baru MENIMPA hanya bila lebih
   * kuat dari sisa punch berjalan (anti mual saat cascade bertumpuk).
   */
  punchZoom(amp, dur = 0.28) {
    const residual = this.punchScale - 1;
    if (amp <= residual) return;
    this.punchAmp = amp;
    this.punchDur = Math.max(0.05, dur);
    this.punchT = 0;
  }

  /**
   * MAP: target epic zoom zona (1 = normal). Dipanggil tiap frame oleh
   * game.js; transisi dihaluskan di update(). Sisi NAIK memicu hentakan
   * trauma kecil (terasa "epic", bukan mual) — hanya saat nilai berubah.
   */
  setZoneZoom(target) {
    const t = Math.max(1, Math.min(ZONE_ZOOM.MAX, target || 1));
    if (t > this.zoneTarget + 1e-9) this.addShake(0.3);
    this.zoneTarget = t;
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
    // R6: punch-zoom meluruh ease-out kubik → punchScale kembali ke 1
    if (this.punchAmp > 0) {
      this.punchT += dt;
      const pr = Math.min(1, this.punchT / this.punchDur);
      this.punchScale = 1 + this.punchAmp * Math.pow(1 - pr, 3);
      if (pr >= 1) { this.punchAmp = 0; this.punchScale = 1; }
    }
    // MAP: epic zoom zona menuju target — masuk sinematik (~1 dtk),
    // keluar cepat (~0.4 dtk). Frame-rate independent.
    if (Math.abs(this.zoneScale - this.zoneTarget) > 1e-4) {
      const rate = this.zoneTarget > this.zoneScale ? 1.6 : 3.2;
      const k = 1 - Math.exp(-rate * dt);
      this.zoneScale += (this.zoneTarget - this.zoneScale) * k;
      if (Math.abs(this.zoneScale - this.zoneTarget) <= 1e-4) this.zoneScale = this.zoneTarget;
    }
  }

  /** Terapkan transform kamera ke ctx (w/h = ukuran viewport CSS px). */
  apply(ctx, w, h) {
    // Fallback transform rata (dipakai layar non-gameplay); gameplay memakai makeProjector().
    ctx.translate(Math.round(w / 2 + this.shakeX), Math.round(h / 2 + this.shakeY));
    const z = this.zoom * this.punchScale * this.zoneScale; // R6 + MAP zona
    ctx.scale(z, z);
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
        const s = persp * cam.zoom * cam.punchScale * cam.zoneScale; // R6 + MAP zona
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
    const s = persp * this.zoom * this.punchScale * this.zoneScale; // R6 + MAP zona
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
