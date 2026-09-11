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
import { hidePresenter } from '../ui/presenter.js';
import {
  getData, getHero, getEnemyDef, getNutrientDef, getWaveConfig,
  xpToNextLevel,
} from './data-store.js';
import { emit } from './ui-bridge.js';
import { getTintedSprite } from '../render/sprite-loader.js';
import { t as tr } from '../systems/i18n.js';
import { writeSave } from '../save/save-manager.js';
import { markSeen } from '../systems/codex-system.js';
import { applyRunGP } from '../systems/rank-system.js';
import { addMasteryXP } from '../systems/mastery-system.js'; // V2 Phase 6
import { bossBark, resetNarrativeRun } from '../systems/narrative-system.js'; // R2: barks RIA
import { initAntigenRun, onAntigenKill, antigenDamageMult, antigenIgnoreArmor, recordAntigenMeta } from '../systems/antigen-memory.js'; // R3: Modul A
import { phagoUpdateEnemy, tryDevour } from '../systems/phagocytosis.js'; // R4: Modul B
import { inflamUpdate, inflamHeat, inflamColor } from '../systems/inflammation.js'; // R5: Modul C
import { tagOnHit, cascadeOnDeath } from '../systems/tag-cascade.js'; // R6: Modul D
import { chemoUpdate } from '../systems/chemotaxis.js'; // R7: Modul E
import { SkillSystem } from '../systems/skill-system.js';

import { Player } from '../entities/player.js';
import { Enemy } from '../entities/enemy.js';
import { Projectile } from '../entities/projectile.js';
import { Pickup } from '../entities/pickup.js';

import { SpawnSystem } from '../systems/spawn-system.js';
import { CollisionSystem } from '../systems/collision-system.js';
import { rollLevelUpChoices, applyLevelUp, squadMultipliers, evolutionBoosts, effectiveStacks } from '../systems/upgrade-system.js';
import { computeRunEndBonus, addCurrency } from '../systems/economy-system.js';
import { checkMissions } from '../systems/mission-system.js';
import { addBpXP } from '../systems/battlepass-system.js';
import { addImun, getEquippedSkin } from '../systems/imun-economy.js';
import { xpForKill, comboXpMult, applyGlobalUpgrades, queueHeroNotice, getRetention, synergyFor } from '../systems/retention-system.js'; // synergyFor: V2 Phase 4
import { getProgressionBand, getProgression, getGameFeel, getCombat, getModules } from './data-store.js';
import { buzz } from '../systems/haptics.js'; // V2 Phase 1: getaran mobile
import {
  passiveCritBonus, modifyOutgoingDamage, passiveOnHit,
  passiveOnKill, passiveOnPlayerHit, passiveTick, passiveSkillCdMult,
} from '../systems/passive-system.js'; // V2 Phase 3: identitas hero
import { checkAutoUnlocks } from '../systems/unlock-system.js';
import { EffectsSystem } from '../systems/effects-system.js';
import {
  triggerRewardedAdRevive, triggerRewardedAdBossChest, canWatchAd, trackAdWatch,
} from '../systems/monetization.js';
import { AbilitySystem } from '../systems/ability-system.js';
import { isSkillUnlocked, canUpgradeSkill, skillUpgradeCost, SKILL_UNLOCK_LEVELS, SKILL_UPGRADE_LEVEL } from '../systems/skill-unlock.js';
import { getEvoStageDef, rollPartDrop } from '../systems/evolution-system.js';
import { arenaUnlockStatus } from '../ui/screens/arena-screen.js';
import {
  applyDailyDecay, getBodyState, getBodyRunModifiers, registerRunResult,
} from '../systems/body-system.js';
import * as tutorial from '../systems/tutorial-system.js';
import { audio } from '../systems/audio-system.js';
import { Ally } from '../entities/ally.js';
import { getTodayMutator, mergeMutatorMods, recordLeaderboardEntry } from '../systems/liveops-system.js';

import { Camera, PERSP, ZONE_ZOOM } from '../render/camera.js';
import { drawBackground, drawArena3D, setArenaPalette } from '../render/background.js';
import { drawNestHint,
  drawProjectile, drawParticle, drawPulseGlow, drawHealthBar, drawSwipeArc,
  drawBlastRing, drawTelegraph, drawJoystick, drawMinimap, drawDamageNumber, drawHitSpark,
  drawImpactPulse, drawAbilityCharge, drawAbilityPayoff, drawKillFx,
} from '../render/shape-renderer.js';
import { drawSprite } from '../render/sprite-loader.js';
import { drawHeroEquity, drawPathogenMutation, pathogenVisualTier } from '../render/character-visuals.js';
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
    console.info(`[MAP] run arena=${arena.id} mode=${STATE.meta.selectedMode || 'normal'} render=50a`);

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
      ebullets: [],
      pickups: [],
      hazards: [], // Fase 9: genangan toksin (area damage statis)
      pendingBlasts: [], // V2 Phase 5: ledakan tertunda elite VOLATILE (fuse→blast)
      inflamZones: [], // R5 Modul C: zona inflamasi (DoT lantai → cytokine storm)
      cascadeTimes: [], // R6 Modul D: throttle cascade bersamaan (doc §5.5)
      chemoTrail: [], // R7 Modul E: TrailSegment jejak sinyal (kemotaksis)
      chemoActiveT: 0, // sisa jendela emisi jejak setelah cast skill gerak
      chemoEmitT: 0,
      chemoSpeedMult: 1, // pengali speed saat menyentuh jejak matang
      chemoStat: null,
      nftMoveFired: false, // R3 Task 4: penanda "gerakan pertama" per run
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
      luPity: 0,
      phagoMeter: 0, // R4 Modul B: fuel ultimate dari telan      // V2 Phase 4: counter pity roll rare+
      evoTaken: {},   // V2 Phase 4: evolusi senjata yang sudah diambil run ini
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
      // V2 Phase 3: passive tcd4 "Komando Sitokin" memangkas cooldown skill
      skills: new SkillSystem(heroDef, { cdMult: (squadMultipliers(meta).jurusCd || 1) * passiveSkillCdMult(heroDef) }),
      // lapisan pertahanan Fase 12: shield → protect → evade
      shield: 0, evadeCharges: 0, protectMult: 1, protectT: 0,
      parts: { equity_receptor: 0, equity_membrane: 0, equity_effector: 0, equity_memory_core: 0 },
      partsCollectedTotal: 0,
      bossChest: null,
      combo: { count: 0, timer: 0 },
      imuAccrued: 0, // Fase 17: IMU terkumpul live di HUD (akhir run = rumus penuh)
      hitStop: 0,
      ended: false,
      stats: { shotsFired: 0 },
    };

    this.run.spawnSys.mods = bodyMods; // mutator/condisi tubuh → spawn & HP musuh
    // PASUKAN IMUN (unlock di dalam run seperti SLOT SKILL — permintaan user):
    // Tidak ada pasukan di awal game; 1 sel bergabung tiap hero mencapai level
    // unlock skill (3/5/10) + Lv 15 (slot ke-4). Jumlah total tetap mengikuti
    // meta.allies + allyLevel (Fase 20); yang berubah hanya WAKTU bergabung.
    this.run.allies = [];
    {
      const membersPerLv = getData().upgrades.allyUpgrade.membersPerLevels || 3;
      const allyByLevel = 1 + Math.floor((meta.allyLevel || 0) / membersPerLv);
      const total = Math.max(0, Math.min(6, Math.max(meta.allies || 0, allyByLevel)));
      const allySpeedBonus = (meta.allyLevel || 0) * (getData().upgrades.allyUpgrade.speedPerLevel || 0);
      this.run.squadPlan = {
        total,
        joined: 0,
        speedBonus: allySpeedBonus,
        unlockLevels: [...SKILL_UNLOCK_LEVELS, SKILL_UPGRADE_LEVEL], // [3, 5, 10, 15]
      };
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
      this.spawnEnemy('bakteri', false, { nest: true });
      const ge = this.run.enemies[this.run.enemies.length - 1];
      if (ge) {
        ge.x = player.x + Math.cos(ga) * 250;
        ge.y = player.y + Math.sin(ga) * 250;
        ge.setNest(ge.x, ge.y, null); // F26: jaga posisinya; mengejar bila player dekat
      }
    }
    this.run.camera.reset(player.x, player.y);
    this.run.collision.rebuildEnemyGrid(this.run.enemies);

    setScreen('gameplay');
    setPaused(false);
    setLevelUpOpen(false);
    resetNarrativeRun(); // R2: bark boss boleh tampil lagi di run baru
    initAntigenRun(this.run); // R3 Modul A: memori antigen reset tiap run
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
   * MAP: target epic zoom kamera dari zona (dipanggil tiap frame).
   * Boss hidup dalam jangkauan → zoom BOSS; player di dalam genangan
   * toksin / zona inflamasi → zoom DANGER; selain itu normal (1).
   * Murah: loop musuh + zona hanya saat run berjalan (hypot per entitas).
   */
  computeZoneZoomTarget(run, player) {
    for (const e of run.enemies) {
      if (!e.isBoss || !e.alive) continue;
      if (Math.hypot(e.x - player.x, e.y - player.y) < ZONE_ZOOM.BOSS_RANGE) return ZONE_ZOOM.BOSS;
    }
    for (const hz of run.hazards) {
      if (Math.hypot(hz.x - player.x, hz.y - player.y) < (hz.r || 40) + ZONE_ZOOM.DANGER_PAD) return ZONE_ZOOM.DANGER;
    }
    for (const z of run.inflamZones || []) {
      if (Math.hypot(z.x - player.x, z.y - player.y) < (z.radius || 90) + ZONE_ZOOM.DANGER_PAD) return ZONE_ZOOM.DANGER;
    }
    return 1;
  },

  /**
   * Definisi arena run (dipilih di dashboard). Arena terkunci tidak bisa
   * dipakai walau tersimpan di save — fallback ke arena terbuka pertama.
   */
  getRunArena() {
    const meta = STATE.meta;
    const list = getData().arenas.arenas;
    // MAP: pilihan pemain (prep/arena-screen) MENANG bila terbuka — di SEMUA
    // mode termasuk kampanye. selectedArena menentukan environment render.
    const chosen = list.find((a) => a.id === meta.selectedArena);
    if (chosen && arenaUnlockStatus(chosen, meta).unlocked) return chosen;
    // Kampanye: organ bab menentukan arena (DEFAULT bila pilihan terkunci /
    // tak dikenal; prep-screen me-default-kan picker ke organ bab).
    if (meta.selectedMode === 'kampanye' && getData().campaign) {
      const ch = getData().campaign.chapters.find((c) => c.id === meta.selectedChapter) || getData().campaign.chapters[0];
      const chArena = list.find((a) => a.id === ch.arenaId);
      if (chArena) return chArena;
    }
    const fallback = list.find((a) => arenaUnlockStatus(a, meta).unlocked);
    if (chosen || !fallback) {
      meta.selectedArena = (fallback || list[0]).id;
    }
    return fallback || list[0];
  },

  computePlayerStats(heroDef, runUpgrades) {
    const base = heroDef.baseStats;
    const squad = squadMultipliers(STATE.meta);
    // Fase 20: TIER HERO SEJAK AWAL (common–legend, TIDAK berubah oleh upgrade).
    // Tier lebih tinggi = basis lebih kuat (data/heroes.json → tiers.statMult).
    const tierCfg = (getData().heroes.tiers || {})[heroDef.tier];
    const tierMult = tierCfg ? tierCfg.statMult : 1;
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

    // V2 Phase 4: SINERGI ROLE NYATA — stack upgrade yang cocok role hero
    // dihitung ×1.25 (luRules.synergyBonus); badge "✦ Sinergi" jadi jujur.
    const syn = synergyFor(heroDef);
    const eff = (id) => effectiveStacks({ upgrades: up, heroDef }, id, syn);
    // V2 Phase 4: EVOLUSI SENJATA in-run (Badai Sitokin / Benteng / Kawanan).
    // Guard: saat run BARU di-init, this.run masih run lama — evoTaken lama
    // tidak boleh bocor; pakai this.run hanya bila upgrades-nya objek yang sama.
    const evoB = evolutionBoosts(this.run && this.run.upgrades === up ? this.run : null);

    const damage = base.damage * tierMult * squad.damage * squad.weapon * (1 + eff('damage') * 0.15) * serum * (1 + heroCfg.dmgPerLevel * heroLvl) * buffDamage * evoB.damageMult;
    const cooldown = base.attackCooldown / ((1 + eff('attackSpeed') * 0.12) * squad.attackSpeed) * buffCooldown * evoB.cooldownMult;
    const speed = base.speed * squad.speed * (1 + eff('moveSpeed') * 0.08) * (tb ? tb.speed.mult : 1);
    const attackRange = base.attackRange * squad.attackRange * (1 + eff('attackRange') * 0.12);
    const swipeRadius = (base.swipeRadius || 0) * squad.attackRange * (1 + eff('attackRange') * 0.12);
    const maxHP = Math.round((base.maxHP * tierMult * squad.maxHP * (1 + heroCfg.hpPerLevel * heroLvl) + eff('maxHP') * 20 + (perm.maxHP || 0)) * evoB.maxHPMult);
    const projectileCount = base.projectileCount + (up.projectileCount || 0) + evoB.projectileFlat;
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
      // V2 Phase 4: entri pool baru — pierce (rare) & magnet (common)
      pierce: base.pierce + (up.pierce || 0),
      projectileSpeed: base.projectileSpeed,
      magnetRadius: base.magnetRadius * (1 + (up.magnet || 0) * 0.25),
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

    // V2 Phase 1: LOW-HP heartbeat — HP < threshold → detak jantung berkala
    {
      const lowHp = getGameFeel().lowHp;
      const p = run.player;
      if (p.alive && p.hp / p.maxHP < lowHp.threshold) {
        run.heartbeatT = (run.heartbeatT ?? 0) - dt;
        if (run.heartbeatT <= 0) {
          run.heartbeatT = lowHp.heartbeatSec;
          audio.heartbeat();
        }
      } else {
        run.heartbeatT = 0;
      }
    }

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

    // R5 Modul C: zona inflamasi — DoT musuh + cytokine storm (risk hero)
    inflamUpdate(this, dt);

    // R7 Modul E: jejak kemotaksis — emisi + cleanup + buff overlap
    chemoUpdate(this, dt);

    // V2 Phase 5 — elite VOLATILE: ledakan bangkai setelah fuse (dodgeable)
    for (let i = run.pendingBlasts.length - 1; i >= 0; i--) {
      const b = run.pendingBlasts[i];
      b.t -= dt;
      if (b.t > 0) continue;
      run.pendingBlasts.splice(i, 1);
      run.effects.spawnBlast(b.x, b.y, b.radius, b.color);
      run.camera.addShake(0.2);
      if (player.alive && player.iframes <= 0 &&
          Math.hypot(player.x - b.x, player.y - b.y) < b.radius + player.radius) {
        this.damagePlayer(b.damage);
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

    // V2 Phase 3 — PASSIVE HERO per-frame: regen (treg), aura slow (baso),
    // reveal pulse (nkcell — fix bug V1: dulu cek id 'sel_nk' yang tak pernah ada)
    passiveTick(run, dt);
    // V2 Phase 3: mark meluruh (dipasang skill mark_target / passive dendritic)
    for (const e of run.enemies) {
      if (e.markT > 0) {
        e.markT -= dt;
        if (e.markT <= 0) e.markMult = 1;
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
        const barkText = bossBark(run.chapter.id); // R2: RIA berkomentar — non-blocking, 1×/run
        if (barkText) emit('bossBark', { chapterId: run.chapter.id, text: barkText }); // R3: lapisan VO
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

    // R3 (Narrative-Cinematic) Task 4: HOOK "gerakan pertama" — observasi
    // ONLY (tidak menyentuh logic combat/wave). Emit 1× per run; main.js
    // mengecek penanda meta.nft.move (sekali sejak pernah) lalu memutar
    // VO + presenter RIA (non-blocking).
    if (!run.nftMoveFired && (move.x !== 0 || move.y !== 0)) {
      run.nftMoveFired = true;
      emit('nftMove', {});
    }

    // 2. Wave & spawn
    const events = run.spawnSys.update(dt, this);
    if (events.waveBreak) {
      emit('waveBreak', { wave: run.spawnSys.wave });
    }
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
      // Endless: bonus antibodi tiap 5 wave (× band reward — Fase 18)
      if (run.mode && run.mode.id === 'endless' && w % 5 === 0) {
        const bonus = Math.round(w * 5 * getProgressionBand(w).rewardMult);
        run.bonusCurrency += bonus;
        addCurrency(meta, bonus);
        emit('toast', { message: `Endless wave ${w}! +${bonus} antibodi`, kind: 'gold' });
      }
      run.wave = run.spawnSys.wave;
    }

    if (events.bossSpawn) {
      emit('wave', { wave: run.spawnSys.wave, isBoss: true });
      run.camera.addShake(0.7);
      buzz('boss'); // V2 Phase 1: kehadiran boss terasa fisik
    }

    // 3. Update musuh (behavior + boss AOE)
    for (const e of run.enemies) {
      if (e.alive) {
        e.update(dt, player, run.time, this);
        phagoUpdateEnemy(e, dt); // R4 Modul B: window telan <20% HP
      }
    }

    // 4. Bangun ulang spatial grid dari posisi musuh terkini
    run.collision.rebuildEnemyGrid(run.enemies);

    // 5. Update proyektil (homing butuh grid utk cari target)
    for (const p of run.projectiles) p.update(dt, this);

    // 5b. Peluru musuh (patogen bersenjata): terbang & tabrak player
    this.updateEnemyBullets(dt);

    // 6. Kollision proyektil vs musuh
    run.collision.handleProjectileHits(run.projectiles, (proj, enemy) => {
      // Eosinofil: granula toksik 1,5x damage ke Parasit (dokumen entitas, nyata)
      let dmg = (proj.antiParasitMult && enemy.def && enemy.def.id === 'parasit')
        ? proj.damage * proj.antiParasitMult
        : proj.damage;
      // V2 Phase 1: critical hit (chance & mult dari data/gamefeel.json)
      const crit = this.rollCrit();
      if (crit) dmg *= getGameFeel().crit.mult;
      // V2 Phase 3: mark (+10% bila ditandai) + execute (tcd8) — lalu passive on-hit
      dmg = modifyOutgoingDamage(run, enemy, dmg);
      // R3 Modul A: memori antigen — bonus damage per tipe + T2 tembus armor
      dmg *= antigenDamageMult(run, enemy);
      enemy.lastHitDamage = dmg;
      const died = antigenIgnoreArmor(run, enemy) ? enemy.takeDamageRaw(dmg) : enemy.takeDamage(dmg);
      this.provokeEnemy(enemy); // RONDE-4: yang kena peluru langsung membalas
      if (!enemy.lastHitAbsorbed) passiveOnHit(run, enemy, dmg);
      if (enemy.lastHitAbsorbed) run.effects.spawnLabel(enemy.x, enemy.y - enemy.radius - 6, tr('TERLAPIS!'), '#cfd8e3');
      // V2 Phase 1: knockback mikro searah proyektil (boss imun)
      this.applyHitKnockback(enemy, proj.vx, proj.vy, getGameFeel().knockback.projectile);
      this.spawnHitFeedback(enemy, enemy.lastHitAbsorbed ? 0 : dmg, died, crit, {
        dirX: proj.vx,
        dirY: proj.vy,
        sourceKind: 'projectile',
      });
      if (!enemy.lastHitAbsorbed) this.onDamageDealt(dmg);
      if (died) this.onEnemyKilled(enemy, proj);
      else audio.hit();
      return died;
    });

    // 7. Separation antar musuh (anti menumpuk)
    run.collision.separateEnemies(run.enemies);

    // 8. Kollision player vs musuh (contact damage)
    // V2 Phase 2: musuh pengejar menyerang lewat WINDUP→STRIKE (enemy.js →
    // enemyContactStrike). Contact instan hanya untuk hazard (toksin/prion —
    // identitas "jangan disentuh") dan boss (punya telegraph AOE sendiri).
    if (player.alive && player.iframes <= 0) {
      const hit = run.collision.checkPlayerCollision(player, (e) => !e.usesContactTelegraph);
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
      this.provokeEnemy(e); // RONDE-4
      if (died) this.onEnemyKilled(e, null);
      if (e.dotT <= 0) e.dotMult = 0;
    }
    run.effects.update(dt);

    // 11. Kamera THIRD-PERSON feel (gaya Raft/Subnautica dipetakan ke 2D):
    // - follow ke arah pandang (look-ahead ke arah gerak; heading terlambat → drift saat belok)
    // - anchor player 62% tinggi layar (kamera "di belakang & sedikit di atas")
    // - zoom dinamis kecepatan: cepat = menjauh, diam = mendekat
    const spd = Math.hypot(player.vx || 0, player.vy || 0);
    const maxSpd = player.maxSpeed || player.speed || 220;
    const spd01 = Math.max(0, Math.min(1, spd / (maxSpd + 1e-6)));
    const lookX = spd > 4 ? (player.vx / (spd || 1)) : 0;
    const lookY = spd > 4 ? (player.vy / (spd || 1)) : 0;
    run.camera.follow(player.x, player.y, dt, false, lookX, lookY);
    run.camera.setSpeedZoom(spd01);
    run.camera.update(dt);
    // 11b. MAP: epic zoom zona — boss dekat / berdiri di zona bahaya
    run.camera.setZoneZoom(this.computeZoneZoomTarget(run, player));

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
    // Fase 18: kurva XP per band — early 1.6× (cepat naik), late 0.85× (berat)
    const bandXp = getProgressionBand(run.spawnSys ? run.spawnSys.wave : 1).xpMult;
    // Fase 17 (trigger 2D): combo ≥3 kill/5 detik → XP ×1.2 (dopamine loop)
    const gained = baseAmount * run.player.stats.xpMult * comboXpMult(run.combo.count) * bandXp;
    run.xpGained += gained;
    // Fase 18: GERBANG TERTUTUP (penjaga masih hidup) → XP DITAHAN di bank,
    // tanpa progres level (spesifikasi: naik-level berhenti sampai boss tumbang)
    if (run.spawnSys && run.spawnSys.isGateBlocked()) {
      run.xpBank = (run.xpBank || 0) + gained;
      return;
    }
    this.applyXpGain(gained);
  },

  /** Terapkan XP mentah ke progres level (tax xpBankRatio = 1 → cair penuh). */
  applyXpGain(gained) {
    const run = this.run;
    run.xp += gained;
    while (run.xp >= xpToNextLevel(run.level)) {
      run.xp -= xpToNextLevel(run.level);
      run.level += 1;
      run.levelUpQueue += 1;
      this.tryJoinSquad(run.level);
    }
  },

  /**
   * Pasukan imun bergabung di level unlock skill [3, 5, 10] (+15) — satu sel
   * per ambang, sampai total skuad meta tercapai. Tidak ada pasukan di awal
   * run (permintaan user): mereka "dipanggil" saat hero semakin kuat.
   */
  tryJoinSquad(level) {
    const run = this.run;
    const plan = run && run.squadPlan;
    if (!plan || plan.joined >= plan.total) return false;
    const slotIdx = plan.unlockLevels.indexOf(level);
    if (slotIdx < 0 || slotIdx !== plan.joined) return false;
    const ally = new Ally(plan.joined, run.player, plan.speedBonus);
    plan.joined += 1;
    run.allies.push(ally);
    // Selebrasi kecil yang jelas: burst hijau-imun + label + toast
    run.effects.spawnBurst(run.player.x, run.player.y, '#6cf2c3', 14, 220, 4);
    run.effects.spawnLabel(run.player.x, run.player.y - 44, tr('PASUKAN DATANG!'), '#8df7d2');
    emit('toast', { message: `Pasukan imun: sel #${plan.joined} bergabung bertarung!`, kind: 'gold' });
    return true;
  },

  /** Fase 18: cairkan XP yang ditahan saat gerbang tertutup (dipanggil saat boss tumbang). */
  flushXpBank() {
    const run = this.run;
    const banked = run.xpBank || 0;
    if (banked <= 0) return 0;
    run.xpBank = 0;
    const prog = getProgression().gatekeeper || {};
    const ratio = typeof prog.xpBankRatio === 'number' ? prog.xpBankRatio : 1;
    this.applyXpGain(banked * ratio);
    emit('toast', { message: `+${Math.round(banked * ratio * 10) / 10} XP ${tr('XP DITAHAN CAIR')}`, kind: 'gold' });
    return banked * ratio;
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
    hidePresenter(); // RONDE-4: narrator jangan menumpuk modal pilih-evolusi
    setPaused(true);
    audio.levelup();
    buzz('levelup'); // V2 Phase 1: selebrasi terasa di tangan
    emit('levelup', { level: run.level, choices: run.currentChoices });
  },

  /** Dipanggil dari modal level-up saat pemain memilih satu upgrade. */
  chooseLevelUp(upgradeId) {
    const run = this.run;
    if (!run || !run.currentChoices) return;
    const result = applyLevelUp(run, upgradeId);
    this.recomputePlayerStats();
    if (result.healAmount > 0) run.player.heal(result.healAmount);
    // V2 Phase 4: EVOLUSI SENJATA diambil → selebrasi besar (momen memorable)
    if (result.evolved) {
      showAnnounce(result.evolved.name.toUpperCase() + '!', true);
      run.effects.spawnBurst(run.player.x, run.player.y, '#c39bd3', 40, 280, 5);
      run.camera.addShake(0.5);
      this.hitStopRun(getGameFeel().hitStop.ult);
      audio.evolve();
      buzz('levelup');
      emit('toast', { message: `EVOLUSI: ${result.evolved.name}!`, kind: 'gold' });
    }

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
      // V2 Phase 1: crit roll + knockback melee (lebih kuat dari proyektil)
      const crit = this.rollCrit();
      let dmg = crit ? damage * getGameFeel().crit.mult : damage;
      dmg = modifyOutgoingDamage(run, e, dmg); // V2 Phase 3: mark + execute
      dmg *= antigenDamageMult(run, e); // R3 Modul A
      e.lastHitDamage = dmg;
      const died = antigenIgnoreArmor(run, e) ? e.takeDamageRaw(dmg) : e.takeDamage(dmg);
      if (!e.lastHitAbsorbed) passiveOnHit(run, e, dmg);
      if (e.lastHitAbsorbed) run.effects.spawnLabel(e.x, e.y - e.radius - 6, tr('TERLAPIS!'), '#cfd8e3');
      this.applyHitKnockback(e, dx, dy, getGameFeel().knockback.melee);
      this.spawnHitFeedback(e, e.lastHitAbsorbed ? 0 : dmg, died, crit, {
        dirX: dx,
        dirY: dy,
        sourceKind: 'melee',
      });
      if (!e.lastHitAbsorbed) this.onDamageDealt(dmg);
      if (died) this.onEnemyKilled(e, null);
    });
  },

  /** V2 Phase 1: roll critical hit global (data/gamefeel.json crit.chance). */
  rollCrit() {
    const cfg = getGameFeel().crit;
    // V2 Phase 3: passive bcell + V2 Phase 4: upgrade "Titik Lemah" (+4%/stack)
    const upBonus = ((this.run.upgrades && this.run.upgrades.critChance) || 0) * 0.04;
    const chance = this.run.critChanceOverride ?? (cfg.chance + passiveCritBonus(this.run) + upBonus);
    return Math.random() < chance;
  },

  /**
   * V2 Phase 1: knockback mikro — dorong musuh searah datangnya hit.
   * Memakai e.vx/vy yang sudah punya decay friksi di enemy.update.
   * Boss imun (gamefeel.knockback.bossImmune) agar fight tetap terbaca.
   */
  applyHitKnockback(enemy, dirX, dirY, force) {
    if (!enemy.alive) return;
    if (enemy.isBoss && getGameFeel().knockback.bossImmune) return;
    const len = Math.hypot(dirX, dirY);
    if (len < 0.001) return;
    enemy.vx += (dirX / len) * force;
    enemy.vy += (dirY / len) * force;
  },

  /** Metadata visual Character untuk impact hit; visual-only, bukan balance. */
  characterHitVisual(enemy, opts = {}) {
    const run = this.run;
    const heroDef = run?.heroDef || run?.player?.heroDef || null;
    const designs = getData().characterDesigns;
    const heroDesign = heroDef ? designs?.heroes?.[heroDef.id] : null;
    const stageRaw = run?.evoStage?.stage ?? STATE.meta?.evoStage ?? 0;
    const stage = Math.max(0, Math.min(4, stageRaw || 0));
    const eq = stage > 0 ? (heroDesign?.equity || []).find((e) => e.stage === stage) : null;
    const dirX = Number.isFinite(opts.dirX) ? opts.dirX : ((enemy && run?.player) ? enemy.x - run.player.x : 1);
    const dirY = Number.isFinite(opts.dirY) ? opts.dirY : ((enemy && run?.player) ? enemy.y - run.player.y : 0);
    const fallbackAngle = Math.abs(dirX) + Math.abs(dirY) > 0.001 ? Math.atan2(dirY, dirX) : 0;
    return {
      heroId: heroDef?.id || '',
      archetype: heroDesign?.archetype || 'generic',
      heroColor: heroDef?.color || enemy?.def?.color || '#35d0ba',
      equityColor: eq?.color || run?.evoStage?.tierColor || heroDef?.color || '#35d0ba',
      equityStage: stage,
      hitAngle: Number.isFinite(opts.hitAngle) ? opts.hitAngle : (Number.isFinite(opts.angle) ? opts.angle : fallbackAngle),
      sourceKind: opts.sourceKind || 'hit',
      targetRadius: enemy?.radius || 18,
    };
  },

  /**
   * Feedback visual per hit: flash sprite + spark + impact pulse + angka.
   * Kill tetap punya death-pop sendiri; hit biasa kini dapat micro-shake
   * ter-throttle supaya landing terasa tanpa membuat kamera mual di wave padat.
   */
  spawnHitFeedback(enemy, damage, died, crit = false, opts = {}) {
    if (crit && typeof crit === 'object') { opts = crit; crit = !!opts.crit; }
    const run = this.run;
    const gf = getGameFeel();
    tagOnHit(enemy); // R6 Modul D: setiap hit hero menandai musuh (opsonisasi)
    const absorbed = !!enemy.lastHitAbsorbed;
    const hitVisual = this.characterHitVisual(enemy, opts);
    if (crit && enemy.hitFlash !== undefined) enemy.hitFlash = Math.max(enemy.hitFlash, 0.18);
    run.effects.spawnSpark(enemy.x, enemy.y - enemy.radius * 0.3, died || crit || enemy.isBoss);
    run.effects.spawnImpact(enemy.x, enemy.y - enemy.radius * 0.18, absorbed ? '#cfd8e3' : (crit ? gf.crit.color : (enemy.def.color || '#ffffff')), {
      big: died || crit || enemy.isBoss,
      crit,
      absorbed,
      ...hitVisual,
    });

    // Micro shake khusus hit yang BELUM kill. Kill/elite/boss tetap ditangani
    // di onEnemyKilled agar intensitasnya tidak dobel.
    if (!died && !absorbed && run.camera && gf.shake) {
      const now = run.time || 0;
      const throttle = gf.shake.hitThrottleSec ?? 0.055;
      if (now - (run.lastHitShakeAt ?? -999) >= throttle) {
        run.lastHitShakeAt = now;
        run.camera.addShake(crit ? (gf.shake.critHit ?? 0.09) : (gf.shake.hit ?? 0.035));
      }
    }

    // V2 Phase 1: ukuran angka mengikuti besaran damage; crit = oranye & lebih besar
    const dn = gf.damageNumber;
    let size = dn.base + Math.min(dn.maxBonus, damage * dn.perDamage);
    let color = died ? '#ffd93d' : '#ffffff';
    if (crit) {
      size *= gf.crit.sizeMult;
      color = gf.crit.color;
      this.hitStopRun(gf.hitStop.crit); // jeda mikro "berat" khusus crit
      buzz('crit');
    }
    run.effects.spawnDamageNumber(enemy.x, enemy.y - enemy.radius - 14, damage, color, Math.round(size));
  },

  /** Cari musuh terdekat (dipakai auto-attack & homing). */
  findNearestEnemy(x, y, range) {
    return this.run.collision.findNearestEnemy(x, y, range);
  },

  /** V2 Phase 2: target auto-attack — bias "finisher" ke musuh sekarat. */
  findAttackTarget(x, y, range) {
    return this.run.collision.findAttackTarget(x, y, range, getCombat().targeting.woundedWeight);
  },

  /**
   * V2 Phase 5: BOSS ENRAGE — dipanggil dari enemy.update (boss_pattern_a).
   * HP ≤ threshold → sekali: lebih cepat & agresif, telegraph tetap terbaca.
   * Angka dari data/waves.json (bossEnrage).
   */
  tryBossEnrage(boss) {
    const cfg = getData().waves.bossEnrage;
    if (!cfg || boss.enraged || boss.hp / boss.maxHP > cfg.threshold) return;
    boss.enraged = true;
    boss.speed *= cfg.speedMult;
    if (boss.def.areaAttack) {
      // shadow def: jangan mutasi definisi bersama di data-store
      boss.def = {
        ...boss.def,
        areaAttack: {
          ...boss.def.areaAttack,
          interval: boss.def.areaAttack.interval * cfg.intervalMult,
          telegraphTime: boss.def.areaAttack.telegraphTime * cfg.telegraphMult,
        },
      };
    }
    showAnnounce(tr('MENGAMUK!'), true);
    this.run.camera.addShake(0.5);
    audio.bossSpawn();
    buzz('boss');
    this.run.effects.spawnBurst(boss.x, boss.y, '#ff5d73', 26, 260, 5);
  },

  /**
   * V2 Phase 2: STRIKE musuh pengejar setelah windup — dipanggil dari
   * enemy.update. Lunge visual (terkam) + damage lewat jalur damagePlayer
   * (shield/evade/iframes/haptic Phase 1 semua tetap berlaku).
   */
  enemyContactStrike(enemy, dirX, dirY) {
    if (!enemy.alive || !this.run || this.run.ended) return;
    const lunge = getCombat().contactAttack.lunge;
    enemy.vx += dirX * lunge;
    enemy.vy += dirY * lunge;
    this.damagePlayer(enemy.damage);
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
    buzz('playerHit'); // V2 Phase 1: getaran pola [30,40,30] di HP
    player.squash = 0.28; // JUICE squash saat terkena hit
    passiveOnPlayerHit(run, this); // V2 Phase 3: retaliate Masta (Degranulasi)
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
    enemy.visualTier = pathogenVisualTier(run.spawnSys?.wave || 1, enemy);
    enemy.visualFamily = enemy.def.visualFamily || enemy.def.family || null;
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
  /**
   * PACK AGGRO: saat satu anggota sarang menyadari player, kawan di sekitarnya
   * ikut bangun — koloni yang ditabrak terasa "hidup" & agresif, bukan pasif.
   */
  packAggro(src, radius = 260) {
    const run = this.run;
    if (!run) return;
    const r2 = radius * radius;
    for (const e of run.enemies) {
      if (e === src || !e.alive || e.isBoss) continue;
      if (e.homeX === null) continue; // free-ranger tidak butuh dibangunkan
      if (e.aiState === 'chase') continue;
      const dx = e.x - src.x, dy = e.y - src.y;
      if (dx * dx + dy * dy <= r2) e.aiState = 'chase';
    }
  },

  /**
   * PROVOKASI: musuh yang kena serangan (dari mana pun asalannya) bangun &
   * membalas — memukul sarang dari jauh tidak lagi "gratis aman": dunia
   * tetap hidup, patogen agresif feedback alami (RONDE-4 issue #1).
   */
  provokeEnemy(e) {
    if (!e || !e.alive || e.isBoss || e.homeX === null) return;
    if (e.aiState !== 'chase') {
      e.aiState = 'chase';
      this.packAggro(e, 160);
    }
  },

  /** Musuh menembak: satu peluru imun-patik (dicegah banjir via cap). */
  tryEnemyShoot(enemy, dirX, dirY) {
    const run = this.run;
    if (!run || !enemy.shooter || !enemy.alive) return false;
    if (run.ebullets.length >= 24) return false;
    const sh = enemy.shooter;
    // Muzzle burst kecil (umpan balik visual instan)
    if (run.effects) run.effects.spawnBurst(enemy.x + dirX * enemy.radius, enemy.y + dirY * enemy.radius, sh.color, 4, 130, 3);
    run.ebullets.push({
      x: enemy.x + dirX * (enemy.radius + 4),
      y: enemy.y + dirY * (enemy.radius + 4),
      vx: dirX * sh.speed,
      vy: dirY * sh.speed,
      dmg: sh.dmg,
      radius: sh.radius,
      color: sh.color,
      life: 1.9,
      alive: true,
    });
    return true;
  },

  /** Update peluru musuh: terbang + tabrak player (menghormati iframes). */
  updateEnemyBullets(dt) {
    const run = this.run;
    if (!run) return;
    const player = run.player;
    for (const b of run.ebullets) {
      if (!b.alive) continue;
      b.life -= dt;
      if (b.life <= 0) { b.alive = false; continue; }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const dx = player.x - b.x, dy = player.y - b.y;
      const rr = b.radius + (player.radius || 12);
      if (dx * dx + dy * dy <= rr * rr) {
        b.alive = false;
        this.damagePlayer(b.dmg);
        if (run.effects) {
          run.effects.spawnSpark(b.x, b.y, false);
          run.effects.spawnBurst(b.x, b.y, b.color, 6, 170, 3);
        }
        run.camera.addShake(0.08);
      }
    }
    if (run.ebullets.length > 40) run.ebullets = run.ebullets.filter((b) => b.alive);
  },

  spawnEnemy(enemyId, isBossSpawn, opts = null) {
    const run = this.run;
    const def = getEnemyDef(enemyId);
    if (!def) return;
    const scalers = run.spawnSys.getScalers();
    if (def.isBoss) {
      scalers.hpScale *= run.spawnSys.getBossHPMultiplier();
    }
    // Fase 18: musuh MENGIKUTI level player — makin tinggi level pemain,
    // makin kuat & gesit musuhnya (bukan hanya ikut wave).
    const pls = getProgression().playerLevelScaling;
    const plvl = Math.max(1, run.level || 1);
    scalers.hpScale *= 1 + (plvl - 1) * pls.hpPerLevel;
    scalers.speedScale += Math.min(pls.speedMax, (plvl - 1) * pls.speedPerLevel);
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
    // F26: free-ranger trickle juga punya sarang (di titik spawn-nya) —
    // tidak ada patogen yang mengejar tanpa ujung; imunlah yang mencari.
    if (opts && opts.nest && !def.isBoss) {
      enemy.setNest(enemy.x, enemy.y, opts.ai || null);
    }
    enemy.visualTier = pathogenVisualTier(run.spawnSys?.wave || 1, enemy);
    enemy.visualFamily = enemy.def.visualFamily || enemy.def.family || null;
    // Musuh mulai BERSENJATA di wave 3+: sebagian pengejar meludah proyektil —
    // koloni yang tadinya "masif tapi pasif" kini membalas dari jarak aman.
    if (!def.isBoss && ((run.spawnSys?.wave || 1) >= 2) && (def.elite || Math.random() < 0.30)) {
      enemy.armShooter();
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
    const bonusPart = rollPartDrop('boss', 1) || 'equity_receptor';
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
    // GUARD progression (Lv 3 / 5 / 10): slot skill LOCKED tidak boleh
    // tereksekusi — berlaku untuk klik, touch, keyboard & handler lain.
    const skill = run.skills.slots[slot];
    if (!skill) return false;
    if (!isSkillUnlocked(run.level, slot, skill)) return false;
    const fired = run.skills.trigger(slot, {
      game: this,
      player,
      enemies: run.enemies,
      damage: player.stats.damage,
      effects: run.effects,
      camera: run.camera,
      hitEnemy: (enemy, dmg) => {
        // Jurus menembus lapisan armor (Petir Sel NK vs Gram±/Prion)
        const died = enemy.takeDamageRaw ? enemy.takeDamageRaw(dmg) : enemy.takeDamage(dmg);
        this.spawnHitFeedback(enemy, dmg, died, false, { sourceKind: 'skill' });
        if (died) this.onEnemyKilled(enemy, null);
      },
    });
    // Third-person feel: hentakan halus saat skill meninggalkan tangan (tempur).
    if (fired) run.camera.addShake(0.14);
    return fired;
  },

  /**
   * Upgrade skill slot (sistem terbuka pada PLAYER LEVEL 15).
   * Biaya = antibodi run (run.currencyEarned). Semua guard progression di
   * sini: sebelum Lv 15 aksi ini tidak berbuat apa-apa (return false).
   * @returns {boolean} true bila rank skill naik.
   */
  upgradeAbilityBySlot(slot) {
    const run = this.run;
    if (!run || run.ended || STATE.levelUpOpen) return false;
    const player = run.player;
    if (!player.alive) return false;
    const skill = run.skills.slots[slot];
    if (!skill) return false;
    // GUARD: upgrade terkunci sebelum Lv 15 (jangan membuat variabel level kedua)
    if (run.level < SKILL_UPGRADE_LEVEL) return false;
    if (!canUpgradeSkill(run.level, slot, skill)) return false;
    const cost = skillUpgradeCost(skill);
    if (run.currencyEarned < cost) {
      emit('toast', { message: `Butuh ${cost} antibodi untuk upgrade skill`, kind: 'warn' });
      return false;
    }
    if (!run.skills.tryUpgrade(slot, run.level)) return false;
    run.currencyEarned -= cost;
    audio.ui();
    buzz('levelup');
    emit('toast', {
      message: `${skill.def.name} → RANK ${skill.rank}! (+28% damage, -7% cooldown)`,
      kind: 'gold',
    });
    return true;
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
    passiveOnKill(run, this); // V2 Phase 3: heal Mako / frenzy Neo
    onAntigenKill(run, enemy, this); // R3 Modul A: memori antigen per tipe
    cascadeOnDeath(this, enemy); // R6 Modul D: tagged mati → rantai opsonisasi

    // R4 Modul B: korban TELAN dikonversi resource (heal+fuel di tryDevour) —
    // TANPA drop XP/koin/imu normal (combat doc §3.1). Combo/efek tetap.
    if (enemy.devoured) {
      run.combo.count += 1;
      run.combo.timer = getRetention().combo.window;
      run.effects.spawnBurst(enemy.x, enemy.y, '#ffd93d', getRetention().particles.enemyDeath, 150, 4);
      audio.kill();
      return;
    }

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
    // V2 Phase 1: hit-stop BERLAPIS dari data (kill biasa juga dapat "berat")
    const gf = getGameFeel();
    if (enemy.isBoss) { this.hitStopRun(gf.hitStop.boss); buzz('boss'); }
    else if (enemy.def.elite) { this.hitStopRun(gf.hitStop.elite); buzz('elite'); }
    else { this.hitStopRun(gf.hitStop.kill); buzz('kill'); }
    // V2 Phase 1: micro shake per kill (biasa/elite; boss sudah shake 0.65 di bawah)
    if (!enemy.isBoss) run.camera.addShake(enemy.def.elite ? gf.shake.elite : gf.shake.kill);
    // V2 Phase 5: elite VOLATILE — bangkai meledak setelah fuse ber-telegraph
    // (konsisten filosofi Phase 2: bisa dihindari dengan menjauh)
    if (enemy.eliteAffix === 'volatile') {
      const vc = enemy.affixCfg;
      run.pendingBlasts.push({ x: enemy.x, y: enemy.y, t: vc.fuse, radius: vc.radius, damage: vc.damage, color: vc.color });
      run.effects.spawnBlast(enemy.x, enemy.y, vc.radius, vc.color);
    }
    // V2 Phase 1: DEATH POP — sprite membesar & memudar, kill tidak "lenyap"
    run.effects.spawnKillPop(
      enemy.x, enemy.y, enemy.def.spriteIdle, enemy.radius,
      run.player.x < enemy.x, gf.killPop.dur, gf.killPop.scaleTo,
    );
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
        // Fase 18 GATEKEEPER: penjaga tumbang → gerbang wave terbuka
        if (run.spawnSys.isGateBlocked()) {
          run.spawnSys.openGate();
          showAnnounce(tr('GERBANG TERBUKA!'), false);
          // XP yang ditahan selama gerbang tertutup → cair penuh (bisa naik beberapa level)
          this.flushXpBank();
        }
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
          child.visualTier = pathogenVisualTier(run.spawnSys?.wave || 1, child);
          child.visualFamily = child.def.visualFamily || child.def.family || null;
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
    const doubleMult = (this.runFlags && this.runFlags.ganda) ? 1.3 : 1; // Fase 18: cap premium 30%
    // Fase 12 (spek pemilik): bonus akhir run floor(wave×8 + kills×0.5 + boss×50)
    // Fase 18: × rewardMult band — early 1.5× (reward besar), late 1.3×
    const endBand = getProgressionBand(run.spawnSys ? run.spawnSys.wave : 1);
    const waveBonus = Math.floor(((run.spawnSys ? run.spawnSys.wave : run.wave || 1) * 8 + run.kills * 0.5 + (run.bossKills || 0) * 50) * endBand.rewardMult);
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

    // FASE 14 — hasil run mengalir ke Battle Pass (XP) & Antibodi (soft).
    // RONDE-4 (ekonomi premium ketat): Imun Coin TIDAK lagi diberikan dari
    // hasil run — coin premium hanya dari PEMBELIAN & reward Battle Pass
    // (aturan platform revenue; blueprint: premium ≠ gampang digratiskan).
    const bpRes = addBpXP(meta, run.level * 40 + run.spawnSys.wave * 15 + run.kills);
    run.bpGain = bpRes; // ringkasan akhir run
    run.imuEarned = 0;

    // Fase 19 — TUJUAN PEMAIN: GP Pangkat Penjaga (setiap run menghasilkan GP;
    // kenaikan pangkat = momen emosional ala naik-rank, tanpa demosi utk anak)
    const rankRes = applyRunGP(meta, {
      wave: run.spawnSys.wave,
      kills: run.kills,
      bossKills: run.bossKills,
      victory,
      chapterId: run.chapter ? run.chapter.id : null,
    });
    run.rankGain = rankRes;

    recordAntigenMeta(meta, run); // R3: encounter record memori antigen (collection)
    // V2 Phase 6 — HERO MASTERY: progres per-hero murni dari bermain
    const masteryRes = addMasteryXP(meta, run.heroDef.id, {
      kills: run.kills,
      wave: run.spawnSys.wave,
      victory,
    });
    run.masteryGain = masteryRes;
    if (masteryRes.levelsGained > 0) {
      emit('toast', {
        message: `MASTERY ${run.heroDef.name} Lv ${masteryRes.level}${masteryRes.title ? ` — ${masteryRes.title}` : ''}! +${masteryRes.reward} Imun`,
        kind: 'gold',
      });
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
      emit('heroUnlocked', { heroId: h.id }); // E1 poin 9: Amara menjelaskan
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
      // V2 Phase 6: mastery hero yang dipakai run ini
      mastery: run.masteryGain ? {
        heroName: run.heroDef.name,
        xp: run.masteryGain.xp,
        level: run.masteryGain.level,
        levelsGained: run.masteryGain.levelsGained,
        title: run.masteryGain.title,
      } : null,
      rank: {
        gained: rankRes.gained,
        gpAfter: rankRes.gpAfter,
        tierUp: rankRes.tierUp,
        tierName: rankRes.toTier.name,
        tierColor: rankRes.toTier.color,
        insignia: rankRes.toTier.insignia,
        prevTierName: rankRes.fromTier.name,
        need: rankRes.need,
        nextName: rankRes.nextName,
      },
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
    // R7 Modul E: jejak sinyal kemotaksis — cakram memudar seiring umur;
    // segmen matang (bisa membuff) diberi rim supaya jalur "hidup" terbaca.
    if (run.chemoTrail && run.chemoTrail.length) {
      const chemoCfg = getModules().chemotaxisTrail || {};
      const cLife = chemoCfg.lifetimeSec || 4;
      const cAge = chemoCfg.minAgeForBuff || 0.5;
      const cR = chemoCfg.segmentRadius || 26;
      for (const seg of run.chemoTrail) {
        const age = run.time - seg.t;
        const fade = Math.max(0, 1 - age / cLife);
        ground(seg.x, seg.y);
        ctx.globalAlpha = 0.16 * fade;
        ctx.fillStyle = '#5ce8c8';
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, cR, 0, Math.PI * 2);
        ctx.fill();
        if (age >= cAge) {
          ctx.globalAlpha = 0.3 * fade;
          ctx.strokeStyle = '#5ce8c8';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, cR * 0.72, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
    // R5 Modul C: zona inflamasi — telegraph kuning pucat → merah menyala,
    // pulsa makin cepat mendekati storm (sinyal "keluar sekarang!" tanpa HUD).
    if (run.inflamZones) for (const z of run.inflamZones) {
      const heat = inflamHeat(z, run.time);
      const col = inflamColor(heat);
      const pulse = Math.sin(run.time * (3 + heat * 9) + z.id) * 0.5 + 0.5;
      ground(z.x, z.y);
      ctx.globalAlpha = 0.14 + heat * 0.2 + pulse * 0.06;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.fill();
      // Rim menebal saat panas — batas zona jelas terbaca
      ctx.globalAlpha = 0.35 + heat * 0.45;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2 + heat * 4;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius * (0.94 + pulse * 0.05), 0, Math.PI * 2);
      ctx.stroke();
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
        // V2 Phase 2: SHIVER telegraph — musuh bergetar selama windup serangan
        let shiverX = 0;
        if (e.attackSpriteHint) {
          const ca = getCombat().contactAttack;
          shiverX = Math.sin(time * ca.shiverHz * Math.PI * 2 + e.weavePhase) * ca.shiverAmp;
        }
        // R6 Modul D: outline TAG (T1 — feedback lokal saja, tanpa kamera)
        if (e.cascadeTag) {
          ground(e.x, e.y + e.radius * 0.9);
          ctx.strokeStyle = '#ffb347';
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(e.x, e.y + e.radius * 0.9, e.radius * 1.22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        // R4 Modul B: ring TELAN — musuh sekarat berdenyut kuning (window aktif)
        if (e.phagoEligible) {
          ground(e.x, e.y + e.radius * 0.9);
          const wPulse = 0.45 + 0.45 * Math.abs(Math.sin(time * 7));
          ctx.strokeStyle = '#ffd93d';
          ctx.globalAlpha = wPulse;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(e.x, e.y + e.radius * 0.9, e.radius * 1.35, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        // V2 Phase 5: aura ELITE — ring warna affix di lantai (terlihat dari jauh)
        if (e.eliteAffix) {
          ground(e.x, e.y + e.radius * 0.9);
          ctx.strokeStyle = e.affixCfg.color || '#ffd93d';
          ctx.globalAlpha = 0.5 + Math.sin(time * 5 + e.weavePhase) * 0.2;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(e.x, e.y + e.radius * 0.9, e.radius * 1.15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        billboard(e.x + shiverX, e.y, { lift: e.radius * 0.62 + bob, flip });
        if (hidden) ctx.globalAlpha = 0.14;
        const path = e.attackSpriteHint ? e.def.spriteAttack : e.def.spriteIdle;
        drawSprite(ctx, path, e.x, e.y, e.radius * 2.667, e.def.orientToMovement ? e.rotation : 0, {
          // V2 Phase 5: boss enrage = tint merah konstan (drama fase akhir)
          flash: e.hitFlash > 0 ? Math.min(1, e.hitFlash / 0.12) : (e.enraged ? 0.3 : 0),
          flashColor: e.hitFlash > 0 ? '#ffffff' : (e.enraged ? '#ff2038' : undefined),
        });
        drawPathogenMutation(ctx, e, e.visualTier ?? pathogenVisualTier(run.spawnSys?.wave || 1, e), time);
        ctx.globalAlpha = 1;
        // HP bar mini di atas kepala (tanpa bob — anchor stabil)
        ctx.restore();
        billboard(e.x, e.y, { lift: e.radius * 0.62 });
        drawHealthBar(ctx, e.x, e.y - e.radius - 10, Math.max(30, e.radius * 2), 5, e.hp / e.maxHP, e.isBoss ? '#ff5d73' : '#ffd93d');
        // V2 Phase 5: label affix elite di atas HP bar
        if (e.eliteAffix) {
          ctx.font = '900 9px Nunito, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = e.affixCfg.color || '#ffd93d';
          ctx.strokeStyle = 'rgba(18,63,58,0.85)';
          ctx.lineWidth = 3;
          const lbl = e.affixCfg.label || 'ELITE';
          ctx.strokeText(lbl, e.x, e.y - e.radius - 16);
          ctx.fillText(lbl, e.x, e.y - e.radius - 16);
        }
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
          // E1 poin 5: aura neon default DIHAPUS — hanya aura KOSMETIK
          // (dibeli pemain) yang boleh menyala; default karakter bersih.
          if (auraAcc) drawPulseGlow(ctx, pBody.x, pBody.y, player.radius * 1.5, auraAcc.color, time, 0, 0.8);
          const bodySize = player.radius * 2.667 * (player.squash > 0 ? 1 + Math.sin(time * 48) * 0.06 : 1);
          const evoStage = run.evoStage?.stage || 0;
          if (skin) {
            const tinted = getTintedSprite(path, skin.color);
            const scale = bodySize / Math.max(tinted.width, tinted.height);
            ctx.drawImage(tinted, pBody.x - (tinted.width * scale) / 2, pBody.y - (tinted.height * scale) / 2, tinted.width * scale, tinted.height * scale);
          } else {
            drawSprite(ctx, path, pBody.x, pBody.y, bodySize, 0, {});
          }
          drawHeroEquity(ctx, player.heroDef.id, evoStage, pBody.x, pBody.y, bodySize, time, player.heroDef.color);
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
    // Peluru musuh: bosa kecil bercahaya + jejak pendek (jelas "peluru musuh")
    for (const b of run.ebullets) {
      if (!b.alive) continue;
      draws.push({ y: b.y, fn: () => {
        const q = billboard(b.x, b.y, { lift: 8 });
        // jejak pendek ke belakang arah kecepatan
        const shx = b.vx * 0.027, shy = b.vy * 0.027;
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = b.radius * 0.8;
        ctx.beginPath();
        ctx.moveTo(b.x - shx, b.y - shy);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // inti bercahaya
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 2.1);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.45, b.color);
        grad.addColorStop(1, 'rgba(255,125,156,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.62, 0, Math.PI * 2);
        ctx.fill();
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
      else if (fx.type === 'impact') drawImpactPulse(ctx, fx);
      else if (fx.type === 'abilityCharge') drawAbilityCharge(ctx, fx, time);
      else if (fx.type === 'abilityPayoff') drawAbilityPayoff(ctx, fx, time);
      else if (fx.type === 'killfx') drawKillFx(ctx, fx, time);
      else if (fx.type === 'killpop') {
        // V2 Phase 1 death pop: sprite musuh membesar 1→scaleTo lalu memudar
        const kt = 1 - fx.life / fx.maxLife; // 0..1
        const scale = 1 + (fx.scaleTo - 1) * kt;
        ctx.globalAlpha = Math.max(0, 1 - kt);
        drawSprite(ctx, fx.sprite, fx.x, fx.y, fx.radius * 2.667 * scale, 0, {});
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    for (const pt of run.effects.particles) {
      billboard(pt.x, pt.y, { lift: 2 });
      drawParticle(ctx, pt);
      ctx.restore();
    }
    // ---- ATMO-KEDALAMAN third-person (referensi user: Raft) ----
    // 3 lapis: kabut jauh di ATAS (horizon), bayangan FETCH bawah (foreground),
    // vignette sudut — menjual foreground/midground/background pada bola mata.
    {
      const fog = this.depthFog = (this.depthFog && this.depthFog.h === h) ? this.depthFog : (this.depthFog = (() => {
        const g = ctx.createLinearGradient(0, 0, 0, h * 0.5);
        g.addColorStop(0, 'rgba(215,244,236,0.36)');
        g.addColorStop(0.35, 'rgba(214,242,234,0.14)');
        g.addColorStop(1, 'rgba(214,242,234,0)');
        return { g, h };
      })());
      ctx.fillStyle = fog.g;
      ctx.fillRect(0, 0, w, h * 0.5);
      // Foreground: dasar layar di-teduhkan (air dekat lebih gelap di foto ref)
      const gr2 = ctx.createLinearGradient(0, h * 0.82, 0, h);
      gr2.addColorStop(0, 'rgba(6,42,38,0)');
      gr2.addColorStop(1, 'rgba(6,42,38,0.22)');
      ctx.fillStyle = gr2;
      ctx.fillRect(0, h * 0.82, w, h * 0.18);
      // Vignette sudut ringan (depth cue perifer)
      const vg = ctx.createRadialGradient(w / 2, h * 0.6, h * 0.5, w / 2, h * 0.6, h * 1.05);
      vg.addColorStop(0, 'rgba(6,30,28,0)');
      vg.addColorStop(1, 'rgba(6,30,28,0.16)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }

    for (const n of run.effects.numbers) {
      billboard(n.x, n.y, { lift: 10 });
      drawDamageNumber(ctx, n, time);
      ctx.restore();
    }

    // ---- Screen-space overlays ----
    cam.drawBossIndicatorIfOffscreen(ctx, run.boss, w, h, time);
    drawNestHint(ctx, run, cam.x, cam.y, w, h, time); // F26: petunjuk arah sarang terdekat
    drawJoystick(ctx, this.input.joystick, this.input.maxRadius, drawImageAt);

    // ---- HUD DOM + minimap ----
    if (STATE.screen === 'gameplay' || STATE.screen === 'gameover') {
      updateHUD({
        hpPct: player.hp / player.maxHP,
        hpText: `${Math.ceil(player.hp)}/${player.maxHP}`,
        xpPct: run.xp / xpToNextLevel(run.level),
        wave: run.spawnSys.wave,
        abilities: run.skills.getView(run.level),
        combo: run.combo,
        mission: run.objective
          ? { quota: run.objective.quota, kills: run.kills, bossSpawned: run.objective.bossSpawned, bossName: run.chapter && run.chapter.boss ? run.chapter.boss.name : null }
          : null,
        timerText: this.formatTime(run.time),
        kills: run.kills,
        currency: run.currencyEarned,
        imu: Math.floor((STATE.meta.imun || 0) + (run.imuAccrued || 0)), // F20: saldo total, bukan akruan run saja
        gate: run.spawnSys.isGateBlocked(),
        gateBank: Math.round((run.xpBank || 0) * 10) / 10,
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
