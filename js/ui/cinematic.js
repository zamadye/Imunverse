/**
 * cinematic.js — MESIN SINEMATIK (cutscene canvas 2D, tanpa file video).
 *
 * "Video animasi" imun vs patogen dirender prosedural: shot berisi aktor
 * (sprite) yang bergerak antar-titik + teks narasi + judul, digambar di
 * canvas fullscreen dengan easing. Bisa di-skip. Semua scene dari
 * data/cinematics.json — konten baru = data baru.
 *
 * Pemakaian yang tepat (natural breakpoint):
 *  - intro            : peluncuran pertama (sebelum dashboard)
 *  - brief_<chapterId>: sebelum run bab baru dimulai (story organ sakit)
 *  - clear_<chapterId>: setelah menang bab (organ bersih — celebrasi)
 */

import { getData } from '../core/data-store.js';
import { getSprite } from '../render/sprite-loader.js';
import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { audio } from '../systems/audio-system.js';

const EASE = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
};

class CinematicPlayer {
  constructor() {
    this.layer = null;
    this.canvas = null;
    this.ctx = null;
    this.textEl = null;
    this.playing = false;
    this.onEnd = null;
    this._raf = null;
  }

  _ensureDom() {
    if (this.layer) return;
    this.layer = document.getElementById('cinematic-layer');
    this.canvas = document.getElementById('cinematic-canvas');
    this.textEl = document.getElementById('cine-text');
    document.getElementById('cine-skip').addEventListener('click', () => this.stop());
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Putar scene berdasarkan id di data/cinematics.json.
   * @param {string} sceneId
   * @param {() => void} onEnd dipanggil saat selesai/di-skip
   */
  play(sceneId, onEnd) {
    this._ensureDom();
    const scene = (getData().cinematics.scenes || []).find((s) => s.id === sceneId);
    if (!scene) {
      if (onEnd) onEnd();
      return;
    }
    this.playing = true;
    this.onEnd = onEnd;
    this.layer.classList.remove('hidden');
    audio.unlock();
    audio.evolve(); // fanfare pembuka sinematik

    const resize = () => {
      this.canvas.width = this.layer.clientWidth * (window.devicePixelRatio || 1);
      this.canvas.height = this.layer.clientHeight * (window.devicePixelRatio || 1);
      this.ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    };
    resize();
    this._onResize = resize;
    window.addEventListener('resize', this._onResize);

    const totalDur = scene.shots.reduce((a, s) => a + s.dur, 0) / 1000;
    const start = performance.now();
    let lastText = null;

    const drawFrame = (now) => {
      if (!this.playing) return;
      const t = (now - start) / 1000;
      // Temukan shot aktif
      let acc = 0;
      let shot = scene.shots[scene.shots.length - 1];
      let shotT = 1;
      for (const s of scene.shots) {
        const d = s.dur / 1000;
        if (t < acc + d) {
          shot = s;
          shotT = (t - acc) / d;
          break;
        }
        acc += d;
      }
      const ctx = this.ctx;
      const W = this.layer.clientWidth;
      const H = this.layer.clientHeight;
      const e = EASE[shot.ease || 'inOut'](Math.min(1, shotT));

      // Latar gradasi organ
      const [c1, c2] = shot.bg || ['#ffe9d6', '#ffd6c2'];
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Gelembung dekoratif melayang (suasana dalam tubuh)
      ctx.save();
      for (let i = 0; i < 14; i++) {
        const bx = ((i * 137.5) % 100) / 100 * W + Math.sin(t * 0.7 + i) * 14;
        const by = H - (((t * (14 + i * 5) + i * 93) % (H + 80)) - 40);
        const br = 4 + (i % 4) * 3;
        ctx.globalAlpha = 0.14;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      ctx.restore();

      // Aktor: tween antar posisi (koordinat 0..1 relatif layar)
      for (const a of shot.actors || []) {
        const [x0, y0] = a.from;
        const [x1, y1] = a.to || a.from;
        const x = (x0 + (x1 - x0) * e) * W;
        const y = (y0 + (y1 - y0) * e) * H;
        const size = (a.scale || 0.16) * Math.min(W, H);
        const entry = getSprite(a.sprite);
        const img = entry.image;
        const bob = Math.sin(t * 3 + (a.wobbleSeed || 0)) * size * 0.04;
        ctx.save();
        ctx.globalAlpha = a.alpha !== undefined ? a.alpha : 1;
        if (img && img.width) ctx.drawImage(img, x - size / 2, y - size / 2 + bob, size, size);
        ctx.restore();
      }

      // Judul (mengetik + fade)
      if (shot.title) {
        ctx.save();
        ctx.font = `900 ${Math.round(Math.min(W, H) * 0.085)}px 'Trebuchet MS', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = shot.titleColor || '#1f7a70';
        const chars = Math.floor(shotT * shot.title.length * 1.6);
        ctx.fillText(shot.title.slice(0, chars), W / 2, H * (shot.titleY || 0.24));
        ctx.restore();
      }

      // Narasi bawah (ganti teks dengan fade sederhana)
      if (shot.text && shot.text !== lastText) {
        lastText = shot.text;
        this.textEl.classList.remove('visible');
        setTimeout(() => {
          if (this.playing) {
            this.textEl.textContent = shot.text;
            this.textEl.classList.add('visible');
          }
        }, 160);
      }
      if (!shot.text && lastText) {
        lastText = null;
        this.textEl.classList.remove('visible');
      }

      if (t >= totalDur) {
        this.stop();
        return;
      }
      this._raf = requestAnimationFrame(drawFrame);
    };
    this._raf = requestAnimationFrame(drawFrame);
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this.layer.classList.add('hidden');
    this.textEl.classList.remove('visible');
    const cb = this.onEnd;
    this.onEnd = null;
    if (cb) cb();
  }
}

export const cinematic = new CinematicPlayer();

/** Putar scene sekali saja (ditandai di meta.cinematicsSeen) lalu lanjut. */
export function playOnce(sceneId, onEnd) {
  const meta = STATE.meta;
  meta.cinematicsSeen = meta.cinematicsSeen || {};
  if (meta.cinematicsSeen[sceneId]) {
    if (onEnd) onEnd();
    return;
  }
  meta.cinematicsSeen[sceneId] = true;
  writeSave(meta);
  cinematic.play(sceneId, onEnd);
}
