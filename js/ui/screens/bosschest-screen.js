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
    el('img', { src: 'assets/icons/cur-antibodi.svg', alt: 'antibodi' }),
    el('span', { text: `+${payload.currency}` }),
  ]));
  loot.appendChild(el('div', { class: 'loot' }, [
    el('img', { src: payload.partSprite || 'assets/sprites/part_equity_receptor.png', alt: 'bagian' }),
    el('span', { text: `+1 ${payload.partName}` }),
  ]));

  const adBtn = document.getElementById('btn-chest-ad');
  adBtn.disabled = !payload.adAvailable;
  adBtn.textContent = payload.adAvailable ? 'TONTON IKLAN — 2X LOOT' : 'KUOTA IKLAN HARI INI PENUH';

  // §7.4: Peti Riset — 2× loot dengan 150 Imun, TANPA iklan. Jalur & penanda
  // terpisah dari pity/kuota gratis: tombol ini hanya membaca saldo Imun.
  const rBtn = document.getElementById('btn-chest-research');
  if (rBtn) {
    const saldo = payload.imun || 0;
    rBtn.textContent = `PETI RISET — ${payload.researchCost} IMUN (2X LOOT)`;
    rBtn.disabled = !payload.researchAvailable || saldo < payload.researchCost;
    rBtn.title = saldo < payload.researchCost
      ? `Imun tidak cukup (saldo ${saldo})`
      : 'Gandakan isi peti dengan Imun — tanpa menonton iklan';
  }
}

export function hide() {}

export function wire() {
  document.getElementById('btn-chest-ad').addEventListener('click', () => {
    game.claimBossChestDouble();
  });
  document.getElementById('btn-chest-research')?.addEventListener('click', () => {
    game.buyResearchChest(); // gagal → toast dari game.js, modal tetap terbuka
  });
  document.getElementById('btn-chest-keep').addEventListener('click', () => {
    game.claimBossChestKeep();
  });
}
