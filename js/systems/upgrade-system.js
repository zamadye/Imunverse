/**
 * upgrade-system.js — Dua jalur upgrade:
 *  1. Upgrade in-run (level-up): pilihan acak dari pool data/upgrades.json,
 *     berlaku sampai run berakhir.
 *  2. Upgrade Squad (permanen): dibeli dengan Antibodi, tersimpan di save.
 */

import { getData, xpToNextLevel } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';

// ---------------------------------------------------------------
// Level-up (in-run)
// ---------------------------------------------------------------

/**
 * Acak `count` pilihan upgrade unik dari pool.
 * @param {object} run  state run (untuk cek jumlah stack yang sudah diambil)
 * @returns {object[]} pilihan (referensi ke entri pool)
 */
export function rollLevelUpChoices(run) {
  const pool = getData().upgrades.levelUpPool;
  const count = getData().upgrades.levelUpChoices || 3;
  const available = pool.filter((u) => (run.upgrades[u.id] || 0) < u.maxStacks);
  // Fisher–Yates shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}

/**
 * Terapkan pilihan level-up ke state run.
 * @returns {{healAmount:number}} info efek untuk diolah game.js
 */
export function applyLevelUp(run, upgradeId) {
  const def = getData().upgrades.levelUpPool.find((u) => u.id === upgradeId);
  if (!def) throw new Error('Upgrade tidak ditemukan: ' + upgradeId);
  run.upgrades[upgradeId] = (run.upgrades[upgradeId] || 0) + 1;
  return { healAmount: def.id === 'maxHP' ? def.amount : 0 };
}

// ---------------------------------------------------------------
// Upgrade Squad (permanen, dibeli dengan currency)
// ---------------------------------------------------------------

export function getSquadUpgradeDef(id) {
  return getData().upgrades.squadUpgrades.find((u) => u.id === id) || null;
}

/** Harga level berikutnya: round(baseCost * costGrowth^level). */
export function squadUpgradeCost(def, currentLevel) {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}

/**
 * Coba beli upgrade squad permanen.
 * @returns {{ok:boolean, reason?:string}}
 */
export function purchaseSquadUpgrade(meta, id) {
  const def = getSquadUpgradeDef(id);
  if (!def) return { ok: false, reason: 'Upgrade tidak ditemukan' };
  const level = meta.squadUpgrades[id] || 0;
  if (level >= def.maxLevel) return { ok: false, reason: 'Sudah maksimum' };
  const cost = squadUpgradeCost(def, level);
  if (meta.currency < cost) return { ok: false, reason: 'Antibodi tidak cukup' };
  meta.currency -= cost;
  meta.squadUpgrades[id] = level + 1;
  writeSave(meta); // auto-save setelah pembelian
  return { ok: true };
}

/**
 * Total multiplier dari semua upgrade squad (dipakai computeStats di game.js).
 * @returns {{damage:number, maxHP:number, speed:number, attackSpeed:number, attackRange:number, xpGain:number}}
 */
export function squadMultipliers(meta) {
  const out = { damage: 1, maxHP: 1, speed: 1, attackSpeed: 1, attackRange: 1, xpGain: 1 };
  for (const def of getData().upgrades.squadUpgrades) {
    const level = meta.squadUpgrades[def.id] || 0;
    if (level <= 0) continue;
    const bonus = 1 + def.perLevel * level;
    switch (def.id) {
      case 'sq_damage': out.damage = bonus; break;
      case 'sq_vitality': out.maxHP = bonus; break;
      case 'sq_swift': out.speed = bonus; break;
      case 'sq_attack': out.attackSpeed = bonus; break;
      case 'sq_range': out.attackRange = bonus; break;
      case 'sq_nutrition': out.xpGain = bonus; break;
    }
  }
  return out;
}
