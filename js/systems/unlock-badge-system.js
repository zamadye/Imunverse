/**
 * unlock-badge-system.js — F25: badge angka pada ikon menu gameplay.
 *
 * UI/UX (progressive disclosure): item menu HUD yang belum terbuka TIDAK
 * dirender. Saat sebuah gerbang (run / gelombang / Antibodi — data/features.json)
 * terlewati, item baru MUNCUL di menu dan ikon menu terkait menampilkan badge
 * angka = jumlah pintu baru yang belum pernah dilihat pemain. Badge hilang saat
 * pemain MEMBUKA menu itu (menandai sudah dilihat) — queue notif, bukan spam toast.
 *
 * Penanda "sudah dilihat" disimpan di `meta.seenUnlocks` (array kunci
 * "target:id"). Save lama tanpa field ini diinisialisasi ke semua gerbang yang
 * SUDAH terbuka saat itu (tanpa badge palsu). Field lama `meta.seenUnlockWave`
 * tidak dipakai lagi tetapi dibiarkan (kompatibel).
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { hudMenuEntries, hudMenuGate, gateDef } from './feature-gate.js';

const MENUS = [
  { menu: 'menu1', badge: 'menu1-badge' },
  { menu: 'menu2', badge: 'menu2-badge' },
];

const key = (e) => `${e.target}:${e.id}`;

/** Gerbang yang punya syarat (item tanpa syarat = pintu awal, bukan "unlock baru"). */
function hasRequirement(e) {
  const g = gateDef(e.target, e.id);
  return !!(g && (g.requireRuns || g.requireWave || g.requireCurrency));
}

function unlockedEntries(menu) {
  return hudMenuEntries(menu).filter((e) => !hudMenuGate(menu, e.screenId).locked && hasRequirement(e));
}

/** Pastikan `meta.seenUnlocks` ada; save lama → anggap yang sudah terbuka sudah dilihat. */
function ensureSeen(meta) {
  if (Array.isArray(meta.seenUnlocks)) return meta.seenUnlocks;
  const seen = [];
  for (const { menu } of MENUS) for (const e of unlockedEntries(menu)) seen.push(key(e));
  meta.seenUnlocks = seen;
  writeSave(meta);
  return seen;
}

/** Daftar item menu yang baru terbuka sejak terakhir dilihat. */
export function pendingUnlocks(menu) {
  const meta = STATE.meta;
  if (!meta) return [];
  const seen = new Set(ensureSeen(meta));
  const menus = menu ? [menu] : MENUS.map((m) => m.menu);
  const out = [];
  for (const m of menus) for (const e of unlockedEntries(m)) if (!seen.has(key(e))) out.push({ menu: m, ...e });
  return out;
}

/** Perbarui badge angka pada kedua ikon menu (per menu). */
export function renderBadges() {
  let total = 0;
  for (const { menu, badge } of MENUS) {
    const n = pendingUnlocks(menu).length;
    total += n;
    const el = document.getElementById(badge);
    if (!el) continue;
    el.textContent = String(n);
    el.classList.toggle('hidden', n === 0);
  }
  return total;
}

/** Pemain membuka menu → item baru di menu itu dianggap sudah dilihat (tanpa arg: semua). */
export function markSeen(menu) {
  const meta = STATE.meta;
  if (!meta) return;
  const pending = pendingUnlocks(menu);
  if (!pending.length) return;
  const seen = new Set(ensureSeen(meta));
  for (const e of pending) seen.add(key(e));
  meta.seenUnlocks = [...seen];
  writeSave(meta);
  renderBadges();
}
