/**
 * chemotaxis.js — R7 (Rebuild) Modul E: Chemotaxis Trail.
 *
 * Combat doc §6: skill gerak/buff-diri meninggalkan "jejak sinyal" kimia di
 * lantai saat hero bergerak (TrailSegment per 0.15 s + jarak minimum). Hero
 * yang MELEWATI jejaknya sendiri mendapat buff kecepatan sementara — buff
 * hidup HANYA selama menyentuh segmen matang ("buff overlap") sehingga
 * pemain didorong membentuk pola gerak disengaja: memutar, menganyam,
 * memotong jalur lama — bukan sekadar kabur pasif.
 *
 * Mitigasi risiko §6.4 (modul terberat dari kelimanya):
 *  - cap `maxSegments` (default 60) — array tidak membengkak tanpa batas;
 *  - cleanup per frame in-place satu pass (GC manual, doc §6.3);
 *  - buff = pengali `run.chemoSpeedMult` yang dibaca player per frame —
 *    TANPA recomputePlayerStats (terlalu mahal untuk per-frame);
 *  - render cakram statis memudar, tanpa partikel per segmen.
 *
 * Flag `chemotaxisTrail` — OFF = tanpa jejak/buff, movement pra-R7 utuh.
 */

import { moduleEnabled, moduleConfig } from './module-flags.js';
import { recordModuleTrigger } from './metrics.js';
import { t as tr } from './i18n.js';

/**
 * Aktifkan jendela emisi jejak (dipanggil saat skill dash/buff_self cast).
 * Selama `activeSec` detik, pergerakan hero menjatuhkan TrailSegment.
 */
export function chemoActivate(game) {
  if (!moduleEnabled('chemotaxisTrail')) return false;
  const run = game.run;
  if (!run || run.ended) return false;
  const cfg = moduleConfig('chemotaxisTrail');
  run.chemoActiveT = cfg.activeSec ?? 6;
  run.chemoEmitT = 0; // emisi segera pada gerakan pertama
  run.chemoStat = run.chemoStat || { segments: 0, buffSec: 0 };
  run.effects.spawnLabel(run.player.x, run.player.y - 52, tr('JEJAK SINYAL!'), '#5ce8c8');
  return true;
}

/**
 * Update per frame: emisi segmen saat bergerak, cleanup segmen kedaluwarsa,
 * overlap check hero↔segmen → set `run.chemoSpeedMult` (dibaca player).
 */
export function chemoUpdate(game, dt) {
  const run = game.run;
  if (!run) return;
  if (!moduleEnabled('chemotaxisTrail')) { run.chemoSpeedMult = 1; return; }
  const cfg = moduleConfig('chemotaxisTrail');
  const trail = run.chemoTrail || (run.chemoTrail = []);
  const player = run.player;

  // ---- Emisi: jendela aktif + player bergerak + interval + jarak min ----
  if (run.chemoActiveT > 0) {
    run.chemoActiveT -= dt;
    run.chemoEmitT -= dt;
    if (player.alive && run.chemoEmitT <= 0) {
      const last = trail[trail.length - 1];
      const farEnough = !last ||
        Math.hypot(player.x - last.x, player.y - last.y) >= (cfg.minSegDist ?? 18);
      if (player.moving && farEnough) {
        run.chemoEmitT = cfg.segmentIntervalSec ?? 0.15;
        trail.push({
          x: player.x, y: player.y, t: run.time,
          buffType: 'speed', buffValue: cfg.speedMult ?? 1.18,
        });
        while (trail.length > (cfg.maxSegments ?? 60)) trail.shift();
        if (run.chemoStat) run.chemoStat.segments += 1;
      }
    }
    // Jendela berakhir → telemetry ringkasan (dipakai evaluasi Phase 11:
    // apakah pemain benar-benar memanen buff dari jejaknya?)
    if (run.chemoActiveT <= 0 && run.chemoStat) {
      recordModuleTrigger('chemotaxisTrail', {
        wave: run.spawnSys ? run.spawnSys.wave : 0,
        segments: run.chemoStat.segments,
        buffSec: Math.round(run.chemoStat.buffSec * 10) / 10,
      });
      run.chemoStat = null;
    }
  }

  // ---- Cleanup per frame (doc §6.3): buang segmen lebih tua dari lifetime ----
  const life = cfg.lifetimeSec ?? 4;
  let w = 0;
  for (let i = 0; i < trail.length; i++) {
    if (run.time - trail[i].t < life) trail[w++] = trail[i];
  }
  trail.length = w;

  // ---- Overlap check (doc §6.3): hero menyentuh segmen MATANG → buff ----
  // Segmen muda (< minAgeForBuff) tidak membuff: jejak yang baru jatuh di
  // kaki bukan "melewati jalur lama" — pemain harus memotong/kembali.
  let onTrail = false;
  let mult = 1;
  const minAge = cfg.minAgeForBuff ?? 0.5;
  const segR = cfg.segmentRadius ?? 26;
  if (player.alive) {
    for (const s of trail) {
      if (run.time - s.t < minAge) continue;
      if (Math.hypot(player.x - s.x, player.y - s.y) > segR) continue;
      onTrail = true;
      mult = Math.max(mult, s.buffValue || 1);
    }
  }
  run.chemoSpeedMult = onTrail ? mult : 1;
  if (onTrail && run.chemoStat) run.chemoStat.buffSec += dt;
}

/** View HUD/debug kecil (dipakai uji & layar dev). */
export function chemoView(run) {
  return {
    active: (run.chemoActiveT || 0) > 0,
    segments: run.chemoTrail ? run.chemoTrail.length : 0,
    buffed: (run.chemoSpeedMult || 1) > 1,
  };
}
