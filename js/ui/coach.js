/**
 * coach.js — ONBOARDING COACH (Hook 1): kunjungan pertama = langsung paham.
 *
 * Tur singkat tap-untuk-lanjut: spotlight ring pada tombol + tooltip bahasa
 * manusia. Semua copy dari data/coach.json. Sekali saja (meta.coachDone),
 * bisa di-skip. Tidak memblokir gameplay — hanya di dashboard.
 */

import { STATE } from '../core/state-manager.js';
import { getData } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';

let step = -1;
let steps = [];
let active = false;

function ensureLayer() {
  let layer = document.getElementById('coach-layer');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'coach-layer';
  layer.innerHTML = `
    <div id="coach-spot"></div>
    <div id="coach-tip" class="coach-tip">
      <b id="coach-title"></b>
      <p id="coach-text"></p>
      <div class="coach-actions">
        <button id="coach-skip" class="coach-skip">Lewati semua</button>
        <button id="coach-next" class="btn btn-primary coach-next">MENGERTI</button>
      </div>
    </div>`;
  document.body.appendChild(layer);
  document.getElementById('coach-next').addEventListener('click', () => next());
  document.getElementById('coach-skip').addEventListener('click', () => finish());
  return layer;
}

function showStep() {
  const layer = ensureLayer();
  const s = steps[step];
  const target = document.querySelector(s.target);
  if (!target) {
    next();
    return;
  }
  target.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'instant' : 'auto' });
  const r = target.getBoundingClientRect();
  const spot = document.getElementById('coach-spot');
  spot.style.top = `${r.top - 8}px`;
  spot.style.left = `${r.left - 8}px`;
  spot.style.width = `${r.width + 16}px`;
  spot.style.height = `${r.height + 16}px`;

  const tip = document.getElementById('coach-tip');
  document.getElementById('coach-title').textContent = s.title;
  document.getElementById('coach-text').textContent = s.text;
  // Tooltip di bawah target; kalau mepet bawah → di atas
  layer.classList.add('active');
  tip.classList.remove('above');
  const tipH = 150;
  if (r.bottom + tipH > window.innerHeight) tip.classList.add('above');
  tip.style.left = `${Math.max(12, Math.min(window.innerWidth - 262, r.left + r.width / 2 - 125))}px`;
  document.getElementById('coach-next').textContent = step === steps.length - 1 ? 'SIAP, MARI MULAI!' : 'MENGERTI';
  audioSafe();
}

function audioSafe() {
  // klik halus tiap langkah (jika audio belum di-unlock, diam saja)
  import('./../systems/audio-system.js').then((m) => m.audio.ui()).catch(() => {});
}

function next() {
  step += 1;
  if (step >= steps.length) {
    finish();
    return;
  }
  showStep();
}

function finish() {
  active = false;
  const layer = document.getElementById('coach-layer');
  if (layer) layer.remove();
  const meta = STATE.meta;
  meta.coachDone = true;
  writeSave(meta);
}

/** Mulai coach bila ini kunjungan pertama (meta.coachDone belum true). */
export function startIfFirstTime() {
  if (STATE.meta.coachDone || active) return;
  steps = (getData().coach && getData().coach.steps) || [];
  if (!steps.length) return;
  active = true;
  step = -1;
  // beri dashboard 1 frame untuk layout
  requestAnimationFrame(() => next());
}

/** Dipakai suite/screenshot & test: paksa selesai. */
export function forceFinish() {
  if (active) finish();
}
