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
  // Dock bawah (gaya RoK) SELALU menampilkan tombolnya — yang terkunci tampil
  // abu-abu dengan label syarat; klik tetap diblokir handler (isDockGated).
  // Permukaan lain (side/quick/secondary/menu HUD) tetap disembunyikan penuh.
  const alwaysShow = target === 'dock' && el.classList.contains('dock-btn');
  el.style.display = gate.locked && !alwaysShow ? 'none' : '';
  if (gate.locked && alwaysShow) {
    el.title = gate.label || '';
  }
  if (!gate.locked) {
    el.querySelector('.gate-lock')?.remove();
    el.removeAttribute('title');
  }
  return gate;
}

/* ------------------------------------------------------------------
 * §6 NAVIGASI — SATU SHEET "PERJALANAN" (pengganti 2 menu HUD F25).
 * Dashboard = launcher (F24): dock 5 slot (slot ke-5 membuka sheet) +
 * tombol bulat HUD saat run membuka sheet yang SAMA. Ini SATU-SATUNYA
 * sumber kebenaran pemetaan destinasi → gerbang features.json, dipakai
 * render sheet, klik, dan badge unlock — agar tidak ada jalur yang lolos
 * (kasus lama: Collection→codex & Battle→arena tak terdaftar → terbuka).
 * ------------------------------------------------------------------ */

/** Destinasi sheet → (target, id) gerbang. `unknown` = tak terdaftar ⇒ DIANGGAP TERKUNCI. */
const JOURNEY_GATES = {
  // progres & pengetahuan (dulu menu1 → gerbang secondary)
  campaign: ['secondary', 'campaign'],
  rank: ['secondary', 'rank'],
  codex: ['secondary', 'codex'],
  bp: ['secondary', 'bp'],
  // hero, koleksi, toko, arena, lab pasukan, tas (dulu menu2/dock)
  roster: ['dock', 'roster'],
  arena: ['dock', 'arena'],
  upgrade: ['dock', 'upgrade'],
  shop: ['dock', 'shop'],
  bag: ['dock', 'bag'],
};

/** Daftar destinasi sheet: [{screenId, target, id}] — dipakai render & badge unlock. */
export function journeyEntries() {
  return Object.entries(JOURNEY_GATES).map(([screenId, [target, id]]) => ({ screenId, target, id }));
}

/** Definisi mentah gerbang (target,id) dari features.json — null bila tak terdaftar. */
export function gateDef(target, id) {
  const gates = (getFeatures() && getFeatures().gates) || [];
  return gates.find((x) => x.target === target && x.id === id) || null;
}

/**
 * Gerbang satu destinasi sheet. Berbeda dari gateFor(): id yang TIDAK terdaftar
 * di features.json dianggap terkunci (fail-closed), bukan lolos.
 * @returns {{locked:boolean, label:string, requireWave:number}}
 */
export function journeyGate(screenId) {
  const map = JOURNEY_GATES[screenId];
  const gate = map ? gateFor(map[0], map[1]) : null;
  return gate || { locked: !isDevMode(), label: 'Terus bermain', requireWave: 0 };
}
