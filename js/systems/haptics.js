/**
 * haptics.js — V2 Phase 1: getaran mobile (navigator.vibrate).
 *
 * Target utama Imunverse = anak bermain di HP Android; getaran singkat pada
 * kill/hit/level-up membuat feedback terasa DI TANGAN, bukan hanya di mata.
 * Semua pola & throttle dari data/gamefeel.json (haptic.*).
 *
 * Aman total: no-op senyap bila API tidak ada (desktop/iOS/headless),
 * throttle global mencegah spam getar saat kill beruntun.
 */

import { getGameFeel } from '../core/data-store.js';
import { STATE } from '../core/state-manager.js';

let lastBuzzAt = 0;

/** Apakah perangkat & preferensi mengizinkan getaran. */
function canBuzz() {
  try {
    const cfg = getGameFeel();
    if (!cfg || !cfg.haptic || !cfg.haptic.enabled) return false;
    if (STATE.meta && STATE.meta.hapticOff) return false; // opsi user (persist di save)
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  } catch {
    return false;
  }
}

/**
 * Getar dengan pola dari gamefeel.json.
 * @param {string} key  'kill' | 'elite' | 'crit' | 'playerHit' | 'boss' | 'levelup'
 * @returns {boolean} true bila getaran benar-benar dikirim
 */
export function buzz(key) {
  if (!canBuzz()) return false;
  const cfg = getGameFeel().haptic;
  const pattern = cfg[key];
  if (pattern === undefined || pattern === null) return false;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (now - lastBuzzAt < (cfg.throttleMs || 90)) return false; // anti spam
  lastBuzzAt = now;
  try {
    navigator.vibrate(pattern);
    return true;
  } catch {
    return false;
  }
}
