/**
 * audio-system.js — SFX prosedural WebAudio (TANPA file audio).
 *
 * Semua suara disintesis dari oscillator + noise buffer: tembakan, hit,
 * pickup, level-up, kemampuan (pedang/angin/petir/beku), boss, peti,
 * evolusi, klik UI. Mute tersimpan di save (meta.soundMuted).
 *
 * Kebijakan autoplay: AudioContext dibuat & di-resume pada GESTURE pertama
 * (pointerdown/keydown — di-wire dari main.js). Sebelum itu semua panggilan
 * audio dilewati senyap — tidak pernah melempar error di headless/autoplay.
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';

const MASTER_VOL = 0.5;
const MIN_GAP = { shoot: 0.035, hit: 0.05, collect: 0.06, kill: 0.05, ui: 0.03 };

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.lastAt = new Map(); // key → timestamp performance.now()
  }

  /** Buat/resume context (dipanggil dari gesture user pertama). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = MASTER_VOL;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    } catch {
      return false;
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

  /** Nada sederhana dengan slide opsional. */
  _tone(freq, dur, { type = 'triangle', vol = 0.15, slideTo = null, delay = 0 } = {}) {
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

  // ---------------- SFX publik (semua aman-dipanggil kapan pun) ----------------

  shoot() {
    if (!this._gate('shoot')) return;
    const f = 620 + Math.random() * 140;
    this._tone(f, 0.07, { type: 'triangle', vol: 0.06, slideTo: f * 0.55 });
  }

  hit() {
    if (!this._gate('hit')) return;
    this._noise(0.05, { vol: 0.08, filter: 1600, filterTo: 700 });
  }

  /** Fase 12c: whoosh ringan untuk swing tombol SERANG saat cooldown. */
  swing() {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    this._noise(0.09, { vol: 0.06, filter: 2600, filterTo: 900 });
  }

  kill() {
    if (!this._gate('kill')) return;
    this._noise(0.09, { vol: 0.12, filter: 900, filterTo: 250 });
    this._tone(300, 0.08, { type: 'square', vol: 0.05, slideTo: 140 });
  }

  collect() {
    if (!this._gate('collect')) return;
    this._tone(880, 0.07, { type: 'sine', vol: 0.12 });
    this._tone(1318, 0.1, { type: 'sine', vol: 0.1, delay: 0.055 });
  }

  playerHit() {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    this._tone(200, 0.18, { type: 'sawtooth', vol: 0.18, slideTo: 70 });
    this._noise(0.12, { vol: 0.1, filter: 500, filterTo: 160 });
  }

  levelup() {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    [523, 659, 784].forEach((f, i) => this._tone(f, 0.12, { type: 'triangle', vol: 0.14, delay: i * 0.07 }));
  }

  bossSpawn() {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    this._tone(110, 0.6, { type: 'sawtooth', vol: 0.2, slideTo: 50 });
    this._noise(0.5, { vol: 0.14, filter: 220, filterTo: 90 });
  }

  bossDie() {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    this._noise(0.45, { vol: 0.22, filter: 800, filterTo: 90 });
    this._tone(220, 0.4, { type: 'square', vol: 0.12, slideTo: 55 });
  }

  ability(kind) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    switch (kind) {
      case 'tebasan':
        this._noise(0.16, { vol: 0.18, filter: 2400, filterTo: 500 });
        break;
      case 'siklon':
        this._noise(0.4, { vol: 0.14, filter: 500, filterTo: 2200 });
        break;
      case 'petir':
        this._noise(0.12, { vol: 0.2, filter: 3200 });
        this._tone(1200, 0.14, { type: 'square', vol: 0.1, slideTo: 180 });
        break;
      case 'beku':
        this._tone(1200, 0.3, { type: 'sine', vol: 0.1, slideTo: 1900 });
        this._noise(0.25, { vol: 0.06, filter: 4200 });
        break;
      default:
        this._noise(0.12, { vol: 0.12, filter: 1500 });
    }
  }

  chest() {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    [784, 1046, 1318].forEach((f, i) => this._tone(f, 0.14, { type: 'triangle', vol: 0.13, delay: i * 0.08 }));
  }

  evolve() {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    [392, 494, 587, 784, 1046].forEach((f, i) => this._tone(f, 0.16, { type: 'triangle', vol: 0.13, delay: i * 0.08 }));
  }

  wave() {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    this._tone(330, 0.1, { type: 'triangle', vol: 0.1 });
    this._tone(440, 0.14, { type: 'triangle', vol: 0.1, delay: 0.09 });
  }

  combo(step) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    const f = 660 + Math.min(6, Math.floor(step / 5)) * 110;
    this._tone(f, 0.09, { type: 'square', vol: 0.07 });
  }

  ui() {
    if (!this._gate('ui')) return;
    this._tone(420, 0.05, { type: 'triangle', vol: 0.07 });
  }
}

export const audio = new AudioSystem();
