/**
 * skill-system.js — Sistem 3 skill aktif per hero (Skill 1, Skill 2, Ultimate)
 * ala MLBB. Data-driven penuh dari data/skills.json: setiap skill = daftar
 * efek primitif (area, strike, heal, buff, shield, mark, dash, dst.) yang
 * dieksekusi executor di bawah — TIDAK ada logika hero yang di-hardcode.
 */

import { getData } from '../core/data-store.js';
import { audio } from './audio-system.js';
import { emit } from '../core/ui-bridge.js';
import { t as tr } from '../systems/i18n.js';

export class SkillSystem {
  /**
   * @param {object} heroDef definisi hero (heroDef.skills = [id,id,id])
   * @param {object} [mods] { cdMult } dari upgrade JURUS permanen
   */
  constructor(heroDef, mods = {}) {
    const all = getData().skills.skills;
    this.slots = (heroDef.skills || []).map((id, i) => {
      const def = all.find((s) => s.id === id);
      if (!def) return null;
      const d = { ...def, cooldown: Math.max(0.8, def.cooldown * (mods.cdMult || 1)) };
      return { def: d, cdLeft: 0, ult: i === 2 };
    }).filter(Boolean);
    this.lastBanner = '';
  }

  /** @param {number} dt */
  update(dt) {
    for (const s of this.slots) if (s.cdLeft > 0) s.cdLeft = Math.max(0, s.cdLeft - dt);
  }

  getView() {
    return this.slots.map((s) => ({
      id: s.def.id, name: tr(s.def.name), color: s.def.color,
      cdLeft: s.cdLeft, cdTotal: s.def.cooldown, ready: s.cdLeft <= 0, ult: s.ult,
    }));
  }

  /**
   * Aktivasi skill slot i. @returns {boolean} true bila terluncur.
   * ctx: { game, player, enemies, damage, effects, camera }
   */
  trigger(i, ctx) {
    const s = this.slots[i];
    if (!s || s.cdLeft > 0) return false;
    s.cdLeft = s.def.cooldown;
    const run = ctx.game.run;
    for (const fx of s.def.effects) this.#apply(fx, ctx, run);
    ctx.player.squash = 0.16;
    ctx.camera?.addShake(0.2);
    ctx.game.hitStopRun(0.05);
    audio.ability(s.ult ? 'petir' : 'tebasan');
    this.lastBanner = tr(s.def.name);
    emit('abilityBanner', { name: tr(s.def.name), color: s.def.color, ult: s.ult });
    return true;
  }

  #nearest(ctx, maxDist = 1e9) {
    let best = null, bd = maxDist;
    for (const e of ctx.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - ctx.player.x, e.y - ctx.player.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  #apply(fx, ctx, run) {
    const { player, enemies, damage, effects, game } = ctx;
    const px = player.x, py = player.y;
    switch (fx.kind) {
      case 'area': {
        effects.spawnBlast(px, py, fx.radius, '#ffd93d');
        for (const e of enemies) {
          if (!e.alive) continue;
          if (Math.hypot(e.x - px, e.y - py) > fx.radius + e.radius) continue;
          const died = e.takeDamage(damage * (fx.mult || 1));
          game.spawnHitFeedback(e, damage * (fx.mult || 1), died);
          if (fx.slow) { e.slowT = fx.slow.duration; e.slowMult = fx.slow.mult; }
          if (fx.stun) e.frozen = Math.max(e.frozen, fx.stun);
          if (died) game.onEnemyKilled(e, null);
        }
        break;
      }
      case 'strike': {
        const t = this.#nearest(ctx);
        if (!t) break;
        const dmg = damage * (fx.mult || 1);
        effects.spawnSwipe(px, py, Math.atan2(t.y - py, t.x - px), 90, 2.2, '#ffe082');
        if (fx.dot) { t.dotMult = fx.dot.mult; t.dotT = fx.dot.duration; t.dotSrc = damage; }
        if (fx.slow) { t.slowT = fx.slow.duration; t.slowMult = fx.slow.mult; }
        if (fx.stun) t.frozen = Math.max(t.frozen, fx.stun);
        const died = t.takeDamage(dmg);
        game.spawnHitFeedback(t, dmg, died);
        if (died) game.onEnemyKilled(t, null);
        break;
      }
      case 'execute': {
        const t = this.#nearest(ctx);
        if (!t) break;
        const lowHP = t.hp / t.maxHP < fx.threshold;
        const dmg = damage * (lowHP ? fx.execMult : fx.mult);
        effects.spawnBlast(t.x, t.y, 50, lowHP ? '#ff5d73' : '#7fdbff');
        const died = t.takeDamage(dmg);
        game.spawnHitFeedback(t, dmg, died);
        if (died) game.onEnemyKilled(t, null);
        break;
      }
      case 'annihilate': {
        const t = this.#nearest(ctx);
        if (!t) break;
        const dmg = damage * fx.mult + t.maxHP * fx.hpPct;
        const died = t.takeDamage(dmg);
        effects.spawnBlast(t.x, t.y, fx.radius, '#c39bd3');
        game.spawnHitFeedback(t, dmg, died);
        if (died) game.onEnemyKilled(t, null);
        for (const e of enemies) {
          if (!e.alive || e === t) continue;
          if (Math.hypot(e.x - t.x, e.y - t.y) > fx.radius) continue;
          const d2 = e.takeDamage(damage * 1.2);
          game.spawnHitFeedback(e, damage * 1.2, d2);
          if (d2) game.onEnemyKilled(e, null);
        }
        break;
      }
      case 'instant_hits': {
        const t = this.#nearest(ctx);
        if (!t) break;
        const total = (fx.hits || 3) * damage * (fx.mult || 1);
        for (let i = 0; i < (fx.hits || 3); i++) {
          const died = t.alive && t.takeDamage(damage * (fx.mult || 1));
          game.spawnHitFeedback(t, damage * (fx.mult || 1), died);
          if (died) { game.onEnemyKilled(t, null); break; }
        }
        effects.spawnLabel(t.x, t.y - t.radius - 12, `x${fx.hits}`, s_defColor(run, this));
        break;
      }
      case 'summon_homing': {
        for (let i = 0; i < (fx.count || 3); i++) {
          const ang = (Math.PI * 2 * i) / (fx.count || 3);
          game.spawnProjectile({
            pattern: 'homing', x: px + Math.cos(ang) * player.radius, y: py + Math.sin(ang) * player.radius,
            angle: ang, speed: 260, damage: damage * (fx.mult || 1), pierce: 1, turnRate: 6,
            color: '#f5c64f',
          });
        }
        break;
      }
      case 'heal': {
        player.heal(fx.amount);
        effects.spawnLabel(px, py - player.radius - 14, `+${fx.amount} HP`, '#7ae582');
        if (fx.radius) {
          for (const ally of run.allies) if (ally.hp !== undefined) ally.hp = Math.min((ally.maxHP || 30), (ally.hp || 30) + fx.amount * 0.5);
          effects.spawnBlast(px, py, fx.radius, '#7ae582');
        }
        break;
      }
      case 'shield_self': {
        run.shield = (run.shield || 0) + fx.amount;
        effects.spawnLabel(px, py - player.radius - 14, `+${fx.amount} 🛡`, '#7fd8c8');
        break;
      }
      case 'protect_self': {
        run.protectMult = fx.mult; run.protectT = fx.duration;
        effects.spawnBlast(px, py, 60, '#8fd8ff');
        break;
      }
      case 'buff_self': {
        const B = run.tempBuffs;
        if (fx.damage) { B.damage.mult *= 1 + fx.damage / 100; B.damage.t = Math.max(B.damage.t, fx.duration); }
        if (fx.speed) { B.speed.mult *= 1 + fx.speed / 100; B.speed.t = Math.max(B.speed.t, fx.duration); }
        if (fx.cd) { B.cooldown.mult *= Math.max(0.5, 1 - fx.cd / 100); B.cooldown.t = Math.max(B.cooldown.t, fx.duration); }
        if (fx.evade) run.evadeCharges = (run.evadeCharges || 0) + fx.evade;
        game.recomputePlayerStats();
        break;
      }
      case 'buff_allies': {
        const B = run.tempBuffs;
        if (fx.damage) { B.damage.mult *= 1 + fx.damage / 100; B.damage.t = Math.max(B.damage.t, fx.duration); }
        if (fx.protect) { run.protectMult = Math.min(run.protectMult, 1 - fx.protect / 100); run.protectT = Math.max(run.protectT, fx.duration); }
        game.recomputePlayerStats();
        effects.spawnBlast(px, py, Math.min(fx.radius, 240), '#ffd93d');
        break;
      }
      case 'mark': {
        const t = this.#nearest(ctx);
        if (!t) break;
        t.markMult = 1 + fx.dmg / 100; t.markT = fx.duration;
        effects.spawnLabel(t.x, t.y - t.radius - 10, '◎', '#ff8c00');
        break;
      }
      case 'pull': {
        effects.spawnBlast(px, py, fx.radius, '#d4a017');
        for (const e of enemies) {
          if (!e.alive) continue;
          const d = Math.hypot(e.x - px, e.y - py);
          if (d > fx.radius || e.isBoss) continue;
          const ang = Math.atan2(py - e.y, px - e.x);
          e.vx += Math.cos(ang) * 340; e.vy += Math.sin(ang) * 340;
        }
        break;
      }
      case 'dash': {
        player.iframes = Math.max(player.iframes, 0.35);
        player.x += Math.cos(player.facing) * fx.distance;
        player.y += Math.sin(player.facing) * fx.distance;
        effects.spawnBlast(px, py, 44, '#4a235a');
        break;
      }
      default:
        console.warn('[skills] efek tidak dikenal:', fx.kind);
    }
  }
}

function s_defColor(run, sys) {
  return '#ffe082';
}
