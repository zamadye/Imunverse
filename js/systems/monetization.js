/**
 * monetization.js — TITIK INTEGRASI MONETISASI.
 *
 * Fungsi-fungsi hook di file ini adalah SATU-SATUNYA tempat yang perlu
 * disentuh saat SDK ads pihak ketiga (mis. AdMob / Poki / CrazyGames /
 * Google Ad Manager) diintegrasikan nanti. Kontrak yang harus dipenuhi:
 *  - Panggil `onSuccess` HANYA setelah user benar-benar selesai menonton iklan.
 *  - Jangan pernah memanggil `onSuccess` dua kali.
 *
 * Saat ini SDK belum ada, jadi hook mensimulasikan durasi menonton
 * (delay singkat) lalu memanggil onSuccess — namun SELURUH alur game di
 * sekitarnya (revive, double currency, daily reward) adalah logic asli:
 * lihat core/game.js (confirmRevive, applyDoubleCurrency) dan
 * systems/economy-system.js (claimDailyReward).
 */

import { getData } from '../core/data-store.js';

const SIMULATED_AD_DURATION_MS = 900;

function simulateAdPlayback(onSuccess, onFail) {
  // TODO(integrasi-ads): ganti simulasi ini dengan pemanggilan SDK sungguhan, contoh:
  //   sdk.showRewardedVideo({ onRewarded: onSuccess, onClosed: (shown) => shown ? onSuccess() : onFail?.() });
  setTimeout(() => {
    onSuccess();
  }, SIMULATED_AD_DURATION_MS);
}

/**
 * HOOK: iklan reward untuk revive setelah tumbang (1x per run).
 * Setelah sukses, game.js.confirmRevive() memulihkan 50% HP, membersihkan
 * musuh di sekitar, dan melanjutkan run — logic asli.
 * @returns {boolean} true bila permintaan diterima (sedang "memutar iklan")
 */
export function triggerRewardedAdRevive(onSuccess, onFail) {
  console.info('[monetization] triggerRewardedAdRevive() — simulasi iklan reward (revive)');
  simulateAdPlayback(onSuccess, onFail);
  return true;
}

/**
 * HOOK: iklan reward untuk menggandakan antibodi hasil run (1x per run).
 * Setelah sukses, game.js.applyDoubleCurrency() menambahkan earn kedua ke
 * meta + menyimpan — logic asli.
 * @returns {boolean}
 */
export function triggerRewardedAdDoubleCurrency(onSuccess, onFail) {
  console.info('[monetization] triggerRewardedAdDoubleCurrency() — simulasi iklan reward (2x currency)');
  simulateAdPlayback(onSuccess, onFail);
  return true;
}

/**
 * HOOK: iklan reward untuk menggandakan isi Peti Boss (muncul saat boss
 * tumbang — titik istirahat alami, gameplay dipause). Sesuai riset penempatan
 * iklan reward: tier booster, SELALU opsional, tidak mengganggu gameplay.
 * Setelah sukses, game.js.#grantBossChest(true) menambahkan isi 2x — logic asli.
 * @returns {boolean}
 */
export function triggerRewardedAdBossChest(onSuccess, onFail) {
  console.info('[monetization] triggerRewardedAdBossChest() — simulasi iklan reward (peti boss 2x)');
  simulateAdPlayback(onSuccess, onFail);
  return true;
}

/**
 * Kuota iklan reward (semua placement dihitung bersama) — 1× siklus
 * 24 jam ROLLING per akun (F8, keputusan user 2026-09-13): di-anchor ke
 * aktivitas user sendiri, bukan tanggal kalender — "kalau klaim jam 8, jam 8
 * pula refresh-nya". Limit dari data/upgrades.json (5×/hari utk jalur gratis).
 * @returns {boolean} true bila masih ada kuota di siklus 24 jam ini.
 */
const DAY_MS = 86400000;

/** Gulir kuota bila siklus 24 jam lama sudah lewat (lazy, tanpa write save). */
function rollAdQuota(meta, now = Date.now()) {
  const q = meta.adDaily;
  if (!q || typeof q.anchorTs !== 'number' || now - q.anchorTs >= DAY_MS) {
    meta.adDaily = { anchorTs: now, count: 0 };
  }
  return meta.adDaily;
}

export function canWatchAd(meta) {
  if (meta.noAds) return false; // IAP Bebas Iklan aktif — tidak ada interupsi
  const q = rollAdQuota(meta);
  // Limit dari data/upgrades.json → economy.adDailyLimit (bukan hardcode)
  let limit = 5;
  try {
    limit = getData().upgrades.economy.adDailyLimit ?? limit;
  } catch { /* data-store belum siap — pakai limit konservatif */ }
  return q.count < limit;
}

/** Catat 1 iklan selesai ditonton (dipanggil setelah onSuccess). */
export function trackAdWatch(meta) {
  rollAdQuota(meta).count += 1;
}

/**
 * HOOK: iklan reward untuk PERCEPAT PEMULIHAN sistem tubuh yang kritis
 * (meta-layer kondisi tubuh). User menonton karena BUTUH menyelamatkan
 * progres sistem — natural break di dashboard, selalu opsional, masuk
 * kuota harian canWatchAd. Setelah sukses body-system.recoverViaAd()
 * menaikkan sistem paling kritis — logic asli.
 * @returns {boolean}
 */
export function triggerRewardedAdRecovery(onSuccess, onFail) {
  console.info('[monetization] triggerRewardedAdRecovery() — simulasi iklan reward (pemulihan sistem)');
  simulateAdPlayback(onSuccess, onFail);
  return true;
}

/** Fase 14: offerwall — video/survei sponsor. Kebijakan 2026-09-13
 * (keputusan user): video sponsor memberi IMUN COIN (jalur gratis, 5×/24 jam
 * via kuota bersama); survei sponsor memberi Antibodi. Buyer: beli Imun
 * langsung via bundle (data/premium.json).
 * (Seam integrasi; tile offerwall toko saat ini memakai openAdModal shop-screen.) */
export function triggerRewardedAdOfferwall(onSuccess, onFail) {
  console.info('[monetization] triggerRewardedAdOfferwall() — simulasi offerwall sponsor');
  simulateAdPlayback(onSuccess, onFail);
  return true;
}

/**
 * HOOK: IAP "Suplemen Premium" (non-consumable style, simulasi).
 * Kontrak integrasi SDK nantinya: onSuccess HANYA setelah pembelian nyata
 * terverifikasi store. Setelah sukses caller menerapkan efek suplemen —
 * alur di sekitarnya (efek +20 semua sistem, ditandai dirawat) logic asli.
 * @returns {boolean}
 */
export function triggerIAPSuplementPremium(onSuccess, onFail) {
  console.info('[monetization] triggerIAPSuplementPremium() — pembelian simulasi');
  setTimeout(() => onSuccess(), SIMULATED_AD_DURATION_MS);
  return true;
}

/**
 * HOOK: ketersediaan sistem "daily lives" / daily reward.
 * SDK/integrasi server nantinya bisa menentukan ketersediaan; saat ini
 * selalu tersedia, dan tanggal klaim terakhir divalidasi lokal oleh
 * economy-system.canClaimDailyReward() — logic asli.
 * @returns {boolean}
 */
export function checkDailyLives() {
  // TODO(integrasi-ads/backend): cek kuota harian dari server bila ada.
  return true;
}

/**
 * HOOK: interstitial antar-run (belum dipakai alur mana pun — disiapkan).
 */
export function triggerInterstitialAd(onComplete) {
  console.info('[monetization] triggerInterstitialAd() — simulasi interstitial');
  // Interstitial biasanya tidak memberi reward; langsung selesai.
  if (onComplete) setTimeout(onComplete, SIMULATED_AD_DURATION_MS);
  return true;
}
