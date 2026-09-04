/**
 * economy-system.js — Ekonomi Antibodi (mata uang permanen):
 * pengeluaran, daily reward, bonus akhir run, dan pembelian item toko.
 * Semua perubahan penting langsung men-trigger writeSave (auto-save).
 */

import { getData } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';

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

/**
 * Beli item toko (consumable). @returns {{ok:boolean, reason?:string}}
 */
/** Teks chip level gabungan hero (antibodi + evolusi) utk UI: "Lv 3" / "Lv 0". */
export function heroLevelBadge(meta, heroId) {
  const lvl = (meta.heroLevels && meta.heroLevels[heroId]) || 0;
  return `Lv ${lvl}`;
}

/** Chip level pasukan: "Lv 2 · 3 sel". */
export function allyLevelBadge(meta) {
  const lvl = meta.allyLevel || 0;
  return `Lv ${lvl} · ${meta.allies || 1} sel`;
}

/** Biaya naik 1 level hero (level sekarang → cost). */
export function heroLevelCost(cfg, level) {
  return Math.round(cfg.baseCost * Math.pow(cfg.costGrowth, level));
}

/** Upgrade level hero (damage & HP khusus hero itu). */
export function purchaseHeroLevel(meta, heroId) {
  const cfg = getData().upgrades.heroUpgrade;
  meta.heroLevels = meta.heroLevels || {};
  const level = meta.heroLevels[heroId] || 0;
  if (level >= cfg.maxLevel) return { ok: false, reason: 'max' };
  const cost = heroLevelCost(cfg, level);
  if (meta.currency < cost) return { ok: false, reason: 'currency' };
  meta.currency -= cost;
  meta.heroLevels[heroId] = level + 1;
  writeSave(meta);
  return { ok: true, level: level + 1, cost };
}

/** Biaya naik 1 level pasukan. */
export function allyLevelCost(cfg, level) {
  return Math.round(cfg.baseCost * Math.pow(cfg.costGrowth, level));
}

/** Upgrade level PASUKAN (semua ally jadi lebih sakit & gesit). */
export function purchaseAllyLevel(meta) {
  const cfg = getData().upgrades.allyUpgrade;
  const level = meta.allyLevel || 0;
  if (level >= cfg.maxLevel) return { ok: false, reason: 'max' };
  const cost = allyLevelCost(cfg, level);
  if (meta.currency < cost) return { ok: false, reason: 'currency' };
  meta.currency -= cost;
  meta.allyLevel = level + 1;
  writeSave(meta);
  return { ok: true, level: level + 1, cost };
}

export function purchaseShopItem(meta, itemId) {
  const def = getData().upgrades.shopItems.find((i) => i.id === itemId);
  if (!def) return { ok: false, reason: 'Item tidak ditemukan' };
  if (meta.currency < def.cost) return { ok: false, reason: 'Antibodi tidak cukup' };
  meta.currency -= def.cost;
  meta.consumables[def.id] = (meta.consumables[def.id] || 0) + 1;
  writeSave(meta); // auto-save setelah pembelian
  return { ok: true };
}

/**
 * Beli unlock hero di toko (jalur alternatif selain kondisi misi).
 * @returns {{ok:boolean, reason?:string}}
 */
export function purchaseHeroUnlock(meta, heroDef) {
  const cost = heroDef.shopCost || 0;
  if (cost <= 0) return { ok: false, reason: 'Hero ini tidak dijual' };
  if (meta.unlockedHeroes.includes(heroDef.id)) return { ok: false, reason: 'Sudah terbuka' };
  if (!spendCurrency(meta, cost)) return { ok: false, reason: 'Antibodi tidak cukup' };
  meta.unlockedHeroes.push(heroDef.id);
  writeSave(meta); // auto-save setelah unlock
  return { ok: true };
}
