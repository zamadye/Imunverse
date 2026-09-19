/**
 * player.js — Entitas player (sel imun yang dikendalikan).
 * Statistik akhir dihitung dari: baseStats hero (JSON) × upgrade squad permanen
 * (meta) × upgrade in-run (level-up) × consumable (serum).
 * PHAGOS: TIDAK ADA serangan tombol — damage = kontak membran (pasif) +
 * PULSE (satu tombol). tryFire/performAttack MATI (badan dikomentari §13.8).
 */

import { PERSP } from '../render/camera.js';

import { audio } from '../systems/audio-system.js';
import { getCombat, getLocomotion } from '../core/data-store.js';
import { ensureMakoRive, updateMakoRive, setMakoRiveInput } from '../render/mako-rive.js';
// P7: rig merayap hasil PANGGANGAN GODOT — sumber gerak utama (anti mengambang)
import { crawlPose, crawlLobe } from '../systems/crawl-rig.js';

let nextPlayerId = 1;

export class Player {
  /**
   * @param {object} heroDef     definisi hero dari data/heroes.json
   * @param {object} stats       statistik turunan hasil computeStats() (dari game.js)
   * @param {number} x
   * @param {number} y
   */
  constructor(heroDef, stats, x, y) {
    this.id = nextPlayerId++;
    this.heroDef = heroDef;
    this.x = x;
    this.y = y;
    this.radius = heroDef.baseStats.radius;
    this.facing = 0;          // arah hadap (rad) — dipakai arah serangan & sprite
    this.squash = 0;          // JUICE: timer squash-stretch (dtk)
    this.stats = stats;       // di-recompute oleh game.js saat upgrade
    this.maxHP = stats.maxHP;
    this.hp = stats.maxHP;
    this.attackTimer = 0;     // hitungan mundur cooldown serangan
    this.iframes = 0;         // masa kebal setelah kena hit (detik)
    this.attackFlash = 0;     // timer untuk swap sprite attack
    this.swing = 0;           // Fase 12c: animasi tebasan respons tombol
    this.moving = false;
    this.walkPhase = 0; // Fase 12b: animasi jalan (bobbing)
    this.stepT = 0;     // (dipertahankan untuk pemanggil lama; debu kaki kini
                        //  dipicu oleh momen kaki menapak — lihat stepEvent)
    this.time = 0;      // waktu hidup hero (napas saat diam)
    // ---- LOCOMOTION V2 (foot-planting, putaran halus, bob & lean) ----
    this.facingTarget = 0;  // sudut yang DIKEJAR (bukan langsung diset)
    this.facingVel = 0;     // laju putar aktual (rad/dtk) → sumber lean belok
    this.turnLean = 0;      // condong ke arah belokan (inersia), rad
    this.stepIndex = 0;     // hitungan langkah (naik tiap kaki menapak)
    this.stepEvent = 0;     // 1 pada frame kaki menapak (untuk debu)
    this.stridePx = 48;     // panjang satu langkah (dihitung dari data)
    this.nominalSpeed = 144;// kecepatan saat animasi jalan berputar 1×
    this.rigActive = false; // true bila sumber locomotion non-analitik aktif
    this.anim = { bob: 0, tilt: 0, sx: 1, sy: 1, legSwing: 0, armSwing: 0, headTilt: 0, shear: 0, contact: 1 };
    this.rigSource = 'analytic'; // 'crawl' | 'rive-artboard' | 'analytic'
    this.time = 0;               // dipakai napas saat diam
    // ---- ANIMASI HALUS (UI-REBUILD P8) ----
    // Dulu sprite hanya dibalik kiri↔kanan secara instan (flip = ±1), jadi
    // gerakan terasa kaku dan tidak pernah bereaksi ke arah atas/bawah.
    // Sekarang semua ditahan oleh smoothing berbasis dt:
    this.animFlip = 1;  // -1..1, lewat 0 saat berputar → sprite "menipis" = berbalik
    this.moveAmt = 0;   // 0..1 seberapa kuat sedang berjalan (untuk bob & ayun)
    this.lean = 0;      // miring ke arah jalan (rad) — kiri/kanan
    this.depth = 0;     // -1..1 gerakan vertikal (menjauh → -1, mendekat → +1)
    this.vx = 0;        // V2 Phase 2: velocity smoothing (accel/decel)
    this.vy = 0;
    this.alive = true;
  }

  /**
   * Update pergerakan + cooldown + auto-attack.
   * @param {number} dt
   * @param {{x:number,y:number,magnitude:number}} move  vektor input
   * @param {object} game  context game (untuk query musuh & spawn proyektil)
   */
  update(dt, move, game) {
    if (!this.alive) return;

    // ---- Gerakan (delta-time based) ----
    // V2 Phase 2: velocity smoothing — ramp ~0.11s saat mulai, berhenti tajam
    // ~0.08s saat lepas (decel > accel). Bukan momentum licin; hanya
    // menghaluskan transisi supaya arah tidak patah-patah.
    const mv = getCombat().movement;
    const hasInput = move.magnitude > 0.01;
    let tvx = 0, tvy = 0;
    if (hasInput) {
      // R7 Modul E: buff jejak kemotaksis — pengali langsung per frame
      // (tanpa recompute stats; 1 bila flag OFF / tidak menyentuh jejak)
      const chemoMult = (game && game.run && game.run.chemoSpeedMult) || 1;
      const speed = this.stats.speed * chemoMult * Math.min(1, move.magnitude);
      tvx = move.x * speed;
      tvy = move.y * speed;
    }
    const k = 1 - Math.exp(-(hasInput ? mv.accel : mv.decel) * dt);
    this.vx += (tvx - this.vx) * k;
    this.vy += (tvy - this.vy) * k;
    // snap-to-zero: decay eksponensial tak pernah 0 — sisa kecepatan kecil
    // saat lepas input dipangkas supaya berhenti terasa TAJAM (spek §4.3)
    if (!hasInput && Math.hypot(this.vx, this.vy) < (mv.stopSnap || 40)) {
      this.vx = 0;
      this.vy = 0;
    }
    const _prevX = this.x;
    const _prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const _dist = Math.hypot(this.x - _prevX, this.y - _prevY); // jarak TEMPUH frame ini
    // ---- Animasi halus: semua arah (kiri/kanan/atas/bawah) ----
    // Nilai mentah dihitung dari kecepatan (bukan tombol), lalu dihaluskan
    // dengan peluruhan eksponensial supaya transisi tidak pernah melompat.
    const loco = getLocomotion() || {};
    {
      const spd = Math.max(1, this.stats.speed || 1);
      const vlen = Math.hypot(this.vx, this.vy);
      const targetMove = Math.min(1, vlen / spd);
      const targetFlip = Math.cos(this.facing) < 0 ? -1 : 1;
      // miring searah jalan (dibatasi) — terasa seperti mencondongkan badan
      const tiltCfg = loco.tilt || {};
      const targetLean = Math.max(-1, Math.min(1, this.vx / spd)) * (tiltCfg.moveLean != null ? tiltCfg.moveLean : 0.13);
      // vertikal: + = mendekat ke kamera (bawah layar), - = menjauh
      const targetDepth = Math.max(-1, Math.min(1, this.vy / spd));
      const ease = (cur, target, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
      this.moveAmt = ease(this.moveAmt, targetMove, 7);
      this.animFlip = ease(this.animFlip, targetFlip, 11);
      this.lean = ease(this.lean, targetLean, 8);
      this.depth = ease(this.depth, targetDepth, 6);
    }

    if (hasInput) this.facingTarget = Math.atan2(move.y, move.x);
    // ---- Putaran halus (smooth rotation) ----
    // Dulu `facing` langsung diset ke sudut input → badan berputar seketika
    // (patah-patah saat pemain mengetuk arah). Sekarang sudut DIKEJAR dengan
    // batas laju putar (turn.rate rad/dtk) lewat jalan terpendek di lingkaran
    // 360°, lalu selisihnya jadi "condong ke arah belokan" (inersia).
    {
      const turn = loco.turn || {};
      const rate = turn.rate || 13;
      let d = this.facingTarget - this.facing;
      while (d > Math.PI) d -= Math.PI * 2;   // jalan terpendek: kiri atau kanan
      while (d < -Math.PI) d += Math.PI * 2;
      const step = Math.max(-rate * dt, Math.min(rate * dt, d));
      this.facing += step;
      if (this.facing > Math.PI) this.facing -= Math.PI * 2;
      if (this.facing < -Math.PI) this.facing += Math.PI * 2;
      this.facingVel = dt > 0 ? step / dt : 0;
      const targetTurnLean = Math.max(-1, Math.min(1, this.facingVel / rate)) * (turn.leanMax || 0.087);
      const kLean = 1 - Math.exp(-(turn.leanRate || 9) * dt);
      this.turnLean += (targetTurnLean - this.turnLean) * kLean;
    }

    // ---- Foot-planting: fase langkah dikunci ke JARAK, bukan ke waktu ----
    // 1 langkah = π rad fase; jadi kaki menapak TE PAT setiap kali hero
    // menempuh satu `stride` (data/locomotion.json). Kalau fase digerakkan
    // waktu saja, kaki "menyapu" lebih cepat/lambat dari badan bergerak —
    // itulah kesan foto digeser yang dihilangkan di sini.
    const strideCfg = loco.stride || {};
    this.stridePx = Math.max(strideCfg.minPx || 34, Math.min(strideCfg.maxPx || 72, this.radius * (strideCfg.radiusFactor || 3.2)));
    this.nominalSpeed = (2 * this.stridePx) / (strideCfg.nominalCycleSec || 0.667);
    {
      const prevStep = this.stepIndex;
      this.walkPhase += (_dist / this.stridePx) * Math.PI;
      this.stepIndex = Math.floor(this.walkPhase / Math.PI);
      this.stepEvent = this.stepIndex !== prevStep ? 1 : 0;
    }

    // ---- Rig Rive (sumber gerakan) + cadangan analitik ----
    const _vlen = Math.hypot(this.vx, this.vy);
    const _heroId = (this.heroDef && this.heroDef.id) || null;
    const _isMako = _heroId === 'macrophage';
    // Mako memakai artboard Rive visible sebagai sumber pose langsung. Rig
    // crawl/Godot dan transform-to-static-photo tidak ikut campur pada Mako.
    // Hero lain tetap memakai jalur locomotion lama sampai artboard Rive mereka
    // tersedia.
    if (_isMako) {
      if (!this._makoRigAsked) { this._makoRigAsked = true; ensureMakoRive(); }
      updateMakoRive(dt, { moving: _vlen > 4, direction: this.facing });
    }
    const _crawl = _isMako ? null : crawlPose(_heroId, this.walkPhase, this.moveAmt, this.facing, this.time);
    const pose = null;
    this.rigActive = _isMako || !!_crawl;
    this.rigSource = _isMako ? 'rive-artboard' : (_crawl ? 'crawl' : 'analytic');
    {
      const bobCfg = loco.bob || {};
      const tiltCfg = loco.tilt || {};
      const stepCurve = (1 - Math.cos(this.walkPhase * 2)) / 2; // 2 puncak/siklus
      if (_crawl) {
        // P7: RIG MERAYAP GODOT. Perhatikan `bob` = 0 — badan TIDAK pernah
        // diangkat naik-turun (itulah sumber kesan "mengambang"). Seluruh
        // gerak hidup terjadi sebagai squash-stretch berporos bawah +
        // jangkauan (shear), sehingga tepi bawah sel tetap menempel alas.
        this.time += dt;
        this.anim.bob = _crawl.bob;
        this.anim.tilt = _crawl.rot + this.turnLean;
        this.anim.sx = _crawl.sx * (1 + this.depth * (tiltCfg.depthX || 0.05));
        this.anim.sy = _crawl.sy * (1 - this.depth * (tiltCfg.depthY || 0.03));
        this.anim.shear = _crawl.shear;
        this.anim.contact = _crawl.contact;
        this.anim.legSwing = (crawlLobe(_heroId, this.walkPhase, 0) - 1) * 1.2;
        this.anim.armSwing = -(crawlLobe(_heroId, this.walkPhase, 2) - 1) * 1.2;
        this.anim.headTilt = _crawl.rot * 0.4;
      } else if (pose) {
        // Rig Rive yang mengatur bob/condong/squash; depth kamera tetap
        // ditambahkan supaya mendekat terasa membesar & menjauh mengecil.
        this.anim.bob = pose.bob;
        this.anim.tilt = pose.tilt + this.turnLean;
        this.anim.sx = pose.sx * (1 + this.depth * (tiltCfg.depthX || 0.05));
        this.anim.sy = pose.sy * (1 - this.depth * (tiltCfg.depthY || 0.03));
        this.anim.legSwing = pose.legSwing;
        this.anim.armSwing = pose.armSwing;
        this.anim.headTilt = pose.headTilt;
      } else {
        // CADANGAN (rig belum siap / gagal dimuat): rumus lama yang sudah
        // terbukti mulus — sekarang fase langkahnya ikut jarak (lihat atas).
        this.time += dt;
        const idleAmp = bobCfg.idleAmp != null ? bobCfg.idleAmp : 1.1;
        const stepAmp = bobCfg.stepAmp != null ? bobCfg.stepAmp : 3.4;
        const swayAmp = tiltCfg.swayAmp != null ? tiltCfg.swayAmp : 0.05;
        this.anim.bob = Math.sin(this.time * (bobCfg.idleHz || 2.1)) * idleAmp + this.moveAmt * stepCurve * stepAmp;
        this.anim.tilt = this.lean + Math.sin(this.walkPhase * 2) * swayAmp * this.moveAmt + this.turnLean;
        this.anim.sx = 1 + this.depth * (tiltCfg.depthX || 0.05);
        this.anim.sy = 1 - this.depth * (tiltCfg.depthY || 0.03);
        this.anim.legSwing = Math.sin(this.walkPhase) * 0.42;
        this.anim.armSwing = -Math.sin(this.walkPhase) * 0.32;
        this.anim.headTilt = -Math.sin(this.walkPhase) * 0.022;
      }
    }

    // ---- Debu langkah: TE PAT saat kaki menapak, di kaki yang menapak ----
    this.moving = _vlen > 4;
    if (this.stepEvent && game && game.run && _vlen > 12) {
      const st = loco.step || {};
      const side = (this.stepIndex % 2 === 0 ? 1 : -1) * this.radius * (st.dustSideOffset != null ? st.dustSideOffset : 0.45);
      const fx = this.x - Math.sin(this.facing) * side;      // kaki kiri/kanan
      const fy = this.y + Math.cos(this.facing) * side * 0.5; // agak miring (kamera)
      game.run.effects.spawnBurst(fx, fy + this.radius * 0.75, st.dustColor || 'rgba(224,244,236,0.85)', st.dustCount || 1, st.dustSpeed || 30, st.dustLife || 2.2);
    }

    // ---- Timers ----
    if (this.iframes > 0) this.iframes -= dt;
    if (this.attackFlash > 0) this.attackFlash -= dt;
    this.attackTimer -= dt; // PHAGOS: sisa cooldown jalur tembak mati (tidak dipakai)
    // PHAGOS: hero TIDAK menyerang sendiri — damage hanya dari membran
    // (updateMembrane) + PULSE. Blok tembak/auto-attack DIHAPUS total.
  }

  /**
   * JALUR TEMBAK MATI — stub dipertahankan agar pemanggil lama tak crash.
   * Badan asli dikomentari di bawah (bible §13.8: komentari, jangan hapus).
   */
  tryFire(game) {
    return;
    /* PHAGOS Sprint 1 (§13.8): JALUR TEMBAK MATI (tak dipanggil). Dikomentari, bukan dihapus.
    if (!this.alive) return;
    // Fase 12c: tombol SERANG SELALU merespons.
    const aimActive = game.input && game.run && (() => {
      try {
        const cam = game.run.camera;
        const sp = cam.getPlayerScreen();
        return game.input.getAimInfo(sp ? sp.x : this.x - cam.x, sp ? sp.y : this.y - cam.y).active;
      } catch {
        return false;
      }
    })();
    let target = game.findAttackTarget(this.x, this.y, this.stats.effectiveAttackRange); // V2 Phase 2: finisher bias
    if (!target && !aimActive) {
      // Tidak ada musuh & tidak mengarahkan: swing + langkah maju (feedback jelas).
      // RONDE-7: TETAP tunduk pada cooldown! Dulu path ini MEMBYPASS attackTimer
      // → tanpa musuh tembakan tiap frame (~60/dtk), saat ada musuh nyangkut di
      // cooldown (~1/dtk) → "SERANG cepat kalau sepi, lemot saat ramai".
      // Sekarang cadence SATU untuk semua kondisi.
      if (this.attackTimer > 0) {
        this.performAttack({ x: this.x + Math.cos(this.facing) * 100, y: this.y + Math.sin(this.facing) * 100 }, game, { tap: true });
        return;
      }
      this.performAttack({ x: this.x + Math.cos(this.facing) * 100, y: this.y + Math.sin(this.facing) * 100 }, game);
      this.attackTimer = this.stats.cooldown;
      return;
    }
    if (!target) target = { x: this.x + Math.cos(this.facing) * 100, y: this.y + Math.sin(this.facing) * 100 };
    if (this.attackTimer > 0) {
      // Cooldown berjalan: swing + tapakan ke arah target (karakter tetap bereaksi)
      this.performAttack(target, game, { tap: true });
      return;
    }
    this.performAttack(target, game);
    this.attackTimer = this.stats.cooldown;
  */
  }

  /** JALUR TEMBAK MATI — stub (badan dikomentari §13.8, tak dipanggil). */
  performAttack(target, game, opts = {}) {
    return;
    /* PHAGOS Sprint 1 (§13.8): JALUR TEMBAK MATI (tak dipanggil). Dikomentari, bukan dihapus.
    const pattern = this.heroDef.attackPattern;
    if (opts.tap) {
      // Fase 12c: respons sentuhan saat cooldown — swing visual + audio ringan,
      // damage tetap dari ritme auto-attack (tidak menembus cooldown).
      this.swing = 0.22;
      this.squash = 0.12;
      audio.swing();
      return;
    }
    this.attackFlash = 0.18; // swap spriteAttack sebentar
    // AIM: bila player mengarahkan (stick kanan / mouse), serangan ikut arah itu
    let aimAngle = null;
    if (game && game.input && game.run) {
      const cam = game.run.camera;
      const sp = cam.getPlayerScreen();
      const sx = sp ? sp.x : this.x - cam.x;
      const sy = sp ? sp.y : this.y - cam.y;
      const aim = game.input.getAimInfo(sx, sy);
      if (aim.active) {
        // Fase 12b: sudut layar → sudut dunia (kompensasi squash kamera miring)
        aimAngle = Math.atan2(Math.sin(aim.angle) / PERSP.YS, Math.cos(aim.angle));
      }
    }
    this.facing = aimAngle !== null ? aimAngle : Math.atan2(target.y - this.y, target.x - this.x);
    if (aimAngle !== null) {
      // target fiktif searah aim (pattern melee/lempar pakai arah facing)
      target = { x: this.x + Math.cos(aimAngle) * 100, y: this.y + Math.sin(aimAngle) * 100 };
    }

    if (pattern === 'melee_swipe') {
      // Tebasan area: damage semua musuh dalam swipeRadius & sudut arc
      const count = 1 + this.stats.projectileCount - 1; // upgrade projectileCount → tebasan ekstra
      const swipeCount = this.stats.projectileCount;
      const offsets = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
      for (let i = 0; i < swipeCount; i++) {
        const angle = this.facing + offsets[i % offsets.length];
        game.run.effects.spawnSwipe(this.x, this.y, angle, this.stats.swipeRadius, this.heroDef.patternParams.arc, this.heroDef.color);
        game.applyMeleeSwipe(this, angle, this.stats.swipeRadius, this.heroDef.patternParams.arc, this.stats.damage);
      }
      game.run.stats.shotsFired += 1;
    } else if (pattern === 'ranged_pierce') {
      // Proyektil garis lurus menembus musuh (pierce = jumlah musuh yang ditembus)
      const n = this.stats.projectileCount;
      const spread = (this.heroDef.patternParams.spreadAngle || 0.14) * (n - 1);
      for (let i = 0; i < n; i++) {
        const angle = this.facing - spread / 2 + (n === 1 ? 0 : (spread / (n - 1)) * i);
        game.spawnProjectile({
          pattern: 'pierce',
          x: this.x + Math.cos(angle) * this.radius,
          y: this.y + Math.sin(angle) * this.radius,
          angle,
          speed: this.stats.projectileSpeed,
          damage: this.stats.damage,
          pierce: this.stats.pierce,
          color: this.heroDef.color,
        });
      }
      game.run.stats.shotsFired += n;
    } else if (pattern === 'ranged_homing') {
      // Proyektil yang belok mengejar musuh terdekat
      const n = this.stats.projectileCount;
      const spread = (this.heroDef.patternParams.spreadAngle || 0.5) * (n - 1);
      const turnRate = this.heroDef.patternParams.turnRate || 4;
      for (let i = 0; i < n; i++) {
        const angle = this.facing - spread / 2 + (n === 1 ? 0 : (spread / (n - 1)) * i);
        game.spawnProjectile({
          pattern: 'homing',
          x: this.x + Math.cos(angle) * this.radius,
          y: this.y + Math.sin(angle) * this.radius,
          angle,
          speed: this.stats.projectileSpeed,
          damage: this.stats.damage,
          pierce: this.stats.pierce,
          turnRate,
          antiParasitMult: this.heroDef.patternParams.antiParasitMult || 0,
          color: this.heroDef.color,
        });
      }
      game.run.stats.shotsFired += n;
    } else if (pattern === 'ranged_chain') {
      // V2 §17 archetype CHAIN: tembakan yang menyambung ke musuh terdekat
      // di sekitar target pertama (identitas Dendritic: multi-target & kontrol).
      const chain = game.getAttackArchetype('chain') || {};
      const n = this.stats.projectileCount;
      const spread = (this.heroDef.patternParams.spreadAngle || 0.5) * (n - 1);
      const turnRate = this.heroDef.patternParams.turnRate || 4;
      for (let i = 0; i < n; i++) {
        const angle = this.facing - spread / 2 + (n === 1 ? 0 : (spread / (n - 1)) * i);
        game.spawnProjectile({
          pattern: 'homing',
          x: this.x + Math.cos(angle) * this.radius,
          y: this.y + Math.sin(angle) * this.radius,
          angle,
          speed: this.stats.projectileSpeed,
          damage: this.stats.damage,
          pierce: 1 + (this.heroDef.patternParams.hops || chain.maxHops || 2),
          turnRate,
          antiParasitMult: this.heroDef.patternParams.antiParasitMult || 0,
          color: this.heroDef.color,
          chainHops: this.heroDef.patternParams.hops || chain.maxHops || 2,
          chainRadius: this.heroDef.patternParams.hopRadius || chain.hopRadius || 120,
          chainDecay: (chain.decay != null ? chain.decay : 0.4),
        });
      }
      game.run.stats.shotsFired += n;
    } else {
      console.warn('[player] attackPattern tidak dikenal:', pattern);
    }
  */
  }

  /** Terima damage dengan i-frames. @returns {boolean} apakah damage diterima */
  takeDamage(amount) {
    if (!this.alive || this.iframes > 0) return false;
    this.hp -= amount;
    this.iframes = 0.7;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return true;
  }

  /** Pulihkan HP (vitamin / efek upgrade). */
  heal(amount) {
    if (!this.alive) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHP, this.hp + amount);
    if (this.heroDef?.id === 'macrophage' && this.hp > before) {
      setMakoRiveInput('heal', this.hp - before);
    }
  }
}
