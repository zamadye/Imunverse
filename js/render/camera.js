/**
 * camera.js — Kamera follow player dengan smoothing + screen shake.
 * Semua entity dirender relatif terhadap offset kamera:
 *   screenX = worldX - camX + viewportW/2
 */

import { drawBossIndicator } from './shape-renderer.js';

/**
 * PERSP — parameter proyeksi pseudo-3D (gaya third-person dari belakang/atas):
 * - YS  : squash vertikal ground-plane (kamera miring dari atas, ~35°)
 * - F/K : perspektif kedalaman — entitas di bawah layar (dekat) lebih besar,
 *         di atas layar (jauh) lebih kecil → peta punya kedalaman.
 * K dinaikkan untuk "behind-the-shoulder look": gradien ukuran depth lebih
 * terasa (obat rasa kaku top-down; referensi user: Raft / Subnautica).
 */
export const PERSP = { F: 1450, K: 1.55, YS: 0.58, MIN: 0.6, MAX: 2.0 };

/**
 * THIRD_PERSON — anchor player di 62% tinggi layar (camera "di belakang &
 * sedikit di atas" player → pandangan didominasi wilayah DEPAN player),
 * look-ahead mengarah ke gerak (drift saat berbelok, karena heading dihaluskan
 * lebih lambat daripada posisi), dan zoom dinamis berbasis kecepatan:
 * bergerak cepat = kamera sedikit menjauh, diam = mendekat.
 */
export const THIRD_PERSON = {
  ANCHOR_Y: 0.66,          // hero di "third bawah" (ref Raft/Subnautica): 2/3 layar = wilayah DEPAN
  FOLLOW_RATE: 6.0,        // smoothing posisi (≈ lerp 0.09/frame @60fps)
  LOOK_MAX: 185,           // px dunia — look-ahead lebih lebar: ombak/ancaman di depan terbaca
  HEADING_RATE: 2.6,       // heading dihaluskan pelan → terlambat saat belok
  ZOOM_BASE: 1.36,         // baseline zoom (badan karakter besar & jelas dari belakang)
  ZOOM_IDLE: 1.08,         // diam → mendekat (lebih besar lagi)
  ZOOM_MOVE: 0.92,         // kecepatan penuh → menjauh (melihat ancaman lebih dulu)
  ZOOM_RATE: 2.4,          // easing zoom kecepatan
};

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
    this.zoom = THIRD_PERSON.ZOOM_BASE; // baseline lebih besar: detail karakter terlihat
    // Third-person feel: heading tersmoothing + target zoom dinamis kecepatan.
    this.headX = 1;
    this.headY = 0;
    this.speedScale = 1;
    this.speedTarget = 1;
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
    this.headX = 1;
    this.headY = 0;
    this.speedScale = 1;
    this.speedTarget = 1;
    this.punchAmp = 0;
    this.punchT = 0;
    this.punchScale = 1;
    this.zoneScale = 1;
    this.zoneTarget = 1;
  }

  /**
   * Follow target dengan exponential smoothing (frame-rate independent).
   * lookX/lookY (opsional, rentang 0..1) = arah gerak normal → kamera memimpin
   * ke arah itu (look-ahead), dengan heading yang TERLAMBAT (drift saat belok).
   */
  follow(tx, ty, dt, snap = false, lookX = 0, lookY = 0) {
    if (snap || !this._follows) {
      this.x = tx;
      this.y = ty;
      this._follows = true;
      this.headX = lookX || this.headX;
      this.headY = lookY || this.headY;
      return;
    }
    // Heading belakang-halus: kuat lambat → saat berbelok arah pandang mengejar
    const kh = 1 - Math.exp(-THIRD_PERSON.HEADING_RATE * dt);
    if (lookX || lookY) {
      const m = Math.hypot(lookX, lookY) || 1;
      this.headX += (lookX / m - this.headX) * kh;
      this.headY += (lookY / m - this.headY) * kh;
    } else {
      // diam: heading meluruh perlahan ke nol-look-ahead (kamera "pulih")
      const kd = 1 - Math.exp(-1.4 * dt);
      const m = Math.hypot(this.headX, this.headY) || 1;
      const decay = Math.max(0, m - 0.4 * dt);
      this.headX = (this.headX / m) * decay;
      this.headY = (this.headY / m) * decay;
    }
    const aimX = tx + this.headX * THIRD_PERSON.LOOK_MAX;
    const aimY = ty + this.headY * THIRD_PERSON.LOOK_MAX;
    const t = 1 - Math.exp(-THIRD_PERSON.FOLLOW_RATE * dt);
    this.x += (aimX - this.x) * t;
    this.y += (aimY - this.y) * t;
  }

  /** Zoom dinamis kecepatan: panggil tiap frame dengan kecepatan ternormasi 0..1. */
  setSpeedZoom(speedNorm) {
    const s = Math.max(0, Math.min(1, speedNorm || 0));
    this.speedTarget = THIRD_PERSON.ZOOM_MOVE + (THIRD_PERSON.ZOOM_IDLE - THIRD_PERSON.ZOOM_MOVE) * (1 - s);
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
    // Third-person: zoom kecepatan dihaluskan lambat (anti mual)
    if (Math.abs(this.speedScale - this.speedTarget) > 1e-4) {
      const kz = 1 - Math.exp(-THIRD_PERSON.ZOOM_RATE * dt);
      this.speedScale += (this.speedTarget - this.speedScale) * kz;
      if (Math.abs(this.speedScale - this.speedTarget) <= 1e-4) this.speedScale = this.speedTarget;
    }
  }

  /** Faktor zoom total (urutan layer: speed → punch → zona). */
  totalZoom() {
    return this.zoom * this.speedScale * this.punchScale * this.zoneScale;
  }

  /** Terapkan transform kamera ke ctx (w/h = ukuran viewport CSS px). */
  apply(ctx, w, h) {
    // Fallback transform rata (dipakai layar non-gameplay); gameplay memakai makeProjector().
    ctx.translate(Math.round(w / 2 + this.shakeX), Math.round(h / 2 + this.shakeY));
    ctx.scale(this.totalZoom(), this.totalZoom());
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
    const anchorY = h * THIRD_PERSON.ANCHOR_Y; // player duduk di bawah tengah layar
    return {
      w, h,
      anchorY,
      project(wx, wy) {
        const dx = wx - cam.x + cam.shakeX;
        const dy = wy - cam.y + cam.shakeY;
        let persp = PERSP.F / (PERSP.F - dy * PERSP.K);
        persp = Math.max(PERSP.MIN, Math.min(PERSP.MAX, persp));
        const s = persp * cam.totalZoom();
        return { x: w / 2 + dx * s, y: anchorY + dy * s * PERSP.YS, s, persp };
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
    const s = persp * this.totalZoom();
    return { x: w / 2 + dx * s, y: h * THIRD_PERSON.ANCHOR_Y + dy * s * PERSP.YS };
  }

  /**
   * Panah indikator boss di tepi layar bila boss di luar viewport.
   */
  drawBossIndicatorIfOffscreen(ctx, boss, w, h, time) {
    if (!boss || !boss.alive) return;
    drawBossIndicator(ctx, boss, this.x, this.y, w, h, time);
  }
}
