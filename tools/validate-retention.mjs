#!/usr/bin/env node
/**
 * tools/validate-retention.mjs
 *
 * Menguji apakah kurva progresi benar-benar mencapai target pacing, bukan
 * hanya terasa benar. Keluar dengan kode 1 bila ada target yang meleset di
 * luar toleransi — pasang di CI bersama validate-catalog.mjs.
 *
 *   node tools/validate-retention.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expectedRunsPerDrop, rollRareDrop } from '../js/systems/rare-drop-system.js';
import { runComebackPass } from '../js/systems/comeback-system.js';
import { buildSessionHook } from '../js/systems/session-hook.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const R = JSON.parse(readFileSync(resolve(root, 'data/retention-config.json'), 'utf8'));

const ref = R.referenceRun;
const pad = (s, w, right = false) => (right ? String(s).padStart(w) : String(s).padEnd(w));
const n1 = v => (Number.isFinite(v) ? v.toFixed(1) : '∞');
const errors = [];

/* ---------- laju run referensi ---------------------------------- */

const geo = (base, growth, levels) => {
  let sum = 0;
  for (let i = 0; i < levels; i++) sum += Math.round(base * Math.pow(growth, i));
  return sum;
};

// Elite terencana per wave: min(3, 1 + floor((w-3)/4)), mulai wave 3.
const elitesUpTo = maxWave => {
  let t = 0;
  for (let w = 3; w <= maxWave; w++) t += Math.min(3, 1 + Math.floor((w - 3) / 4));
  return t;
};
const elitesFrom = (minWave, maxWave) => elitesUpTo(maxWave) - elitesUpTo(minWave - 1);

const eliteAll = elitesUpTo(ref.wave);
const antPerRun =
  (ref.wave * 12 + ref.kills) +
  Math.floor(ref.wave * 8 + ref.kills * 0.5 + ref.bossKills * 50) +
  Math.round(ref.kills * 0.45 * 2);

/* ---------- pacing aktual vs target ------------------------------ */

const bpTotal = Array.from({ length: R.battlePass.maxLevel }, (_, i) =>
  R.battlePass.xpNeedFormula.base + R.battlePass.xpNeedFormula.perLevel * (i + 1)
).reduce((a, b) => a + b, 0);

const bpRunXp = Math.min(
  R.battlePass.runXp.perRunCap,
  ref.heroLevelInRun * R.battlePass.runXp.heroLevelMult +
  ref.wave * R.battlePass.runXp.waveMult +
  ref.kills * R.battlePass.runXp.killMult
);
const bpDaily =
  Math.min(R.battlePass.runXp.dailyRunXpCap, bpRunXp * ref.runsPerDayActive) +
  R.battlePass.missionXp.daily * 3 +
  (R.battlePass.missionXp.weekly * 2) / 7;
const bpDays = bpTotal / bpDaily;

const gpPerRun =
  ref.wave * R.rank.gpPerWave +
  ref.kills * R.rank.gpPerKill +
  ref.bossKills * R.rank.gpPerBoss;

const fragCost = Object.values(R.evolution.stageCost).reduce((a, b) => a + b, 0);
const fragPerRun =
  ref.kills * R.evolution.dropChanceNormal +
  eliteAll * R.evolution.dropChanceElite +
  ref.bossKills * R.evolution.bossGuaranteedParts;

const heroTotal = geo(R.heroUpgrade.baseCost, R.heroUpgrade.growth, R.heroUpgrade.maxLevel);
const heroTotalOld = geo(150, 1.35, 20);

const campaignClears = 6 * R.campaign.difficulties.length;

const actual = {
  kampanye: campaignClears * R.campaign.expectedRunsPerClear,
  battlePass: bpDays * ref.runsPerDayActive,
  pangkat: R.rank.maxGp / gpPerRun,
  evolusi: fragCost / fragPerRun,
  masteryPerHero: 6100 / (ref.kills * 2 + ref.wave * 10),
  levelHeroPerHero: heroTotal / antPerRun,
  squadPenuh: 139604 / antPerRun
};

// Kurva LAMA, untuk perbandingan di dokumen.
const before = {
  kampanye: 6,
  battlePass: Array.from({ length: 30 }, (_, i) => 40 + 10 * (i + 1)).reduce((a, b) => a + b, 0) /
             (ref.heroLevelInRun * 40 + ref.wave * 15 + ref.kills),
  pangkat: 12000 / (ref.wave * 18 + ref.kills * 2 + ref.bossKills * 120),
  evolusi: 17 / (ref.kills * 0.06 + eliteAll * 0.30 + ref.bossKills * 2),
  masteryPerHero: 6100 / (ref.kills * 2 + ref.wave * 10),
  levelHeroPerHero: heroTotalOld / antPerRun,
  squadPenuh: 139604 / antPerRun
};

console.log('\n=== PACING PROGRESI ===');
console.log(`Run referensi: wave ${ref.wave} · ${ref.kills} kill · ${ref.bossKills} boss · hero lv ${ref.heroLevelInRun}`);
console.log(`Turunan: ${eliteAll} elite/run · ${antPerRun} antibodi/run · ${bpRunXp.toFixed(0)} BP XP/run (cap ${R.battlePass.runXp.perRunCap}) · ${gpPerRun.toFixed(0)} GP/run · ${fragPerRun.toFixed(2)} fragmen/run\n`);

const head = [pad('sistem', 24), pad('sebelum', 12, true), pad('sesudah', 12, true), pad('target', 10, true), pad('hari @3/hr', 12, true), pad('status', 8)].join(' ');
console.log(head);
console.log('-'.repeat(head.length));

const tol = R.pacingTargets.toleransiPct / 100;
for (const [key, target] of Object.entries(R.pacingTargets.targets)) {
  const a = actual[key];
  const b = before[key];
  const off = Math.abs(a - target) / target;
  const ok = off <= tol;
  if (!ok) errors.push(`${key}: aktual ${n1(a)} run vs target ${target} run (meleset ${(off * 100).toFixed(0)}%, toleransi ${R.pacingTargets.toleransiPct}%).`);
  console.log([
    pad(key, 24),
    pad(n1(b) + ' run', 12, true),
    pad(n1(a) + ' run', 12, true),
    pad(target + ' run', 10, true),
    pad(n1(a / ref.runsPerDayActive), 12, true),
    pad(ok ? 'OK' : 'MELESET', 8)
  ].join(' '));
}

console.log(`\nLevel 20 seluruh 12 hero: ${n1(before.levelHeroPerHero * 12)} run  ->  ${n1(actual.levelHeroPerHero * 12)} run`);

/* ---------- drop langka: analitik + Monte Carlo ------------------- */

const cfgDrop = R.rareDrop;
const profile = {
  eliteKills: elitesFrom(cfgDrop.minWave, ref.wave),
  bossKills: Math.floor(ref.wave / 5) - Math.floor((cfgDrop.minWave - 1) / 5)
};
const an = expectedRunsPerDrop(profile, cfgDrop);

const cosmetics = {
  skins: {
    skin_mako_daun: { id: 'skin_mako_daun', f2pDroppable: true },
    skin_eos_sakura: { id: 'skin_eos_sakura', f2pDroppable: true },
    skin_helia_murni: { id: 'skin_helia_murni', f2pDroppable: true },
    skin_tbolt_krom: { id: 'skin_tbolt_krom', f2pDroppable: false }
  },
  accs: {
    acc_aura_bintang: { id: 'acc_aura_bintang', f2pDroppable: true },
    acc_mahkota_beta: { id: 'acc_mahkota_beta', f2pDroppable: true }
  }
};

// PRNG deterministik agar simulasi dapat direproduksi persis.
let seed = 0x2f6e2b1;
const rng = () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5;  seed >>>= 0;
  return seed / 4294967296;
};

const TRIALS = 20000;
let totalRuns = 0, totalDrops = 0, pityDrops = 0;
for (let t = 0; t < TRIALS; t++) {
  const meta = { cosmetics: { owned: [] } };
  let runs = 0, got = false;
  while (!got && runs < 500) {
    runs++;
    const run = { wave: ref.wave, rareDropsThisRun: 0 };
    for (let i = 0; i < profile.eliteKills && !got; i++) {
      const d = rollRareDrop({ meta, run, enemy: { isElite: true, tier: 'hard' }, cosmetics, cfg: cfgDrop, rng });
      if (d) { got = true; if (d.viaPity) pityDrops++; }
    }
    for (let i = 0; i < profile.bossKills && !got; i++) {
      const d = rollRareDrop({ meta, run, enemy: { tier: 'boss' }, cosmetics, cfg: cfgDrop, rng });
      if (d) { got = true; if (d.viaPity) pityDrops++; }
    }
  }
  totalRuns += runs;
  if (got) totalDrops++;
}

console.log('\n=== DROP KOSMETIK LANGKA (konsep poin 3 owner) ===');
console.log(`Kill layak per run referensi: ${profile.eliteKills} elite + ${profile.bossKills} boss (wave >= ${cfgDrop.minWave})`);
console.log(`Analitik  : murni RNG ${n1(an.rngRuns)} run · pity ${n1(an.pityRuns)} run · efektif ${n1(an.effectiveRuns)} run`);
console.log(`Monte Carlo (${TRIALS.toLocaleString('id-ID')} percobaan): ${n1(totalRuns / TRIALS)} run per drop pertama · ${((pityDrops / totalDrops) * 100).toFixed(1)}% datang lewat pity`);
console.log(`Artinya: ~${n1(totalRuns / TRIALS / ref.runsPerDayActive)} hari bermain untuk satu kosmetik gratis.`);

if (totalRuns / TRIALS > 40 || totalRuns / TRIALS < 8) {
  errors.push(`Drop langka ${n1(totalRuns / TRIALS)} run/drop di luar jendela sehat 8-40 run.`);
}

/* ---------- comeback: 45 hari simulasi --------------------------- */

console.log('\n=== COMEBACK & STREAK ===');
{
  const DAY = 86400000;
  const meta = { currency: 0, imun: 0, stats: {}, bodyState: { systems: { sirkulasi: 100 }, toxin: 0, energy: 100 } };
  let t = Date.UTC(2026, 0, 1, 9, 0, 0);
  // 10 hari beruntun, bolos 1 hari (harus diampuni), 4 hari lagi, hilang 20 hari, kembali.
  const plan = [...Array(10).fill(1), 2, 1, 1, 1, 1, 20];
  let log = [];
  for (const gap of plan) {
    const res = runComebackPass({ meta, cfg: R.comeback, now: t });
    log.push({ gap, day: res.streak.day, broken: res.streak.broken, decay: `${res.rawDecayDays}->${res.decayDays}`, gift: res.returnGift ? 'YA' : '-' });
    t += gap * DAY;
  }
  const last = runComebackPass({ meta, cfg: R.comeback, now: t });
  log.push({ gap: 0, day: last.streak.day, broken: last.streak.broken, decay: `${last.rawDecayDays}->${last.decayDays}`, gift: last.returnGift ? 'YA' : '-' });

  console.log(pad('jeda(hari)', 12) + pad('streak', 8, true) + pad('putus', 8, true) + pad('decay', 12, true) + pad('hadiah', 9, true));
  for (const r of log) {
    console.log(pad(r.gap, 12) + pad(r.day, 8, true) + pad(r.broken ? 'YA' : '-', 8, true) + pad(r.decay, 12, true) + pad(r.gift, 9, true));
  }
  console.log(`Total diberikan selama simulasi: ${meta.currency.toLocaleString('id-ID')} Antibodi · ${meta.imun} Imun`);

  const forgiven = log.find(r => r.gap === 2);
  if (log[11] && log[11].broken) errors.push('Hari pengampunan tidak bekerja: bolos 1 hari mematahkan streak.');
  if (last.rawDecayDays <= R.comeback.maxOfflineDecayDays) errors.push('Simulasi tidak menguji batas peluruhan offline.');
  if (last.decayDays !== R.comeback.maxOfflineDecayDays) errors.push('Peluruhan offline tidak dibatasi.');
  if (!last.returnGift) errors.push('Absen 20 hari tidak memicu hadiah kembali.');
  void forgiven;
}

/* ---------- session hook ----------------------------------------- */

console.log('\n=== HOOK AKHIR SESI ===');
{
  const meta = {
    unlockedHeroes: ['tcd8', 'macrophage'],
    selectedHero: 'tcd8',
    selectedChapter: 'bab_demam',
    stats: { totalRuns: 14, totalKills: 2900, bossKills: 9, bestWave: 16, totalCurrencyEarned: 13000 },
    battlepass: { level: 4, xp: 160 },
    rank: { gp: 940 },
    heroMastery: { tcd8: { xp: 520, level: 3 } },
    evoParts: { equity_receptor: 41, equity_membran: 18, equity_effector: 9, inti_memori: 2 }
  };
  const data = {
    retention: R,
    heroes: {
      eos: { id: 'eos', name: 'Eos', unlock: { stats: { totalKills: 3000 } } },
      tcd4: { id: 'tcd4', name: 'Helia', unlock: { stats: { bestWave: 18 } } },
      mastcell: { id: 'mastcell', name: 'Mastia', unlock: { stats: { totalKills: 500 } } }
    },
    arenas: {
      lambung: { id: 'lambung', name: 'Lambung Asam', unlock: { totalKills: 3200 } },
      saraf: { id: 'saraf', name: 'Sumbu Saraf', unlock: { bossKills: 12 } }
    },
    ranks: { tiers: [{ name: 'Sel Baru', gp: 0 }, { name: 'Fagosit', gp: 600 }, { name: 'Penjaga Muda', gp: 1100 }] },
    mastery: { levels: [100, 300, 600, 1000, 1600, 2400, 3400, 4600, 6100] },
    campaign: { bab_demam: { id: 'bab_demam', name: 'Demam Pertama', quota: 30 } },
    battlepass: { maxLevel: 30 }
  };
  const hook = buildSessionHook({
    meta,
    lastRun: { kills: 205, wave: 14, victory: false, heroId: 'tcd8' },
    data,
    cfg: R.sessionHook,
    missionProgress: [{ id: 'd1', label: 'Bunuh 300 patogen', current: 205, target: 300, claimed: false }]
  });
  console.log('Headline :', hook.headline);
  for (const it of hook.items) {
    console.log(`  ${pad(it.kind, 18)} ${pad(it.label, 26)} ${pad(it.current + '/' + it.target, 14, true)} ${pad((it.pct * 100).toFixed(0) + '%', 6, true)} ${pad(it.etaRuns + ' run', 8, true)}`);
  }
  if (!hook.headline) errors.push('Hook akhir sesi tidak menghasilkan satu pun alasan untuk main lagi pada profil pemain uji.');
}

/* ---------- hasil ------------------------------------------------- */

console.log('\n--- Hasil ---');
if (errors.length) {
  for (const e of errors) console.log('  ERROR  ' + e);
  console.log(`\n${errors.length} error.\n`);
  process.exit(1);
}
console.log('  Lolos. 0 error.\n');
