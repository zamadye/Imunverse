/**
 * upgrade-screen.js — Upgrade Squad ala reference: baris kartu dengan
 * "slider" level (track + knob) dan tombol pill harga dengan ikon .
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { squadUpgradeCost, purchaseSquadUpgrade } from '../../systems/upgrade-system.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { el } from '../screen-manager.js';

export function show() {
  const meta = STATE.meta;
  document.getElementById('upgrade-currency').textContent = meta.currency.toLocaleString('id-ID');

  // Banner ala mockup: tile hero besar + 2 tile musuh kecil
  const banner = document.getElementById('upg-banner');
  banner.textContent = '';
  const heroDefs = getData().heroes.heroes;
  const selHero = heroDefs.find((h) => h.id === meta.selectedHero) || heroDefs[0];
  const enemyDefs = getData().enemies.enemies;
  const bossDef = enemyDefs.find((e) => e.isBoss) || enemyDefs[0];
  const mobDef = enemyDefs.find((e) => e.id === 'virus') || enemyDefs[0];
  banner.appendChild(el('div', { class: 'ub-tile big' }, [
    el('img', { src: spriteToDataURL(selHero.spriteIdle), alt: selHero.name }),
  ]));
  banner.appendChild(el('div', { class: 'ub-side' }, [
    el('div', { class: 'ub-tile mini coral' }, [el('img', { src: spriteToDataURL(bossDef.sprite), alt: bossDef.name })]),
    el('div', { class: 'ub-tile mini coral light' }, [el('img', { src: spriteToDataURL(mobDef.sprite), alt: mobDef.name })]),
  ]));

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

    // Label LAYER upgrade (jelas kategori apa yang ditingkatkan)
    const LAYER = {
      sq_damage: 'SERANGAN', sq_weapon: 'SENJATA', sq_jurus: 'JURUS',
      sq_armor: 'PERTAHANAN', sq_vitality: 'PERTAHANAN',
      sq_swift: 'MOBILITAS', sq_attack: 'SERANGAN', sq_range: 'SENJATA',
      sq_nutrition: 'UTILITAS',
    };
    const layerTag = el('span', { class: 'upg-layer', text: LAYER[def.id] || 'LAINNYA' });

    const buyBtn = maxed
      ? el('div', { class: 'btn-buy maxed', text: 'MAX ✓' })
      : el('button', {
          class: 'btn btn-primary btn-buy',
          disabled: meta.currency < cost,
          onclick: () => {
            const res = purchaseSquadUpgrade(STATE.meta, def.id); // logic + auto-save
            if (res.ok) show();
            else if (res.reason) console.warn('[upgrade]', res.reason);
          },
        }, [
          el('img', { class: 'inline-coin', src: 'assets/sprites/icon_coin.png', alt: '' }),
          el('span', { text: cost.toLocaleString('id-ID') }),
        ]);

    const row = el('div', { class: 'upg-row' }, [
      el('div', { class: 'upg-head' }, [
        def.icon.startsWith('assets/')
          ? el('div', { class: 'upg-icon' }, [el('img', { src: def.icon, alt: '', style: 'width:26px;height:26px;object-fit:contain;' })])
          : el('div', { class: 'upg-icon', text: def.icon }),
        el('div', { class: 'upg-info' }, [
          el('b', { class: 'upg-name-wrap' }, [
            el('span', { text: def.name }),
            layerTag,
          ]),
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
