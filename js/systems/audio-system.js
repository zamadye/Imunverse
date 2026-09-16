/**
 * audio-system.js — SFX: file MP3 (CC0) + fallback synth prosedural WebAudio.
 *
 * Rantai: [MP3 buffer | oscillator synth] → gain per-SFX → master → destination
 *
 * - Semua file & angka volume dibaca dari `data/audio.json` (kontrak repo:
 *   angka/config di data/, bukan di js/).
 * - File di-fetch + di-decode SETELAH gesture pertama (unlock) agar Autoplay
 *   Policy tidak memblokir AudioContext.
 * - Bila sebuah file gagal dimuat (offline/PWA cache miss), jatuh ke synth
 *   prosedural lama — game tetap bersuara walau tanpa aset.
 *
 * Kebijakan autoplay: AudioContext dibuat & di-resume pada GESTURE pertama
 * (pointerdown/keydown — di-wire dari main.js). Sebelum itu semua panggilan
 * audio dilewati senyap — tidak pernah melempar error di headless/autoplay.
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { getAudio } from '../core/data-store.js';

// Fallback bila data/audio.json belum termuat (mis. dipanggil sebelum boot).
const DEFAULTS = {
  volumes: { master: 0.9, music: 0.5 },
  sfx: {},
};

/** Ambil config audio dengan aman (data-store boleh belum siap). */
function cfg() {
  try {
    return getAudio() || DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

const MIN_GAP = { shoot: 0.035, hit: 0.05, collect: 0.06, kill: 0.05, ui: 0.03 };

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.lastAt = new Map(); // key → timestamp performance.now()
    this.buffers = new Map(); // key → AudioBuffer (hasil decode MP3)
    this.loading = new Set(); // key yang sedang di-fetch
    this.failed = new Set(); // key yang gagal → pakai synth
    this._preloadStarted = false;
  }

  /** Buat/resume context (dipanggil dari gesture user pertama). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = cfg().volumes?.master ?? 0.9;
        this.master.connect(this.ctx.destination);
        this.preload(); // file MP3 bisa di-decode setelah context hidup
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Pramuat SEMUA SFX di data/audio.json → AudioBuffer.
   * Berjalan di background; SFX yang belum siap otomatis pakai synth.
   */
  preload() {
    if (this._preloadStarted || !this.ctx) return;
    this._preloadStarted = true;
    const map = cfg().sfx || {};
    for (const key of Object.keys(map)) this._load(key);
  }

  async _load(key) {
    if (this.buffers.has(key) || this.loading.has(key) || this.failed.has(key)) return;
    const def = (cfg().sfx || {})[key];
    if (!def || !def.file || !this.ctx) return;
    this.loading.add(key);
    try {
      const res = await fetch(def.file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.buffers.set(key, buf);
    } catch {
      this.failed.add(key); // → synth fallback selamanya untuk key ini
    } finally {
      this.loading.delete(key);
    }
  }

  get muted() {
    return !!(STATE.meta && STATE.meta.soundMuted);
  }

  setMuted(muted) {
    STATE.meta.soundMuted = !!muted;
    writeSave(STATE.meta);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.unlock();
      this.ui();
    }
    return this.muted;
  }

  /** Boleh mainkan sekarang? (throttle per-key + tidak mute) */
  _gate(key) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return false;
    const gap = MIN_GAP[key] || 0.02;
    const now = performance.now();
    const last = this.lastAt.get(key) || 0;
    if (now - last < gap * 1000) return false;
    this.lastAt.set(key, now);
    return true;
  }

  /**
   * Mainkan satu SFX dari file MP3. Jatuh ke `fallback()` bila file belum
   * siap/gagal dimuat — tidak pernah melempar ke pemanggil.
   * @param {string} key    kunci di data/audio.json → sfx
   * @param {object} [opts] { vol = 1, rate = 1, delay = 0, gate }
   * @returns {boolean} true bila file dipakai (false = synth fallback)
   */
  play(key, opts = {}) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return false;
    const def = (cfg().sfx || {})[key];
    const buf = this.buffers.get(key);
    if (!def || !buf) {
      // File belum sempat dimuat di hit pertama — minta muat & pakai synth.
      if (def && def.file && !this.failed.has(key)) this._load(key);
      return false;
    }
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts.rate || 1;
      const g = this.ctx.createGain();
      g.gain.value = (def.gain ?? 0.7) * (opts.vol ?? 1);
      src.connect(g).connect(this.master);
      src.start(this.ctx.currentTime + (opts.delay || 0));
      return true;
    } catch {
      return false;
    }
  }

  // ---------------- primitif synth (fallback & lapisan) ----------------

  /** Nada sederhana dengan slide opsional. */
  _tone(freq, dur, { type = 'triangle', vol = 0.15, slideTo = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Noise burst (hit/ledakan/swish) dengan filter opsional. */
  _noise(dur, { vol = 0.15, filter = null, filterTo = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    let node = src;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(filter, t0);
      if (filterTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), t0 + dur);
      f.Q.value = 0.9;
      node.connect(f);
      node = f;
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(gain).connect(this.master);
    src.start(t0);
  }

  /** Aktif (tidak mute & context hidup) — untuk SFX yang tidak di-throttle. */
  get live() {
    return !this.muted && !!this.ctx && this.ctx.state === 'running';
  }

  // ---------------- SFX publik (semua aman dipanggil kapan pun) ----------------

  shoot() {
    if (!this._gate('shoot')) return;
    if (this.play('shoot')) return;
    const f = 620 + Math.random() * 140;
    this._tone(f, 0.07, { type: 'triangle', vol: 0.24, slideTo: f * 0.55 });
  }

  hit() {
    if (!this._gate('hit')) return;
    if (this.play('hit')) return;
    this._noise(0.05, { vol: 0.32, filter: 1600, filterTo: 700 });
  }

  /** Hit kritis (dipanggil dari spawnHitFeedback saat crit). */
  crit() {
    if (!this.live) return;
    if (this.play('hit_crit')) return;
    this._noise(0.07, { vol: 0.4, filter: 2200, filterTo: 900 });
  }

  kill() {
    if (!this._gate('kill')) return;
    if (this.play('kill')) return;
    this._noise(0.09, { vol: 0.42, filter: 900, filterTo: 250 });
    this._tone(300, 0.08, { type: 'square', vol: 0.2, slideTo: 140 });
  }

  /** PHAGOS: menelan patogen (<15% HP) — basah & lebih tebal dari kill. */
  engulf() {
    if (!this.live) return;
    if (this.play('engulf')) return;
    this._noise(0.16, { vol: 0.4, filter: 600, filterTo: 180 });
    this._tone(180, 0.14, { type: 'sine', vol: 0.24, slideTo: 90 });
  }

  collect() {
    if (!this._gate('collect')) return;
    if (this.play('collect')) return;
    this._tone(880, 0.07, { type: 'sine', vol: 0.4 });
    this._tone(1318, 0.1, { type: 'sine', vol: 0.32, delay: 0.055 });
  }

  /** Nutrisi besar / drop langka. */
  collectBig() {
    if (!this.live) return;
    if (this.play('collect_big')) return;
    [880, 1174, 1568].forEach((f, i) => this._tone(f, 0.1, { type: 'sine', vol: 0.34, delay: i * 0.05 }));
  }

  coin() {
    if (!this.live) return;
    if (this.play('coin')) return;
    this._tone(1046, 0.06, { type: 'square', vol: 0.26 });
    this._tone(1568, 0.09, { type: 'square', vol: 0.2, delay: 0.05 });
  }

  playerHit() {
    if (!this.live) return;
    if (this.play('player_hit')) return;
    this._tone(200, 0.18, { type: 'sawtooth', vol: 0.4, slideTo: 70 });
    this._noise(0.12, { vol: 0.28, filter: 500, filterTo: 160 });
  }

  levelup() {
    if (!this.live) return;
    if (this.play('levelup')) return;
    [523, 659, 784].forEach((f, i) => this._tone(f, 0.12, { type: 'triangle', vol: 0.34, delay: i * 0.07 }));
  }

  /** PHAGOS: mutasi bentuk dipilih — lebih berat dari level-up biasa. */
  mutation() {
    if (!this.live) return;
    if (this.play('mutation')) return;
    [392, 523, 698, 880].forEach((f, i) => this._tone(f, 0.16, { type: 'sawtooth', vol: 0.22, delay: i * 0.06 }));
  }

  /** PHAGOS: Pulse — momen aksi utama pemain. */
  pulse() {
    if (!this.live) return;
    if (this.play('pulse')) return;
    this._noise(0.22, { vol: 0.36, filter: 300, filterTo: 2400 });
    this._tone(140, 0.24, { type: 'sawtooth', vol: 0.3, slideTo: 420 });
  }

  /** V2 Phase 1: detak jantung saat HP kritis (<30%) — tensi terasa. */
  heartbeat() {
    if (!this.live) return;
    if (this.play('heartbeat')) return;
    this._tone(62, 0.1, { type: 'sine', vol: 0.45, slideTo: 44 });
    this._tone(58, 0.09, { type: 'sine', vol: 0.34, delay: 0.16, slideTo: 40 });
  }

  bossSpawn() {
    if (!this.live) return;
    if (this.play('boss_spawn')) return;
    this._tone(110, 0.6, { type: 'sawtooth', vol: 0.36, slideTo: 50 });
    this._noise(0.5, { vol: 0.3, filter: 220, filterTo: 90 });
  }

  bossDie() {
    if (!this.live) return;
    if (this.play('boss_die')) return;
    this._noise(0.45, { vol: 0.4, filter: 800, filterTo: 90 });
    this._tone(220, 0.4, { type: 'square', vol: 0.28, slideTo: 55 });
  }

  /** Ledakan sitotoksin boss (telegraph → blast). */
  bossBlast() {
    if (!this.live) return;
    if (this.play('boss_blast')) return;
    this._noise(0.3, { vol: 0.42, filter: 1200, filterTo: 120 });
  }

  ability(kind) {
    if (!this.live) return;
    if (this.play('ability')) return;
    switch (kind) {
      case 'tebasan':
        this._noise(0.16, { vol: 0.36, filter: 2400, filterTo: 500 });
        break;
      case 'siklon':
        this._noise(0.4, { vol: 0.3, filter: 500, filterTo: 2200 });
        break;
      case 'petir':
        this._noise(0.12, { vol: 0.38, filter: 3200 });
        this._tone(1200, 0.14, { type: 'square', vol: 0.24, slideTo: 180 });
        break;
      case 'beku':
        this._tone(1200, 0.3, { type: 'sine', vol: 0.26, slideTo: 1900 });
        this._noise(0.25, { vol: 0.18, filter: 4200 });
        break;
      default:
        this._noise(0.12, { vol: 0.3, filter: 1500 });
    }
  }

  chest() {
    if (!this.live) return;
    if (this.play('chest')) return;
    [784, 1046, 1318].forEach((f, i) => this._tone(f, 0.14, { type: 'triangle', vol: 0.34, delay: i * 0.08 }));
  }

  evolve() {
    if (!this.live) return;
    if (this.play('evolve')) return;
    [392, 494, 587, 784, 1046].forEach((f, i) => this._tone(f, 0.16, { type: 'triangle', vol: 0.34, delay: i * 0.08 }));
  }

  wave() {
    if (!this.live) return;
    if (this.play('wave')) return;
    this._tone(330, 0.1, { type: 'triangle', vol: 0.32 });
    this._tone(440, 0.14, { type: 'triangle', vol: 0.3, delay: 0.09 });
  }

  /** Patogen bermutasi (trait baru di wave) — peringatan. */
  strain() {
    if (!this.live) return;
    if (this.play('strain')) return;
    this._tone(160, 0.4, { type: 'sawtooth', vol: 0.3, slideTo: 320 });
  }

  /** Aksesori: kapsul membran dibuka. */
  capsule() {
    if (!this.live) return;
    if (this.play('capsule')) return;
    this._noise(0.5, { vol: 0.3, filter: 400, filterTo: 3000 });
  }

  revive() {
    if (!this.live) return;
    if (this.play('revive')) return;
    [523, 784, 1046, 1318].forEach((f, i) => this._tone(f, 0.18, { type: 'triangle', vol: 0.32, delay: i * 0.07 }));
  }

  gameover() {
    if (!this.live) return;
    if (this.play('gameover')) return;
    [392, 330, 262].forEach((f, i) => this._tone(f, 0.4, { type: 'triangle', vol: 0.34, delay: i * 0.18 }));
  }

  victory() {
    if (!this.live) return;
    if (this.play('victory')) return;
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.2, { type: 'triangle', vol: 0.36, delay: i * 0.1 }));
  }

  /** Peringatan bahaya (telegraph boss / HP kritis). */
  warn() {
    if (!this.live) return;
    if (this.play('warn')) return;
    this._tone(880, 0.12, { type: 'square', vol: 0.24 });
    this._tone(880, 0.12, { type: 'square', vol: 0.24, delay: 0.18 });
  }

  ui() {
    if (!this._gate('ui')) return;
    if (this.play('ui')) return;
    this._tone(420, 0.05, { type: 'triangle', vol: 0.22 });
  }

  /** Alias lama (tombol toko) — tak boleh lagi melempar TypeError. */
  click() {
    if (!this._gate('ui')) return;
    if (this.play('ui_confirm')) return;
    this._tone(520, 0.05, { type: 'triangle', vol: 0.22 });
  }

  hover() {
    if (!this._gate('ui')) return;
    if (this.play('ui_hover', { vol: 0.5 })) return;
    this._tone(620, 0.03, { type: 'sine', vol: 0.12 });
  }

  /** Alias warisan (serangan melee lama) — kini bunyi Pulse. */
  swing() {
    if (!this.live) return;
    if (this.play('pulse', { vol: 0.8 })) return;
    this._noise(0.12, { vol: 0.24, filter: 1800, filterTo: 600 });
  }
}

export const audio = new AudioSystem();
