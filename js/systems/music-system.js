/**
 * music-system.js — Musik latar: file MP3 (CC0) lewat <audio> → WebAudio,
 * dengan fallback musik PROSEDURAL bila file tak tersedia (offline/PWA miss).
 *
 * Kenapa <audio> + MediaElementSource (bukan decode penuh):
 *  - streaming → jejak memori kecil (loop 50 dtk × 4 trek, bukan puluhan MB PCM),
 *  - tetap lewat `music.gain` (GainNode) → ducking VO (vo-system) tetap jalan,
 *  - master/mute satu rantai dengan SFX (audio-system).
 *
 * Trek dipetakan di `data/audio.json` → `tracks` + `chapterTracks`
 * (menu · run · boss · dark). `setTheme(chapterId)` memilih trek bab;
 * `setTrack('boss')` dipakai saat boss/duel penting.
 *
 * Bila SEMUA file gagal dimuat (mis. aset belum ikut ter-deploy), sistem
 * kembali ke chiptune prosedural 8-bar (C–G–Am–F) — 0 KB, bebas lisensi.
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { audio } from './audio-system.js';
import { getAudio } from '../core/data-store.js';

// Nada yang dipakai (Hz dihitung dari A4=440)
const NOTE_OFFSET = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function freq(note, shift = 0) {
  if (!note) return 0;
  const m = /^([A-G])(\d)$/.exec(note);
  if (!m) return 0;
  const semi = NOTE_OFFSET[m[1]] + (Number(m[2]) - 4) * 12 + shift;
  return 440 * Math.pow(2, semi / 12);
}

// R3 (Narrative-Cinematic): tema musikal per chapter — fallback prosedural.
const THEMES = {
  luka:   { bpm: 112, shift: 0,  minor: false },
  demam:  { bpm: 118, shift: 2,  minor: false },
  racun:  { bpm: 122, shift: 4,  minor: false },
  alergi: { bpm: 116, shift: -3, minor: false },
  kanker: { bpm: 96,  shift: -5, minor: true },
  final:  { bpm: 126, shift: 1,  minor: true },
};

// Progresi ceria: C – G – Am – F ×2 (1 bar per akor, 8 bar)
const CHORDS = [
  ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'],
  ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'],
];
const BASS = ['C3', 'G2', 'A2', 'F2', 'C3', 'G2', 'F2', 'G2'];
// Warna minor (bab gelap: kanker/final) — Fm–Dm–Am–C ×2
const MINOR_CHORDS = [
  ['F3', 'A3', 'C4'], ['D3', 'F3', 'A3'], ['A2', 'C3', 'E3'], ['C3', 'E3', 'G3'],
  ['F3', 'A3', 'C4'], ['D3', 'F3', 'A3'], ['C3', 'E3', 'G3'], ['D3', 'F3', 'A3'],
];
const MINOR_BASS = ['F2', 'D2', 'A2', 'C2', 'F2', 'D2', 'C2', 'D2'];

// Motif pentatonik penyahut (null = Istirahat) — 8 bar × 8 langkah
const MELODY = [
  'C5', null, 'E5', null, 'G5', null, 'E5', null,
  'D5', null, 'B4', null, 'D5', null, 'G4', null,
  'A4', null, 'C5', null, 'E5', null, 'C5', null,
  'A4', null, 'F4', null, 'A4', null, 'C5', null,
  'C5', null, 'E5', null, 'G5', null, 'A5', null,
  'G5', null, 'D5', null, 'B4', null, 'D5', null,
  'F5', null, 'E5', null, 'C5', null, 'A4', null,
  'D5', null, 'B4', null, 'G4', null, null, null,
];

const TOTAL_STEPS = 64;

function audioCfg() {
  try {
    return getAudio() || null;
  } catch {
    return null;
  }
}

class MusicSystem {
  constructor() {
    this.timer = null;
    this.gain = null;
    this.step = 0;
    this.nextT = 0;
    this.themeKey = 'luka'; // R3: tema chapter (default = progresi lama)
    this._theme = THEMES.luka;
    this.stepDur = 60 / this._theme.bpm / 2;
    // ---- MP3 ----
    this.trackKey = null;      // trek aktif: menu | run | boss | dark
    this.el = null;            // <audio> aktif
    this.els = new Map();      // key → <audio>
    this.nodes = new Map();    // key → MediaElementAudioSourceNode
    this.fadeT = null;
    this.usingFiles = false;
  }

  /** Gain normal musik (dipakai vo-system untuk ducking). */
  get normalGain() {
    return audioCfg()?.volumes?.music ?? 0.5;
  }

  /** R3: pilih tema chapter (dipanggil sebelum start: runstart & cutscene). */
  setTheme(key) {
    this.themeKey = THEMES[key] ? key : 'luka';
    this._theme = THEMES[this.themeKey];
    this.stepDur = 60 / this._theme.bpm / 2;
    if (this.timer) { this.step = 0; this.nextT = this._freshNextT(); }
    // Mode file: bab menentukan trek (run vs dark).
    const map = audioCfg()?.chapterTracks || {};
    const wanted = map[this.themeKey] || 'run';
    if (this.usingFiles && this.trackKey !== wanted && this.el) this.setTrack(wanted);
    else this.trackKey = wanted;
  }

  _freshNextT() {
    return audio.ctx ? audio.ctx.currentTime + 0.35 : this.nextT;
  }

  /** Musik aktif bila meta.musicOn !== false (default AKTIF). */
  get on() {
    return !(STATE.meta && STATE.meta.musicOn === false);
  }

  setOn(on) {
    STATE.meta.musicOn = !!on;
    writeSave(STATE.meta);
    if (!on) this.stop();
    else this.start();
  }

  ensureGain() {
    const ctx = audio.ctx;
    if (!ctx) return null;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = this.normalGain; // musik di bawah SFX/VO
      this.gain.connect(audio.master);
    }
    return this.gain;
  }

  // ------------------------------------------------------------------ MP3

  /** Buat (sekali) elemen <audio> per trek + sambungkan ke WebAudio. */
  _ensureEl(key) {
    const cfgc = audioCfg();
    const file = cfgc?.tracks?.[key];
    if (!file) return null;
    if (this.els.has(key)) return this.els.get(key);
    const ctx = audio.ctx;
    if (!ctx) return null;
    try {
      const el = new Audio(file);
      el.loop = true;
      el.preload = 'auto';
      el.volume = 1; // level diatur lewat GainNode (satu rantai dgn SFX)
      const node = ctx.createMediaElementSource(el);
      node.connect(this.gain || this.ensureGain());
      this.els.set(key, el);
      this.nodes.set(key, node);
      return el;
    } catch {
      return null;
    }
  }

  /** Ganti trek dengan crossfade pendek (tanpa henti mendadak). */
  setTrack(key) {
    if (!audioCfg()?.tracks?.[key]) return;
    if (this.trackKey === key && this.el && !this.el.paused) return;
    const next = this._ensureEl(key);
    if (!next) return;
    const prev = this.el;
    const fade = Math.max(0.15, audioCfg()?.fadeSec ?? 0.5);
    const target = this.normalGain;
    const ctx = audio.ctx;
    // Turunkan sebentar → ganti → naikkan lagi (crossfade sederhana).
    if (ctx && this.gain) {
      const now = ctx.currentTime;
      try {
        this.gain.gain.cancelScheduledValues(now);
        this.gain.gain.setValueAtTime(Math.max(0.0001, this.gain.gain.value), now);
        this.gain.gain.linearRampToValueAtTime(0.0001, now + fade * 0.45);
      } catch { /* abaikan */ }
    }
    clearTimeout(this.fadeT);
    this.fadeT = setTimeout(() => {
      try { prev?.pause(); } catch { /* abaikan */ }
      this.el = next;
      this.trackKey = key;
      const p = next.play();
      if (p && typeof p.catch === 'function') p.catch(() => { this._fallbackSynth(); });
      if (ctx && this.gain) {
        const now2 = ctx.currentTime;
        try {
          this.gain.gain.setValueAtTime(0.0001, now2);
          this.gain.gain.linearRampToValueAtTime(target, now2 + fade * 0.6);
        } catch { /* abaikan */ }
      }
    }, Math.max(0, fade * 0.45 * 1000));
  }

  /** Putar trek file (bila ada). @returns {boolean} true bila mode file aktif. */
  _startFiles() {
    const cfgc = audioCfg();
    const key = this.trackKey || (cfgc?.chapterTracks?.[this.themeKey]) || 'run';
    const el = this._ensureEl(key);
    if (!el) return false;
    this.el = el;
    this.trackKey = key;
    this.usingFiles = true;
    // Hentikan synth prosedural bila sempat menyala.
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const ctx = audio.ctx;
    if (ctx && this.gain) {
      const now = ctx.currentTime;
      const fade = Math.max(0.2, cfgc?.fadeSec ?? 0.5);
      try {
        this.gain.gain.cancelScheduledValues(now);
        this.gain.gain.setValueAtTime(0.0001, now);
        this.gain.gain.linearRampToValueAtTime(this.normalGain, now + fade);
      } catch { /* abaikan */ }
    }
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => this._fallbackSynth());
    return true;
  }

  /** File tak bisa diputar → pakai chiptune prosedural seperti sediakala. */
  _fallbackSynth() {
    if (!this.on || !audio.unlock() || !this.ensureGain()) return;
    this.usingFiles = false;
    if (this.timer) return;
    this._theme = THEMES[this.themeKey] || THEMES.luka;
    this.stepDur = 60 / this._theme.bpm / 2;
    this.step = 0;
    this.nextT = audio.ctx.currentTime + 0.1;
    this.gain.gain.value = this.normalGain;
    this.timer = setInterval(() => this.schedule(), 90);
  }

  // ---------------------------------------------------------------- API

  /** Mulai musik (aman dipanggil berkali-kali; hanya satu pemutar). */
  start() {
    if (!this.on) return;
    if (!audio.unlock()) return;
    if (!this.ensureGain()) return;
    if (this.usingFiles && this.el && !this.el.paused) return;
    if (!this._startFiles()) this._fallbackSynth();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    clearTimeout(this.fadeT);
    const ctx = audio.ctx;
    if (ctx && this.gain) {
      const now = ctx.currentTime;
      try {
        this.gain.gain.cancelScheduledValues(now);
        this.gain.gain.setValueAtTime(Math.max(0.0001, this.gain.gain.value), now);
        this.gain.gain.linearRampToValueAtTime(0.0001, now + 0.35);
      } catch { /* abaikan */ }
    }
    setTimeout(() => {
      try { this.el?.pause(); } catch { /* abaikan */ }
    }, 380);
  }

  /** Scheduler lookahead synth (fallback) — anti-jitter. */
  schedule() {
    const ctx = audio.ctx;
    if (!ctx || ctx.state !== 'running') return;
    while (this.nextT < ctx.currentTime + 0.35) {
      this.playStep(this.step, this.nextT);
      this.step = (this.step + 1) % TOTAL_STEPS;
      this.nextT += this.stepDur;
    }
  }

  tone(dest, type, f, t, dur, vol) {
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  playStep(i, t) {
    const g = this.gain;
    if (!g) return;
    const minor = this._theme?.minor;
    const chords = minor ? MINOR_CHORDS : CHORDS;
    const bass = minor ? MINOR_BASS : BASS;
    const shift = this._theme?.shift || 0;
    const bar = Math.floor(i / 8) % 8;
    const inBar = i % 8;
    if (inBar === 0 || inBar === 4) this.tone(g, 'triangle', freq(bass[bar], shift), t, 0.42, 0.5);
    if (inBar === 0) for (const n of chords[bar]) this.tone(g, 'sine', freq(n, shift), t, 0.9, 0.14);
    const mel = MELODY[i];
    if (mel) this.tone(g, 'square', freq(mel, shift), t, 0.22, 0.2);
    if (inBar === 3 || inBar === 6) this.tone(g, 'sine', freq(chords[bar][inBar === 3 ? 1 : 2], shift) * 2, t, 0.14, 0.1);
  }
}

export const music = new MusicSystem();
