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
  && g.baseCost === 27 && g.costGrowth === 1.2 && g.genomBase === 3 && g.genomGrowth === 1.12)
  && gs.map((g) => g.stat).join(',') === 'damage,maxHP,moveSpeed,pulseCdr,membraneRadius,engulfHeal',
  gs.map((g) => g.id).join(','));

// ---------- heroes.json ----------
const heroes = load('data/heroes.json').heroes || [];
const types = heroes.map((h) => (h.unlock || {}).type);
// V2 §33 + IAP §22: hero TIDAK dibuka dengan mata uang premium — semua dari progress bermain.
ok('hero-census', heroes.length === 11 && types.filter((t) => t === 'default').length === 1
  && types.filter((t) => t === 'stat').length === 10);
ok('hero-tanpa-harga-premium', heroes.every((h) => !h.unlock?.imuCost && !h.shopCost));
ok('hero-membrane', heroes.every((h) => h.membrane && typeof h.membrane === 'object'));

// ---------- evolutions.json ----------
// V2 P2: format lama (fragmen diferensiasi) DIGANTI pohon evolusi per hero.
// Validasi baru: 4 tahap BASE→MUT1→MUT2→APEX, ambang naik, dan 11 hero
// punya ≥2 mutasi khas sesuai archetype-nya.
const evo = load('data/evolutions.json');
const muts = load('data/mutations.json').mutations || [];
ok('pohon-evolusi', evo.schemaVersion === 3
  && evo.stages.map((s) => s.id).join('>') === 'base>mut1>mut2>apex'
  && evo.stages.every((s, i) => i === 0 || s.minMutations > evo.stages[i - 1].minMutations)
  && Object.keys(evo.heroes || {}).length === 11);
ok('jalur-khas-per-hero', heroes.every((h) => {
  const arch = h.identity?.attackArchetype;
  const sig = (evo.heroes[h.id] || {}).signature || [];
  return sig.length >= 2 && sig.every((id) => {
    const atk = (muts.find((m) => m.id === id) || {}).attack || {};
    return !!(atk.payload && atk.payload[arch]) || !!(atk.archetypeFrom && atk.archetypeFrom[arch]);
  });
}));
ok('sinematik-mutasi-terdata', Array.isArray(evo.cinematic?.phases)
  && evo.cinematic.phases.map((p) => p.id).join('>') === 'pause>charge>break>reveal>resume');

// ---------- zones.json (P4: dunia kontinu) ----------
const zon = load('data/zones.json');
const rute = zon.route || [];
ok('rute-kontinu', rute.length === 12 && rute[0].id === 'lung'
  && rute.every((z, i) => z.order === i + 1 && z.arenaId && z.landmark && z.mechanic)
  && ['bloodstream', 'heart', 'tumor'].every((id) => rute.some((z) => z.id === id)));
ok('transisi-zona', rute.every((z) => typeof z.transitionSec === 'number'
  && z.transitionSec >= 20 && z.transitionSec <= 60 && z.wavesPerZone >= 1));
ok('mekanik-lingkungan', ['oxygenMucus', 'narrowPath', 'gasExchange', 'narrowMovement',
  'bloodCurrent', 'heartbeatPulse'].every((m) => rute.some((z) => z.mechanic === m))
  && rute.every((z) => z.params && Object.keys(z.params).length > 0));

// ---------- P6: game feel (tangga dampak + keramaian) ----------
const gf = load('data/gamefeel.json');
const tangga = (gf.tiers || {});
const urut = ['normal', 'heavy', 'elite', 'ultimate', 'bossEvent'];
ok('tangga-dampak-naik', urut.every((k) => tangga[k])
  && ['shake', 'killSec', 'flashSec', 'squash'].every((f) => urut.every((k, i) => i === 0 || (tangga[k][f] ?? 0) > (tangga[urut[i - 1]][f] ?? 0)))
  && tangga.normal.hitSec === 0 && tangga.bossEvent.staggerSec === 0);
ok('keramaian-terkendali', (gf.crowd || {}).numbersMax > 0 && (gf.crowd || {}).numbersPerSec > 0
  && (gf.crowd || {}).labelsMax > 0 && (gf.crowd || {}).busyEnemyCount > (gf.crowd || {}).calmEnemyCount
  && (gf.crowd || {}).particleScale < 1 && (gf.crowd || {}).shakeScale < 1
  && Object.keys((gf.crowd || {}).sfxThrottleMs || {}).length >= 3);
ok('kamera-di-cap', (gf.camera || {}).traumaCap > 0 && (gf.camera || {}).traumaCap <= 1);

// ---------- P5: reserve · rewarded ads · IAP mock ----------
const eko = load('data/economy.json');
const rv = eko.reserve || {};
ok('reserve-terbatas', rv.enabled === true && rv.separateFromAntibody === true
  && rv.assistancePctOfMutationCost > 0 && rv.assistancePctOfMutationCost < 1
  && rv.maxUsesPerRun >= 1 && rv.capacity > 0);
ok('iklan-reward-tertunable', (eko.rewardedAds || {}).enabled === true
  && (eko.rewardedAds || {}).antibodyReward > 0 && (eko.rewardedAds || {}).dailyLimit > 0
  && (eko.rewardedAds || {}).cooldownSec >= 0);
ok('iap-mock-tanpa-payment', (eko.iap || {}).provider === 'mock'
  && (eko.iap || {}).realPayment === false
  && Array.isArray((eko.iap || {}).packs) && (eko.iap || {}).packs.length > 0
  && (eko.iap || {}).packs.every((pk) => pk.id && pk.grant > 0)
  && (eko.iap || {}).maxOffersPerRun > 0);

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
