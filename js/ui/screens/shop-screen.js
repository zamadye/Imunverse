/**
 * shop-screen.js — Toko ala reference: grid kartu pastel 3 kolom, badge harga
 * kuning di pojok kanan-atas, badge gembok di kanan-bawah untuk terkunci.
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { purchaseHeroUnlock, purchaseShopItem } from '../../systems/economy-system.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { el } from '../screen-manager.js';

const PASTEL = ['c-teal', 'c-green', 'c-coral'];

export function show() {
  const meta = STATE.meta;
  document.getElementById('shop-currency').textContent = meta.currency.toLocaleString('id-ID');

  const wrap = document.getElementById('shop-sections');
  wrap.textContent = '';

  // ---------------- Section: buka hero ----------------
  const heroSection = el('div', { class: 'shop-section' }, [el('h3', { text: 'BUKA HERO' })]);
  const heroGrid = el('div', { class: 'shop-grid' });
  const heroes = getData().heroes.heroes;
  heroes.forEach((heroDef, i) => {
    const unlocked = meta.unlockedHeroes.includes(heroDef.id);
    const card = el('div', { class: `shop-card ${PASTEL[i % PASTEL.length]}` });
    // Badge kategori bulat kecil di pojok kiri-atas (ala mockup shop)
    const decoIcons = ['assets/sprites/item_glukosa.png', 'assets/sprites/item_antibodi.png', 'assets/sprites/item_vitamin_c.png'];
    card.appendChild(el('img', { class: 'corner-deco', src: decoIcons[i % decoIcons.length], alt: '' }));
    // Badge harga di pojok (untuk yang dijual & belum dimiliki)
    if (!unlocked && heroDef.shopCost > 0) {
      card.appendChild(el('div', { class: 'price-tag' }, [
        el('img', { class: 'inline-coin', src: 'assets/sprites/icon_coin.png', alt: '' }),
        el('span', { text: String(heroDef.shopCost) }),
      ]));
    }
    card.appendChild(el('img', { class: 'shop-sprite', src: spriteToDataURL(heroDef.spriteIdle), alt: heroDef.name }));
    card.appendChild(el('b', { text: heroDef.name }));
    card.appendChild(el('div', { class: 's-desc', text: heroDef.description }));

    if (unlocked) {
      card.appendChild(el('div', { class: 's-owned', text: '✓ Dimiliki' }));
    } else if (!heroDef.shopCost) {
      card.appendChild(el('div', { class: 's-owned', text: 'Buka via misi' }));
      card.appendChild(el('img', { class: 'lock-badge', src: 'assets/sprites/icon_lock.png', alt: 'terkunci' }));
    } else {
      card.appendChild(el('button', {
        class: 'btn btn-primary',
        text: 'BELI',
        disabled: meta.currency < heroDef.shopCost,
        onclick: () => {
          const res = purchaseHeroUnlock(STATE.meta, heroDef); // logic + auto-save
          if (res.ok) show();
        },
      }));
      card.appendChild(el('img', { class: 'lock-badge', src: 'assets/sprites/icon_lock.png', alt: 'terkunci' }));
    }
    heroGrid.appendChild(card);
  });
  heroSection.appendChild(heroGrid);
  wrap.appendChild(heroSection);

  // ---------------- Section: item ----------------
  const itemSection = el('div', { class: 'shop-section' }, [el('h3', { text: 'ITEM' })]);
  const itemGrid = el('div', { class: 'shop-grid' });
  const items = getData().upgrades.shopItems;
  items.forEach((def, i) => {
    const owned = meta.consumables[def.id] || 0;
    const card = el('div', { class: `shop-card ${PASTEL[(i + 2) % PASTEL.length]}` }, [
      el('div', { class: 'price-tag' }, [
        el('img', { class: 'inline-coin', src: 'assets/sprites/icon_coin.png', alt: '' }),
        el('span', { text: String(def.cost) }),
      ]),
      def.icon.startsWith('assets/')
        ? el('img', { class: 'shop-sprite', src: def.icon, alt: '' })
        : el('div', { class: 'icon-sprite', text: def.icon }),
      el('b', { text: def.name }),
      el('div', { class: 's-desc', text: def.desc }),
      el('div', { class: 's-owned', text: `Dimiliki: ${owned}` }),
      el('button', {
        class: 'btn btn-primary',
        text: 'BELI',
        disabled: meta.currency < def.cost,
        onclick: () => {
          const res = purchaseShopItem(STATE.meta, def.id); // logic + auto-save
          if (res.ok) show();
        },
      }),
    ]);
    itemGrid.appendChild(card);
  });
  itemSection.appendChild(itemGrid);
  wrap.appendChild(itemSection);
}

export function hide() {}
