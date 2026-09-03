/**
 * upgrade-screen.js — Upgrade Squad ala reference: baris kartu dengan
 * "slider" level (track + knob) dan tombol pill harga dengan ikon 💠.
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
    const pct = (level / def.maxLevel) * 100;

    // Slider ala mockup: fill + knob di ujung level
    const slider = el('div', { class: 'upg-slider' + (maxed ? ' maxed' : ''), role: 'img', 'aria-label': `Level ${level} dari ${def.maxLevel}` }, [
      el('div', { class: 'upg-fill', style: `width:${pct}%` }),
      el('div', { class: 'upg-knob', style: `left:${pct}%` }),
    ]);

    const buyBtn = maxed
      ? el('div', { class: 'btn-buy maxed', text: 'MAX ✓' })
      : el('button', {
          class: 'btn btn-primary btn-buy',
          text: `💠 ${cost.toLocaleString('id-ID')}`,
          disabled: meta.currency < cost,
          onclick: () => {
            const res = purchaseSquadUpgrade(STATE.meta, def.id); // logic + auto-save
            if (res.ok) show();
            else if (res.reason) console.warn('[upgrade]', res.reason);
          },
        });

    const row = el('div', { class: 'upg-row' }, [
      el('div', { class: 'upg-head' }, [
        el('div', { class: 'upg-icon', text: def.icon }),
        el('div', { class: 'upg-info' }, [
          el('b', { text: def.name }),
          el('span', { class: 'upg-desc', text: def.desc }),
        ]),
      ]),
      slider,
      el('div', { class: 'upg-foot' }, [
        el('span', { class: 'upg-count', text: `Lv ${level}/${def.maxLevel}` }),
        buyBtn,
      ]),
    ]);
    list.appendChild(row);
  }
}

export function hide() {}
