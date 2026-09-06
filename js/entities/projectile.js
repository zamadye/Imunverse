/**
 * projectile.js — Proyektil serangan ranged.
 * Pattern:
 *  - 'pierce' : garis lurus, menembus N musuh (hitSet mencegah double-hit)
 *  - 'homing' : belok mengejar musuh terdekat dengan turn rate terbatas
 * Digambar lewat shape-renderer (elemen dinamis — bukan sprite).
 */

let nextProjectileId = 1;

export class Projectile {
  constructor(opts) {
    this.uid = nextProjectileId++;
    this.pattern = opts.pattern;         // 'pierce' | 'homing'
    this.x = opts.x;
    this.y = opts.y;
    this.angle = opts.angle;
    this.speed = opts.speed;
    this.damage = opts.damage;
    this.pierce = Math.max(1, opts.pierce || 1);
    this.turnRate = opts.turnRate || 0;  // rad/detik, untuk homing
    this.antiParasitMult = opts.antiParasitMult || 0; // bonus Eosinofil vs Parasit
    this.color = opts.color || '#ffffff';
    this.radius = opts.radius || 6;
    this.life = 2.2;                     // detik hidup maksimum
    this.alive = true;
    this.hitSet = new Set();             // uid musuh yang sudah kena
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
  }

  /**
   * @param {number} dt
   * @param {object} game  context (findNearestEnemy untuk homing)
   */
  update(dt, game) {
    if (!this.alive) return;
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }

    if (this.pattern === 'homing' && this.turnRate > 0) {
      const target = game.findNearestEnemy(this.x, this.y, 520);
      if (target) {
        // Belokkan heading menuju target dengan laju maksimum turnRate rad/s
        const desired = Math.atan2(target.y - this.y, target.x - this.x);
        let diff = desired - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = this.turnRate * dt;
        const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
        this.angle += turn;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}
