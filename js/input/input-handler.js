/**
 * input-handler.js — Input gerak & arah player.
 *
 *  GERAK
 *   1. Joystick virtual mengambang (touch / drag mouse) — di MANA SAJA di canvas:
 *      vektor arah = TITIK AWAL sentuh → posisi sentuh sekarang, magnitude 0..1.
 *      (UI/UX BUILD 42: zona "aim stick" tak kasatmata di 42% layar kanan DIHAPUS —
 *      pemain menarik di sana dan hero diam → laporan "arah tidak berfungsi".)
 *   2. WASD / panah untuk desktop — hanya ditangkap saat gameplay aktif
 *      (isActive) dan bukan saat mengetik di <input>/<textarea>.
 *
 *  ARAH SERANGAN (aim)
 *   1. Tahan tombol SERANG lalu TARIK → aim stick (ala MLBB: arah dari titik
 *      tekan). Lepas → kembali auto-aim. Dipasang lewat bindFireButton(el).
 *   2. Desktop: mouse bergerak tanpa tekan → arah ke kursor (aimPos).
 *   3. Tidak ada keduanya → { active:false } → auto-aim musuh terdekat.
 *
 * getMoveVector() mengembalikan vektor {x, y} dengan magnitude 0..1.
 */

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'fire', KeyK: 'fire', // SERANG manual (desktop)
};

const isTypingTarget = (t) =>
  !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

/**
 * Zona UI yang SELALU menang prioritas atas controller gerak.
 * Hierarchi input: UI interaction → combat button → movement zone → world.
 * Bila pointer/touch dimulai pada salah satu elemen ini, joystick TIDAK aktif.
 */
export const UI_CONTROL_SELECTOR =
  'button, a, input, textarea, select, label, summary, ' +
  '[role="button"], [role="dialog"], [data-ui], ' +
  '.modal-box, .screen.modal, .hud-hero-status, .hud-quests, .hud-menu2-toggle, ' +
  '.hud-game-menu2, .hud-minimap, .hud-xp-top, .hud-mission, .hud-buff-chip, ' +
  '.hud-antigen, .phago-meter, .ability-btn, .fire-btn, .tut-block, .hud-top, .curguide-box';

/**
 * Apakah target pointer BOLEH masuk ke movement system (GAMEPLAY_INPUT_ZONE)?
 * @param {EventTarget|null} target
 * @returns {boolean} false bila target berada di dalam UI overlay/kontrol
 */
export function isGameplayInputTarget(target) {
  if (!target || target.nodeType !== 1) {
    // Document/window sebagai fallback: hanya boleh saat target memang canvas-ish
    return target instanceof HTMLCanvasElement;
  }
  return !target.closest(UI_CONTROL_SELECTOR);
}

export class InputHandler {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();

    // State joystick virtual
    this.joystick = {
      active: false,
      touchId: null,
      originX: 0,
      originY: 0,
      x: 0, // posisi sentuh sekarang
      y: 0,
      dx: 0, // vektor ternormalisasi hasil (dx, dy) magnitude 0..1
      dy: 0,
    };
    this.maxRadius = 56; // radius jangkauan joystick (px CSS)

    // ---- AIM STICK (arahkan serangan) — diisi oleh drag pada tombol SERANG ----
    this.aimStick = { active: false, touchId: null, dx: 0, dy: 0, angle: 0, ox: 0, oy: 0 };
    this.aimDragThreshold = 12; // px: tap biasa ≠ mengarahkan
    this.aimPos = { x: 0, y: 0, t: -1e9 }; // px relatif canvas + timestamp (mouse hover)
    this.fireButtonHeld = false; // tombol SERANG di HUD (touch/mouse)
    this.fireEl = null;
    this._firePointerId = null;

    this.onPauseKey = null; // callback opsional (Esc / P)
    /** Predikat: keyboard gerak hanya ditangkap bila true (di-set main.js). */
    this.isActive = null;

    this._bind();
  }

  _bind() {
    // ---------- Keyboard ----------
    this._onKeyDown = (e) => {
      // Sedang mengetik (form akun, dsb.) → biarkan browser bekerja normal
      if (isTypingTarget(e.target)) return;
      // Bukan gameplay (dashboard/menu/modal) → jangan tangkap & jangan blokir
      if (this.isActive && !this.isActive()) return;
      const action = KEY_MAP[e.code];
      if (action) {
        this.keys.add(action);
        e.preventDefault();
      }
      if (e.code === 'Space') e.preventDefault();
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.onPauseKey) {
        this.onPauseKey();
      }
    };
    this._onKeyUp = (e) => {
      // keyup SELALU melepas tombol — walau layar sudah berganti (anti tersangkut)
      const action = KEY_MAP[e.code];
      if (action) {
        this.keys.delete(action);
        if (!isTypingTarget(e.target)) e.preventDefault();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    // Jendela kehilangan fokus / tab disembunyikan → lepas SEMUA input.
    // (Tanpa ini tombol yang ditahan saat pindah tab tersangkut → hero jalan sendiri.)
    this._onBlur = () => this.releaseAll();
    this._onVisibility = () => { if (document.hidden) this.releaseAll(); };
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onVisibility);

    // ---------- Touch (virtual joystick — GAMEPLAY_INPUT_ZONE: lantai arena) ----------
    // Bukan window/document global: event di-bind ke canvas dan difilter:
    // (a) hanya saat gameplay aktif (isActive), (b) target BUKAN zona UI.
    // UI (profil, misi, jeda, tombol skill, tombol SERANG) selalu menang.
    this._onTouchStart = (e) => {
      if (this.isActive && !this.isActive()) return; // bukan gameplay → UI normal
      if (!isGameplayInputTarget(e.target)) return;  // sentuhan mulai di UI → jangan gerak
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (!this.joystick.active) {
          this.joystick.active = true;
          this.joystick.touchId = touch.identifier;
          this.joystick.originX = touch.clientX;
          this.joystick.originY = touch.clientY;
          this.joystick.x = touch.clientX;
          this.joystick.y = touch.clientY;
          this._updateJoystickVector();
        }
      }
    };
    this._onTouchMove = (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (this.joystick.active && touch.identifier === this.joystick.touchId) {
          this.joystick.x = touch.clientX;
          this.joystick.y = touch.clientY;
          this._updateJoystickVector();
        }
      }
    };
    this._onTouchEnd = (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (this.joystick.active && touch.identifier === this.joystick.touchId) {
          this._releaseJoystick();
        }
      }
    };
    this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this._onTouchEnd, { passive: false });

    // ---------- Pointer / mouse (drag = joystick, untuk desktop) ----------
    // Pointer Events menyatukan mouse & pena; touch sudah ditangani di atas
    // (pointerType 'touch' di-skip agar tidak dobel).
    this._onPointerDown = (e) => {
      if (e.pointerType === 'touch') return; // sudah via touch handlers
      // GAMEPLAY_INPUT_ZONE: drag hanya dimulai bila gameplay aktif & target
      // bukan zona UI (profil/misi/tombol dibind ke elemennya sendiri).
      if (this.isActive && !this.isActive()) return;
      if (!isGameplayInputTarget(e.target)) return;
      this.canvas.setPointerCapture?.(e.pointerId);
      this.joystick.active = true;
      this.joystick.touchId = 'pointer';
      this.joystick.originX = e.clientX;
      this.joystick.originY = e.clientY;
      this.joystick.x = e.clientX;
      this.joystick.y = e.clientY;
      this._updateJoystickVector();
    };
    this._onPointerMove = (e) => {
      if (e.pointerType === 'touch') return;
      const rect = this.canvas.getBoundingClientRect();
      // Mouse hover (tanpa tekan) = arah aim desktop
      if (!this.joystick.active && !this.aimStick.active) {
        this.aimPos.x = e.clientX - rect.left;
        this.aimPos.y = e.clientY - rect.top;
        this.aimPos.t = performance.now();
      }
      if (this.joystick.active && this.joystick.touchId === 'pointer') {
        this.joystick.x = e.clientX;
        this.joystick.y = e.clientY;
        this._updateJoystickVector();
      }
    };
    this._onPointerUp = (e) => {
      if (e.pointerType === 'touch') return;
      if (this.joystick.active && this.joystick.touchId === 'pointer') {
        this._releaseJoystick();
      }
    };
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('pointercancel', this._onPointerUp);

    // Cegah menu konteks klik-kanan / long-press
    this._onContext = (e) => e.preventDefault();
    this.canvas.addEventListener('contextmenu', this._onContext);
  }

  /**
   * Pasang tombol SERANG: tekan/tahan = menembak, TARIK saat ditahan =
   * mengarahkan serangan (aim stick), lepas = berhenti & kembali auto-aim.
   * Pointer di-capture supaya jari yang meleset keluar tombol tidak memutus tembakan.
   * @param {HTMLElement} el
   * @param {{onPress?: Function}} [opts] onPress: respons instan tiap tekan (swing/lunge)
   */
  bindFireButton(el, opts = {}) {
    if (!el) return;
    this.fireEl = el;
    this._onFireDown = (e) => {
      e.preventDefault();
      if (this._firePointerId !== null) return; // sudah ditahan jari lain
      this._firePointerId = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer sudah lepas */ }
      const r = el.getBoundingClientRect();
      el.style.setProperty('--fire-r', `${r.width / 2}px`);
      this.aimStick.ox = e.clientX;
      this.aimStick.oy = e.clientY;
      this.aimStick.dx = 0;
      this.aimStick.dy = 0;
      this.aimStick.active = false;
      this.fireButtonHeld = true;
      el.classList.add('held');
      if (opts.onPress) opts.onPress(e);
    };
    this._onFireMove = (e) => {
      if (e.pointerId !== this._firePointerId) return;
      const dx = e.clientX - this.aimStick.ox;
      const dy = e.clientY - this.aimStick.oy;
      const len = Math.hypot(dx, dy);
      if (len > this.aimDragThreshold) {
        this.aimStick.active = true;
        this.aimStick.touchId = 'fire';
        this.aimStick.dx = dx / len;
        this.aimStick.dy = dy / len;
        this.aimStick.angle = Math.atan2(dy, dx);
        el.classList.add('aiming');
        el.style.setProperty('--aim', `${this.aimStick.angle}rad`);
      }
    };
    this._onFireUp = (e) => {
      if (e.pointerId !== this._firePointerId) return;
      this._releaseFire();
    };
    el.addEventListener('pointerdown', this._onFireDown);
    el.addEventListener('pointermove', this._onFireMove);
    el.addEventListener('pointerup', this._onFireUp);
    el.addEventListener('pointercancel', this._onFireUp);
    el.addEventListener('lostpointercapture', this._onFireUp);
  }

  _releaseFire() {
    this._firePointerId = null;
    this.fireButtonHeld = false;
    this.aimStick.active = false;
    this.aimStick.touchId = null;
    if (this.fireEl) this.fireEl.classList.remove('held', 'aiming');
  }

  _releaseJoystick() {
    this.joystick.active = false;
    this.joystick.touchId = null;
    this.joystick.dx = 0;
    this.joystick.dy = 0;
  }

  /** Lepas semua input (blur, tab tersembunyi, ganti layar). */
  releaseAll() {
    this.keys.clear();
    this._releaseJoystick();
    this._releaseFire();
  }

  /**
   * Info arah aim (arahkan serangan):
   *  1. aim stick aktif (tarik tombol SERANG) → sudut dari stick
   *  2. mouse bergerak < 2.5 dtk lalu → sudut dari posisi kursor (px,py = player di layar)
   *  3. tidak ada → { active:false } → auto-aim ke musuh terdekat
   */
  getAimInfo(px, py) {
    if (this.aimStick.active && (this.aimStick.dx !== 0 || this.aimStick.dy !== 0)) {
      return { active: true, angle: this.aimStick.angle, source: 'stick' };
    }
    if (performance.now() - this.aimPos.t < 2500) {
      const dx = this.aimPos.x - px;
      const dy = this.aimPos.y - py;
      if (Math.hypot(dx, dy) > 12) {
        return { active: true, angle: Math.atan2(dy, dx), source: 'mouse' };
      }
    }
    return { active: false, angle: 0, source: null };
  }

  /** Dipakai self-test/harness: paksa status tombol SERANG. */
  setFire(v) {
    this.fireButtonHeld = !!v;
  }

  /** Sedang menembak? (tombol HUD ATAU Space/K) */
  isFiring() {
    return this.fireButtonHeld || this.keys.has('fire');
  }

  /** Hitung vektor joystick dari titik awal sentuh. */
  _updateJoystickVector() {
    const j = this.joystick;
    let dx = j.x - j.originX;
    let dy = j.y - j.originY;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) {
      j.dx = 0;
      j.dy = 0;
      return;
    }
    // Normalisasi: kecepatan penuh lebih cepat tercapai (gesit, ramah anak)
    const mag = Math.min(1, len / (this.maxRadius * 0.55));
    j.dx = (dx / len) * mag;
    j.dy = (dy / len) * mag;
  }

  /**
   * Vektor gerak gabungan (joystick diprioritaskan bila aktif).
   * @returns {{x:number, y:number, magnitude:number}}
   */
  getMoveVector() {
    if (this.joystick.active && (this.joystick.dx !== 0 || this.joystick.dy !== 0)) {
      return {
        x: this.joystick.dx,
        y: this.joystick.dy,
        magnitude: Math.hypot(this.joystick.dx, this.joystick.dy),
        source: 'touch',
      };
    }
    let x = 0;
    let y = 0;
    if (this.keys.has('left')) x -= 1;
    if (this.keys.has('right')) x += 1;
    if (this.keys.has('up')) y -= 1;
    if (this.keys.has('down')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, magnitude: len > 0 ? 1 : 0, source: 'keyboard' };
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    this.canvas.removeEventListener('touchend', this._onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this._onTouchEnd);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('pointercancel', this._onPointerUp);
    this.canvas.removeEventListener('contextmenu', this._onContext);
    if (this.fireEl) {
      this.fireEl.removeEventListener('pointerdown', this._onFireDown);
      this.fireEl.removeEventListener('pointermove', this._onFireMove);
      this.fireEl.removeEventListener('pointerup', this._onFireUp);
      this.fireEl.removeEventListener('pointercancel', this._onFireUp);
      this.fireEl.removeEventListener('lostpointercapture', this._onFireUp);
    }
  }
}
