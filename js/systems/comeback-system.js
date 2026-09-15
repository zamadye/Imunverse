/**
 * comeback-system.js — Sprint 6.31 (bible §10.1): streak harian +
 * hadiah kembali "Antibodi Selamat Datang".
 *
 * - Streak: 1 hari pengampunan per siklus 7 hari; reward milestone di
 *   hari 2/3/5/7/14/30; lewat hari 30 reward BERPUTAR (tier 7→14→30).
 * - Absen ≥3 hari: hadiah kembali berjenjang + pemulihan tubuh gratis.
 * - Hari memakai TANGGAL LOKAL (konsisten dgn klaim harian sebelumnya).
 */

import { getData } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';
import { addCurrency } from './economy-system.js';
import { addImun } from './imun-economy.js';
import { getBodyState } from './body-system.js';

export const STREAK_MILESTONES = {
  2: { bk: 150, genom: 0 },
  3: { bk: 180, genom: 0 },
  5: { bk: 250, genom: 0 },
  7: { bk: 400, genom: 0 },
  14: { bk: 800, genom: 10 },
  30: { bk: 2000, genom: 25 },
};
/** Lewat hari 30: reward berputar mulai tier hari 7. */
export const STREAK_ROTATE_TIERS = [7, 14, 30];

/** Hadiah kembali berjenjang berdasar lama absen (hari). */
export const COMEBACK_TIERS = [
  { minAbsent: 30, bk: 3000, genom: 25 },
  { minAbsent: 14, bk: 1500, genom: 10 },
  { minAbsent: 7, bk: 800, genom: 0 },
  { minAbsent: 3, bk: 300, genom: 0 },
];

export function dayStr(d = new Date()) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function toDay(str) {
  const [y, m, dd] = String(str).split('-').map(Number);
  return new Date(y, m - 1, dd);
}

export function daysBetween(fromStr, toStr) {
  if (!fromStr || !toStr) return 0;
  return Math.round((toDay(toStr) - toDay(fromStr)) / 86400000);
}

export function ensureComeback(meta) {
  meta.loginStreak = meta.loginStreak || { lastDay: null, streak: 0, claimedDay: null, forgaveUsed: false };
  meta.comeback = meta.comeback || { pending: null };
  return meta;
}

function baseDaily() {
  try {
    return getData().upgrades.economy.dailyReward || 120;
  } catch { return 120; }
}

/**
 * Catat login hari ini. Dipanggil tiap dashboard show().
 * @returns {{newDay, streak, forgiven, wasReset, absentDays, comeback}}
 */
export function recordLoginDay(meta, today = dayStr()) {
  ensureComeback(meta);
  const st = meta.loginStreak;
  if (st.lastDay === today) {
    return { newDay: false, streak: st.streak, forgiven: false, wasReset: false, absentDays: 0, comeback: !!meta.comeback.pending };
  }
  const gap = st.lastDay ? daysBetween(st.lastDay, today) : 1;
  let forgiven = false;
  let wasReset = false;
  let absentDays = 0;
  if (gap <= 1) {
    st.streak += 1;
  } else if (gap === 2 && !st.forgaveUsed) {
    // 1 hari pengampunan: streak lanjut seolah tak absen
    st.streak += 1;
    st.forgaveUsed = true;
    forgiven = true;
  } else {
    absentDays = gap - 1;
    st.streak = 1;
    st.forgaveUsed = false;
    wasReset = st.lastDay !== null;
  }
  // Siklus baru tiap kelipatan 7 → pengampunan segar
  if (st.streak > 0 && st.streak % 7 === 0) st.forgaveUsed = false;
  st.lastDay = today;
  // Absen ≥3 hari → hadiah kembali menanti
  let comeback = !!meta.comeback.pending;
  if (absentDays >= 3) {
    meta.comeback.pending = { absentDays, tier: comebackTier(absentDays) };
    comeback = true;
  }
  writeSave(meta);
  return { newDay: true, streak: st.streak, forgiven, wasReset, absentDays, comeback };
}

/** Reward streak hari ke-N (milestone / putaran / basis harian). */
export function streakRewardFor(streak) {
  if (STREAK_MILESTONES[streak]) {
    return { ...STREAK_MILESTONES[streak], milestone: streak, rotated: false };
  }
  if (streak > 30) {
    const tier = STREAK_ROTATE_TIERS[(streak - 31) % STREAK_ROTATE_TIERS.length];
    return { ...STREAK_MILESTONES[tier], milestone: tier, rotated: true };
  }
  return { bk: baseDaily(), genom: 0, milestone: null, rotated: false };
}

export function canClaimStreak(meta, today = dayStr()) {
  ensureComeback(meta);
  return meta.loginStreak.claimedDay !== today && meta.loginStreak.streak > 0;
}

/** Klaim bonus harian berbasis streak (sekali sehari). */
export function claimStreakReward(meta, today = dayStr()) {
  ensureComeback(meta);
  if (!canClaimStreak(meta, today)) return { ok: false };
  const st = meta.loginStreak;
  const r = streakRewardFor(st.streak);
  st.claimedDay = today;
  addCurrency(meta, r.bk);
  if (r.genom > 0) addImun(meta, r.genom);
  writeSave(meta);
  return { ok: true, bk: r.bk, genom: r.genom, streak: st.streak, milestone: r.milestone, rotated: r.rotated };
}

export function comebackTier(absentDays) {
  for (const t of COMEBACK_TIERS) {
    if (absentDays >= t.minAbsent) return t;
  }
  return COMEBACK_TIERS[COMEBACK_TIERS.length - 1];
}

/**
 * Klaim "Antibodi Selamat Datang": hadiah tier + pemulihan tubuh GRATIS
 * (semua sistem Imunitas pulih penuh & ditandai dirawat).
 */
export function claimComeback(meta, today = dayStr()) {
  ensureComeback(meta);
  const pending = meta.comeback.pending;
  if (!pending) return null;
  meta.comeback.pending = null;
  addCurrency(meta, pending.tier.bk);
  if (pending.tier.genom > 0) addImun(meta, pending.tier.genom);
  const st = getBodyState(meta);
  for (const sys of Object.values(st.systems)) {
    sys.health = 100;
    sys.lastCaredDay = today;
  }
  st.lastVisitedDay = today;
  meta.bodyState = st;
  writeSave(meta);
  return { bk: pending.tier.bk, genom: pending.tier.genom, absentDays: pending.absentDays };
}
