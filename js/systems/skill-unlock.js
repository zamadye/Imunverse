/**
 * skill-unlock.js — PHAGOS D5 (owner): progresi skill PASIF yang EKSPLISIT.
 *
 * SOURCE OF TRUTH: level player di-run (game.run.level). TIDAK ada variabel
 * level kedua — helper ini murni menghitung state dari level tersebut.
 *
 *   Player Lv 1-2 : semua slot pasif TERKUNCI
 *   Player Lv 3   : slot #1 AKTIF (menyala otomatis sesuai trigger)
 *   Player Lv 5   : slot #2 AKTIF
 *   Player Lv 10  : slot #3 AKTIF (kuat)
 *   Player Lv 15  : SEMUA slot naik ke rank 2 OTOMATIS (tanpa biaya/tombol)
 *
 * Note: slot.unlocked === true diperlakukan sebagai override manual
 * (dipakai harness E2E untuk menguji efek skill tanpa menunggu level).
 */

/** Level pembuka tiap slot skill (slot 0/1/2 = S1/S2/ULT). */
export const SKILL_UNLOCK_LEVELS = [3, 5, 10];

/** Level player saat semua slot naik ke rank 2 OTOMATIS. */
export const SKILL_RANK2_LEVEL = 15;

/** Rank maksimum skill pasif dalam satu run (1 → 2 otomatis di Lv 15). */
export const SKILL_MAX_RANK = 2;

/** Level yang dibutuhkan untuk membuka slot skill `index`. */
export function getSkillUnlockLevel(skillIndex) {
  return SKILL_UNLOCK_LEVELS[skillIndex] ?? Infinity;
}

/** Skill bisa DI-PAKAI? (murni level, tanpa melihat cooldown) */
export function isSkillUnlocked(playerLevel, skillIndex, slot = null) {
  if (slot && slot.unlocked === true) return true; // override manual (E2E/dev)
  return playerLevel >= getSkillUnlockLevel(skillIndex);
}

/** Rank skill pada level tertentu (1, atau 2 mulai Lv 15). */
export function skillRankForLevel(playerLevel) {
  return playerLevel >= SKILL_RANK2_LEVEL ? 2 : 1;
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
