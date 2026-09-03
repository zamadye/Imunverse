/**
 * tutorial-system.js — Onboarding run pertama (hanya totalRuns === 0).
 * 3 langkah ringkas di atas gameplay (gameplay jalan terus, tanpa pause):
 *   1. Bergerak (tarik layar / WASD)
 *   2. Auto-attack (dekati patogen)
 *   3. Ambil nutrisi (XP & item)
 * Diakhiri bubble "selamat" lalu ditandai selesai di save (meta.tutorialDone).
 * Bisa dilewati lewat tombol LEWATI.
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';

const steps = [
  {
    id: 'move',
    text: 'Tarik di layar (atau W A S D) untuk bergerak!',
    hint: 'tut-move',
  },
  {
    id: 'attack',
    text: 'Senjata menembak OTOMATIS — dekati patogen itu!',
    hint: 'tut-attack',
  },
  {
    id: 'collect',
    text: 'Ambil nutrisi yang jatuh: itu XP & item evolusi!',
    hint: 'tut-collect',
  },
];

let idx = 0;
let active = false;
let movedDist = 0;
const el = (id) => document.getElementById(id);

function shouldRun(meta = STATE.meta) {
  return !meta.tutorialDone && (meta.stats?.totalRuns || 0) === 0;
}

function renderStep() {
  const layer = el('tutorial-layer');
  if (!layer) return;
  layer.classList.remove('hidden');
  layer.textContent = '';
  const step = steps[idx];

  const bubble = document.createElement('div');
  bubble.className = 'tut-bubble';
  bubble.innerHTML = `<span>${step.text}</span>`;

  const finger = document.createElement('div');
  finger.className = `tut-finger ${step.hint}`;

  const skip = document.createElement('button');
  skip.className = 'tut-skip btn btn-sm';
  skip.textContent = 'LEWATI';
  skip.addEventListener('click', skipTutorial);

  layer.appendChild(bubble);
  layer.appendChild(finger);
  layer.appendChild(skip);
}

function advance() {
  idx += 1;
  if (idx >= steps.length) {
    finish();
    return;
  }
  renderStep();
}

function finish() {
  active = false;
  const layer = el('tutorial-layer');
  if (layer) layer.classList.add('hidden');
  const meta = STATE.meta;
  if (meta) {
    meta.tutorialDone = true;
    writeSave(meta);
  }
}

export function skipTutorial() {
  finish();
}

/** Dipanggil dari event runstart. */
export function onRunStart() {
  idx = 0;
  movedDist = 0;
  active = shouldRun();
  if (active) renderStep();
  else {
    const layer = el('tutorial-layer');
    if (layer) layer.classList.add('hidden');
  }
}

/** Dipanggil tiap frame dari game.update dengan jarak gerak player (dt). */
export function notifyMoved(dist, speed) {
  if (!active || steps[idx]?.id !== 'move') return;
  movedDist += dist;
  // selesai setelah bergerak ~2.5 detik
  if (movedDist > speed * 2.5) advance();
}

/** Dipanggil dari onEnemyKilled. */
export function notifyKill() {
  if (!active) return;
  if (steps[idx]?.id === 'attack') advance();
}

/** Dipanggil dari collectPickup. */
export function notifyCollected() {
  if (!active) return;
  if (steps[idx]?.id === 'collect') advance();
  // kematian player saat tutorial: cukup tandai selesai agar tak mengganggu
  // run berikutnya (gameover screen sudah cukup jelas).
}
