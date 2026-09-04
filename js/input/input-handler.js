/**
 * input-handler.js — Input gerak player:
 *  1. Virtual joystick untuk mobile (touchstart/touchmove/touchend):
 *     vektor arah dihitung dari TITIK AWAL sentuh → posisi sentuh sekarang,
 *     magnitude di-clamp ke radius maksimum joystick.
 *  2. WASD / Arrow keys untuk desktop.
 *
 * getMoveVector() mengembalikan vektor {x, y} dengan magnitude 0..1.
 */

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

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

    // ---- AIM STICK (arahkan serangan) ----
    // Touch/pointer di ZONA KANAN canvas = aim stick; zona kiri = gerak.
    // Mouse tanpa tekan = arah ke posisi kursor (desktop, auto-aim override).
    this.aimStick = { active: false, touchId: null, dx: 0, dy: 0, angle: 0 };
    this.aimPos = { x: 0, y: 0, t: -1e9 }; // px relatif canvas + timestamp
    this.aimZone = 0.58;  // mulai zona aim di 58% lebar canvas

    this.onPauseKey = null; // callback opsional (Esc / P)

    this._bind();
  }

  _bind() {
    // ---------- Keyboard ----------
    this._onKeyDown = (e) => {
      const action = KEY_MAP[e.code];
      if (action) {
        this.keys.add(action);
        e.preventDefault();
      }
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.onPauseKey) {
        this.onPauseKey();
      }
    };
    this._onKeyUp = (e) => {
      const action = KEY_MAP[e.code];
      if (action) {
        this.keys.delete(action);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    // ---------- Touch (virtual joystick) ----------
    this._onTouchStart = (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        const rect = this.canvas.getBoundingClientRect();
        const inAimZone = (touch.clientX - rect.left) > rect.width * this.aimZone;
        if (inAimZone && !this.aimStick.active) {
          this.aimStick.active = true;
          this.aimStick.touchId = touch.identifier;
          this.aimStick.ox = touch.clientX;
          this.aimStick.oy = touch.clientY;
          this.aimStick.dx = 0;
          this.aimStick.dy = 0;
        } else if (!this.joystick.active) {
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
        if (this.aimStick.active && touch.identifier === this.aimStick.touchId) {
          const dx = touch.clientX - this.aimStick.ox;
          const dy = touch.clientY - this.aimStick.oy;
          const len = Math.hypot(dx, dy);
          if (len > 8) {
            this.aimStick.dx = dx / len;
            this.aimStick.dy = dy / len;
            this.aimStick.angle = Math.atan2(dy, dx);
          }
        }
      }
    };
    this._onTouchEnd = (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (this.joystick.active && touch.identifier === this.joystick.touchId) {
          this.joystick.active = false;
          this.joystick.touchId = null;
          this.joystick.dx = 0;
          this.joystick.dy = 0;
        }
        if (this.aimStick.active && touch.identifier === this.aimStick.touchId) {
          this.aimStick.active = false;
          this.aimStick.touchId = null;
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
      const rect = this.canvas.getBoundingClientRect();
      const inAimZone = (e.clientX - rect.left) > rect.width * this.aimZone;
      if (inAimZone) {
        // Drag zona kanan (mouse) = aim stick
        this.canvas.setPointerCapture?.(e.pointerId);
        this.aimStick.active = true;
        this.aimStick.touchId = 'pointer';
        this.aimStick.ox = e.clientX;
        this.aimStick.oy = e.clientY;
        this.aimStick.dx = 0;
        this.aimStick.dy = 0;
        return;
      }
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
      if (this.aimStick.active && this.aimStick.touchId === 'pointer') {
        const dx = e.clientX - this.aimStick.ox;
        const dy = e.clientY - this.aimStick.oy;
        const len = Math.hypot(dx, dy);
        if (len > 8) {
          this.aimStick.dx = dx / len;
          this.aimStick.dy = dy / len;
          this.aimStick.angle = Math.atan2(dy, dx);
        }
      }
    };
    this._onPointerUp = (e) => {
      if (e.pointerType === 'touch') return;
      if (this.joystick.active && this.joystick.touchId === 'pointer') {
        this.joystick.active = false;
        this.joystick.touchId = null;
        this.joystick.dx = 0;
        this.joystick.dy = 0;
      }
      if (this.aimStick.active && this.aimStick.touchId === 'pointer') {
        this.aimStick.active = false;
        this.aimStick.touchId = null;
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
   * Info arah aim (arahkan serangan):
   *  1. aim stick aktif (touch/drag zona kanan) → sudut dari stick
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
    // Normalisasi: magnitude penuh setelah melewati radius maksimum
    const mag = Math.min(1, len / this.maxRadius);
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
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    this.canvas.removeEventListener('touchend', this._onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this._onTouchEnd);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('pointercancel', this._onPointerUp);
    this.canvas.removeEventListener('contextmenu', this._onContext);
  }
}
