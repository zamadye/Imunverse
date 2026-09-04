/**
 * payment-system.js — GATEWAY PEMBAYARAN (persiapan SDK nyata).
 *
 * Alur lengkap: katalog → buat order → pilih metode (QRIS/E-Wallet/Kartu)
 * → bayar → RECEIPT tersimpan → entitlement diberikan (antibodi, item,
 * bebas iklan, gelar). Kini disimulasikan (label jelas di UI); untuk
 * backend nyata CUKUP ganti isi payOrder() dengan fetch ke PSP
 * (Midtrans/Xendit/Play Billing) — satu modul, UI & game tak berubah.
 *
 * Balancing (data/premium.json): nilai bundle 1,5–1,8× lipat vs beli
 * satuan — hemat terasa tapi tidak mematahkan progres gratisan.
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

/** Buat order baru (menunggu pembayaran). */
export function createOrder(productId) {
  const bundle = getCatalog().find((b) => b.id === productId);
  if (!bundle) return { ok: false, error: 'Produk tidak ditemukan' };
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
  const granted = [];
  if (contents.currency) {
    meta.currency += contents.currency;
    granted.push(`+${contents.currency} antibodi`);
  }
  if (contents.consumables) {
    meta.consumables = meta.consumables || {};
    for (const [id, n] of Object.entries(contents.consumables)) {
      meta.consumables[id] = (meta.consumables[id] || 0) + n;
      granted.push(`${n}× ${id.replace(/_/g, ' ')}`);
    }
  }
  if (contents.noAds) {
    meta.noAds = true;
    granted.push('bebas iklan');
  }
  if (contents.title) {
    meta.premiumTitle = contents.title;
    granted.push(`gelar "${contents.title}"`);
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
      const granted = grantContents(meta, bundle.contents);
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

/** Riwayat pembelian (transparan, tersimpan di save). */
export function getReceipts() {
  return (STATE.meta && STATE.meta.receipts) || [];
}

/** Bebas iklan aktif? (dipakai monetization untuk menonaktifkan tawaran) */
export function isNoAds() {
  return !!(STATE.meta && STATE.meta.noAds);
}
