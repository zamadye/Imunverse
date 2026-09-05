/**
 * battlepass-screen.js — BATTLE PASS (Fase 14): dua jalur 30 level,
 * klaim manual, beli premium pakai Imun Coin. Layout landscape-friendly.
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import {
  ensureBp, xpNeed, buyPremiumPass, getTrackData, claimReward,
} from '../../systems/battlepass-system.js';
import { el, screenManager } from '../screen-manager.js';
import { emit } from '../../core/ui-bridge.js';
import { audio } from '../../systems/audio-system.js';
import { writeSave } from '../../save/save-manager.js';

let wired = false;

function refresh() {
  show();
}

function renderTrack(rowEl, meta, track) {
  rowEl.textContent = '';
  const items = getTrackData(meta, track);
  for (const it of items) {
    const cls = [
      'bp-cell',
      it.claimed ? 'claimed' : '',
      it.claimable ? 'claimable' : '',
      it.premiumLocked ? 'locked' : '',
    ].filter(Boolean).join(' ');
    const cell = el('button', { class: cls, title: it.label, 'aria-label': `Level ${it.lv}: ${it.label}` }, [
      el('span', { class: 'bp-lv', text: String(it.lv) }),
      el('span', { class: 'bp-reward', text: it.label }),
      it.claimed ? el('img', { class: 'bp-state', src: 'assets/sprites/icon_star.png', alt: 'diklaim' }) : null,
      it.premiumLocked ? el('img', { class: 'bp-state lock', src: 'assets/sprites/icon_lock.png', alt: 'premium' }) : null,
    ]);
    cell.addEventListener('click', () => {
      if (it.premiumLocked) {
        emit('toast', { message: 'Buka jalur premium untuk mengklaim ini.', kind: 'gold' });
        return;
      }
      const res = claimReward(meta, track, it.lv);
      if (res.ok) {
        audio.collect();
        emit('toast', { message: `Lv ${it.lv}: ${res.label}!`, kind: 'gold' });
        refresh();
      }
    });
    rowEl.appendChild(cell);
  }
}

export function show() {
  const meta = STATE.meta;
  const cfg = getData().battlepass;
  const bp = ensureBp(meta);

  // Header
  document.getElementById('bp-imun').textContent = (meta.imun || 0).toLocaleString('id-ID');
  document.getElementById('bp-season').textContent = `${cfg.name}`;
  document.getElementById('bp-level').textContent = String(bp.level);
  const need = xpNeed(bp.level);
  const pct = bp.level >= cfg.maxLevel ? 100 : Math.min(100, Math.round((bp.xp / need) * 100));
  document.querySelector('#bp-xp-fill').style.width = `${pct}%`;
  document.getElementById('bp-xp-text').textContent = bp.level >= cfg.maxLevel
    ? 'MAX' : `${Math.floor(bp.xp)} / ${need} XP`;

  const buyBtn = document.getElementById('btn-bp-premium');
  if (bp.premium) {
    buyBtn.textContent = '✓ PREMIUM AKTIF';
    buyBtn.disabled = true;
  } else {
    buyBtn.textContent = `PREMIUM — ${cfg.premiumCostImun} IMU`;
    buyBtn.disabled = false;
  }

  renderTrack(document.getElementById('bp-free'), meta, 'free');
  renderTrack(document.getElementById('bp-prem'), meta, 'prem');

  // Iklan Free-Imun dipasarkan di Shop; BP screen hanya info kecil
  const hint = document.getElementById('bp-hint');
  if (hint) hint.textContent = bp.premium
    ? 'Total Imun jalur premium > harga pass — musim berikutnya terbiayai!'
    : `Klaim jalur gratis, atau buka premium (${cfg.premiumCostImun} Imun) untuk hadiah 2× lebih besar.`;

  if (!wired) {
    wired = true;
    document.getElementById('btn-bp-back').addEventListener('click', () => screenManager.show('dashboard'));
    buyBtn.addEventListener('click', () => {
      const res = buyPremiumPass(meta);
      if (res.ok) {
        audio.levelup();
        emit('toast', { message: 'Jalur PREMIUM terbuka — selamat!', kind: 'gold' });
        writeSave(meta);
        refresh();
      } else {
        emit('toast', { message: res.error, kind: 'coral' });
      }
    });
    import('../../systems/i18n.js').then(({ translateTree }) => translateTree(document.getElementById('screen-bp')));
  }
}

export function hide() {}
