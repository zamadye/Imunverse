/**
 * player.js — Entitas player (sel imun yang dikendalikan).
 * Statistik akhir dihitung dari: baseStats hero (JSON) × upgrade squad permanen
 * (meta) × upgrade in-run (level-up) × consumable (serum).
 * Attack otomatis ke musuh terdekat dalam range — pattern sesuai data hero.
 */

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
    this.moving = false;
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
    if (move.magnitude > 0.01) {
      const speed = this.stats.speed * Math.min(1, move.magnitude);
      this.x += move.x * speed * dt;
      this.y += move.y * speed * dt;
      this.facing = Math.atan2(move.y, move.x);
      this.moving = true;
    } else {
      this.moving = false;
    }

    // ---- Timers ----
    if (this.iframes > 0) this.iframes -= dt;
    if (this.attackFlash > 0) this.attackFlash -= dt;
    this.attackTimer -= dt;

    // ---- Auto-attack: cari musuh terdekat dalam range ----
    if (this.attackTimer <= 0) {
      const target = game.findNearestEnemy(this.x, this.y, this.stats.effectiveAttackRange);
      if (target) {
        this.performAttack(target, game);
        this.attackTimer = this.stats.cooldown;
      }
    }
  }

  /** Jalankan attack pattern sesuai data hero. */
  performAttack(target, game) {
    const pattern = this.heroDef.attackPattern;
    this.attackFlash = 0.18; // swap spriteAttack sebentar
    // AIM: bila player mengarahkan (stick kanan / mouse), serangan ikut arah itu
    let aimAngle = null;
    if (game && game.input && game.run) {
      const w = game.viewW || 390;
      const h = game.viewH || 844;
      const cam = game.run.camera;
      const sx = this.x - cam.x + w / 2;
      const sy = this.y - cam.y + h / 2;
      const aim = game.input.getAimInfo(sx, sy);
      if (aim.active) aimAngle = aim.angle;
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
          color: this.heroDef.color,
        });
      }
      game.run.stats.shotsFired += n;
    } else {
      console.warn('[player] attackPattern tidak dikenal:', pattern);
    }
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
