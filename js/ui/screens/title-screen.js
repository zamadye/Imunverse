/**
 * title-screen.js — F21: LAYAR JUDUL (gameplay-first, ala game indie).
 * User baru MULAI → sinematik cerita → LANGSUNG gameplay (bukan dashboard).
 * Sudah punya akun → MASUK (alur lama). Semua klik riil.
 */

import { screenManager } from '../screen-manager.js';
import { STATE } from '../../core/state-manager.js';
import { getData, getHero } from '../../core/data-store.js';
import { playOnce } from '../cinematic.js';
import { game } from '../../core/game.js';
import { audio } from '../../systems/audio-system.js';
import { writeSave } from '../../save/save-manager.js';

export function show() {
  const lang = STATE.meta.lang || 'id';
  const btn = document.getElementById('btn-lang-title');
  if (btn) btn.textContent = lang === 'id' ? 'EN' : 'ID';
}

export function hide() {}

/** Mulai run onboarding: sinematik cerita → langsung gameplay bab pertama. */
function startOnboardingRun() {
  const meta = STATE.meta;
  // Hero default (Mako — spek: hero pertama) + bab kampanye pertama
  const heroes = getData().heroes.heroes;
  const starter = heroes.find((h) => h.id === 'macrophage') || heroes[0];
  meta.selectedHero = starter.id;
  const chapters = (getData().campaign.chapters || []);
  if (chapters.length) {
    meta.selectedChapter = chapters[0].id;
    meta.selectedMode = 'kampanye';
  }
  writeSave(meta);
  // Sinematik onboarding (dapat di-skip) → LANGSUNG gameplay
  playOnce('onboarding', () => game.startRun(starter.id));
}

export function wire() {
  document.getElementById('btn-title-start').addEventListener('click', () => {
    audio.unlock();
    startOnboardingRun();
  });
  document.getElementById('btn-title-login').addEventListener('click', () => {
    screenManager.show('auth');
  });
  // Bahasa: tombol .lang-pill SUDAH ditangani handler global main.js
  // (toggle meta.lang + applyDataLanguage + sweepAll) — tidak perlu wiring di sini.
}
