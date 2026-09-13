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

import { getData, getWaveConfig, getSpawnInterval, getEnemyHPScale, getEnemySpeedScale, getProgression } from '../core/data-store.js';
import { isTutorialActive } from './tutorial-system.js';

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
    this.gateOpen = true;       // Fase 18: gerbang wave — tertutup saat PENJAGA hidup
    this.waveClearing = false;  // wave berhenti spawn setelah durasi habis
    this.breakTimer = 0;        // jeda singkat agar pemain bisa mengumpulkan nutrisi
    this.nestsSpawnedForWave = 0; // F26: sarang per wave (explore MMORPG)
    this.ecoT = 0.6;            // ECOSYSTEM: timer top-up populasi hidup (lihat waves.json)
  }

  /** Gerbang tertutup = boss penjaga masih hidup, wave TIDAK bisa maju. */
  isGateBlocked() {
    return !this.gateOpen;
  }

  /** Boss penjaga tumbang → gerbang wave terbuka (dipanggil dari game.js). */
  openGate() {
    this.gateOpen = true;
  }

  /**
   * Update timer wave & spawn.
   * @returns {{newWave:boolean, bossSpawn:boolean} | null} event yang terjadi frame ini
   */
  update(dt, game) {
    const cfg = getWaveConfig();
    const events = { newWave: false, bossSpawn: false, waveBreak: false };

    // RONDE-4 (pembukaan santai): selama TUTORIAL run-pertama berjalan, arena
    // sengaja TENANG. RONDE-7: tutorial DIHAPUS — cabang ini tidak pernah aktif
    // lagi (isTutorialActive ≡ false), disimpan arsip, tidak mengubah perilaku.
    // maksimal 4 musuh kecil menetes pelan untuk latihan. Timer wave BEKU
    // (wave tidak maju sampai tutorial selesai).
    if (isTutorialActive()) {
      this.spawnTimer -= dt;
      const aliveN = game.run.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
      if (this.spawnTimer <= 0 && aliveN < 4) {
        this.spawnTimer = 4.0;
        const enemyId = this.pickEnemyId(this.wave);
        if (enemyId) {
          game.spawnEnemy(enemyId, false);
          const e = game.run.enemies[game.run.enemies.length - 1];
          if (e) { // cincin aman: tidak terlalu dekat, terlihat di layar
            const a = Math.random() * Math.PI * 2;
            e.x = game.run.player.x + Math.cos(a) * 380;
            e.y = game.run.player.y + Math.sin(a) * 380;
          }
        }
      }
      return events;
    }

    // HOOK: 15 detik pertama ramp-up — aksi terasa sejak awal, sulit merambat naik
    if (this.wave === 1) {
      this.rampTimer += dt;
      if (this.rampTimer > 15) this.rampMult = Math.min(1, this.rampMult + dt * 0.055);
    } else {
      this.rampMult = 1;
    }

    // ECOSYSTEM — continuous controlled spawning: arena = ekosistem hidup.
    // Musuh yang mati digantikan (top-up), populasi punya target & cap, spawn
    // selalu di ring jauh player (roam-first — TIDAK langsung menyerang).
    // Skip saat waveClearing supaya fase clear bisa selesai (wave tetap maju).
    if (!this.waveClearing) this.ecosystemTopUp(dt, game);

    // ---- Fase 18 GATEKEEPER: wave 5/10/15… punya PENJAGA — wajib tumbang
    // sebelum wave lanjut. Selama gerbang tertutup: timer wave BEKU, musuh
    // reguler hanya menetes (trickle) supaya arena tetap hidup. ----
    if (!this.gateOpen) {
      const gk = getProgression().gatekeeper;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = getSpawnInterval(this.wave) * this.rampMult * gk.trickleSpawnMult / (this.mods.spawnMult || 1);
        if (game.run.enemies.length < cfg.maxAliveEnemies) {
          const enemyId = this.pickEnemyId(this.wave);
          if (enemyId) game.spawnEnemy(enemyId, false);
        }
      }
      return events;
    }

    // ---- Istirahat antar wave: berhenti spawn, beri ruang untuk bergerak
    // dan mengumpulkan nutrisi. Wave baru dimulai setelah arena relatif bersih.
    if (this.waveClearing) {
      const active = game.run.enemies.some((e) => e.alive && !e.isBoss);
      if (!active) {
        this.breakTimer -= dt;
        if (this.breakTimer <= 0) {
          this.wave += 1;
          this.waveTimer = 0;
          this.waveClearing = false;
          this.breakTimer = 0;
          events.newWave = true;
        }
      } else {
        this.breakTimer = Math.max(this.breakTimer, 1.2);
      }
      return events;
    }

    // ---- Ganti wave menjadi fase clear, bukan arus musuh tanpa akhir ----
    this.waveTimer += dt;
    if (this.waveTimer >= cfg.waveDuration) {
      this.waveClearing = true;
      this.breakTimer = cfg.breakDuration; // V2 Phase 2: pacing dari data/waves.json
      events.waveBreak = true;
      return events;
    }

    // ---- F26 BOSS: dicek SEBELUM early-clear agar wave penjaga tak terlewati ----
    const bossDue = this.wave % cfg.bossWaveEvery === 0 && this.bossSpawnedForWave !== this.wave;
    if (bossDue && this.waveTimer < cfg.waveDuration) {
      this.bossSpawnedForWave = this.wave;
      // Fase 9: boss bergantian sesuai roster (sel_kanker → toksin_raksasa → …)
      const roster = (cfg.bossRoster && cfg.bossRoster.length) ? cfg.bossRoster : ['sel_kanker'];
      const bossNo = Math.max(0, this.wave / cfg.bossWaveEvery - 1);
      game.spawnEnemy(roster[Math.floor(bossNo) % roster.length], true);
      this.gateOpen = false; // Fase 18: kunci wave sampai penjaga dikalahkan
      events.bossSpawn = true;
    }

    // ---- F26 SARANG (explore MMORPG): sekali per wave — 1 dekat + sisanya jauh ----
    const ai = cfg.explore || {};
    if (ai.aggroRadius && this.nestsSpawnedForWave !== this.wave) {
      this.nestsSpawnedForWave = this.wave;
      this.spawnWaveNests(game, ai);
    }

    // ---- Trickle: PEMBURU — spawn di luar pandang lalu MENGHAMPIRI player
    // (RONDE-7 ketegangan: dulu menempel sarang jauh & hanya mengejar bila
    // player mendekat → arena "sunyi" setelah wave awal; sekarang tekanan
    // mendatangi pemain terus-menerus sesuai ritme interval). ----
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = getSpawnInterval(this.wave) * this.rampMult * cfg.trickleIntervalMult / (this.mods.spawnMult || 1); // V2 Phase 2: dari data
      if (game.run.enemies.length < cfg.maxAliveEnemies) {
        const enemyId = this.pickEnemyId(this.wave);
        if (enemyId) game.spawnEnemy(enemyId, false); // tanpa nest/ai → mengejar player
      }
    }

    // ---- Wave berakhir: durasi habis ATAU semua sarang dibersihkan (≥ minWaveTime) ----
    const regularAlive = game.run.enemies.some((e) => e.alive && !e.isBoss);
    const bossPending = bossDue && this.waveTimer < cfg.waveDuration;
    if (
      this.waveTimer >= cfg.waveDuration ||
      (!regularAlive && !bossPending && this.waveTimer >= (ai.minWaveTime || 8))
    ) {
      this.waveClearing = true;
      this.breakTimer = cfg.breakDuration; // V2 Phase 2: pacing dari data/waves.json
      events.waveBreak = true;
    }

    return events;
  }

  /**
   * ECOSYSTEM — top-up populasi hidup secara berkala.
   * Ringkas: target = targetBase + wave*targetPerWave (di-jepit targetMax);
   * bila musuh roaming (non-boss, hidup) di bawah target → spawn topUpBatch
   * musuh pada RING sekitar player [minPlayerDist..maxPlayerDist], masing-masing
   * dengan sarang & AI patrol — mereka ROAM dulu; hanya mengejar bila player
   * memasuki aggroRadius. Tidak pernah spawn di atas/dekat player, dead cap
   * global (maxAliveEnemies) selalu dihormati → tidak ada spawn tanpa batas.
   */
  ecosystemTopUp(dt, game) {
    const cfg = getWaveConfig();
    const eco = cfg.ecosystem;
    if (!eco || !eco.enabled) return;
    this.ecoT -= dt;
    if (this.ecoT > 0) return;
    this.ecoT = eco.topUpInterval || 2.2;

    const run = game.run;
    if (!run || !run.player) return;
    const roaming = run.enemies.reduce((n, e) => n + (e.alive && !e.isBoss ? 1 : 0), 0);
    const target = Math.min(
      eco.targetMax || 30,
      Math.round((eco.targetBase || 8) + (this.wave - 1) * (eco.targetPerWave || 0.8))
    );
    if (roaming >= target) return;

    const ai = cfg.explore || null;
    const minD = eco.minPlayerDist || 300;
    const maxD = Math.max(minD + 40, eco.maxPlayerDist || 820);
    let batch = Math.min(eco.topUpBatch || 2, target - roaming);
    // RONDE-7: campuran top-up — mayoritas PEMBURU (tanpa sarang → langsung
    // menghampiri player dari ring), sisanya patroli seperti semula. Ini
    // mengembalikan ketegangan permanen; tanpa pemburu, populasi roam di
    // cincin 340–950 px TIDAK PERNAH menyerang pemain diam (arena "sunyi").
    const hunterShare = eco.hunterShare != null ? eco.hunterShare : 0.6;
    while (batch-- > 0) {
      if (run.enemies.length >= cfg.maxAliveEnemies) break; // CAP global
      const enemyId = this.pickEnemyId(this.wave);
      if (!enemyId) break;
      const hunter = Math.random() < hunterShare;
      game.spawnEnemy(enemyId, false, hunter ? {} : { nest: true, ai });
      const e = run.enemies[run.enemies.length - 1];
      if (!e) break;
      // Tempatkan di ring sekitar player (setelah spawn off-screen default)
      const angle = Math.random() * Math.PI * 2;
      const dist = minD + Math.random() * (maxD - minD);
      const sx = run.player.x + Math.cos(angle) * dist;
      const sy = run.player.y + Math.sin(angle) * dist;
      e.x = sx; e.y = sy;
      if (!hunter) e.setNest(sx, sy, ai);
    }
  }

  /**
   * F26 — Tempatkan sarang patogen di sekitar pemain: satu sarang dekat
   * (aksi terasa sejak awal, dalam jangkauan auto-attack) dan sisanya jauh
   * (target jelajah — imun yang mencari virus).
   */
  spawnWaveNests(game, ai) {
    const cfg = getWaveConfig();
    const nNests = Math.min(ai.nestsMax || 5, (ai.nestsBase || 2) + Math.floor((this.wave - 1) / (ai.nestsAddEveryWaves || 4)));
    const packSize = Math.max(2, Math.round((ai.packSize || 3) + (this.wave - 1) * (ai.packPerWave || 0.45)));
    const baseAngle = Math.random() * Math.PI * 2;
    // V2 Phase 5: ELITE terencana — mulai startWave, 1..max elite per wave di
    // sarang JAUH (momen "itu elite!" yang bisa diantisipasi, bukan RNG murni)
    const ec = cfg.elite || null;
    let eliteQuota = ec && this.wave >= ec.startWave
      ? Math.min(ec.max, ec.base + Math.floor((this.wave - ec.startWave) / ec.addEveryWaves))
      : 0;
    for (let n = 0; n < nNests; n++) {
      const near = n === 0;
      const dist = (near ? ai.nearNestDist || 300 : ai.farNestDist || 620) + (Math.random() - 0.5) * 80;
      const angle = baseAngle + (n / nNests) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const px = game.run.player.x + Math.cos(angle) * dist;
      const py = game.run.player.y + Math.sin(angle) * dist;
      const enemyId = this.pickEnemyId(this.wave);
      if (!enemyId) return;
      for (let m = 0; m < packSize; m++) {
        if (game.run.enemies.length >= cfg.maxAliveEnemies) return;
        game.spawnEnemy(enemyId, false, { nest: false }); // posisi ditimpa di bawah
        const e = game.run.enemies[game.run.enemies.length - 1];
        if (!e) break;
        const sa = Math.random() * Math.PI * 2;
        const sr = 30 + Math.random() * 45;
        e.x = px + Math.cos(sa) * sr;
        e.y = py + Math.sin(sa) * sr;
        e.setNest(px, py, ai);
        // V2 Phase 5: anggota pertama sarang JAUH dipromosikan jadi elite
        if (eliteQuota > 0 && !near && m === 0 && !e.isBoss) {
          const affix = ec.affixes[Math.floor(Math.random() * ec.affixes.length)];
          e.makeElite(affix, ec);
          eliteQuota -= 1;
          // Third-person feel: "virus kuat muncul" → hentakan samar di kamera
          if (game && game.run && game.run.camera) game.run.camera.addShake(0.09);
        }
      }
    }
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

  /** Scaler statistik musuh untuk wave sekarang (band kurva di getter). */
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
