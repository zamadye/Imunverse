/**
 * payment-system.js — GATEWAY PEMBAYARAN (persiapan SDK nyata).
 *
 * Alur lengkap: katalog → buat order → pilih metode (QRIS/E-Wallet/Kartu)
 * → bayar → RECEIPT tersimpan → entitlement diberikan (antibodi, item,
 * bebas iklan, gelar). Kini disimulasikan (label jelas di UI); untuk
 * backend nyata CUKUP ganti isi payOrder() dengan fetch ke PSP
 * (Midtrans/Xendit/Play Billing) — satu modul, UI & game tak berubah.
 *
 * Sprint 4.22: katalog bible §9.1 (Kapsul Perdana 1×, 4 tangga Genom,
 * Kit Riset, Genom Harian/subscription). Bonus pembelian pertama 2× (§9.3).
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { getData } from '../core/data-store.js';
import { emit } from '../core/ui-bridge.js';

let currentOrder = null;

/** Katalog bundle dari data/premium.json. */
export function getCatalog() {
  return getData().premium.bundles;
}

export function getMethods() {
  return getData().premium.methods;
}

/** Apakah produk sudah pernah dibayar (dari struk tersimpan)? */
export function hasPaidReceipt(meta, productId) {
  return (meta.receipts || []).some((r) => r.productId === productId && r.status === 'paid');
}

/** Buat order baru (menunggu pembayaran). */
export function createOrder(productId) {
  const bundle = getCatalog().find((b) => b.id === productId);
  if (!bundle) return { ok: false, error: 'Produk tidak ditemukan' };
  // Sprint 4.22: produk sekali-per-akun (Kapsul Perdana) tak bisa diorder ulang.
  if (bundle.onePerAccount && hasPaidReceipt(STATE.meta, productId)) {
    return { ok: false, error: 'Produk ini hanya sekali per akun' };
  }
  currentOrder = {
    orderId: 'ord_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    productId,
    name: bundle.name,
    priceRp: bundle.priceRp,
    priceLabel: bundle.priceLabel,
    method: null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  return { ok: true, order: currentOrder };
}

export function getPendingOrder() {
  return currentOrder && currentOrder.status === 'pending' ? currentOrder : null;
}

export function setMethod(orderId, method) {
  if (!currentOrder || currentOrder.orderId !== orderId) return { ok: false, error: 'order tidak cocok' };
  if (!getMethods().includes(method)) return { ok: false, error: 'metode tidak dikenal' };
  currentOrder.method = method;
  return { ok: true, order: currentOrder };
}

/** Terapkan isi bundle ke meta (entitlement). */
function grantContents(meta, contents) {
  // Sprint 4.22: ID consumable lama dipetakan ke ID bible §7 saat grant.
  const LEGACY_ITEM = { serum_awal: 'serum_regenerasi', vaksin_awal: 'enzim_litik', kopi_limfa: 'sitokin_burst', pelindung_lendir: 'lapisan_mukus', koin_ganda: 'katalis_mitosis' };
  const granted = [];
  if (contents.currency) {
    meta.currency += contents.currency;
    granted.push(`+${contents.currency} biokredit`);
  }
  if (contents.consumables) {
    meta.consumables = meta.consumables || {};
    for (let [id, n] of Object.entries(contents.consumables)) {
      id = LEGACY_ITEM[id] || id;
      meta.consumables[id] = (meta.consumables[id] || 0) + n;
      granted.push(`${n}× ${id.replace(/_/g, ' ')}`);
    }
  }
  // Sprint 4.22: drip langganan (Genom Harian: 50/hari × 30 klaim manual).
  if (contents.drip) {
    meta.genomDrip = { perDay: contents.drip.perDay, daysLeft: contents.drip.days, lastClaim: null };
    granted.push(`langganan ${contents.drip.perDay} Genom/hari × ${contents.drip.days} hari`);
  }
  if (contents.noAds) {
    meta.noAds = true;
    granted.push('bebas iklan');
  }
  if (contents.title) {
    meta.premiumTitle = contents.title;
    granted.push(`gelar "${contents.title}"`);
  }
  // Fase 14: Imun Coin + kosmetik di dalam bundle (ekonomi premium)
  if (contents.imun) {
    meta.imun = (meta.imun || 0) + contents.imun;
    granted.push(`+${contents.imun} Genom`);
  }
  if (contents.skin || contents.acc) {
    meta.cosmetics = meta.cosmetics || { owned: [], skin: {}, crown: null, aura: null };
    for (const cid of [contents.skin, contents.acc].filter(Boolean)) {
      if (!meta.cosmetics.owned.includes(cid)) meta.cosmetics.owned.push(cid);
      granted.push('kosmetik eksklusif');
    }
  }
  return granted;
}

/**
 * BAYAR — simulasi gateway (UI sudah menyebut "simulasi").
 * Backend nyata: ganti isi fungsi ini dengan fetch create-transaction
 * ke PSP, lalu konfirmasi via webhook → grant entitlement dari server.
 */
export function payOrder(orderId) {
  return new Promise((resolve) => {
    if (!currentOrder || currentOrder.orderId !== orderId || !currentOrder.method) {
      resolve({ ok: false, error: 'order/metode belum siap' });
      return;
    }
    const meta = STATE.meta;
    if (!meta.account) {
      resolve({ ok: false, error: 'Pembelian wajib dengan akun' });
      return;
    }
    // Simulasi jaringan PSP ±700 ms
    setTimeout(() => {
      const receipt = {
        receiptId: 'rcp_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        orderId: currentOrder.orderId,
        productId: currentOrder.productId,
        productName: currentOrder.name,
        method: currentOrder.method,
        amountRp: currentOrder.priceRp,
        uid: meta.account.uid,
        username: meta.account.username,
        date: new Date().toISOString().slice(0, 10),
        status: 'paid',
      };
      const bundle = getCatalog().find((b) => b.id === receipt.productId);
      // Sprint 4.22/23: sekali-per-akun dicek ulang + bonus pertama 2× (§9.3).
      if (bundle.onePerAccount && hasPaidReceipt(meta, bundle.id)) {
        resolve({ ok: false, error: 'Produk ini hanya sekali per akun' });
        return;
      }
      let contents = bundle.contents;
      if (bundle.firstBonus2x && !hasPaidReceipt(meta, bundle.id)) {
        contents = Object.assign({}, bundle.contents, { imun: (bundle.contents.imun || 0) * 2 });
        receipt.firstBonus = true;
      }
      const granted = grantContents(meta, contents);
      meta.receipts = meta.receipts || [];
      meta.receipts.unshift(receipt);
      if (meta.receipts.length > 30) meta.receipts.length = 30;
      currentOrder.status = 'paid';
      writeSave(meta);
      emit('toast', { message: `Pembayaran berhasil: ${bundle.name}!`, kind: 'gold' });
      resolve({ ok: true, receipt, granted });
    }, 700);
  });
}

/**
 * Sprint 4.22: klaim drip Genom Harian (sekali per hari kalender).
 * @returns {{ok:boolean, granted?:int, daysLeft?:int, reason?:string}}
 */
export function claimGenomDrip() {
  const meta = STATE.meta;
  const drip = meta.genomDrip;
  if (!drip || drip.daysLeft <= 0) return { ok: false, reason: 'Tidak ada langganan aktif' };
  const today = new Date().toISOString().slice(0, 10);
  if (drip.lastClaim === today) return { ok: false, reason: 'Sudah diklaim hari ini' };
  drip.lastClaim = today;
  drip.daysLeft -= 1;
  meta.imun = (meta.imun || 0) + drip.perDay;
  writeSave(meta);
  return { ok: true, granted: drip.perDay, daysLeft: drip.daysLeft };
}

/** Riwayat pembelian (transparan, tersimpan di save). */
export function getReceipts() {
  return (STATE.meta && STATE.meta.receipts) || [];
}

/** Bebas iklan aktif? (dipakai monetization untuk menonaktifkan tawaran) */
export function isNoAds() {
  return !!(STATE.meta && STATE.meta.noAds);
}
