/**
 * roster-screen.js — Roster ala reference: lingkaran avatar berwarna per hero,
 * badge gembok untuk yang terkunci, ring glow untuk yang terpilih.
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { getHeroStatus } from '../../systems/unlock-system.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { writeSave } from '../../save/save-manager.js';
import { game } from '../../core/game.js';
import { el } from '../screen-manager.js';
import { heroLevelBadge } from '../../systems/economy-system.js';
import { screenManager as sm } from '../screen-manager.js';

const PATTERN_LABEL = {
  melee_swipe: 'Tebasan Area',
  ranged_pierce: 'Penembus',
  ranged_homing: 'Penjejak',
};

/** Ubah '#rrggbb' → 'rgba(r,g,b,a)'. */
function hexAlpha(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(191,227,216,${a})`;
  const int = parseInt(m[1], 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${a})`;
}

export function show() {
  const meta = STATE.meta;
  const grid = document.getElementById('roster-grid');
  grid.textContent = '';

  // Fase 13.1: chip progres koleksi di subtitle (x/11 terbuka)
  const heroesAll = getData().heroes.heroes;
  const openCount = heroesAll.filter((h) => getHeroStatus(meta, h).unlocked).length;
  const subEl = document.querySelector('#screen-roster .screen-subtitle');
  if (subEl) {
    let chip = subEl.querySelector('.count-chip');
    if (!chip) { chip = el('span', { class: 'count-chip' }); subEl.appendChild(chip); }
    chip.textContent = '';
    chip.appendChild(el('span', { text: `${openCount}/${heroesAll.length} ` }));
    chip.appendChild(el('span', { text: 'Terbuka' }));
  }

  for (const heroDef of getData().heroes.heroes) {
    const status = getHeroStatus(meta, heroDef);
    const selected = meta.selectedHero === heroDef.id;

    const avatar = el('div', {
      class: 'avatar-wrap',
      style: `background: ${hexAlpha(heroDef.color, status.unlocked ? 0.35 : 0.18)}; border-color: ${status.unlocked ? hexAlpha(heroDef.color, 0.85) : '#e4d9bf'};`,
    }, [
      el('img', { class: 'hero-sprite', src: spriteToDataURL(heroDef.spritePortrait || heroDef.spriteIdle), alt: heroDef.name }),
    ]);

    const children = [avatar];

    if (status.unlocked) {
      children.push(el('div', { class: 'hero-name', text: heroDef.name }));
      children.push(el('div', { class: 'hero-pattern' }, [
        el('span', { text: PATTERN_LABEL[heroDef.attackPattern] || heroDef.attackPattern }),
        el('span', { class: 'hero-lvl-chip', text: heroLevelBadge(meta, heroDef.id) }),
      ]));
    } else {
      // Badge gembok aset PNG di lingkaran (ala mockup)
      avatar.appendChild(el('img', { class: 'lock-badge', src: 'assets/sprites/icon_lock.png', alt: 'terkunci' }));
      children.push(el('div', { class: 'hero-name', text: heroDef.name }));
      children.push(el('div', { class: 'lock-cond', text: status.conditionLabel }));
      if (status.shopCost > 0) {
        children.push(el('div', { class: 'lock-buy-note' }, [
        el('span', { text: `atau beli ${status.shopCost}` }),
        el('img', { class: 'inline-coin', src: 'assets/sprites/icon_coin.png', alt: '' }),
        el('span', { text: 'di Shop' }),
      ]));
      }
    }

    const card = el('div', {
      class: 'hero-card' + (status.unlocked ? '' : ' locked') + (selected ? ' selected' : ''),
      role: status.unlocked ? 'button' : undefined,
      title: status.unlocked ? `Detail & upgrade ${heroDef.name}` : heroDef.name,
      role: 'button',
      tabindex: status.unlocked ? '0' : '-1',
      onclick: () => {
        if (!status.unlocked) return;
        meta.selectedHero = heroDef.id;
        writeSave(meta);
        show(); // render ulang highlight
      },
    }, children);

    // Pilih via keyboard (aksesibilitas)
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        card.click();
      }
    });

    grid.appendChild(card);
    if (status.unlocked) card.addEventListener('click', () => sm.show('herodetail', { heroId: heroDef.id }));
  }

  // Tombol mulai aktif hanya bila hero terpilih terbuka
  const btn = document.getElementById('btn-start-run');
  const selHero = getData().heroes.heroes.find((h) => h.id === meta.selectedHero);
  const selStatus = selHero ? getHeroStatus(meta, selHero) : null;
  btn.disabled = !(selStatus && selStatus.unlocked);
  btn.textContent = selStatus && selStatus.unlocked ? `MULAI — ${selHero.name.toUpperCase()}` : 'HERO TERPILIH TERKUNCI';
}

export function hide() {}

/** Dipanggil dari main.js (tombol dock Heroes → pilih → mulai). */
export function startSelectedRun() {
  const meta = STATE.meta;
  const heroDef = getData().heroes.heroes.find((h) => h.id === meta.selectedHero);
  if (!heroDef) return;
  const status = getHeroStatus(meta, heroDef);
  if (!status.unlocked) return;
  game.startRun(heroDef.id);
}
