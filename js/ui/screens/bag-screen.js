/**
 * bag-screen.js — TAS / INVENTORY: keranjang semua yang didapat pemain.
 * Bagian evolusi (dengan kebutuhan tahap berikutnya), consumable
 * (serum awal, dsb), dan ringkasan jalan evolusi berikutnya.
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { getNextEvoStageDef, canEvolve } from '../../systems/evolution-system.js';
import { el } from '../screen-manager.js';

export function show() {
  const meta = STATE.meta;
  document.getElementById('bag-currency').textContent = meta.currency.toLocaleString('id-ID');

  // ---- Bagian evolusi ----
  const partsGrid = document.getElementById('bag-parts');
  partsGrid.textContent = '';
  const next = getNextEvoStageDef(meta);
  for (const partDef of getData().evolutions.parts) {
    const have = meta.evoParts[partDef.id] || 0;
    const need = next ? (next.cost[partDef.id] || 0) : 0;
    const card = el('div', { class: `bag-card${need > have ? ' short' : ''}` }, [
      el('img', { class: 'bag-sprite', src: partDef.sprite, alt: partDef.name }),
      el('b', { text: partDef.name }),
      need > 0
        ? el('span', { class: `bag-count${have >= need ? ' ok' : ''}`, text: `${have}/${need}` })
        : el('span', { class: 'bag-count', text: String(have) }),
      el('small', { text: need > 0 ? (have >= need ? 'cukup ✓' : `butuh ${need - have} lagi`) : '—' }),
    ]);
    partsGrid.appendChild(card);
  }

  // ---- Consumable ----
  const itemsGrid = document.getElementById('bag-items');
  itemsGrid.textContent = '';
  const consumables = getData().upgrades.shopItems || [];
  let any = false;
  for (const def of consumables) {
    const owned = meta.consumables[def.id] || 0;
    any = any || owned > 0;
    itemsGrid.appendChild(el('div', { class: `bag-card${owned === 0 ? ' empty' : ''}` }, [
      def.icon.startsWith('assets/')
        ? el('img', { class: 'bag-sprite', src: def.icon, alt: def.name })
        : el('div', { class: 'icon-sprite', text: def.icon }),
      el('b', { text: def.name }),
      el('span', { class: `bag-count${owned > 0 ? ' ok' : ''}`, text: `×${owned}` }),
      el('small', { text: owned > 0 ? 'dipakai otomatis saat run' : 'beli di Shop' }),
    ]));
  }
  if (!any) {
    itemsGrid.appendChild(el('p', { class: 'bag-hint', text: 'Belum punya consumable — Serum Awal tersedia di Shop.' }));
  }

  // ---- Jalan evolusi berikutnya ----
  const evoBox = document.getElementById('bag-evo-next');
  evoBox.textContent = '';
  if (next) {
    evoBox.appendChild(el('b', { text: `Berikutnya: ${next.name} (${next.tier})` }));
    evoBox.appendChild(el('p', { text: 'Kalahkan patogen untuk mengumpulkan bagian — musuh elite (Virion & Parasit) drop 5x lebih sering, boss selalu drop.' }));
    if (canEvolve(meta)) {
      evoBox.appendChild(el('p', { class: 'bag-ready', text: 'Bagian lengkap! Buka Dashboard → kartu Evolusi → BEREVOLUSI.' }));
    }
  } else {
    evoBox.appendChild(el('b', { text: 'Evolusi maksimal — Imun Legenda sejati!' }));
  }
}

export function hide() {}
