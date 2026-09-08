/**
 * inflammation.js — R5 (Rebuild) Modul C: Inflammation Zone.
 *
 * Combat doc §4: skill area menumpuk "inflamasi" DI LANTAI (bukan di musuh).
 * intensity = min(maxIntensity, baseRate · elapsed^1.2). Zona memberi DoT ke
 * musuh di dalamnya sesuai intensity; saat intensity ≥ stormThreshold zona
 * meledak jadi CYTOKINE STORM — damage besar ke semua musuh di dalam, tapi
 * juga splash ke hero bila hero masih berdiri di zona (risk/reward posisi).
 * Telegraph murni canvas: warna kuning pucat → merah menyala + pulsa makin
 * cepat (doc §4.3 — tidak perlu UI tambahan di luar canvas).
 *
 * Semua di belakang flag `inflammationZone` (modules.json / localStorage
 * override) — flag OFF = skill area berperilaku persis seperti sebelum R5.
 */

import { moduleEnabled, moduleConfig } from './module-flags.js';
import { recordModuleTrigger } from './metrics.js';
import { t as tr } from './i18n.js';

let nextId = 1;

/** intensity(t) = min(maxIntensity, baseRate · t^exp) — formula doc §4.2. */
export function inflamIntensity(zone, now, cfg = moduleConfig('inflammationZone')) {
  const t = Math.max(0, now - zone.spawnTime);
  return Math.min(zone.maxIntensity, (cfg.baseRate ?? 2) * Math.pow(t, cfg.intensityExp ?? 1.2));
}

/** heat 0→1 relatif threshold storm (dipakai warna/pulsa telegraph). */
export function inflamHeat(zone, now, cfg = moduleConfig('inflammationZone')) {
  const th = cfg.stormThreshold ?? 8;
  return Math.min(1, inflamIntensity(zone, now, cfg) / th);
}

/** Warna telegraph: kuning pucat (#ffd93d) → merah menyala (#ff5d73). */
export function inflamColor(heat) {
  const a = [0xff, 0xd9, 0x3d], b = [0xff, 0x5d, 0x73];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * heat));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * Spawn zona inflamasi di (x,y). Dipanggil dari skill ber-efek 'area'.
 * Cap maxZones: zona tertua dibuang (mitigasi performa doc §4.4).
 * @returns {object|null} zona baru, atau null bila flag mati.
 */
export function spawnInflamZone(game, x, y, radius) {
  if (!moduleEnabled('inflammationZone')) return null;
  const run = game.run;
  if (!run || run.ended) return null;
  const cfg = moduleConfig('inflammationZone');
  if (!run.inflamZones) run.inflamZones = [];
  while (run.inflamZones.length >= (cfg.maxZones ?? 3)) run.inflamZones.shift();
  const zone = {
    id: nextId++,
    x, y,
    radius: radius || cfg.radius || 90,
    spawnTime: run.time,
    maxIntensity: cfg.maxIntensity ?? 10,
    stormTriggered: false,
    tick: cfg.dotTickSec ?? 0.5, // tunda tick pertama satu interval
  };
  run.inflamZones.push(zone);
  run.effects.spawnLabel(x, y - 30, tr('INFLAMASI!'), '#ffd93d');
  return zone;
}

/**
 * Update semua zona aktif — dipanggil per frame dari game.update.
 * DoT musuh per tick (bukan per frame — mitigasi §4.4); storm otomatis
 * saat intensity ≥ stormThreshold: dmg besar musuh + splash hero bila
 * hero di dalam, lalu zona lenyap (siklus selesai).
 */
export function inflamUpdate(game, dt) {
  if (!moduleEnabled('inflammationZone')) return;
  const run = game.run;
  const zones = run && run.inflamZones;
  if (!zones || !zones.length) return;
  const cfg = moduleConfig('inflammationZone');
  const player = run.player;
  const baseDmg = player.stats.damage;

  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    const intensity = inflamIntensity(z, run.time, cfg);

    // ===== CYTOKINE STORM: intensity mencapai threshold =====
    if (!z.stormTriggered && intensity >= (cfg.stormThreshold ?? 8)) {
      z.stormTriggered = true;
      const stormDmg = Math.max(1, Math.round(baseDmg * (cfg.stormMult ?? 2.5)));
      let enemiesHit = 0;
      for (const e of run.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - z.x, e.y - z.y) > z.radius + e.radius) continue;
        enemiesHit++;
        const died = e.takeDamage(stormDmg);
        game.spawnHitFeedback(e, stormDmg, died);
        if (died) game.onEnemyKilled(e, null);
      }
      run.effects.spawnBlast(z.x, z.y, z.radius, '#ff5d73');
      run.effects.spawnLabel(z.x, z.y - 40, tr('CYTOKINE STORM!'), '#ff5d73');
      run.camera.addShake(0.5);
      // Risk: hero masih di dalam zona saat storm → splash (jalur damagePlayer
      // agar hormati shield/evade/i-frames seperti sumber damage lain).
      if (player.alive && Math.hypot(player.x - z.x, player.y - z.y) < z.radius + player.radius * 0.4) {
        game.damagePlayer(cfg.heroSplashDamage ?? 12);
      }
      recordModuleTrigger('inflammationZone', { wave: run.spawnSys ? run.spawnSys.wave : 0, enemiesHit });
      zones.splice(i, 1); // zona habis setelah storm
      continue;
    }

    // ===== DoT musuh per tick (musuh saja — hero hanya kena saat storm) =====
    z.tick -= dt;
    if (z.tick > 0) continue;
    z.tick = cfg.dotTickSec ?? 0.5;
    const tickDmg = Math.max(1, Math.round(baseDmg * (cfg.dotDmgPct ?? 0.08) * intensity));
    for (const e of run.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - z.x, e.y - z.y) > z.radius + e.radius) continue;
      const died = e.takeDamage(tickDmg);
      game.spawnHitFeedback(e, tickDmg, died);
      if (died) game.onEnemyKilled(e, null);
    }
  }
}
