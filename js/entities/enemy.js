/**
 * enemy.js — Entitas musuh (patogen).
 * Behavior didukung (field `behavior` di data/enemies.json):
 *  - chase_direct   : bergerak lurus ke player
 *  - chase_weave    : mengejar player dengan gerakan zig-zag sinusoidal
 *  - splitter       : chase_direct + pecah jadi N musuh kecil saat mati
 *                     (pemecahan dieksekusi game.js lewat field splitOnDeath)
 *  - boss_pattern_a : lambat, HP besar, serangan area berkala (AOE ter-telegraf)
 */

import { getCombat } from '../core/data-store.js';

let nextEnemyId = 1;

export class Enemy {
  /**
   * @param {object} def      definisi dari data/enemies.json
   * @param {number} x
   * @param {number} y
   * @param {object} scalers  { hpScale, speedScale } hasil scaling wave
   * @param {object} [splitOverrides] override untuk musuh hasil split (virion)
   */
  constructor(def, x, y, scalers, splitOverrides = null) {
    this.uid = nextEnemyId++;
    this.def = def;
    this.behavior = def.behavior;
    this.isBoss = !!def.isBoss;
    this.x = x;
    this.y = y;
    this.alive = true;

    // Statistik dengan scaling wave (dan override untuk hasil splitter)
    const hpScale = splitOverrides ? 1 : scalers.hpScale;
    const speedScale = splitOverrides ? 1 : scalers.speedScale;
    this.maxHP = Math.round(def.baseHP * hpScale * (splitOverrides?.hpScale ?? 1));
    this.hp = this.maxHP;
    this.speed = def.speed * speedScale * (splitOverrides?.speedScale ?? 1);
    this.radius = def.radius * (splitOverrides?.radiusScale ?? 1);
    this.damage = def.damage;
    this.xpPerKill = def.xpPerKill;

    // Fase 9 (dokumen entitas): armor Gram±/Prion, stealth Sel Abnormal, timer konversi Prion
    this.armorLayers = def.armorLayers || 0;
    this.stealth = !!def.stealth;
    this.stealthExposed = false;
    this.nkRevealT = 0;
    this.convertT = def.convertInterval || 0;
    this.lastHitAbsorbed = false;
    this.markMult = 1; this.markT = 0; this.dotMult = 0; this.dotT = 0; this.dotSrc = 0; // Fase 12 skill state

    // Visual
    this.rotation = Math.random() * Math.PI * 2;
    this.hitFlash = 0;
    // R4 Modul B: window telan (phagocytosis) — diisi phagoUpdateEnemy
    this.phagoEligible = false;
    this.phagoWindowT = 0;
    this.phagoSpent = false;
    this.devoured = false;
    // R6 Modul D: tag-cascade (opsonisasi) — diisi tagOnHit/cascadeOnDeath
    this.cascadeTag = false;
    this.cascadeHopIn = 0;
    this.cascadeDone = false;
    this.weavePhase = Math.random() * Math.PI * 2;

    // Boss: state serangan area berkala
    this.areaState = {
      phase: 'idle',        // 'idle' | 'telegraph'
      timer: def.areaAttack ? def.areaAttack.interval * 0.6 : 0,
      telegraphT: 0,
    };

    // Result split (untuk enemy anak dari splitter)
    this.splitSource = splitOverrides ? true : false;

    // F26 — AI MMORPG: imun yang mencari virus. Musuh JAGA sarangnya dan
    // hanya mengejar bila player masuk radius aggro; melewati leash → pulang.
    // null = free-ranger (fallback perilaku lama: terus mengejar).
    this.homeX = null;
    this.homeY = null;
    this.aiState = 'chase';   // 'guard' | 'patrol' | 'chase' | 'return'
    this.patrolAngle = Math.random() * Math.PI * 2;
    this.patrolT = 0;

    // Kontrol status (kemampuan aktif): beku total & pelankan (siklon)
    this.frozen = 0;
    this.slowT = 0;
    this.slowMult = 1;
    this.vx = 0; // dorongan (knockback siklon), meluruh tiap frame
    this.vy = 0;

    // V2 Phase 2 — CONTACT ATTACK bertelegraph (chase_*/splitter, bukan boss/hazard):
    // 'ready' → masuk strikeRange → 'windup' (berhenti, sprite attack, shiver)
    // → strike bila player masih dekat → 'cooldown'. Dodge saat windup = whiff.
    this.atkPhase = 'ready';       // 'ready' | 'windup' | 'cooldown'
    this.atkT = 0;                 // timer fase berjalan
    this.attackSpriteHint = false; // dibaca render game.js (spriteAttack)
    this.usesContactTelegraph = !def.isBoss && def.behavior !== 'hazard_drift' && def.behavior !== 'boss_pattern_a';

    // V2 Phase 5 — ELITE affix & boss enrage
    this.eliteAffix = null;   // 'brute'|'swift'|'regen'|'volatile' (via makeElite)
    this.affixCfg = null;     // params affix dari waves.json
    this.windupOverride = 0;  // swift: windup lebih singkat
    this.enraged = false;     // boss: fase mengamuk (sekali per boss)
  }

  /**
   * V2 Phase 5: promosikan musuh reguler jadi ELITE ber-affix (mini-boss).
   * Statistik & param dari data/waves.json (elite.*). def dishadow supaya
   * feedback tier elite Phase 1 (hit-stop 50ms, part drop) otomatis aktif.
   */
  makeElite(affix, cfg) {
    this.eliteAffix = affix;
    this.affixCfg = (cfg.affixParams && cfg.affixParams[affix]) || {};
    this.def = { ...this.def, elite: true };
    this.maxHP = Math.round(this.maxHP * cfg.hpMult);
    this.hp = this.maxHP;
    this.radius = this.radius * cfg.radiusMult;
    if (affix === 'brute') this.damage = Math.round(this.damage * this.affixCfg.dmgMult);
    else if (affix === 'swift') {
      this.speed *= this.affixCfg.speedMult;
      this.windupOverride = this.affixCfg.windup;
    }
  }

  /**
   * F26: tempelkan musuh ke sarang — guard/patrol di sekitar (x,y),
   * mengejar bila player masuk aggroRadius, pulang bila melewati leashRadius.
   */
  setNest(x, y, ai) {
    this.homeX = x;
    this.homeY = y;
    this.aiCfg = ai || null;
    this.aiState = 'guard';
  }

  /** Beku total: musuh berhenti bergerak & menyerang sementara. */
  applyFreeze(time) {
    this.frozen = Math.max(this.frozen, time);
  }

  /** Pelankan gerakan (mis. tertiup siklon). */
  applySlow(mult, time) {
    this.slowMult = Math.min(this.slowMult === 1 || this.slowT <= 0 ? mult : this.slowMult, mult);
    this.slowT = Math.max(this.slowT, time);
  }

  update(dt, playerPos, time, game) {
    if (!this.alive) return;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // V2 Phase 5: affix REGEN — elite pulih 2%/dtk (jawaban pemain: fokus burst)
    if (this.eliteAffix === 'regen' && this.hp < this.maxHP) {
      this.hp = Math.min(this.maxHP, this.hp + this.maxHP * this.affixCfg.pctPerSec * dt);
    }

    // Dorongan knockback meluruh (tetap jalan meski beku, tapi melemah)
    if (Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const fric = Math.max(0, 1 - 6 * dt);
      this.vx *= fric;
      this.vy *= fric;
    }

    // Beku: skip seluruh perilaku (tidak bergerak/serang) sampai waktu habis
    if (this.frozen > 0) {
      this.frozen -= dt;
      return;
    }
    // Perlambatan (siklon): dt gerak efektif dikali faktor
    if (this.slowT > 0) {
      this.slowT -= dt;
      dt = dt * this.slowMult;
      if (this.slowT <= 0) this.slowMult = 1;
    }

    const dx = playerPos.x - this.x;
    const dy = playerPos.y - this.y;
    let dist = Math.hypot(dx, dy) || 1;
    let baseAngle = Math.atan2(dy, dx);

    // ---- V2 Phase 2: CONTACT ATTACK bertelegraph ----
    // Musuh pengejar TIDAK melukai lewat sentuhan pasif; ia berhenti, windup
    // terbaca (sprite attack + shiver), lalu menerkam — dodge dihargai.
    if (this.usesContactTelegraph && game) {
      const ca = getCombat().contactAttack;
      const strikeRange = this.radius + (playerPos.radius || 0) + ca.rangeBonus;
      if (this.atkPhase === 'cooldown') {
        this.atkT -= dt;
        if (this.atkT <= 0) this.atkPhase = 'ready';
      } else if (this.atkPhase === 'windup') {
        this.atkT -= dt;
        if (this.atkT <= 0) {
          // STRIKE: hanya kena bila player masih dalam toleransi (whiff bila dodge)
          this.attackSpriteHint = false;
          this.atkPhase = 'cooldown';
          this.atkT = ca.cooldown;
          if (dist <= strikeRange * ca.strikeTolerance) {
            game.enemyContactStrike(this, dx / dist, dy / dist);
          }
        }
        return; // selama windup: berdiri di tempat (telegraph jelas)
      } else if (dist <= strikeRange) {
        this.atkPhase = 'windup';
        // V2 Phase 5: affix SWIFT menyerang dengan windup lebih singkat
        this.atkT = this.windupOverride || ca.windup;
        this.attackSpriteHint = true;
        return;
      }
    }

    // ---- F26 AI sarang: guard → chase → return (boss selalu bebas mengejar) ----
    if (this.homeX !== null && !this.isBoss) {
      const ai = this.aiCfg || { aggroRadius: 190, leashRadius: 430, patrolRadius: 80 };
      const dHome = Math.hypot(this.x - this.homeX, this.y - this.homeY) || 1;
      if (this.aiState === 'return') {
        if (dist < ai.aggroRadius * 0.75) {
          this.aiState = 'chase'; // player terlalu dekat lagi → kejar
        } else if (dHome <= 14) {
          this.aiState = 'guard'; // sampai rumah → jaga lagi
        } else {
          // jalan pulang, abaikan player
          this.x += ((this.homeX - this.x) / dHome) * this.speed * 0.9 * dt;
          this.y += ((this.homeY - this.y) / dHome) * this.speed * 0.9 * dt;
          if (this.def.orientToMovement) this.rotation = Math.atan2(this.homeY - this.y, this.homeX - this.x);
          return;
        }
      }
      if (this.aiState === 'guard' || this.aiState === 'patrol') {
        if (dist < ai.aggroRadius) {
          this.aiState = 'chase'; // player ketahuan → kejar
        } else {
          // patroli kecil mengelilingi sarang (terlihat hidup, tetap di zona)
          this.patrolT -= dt;
          if (this.patrolT <= 0) {
            this.patrolT = 1.6 + Math.random() * 1.6;
            this.patrolAngle += (Math.random() - 0.5) * 2.2;
          }
          const tx = this.homeX + Math.cos(this.patrolAngle) * ai.patrolRadius * 0.6;
          const ty = this.homeY + Math.sin(this.patrolAngle) * ai.patrolRadius * 0.6;
          const tdx = tx - this.x, tdy = ty - this.y;
          const td = Math.hypot(tdx, tdy) || 1;
          if (td > 6) {
            this.x += (tdx / td) * this.speed * 0.4 * dt;
            this.y += (tdy / td) * this.speed * 0.4 * dt;
            if (this.def.orientToMovement) this.rotation = Math.atan2(tdy, tdx);
          }
          return;
        }
      }
      if (this.aiState === 'chase' && dHome > ai.leashRadius) {
        this.aiState = 'return'; // terlalu jauh dari rumah → pulang (imun yang mencari)
      }
    }

    switch (this.behavior) {
      case 'chase_direct':
      case 'splitter': {
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
        break;
      }
      case 'chase_weave': {
        // Heading menyeleweng sinusoidal di sekitar arah player
        const wp = this.def.weaveParams || { amplitudeDeg: 0.65, frequency: 2.4 };
        const wobble = Math.sin(time * wp.frequency + this.weavePhase) * wp.amplitudeDeg;
        const angle = baseAngle + wobble;
        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;
        break;
      }
      case 'hazard_drift': {
        // Fase 9: Toksin/Prion/Sel Abnormal — hanyut pelan + aura konversi Prion
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
        if (this.def.convertRadius) {
          this.convertT -= dt;
          if (this.convertT <= 0) {
            this.convertT = this.def.convertInterval;
            game.convertNearbyEnemies(this, this.def.convertRadius);
          }
        }
        if (this.nkRevealT > 0) this.nkRevealT -= dt;
        this.stealthExposed = this.nkRevealT > 0;
        break;
      }
      case 'boss_pattern_a': {
        // V2 Phase 5: ENRAGE — HP rendah → boss mengamuk sekali (drama akhir)
        if (!this.enraged && game && game.tryBossEnrage) game.tryBossEnrage(this);
        // Bergerak lebih lambat + serangan area berkala
        const stopDist = this.radius + 24;
        if (dist > stopDist) {
          this.x += (dx / dist) * this.speed * dt;
          this.y += (dy / dist) * this.speed * dt;
        }
        this._updateAreaAttack(dt, dist, game);
        break;
      }
      default:
        console.warn('[enemy] behavior tidak dikenal:', this.behavior);
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
    }

    // Orientasi sprite ke arah gerak bila def minta
    if (this.def.orientToMovement) {
      this.rotation = Math.atan2(dy, dx);
    }
  }

  /** Logika AOE boss: telegraph → blast. */
  _updateAreaAttack(dt, distToPlayer, game) {
    const cfg = this.def.areaAttack;
    if (!cfg) return;
    const st = this.areaState;

    if (st.phase === 'idle') {
      st.timer -= dt;
      if (st.timer <= 0 && distToPlayer <= cfg.triggerRange) {
        st.phase = 'telegraph';
        st.telegraphT = cfg.telegraphTime;
      }
    } else if (st.phase === 'telegraph') {
      st.telegraphT -= dt;
      if (st.telegraphT <= 0) {
        // LEDAKAN — damage ke player bila dalam radius
        st.phase = 'idle';
        st.timer = cfg.interval;
        game.bossBlast(this, cfg);
      }
    }
  }

  /**
   * Terima damage. @returns {boolean} true bila musuh mati.
   */
  takeDamage(amount) {
    if (!this.alive) return false;
    // ARMOR (Gram Positif/Negatif/Prion): lapisan luar menyerap satu tepukan
    if (this.armorLayers > 0) {
      this.armorLayers -= 1;
      this.hitFlash = 0.12;
      this.lastHitAbsorbed = true;
      return false;
    }
    this.lastHitAbsorbed = false;
    this.hp -= amount;
    this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  /**
   * Damage yang selalu mengurangi HP (mengabaikan armor) — dipakai jurus
   * Petir Sel NK, selaras peran "penembus lapisan".
   */
  takeDamageRaw(amount) {
    if (!this.alive) return false;
    this.lastHitAbsorbed = false;
    this.hp -= amount;
    this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }
}
