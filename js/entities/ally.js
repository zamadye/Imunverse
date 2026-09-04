/**
 * ally.js — Pasukan Imun (PERMANEN): sel imun kecil yang ikut bertarung
 * bersama hero. Jumlah bertambah per bab kampanye yang dibersihkan
 * (meta.allies, maks 6) dan tersimpan di save.
 *
 * Perilaku: mengapung mengelilingi player (slot sudut), auto-menembak
 * proyektil kecil ke musuh terdekat dalam jangkauan. Tak bisa mati —
 * mereka pendukung DPS, biar kesulitan tetap "medium".
 */

import { getSprite } from '../render/sprite-loader.js';

const ALLY_SPRITES = [
  'assets/sprites/hero_sel_b_idle.png',
  'assets/sprites/hero_sel_nk_idle.png',
  'assets/sprites/hero_makrofag_idle.png',
  'assets/sprites/hero_eosinofil_idle.png',
  'assets/sprites/hero_sel_t_idle.png',
  'assets/sprites/hero_sel_t_attack.png',
];

export class Ally {
  constructor(slot, player) {
    this.slot = slot;
    this.sprite = ALLY_SPRITES[slot % ALLY_SPRITES.length];
    // Posisi awal mengelilingi player
    const ang = (slot / 6) * Math.PI * 2;
    this.orbitAngle = ang;
    this.x = player.x + Math.cos(ang) * 52;
    this.y = player.y + Math.sin(ang) * 52;
    this.radius = 9;
    this.attackCd = 0.8 + slot * 0.17; // stagger tembakan biar organik
    this.fireInterval = 1.15;
    this.range = 240;
    this.wobble = Math.random() * Math.PI * 2;
  }

  /**
   * Ikuti player + tembak musuh terdekat.
   * @returns {object|null} permintaan tembak {x, y, angle, damage, speed}
   */
  update(dt, player, enemies, damage) {
    // Posisi orbit: slot tersebar, sedikit wobbling organik
    this.wobble += dt * 2.1;
    const targetAng = this.orbitAngle + Math.sin(this.wobble) * 0.35 + player.facing * 0;
    const tx = player.x + Math.cos(targetAng) * 52;
    const ty = player.y + Math.sin(targetAng) * 52;
    const lerp = Math.min(1, dt * 4.2);
    this.x += (tx - this.x) * lerp;
    this.y += (ty - this.y) * lerp;

    this.attackCd -= dt;
    if (this.attackCd > 0) return null;

    // Musuh terdekat dalam range
    let best = null;
    let bestD = this.range * this.range;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return null;
    this.attackCd = this.fireInterval;
    return {
      x: this.x,
      y: this.y,
      angle: Math.atan2(best.y - this.y, best.x - this.x),
      damage: Math.max(2, Math.round(damage * 0.35)),
      speed: 420,
      color: '#7fd8c8',
    };
  }

  render(ctx) {
    const img = getSprite(this.sprite).image;
    const bob = Math.sin(this.wobble * 2) * 1.5;
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    // Ring tim (biru muda = sekutu)
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(122, 215, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (img && img.width) {
      ctx.drawImage(img, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#7fd8c8';
      ctx.fill();
    }
    ctx.restore();
  }
}
