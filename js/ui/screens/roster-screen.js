/**
 * roster-screen.js — Roster hero: kartu sprite (drawImage cache → dataURL),
 * status locked/unlocked (opacity rendah + ikon gembok), kondisi unlock dari
 * mission progress, dan tombol mulai run.
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { getHeroStatus } from '../../systems/unlock-system.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { writeSave } from '../../save/save-manager.js';
import { game } from '../../core/game.js';
import { el } from '../screen-manager.js';

const PATTERN_LABEL = {
  melee_swipe: '⚔️ Tebasan Area',
  ranged_pierce: '🏹 Sitokin Penembus',
  ranged_homing: '🎯 Antibodi Penjejak',
};

export function show() {
  const meta = STATE.meta;
  document.getElementById('roster-currency').textContent = meta.currency.toLocaleString('id-ID');

  const grid = document.getElementById('roster-grid');
  grid.textContent = '';

  for (const heroDef of getData().heroes.heroes) {
    const status = getHeroStatus(meta, heroDef);
    const selected = meta.selectedHero === heroDef.id;

    const card = el('div', {
      class: 'hero-card' + (status.unlocked ? '' : ' locked') + (selected ? ' selected' : ''),
      onclick: () => {
        if (!status.unlocked) return;
        meta.selectedHero = heroDef.id;
        writeSave(meta);
        show(); // render ulang highlight
      },
    });

    card.appendChild(el('img', { class: 'hero-sprite', src: spriteToDataURL(heroDef.spriteIdle), alt: heroDef.name }));
    card.appendChild(el('div', { class: 'hero-name', text: heroDef.name }));
    card.appendChild(el('div', { class: 'hero-title', text: heroDef.title }));
    card.appendChild(el('div', { class: 'hero-pattern', text: PATTERN_LABEL[heroDef.attackPattern] || heroDef.attackPattern }));
    card.appendChild(el('div', { class: 'hero-stats' }, [
      el('span', { text: `❤️${heroDef.baseStats.maxHP}` }),
      el('span', { text: `⚔️${heroDef.baseStats.damage}` }),
      el('span', { text: `💨${heroDef.baseStats.speed}` }),
    ]));

    // Overlay gembok untuk hero terkunci (opacity rendah + ikon gembok)
    if (!status.unlocked) {
      const overlay = el('div', { class: 'lock-overlay' }, [
        el('div', { class: 'lock-icon', text: '🔒' }),
        el('div', { class: 'lock-label', text: status.conditionLabel }),
      ]);
      if (status.shopCost > 0) {
        overlay.appendChild(el('div', { class: 'lock-buy', text: `atau beli: ${status.shopCost} 🛡️ di Toko` }));
      }
      card.appendChild(overlay);
    }

    grid.appendChild(card);
  }

  // Tombol mulai aktif hanya bila hero terpilih terbuka
  const btn = document.getElementById('btn-start-run');
  const selHero = getData().heroes.heroes.find((h) => h.id === meta.selectedHero);
  const selStatus = selHero ? getHeroStatus(meta, selHero) : null;
  btn.disabled = !(selStatus && selStatus.unlocked);
  btn.textContent = selStatus && selStatus.unlocked ? `PILIH & MULAI — ${selHero.name.toUpperCase()}` : 'HERO TERPILIH TERKUNCI';
}

export function hide() {}

/** Dipanggil dari index.html wiring (main.js) — lihat wiring tombol. */
export function startSelectedRun() {
  const meta = STATE.meta;
  const heroDef = getData().heroes.heroes.find((h) => h.id === meta.selectedHero);
  if (!heroDef) return;
  const status = getHeroStatus(meta, heroDef);
  if (!status.unlocked) return;
  game.startRun(heroDef.id);
}
