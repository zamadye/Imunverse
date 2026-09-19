/**
 * signup-screen.js — Modal ringkas "simpan progres" onboarding V2.
 * Beda dari auth-screen.js (layar penuh, tab MASUK/DAFTAR, dipakai di alur
 * lama post-game-over): ini SATU modal kecil, kontekstual, muncul sekali
 * setelah openbox — boleh dilewati ("Nanti saja") tanpa memblokir main.
 */

import { screenManager } from '../screen-manager.js';
import { setPaused } from '../../core/state-manager.js';
import { signUp } from '../../systems/account-system.js';
import { audio } from '../../systems/audio-system.js';

function setError(msg) {
  const el = document.getElementById('signup-error');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('show', !!msg);
}

function resumeToHud() {
  setPaused(false);
  screenManager.show('hud');
}

export function show() {
  wireOnce();
  setError('');
  const u = document.getElementById('signup-username');
  const p = document.getElementById('signup-password');
  if (u) u.value = '';
  if (p) p.value = '';
  u?.focus();
}

export function hide() {}

let wired = false;
function wireOnce() {
  if (wired) return;
  wired = true;
  const submit = () => {
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const res = signUp({ username, password, faction: 'imun' });
    if (!res.ok) { setError(res.error); return; }
    try { audio.ui(); } catch { /* abaikan */ }
    resumeToHud();
  };
  document.getElementById('btn-signup-submit').addEventListener('click', submit);
  document.getElementById('signup-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  document.getElementById('signup-username').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  document.getElementById('btn-signup-skip').addEventListener('click', () => {
    try { audio.ui(); } catch { /* abaikan */ }
    resumeToHud();
  });
}
