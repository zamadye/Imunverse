/**
 * upgrade-screen.js — Upgrade Squad permanen: level, pips progres, harga
 * berikutnya (rumus costGrowth), beli dengan Antibodi (auto-save).
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { squadUpgradeCost, purchaseSquadUpgrade } from '../../systems/upgrade-system.js';
import { el } from '../screen-manager.js';

export function show() {
  const meta = STATE.meta;
  document.getElementById('upgrade-currency').textContent = meta.currency.toLocaleString('id-ID');

  const list = document.getElementById('upgrade-list');
  list.textContent = '';

  for (const def of getData().upgrades.squadUpgrades) {
    const level = meta.squadUpgrades[def.id] || 0;
    const maxed = level >= def.maxLevel;
    const cost = squadUpgradeCost(def, level);

    const pips = el('div', { class: 'upg-levels' });
    for (let i = 0; i < def.maxLevel; i++) {
      pips.appendChild(el('div', { class: 'upg-pip' + (i < level ? ' on' : '') }));
    }

    const buyBtn = maxed
      ? el('div', { class: 'upg-buy maxed', text: 'MAX' })
      : el('button', {
          class: 'btn btn-primary upg-buy',
          text: `${cost} 🛡️`,
          disabled: meta.currency < cost,
          onclick: () => {
            const res = purchaseSquadUpgrade(STATE.meta, def.id); // logic + auto-save
            if (res.ok) show();
            else if (res.reason) console.warn('[upgrade] ', res.reason);
          },
        });

    const row = el('div', { class: 'upg-row' }, [
      el('div', { class: 'upg-icon', text: def.icon }),
      el('div', { class: 'upg-info' }, [
        el('b', { text: def.name }),
        el('span', { class: 'upg-desc', text: def.desc }),
        pips,
      ]),
      buyBtn,
    ]);
    list.appendChild(row);
  }
}

export function hide() {}
