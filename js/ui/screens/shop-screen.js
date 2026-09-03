/**
 * shop-screen.js — Toko: beli unlock hero (jalur alternatif kondisi misi)
 * dan item consumable (Serum Awal). Semua pembelian auto-save.
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { purchaseHeroUnlock, purchaseShopItem } from '../../systems/economy-system.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { el } from '../screen-manager.js';

export function show() {
  const meta = STATE.meta;
  document.getElementById('shop-currency').textContent = meta.currency.toLocaleString('id-ID');

  const wrap = document.getElementById('shop-sections');
  wrap.textContent = '';

  // ---------------- Section: buka hero ----------------
  const heroSection = el('div', { class: 'shop-section' }, [el('h3', { text: '🦠 BUKA HERO' })]);
  const heroGrid = el('div', { class: 'shop-grid' });
  for (const heroDef of getData().heroes.heroes) {
    const unlocked = meta.unlockedHeroes.includes(heroDef.id);
    const item = el('div', { class: 'shop-item' });
    const img = el('img', { src: spriteToDataURL(heroDef.spriteIdle), alt: heroDef.name, style: 'width:56px;height:56px;object-fit:contain;' + (unlocked ? '' : 'opacity:.35;filter:grayscale(.7);') });
    item.appendChild(img);
    item.appendChild(el('b', { text: heroDef.name }));
    item.appendChild(el('div', { class: 's-desc', text: heroDef.description }));

    if (unlocked) {
      item.appendChild(el('div', { class: 's-owned', text: '✓ Terbuka' }));
    } else if (!heroDef.shopCost) {
      item.appendChild(el('div', { class: 's-owned', style: 'color:var(--text-dim)', text: 'Tidak dijual' }));
    } else {
      item.appendChild(el('button', {
        class: 'btn btn-primary',
        style: 'width:100%;font-size:13px;',
        text: `Beli ${heroDef.shopCost} 🛡️`,
        disabled: meta.currency < heroDef.shopCost,
        onclick: () => {
          const res = purchaseHeroUnlock(STATE.meta, heroDef); // logic + auto-save
          if (res.ok) show();
        },
      }));
    }
    heroGrid.appendChild(item);
  }
  heroSection.appendChild(heroGrid);
  wrap.appendChild(heroSection);

  // ---------------- Section: item ----------------
  const itemSection = el('div', { class: 'shop-section' }, [el('h3', { text: '💉 ITEM' })]);
  const itemGrid = el('div', { class: 'shop-grid' });
  for (const def of getData().upgrades.shopItems) {
    const owned = meta.consumables[def.id] || 0;
    const item = el('div', { class: 'shop-item' }, [
      el('div', { class: 's-icon', text: def.icon }),
      el('b', { text: def.name }),
      el('div', { class: 's-desc', text: def.desc }),
      el('div', { class: 's-owned', text: `Dimiliki: ${owned}` }),
      el('button', {
        class: 'btn btn-primary',
        style: 'width:100%;font-size:13px;',
        text: `Beli ${def.cost} 🛡️`,
        disabled: meta.currency < def.cost,
        onclick: () => {
          const res = purchaseShopItem(STATE.meta, def.id); // logic + auto-save
          if (res.ok) show();
        },
      }),
    ]);
    itemGrid.appendChild(item);
  }
  itemSection.appendChild(itemGrid);
  wrap.appendChild(itemSection);
}

export function hide() {}
