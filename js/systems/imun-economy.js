/**
 * imun-economy.js — IMUN COIN (currency premium, Fase 14).
 *
 * Ekonomi ganda: Antibodi = soft currency (drop musuh, upgrade dasar);
 * Imun Coin = premium (skin, aksesori, Battle Pass premium, bundle).
 * Beta: Imun didapat dari BERMAIN (konversi hasil run), Battle Pass,
 * offerwall (iklan/survei sponsor — simulasi SDK), referral, dan hadiah
 * early-beta. Pembelian uang nyata tetap via payment-system (simulasi).
 */

import { getData } from '../core/data-store.js';
import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';

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

/** Kosmetik: pastikan struktur, lalu operasi milik/pakai. */
function ensureCosmetics(meta) {
  if (!meta.cosmetics) meta.cosmetics = { owned: [], skin: {}, crown: null, aura: null };
  return meta.cosmetics;
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
  addImun(meta, 300);
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

/** Pakai kode teman → +Imun (sekali per kode; tidak bisa kode sendiri). */
export function applyReferralCode(meta, raw) {
  const code = String(raw || '').trim().toUpperCase();
  const ref = ensureReferral(meta);
  if (!/^IMUN-[A-Z0-9]{3,8}$/.test(code)) return { ok: false, error: 'Format kode: IMUN-XXXXX' };
  if (code === ref.code) return { ok: false, error: 'Itu kode kamu sendiri' };
  if (ref.applied.includes(code)) return { ok: false, error: 'Kode itu sudah dipakai' };
  const reward = getData().battlepass.offers.referralImun;
  ref.applied.push(code);
  addImun(meta, reward);
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
