/**
 * ability-system.js — 4 tombol kemampuan aktif di kanan layar.
 *
 * Slot 1 = senjata (pedang), slot 2-4 = kekuatan elemen (angin, petir, beku).
 * Terbuka mengikuti tahap evolusi hero (lihat evolution-system.js).
 * Cooldown per kemampuan; aktivasi mengeksekusi damage/kontrol nyata pada
 * musuh dan memunculkan VFX (shape-renderer.drawKillFx / effects-system).
 */

import { getData } from '../core/data-store.js';
import { audio } from './audio-system.js';
import { emit } from '../core/ui-bridge.js';

export class AbilitySystem {
  /**
   * @param {string[]} unlockedIds
   * @param {object} [mods] { cd, radius } — dari upgrade JURUS (permanen)
   */
  constructor(unlockedIds, mods = {}) {
    this.abilities = getData().abilities.abilities.map((raw) => {
      const def = { ...raw };
      if (mods.cd && mods.cd !== 1) def.cooldown = Math.max(0.6, def.cooldown * mods.cd);
      if (mods.radius && mods.radius !== 1 && def.radius) def.radius = def.radius * mods.radius;
      return {
        def,
        unlocked: unlockedIds.includes(def.id),
        cdLeft: 0,
      };
    });
  }

  /** @param {number} dt */
  update(dt) {
    for (const a of this.abilities) {
      if (a.cdLeft > 0) a.cdLeft = Math.max(0, a.cdLeft - dt);
    }
  }

  /** State ringkas untuk HUD. */
  getView() {
    return this.abilities.map((a) => ({
      id: a.def.id,
      name: a.def.name,
      icon: a.def.icon,
      slot: a.def.slot,
      key: a.def.key,
      unlocked: a.unlocked,
      cdLeft: a.cdLeft,
      cdTotal: a.def.cooldown,
      ready: a.unlocked && a.cdLeft <= 0,
    }));
  }

  getBySlot(slot) {
    return this.abilities.find((a) => a.def.slot === slot) || null;
  }

  getById(id) {
    return this.abilities.find((a) => a.def.id === id) || null;
  }

  /**
   * Aktivasi kemampuan. @returns {boolean} true bila terluncur.
   * @param {object} ctx { player, enemies, damage, effects, camera }
   */
  triggerBySlot(slot, ctx) {
    const a = this.getBySlot(slot);
    if (!a || !a.unlocked || a.cdLeft > 0) return false;
    a.cdLeft = a.def.cooldown;
    this.#execute(a.def, ctx);
    // JUICE cast: ring ledakan + shake + squash + hit-stop — jurus TERASA keluar
    if (ctx.player) {
      ctx.player.squash = 0.16;
      if (ctx.effects) ctx.effects.spawnBlast(ctx.player.x, ctx.player.y, a.def.radius || 80, a.def.fxColor || '#7fd8c8');
      if (ctx.camera) ctx.camera.addShake(0.22);
      if (ctx.game && ctx.game.hitStopRun) ctx.game.hitStopRun(0.06);
    }
    audio.ability(a.def.id);
    emit('abilityBanner', { name: a.def.name, color: a.def.fxColor || '#2f9c8f' });
    return true;
  }

  #execute(def, ctx) {
    const { player, enemies, damage, effects } = ctx;
    const dmg = damage * def.damageMult;
    const px = player.x;
    const py = player.y;

    if (def.kind === 'melee_arc') {
      // Tebasan 240° di arah hadap player (pakai rotasi player)
      const ang = player.facingAngle ?? 0;
      const half = def.arc / 2;
      let hits = 0;
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = e.x - px;
        const dy = e.y - py;
        const dist = Math.hypot(dx, dy);
        if (dist > def.radius + e.radius) continue;
        const a2 = Math.atan2(dy, dx);
        let diff = Math.abs(((a2 - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff <= half) {
          ctx.hitEnemy?.(e, dmg, 'ability');
          hits++;
        }
      }
      effects.spawnSwipe(px, py, ang, def.radius, def.arc, def.fxColor);
      effects.spawnBurst(px + Math.cos(ang) * def.radius * 0.6, py + Math.sin(ang) * def.radius * 0.6, def.fxColor, 8, 200, 4);
      ctx.camera?.addShake(0.25);
      return hits;
    }

    if (def.kind === 'push') {
      // Siklon: dorong + lambat semua musuh dalam radius
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = e.x - px;
        const dy = e.y - py;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > def.radius + e.radius) continue;
        const force = def.pushForce * (1 - dist / (def.radius * 1.4));
        e.vx += (dx / dist) * force;
        e.vy += (dy / dist) * force;
        e.applySlow?.(def.slowMult, def.slowTime);
        ctx.hitEnemy?.(e, dmg, 'ability');
      }
      effects.spawnKillFx('wind', px, py, def.fxColor, Math.random() * 10);
      return -1;
    }

    if (def.kind === 'lightning') {
      // Petir: N musuh terdekat, strike dengan VFX petir
      const targets = enemies
        .filter((e) => e.alive)
        .map((e) => ({ e, d: Math.hypot(e.x - px, e.y - py) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, def.targets);
      for (const { e } of targets) {
        effects.spawnKillFx('bolt', e.x, e.y, def.fxColor, Math.random() * 10);
        ctx.hitEnemy?.(e, dmg, 'ability');
      }
      ctx.camera?.addShake(0.3);
      return targets.length;
    }

    if (def.kind === 'freeze') {
      // Beku: musuh dalam radius berhenti total sementara
      for (const e of enemies) {
        if (!e.alive) continue;
        const dist = Math.hypot(e.x - px, e.y - py);
        if (dist > def.radius + e.radius) continue;
        e.applyFreeze?.(def.freezeTime);
        ctx.hitEnemy?.(e, dmg, 'ability');
      }
      effects.spawnKillFx('frost', px, py, def.fxColor, Math.random() * 10);
      return -1;
    }
    return 0;
  }
}
