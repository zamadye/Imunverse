/**
 * rank-system.js — Fase 19: PANGKAT PENJAGA (tujuan pemain).
 *
 * Referensi desain (riset internet, 2026-09):
 *  - MLBB rank ladder (esportsinsider): tier + divisi memberi "something to work
 *    towards"; rank pemula TANPA penalti (Warrior: no star loss) — ramah pemain baru.
 *  - Duolingo/SDT (Moller dkk., selfdeterminationtheory.org): demosi & penalti
 *    menimbulkan stres pada pemain kasual/anak; progress bar + badge = kompetensi.
 *  - Udonis (leaderboard design): recognition + visible progress = motivasi inti.
 *
 * Konsekuensi desain untuk anak-anak:
 *  - TIDAK ADA demosi. GP hanya bertambah (effort tetap dihargai, kalah pun dapat).
 *  - Musim (dari data): saat ganti musim, GP di-set ulang ke LANTAI tier saat ini
 *    (soft reset ala MLBB — pangkat tidak turun).
 *  - GP tidak bisa dibeli (fair — selaras premium cap 30% Fase 18).
 *
 * Semua angka hidup di data/ranks.json — tanpa angka keras di sini.
 */

import { getRanks } from '../core/data-store.js';
import { STATE } from '../core/state-manager.js';
import { emit } from '../core/ui-bridge.js';
import { t } from './i18n.js';

/** Pemetaan rank → state aplikasi (modal di atas dashboard). */
export const RANK_APP_STATE = 'dashboard';

/** Index tier untuk GP tertentu (tier terakhir dengan min <= gp). */
export function tierIndexFor(gp) {
  const tiers = getRanks().tiers;
  let idx = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (gp >= tiers[i].min) idx = i;
  }
  return idx;
}

/** Info lengkap pangkat untuk gp: tier, berikutnya, progres 0..1, sisa GP. */
export function rankInfoFor(gp) {
  const tiers = getRanks().tiers;
  const idx = tierIndexFor(gp);
  const tier = tiers[idx];
  const next = idx + 1 < tiers.length ? tiers[idx + 1] : null;
  const span = next ? next.min - tier.min : 1;
  const into = next ? gp - tier.min : 1;
  return {
    idx,
    tier,
    next,
    pct: next ? Math.max(0, Math.min(1, into / span)) : 1,
    need: next ? Math.max(0, next.min - gp) : 0,
  };
}

/** Nomor musim berjalan (dihitung dari data/ranks.json → season.start). */
export function currentSeason() {
  const cfg = getRanks().season;
  const start = new Date(`${cfg.start}T00:00:00`);
  const days = Math.floor((Date.now() - start.getTime()) / 86400000);
  return {
    number: cfg.number + Math.max(0, Math.floor(days / cfg.daysPerSeason)),
    dayOfSeason: cfg.daysPerSeason - (((days % cfg.daysPerSeason) + cfg.daysPerSeason) % cfg.daysPerSeason),
    endsInDays: cfg.daysPerSeason - (((days % cfg.daysPerSeason) + cfg.daysPerSeason) % cfg.daysPerSeason),
  };
}

/**
 * Pastikan meta.rank ada & ikut musim berjalan. Saat musim berganti:
 * soft reset ala MLBB — GP kembali ke lantai tier saat ini (pangkat tidak turun).
 * @returns {{reset:boolean, fromSeason?:number, toSeason?:number}}
 */
export function ensureRankState(meta) {
  const season = currentSeason().number;
  if (!meta.rank || typeof meta.rank.gp !== 'number') {
    meta.rank = { season, gp: 0, best: 0 };
    return { reset: false, fresh: true };
  }
  if (meta.rank.season !== season) {
    const from = meta.rank.season;
    const floor = getRanks().tiers[tierIndexFor(meta.rank.gp)].min;
    meta.rank = { season, gp: floor, best: Math.max(meta.rank.best || 0, meta.rank.gp) };
    emit('toast', { message: `${t('Musim Baru!')} ${t('GP kembali ke lantai pangkat — pangkat tidak turun')}`, kind: 'gold' });
    return { reset: true, fromSeason: from, toSeason: season };
  }
  return { reset: false };
}

/** GP hasil satu run (menang maupun kalah — usaha tetap dihargai). */
export function computeRunGP({ wave, kills, bossKills, victory, chapterId }) {
  const pts = getRanks().points;
  let gp = wave * pts.perWave + kills * pts.perKill + bossKills * pts.perBoss;
  if (victory) gp += pts.victoryBonus;
  if (victory && chapterId) gp += pts.chapterBonus;
  return Math.round(gp);
}

/**
 * Terapkan GP hasil run ke meta (meta.rank), deteksi kenaikan pangkat.
 * @returns {{gained, gpBefore, gpAfter, fromTier, toTier, tierUp, need, nextName}}
 */
export function applyRunGP(meta, runSummary) {
  ensureRankState(meta);
  if (!meta.rank || typeof meta.rank.gp !== 'number') meta.rank = { season: currentSeason().number, gp: 0, best: 0 };
  const gained = computeRunGP(runSummary);
  const gpBefore = meta.rank.gp;
  const fromIdx = tierIndexFor(gpBefore);
  const gpAfter = gpBefore + gained;
  meta.rank.gp = gpAfter;
  meta.rank.best = Math.max(meta.rank.best || 0, gpAfter);
  const toIdx = tierIndexFor(gpAfter);
  const tiers = getRanks().tiers;
  const info = rankInfoFor(gpAfter);
  return {
    gained,
    gpBefore,
    gpAfter,
    fromTier: tiers[fromIdx],
    toTier: tiers[toIdx],
    tierUp: toIdx > fromIdx,
    need: info.need,
    nextName: info.next ? info.next.name : null,
  };
}

/** State pangkat pemain aktif (untuk chip dashboard & modal). */
export function playerRank() {
  const meta = STATE.meta;
  ensureRankState(meta);
  const gp = (meta.rank && meta.rank.gp) || 0;
  return { ...rankInfoFor(gp), gp, season: currentSeason() };
}
