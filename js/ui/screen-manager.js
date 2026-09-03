/**
 * screen-manager.js — Manajemen tampilan screen UI.
 * Setiap screen adalah modul terpisah di ui/screens/ yang mengekspor
 * show(params)/hide() dan punya elemen <section data-screen="..."> di
 * index.html. Menampilkan satu screen akan menyembunyikan screen aktif lain
 * DAN menyinkronkan STATE.screen (single source of truth).
 */

import { setScreen } from '../core/state-manager.js';

const registry = new Map();
let currentId = null;

// Pemetaan id screen UI → nilai STATE.screen aplikasi.
// Modal (levelup/pause/revive) tampil di atas gameplay — state tidak berubah.
const APP_STATE_BY_SCREEN = {
  loading: 'loading',
  dashboard: 'dashboard',
  roster: 'roster',
  upgrade: 'upgrade',
  shop: 'shop',
  arena: 'dashboard', // modal di atas dashboard — state tetap dashboard
  hud: 'gameplay',
  gameover: 'gameover',
};

function elFor(id) {
  return document.querySelector(`[data-screen="${id}"]`);
}

export function registerScreen(id, mod) {
  // Jangan mutasi modul (module namespace ESM bersifat frozen) — bungkus.
  registry.set(id, { id, mod });
}

/**
 * Tampilkan screen. Bila modul punya show(), panggil dengan params.
 */
export function show(id, params) {
  const record = registry.get(id);
  if (!record) throw new Error('Screen tidak terdaftar: ' + id);
  if (currentId && currentId !== id) {
    hideCurrent();
  }
  const el = elFor(id);
  if (el) el.classList.add('active');
  currentId = id;
  // Sinkronkan state aplikasi (modal tidak mengubah state di bawahnya)
  const appState = APP_STATE_BY_SCREEN[id];
  if (appState) setScreen(appState);
  if (record.mod.show) record.mod.show(params);
}

export function hideCurrent() {
  if (!currentId) return;
  const record = registry.get(currentId);
  const el = elFor(currentId);
  if (el) el.classList.remove('active');
  if (record && record.mod.hide) record.mod.hide();
  currentId = null;
}

export function getCurrentId() {
  return currentId;
}

/** Nama modul dipakai langsung (import * as screenManager) — re-export diri. */
const screenManager = { registerScreen, show, hideCurrent, getCurrentId };
export { screenManager };

/** Helper kecil membuat elemen (menghindari innerHTML untuk konten dinamis). */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child) node.appendChild(child);
  }
  return node;
}
