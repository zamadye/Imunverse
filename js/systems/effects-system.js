/**
 * effects-system.js — Partikel & efek visual sementara (vfx).
 * Semua digambar lewat shape-renderer (elemen dinamis, bukan sprite).
 * Menggunakan object array sederhana dengan pool cap agar GC aman.
 */

const MAX_PARTICLES = 400;
const MAX_EFFECTS = 80;
const MAX_NUMBERS = 40;

export class EffectsSystem {
  constructor() {
    this.particles = []; // {x,y,vx,vy,life,maxLife,size,color}
    this.effects = [];   // {type:'swipe'|'blast'|'ring'|'collect'|'spark', ...}
    this.numbers = [];   // angka damage mengambang {x,y,vy,life,maxLife,text,color,size}
  }

  clear() {
    this.particles.length = 0;
    this.effects.length = 0;
    this.numbers.length = 0;
  }

  /** Burst partikel (mis. musuh meledak jadi sitoplasma). */
  spawnBurst(x, y, color, count = 8, speed = 150, size = 4) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.85);
      const life = 0.35 + Math.random() * 0.45;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
      });
    }
  }

  /** Efek tebasan melee (arc). */
  spawnSwipe(x, y, angle, radius, arc, color) {
    if (this.effects.length >= MAX_EFFECTS) this.effects.shift();
    this.effects.push({ type: 'swipe', x, y, angle, radius, arc, color, life: 0.18, maxLife: 0.18 });
  }

  /** Ledakan boss (lingkaran blast). */
  spawnBlast(x, y, radius, color) {
    if (this.effects.length >= MAX_EFFECTS) this.effects.shift();
    this.effects.push({ type: 'blast', x, y, radius, color, life: 0.4, maxLife: 0.4 });
    this.spawnBurst(x, y, color, 16, 260, 5);
  }

  /** Kilatan kecil saat pickup diambil. */
  spawnCollect(x, y, color) {
    this.spawnBurst(x, y, color, 4, 90, 3);
  }

  /**
   * VFX kematian musuh sesuai tier evolusi hero (killFx):
   * ring (common) | slash (uncommon) | wind (rare) | bolt (epic) |
   * legend (legendary: petir + ring emas) | frost (beku fagosit).
   * Digambar shape-renderer.drawKillFx.
   */
  spawnKillFx(kind, x, y, color, seed = 0) {
    if (this.effects.length >= MAX_EFFECTS) this.effects.shift();
    const life = kind === 'legend' ? 0.5 : kind === 'bolt' ? 0.3 : 0.4;
    this.effects.push({ type: 'killfx', kind, x, y, color, seed, life, maxLife: life });
  }

  /** Bintang hit (aset fx_hit.png) saat musuh menerima damage. */
  spawnSpark(x, y, big = false) {
    if (this.effects.length >= MAX_EFFECTS) this.effects.shift();
    this.effects.push({ type: 'spark', x, y, rot: Math.random() * Math.PI, big, life: 0.16, maxLife: 0.16 });
  }

  /**
   * Angka damage mengambang (real, dipanggil dari setiap hit).
   * @param {number} amount
   */
  spawnDamageNumber(x, y, amount, color = '#fff') {
    if (this.numbers.length >= MAX_NUMBERS) this.numbers.shift();
    this.numbers.push({
      x: x + (Math.random() - 0.5) * 14,
      y: y - 8,
      vy: -55,
      life: 0.65,
      maxLife: 0.65,
      text: String(Math.max(1, Math.round(amount))),
      color,
      size: 13,
    });
  }

  /** Label bebas mengambang (mis. "Silia +1" saat drop bagian evolusi diambil). */
  spawnLabel(x, y, text, color = '#ffe082') {
    if (this.numbers.length >= MAX_NUMBERS) this.numbers.shift();
    this.numbers.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y - 12,
      vy: -40,
      life: 0.9,
      maxLife: 0.9,
      text,
      color,
      size: 12,
    });
  }

  update(dt) {
    // Partikel
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const fric = Math.max(0, 1 - 3.2 * dt);
      p.vx *= fric;
      p.vy *= fric;
    }
    // Efek
    const es = this.effects;
    for (let i = es.length - 1; i >= 0; i--) {
      es[i].life -= dt;
      if (es[i].life <= 0) {
        es[i] = es[es.length - 1];
        es.pop();
      }
    }
    // Angka damage
    const ns = this.numbers;
    for (let i = ns.length - 1; i >= 0; i--) {
      const n = ns[i];
      n.life -= dt;
      if (n.life <= 0) {
        ns[i] = ns[ns.length - 1];
        ns.pop();
        continue;
      }
      n.y += n.vy * dt;
      n.vy *= Math.max(0, 1 - 2.5 * dt);
    }
  }
}
