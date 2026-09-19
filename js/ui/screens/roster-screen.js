/**
 * roster-screen.js — Roster ala reference: lingkaran avatar berwarna per hero,
 * badge gembok untuk yang terkunci, ring glow untuk yang terpilih.
 */

import { STATE } from '../../core/state-manager.js';
import { getData, getCharacterDesigns } from '../../core/data-store.js';
import { getHeroStatus } from '../../systems/unlock-system.js';
import { queueHeroNotice } from '../../systems/retention-system.js';
import { emit } from '../../core/ui-bridge.js';
import { t as tr } from '../../systems/i18n.js';
import { createHeroEquityPreview } from '../../render/character-preview.js';
import { writeSave } from '../../save/save-manager.js';
import { game } from '../../core/game.js';
import { el } from '../screen-manager.js';
import { masteryInfo } from '../../systems/mastery-system.js';
import { screenManager as sm } from '../screen-manager.js';
import { roleIconSrc, roleTint } from '../menu-icons.js';

const PATTERN_LABEL = {
  melee_swipe: 'Tebasan Area',
  ranged_pierce: 'Penembus',
  ranged_homing: 'Penjejak',
};

function rosterEquityCue(heroId, stage) {
  const designs = getCharacterDesigns();
  const heroDesign = designs?.heroes?.[heroId];
  if (!heroDesign) return null;
  if (stage <= 0) return {
    stage: 0,
    color: '#9db1a8',
    label: 'Polos',
    cue: heroDesign.baseCue,
  };
  const item = (heroDesign.equity || []).find((e) => e.stage === stage)
    || (heroDesign.equity || [])[Math.max(0, Math.min(stage - 1, (heroDesign.equity || []).length - 1))];
  const stageDef = (getData().evolutions.stages || []).find((s) => s.stage === stage);
  return item ? {
    stage,
    color: item.color || stageDef?.tierColor || '#35d0ba',
    label: stageDef?.collectionLabel || `Equity ${stage}`,
    cue: item.visualCue || item.name,
  } : null;
}

function rosterEquityMini(heroDef, meta) {
  const stage = Math.max(0, Math.min(4, meta.evoStage || 0));
  const cue = rosterEquityCue(heroDef.id, stage);
  if (!cue) return null;
  const dots = [];
  for (let i = 1; i <= 4; i++) {
    const dotCue = rosterEquityCue(heroDef.id, i);
    dots.push(el('span', {
      class: `roster-eq-dot${i <= stage ? ' on' : ''}${i === stage ? ' active' : ''}`,
      style: `--eq:${dotCue?.color || heroDef.color};`,
      title: dotCue ? `${dotCue.label}: ${dotCue.cue}` : `Equity ${i}`,
    }));
  }
  return el('div', { class: 'roster-equity', title: cue.cue }, [
    el('span', { class: 'roster-eq-chip', style: `--eq:${cue.color};`, text: cue.label }),
    el('span', { class: 'roster-eq-dots' }, dots),
    el('small', { text: cue.cue }),
  ]);
}

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
      createHeroEquityPreview(heroDef, meta.evoStage || 0, { size: 128, className: 'hero-sprite roster-hero-preview' }),
    ]);

    // UI/UX work order #3: badge PERAN (Tank/Damage/Support) di lingkaran avatar —
    // ikon bespoke assets/icons/role-*.svg, bahasa sama dengan Shop & Detail Hero.
    const roleSrc = roleIconSrc(heroDef.role);
    if (roleSrc) avatar.appendChild(el('img', { class: 'role-badge', src: roleSrc, alt: heroDef.role, title: heroDef.role, style: `--role:${roleTint(heroDef.role)}` }));

    const children = [avatar];

    // Fase 20: TIER SEJAK AWAL (common–legend) — ditentukan saat dapat hero,
    // TIDAK berubah oleh upgrade (feedback pemilik: eksklusivitas).
    const tierCfg = (getData().heroes.tiers || {})[heroDef.tier];
    if (tierCfg) {
      children.push(el('span', {
        class: 'tier-badge',
        style: `background:${tierCfg.color}`,
        text: tierCfg.label,
        title: `Tier ${tierCfg.label} — tetap selamanya, upgrade menambah kekuatan bukan tier`,
      }));
    }

    if (status.unlocked) {
      children.push(el('div', { class: 'hero-name', text: heroDef.name }));
      children.push(el('div', { class: 'hero-pattern' }, [
        el('span', { text: PATTERN_LABEL[heroDef.attackPattern] || heroDef.attackPattern }),
        el('span', { class: 'hero-lvl-chip', text: `Lv ${masteryInfo(meta, heroDef.id).level}` }),
      ]));
      const equity = rosterEquityMini(heroDef, meta);
      if (equity) children.push(equity);
    } else {
      // Badge gembok aset PNG di lingkaran (ala mockup)
      avatar.appendChild(el('img', { class: 'lock-badge', src: 'assets/icons/ui-lock.svg', alt: 'terkunci' }));
      children.push(el('div', { class: 'hero-name', text: heroDef.name }));
      children.push(el('div', { class: 'lock-cond', text: tr(status.conditionLabel) }));
      // Workflow minimal: jalur beli instan dengan Antibodi, DI SAMPING jalur
      // gratis (kondisi statistik di atas) — tombol beli sungguhan ada di
      // hero-detail (kartu ini cuma harga sekilas + navigasi ke sana).
      if (status.shopCost > 0) {
        children.push(el('div', { class: 'lock-cond lock-buy' + (status.canBuy ? ' afford' : ''), text: `◉ ${status.shopCost.toLocaleString('id-ID')} Antibodi` }));
      }
    }

    const card = el('div', {
      class: 'hero-card' + (status.unlocked ? '' : ' locked') + (selected ? ' selected' : ''),
      title: status.unlocked ? `Detail & upgrade ${heroDef.name}` : `${heroDef.name} — terkunci, ketuk untuk lihat syarat/beli`,
      // Kartu terkunci TETAP tombol sekarang: menuju hero-detail untuk lihat
      // syarat gratis ATAU beli dengan Antibodi (dua jalur, lihat unlock-system).
      role: 'button',
      tabindex: '0',
      // SATU handler: pilih hero (tersimpan, hanya bila SUDAH dimiliki) lalu
      // buka detail — hero terkunci tetap boleh dilihat detailnya (tombol beli
      // di sana), sama seperti rail carousel di hero-detail sendiri.
      onclick: () => {
        if (status.unlocked) {
          meta.selectedHero = heroDef.id;
          writeSave(meta);
        }
        sm.show('herodetail', { heroId: heroDef.id });
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
