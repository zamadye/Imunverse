/**
 * feature-gate.js — R1 (Rebuild): progressive disclosure TRIGGER-BASED.
 *
 * Addendum UX: gate berbasis trigger nyata (jumlah run / wave tercapai /
 * currency terkumpul), BUKAN waktu — sesi cuma 3-8 menit. Item terkunci
 * DISEMBUNYIKAN dari UI (tab muncul begitu ter-unlock), bukan dipajang
 * dengan gembok — mengurangi decision fatigue sesi pertama.
 * Data: data/features.json (schemaVersion 2).
 */

import { getFeatures } from '../core/data-store.js';
import { STATE } from '../core/state-manager.js';
import { isDevMode } from '../core/dev-mode.js';

function stats() {
  return (STATE.meta && STATE.meta.stats) || {};
}

/** Label syarat unlock untuk pesan ke pemain. */
function requirementLabel(g) {
  if (g.requireWave) return `Capai Gelombang ${g.requireWave}`;
  if (g.requireCurrency) return `Kumpulkan ${g.requireCurrency} Antibodi`;
  if (g.requireRuns) return `Selesaikan ${g.requireRuns} run`;
  return '';
}

/**
 * Cek gerbang satu fitur. Semua syarat yang tercantum harus terpenuhi (AND).
 * @returns {{locked:boolean, label:string, requireWave:number} | null} null bila tak terdaftar
 */
export function gateFor(target, id) {
  if (isDevMode()) return { locked: false, label: '', requireWave: 0 };
  const gates = (getFeatures() && getFeatures().gates) || [];
  const g = gates.find((x) => x.target === target && x.id === id);
  if (!g) return null;
  const s = stats();
  const meta = STATE.meta || {};
  let locked = false;
  if (g.requireRuns && (s.totalRuns || 0) < g.requireRuns) locked = true;
  if (g.requireWave && (s.bestWave || 0) < g.requireWave) locked = true;
  if (g.requireCurrency && (s.totalCurrencyEarned || meta.currency || 0) < g.requireCurrency) locked = true;
  return { locked, label: requirementLabel(g), requireWave: g.requireWave || 0 };
}

/** Gate untuk tombol dock (dataset.nav = id screen tujuan).
 *  Kontrak main.js: `if (gate) → blokir` — maka kembalikan gate HANYA bila terkunci. */
export function isDockGated(btn) {
  const target = btn.closest('.secondary-dock') ? 'secondary' : 'dock';
  const gate = gateFor(target, btn.dataset.nav);
  return gate && gate.locked ? gate : null;
}

/**
 * R1: progressive disclosure — elemen ter-gate DISEMBUNYIKAN, bukan digembok.
 * Kembalikan gate agar pemanggil tahu status.
 */
export function applyGateVisual(el, target, id) {
  const gate = gateFor(target, id);
  if (!gate) return null;
  el.classList.toggle('gated', gate.locked);
  el.classList.toggle('gate-hidden', gate.locked);
  el.style.display = gate.locked ? 'none' : '';
  if (!gate.locked) {
    el.querySelector('.gate-lock')?.remove();
    el.removeAttribute('title');
  }
  return gate;
}

/* ------------------------------------------------------------------
 * UI/UX — MENU GAMEPLAY (HUD). Sejak F24 dashboard = launcher 1 tombol,
 * semua destinasi hidup di dua menu HUD. Ini SATU-SATUNYA sumber kebenaran
 * pemetaan tombol menu → gerbang features.json, dipakai handler klik,
 * penyembunyian item, dan badge unlock — agar tidak ada jalur yang lolos
 * (kasus lama: Collection→codex & Battle→arena tak terdaftar → terbuka).
 * ------------------------------------------------------------------ */

/** Tombol menu HUD → (target, id) gerbang. `unknown` = tak terdaftar ⇒ DIANGGAP TERKUNCI. */
const HUD_MENU_GATES = {
  // menu1 (perjalanan penjaga): progres & pengetahuan
  menu1: { campaign: ['secondary', 'campaign'], rank: ['secondary', 'rank'], codex: ['secondary', 'codex'], bp: ['secondary', 'bp'] },
  // menu2 (regu hero): hero, koleksi, toko, arena, lab pasukan
  menu2: { roster: ['dock', 'roster'], codex: ['dock', 'codex'], shop: ['dock', 'shop'], arena: ['dock', 'arena'], upgrade: ['dock', 'upgrade'] },
};

/** Daftar item satu menu HUD: [{screenId, target, id}] — dipakai badge unlock. */
export function hudMenuEntries(menu) {
  return Object.entries(HUD_MENU_GATES[menu] || {}).map(([screenId, [target, id]]) => ({ screenId, target, id }));
}

/** Definisi mentah gerbang (target,id) dari features.json — null bila tak terdaftar. */
export function gateDef(target, id) {
  const gates = (getFeatures() && getFeatures().gates) || [];
  return gates.find((x) => x.target === target && x.id === id) || null;
}

/**
 * Gerbang untuk item menu HUD. Berbeda dari gateFor(): id yang TIDAK terdaftar
 * di features.json dianggap terkunci (fail-closed), bukan lolos.
 * @param {'menu1'|'menu2'} menu
 * @returns {{locked:boolean, label:string, requireWave:number}}
 */
export function hudMenuGate(menu, screenId) {
  const map = HUD_MENU_GATES[menu] && HUD_MENU_GATES[menu][screenId];
  const gate = map ? gateFor(map[0], map[1]) : null;
  return gate || { locked: !isDevMode(), label: 'Terus bermain', requireWave: 0 };
}

/**
 * Terapkan disclosure ke satu menu HUD: item terkunci disembunyikan (class
 * `gated` + display:none — bukan gembok), toggle menu ikut disembunyikan bila
 * belum ada satu pun item terbuka. Kembalikan jumlah item terbuka.
 */
export function applyHudMenuGates(menu, linkSelector, toggleEl, datasetKey) {
  let open = 0;
  document.querySelectorAll(linkSelector).forEach((btn) => {
    const gate = hudMenuGate(menu, btn.dataset[datasetKey]);
    btn.classList.toggle('gated', gate.locked);
    btn.style.display = gate.locked ? 'none' : '';
    btn.setAttribute('aria-hidden', gate.locked ? 'true' : 'false');
    if (!gate.locked) open += 1;
  });
  if (toggleEl) {
    toggleEl.classList.toggle('gate-hidden', open === 0);
    toggleEl.style.display = open === 0 ? 'none' : '';
  }
  return open;
}
