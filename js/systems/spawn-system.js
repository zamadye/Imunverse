/**
 * spawn-system.js — Wave-based spawning.
 *
 * Formula (sesuai spek, config dari data/waves.json):
 *   spawnInterval = max(spawnIntervalMin, spawnIntervalBase - wave * decay)
 *   enemyHP       = baseHP * (1 + (wave - 1) * hpScalePerWave)
 *
 * Musuh spawn DI LUAR area pandang (radius lingkaran luar canvas + padding)
 * lalu bergerak ke arah player. Wave berganti tiap `waveDuration` detik;
 * setiap `bossWaveEvery` wave, boss (behavior boss_pattern_a) muncul sekali.
 */

import { getData, getWaveConfig, getSpawnInterval, getEnemyHPScale, getEnemySpeedScale } from '../core/data-store.js';

export class SpawnSystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.wave = 1;
    this.waveTimer = 0;        // waktu berjalan pada wave sekarang
    this.spawnTimer = 0.8;     // delay spawn pertama sedikit
    this.bossSpawnedForWave = 0; // wave terakhir yang sudah memunculkan boss
    this.mods = {};             // modifier run (kondisi tubuh + mutator liveops)
    this.rampTimer = 0;         // HOOK: wave 1 mulai ramai (tidak sepi)
    this.rampMult = 0.45;       // spawn interval dikali ini (naik ke 1 dalam ±15 dtk)
  }

  /**
   * Update timer wave & spawn.
   * @returns {{newWave:boolean, bossSpawn:boolean} | null} event yang terjadi frame ini
   */
  update(dt, game) {
    const cfg = getWaveConfig();
    const events = { newWave: false, bossSpawn: false };

    // HOOK: 15 detik pertama ramp-up — aksi terasa sejak awal, sulit merambat naik
    if (this.wave === 1) {
      this.rampTimer += dt;
      if (this.rampTimer > 15) this.rampMult = Math.min(1, this.rampMult + dt * 0.055);
    } else {
      this.rampMult = 1;
    }

    // ---- Ganti wave ----
    this.waveTimer += dt;
    if (this.waveTimer >= cfg.waveDuration) {
      this.waveTimer -= cfg.waveDuration;
      this.wave += 1;
      events.newWave = true;
    }

    // ---- Boss setiap N wave ----
    if (
      this.wave % cfg.bossWaveEvery === 0 &&
      this.bossSpawnedForWave !== this.wave &&
      this.waveTimer < cfg.waveDuration // bukan saat frame ganti wave ganda
    ) {
      this.bossSpawnedForWave = this.wave;
      game.spawnEnemy('sel_kanker', true);
      events.bossSpawn = true;
    }

    // ---- Spawn musuh reguler ----
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = getSpawnInterval(this.wave) * this.rampMult / (this.mods.spawnMult || 1);
      if (game.run.enemies.length < cfg.maxAliveEnemies) {
        const enemyId = this.pickEnemyId(this.wave);
        if (enemyId) game.spawnEnemy(enemyId, false);
      }
    }

    return events;
  }

  /**
   * Pilih tipe musuh via weighted random dari musuh yang memenuhi minWave.
   * @returns {string|null} id musuh
   */
  pickEnemyId(waveNumber) {
    const enemies = getData().enemies.enemies;
    const pool = enemies.filter((e) => e.weight > 0 && waveNumber >= e.minWave);
    if (pool.length === 0) return null;
    let total = 0;
    for (const e of pool) total += e.weight;
    let roll = Math.random() * total;
    for (const e of pool) {
      roll -= e.weight;
      if (roll <= 0) return e.id;
    }
    return pool[pool.length - 1].id;
  }

  /**
   * Posisi spawn di luar area pandang: pada lingkaran ber-radius
   * setengah diagonal canvas + padding, di sekitar posisi player.
   */
  getSpawnPosition(playerX, playerY, viewportW, viewportH) {
    const cfg = getWaveConfig();
    const radius = Math.hypot(viewportW, viewportH) / 2 + cfg.spawnPadding;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: playerX + Math.cos(angle) * radius,
      y: playerY + Math.sin(angle) * radius,
    };
  }

  /** Scaler statistik musuh untuk wave sekarang. */
  getScalers() {
    return {
      hpScale: getEnemyHPScale(this.wave) * (this.mods.enemyHPMult || 1),
      speedScale: getEnemySpeedScale(this.wave),
    };
  }

  /** Boss multiplier HP berdasarkan index boss dalam run (boss ke-1 → 1.0). */
  getBossHPMultiplier() {
    const cfg = getWaveConfig();
    const bossIndex = Math.max(1, Math.floor(this.wave / cfg.bossWaveEvery));
    return 1 + (bossIndex - 1) * cfg.bossHPBonusPerBossIndex;
  }
}
