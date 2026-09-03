/**
 * pickup.js — Entitas nutrisi (drop dari musuh): XP, heal, currency, magnet.
 * Bergerak tersebar saat drop, lalu tertarik ke player bila masuk radius magnet.
 */

let nextPickupId = 1;

export class Pickup {
  /**
   * @param {object} def    definisi dari data/nutrients.json
   * @param {number} x
   * @param {number} y
   * @param {number} value  nilai override (mis. XP dari musuh = xpPerKill)
   */
  constructor(def, x, y, value) {
    this.uid = nextPickupId++;
    this.def = def;
    this.pickupType = def.pickupType;
    this.x = x;
    this.y = y;
    this.value = value !== undefined ? value : def.value;
    this.radius = def.radius;
    this.lifetime = def.lifetime;
    this.age = 0;
    this.alive = true;
    this.magnetized = false; // ditarik kuat (efek item sitokin)

    // Sebar acak saat drop
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 90;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  /**
   * @param {number} dt
   * @param {{x:number,y:number, pickupRadius:number, magnetRadius:number}} player
   */
  update(dt, player) {
    if (!this.alive) return;
    this.age += dt;
    if (this.age > this.lifetime) {
      this.alive = false;
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Efek magnet: semua pickup ditarik kuat ke player
    if (this.magnetized) {
      const pull = 640;
      this.vx += (dx / dist) * pull * dt;
      this.vy += (dy / dist) * pull * dt;
    } else if (dist < player.magnetRadius) {
      // Tarikan magnet natural dalam radius
      const pull = 420;
      this.vx += (dx / dist) * pull * dt;
      this.vy += (dy / dist) * pull * dt;
    } else {
      // Gesekan cairan: kecepatan sebar meluruh
      const friction = Math.max(0, 1 - 5 * dt);
      this.vx *= friction;
      this.vy *= friction;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /** Apakah sudah bisa diambil player. */
  isCollectedBy(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const rr = player.pickupRadius + this.radius;
    return dx * dx + dy * dy < rr * rr;
  }
}
