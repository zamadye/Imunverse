/**
 * referral-system.js — ADDENDUM P2 (§3.4): referral DUA ARAH tanpa server.
 *
 * Masalah MVP: localStorage tak bisa memberi hadiah ke perangkat pengundang.
 * Solusi: outbox klaim. Setiap pendaftaran & milestone dicatat di
 * `phagos.referral.outbox`; pengundang menekan KLAIM (di Profil, perangkat
 * mana pun yang memegang akunnya / sinkronisasi server nanti) untuk menarik
 * hadiahnya. Alur yang dirujuk: bonus instan saat pakai kode (sudah ada di
 * imun-economy) + bonus milestone saat pertama kali mencapai wave 5.
 */

import { getData } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';
import { ensureReferral, applyReferralCode } from './imun-economy.js';
import { addCurrency } from './economy-system.js';
import { shareBaseUrl } from './challenge-system.js';

const OUTBOX_KEY = 'phagos.referral.outbox';
export const REFERRAL_MILESTONE_WAVE = 5;

function offers() {
  try {
    return getData().battlepass.offers;
  } catch {
    return { referralAntibodi: 250 };
  }
}

export function entryReward() {
  return offers().referralAntibodi || 250;
}

export function milestoneReward() {
  return offers().referralAntibodi || 250;
}

/** Kode referral milik akun ini. */
export function myCode(meta) {
  return ensureReferral(meta).code;
}

/** Link undangan: ?ref=<uid>&play=1 (pendaftar langsung main). */
export function myReferralLink(meta) {
  const uid = (meta.account && meta.account.uid) || meta.guestUid || 'tamu';
  return `${shareBaseUrl()}?ref=${encodeURIComponent(uid)}&play=1`;
}

/** Kunci identitas meta ini (untuk mencocokkan outbox saat klaim). */
function myKeys(meta) {
  const keys = [];
  try {
    if (meta.referral && meta.referral.code) keys.push(meta.referral.code);
  } catch { /* abaikan */ }
  if (meta.account && meta.account.uid) keys.push(meta.account.uid);
  if (meta.guestUid) keys.push(meta.guestUid);
  return keys;
}

function readOutbox() {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveOutbox(arr) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(arr.slice(-200)));
  } catch { /* abaikan */ }
}

function record(forKey, kind, byUid) {
  if (!forKey) return;
  const box = readOutbox();
  box.push({ for: forKey, kind, by: byUid || 'anon', date: new Date().toISOString(), claimed: false });
  saveOutbox(box);
}

/** Daftarkan ?ref=uid dari link (sekali, bukan diri sendiri). */
export function handleRefParam(meta, refUid) {
  if (!meta || !refUid || meta.referredBy) return false;
  const mine = (meta.account && meta.account.uid) || meta.guestUid;
  if (refUid === mine) return false;
  meta.referredBy = refUid;
  record(refUid, 'hit', mine);
  try { writeSave(meta); } catch { /* abaikan */ }
  return true;
}

/** Pakai kode GENOM-XXXX + catat hadiah pengundang. */
export function applyCodeAndRecord(meta, code) {
  const res = applyReferralCode(meta, code);
  if (!res.ok) return res;
  const used = String(code || '').trim().toUpperCase();
  if (!meta.referredBy) {
    meta.referredBy = used;
    try { writeSave(meta); } catch { /* abaikan */ }
  }
  const mine = (meta.account && meta.account.uid) || meta.guestUid;
  record(used, 'hit', mine);
  return res;
}

/** Milestone: wave 5 pertama → bonus yang dirujuk + catat bonus pengundang. */
export function checkMilestone(run, meta) {
  if (!run || !meta || !meta.referredBy || meta.referralMilestone) return 0;
  const wave = run.spawnSys ? run.spawnSys.wave : 1;
  if (wave < REFERRAL_MILESTONE_WAVE) return 0;
  const reward = milestoneReward();
  meta.referralMilestone = true;
  addCurrency(meta, reward);
  const mine = (meta.account && meta.account.uid) || meta.guestUid;
  record(meta.referredBy, 'milestone', mine);
  try { writeSave(meta); } catch { /* abaikan */ }
  return reward;
}

/** Hadiah pengundang yang belum diklaim meta ini. */
export function pendingRewards(meta) {
  const keys = myKeys(meta);
  const box = readOutbox().filter((e) => !e.claimed && keys.includes(e.for));
  return {
    hits: box.filter((e) => e.kind === 'hit').length,
    milestones: box.filter((e) => e.kind === 'milestone').length,
  };
}

/** Klaim semua hadiah pengundang → Biokredit. @returns total. */
export function claimPending(meta) {
  const keys = myKeys(meta);
  const box = readOutbox();
  let hits = 0;
  let milestones = 0;
  for (const e of box) {
    if (e.claimed || !keys.includes(e.for)) continue;
    e.claimed = true;
    if (e.kind === 'milestone') milestones++;
    else hits++;
  }
  const total = hits * entryReward() + milestones * milestoneReward();
  if (total > 0) {
    addCurrency(meta, total);
    saveOutbox(box);
    try { writeSave(meta); } catch { /* abaikan */ }
  }
  return { hits, milestones, total };
}
