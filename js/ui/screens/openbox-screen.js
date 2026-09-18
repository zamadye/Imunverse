/**
 * openbox-screen.js — Modal "openbox" onboarding V2: reveal hero bonus
 * setelah level-up PERTAMA pemain (main.js on('levelup')/on('resume')).
 *
 * Tidak ada gacha/acak (ROADMAP §8 non-goals): hero yang diungkap sudah
 * ada di meta.unlockedHeroes sejak createDefaultMeta() (T-Bolt) — modal ini
 * murni PERAYAAN hero yang memang sudah didapat, bukan hadiah acak baru.
 */

import { STATE, setPaused } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { screenManager } from '../screen-manager.js';
import { audio } from '../../systems/audio-system.js';
import { hasAccount } from '../../systems/account-system.js';

/** Hero bonus = hero terbuka selain yang sedang dipakai (fallback T-Bolt). */
function bonusHeroId(meta) {
  const list = meta.unlockedHeroes || [];
  const candidate = list.find((id) => id !== meta.selectedHero);
  return candidate || 'tcd8';
}

export function show() {
  wireOnce();
  const meta = STATE.meta;
  const heroes = getData().heroes.heroes;
  const hero = heroes.find((h) => h.id === bonusHeroId(meta)) || heroes[0];

  document.getElementById('openbox-hero-portrait').src = hero.spritePortrait || hero.spriteIdle || '';
  document.getElementById('openbox-hero-portrait').alt = hero.name;
  document.getElementById('openbox-hero-name').textContent = hero.name;
  document.getElementById('openbox-hero-role').textContent = `${hero.title || ''} · ${hero.role || ''}`;
  document.getElementById('openbox-hero-desc').textContent =
    (hero.identity && hero.identity.combatIdentity) || hero.description || '';

  const crate = document.getElementById('openbox-crate');
  crate.classList.remove('opened');
  void crate.offsetWidth; // restart animasi buka peti
  crate.classList.add('opened');

  try { audio.evolve ? audio.evolve() : audio.ui(); } catch { /* abaikan */ }
}

export function hide() {}

let wired = false;
function wireOnce() {
  if (wired) return;
  wired = true;
  document.getElementById('btn-openbox-claim').addEventListener('click', () => {
    try { audio.ui(); } catch { /* abaikan */ }
    if (!hasAccount()) {
      screenManager.show('signup');
    } else {
      setPaused(false);
      screenManager.show('hud');
    }
  });
}
