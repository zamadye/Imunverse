/**
 * game.js — Orkestrator gameplay Imunverse.
 * Memegang state run (entitas, sistem, kamera), loop update/render, dan
 * seluruh alur: spawn → serang → mati → drop → XP → level-up → revive →
 * akhir run → ekonomi → misi → save.
 *
 * CATATAN ARSITEKTUR: file ini TIDAK mengimpor modul screen UI manapun
 * (kecuali hud-screen yang murni "view adapter" tanpa import balik).
 * Komunikasi ke UI lewat ui-bridge (event) — lihat ui-bridge.js.
 */

import { STATE, setPaused, setLevelUpOpen, setScreen } from './state-manager.js';
import {
  getData, getHero, getEnemyDef, getNutrientDef, getWaveConfig,
  xpToNextLevel,
} from './data-store.js';
import { emit } from './ui-bridge.js';
import { writeSave } from '../save/save-manager.js';

import { Player } from '../entities/player.js';
import { Enemy } from '../entities/enemy.js';
import { Projectile } from '../entities/projectile.js';
import { Pickup } from '../entities/pickup.js';

import { SpawnSystem } from '../systems/spawn-system.js';
import { CollisionSystem } from '../systems/collision-system.js';
import { rollLevelUpChoices, applyLevelUp, squadMultipliers } from '../systems/upgrade-system.js';
import { computeRunEndBonus, addCurrency } from '../systems/economy-system.js';
import { checkMissions } from '../systems/mission-system.js';
import { checkAutoUnlocks } from '../systems/unlock-system.js';
import { EffectsSystem } from '../systems/effects-system.js';
import {
  triggerRewardedAdRevive, triggerRewardedAdBossChest, canWatchAd, trackAdWatch,
} from '../systems/monetization.js';
import { AbilitySystem } from '../systems/ability-system.js';
import { getEvoStageDef, rollPartDrop } from '../systems/evolution-system.js';
import { arenaUnlockStatus } from '../ui/screens/arena-screen.js';
import {
  applyDailyDecay, getBodyState, getBodyRunModifiers, registerRunResult,
} from '../systems/body-system.js';
import * as tutorial from '../systems/tutorial-system.js';
import { audio } from '../systems/audio-system.js';
import { getTodayMutator, mergeMutatorMods, recordLeaderboardEntry } from '../systems/liveops-system.js';

import { Camera } from '../render/camera.js';
import { drawBackground, setArenaPalette } from '../render/background.js';
import {
  drawProjectile, drawParticle, drawPulseGlow, drawHealthBar, drawSwipeArc,
  drawBlastRing, drawTelegraph, drawJoystick, drawMinimap, drawDamageNumber, drawHitSpark,
  drawKillFx,
} from '../render/shape-renderer.js';
import { drawSprite } from '../render/sprite-loader.js';
import { updateHUD, getMinimapContext, showAnnounce } from '../ui/screens/hud-screen.js';

export const game = {
  canvas: null,
  ctx: null,
  input: null,
  viewW: 0,
  viewH: 0,
  dpr: 1,

  /** @type {object|null} state run aktif */
  run: null,
  serumActive: false,

  init({ canvas, input }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
  },

  resize(w, h, dpr) {
    this.viewW = w;
    this.viewH = h;
    this.dpr = dpr;
  },

  // =====================================================================
  // MULAI RUN
  // =====================================================================
  startRun(heroId) {
    const meta = STATE.meta;
    const heroDef = getHero(heroId) || getHero(meta.selectedHero);
    if (!heroDef) throw new Error('Hero tidak ditemukan: ' + heroId);

    meta.selectedHero = heroId;
    writeSave(meta); // simpan pilihan hero

    // Consumable "Serum Awal" dipakai otomatis di awal run
    this.serumActive = false;
    if ((meta.consumables.serum_awal || 0) > 0) {
      meta.consumables.serum_awal -= 1;
      this.serumActive = true;
      writeSave(meta);
      emit('toast', { message: 'Serum Awal aktif: +25% damage run ini!', kind: 'gold' });
    }

    const startX = 0;
    const startY = 0;
    const upgrades = {};
    // Decay harian sistem tubuh (sekali per hari kalender) + modifier kondisi
    const decayInfo = applyDailyDecay(meta);
    const bodyMods = getBodyRunModifiers(meta);
    this.lastBodyDecay = decayInfo;

    // LIVEOPS: mode (Klasik/Endless) + mutator harian seeded (khusus Endless)
    const modes = (getData().modes && getData().modes.modes) || [];
    const modeDef = modes.find((m) => m.id === (meta.selectedMode || 'normal')) || modes[0] || null;
    let mutatorDef = null;
    let mutatorDate = null;
    if (modeDef && modeDef.id === 'endless' && getData().mutators) {
      const daily = getTodayMutator();
      mutatorDef = daily.def;
      mutatorDate = daily.date;
      mergeMutatorMods(bodyMods, daily.def.mods);
      emit('toast', { message: `Mutator hari ini: ${daily.def.name}`, kind: 'gold' });
    }

    const stats = this.computePlayerStats(heroDef, upgrades);
    this.applyMetaMultipliers(stats); // evolusi hero + bonus arena (nyata)
    this.applyBodyModifiers(stats, bodyMods); // kondisi tubuh (meta-layer)

    const player = new Player(heroDef, stats, startX, startY);

    // Arena terpilih → palet latar + properti khas arena
    const arena = this.getRunArena();
    setArenaPalette(arena.palette);

    // Fokus run (dari dashboard/roster) — menentukan sistem yang dipulihkan
    const focusId = meta.focusRun || 'seimbang';
    const focusDef = getData().bodySystems.focusRuns.find((f) => f.id === focusId) || null;

    // Kemampuan aktif sesuai tahap evolusi hero (tombol kanan: pedang + 3 kekuatan)
    const evoStage = getEvoStageDef(meta);
    const unlockedAbilityIds = getData().evolutions.stages
      .filter((st) => st.stage <= evoStage.stage && st.ability)
      .map((st) => st.ability);

    this.run = {
      heroDef,
      player,
      enemies: [],
      projectiles: [],
      pickups: [],
      effects: new EffectsSystem(),
      spawnSys: new SpawnSystem(),
      collision: new CollisionSystem(96),
      camera: new Camera(),
      time: 0,
      wave: 1,
      kills: 0,
      bossKills: 0,
      xp: 0,
      xpGained: 0,
      level: 1,
      currencyEarned: 0,
      nutrientsCollected: 0,
      upgrades,
      levelUpQueue: 0,
      currentChoices: null,
      reviveUsed: false,
      reviveOffered: false,
      doubleCurrencyUsed: false,
      earned: 0, // total antibodi yang dibawa pulang (diisi di finishRun)
      boss: null,
      arena,
      evoStage,
      bodyMods,
      mode: modeDef,
      mutator: mutatorDef,
      mutatorDate,
      bonusCurrency: 0,
      victory: false,
      focusId,
      focusDef,
      abilities: new AbilitySystem(unlockedAbilityIds),
      parts: { silia: 0, pseudopodia: 0, mikropedang: 0, inti_elemen: 0 },
      partsCollectedTotal: 0,
      bossChest: null,
      combo: { count: 0, timer: 0 },
      hitStop: 0,
      ended: false,
      stats: { shotsFired: 0 },
    };

    this.run.spawnSys.mods = bodyMods; // mutator/condisi tubuh → spawn & HP musuh
    this.run.camera.reset(player.x, player.y);
    this.run.collision.rebuildEnemyGrid(this.run.enemies);

    setScreen('gameplay');
    setPaused(false);
    setLevelUpOpen(false);
    emit('runstart', { heroDef });
    emit('wave', { wave: 1, isBoss: false });
  },

  // =====================================================================
  // STATISTIK PLAYER (base JSON × squad permanen × upgrade run × serum)
  // =====================================================================
  /**
   * Kalikan stat dasar dengan multiplier META: tahap evolusi hero (damage/HP)
   * + bonus arena terpilih (speed/magnet). Dipanggil di startRun.
   */
  applyMetaMultipliers(stats) {
    const meta = STATE.meta;
    const evo = getEvoStageDef(meta);
    const arena = this.getRunArena();
    stats.damage *= evo.damageMult;
    stats.maxHP = Math.round(stats.maxHP * evo.maxHPMult);
    stats.speed *= arena.bonus.speedMult || 1;
    stats.magnetRadius *= arena.bonus.magnetMult || 1;
    return stats;
  },

  /**
   * Terapkan kondisi tubuh ke stat run (meta-layer, gameplay inti sama):
   * cooldownScale (Sirkulasi efektif), nutrientMult (Pencernaan), xpMult
   * (Saraf), damageMult (Imun), enemySpeedMult kritis (musuh lebih cepat).
   */
  applyBodyModifiers(stats, mods) {
    if (mods.cooldownScale !== undefined) stats.cooldown *= mods.cooldownScale;
    if (mods.damageMult !== undefined) stats.damage *= mods.damageMult;
    if (mods.playerDamageMult !== undefined) stats.damage *= mods.playerDamageMult;
    if (mods.playerHPMult !== undefined) stats.maxHP = Math.round(stats.maxHP * mods.playerHPMult);
    if (mods.playerSpeedMult !== undefined) stats.speed *= mods.playerSpeedMult;
    if (mods.magnetMult !== undefined) stats.magnetRadius *= mods.magnetMult;
    if (mods.xpMult !== undefined) stats.xpMult *= mods.xpMult;
    stats.bodyNutrientMult = mods.nutrientMult !== undefined ? mods.nutrientMult : 1;
    stats.bodyEnemySpeedMult = mods.enemySpeedMult !== undefined ? mods.enemySpeedMult : 1;
    return stats;
  },

  /**
   * Definisi arena run (dipilih di dashboard). Arena terkunci tidak bisa
   * dipakai walau tersimpan di save — fallback ke arena terbuka pertama.
   */
  getRunArena() {
    const meta = STATE.meta;
    const list = getData().arenas.arenas;
    const chosen = list.find((a) => a.id === meta.selectedArena);
    if (chosen && arenaUnlockStatus(chosen, meta).unlocked) return chosen;
    const fallback = list.find((a) => arenaUnlockStatus(a, meta).unlocked);
    if (chosen || !fallback) {
      meta.selectedArena = (fallback || list[0]).id;
    }
    return fallback || list[0];
  },

  computePlayerStats(heroDef, runUpgrades) {
    const base = heroDef.baseStats;
    const squad = squadMultipliers(STATE.meta);
    const up = runUpgrades;
    const serum = this.serumActive ? 1.25 : 1;

    const damage = base.damage * squad.damage * (1 + (up.damage || 0) * 0.15) * serum;
    const cooldown = base.attackCooldown / ((1 + (up.attackSpeed || 0) * 0.12) * squad.attackSpeed);
    const speed = base.speed * squad.speed * (1 + (up.moveSpeed || 0) * 0.08);
    const attackRange = base.attackRange * squad.attackRange * (1 + (up.attackRange || 0) * 0.12);
    const swipeRadius = (base.swipeRadius || 0) * squad.attackRange * (1 + (up.attackRange || 0) * 0.12);
    const maxHP = Math.round(base.maxHP * squad.maxHP + (up.maxHP || 0) * 20);
    const projectileCount = base.projectileCount + (up.projectileCount || 0);

    const isMelee = heroDef.attackPattern === 'melee_swipe';

    return {
      damage,
      cooldown,
      speed,
      attackRange,
      swipeRadius,
      maxHP,
      projectileCount,
      pierce: base.pierce,
      projectileSpeed: base.projectileSpeed,
      magnetRadius: base.magnetRadius,
      pickupRadius: base.pickupRadius,
      xpMult: squad.xpGain,
      // jarak cari target: melee pakai radius tebasan, ranged pakai attackRange
      effectiveAttackRange: isMelee ? swipeRadius + 26 : attackRange,
    };
  },

  /** Rekomputasi statistik player setelah upgrade (mengubah damage, HP, dsb). */
  recomputePlayerStats() {
    const run = this.run;
    const oldMax = run.player.maxHP;
    const stats = this.computePlayerStats(run.heroDef, run.upgrades);
    run.player.stats = stats;
    run.player.maxHP = stats.maxHP;
    // pertahankan HP absolut; penambahan maxHP dari upgrade menaikkan selisih
    run.player.hp = Math.min(run.player.hp + Math.max(0, stats.maxHP - oldMax), stats.maxHP);
  },

  // =====================================================================
  // UPDATE PER FRAME
  // =====================================================================
  update(dt) {
    const run = this.run;
    if (!run || run.ended) return;
    const player = run.player;

    // JUICE hit-stop: freeze singkat saat kill besar (render tetap jalan)
    if (run.hitStop > 0) {
      run.hitStop -= dt;
      return;
    }
    run.time += dt;

    // Combo decay (2 dtk tanpa kill → reset)
    if (run.combo.timer > 0) {
      run.combo.timer -= dt;
      if (run.combo.timer <= 0) run.combo.count = 0;
    }
    // Squash-stretch decay
    if (player.squash > 0) player.squash -= dt;

    // 1. Input & player (gerak + auto-attack)
    const move = this.input.getMoveVector();
    player.update(dt, move, this);

    // 2. Wave & spawn
    const events = run.spawnSys.update(dt, this);
    if (events.newWave) {
      emit('wave', { wave: run.spawnSys.wave, isBoss: false });
      audio.wave();
      const w = run.spawnSys.wave;
      // Milestone XP tiap kelipatan 10 wave
      if (w % 10 === 0) {
        const bonus = 20 + w * 3;
        this.addXP(bonus);
        emit('toast', { message: `Wave ${w}! +${bonus} XP`, kind: 'gold' });
      }
      // MENANG mode Klasik: wave melewati finalWave (boss wave 10 sudah tumbang)
      if (run.mode && run.mode.finalWave && w > run.mode.finalWave) {
        this.winRun();
        return;
      }
      // Endless: bonus antibodi tiap 5 wave
      if (run.mode && run.mode.id === 'endless' && w % 5 === 0) {
        const bonus = w * 5;
        run.bonusCurrency += bonus;
        addCurrency(meta, bonus);
        emit('toast', { message: `Endless wave ${w}! +${bonus} antibodi`, kind: 'gold' });
      }
      run.wave = run.spawnSys.wave;
    }

    if (events.bossSpawn) {
      emit('wave', { wave: run.spawnSys.wave, isBoss: true });
      run.camera.addShake(0.7);
    }

    // 3. Update musuh (behavior + boss AOE)
    for (const e of run.enemies) {
      if (e.alive) e.update(dt, player, run.time, this);
    }

    // 4. Bangun ulang spatial grid dari posisi musuh terkini
    run.collision.rebuildEnemyGrid(run.enemies);

    // 5. Update proyektil (homing butuh grid utk cari target)
    for (const p of run.projectiles) p.update(dt, this);

    // 6. Kollision proyektil vs musuh
    run.collision.handleProjectileHits(run.projectiles, (proj, enemy) => {
      const died = enemy.takeDamage(proj.damage);
      this.spawnHitFeedback(enemy, proj.damage, died);
      if (died) this.onEnemyKilled(enemy, proj);
      else audio.hit();
      return died;
    });

    // 7. Separation antar musuh (anti menumpuk)
    run.collision.separateEnemies(run.enemies);

    // 8. Kollision player vs musuh (contact damage)
    if (player.alive && player.iframes <= 0) {
      const hit = run.collision.checkPlayerCollision(player);
      if (hit) this.damagePlayer(hit.damage);
    }

    // 9. Pickup (nutrisi)
    this.updatePickups(dt);

    // 10. Efek & partikel (+ cooldown kemampuan aktif)
    run.abilities.update(dt);
    run.effects.update(dt);

    // 11. Kamera follow + shake decay
    run.camera.follow(player.x, player.y, dt);
    run.camera.update(dt);

    // Tutorial langkah "bergerak": akumulasi jarak pemain
    const mv = this.input.getMoveVector();
    if (mv.x || mv.y) tutorial.notifyMoved(Math.hypot(mv.x, mv.y) * player.stats.speed * dt, player.stats.speed);

    // 12. Bersihkan entity mati
    run.enemies = run.enemies.filter((e) => e.alive);
    run.projectiles = run.projectiles.filter((p) => p.alive);
    run.pickups = run.pickups.filter((p) => p.alive);

    // 13. Proses antrean level-up (modal terbuka → game pause via STATE)
    if (run.levelUpQueue > 0 && !STATE.levelUpOpen) {
      this.openLevelUpModal();
    }
  },

  updatePickups(dt) {
    const run = this.run;
    const player = run.player;
    if (!player.alive) {
      for (const p of run.pickups) p.update(dt, { x: player.x, y: player.y, magnetRadius: 0, pickupRadius: 0 });
      return;
    }
    const zone = {
      x: player.x,
      y: player.y,
      magnetRadius: player.stats.magnetRadius,
      pickupRadius: player.stats.pickupRadius,
    };
    for (const p of run.pickups) {
      p.update(dt, zone);
      if (p.alive && p.isCollectedBy(player)) {
        p.alive = false;
        this.collectPickup(p);
      }
    }
  },

  /** Terapkan efek nutrisi yang diambil. */
  collectPickup(p) {
    const run = this.run;
    run.nutrientsCollected += 1;
    tutorial.notifyCollected();
    audio.collect();
    run.effects.spawnCollect(p.x, p.y, p.def.color);

    switch (p.pickupType) {
      case 'part': {
        // Bagian evolusi: untuk upgrade bentuk hero (tangan → kaki → pedang → elemen)
        const partId = p.partId || p.def.id;
        run.parts[partId] = (run.parts[partId] || 0) + 1;
        run.partsCollectedTotal += 1;
        run.effects.spawnLabel(p.x, p.y, `${p.def.name} +1`, '#ffe082');
        run.effects.spawnKillFx('ring', p.x, p.y, run.evoStage.tierColor, Math.random() * 10);
        break;
      }
      case 'xp':
        this.addXP(p.value);
        break;
      case 'heal':
        run.player.heal(p.value);
        break;
      case 'currency':
        run.currencyEarned += p.value;
        break;
      case 'magnet': {
        for (const other of run.pickups) other.magnetized = true;
        emit('toast', { message: 'Sinyal sitokin! Semua nutrisi tertarik padamu.' });
        break;
      }
      default:
        console.warn('[game] pickupType tidak dikenal:', p.pickupType);
    }
  },

  // =====================================================================
  // XP & LEVEL-UP (xpToNextLevel = ceil(10 * level^1.5))
  // =====================================================================
  addXP(baseAmount) {
    const run = this.run;
    const gained = baseAmount * run.player.stats.xpMult;
    run.xp += gained;
    run.xpGained += gained;
    while (run.xp >= xpToNextLevel(run.level)) {
      run.xp -= xpToNextLevel(run.level);
      run.level += 1;
      run.levelUpQueue += 1;
    }
  },

  openLevelUpModal() {
    const run = this.run;
    run.currentChoices = rollLevelUpChoices(run);
    setLevelUpOpen(true);
    setPaused(true);
    audio.levelup();
    emit('levelup', { level: run.level, choices: run.currentChoices });
  },

  /** Dipanggil dari modal level-up saat pemain memilih satu upgrade. */
  chooseLevelUp(upgradeId) {
    const run = this.run;
    if (!run || !run.currentChoices) return;
    const result = applyLevelUp(run, upgradeId);
    this.recomputePlayerStats();
    if (result.healAmount > 0) run.player.heal(result.healAmount);

    run.levelUpQueue = Math.max(0, run.levelUpQueue - 1);
    if (run.levelUpQueue > 0) {
      // masih ada level berlebih → tampilkan pilihan berikutnya
      this.openLevelUpModal();
    } else {
      run.currentChoices = null;
      setLevelUpOpen(false);
      setPaused(false);
      emit('resume'); // tutup modal, kembali ke HUD
    }
  },

  // =====================================================================
  // SERANGAN & DAMAGE
  // =====================================================================
  /** Dipakai Player untuk spawn proyektil. */
  spawnProjectile(opts) {
    const proj = new Projectile(opts);
    this.run.projectiles.push(proj);
    return proj;
  },

  /** Tebasan melee: damage semua musuh dalam radius & sudut arc. */
  applyMeleeSwipe(player, angle, radius, arc, damage) {
    const run = this.run;
    const half = arc / 2;
    run.collision.grid.queryCircle(player.x, player.y, radius + 48, (e) => {
      if (!e.alive) return;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + e.radius * 0.5) return;
      // cek sudut dalam arc
      const angTo = Math.atan2(dy, dx);
      let diff = angTo - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > half) return;
      const died = e.takeDamage(damage);
      this.spawnHitFeedback(e, damage, died);
      if (died) this.onEnemyKilled(e, null);
    });
  },

  /**
   * Feedback visual per hit: bintang aset fx_hit.png + angka damage mengambang.
   */
  spawnHitFeedback(enemy, damage, died) {
    const run = this.run;
    run.effects.spawnSpark(enemy.x, enemy.y - enemy.radius * 0.3, died || enemy.isBoss);
    run.effects.spawnDamageNumber(enemy.x, enemy.y - enemy.radius - 14, damage, died ? '#ffd93d' : '#ffffff');
  },

  /** Cari musuh terdekat (dipakai auto-attack & homing). */
  findNearestEnemy(x, y, range) {
    return this.run.collision.findNearestEnemy(x, y, range);
  },

  /** Ledakan AOE boss: cek player dalam radius + shake. */
  bossBlast(enemy, cfg) {
    const run = this.run;
    run.effects.spawnBlast(enemy.x, enemy.y, cfg.radius, '#ff4059');
    run.camera.addShake(0.55);
    const player = run.player;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const rr = cfg.radius + player.radius;
    if (dx * dx + dy * dy < rr * rr) {
      this.damagePlayer(cfg.damage);
    }
  },

  /** Pusat damage ke player: i-frames, vignette, shake, death flow. */
  damagePlayer(amount) {
    const run = this.run;
    const player = run.player;
    if (!player.takeDamage(amount)) return;
    emit('playerHit', { damage: amount });
    // Screen shake saat kena damage besar (sesuai spek)
    run.camera.addShake(amount >= 15 ? 0.6 : 0.22);
    audio.playerHit();
    player.squash = 0.28; // JUICE squash saat terkena hit
    if (!player.alive) {
      this.handlePlayerDeath();
    }
  },

  handlePlayerDeath() {
    const run = this.run;
    if (run.ended) return;
    if (!run.reviveOffered) {
      run.reviveOffered = true;
      setPaused(true);
      emit('revive', {});
    } else {
      this.finishRun(false);
    }
  },

  // =====================================================================
  // SPAWN MUSUH & DROP
  // =====================================================================
  /**
   * Spawn musuh di luar area pandang (dipanggil SpawnSystem).
   */
  spawnEnemy(enemyId, isBossSpawn) {
    const run = this.run;
    const def = getEnemyDef(enemyId);
    if (!def) return;
    const scalers = run.spawnSys.getScalers();
    if (def.isBoss) {
      scalers.hpScale *= run.spawnSys.getBossHPMultiplier();
    }
    const pos = run.spawnSys.getSpawnPosition(run.player.x, run.player.y, this.viewW, this.viewH);
    const enemy = new Enemy(def, pos.x, pos.y, scalers);
    // Kondisi tubuh: sistem kritis bisa mempercepat musuh (mis. Imun < 20)
    if (run.bodyMods && run.bodyMods.enemySpeedMult && run.bodyMods.enemySpeedMult !== 1) {
      enemy.speed *= run.bodyMods.enemySpeedMult;
    }
    // Mutator liveops: damage kontak musuh
    if (run.bodyMods && run.bodyMods.enemyDamageMult) {
      enemy.damage = Math.round(enemy.damage * run.bodyMods.enemyDamageMult);
    }
    run.enemies.push(enemy);
    if (def.isBoss) {
      run.boss = enemy;
      audio.bossSpawn();
      emit('toast', { message: 'SEL KANKER MUNCUL!', kind: 'danger' });
    }
  },

  /**
   * Peti boss muncul di momen istirahat alami (boss tumbang, gameplay dipause).
   * Isi: antibodi + 1 bagian evolusi. Tawaran iklan opsional: 2x isi.
   */
  openBossChest(enemy) {
    const run = this.run;
    const economy = getData().upgrades.economy;
    const bonusCurrency = economy.waveBonusPerWave + run.spawnSys.wave * 2;
    const bonusPart = rollPartDrop('boss', 1) || 'silia';
    run.bossChest = { currency: bonusCurrency, partId: bonusPart, doubled: false };
    setPaused(true);
    audio.chest();
    emit('bosschest', {
      currency: bonusCurrency,
      partName: getData().evolutions.parts.find((p) => p.id === bonusPart)?.name || 'Bagian',
      partSprite: getData().evolutions.parts.find((p) => p.id === bonusPart)?.sprite || '',
      adAvailable: canWatchAd(STATE.meta),
    });
  },

  /** Ambil isi peti tanpa iklan → lanjut run. */
  claimBossChestKeep() {
    this._grantBossChest(false);
  },

  /** Iklan reward selesai → isi peti digandakan → lanjut run. Logic asli. */
  claimBossChestDouble() {
    const meta = STATE.meta;
    if (!canWatchAd(meta)) { this._grantBossChest(false); return; }
    triggerRewardedAdBossChest(() => {
      trackAdWatch(meta);
      this._grantBossChest(true);
    }, () => this._grantBossChest(false));
  },

  _grantBossChest(doubled) {
    const run = this.run;
    const meta = STATE.meta;
    const chest = run.bossChest;
    if (!chest) return;
    const currency = chest.currency * (doubled ? 2 : 1);
    meta.currency += currency;
    meta.evoParts[chest.partId] = (meta.evoParts[chest.partId] || 0) + (doubled ? 2 : 1);
    writeSave(meta);
    run.bossChest = null;
    emit('toast', { message: `Peti boss: +${currency} antibodi${doubled ? ' (2x!)' : ''}`, kind: 'gold' });
    setPaused(false);
    emit('resume');
  },

  /**
   * Aktivasi kemampuan aktif via tombol HUD / keyboard (slot 1-4).
   * @returns {boolean} true bila kemampuan terluncur.
   */
  useAbilityBySlot(slot) {
    const run = this.run;
    if (!run || run.ended || STATE.levelUpOpen) return false;
    const player = run.player;
    if (!player.alive) return false;
    return run.abilities.triggerBySlot(slot, {
      player,
      enemies: run.enemies,
      damage: player.stats.damage,
      effects: run.effects,
      camera: run.camera,
      hitEnemy: (enemy, dmg) => {
        const died = enemy.takeDamage(dmg);
        this.spawnHitFeedback(enemy, dmg, died);
        if (died) this.onEnemyKilled(enemy, null);
      },
    });
  },

  /** JUICE: hentikan update sesaat (dtk) — render tetap berjalan. */
  hitStopRun(sec) {
    if (this.run) this.run.hitStop = Math.max(this.run.hitStop, sec);
  },

  /** Musuh mati: kill count, partikel, drop nutrisi, splitter, boss reward. */
  onEnemyKilled(enemy, source) {
    const run = this.run;
    run.kills += 1;
    tutorial.notifyKill();

    // ---- JUICE: combo counter + hit-stop + SFX kill ----
    run.combo.count += 1;
    run.combo.timer = 2.0;
    if (run.combo.count >= 3) audio.combo(run.combo.count);
    if (run.combo.count > 0 && run.combo.count % 10 === 0) {
      this.addXP(10 + run.combo.count); // bonus XP milestone combo
      emit('toast', { message: `COMBO x${run.combo.count}! +${10 + run.combo.count} XP`, kind: 'gold' });
    }
    audio.kill();
    if (enemy.isBoss) this.hitStopRun(0.07);      // hit-stop 70ms boss
    else if (enemy.def.elite) this.hitStopRun(0.035); // 35ms elite
    run.effects.spawnBurst(enemy.x, enemy.y, enemy.def.color, enemy.isBoss ? 26 : 8, enemy.isBoss ? 300 : 150, enemy.isBoss ? 6 : 4);

    // ---- VFX kill sesuai tier evolusi hero (ring→slash→angin→petir→legenda)
    const killKind = run.evoStage.killFx || 'ring';
    run.effects.spawnKillFx(killKind, enemy.x, enemy.y, run.evoStage.tierColor, Math.random() * 10);
    if (killKind === 'legend' || enemy.isBoss) {
      run.effects.spawnBurst(enemy.x, enemy.y, run.evoStage.tierColor, 10, 220, 4);
    }

    if (enemy.isBoss) {
      run.bossKills += 1;
      run.boss = null;
      run.camera.addShake(0.65);
      audio.bossDie();
      emit('toast', { message: 'Sel Kanker dikalahkan! +' + enemy.xpPerKill + ' XP', kind: 'gold' });
      this.openBossChest(enemy);
    }

    // ---- Drop BAGIAN EVOLUSI (item upgrade hero, bukan sekadar poin) ----
    const partMult = run.arena.bonus.partMult || 1;
    const dropPart = (partId, ox = 0, oy = 0) => {
      if (!partId) return;
      const partDef = getData().evolutions.parts.find((p) => p.id === partId);
      if (!partDef) return;
      const pickup = new Pickup({ ...partDef, pickupType: 'part', color: partDef.sprite, radius: 13, lifetime: 25 }, enemy.x + ox, enemy.y + oy);
      pickup.partId = partDef.id;
      run.pickups.push(pickup);
    };
    if (enemy.isBoss) {
      for (let i = 0; i < getData().evolutions.bossGuaranteedParts; i++) {
        dropPart(rollPartDrop('boss', partMult), (Math.random() - 0.5) * 70, (Math.random() - 0.5) * 70);
      }
    } else if (enemy.def.elite) {
      dropPart(rollPartDrop('elite', partMult));
    } else {
      dropPart(rollPartDrop('normal', partMult));
    }

    // ---- Drop orb XP (nilai = xpPerKill musuh; skin sesuai nilai) ----
    // Nilai nutrisi dipengaruhi kondisi Pencernaan (meta-layer)
    const nutrMult = run.bodyMods?.nutrientMult ?? 1;
    const nutrients = getData().nutrients;
    const xpSkin = enemy.xpPerKill >= 5 ? getNutrientDef('amino') : getNutrientDef('glukosa');
    run.pickups.push(new Pickup(xpSkin, enemy.x, enemy.y, Math.round(enemy.xpPerKill * nutrMult * 10) / 10));

    // ---- Bonus drop (heal/currency/magnet) ----
    if (enemy.isBoss) {
      for (const itemId of nutrients.bossGuaranteedDrops) {
        const def = getNutrientDef(itemId);
        run.pickups.push(new Pickup(def, enemy.x + (Math.random() - 0.5) * 60, enemy.y + (Math.random() - 0.5) * 60));
      }
    } else if (Math.random() < nutrients.bonusDropChance) {
      const itemId = this.pickWeightedBonus(nutrients.bonusWeights);
      if (itemId) {
        const def = getNutrientDef(itemId);
        run.pickups.push(new Pickup(def, enemy.x, enemy.y));
      }
    }

    // ---- Splitter: pecah jadi N musuh kecil ----
    const split = enemy.def.splitOnDeath;
    if (split && !enemy.splitSource) {
      const childDef = getEnemyDef(split.childId);
      if (childDef) {
        for (let i = 0; i < split.count; i++) {
          const ang = Math.random() * Math.PI * 2;
          const child = new Enemy(childDef, enemy.x + Math.cos(ang) * 18, enemy.y + Math.sin(ang) * 18, { hpScale: 1, speedScale: 1 }, {
            hpScale: split.hpScale,
            radiusScale: split.radiusScale,
            speedScale: split.speedScale,
          });
          run.enemies.push(child);
        }
      }
    }
  },

  pickWeightedBonus(weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let roll = Math.random() * total;
    for (const k in weights) {
      roll -= weights[k];
      if (roll <= 0) return k;
    }
    return null;
  },

  // =====================================================================
  // PAUSE / RESUME / QUIT
  // =====================================================================
  pause() {
    if (STATE.screen !== 'gameplay' || STATE.paused || STATE.levelUpOpen) return;
    setPaused(true);
    emit('pause', {});
  },

  resume() {
    if (STATE.screen !== 'gameplay') return;
    setPaused(false);
    emit('resume'); // tutup modal pause, kembali ke HUD
  },

  // =====================================================================
  // REVIVE (rewarded ad hook — alur setelahnya logic asli)
  // =====================================================================
  requestRevive() {
    triggerRewardedAdRevive(() => this.confirmRevive());
  },

  /** Logic asli setelah iklan "selesai ditonton". */
  confirmRevive() {
    const run = this.run;
    if (!run || run.ended) return;
    const player = run.player;
    run.reviveUsed = true;
    player.alive = true;
    player.hp = Math.round(player.maxHP * 0.5);
    player.iframes = 2.0;

    // Bersihkan musuh di sekitar (tanpa drop — anti exploit)
    const clearRadius = 320;
    for (const e of run.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < clearRadius) {
        e.alive = false;
        run.effects.spawnBurst(e.x, e.y, e.def.color, 6, 200, 4);
      }
    }
    run.enemies = run.enemies.filter((e) => e.alive);
    run.camera.addShake(0.5);
    setPaused(false);
    emit('resume'); // tutup modal revive, kembali ke HUD
    emit('toast', { message: 'Sel regenerasi — lanjutkan pertempuran!', kind: 'gold' });
  },

  declineRevive() {
    this.finishRun(false);
  },

  // =====================================================================
  // AKHIR RUN — ekonomi, statistik, misi, save
  // =====================================================================
  /** MENANG mode Klasik (finalWave terlampaui) — alur sama dengan akhir run. */
  winRun() {
    const run = this.run;
    if (!run || run.ended) return;
    run.victory = true;
    audio.evolve(); // fanfare kemenangan
    this.finishRun(false);
  },

  finishRun(quit) {
    const run = this.run;
    if (!run || run.ended) return;
    run.ended = true;

    const meta = STATE.meta;
    const bonus = computeRunEndBonus(run);
    const earned = run.currencyEarned + (run.bonusCurrency || 0) + bonus;
    run.earned = earned;
    const victory = !!run.victory;

    // Statistik permanen (wins → membuka mode Endless)
    if (victory) meta.stats.wins = (meta.stats.wins || 0) + 1;
    meta.stats.totalKills += run.kills;
    meta.stats.bossKills += run.bossKills;
    meta.stats.bestWave = Math.max(meta.stats.bestWave, run.spawnSys.wave);
    meta.stats.bestSurvivalTime = Math.max(meta.stats.bestSurvivalTime, Math.floor(run.time));
    meta.stats.totalSurviveSeconds += Math.floor(run.time);
    meta.stats.totalRuns += 1;
    meta.stats.totalNutrients += run.nutrientsCollected;
    meta.stats.totalXP += Math.floor(run.xpGained);
    // Bagian evolusi yang dikumpulkan selama run → inventory meta
    for (const [partId, n] of Object.entries(run.parts)) {
      if (n > 0) meta.evoParts[partId] = (meta.evoParts[partId] || 0) + n;
    }
    addCurrency(meta, earned);

    // META-LAYER kondisi tubuh: racun, energi, pemulihan sistem fokus,
    // toxic seep, streak milestone — loop tertutup antar-run.
    this.lastBodyImpact = registerRunResult(meta, {
      kills: run.kills,
      wave: run.spawnSys.wave,
      focusId: run.focusId || 'seimbang',
    });
    emit('bodyimpact', this.lastBodyImpact);

    // LEADERBOARD lokal per mode (top-10, wave → waktu → kill)
    const lbResult = recordLeaderboardEntry(meta, {
      modeId: (run.mode && run.mode.id) || 'normal',
      heroName: run.heroDef.name,
      heroColor: run.heroDef.color,
      wave: run.spawnSys.wave,
      time: Math.floor(run.time),
      kills: run.kills,
      victory,
      date: new Date().toISOString().slice(0, 10),
    });

    // Misi baru selesai → reward otomatis
    const completedMissions = checkMissions(meta);
    for (const m of completedMissions) {
      emit('toast', { message: `Misi "${m.name}" selesai! +${m.reward} antibodi`, kind: 'gold' });
    }
    // Auto-unlock hero dari statistik
    const newlyUnlocked = checkAutoUnlocks(meta);
    for (const h of newlyUnlocked) {
      emit('toast', { message: `Hero baru terbuka: ${h.name}!`, kind: 'gold' });
    }

    writeSave(meta); // AUTO-SAVE akhir run

    setPaused(false);
    setScreen('gameover');
    emit('gameover', {
      quit,
      victory,
      modeId: (run.mode && run.mode.id) || 'normal',
      mutatorName: run.mutator ? run.mutator.name : null,
      isRecord: lbResult.isNewBest,
      wave: run.spawnSys.wave,
      time: Math.floor(run.time),
      kills: run.kills,
      bossKills: run.bossKills,
      xpGained: Math.floor(run.xpGained),
      nutrients: run.nutrientsCollected,
      parts: run.partsCollectedTotal,
      level: run.level,
      currencyEarned: earned,
      newMissions: completedMissions.length,
    });
  },

  /**
   * Logic asli setelah iklan double-currency "selesai ditonton":
   * tambahkan earn yang sama sekali lagi + simpan.
   * @returns {number} total currency meta terbaru
   */
  applyDoubleCurrency() {
    const run = this.run;
    if (!run || run.doubleCurrencyUsed) return STATE.meta.currency;
    run.doubleCurrencyUsed = true;
    const meta = STATE.meta;
    addCurrency(meta, run.earned);
    writeSave(meta); // AUTO-SAVE
    return meta.currency;
  },

  canDoubleCurrency() {
    return !!(this.run && !this.run.doubleCurrencyUsed && this.run.earned > 0);
  },

  // =====================================================================
  // RENDER
  // =====================================================================
  render(dt, time) {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    if (!ctx || w === 0) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const run = this.run;
    if (!run) {
      ctx.fillStyle = '#060d16';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const cam = run.camera;
    const player = run.player;

    // Latar prosedural (screen-space, parallax internal)
    drawBackground(ctx, cam.x, cam.y, w, h, time);

    // ---- Dunia (relatif kamera) ----
    ctx.save();
    cam.apply(ctx, w, h);

    // Pickup nutrisi (sprite + glow pulse lembut)
    for (const p of run.pickups) {
      drawPulseGlow(ctx, p.x, p.y, p.radius * 1.4, p.def.color, time, p.uid * 0.13, 0.7);
      const fade = p.lifetime - p.age < 4 ? (Math.sin(time * 8) * 0.25 + 0.65) : 1; // kedip menjelang hilang
      drawSprite(ctx, p.def.sprite, p.x, p.y, p.radius * 2.4, 0, { alpha: fade });
    }

    // Musuh: telegraph boss di bawah, lalu sprite, lalu health bar
    for (const e of run.enemies) {
      if (!e.alive) continue;
      if (e.def.areaAttack) drawTelegraph(ctx, e, e.def.areaAttack);
      // Shadow pipih ala mockup (bayangan lembut di bawah entitas)
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#0a3530';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.radius * 0.92, e.radius * 0.85, e.radius * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const path = e.attackSpriteHint ? e.def.spriteAttack : e.def.spriteIdle;
      drawSprite(ctx, path, e.x, e.y, e.radius * 2.667, e.def.orientToMovement ? e.rotation : 0, {
        flash: e.hitFlash > 0 ? Math.min(1, e.hitFlash / 0.12) : 0,
      });
      drawHealthBar(ctx, e.x, e.y - e.radius - 10, Math.max(30, e.radius * 2), 5, e.hp / e.maxHP, e.isBoss ? '#ff5d73' : '#ffd93d');
    }

    // Player (blink saat i-frames, sprite attack saat baru menyerang)
    if (player.alive) {
      const blink = player.iframes > 0 && Math.floor(time * 12) % 2 === 0;
      if (!blink) {
        const path = player.attackFlash > 0 ? player.heroDef.spriteAttack : player.heroDef.spriteIdle;
        // Aura mockup: ring putih gradasi lembut di belakang karakter
        drawSprite(ctx, 'assets/sprites/deco_aura.png', player.x, player.y, player.radius * 4.4, 0, { alpha: 0.8 });
        drawPulseGlow(ctx, player.x, player.y, player.radius * 1.5, player.heroDef.color, time, 0, 0.8);
        const bodySize = player.radius * 2.667 * (player.squash > 0 ? 1 + Math.sin(time * 48) * 0.06 : 1);
        const evo = run.evoStage;
        // OVERLAY EVOLUSI — bentuk hero berubah sesuai tahap (terlihat jelas):
        if (evo.stage >= 2) drawSprite(ctx, 'assets/sprites/ov_pseudopodia.png', player.x, player.y + bodySize * 0.34, bodySize * 0.62, 0, {});
        if (evo.stage >= 4) drawSprite(ctx, 'assets/sprites/ov_inti.png', player.x, player.y, bodySize * 1.5, time * 1.1, { alpha: 0.85 });
        drawSprite(ctx, path, player.x, player.y, bodySize, 0, {});
        if (evo.stage >= 1) drawSprite(ctx, 'assets/sprites/ov_silia.png', player.x, player.y - bodySize * 0.3, bodySize * 0.6, Math.sin(time * 2.2) * 0.08, {});
        if (evo.stage >= 3) drawSprite(ctx, 'assets/sprites/ov_pedang.png', player.x + bodySize * 0.3, player.y - bodySize * 0.04, bodySize * 0.78, 0.5 + Math.sin(time * 2.6) * 0.05, {});
      }
    }

    // Proyektil (shape dinamis)
    for (const p of run.projectiles) {
      if (p.alive) drawProjectile(ctx, p, time);
    }

    // Efek (tebasan, blast, spark) & partikel & angka damage
    const drawImageAt = (path, x, y, size, rotation = 0, opts = {}) => drawSprite(ctx, path, x, y, size, rotation, opts);
    for (const fx of run.effects.effects) {
      if (fx.type === 'swipe') drawSwipeArc(ctx, fx);
      else if (fx.type === 'blast') drawBlastRing(ctx, fx);
      else if (fx.type === 'spark') drawHitSpark(ctx, fx, drawImageAt);
      else if (fx.type === 'killfx') drawKillFx(ctx, fx, time);
    }
    for (const pt of run.effects.particles) {
      drawParticle(ctx, pt);
    }
    for (const n of run.effects.numbers) {
      drawDamageNumber(ctx, n, time);
    }

    ctx.restore();

    // ---- Screen-space overlays ----
    cam.drawBossIndicatorIfOffscreen(ctx, run.boss, w, h, time);
    drawJoystick(ctx, this.input.joystick, this.input.maxRadius, drawImageAt);

    // ---- HUD DOM + minimap ----
    if (STATE.screen === 'gameplay' || STATE.screen === 'gameover') {
      updateHUD({
        hpPct: player.hp / player.maxHP,
        hpText: `${Math.ceil(player.hp)}/${player.maxHP}`,
        xpPct: run.xp / xpToNextLevel(run.level),
        wave: run.spawnSys.wave,
        abilities: run.abilities.getView(),
        combo: run.combo,
        timerText: this.formatTime(run.time),
        kills: run.kills,
        currency: run.currencyEarned,
        level: run.level,
        boss: run.boss && run.boss.alive ? { name: run.boss.def.name, pct: run.boss.hp / run.boss.maxHP } : null,
      });
      const mmCtx = getMinimapContext();
      if (mmCtx) {
        drawMinimap(mmCtx, mmCtx.canvas, run, player, 760);
      }
    }
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  /** Ringkasan run untuk modal pause. */
  getRunSummary() {
    const run = this.run;
    if (!run) return null;
    return {
      wave: run.spawnSys.wave,
      time: this.formatTime(run.time),
      kills: run.kills,
      level: run.level,
      currency: run.currencyEarned,
    };
  },
};

// Dipakai main.js untuk announce banner wave (di-screen-kan lewat hud module)
export { showAnnounce };
