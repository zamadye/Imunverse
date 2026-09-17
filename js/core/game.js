/**
 * game.js — Orkestrator gameplay PHAGOS (eksperimen membran).
 * Memegang state run (entitas, sistem, kamera), loop update/render, dan
 * seluruh alur: spawn → membran/PULSE/engulf → mati → drop → XP → mutasi →
 * revive → akhir run → ekonomi → misi → save.
 *
 * CATATAN ARSITEKTUR: file ini TIDAK mengimpor modul screen UI manapun
 * (kecuali hud-screen yang murni "view adapter" tanpa import balik).
 * Komunikasi ke UI lewat ui-bridge (event) — lihat ui-bridge.js.
 *
 * PHAGOS: kata kerja tempur = MEDAN MEMBRAN (kontak pasif) + PULSE (satu
 * tombol) + ENGULF (fagositosis otomatis). Proyektil hero dinonaktifkan;
 * sub-sistem proyektil tetap hidup untuk antibodi Bella/Eos + skill.
 */

import { STATE, setPaused, setLevelUpOpen, setScreen } from './state-manager.js';
import { hidePresenter } from '../ui/presenter.js';
import {
  getData, getHero, getEnemyDef, getNutrientDef, getWaveConfig,
  xpToNextLevel, getMembrane,
} from './data-store.js';
import { emit } from './ui-bridge.js';
import { getTintedSprite } from '../render/sprite-loader.js';
import { t as tr } from '../systems/i18n.js';
import { writeSave } from '../save/save-manager.js';
import { markSeen } from '../systems/codex-system.js';
import { addMasteryXP } from '../systems/mastery-system.js'; // V2 Phase 6
import { bossBark, resetNarrativeRun } from '../systems/narrative-system.js'; // R2: barks RIA
import { initAntigenRun, onAntigenKill, antigenDamageMult, antigenIgnoreArmor, recordAntigenMeta } from '../systems/antigen-memory.js'; // R3: Modul A
import { phagoUpdateEnemy, tryDevour } from '../systems/phagocytosis.js'; // R4: Modul B
import { inflamUpdate, inflamHeat, inflamColor } from '../systems/inflammation.js'; // R5: Modul C
import { tagOnHit, cascadeOnDeath } from '../systems/tag-cascade.js'; // R6: Modul D
import { chemoUpdate } from '../systems/chemotaxis.js'; // R7: Modul E
import { SkillSystem, SKILL_TRIGGER_LABEL } from '../systems/skill-system.js';
// PHAGOS eksperimen: membran + mutasi hero + mutasi musuh
import {
  initMembrane, updateMembrane, tryPulse, tryEngulf, getMembraneStats,
  membraneContains, membraneOnKill, membraneAbsorbDamage, membraneOnPlayerHit,
  pulseView,
} from '../systems/membrane-system.js';
import { rollMutationChoices, applyMutation, isMutationId, mutationDef } from '../systems/mutation-system.js';
import { applyStartConsumables, updateItemBuffs, absorbMukus, isMukusActive, onPlayerDamaged } from '../systems/item-buffs.js'; // ADDENDUM §2
import {
  onNewWave as enemyMutOnNewWave, checkPreWarning as enemyMutPreWarning,
  maybeApplyTrait as enemyMutMaybeApply, updateEnemyMutations,
  mutationLabelFor,
} from '../systems/enemy-mutation-system.js';

import { Player } from '../entities/player.js';
import { Enemy } from '../entities/enemy.js';
import { Projectile } from '../entities/projectile.js';
import { Pickup } from '../entities/pickup.js';

import { SpawnSystem } from '../systems/spawn-system.js';
import { CollisionSystem } from '../systems/collision-system.js';
import { rollLevelUpChoices, applyLevelUp, squadMultipliers, effectiveStacks } from '../systems/upgrade-system.js';
import { isDevMode } from './dev-mode.js';
import { addCurrency } from '../systems/economy-system.js';
import { checkMissions } from '../systems/mission-system.js';
import { applyGlobalUpgrades, queueHeroNotice, getRetention, synergyFor, globalHomeoLevels } from '../systems/retention-system.js'; // synergyFor: V2 Phase 4
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
import { isSkillUnlocked, SKILL_UNLOCK_LEVELS, SKILL_RANK2_LEVEL } from '../systems/skill-unlock.js';
import { evoStageFor, evoStatMult, evoProgress, evoSprite } from '../systems/evolution-system.js';
import { antibodyForKill, antibodyForEngulf, earnAntibody, mutationCost, economyPhase, runAntibody, recordEconomyEvent } from '../systems/antibody-economy.js';
import { initJourney, updateJourney, journeyHud, drawLandmark } from '../systems/world-journey.js';
import { startMutationCinematic, drawMutationCinematic, cineActive, resetCinematic } from '../systems/mutation-cinematic.js';
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
import { drawSprite, hasSprite } from '../render/sprite-loader.js';
import { drawPathogenMutation, pathogenVisualTier } from '../render/character-visuals.js';
import { updateHUD, getMinimapContext, showAnnounce } from '../ui/screens/hud-screen.js';
import { updateAttack, updateSummons, drawAttack } from '../systems/attack-archetype.js';

export const game = {
  canvas: null,
  ctx: null,
  input: null,
  viewW: 0,
  viewH: 0,
  dpr: 1,

  /** @type {object|null} state run aktif */
  run: null,
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
    resetCinematic(); // P2: run baru tidak boleh mewarisi adegan mutasi lama
    const meta = STATE.meta;
    const heroDef = getHero(heroId) || getHero(meta.selectedHero);
    if (!heroDef) throw new Error('Hero tidak ditemukan: ' + heroId);

    meta.selectedHero = heroId;
    writeSave(meta); // simpan pilihan hero

    // ADDENDUM §2: consumable dipakai otomatis di AKHIR startRun
    // (applyStartConsumables — butuh player & membran yang sudah jadi).
    this.runFlags = {};
    meta.consumables = meta.consumables || {};

    const startX = 0;
    const startY = 0;
    const upgrades = {};
    // Decay harian sistem tubuh (sekali per hari kalender) + modifier kondisi
    const decayInfo = applyDailyDecay(meta);
    const bodyMods = getBodyRunModifiers(meta);
    this.lastBodyDecay = decayInfo;

    // V2 §21/§34: tidak ada lagi "pilih mode" (kampanye/endless) — run selalu
    // mengikuti bab aktif di Peta Tubuh sampai model perjalanan kontinu (P4)
    // menggantikannya sepenuhnya.
    const modeDef = { id: 'kampanye' };
    // KAMPANYE: bab aktif dari Peta Tubuh (cerita organ sakit → bersihkan → boss)
    const chapterDef = getData().campaign
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

    // P2: tahap evolusi dihitung dari MUTASI AKTIF se-run (bukan fragmen meta).
    // Awal run selalu BASE; naik saat pemain memilih mutasi (refreshEvoStage).
    const evoStage = evoStageFor(null, heroDef);
    const unlockedAbilityIds = []; // V2: kekuatan datang dari mutasi, bukan drop fragmen

    this.run = {
      heroDef,
      heroLvl: (STATE.meta.heroLevels && STATE.meta.heroLevels[heroDef.id]) || 0,
      globalHomeo: globalHomeoLevels(STATE.meta), // D11: cdr/radius/engulf
      player,
      enemies: [],
      projectiles: [],
      summons: [],       // V2 archetype SUMMON: entitas biologis sementara
      attack: null,      // V2 §17: eksekusi archetype serangan (bertelegraph)
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
      chapterTier: chapterDef ? this.getChapterTier(meta) : null,
      objective: chapterDef
        ? { quota: Math.round(chapterDef.killQuota * (this.getChapterTier(meta).quotaMult || 1)), bossSpawned: false, bossDefeated: false }
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
      parts: {}, // V2: fragmen evolusi DIHAPUS — progresi run = mutasi
      partsCollectedTotal: 0,
      bossChest: null,
      imuAccrued: 0, // Fase 17: IMU terkumpul live di HUD (akhir run = rumus penuh)
      hitStop: 0,
      // RONDE-7: hit-stop kill digerbang agar tidak berantai tak putus — saat
      // membantai kerumunan (banyak kill/detik) hit-stop 30ms yang di-refresh
      // tiap kill membekukan game ~30-90% waktu nyata = tombol PULSE terasa
      // LEMOT persis saat musuh ramai (laporan pemain). Kill pertama tetap
      // punya beat-nya; sisanya menunggu celah 0.24 dtk.
      hitStopCool: 0,
      ended: false,
      // PHAGOS: membran + mutasi + bio-point + adaptasi musuh (run-only)
      activeMutations: [],
      mutationHistory: [],
      antibody: 0, // P3: ANTIBODI = satu-satunya resource evolusi (IAP §3)
      engulfStats: {},
      enemyMutation: { activeTrait: null, warnedWave: 0, history: [] },
      membrane: null,
      _mutationFlashT: 0, // PHAGOS: overlay merah saat patogen bermutasi
    };
    // PHAGOS: medan membran hero (wajib sebelum HOOK spawn agar stats siap)
    try { initMembrane(this.run, heroDef); } catch (err) { console.warn('[phagos] initMembrane gagal:', err); }
    // PHAGOS: arena cawan petri (dunia tak lagi tanpa batas) — dari data/membrane.json
    try {
      const ab = (getMembrane() && getMembrane().arena) || {};
      this.run.arenaBounds = { x: ab.cx || 0, y: ab.cy || 0, r: ab.radius || 750 };
    } catch { this.run.arenaBounds = { x: 0, y: 0, r: 750 }; }
    // P4: perjalanan dunia dimulai di zona pertama — lingkungan & musuh
    // mengikuti ZONA, bukan pilihan stage (§21).
    try { initJourney(this.run); } catch (err) { if (isDevMode()) console.warn('[phagos] initJourney:', err); }
    // P4: perjalanan dunia dimulai di zona pertama — lingkungan & musuh
    // mengikuti zona, bukan pilihan stage (§21).
    try { initJourney(this.run); } catch (err) { if (isDevMode()) console.warn('[phagos] initJourney:', err); }

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
        unlockLevels: [...SKILL_UNLOCK_LEVELS, SKILL_RANK2_LEVEL], // [3, 5, 10, 15]
      };
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
    try { applyStartConsumables(this); } catch (err) { console.warn('[item] start:', err); }
    emit('runstart', { heroDef });
    emit('wave', { wave: 1, isBoss: false });
  },

  // =====================================================================
  // STATISTIK PLAYER (base JSON × squad permanen × upgrade run)
  // =====================================================================
  /**
   * Kalikan stat dasar dengan multiplier META: tahap evolusi hero (damage/HP)
   * + bonus arena terpilih (speed/magnet). Dipanggil di startRun.
   */
  applyMetaMultipliers(stats, heroDef) {
    const meta = STATE.meta;
    const run = this.run;
    const hd = heroDef || (run && run.heroDef) || null;
    // P2: pengali tahap evolusi (BASE → MUT1 → MUT2 → APEX) dari mutasi run ini.
    const m = evoStatMult(run, hd);
    const arena = this.getRunArena();
    stats.damage *= m.damage;
    stats.maxHP = Math.round(stats.maxHP * m.maxHP);
    stats.speed *= (arena.bonus.speedMult || 1) * m.speed;
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
    // V2 §21: model "pilih stage/arena" DIBUANG. selectedArena hanya dipakai
    // renderer sebagai penentu environment, bukan sebagai pilihan pemain:
    // kampanye menurunkannya dari organ bab aktif.
    const chosen = list.find((a) => a.id === meta.selectedArena);
    if (chosen) return chosen;
    if (meta.selectedMode === 'kampanye' && getData().campaign) {
      const ch = getData().campaign.chapters.find((c) => c.id === meta.selectedChapter) || getData().campaign.chapters[0];
      const chArena = list.find((a) => a.id === ch.arenaId);
      if (chArena) { meta.selectedArena = chArena.id; return chArena; }
    }
    meta.selectedArena = list[0].id;
    return list[0];
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

    // BUFF TEMPUR: nutrisi (zinc, zat besi, probiotik, serat) — nyata di statistik
    const tb = (this.run && this.run.tempBuffs) || null;
    const buffDamage = tb ? tb.damage.mult : 1;
    const buffCooldown = tb ? tb.cooldown.mult : 1;
    const buffXP = tb ? tb.xp.mult : 1;
    const perm = (this.run && this.run.permBoost) || { maxHP: 0, regen: 0, omega: 0 };

    // Sinergi role: stack upgrade yang cocok role hero dihitung ×(1+bonus)
    // (luRules.synergyBonus); badge "✦ Sinergi" jadi jujur.
    const syn = synergyFor(heroDef);
    const eff = (id) => effectiveStacks({ upgrades: up, heroDef }, id, syn);

    const damage = base.damage * tierMult * squad.damage * squad.weapon * (1 + heroCfg.dmgPerLevel * heroLvl) * buffDamage;
    const cooldown = base.attackCooldown / squad.attackSpeed * buffCooldown;
    // PHAGOS: Treg memperlambat SEMUA termasuk dirinya sendiri (-10%)
    const tregSlow = heroDef.id === 'treg' ? 0.9 : 1;
    // PHAGOS safety net (bible §4.1): Kemotaksis +10% speed, Sitoskeleton +15% HP.
    const speed = base.speed * squad.speed * (1 + eff('speed_boost') * 0.10) * (tb ? tb.speed.mult : 1) * tregSlow;
    const attackRange = base.attackRange * squad.attackRange;
    const swipeRadius = (base.swipeRadius || 0) * squad.attackRange;
    const maxHP = Math.round(base.maxHP * tierMult * squad.maxHP * (1 + heroCfg.hpPerLevel * heroLvl) * (1 + eff('hp_boost') * 0.15) + (perm.maxHP || 0));
    const projectileCount = base.projectileCount;
    const lifeSteal = 0; // pool life-steal dicabut (bible §14); konsumen dipertahankan utk mutasi Sprint 2

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
    // PHAGOS Sprint 1: sitokin ×1.4 adalah pengali SEMENTARA di atas stats — recompute
    // mengganti objek stats (pengali hilang) sementara flag sitokinApplied masih owed.
    // Terapkan ulang agar restore /1.4 saat expiry tidak membelah base (slow permanen 71%).
    if (run.itemBuffs && run.itemBuffs.sitokinApplied) stats.speed *= 1.4;
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

    // RONDE-7: gerbang hit-stop meluruh juga selama freeze (real-time)
    if (run.hitStopCool > 0) run.hitStopCool -= dt;
    // PHAGOS: flash merah arena (peringatan mutasi musuh) meluruh real-time
    if (run._mutationFlashT > 0) run._mutationFlashT -= dt;
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

    // Squash-stretch decay
    if (player.squash > 0) player.squash -= dt;

    // PHAGOS Tahap 3 — input → PULSE (edge-trigger, bukan hold-to-fire).
    // Medan kontak selalu aktif; tombol PULSE satu-satunya aksi eksplisit.
    if (this.input.consumePulse && this.input.consumePulse()) {
      tryPulse(this, {});
    }

    // PHAGOS Opsi A — PASUKAN: membran mini kontak-pasif (tanpa Pulse/engulf).
    // Di sini pasukan HANYA follow; damage kontaknya dihitung di membrane-system.
    for (const ally of run.allies) {
      ally.update(dt, player, [], 0); // tanpa musuh = hanya follow
    }

    // 1. Input & player (gerak joystick; root saat metamorfosis/Nyx)
    const rawMove = this.input.getMoveVector();
    const rooted = run.membrane && run.membrane.metaRootT > 0;
    const move = rooted ? { x: 0, y: 0, magnitude: 0, source: 'rooted' } : rawMove;
    player.update(dt, move, this);
    // PHAGOS adaptif virus: +speed sebagai displacement ekstra (tanpa recompute)
    if (run.membrane) {
      try {
        const mst = getMembraneStats(run);
        if (mst.adaptive && mst.adaptive.speedMult && !rooted) {
          const ex = (mst.adaptive.speedMult - 1) * dt;
          player.x += (player.vx || 0) * ex;
          player.y += (player.vy || 0) * ex;
        }
      } catch { /* stats belum siap */ }
    }

    // PHAGOS desktop: ARAH = MOUSE (facing mengikuti kursor; cone/tentakel +
    // dash T-Bolt otomatis mengikutinya), PULSE = KEYBOARD (Spasi/K/4/T —
    // antrean PULSE di atas). Sentuh/joy-drag tetap memakai arah gerak.
    run._mouseAimFresh = false;
    try {
      const dragging = this.input.joystick && this.input.joystick.active;
      const sp = run.camera.getPlayerScreen ? run.camera.getPlayerScreen() : null;
      const aim = sp && this.input.getAimInfo ? this.input.getAimInfo(sp.x, sp.y) : null;
      if (aim && aim.active && aim.source === 'mouse' && !dragging && player.alive) {
        player.facing = aim.angle;
        run._mouseAimFresh = true;
      }
    } catch { /* abaikan */ }

    // PHAGOS: jepit player di dalam cawan petri (dash/knockback tak bisa kabur)
    try { this.arenaClamp(player, player.radius || 15); } catch { /* abaikan */ }

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
    // P4: perjalanan dunia (zona & transisi) — SETELAH spawn supaya kenaikan
    // wave terbaca di frame yang sama (§27: wave = pacing, bukan arena).
    try { updateJourney(this, dt); } catch (err) { if (isDevMode()) console.warn('[phagos] updateJourney:', err); }
    if (events.waveBreak) {
      emit('waveBreak', { wave: run.spawnSys.wave });
    }
    // PHAGOS: peringatan dini mutasi musuh (5 dtk sebelum wave 6/10/14)
    try { enemyMutPreWarning(this); } catch { /* abaikan */ }
    try { updateEnemyMutations(this, dt); } catch { /* abaikan */ }
    if (events.newWave) {
      emit('wave', { wave: run.spawnSys.wave, isBoss: false });
      audio.wave();
      // PHAGOS: wave mutasi → pilih trait counter build pemain
      try { enemyMutOnNewWave(this, run.spawnSys.wave); } catch (err) { console.warn('[phagos] enemyMutOnNewWave:', err); }
      const w = run.spawnSys.wave;
      // Sprint 3.17 (bible §6.2): bonus Biokredit LIVE tiap wave (+10 BK, float emas)
      const bkWave = getData().upgrades.bkPerWave || 10;
      run.currencyEarned += bkWave;
      run.effects.spawnLabel(player.x, player.y - 46, `+${bkWave} BK`, '#ffd76a');
      // PHAGOS Sprint 1 (bible §5): XP HANYA dari kill — milestone XP wave dicabut.
      // MENANG mode Klasik: wave melewati finalWave (boss wave 10 sudah tumbang)
      if (run.mode && run.mode.finalWave && w > run.mode.finalWave) {
        this.winRun();
        return;
      }
      // Endless: bonus antibodi tiap 5 wave (× band reward — Fase 18)
      if (run.mode && run.mode.id === 'endless' && w % 5 === 0) {
        const bonus = Math.round(w * 5 * getProgressionBand(w).rewardMult);
        run.bonusCurrency += bonus;
        addCurrency(STATE.meta, bonus); // PHAGOS Sprint 1: fix crash endless (meta tak terdefinisi di scope update)
        emit('toast', { message: `Endless wave ${w}! +${bonus} Biokredit`, kind: 'gold' });
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

    // PHAGOS: jepit semua entitas di dalam cawan petri (sebelum grid dibangun
    // ulang agar posisi terjepit yang dipakai semua sistem).
    try {
      for (const e of run.enemies) if (e.alive) this.arenaClamp(e, (e.radius || 14) * 0.5);
      for (const a of run.allies) this.arenaClamp(a, a.radius || 12);
      for (const h of run.hazards) this.arenaClamp(h, 0);
      const B = run.arenaBounds;
      if (B) {
        for (const p of run.projectiles) {
          if (p.alive && Math.hypot(p.x - B.x, p.y - B.y) > B.r + 60) p.alive = false;
        }
        for (const b of run.ebullets) {
          if (b.alive && Math.hypot(b.x - B.x, b.y - B.y) > B.r + 60) b.alive = false;
        }
      }
    } catch { /* abaikan */ }

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

    // PHAGOS Tahap 5 — MEDAN MEMBRAN vs musuh (kontak tick + engulf).
    // Proyektil di atas hanya untuk antibodi Bella/Eos + skill (sub-sistem).
    try { updateMembrane(this, dt); } catch (err) { console.warn('[phagos] updateMembrane:', err); }
    // V2 §17–§19: archetype serangan hero berjalan di PULSE, dengan telegraph
    try { updateAttack(this, dt); } catch (err) { console.warn('[phagos] updateAttack:', err); }
    try { updateSummons(this, dt); } catch (err) { console.warn('[phagos] updateSummons:', err); }
    try { updateItemBuffs(this); } catch { /* abaikan */ } // ADDENDUM §2: kedaluwarsa buff

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
      if (died) this.onEnemyKilled(e, 'dot');
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
    // PACING D14: buff TERKUAT menang + durasi refresh — TIDAK compounding
    // (mult *= tiap pickup + refresh = eksponensial tak terbatas → XP/dmg meledak).
    if (t === 'buff_damage') {
      B.damage.mult = Math.max(B.damage.mult, 1 + v / 100);
      B.damage.t = dur;
      run.effects.spawnLabel(p.x, p.y - 10, tr(`+${v}% Damage!`), '#f2825c');
      this.recomputePlayerStats();
    } else if (t === 'buff_cooldown') {
      B.cooldown.mult = B.cooldown.t > 0 ? Math.min(B.cooldown.mult, Math.max(0.5, 1 - v / 100)) : Math.max(0.5, 1 - v / 100);
      B.cooldown.t = dur;
      run.effects.spawnLabel(p.x, p.y - 10, tr('Serangan makin cepat!'), '#7bdff2');
      this.recomputePlayerStats();
    } else if (t === 'buff_xp') {
      B.xp.mult = Math.max(B.xp.mult, 1 + v);
      B.xp.t = dur;
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
  // XP & LEVEL-UP (PHAGOS Sprint 1: xpToNextLevel = 80 + 35L, bible §5.2)
  // =====================================================================
  addXP(baseAmount) {
    const run = this.run;
    // PHAGOS Sprint 1 (bible §5, D6): XP MURNI dari kill — pengali band & kombo dicabut.
    // Hanya xpMult stat (progresi meta) yang berlaku.
    const gained = baseAmount * run.player.stats.xpMult;
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
      this.announceSkillProgress(run.level);
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
    // PHAGOS Tahap 9 — level-up = MUTASI BENTUK (fallback upgrade lama bila gagal)
    try {
      run.currentChoices = rollMutationChoices(run);
      if (!run.currentChoices || run.currentChoices.length === 0) throw new Error('pool mutasi kosong');
    } catch (err) {
      if (isDevMode()) console.warn('[phagos] rollMutationChoices gagal, fallback upgrade:', err);
      run.currentChoices = rollLevelUpChoices(run);
    }
    const pfx = getRetention().particles;
    run.effects.spawnBurst(run.player.x, run.player.y, '#ffd93d', pfx.levelUp, 240, 5);
    run.camera.addShake(0.3);
    showAnnounce('BERMUTASI!', false);
    this.hitStopRun(getRetention().levelUpStopSec);
    setLevelUpOpen(true);
    hidePresenter(); // RONDE-4: narrator jangan menumpuk modal pilih-evolusi
    setPaused(true);
    audio.levelup();
    buzz('levelup'); // V2 Phase 1: selebrasi terasa di tangan
    emit('levelup', { level: run.level, choices: run.currentChoices });
  },

  /** Dipanggil dari modal level-up saat pemain memilih satu mutasi/upgrade. */
  chooseLevelUp(upgradeId) {
    const run = this.run;
    if (!run || !run.currentChoices) return;
    // PHAGOS: kartu mutasi vs kartu upgrade lama (safety net)
    if (isMutationId(upgradeId)) {
      // P2 §9: bentuk SEBELUM diingat dulu untuk adegan transformasi.
      const sebelum = evoSprite(run, run.heroDef) || run.heroDef.spriteIdle;
      const res = applyMutation(run, upgradeId);
      if (!res.ok) {
        emit('toast', { message: res.reason || 'Mutasi gagal', kind: 'warn' });
        return; // jangan tutup modal — pemain pilih kartu lain
      }
      // Tahap evolusi naik (BASE → MUT1 → MUT2 → APEX) dari mutasi aktif.
      run.evoStage = evoStageFor(run, run.heroDef);
      this.recomputePlayerStats();
      const sesudah = evoSprite(run, run.heroDef) || sebelum;
      showAnnounce(res.mutation.name.toUpperCase() + '!', true);
      run.effects.spawnBurst(run.player.x, run.player.y, '#8df7d2', 30, 260, 5);
      run.camera.addShake(0.4);
      audio.mutation();
      buzz('levelup');
      emit('toast', { message: `MUTASI: ${res.mutation.name}!`, kind: 'gold' });
      // Dunia beku → putar adegan, lalu lanjutkan sisa antrean level-up.
      // Mutasi SUDAH diterapkan di sini, jadi LEWATI tidak menghilangkan apa pun.
      startMutationCinematic({
        from: sebelum,
        to: sesudah,
        name: res.mutation.name,
        stageName: run.evoStage.name || '',
        tierColor: run.evoStage.tierColor || '#8df7d2',
        onDone: () => this._afterLevelUpChoice(),
      });
      return;
    }
    const result = applyLevelUp(run, upgradeId);
    this.recomputePlayerStats();
    if (result.healAmount > 0) run.player.heal(result.healAmount);
    this._afterLevelUpChoice();
  },

  /** Sisa alur setelah satu pilihan level-up diproses (modal / lanjut run). */
  _afterLevelUpChoice() {
    const run = this.run;
    if (!run) return;
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

  /** V2 §17: konfigurasi satu archetype serangan dari data/attacks.json. */
  getAttackArchetype(id) {
    const list = (getData().attacks && getData().attacks.archetypes) || [];
    return list.find((a) => a.id === id) || null;
  },
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
      if (died) this.onEnemyKilled(e, 'melee');
    });
  },

  /** V2 Phase 1: roll critical hit global (data/gamefeel.json crit.chance). */
  rollCrit() {
    const cfg = getGameFeel().crit;
    const chance = this.run.critChanceOverride ?? (cfg.chance + passiveCritBonus(this.run));
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
    // P2: tahap visual = indeks pohon evolusi V2 (0 BASE … 3 APEX).
    const stageRaw = run?.evoStage?.index ?? 0;
    const stage = Math.max(0, Math.min(3, stageRaw || 0));
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
      audio.crit(); // bunyi khusus crit (lebih tajam dari hit biasa)
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
    if (isMukusActive(this.run)) { try { enemy.applySlow(0.7, 0.5); } catch { /* abaikan */ } }
    // V2 §15 SUPPORT: musuh yang sedang dikuatkan aura melukai lebih keras
    this.damagePlayer(enemy.damage * (enemy.auraDmgMult || 1));
  },

  /** Ledakan AOE boss: cek player dalam radius + shake. */
  bossBlast(enemy, cfg) {
    const run = this.run;
    run.effects.spawnBlast(enemy.x, enemy.y, cfg.radius, '#ff4059');
    run.camera.addShake(0.55);
    audio.bossBlast();
    const player = run.player;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const rr = cfg.radius + player.radius;
    if (dx * dx + dy * dy < rr * rr) {
      if (isMukusActive(run)) { try { enemy.applySlow(0.7, 0.5); } catch { /* abaikan */ } }
      this.damagePlayer(cfg.damage);
    }
  },

  /** Pusat damage ke player: i-frames, vignette, shake, death flow. */
  damagePlayer(amount) {
    const run = this.run;
    const player = run.player;
    // ADDENDUM §2 — LAPISAN MUKUS (item): serap dari pool 25% max HP
    if (isMukusActive(run)) {
      const before = amount;
      amount = absorbMukus(run, amount);
      if (amount < before) {
        run.effects.spawnLabel(player.x, player.y - 40, tr('TERSERAP!'), '#7fd8c8');
        run.effects.spawnBlast(player.x, player.y, 46, '#7fd8c8');
        audio.hit();
      }
      if (amount <= 0) return;
    }
    // PHAGOS: membran hidup / immunity / armor Mastia / adaptif spora
    try {
      amount = membraneAbsorbDamage(run, amount);
      if (amount <= 0) return;
    } catch { /* membran belum siap */ }
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
    this.fireSkillTrigger('damaged');
    emit('playerHit', { damage: amount });
    // Fase 17 (trigger 5B): percikan merah 5–8 partikel di sekitar player
    run.effects.spawnBurst(player.x, player.y, '#ff6b6b', getRetention().particles.playerHit, 120, 3);
    // Screen shake saat kena damage besar (sesuai spek)
    run.camera.addShake(amount >= 15 ? 0.6 : 0.22);
    audio.playerHit();
    buzz('playerHit'); // V2 Phase 1: getaran pola [30,40,30] di HP
    player.squash = 0.28; // JUICE squash saat terkena hit
    passiveOnPlayerHit(run, this); // V2 Phase 3: retaliate Masta (Degranulasi)
    try { membraneOnPlayerHit(this, amount); } catch { /* abaikan */ } // PHAGOS: reflektor cermin
    try { onPlayerDamaged(this, amount); } catch { /* abaikan */ } // ADDENDUM §2: serum/cadangan/thorns
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

/**
 * Sprint 3.19 (bible §8.5): tingkat kesulitan bab dari meta.selectedTier.
 */
getChapterTier(meta) {
  const tiers = (getData().campaign && getData().campaign.tiers) || [];
  return tiers.find((t) => t.id === meta.selectedTier) || tiers[0] || { id: 'normal', tier: 0, quotaMult: 1, hpMult: 1, dmgMult: 1 };
},

/**
 * Sprint 3.19: terapkan pengali tingkat ke musuh yang baru spawn.
 */
applyChapterTier(enemy, run) {
  const t = run.chapterTier;
  if (!t || t.id === 'normal') return;
  enemy.maxHP = Math.max(1, Math.round(enemy.maxHP * (t.hpMult || 1)));
  enemy.hp = enemy.maxHP;
  enemy.damage = Math.max(1, Math.round(enemy.damage * (t.dmgMult || 1)));
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
    // PHAGOS: titik spawn di luar pandang bisa jatuh di luar cawan — tarik masuk
    try {
      const B = run.arenaBounds;
      if (B) {
        const sdx = pos.x - B.x, sdy = pos.y - B.y;
        const smaxR = Math.max(60, B.r - 60);
        if (Math.hypot(sdx, sdy) > smaxR) {
          const sa = Math.atan2(sdy, sdx);
          pos.x = B.x + Math.cos(sa) * smaxR;
          pos.y = B.y + Math.sin(sa) * smaxR;
        }
      }
    } catch { /* abaikan */ }
    const enemy = new Enemy(def, pos.x, pos.y, scalers);
    markSeen(bossCfg.id); // Bio-Pedia: boss ditemui
    if (bossCfg.areaAttack) enemy.def = Object.assign({}, def, { areaAttack: bossCfg.areaAttack });
    enemy.isBoss = true;
    // PACING D14: boss bab bisa memukul lebih keras (dmgMult per bab)
    if (bossCfg.dmgMult) enemy.damage = Math.max(1, Math.round(enemy.damage * bossCfg.dmgMult));
    this.applyChapterTier(enemy, run); // Sprint 3.19: HP/damage × tingkat kesulitan
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
    // PHAGOS: titik spawn di luar pandang bisa jatuh di luar cawan — tarik masuk
    try {
      const B = run.arenaBounds;
      if (B) {
        const sdx = pos.x - B.x, sdy = pos.y - B.y;
        const smaxR = Math.max(60, B.r - 60);
        if (Math.hypot(sdx, sdy) > smaxR) {
          const sa = Math.atan2(sdy, sdx);
          pos.x = B.x + Math.cos(sa) * smaxR;
          pos.y = B.y + Math.sin(sa) * smaxR;
        }
      }
    } catch { /* abaikan */ }
    const enemy = new Enemy(def, pos.x, pos.y, scalers);
    this.applyChapterTier(enemy, run); // Sprint 3.19: HP/damage × tingkat kesulitan
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
    // PHAGOS: inject trait strain bermutasi (wave 6/10/14)
    try { enemyMutMaybeApply(run, enemy); } catch { /* abaikan */ }
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
    // V2 P3: peti boss = suntikan ANTIBODI (resource evolusi) — bukan fragmen
    // evolusi lama, bukan Bio-Point. Membuat mutasi akhir run terjangkau.
    const bonusBio = Math.round(antibodyForKill('boss', run.heroDef && run.heroDef.id) * 0.5);
    run.bossChest = { currency: bonusCurrency, bio: bonusBio, doubled: false };
    setPaused(true);
    audio.chest();
    emit('bosschest', {
      currency: bonusCurrency,
      bio: bonusBio,
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
    const bio = (chest.bio || 0) * (doubled ? 2 : 1);
    meta.currency += currency;
    // P3: peti boss menambah ANTIBODI (resource evolusi), bukan Bio-Point.
    earnAntibody(run, bio, { source: 'boss_chest', particles: 14 });
    writeSave(meta);
    run.bossChest = null;
    emit('toast', { message: `Peti boss: +${currency} Biokredit${bio > 0 ? ` · +${bio} Antibodi` : ''}${doubled ? ' (2x!)' : ''}`, kind: 'gold' });
    setPaused(false);
    emit('resume');
  },

  /**
   * Aktivasi kemampuan aktif via tombol HUD / keyboard (slot 1-4).
   * @returns {boolean} true bila kemampuan terluncur.
   */
  /**
   * PHAGOS: jepit entitas ke dalam lingkaran arena (cawan petri).
   * @param {object} ent {x, y} yang digeser bila di luar dinding
   * @param {number} margin jarak aman dari dinding (radius entitas)
   */
  arenaClamp(ent, margin = 0) {
    const B = this.run && this.run.arenaBounds;
    if (!B || !ent) return;
    const dx = ent.x - B.x, dy = ent.y - B.y;
    const maxR = Math.max(50, B.r - (margin || 0));
    const d = Math.hypot(dx, dy);
    if (d > maxR) {
      const k = maxR / (d || 1);
      ent.x = B.x + dx * k;
      ent.y = B.y + dy * k;
    }
  },

  /** PHAGOS: PULSE — ledakkan medan membran (tombol PULSE / Spasi / tombol 4). */
  triggerPulse() {
    if (!this.run || this.run.ended || STATE.levelUpOpen) return false;
    const ok = tryPulse(this, {});
    if (ok) audio.pulse(); // PHAGOS: Pulse = momen aksi utama → bunyi paling tebal
    return ok;
  },

  /** ADDENDUM §2 — Pulse paksa abaikan cooldown (Ledakan ATP). */
  triggerPulseForce() {
    if (!this.run || this.run.ended || STATE.levelUpOpen) return false;
    const ok = tryPulse(this, { ignoreCd: true });
    if (ok) audio.pulse();
    return ok;
  },

  /**
   * PHAGOS D5 — konteks eksekusi skill PASIF (dibangun sekali per pemicu).
   * Jurus menembus lapisan armor (Petir Sel NK vs Gram±/Prion).
   */
  skillCtx() {
    const run = this.run;
    const player = run.player;
    return {
      game: this,
      player,
      enemies: run.enemies,
      damage: player.stats.damage,
      effects: run.effects,
      camera: run.camera,
      hitEnemy: (enemy, dmg) => {
        const died = enemy.takeDamageRaw ? enemy.takeDamageRaw(dmg) : enemy.takeDamage(dmg);
        this.spawnHitFeedback(enemy, dmg, died, false, { sourceKind: 'skill' });
        if (died) this.onEnemyKilled(enemy, 'skill');
      },
    };
  },

  /**
   * PHAGOS D5 — tembakkan SEMUA skill pasif yang terpicu `trigger`
   * ('pulse'/'engulf'/'kill'/'damaged'). Guard kedalaman 2 mencegah rantai
   * rekursif (skill → kill → skill → ...) meledak.
   */
  fireSkillTrigger(trigger) {
    const run = this.run;
    if (!run || run.ended || !run.player.alive) return;
    const depth = run._skillNotifyDepth || 0;
    if (depth >= 2) return;
    run._skillNotifyDepth = depth + 1;
    try {
      run.skills.notify(trigger, this.skillCtx());
    } finally {
      run._skillNotifyDepth = depth;
    }
  },

  /**
   * PHAGOS D5 — umumkan progresi skill pasif saat level naik:
   * toast aktivasi (Lv 3/5/10) + toast rank 2 otomatis (Lv 15).
   */
  announceSkillProgress(level) {
    const run = this.run;
    if (!run || !run.skills) return;
    for (let i = 0; i < run.skills.slots.length; i++) {
      if (level === SKILL_UNLOCK_LEVELS[i]) {
        const def = run.skills.slots[i].def;
        run.effects.spawnLabel(run.player.x, run.player.y - 56, `${def.name} AKTIF!`, '#8df7d2');
        emit('toast', { message: `${def.name} aktif — picu: ${SKILL_TRIGGER_LABEL[def.trigger] || def.trigger}`, kind: 'gold' });
      }
    }
    if (level === SKILL_RANK2_LEVEL) {
      emit('toast', { message: 'Semua skill pasif → RANK 2! (+28% damage, −7% cooldown)', kind: 'gold' });
    }
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
  /** PHAGOS Sprint 1 (bible §5.1): XP dari tipe kill. source = string cause
   * ('contact'/'pulse'/'engulf'/...) dari membran & skill, objek proj, atau null. */
  xpForKillCause(enemy, source) {
    let tbl = null;
    try { tbl = getData().upgrades.xpByKillType; } catch { /* fallback bawah */ }
    tbl = tbl || { contact: 3, pulse: 5, engulf: 4, boss: 60, other: 3 }; // D14: engulf 4
    if (enemy.isBoss) return tbl.boss;
    if (typeof source === 'string' && tbl[source] !== undefined) return tbl[source];
    return tbl.other;
  },
  /** Sprint 3.17 (bible §6.2): Biokredit per TIPE kill (cermin xpForKillCause). */
  bkForKillCause(enemy, source) {
    let tbl = null;
    try { tbl = getData().upgrades.bkByKillType; } catch { /* fallback bawah */ }
    tbl = tbl || { contact: 1, pulse: 1.5, engulf: 2, boss: 60, other: 1 };
    if (enemy.isBoss) return tbl.boss;
    if (typeof source === 'string' && tbl[source] !== undefined) return tbl[source];
    return tbl.other;
  },

  onEnemyKilled(enemy, source) {
    const run = this.run;
    run.kills += 1;
    tutorial.notifyKill();
    passiveOnKill(run, this); // V2 Phase 3: heal Mako / frenzy Neo
    onAntigenKill(run, enemy, this); // R3 Modul A: memori antigen per tipe
    cascadeOnDeath(this, enemy); // R6 Modul D: tagged mati → rantai opsonisasi
    this.fireSkillTrigger('kill'); // PHAGOS D5: skill pasif pemicu 'kill'

    // R4 Modul B: korban TELAN dikonversi resource (heal+fuel di tryDevour) —
    // TANPA drop XP/Biokredit/Genom normal — efek visual tetap.
    if (enemy.devoured) {
      run.effects.spawnBurst(enemy.x, enemy.y, '#ffd93d', getRetention().particles.enemyDeath, 150, 4);
      // PACING D14: korban telan (skill devour) = engulf → 4 XP.
      // Drop tetap tidak ada (trade-off jalur skill — D9; engulf membran tetap full kill).
      this.addXP(this.xpForKillCause(enemy, 'engulf'));
      audio.engulf();
      return;
    }

    // ---- PHAGOS Sprint 1 (bible §5.1): XP per TIPE kill — kontak 3, Pulse 5, engulf 4, boss 60 ----
    const killXp = this.xpForKillCause(enemy, source);
    this.addXP(killXp);
    // ---- Sprint 3.17 (bible §6.2): Biokredit LANGSUNG per tipe kill ----
    const killBk = this.bkForKillCause(enemy, source);
    run.currencyEarned += killBk;
    run.effects.spawnLabel(enemy.x, enemy.y - enemy.radius - 22, `+${killXp} XP · +${killBk} BK`, '#cde86b');

    // ---- P3 (IAP §5): ANTIBODI per kill + umpan balik berantai ----
    // Rantai wajib: musuh mati → partikel → label "+N ANTIBODI" → dompet HUD.
    // Bukan sekadar mengubah angka.
    {
      const kind = enemy.isBoss ? 'boss' : (enemy.def.elite ? 'elite' : 'normal');
      const jumlah = antibodyForKill(kind, run.heroDef && run.heroDef.id, run.antibodyMult || 1);
      earnAntibody(run, jumlah, {
        x: enemy.x, y: enemy.y - (enemy.radius || 12) - 6, source: kind,
        color: kind === 'boss' ? '#f5c64f' : '#8df7d2',
        particles: kind === 'boss' ? 18 : (kind === 'elite' ? 10 : 5),
      });
      recordEconomyEvent('enemy_killed', { kind, source: source || 'kill' });
    }

    // Sprint 3.17: earn BK LANGSUNG per kill (lihat atas) — drop koin per tier
    // DICABUT (double-count). HARD: nutrisi bonus saja.
    if (!enemy.isBoss && (enemy.def.tier || 'medium') === 'hard') {
      if (Math.random() < 0.6) {
        const bonusId = Math.random() < 0.5 ? 'vitamin_c' : 'amino';
        const bonusDef = getData().nutrients.nutrients.find((n) => n.id === bonusId);
        if (bonusDef) run.pickups.push(new Pickup(bonusDef, enemy.x + 14, enemy.y - 10));
      }
    }

    // ---- JUICE: hit-stop + SFX kill ----
    // PHAGOS: korban yang DITELAN beda bunyi dari kill kontak/Pulse (basah).
    if (source === 'engulf') audio.engulf(); else audio.kill();
    // V2 Phase 1: hit-stop BERLAPIS dari data (kill biasa juga dapat "berat")
    const gf = getGameFeel();
    if (enemy.isBoss) { this.hitStopRun(gf.hitStop.boss); buzz('boss'); }
    else if (enemy.def.elite) { this.hitStopRun(gf.hitStop.elite); buzz('elite'); }
    else {
      // RONDE-7: kill biasa tidak menumpuk freeze — cadence PULSE tetap
      // responsif penuh di tengah keroyokan.
      // PHAGOS: kill kontak lebih kecil dari kill Pulse (hierarki aksi).
      const isMembraneKill = source == null || typeof source === 'string'; // PHAGOS Sprint 1: cause string = kill membran
      if (run.hitStopCool <= 0) {
        this.hitStopRun(isMembraneKill ? (gf.hitStop.membraneKill ?? 0.015) : gf.hitStop.kill);
        run.hitStopCool = 0.24;
      }
      buzz('kill');
    }
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
      // ADDENDUM §2.2 — boss bisa menjatuhkan Marker Opsonin (25%)
      if (Math.random() < 0.25 && STATE.meta) {
        STATE.meta.consumables = STATE.meta.consumables || {};
        STATE.meta.consumables.opsonin = (STATE.meta.consumables.opsonin || 0) + 1;
        try { writeSave(STATE.meta); } catch { /* abaikan */ }
        emit('toast', { message: 'Boss menjatuhkan Marker Opsonin!', kind: 'gold' });
      }
      run.boss = null;
      run.camera.addShake(0.65);
      audio.bossDie();
      if (run.chapterBoss === enemy) {
        // KAMPANYE: boss bab tumbang → ORGAN BERSIH → menang
        run.objective.bossDefeated = true;
        emit('toast', { message: `${enemy.bossName || 'Boss'} tumbang! Organ bersih!`, kind: 'gold' });
        this.winRun();
      } else {
        emit('toast', { message: tr(`Sel Kanker dikalahkan! +${killXp} XP`), kind: 'gold' });
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

    // D9 (roadmap): korban TELAN = trade-off — heal+Bio, TANPA drop fisik.
    // (XP + BK cause tetap jalan; boss chest/opsonin tidak diganggu.)
    const devoured = source === 'engulf' && !enemy.isBoss;
    // V2 P2: drop fragmen evolusi DIHAPUS. Progresi run = mutasi (dipilih saat
    // level-up), jadi tidak ada lagi item fragmen yang perlu dipungut.
    void devoured;

    // PHAGOS Sprint 1 (bible §5): XP di-grant LANGSUNG saat kill (lihat atas) —
    // orb XP kill dicabut (sebelumnya double-grant: langsung + orb).
    const nutrients = getData().nutrients;

    // Fase 9: Toksin hancur → meninggalkan genangan racun (area hazard)
    if (enemy.def.id === 'toksin' && !enemy.isBoss) {
      run.hazards.push({ x: enemy.x, y: enemy.y, r: Math.max(34, enemy.radius * 2.1), dps: 5, life: 9 });
    }

    // ---- Bonus drop (heal/currency/magnet) ----
    if (devoured) {
      // D9: tidak ada bonus drop dari korban telan
    } else if (enemy.isBoss) {
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

    // PHAGOS: Reaksi Berantai — kill di medan memicu mini-pulse (maks 5 rantai)
    try {
      const depth = this._chainDepth || 0;
      if (depth < 5) {
        this._chainDepth = depth + 1;
        membraneOnKill(this, enemy, depth);
        this._chainDepth = depth;
      }
    } catch { /* abaikan */ }

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
    // RONDE-7: bark naratif (presenter-layer z 340) jangan menempel di atas
    // menu pause — dulu menelan tombol LANJUT (#btn-resume) sampai terasa mati.
    try { hidePresenter(); } catch { /* presenter belum siap di fase tes */ }
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
    audio.revive();

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
    audio.victory(); // fanfare kemenangan
    this.finishRun(false);
  },

  finishRun(quit) {
    const run = this.run;
    if (!run || run.ended) return;
    run.ended = true;
    if (!run.victory) audio.gameover(); // fanfare kalah (menang sudah bunyi di winRun)

    const meta = STATE.meta;
    const doubleMult = (run.itemBuffs && run.itemBuffs.katalis) ? 1.5 : 1; // ADDENDUM §2: Katalis Mitosis
    // Sprint 3.17 (bible §6.2): earn BK sudah LIVE per kill/wave — rumus bonus
    // akhir run (wave×8 + kills×0.5 + boss×50) DICABUT. Sisa: chapter/endless bonus.
    const earned = Math.round((run.currencyEarned + (run.bonusCurrency || 0)) * doubleMult);
    run.earned = earned;
    const victory = !!run.victory;

    // Statistik permanen (wins → membuka mode Endless)
    if (victory) meta.stats.wins = (meta.stats.wins || 0) + 1;
    // KAMPANYE: bab bersih → tandai + pasukan imun permanen bertambah (+1/bab, maks 6)
    if (victory && run.chapter) {
      meta.campaignCleared = meta.campaignCleared || {};
      const tierIdx = run.chapterTier ? run.chapterTier.tier : 0;
      meta.campaignCleared[run.chapter.id] = Math.max(meta.campaignCleared[run.chapter.id] || 0, tierIdx);
      const clearedCount = Object.keys(meta.campaignCleared).length;
      meta.allies = Math.min(6, Math.max(meta.allies || 1, 1 + clearedCount));
    }
    meta.stats.totalKills += run.kills;
    meta.stats.bossKills += run.bossKills;
    meta.stats.totalEngulfs = (meta.stats.totalEngulfs || 0) + ((run.membrane && run.membrane.stats && run.membrane.stats.engulfCount) || 0);
    meta.stats.bestWave = Math.max(meta.stats.bestWave, run.spawnSys.wave);
    meta.stats.bestSurvivalTime = Math.max(meta.stats.bestSurvivalTime, Math.floor(run.time));
    meta.stats.totalSurviveSeconds += Math.floor(run.time);
    meta.stats.totalRuns += 1;
    meta.stats.totalNutrients += run.nutrientsCollected;
    meta.stats.totalXP += Math.floor(run.xpGained);
    addCurrency(meta, earned);

    // V2: Battle Pass & Pangkat DIHAPUS. Hasil run hanya mengalir ke Antibodi
    // (satu-satunya resource) — sudah dilakukan oleh addCurrency() di atas.

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
        message: `MASTERY ${run.heroDef.name} Lv ${masteryRes.level}${masteryRes.title ? ` — ${masteryRes.title}` : ''}! +${masteryRes.reward} Genom`,
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
      emit('toast', { message: `Misi "${m.name}" selesai! +${m.reward} Biokredit`, kind: 'gold' });
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
      heroId: run.heroDef ? run.heroDef.id : null,
      engulfs: (run.membrane && run.membrane.stats && run.membrane.stats.engulfCount) || 0,
      antibody: runAntibody(run),
      antibodySpent: run.antibodySpent || 0,
      pulses: (run.membrane && run.membrane.stats && run.membrane.stats.pulseCount) || 0,
      xpGained: Math.floor(run.xpGained),
      nutrients: run.nutrientsCollected,
      parts: run.partsCollectedTotal,
      mutations: (run.activeMutations || []).length, // P2: progresi run = mutasi
      evoStage: (run.evoStage && run.evoStage.id) || 'base',
      level: run.level,
      currencyEarned: earned,
      newMissions: completedMissions.length,
      // V2 Phase 6: mastery hero yang dipakai run ini
      mastery: run.masteryGain ? {
        heroName: run.heroDef.name,
        xp: run.masteryGain.xp,
        level: run.masteryGain.level,
        levelsGained: run.masteryGain.levelsGained,
        title: run.masteryGain.title,
      } : null,
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
    // P4 §47: landmark zona — struktur yang DIINGAT pemain ("saya sudah
    // melewati gugus alveoli itu"), bukan nomor stage.
    try { drawLandmark(ctx, run, (wx, wy) => P.project(wx, wy)); } catch { /* abaikan */ }

    /** Billboard: sprite "berdiri" di ground — skala per-kedalaman, tanpa squash. */
    const billboard = (x, y, { lift = 0, flip = 1, tilt = 0, sx = 1, sy = 1 } = {}) => {
      const q = P.project(x, y);
      ctx.save();
      ctx.translate(q.x, q.y - lift * q.s);
      if (tilt) ctx.rotate(tilt);
      ctx.scale(q.s * flip * sx, q.s * sy);
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

    // ===== PHAGOS: LAPISAN MEDAN MEMBRAN (di atas background, di bawah hero) =====
    try { this.renderMembraneLayer(ctx, run, time, ground, billboard); } catch (err) { console.warn('[phagos] renderMembrane:', err); }
    // V2 §19: bentuk TELEGRAPH serangan digambar di lantai SEBELUM eksekusi
    try { drawAttack(ctx, run, ground); } catch (err) { console.warn('[phagos] drawAttack:', err); }
    try { this.renderArenaWall(ctx, run, time, ground); } catch (err) { console.warn('[phagos] renderArenaWall:', err); }

    // ===== LAPISAN BILLBOARD (diurutkan per kedalaman — painter's algorithm) =====
    const bobOf = { player: 0 };
    // LOCOMOTION V2: bob / condong / squash dihitung di player.update() —
    // SATU sumber kebenaran, entah dari rig Rive (data/…/hero-locomotion.riv)
    // atau rumus cadangannya. game.js hanya MEMAKAI nilai itu supaya tidak
    // pernah ada dua rumus yang tidak sinkron antara update dan render.
    const pAnim = player.anim || { bob: 0, tilt: 0, sx: 1, sy: 1 };
    const pBob = pAnim.bob || 0;
    bobOf.player = pBob;
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
        // V2 §15 SUPPORT: aura pendukung — telegraph tumbuh dulu, baru menyala.
        // Kalau pemain melihat cincin ini, ia masih punya waktu untuk membekukan
        // atau membunuh pendukungnya sebelum buff menyala.
        if (e.auraCfg) {
          const cfgA = e.auraCfg;
          const warnaA = cfgA.color || '#b39ddb';
          ground(e.x, e.y + e.radius * 0.9);
          if (e.auraWindup > 0) {
            const tA = 1 - Math.max(0, e.auraWindup) / (cfgA.telegraphSec || 0.5);
            ctx.strokeStyle = warnaA;
            ctx.globalAlpha = 0.35 + 0.45 * tA;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([7, 6]);
            ctx.beginPath();
            ctx.arc(e.x, e.y + e.radius * 0.9, (cfgA.radius || 150) * (0.3 + 0.7 * tA), 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          } else if (e.auraPulseFx > 0) {
            const kA = Math.max(0, e.auraPulseFx) / 0.45;
            ctx.strokeStyle = warnaA;
            ctx.globalAlpha = 0.85 * kA;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(e.x, e.y + e.radius * 0.9, (cfgA.radius || 150) * (1.05 - 0.25 * kA), 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.strokeStyle = warnaA;
            ctx.globalAlpha = 0.22;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(e.x, e.y + e.radius * 0.9, (cfgA.radius || 150) * 0.35, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        // V2 §15 SUPPORT: musuh yang SEDANG dikuatkan aura (cincin terang)
        if (e.auraBuffT > 0) {
          ground(e.x, e.y + e.radius * 0.9);
          ctx.strokeStyle = e.auraColor || '#b39ddb';
          ctx.globalAlpha = 0.45 + 0.25 * Math.abs(Math.sin(time * 6));
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(e.x, e.y + e.radius * 0.9, e.radius * 1.45, 0, Math.PI * 2);
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
        // ADDENDUM §2 — Opsonin: cincin emas putus-putus di musuh bertanda
        if ((e.opsoninUntil || 0) > (this.run.time || 0)) {
          ground(e.x, e.y + e.radius * 0.9);
          ctx.strokeStyle = '#ffd166';
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(e.x, e.y + e.radius * 0.9, e.radius * 1.55, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        // PHAGOS: STRAIN BERMUTASI — tint jelas + ring mutasi (tidak subtle)
        if (e.mutTrait) {
          ground(e.x, e.y + e.radius * 0.9);
          ctx.strokeStyle = e.mutTint || '#c39bd3';
          ctx.globalAlpha = 0.75;
          ctx.lineWidth = 3.5;
          ctx.setLineDash([7, 4]);
          ctx.beginPath();
          ctx.arc(e.x, e.y + e.radius * 0.9, e.radius * 1.3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
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
        // PHAGOS: label STRAIN BERMUTASI (5 dtk pertama setelah spawn)
        try {
          const mutLbl = mutationLabelFor(e);
          if (mutLbl) {
            ctx.font = '900 8px Nunito, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = e.mutTint || '#c39bd3';
            ctx.strokeStyle = 'rgba(18,63,58,0.9)';
            ctx.lineWidth = 3;
            const my = e.y - e.radius - (e.eliteAffix ? 28 : 16);
            ctx.strokeText(mutLbl, e.x, my);
            ctx.fillText(mutLbl, e.x, my);
          }
        } catch { /* abaikan */ }
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
    // V2 archetype SUMMON: entitas biologis sementara (punya umur)
    for (const sm of run.summons || []) {
      draws.push({ y: sm.y, fn: () => {
        const fade = Math.min(1, (sm.life - sm.t) / 1.5); // memudar sebelum habis
        billboard(sm.x, sm.y, { lift: sm.radius * 0.55 });
        ctx.globalAlpha = 0.35 + 0.4 * fade;
        drawPulseGlow(ctx, sm.x, sm.y, sm.radius * 1.6, sm.color, time, sm.angle, 0.7);
        ctx.globalAlpha = fade;
        drawSprite(ctx, sm.sprite, sm.x, sm.y, sm.radius * 2.4, 0, { alpha: fade });
        ctx.globalAlpha = 1;
        ctx.restore();
      } });
    }
    if (player.alive) {
      draws.push({ y: player.y, fn: () => {
        // PHAGOS Nyx: menghilang total 0,5 dtk saat Pulse (invincible)
        if (run.membrane && run.membrane.vanishT > 0) return;
        const blink = player.iframes > 0 && player.iframes < 900 && Math.floor(time * 12) % 2 === 0;
        if (!blink) {
          // UI-REBUILD P8: BENTUK MUTASI = foto karakter itu sendiri (bukan lagi
          // overlay mut_*.png yang ditumpuk). Kalau fotonya belum tersedia untuk
          // hero ini, pakai sprite dasar seperti sediakala.
          const _muts = run.activeMutations || [];
          // P2: BENTUK karakter mengikuti POHON EVOLUSI (BASE → MUT1 → MUT2 →
          // APEX) — sumber tunggalnya data/evolutions.json, bukan lagi tier
          // mutasi mentah. Bila foto tingkat itu belum ada, turun ke tingkat
          // bawahnya; terakhir ke sprite dasar.
          const _evo = run.evoStage || evoStageFor(run, player.heroDef);
          const _evoId = _evo.id || 'base';
          const _wantStage = _evo.spriteKey === 'spriteMut2Idle' ? 2 : (_evo.spriteKey === 'spriteMut1Idle' ? 1 : 0);
          const _attacking = player.attackFlash > 0;
          const _mutPair = (stage) => [
            _attacking ? player.heroDef[`spriteMut${stage}Attack`] : player.heroDef[`spriteMut${stage}Idle`],
            _attacking ? player.heroDef[`spriteMut${stage}Idle`] : null, // cadangan satu pose bila pose ini belum ada
          ];
          let path = _attacking ? player.heroDef.spriteAttack : player.heroDef.spriteIdle;
          if (_wantStage > 0) {
            const stages = _wantStage === 2 ? [2, 1] : [1];
            for (const st of stages) {
              const [main, fallback] = _mutPair(st);
              if (hasSprite(main)) { path = main; break; }
              if (fallback && hasSprite(fallback)) { path = fallback; break; }
            }
          }
          // UI-REBUILD P8: gerakan NATURAL ke semua arah.
          //  · flip dihaluskan (animFlip lewat 0 saat berbalik → badan menipis
          //    sesaat, bukan langsung jump ke sisi lain).
          //  · condong searah jalan (kiri/kanan) — dikalikan animFlip karena
          //    mirror membalik arah rotasi.
          //  · ayunan halus saat berjalan + tebasan saat Pulse.
          //  · gerak vertikal (atas/bawah) jadi squash-stretch halus (sx/sy),
          //    jadi mendekat terasa "membesar" dan menjauh "mengecil".
          const _rawFlip = typeof player.animFlip === 'number' ? player.animFlip : (Math.cos(player.facing) < 0 ? -1 : 1);
          const _sgn = _rawFlip < 0 ? -1 : 1;
          const flip = _sgn * Math.max(0.14, Math.abs(_rawFlip)); // jangan pernah 0 (sprite hilang)
          const _flipAbs = Math.max(0.14, Math.abs(_rawFlip));
          // condong sudah termasuk lean searah jalan + ayunan langkah +
          // miring ke arah belokan (inersia). Dikalikan arah mirror karena
          // sprite yang dibalik membalik arah rotasi.
          const tilt = (pAnim.tilt || 0) * _sgn * _flipAbs + pSwingTilt * _sgn;
          const sx = pAnim.sx || 1;   // squash-stretch dari rig (atau cadangan)
          const sy = pAnim.sy || 1;
          billboard(pBody.x, pBody.y, { lift: player.radius * 0.62 + pBob, flip, tilt, sx, sy });
          const bodySize = player.radius * 2.667 * (player.squash > 0 ? 1 + Math.sin(time * 48) * 0.06 : 1);
          // P2: overlay equity lama DICABUT — bentuk evolusi adalah FOTO
          // karakter sendiri (path dipilih dari tahap pohon evolusi di atas).
          drawSprite(ctx, path, pBody.x, pBody.y, bodySize, 0, {});
          // APEX: aura emas prosedural (bukan tempelan gambar) — penanda
          // puncak pohon evolusi hero.
          if (_evoId === 'apex') {
            drawPulseGlow(ctx, pBody.x, pBody.y, player.radius * 1.9, '#f5c64f', time, 0, 0.5);
          }
          // UI-REBUILD P8: overlay mut_*.png DICABUT — mutasi kini mengganti
          // FOTO karakter (lihat pemilihan `path` di atas). Yang tersisa cuma
          // aura kanvas tipis yang ikut jumlah mutasi (bukan tempelan gambar):
          // makin banyak mutasi, rim energi makin terang.
          if (_muts.length > 0) {
            const _tier = _muts.reduce((mx, id) => Math.max(mx, (mutationDef(id)?.tier) || 1), 1);
            const _glowColor = _tier >= 3 ? '#ffd166' : (_tier === 2 ? '#8df7d2' : '#7fe3d0');
            const _glowA = Math.min(0.55, 0.12 + _muts.length * 0.07);
            drawPulseGlow(ctx, pBody.x, pBody.y, player.radius * 1.35, _glowColor, time, 0, _glowA);
          }
          // V2: aksesori kosmetik (aura/mahkota) DIHAPUS — identitas karakter
          // berasal dari evolusi/mutasi, bukan dari toko skin (V2 §3).
          if (false) {
            const cy = pBody.y - bodySize * 0.62 + Math.sin(time * 2.4) * 1.5;
            const cw = bodySize * 0.3, ch = bodySize * 0.14;
            const crownAcc = null;
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
    // PHAGOS: flash merah saat patogen bermutasi (sinyal anti-curang)
    if (run._mutationFlashT > 0) {
      ctx.fillStyle = `rgba(214,38,61,${Math.min(0.28, run._mutationFlashT * 0.25)})`;
      ctx.fillRect(0, 0, w, h);
    }
    cam.drawBossIndicatorIfOffscreen(ctx, run.boss, w, h, time);
    drawNestHint(ctx, run, cam.x, cam.y, w, h, time); // F26: petunjuk arah sarang terdekat
    drawJoystick(ctx, this.input.joystick, this.input.maxRadius, drawImageAt);

    // ---- HUD DOM + minimap ----
    if (STATE.screen === 'gameplay' || STATE.screen === 'gameover') {
      let pulse = null;
      try { pulse = run.membrane ? pulseView(run) : null; } catch { pulse = null; }
      updateHUD({
        hpPct: player.hp / player.maxHP,
        hpText: `${Math.ceil(player.hp)}/${player.maxHP}`,
        xpPct: run.xp / xpToNextLevel(run.level),
        wave: run.spawnSys.wave,
        abilities: run.skills.getView(run.level),
        pulse,
        antibody: runAntibody(run),
        nextMutationCost: mutationCost((run.activeMutations || []).length + 1),
        ecoPhase: economyPhase((run.activeMutations || []).length),
        activeMutations: run.activeMutations || [],
        // P2: tahap pohon evolusi (BASE → MUT1 → MUT2 → APEX) tampil di HUD
        evoStage: run.evoStage ? { id: run.evoStage.id, name: run.evoStage.name, tierColor: run.evoStage.tierColor } : null,
        membraneLiving: run.membrane && run.membrane.livingMaxHp > 0
          ? { hp: run.membrane.livingHp, max: run.membrane.livingMaxHp, down: run.membrane.livingDownT > 0 }
          : null,
        mission: run.objective
          ? { quota: run.objective.quota, kills: run.kills, bossSpawned: run.objective.bossSpawned, bossName: run.chapter && run.chapter.boss ? run.chapter.boss.name : null }
          : null,
        timerText: this.formatTime(run.time),
        kills: run.kills,
        currency: run.currencyEarned,
        gate: run.spawnSys.isGateBlocked(),
        gateBank: Math.round((run.xpBank || 0) * 10) / 10,
        level: run.level,
        // P4 §26: progres perjalanan minimal (zona sekarang → berikutnya)
        journey: journeyHud(run),
        boss: run.boss && run.boss.alive ? { name: run.boss.def.name, pct: run.boss.hp / run.boss.maxHP } : null,
      });
      const mmCtx = getMinimapContext();
      if (mmCtx) {
        drawMinimap(mmCtx, mmCtx.canvas, run, player, 760);
      }
    }

    // P2 §9: sinematik mutasi digambar paling atas (dunia sedang dibekukan).
    if (cineActive()) drawMutationCinematic(ctx, w, h, time);
  },

  /**
   * PHAGOS Tahap 11 — render medan membran + efek mutasi kumulatif.
   * Layer: trail racun → cloud histamin → medan utama (+pulse expand) →
   * dual-ring → satelit → membran mini pasukan. Semua ground-space.
   */
  /**
   * PHAGOS: dinding kaca cawan petri — lingkaran putus-putus berputar pelan.
   * Selalu terlihat saat kamera dekat tepi; di luar jangkau = di-skip.
   */
  renderArenaWall(ctx, run, time, ground) {
    const B = run.arenaBounds;
    if (!B || !B.r) return;
    const player = run.player;
    // Skip bila seluruh lingkaran jauh di luar layar (hemat fill-rate)
    const vw = this.viewW || 900, vh = this.viewH || 600;
    if (Math.hypot(player.x - B.x, player.y - B.y) > B.r + Math.hypot(vw, vh)) return;
    let wallColor = '#7fe3d0';
    try { wallColor = (getMembrane() && getMembrane().arena && getMembrane().arena.wallColor) || wallColor; } catch { /* abaikan */ }
    ground(B.x, B.y);
    // Cahaya kaca: ring luar lembut
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = wallColor;
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(B.x, B.y, B.r, 0, Math.PI * 2);
    ctx.stroke();
    // Dinding: garis putus berputar pelan
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 3.5;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -time * 26;
    ctx.beginPath();
    ctx.arc(B.x, B.y, B.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    // Kilau dalam: ring tipis statis
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(B.x, B.y, B.r - 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  renderMembraneLayer(ctx, run, time, ground, billboard) {
    const mem = run.membrane;
    if (!mem || !run.player.alive) return;
    const player = run.player;
    const heroColor = run.heroDef?.color || '#35d0ba';
    let st = null;
    try { st = getMembraneStats(run); } catch { return; }
    const fx = st.fx;
    const acts = run.activeMutations || [];
    const has = (id) => acts.includes(id);

    // Warna adaptif (mutasi adaptif): geser sesuai musuh dominan
    let fieldColor = heroColor;
    if (st.adaptive?.color) fieldColor = st.adaptive.color;
    if (has('lengket')) fieldColor = '#6cf2a3';
    if (has('penyerap')) fieldColor = '#2b3a55';
    if (has('regenerasi') && mem.activeContacts === 0) fieldColor = '#5eff8a';

    // ---- Jejak toksik (beracun) ----
    for (const tr of mem.trail) {
      const fade = 1 - tr.t / tr.life;
      ground(tr.x, tr.y);
      ctx.globalAlpha = 0.35 * fade;
      ctx.fillStyle = '#a8e10c';
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.r * (0.7 + 0.3 * fade), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // ---- Awan histamin (Baso pulse) ----
    for (const c of mem.clouds) {
      const fade = 1 - c.t / c.life;
      ground(c.x, c.y);
      ctx.globalAlpha = 0.28 * fade;
      ctx.fillStyle = '#b678e0';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5 * fade;
      ctx.strokeStyle = '#8e44ad';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ---- Medan utama ----
    const pulsing = mem.pulseAnimT >= 0;
    const peak = mem.pulsePeak || 0;
    // Radius visual: idle berdenyut 0.97–1.03 (1.5 dtk), pulse expand ke pulseRadius
    const idleOsc = has('elastis')
      ? 0.94 + 0.06 * Math.sin((time / 1.5) * Math.PI * 2) + 0.02 * Math.sin(time * 9)
      : 0.97 + 0.03 * Math.sin((time / 1.5) * Math.PI * 2);
    const breathe = has('medan_hidup') ? 1 + 0.05 * Math.sin(time * 2.2) : 1;
    let visR = st.radius * idleOsc * breathe;
    let alpha = mem.activeContacts > 0 ? 0.35 : 0.2;
    if (has('tipis')) alpha *= 0.6;
    if (pulsing) {
      visR = st.radius + (st.pulseRadius - st.radius) * peak;
      alpha = 0.2 + 0.4 * peak;
    }
    if (mem.shape === 'pulse_only' && !pulsing) {
      // Mastia: tidak ada medan pasif — hanya ring cooldown tipis
      ground(player.x, player.y);
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = heroColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, 64, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.restore();
    } else if (mem.shape !== 'pulse_only' && mem.livingDownT <= 0) {
      const invisible = mem.shape === 'invisible';
      if (invisible) alpha *= 0.25; // Nyx: nyaris tak terlihat (tetap ada petunjuk samar)
      this.drawMembraneShape(ctx, ground, player, mem, visR, fieldColor, alpha, time, { pulsing, peak, has, fx, st });
      // ADDENDUM §2 — Membran Cadangan: cincin kedua 0,5× saat aktif
      if (this.run && this.run.itemBuffs && (this.run.time || 0) < (this.run.itemBuffs.cadanganUntil || 0)) {
        ground(player.x, player.y);
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 6);
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(player.x, player.y, visR * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      // Dual ring: ring luar kedua
      if (fx.dualRing) {
        const outerR = st.radius * fx.outerRadiusMult * idleOsc;
        ground(player.x, player.y);
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = fieldColor;
        ctx.beginPath();
        ctx.arc(player.x, player.y, outerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = fieldColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, outerR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      // Cermin: kilau di permukaan
      if (has('cermin')) {
        ground(player.x, player.y);
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(time * 4);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(player.x, player.y, visR * 0.7, time % (Math.PI * 2), (time % (Math.PI * 2)) + 1.2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
    // Living membrane down: retakan merah
    if (mem.livingDownT > 0) {
      ground(player.x, player.y);
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, st.radius * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ---- Satelit simbiosis ----
    for (const s of mem.satellites) {
      const sx = player.x + Math.cos(s.angle) * s.dist;
      const sy = player.y + Math.sin(s.angle) * s.dist;
      ground(sx, sy);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(sx, sy, s.radius + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(sx, sy, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // ---- Membran mini pasukan (Opsi A) ----
    if (run.allies.length > 0 && st.contactDps > 0) {
      const sqR = st.radius * 0.5;
      for (const a of run.allies) {
        ground(a.x, a.y);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#4ae3c2';
        ctx.beginPath();
        ctx.arc(a.x, a.y, sqR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#4ae3c2';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(a.x, a.y, sqR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
    // PHAGOS desktop: indikator arah mouse (garis pendek + titik ke facing)
    if (run._mouseAimFresh && player.alive) {
      const fx0 = Math.cos(player.facing || 0), fy0 = Math.sin(player.facing || 0);
      const pr = (player.radius || 15);
      ground(player.x, player.y);
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(player.x + fx0 * (pr + 4), player.y + fy0 * (pr + 4));
      ctx.lineTo(player.x + fx0 * (pr + 30), player.y + fy0 * (pr + 30));
      ctx.stroke();
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(player.x + fx0 * (pr + 34), player.y + fy0 * (pr + 34), 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    void billboard;
  },

  /**
   * Gambar bentuk medan sesuai shape hero: circle/support/pulsing/invisible,
   * cone/cone_trail, tentacles. Tepi bergelombang organik (distorsi sinusoidal).
   */
  drawMembraneShape(ctx, ground, player, mem, visR, color, alpha, time, opts) {
    const { has } = opts;
    const spikes = has('berduri');
    const sticky = has('lengket');
    ground(player.x, player.y);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    const wob = (ang) => 1 + 0.03 * Math.sin(ang * 5 + time * 3) + 0.02 * Math.sin(ang * 9 - time * 4.2);
    const traceCircle = (r) => {
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const rr = r * wob(a);
        const x = player.x + Math.cos(a) * rr;
        const y = player.y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    const traceCone = (facing, arc, range) => {
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const a = facing - arc / 2 + (arc * i) / steps;
        const rr = range * wob(a);
        ctx.lineTo(player.x + Math.cos(a) * rr, player.y + Math.sin(a) * rr);
      }
      ctx.closePath();
    };
    const fillAndStroke = (lineW) => {
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = Math.min(1, alpha + 0.25);
      ctx.lineWidth = lineW;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    const shape = mem.shape;
    if (shape === 'cone') {
      const arc = (mem.shapeParams?.arcDeg ?? 90) * Math.PI / 180;
      const range = visR * (mem.shapeParams?.rangeMult ?? 1.6);
      traceCone(player.facing || 0, arc, range);
      fillAndStroke(sticky ? 5 : 2.5);
    } else if (shape === 'cone_trail') {
      const arc = 45 * Math.PI / 180;
      const range = visR * 1.6;
      const f = player.facing || 0;
      traceCone(f, arc, range);
      fillAndStroke(2.5);
      traceCone(f + Math.PI, arc, range);
      ctx.globalAlpha = alpha * 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (shape === 'tentacles') {
      const count = mem.shapeParams?.count ?? 3;
      const arc = (mem.shapeParams?.arcDeg ?? 32) * Math.PI / 180;
      const range = visR * (mem.shapeParams?.rangeMult ?? 1.9);
      const base = player.facing || 0;
      const sweepOff = mem.sweepT >= 0 ? (1 - mem.sweepT / 0.4) * Math.PI : 0;
      for (let i = 0; i < count; i++) {
        const dir = base + sweepOff + (i * Math.PI * 2) / count;
        traceCone(dir, arc, range);
        fillAndStroke(2);
      }
      // Inti kecil di pusat
      ctx.globalAlpha = alpha + 0.15;
      ctx.beginPath();
      ctx.arc(player.x, player.y, visR * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // circle / support / pulsing / invisible
      traceCircle(visR);
      fillAndStroke(sticky ? 6 : has('tipis') ? 1 : 2.5);
      // Berduri: duri tajam di tepi
      if (spikes) {
        ctx.globalAlpha = Math.min(1, alpha + 0.4);
        ctx.fillStyle = color;
        const n = 14;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + time * 0.6;
          const r0 = visR * wob(a);
          const r1 = r0 + 10 + 4 * Math.sin(time * 6 + i);
          const bx = player.x + Math.cos(a) * r0;
          const by = player.y + Math.sin(a) * r0;
          const tx = player.x + Math.cos(a) * r1;
          const ty = player.y + Math.sin(a) * r1;
          const px = -Math.sin(a) * 4, py = Math.cos(a) * 4;
          ctx.beginPath();
          ctx.moveTo(bx + px, by + py);
          ctx.lineTo(tx, ty);
          ctx.lineTo(bx - px, by - py);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
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
