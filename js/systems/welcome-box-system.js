/**
 * welcome-box-system.js — ADDENDUM §1: Kapsul Membran (Welcome Box).
 *
 * Satu hero gratis sekali seumur akun, dibuka SETELAH run pertama selesai
 * (pemain sudah merasakan Mako dulu → hero baru punya pembanding emosional).
 * Pool & peluang dari data/welcome-box.json (bisa diganti per musim).
 *
 * Alir: finishRun → onRunComplete (tandai pending) → gameover dismiss →
 *   maybeConsumePending (alih ke layar 'capsule') → rollCapsule → unlock.
 * Duplikat (hero sudah dimiliki): kompensasi antibodi, BUKAN hero kedua.
 */

import { getData } from '../core/data-store.js';
import { getHero } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';
import { addCurrency } from './economy-system.js';

/** Definisi kapsul dari data (null bila data belum dimuat). */
export function getWelcomeBoxDef() {
  try {
    return (getData() && getData().welcomeBox) || null;
  } catch {
    return null;
  }
}

/** Dipanggil di akhir run: tandai kapsul pending tepat setelah run pertama. */
export function onRunComplete(meta) {
  if (!meta) return false;
  if ((meta.stats && meta.stats.totalRuns) !== 1) return false;
  meta.welcomeBox = meta.welcomeBox || {};
  if (meta.welcomeBox.opened) return false;
  if (meta.welcomeBox.pending) return true;
  const def = getWelcomeBoxDef();
  meta.welcomeBox.pending = true;
  meta.welcomeBox.seasonId = (def && def.seasonId) || 's1';
  try { writeSave(meta); } catch { /* abaikan */ }
  return true;
}

/** Apakah kapsul menunggu dibuka? */
export function isCapsulePending(meta) {
  return !!(meta && meta.welcomeBox && meta.welcomeBox.pending && !meta.welcomeBox.opened);
}

/**
 * Roll hero dari pool (weighted, hanya hero valid). Sekali seumur akun.
 * @returns {{heroId, tier, duplicate, compensation}|null}
 */
export function rollCapsule(meta) {
  const def = getWelcomeBoxDef();
  if (!def || !meta) return null;
  meta.welcomeBox = meta.welcomeBox || {};
  if (meta.welcomeBox.opened) return null; // oncePerAccount
  const pool = (def.pool || []).filter((p) => p && getHero(p.heroId));
  if (pool.length === 0) return null;
  const total = pool.reduce((a, p) => a + (p.weight || 0), 0) || 1;
  let r = Math.random() * total;
  let picked = pool[0];
  for (const p of pool) {
    r -= (p.weight || 0);
    if (r <= 0) { picked = p; break; }
  }
  meta.unlockedHeroes = meta.unlockedHeroes || [];
  const duplicate = meta.unlockedHeroes.includes(picked.heroId);
  let compensation = 0;
  if (duplicate) {
    // Duplikat → kompensasi antibodi (field internal tetap 'currency')
    compensation = def.compensationAntibodi || 0;
    if (compensation > 0) addCurrency(meta, compensation);
  } else {
    meta.unlockedHeroes.push(picked.heroId);
  }
  meta.welcomeBox.opened = true;
  meta.welcomeBox.pending = false;
  meta.welcomeBox.heroId = picked.heroId;
  meta.welcomeBox.tier = picked.tier || 'common';
  meta.welcomeBox.duplicate = duplicate;
  meta.welcomeBox.openedAt = new Date().toISOString();
  try { writeSave(meta); } catch { /* abaikan */ }
  return { heroId: picked.heroId, tier: picked.tier || 'common', duplicate, compensation };
}

let snoozed = false; // sesi ini saja: pemain menunda buka kapsul

/** Tandai kapsul ditunda sesi ini (dashboard tidak menagih lagi). */
export function snoozeCapsule() { snoozed = true; }

/** Apakah kapsul sedang ditunda sesi ini? */
export function isCapsuleSnoozed() { return snoozed; }

/**
 * Pastikan ada UID tamu untuk link referral/share (akun bisa belum ada).
 * Disimpan di meta.guestUid (merge default menanganinya utk save lama).
 */
export function ensureGuestUid(meta) {
  if (!meta) return 'phagos';
  if (!meta.guestUid) {
    try {
      meta.guestUid = 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    } catch {
      meta.guestUid = 'g-anon';
    }
    try { writeSave(meta); } catch { /* abaikan */ }
  }
  return meta.guestUid;
}

/** Warna tier untuk animasi & gambar share. */
export function tierColor(tier) {
  switch (tier) {
    case 'epic': return '#b366ff';
    case 'rare': return '#4da6ff';
    case 'uncommon': return '#5fd97a';
    default: return '#e8e4da';
  }
}

/** Label tier Indonesia. */
export function tierLabel(tier) {
  switch (tier) {
    case 'epic': return 'EPIC';
    case 'rare': return 'RARE';
    case 'uncommon': return 'UNCOMMON';
    default: return 'COMMON';
  }
}
