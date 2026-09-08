/**
 * bag-screen.js — TAS / INVENTORY: keranjang semua yang didapat pemain.
 * Bagian evolusi (dengan kebutuhan tahap berikutnya), consumable
 * (serum awal, dsb), dan ringkasan jalan evolusi berikutnya.
 */

import { STATE } from '../../core/state-manager.js';
import { getData, getCharacterDesigns, getHero } from '../../core/data-store.js';
import { getNextEvoStageDef, canEvolve } from '../../systems/evolution-system.js';
import { el } from '../screen-manager.js';

function appendDesignCollection(evoBox, meta) {
  const selectedHero = getHero(meta.selectedHero) || getData().heroes.heroes[0];
  const heroDesign = getCharacterDesigns()?.heroes?.[selectedHero.id];
  if (!selectedHero || !heroDesign) return;
  const stages = getData().evolutions.stages || [];
  const current = Math.max(0, Math.min(4, meta.evoStage || 0));
  const equityRows = [
    {
      stage: 0,
      label: stages.find((s) => s.stage === 0)?.collectionLabel || 'Stage 0 Polos',
      name: 'Base Polos',
      cue: heroDesign.baseCue,
      color: stages.find((s) => s.stage === 0)?.tierColor || '#9db1a8',
      cost: {},
    },
    ...(heroDesign.equity || []).map((item) => {
      const st = stages.find((s) => s.stage === item.stage) || {};
      return {
        stage: item.stage,
        label: st.collectionLabel || `Equity ${item.stage}`,
        name: item.name,
        cue: item.visualCue,
        color: item.color || st.tierColor || selectedHero.color,
        cost: st.cost || {},
      };
    }),
  ];

  evoBox.appendChild(el('div', { class: 'bag-design-panel' }, [
    el('div', { class: 'bag-design-head' }, [
      el('span', { class: 'bag-design-kicker', text: 'Character Design Collection' }),
      el('b', { text: `${selectedHero.name} — Jalur Equity` }),
      el('small', { text: 'Inventori part di atas sekarang punya konteks visual untuk tiap stage hero.' }),
    ]),
    el('div', { class: 'bag-design-list' }, equityRows.map((row) => el('div', {
      class: `bag-design-row${row.stage === current ? ' active' : ''}${row.stage < current ? ' done' : ''}`,
      style: `--eq:${row.color};`,
    }, [
      el('span', { class: 'bag-design-node', text: String(row.stage) }),
      el('div', { class: 'bag-design-copy' }, [
        el('b', { text: `${row.label} · ${row.name}` }),
        el('span', { text: row.cue || 'Cue visual equity.' }),
        Object.keys(row.cost).length
          ? el('small', { text: Object.entries(row.cost).map(([part, need]) => {
            const partDef = getData().evolutions.parts.find((p) => p.id === part);
            return `${need}× ${partDef ? partDef.name : part}`;
          }).join(' + ') })
          : el('small', { text: 'tanpa part — bentuk dasar/polos' }),
      ]),
    ]))),
  ]));
}

export function show() {
  const meta = STATE.meta;
  document.getElementById('bag-currency').textContent = meta.currency.toLocaleString('id-ID');

  // Fase 13.1: chip jumlah kepemilikan di header
  const partTotal = Object.values(meta.evoParts || {}).reduce((a, b) => a + (b || 0), 0);
  const itemTotal = Object.values(meta.consumables || {}).reduce((a, b) => a + (b || 0), 0);
  const bagHead = document.querySelector('#screen-bag .topbar');
  if (bagHead) {
    let chip = bagHead.querySelector('.count-chip');
    if (!chip) { chip = el('span', { class: 'count-chip' }); bagHead.insertBefore(chip, bagHead.querySelector('.currency-chip')); }
    chip.textContent = '';
    chip.appendChild(el('span', { text: `${partTotal + itemTotal} ` }));
    chip.appendChild(el('span', { text: 'item' }));
  }

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
  appendDesignCollection(evoBox, meta);
}

export function hide() {}
