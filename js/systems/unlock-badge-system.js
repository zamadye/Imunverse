/**
 * unlock-badge-system.js — F25: badge angka pada menu gameplay.
 *
 * Saat bestWave naik melewati syarat gerbang menu yang belum pernah dilihat
 * pemain, ikon menu (☰ kiri-atas & menu Hero/Toko kanan-bawah) menampilkan
 * badge angka ¹ ² … (jumlah unlock baru). Badge hilang saat pemain MEMBUKA
 * menu (menandai sudah dilihat) — queue notif, bukan spam toast.
 *
 * Kunci progres tetap `meta.stats.bestWave`; penanda "sudah dilihat" disimpan
 * di `meta.seenUnlockWave` (default 0).
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { getFeatures } from '../core/data-store.js';

/** Daftar gerbang yang baru terbuka sejak terakhir dilihat. */
export function pendingUnlocks() {
  const best = (STATE.meta && STATE.meta.stats && STATE.meta.stats.bestWave) || 0;
  const seen = (STATE.meta && STATE.meta.seenUnlockWave) || 0;
  const gates = (getFeatures() && getFeatures().gates) || [];
  return gates.filter((g) => g.requireWave > 0 && g.requireWave <= best && g.requireWave > seen);
}

/** Perbarui badge angka di kedua ikon menu. */
export function renderBadges() {
  const n = pendingUnlocks().length;
  for (const id of ['menu1-badge', 'menu2-badge']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.textContent = String(n);
    el.classList.toggle('hidden', n === 0);
  }
  return n;
}

/** Pemain membuka menu → semua unlock dianggap sudah dilihat. */
export function markSeen() {
  if (!STATE.meta) return;
  const best = (STATE.meta.stats && STATE.meta.stats.bestWave) || 0;
  if ((STATE.meta.seenUnlockWave || 0) >= best) return;
  STATE.meta.seenUnlockWave = best;
  writeSave(STATE.meta);
  renderBadges();
}
