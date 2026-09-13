/**
 * pwa-system.js — Fase 2.6 (13 Sep 2026): installability sebagai pertahanan save.
 *
 * Brief §2.6: "manifest aplikasi, service worker untuk cache aset, dan prompt
 * pasang yang muncul setelah run ketiga — sekali, bisa ditolak permanen."
 * docs/rekomendasi-struktur-imunverse.md: aplikasi yang dipasang ke home screen
 * DIKECUALIKAN dari penghapusan penyimpanan 7 hari WebKit di iOS — ini lapisan
 * pertahanan kedua untuk save setelah keputusan pemilik "tetap localStorage,
 * tanpa backend" (ROADMAP §10 #10).
 *
 * Pembagian tugas:
 *   • logika keputusan = MURNI (`shouldPromptInstall`) supaya bisa diuji headless
 *     tanpa browser (scripts/unit-fase2-pwa.mjs)
 *   • tampilan modal = js/ui/install-prompt-modal.js (sistem ini tidak menyentuh DOM)
 *   • service worker & manifest = berkas di akar repo (sw.js, manifest.json)
 *
 * Aturan "sekali": penawaran ditandai `meta.pwa.promptedAt` — tidak pernah muncul
 * lagi setelah itu. Penolakan menyetel `meta.pwa.declined` (permanen).
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { BUILD } from '../core/version.js';

/** Prompt beforeinstallprompt yang ditahan (supaya kita yang memilih momennya). */
let deferredPrompt = null;

/* ------------------------------------------------------------------ */
/* Lingkungan                                                          */
/* ------------------------------------------------------------------ */

/** Apakah aplikasi sudah berjalan sebagai aplikasi terpasang? */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  return !!mq || window.navigator?.standalone === true;
}

/** Deteksi iOS/iPadOS — satu-satunya platform tanpa beforeinstallprompt. */
export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

/** Apakah browser punya prompt instalasi native yang bisa kita picu? */
export function hasNativePrompt() {
  return !!deferredPrompt;
}

export function captureInstallPrompt(event) {
  deferredPrompt = event;
}

/* ------------------------------------------------------------------ */
/* Keputusan (murni)                                                   */
/* ------------------------------------------------------------------ */

/**
 * Apakah prompt pasang boleh ditampilkan SEKARANG?
 *
 * @param {Object} meta  state pemain
 * @param {{canPrompt?:boolean, ios?:boolean, standalone?:boolean}} env
 * @param {number} [now] timestamp (untuk injeksi di uji)
 * @returns {{show:boolean, ios?:boolean, reason?:string}}
 */
export function shouldPromptInstall(meta, env = {}, now = Date.now()) {
  void now; // disertakan agar tanda tangan stabil untuk injeksi uji
  const runs = (meta && meta.stats && meta.stats.totalRuns) || 0;
  const pwa = (meta && meta.pwa) || {};

  if (env.standalone) return { show: false, reason: 'sudah berjalan sebagai aplikasi terpasang' };
  if (pwa.installed) return { show: false, reason: 'sudah terpasang' };
  if (pwa.declined) return { show: false, reason: 'ditolak permanen oleh pemain' };
  if (pwa.promptedAt) return { show: false, reason: 'sudah pernah ditawarkan (sekali)' };
  if (runs < 3) return { show: false, reason: `menunggu run ke-3 (${runs}/3 selesai)` };
  // Tanpa prompt native: hanya iOS yang tetap ditawari (berupa petunjuk manual,
  // karena iOS tidak punya beforeinstallprompt).
  if (!env.canPrompt && !env.ios) return { show: false, reason: 'browser tidak mendukung prompt dan bukan iOS' };
  return { show: true, ios: !env.canPrompt && !!env.ios };
}

/* ------------------------------------------------------------------ */
/* Penanda di save                                                     */
/* ------------------------------------------------------------------ */

export function markPrompted(meta = STATE.meta, now = Date.now()) {
  meta.pwa = Object.assign({ declined: false, installed: false, promptedAt: 0 }, meta.pwa || {});
  meta.pwa.promptedAt = now;
  meta.pwa.lastOfferBuild = BUILD;
  writeSave(meta);
  return meta.pwa;
}

/** Tolak permanen ("jangan tanyakan lagi"). */
export function markDeclined(meta = STATE.meta) {
  meta.pwa = Object.assign({ declined: false, installed: false, promptedAt: 0 }, meta.pwa || {});
  meta.pwa.declined = true;
  writeSave(meta);
  return meta.pwa;
}

export function markInstalled(meta = STATE.meta) {
  meta.pwa = Object.assign({ declined: false, installed: false, promptedAt: 0 }, meta.pwa || {});
  meta.pwa.installed = true;
  writeSave(meta);
  return meta.pwa;
}

/* ------------------------------------------------------------------ */
/* Registrasi & prompt native                                          */
/* ------------------------------------------------------------------ */

/**
 * Daftarkan service worker. Gagal TIDAK pernah memblokir game: hanya console.warn.
 * Hanya pada konteks aman (https atau localhost) — syarat browser untuk SW.
 */
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  const secure =
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';
  if (!secure) return false;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`sw.js?v=${BUILD}`)
      .then((reg) => console.info(`[pwa] service worker aktif (cache imunverse-${BUILD})`, reg.scope))
      .catch((err) => console.warn('[pwa] registrasi service worker gagal:', err));
  });
  return true;
}

/** Picu prompt instalasi native; kembalikan pilihan pengguna. */
export async function promptInstallNative() {
  if (!deferredPrompt) return { ok: false, outcome: 'unavailable' };
  const evt = deferredPrompt;
  deferredPrompt = null;
  try {
    evt.prompt();
    const choice = await evt.userChoice;
    return { ok: choice.outcome === 'accepted', outcome: choice.outcome };
  } catch (err) {
    console.warn('[pwa] prompt instalasi gagal:', err);
    return { ok: false, outcome: 'error' };
  }
}
