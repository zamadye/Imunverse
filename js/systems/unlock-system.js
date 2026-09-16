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
import { isDevMode } from '../core/dev-mode.js';

/** Nilai stat meta; 'unlockedHeroes' = jumlah hero yang dimiliki. */
function metaValue(meta, stat) {
  if (stat === 'unlockedHeroes') return meta.unlockedHeroes.length;
  return meta.stats[stat] || 0;
}

/**
 * Status hero: unlocked atau locked (beserta label kondisi & harga toko).
 * @returns {{unlocked:boolean, conditionLabel?:string, conditionMet:boolean, shopCost:number}}
 */
export function getHeroStatus(meta, heroDef) {
  if (isDevMode()) return { unlocked: true, conditionMet: true, shopCost: 0, dev: true };
  const unlock = heroDef.unlock || { type: 'default' };

  if (unlock.type === 'default' || meta.unlockedHeroes.includes(heroDef.id)) {
    return { unlocked: true, conditionMet: true, shopCost: heroDef.shopCost || 0 };
  }

  // V2 §3 + IAP §22: jalur "buka hero dengan mata uang premium" (imu /
  // imu_stat) DIHAPUS. Hero terbuka dari progress bermain atau bawaan.
  const cost = 0;
  let conditionMet = false;
  let conditionLabel = '';
  if (unlock.type === 'stat') {
    const value = metaValue(meta, unlock.stat);
    conditionMet = value >= unlock.value;
    conditionLabel = unlock.label || `Capai ${unlock.value} ${unlock.stat}`;
  } else {
    // jalur lama 'imu'/'imu_stat' diperlakukan sebagai jalur stat bila
    // membawa syarat statistik; bila tidak, hero tidak bisa dibuka.
    if (unlock.stat) {
      const value = metaValue(meta, unlock.stat);
      conditionMet = value >= unlock.value;
      conditionLabel = unlock.label || `Capai ${unlock.value} ${unlock.stat}`;
    } else {
      conditionLabel = 'Tidak tersedia di V2';
    }
  }

  return {
    unlocked: false,
    conditionLabel,
    conditionMet,
    shopCost: cost,
    unlockType: unlock.type,
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
    const unlock = heroDef.unlock || { type: 'default' };
    // V2: hero terbuka dari progress bermain (stat) — jalur premium dihapus.
    if (unlock.type !== 'stat') continue;
    const status = getHeroStatus(meta, heroDef);
    if (!status.unlocked && status.conditionMet) {
      meta.unlockedHeroes.push(heroDef.id);
      newly.push(heroDef);
    }
  }
  if (newly.length > 0) writeSave(meta); // auto-save setelah unlock
  return newly;
}

