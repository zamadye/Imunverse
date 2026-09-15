#!/usr/bin/env node
/**
 * validate-retention.mjs — Validator pacing retensi PHAGOS (roadmap Sprint 3.20).
 *
 * Menurunkan ulang SEMUA klaim pacing bible §6/§8 dari angka data aktual.
 * GAGAL (exit 1) bila laju menyimpang — perbaiki data, jangan longgarkan tes.
 *
 * Model run acuan (diukur: measure-run.mjs, macrophage w10):
 *   400 kill (campuran kontak/Pulse/engulf), 15 wave, 3 boss, menang.
 *
 * Jalankan: npm run validate  (atau: node tools/validate-retention.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];
const ok = (k, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} pacing:${k}${extra ? ' ' + extra : ''}`);
  if (!cond) fails.push(k);
};
const load = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const sum = (a) => a.reduce((x, y) => x + y, 0);
const approx = (v, want, tol) => Math.abs(v - want) <= tol;

// Model run acuan
const KILLS = 400, WAVES = 15, BOSSES = 3, ENGULFS = 18, VICTORY = true;

const up = load('data/upgrades.json');
const bk = up.bkByKillType;

// ---------- §6.2 earn: model campuran ≈ 916 BK/run ----------
// Campuran TERUKUR (measure-run macrophage, 501 kill): pulse 39% / engulf 37% /
// kontak 2% / lain 22%. Bible mengasumsikan engulf jarang (18/run @8 BK); di game
// nyata engulf = killer utama (mutasi), sehingga engulf 8 BK akan mencetak
// ~1.500 BK/run — D14: engulf ditambatkan ke 2 BK (deviasi bible yang divalidasi).
const earnModel = KILLS * (0.1 * bk.contact + 0.35 * bk.pulse + 0.3 * bk.engulf + 0.25 * bk.other)
  + WAVES * up.bkPerWave + BOSSES * bk.boss;
ok('earn-916', approx(earnModel, 916, 60), `model=${Math.round(earnModel)}`);

// ---------- §8.1 Mitosis: total XP muat dalam musim 30 hari ----------
// Naik 1→30 butuh xpNeed(L) untuk L=1..29 (lihat battlepass-system addBpXP).
const bp = load('data/battlepass.json');
const bpTotal = sum(Array.from({ length: 29 }, (_, i) => bp.xpNeed.base + bp.xpNeed.step * (i + 1)));
const dailyPace = bp.dailyRunCap + 3 * 50 + (3 * 250) / 7; // run + 3 harian + 3 mingguan
ok('mitosis-muat-musim', bpTotal / dailyPace <= 30, `total=${bpTotal} hari=${(bpTotal / dailyPace).toFixed(1)}`);
ok('mitosis-net', bp.premiumCostImun === 800, `net=${500 - bp.premiumCostImun}/musim`);

// ---------- §8.2 Pangkat: ≈337 GP/run menang ----------
// gpPerRun = 15×4 + 400×0,2 + 18×4 + 3×25 + 50 = 337 (bible).
const rk = load('data/ranks.json').points;
const gpRun = WAVES * rk.perWave + KILLS * rk.perKill + ENGULFS * rk.perEngulf + BOSSES * rk.perBoss + rk.victoryBonus;
ok('pangkat-337', gpRun === 337, `gp=${gpRun} run-ke-12000=${(12000 / gpRun).toFixed(1)}`);

// ---------- §8.3 Hero lv20 = 22.404 ≈ 24,5 run ----------
//
const hu = up.heroUpgrade;
const heroTot = sum(Array.from({ length: hu.maxLevel }, (_, lv) => Math.round(hu.baseCost * Math.pow(hu.costGrowth, lv))));
ok('hero-22404', heroTot === 22404, `total=${heroTot} run=${(heroTot / 916).toFixed(1)}`);

// ---------- §6.3/§8.6 Homeostasis: 701 BK + ±116 G per jalur ----------
const g0 = up.globalUpgrades[0];
const homeoBK = sum(Array.from({ length: 10 }, (_, i) => Math.round(g0.baseCost * Math.pow(g0.costGrowth, i))));
const homeoG = sum(Array.from({ length: 15 }, (_, i) => Math.round(g0.genomBase * Math.pow(g0.genomGrowth, i))));
ok('homeo-701', homeoBK === 701, `bk=${homeoBK}`);
ok('homeo-genom', approx(homeoG, 116, 6), `g=${homeoG} (bible 116, toleransi kurva)`);

// ---------- §8.4 Diferensiasi: 167 fragmen ≈ 33 run ----------
const evo = load('data/evolutions.json');
const fragTot = sum(evo.stages.map((s) => Object.values(s.cost || {}).reduce((a, b) => a + b, 0)));
ok('diferensiasi-33run', fragTot === 167, `fragmen=${fragTot} run=${(fragTot / 5).toFixed(1)}`);

// ---------- §6.3 Mastery: 6.100 XP ≈ 8,5 run ----------
const my = load('data/mastery.json');
const mRun = KILLS * my.xpFormula.perKill + WAVES * my.xpFormula.perWave + my.xpFormula.victoryBonus;
ok('mastery-8.5run', approx(my.levels[9] / mRun, 8.5, 0.3), `xp/run=${mRun} run=${(my.levels[9] / mRun).toFixed(1)}`);

// ---------- §8.5 Kampanye: 18 clear ----------
const camp = load('data/campaign.json');
ok('kampanye-18', camp.chapters.length * camp.tiers.length === 18
  && camp.tiers[camp.tiers.length - 1].quotaMult === 2.2);

console.log(fails.length === 0 ? '\nPACING VALID ✔' : `\n${fails.length} CEK PACING GAGAL ✘: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
