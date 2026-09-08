/**
 * codex-system.js — Kodex Sel (Bio-Pedia): koleksi kartu sains yang terbuka
 * saat pemain BERTEMU entitas di dunia game (bukan lewat menu). Dua kedalaman
 * konten (anak / dewasa muda) dan dwibahasa otomatis via mesin i18n.
 */

import { STATE } from '../core/state-manager.js';
import { getData } from '../core/data-store.js';
import { emit } from '../core/ui-bridge.js';
import { writeSave } from '../save/save-manager.js';

/** Definisi kartu dari data/codex.json. */
export function codexDef(id) {
  const c = getData().codex;
  return (c && c.entries ? c.entries : []).find((e) => e.id === id) || null;
}

export function isSeen(id) {
  return !!(STATE.meta.codexSeen && STATE.meta.codexSeen[id]);
}

/** Tandai entitas pernah ditemui. @returns {boolean} true bila BARU terbuka. */
export function markSeen(id) {
  if (!id) return false;
  const meta = STATE.meta;
  if (!meta.codexSeen) meta.codexSeen = {};
  if (meta.codexSeen[id]) return false;
  const def = codexDef(id);
  if (!def) return false;
  meta.codexSeen[id] = true;
  // cermin ke stats agar sistem misi existing bisa menghitungnya
  meta.stats.codexCards = (meta.stats.codexCards || 0) + 1;
  writeSave(meta);
  emit('toast', { message: `Bio-Pedia: kartu ${def.id} tercatat!`, kind: 'gold' });
  return true;
}

export function progress() {
  const c = getData().codex;
  const total = c && c.entries ? c.entries.length : 0;
  let seen = 0;
  for (const e of (c && c.entries ? c.entries : [])) if (isSeen(e.id)) seen += 1;
  return { seen, total };
}
