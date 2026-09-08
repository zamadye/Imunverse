/**
 * tag-cascade.js — R6 (Rebuild) Modul D: Tag-Cascade / Opsonisasi.
 *
 * Combat doc §5: setiap hit hero MENANDAI (tag) musuh — meniru antibodi yang
 * menandai patogen sebelum dihancurkan berantai. Musuh ter-tag yang mati
 * memicu cascade: damage menyebar ke musuh sekitar (radius search), berantai
 * maks `maxHops` hop dengan intensitas meluruh `decay^hop`.
 *
 * Alur bertingkat (§5.3):
 *  T1 tag        → outline lokal saja (render di game.js), TANPA kamera.
 *  T2 mati, targets < tier3Targets → shockwave ring 2D, TANPA kamera.
 *  T3 targets ≥ tier3Targets       → hit-stop 70 ms + punch-zoom kamera 9%
 *                                    ease-out 280 ms (layer di Camera, §5.4).
 *  T4 chain      → hop berikutnya dgn kamera & damage meluruh 0.6/hop.
 *
 * Throttle (§5.5): maks `maxConcurrent` cascade per `windowSec` — lebihnya
 * di-skip TOTAL (tanpa radius search) demi performa wave padat.
 *
 * Flag `tagCascade` — OFF = tidak ada tag/cascade/punch-zoom (pra-R6 utuh).
 */

import { moduleEnabled, moduleConfig } from './module-flags.js';
import { recordModuleTrigger } from './metrics.js';

/**
 * Tandai musuh saat hit hero landing. Dipanggil dari spawnHitFeedback —
 * titik sentral SEMUA hit hero (proyektil, skill, DoT zona R5).
 */
export function tagOnHit(enemy) {
  if (!moduleEnabled('tagCascade')) return;
  if (!enemy || !enemy.alive) return;
  enemy.cascadeTag = true;
}

/**
 * Musuh mati: bila ter-tag, ledakkan cascade ke tetangga dalam radius.
 * Korban cascade ikut ter-tag (opsonisasi menyebar) → bila mati, rantai
 * lanjut dengan hop+1 sampai maxHops / tak ada target valid (§5.3 T4).
 * @param {object} game  Game singleton.
 * @param {object} enemy Musuh yang baru mati.
 */
export function cascadeOnDeath(game, enemy) {
  if (!moduleEnabled('tagCascade')) return;
  const run = game.run;
  if (!run || run.ended) return;
  if (!enemy.cascadeTag || enemy.cascadeDone) return;
  enemy.cascadeDone = true; // guard: satu mayat satu ledakan

  const cfg = moduleConfig('tagCascade');
  const hop = enemy.cascadeHopIn || 0;
  if (hop >= (cfg.maxHops ?? 4)) return;

  // Throttle §5.5: cap cascade bersamaan — skip total tanpa radius search.
  if (!run.cascadeTimes) run.cascadeTimes = [];
  const win = cfg.windowSec ?? 0.6;
  run.cascadeTimes = run.cascadeTimes.filter((t) => run.time - t < win);
  if (run.cascadeTimes.length >= (cfg.maxConcurrent ?? 3)) return;

  // Radius search target valid (§5.2 CASCADE_RADIUS).
  const radius = cfg.radius ?? 120;
  const targets = [];
  for (const e of run.enemies) {
    if (!e.alive || e === enemy) continue;
    if (Math.hypot(e.x - enemy.x, e.y - enemy.y) > radius + e.radius) continue;
    targets.push(e);
  }
  if (!targets.length) return;
  run.cascadeTimes.push(run.time);

  const decayN = Math.pow(cfg.decay ?? 0.6, hop);
  const dmg = Math.max(1, Math.round(run.player.stats.damage * (cfg.dmgPct ?? 0.5) * decayN));
  const tier3 = targets.length >= (cfg.tier3Targets ?? 3);

  // Telegraph ring radial + shockwave (T2 selalu; T3 lebih besar).
  run.effects.spawnBlast(enemy.x, enemy.y, radius * (tier3 ? 1 : 0.7), '#ffb347');
  if (tier3) {
    // T3: hit-stop singkat + punch-zoom — intensitas meluruh per hop (§5.3).
    game.hitStopRun((cfg.hitStopSec ?? 0.07) * decayN);
    run.camera.punchZoom((cfg.punchZoom ?? 0.09) * decayN, cfg.punchDurSec ?? 0.28);
  }

  for (const t of targets) {
    t.cascadeTag = true;          // opsonisasi menyebar (T4)
    t.cascadeHopIn = hop + 1;     // pelacak kedalaman rantai (§5.2)
    const died = t.takeDamage(dmg);
    game.spawnHitFeedback(t, dmg, died);
    if (died) game.onEnemyKilled(t, null); // rekursif → hop berikutnya
  }

  recordModuleTrigger('tagCascade', {
    wave: run.spawnSys ? run.spawnSys.wave : 0,
    hop, targets: targets.length, tier3,
  });
}
