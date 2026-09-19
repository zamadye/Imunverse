/**
 * purchase-provider.js — P5: provider pembelian (MOCK, TANPA PAYMENT NYATA).
 *
 * IAP §21: prototype TIDAK boleh terhubung ke payment provider. Yang dibangun
 * di sini adalah DEV GRANT yang rasanya sama dengan pembelian: masuk ke
 * CADANGAN (Reserve), lalu cadangan membantu mutasi sesuai aturan §15.
 *
 * IAP §34 (arsitektur akhir):
 *
 *   PLAYER → PURCHASE → STORE → VERIFICATION → ENTITLEMENT → RESERVE GRANTED
 *
 * Tahap "STORE → VERIFICATION" adalah SATU-SATUNYA yang diganti nanti (P9).
 * Karena itu ia dipisah di balik antarmuka kecil: `setPurchaseProvider(...)`
 * menukar MockPurchaseProvider dengan provider sungguhan (Google Play Billing
 * dst.) TANPA menyentuh sistem mutasi, ekonomi, atau UI.
 *
 * Nol angka di sini — paket & latensi ada di data/economy.json → blok `iap`.
 */

import { economyCfg, recordEconomyEvent } from './antibody-economy.js';
import { grantReserve, reserveBalance } from './reserve-system.js';

function num(v, dflt) {
  return typeof v === 'number' && isFinite(v) ? v : dflt;
}

/** Blok konfigurasi IAP (data/economy.json → iap). */
export function iapCfg() {
  return (economyCfg() && economyCfg().iap) || {};
}

/** IAP aktif? Selalu false bila provider bukan mock tapi belum tersedia. */
export function iapEnabled() {
  const c = iapCfg();
  return c.enabled === true && c.realPayment !== true;
}

/** Daftar paket cadangan yang dijual (urutan & isi dari data). */
export function iapPacks() {
  const c = iapCfg();
  return Array.isArray(c.packs) ? c.packs.filter((p) => p && p.id) : [];
}

export function packById(packId) {
  return iapPacks().find((p) => p.id === packId) || null;
}

/** Maksimal berapa kali tawaran IAP boleh muncul dalam satu run (§27). */
export function maxIapOffersPerRun() {
  return Math.max(0, Math.floor(num(iapCfg().maxOffersPerRun, 0)));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * Provider MOCK — satu-satunya provider di prototype. Pembelian "berhasil"
 * setelah latensi simulasi; TIDAK ada jaringan, TIDAK ada uang, TIDAK ada
 * entitlement. Dipakai untuk merasakan VALUE, bukan menghasilkan revenue.
 */
export class MockPurchaseProvider {
  constructor() {
    this.id = 'mock';
    this.realPayment = false;
  }

  listPacks() {
    return iapPacks();
  }

  /** @returns {Promise<{ok:boolean, packId:string, grant:number, provider:string, simulated:boolean}>} */
  async purchase(packId) {
    const pack = packById(packId);
    const latency = num(iapCfg().mock && iapCfg().mock.latencyMs, 600);
    await delay(latency);
    if (!pack) return { ok: false, packId, grant: 0, provider: this.id, simulated: true, reason: 'paket-tidak-ada' };
    return { ok: true, packId: pack.id, grant: num(pack.grant, 0), provider: this.id, simulated: true };
  }
}

let PROVIDER = new MockPurchaseProvider();

/** Provider aktif (default: mock). */
export function purchaseProvider() {
  return PROVIDER;
}

/**
 * Tukar provider — TITIK INTEGRASI P9. Panggil sekali saat boot dengan
 * provider billing sungguhan; seluruh sistem lain (ekonomi, mutasi, UI)
 * tetap memanggil `buyReservePack()` yang sama.
 */
export function setPurchaseProvider(provider) {
  if (provider) PROVIDER = provider;
  return PROVIDER;
}

/**
 * Beli satu paket → cadangan bertambah (IAP §34: entitlement → reserve).
 * Mencatat event wajib `iap_mock_granted` (§28).
 * @param {object} meta data permanen pemain
 * @param {string} packId
 * @returns {Promise<{ok:boolean, granted:number, reserve:number, pack:object|null}>}
 */
export async function buyReservePack(meta, packId) {
  if (!iapEnabled()) return { ok: false, granted: 0, reserve: reserveBalance(meta), pack: null, reason: 'nonaktif' };
  if (!meta) return { ok: false, granted: 0, reserve: 0, pack: null, reason: 'meta-kosong' };
  const res = await purchaseProvider().purchase(packId);
  if (!res.ok) return { ok: false, granted: 0, reserve: reserveBalance(meta), pack: packById(packId), reason: res.reason || 'gagal' };
  const masuk = grantReserve(meta, res.grant, 'iap_mock');
  recordEconomyEvent('iap_mock_granted', {
    packId: res.packId,
    grant: masuk,
    provider: res.provider,
    simulated: res.simulated !== false,
    reserve: meta.reserve,
  });
  return { ok: true, granted: masuk, reserve: meta.reserve, pack: packById(packId) };
}
