#!/usr/bin/env node
/**
 * validate-catalog.mjs — Validator greenfield katalog PHAGOS (roadmap Sprint 3.20).
 *
 * Memastikan angka data/ == bible PHAGOS. GAGAL (exit 1) bila ada angka
 * menyimpang — perbaiki data, jangan longgarkan tes (roadmap item 21).
 *
 * Jalankan: npm run validate  (atau: node tools/validate-catalog.mjs)
 * cwd = root repo.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];
const ok = (k, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} catalog:${k}${extra ? ' ' + extra : ''}`);
  if (!cond) fails.push(k);
};
const load = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// ---------- upgrades.json ----------
const up = load('data/upgrades.json');
ok('earn-table', up.bkByKillType?.contact === 1 && up.bkByKillType?.pulse === 1.5
  && up.bkByKillType?.engulf === 2 && up.bkByKillType?.boss === 60
  && up.bkByKillType?.other === 1 && up.bkPerWave === 10,
  JSON.stringify(up.bkByKillType));
const shopWant = {
  serum_regenerasi: [200, 'bk'], enzim_litik: [250, 'bk'], sitokin_burst: [200, 'bk'],
  lapisan_mukus: [300, 'bk'], katalis_mitosis: [350, 'bk'], opsonin: [350, 'bk'],
  atp_surge: [200, 'genom'], toksin_balik: [200, 'bk'],
};
const shopGot = Object.fromEntries((up.shopItems || []).map((i) => [i.id, [i.cost, i.currency || 'bk']]));
ok('shop-catalog', JSON.stringify(shopGot) === JSON.stringify(shopWant), `n=${Object.keys(shopGot).length}`);
const hu = up.heroUpgrade || {};
ok('hero-cost', hu.baseCost === 120 && hu.costGrowth === 1.2 && hu.maxLevel === 20
  && hu.dmgPerLevel === 0.06 && hu.hpPerLevel === 0.08 && hu.membranePerLevel === 0.015);
const gs = up.globalUpgrades || [];
ok('homeo-tracks', gs.length === 6 && gs.every((g) => g.maxLevel === 25
  && g.baseCost === 27 && g.costGrowth === 1.2 && g.genomBase === 3 && g.genomGrowth === 1.12),
  gs.map((g) => g.id).join(','));

// ---------- heroes.json ----------
const heroes = load('data/heroes.json').heroes || [];
const types = heroes.map((h) => (h.unlock || {}).type);
ok('hero-census', heroes.length === 11 && types.filter((t) => t === 'default').length === 1
  && types.filter((t) => t === 'imu').length === 3
  && types.filter((t) => t === 'stat' || t === 'imu_stat').length === 7);
ok('hero-genom-wall', heroes.reduce((a, h) => a + ((h.unlock && h.unlock.imuCost) || 0), 0) === 2460);
ok('hero-membrane', heroes.every((h) => h.membrane && typeof h.membrane === 'object'));

// ---------- evolutions.json ----------
const evo = load('data/evolutions.json');
ok('diferensiasi', evo.parts.length === 1 && evo.parts[0].id === 'fragmen_diferensiasi'
  && evo.dropChanceNormal === 0.004 && evo.dropChanceElite === 0.04 && evo.bossGuaranteedParts === 1
  && evo.stages.map((s) => Object.values(s.cost || {}).reduce((a, b) => a + b, 0)).join(',') === '0,50,50,50,17');

// ---------- battlepass.json ----------
const bp = load('data/battlepass.json');
ok('mitosis-config', bp.premiumCostImun === 800 && bp.xpNeed?.base === 120 && bp.xpNeed?.step === 30
  && bp.maxLevel === 30 && bp.runXpCap === 150 && bp.dailyRunCap === 450
  && (bp.premium || []).length === 30 && (bp.free || []).length === 30);
ok('mitosis-return', (bp.premium || []).filter((x) => x.type === 'imun').reduce((a, x) => a + (x.n || 0), 0) === 500);

// ---------- ranks.json ----------
const rk = load('data/ranks.json');
const pts = rk.points || {};
ok('pangkat', pts.perWave === 4 && pts.perKill === 0.2 && pts.perEngulf === 4
  && pts.perBoss === 25 && pts.victoryBonus === 50 && pts.chapterBonus === undefined
  && Math.max(...(rk.tiers || []).map((t) => t.min)) === 12000);

// ---------- mastery.json ----------
const my = load('data/mastery.json');
ok('mastery', my.xpFormula?.perKill === 1.4 && my.xpFormula?.perWave === 8
  && my.xpFormula?.victoryBonus === 40 && my.levels?.[9] === 6100);

// ---------- campaign.json ----------
const camp = load('data/campaign.json');
ok('kampanye', (camp.tiers || []).map((t) => t.quotaMult).join(',') === '1,1.6,2.2'
  && (camp.chapters || []).length === 6
  && (camp.chapters || []).every((c) => (c.killQuota || 0) > 0));

// ---------- missions.json ----------
const mis = load('data/missions.json');
ok('misi-bpxp', (mis.daily || []).length === 3 && (mis.daily || []).every((m) => m.bpXp === 50)
  && (mis.weekly || []).length >= 2 && (mis.weekly || []).every((m) => m.bpXp === 250));

// ---------- D7: faucet Genom run mati ----------
const ret = load('data/retention.json');
const nut = load('data/nutrients.json');
ok('d7-faucet-mati', (ret.imuReward || {}).perBoss === 0 && (ret.imuReward || {}).victoryBonus === 0
  && (ret.imuReward || {}).perWave === 0 && (ret.imuReward || {}).perKill === 0
  && !(nut.bossGuaranteedDrops || []).some((d) => /koin|genom/i.test(d)));

console.log(fails.length === 0 ? '\nKATALOG VALID ✔' : `\n${fails.length} CEK KATALOG GAGAL ✘: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
