/**
 * unit-skill-unlock.mjs — uji MURNI (tanpa browser) progresi skill PASIF (PHAGOS D5):
 * - Matriks unlock per level: slot ke-1/2/3 AKTIF di Lv 3/5/10.
 * - Override manual (slot { unlocked: true }) tetap dihormati (harness E2E).
 * - Rank OTOMATIS dari level: rank 1 (< 15), rank 2 (>= 15) — tanpa biaya/tombol.
 * - Damage +28% di rank 2; cooldown ×0.93 dengan lantai 0.8.
 *
 * Jalur yang diuji = jalur yang dipakai game.js (announceSkillProgress +
 * SkillSystem.trigger) — TIDAK ada lagi cast/upgrade manual.
 *
 * Jalankan: node scripts/unit-skill-unlock.mjs   → exit 0 bila semua PASS.
 */
import {
  SKILL_UNLOCK_LEVELS, SKILL_RANK2_LEVEL, SKILL_MAX_RANK,
  isSkillUnlocked, skillRankForLevel,
  skillRankDamageMult, skillRankCooldownMult,
} from '../js/systems/skill-unlock.js';

let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' ' + x : ''}`); };
const slot = { unlocked: false, rank: 1 };

ok('matriks-level',
  [[1, 0], [2, 0], [3, 0], [4, 1], [5, 2], [10, 2], [99, 2], [15, 2]]
    .every(([lv, i]) => isSkillUnlocked(lv, i, slot) === (lv >= SKILL_UNLOCK_LEVELS[i])));
ok('slot-luar-rentang-terkunci', !isSkillUnlocked(99, 3, slot) && !isSkillUnlocked(99, -1, slot));
ok('slot-null-aman', isSkillUnlocked(10, 2, null) === true);

ok('manual-override-honored', isSkillUnlocked(1, 0, { unlocked: true, rank: 1 }));

ok('rank-otomatis', skillRankForLevel(1) === 1 && skillRankForLevel(14) === 1
  && skillRankForLevel(15) === 2 && skillRankForLevel(99) === 2);
ok('rank-cap-2', SKILL_MAX_RANK === 2);

ok('dmg-plus-28persen-rank2', skillRankDamageMult({ rank: 1 }) === 1
  && Math.abs(skillRankDamageMult({ rank: 2 }) - 1.28) < 1e-12);
ok('cd-min-0.8', skillRankCooldownMult({ rank: 1 }) === 1
  && Math.abs(skillRankCooldownMult({ rank: 2 }) - 0.93) < 1e-12
  && skillRankCooldownMult({ rank: 99 }) === 0.8);

ok('konstanta', JSON.stringify(SKILL_UNLOCK_LEVELS) === '[3,5,10]' && SKILL_RANK2_LEVEL === 15);

console.log(fails ? `FAIL total ${fails}` : 'ALL PASS');
process.exit(fails ? 1 : 0);
