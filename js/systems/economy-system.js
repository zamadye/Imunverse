/**
 * economy-system.js — Ekonomi Antibodi (mata uang permanen):
 * pengeluaran, daily reward, bonus akhir run, dan pembelian item toko.
 * Semua perubahan penting langsung men-trigger writeSave (auto-save).
 */

import { getData } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';
import { emit } from '../core/ui-bridge.js'; // E1 poin 9

export function getEconomyConfig() {
  return getData().upgrades.economy;
}

/** Tambah currency meta (dipakai di akhir run). Nilai non-finite diabaikan. */
export function addCurrency(meta, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  meta.currency += amount;
  meta.stats.totalCurrencyEarned += amount;
}

/**
 * Kurangi currency bila cukup. @returns {boolean}
 * (pemanggil wajib writeSave setelah pembayaran sukses)
 */
export function spendCurrency(meta, amount) {
  if (meta.currency < amount) return false;
  meta.currency -= amount;
  return true;
}

function todayString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Apakah daily reward tersedia hari ini. */
export function canClaimDailyReward(meta) {
  return meta.lastDailyClaim !== todayString();
}

/**
 * Klaim daily reward. @returns {number} jumlah yang diklaim (0 bila tidak bisa).
 */
export function claimDailyReward(meta) {
  if (!canClaimDailyReward(meta)) return 0;
  const amount = getEconomyConfig().dailyReward;
  meta.lastDailyClaim = todayString();
  addCurrency(meta, amount);
  writeSave(meta); // auto-save
  return amount;
}

/**
 * Bonus akhir run: per wave + per kill (config di data/upgrades.json).
 * Fallback defensif: bila field wave belum terisi, pakai spawnSys.wave.
 */
export function computeRunEndBonus(run) {
  const cfg = getEconomyConfig();
  const wave = Number.isFinite(run.wave) ? run.wave : (run.spawnSys ? run.spawnSys.wave : 1);
  return wave * cfg.waveBonusPerWave + Math.floor(run.kills * cfg.killBonusCurrency);
}

