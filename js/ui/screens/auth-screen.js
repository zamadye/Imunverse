/**
 * auth-screen.js — MASUK / DAFTAR (fondasi online).
 *
 * DAFTAR: nama akun + sandi + pilih fraksi (Imun playable; Virus = SEGERA).
 * Fraksi inilah yang nanti men-trigger dashboard pasukan masing-masing
 * (layout sama, hero/allies/tujuan beda). MASUK: untuk kembali ke akun
 * yang sudah ada di perangkat (pembelian & progres terikat akun).
 */

import { STATE } from '../../core/state-manager.js';
import { writeSave } from '../../save/save-manager.js';
import { el, screenManager } from '../screen-manager.js';
import { signUp, login, logout, hasAccount, hasRegisteredAccount, getRegisteredUsernames, getSession } from '../../systems/account-system.js';
import { startIfFirstTime as startCoach } from '../coach.js';

let mode = 'daftar';
let chosenFaction = 'imun';
let fromScreen = null;

function setMode(m) {
  mode = m;
  renderAll();
}

// R1 (Rebuild): pemilihan fraksi DICOPOT dari signup (addendum UX) —
// fitur PvP Virus belum ada; menampilkan pilihan non-fungsional di momen
// onboarding paling kritis merusak trust. Fraksi default: imun.

function setError(msg) {
  const err = document.getElementById('auth-error');
  err.textContent = msg || '';
  err.classList.toggle('show', !!msg);
}

function submit() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  setError('');
  if (mode === 'daftar') {
    const res = signUp({ username, password, faction: chosenFaction });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    screenManager.show('dashboard');
    startCoach(); // onboarding tombol — setelah punya akun
  } else {
    const res = login(username, password);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    screenManager.show('dashboard');
  }
}

function renderTabs() {
  const tabs = document.getElementById('auth-tabs');
  tabs.textContent = '';
  [['daftar', 'DAFTAR'], ['masuk', 'MASUK']].forEach(([m, label]) => {
    const tab = el('button', {
      class: `auth-tab${mode === m ? ' active' : ''}`,
      text: label,
      type: 'button',
    });
    tab.addEventListener('click', () => setMode(m));
    tabs.appendChild(tab);
  });
}


function renderAll() {
  const meta = STATE.meta;
  document.getElementById('auth-currency') && (document.getElementById('auth-currency').textContent = meta.currency.toLocaleString('id-ID'));
  renderTabs();
  // R1: kartu fraksi tidak dirender — kontainer disembunyikan via index.html
  document.getElementById('auth-submit').textContent = mode === 'daftar' ? 'BUAT AKUN & MULAI' : 'MASUK';
  const resume = document.getElementById('auth-resume');
  resume.textContent = '';
  if (hasAccount() && mode === 'masuk') {
    const sess = getSession();
    const outBtn = el('button', { class: 'auth-logout', text: `Keluar dari akun "${sess.username}" (data tetap tersimpan)` });
    outBtn.addEventListener('click', () => {
      logout();
      mode = 'daftar';
      setError('');
      renderAll();
    });
    resume.appendChild(outBtn);
  }
  // Akun terdaftar di perangkat (meski sesi keluar) → tombol lanjut cepat
  if (hasRegisteredAccount() && !hasAccount() && mode === 'masuk') {
    const registered = getRegisteredUsernames()[0];
    const btn = el('button', { class: 'auth-resume-btn' }, [
      el('span', {}, [
        el('b', { text: `Lanjutkan sebagai ${registered}` }),
        el('small', { text: 'akun terdaftar di perangkat ini' }),
      ]),
      el('img', { src: 'assets/sprites/icon_back.png', alt: '', style: 'transform:rotate(180deg);width:16px' }),
    ]);
    btn.addEventListener('click', () => {
      screenManager.show('dashboard'); // pemilik perangkat — akses cepat
    });
    resume.appendChild(btn);
  }
}

let wired = false;

function wireOnce() {
  if (wired) return;
  wired = true;
  document.getElementById('auth-submit').addEventListener('click', submit);
  document.getElementById('auth-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  document.getElementById('auth-username').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

export function show(params) {
  wireOnce();
  fromScreen = (params && params.from) || null;
  mode = hasAccount() ? 'masuk' : 'daftar';
  chosenFaction = 'imun';
  setError('');
  renderAll();
  // Info konteks: dari mana user diarahkan ke sini (mis. coba beli tanpa akun)
  if (fromScreen) {
    setError('');
  }
}

export function hide() {}

export { submit as _submit };
