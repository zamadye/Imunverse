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
import { drawFigure } from '../render/humanoid.js';

const ALLY_SPRITES = [
  'assets/sprites/hero_bcell_idle.png',
  'assets/sprites/hero_nkcell_idle.png',
  'assets/sprites/hero_macrophage_idle.png',
  'assets/sprites/hero_eosinophil_idle.png',
  'assets/sprites/hero_tcd8_idle.png',
  'assets/sprites/hero_tcd4_idle.png',
];
// Fase 12d: pasukan = FIGUR HUMANOID kecil (warna sel masing-masing)
const ALLY_SPECS = [
  { primary: '#bb8fce', accent: '#ff5c8a' },  // Bella
  { primary: '#4a235a', accent: '#b08cff' },  // Nyx
  { primary: '#4a7c59', accent: '#f4d03f' },  // Mako
  { primary: '#ff6b81', accent: '#ffb3ab' },  // Eos
  { primary: '#00d2ff', accent: '#cfd8dc' },  // T-Bolt
  { primary: '#f1c40f', accent: '#ffffff' },  // Helia
];

export class Ally {
  constructor(slot, player, speedBonus = 0) {
    this.slot = slot;
    this.sprite = ALLY_SPRITES[slot % ALLY_SPRITES.length];
    // Posisi awal mengelilingi player
    const ang = (slot / 6) * Math.PI * 2;
    this.orbitAngle = ang;
    this.x = player.x + Math.cos(ang) * 52;
    this.y = player.y + Math.sin(ang) * 52;
    this.radius = 10;
    this.attackCd = 0.6 + slot * 0.15; // stagger tembakan biar organik
    this.fireInterval = Math.max(0.55, 0.95 - speedBonus);
    this.range = 260;
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
      damage: Math.max(2, Math.round(damage * 0.45)),
      speed: 440,
      color: '#4ae3c2',
    };
  }

  render(ctx) {
    // Ring tim (biru muda = sekutu)
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(122, 215, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Fase 12d: figur humanoid mini (kaki+tangan+ekspresi), selalu tampak jalan
    const spec = ALLY_SPECS[this.slot % ALLY_SPECS.length] || ALLY_SPECS[0];
    drawFigure(ctx, {
      x: this.x, y: this.y, r: this.radius * 0.8,
      primary: spec.primary, accent: spec.accent,
      build: 'medium',
      phase: this.wobble * 2.2, moving: true,
      attackT: 0, swingT: 0,
      mood: 'happy', flip: 1,
    });
  }
}
