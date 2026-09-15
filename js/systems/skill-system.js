/**
 * skill-system.js — PHAGOS D5 (owner): 3 skill PASIF per hero (bukan tombol).
 * Tiap skill punya `trigger` (pulse/engulf/kill/damaged — data/skills.json)
 * dan menyala OTOMATIS saat pemicunya terjadi (cooldown = jeda minimum).
 * Aktivasi di level 3/5/10, rank 2 otomatis di level 15. TIDAK ADA tombol
 * cast, TIDAK ADA biaya upgrade. Eksekutor efek tetap data-driven.
 */

import { getData, getGameFeel } from '../core/data-store.js';
import { buzz } from './haptics.js'; // V2 Phase 1
import { audio } from './audio-system.js';
import { emit } from '../core/ui-bridge.js';
import { tryDevour } from './phagocytosis.js'; // R4: Modul B
import { spawnInflamZone } from './inflammation.js'; // R5: Modul C
import { chemoActivate } from './chemotaxis.js'; // R7: Modul E
import { t as tr } from '../systems/i18n.js';
// Progresi pasif: aktif Lv 3/5/10 + rank 2 otomatis Lv 15 — terpusat
import {
  isSkillUnlocked, getSkillUnlockLevel,
  skillRankDamageMult, skillRankCooldownMult, SKILL_RANK2_LEVEL,
} from './skill-unlock.js';

/** Label Indonesia pemicu skill pasif (HUD). */
export const SKILL_TRIGGER_LABEL = { pulse: 'saat Pulse', engulf: 'saat menelan', kill: 'saat kill', damaged: 'saat terluka' };

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
      // unlocked: override manual (E2E/dev). Progresi nyata dihitung dari
      // run.level lewat skill-unlock.js — TIDAK ada state level duplikat.
      return { def: d, cdLeft: 0, ult: i === 2, unlocked: false, rank: 1 };
    }).filter(Boolean);
    this.lastBanner = '';
  }

  /** @param {number} dt */
  update(dt) {
    for (const s of this.slots) if (s.cdLeft > 0) s.cdLeft = Math.max(0, s.cdLeft - dt);
  }

  /**
   * View HUD deret pasif (ikon + status, tanpa tombol).
   * @param {number} playerLevel level player di-run (source of truth: run.level)
   */
  getView(playerLevel = Infinity) {
    return this.slots.map((s, i) => ({
      id: s.def.id, name: tr(s.def.name), desc: tr(s.def.description || ''),
      color: s.def.color, ult: s.ult,
      trigger: s.def.trigger || 'pulse',
      triggerLabel: SKILL_TRIGGER_LABEL[s.def.trigger] || s.def.trigger,
      locked: !isSkillUnlocked(playerLevel, i, s),
      unlockLevel: getSkillUnlockLevel(i),
      cdLeft: s.cdLeft, cdTotal: s.def.cooldown,
      rank: s.rank || 1,
    }));
  }

  /**
   * PHAGOS D5: pemicu otomatis — nyalakan semua slot yang cocok.
   * @param {string} triggerName pulse|engulf|kill|damaged
   * @param {object} ctx konteks eksekusi (dari game.skillCtx())
   */
  notify(triggerName, ctx) {
    const game = ctx && ctx.game;
    const run = game && game.run;
    if (!run || run.ended || !run.player || !run.player.alive) return;
    for (let i = 0; i < this.slots.length; i++) {
      const sl = this.slots[i];
      if (!sl || (sl.def.trigger || 'pulse') !== triggerName) continue;
      if (sl.cdLeft > 0) continue;
      try { this.trigger(i, ctx); } catch { /* satu skill gagal → lainnya tetap */ }
    }
  }

  /**
   * Eksekusi skill slot i (dipanggil notify otomatis). @returns {boolean} true bila terluncur.
   * ctx: { game, player, enemies, damage, effects, camera }
   */
  trigger(i, ctx) {
    const s = this.slots[i];
    if (!s || s.cdLeft > 0) return false;
    // GUARD progression: slot LOCKED tak boleh tereksekusi lewat jalur apa pun.
    const playerLevel = ctx?.game?.run?.level ?? 1;
    if (!isSkillUnlocked(playerLevel, i, s)) return false;
    // D5: rank 2 OTOMATIS di level 15 (tanpa biaya/tombol).
    s.rank = playerLevel >= SKILL_RANK2_LEVEL ? 2 : 1;
    s.cdLeft = s.def.cooldown * skillRankCooldownMult(s);
    // Rank upgrade (Lv 15+) memperkuat damage seluruh efek skill ini
    if ((s.rank || 1) > 1) ctx = { ...ctx, damage: ctx.damage * skillRankDamageMult(s) };
    const run = ctx.game.run;
    const primaryKind = (s.def.effects && s.def.effects[0] && s.def.effects[0].kind) || 'skill';
    const charFx = characterSkillVisual(ctx, s.def, primaryKind);
    const castColor = s.def.color || charFx.equityColor || ctx.player.heroDef?.color || '#ffd93d';
    // Frame budget aset: setiap hero hanya punya 1 idle PNG + 1 attack PNG.
    // Jadi buildup/payoff dibuat sebagai VFX shape procedural singkat, bukan
    // berpura-pura ada sprite-sheet charge yang belum diproduksi tim art.
    // Character Agent: VFX cast membawa archetype + warna equity aktif agar
    // skill di gameplay punya identitas biologis tanpa mengubah damage/cooldown.
    ctx.effects?.spawnAbilityCharge(ctx.player.x, ctx.player.y, castColor, { ult: s.ult, kind: primaryKind, ...charFx });
    for (const fx of s.def.effects) this.#apply(fx, ctx, run);
    ctx.effects?.spawnAbilityPayoff(ctx.player.x, ctx.player.y, castColor, { ult: s.ult, kind: primaryKind, ...charFx });
    // R7 Modul E: skill gerak/buff-diri meninggalkan jejak sinyal kemotaksis
    if (s.def.effects.some((fx) => fx.kind === 'dash' || fx.kind === 'buff_self')) {
      chemoActivate(ctx.game);
    }
    ctx.player.squash = 0.16;
    // V2 Phase 1: ULTIMATE cast lebih "berat" — hit-stop & shake dari gamefeel.json
    if (s.ult) {
      const gf = getGameFeel();
      ctx.camera?.addShake(gf.shake.ultCast);
      ctx.game.hitStopRun(gf.hitStop.ult);
      buzz('levelup'); // pola selebrasi pendek utk momen ult
    } else {
      ctx.camera?.addShake(0.2);
      ctx.game.hitStopRun(0.05);
    }
    audio.ability(s.ult ? 'petir' : 'tebasan');
    // D5: banner hanya untuk slot-3 (ult) agar auto-cast tak membanjiri layar.
    if (s.ult) {
      this.lastBanner = tr(s.def.name);
      emit('abilityBanner', { name: tr(s.def.name), color: s.def.color, ult: s.ult });
    }
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
          if (died) game.onEnemyKilled(e, 'skill');
        }
        // R5 Modul C: skill area menumpuk INFLAMASI di lantai (bukan di
        // musuh) — zona DoT yang memanas menuju cytokine storm. Flag OFF
        // = tidak ada zona (perilaku pra-R5 utuh).
        spawnInflamZone(game, px, py, fx.radius);
        break;
      }
      case 'devour': {
        // R4 Modul B: TELAN musuh eligible (window <20% HP) — instan jadi
        // resource; fallback: strike lama bila tak ada target sekarat.
        if (tryDevour(game, ctx)) break;
        const t0 = this.#nearest(ctx);
        if (t0) {
          const dmg0 = damage * (fx.mult || 4);
          effects.spawnSwipe(px, py, Math.atan2(t0.y - py, t0.x - px), 90, 2.2, '#ffe082');
          const died0 = t0.takeDamage(dmg0);
          game.spawnHitFeedback(t0, dmg0, died0);
          if (died0) game.onEnemyKilled(t0, 'skill');
        }
        if (fx.heal) player.heal(fx.heal);
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
        if (died) game.onEnemyKilled(t, 'skill');
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
        if (died) game.onEnemyKilled(t, 'skill');
        break;
      }
      case 'annihilate': {
        const t = this.#nearest(ctx);
        if (!t) break;
        const dmg = damage * fx.mult + t.maxHP * fx.hpPct;
        const died = t.takeDamage(dmg);
        effects.spawnBlast(t.x, t.y, fx.radius, '#c39bd3');
        game.spawnHitFeedback(t, dmg, died);
        if (died) game.onEnemyKilled(t, 'skill');
        for (const e of enemies) {
          if (!e.alive || e === t) continue;
          if (Math.hypot(e.x - t.x, e.y - t.y) > fx.radius) continue;
          const d2 = e.takeDamage(damage * 1.2);
          game.spawnHitFeedback(e, damage * 1.2, d2);
          if (d2) game.onEnemyKilled(e, 'skill');
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
          if (died) { game.onEnemyKilled(t, 'skill'); break; }
        }
        effects.spawnLabel(t.x, t.y - t.radius - 12, `x${fx.hits}`, s_defColor(run, this));
        break;
      }
      case 'instant_multi': { // D3: N hit instan ke N terdekat (tanpa proyektil)
        const sorted = [...enemies].filter((e) => e.alive)
          .sort((a, b) => (Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py)));
        for (const t of sorted.slice(0, fx.count || 3)) {
          const dmg = damage * (fx.mult || 1);
          effects.spawnBurst(t.x, t.y, '#f5c64f', 5, 170, 3);
          const died = t.takeDamage(dmg);
          game.spawnHitFeedback(t, dmg, died);
          if (died) game.onEnemyKilled(t, 'skill');
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

function characterSkillVisual(ctx, skillDef, primaryKind) {
  const heroDef = ctx.player?.heroDef;
  const run = ctx.game?.run;
  const designs = getData().characterDesigns;
  const heroDesign = heroDef ? designs?.heroes?.[heroDef.id] : null;
  const stage = Math.max(0, Math.min(4, run?.evoStage?.stage || 0));
  const eq = stage > 0 ? (heroDesign?.equity || []).find((e) => e.stage === stage) : null;
  return {
    skillId: skillDef?.id || primaryKind,
    skillKind: primaryKind,
    archetype: heroDesign?.archetype || 'generic',
    heroColor: heroDef?.color || skillDef?.color || '#35d0ba',
    equityColor: eq?.color || run?.evoStage?.tierColor || heroDef?.color || skillDef?.color || '#35d0ba',
    equityStage: stage,
    equityCue: eq?.visualCue || heroDesign?.baseCue || '',
  };
}

function s_defColor(run, sys) {
  return '#ffe082';
}
