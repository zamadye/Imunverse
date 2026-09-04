/**
 * shop-screen.js — Toko ala reference: grid kartu pastel 3 kolom, badge harga
 * kuning di pojok kanan-atas, badge gembok di kanan-bawah untuk terkunci.
 */

import { STATE } from '../../core/state-manager.js';
import { requireAccount } from '../../systems/account-system.js';
import { getData } from '../../core/data-store.js';
import { addCurrency, purchaseShopItem, purchaseHeroUnlock } from '../../systems/economy-system.js';
import { applySuplemen } from '../../systems/body-system.js';
import { writeSave } from '../../save/save-manager.js';
import { canWatchAd, trackAdWatch, triggerIAPSuplementPremium, triggerRewardedAdRecovery } from '../../systems/monetization.js';
import { emit } from '../../core/ui-bridge.js';
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
          if (!requireAccount('shop')) return; // transaksi wajib akun
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
          if (!requireAccount('shop')) return; // transaksi wajib akun
          const res = purchaseShopItem(STATE.meta, def.id); // logic + auto-save
          if (res.ok) show();
        },
      }),
    ]);
    itemGrid.appendChild(card);
  });
  itemSection.appendChild(itemGrid);
  wrap.appendChild(itemSection);

  // ---------------- Section: SUPLEMEN SISTEM (meta-layer kondisi tubuh) ----------------
  const bodyCfg = getData().bodySystems;
  const supSection = el('div', { class: 'shop-section' }, [el('h3', { text: 'SUPLEMEN SISTEM TUBUH' })]);
  const supGrid = el('div', { class: 'shop-grid' });
  bodyCfg.systems.forEach((sysDef, i) => {
    const card = el('div', { class: `shop-card ${PASTEL[i % PASTEL.length]}` }, [
      el('div', { class: 'price-tag' }, [
        el('img', { class: 'inline-coin', src: 'assets/sprites/icon_coin.png', alt: '' }),
        el('span', { text: String(bodyCfg.suplemenCost) }),
      ]),
      el('img', { class: 'shop-sprite', src: sysDef.icon, alt: sysDef.name }),
      el('b', { text: `Suplemen ${sysDef.name}` }),
      el('div', { class: 's-desc', text: `+${bodyCfg.suplemenGain} kesehatan ${sysDef.name} — ${sysDef.role}.` }),
      el('button', {
        class: 'btn btn-primary',
        text: 'BELI',
        disabled: meta.currency < bodyCfg.suplemenCost,
        onclick: () => {
          if (meta.currency < bodyCfg.suplemenCost) return;
          addCurrency(meta, -bodyCfg.suplemenCost); // sink currency (logic asli)
          const res = applySuplemen(sysDef.id, meta);
          if (res) emit('toast', { message: `Suplemen diminum: ${sysDef.name} +${res.gained}!`, kind: 'gold' });
          show();
        },
      }),
    ]);
    supGrid.appendChild(card);
  });

  // Suplemen Premium via IAP simulasi (+20 SEMUA sistem, 1x/hari via kuota)
  const premiumCard = el('div', { class: 'shop-card c-gold' }, [
    el('img', { class: 'shop-sprite', src: 'assets/sprites/meter_energi.png', alt: '' }),
    el('b', { text: 'Suplemen Premium' }),
    el('div', { class: 's-desc', text: `+${bodyCfg.suplemenGain} SEMUA sistem sekaligus (pembelian simulasi).` }),
    el('button', {
      class: 'btn btn-gold',
      text: canWatchAd(meta) ? 'BELI (IAP SIMULASI)' : 'KUOTA HARIAN PENUH',
      disabled: !canWatchAd(meta),
      onclick: () => {
        if (!canWatchAd(meta)) return;
        triggerIAPSuplementPremium(() => {
          trackAdWatch(meta);
          for (const sysDef of bodyCfg.systems) applySuplemen(sysDef.id, meta);
          emit('toast', { message: 'Suplemen Premium: semua sistem pulih!', kind: 'gold' });
          show();
        });
      },
    }),
  ]);
  supGrid.appendChild(premiumCard);
  supSection.appendChild(supGrid);
  wrap.appendChild(supSection);
}

export function hide() {}
