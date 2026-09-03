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
import { triggerRewardedAdRevive } from '../systems/monetization.js';

import { Camera } from '../render/camera.js';
import { drawBackground } from '../render/background.js';
import {
  drawProjectile, drawParticle, drawPulseGlow, drawHealthBar, drawSwipeArc,
  drawBlastRing, drawTelegraph, drawJoystick, drawMinimap,
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
      emit('toast', { message: '💉 Serum Awal aktif: +25% damage run ini!', kind: 'gold' });
    }

    const startX = 0;
    const startY = 0;
    const upgrades = {};
    const stats = this.computePlayerStats(heroDef, upgrades);

    const player = new Player(heroDef, stats, startX, startY);

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
      ended: false,
      stats: { shotsFired: 0 },
    };

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

    run.time += dt;

    // 1. Input & player (gerak + auto-attack)
    const move = this.input.getMoveVector();
    player.update(dt, move, this);

    // 2. Wave & spawn
    const events = run.spawnSys.update(dt, this);
    if (events.newWave) {
      emit('wave', { wave: run.spawnSys.wave, isBoss: false });
      run.wave = run.spawnSys.wave;
    }

    if (events.bossSpawn) {
      emit('wave', { wave: run.spawnSys.wave, isBoss: true });
      emit('toast', { message: '☣️ SEL KANKER MUNCUL!', kind: 'danger' });
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
      if (died) this.onEnemyKilled(enemy, proj);
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

    // 10. Efek & partikel
    run.effects.update(dt);

    // 11. Kamera follow + shake decay
    run.camera.follow(player.x, player.y, dt);
    run.camera.update(dt);

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
    run.effects.spawnCollect(p.x, p.y, p.def.color);

    switch (p.pickupType) {
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
        emit('toast', { message: '🧲 Sinyal sitokin! Semua nutrisi tertarik padamu.' });
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
      if (died) this.onEnemyKilled(e, null);
    });
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
    run.enemies.push(enemy);
    if (def.isBoss) {
      run.boss = enemy;
    }
  },

  /** Musuh mati: kill count, partikel, drop nutrisi, splitter, boss reward. */
  onEnemyKilled(enemy, source) {
    const run = this.run;
    run.kills += 1;
    run.effects.spawnBurst(enemy.x, enemy.y, enemy.def.color, enemy.isBoss ? 26 : 8, enemy.isBoss ? 300 : 150, enemy.isBoss ? 6 : 4);

    if (enemy.isBoss) {
      run.bossKills += 1;
      run.boss = null;
      run.camera.addShake(0.65);
      emit('toast', { message: '🏆 Sel Kanker dikalahkan! +' + enemy.xpPerKill + ' XP', kind: 'gold' });
    }

    // ---- Drop orb XP (nilai = xpPerKill musuh; skin sesuai nilai) ----
    const nutrients = getData().nutrients;
    const xpSkin = enemy.xpPerKill >= 5 ? getNutrientDef('amino') : getNutrientDef('glukosa');
    run.pickups.push(new Pickup(xpSkin, enemy.x, enemy.y, enemy.xpPerKill));

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
    emit('toast', { message: '✨ Sel regenerasi — lanjutkan pertempuran!', kind: 'gold' });
  },

  declineRevive() {
    this.finishRun(false);
  },

  // =====================================================================
  // AKHIR RUN — ekonomi, statistik, misi, save
  // =====================================================================
  finishRun(quit) {
    const run = this.run;
    if (!run || run.ended) return;
    run.ended = true;

    const meta = STATE.meta;
    const bonus = computeRunEndBonus(run);
    const earned = run.currencyEarned + bonus;
    run.earned = earned;

    // Statistik permanen
    meta.stats.totalKills += run.kills;
    meta.stats.bossKills += run.bossKills;
    meta.stats.bestWave = Math.max(meta.stats.bestWave, run.spawnSys.wave);
    meta.stats.bestSurvivalTime = Math.max(meta.stats.bestSurvivalTime, Math.floor(run.time));
    meta.stats.totalSurviveSeconds += Math.floor(run.time);
    meta.stats.totalRuns += 1;
    meta.stats.totalNutrients += run.nutrientsCollected;
    meta.stats.totalXP += Math.floor(run.xpGained);
    addCurrency(meta, earned);

    // Misi baru selesai → reward otomatis
    const completedMissions = checkMissions(meta);
    for (const m of completedMissions) {
      emit('toast', { message: `🏅 Misi "${m.name}" selesai! +${m.reward} 🛡️`, kind: 'gold' });
    }
    // Auto-unlock hero dari statistik
    const newlyUnlocked = checkAutoUnlocks(meta);
    for (const h of newlyUnlocked) {
      emit('toast', { message: `🔓 Hero baru terbuka: ${h.name}!`, kind: 'gold' });
    }

    writeSave(meta); // AUTO-SAVE akhir run

    setPaused(false);
    setScreen('gameover');
    emit('gameover', {
      quit,
      wave: run.spawnSys.wave,
      time: Math.floor(run.time),
      kills: run.kills,
      bossKills: run.bossKills,
      xpGained: Math.floor(run.xpGained),
      nutrients: run.nutrientsCollected,
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
        drawPulseGlow(ctx, player.x, player.y, player.radius * 1.5, player.heroDef.color, time, 0, 0.8);
        drawSprite(ctx, path, player.x, player.y, player.radius * 2.667, 0, {});
      }
    }

    // Proyektil (shape dinamis)
    for (const p of run.projectiles) {
      if (p.alive) drawProjectile(ctx, p, time);
    }

    // Efek (tebasan, blast) & partikel (shape dinamis)
    for (const fx of run.effects.effects) {
      if (fx.type === 'swipe') drawSwipeArc(ctx, fx);
      else if (fx.type === 'blast') drawBlastRing(ctx, fx);
    }
    for (const pt of run.effects.particles) {
      drawParticle(ctx, pt);
    }

    ctx.restore();

    // ---- Screen-space overlays ----
    cam.drawBossIndicatorIfOffscreen(ctx, run.boss, w, h, time);
    drawJoystick(ctx, this.input.joystick, this.input.maxRadius);

    // ---- HUD DOM + minimap ----
    if (STATE.screen === 'gameplay' || STATE.screen === 'gameover') {
      updateHUD({
        hpPct: player.hp / player.maxHP,
        hpText: `${Math.ceil(player.hp)}/${player.maxHP}`,
        xpPct: run.xp / xpToNextLevel(run.level),
        wave: run.spawnSys.wave,
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
