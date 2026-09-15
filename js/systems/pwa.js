/**
 * pwa.js — Sprint 6.35: registrasi Service Worker + prompt instal run ke-3.
 * beforeinstallprompt ditampung; banner PASANG muncul di dashboard saat
 * totalRuns >= 3, belum instal, dan belum ditolak.
 */

import { writeSave } from '../save/save-manager.js';

let deferredPrompt = null;

export function initPwa() {
  try {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  } catch { /* browser lama — game tetap jalan tanpa SW */ }
  try {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
    });
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
    });
  } catch { /* abaikan */ }
}

/** Untuk testing: paksa ketersediaan prompt instal. */
export function setDeferredPromptForTest(evt) {
  deferredPrompt = evt || null;
}

export function canInstall() {
  return !!deferredPrompt;
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  try {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return choice && choice.outcome === 'accepted';
  } catch {
    deferredPrompt = null;
    return false;
  }
}

/**
 * Syarat banner PASANG: run ke-3+, belum instal (prompt tersedia atau
 * force), belum ditolak permanen.
 */
export function shouldShowInstallBanner(meta, { force = false } = {}) {
  if (!meta || meta.pwaDismissed) return false;
  const runs = (meta.stats && meta.stats.totalRuns) || 0;
  if (runs < 3) return false;
  if (force) return true;
  return canInstall();
}

export function dismissInstallBanner(meta) {
  meta.pwaDismissed = true;
  writeSave(meta);
}
