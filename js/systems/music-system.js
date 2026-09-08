/**
 * music-system.js — Musik latar PROSEDURAL WebAudio (tanpa file audio, tanpa dependensi).
 *
 * Melodi chiptune ceria 8-bar (C–G–Am–F) disintesis langsung dari oscillator:
 * 100% bebas lisensi/royalti — dibangkitkan kode saat runtime, bukan rekaman.
 * Nanti bila pemilik menyediakan file musik sendiri, cukup ganti isi playStep()
 * dengan playback <audio>/buffer — API start/stop/setOn tidak berubah.
 *
 * Toggle tersimpan di meta.musicOn (default AKTIF). Musik bermain saat run
 * (gesture sudah terjadi → AudioContext aman di-unlock), berhenti saat run selesai.
 * Berbagi AudioContext & master gain dengan audio-system (volume master satu rantai).
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { audio } from './audio-system.js';

const BPM = 112;
const STEP = 60 / BPM / 2; // 8th note

// Nada yang dipakai (Hz dihitung dari A4=440)
const NOTE_OFFSET = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function freq(note) {
  if (!note) return 0;
  const m = /^([A-G])(\d)$/.exec(note);
  if (!m) return 0;
  const semi = NOTE_OFFSET[m[1]] + (Number(m[2]) - 4) * 12;
  return 440 * Math.pow(2, semi / 12);
}

// Progresi ceria: C – G – Am – F ×2 (1 bar per akor, 8 bar)
const CHORDS = [
  ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'],
  ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'],
];
const BASS = ['C3', 'G2', 'A2', 'F2', 'C3', 'G2', 'F2', 'G2'];

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

class MusicSystem {
  constructor() {
    this.timer = null;
    this.gain = null;
    this.step = 0;
    this.nextT = 0;
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
      this.gain.gain.value = 0.09; // lembut, di bawah SFX
      this.gain.connect(audio.master);
    }
    return this.gain;
  }

  /** Mulai loop (aman dipanggil berkali-kali; hanya satu scheduler). */
  start() {
    if (!this.on) return;
    if (!audio.unlock()) return;
    if (!this.ensureGain()) return;
    if (this.timer) return;
    this.step = 0;
    this.nextT = audio.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 90);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Scheduler lookahead: jadwalkan langkah yang sudah dekat (anti-jitter). */
  schedule() {
    const ctx = audio.ctx;
    if (!ctx || ctx.state !== 'running') return;
    while (this.nextT < ctx.currentTime + 0.35) {
      this.playStep(this.step, this.nextT);
      this.step = (this.step + 1) % TOTAL_STEPS;
      this.nextT += STEP;
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
    const bar = Math.floor(i / 8) % 8;
    const inBar = i % 8;
    // Bass: di lat 1 & 5 tiap bar
    if (inBar === 0 || inBar === 4) this.tone(g, 'triangle', freq(BASS[bar]), t, 0.42, 0.16);
    // Pad akor: lat 1 (halus)
    if (inBar === 0) for (const n of CHORDS[bar]) this.tone(g, 'sine', freq(n), t, 0.9, 0.045);
    // Melodi utama
    const mel = MELODY[i];
    if (mel) this.tone(g, 'square', freq(mel), t, 0.22, 0.06);
    // Sentuhan arpeggio di lat 3 & 7
    if (inBar === 3 || inBar === 6) this.tone(g, 'sine', freq(CHORDS[bar][inBar === 3 ? 1 : 2]) * 2, t, 0.14, 0.03);
  }
}

export const music = new MusicSystem();
