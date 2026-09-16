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

// Batch toast: collect newly unlocked codex names, flush as one toast after 400ms
let _pendingCodexNames = [];
let _codexFlushTimer = null;
function _flushCodexToast() {
  _codexFlushTimer = null;
  if (!_pendingCodexNames.length) return;
  const names = _pendingCodexNames.splice(0);
  const message = names.length === 1
    ? `Bio-Pedia: kartu ${names[0]} tercatat!`
    : `Bio-Pedia: ${names.length} kartu baru tercatat!`;
  emit('toast', { message, kind: 'gold' });
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
  _pendingCodexNames.push(def.id);
  clearTimeout(_codexFlushTimer);
  _codexFlushTimer = setTimeout(_flushCodexToast, 400);
  return true;
}

export function progress() {
  const c = getData().codex;
  const total = c && c.entries ? c.entries.length : 0;
  let seen = 0;
  for (const e of (c && c.entries ? c.entries : [])) if (isSeen(e.id)) seen += 1;
  return { seen, total };
}
