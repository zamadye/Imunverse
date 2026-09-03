/**
 * levelup-screen.js — Modal pilihan 3 upgrade acak saat level up.
 * Game sudah di-pause oleh game.js sebelum modal ini tampil.
 * Pemain klik satu kartu → upgrade diterapkan (logic asli) → lanjut main.
 */

import { STATE } from '../../core/state-manager.js';
import { game } from '../../core/game.js';
import { el } from '../screen-manager.js';

export function show({ level, choices }) {
  document.getElementById('levelup-sub').textContent = `Level ${level} — pilih satu peningkatan`;

  const wrap = document.getElementById('levelup-choices');
  wrap.textContent = '';

  for (const def of choices) {
    const stacks = STATE.meta && game.run ? game.run.upgrades[def.id] || 0 : 0;
    const card = el('button', {
      class: 'choice-card',
      onclick: () => {
        game.chooseLevelUp(def.id);
        // bila masih ada level berlebih, game.js membuka modal baru — render ulang
        if (STATE.levelUpOpen && game.run && game.run.currentChoices) {
          show({ level: game.run.level, choices: game.run.currentChoices });
        }
      },
    }, [
      def.icon.startsWith('assets/')
        ? el('div', { class: 'choice-icon' }, [el('img', { src: def.icon, alt: '', style: 'width:28px;height:28px;object-fit:contain;' })])
        : el('div', { class: 'choice-icon', text: def.icon }),
      el('div', { class: 'choice-info' }, [
        el('b', { text: def.name }),
        el('p', { text: def.desc }),
        stacks > 0 ? el('span', { class: 'choice-stack', text: `Dimiliki: ${stacks}x` }) : null,
      ]),
    ]);
    wrap.appendChild(card);
  }
}

export function hide() {}
