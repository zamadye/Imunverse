/**
 * unlock-system.js — Cek kondisi unlock hero/organ/nutrisi dari mission
 * progress (statistik meta). Status locked/unlocked ditampilkan di roster
 * (opacity rendah + ikon gembok untuk yang terkunci).
 *
 * Dua jalur unlock:
 *  1. Kondisi statistik terpenuhi (auto-unlock, persist ke save).
 *  2. Pembelian di Toko dengan Antibodi (lihat economy-system.purchaseHeroUnlock).
 */

import { getData } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';

/**
 * Status hero: unlocked atau locked (beserta label kondisi & harga toko).
 * @returns {{unlocked:boolean, conditionLabel?:string, conditionMet:boolean, shopCost:number}}
 */
export function getHeroStatus(meta, heroDef) {
  const unlock = heroDef.unlock || { type: 'default' };

  if (unlock.type === 'default' || meta.unlockedHeroes.includes(heroDef.id)) {
    return { unlocked: true, conditionMet: true, shopCost: heroDef.shopCost || 0 };
  }

  let conditionMet = false;
  let conditionLabel = '';
  if (unlock.type === 'stat') {
    const value = meta.stats[unlock.stat] || 0;
    conditionMet = value >= unlock.value;
    conditionLabel = unlock.label || `Capai ${unlock.value} ${unlock.stat}`;
  }

  return {
    unlocked: false,
    conditionLabel,
    conditionMet,
    shopCost: heroDef.shopCost || 0,
  };
}

/**
 * Sinkronkan auto-unlock: bila kondisi statistik terpenuhi dan hero belum
 * tercatat di meta.unlockedHeroes, catat + persist.
 * @returns {object[]} daftar hero yang BARU terbuka (untuk toast)
 */
export function checkAutoUnlocks(meta) {
  const newly = [];
  for (const heroDef of getData().heroes.heroes) {
    const status = getHeroStatus(meta, heroDef);
    if (!status.unlocked && status.conditionMet) {
      meta.unlockedHeroes.push(heroDef.id);
      newly.push(heroDef);
    }
  }
  if (newly.length > 0) writeSave(meta); // auto-save setelah unlock
  return newly;
}

/** Apakah hero bisa dibeli di toko (locked + punya harga). */
export function isPurchasable(meta, heroDef) {
  const status = getHeroStatus(meta, heroDef);
  return !status.unlocked && (heroDef.shopCost || 0) > 0;
}
