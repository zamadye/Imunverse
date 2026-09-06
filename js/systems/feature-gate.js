/**
 * feature-gate.js — F21: gerbang menu bertahap (dashboard muncul perlahan).
 * Referensi: game indie memunculkan menu setelah pemain cukup bermain (jam/hari,
 * bukan menit) — fokus tetap gameplay. Data: data/features.json.
 * Kunci progres: meta.stats.bestWave (Gelombang terjauh yang pernah dicapai).
 */

import { getFeatures } from '../core/data-store.js';
import { STATE } from '../core/state-manager.js';
import { isDevMode } from '../core/dev-mode.js';

/** bestWave pemain aktif (0 untuk baru). */
function bestWave() {
  return (STATE.meta && STATE.meta.stats && STATE.meta.stats.bestWave) || 0;
}

/**
 * Cek gerbang satu fitur.
 * @returns {{locked:boolean, requireWave:number} | null} null bila tak terdaftar
 */
export function gateFor(target, id) {
  if (isDevMode()) return { locked: false, requireWave: 0 };
  const gates = (getFeatures() && getFeatures().gates) || [];
  const g = gates.find((x) => x.target === target && x.id === id);
  if (!g) return null;
  return { locked: bestWave() < g.requireWave, requireWave: g.requireWave };
}

/** Gate untuk tombol dock (dataset.nav = id screen tujuan). */
export function isDockGated(btn) {
  const target = btn.closest('.secondary-dock') ? 'secondary' : 'dock';
  return gateFor(target, btn.dataset.nav);
}

/** Terapkan visual lock pada satu elemen (badge + label syarat). */
export function applyGateVisual(el, target, id) {
  const gate = gateFor(target, id);
  if (!gate) return null;
  el.classList.toggle('gated', gate.locked);
  if (gate.locked) {
    let badge = el.querySelector('.gate-lock');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'gate-lock';
      el.appendChild(badge);
    }
    badge.textContent = `🔒 Gel.${gate.requireWave}`;
    el.title = `Terbuka setelah mencapai Gelombang ${gate.requireWave}`;
  }
  return gate;
}
