/**
 * antibody-economy.js — P3: EKONOMI ANTIBODI (PHAGOS_IAP_V2.txt §3–§31).
 *
 * Satu mata uang, satu fungsi:
 *
 *   SUMBER  : kill · elite · boss · event biologis · telan · bonus zona
 *   PENGGUNA: MUTASI (evolution) — bukan squad, bukan toko, bukan skin.
 *
 * Tiga fase ekonomi (§8) harus muncul NATURAL di dalam satu run:
 *   ABUNDANCE (mutasi 1–2) → TENSION (3–5) → SCARCITY (6–8)
 *
 * Dua aturan yang tidak bisa ditawar:
 *   1. Kekurangan antibodi TIDAK mematikan permainan (§10) — pemain tetap
 *      bertempur; kartu mutasi hanya terkunci, tidak pernah memblokir.
 *   2. Semua angka ada di data/economy.json (§29) — nol angka ekonomi di js/.
 */

import { getData } from '../core/data-store.js';

/** Daftar event ekonomi yang wajib tercatat (IAP §28). */
export const ECONOMY_EVENTS = [
  'run_started', 'enemy_killed', 'antibody_earned', 'mutation_offered',
  'mutation_purchased', 'mutation_failed_insufficient_antibody', 'reserve_used',
  'rewarded_ad_offered', 'rewarded_ad_completed', 'iap_mock_granted',
  'run_completed', 'run_failed', 'hero_selected', 'hero_unlocked',
];

const LOG = []; // ring buffer prototipe (bukan analytics berat)
const LOG_CAP = 400;

/** Catat satu event ekonomi (ring buffer + console saat dev). */
export function recordEconomyEvent(name, payload = {}) {
  const rec = { t: Date.now(), name, ...payload };
  LOG.push(rec);
  if (LOG.length > LOG_CAP) LOG.splice(0, LOG.length - LOG_CAP);
  try {
    const ev = getData() && getData().economy && getData().economy.telemetry;
    if (!ev || ev.enabled === false) return rec;
    if (Array.isArray(ev.events) && !ev.events.includes(name)) return rec;
  } catch { /* abaikan */ }
  return rec;
}

/** Riwayat event ekonomi (dipakai penguji & debug). */
export function economyLog() { return LOG.slice(); }

export function economyCfg() {
  return (getData() && getData().economy) || null;
}

/** Pengali penghasilan hero untuk satu jenis sumber (IAP §11). */
export function earningProfile(heroId) {
  const e = economyCfg();
  const p = e && e.antibody && e.antibody.heroEarning && e.antibody.heroEarning[heroId];
  const d = (e && e.antibody && e.antibody.heroEarning && e.antibody.heroEarning._default) || null;
  const base = p || d || { normal: 1, elite: 1, boss: 1, event: 1 };
  return {
    normal: num(base.normal, 1), elite: num(base.elite, 1),
    boss: num(base.boss, 1), event: num(base.event, 1),
  };
}

function num(v, dflt) { return typeof v === 'number' && isFinite(v) ? v : dflt; }

/**
 * Antibodi untuk satu kill.
 * @param {'normal'|'elite'|'boss'|'event'} kind
 * @param {string} heroId
 * @param {object} [mult] pengali tambahan (iklan 2x, mutator, buff)
 */
export function antibodyForKill(kind, heroId, mult = 1) {
  const e = economyCfg();
  const src = (e && e.antibody && e.antibody.sources) || {};
  const base = kind === 'elite' ? num(src.eliteKill, 12)
    : kind === 'boss' ? num(src.bossKill, 60)
      : kind === 'event' ? num(src.specialEvent, 25)
        : num(src.enemyKill, 1);
  const p = earningProfile(heroId);
  const pm = kind === 'elite' ? p.elite : kind === 'boss' ? p.boss : kind === 'event' ? p.event : p.normal;
  return Math.max(0, Math.round(base * pm * num(mult, 1)));
}

/** Antibodi dari satu telan (engulf) — jalur alternatif, bukan pengganti kill. */
export function antibodyForEngulf(heroId, mult = 1) {
  const e = economyCfg();
  const src = (e && e.antibody && e.antibody.sources) || {};
  const p = earningProfile(heroId);
  return Math.max(0, Math.round(num(src.engulf, 1) * ((p.normal + p.elite) / 2) * num(mult, 1)));
}

/**
 * Biaya mutasi ke-`index` (1 = mutasi pertama).
 * Kurva: baseCost + jumlah langkah geometris (§7) — langkah tumbuh lalu
 * dibatasi `maxStep` supaya tidak eksponensial tanpa batas.
 */
export function mutationCost(index) {
  const m = (economyCfg() && economyCfg().mutation) || {};
  const n = Math.max(1, Math.floor(num(index, 1)));
  const base = num(m.baseCost, 100);
  const g = m.growth || {};
  const firstStep = num(g.firstStep, 50);
  const growth = num(g.stepGrowth, 1.35);
  const maxStep = num(g.maxStep, 400);
  let cost = base;
  for (let i = 2; i <= n; i++) {
    const step = Math.min(maxStep, firstStep * Math.pow(growth, i - 2));
    cost += step;
  }
  return Math.round(Math.min(num(m.maxCost, Infinity), Math.max(num(m.minCost, 0), cost)));
}

/** Total biaya untuk mencapai `count` mutasi. */
export function totalMutationCost(count) {
  let total = 0;
  for (let i = 1; i <= Math.max(0, Math.floor(num(count, 0))); i++) total += mutationCost(i);
  return total;
}

/** Fase ekonomi untuk jumlah mutasi yang sudah dimiliki (§8). */
export function economyPhase(mutationCount) {
  const ph = (economyCfg() && economyCfg().phases) || {};
  const n = Math.max(0, Math.floor(num(mutationCount, 0)));
  for (const key of ['abundance', 'tension', 'scarcity']) {
    const rng = ph[key] && ph[key].mutations;
    if (Array.isArray(rng) && n >= rng[0] && n <= rng[1]) return key;
  }
  return n <= 0 ? 'abundance' : 'scarcity';
}

/** Antibodi yang dimiliki run ini. */
export function runAntibody(run) {
  return (run && typeof run.antibody === 'number') ? run.antibody : 0;
}

/**
 * Tambah antibodi ke run + umpan balik wajib (§5): partikel, label melayang,
 * dan penanda dompet untuk HUD. Bukan sekadar mengubah angka.
 */
export function earnAntibody(run, amount, opts = {}) {
  const n = Math.max(0, Math.round(num(amount, 0)));
  if (!run || n <= 0) return 0;
  run.antibody = runAntibody(run) + n;
  try {
    const fx = run.effects;
    if (fx && opts.x !== undefined && opts.y !== undefined) {
      if (typeof fx.spawnLabel === 'function') fx.spawnLabel(opts.x, opts.y - 22, `+${n} ANTIBODI`, opts.color || '#8df7d2');
      if (typeof fx.spawnBurst === 'function') fx.spawnBurst(opts.x, opts.y, opts.color || '#8df7d2', opts.particles || 5, 150, 3);
    }
  } catch { /* efek tak boleh merusak ekonomi */ }
  run.antibodyPulse = true; // HUD memakainya untuk animasi dompet
  recordEconomyEvent('antibody_earned', { amount: n, source: opts.source || 'kill', total: run.antibody });
  return n;
}

/** Cukup untuk membeli mutasi ke-`index`? */
export function canAffordMutation(run, index) {
  return runAntibody(run) >= mutationCost(index);
}

/** Bayar mutasi. @returns {boolean} */
export function spendAntibody(run, amount) {
  const cost = Math.max(0, Math.round(num(amount, 0)));
  if (runAntibody(run) < cost) {
    recordEconomyEvent('mutation_failed_insufficient_antibody', { need: cost, have: runAntibody(run) });
    return false;
  }
  run.antibody = runAntibody(run) - cost;
  recordEconomyEvent('mutation_purchased', { cost, remaining: run.antibody });
  return true;
}

/** Apakah kekurangan antibodi boleh menghentikan permainan? (§10: TIDAK) */
export function blocksGameplay() {
  const r = (economyCfg() && economyCfg().insufficientRule) || {};
  return r.blockGameplay === true;
}

/**
 * Perkiraan penghasilan satu run untuk seorang hero — dipakai HUD tujuan &
 * penguji (bukan gameplay). Modelnya ada di economy.json → runModel.
 */
export function projectedRunIncome(heroId) {
  const e = economyCfg();
  const model = (e && e.runModel) || {};
  const waves = num(model.wavesPerRun, 10);
  const base = num(model.killsPerWaveBase, 13);
  const growth = num(model.killsPerWaveGrowth, 1.2);
  let kills = 0;
  for (let w = 1; w <= waves; w++) kills += Math.round(base * Math.pow(growth, (w - 1) * 0.5));
  const mix = (e && e.antibody && e.antibody.killMixReference) || { normal: 0.85, elite: 0.1, boss: 0.04, event: 0.01 };
  let total = 0;
  for (const kind of ['normal', 'elite', 'boss', 'event']) {
    total += kills * num(mix[kind], 0) * antibodyForKill(kind, heroId);
  }
  return Math.round(total);
}
