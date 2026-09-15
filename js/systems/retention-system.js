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
 * [RETIRED RONDE-4] Imun Coin tidak lagi mengalir dari hasil run — premium
 * currency hanya dari PEMBELIAN & reward Battle Pass (aturan revenue platform:
 * blueprint Master Phase 10 — premium tidak dimudahkan). Fungsi disimpan *
 * bernilai 0 supaya pemanggil lama tidak rusak; jangan dipakai untuk fitur baru.
 * @returns {number} selalu 0
 */
export function imuForRun() {
  return 0;
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

/**
 * Terapkan UPGRADE GLOBAL (semua hero) ke statistik dasar run.
 * D11: hanya damage/maxHP/moveSpeed di sini; pulseCdr/membraneRadius/
 * engulfHeal diterapkan di membrane-system via run.globalHomeo.
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
  }
  return stats;
}

/**
 * D11: level jalur Homeostasis membran untuk run ini.
 * @returns {{cdr:int, radius:int, engulf:int}}
 */
export function globalHomeoLevels(meta = STATE.meta) {
  const owned = (meta && meta.globalUpgrades) || {};
  return { cdr: owned.g_rapid || 0, radius: owned.g_range || 0, engulf: owned.g_steal || 0 };
}

/**
 * Sprint 3.21 (bible §6.3): Homeostasis 25 level — lv 1–10 Biokredit
 * (Σ701), lv 11–25 Genom (Σ≈111). @returns {{cost:int, currency:'bk'|'genom'}}
 */
export function globalUpgradeCost(def, level) {
  if (level < 10) return { cost: Math.round(def.baseCost * Math.pow(def.costGrowth, level)), currency: 'bk' };
  const i = level - 10;
  return { cost: Math.round((def.genomBase || 3) * Math.pow(def.genomGrowth || 1.12, i)), currency: 'genom' };
}

/** Level upgrade global saat ini. */
export function globalUpgradeLevel(meta, id) {
  return (meta.globalUpgrades && meta.globalUpgrades[id]) || 0;
}

/**
 * Beli upgrade global/Homeostasis (global — semua hero). lv 1–10 pakai
 * Biokredit, lv 11–25 pakai Genom (bible §6.3).
 * @returns {{ok:boolean, reason?:string, level?:int, cost?:int}}
 */
export function purchaseGlobalUpgrade(id) {
  const meta = STATE.meta;
  const def = (getData().upgrades.globalUpgrades || []).find((d) => d.id === id);
  if (!def) return { ok: false, reason: 'Upgrade tidak ditemukan' };
  const lv = globalUpgradeLevel(meta, id);
  if (lv >= def.maxLevel) return { ok: false, reason: 'Level maksimal' };
  const { cost, currency } = globalUpgradeCost(def, lv);
  if (currency === 'genom') {
    if (!spendImun(meta, cost)) return { ok: false, reason: 'Genom tidak cukup' };
  } else {
    if ((meta.currency || 0) < cost) return { ok: false, reason: 'Biokredit tidak cukup' };
    meta.currency -= cost;
  }
  meta.globalUpgrades = meta.globalUpgrades || {};
  meta.globalUpgrades[id] = lv + 1;
  writeSave(meta);
  return { ok: true, level: lv + 1, cost };
}

/**
 * Sprint 3.21 (bible §9): Reset Homeostasis — nolkan SEMUA jalur (tanpa
 * refund) seharga 200 Genom. @returns {{ok:boolean, reason?:string}}
 */
export function resetHomeostasis() {
  const meta = STATE.meta;
  const COST = 200;
  if (!spendImun(meta, COST)) return { ok: false, reason: 'Butuh 200 Genom untuk reset' };
  meta.globalUpgrades = {};
  writeSave(meta);
  return { ok: true };
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
