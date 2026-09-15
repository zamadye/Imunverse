/**
 * revive-screen.js — Modal tawaran revive via rewarded ad (HOOK monetisasi).
 * Tombol "tonton iklan" memanggil game.requestRevive() → hook
 * triggerRewardedAdRevive() → (sukses) confirmRevive() dengan logic asli:
 * pulihkan 50% HP, bersihkan musuh sekitar, lanjutkan run.
 * Hitung mundur 5 detik: bila habis → lanjut ke game over.
 */

import { game } from '../../core/game.js';
import { STATE } from '../../core/state-manager.js';

let countdown = null;
let busy = false;

export function show() {
  busy = false;
  const btn = document.getElementById('btn-watch-ad-revive');
  btn.disabled = false;
  btn.textContent = 'Tonton Iklan & Bangkit';
  document.getElementById('btn-skip-revive').disabled = false;
  // Sprint 4.24: Lanjut Run 50 Genom (butuh saldo cukup).
  const gbtn = document.getElementById('btn-genom-revive');
  if (gbtn) {
    gbtn.disabled = (STATE.meta.imun || 0) < 50;
    gbtn.textContent = `Bangkit — 50 Genom (${STATE.meta.imun || 0})`;
  }

  let left = 5;
  document.getElementById('revive-countdown').textContent = left;
  clearInterval(countdown);
  countdown = setInterval(() => {
    left -= 1;
    document.getElementById('revive-countdown').textContent = left;
    if (left <= 0) {
      clearInterval(countdown);
      countdown = null;
      game.declineRevive(); // → finishRun → event gameover (modal berganti otomatis)
    }
  }, 1000);
}

export function hide() {
  clearInterval(countdown);
  countdown = null;
}

export function wireButtons() {
  document.getElementById('btn-watch-ad-revive').addEventListener('click', () => {
    if (busy) return;
    busy = true;
    const btn = document.getElementById('btn-watch-ad-revive');
    btn.disabled = true;
    btn.textContent = 'Memutar iklan… (simulasi)';
    clearInterval(countdown);
    game.requestRevive();
    // modal ditutup lewat event 'revived' (main.js) bila sukses;
    // fallback: bila 3 detik tak bangkit, aktifkan tombol skip lagi
    setTimeout(() => {
      if (STATE.screen === 'gameplay' && !STATE.paused) return; // sudah revive
      busy = false;
      btn.disabled = false;
      btn.textContent = 'Coba lagi / Lewati';
    }, 3000);
  });

  document.getElementById('btn-genom-revive').addEventListener('click', () => {
    if (busy) return;
    busy = true;
    clearInterval(countdown);
    countdown = null;
    game.requestReviveGenom();
    // modal ditutup lewat event 'resume' bila sukses; gagal → countdown lanjut
    setTimeout(() => {
      if (STATE.screen === 'gameplay' && !STATE.paused) return;
      busy = false;
    }, 500);
  });

  document.getElementById('btn-skip-revive').addEventListener('click', () => {
    clearInterval(countdown);
    countdown = null;
    game.declineRevive();
  });
}
