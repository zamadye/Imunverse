/**
 * unit-skill-unlock.mjs — uji MURNI (tanpa browser) sistem progression skill:
 * - Matriks unlock per level: slot ke-1/2/3 terbuka di Lv 3/5/10.
 * - Override manual (slot { unlocked: true }) tetap dihormati.
 * - Jerat upgrade: sebelum SKILL_UPGRADE_LEVEL (15) tidak bisa; rank cap 3.
 * - Biaya linear 45/85/125; damage linear +28% (1 / 1.28 / 1.56);
 *   cooldown ×0.93 dengan lantai 0.8.
 * - Enum state kapsul konsisten.
 *
 * Akses yang diuji = jalur yang sama yang dipakai handler klik, tombol HUD,
 * dan keyboard shortcut (js/core/game.js → useAbilityBySlot/upgradeAbilityBySlot).
 *
 * Jalankan: node scripts/unit-skill-unlock.mjs   → exit 0 bila semua PASS.
 */
import {
  SKILL_UNLOCK_LEVELS, SKILL_UPGRADE_LEVEL, SKILL_UNLOCK_STATE,
  isSkillUnlocked, canUpgradeSkill, skillUpgradeCost,
  skillRankDamageMult, skillRankCooldownMult, getSkillUnlockState,
} from '../js/systems/skill-unlock.js';

let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' ' + x : ''}`); };
const slot = { unlocked: false, rank: 1 };

ok('matriks-level',
  [[1, 0], [2, 0], [3, 0], [4, 1], [5, 2], [10, 2], [99, 2], [15, 2]]
    .every(([lv, i]) => isSkillUnlocked(lv, i, slot) === (lv >= SKILL_UNLOCK_LEVELS[i])));
ok('slot-luar-rentang-terkunci', !isSkillUnlocked(99, 3, slot) && !isSkillUnlocked(99, -1, slot));
ok('slot-null-default-rank-aman', isSkillUnlocked(10, 2, null) && skillUpgradeCost(null) === 45);

ok('manual-override-honored', isSkillUnlocked(1, 0, { unlocked: true, rank: 1 }));

ok('upgrade-lock-14', !canUpgradeSkill(14, 0, slot));
ok('upgrade-open-15-99', canUpgradeSkill(15, 0, slot) && canUpgradeSkill(99, 2, slot));
ok('rank-cap-3', !canUpgradeSkill(99, 0, { rank: 3 }));
ok('rank-2-can', canUpgradeSkill(15, 0, { rank: 2 }));

ok('biaya-linear', skillUpgradeCost({ rank: 1 }) === 45 && skillUpgradeCost({ rank: 2 }) === 85 && skillUpgradeCost({ rank: 3 }) === 125);
ok('dmg-linear-28persen', skillRankDamageMult({ rank: 1 }) === 1
  && Math.abs(skillRankDamageMult({ rank: 2 }) - 1.28) < 1e-12
  && Math.abs(skillRankDamageMult({ rank: 3 }) - 1.56) < 1e-12);
ok('cd-min-0.8', skillRankCooldownMult({ rank: 1 }) === 1
  && Math.abs(skillRankCooldownMult({ rank: 2 }) - 0.93) < 1e-12
  && skillRankCooldownMult({ rank: 3 }) > 0.85
  && skillRankCooldownMult({ rank: 99 }) === 0.8);

ok('enum-locked', getSkillUnlockState(1, 0, slot) === SKILL_UNLOCK_STATE.LOCKED);
ok('enum-upgrade-locked', getSkillUnlockState(5, 1, slot) === SKILL_UNLOCK_STATE.UPGRADE_LOCKED);
ok('enum-upgrade-available', getSkillUnlockState(15, 0, slot) === SKILL_UNLOCK_STATE.UPGRADE_AVAILABLE);
ok('enum-unlocked-stabil', getSkillUnlockState(99, 0, { rank: 3 }) === SKILL_UNLOCK_STATE.UNLOCKED);

ok('konstanta', JSON.stringify(SKILL_UNLOCK_LEVELS) === '[3,5,10]' && SKILL_UPGRADE_LEVEL === 15);

console.log(fails ? `FAIL total ${fails}` : 'ALL PASS');
process.exit(fails ? 1 : 0);
