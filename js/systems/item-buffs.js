/**
 * item-buffs.js — ADDENDUM §2: consumable sistem membran.
 *
 * Model TETAP seperti lama (dipakai otomatis saat run dimulai), tapi efeknya
 * diselaraskan ke mekanik membran. Buff berdurasi disimpan di run.itemBuffs
 * berbasis run.time (tidak perlu tick manual); dua item bersifat reaktif:
 * Serum Regenerasi (picu saat HP<70%) & Membran Cadangan (picu saat HP<20%).
 *
 * Sprint 3.18: ID bible §7 (serum_regenerasi, enzim_litik, sitokin_burst,
 * lapisan_mukus, katalis_mitosis). Stok ID lama (bundle premium) tetap
 * diambil sebagai fallback — lihat take() di bawah.
 */

import { writeSave } from '../save/save-manager.js';
import { emit } from '../core/ui-bridge.js';
import { STATE } from '../core/state-manager.js';

/** State buff fresh untuk run baru. */
export function freshBuffs() {
  return {
    enzimUntil: 0,       // Enzim Litik: contact ×2 + telan mudah (8 dtk)
    sitokinUntil: 0,     // Sitokin Burst: speed +40% (10 dtk)
    sitokinApplied: false,
    toksinUntil: 0,      // Racun Balik: thorns 40% (10 dtk)
    opsoninUntil: 0,     // Marker Opsonin: info durasi (musuh bawa timer sendiri)
    atpPulsesLeft: 0,    // Ledakan ATP: sisa Pulse −60% CD
    sinapsisUntil: 0,    // Sinyal Sinapsis: medan mini pasukan ×2 (12 dtk)
    katalis: false,      // Katalis Mitosis: drop ×1.5 + engulf 2× bio
    mukusPool: 0,        // Lapisan Mukus: sisa serapan (25% max HP)
    serumPending: false, // Serum Regenerasi: picu saat HP<70%
    cadanganPending: false, // Membran Cadangan: picu saat HP<20%
    cadanganUsed: false,
    cadanganUntil: 0,    // medan kedua aktif sampai (6 dtk)
  };
}

/** Apakah buff berdurasi `key` masih aktif? (key = 'enzim'|'sitokin'|...). */
export function buffActive(run, key) {
  const b = run && run.itemBuffs;
  if (!b) return false;
  const t = run.time || 0;
  switch (key) {
    case 'enzim': return t < (b.enzimUntil || 0);
    case 'sitokin': return t < (b.sitokinUntil || 0);
    case 'toksin': return t < (b.toksinUntil || 0);
    case 'sinapsis': return t < (b.sinapsisUntil || 0);
    case 'cadangan': return t < (b.cadanganUntil || 0);
    default: return false;
  }
}

/** Apakah musuh ini sedang ditandai Opsonin? */
export function isOpsoninMarked(run, enemy) {
  return !!enemy && (enemy.opsoninUntil || 0) > (run.time || 0);
}

/**
 * Konsumsi semua consumable di awal run (dipanggil di AKHIR startRun —
 * player & membran sudah ada). Toast memakai NAMA BARU.
 */
export function applyStartConsumables(game) {
  const run = game.run;
  const meta = STATE.meta || null;
  const M = meta && meta.consumables ? meta : null;
  if (!run || !M) return;
  run.itemBuffs = freshBuffs();
  const b = run.itemBuffs;
  const t = run.time || 0;
  const LEGACY = { serum_regenerasi: 'serum_awal', enzim_litik: 'vaksin_awal', sitokin_burst: 'kopi_limfa', lapisan_mukus: 'pelindung_lendir', katalis_mitosis: 'koin_ganda' };
  const take = (id) => {
    if ((M.consumables[id] || 0) > 0) { M.consumables[id] -= 1; return true; }
    const leg = LEGACY[id]; // fallback stok ID lama (bundle premium §9.1)
    if (leg && (M.consumables[leg] || 0) > 0) { M.consumables[leg] -= 1; return true; }
    return false;
  };
  let touched = false;

  // Enzim Litik (dulu Vaksin Awal): contact ×2 + telan mudah, 8 dtk
  if (take('enzim_litik')) {
    touched = true;
    b.enzimUntil = t + 8;
    emit('toast', { message: 'Enzim Litik: membran ganas 8 detik!', kind: 'gold' });
  }
  // Sitokin Burst (dulu Kopi Limfa): speed +40% 10 dtk + reset Pulse
  if (take('sitokin_burst')) {
    touched = true;
    b.sitokinUntil = t + 10;
    if (!b.sitokinApplied && run.player && run.player.stats) {
      run.player.stats.speed *= 1.4;
      b.sitokinApplied = true;
    }
    if (run.membrane) run.membrane.pulseCdLeft = 0;
    emit('toast', { message: 'Sitokin Burst: +40% kecepatan!', kind: 'gold' });
  }
  // Lapisan Mukus (dulu Pelindung Lendir): perisai 25% max HP
  if (take('lapisan_mukus')) {
    touched = true;
    const pool = Math.round((run.player ? run.player.maxHP : 100) * 0.25);
    b.mukusPool = pool;
    emit('toast', { message: `Lapisan Mukus: perisai ${pool} HP!`, kind: 'gold' });
  }
  // Katalis Mitosis (dulu Sinyal Ganda): drop ×1.5 + engulf 2× bio
  if (take('katalis_mitosis')) {
    touched = true;
    b.katalis = true;
    emit('toast', { message: 'Katalis Mitosis: panen ganda run ini!', kind: 'gold' });
  }
  // Marker Opsonin: tandai semua musuh di layar 8 dtk
  if (take('opsonin')) {
    touched = true;
    b.opsoninUntil = t + 8;
    let n = 0;
    for (const e of run.enemies || []) {
      if (e && e.alive) { e.opsoninUntil = t + 8; n += 1; }
    }
    emit('toast', { message: `Marker Opsonin: ${n} musuh ditandai!`, kind: 'gold' });
  }
  // Ledakan ATP: Pulse instan + 3 Pulse berikut −60% CD
  if (take('atp_surge')) {
    touched = true;
    b.atpPulsesLeft = 3;
    try {
      // Pulse instan (abaikan cooldown) — visual + sapu awal bila ada yang dekat
      game.triggerPulseForce();
    } catch { /* abaikan */ }
    emit('toast', { message: 'Ledakan ATP: Pulse tak terbendung!', kind: 'gold' });
  }
  // Racun Balik: thorns 40%, 10 dtk
  if (take('toksin_balik')) {
    touched = true;
    b.toksinUntil = t + 10;
    emit('toast', { message: 'Racun Balik: penyerang kena getah!', kind: 'gold' });
  }
  // Sinyal Sinapsis: medan mini pasukan ×2, 12 dtk
  if (take('sinapsis')) {
    touched = true;
    b.sinapsisUntil = t + 12;
    emit('toast', { message: 'Sinyal Sinapsis: pasukan menguat!', kind: 'gold' });
  }
  // Serum Regenerasi: TIDAK dikonsumsi sekarang — picu saat HP<70%
  if ((M.consumables.serum_regenerasi || 0) > 0 || (M.consumables.serum_awal || 0) > 0) b.serumPending = true;
  // Membran Cadangan: TIDAK dikonsumsi sekarang — picu saat HP<20%
  if ((M.consumables.membran_cadangan || 0) > 0) b.cadanganPending = true;

  if (touched) { try { writeSave(M); } catch { /* abaikan */ } }
}

/** Tick per-frame: kembalikan stat sementara yang kedaluwarsa. */
export function updateItemBuffs(game) {
  const run = game.run;
  if (!run || !run.itemBuffs || !run.player) return;
  const b = run.itemBuffs;
  // Sitokin habis → kecepatan kembali normal
  if (b.sitokinApplied && !buffActive(run, 'sitokin')) {
    b.sitokinApplied = false;
    if (run.player.stats) run.player.stats.speed /= 1.4;
  }
}

/**
 * Serap damage dengan Lapisan Mukus (lapisan paling luar).
 * @returns {number} sisa damage yang lolos.
 */
export function absorbMukus(run, amount) {
  const b = run && run.itemBuffs;
  if (!b || !(b.mukusPool > 0) || !(amount > 0)) return amount;
  const absorbed = Math.min(b.mukusPool, amount);
  b.mukusPool -= absorbed;
  return amount - absorbed;
}

/** Apakah Mukus masih punya perisai (→ sentuhan musuh melambat)? */
export function isMukusActive(run) {
  return !!(run && run.itemBuffs && run.itemBuffs.mukusPool > 0);
}

/**
 * Dipanggil dari damagePlayer SETELAH HP berkurang (thorns + picu reaktif).
 * @param {object} game — objek game (akses run/effects/spawnHitFeedback).
 * @param {number} dealt — damage final yang masuk ke HP.
 */
export function onPlayerDamaged(game, dealt) {
  const run = game.run;
  const b = run && run.itemBuffs;
  if (!run || !b || !run.player) return;
  const player = run.player;
  // Racun Balik: 40% damage kembali ke musuh di sekitar (para penyerang)
  if (buffActive(run, 'toksin') && dealt > 0) {
    const reflect = Math.max(1, Math.round(dealt * 0.4));
    for (const e of run.enemies || []) {
      if (!e || !e.alive) continue;
      if (Math.hypot(e.x - player.x, e.y - player.y) > 130 + (e.radius || 0)) continue;
      const died = e.takeDamage(reflect);
      try { game.spawnHitFeedback(e, reflect, died, false, { sourceKind: 'thorns' }); } catch { /* abaikan */ }
      if (died) { try { game.onEnemyKilled(e, 'item'); } catch { /* abaikan */ } }
    }
  }
  if (!player.alive) return;
  const frac = player.hp / Math.max(1, player.maxHP);
  const meta = STATE.meta;
  // Serum Regenerasi: picu saat HP<70% (konsumsi DI SINI, bukan di awal)
  const serumStock = (meta.consumables.serum_regenerasi || 0) + (meta.consumables.serum_awal || 0);
  if (b.serumPending && frac < 0.7 && meta && serumStock > 0) {
    b.serumPending = false;
    if ((meta.consumables.serum_regenerasi || 0) > 0) meta.consumables.serum_regenerasi -= 1;
    else meta.consumables.serum_awal -= 1;
    player.heal(Math.round(player.maxHP * 0.35));
    run.effects.spawnLabel(player.x, player.y - 50, 'SERUM +35%!', '#7dff9a');
    run.effects.spawnBlast(player.x, player.y, 90, '#7dff9a');
    run.effects.spawnBlast(player.x, player.y, 150, '#2c7a78');
    try { writeSave(meta); } catch { /* abaikan */ }
  }
  // Membran Cadangan: picu saat HP<20% (sekali per run)
  if (b.cadanganPending && !b.cadanganUsed && frac < 0.2 && meta && (meta.consumables.membran_cadangan || 0) > 0) {
    b.cadanganPending = false;
    b.cadanganUsed = true;
    b.cadanganUntil = (run.time || 0) + 6;
    meta.consumables.membran_cadangan -= 1;
    run.effects.spawnLabel(player.x, player.y - 50, 'MEMBRAN CADANGAN!', '#ffd166');
    run.effects.spawnBlast(player.x, player.y, 120, '#ffd166');
    try { writeSave(meta); } catch { /* abaikan */ }
  }
}
