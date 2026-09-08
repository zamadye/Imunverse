/**
 * passive-system.js — V2 Phase 3: HERO IDENTITY.
 *
 * Setiap hero punya SATU passive khas (data/heroes.json → passive
 * {type, name, desc, params}) yang mengubah cara bermain, bukan hanya angka.
 * Modul ini stateless terhadap hero: semua dibaca dari def, dieksekusi lewat
 * 5 hook yang dipanggil game.js/skill-system:
 *   - critBonus()            → rollCrit (bcell)
 *   - skillCdMult()          → konstruktor SkillSystem (tcd4)
 *   - modifyOutgoingDamage() → jalur proyektil & melee (tcd8 execute + mark)
 *   - onHit()/onKill()/onPlayerHit()/tick() → efek berjalan
 *
 * CATATAN mark: markMult/markT ada sejak Fase 12 tapi tidak pernah dikonsumsi
 * (skill mark_target no-op). Phase 3 memperbaikinya: modifyOutgoingDamage
 * mengalikan markMult, dan game.js meluruhkan markT — skill itu hidup lagi.
 */

import { buzz } from './haptics.js';

const P = (run) => (run && run.heroDef && run.heroDef.passive) || null;

/** Bonus crit chance aditif (bcell "Memori Antibodi"). */
export function passiveCritBonus(run) {
  const p = P(run);
  return p && p.type === 'crit_up' ? p.params.bonus : 0;
}

/** Multiplier cooldown skill (tcd4 "Komando Sitokin"). Dipakai saat init run. */
export function passiveSkillCdMult(heroDef) {
  const p = heroDef && heroDef.passive;
  return p && p.type === 'skill_haste' ? p.params.cdMult : 1;
}

/**
 * Modifikasi damage keluar player→musuh. Berlaku identik untuk proyektil,
 * melee, dan skill (dipanggil di satu titik per jalur).
 * mark (siapa pun sumbernya) + execute (tcd8).
 */
export function modifyOutgoingDamage(run, enemy, dmg) {
  // MARK: musuh bertanda menerima damage lebih besar (fix no-op V1)
  if (enemy.markT > 0 && enemy.markMult > 1) dmg *= enemy.markMult;
  const p = P(run);
  if (p && p.type === 'execute_bonus' && enemy.hp / enemy.maxHP < p.params.threshold) {
    dmg *= 1 + p.params.bonus;
  }
  return dmg;
}

/** Setelah player memukul musuh (dendritic mark, eosinophil poison). */
export function passiveOnHit(run, enemy, damage) {
  const p = P(run);
  if (!p || !enemy.alive) return;
  if (p.type === 'mark_on_hit') {
    enemy.markMult = Math.max(enemy.markMult, 1 + p.params.dmg / 100);
    enemy.markT = p.params.duration;
  } else if (p.type === 'poison_on_hit') {
    enemy.dotMult = p.params.mult;
    enemy.dotT = Math.max(enemy.dotT, p.params.duration);
    enemy.dotSrc = damage;
  }
}

/** Setelah kill (macrophage heal, neutrophil frenzy). */
export function passiveOnKill(run, game) {
  const p = P(run);
  if (!p) return;
  if (p.type === 'lifesteal_kill') {
    run.player.heal(p.params.heal);
  } else if (p.type === 'frenzy_on_kill') {
    const B = run.tempBuffs;
    B.cooldown.mult = Math.min(B.cooldown.mult, 1 - p.params.haste / 100);
    B.cooldown.t = Math.max(B.cooldown.t, p.params.duration);
    game.recomputePlayerStats();
  }
}

/** Saat player menerima damage (mastcell retaliate). */
export function passiveOnPlayerHit(run, game) {
  const p = P(run);
  if (!p || p.type !== 'retaliate') return;
  const { player, effects } = run;
  effects.spawnBlast(player.x, player.y, p.params.radius, '#e8804a');
  buzz('crit');
  for (const e of run.enemies) {
    if (!e.alive) continue;
    if (Math.hypot(e.x - player.x, e.y - player.y) > p.params.radius + e.radius) continue;
    const dmg = p.params.damage;
    const died = e.takeDamage(dmg);
    game.spawnHitFeedback(e, dmg, died);
    if (died) game.onEnemyKilled(e, null);
  }
}

/** Per-frame (treg regen, basophil slow aura, nkcell reveal pulse). */
export function passiveTick(run, dt) {
  const p = P(run);
  if (!p) return;
  if (p.type === 'regen') {
    run.player.heal(p.params.hpPerSec * dt);
  } else if (p.type === 'slow_aura') {
    const { player } = run;
    for (const e of run.enemies) {
      if (!e.alive || e.isBoss) continue;
      if (Math.hypot(e.x - player.x, e.y - player.y) <= p.params.radius + e.radius) {
        e.applySlow(p.params.mult, 0.25); // refresh singkat: keluar aura → normal
      }
    }
  } else if (p.type === 'reveal_pulse') {
    run.nkPulseT -= dt;
    if (run.nkPulseT <= 0) {
      run.nkPulseT = p.params.interval;
      run.effects.spawnKillFx('ring', run.player.x, run.player.y, '#5ef2ff', Math.random() * 10);
      for (const e of run.enemies) if (e.alive && e.stealth) e.nkRevealT = p.params.revealSec;
    }
  }
}
