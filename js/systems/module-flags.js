/**
 * module-flags.js — R3+ (Rebuild): feature flag 5 modul combat.
 *
 * Combat doc §8: semua modul diferensiasi di belakang flag terpisah sampai
 * fase evaluasi (§7) selesai — jangan hardcode salah satu sebagai pemenang.
 * Flag dibaca dari data/modules.json; override dev via localStorage
 * `imunverse.module.<id>` = '1'/'0' untuk A/B test manual tanpa deploy.
 */

import { getModules } from '../core/data-store.js';

/** Apakah modul aktif? @param {string} id mis. 'antigenMemory' */
export function moduleEnabled(id) {
  try {
    const ov = window.localStorage.getItem('imunverse.module.' + id);
    if (ov === '1') return true;
    if (ov === '0') return false;
  } catch { /* storage terblokir → pakai data */ }
  const m = getModules();
  return !!(m && m.modules && m.modules[id] && m.modules[id].enabled);
}

/** Config modul (bagian bernama sama di modules.json). */
export function moduleConfig(id) {
  const m = getModules();
  return (m && m[id]) || {};
}
