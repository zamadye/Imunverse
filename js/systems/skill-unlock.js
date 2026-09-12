/**
 * skill-unlock.js — Progression skill tempur yang EKSPLISIT.
 *
 * SOURCE OF TRUTH: level player di-run (game.run.level). TIDAK ada variabel
 * level kedua — helper ini murni menghitung state dari level tersebut.
 *
 *   Player Lv 1–2 : hanya basic ATTACK (semua slot skill LOCKED)
 *   Player Lv 3   : slot #1 terbuka
 *   Player Lv 5   : slot #2 terbuka
 *   Player Lv 10  : slot #3 (ULTIMATE) terbuka
 *   Player Lv 15  : sistem UPGRADE skill terbuka
 *
 * Gameplay handler WAJIB memakai helper ini (bukan hanya CSS disabled):
 *   if (!isSkillUnlocked(run.level, slot)) return false;
 *
 * Note: slot.unlocked === true diperlakukan sebagai override manual
 * (dipakai harness E2E untuk menguji efek skill tanpa menunggu level).
 */

/** Level pembuka tiap slot skill (slot 0/1/2 = S1/S2/ULT). */
export const SKILL_UNLOCK_LEVELS = [3, 5, 10];

/** Level player yang membuka sistem upgrade skill. */
export const SKILL_UPGRADE_LEVEL = 15;

/** Rank maksimum upgrade skill dalam satu run. */
export const SKILL_MAX_RANK = 3;

/** Biaya upgrade skill per rank berikutnya (antibodi run, run.currencyEarned). */
export const SKILL_UPGRADE_COST_BASE = 45;
export const SKILL_UPGRADE_COST_GROWTH = 40;

export const SKILL_UNLOCK_STATE = Object.freeze({
  LOCKED: 'LOCKED',                     // skill belum bisa dipakai sama sekali
  UNLOCKED: 'UNLOCKED',                 // skill bisa dipakai (state dasar)
  UPGRADE_LOCKED: 'UPGRADE_LOCKED',     // skill bisa dipakai, upgrade belum terbuka (< Lv 15)
  UPGRADE_AVAILABLE: 'UPGRADE_AVAILABLE', // skill bisa dipakai DAN bisa di-upgrade (>= Lv 15)
});

/** Level yang dibutuhkan untuk membuka slot skill `index`. */
export function getSkillUnlockLevel(skillIndex) {
  return SKILL_UNLOCK_LEVELS[skillIndex] ?? Infinity;
}

/** Skill bisa DI-PAKAI? (murni level, tanpa melihat cooldown) */
export function isSkillUnlocked(playerLevel, skillIndex, slot = null) {
  if (slot && slot.unlocked === true) return true; // override manual (E2E/dev)
  return playerLevel >= getSkillUnlockLevel(skillIndex);
}

/** Sistem upgrade skill sudah terbuka? */
export function isSkillUpgradeUnlocked(playerLevel) {
  return playerLevel >= SKILL_UPGRADE_LEVEL;
}

/** Upgrade untuk slot ini boleh dieksekusi? (level + slot + rank) */
export function canUpgradeSkill(playerLevel, skillIndex, slot = null) {
  if (!isSkillUpgradeUnlocked(playerLevel)) return false;
  if (!isSkillUnlocked(playerLevel, skillIndex, slot)) return false;
  const rank = slot && slot.rank ? slot.rank : 1;
  return rank < SKILL_MAX_RANK;
}

/**
 * State lengkap satu slot skill pada level tertentu.
 * @returns {'LOCKED'|'UNLOCKED'|'UPGRADE_LOCKED'|'UPGRADE_AVAILABLE'}
 */
export function getSkillUnlockState(playerLevel, skillIndex, slot = null) {
  if (!isSkillUnlocked(playerLevel, skillIndex, slot)) return SKILL_UNLOCK_STATE.LOCKED;
  if (!isSkillUpgradeUnlocked(playerLevel)) return SKILL_UNLOCK_STATE.UPGRADE_LOCKED;
  if (canUpgradeSkill(playerLevel, skillIndex, slot)) return SKILL_UNLOCK_STATE.UPGRADE_AVAILABLE;
  return SKILL_UNLOCK_STATE.UNLOCKED;
}

/** Biaya antibodi untuk menaikkan slot ke rank berikutnya. */
export function skillUpgradeCost(slot = null) {
  const rank = slot && slot.rank ? slot.rank : 1;
  return SKILL_UPGRADE_COST_BASE + SKILL_UPGRADE_COST_GROWTH * (rank - 1);
}

/** Pengali damage skill dari rank (rank 1 = 1.0, tiap rank +28%). */
export function skillRankDamageMult(slot = null) {
  const rank = slot && slot.rank ? slot.rank : 1;
  return 1 + 0.28 * (rank - 1);
}

/** Pengali cooldown skill dari rank (tiap rank -7%, membulat lantai 0.8×). */
export function skillRankCooldownMult(slot = null) {
  const rank = slot && slot.rank ? slot.rank : 1;
  return Math.max(0.8, Math.pow(0.93, rank - 1));
}
