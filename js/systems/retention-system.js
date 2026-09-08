/**
 * retention-system.js — Fase 17: parameter 5 retention trigger (dokumen
 * "Retention Trigger Imunverse") dalam SATU modul pembaca data/retention.json.
 * Semua angka (reward IMU, combo, XP per kill, partikel, sinergi) hidup di
 * data — tidak ada angka keras di logic.
 */

import { getData } from '../core/data-store.js';
import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { spendImun } from './imun-economy.js';

/** Konfigurasi trigger (data/retention.json). */
export function getRetention() {
  return getData().retention;
}

/**
 * Imun Coin akhir run — spek: (wave × 8) + (kills × 0.5) + (boss × 50).
 * @returns {number} bulat
 */
export function imuForRun(wave, kills, bossKills, victory = false) {
  // Imun Coin adalah currency premium langka: hanya boss dan victory.
  // Kill biasa memberi Antibodi (soft currency), bukan Imun Coin.
  const r = getRetention().imuReward;
  let imu = Math.floor((bossKills || 0) * (r.perBoss || 0));
  if (victory) imu += r.victoryBonus || 0;
  return imu;
}

/**
 * XP per kill sesuai tier musuh: kecil 5–8, besar 12–15, boss 50 (acak di rentang).
 */
export function xpForKill(tier, isBoss) {
  const cfg = getRetention().xpPerKill;
  if (isBoss) return cfg.boss;
  const [lo, hi] = cfg[tier] || cfg.medium;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Perkalian XP saat combo aktif (≥ threshold kill dalam window detik). */
export function comboXpMult(comboCount) {
  const c = getRetention().combo;
  return comboCount >= c.threshold ? c.xpMult : 1;
}

/**
 * Terapkan UPGRADE GLOBAL (semua hero) ke statistik dasar run.
 * damage/moveSpeed/attackSpeed/attackRange = persen; maxHP = flat; lifeSteal = persen.
 */
export function applyGlobalUpgrades(stats) {
  const meta = STATE.meta;
  const owned = meta.globalUpgrades || {};
  const defs = getData().upgrades.globalUpgrades || [];
  for (const def of defs) {
    const lv = owned[def.id] || 0;
    if (lv <= 0) continue;
    if (def.stat === 'damage') stats.damage *= 1 + def.perLevel * lv;
    else if (def.stat === 'maxHP') stats.maxHP += def.perLevel * lv;
    else if (def.stat === 'moveSpeed') stats.speed *= 1 + def.perLevel * lv;
    else if (def.stat === 'attackSpeed') stats.cooldown /= 1 + def.perLevel * lv;
    else if (def.stat === 'attackRange') {
      stats.attackRange *= 1 + def.perLevel * lv;
      stats.swipeRadius *= 1 + def.perLevel * lv;
    } else if (def.stat === 'lifeSteal') stats.lifeSteal += def.perLevel * lv;
  }
  return stats;
}

/** Biaya upgrade global level berikutnya: round(50 × 1.15^level). */
export function globalUpgradeCost(def, level) {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
}

/** Level upgrade global saat ini. */
export function globalUpgradeLevel(meta, id) {
  return (meta.globalUpgrades && meta.globalUpgrades[id]) || 0;
}

/**
 * Beli upgrade global dengan Imun Coin (bersifat global — semua hero).
 * @returns {{ok:boolean, reason?:string}}
 */
export function purchaseGlobalUpgrade(id) {
  const meta = STATE.meta;
  const def = (getData().upgrades.globalUpgrades || []).find((d) => d.id === id);
  if (!def) return { ok: false, reason: 'Upgrade tidak ditemukan' };
  const lv = globalUpgradeLevel(meta, id);
  if (lv >= def.maxLevel) return { ok: false, reason: 'Level maksimal' };
  const cost = globalUpgradeCost(def, lv);
  if (meta.imun < cost) return { ok: false, reason: 'Imun Coin tidak cukup' };
  if (!spendImun(meta, cost)) return { ok: false, reason: 'Imun Coin tidak cukup' };
  meta.globalUpgrades = meta.globalUpgrades || {};
  meta.globalUpgrades[id] = lv + 1;
  writeSave(meta);
  return { ok: true, level: lv + 1, cost };
}

/**
 * Sinergi hero → id upgrade in-run yang "cocok" (untuk badge ✦ di level-up).
 * @returns {string[]} daftar id upgrade pool
 */
export function synergyFor(heroDef) {
  const map = getRetention().synergy || {};
  return map[heroDef && heroDef.role] || [];
}

/** Notifikasi hero baru: antre nama untuk overlay perayaan di dashboard. */
export function queueHeroNotice(heroId) {
  const meta = STATE.meta;
  meta.heroNotices = meta.heroNotices || [];
  if (!meta.heroNotices.includes(heroId)) meta.heroNotices.push(heroId);
}

/** Ambil & kosongkan antrean notifikasi hero (dipanggil dashboard show()). */
export function drainHeroNotices() {
  const meta = STATE.meta;
  const ids = meta.heroNotices || [];
  if (ids.length) {
    meta.heroNotices = [];
    writeSave(meta);
  }
  return ids
    .map((id) => getData().heroes.heroes.find((h) => h.id === id))
    .filter(Boolean);
}
