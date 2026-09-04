/**
 * pause-screen.js — Modal jeda: ringkasan run + lanjutkan / akhiri run.
 * Mengakhiri run tetap memproses ekonomi, misi, dan save (logic asli).
 */

import { game } from '../../core/game.js';
import { el } from '../screen-manager.js';

export function show() {
  const s = game.getRunSummary();
  const box = document.getElementById('pause-summary');
  box.textContent = '';
  if (s) {
    box.appendChild(el('div', { text: `Level ${s.level} · Gelombang ${s.wave}` }));
    // Ikon PNG (bukan emoji) — Chromium headless tak punya font emoji.
    box.appendChild(el('div', { class: 'pause-line' }, [
      el('img', { class: 'pause-ico', src: 'assets/sprites/icon_timer.png', alt: '' }),
      el('span', { text: ` ${s.time} · ${s.kills} patogen` }),
    ]));
    box.appendChild(el('div', { class: 'pause-line' }, [
      el('img', { class: 'pause-ico', src: 'assets/sprites/icon_coin.png', alt: '' }),
      el('span', { text: ` ${s.currency} antibodi terkumpul (dibawa pulang saat run diakhiri)` }),
    ]));
    if (s.maxCombo >= 2) {
      box.appendChild(el('div', { class: 'pause-line' }, [
        el('img', { class: 'pause-ico', src: 'assets/sprites/icon_star.png', alt: '' }),
        el('span', { text: ` Combo terbaik: x${s.maxCombo}` }),
      ]));
    }
  }
}

export function hide() {}
