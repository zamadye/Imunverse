/**
 * bosschest-screen.js — Modal Peti Boss (muncul saat boss tumbang).
 * Titik istirahat alami: gameplay sudah dipause oleh game.openBossChest().
 * Pemain memilih: ambil isi normal, ATAU tonton iklan reward (simulasi)
 * untuk menggandakan isi — selalu opsional sesuai riset penempatan ads.
 */

import { game } from '../../core/game.js';
import { STATE } from '../../core/state-manager.js';
import { el } from '../screen-manager.js';

export function show(payload) {
  const loot = document.getElementById('chest-loot');
  loot.textContent = '';
  loot.appendChild(el('div', { class: 'loot' }, [
    el('img', { src: 'assets/icons/cur-antibodi.svg', alt: 'biokredit' }),
    el('span', { text: `+${payload.currency}` }),
  ]));
  loot.appendChild(el('div', { class: 'loot' }, [
    el('img', { src: payload.partSprite || 'assets/sprites/part_equity_receptor.png', alt: 'bagian' }),
    el('span', { text: `+1 ${payload.partName}` }),
  ]));

  const adBtn = document.getElementById('btn-chest-ad');
  adBtn.disabled = !payload.adAvailable;
  adBtn.textContent = payload.adAvailable ? 'TONTON IKLAN — 2X LOOT' : 'KUOTA IKLAN HARI INI PENUH';
  // Sprint 4.24: Peti Mutasi 150 Genom (pity tier-3 tiap ke-5; modal tetap terbuka).
  const mBtn = document.getElementById('btn-mutasi-chest');
  if (mBtn) {
    const pity = STATE.meta.mutasiPity || 0;
    mBtn.disabled = (STATE.meta.imun || 0) < 150;
    mBtn.textContent = pity >= 4 ? 'PETI MUTASI — 150G (PITY TIER 3!)' : `PETI MUTASI — 150G (pity ${pity + 1}/5)`;
  }
}

export function hide() {}

export function wire() {
  document.getElementById('btn-chest-ad').addEventListener('click', () => {
    game.claimBossChestDouble();
  });
  document.getElementById('btn-chest-keep').addEventListener('click', () => {
    game.claimBossChestKeep();
  });
  document.getElementById('btn-mutasi-chest').addEventListener('click', () => {
    const res = game.openMutasiChest();
    if (res.ok) show(game.run.bossChest); // segarkan label pity/saldo
  });
}
