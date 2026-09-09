/**
 * vo-system.js — R3 (Narrative-Cinematic): lapisan VO narator (TTS) di atas
 * rantai master audio-system (volume & mute SATU rantai dgn SFX/musik).
 *
 * - MP3 di-decode on-demand → AudioBuffer (cache sesi; evict saat scene selesai)
 * - Ducking: saat VO bicara, gain musik diturunkan halus (setelah VO selesai
 *   dipulihkan) — agar dialog selalu di atas musik.
 * - Kesinkronan: cutscene-player memanggil play() dengan offset (detik ke-
 *   berapa dalam file) saat tautan VO terlambat — mencegah desync setelah tab
 *   ter-throttle.
 *
 * API: vo.preload(paths) / vo.play(path, {offset, volume}) / vo.stopAll()
 */

import { audio } from './audio-system.js';
import { music } from './music-system.js';

const cache = new Map(); // path -> Promise<AudioBuffer>
const active = new Set(); // source nodes aktif
let ducking = 0; // jumlah VO aktif yang sedang duck (refcount)
const MUSIC_GAIN_NORMAL = 0.09;
const MUSIC_GAIN_DUCKED = 0.03;

function setDuck(on) {
  ducking = Math.max(0, ducking + (on ? 1 : -1));
  const g = music.gain;
  if (!g || !audio.ctx) return;
  const target = ducking > 0 ? MUSIC_GAIN_DUCKED : MUSIC_GAIN_NORMAL;
  try {
    g.gain.cancelScheduledValues(audio.ctx.currentTime);
    g.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.12);
  } catch { /* gain belum ada */ }
}

function decode(path) {
  if (!cache.has(path)) {
    const p = (async () => {
      const res = await fetch(path);
      if (!res.ok) throw new Error('VO gagal dimuat: ' + path + ' (' + res.status + ')');
      const buf = await res.arrayBuffer();
      return audio.ctx.decodeAudioData(buf);
    })();
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

export const vo = {
  /** Pramuat file (background, non-blocking). Aman dipanggil berkali-kali. */
  preload(paths) {
    if (!audio.ctx) audio.unlock();
    for (const p of paths || []) { if (p) decode(p).catch(() => {}); }
  },

  /** Buang cache (setelah cutscene selesai) — hemat memori device menengah. */
  evict() {
    for (const k of [...cache.keys()]) cache.delete(k);
  },

  /**
   * Putar VO.
   * @param {string} path
   * @param {{offset?:number, volume?:number}} [opts] offset = detik ke-n dalam file (catch-up sync)
   * @returns {{stop: () => void}} handle — panggil handle.stop() untuk
   *   menghentikan HANYA VO ini (aman dipanggil sebelum start / setelah selesai).
   */
  play(path, opts = {}) {
    const handle = { stopped: false, src: null, stop() {
      handle.stopped = true;
      if (handle.src) {
        active.delete(handle.src);
        try { handle.src.onended = null; handle.src.stop(); } catch { /* sudah habis */ }
      }
    } };
    if (!path || !audio.ctx || audio.muted) return handle;
    const pending = decode(path);
    if (!pending) return handle;
    pending.then((buf) => {
      if (handle.stopped) return;
      if (active.size > 3) vo.stopAll(); // pengaman: maks 3 VO berbarengan
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const g = audio.ctx.createGain();
      g.gain.value = opts.volume !== undefined ? opts.volume : 0.95;
      src.connect(g).connect(audio.master);
      const off = Math.min(Math.max(0, opts.offset || 0), Math.max(0, buf.duration - 0.05));
      active.add(src);
      setDuck(true);
      src.onended = () => {
        if (handle.stopped) return;
        active.delete(src);
        setDuck(false);
      };
      src.start(0, off);
      handle.src = src;
    }).catch(() => { /* decode gagal → dialog tetap tampil sebagai teks */ });
    return handle;
  },

  /** Hentikan semua VO (skip cutscene / ganti scene). */
  stopAll() {
    for (const src of [...active]) {
      try { src.onended = null; src.stop(); } catch { /* sudah berhenti */ }
      active.delete(src);
    }
    setDuck(false);
  },

  /** Apakah ada VO sedang diputar. */
  playing() { return active.size > 0; },

  /** Estimasi durasi file (untuk auto-dismiss presenter) — best-effort via cache. */
  async duration(path) {
    try { const buf = await decode(path); return buf.duration; } catch { return null; }
  },
};
