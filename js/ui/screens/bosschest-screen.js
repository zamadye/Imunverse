/**
 * bosschest-screen.js — Modal Peti Boss (muncul saat boss tumbang).
 * Titik istirahat alami: gameplay sudah dipause oleh game.openBossChest().
 * Pemain memilih: ambil isi normal, ATAU tonton iklan reward (simulasi)
 * untuk menggandakan isi — selalu opsional sesuai riset penempatan ads.
 */

import { game } from '../../core/game.js';
import { el } from '../screen-manager.js';

export function show(payload) {
  const loot = document.getElementById('chest-loot');
  loot.textContent = '';
  loot.appendChild(el('div', { class: 'loot' }, [
    el('img', { src: 'assets/sprites/icon_coin.png', alt: 'antibodi' }),
    el('span', { text: `+${payload.currency}` }),
  ]));
  loot.appendChild(el('div', { class: 'loot' }, [
    el('img', { src: payload.partSprite || 'assets/sprites/part_silia.png', alt: 'bagian' }),
    el('span', { text: `+1 ${payload.partName}` }),
  ]));

  const adBtn = document.getElementById('btn-chest-ad');
  adBtn.disabled = !payload.adAvailable;
  adBtn.textContent = payload.adAvailable ? 'TONTON IKLAN — 2X LOOT' : 'KUOTA IKLAN HARI INI PENUH';
}

export function hide() {}

export function wire() {
  document.getElementById('btn-chest-ad').addEventListener('click', () => {
    game.claimBossChestDouble();
  });
  document.getElementById('btn-chest-keep').addEventListener('click', () => {
    game.claimBossChestKeep();
  });
}
