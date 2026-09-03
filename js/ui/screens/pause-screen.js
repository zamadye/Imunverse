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
    box.appendChild(el('div', { text: `⏱ ${s.time} · ${s.kills} patogen` }));
    box.appendChild(el('div', { text: `🛡️ ${s.currency} antibodi terkumpul (dibawa pulang saat run diakhiri)` }));
  }
}

export function hide() {}
