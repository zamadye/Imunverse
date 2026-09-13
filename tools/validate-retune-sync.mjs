#!/usr/bin/env node
/**
 * tools/validate-retune-sync.mjs — Fase 1.5 (retune v2.0, 13 Sep 2026)
 *
 * MENAMBAL celah yang dilaporkan di ROADMAP.md §2 G11:
 *   tools/validate-retention.mjs HANYA membaca data/retention-config.json dan
 *   menghitung kurva dari sana (kolom "sebelum" malah hardcode di baris 95-104).
 *   Akibatnya ia tetap melaporkan 0 error walaupun angka retune belum pernah
 *   dipindahkan ke file data yang benar-benar dipakai game.
 *
 * Validator ini menutup celah itu: ia MEMBANDINGKAN file data repo dengan target
 * di retention-config.json / economy-anchors.json / premium.json. Bila seseorang
 * mengembalikan angka lama (atau mengubah salah satu sisi tanpa sisi lainnya),
 * skrip ini keluar dengan kode 1.
 *
 * Bukan pengganti validate-retention.mjs — pelengkap. Ketiganya dijalankan oleh
 * `npm run validate`.
 *
 *   node tools/validate-retune-sync.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const R = read('data/retention-config.json');
const A = read('data/economy-anchors.json');
const P = read('data/premium.json');
const bp = read('data/battlepass.json');
const up = read('data/upgrades.json');
const rk = read('data/ranks.json');
const ev = read('data/evolutions.json');
const cp = read('data/campaign.json');

const errors = [];
const rows = [];

/** Satu perbandingan: nilai repo vs nilai target. */
function eq(label, actual, expected, note = '') {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  rows.push({ label, actual, expected, ok, note });
  if (!ok) errors.push(`${label}: repo = ${JSON.stringify(actual)}, target = ${JSON.stringify(expected)}${note ? ` (${note})` : ''}`);
  return ok;
}

/* ---------- 1. Battle Pass ---------- */

eq('battlepass.xpNeed.base', bp.xpNeed.base, R.battlePass.xpNeedFormula.base);
eq('battlepass.xpNeed.step', bp.xpNeed.step, R.battlePass.xpNeedFormula.perLevel, 'field repo bernama "step", config bernama "perLevel"');
eq('battlepass.maxLevel', bp.maxLevel, R.battlePass.maxLevel);
eq('battlepass.premiumCostImun', bp.premiumCostImun, P.battlePass.premiumCostImun);

const premiumImun = (bp.premium || []).filter((r) => r.type === 'imun').reduce((a, r) => a + (r.n || 0), 0);
eq('total Imun jalur premium', premiumImun, P.battlePass.imunReturnedOnFullTrack);
eq('net Imun per musim', premiumImun - bp.premiumCostImun, P.battlePass.netImun);

// Total XP 30 level harus sama dengan yang dihitung validator retensi.
const totalXp = Array.from({ length: bp.maxLevel }, (_, i) => bp.xpNeed.base + bp.xpNeed.step * (i + 1))
  .reduce((a, b) => a + b, 0);
eq('total XP ke level maks', totalXp, R.battlePass.totalXpToMax);

// Catatan lama yang mengklaim pass membayar dirinya sendiri WAJIB sudah dihapus.
if (String(bp.doc || '').includes('525')) {
  errors.push('battlepass.doc masih menyebut "525 Imun" — brief §Fase 1.4 mewajibkan catatan itu dihapus.');
}

// Field iklan lama harus sudah hilang (economy-anchors.adEconomy.removedFields).
for (const field of A.adEconomy.removedFields || []) {
  const key = field.split('.').pop();
  if (bp.offers && Object.prototype.hasOwnProperty.call(bp.offers, key)) {
    errors.push(`battlepass.offers.${key} masih ada — economy-anchors.json:adEconomy.removedFields mewajibkannya dihapus.`);
  }
}

/* ---------- 2. Level hero & kuota iklan ---------- */

eq('upgrades.heroUpgrade.baseCost', up.heroUpgrade.baseCost, R.heroUpgrade.baseCost);
eq('upgrades.heroUpgrade.costGrowth', up.heroUpgrade.costGrowth, R.heroUpgrade.growth);
eq('upgrades.heroUpgrade.maxLevel', up.heroUpgrade.maxLevel, R.heroUpgrade.maxLevel);
eq('upgrades.economy.adDailyLimit', up.economy.adDailyLimit, A.adEconomy.dailyLimit, 'kuota iklan harus satu angka dengan anchors');

/* ---------- 3. Pangkat ---------- */

const gpMap = [
  ['points.perWave', rk.points.perWave, R.rank.gpPerWave],
  ['points.perKill', rk.points.perKill, R.rank.gpPerKill],
  ['points.perBoss', rk.points.perBoss, R.rank.gpPerBoss],
  ['points.victoryBonus', rk.points.victoryBonus, R.rank.gpVictory],
  ['points.chapterBonus', rk.points.chapterBonus, R.rank.gpChapterClear],
];
for (const [label, actual, expected] of gpMap) eq(`ranks.${label}`, actual, expected);

const lastTierMin = rk.tiers[rk.tiers.length - 1].min;
if (lastTierMin > R.rank.maxGp) {
  errors.push(`ranks.json: tier terakhir butuh ${lastTierMin} GP tetapi retention-config.rank.maxGp = ${R.rank.maxGp}.`);
}
rows.push({ label: 'tier terakhir ≤ maxGp', actual: lastTierMin, expected: `≤ ${R.rank.maxGp}`, ok: lastTierMin <= R.rank.maxGp });

/* ---------- 4. Evolusi ---------- */

eq('evolutions.dropChanceNormal', ev.dropChanceNormal, R.evolution.dropChanceNormal);
eq('evolutions.dropChanceElite', ev.dropChanceElite, R.evolution.dropChanceElite);
eq('evolutions.bossGuaranteedParts', ev.bossGuaranteedParts, R.evolution.bossGuaranteedParts);

// ROADMAP §2 G5: retention-config memakai id bagian "equity_membran"/"inti_memori",
// repo memakai "equity_membrane"/"equity_memory_core". Alih-alih mengubah salah
// satu file (retention-config adalah drop-in yang tidak boleh diedit, dan rename
// id repo akan memutasi meta.evoParts di save pemain), perbedaan nama dipetakan
// eksplisit di sini. Yang dibandingkan adalah TOTAL fragmen per bagian.
const PART_ALIAS = { equity_membran: 'equity_membrane', inti_memori: 'equity_memory_core' };
const totals = {};
for (const stage of ev.stages) {
  for (const [partId, n] of Object.entries(stage.cost || {})) totals[partId] = (totals[partId] || 0) + n;
}
for (const [cfgId, need] of Object.entries(R.evolution.stageCost)) {
  const repoId = PART_ALIAS[cfgId] || cfgId;
  eq(`total fragmen ${cfgId}`, totals[repoId] || 0, need, PART_ALIAS[cfgId] ? `id repo: ${repoId} (alias G5)` : '');
}

/* ---------- 5. Kampanye ---------- */

eq('campaign.quotaMultGlobal', cp.quotaMultGlobal, R.campaign.quotaMultGlobal);
eq('campaign.difficulties', cp.difficulties, R.campaign.difficulties, 'definisi data saja — implementasi di Fase 4.1');

/* ---------- 6. Faucet iklan di kode (cek teks sumber, sadar-komentar) ---------- */

/**
 * Buang komentar sebelum memindai, dengan menghormati string. Tanpa ini,
 * komentar penjelasan yang menyebut "offers.adAntibodi" (riwayat perubahan)
 * ikut terdeteksi sebagai pemakaian nyata — positif palsu, persis masalah yang
 * pernah terjadi di scripts/check-imports.mjs.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { if (i + 1 < src.length) out += src[i + 1]; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      out += ' ';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const shopSrc = stripComments(readFileSync(resolve(root, 'js/ui/screens/shop-screen.js'), 'utf8'));
const shopChecks = [
  ['shop-screen tidak lagi membaca offers.adAntibodi', !shopSrc.includes('adAntibodi')],
  ['shop-screen memakai getAdEconomy() (angka dari anchors)', shopSrc.includes('getAdEconomy')],
  ['reward iklan diberikan sebagai Imun', /addImun\(\s*meta,\s*adEcon\.imunPerAd\s*\)/.test(shopSrc)],
];
for (const [label, ok] of shopChecks) {
  rows.push({ label, actual: ok ? 'ok' : 'TIDAK', expected: 'ok', ok });
  if (!ok) errors.push(`${label} — faucet iklan harus ${A.adEconomy.imunPerAd} Imun × ${A.adEconomy.dailyLimit}/hari dari economy-anchors.json, bukan Antibodi hardcode.`);
}

/* ---------- laporan ---------- */

const pad = (s, w) => String(s).padEnd(w);
console.log('\n=== SINKRONISASI RETUNE: data repo vs retention-config / economy-anchors ===');
console.log(`${pad('pemeriksaan', 42)} ${pad('repo', 16)} ${pad('target', 16)} status`);
console.log('-'.repeat(86));
for (const r of rows) {
  const fmt = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
  const exp = Array.isArray(r.expected) ? JSON.stringify(r.expected).slice(0, 14) + '…' : fmt(r.expected);
  console.log(
    pad(r.label, 42) +
    pad(fmt(r.actual), 16).slice(0, 16) +
    pad(exp, 16).slice(0, 16) +
    (r.ok ? 'OK' : 'MELESET')
  );
}

console.log('\n--- Hasil ---');
if (errors.length) {
  for (const e of errors) console.log('  ERROR  ' + e);
  console.log(`\n${errors.length} error. Angka retune tidak sinkron dengan konfigurasi.\n`);
  process.exit(1);
}
console.log(`  Lolos. ${rows.length} pemeriksaan sinkron, 0 error.\n`);
