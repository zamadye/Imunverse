/**
 * audio-system.js — Audio & musik prosedural (WebAudio, TANPA file aset).
 *
 * Arsitektur:
 *  - AudioContext dibuat LAZY dan di-unlock lewat gesture user (kebijakan
 *    autoplay browser desktop/mobile). SEMUA API aman dipanggil sebelum
 *    unlock — hanya no-op. Tidak ada dependency ke UI/game.
 *  - SFX = oscillator / noise-buffer + envelope pendek. Ada throttle per
 *    jenis (anti spam saat 100+ musuh) dan 3 bus gain terpisah:
 *    master → sfxBus / musicBus (+ delay echo untuk musik).
 *  - Musik = sequencer lookahead (0.35 dtk) pola 32 langkah: pad chord
 *    Dm–Bb–F–A, bass pulse, arpeggio pentatonik, click hat.
 *    Intensity 0..1 (dashboard → gameplay → boss).
 *  - Preferensi {sfx,music} disimpan main.js di STATE.meta.audio → save.
 *
 * Event yang didengarkan (via ui-bridge, di-wire main.js):
 *  - 'sfx'  {name, ...opts} → play()
 *  - 'runstart' / 'wave' / 'gameover' → setIntensity()
 */

const BPM = 84;
const STEP_DUR = 60 / BPM / 2;          // not seperdelapan
const LOOKAHEAD = 0.35;                  // detik jadwal ke depan
const BEAT = 60 / BPM;

// D minor pentatonik (D4..D6) — nada arpeggio
const ARP = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 880.0];
// Progresi 4 bar: Dm · Bb · F · A (root + kelima, oktaf rendah)
const CHORDS = [
  { root: 146.83, fifth: 220.0 },
  { root: 116.54, fifth: 174.61 },
  { root: 87.31, fifth: 130.81 },
  { root: 110.0, fifth: 164.81 },
];

// Gap minimal antar pemicuan SFX (detik) — anti banjir node AudioContext
const MIN_GAP = { shoot: 0.05, hit: 0.035, pickup: 0.06, combo: 0.09, hitStop: 0.1 };

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let settings = { sfx: true, music: true };
let unlocked = false;
let intensity = 0.4;
let playing = false;
let stepIndex = 0;
let nextStepTime = 0;
let schedTimer = null;
const lastPlay = new Map(); // name → ctx.currentTime

// ---------------------------------------------------------------------
// Preferensi — dipanggil main.js setelah save dimuat
// ---------------------------------------------------------------------
export function initAudio(prefs = {}) {
  settings = { sfx: prefs.sfx !== false, music: prefs.music !== false };
  return { ...settings };
}

export function getAudioSettings() {
  return { ...settings };
}

/** Nyalakan/matikan SEMUA suara (tombol toggle dashboard & pause). */
export function toggleAll() {
  const next = !(settings.sfx || settings.music);
  settings.sfx = next;
  settings.music = next;
  if (ctx) {
    const now = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(next ? 0.5 : 0.0001, now, 0.05);
    if (next) startMusic();
    else musicBus.gain.setTargetAtTime(0.0001, now, 0.08);
  }
  if (!next) playing = false;
  return { ...settings };
}

export function setSfx(on) {
  settings.sfx = !!on;
  if (ctx) sfxBus.gain.setTargetAtTime(settings.sfx ? 0.5 : 0.0001, ctx.currentTime, 0.05);
  return { ...settings };
}

export function setMusic(on) {
  settings.music = !!on;
  if (ctx) {
    const now = ctx.currentTime;
    if (settings.music) {
      startMusic();
      musicBus.gain.setTargetAtTime(0.14 + intensity * 0.1, now, 0.6);
    } else {
      playing = false;
      musicBus.gain.setTargetAtTime(0.0001, now, 0.08);
    }
  }
  return { ...settings };
}

/** Panggil pada gesture user pertama (pointerdown/keydown). Idempotent. */
export function unlock() {
  if (unlocked) {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // browser tanpa WebAudio → mode senyap (game tetap jalan)
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = settings.sfx ? 0.5 : 0.0001;
    sfxBus.connect(master);

    // Echo ambience untuk musik (dari musicBus ke master, paralel)
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = BEAT * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.0001;
    musicBus.connect(master);
    musicBus.connect(delay);

    noiseBuf = createNoiseBuffer(ctx);
    ctx.resume().catch(() => {});
    unlocked = true;
    if (settings.music) startMusic();
  } catch (err) {
    // Gagal init audio tidak boleh mematikan game
    console.warn('[audio] WebAudio tidak tersedia:', err);
    unlocked = false;
  }
}

// ---------------------------------------------------------------------
// SFX — synth mini per event
// ---------------------------------------------------------------------
export function play(name, opts = {}) {
  if (!unlocked || !ctx || !settings.sfx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const gap = MIN_GAP[name] ?? 0.025;
  if (now - (lastPlay.get(name) || -1) < gap) return;
  lastPlay.set(name, now);
  try {
    SFX[name]?.(opts, now);
  } catch (err) {
    console.warn('[audio] sfx gagal:', name, err);
  }
}

const SFX = {
  /** Tembakan auto-attack (pitch sedikit acak per hero). */
  shoot(o, t) {
    const p = (o.pitch ?? 1) * (1 + Math.random() * 0.12);
    tone({ type: 'square', freq: 540 * p, freqEnd: 190, dur: 0.07, gain: 0.045, t });
  },
  /** Damage ke musuh. */
  hit(o, t) {
    noise({ dur: 0.05, gain: 0.08, filterFreq: 1900, type: 'highpass', t });
    tone({ type: 'triangle', freq: 310, freqEnd: 95, dur: 0.08, gain: 0.09, t });
  },
  /** Musuh mati — pop turun; besar (elite/boss) lebih berat. */
  kill(o, t) {
    const big = !!o.big;
    tone({ type: 'sine', freq: big ? 300 : 430, freqEnd: 62, dur: big ? 0.4 : 0.24, gain: big ? 0.3 : 0.17, t });
    noise({ dur: big ? 0.28 : 0.12, gain: big ? 0.14 : 0.08, filterFreq: big ? 700 : 1100, type: 'lowpass', t });
  },
  /** Pengambilan nutrisi — nada naik mengikuti urutan (pentatonik). */
  pickup(o, t) {
    const f = ARP[(o.step ?? 0) % ARP.length] * 1.5;
    tone({ type: 'sine', freq: f, freqEnd: f * 1.5, dur: 0.14, gain: 0.12, t });
  },
  heal(o, t) {
    tone({ type: 'sine', freq: 523.25, dur: 0.12, gain: 0.12, t });
    tone({ type: 'sine', freq: 783.99, dur: 0.18, gain: 0.1, t: t + 0.07 });
  },
  coin(o, t) {
    tone({ type: 'square', freq: 880, dur: 0.05, gain: 0.08, t });
    tone({ type: 'square', freq: 1318.5, dur: 0.09, gain: 0.07, t: t + 0.05 });
  },
  levelup(o, t) {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone({ type: 'triangle', freq: f, dur: 0.16, gain: 0.14, t: t + i * 0.07 });
    });
  },
  /** Milestone combo — pitch naik per tier. */
  combo(o, t) {
    const tier = Math.min(6, o.tier ?? 0);
    const f = 440 * Math.pow(1.12, tier);
    tone({ type: 'square', freq: f, dur: 0.09, gain: 0.11, t });
    tone({ type: 'sine', freq: f * 1.5, dur: 0.16, gain: 0.09, t: t + 0.05 });
  },
  playerHit(o, t) {
    tone({ type: 'sawtooth', freq: 165, freqEnd: 52, dur: 0.28, gain: 0.24, t });
    noise({ dur: 0.2, gain: 0.12, filterFreq: 420, type: 'lowpass', t });
  },
  boss_warning(o, t) {
    tone({ type: 'sawtooth', freq: 110, dur: 0.5, gain: 0.16, t });
    tone({ type: 'sawtooth', freq: 164.8, dur: 0.5, gain: 0.1, t });
    tone({ type: 'sawtooth', freq: 220, dur: 0.7, gain: 0.07, t: t + 0.25 });
  },
  explosion(o, t) {
    noise({ dur: 0.5, gain: 0.26, filterFreq: 320, type: 'lowpass', t });
    tone({ type: 'sine', freq: 130, freqEnd: 38, dur: 0.5, gain: 0.28, t });
  },
  slash(o, t) {
    noise({ dur: 0.14, gain: 0.12, filterFreq: 2600, type: 'bandpass', t });
    tone({ type: 'sawtooth', freq: 220, freqEnd: 700, dur: 0.12, gain: 0.06, t });
  },
  wind(o, t) {
    noise({ dur: 0.38, gain: 0.15, filterFreq: 950, type: 'bandpass', t });
    tone({ type: 'sine', freq: 300, freqEnd: 120, dur: 0.3, gain: 0.06, t });
  },
  bolt(o, t) {
    tone({ type: 'square', freq: 1500, freqEnd: 120, dur: 0.2, gain: 0.15, t });
    noise({ dur: 0.14, gain: 0.18, filterFreq: 3200, type: 'highpass', t });
    tone({ type: 'triangle', freq: 2400, freqEnd: 300, dur: 0.28, gain: 0.07, t: t + 0.02 });
  },
  frost(o, t) {
    tone({ type: 'sine', freq: 1200, freqEnd: 1900, dur: 0.35, gain: 0.07, t });
    tone({ type: 'triangle', freq: 900, freqEnd: 2400, dur: 0.45, gain: 0.05, t: t + 0.06 });
  },
  chest(o, t) {
    [659.25, 880, 1108.7, 1318.5].forEach((f, i) => {
      tone({ type: 'sine', freq: f, dur: 0.2, gain: 0.13, t: t + i * 0.08 });
    });
  },
  gameover(o, t) {
    [392, 311.13, 233.08, 196].forEach((f, i) => {
      tone({ type: 'triangle', freq: f, dur: 0.42, gain: 0.15, t: t + i * 0.22 });
    });
  },
  revive(o, t) {
    [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) => {
      tone({ type: 'sine', freq: f, dur: 0.24, gain: 0.13, t: t + i * 0.09 });
    });
  },
  ui(o, t) {
    tone({ type: 'sine', freq: 740, dur: 0.05, gain: 0.07, t });
  },
};

// ---------------------------------------------------------------------
// Musik ambient loop — sequencer lookahead
// ---------------------------------------------------------------------
export function setIntensity(v) {
  intensity = Math.max(0, Math.min(1, v));
  if (ctx && settings.music) {
    musicBus.gain.setTargetAtTime(0.14 + intensity * 0.1, ctx.currentTime, 0.5);
  }
}

function startMusic() {
  if (schedTimer || !ctx) return;
  playing = true;
  stepIndex = 0;
  nextStepTime = ctx.currentTime + 0.06;
  schedTimer = setInterval(musicTick, 100);
  if (settings.music) {
    musicBus.gain.setTargetAtTime(0.14 + intensity * 0.1, ctx.currentTime, 0.8);
  }
}

function stopMusic() {
  if (schedTimer) clearInterval(schedTimer);
  schedTimer = null;
  playing = false;
}

function musicTick() {
  if (!ctx || !playing) return;
  while (nextStepTime < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(stepIndex, nextStepTime);
    stepIndex++;
    nextStepTime += STEP_DUR;
  }
}

function scheduleStep(i, t) {
  const bar = Math.floor(i / 8) % 4;
  const chord = CHORDS[bar];
  const inBar = i % 8;
  const hot = intensity > 0.75;

  // Pad chord (awal bar) + kelima (tengah bar)
  if (inBar === 0) pad(chord.root, t, STEP_DUR * 8, 0.075 + intensity * 0.03);
  if (inBar === 4) pad(chord.fifth, t, STEP_DUR * 4, 0.045 + intensity * 0.025);
  // Bass pulse tiap 2 ketukan
  if (inBar % 4 === 0) bass(chord.root / 2, t, 0.16 + intensity * 0.1);
  // Click off-beat
  if (inBar % 2 === 1) hat(t, 0.02 + intensity * 0.014);
  // Arpeggio: kerapatan naik dengan intensity; oktaf tinggi saat boss
  if (inBar % 2 === 0 && Math.random() < 0.3 + intensity * 0.5) {
    const note = ARP[Math.floor(Math.random() * ARP.length)] * (hot ? 2 : 1);
    arp(note, t, 0.6 + intensity * 0.35);
  }
  // Sparkle tambahan saat boss (intensitas penuh)
  if (hot && inBar === 6 && Math.random() < 0.6) {
    arp(ARP[Math.floor(Math.random() * ARP.length)] * 2, t, 0.5);
  }
}

/** Pad lembut (2 osc detuned + lowpass). */
function pad(freq, t, dur, gain) {
  for (const detune of [0, 4]) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 620;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain / 2), t + 0.5);
    g.gain.setValueAtTime(Math.max(0.0001, gain / 2), t + dur - 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

function bass(freq, t, gain) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.5, STEP_DUR * 1.4));
  osc.connect(g);
  g.connect(musicBus);
  osc.start(t);
  osc.stop(t + 0.6);
}

function arp(freq, t, gain) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * 0.1), t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + STEP_DUR * 0.9);
  osc.connect(g);
  g.connect(musicBus);
  osc.start(t);
  osc.stop(t + STEP_DUR);
}

function hat(t, gain) {
  noise({ dur: 0.03, gain, filterFreq: 6000, type: 'highpass', t, bus: musicBus });
}

// ---------------------------------------------------------------------
// Helper synth
// ---------------------------------------------------------------------
/** Oscillator + envelope eksponensial (freqEnd optional = glide). */
function tone({ type, freq, freqEnd, dur, gain, t, bus = sfxBus }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

/** Noise burst ter-filter (buffer 1 detik dibuat sekali). */
function noise({ dur, gain, filterFreq = 2000, type = 'highpass', t, bus = sfxBus }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(bus);
  src.start(t);
  src.stop(t + dur + 0.03);
}

function createNoiseBuffer(ac) {
  const len = Math.floor(ac.sampleRate * 1);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
