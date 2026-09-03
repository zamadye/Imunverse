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
