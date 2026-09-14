/**
 * mutation-system.js — PHAGOS eksperimen: Evolusi Dalam Run.
 *
 * Setiap level-up, pemain memilih 1 dari 3 MUTASI BENTUK (bukan +stat).
 * Mutasi kumulatif se-run, ada konflik, ada tier + biaya Bio-Point:
 *  - Tier 1 gratis (level 2-4), tier 2 = 5 Bio (level 5-8), tier 3 = 15 Bio (level 9+).
 *  - Level 2-4: 2 mutasi + 1 upgrade stat lama (jaring pengaman).
 *
 * Visual kumulatif: run.activeMutations[] dirender berurutan sebagai layer
 * di atas sprite dasar (lihat membrane-render di game.js).
 */

import { getMutations, getData } from '../core/data-store.js';

/** Tier yang boleh muncul di level tertentu. */
export function tiersForLevel(level) {
  if (level <= 4) return [1];
  if (level <= 8) return [2];
  return [2, 3];
}

/**
 * Roll 3 kartu level-up PHAGOS: mutasi (+ safety net upgrade lama di level awal).
 * @returns {object[]} kartu gabungan (mutasi: {isMutation:true,...}, upgrade: entri pool lama)
 */
export function rollMutationChoices(run) {
  const data = getMutations();
  const all = (data && data.mutations) || [];
  const level = run.level || 2;
  const tiers = tiersForLevel(level);
  const active = run.activeMutations || [];
  const bio = run.bioPoints || 0;

  // Kandidat: tier cocok + belum dipilih + tidak konflik + (bio cukup ATAU gratis)
  // Catatan: kartu mahal tetap boleh muncul (terkunci) agar pemain tahu target menabung?
  // Keputusan: hanya tampilkan yang TERBELI (bio cukup) agar tidak ada dead-choice.
  // Jika kandidat terbeli < kebutuhan, izinkan kartu terkunci sebagai info (1 slot).
  const conflicts = new Set();
  for (const id of active) {
    const def = all.find((m) => m.id === id);
    if (def && def.conflicts) for (const c of def.conflicts) conflicts.add(c);
  }
  const affordable = all.filter((m) =>
    tiers.includes(m.tier) &&
    !active.includes(m.id) &&
    !conflicts.has(m.id) &&
    (m.bioCost || 0) <= bio);
  const locked = all.filter((m) =>
    tiers.includes(m.tier) &&
    !active.includes(m.id) &&
    !conflicts.has(m.id) &&
    (m.bioCost || 0) > bio);

  const safety = level >= 2 && level <= 4;
  const needMutations = safety ? 2 : 3;
  const picked = shuffle([...affordable]).slice(0, needMutations);
  // Isi kurang → tambah kartu terkunci (info) agar slot penuh
  if (picked.length < needMutations) {
    for (const m of shuffle([...locked])) {
      if (picked.length >= needMutations) break;
      picked.push({ ...m, lockedByBio: true });
    }
  }
  const cards = picked.map((m) => ({ ...m, isMutation: true, kind: 'mutation' }));

  if (safety) {
    // 1 kartu upgrade stat lama sebagai jaring pengaman
    // PHAGOS: hanya upgrade yang masih bermakna untuk membran (damage→DPS
    // kontak via scale, maxHP/moveSpeed/magnet→survivalitas). attackSpeed
    // tidak dipakai (tidak ada proyektil) → dikeluarkan agar tak jadi kartu mati.
    const pool = (getData().upgrades.levelUpPool || []).filter((u) =>
      ['damage', 'maxHP', 'moveSpeed', 'magnet'].includes(u.id) &&
      (run.upgrades[u.id] || 0) < (u.maxStacks || 99));
    if (pool.length > 0) {
      const u = pool[Math.floor(Math.random() * pool.length)];
      cards.push({ ...u, isMutation: false, kind: 'upgrade' });
    } else if (locked.length > 0) {
      cards.push({ ...locked[0], isMutation: true, kind: 'mutation', lockedByBio: (locked[0].bioCost || 0) > bio });
    }
  }
  // Acak urutan akhir agar posisi tidak tertebak
  return shuffle(cards).slice(0, 3);
}

/**
 * Terapkan pilihan mutasi ke run.
 * @returns {{ok:boolean, reason?:string, mutation?:object}}
 */
export function applyMutation(run, mutationId) {
  const all = (getMutations() && getMutations().mutations) || [];
  const def = all.find((m) => m.id === mutationId);
  if (!def) return { ok: false, reason: 'Mutasi tidak ditemukan' };
  const active = run.activeMutations || (run.activeMutations = []);
  if (active.includes(mutationId)) return { ok: false, reason: 'Sudah dimiliki' };
  // Konflik
  for (const id of active) {
    const a = all.find((m) => m.id === id);
    if (a && a.conflicts && a.conflicts.includes(mutationId)) {
      return { ok: false, reason: `Berkonflik dengan ${a.name}` };
    }
  }
  if (def.conflicts) {
    for (const c of def.conflicts) {
      if (active.includes(c)) {
        const other = all.find((m) => m.id === c);
        return { ok: false, reason: `Berkonflik dengan ${other ? other.name : c}` };
      }
    }
  }
  // Bio cost
  const cost = def.bioCost || 0;
  if ((run.bioPoints || 0) < cost) return { ok: false, reason: `Butuh ${cost} Bio-Point` };
  run.bioPoints -= cost;
  active.push(mutationId);
  run.mutationHistory = run.mutationHistory || [];
  run.mutationHistory.push({ id: mutationId, level: run.level, wave: run.spawnSys ? run.spawnSys.wave : 1 });
  return { ok: true, mutation: def };
}

/** Apakah id adalah mutasi (bukan upgrade lama)? */
export function isMutationId(id) {
  try {
    const all = (getMutations() && getMutations().mutations) || [];
    return all.some((m) => m.id === id);
  } catch {
    return false;
  }
}

/** Label tier untuk kartu. */
export function tierLabel(tier) {
  return tier === 1 ? 'MUTASI I' : tier === 2 ? 'MUTASI II' : 'MUTASI III';
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
