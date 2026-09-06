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
  // Fase 15: highlight SAJA — jangan scrollIntoView (merusak posisi banner home;
  // user diarahkan lewat sorotan & tombol lanjut, bukan lompatan layout).
  target.scrollIntoView({ block: 'nearest', behavior: 'instant' in window ? 'instant' : 'auto' });
  const sc = target.closest('.dash-scroll');
  if (sc) sc.scrollTop = 0;
  // Fase 15: geometri DIKUNCI ke viewport (tanpa scrollIntoView agar banner
  // home tidak bergeser) — sorotan & tooltip selalu terlihat & bisa diklik.
  const raw = target.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const top = Math.max(10, Math.min(vh - 60, raw.top));
  const left = Math.max(10, Math.min(vw - 60, raw.left));
  const r = {
    top,
    left,
    width: Math.min(raw.width, vw - left - 10),
    height: Math.min(raw.height, vh - top - 10),
    bottom: 0,
  };
  r.bottom = r.top + r.height;
  const spot = document.getElementById('coach-spot');
  spot.style.top = `${r.top - 8}px`;
  spot.style.left = `${r.left - 8}px`;
  spot.style.width = `${Math.max(60, r.width + 16)}px`;
  spot.style.height = `${Math.max(40, r.height + 16)}px`;

  const tip = document.getElementById('coach-tip');
  document.getElementById('coach-title').textContent = s.title;
  document.getElementById('coach-text').textContent = s.text;
  layer.classList.add('active');
  tip.classList.remove('above');
  const tipH = 150;
  const tipTop = r.bottom + 14 + tipH > vh - 10
    ? Math.max(10, r.top - tipH - 14)
    : Math.min(vh - tipH - 10, r.bottom + 14);
  if (r.bottom + tipH > vh - 10) tip.classList.add('above');
  tip.style.top = `${tipTop}px`;
  tip.style.left = `${Math.max(12, Math.min(vw - 262, r.left + r.width / 2 - 125))}px`;
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
