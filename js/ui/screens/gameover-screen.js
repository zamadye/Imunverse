/**
 * gameover-screen.js — Summary hasil run: wave, waktu, kill, XP, nutrisi,
 * antibodi didapat + tombol rewarded ad 2x currency (HOOK monetisasi,
 * alur setelahnya logic asli via game.applyDoubleCurrency()).
 * wireButtons() dipanggil SEKALI dari main.js saat boot.
 */

import { STATE } from '../../core/state-manager.js';
import { game } from '../../core/game.js';
import { triggerRewardedAdDoubleCurrency } from '../../systems/monetization.js';
import { el } from '../screen-manager.js';

export function show(summary) {
  const title = document.getElementById('gameover-title');
  title.textContent = summary.quit ? 'RUN DIAKHIRI' : 'PERMAINAN SELESAI';
  title.className = 'gameover-title' + (summary.quit ? ' win' : '');

  document.getElementById('gameover-sub').textContent =
    summary.wave >= 10
      ? 'Luar biasa! Sistem imun mengingat pengorbananmu.'
      : 'Sistem imun mengingat pengorbananmu. Setiap run membuat squad semakin kuat.';

  const grid = document.getElementById('gameover-summary');
  grid.textContent = '';
  const cells = [
    [summary.wave, 'Gelombang'],
    [formatTime(summary.time), 'Bertahan'],
    [summary.kills, 'Patogen Kalah'],
    [summary.level, 'Level'],
    [summary.bossKills, 'Boss Kalah'],
    [summary.nutrients, 'Nutrisi'],
  ];
  for (const [value, label] of cells) {
    grid.appendChild(el('div', { class: 'summary-cell' }, [
      el('b', { text: String(value) }),
      el('span', { text: label }),
    ]));
  }

  document.getElementById('gameover-currency').textContent = `+${summary.currencyEarned} 🛡️`;

  const dblBtn = document.getElementById('btn-double-currency');
  dblBtn.disabled = !game.canDoubleCurrency();
  dblBtn.textContent = game.canDoubleCurrency()
    ? '🎬 Tonton Iklan → 2x Antibodi'
    : `Total Antibodi: ${STATE.meta.currency} 🛡️`;
}

export function wireButtons() {
  document.getElementById('btn-double-currency').addEventListener('click', () => {
    const dblBtn = document.getElementById('btn-double-currency');
    if (!game.canDoubleCurrency()) return;
    dblBtn.disabled = true;
    dblBtn.textContent = '📺 Memutar iklan… (simulasi)';
    triggerRewardedAdDoubleCurrency(() => {
      const total = game.applyDoubleCurrency(); // logic asli + auto-save
      dblBtn.textContent = `✓ 2x! Total: ${total} 🛡️`;
    });
  });

  document.getElementById('btn-retry').addEventListener('click', () => {
    game.startRun(STATE.meta.selectedHero); // 'runstart' → HUD tampil otomatis
  });

  document.getElementById('btn-home').addEventListener('click', () => {
    // navigasi ditangani main.js lewat delegasi tombol data-nav
    window.__IMUNVERSE_goDashboard();
  });
}

export function hide() {}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
