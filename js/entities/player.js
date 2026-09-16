/**
 * player.js — Entitas player (sel imun yang dikendalikan).
 * Statistik akhir dihitung dari: baseStats hero (JSON) × upgrade squad permanen
 * (meta) × upgrade in-run (level-up) × consumable (serum).
 * PHAGOS: TIDAK ADA serangan tombol — damage = kontak membran (pasif) +
 * PULSE (satu tombol). tryFire/performAttack MATI (badan dikomentari §13.8).
 */

import { PERSP } from '../render/camera.js';

import { audio } from '../systems/audio-system.js';
import { getCombat } from '../core/data-store.js';

let nextPlayerId = 1;

export class Player {
  /**
   * @param {object} heroDef     definisi hero dari data/heroes.json
   * @param {object} stats       statistik turunan hasil computeStats() (dari game.js)
   * @param {number} x
   * @param {number} y
   */
  constructor(heroDef, stats, x, y) {
    this.id = nextPlayerId++;
    this.heroDef = heroDef;
    this.x = x;
    this.y = y;
    this.radius = heroDef.baseStats.radius;
    this.facing = 0;          // arah hadap (rad) — dipakai arah serangan & sprite
    this.squash = 0;          // JUICE: timer squash-stretch (dtk)
    this.stats = stats;       // di-recompute oleh game.js saat upgrade
    this.maxHP = stats.maxHP;
    this.hp = stats.maxHP;
    this.attackTimer = 0;     // hitungan mundur cooldown serangan
    this.iframes = 0;         // masa kebal setelah kena hit (detik)
    this.attackFlash = 0;     // timer untuk swap sprite attack
    this.swing = 0;           // Fase 12c: animasi tebasan respons tombol
    this.moving = false;
    this.walkPhase = 0; // Fase 12b: animasi jalan (bobbing)
    this.stepT = 0;     // jeda antar langkah (debu kaki)
    // ---- ANIMASI HALUS (UI-REBUILD P8) ----
    // Dulu sprite hanya dibalik kiri↔kanan secara instan (flip = ±1), jadi
    // gerakan terasa kaku dan tidak pernah bereaksi ke arah atas/bawah.
    // Sekarang semua ditahan oleh smoothing berbasis dt:
    this.animFlip = 1;  // -1..1, lewat 0 saat berputar → sprite "menipis" = berbalik
    this.moveAmt = 0;   // 0..1 seberapa kuat sedang berjalan (untuk bob & ayun)
    this.lean = 0;      // miring ke arah jalan (rad) — kiri/kanan
    this.depth = 0;     // -1..1 gerakan vertikal (menjauh → -1, mendekat → +1)
    this.vx = 0;        // V2 Phase 2: velocity smoothing (accel/decel)
    this.vy = 0;
    this.alive = true;
  }

  /**
   * Update pergerakan + cooldown + auto-attack.
   * @param {number} dt
   * @param {{x:number,y:number,magnitude:number}} move  vektor input
   * @param {object} game  context game (untuk query musuh & spawn proyektil)
   */
  update(dt, move, game) {
    if (!this.alive) return;

    // ---- Gerakan (delta-time based) ----
    // V2 Phase 2: velocity smoothing — ramp ~0.11s saat mulai, berhenti tajam
    // ~0.08s saat lepas (decel > accel). Bukan momentum licin; hanya
    // menghaluskan transisi supaya arah tidak patah-patah.
    const mv = getCombat().movement;
    const hasInput = move.magnitude > 0.01;
    let tvx = 0, tvy = 0;
    if (hasInput) {
      // R7 Modul E: buff jejak kemotaksis — pengali langsung per frame
      // (tanpa recompute stats; 1 bila flag OFF / tidak menyentuh jejak)
      const chemoMult = (game && game.run && game.run.chemoSpeedMult) || 1;
      const speed = this.stats.speed * chemoMult * Math.min(1, move.magnitude);
      tvx = move.x * speed;
      tvy = move.y * speed;
    }
    const k = 1 - Math.exp(-(hasInput ? mv.accel : mv.decel) * dt);
    this.vx += (tvx - this.vx) * k;
    this.vy += (tvy - this.vy) * k;
    // snap-to-zero: decay eksponensial tak pernah 0 — sisa kecepatan kecil
    // saat lepas input dipangkas supaya berhenti terasa TAJAM (spek §4.3)
    if (!hasInput && Math.hypot(this.vx, this.vy) < (mv.stopSnap || 40)) {
      this.vx = 0;
      this.vy = 0;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // ---- Animasi halus: semua arah (kiri/kanan/atas/bawah) ----
    // Nilai mentah dihitung dari kecepatan (bukan tombol), lalu dihaluskan
    // dengan peluruhan eksponensial supaya transisi tidak pernah melompat.
    {
      const spd = Math.max(1, this.stats.speed || 1);
      const vlen = Math.hypot(this.vx, this.vy);
      const targetMove = Math.min(1, vlen / spd);
      const targetFlip = Math.cos(this.facing) < 0 ? -1 : 1;
      // miring searah jalan (dibatasi) — terasa seperti mencondongkan badan
      const targetLean = Math.max(-1, Math.min(1, this.vx / spd)) * 0.13;
      // vertikal: + = mendekat ke kamera (bawah layar), - = menjauh
      const targetDepth = Math.max(-1, Math.min(1, this.vy / spd));
      const ease = (cur, target, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
      this.moveAmt = ease(this.moveAmt, targetMove, 7);
      this.animFlip = ease(this.animFlip, targetFlip, 11);
      this.lean = ease(this.lean, targetLean, 8);
      this.depth = ease(this.depth, targetDepth, 6);
    }

    if (hasInput) {
      this.facing = Math.atan2(move.y, move.x);
      this.moving = true;
      // Fase 12b: animasi jalan — bobbing + debu langkah kecil.
      // UI-REBUILD P8: laju langkah 3–9 rad/dtk mengikuti kecepatan AKTUAL
      // (≈2–3 langkah/dtk). Rumus lama (speed/16 ≈ 30 rad/dtk) membuat
      // mantulan terlalu cepat sampai 2 px/frame — terlihat bergetar, bukan
      // berjalan.
      const _spdRef = Math.max(1, this.stats.speed || 1);
      const _ratio = Math.min(1, Math.hypot(this.vx, this.vy) / _spdRef);
      this.walkPhase += dt * (3 + 6 * _ratio);
      this.stepT -= dt;
      if (this.stepT <= 0 && game && game.run) {
        this.stepT = 0.24;
        game.run.effects.spawnBurst(this.x, this.y + this.radius * 0.75, 'rgba(224,244,236,0.85)', 1, 30, 2.2);
      }
    } else {
      this.moving = Math.hypot(this.vx, this.vy) > 4; // masih meluncur pelan
    }

    // ---- Timers ----
    if (this.iframes > 0) this.iframes -= dt;
    if (this.attackFlash > 0) this.attackFlash -= dt;
    this.attackTimer -= dt; // PHAGOS: sisa cooldown jalur tembak mati (tidak dipakai)
    // PHAGOS: hero TIDAK menyerang sendiri — damage hanya dari membran
    // (updateMembrane) + PULSE. Blok tembak/auto-attack DIHAPUS total.
  }

  /**
   * JALUR TEMBAK MATI — stub dipertahankan agar pemanggil lama tak crash.
   * Badan asli dikomentari di bawah (bible §13.8: komentari, jangan hapus).
   */
  tryFire(game) {
    return;
    /* PHAGOS Sprint 1 (§13.8): JALUR TEMBAK MATI (tak dipanggil). Dikomentari, bukan dihapus.
    if (!this.alive) return;
    // Fase 12c: tombol SERANG SELALU merespons.
    const aimActive = game.input && game.run && (() => {
      try {
        const cam = game.run.camera;
        const sp = cam.getPlayerScreen();
        return game.input.getAimInfo(sp ? sp.x : this.x - cam.x, sp ? sp.y : this.y - cam.y).active;
      } catch {
        return false;
      }
    })();
    let target = game.findAttackTarget(this.x, this.y, this.stats.effectiveAttackRange); // V2 Phase 2: finisher bias
    if (!target && !aimActive) {
      // Tidak ada musuh & tidak mengarahkan: swing + langkah maju (feedback jelas).
      // RONDE-7: TETAP tunduk pada cooldown! Dulu path ini MEMBYPASS attackTimer
      // → tanpa musuh tembakan tiap frame (~60/dtk), saat ada musuh nyangkut di
      // cooldown (~1/dtk) → "SERANG cepat kalau sepi, lemot saat ramai".
      // Sekarang cadence SATU untuk semua kondisi.
      if (this.attackTimer > 0) {
        this.performAttack({ x: this.x + Math.cos(this.facing) * 100, y: this.y + Math.sin(this.facing) * 100 }, game, { tap: true });
        return;
      }
      this.performAttack({ x: this.x + Math.cos(this.facing) * 100, y: this.y + Math.sin(this.facing) * 100 }, game);
      this.attackTimer = this.stats.cooldown;
      return;
    }
    if (!target) target = { x: this.x + Math.cos(this.facing) * 100, y: this.y + Math.sin(this.facing) * 100 };
    if (this.attackTimer > 0) {
      // Cooldown berjalan: swing + tapakan ke arah target (karakter tetap bereaksi)
      this.performAttack(target, game, { tap: true });
      return;
    }
    this.performAttack(target, game);
    this.attackTimer = this.stats.cooldown;
  */
  }

  /** JALUR TEMBAK MATI — stub (badan dikomentari §13.8, tak dipanggil). */
  performAttack(target, game, opts = {}) {
    return;
    /* PHAGOS Sprint 1 (§13.8): JALUR TEMBAK MATI (tak dipanggil). Dikomentari, bukan dihapus.
    const pattern = this.heroDef.attackPattern;
    if (opts.tap) {
      // Fase 12c: respons sentuhan saat cooldown — swing visual + audio ringan,
      // damage tetap dari ritme auto-attack (tidak menembus cooldown).
      this.swing = 0.22;
      this.squash = 0.12;
      audio.swing();
      return;
    }
    this.attackFlash = 0.18; // swap spriteAttack sebentar
    // AIM: bila player mengarahkan (stick kanan / mouse), serangan ikut arah itu
    let aimAngle = null;
    if (game && game.input && game.run) {
      const cam = game.run.camera;
      const sp = cam.getPlayerScreen();
      const sx = sp ? sp.x : this.x - cam.x;
      const sy = sp ? sp.y : this.y - cam.y;
      const aim = game.input.getAimInfo(sx, sy);
      if (aim.active) {
        // Fase 12b: sudut layar → sudut dunia (kompensasi squash kamera miring)
        aimAngle = Math.atan2(Math.sin(aim.angle) / PERSP.YS, Math.cos(aim.angle));
      }
    }
    this.facing = aimAngle !== null ? aimAngle : Math.atan2(target.y - this.y, target.x - this.x);
    if (aimAngle !== null) {
      // target fiktif searah aim (pattern melee/lempar pakai arah facing)
      target = { x: this.x + Math.cos(aimAngle) * 100, y: this.y + Math.sin(aimAngle) * 100 };
    }

    if (pattern === 'melee_swipe') {
      // Tebasan area: damage semua musuh dalam swipeRadius & sudut arc
      const count = 1 + this.stats.projectileCount - 1; // upgrade projectileCount → tebasan ekstra
      const swipeCount = this.stats.projectileCount;
      const offsets = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
      for (let i = 0; i < swipeCount; i++) {
        const angle = this.facing + offsets[i % offsets.length];
        game.run.effects.spawnSwipe(this.x, this.y, angle, this.stats.swipeRadius, this.heroDef.patternParams.arc, this.heroDef.color);
        game.applyMeleeSwipe(this, angle, this.stats.swipeRadius, this.heroDef.patternParams.arc, this.stats.damage);
      }
      game.run.stats.shotsFired += 1;
    } else if (pattern === 'ranged_pierce') {
      // Proyektil garis lurus menembus musuh (pierce = jumlah musuh yang ditembus)
      const n = this.stats.projectileCount;
      const spread = (this.heroDef.patternParams.spreadAngle || 0.14) * (n - 1);
      for (let i = 0; i < n; i++) {
        const angle = this.facing - spread / 2 + (n === 1 ? 0 : (spread / (n - 1)) * i);
        game.spawnProjectile({
          pattern: 'pierce',
          x: this.x + Math.cos(angle) * this.radius,
          y: this.y + Math.sin(angle) * this.radius,
          angle,
          speed: this.stats.projectileSpeed,
          damage: this.stats.damage,
          pierce: this.stats.pierce,
          color: this.heroDef.color,
        });
      }
      game.run.stats.shotsFired += n;
    } else if (pattern === 'ranged_homing') {
      // Proyektil yang belok mengejar musuh terdekat
      const n = this.stats.projectileCount;
      const spread = (this.heroDef.patternParams.spreadAngle || 0.5) * (n - 1);
      const turnRate = this.heroDef.patternParams.turnRate || 4;
      for (let i = 0; i < n; i++) {
        const angle = this.facing - spread / 2 + (n === 1 ? 0 : (spread / (n - 1)) * i);
        game.spawnProjectile({
          pattern: 'homing',
          x: this.x + Math.cos(angle) * this.radius,
          y: this.y + Math.sin(angle) * this.radius,
          angle,
          speed: this.stats.projectileSpeed,
          damage: this.stats.damage,
          pierce: this.stats.pierce,
          turnRate,
          antiParasitMult: this.heroDef.patternParams.antiParasitMult || 0,
          color: this.heroDef.color,
        });
      }
      game.run.stats.shotsFired += n;
    } else if (pattern === 'ranged_chain') {
      // V2 §17 archetype CHAIN: tembakan yang menyambung ke musuh terdekat
      // di sekitar target pertama (identitas Dendritic: multi-target & kontrol).
      const chain = game.getAttackArchetype('chain') || {};
      const n = this.stats.projectileCount;
      const spread = (this.heroDef.patternParams.spreadAngle || 0.5) * (n - 1);
      const turnRate = this.heroDef.patternParams.turnRate || 4;
      for (let i = 0; i < n; i++) {
        const angle = this.facing - spread / 2 + (n === 1 ? 0 : (spread / (n - 1)) * i);
        game.spawnProjectile({
          pattern: 'homing',
          x: this.x + Math.cos(angle) * this.radius,
          y: this.y + Math.sin(angle) * this.radius,
          angle,
          speed: this.stats.projectileSpeed,
          damage: this.stats.damage,
          pierce: 1 + (this.heroDef.patternParams.hops || chain.maxHops || 2),
          turnRate,
          antiParasitMult: this.heroDef.patternParams.antiParasitMult || 0,
          color: this.heroDef.color,
          chainHops: this.heroDef.patternParams.hops || chain.maxHops || 2,
          chainRadius: this.heroDef.patternParams.hopRadius || chain.hopRadius || 120,
          chainDecay: (chain.decay != null ? chain.decay : 0.4),
        });
      }
      game.run.stats.shotsFired += n;
    } else {
      console.warn('[player] attackPattern tidak dikenal:', pattern);
    }
  */
  }

  /** Terima damage dengan i-frames. @returns {boolean} apakah damage diterima */
  takeDamage(amount) {
    if (!this.alive || this.iframes > 0) return false;
    this.hp -= amount;
    this.iframes = 0.7;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return true;
  }

  /** Pulihkan HP (vitamin / efek upgrade). */
  heal(amount) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHP, this.hp + amount);
  }
}
