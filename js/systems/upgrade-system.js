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
 * V2 Phase 4 — roll pilihan level-up dengan RARITY + PITY + anti dead-choice.
 * (menggantikan Fisher-Yates seragam V1; spek docs/v2/phase-04-build-evolution.md)
 *  - weighted sampling tanpa penggantian (bobot luRules.rarityWeights)
 *  - patterns per entri: hero melee tidak pernah ditawari upgrade proyektil
 *  - pity: run.luPity ≥ pityRolls → dijamin ≥1 rare+ pada roll ini
 *  - evolusi senjata: resep terpenuhi & belum diambil → kartu EVO di slot 0
 * @returns {object[]} pilihan (entri pool / kartu evo dengan flag isEvo)
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

  // EVOLUSI SENJATA: resep terpenuhi → kartu evo DIJAMIN terlihat (slot 0)
  const evo = availableEvolution(run);
  if (evo && picked.length > 0) {
    picked[0] = { ...evo, isEvo: true, rarity: 'epic', maxStacks: 1 };
  }
  return picked;
}

/** Resep evolusi pertama yang syaratnya terpenuhi & belum diambil run ini. */
export function availableEvolution(run) {
  const evos = getData().upgrades.evolutions || [];
  for (const evo of evos) {
    if (run.evoTaken && run.evoTaken[evo.id]) continue;
    const ok = Object.entries(evo.requires).every(([id, need]) => (run.upgrades[id] || 0) >= need);
    if (ok) return evo;
  }
  return null;
}

/**
 * Terapkan pilihan level-up ke state run (upgrade biasa ATAU kartu evolusi).
 * @returns {{healAmount:number, evolved?:object}} info efek untuk diolah game.js
 */
export function applyLevelUp(run, upgradeId) {
  // V2 Phase 4: kartu evolusi senjata
  const evo = (getData().upgrades.evolutions || []).find((e) => e.id === upgradeId);
  if (evo) {
    run.evoTaken = run.evoTaken || {};
    run.evoTaken[evo.id] = true;
    return { healAmount: 0, evolved: evo };
  }
  const def = getData().upgrades.levelUpPool.find((u) => u.id === upgradeId);
  if (!def) throw new Error('Upgrade tidak ditemukan: ' + upgradeId);
  run.upgrades[upgradeId] = (run.upgrades[upgradeId] || 0) + 1;
  return { healAmount: def.id === 'maxHP' ? def.amount : 0 };
}

/**
 * V2 Phase 4: gabungan boost seluruh evolusi yang diambil run ini.
 * @returns {{damageMult:number, cooldownMult:number, maxHPMult:number, projectileFlat:number}}
 */
export function evolutionBoosts(run) {
  const out = { damageMult: 1, cooldownMult: 1, maxHPMult: 1, projectileFlat: 0 };
  if (!run || !run.evoTaken) return out;
  for (const evo of getData().upgrades.evolutions || []) {
    if (!run.evoTaken[evo.id]) continue;
    const b = evo.boost;
    if (b.damageMult) out.damageMult *= b.damageMult;
    if (b.cooldownMult) out.cooldownMult *= b.cooldownMult;
    if (b.maxHPMult) out.maxHPMult *= b.maxHPMult;
    if (b.projectileFlat) out.projectileFlat += b.projectileFlat;
  }
  return out;
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
  const out = { damage: 1, maxHP: 1, speed: 1, attackSpeed: 1, attackRange: 1, xpGain: 1, weapon: 1, jurusCd: 1, jurusRadius: 1, armor: 1 };
  for (const def of getData().upgrades.squadUpgrades) {
    const level = meta.squadUpgrades[def.id] || 0;
    if (level <= 0) continue;
    const bonus = 1 + def.perLevel * level;
    switch (def.id) {
      case 'sq_damage': out.damage = bonus; break;
      case 'sq_vitality': out.maxHP = bonus; break;
      case 'sq_weapon': out.weapon = bonus; break;        // SENJATA
      case 'sq_jurus':                                    // JURUS
        out.jurusCd = Math.max(0.5, 1 - def.perLevel * level);
        out.jurusRadius = 1 + def.perLevel * 1.35 * level;
        break;
      case 'sq_armor':                                    // PERTAHANAN
        out.armor = Math.max(0.55, 1 - def.perLevel * level);
        break;
      case 'sq_swift': out.speed = bonus; break;
      case 'sq_attack': out.attackSpeed = bonus; break;
      case 'sq_range': out.attackRange = bonus; break;
      case 'sq_nutrition': out.xpGain = bonus; break;
    }
  }
  return out;
}
