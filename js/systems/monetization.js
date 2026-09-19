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
import { economyCfg, recordEconomyEvent } from './antibody-economy.js';

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
 * Kuota iklan reward harian (semua placement dihitung bersama) — mencegah
 * reward inflation & ad fatigue (riset: cap konservatif, limit dari JSON).
 * @returns {boolean} true bila masih ada kuota hari ini.
 */
export function canWatchAd(meta) {
  if (meta.noAds) return false; // IAP Bebas Iklan aktif — tidak ada interupsi
  const today = new Date().toISOString().slice(0, 10);
  if (!meta.adDaily || meta.adDaily.date !== today) return true;
  // Limit dari data/upgrades.json → economy.adDailyLimit (bukan hardcode)
  let limit = 6;
  try {
    limit = getData().upgrades.economy.adDailyLimit ?? limit;
  } catch { /* data-store belum siap — pakai limit konservatif */ }
  return meta.adDaily.count < limit;
}

/** Catat 1 iklan selesai ditonton (dipanggil setelah onSuccess). */
export function trackAdWatch(meta) {
  const today = new Date().toISOString().slice(0, 10);
  if (!meta.adDaily || meta.adDaily.date !== today) {
    meta.adDaily = { date: today, count: 0 };
  }
  meta.adDaily.count += 1;
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

/** Fase 14: offerwall — video/survei sponsor yang memberi Imun Coin. */
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
 * P5 (IAP §19): status iklan reward ANTIBODI — jalur GRATIS untuk akselerasi.
 * Kuota harian & jeda antar-iklan dibaca dari data/economy.json →
 * `rewardedAds` (bukan hardcode), supaya balancing bisa diutak-atik tanpa
 * menyentuh kode.
 * @returns {{enabled:boolean, canWatch:boolean, reason:string, reward:number,
 *            remainingToday:number, cooldownSec:number, cooldownLeftSec:number}}
 *   reason: '' | 'nonaktif' | 'tanpa-iklan' | 'kuota-habis' | 'jeda'
 */
export function adStatus(meta) {
  const cfg = (economyCfg() && economyCfg().rewardedAds) || {};
  const enabled = cfg.enabled !== false;
  const reward = Math.max(0, Math.round(cfg.antibodyReward ?? 0));
  const limit = Math.max(0, Math.floor(cfg.dailyLimit ?? 0));
  const cooldown = Math.max(0, Number(cfg.cooldownSec ?? 0));
  const daily = (meta && meta.adDaily) || { date: null, count: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const watched = daily.date === today ? Math.max(0, daily.count) : 0;
  const remaining = Math.max(0, limit - watched);
  const last = Number((meta && meta.adLastAt) || 0);
  const left = last > 0 ? Math.max(0, cooldown - (Date.now() - last) / 1000) : 0;
  let reason = '';
  if (!enabled) reason = 'nonaktif';
  else if (meta && meta.noAds) reason = 'tanpa-iklan';
  else if (limit > 0 && remaining <= 0) reason = 'kuota-habis';
  else if (left > 0) reason = 'jeda';
  return {
    enabled, canWatch: reason === '', reason, reward,
    remainingToday: remaining, dailyLimit: limit,
    cooldownSec: cooldown, cooldownLeftSec: Math.ceil(left),
  };
}

/**
 * P5 (IAP §19): HOOK iklan reward untuk ANTIBODI — prioritas utama prototype.
 * Kontrak SDK nanti sama seperti hook lain: onSuccess HANYA setelah iklan
 * benar-benar selesai. Kuota & jeda dicatat di meta (trackAdWatch + adLastAt).
 * @returns {boolean} true bila permintaan diterima
 */
export function triggerRewardedAdAntibody(meta, onSuccess, onFail) {
  const st = adStatus(meta);
  console.info('[monetization] triggerRewardedAdAntibody() — simulasi iklan reward (+antibodi)');
  recordEconomyEvent('rewarded_ad_offered', { placement: 'antibody', canWatch: st.canWatch, reason: st.reason });
  if (!st.canWatch) {
    if (typeof onFail === 'function') onFail(st.reason || 'tidak-tersedia');
    return false;
  }
  simulateAdPlayback(
    () => {
      if (meta) {
        trackAdWatch(meta);
        meta.adLastAt = Date.now();
        recordEconomyEvent('rewarded_ad_completed', { placement: 'antibody', reward: st.reward });
      }
      onSuccess();
    },
    onFail,
  );
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
