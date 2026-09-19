/**
 * unlock-system.js — Cek kondisi unlock hero/organ/nutrisi dari mission
 * progress (statistik meta). Status locked/unlocked ditampilkan di roster
 * (opacity rendah + ikon gembok untuk yang terkunci).
 *
 * Workflow minimal (rombak V3): DUA jalur unlock, keduanya aktif sekaligus —
 * pemain memilih mana yang lebih cocok, bukan satu menggantikan yang lain:
 *  1. Kondisi statistik terpenuhi lewat main (gratis, auto-unlock, persist).
 *  2. Beli langsung dengan Antibodi (meta.currency) via purchaseHero() di
 *     bawah — utk pemain yang sudah cukup farm tapi belum capai syaratnya.
 * Harga per hero ada di data/heroes.json → heroes[].shopCost (skala tier).
 */

import { getData } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';
import { isDevMode } from '../core/dev-mode.js';
import { spendCurrency } from './economy-system.js';

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

  // Workflow minimal: jalur premium DIKEMBALIKAN sebagai alternatif — beli
  // langsung dengan Antibodi (meta.currency) bila pemain belum capai syarat
  // statistiknya tapi sudah cukup farm. Harga dari data/heroes.json.
  const cost = Number.isFinite(heroDef.shopCost) ? heroDef.shopCost : 0;
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
    canBuy: cost > 0 && meta.currency >= cost,
    unlockType: unlock.type,
  };
}

/**
 * Beli hero langsung dengan Antibodi (meta.currency) — jalur instan di
 * samping jalur gratis (kondisi statistik). Tidak mengganggu jalur gratis:
 * hero yang sudah unlocked lewat statistik tetap gratis, beli hanya untuk
 * yang belum capai syaratnya.
 * @returns {{ok:boolean, reason?:string}}
 */
export function purchaseHero(meta, heroDef) {
  if (!heroDef) return { ok: false, reason: 'Hero tidak ditemukan' };
  if ((meta.unlockedHeroes || []).includes(heroDef.id)) return { ok: false, reason: 'Sudah dimiliki' };
  const cost = Number.isFinite(heroDef.shopCost) ? heroDef.shopCost : 0;
  if (cost <= 0) return { ok: false, reason: 'Hero ini tidak dijual' };
  if (!spendCurrency(meta, cost)) return { ok: false, reason: `Butuh ${cost} Antibodi` };
  meta.unlockedHeroes.push(heroDef.id);
  writeSave(meta); // auto-save setelah pembelian
  return { ok: true, cost };
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

