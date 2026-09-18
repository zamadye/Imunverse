/**
 * upgrade-system.js — Upgrade in-run (level-up): LIMA stat boost biologis
 * (bible §4.1 safety net) dari pool data/upgrades.json — jaring pengaman
 * level 2-4 + fallback saat pool mutasi habis. Pool shooter lama & evolusi
 * senjata DICABUT (bible §14). Upgrade Squad permanen (dibeli currency)
 * DICABUT bersama sistem hero-upgrade/pasukan — satu-satunya jalur
 * kekuatan sekarang mutasi in-run berbayar Antibodi.
 */

import { getData } from '../core/data-store.js';

// ---------------------------------------------------------------
// Level-up (in-run)
// ---------------------------------------------------------------

/**
 * Roll pilihan level-up (safety net): weighted sampling tanpa penggantian
 * (bobot luRules.rarityWeights) + pity (run.luPity ≥ pityRolls → ≥1 rare+).
 * Pool = 5 stat boost biologis (bible §4.1). Evolusi senjata DICABUT —
 * PHAGOS tidak punya senjata (bible §14).
 * @returns {object[]} pilihan (entri pool)
 */
export function rollLevelUpChoices(run) {
  const data = getData().upgrades;
  const pool = data.levelUpPool;
  const count = data.levelUpChoices || 3;
  const rules = data.luRules || { rarityWeights: { common: 1 }, pityRolls: 99 };
  const pattern = run.heroDef ? run.heroDef.attackPattern : null;

  const available = pool.filter((u) =>
    (run.upgrades[u.id] || 0) < u.maxStacks &&
    (!u.patterns || !pattern || u.patterns.includes(pattern)));

  // weighted sampling tanpa penggantian
  const picked = [];
  const bag = [...available];
  while (picked.length < count && bag.length > 0) {
    let total = 0;
    for (const u of bag) total += rules.rarityWeights[u.rarity || 'common'] || 1;
    let roll = Math.random() * total;
    let idx = bag.length - 1;
    for (let i = 0; i < bag.length; i++) {
      roll -= rules.rarityWeights[bag[i].rarity || 'common'] || 1;
      if (roll <= 0) { idx = i; break; }
    }
    picked.push(bag.splice(idx, 1)[0]);
  }

  // PITY: dua roll tanpa rare+ → jamin ≥1 rare+ sekarang
  const isRarePlus = (u) => u.rarity === 'rare' || u.rarity === 'epic';
  if (!picked.some(isRarePlus) && (run.luPity || 0) >= rules.pityRolls) {
    const candidates = bag.filter(isRarePlus);
    if (candidates.length > 0) {
      picked[picked.length - 1] = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  run.luPity = picked.some(isRarePlus) ? 0 : (run.luPity || 0) + 1;
  return picked;
}

/**
 * Terapkan pilihan level-up ke state run (5 stat boost bible §4.1).
 * @returns {{healAmount:number}} info efek untuk diolah game.js
 */
export function applyLevelUp(run, upgradeId) {
  const def = getData().upgrades.levelUpPool.find((u) => u.id === upgradeId);
  if (!def) throw new Error('Upgrade tidak ditemukan: ' + upgradeId);
  run.upgrades[upgradeId] = (run.upgrades[upgradeId] || 0) + 1;
  // Sitoskeleton: pulihkan 15% HP saat diambil (angka ikut desc pool).
  if (def.id === 'hp_boost') {
    const maxHP = (run.player && run.player.maxHP) || 100;
    return { healAmount: Math.round(maxHP * 0.15) };
  }
  return { healAmount: 0 };
}

/**
 * V2 Phase 4: stack EFEKTIF sebuah upgrade — sinergi role ×(1+synergyBonus).
 * Membuat badge "✦ Sinergi" di kartu level-up akhirnya berdampak nyata.
 */
export function effectiveStacks(run, upgradeId, synergyIds) {
  const stacks = run.upgrades[upgradeId] || 0;
  if (!stacks || !synergyIds || !synergyIds.includes(upgradeId)) return stacks;
  const bonus = (getData().upgrades.luRules || {}).synergyBonus || 0;
  return stacks * (1 + bonus);
}

// ---------------------------------------------------------------
// Multiplier stat (dulu "Upgrade Squad" dibeli permanen dengan currency —
// DICABUT bersama sistem hero-upgrade/pasukan lainnya; alur kekuatan
// sekarang tunggal lewat mutasi in-run berbayar Antibodi). Fungsi ini
// dipertahankan sebagai stub netral (semua 1x) supaya computeStats di
// game.js & hero-detail-screen.js tidak perlu di-cabangkan ulang.
// ---------------------------------------------------------------

export function squadMultipliers() {
  return { damage: 1, maxHP: 1, speed: 1, attackSpeed: 1, attackRange: 1, xpGain: 1, weapon: 1, jurusCd: 1, jurusRadius: 1, armor: 1 };
}
