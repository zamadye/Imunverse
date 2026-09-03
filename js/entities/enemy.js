/**
 * enemy.js — Entitas musuh (patogen).
 * Behavior didukung (field `behavior` di data/enemies.json):
 *  - chase_direct   : bergerak lurus ke player
 *  - chase_weave    : mengejar player dengan gerakan zig-zag sinusoidal
 *  - splitter       : chase_direct + pecah jadi N musuh kecil saat mati
 *                     (pemecahan dieksekusi game.js lewat field splitOnDeath)
 *  - boss_pattern_a : lambat, HP besar, serangan area berkala (AOE ter-telegraf)
 */

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

    // Visual
    this.rotation = Math.random() * Math.PI * 2;
    this.hitFlash = 0;
    this.weavePhase = Math.random() * Math.PI * 2;

    // Boss: state serangan area berkala
    this.areaState = {
      phase: 'idle',        // 'idle' | 'telegraph'
      timer: def.areaAttack ? def.areaAttack.interval * 0.6 : 0,
      telegraphT: 0,
    };

    // Result split (untuk enemy anak dari splitter)
    this.splitSource = splitOverrides ? true : false;

    // Kontrol status (kemampuan aktif): beku total & pelankan (siklon)
    this.frozen = 0;
    this.slowT = 0;
    this.slowMult = 1;
    this.vx = 0; // dorongan (knockback siklon), meluruh tiap frame
    this.vy = 0;
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
    const dist = Math.hypot(dx, dy) || 1;
    const baseAngle = Math.atan2(dy, dx);

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
      case 'boss_pattern_a': {
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
