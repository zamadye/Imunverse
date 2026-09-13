/**
 * imun-economy.js — IMUN COIN (currency premium, Fase 14).
 *
 * Ekonomi ganda: Antibodi = soft currency (drop musuh, reward misi, offerwall);
 * Imun Coin = PREMIUM KETAT. Sumber Imun (diperbarui 13 Sep 2026, retune v2.0):
 *   (1) PEMBELIAN uang nyata — payment-system + katalog data/premium.json,
 *       termasuk TETESAN harian Kartu Imun 30 Hari (contents.drip: 50 Imun/hari
 *       × 30 hari, hangus bila tidak diklaim) dan perk langganan di dalamnya
 *   (2) reward BATTLE PASS — data/battlepass.json (jalur premium 500 Imun/musim)
 *   (3) IKLAN REWARDED — 10 Imun × 6/hari, angka dari data/economy-anchors.json
 *       (adEconomy.imunPerAd/dailyLimit). Ini faucet F2P pengganti
 *       offers.adAntibodi yang dihapus; rasio nilainya dijaga validator katalog.
 *   (4) COMEBACK & STREAK — hadiah kembali/harian dari data/retention-config.json
 *       (comeback.returnGift[].imun, comeback.streak.rewards[].imun), diberikan
 *       oleh js/systems/comeback-system.js saat boot.
 *   (5) mastery level (addMasteryXP) — jumlah kecil, sudah ada sejak V2 Phase 6.
 * Tetap TIDAK dari bermain biasa / drop run / likuidasi apa pun: premium tidak
 * dimudahkan. Bonus sampingan sosial (referral/founder/survei) = Antibodi.
 */

import { getData } from '../core/data-store.js';
import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { addCurrency } from './economy-system.js'; // bonus sampingan = ANTIBODI (soft)

export const FOUNDER_TITLE = 'Pendiri Imunverse';

/** Tambah Imun Coin (beta earn / reward / offerwall). */
export function addImun(meta, n) {
  meta.imun = Math.max(0, (meta.imun || 0) + n);
  return meta.imun;
}

/** Belanja Imun. @returns {boolean} true bila saldo cukup & berhasil dipotong. */
export function spendImun(meta, n) {
  if ((meta.imun || 0) < n) return false;
  meta.imun -= n;
  writeSave(meta);
  return true;
}

/**
 * Kosmetik: pastikan struktur, lalu operasi milik/pakai.
 *
 * DIEKSPOR (Fase 1B) karena ini satu-satunya bentuk kanonik `meta.cosmetics`
 * di repo: `{ owned: [], skin: {}, crown: null, aura: null }`. Modul drop-in
 * `rare-drop-system.grantCosmetic()` menginisialisasi `skin: null` (ROADMAP
 * §2 G13) — karena itu kosmetik dari pembelian/drop harus lewat sini lebih
 * dulu supaya bentuk save tidak bercabang.
 */
export function ensureCosmetics(meta) {
  if (!meta.cosmetics) meta.cosmetics = { owned: [], skin: {}, crown: null, aura: null };
  if (!Array.isArray(meta.cosmetics.owned)) meta.cosmetics.owned = [];
  return meta.cosmetics;
}

/**
 * Berikan kosmetik dari isi produk katalog v2 (`contents.cosmetics[]`).
 * @returns {string[]} id yang BARU dimiliki (yang sudah dimiliki dilewati)
 */
export function grantCosmetics(meta, ids) {
  const cos = ensureCosmetics(meta);
  const added = [];
  for (const id of ids || []) {
    if (!id || cos.owned.includes(id)) continue;
    cos.owned.push(id);
    added.push(id);
  }
  if (added.length) writeSave(meta);
  return added;
}

export function ownsCosmetic(meta, id) {
  return (meta.cosmetics?.owned || []).includes(id);
}

/** Beli kosmetik dengan Imun (gratis untuk yang limited/0). */
export function buyCosmetic(meta, cosmeticId) {
  const cfg = getData().cosmetics;
  const item = [...cfg.skins, ...cfg.accs].find((c) => c.id === cosmeticId);
  if (!item || ownsCosmetic(meta, cosmeticId)) return { ok: false, error: 'tidak tersedia' };
  if (item.priceImun > 0 && !spendImun(meta, item.priceImun)) return { ok: false, error: 'Imun tidak cukup' };
  ensureCosmetics(meta).owned.push(cosmeticId);
  writeSave(meta);
  return { ok: true, item };
}

/** Skin yang dipakai untuk hero (per-hero mengalahkan "semua"). */
export function getEquippedSkin(meta, heroId) {
  const cos = meta.cosmetics;
  if (!cos) return null;
  const cfg = getData().cosmetics;
  const find = (id) => cfg.skins.find((s) => s.id === id) || null;
  const mine = cos.skin?.[heroId] ? find(cos.skin[heroId]) : null;
  return mine || (cos.skin?.semua ? find(cos.skin.semua) : null);
}

export function equipSkin(meta, skinId, heroId) {
  const cfg = getData().cosmetics;
  const skin = cfg.skins.find((s) => s.id === skinId);
  if (!skin || !ownsCosmetic(meta, skinId)) return false;
  ensureCosmetics(meta).skin[skin.hero] = skinId; // 'semua' | heroId tertentu
  writeSave(meta);
  return true;
}

export function equipAcc(meta, accId) {
  const cfg = getData().cosmetics;
  const acc = cfg.accs.find((a) => a.id === accId);
  if (!acc || !ownsCosmetic(meta, accId)) return false;
  const cos = ensureCosmetics(meta);
  if (acc.kind === 'crown') cos.crown = cos.crown === accId ? null : accId;
  if (acc.kind === 'aura') cos.aura = cos.aura === accId ? null : accId;
  writeSave(meta);
  return true;
}

/**
 * Hadiah Early Beta (Pilar 5): gelar Pendiri + skin terbatas + 300 Imun,
 * sekali per akun. Idempoten — dipanggil tiap dashboard tampil.
 */
export function ensureFounderReward(meta) {
  if (!meta.account || meta.founderGranted) return false;
  meta.founderGranted = true;
  meta.premiumTitle = meta.premiumTitle || FOUNDER_TITLE;
  // RONDE-4: hadiah pendiri = gelar + skin + Antibodi (TANPA Imun Coin —
  // premium murni dari pembelian & Battle Pass).
  addCurrency(meta, 250);
  const cos = ensureCosmetics(meta);
  if (!cos.owned.includes('skin_pendiri')) cos.owned.push('skin_pendiri');
  cos.skin.semua = cos.skin.semua || 'skin_pendiri';
  writeSave(meta);
  return true;
}

/** Kode referral milik akun ini (stabil per uid). */
export function ensureReferral(meta) {
  if (!meta.referral) {
    const seed = (meta.account?.uid || 'tamu').slice(-5).toUpperCase();
    meta.referral = { code: `IMUN-${seed}`, applied: [] };
  }
  return meta.referral;
}

/** Pakai kode teman → +Antibodi (sekali per kode; tidak bisa kode sendiri). */
export function applyReferralCode(meta, raw) {
  const code = String(raw || '').trim().toUpperCase();
  const ref = ensureReferral(meta);
  if (!/^IMUN-[A-Z0-9]{3,8}$/.test(code)) return { ok: false, error: 'Format kode: IMUN-XXXXX' };
  if (code === ref.code) return { ok: false, error: 'Itu kode kamu sendiri' };
  if (ref.applied.includes(code)) return { ok: false, error: 'Kode itu sudah dipakai' };
  const reward = getData().battlepass.offers.referralAntibodi; // RONDE-4: bonus sosial = soft currency
  ref.applied.push(code);
  addCurrency(meta, reward);
  writeSave(meta);
  return { ok: true, reward };
}

/** Offerwall survei sponsor: sekali per hari. */
export function canSurveyToday(meta) {
  const today = new Date().toISOString().slice(0, 10);
  return meta.offerwall?.surveyDate !== today;
}

export function markSurveyDone(meta) {
  meta.offerwall = meta.offerwall || {};
  meta.offerwall.surveyDate = new Date().toISOString().slice(0, 10);
  writeSave(meta);
}

/* ---------------------------------------------------------------------------
 * FASE 1B — ENTITLEMENT DARI PEMBELIAN (katalog IAP v2.0, data/premium.json)
 *
 * Tiga jenis isi produk yang belum dikenal repo sebelum Fase 1B:
 *   contents.cosmetics[]  → grantCosmetics()   (skin Paket Perdana)
 *   contents.perks[]      → grantPerks()       (noForcedAds, adDailyLimitPlus2)
 *   contents.drip{…}      → startDrip()/claimDrip()  (Kartu Imun 30 Hari)
 *
 * Aturannya dari ROADMAP §4 butir 4 dan doc `pass_bulanan`: tetesan HANGUS bila
 * tidak diambil pada harinya — tidak pernah menumpuk. Perk ikut jendela kartu
 * (startTs + days), jadi kuota iklan +2 ikut berakhir saat kartunya berakhir.
 * Tidak ada angka di sini: semuanya dari contents produk di data.
 * ------------------------------------------------------------------------- */

const DAY_MS = 86400000;
const dayKey = (ts) => new Date(ts).toISOString().slice(0, 10);

/**
 * Catat perk langganan.
 * @param {number} untilTs timestamp kedaluwarsa; 0 = permanen
 */
export function grantPerks(meta, perkIds, untilTs = 0) {
  meta.perks = meta.perks || {};
  for (const id of perkIds || []) meta.perks[id] = untilTs || 0;
  writeSave(meta);
  return meta.perks;
}

/** Apakah satu perk masih berlaku? */
export function hasPerk(meta, perkId, now = Date.now()) {
  const until = meta && meta.perks ? meta.perks[perkId] : 0;
  if (!until) return false;
  return until === 0 || until > now;
}

/**
 * Bonus kuota iklan harian dari perk berbentuk `adDailyLimitPlusN`.
 * Angkanya dibaca dari id perk (yang datang dari data/premium.json), jadi
 * menambah `adDailyLimitPlus3` di data tidak memerlukan perubahan kode.
 */
export function adLimitBonusFromPerks(meta, now = Date.now()) {
  let bonus = 0;
  for (const id of Object.keys((meta && meta.perks) || {})) {
    const m = /^adDailyLimitPlus(\d+)$/.exec(id);
    if (m && hasPerk(meta, id, now)) bonus += Number(m[1]);
  }
  return bonus;
}

/** Mulai tetesan Imun harian (menimpa kartu lama — produk ini tidak ditumpuk). */
export function startDrip(meta, drip, productId = null, now = Date.now()) {
  meta.drip = {
    productId,
    imunPerDay: (drip && drip.imunPerDay) || 0,
    days: (drip && drip.days) || 0,
    startTs: now,
    lastClaimDay: null,
    claimedDays: 0,
  };
  writeSave(meta);
  return meta.drip;
}

/** Status kartu untuk UI: hari ke berapa, sisa hari, sudah klaim hari ini? */
export function dripStatus(meta, now = Date.now()) {
  const d = meta && meta.drip;
  if (!d || !d.days) return null;
  const elapsed = Math.floor((now - d.startTs) / DAY_MS); // 0 = hari pertama
  const active = elapsed < d.days;
  const dayNumber = Math.min(elapsed + 1, d.days);
  return {
    productId: d.productId,
    active,
    dayNumber,
    days: d.days,
    daysLeft: Math.max(0, d.days - elapsed),
    imunPerDay: d.imunPerDay,
    claimedToday: d.lastClaimDay === dayKey(now),
    claimedDays: d.claimedDays || 0,
    totalImun: d.imunPerDay * d.days,
    expiresTs: d.startTs + d.days * DAY_MS,
  };
}

/**
 * Klaim tetesan hari ini. Hari yang terlewat HANGUS (tidak menumpuk).
 * @returns {{ok:boolean, imun?:number, dayNumber?:number, daysLeft?:number, expired?:boolean, error?:string}}
 */
export function claimDrip(meta, now = Date.now()) {
  const st = dripStatus(meta, now);
  if (!st) return { ok: false, error: 'Tidak ada kartu aktif' };
  if (!st.active) return { ok: false, expired: true, error: 'Kartu sudah berakhir' };
  if (st.claimedToday) return { ok: false, error: 'Sudah diklaim hari ini' };
  addImun(meta, st.imunPerDay);
  meta.drip.lastClaimDay = dayKey(now);
  meta.drip.claimedDays = (meta.drip.claimedDays || 0) + 1;
  writeSave(meta);
  return { ok: true, imun: st.imunPerDay, dayNumber: st.dayNumber, daysLeft: st.daysLeft };
}
