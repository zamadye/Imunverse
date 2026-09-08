/**
 * phagocytosis.js — R4 (Rebuild): MODUL B — Phagocytosis (Telan).
 *
 * Combat doc §3: musuh sekarat (<20% HP) masuk WINDOW TELAN 1.8 dtk
 * (berdenyut kuning). Skill `devour` menelan target eligible terdekat
 * INSTAN — korban dikonversi jadi resource (heal kecil + fuel ultimate),
 * BUKAN drop XP/koin normal. Meter penuh → cooldown ULT langsung 0
 * (hybrid: paralel dengan cooldown normal, doc §3.3).
 *
 * Window HANGUS sekali (phagoSpent) — memaksa keputusan timing, bukan
 * menunggu pasif. Boss tidak pernah eligible. Flag: modules.phagocytosis.
 */

import { moduleEnabled, moduleConfig } from './module-flags.js';
import { recordModuleTrigger } from './metrics.js';
import { emit } from '../core/ui-bridge.js';

/** Update state window telan per-musuh (dipanggil dari enemy.update). */
export function phagoUpdateEnemy(e, dt) {
  if (!moduleEnabled('phagocytosis')) return;
  if (e.isBoss || !e.alive) return;
  const cfg = moduleConfig('phagocytosis');
  if (e.phagoEligible) {
    e.phagoWindowT -= dt;
    if (e.phagoWindowT <= 0) {
      e.phagoEligible = false;
      e.phagoSpent = true; // window hangus — tidak eligible lagi run ini
    }
  } else if (!e.phagoSpent && e.hp > 0 && e.hp <= e.maxHP * (cfg.hpThreshold || 0.2)) {
    e.phagoEligible = true;
    e.phagoWindowT = cfg.windowSec || 1.8;
  }
}

/** Musuh eligible terdekat dalam jangkauan telan. @returns {Enemy|null} */
export function nearestDevourable(run, cfg = moduleConfig('phagocytosis')) {
  const p = run.player;
  const range = cfg.range || 160;
  let best = null; let bd = range;
  for (const e of run.enemies) {
    if (!e.alive || !e.phagoEligible) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/**
 * Coba TELAN. @returns {boolean} true bila ada korban tertelan.
 * Korban mati lewat jalur devour: tanpa takeDamage, tanpa loot normal
 * (game.onEnemyKilled dipanggil dengan flag devoured utk melewati drop).
 */
export function tryDevour(game, ctx) {
  if (!moduleEnabled('phagocytosis')) return false;
  const run = game.run;
  const cfg = moduleConfig('phagocytosis');
  const t = nearestDevourable(run, cfg);
  if (!t) return false;

  // Konversi: heal kecil + fuel meter — BUKAN drop normal (doc §3.1)
  t.alive = false;
  t.hp = 0;
  t.devoured = true; // onEnemyKilled melewati drop XP/koin utk korban telan
  ctx.player.heal(cfg.healOnDevour || 8);
  run.effects.spawnBlast(t.x, t.y, t.radius * 2.2, '#ffd93d');
  run.effects.spawnLabel(t.x, t.y - t.radius - 16, 'TELAN!', '#ffd93d');
  addPhagoMeter(run, cfg.meterPerDevour || 25, game);
  game.onEnemyKilled(t, null);
  recordModuleTrigger('phagocytosis', { wave: run.spawnSys ? run.spawnSys.wave : 0, meter: run.phagoMeter });
  emit('phago', phagoHudView(run));
  return true;
}

/** Tambah fuel meter; penuh → ULT (slot 2) siap SEKARANG + reset meter. */
export function addPhagoMeter(run, amount, game) {
  if (!moduleEnabled('phagocytosis')) return;
  const cfg = moduleConfig('phagocytosis');
  const max = cfg.meterMax || 100;
  run.phagoMeter = Math.min(max, (run.phagoMeter || 0) + amount);
  if (run.phagoMeter >= max) {
    run.phagoMeter = 0;
    const ult = run.skills && run.skills.slots && run.skills.slots[2];
    if (ult) ult.cdLeft = 0;
    emit('toast', { message: 'FAGOSITOSIS PENUH — Ultimate SIAP!', kind: 'gold' });
    if (run.effects && run.player) run.effects.spawnBlast(run.player.x, run.player.y, 90, '#ffd93d');
  }
  emit('phago', phagoHudView(run));
}

/** View HUD meter. */
export function phagoHudView(run) {
  const cfg = moduleConfig('phagocytosis');
  return { meter: run.phagoMeter || 0, max: cfg.meterMax || 100, enabled: moduleEnabled('phagocytosis') };
}
