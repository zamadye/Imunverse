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
import { getTintedSprite } from '../render/sprite-loader.js';
import { t as tr } from '../systems/i18n.js';
import { writeSave } from '../save/save-manager.js';
import { markSeen } from '../systems/codex-system.js';
import { SkillSystem } from '../systems/skill-system.js';

import { Player } from '../entities/player.js';
import { Enemy } from '../entities/enemy.js';
import { Projectile } from '../entities/projectile.js';
import { Pickup } from '../entities/pickup.js';

import { SpawnSystem } from '../systems/spawn-system.js';
import { CollisionSystem } from '../systems/collision-system.js';
import { rollLevelUpChoices, applyLevelUp, squadMultipliers } from '../systems/upgrade-system.js';
import { computeRunEndBonus, addCurrency } from '../systems/economy-system.js';
import { checkMissions } from '../systems/mission-system.js';
import { addBpXP } from '../systems/battlepass-system.js';
import { addImun, getEquippedSkin } from '../systems/imun-economy.js';
import { imuForRun, xpForKill, comboXpMult, applyGlobalUpgrades, queueHeroNotice, getRetention } from '../systems/retention-system.js';
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
import { Ally } from '../entities/ally.js';
import { getTodayMutator, mergeMutatorMods, recordLeaderboardEntry } from '../systems/liveops-system.js';

import { Camera, PERSP } from '../render/camera.js';
import { drawBackground, drawArena3D, setArenaPalette } from '../render/background.js';
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
  runFlags: {},

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
    // ITEM VARIASI (dipakai otomatis bila dimiliki):
    this.runFlags = {};
    meta.consumables = meta.consumables || {};
    if ((meta.consumables.vaksin_awal || 0) > 0) {
      meta.consumables.vaksin_awal -= 1;
      this.runFlags.vaksin = true;
      emit('toast', { message: 'Vaksin Awal: +30 HP run ini!', kind: 'gold' });
    }
    if ((meta.consumables.kopi_limfa || 0) > 0) {
      meta.consumables.kopi_limfa -= 1;
      this.runFlags.kopi = true;
      emit('toast', { message: 'Kopi Limfa: +12% kecepatan!', kind: 'gold' });
    }
    if ((meta.consumables.pelindung_lendir || 0) > 0) {
      meta.consumables.pelindung_lendir -= 1;
      this.runFlags.pelindung = true;
      emit('toast', { message: 'Pelindung Lendir: 1 serangan terserap!', kind: 'gold' });
    }
    if ((meta.consumables.koin_ganda || 0) > 0) {
      meta.consumables.koin_ganda -= 1;
      this.runFlags.ganda = true;
      emit('toast', { message: 'Sinyal Ganda: +50% antibodi run ini!', kind: 'gold' });
    }

    const startX = 0;
    const startY = 0;
    const upgrades = {};
    // Decay harian sistem tubuh (sekali per hari kalender) + modifier kondisi
    const decayInfo = applyDailyDecay(meta);
    const bodyMods = getBodyRunModifiers(meta);
    this.lastBodyDecay = decayInfo;

    // LIVEOPS: mode (Kampanye/Endless) + mutator harian seeded (khusus Endless)
    const modes = (getData().modes && getData().modes.modes) || [];
    const modeDef = modes.find((m) => m.id === (meta.selectedMode || 'kampanye')) || modes[0] || null;
    // KAMPANYE: bab aktif dari Peta Tubuh (cerita organ sakit → bersihkan → boss)
    const chapterDef = modeDef && modeDef.id === 'kampanye' && getData().campaign
      ? getData().campaign.chapters.find((c) => c.id === meta.selectedChapter) || getData().campaign.chapters[0]
      : null;
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
    markSeen(heroDef.id); // Bio-Pedia: hero yang dimainkan
    markSeen('imun'); // Bio-Pedia: sistem imun (pasukan pemain)

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
      hazards: [], // Fase 9: genangan toksin (area damage statis)
      nkPulseT: 1, // Fase 9: sorotan pengungkap Sel Abnormal (hero Sel NK)
      // BUFF TEMPUR (Fase 8.4, dokumen entitas): sementara (timer) & permanen se-run
      tempBuffs: { damage: { mult: 1, t: 0 }, cooldown: { mult: 1, t: 0 }, xp: { mult: 1, t: 0 }, speed: { mult: 1, t: 0 } },
      permBoost: { maxHP: 0, regen: 0, omega: 0 },
      bodyMods, // modifier kondisi tubuh run ini — dipakai ulang saat recompute
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
      chapter: chapterDef,
      mutator: mutatorDef,
      mutatorDate,
      allies: [],
      objective: chapterDef
        ? { quota: chapterDef.killQuota, bossSpawned: false, bossDefeated: false }
        : null,
      bonusCurrency: 0,
      victory: false,
      focusId,
      focusDef,
      // Fase 12: 3 skill aktif hero (S1/S2/Ult) ala MLBB — data-driven skills.json
      skills: new SkillSystem(heroDef, { cdMult: squadMultipliers(meta).jurusCd }),
      // lapisan pertahanan Fase 12: shield → protect → evade
      shield: 0, evadeCharges: 0, protectMult: 1, protectT: 0,
      parts: { silia: 0, pseudopodia: 0, mikropedang: 0, inti_elemen: 0 },
      partsCollectedTotal: 0,
      bossChest: null,
      combo: { count: 0, timer: 0 },
      imuAccrued: 0, // Fase 17: IMU terkumpul live di HUD (akhir run = rumus penuh)
      hitStop: 0,
      ended: false,
      stats: { shotsFired: 0 },
    };

    this.run.spawnSys.mods = bodyMods; // mutator/condisi tubuh → spawn & HP musuh
    // PASUKAN IMUN (permanen): ikut bertarung sesuai meta.allies
    this.run.allies = [];
    const allyCount = Math.max(0, Math.min(6, meta.allies || 0));
    const allySpeedBonus = (meta.allyLevel || 0) * (getData().upgrades.allyUpgrade.speedPerLevel || 0);
    for (let i = 0; i < allyCount; i++) this.run.allies.push(new Ally(i, player, allySpeedBonus));
    if (allyCount > 0) {
      const lvlTxt = meta.allyLevel > 0 ? ` (Lv ${meta.allyLevel})` : '';
      emit('toast', { message: `Pasukan imun: ${allyCount} sel ikut bertarung!${lvlTxt}`, kind: '' });
    }
    // Item variasi: vaksin (+30 HP) & kopi (+12% speed)
    const flags = this.runFlags || {};
    if (flags.vaksin) {
      player.maxHP += 30;
      player.hp = Math.min(player.maxHP, player.hp + 30);
    }
    if (flags.kopi) {
      player.stats.speed *= 1.12;
    }

    // HOOK dampak-dini: 2 patogen pasti mendekat dalam ±3 detik pertama
    for (let gi = 0; gi < 2; gi++) {
      const ga = (gi / 2) * Math.PI * 2 + 0.7;
      this.spawnEnemy('bakteri', false);
      const ge = this.run.enemies[this.run.enemies.length - 1];
      if (ge) {
        ge.x = player.x + Math.cos(ga) * 250;
        ge.y = player.y + Math.sin(ga) * 250;
      }
    }
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
    // Kampanye: organ bab menentukan arena (palet = jaringan tubuh bab)
    if (meta.selectedMode === 'kampanye' && getData().campaign) {
      const ch = getData().campaign.chapters.find((c) => c.id === meta.selectedChapter) || getData().campaign.chapters[0];
      const chArena = list.find((a) => a.id === ch.arenaId);
      if (chArena) return chArena;
    }
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
    // LEVEL HERO (upgrade antibodi per hero): damage & HP tumbuh
    const heroCfg = getData().upgrades.heroUpgrade;
    const heroLvl = (STATE.meta.heroLevels && STATE.meta.heroLevels[heroDef.id]) || 0;
    const up = runUpgrades;
    const serum = this.serumActive ? 1.25 : 1;

    // BUFF TEMPUR: nutrisi (zinc, zat besi, probiotik, serat) — nyata di statistik
    const tb = (this.run && this.run.tempBuffs) || null;
    const buffDamage = tb ? tb.damage.mult : 1;
    const buffCooldown = tb ? tb.cooldown.mult : 1;
    const buffXP = tb ? tb.xp.mult : 1;
    const perm = (this.run && this.run.permBoost) || { maxHP: 0, regen: 0, omega: 0 };

    const damage = base.damage * squad.damage * squad.weapon * (1 + (up.damage || 0) * 0.15) * serum * (1 + heroCfg.dmgPerLevel * heroLvl) * buffDamage;
    const cooldown = base.attackCooldown / ((1 + (up.attackSpeed || 0) * 0.12) * squad.attackSpeed) * buffCooldown;
    const speed = base.speed * squad.speed * (1 + (up.moveSpeed || 0) * 0.08) * (tb ? tb.speed.mult : 1);
    const attackRange = base.attackRange * squad.attackRange * (1 + (up.attackRange || 0) * 0.12);
    const swipeRadius = (base.swipeRadius || 0) * squad.attackRange * (1 + (up.attackRange || 0) * 0.12);
    const maxHP = Math.round(base.maxHP * squad.maxHP * (1 + heroCfg.hpPerLevel * heroLvl) + (up.maxHP || 0) * 20 + (perm.maxHP || 0));
    const projectileCount = base.projectileCount + (up.projectileCount || 0);
    const lifeSteal = (up.lifeSteal || 0) * 0.05; // Fase 12: Life Steal +5% per pilihan

    const isMelee = heroDef.attackPattern === 'melee_swipe';

    // Fase 17 (trigger 1C): UPGRADE GLOBAL Imun Coin — berlaku SEMUA hero
    const out = {
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
      xpMult: squad.xpGain * buffXP,
      lifeSteal,
      regen: perm.regen || 0,
      omegaCleanse: perm.omega || 0,
      // jarak cari target: melee pakai radius tebasan, ranged pakai attackRange
      effectiveAttackRange: isMelee ? swipeRadius + 26 : attackRange,
    };
    return applyGlobalUpgrades(out);
  },

  /** Rekomputasi statistik player setelah upgrade (mengubah damage, HP, dsb). */
  recomputePlayerStats() {
    const run = this.run;
    const oldMax = run.player.maxHP;
    const stats = this.computePlayerStats(run.heroDef, run.upgrades);
    // FIX (terbuka oleh e2e Fase 8.4): recompute dulu kehilangan pengali
    // evolusi/arena/kondisi tubuh — sekarang diterapkan ulang konsisten startRun.
    this.applyMetaMultipliers(stats);
    this.applyBodyModifiers(stats, run.bodyMods || getBodyRunModifiers(STATE.meta));
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

    // Fase 9: genangan toksin — damage berkala saat player di dalamnya
    for (let i = run.hazards.length - 1; i >= 0; i--) {
      const hz = run.hazards[i];
      hz.life -= dt;
      if (hz.life <= 0) { run.hazards.splice(i, 1); continue; }
      hz.tick = (hz.tick || 0) - dt;
      if (player.alive && hz.tick <= 0 && Math.hypot(player.x - hz.x, player.y - hz.y) < hz.r + player.radius * 0.4) {
        hz.tick = 0.8;
        this.damagePlayer(hz.dps);
      }
    }

    // Fase 9 — Toksin Raksasa: menumbuhkan genangan racun baru secara berkala
    if (run.boss && run.boss.alive && run.boss.def.hazardDrop) {
      const hd = run.boss.def.hazardDrop;
      if (run.bossHazardT === undefined) run.bossHazardT = hd.interval * 0.5;
      run.bossHazardT -= dt;
      if (run.bossHazardT <= 0) {
        run.bossHazardT = hd.interval;
        const b = run.boss;
        const a = Math.random() * Math.PI * 2;
        run.hazards.push({ x: b.x + Math.cos(a) * hd.radius, y: b.y + Math.sin(a) * hd.radius, r: hd.radius * 0.8, dps: 5, life: 10 });
        run.effects.spawnKillFx('ring', b.x, b.y, '#7ed957', Math.random() * 10);
      }
    }

    // Fase 9 — Sel NK: sorot berkala mengungkap Sel Abnormal yang menyamar
    run.nkPulseT -= dt;
    if (run.nkPulseT <= 0) {
      run.nkPulseT = 1.3;
      if (run.heroDef.id === 'sel_nk') {
        run.effects.spawnKillFx('ring', player.x, player.y, '#5ef2ff', Math.random() * 10);
        for (const e of run.enemies) if (e.alive && e.stealth) e.nkRevealT = 1.6;
      }
    }

    // BUFF TEMPUR (Fase 8.4): hitung mundur buff sementara + regen permanen run
    if (run.tempBuffs) {
      let buffExpired = false;
      for (const k of ['damage', 'cooldown', 'xp', 'speed']) {
        const b = run.tempBuffs[k];
        if (b.t > 0) {
          b.t -= dt;
          if (b.t <= 0) { b.t = 0; b.mult = 1; buffExpired = true; }
        }
      }
      if (buffExpired) this.recomputePlayerStats();
      if (run.permBoost.regen > 0 && player.alive) player.heal(run.permBoost.regen * dt);
    }

    // KAMPANYE: kuota bersih tercapai → boss organ muncul (sekali)
    if (run.objective && !run.objective.bossSpawned && run.kills >= run.objective.quota) {
      run.objective.bossSpawned = true;
      const boss = run.chapter.boss;
      if (boss) {
        this.spawnChapterBoss(run.chapter);
      } else {
        // Bab tanpa boss → langsung bersih saat kuota tercapai
        run.objective.bossDefeated = true;
        this.winRun();
        return;
      }
    }

    // Combo decay (2 dtk tanpa kill → reset)
    if (run.combo.timer > 0) {
      run.combo.timer -= dt;
      if (run.combo.timer <= 0) run.combo.count = 0;
    }
    // Squash-stretch decay
    if (player.squash > 0) player.squash -= dt;

    // TEMBAK MANUAL: hanya saat tombol TEMBAK ditekan/tahan
    if (this.input.isFiring && this.input.isFiring()) {
      player.tryFire(this);
    }

    // PASUKAN: follow + auto-tembak (level pasukan memperkuat)
    const allyCfg = getData().upgrades.allyUpgrade;
    const allyLvl = STATE.meta.allyLevel || 0;
    for (const ally of run.allies) {
      const shot = ally.update(dt, player, run.enemies, player.stats.damage * (1 + allyCfg.dmgPerLevel * allyLvl));
      if (shot) {
        this.spawnProjectile({
          pattern: 'pierce',
          x: shot.x,
          y: shot.y,
          angle: shot.angle,
          speed: shot.speed,
          damage: shot.damage,
          pierce: 1,
          radius: 7,
          color: shot.color,
        });
      }
    }

    // 1. Input & player (gerak + auto-attack)
    const move = this.input.getMoveVector();
    player.update(dt, move, this);

    // 2. Wave & spawn
    const events = run.spawnSys.update(dt, this);
    if (events.newWave) {
      emit('wave', { wave: run.spawnSys.wave, isBoss: false });
      audio.wave();
      const w = run.spawnSys.wave;
      // Fase 17 (trigger 1A): Imun Coin masuk LIVE tiap wave — +perWave, float emas
      const imuWave = getRetention().imuReward.perWave;
      run.imuAccrued += imuWave;
      run.effects.spawnLabel(player.x, player.y - 46, `+${imuWave} Imun`, '#ffd76a');
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
      // Eosinofil: granula toksik 1,5x damage ke Parasit (dokumen entitas, nyata)
      const dmg = (proj.antiParasitMult && enemy.def && enemy.def.id === 'parasit')
        ? proj.damage * proj.antiParasitMult
        : proj.damage;
      const died = enemy.takeDamage(dmg);
      if (enemy.lastHitAbsorbed) run.effects.spawnLabel(enemy.x, enemy.y - enemy.radius - 6, tr('TERLAPIS!'), '#cfd8e3');
      this.spawnHitFeedback(enemy, enemy.lastHitAbsorbed ? 0 : dmg, died);
      if (!enemy.lastHitAbsorbed) this.onDamageDealt(dmg);
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
    run.skills.update(dt);
    if (run.protectT > 0) {
      run.protectT -= dt;
      if (run.protectT <= 0) run.protectMult = 1;
    }
    // DOT tick (racun skill Eos)
    for (const e of run.enemies) {
      if (!e.alive || !e.dotT) continue;
      e.dotT -= dt;
      const dmg = (e.dotSrc || 0) * (e.dotMult || 0) * dt;
      const died = e.takeDamage(dmg);
      if (died) this.onEnemyKilled(e, null);
      if (e.dotT <= 0) e.dotMult = 0;
    }
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
    if (p.pickupType !== 'part') markSeen(p.def.id); // Bio-Pedia: nutrisi ditemui
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
        // XP TERASA: label melayang tiap orb (ramah anak)
        run.effects.spawnLabel(p.x, p.y - 6, tr(`+${Math.round(p.value * 10) / 10} XP`), '#8fe8d2');
        break;
      case 'heal':
        run.player.heal(p.value);
        break;
      case 'currency':
        run.currencyEarned += p.value;
        run.effects.spawnLabel(p.x, p.y - 8, `+${p.value}`, '#f5c64f'); // feedback farm
        break;
      case 'magnet': {
        for (const other of run.pickups) other.magnetized = true;
        emit('toast', { message: 'Sinyal sitokin! Semua nutrisi tertarik padamu.' });
        break;
      }
      case 'buff':
        this.applyCombatBuff(p);
        break;
      default:
        console.warn('[game] pickupType tidak dikenal:', p.pickupType);
    }
  },

  /** Fase 8.4 (dokumen entitas): terapkan nutrisi buff tempur. */
  applyCombatBuff(p) {
    const run = this.run;
    const t = p.def.buffType;
    const v = p.value;
    const dur = p.def.buffDuration || 20;
    const B = run.tempBuffs;
    if (t === 'buff_damage') {
      B.damage.mult *= 1 + v / 100;
      B.damage.t = Math.max(B.damage.t, dur);
      run.effects.spawnLabel(p.x, p.y - 10, tr(`+${v}% Damage!`), '#f2825c');
      this.recomputePlayerStats();
    } else if (t === 'buff_cooldown') {
      B.cooldown.mult *= Math.max(0.5, 1 - v / 100);
      B.cooldown.t = Math.max(B.cooldown.t, dur);
      run.effects.spawnLabel(p.x, p.y - 10, tr('Serangan makin cepat!'), '#7bdff2');
      this.recomputePlayerStats();
    } else if (t === 'buff_xp') {
      B.xp.mult *= 1 + v;
      B.xp.t = Math.max(B.xp.t, dur);
      run.effects.spawnLabel(p.x, p.y - 10, tr(`+${Math.round(v * 100)}% XP!`), '#8fe8d2');
    } else if (t === 'buff_maxhp') {
      run.permBoost.maxHP += v;
      this.recomputePlayerStats();
      run.effects.spawnLabel(p.x, p.y - 10, tr(`+${v} HP Maks!`), '#7ae582');
    } else if (t === 'buff_regen') {
      run.permBoost.regen += v;
      this.recomputePlayerStats();
      run.effects.spawnLabel(p.x, p.y - 10, tr('Regenerasi aktif'), '#5bc8ff');
    } else if (t === 'buff_omega') {
      run.permBoost.omega += v;
      this.recomputePlayerStats();
      run.effects.spawnLabel(p.x, p.y - 10, tr('Racun sisa dibersihkan'), '#7bdff2');
    } else {
      console.warn('[game] buffType tidak dikenal:', t);
    }
  },

  // =====================================================================
  // XP & LEVEL-UP (xpToNextLevel = ceil(10 * level^1.5))
  // =====================================================================
  addXP(baseAmount) {
    const run = this.run;
    // Fase 17 (trigger 2D): combo ≥3 kill/5 detik → XP ×1.2 (dopamine loop)
    const gained = baseAmount * run.player.stats.xpMult * comboXpMult(run.combo.count);
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
    // Fase 17 (trigger 2C): layar berhenti sejenak 0.3 dtk + ledakan emas
    run.currentChoices = rollLevelUpChoices(run);
    const pfx = getRetention().particles;
    run.effects.spawnBurst(run.player.x, run.player.y, '#ffd93d', pfx.levelUp, 240, 5);
    run.camera.addShake(0.3);
    showAnnounce('LEVEL UP!', false);
    this.hitStopRun(getRetention().levelUpStopSec);
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
      if (e.lastHitAbsorbed) run.effects.spawnLabel(e.x, e.y - e.radius - 6, tr('TERLAPIS!'), '#cfd8e3');
      this.spawnHitFeedback(e, e.lastHitAbsorbed ? 0 : damage, died);
      if (!e.lastHitAbsorbed) this.onDamageDealt(damage);
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
    // PELINDUNG LENDIR (item): serap serangan pertama
    if (this.runFlags && this.runFlags.pelindung) {
      this.runFlags.pelindung = false;
      run.effects.spawnLabel(player.x, player.y - 40, tr('TERSERAP!'), '#7fd8c8');
      run.effects.spawnBlast(player.x, player.y, 46, '#7fd8c8');
      audio.hit();
      return;
    }
    // Fase 12 — SHIELD skill: serap damage dulu
    if (run.shield > 0) {
      const absorbed = Math.min(run.shield, amount);
      run.shield -= absorbed;
      amount -= absorbed;
      run.effects.spawnLabel(player.x, player.y - 44, tr('TERSERAP!'), '#7fd8c8');
      if (amount <= 0) return;
    }
    // EVADE (skill Eos): hindari 1 serangan
    if (run.evadeCharges > 0) {
      run.evadeCharges -= 1;
      run.effects.spawnLabel(player.x, player.y - 44, tr('Evade!'), '#ff8a80');
      return;
    }
    // PROTECT (skill defensif): damage × mult
    if (run.protectMult < 1) amount = Math.max(1, Math.round(amount * run.protectMult));
    // PERTAHANAN (upgrade permanen): kurangi damage diterima
    amount = Math.max(1, Math.round(amount * (squadMultipliers(STATE.meta).armor || 1)));
    if (!player.takeDamage(amount)) return;
    emit('playerHit', { damage: amount });
    // Fase 17 (trigger 5B): percikan merah 5–8 partikel di sekitar player
    run.effects.spawnBurst(player.x, player.y, '#ff6b6b', getRetention().particles.playerHit, 120, 3);
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
  /** KAMPANYE: boss bab muncul saat kuota bersih tercapai. */
  spawnChapterBoss(chapter) {
    const run = this.run;
    const bossCfg = chapter.boss;
    const def = getEnemyDef(bossCfg.id);
    if (!def) return;
    const scalers = run.spawnSys.getScalers();
    scalers.hpScale *= (bossCfg.hpMult || 1) * run.spawnSys.getBossHPMultiplier();
    const pos = run.spawnSys.getSpawnPosition(run.player.x, run.player.y, this.viewW, this.viewH);
    const enemy = new Enemy(def, pos.x, pos.y, scalers);
    markSeen(bossCfg.id); // Bio-Pedia: boss ditemui
    if (bossCfg.areaAttack) enemy.def = Object.assign({}, def, { areaAttack: bossCfg.areaAttack });
    enemy.isBoss = true;
    enemy.bossName = bossCfg.name || def.name;
    enemy.maxHP = Math.round(enemy.maxHP);
    enemy.hp = enemy.maxHP;
    if (run.bodyMods && run.bodyMods.enemySpeedMult) enemy.speed *= run.bodyMods.enemySpeedMult;
    run.enemies.push(enemy);
    run.boss = enemy;
    run.chapterBoss = enemy;
    audio.bossSpawn();
    emit('toast', { message: `${enemy.bossName} MUNCUL!`, kind: 'danger' });
    run.camera.addShake(0.5);
  },

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
    markSeen(enemyId); // Bio-Pedia: musuh ditemui
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
      run.bossHazardT = undefined; // Fase 9: timer genangan di-reset per boss
      audio.bossSpawn();
      emit('toast', { message: `${def.name.toUpperCase()} MUNCUL!`, kind: 'danger' });
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
  /** Fase 12: SERANG manual sekali (tombol SERANG / tombol 4). */
  triggerAttack() {
    if (!this.run || this.run.ended || STATE.levelUpOpen) return false;
    this.run.player.tryFire(this);
    return true;
  },

  useAbilityBySlot(slot) {
    const run = this.run;
    if (!run || run.ended || STATE.levelUpOpen) return false;
    const player = run.player;
    if (!player.alive) return false;
    return run.skills.trigger(slot, {
      game: this,
      player,
      enemies: run.enemies,
      damage: player.stats.damage,
      effects: run.effects,
      camera: run.camera,
      hitEnemy: (enemy, dmg) => {
        // Jurus menembus lapisan armor (Petir Sel NK vs Gram±/Prion)
        const died = enemy.takeDamageRaw ? enemy.takeDamageRaw(dmg) : enemy.takeDamage(dmg);
        this.spawnHitFeedback(enemy, dmg, died);
        if (died) this.onEnemyKilled(enemy, null);
      },
    });
  },

  /** Fase 12: Life Steal — pulihkan HP dari damage yang diberikan. */
  onDamageDealt(amount) {
    const ls = this.run && this.run.player.stats.lifeSteal;
    if (ls > 0 && this.run.player.alive) this.run.player.heal(amount * ls);
  },

  /** Fase 9 — Prion: ubah musuh biasa di sekitar jadi versi kristal lebih kuat. */
  convertNearbyEnemies(prion, radius) {
    const run = this.run;
    let count = 0;
    for (const e of run.enemies) {
      if (!e.alive || e === prion || e.isBoss || e.def.id === 'prion') continue;
      if (Math.hypot(e.x - prion.x, e.y - prion.y) > radius) continue;
      e.maxHP = Math.round(e.maxHP * 1.6);
      e.hp = Math.min(e.maxHP, e.hp * 1.6);
      e.damage = Math.round(e.damage * 1.3);
      e.speed *= 1.15;
      e.radius = Math.min(26, e.radius * 1.15);
      e.def = Object.assign({}, e.def, { sprite: 'assets/sprites/enemy_prion.png', spriteIdle: 'assets/sprites/enemy_prion.png', spriteAttack: 'assets/sprites/enemy_prion.png' });
      count++;
      run.effects.spawnKillFx('ring', e.x, e.y, '#cfc6e6', Math.random() * 10);
    }
    if (count > 0) emit('toast', { message: `Prion mengkristalkan ${count} musuh!`, kind: 'danger' });
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

    // ---- Fase 17 (trigger 2A): XP per KILL — kecil 5–8, besar 12–15, boss 50 ----
    const killXp = xpForKill(enemy.def.tier, enemy.isBoss);
    this.addXP(killXp);
    run.effects.spawnLabel(enemy.x, enemy.y - enemy.radius - 22, `+${killXp} XP`, '#cde86b');

    // ---- Fase 17 (trigger 1A): IMU terkumpul +0.5/kill (chip HUD berdetak) ----
    run.imuAccrued += getRetention().imuReward.perKill;
    if (enemy.isBoss) {
      run.imuAccrued += getRetention().imuReward.perBoss - getRetention().imuReward.perKill;
      run.effects.spawnLabel(enemy.x, enemy.y - enemy.radius - 38, `+${getRetention().imuReward.perBoss} Imun`, '#ffd76a');
    }

    // EQUITY PER TIER: kecil jarang, MEDIUM sering (koin), HARD pasti koin x2 + nutrisi bonus
    if (!enemy.isBoss) {
      const tier = enemy.def.tier || 'medium';
      const coinDef = getData().nutrients.nutrients.find((n) => n.pickupType === 'currency');
      const dropCoin = (n) => {
        if (!coinDef) return;
        for (let ci = 0; ci < n; ci++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 18 + Math.random() * 26;
          run.pickups.push(new Pickup(coinDef, enemy.x + Math.cos(ang) * dist, enemy.y + Math.sin(ang) * dist));
        }
      };
      if (tier === 'kecil') {
        if (Math.random() < 0.15) dropCoin(1);
      } else if (tier === 'hard') {
        dropCoin(2); // HARD: equity pasti, dobel
        if (Math.random() < 0.6) {
          const bonusId = Math.random() < 0.5 ? 'vitamin_c' : 'amino';
          const bonusDef = getData().nutrients.nutrients.find((n) => n.id === bonusId);
          if (bonusDef) run.pickups.push(new Pickup(bonusDef, enemy.x + 14, enemy.y - 10));
        }
      } else {
        if (Math.random() < 0.45) dropCoin(1); // medium: sumber utama farm equity
      }
    }

    // ---- JUICE: combo counter + hit-stop + SFX kill ----
    run.combo.count += 1;
    run.combo.timer = getRetention().combo.window; // spek: 3+ kill dalam 5 detik
    if (run.combo.count >= 3) audio.combo(run.combo.count);
    if (run.combo.count > 0 && run.combo.count % 10 === 0) {
      this.addXP(10 + run.combo.count); // bonus XP milestone combo
      emit('toast', { message: `COMBO x${run.combo.count}! +${10 + run.combo.count} XP`, kind: 'gold' });
    }
    audio.kill();
    if (enemy.isBoss) this.hitStopRun(0.07);      // hit-stop 70ms boss
    else if (enemy.def.elite) this.hitStopRun(0.035); // 35ms elite
    const pfx = getRetention().particles;
    run.effects.spawnBurst(enemy.x, enemy.y, enemy.def.color, enemy.isBoss ? pfx.bossDeath : pfx.enemyDeath, enemy.isBoss ? 300 : 150, enemy.isBoss ? 6 : 4);

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
      if (run.chapterBoss === enemy) {
        // KAMPANYE: boss bab tumbang → ORGAN BERSIH → menang
        run.objective.bossDefeated = true;
        emit('toast', { message: `${enemy.bossName || 'Boss'} tumbang! Organ bersih!`, kind: 'gold' });
        this.winRun();
      } else {
        emit('toast', { message: tr(`Sel Kanker dikalahkan! +${enemy.xpPerKill} XP`), kind: 'gold' });
        this.openBossChest(enemy);
      }
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

    // Fase 9: Toksin hancur → meninggalkan genangan racun (area hazard)
    if (enemy.def.id === 'toksin' && !enemy.isBoss) {
      run.hazards.push({ x: enemy.x, y: enemy.y, r: Math.max(34, enemy.radius * 2.1), dps: 5, life: 9 });
    }

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
  /** MENANG: bab kampanye bersih / finalWave terlampaui — alur akhir run asli. */
  winRun() {
    const run = this.run;
    if (!run || run.ended) return;
    run.victory = true;
    if (run.chapter) run.bonusCurrency = (run.bonusCurrency || 0) + (run.chapter.reward || 0);
    audio.evolve(); // fanfare kemenangan
    this.finishRun(false);
  },

  finishRun(quit) {
    const run = this.run;
    if (!run || run.ended) return;
    run.ended = true;

    const meta = STATE.meta;
    const bonus = computeRunEndBonus(run);
    const doubleMult = (this.runFlags && this.runFlags.ganda) ? 1.5 : 1;
    // Fase 12 (spek pemilik): bonus akhir run floor(wave×8 + kills×0.5 + boss×50)
    const waveBonus = Math.floor((run.spawnSys ? run.spawnSys.wave : run.wave || 1) * 8 + run.kills * 0.5 + (run.bossKills || 0) * 50);
    const earned = Math.round((run.currencyEarned + (run.bonusCurrency || 0) + bonus + waveBonus) * doubleMult);
    run.earned = earned;
    const victory = !!run.victory;

    // Statistik permanen (wins → membuka mode Endless)
    if (victory) meta.stats.wins = (meta.stats.wins || 0) + 1;
    // KAMPANYE: bab bersih → tandai + pasukan imun permanen bertambah (+1/bab, maks 6)
    if (victory && run.chapter) {
      meta.campaignCleared = meta.campaignCleared || {};
      meta.campaignCleared[run.chapter.id] = true;
      const clearedCount = Object.keys(meta.campaignCleared).length;
      meta.allies = Math.min(6, Math.max(meta.allies || 1, 1 + clearedCount));
    }
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

    // FASE 14 — EKONOMI PREMIUM: hasil run mengalir ke Battle Pass & Imun Coin
    const bpRes = addBpXP(meta, run.level * 40 + run.spawnSys.wave * 15 + run.kills);
    run.bpGain = bpRes; // ringkasan akhir run
    // Fase 17 (trigger 1A) — spek dokumen: (wave×8) + (kills×0.5) + (boss×50)
    const imuFromRun = imuForRun(run.spawnSys.wave, run.kills, run.bossKills);
    if (imuFromRun > 0) {
      addImun(meta, imuFromRun);
      run.imuEarned = imuFromRun;
      emit('toast', { message: `+${imuFromRun} Imun Coin dari hasil run!`, kind: 'gold' });
    }

    // META-LAYER kondisi tubuh: racun, energi, pemulihan sistem fokus,
    // toxic seep, streak milestone — loop tertutup antar-run.
    this.lastBodyImpact = registerRunResult(meta, {
      kills: run.kills,
      wave: run.spawnSys.wave,
      focusId: run.focusId || 'seimbang',
      omegaCleanse: run.permBoost ? run.permBoost.omega : 0,
    });
    emit('bodyimpact', this.lastBodyImpact);

    // LEADERBOARD lokal per mode (top-10, wave → waktu → kill)
    const lbResult = recordLeaderboardEntry(meta, {
      modeId: (run.mode && run.mode.id) || 'normal',
      playerName: (meta.account && meta.account.username) || 'Tamu',
      faction: (meta.account && meta.account.faction) || 'imun',
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
      queueHeroNotice(h.id); // Fase 17: overlay "HERO BARU!" di dashboard
    }

    writeSave(meta); // AUTO-SAVE akhir run

    setPaused(false);
    setScreen('gameover');
    emit('gameover', {
      quit,
      victory,
      modeId: (run.mode && run.mode.id) || 'normal',
      chapterId: run.chapter ? run.chapter.id : null,
      chapterName: run.chapter ? run.chapter.organ : null,
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
      imuEarned: run.imuEarned || 0,
      bpFrom: run.bpGain ? run.bpGain.from : null,
      bpTo: run.bpGain ? run.bpGain.to : null,
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

    // ---- DUNIA PSEUDO-3D (Fase 12b): kamera miring, yang jauh lebih kecil ----
    const P = cam.makeProjector(w, h);
    cam.setPlayerScreen(P.project(player.x, player.y));
    drawArena3D(ctx, P, time);

    /** Billboard: sprite "berdiri" di ground — skala per-kedalaman, tanpa squash. */
    const billboard = (x, y, { lift = 0, flip = 1, tilt = 0 } = {}) => {
      const q = P.project(x, y);
      ctx.save();
      ctx.translate(q.x, q.y - lift * q.s);
      if (tilt) ctx.rotate(tilt);
      ctx.scale(q.s * flip, q.s);
      ctx.translate(-x, -y);
      return q;
    };
    /** Ground: bentukan di lantai — dimampetkan (kamera miring). */
    const ground = (x, y) => {
      const q = P.project(x, y);
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.scale(q.s, q.s * PERSP.YS);
      ctx.translate(-x, -y);
      return q;
    };
    const dropShadow = (x, y, r, alpha = 0.12) => {
      ground(x, y);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#0a3530';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r, 0, 0, Math.PI * 2); // squash Y via transform ground
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    // ===== LAPISAN TANAH =====
    // Genangan toksin (berdenyut)
    for (const hz of run.hazards) {
      ground(hz.x, hz.y);
      ctx.globalAlpha = 0.16 + 0.06 * Math.sin(run.time * 3 + hz.x);
      ctx.fillStyle = '#5aff5a';
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // Telegraph area attack musuh
    for (const e of run.enemies) {
      if (e.alive && e.def.areaAttack) {
        ground(e.x, e.y);
        drawTelegraph(ctx, e, e.def.areaAttack);
        ctx.restore();
      }
    }
    // Bayangan semua entitas (volume: badan "berdiri" di atas bayangan)
    for (const e of run.enemies) if (e.alive) dropShadow(e.x, e.y + e.radius * 0.92, e.radius * 0.85, e.stealth && !e.stealthExposed ? 0.05 : 0.13);
    for (const a of run.allies) dropShadow(a.x, a.y + a.radius * 0.9, a.radius * 0.8, 0.11);
    if (player.alive) {
      dropShadow(player.x, player.y + player.radius * 0.92, player.radius * 0.9, 0.16);
      // Ring tim ala MOBA di bawah hero (warna peran) + aura lembut
      ground(player.x, player.y + player.radius * 0.92);
      ctx.strokeStyle = run.heroDef.roleColor || run.heroDef.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(player.x, player.y, player.radius * 1.25, player.radius * 1.25, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Glow pickup = lingkaran lantai
    for (const p of run.pickups) {
      ground(p.x, p.y);
      drawPulseGlow(ctx, p.x, p.y, p.radius * 1.4, p.def.color, time, p.uid * 0.13, 0.7);
      ctx.restore();
    }

    // ===== LAPISAN BILLBOARD (diurutkan per kedalaman — painter's algorithm) =====
    const bobOf = { player: 0 };
    const pBob = player.moving ? Math.abs(Math.sin(player.walkPhase || 0)) * 3.4 : Math.sin(time * 2.1) * 1.1;
    const pLunge = player.attackFlash > 0 ? (player.attackFlash / 0.18) * 7 : (player.swing > 0 ? Math.sin((1 - player.swing / 0.22) * Math.PI) * 12 : 0);
    const pSwingTilt = player.swing > 0 ? Math.sin((1 - player.swing / 0.22) * Math.PI) * 0.3 : 0;
    const pBody = {
      x: player.x + (player.alive ? Math.cos(player.facing) * pLunge : 0),
      y: player.y + (player.alive ? Math.sin(player.facing) * pLunge * PERSP.YS : 0),
    };

    const draws = [];
    for (const p of run.pickups) {
      const fade = p.lifetime - p.age < 4 ? (Math.sin(time * 8) * 0.25 + 0.65) : 1;
      draws.push({ y: p.y, fn: () => {
        billboard(p.x, p.y, { lift: p.radius * 0.5 + Math.sin(time * 3 + p.uid) * 1.6 });
        drawSprite(ctx, p.def.sprite, p.x, p.y, p.radius * 2.4, 0, { alpha: fade });
        ctx.restore();
      } });
    }
    for (const e of run.enemies) {
      if (!e.alive) continue;
      draws.push({ y: e.y, fn: () => {
        const hidden = e.stealth && !e.stealthExposed;
        const bob = Math.abs(Math.sin(time * 6.4 + e.weavePhase * 7)) * 2.4;
        const flip = player.x < e.x ? -1 : 1;
        billboard(e.x, e.y, { lift: e.radius * 0.62 + bob, flip });
        if (hidden) ctx.globalAlpha = 0.14;
        const path = e.attackSpriteHint ? e.def.spriteAttack : e.def.spriteIdle;
        drawSprite(ctx, path, e.x, e.y, e.radius * 2.667, e.def.orientToMovement ? e.rotation : 0, {
          flash: e.hitFlash > 0 ? Math.min(1, e.hitFlash / 0.12) : 0,
        });
        ctx.globalAlpha = 1;
        // HP bar mini di atas kepala (tanpa bob — anchor stabil)
        ctx.restore();
        billboard(e.x, e.y, { lift: e.radius * 0.62 });
        drawHealthBar(ctx, e.x, e.y - e.radius - 10, Math.max(30, e.radius * 2), 5, e.hp / e.maxHP, e.isBoss ? '#ff5d73' : '#ffd93d');
        ctx.restore();
      } });
    }
    for (const a of run.allies) {
      draws.push({ y: a.y, fn: () => {
        billboard(a.x, a.y, { lift: a.radius * 0.55 });
        a.render(ctx);
        ctx.restore();
      } });
    }
    if (player.alive) {
      draws.push({ y: player.y, fn: () => {
        const blink = player.iframes > 0 && player.iframes < 900 && Math.floor(time * 12) % 2 === 0;
        if (!blink) {
          const skin = getEquippedSkin(STATE.meta, player.heroDef.id); // Fase 14: skin kosmetik
          let path = player.attackFlash > 0 ? player.heroDef.spriteAttack : player.heroDef.spriteIdle;
          const tilt = (player.moving ? Math.sin((player.walkPhase || 0) * 2) * 0.05 : 0) + pSwingTilt * (Math.cos(player.facing) < 0 ? -1 : 1);
          const flip = Math.cos(player.facing) < 0 ? -1 : 1;
          billboard(pBody.x, pBody.y, { lift: player.radius * 0.62 + pBob, flip, tilt });
          const auraAcc = STATE.meta.cosmetics?.aura
            ? getData().cosmetics.accs.find((a) => a.id === STATE.meta.cosmetics.aura) : null;
          drawPulseGlow(ctx, pBody.x, pBody.y, player.radius * 1.5, auraAcc ? auraAcc.color : player.heroDef.color, time, 0, 0.8);
          const bodySize = player.radius * 2.667 * (player.squash > 0 ? 1 + Math.sin(time * 48) * 0.06 : 1);
          const evo = run.evoStage;
          if (evo.stage >= 2) drawSprite(ctx, 'assets/sprites/ov_pseudopodia.png', pBody.x, pBody.y + bodySize * 0.34, bodySize * 0.62, 0, {});
          if (evo.stage >= 4) drawSprite(ctx, 'assets/sprites/ov_inti.png', pBody.x, pBody.y, bodySize * 1.5, time * 1.1, { alpha: 0.85 });
          if (skin) {
            const tinted = getTintedSprite(path, skin.color);
            const scale = bodySize / Math.max(tinted.width, tinted.height);
            ctx.drawImage(tinted, pBody.x - (tinted.width * scale) / 2, pBody.y - (tinted.height * scale) / 2, tinted.width * scale, tinted.height * scale);
          } else {
            drawSprite(ctx, path, pBody.x, pBody.y, bodySize, 0, {});
          }
          // Aksesori MAHKOTA (kosmetik, Pilar 3: visual-only)
          const crownAcc = STATE.meta.cosmetics?.crown
            ? getData().cosmetics.accs.find((a) => a.id === STATE.meta.cosmetics.crown) : null;
          if (crownAcc) {
            const cy = pBody.y - bodySize * 0.62 + Math.sin(time * 2.4) * 1.5;
            const cw = bodySize * 0.3, ch = bodySize * 0.14;
            ctx.fillStyle = crownAcc.color;
            ctx.strokeStyle = 'rgba(122,73,4,0.8)';
            ctx.lineWidth = Math.max(1, bodySize * 0.012);
            ctx.beginPath();
            ctx.moveTo(pBody.x - cw / 2, cy + ch / 2);
            ctx.lineTo(pBody.x - cw / 2, cy - ch / 2);
            ctx.lineTo(pBody.x - cw / 6, cy - ch * 0.1);
            ctx.lineTo(pBody.x, cy - ch * 0.75);
            ctx.lineTo(pBody.x + cw / 6, cy - ch * 0.1);
            ctx.lineTo(pBody.x + cw / 2, cy - ch / 2);
            ctx.lineTo(pBody.x + cw / 2, cy + ch / 2);
            ctx.closePath(); ctx.fill(); ctx.stroke();
          }
          if (evo.stage >= 1) drawSprite(ctx, 'assets/sprites/ov_silia.png', pBody.x, pBody.y - bodySize * 0.3, bodySize * 0.6, Math.sin(time * 2.2) * 0.08, {});
          if (evo.stage >= 3) drawSprite(ctx, 'assets/sprites/ov_pedang.png', pBody.x + bodySize * 0.3, pBody.y - bodySize * 0.04, bodySize * 0.78, 0.5 + Math.sin(time * 2.6) * 0.05, {});
          ctx.restore();

          // NAMEPLATE ala MOBA: nama hero + level di atas kepala
          billboard(player.x, player.y, { lift: player.radius * 0.62 });
          const nw = 86, nh = 16, nx = player.x - nw / 2, ny = player.y - player.radius - 30;
          ctx.fillStyle = 'rgba(2,8,14,0.58)';
          ctx.strokeStyle = player.heroDef.color;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(nx, ny, nw, nh, 8);
          else ctx.rect(nx, ny, nw, nh);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '900 9.5px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${player.heroDef.name} · Lv ${run.level}`, player.x, ny + nh / 2 + 0.5);
          ctx.restore();

          // Indikator arah aim (chevron) — sudut dunia sudah dikompensasi squash
          const aim = this.input.getAimInfo(cam.getPlayerScreen()?.x ?? w / 2, cam.getPlayerScreen()?.y ?? h / 2);
          if (aim.active) {
            const wa = Math.atan2(Math.sin(aim.angle) / PERSP.YS, Math.cos(aim.angle));
            billboard(player.x, player.y, { lift: player.radius * 0.62 });
            ctx.save();
            ctx.translate(player.x + Math.cos(wa) * (player.radius + 22), player.y + Math.sin(wa) * (player.radius + 22) * PERSP.YS);
            ctx.rotate(wa);
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.moveTo(7, 0); ctx.lineTo(-5, 6); ctx.lineTo(-2, 0); ctx.lineTo(-5, -6);
            ctx.closePath();
            ctx.fillStyle = run.heroDef.color;
            ctx.fill();
            ctx.restore();
            ctx.restore();
          }
        }
      } });
    }
    for (const pr of run.projectiles) {
      if (pr.alive) draws.push({ y: pr.y, fn: () => {
        billboard(pr.x, pr.y, { lift: 6 });
        drawProjectile(ctx, pr, time);
        ctx.restore();
      } });
    }
    draws.sort((A, B) => A.y - B.y);
    for (const d of draws) d.fn();

    // ===== LAPISAN EFEK (billboard ringan, mengikuti kedalaman) =====
    const drawImageAt = (path, x, y, size, rotation = 0, opts = {}) => drawSprite(ctx, path, x, y, size, rotation, opts);
    for (const fx of run.effects.effects) {
      billboard(fx.x, fx.y, { lift: 4 });
      if (fx.type === 'swipe') drawSwipeArc(ctx, fx);
      else if (fx.type === 'blast') drawBlastRing(ctx, fx);
      else if (fx.type === 'spark') drawHitSpark(ctx, fx, drawImageAt);
      else if (fx.type === 'killfx') drawKillFx(ctx, fx, time);
      ctx.restore();
    }
    for (const pt of run.effects.particles) {
      billboard(pt.x, pt.y, { lift: 2 });
      drawParticle(ctx, pt);
      ctx.restore();
    }
    for (const n of run.effects.numbers) {
      billboard(n.x, n.y, { lift: 10 });
      drawDamageNumber(ctx, n, time);
      ctx.restore();
    }

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
        abilities: run.skills.getView(),
        combo: run.combo,
        mission: run.objective
          ? { quota: run.objective.quota, kills: run.kills, bossSpawned: run.objective.bossSpawned, bossName: run.chapter && run.chapter.boss ? run.chapter.boss.name : null }
          : null,
        timerText: this.formatTime(run.time),
        kills: run.kills,
        currency: run.currencyEarned,
        imu: Math.floor(run.imuAccrued || 0),
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
