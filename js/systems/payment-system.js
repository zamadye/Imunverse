/**
 * payment-system.js — GATEWAY PEMBAYARAN (persiapan SDK nyata) + katalog IAP v2.0.
 *
 * Alur lengkap: katalog → buat order → pilih metode (QRIS/E-Wallet/Kartu)
 * → bayar → RECEIPT tersimpan → entitlement diberikan. Kini disimulasikan
 * (label jelas di UI); untuk backend nyata CUKUP ganti isi payOrder() dengan
 * fetch ke PSP (Midtrans/Xendit/Play Billing) — satu modul, UI & game tak
 * berubah. Entitlement pada akhirnya WAJIB diberikan dari server (ROADMAP §8.5).
 *
 * FASE 1B (13 Sep 2026) — disesuaikan ke katalog v2.0 di data/premium.json:
 *   • produk ada di `bundles[]` dengan `class`, `active`, `limit`, `contents`
 *   • `contents`: imun · currency · consumables{} · cosmetics[] · drip{} · perks[]
 *   • `methods[]` sekarang OBJEK {id,name,mdrPct,flatFeeRp,…}, bukan string
 *   • field `priceLabel`/`valueNote` SUDAH TIDAK ADA — harga diformat dari
 *     `priceRp`, dan nilai/hemat/badge dihitung runtime oleh pricing-model.js
 *     dari data/economy-anchors.json. Tidak ada angka nilai tulis tangan di sini.
 *   • `active: false` (imun_12000, bundle_noads) tidak boleh tampil/terjual
 *   • batas `limit.perAccount` dihitung dari `meta.purchaseCount`, bukan dari
 *     `meta.receipts` yang dipangkas ke 30 entri
 *   • bonus pembelian pertama 2× (imun_500 & imun_1000, sekali per tier) lewat
 *     resolveImunGrant()/markFirstPurchase()
 *   • produk yang hilang dari katalog tidak lagi membuat payOrder() melempar
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { getData, getAnchors } from '../core/data-store.js';
import { emit } from '../core/ui-bridge.js';
import { badgeFor, valueContents, savingPct, resolveImunGrant, markFirstPurchase } from './pricing-model.js';
import { addImun, grantCosmetics, grantPerks, startDrip } from './imun-economy.js';

const DAY_MS = 86400000;
const HOUR_MS = 3600000;

let currentOrder = null;

/* ------------------------------------------------------------------ */
/* Katalog & metode                                                    */
/* ------------------------------------------------------------------ */

/** Seluruh entri katalog (termasuk yang nonaktif) — untuk pencarian/audit. */
export function getCatalog() {
  return getData().premium.bundles || [];
}

/** Satu produk berdasarkan id, atau null (tidak pernah melempar). */
export function findProduct(productId) {
  return getCatalog().find((b) => b.id === productId) || null;
}

/** Produk yang boleh DIPERLIHATKAN: aktif dan penawarannya masih terbuka. */
export function getVisibleCatalog(meta = STATE.meta, now = Date.now()) {
  return getCatalog().filter((p) => p.active !== false && isOfferOpen(p, meta, now));
}

/** Sudah berapa kali produk ini dibeli akun ini (untuk `limit.perAccount`). */
export function countPurchases(meta = STATE.meta, productId) {
  const counts = (meta && meta.purchaseCount) || {};
  return counts[productId] || 0;
}

/**
 * Apakah penawaran masih terbuka?
 * `limit.perAccount` → maksimal N kali per akun; `visibleForHoursAfterFirstLogin`
 * → hanya N jam sejak save dibuat (proxy login pertama; tidak ada field lain yang
 * menyimpan waktu itu, dan akun perangkat juga hanya menyimpan tanggal).
 */
export function isOfferOpen(product, meta = STATE.meta, now = Date.now()) {
  const limit = product.limit;
  if (!limit) return true;
  if (limit.perAccount && countPurchases(meta, product.id) >= limit.perAccount) return false;
  if (limit.visibleForHoursAfterFirstLogin) {
    const firstTs = Date.parse((meta && meta.createdAt) || '') || 0;
    if (firstTs && now - firstTs > limit.visibleForHoursAfterFirstLogin * HOUR_MS) return false;
  }
  return true;
}

export function getMethods() {
  return getData().premium.methods || [];
}

export function findMethod(methodId) {
  return getMethods().find((m) => m.id === methodId) || null;
}

/**
 * Urutan metode di UI: biaya gateway termurah dulu, kartu terakhir
 * (brief Fase 1B butir 3). Diurut dari data (`mdrPct`, lalu `flatFeeRp`),
 * jadi 0,7% QRIS → 2,0% e-wallet → 2,9% + Rp 2.000 kartu.
 */
export function getMethodsSorted() {
  return [...getMethods()].sort((a, b) => (a.mdrPct - b.mdrPct) || ((a.flatFeeRp || 0) - (b.flatFeeRp || 0)));
}

/** Nama tampilan metode dari id; tahan terhadap receipt lama/metode tak dikenal. */
export function methodName(methodId) {
  const m = findMethod(methodId);
  return m ? m.name : String(methodId || '—').toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Format & nilai (dihitung, bukan ditulis tangan)                     */
/* ------------------------------------------------------------------ */

/** Satu-satunya tempat harga rupiah diformat untuk UI. */
export function formatRp(n) {
  return `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
}

/**
 * Ringkasan nilai isi produk — pengganti `valueNote` yang sudah tidak ada di
 * katalog v2. Dihitung dari economy-anchors.json. Sengaja HANYA menyebut nilai:
 * klaim persentase hemat adalah tugas badge (badgeForProduct) supaya satu angka
 * tidak muncul dua kali dengan dua pembulatan berbeda.
 */
export function valueSummary(product, anchors = getAnchors()) {
  const v = valueContents(product.contents || {}, anchors);
  return `Nilai isi ± ${formatRp(Math.round(v.totalRp))}`;
}

/** Persentase hemat yang dibenarkan rumus (floor), atau null — untuk audit/UI. */
export function savingPctOf(product, anchors = getAnchors()) {
  return savingPct(product, anchors);
}

/** Badge runtime (menggantikan string badge tulis tangan di UI). */
export function badgeForProduct(product, anchors = getAnchors()) {
  const refId = anchors.currency && anchors.currency.imun ? anchors.currency.imun.referenceTierId : null;
  return badgeFor(product, anchors, refId ? findProduct(refId) : null);
}

/** Label perk untuk struk/chip — angka `+N` dibaca dari id perk di data. */
function perkLabel(perkId) {
  const m = /^adDailyLimitPlus(\d+)$/.exec(perkId);
  if (m) return `kuota iklan harian +${m[1]}`;
  if (perkId === 'noForcedAds') return 'tanpa iklan paksa';
  return `perk ${perkId}`;
}

/* ------------------------------------------------------------------ */
/* Order                                                               */
/* ------------------------------------------------------------------ */

/** Buat order baru (menunggu pembayaran). Menolak produk nonaktif/limit habis. */
export function createOrder(productId, meta = STATE.meta) {
  const bundle = findProduct(productId);
  if (!bundle) return { ok: false, error: 'Produk tidak ditemukan' };
  if (bundle.active === false) return { ok: false, error: 'Produk ini sedang tidak dijual' };
  if (!isOfferOpen(bundle, meta)) {
    const limit = bundle.limit || {};
    if (limit.perAccount && countPurchases(meta, productId) >= limit.perAccount) {
      return { ok: false, error: `Maksimal ${limit.perAccount}× per akun — sudah dibeli` };
    }
    return { ok: false, error: 'Penawaran ini sudah berakhir' };
  }
  currentOrder = {
    orderId: 'ord_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    productId,
    name: bundle.name,
    priceRp: bundle.priceRp,
    method: null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  return { ok: true, order: currentOrder };
}

export function getPendingOrder() {
  return currentOrder && currentOrder.status === 'pending' ? currentOrder : null;
}

/** Pilih metode dengan ID (katalog v2: `methods[]` berisi objek, bukan string). */
export function setMethod(orderId, methodId) {
  if (!currentOrder || currentOrder.orderId !== orderId) return { ok: false, error: 'order tidak cocok' };
  if (!findMethod(methodId)) return { ok: false, error: 'metode tidak dikenal' };
  currentOrder.method = methodId;
  return { ok: true, order: currentOrder };
}

/* ------------------------------------------------------------------ */
/* Entitlement                                                         */
/* ------------------------------------------------------------------ */

/**
 * Terapkan isi produk ke meta. Semua cabang mengikuti `contents` katalog v2;
 * kunci lama (skin/acc/title/noAds) tetap didukung agar produk lama tidak
 * kehilangan isinya.
 * @returns {string[]} ringkasan untuk struk/UI
 */
function grantContents(meta, product) {
  const granted = [];
  const contents = product.contents || {};
  const catalog = getData().premium;

  // Imun — termasuk bonus pembelian pertama 2× (sekali per tier).
  const imunRes = resolveImunGrant(product, catalog, meta);
  if (imunRes.imun > 0) {
    addImun(meta, imunRes.imun);
    markFirstPurchase(product, meta);
    granted.push(imunRes.bonusApplied
      ? `+${imunRes.imun.toLocaleString('id-ID')} Imun (bonus pembelian pertama 2×)`
      : `+${imunRes.imun.toLocaleString('id-ID')} Imun`);
  }

  if (contents.currency) {
    meta.currency = (meta.currency || 0) + contents.currency;
    granted.push(`+${contents.currency.toLocaleString('id-ID')} Antibodi`);
  }

  if (contents.consumables) {
    meta.consumables = meta.consumables || {};
    for (const [id, n] of Object.entries(contents.consumables)) {
      meta.consumables[id] = (meta.consumables[id] || 0) + n;
      granted.push(`${n}× ${id.replace(/_/g, ' ')}`);
    }
  }

  // Kosmetik: lewat grantCosmetics() supaya bentuk meta.cosmetics tetap kanonik (G13).
  if (Array.isArray(contents.cosmetics) && contents.cosmetics.length) {
    const added = grantCosmetics(meta, contents.cosmetics);
    for (const id of added) granted.push(`kosmetik: ${id.replace(/_/g, ' ')}`);
    if (!added.length) granted.push('kosmetik sudah dimiliki');
  }

  // Tetesan harian (Kartu Imun 30 Hari) + perk yang hidup selama jendela kartu.
  if (contents.drip) {
    const now = Date.now();
    startDrip(meta, contents.drip, product.id, now);
    granted.push(`tetesan ${contents.drip.imunPerDay} Imun/hari × ${contents.drip.days} hari`);
    if (Array.isArray(contents.perks) && contents.perks.length) {
      grantPerks(meta, contents.perks, now + (contents.drip.days || 0) * DAY_MS);
    }
  } else if (Array.isArray(contents.perks) && contents.perks.length) {
    grantPerks(meta, contents.perks, 0); // tidak terikat jendela → permanen
  }
  for (const perk of contents.perks || []) granted.push(perkLabel(perk));

  if (contents.noAds) {
    meta.noAds = true;
    granted.push('bebas iklan');
  }
  if (contents.title) {
    meta.premiumTitle = contents.title;
    granted.push(`gelar "${contents.title}"`);
  }
  // Kunci katalog v1 (masih didukung; tidak ada produk aktif yang memakainya).
  if (contents.skin || contents.acc) {
    const added = grantCosmetics(meta, [contents.skin, contents.acc].filter(Boolean));
    for (const id of added) granted.push(`kosmetik: ${id.replace(/_/g, ' ')}`);
  }

  return granted;
}

/* ------------------------------------------------------------------ */
/* Bayar (simulasi)                                                    */
/* ------------------------------------------------------------------ */

/**
 * BAYAR — simulasi gateway (UI sudah menyebut "simulasi").
 * Backend nyata: ganti isi fungsi ini dengan fetch create-transaction ke PSP,
 * lalu konfirmasi via webhook → grant entitlement DARI SERVER.
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
    const bundle = findProduct(currentOrder.productId);
    if (!bundle) {
      // Katalog berubah saat order masih terbuka — jangan melempar (ROADMAP §4 butir 5).
      currentOrder.status = 'failed';
      resolve({ ok: false, error: 'Produk sudah tidak ada di katalog — transaksi dibatalkan' });
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
      const granted = grantContents(meta, bundle);
      meta.receipts = meta.receipts || [];
      meta.receipts.unshift(receipt);
      if (meta.receipts.length > 30) meta.receipts.length = 30;
      meta.purchaseCount = meta.purchaseCount || {};
      meta.purchaseCount[receipt.productId] = countPurchases(meta, receipt.productId) + 1;
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
