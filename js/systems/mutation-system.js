/**
 * mutation-system.js — PHAGOS V2: Evolusi Dalam Run.
 *
 * Setiap level-up, pemain memilih 1 dari 3 MUTASI BENTUK (bukan +stat).
 * Mutasi kumulatif se-run, ada konflik, ada tier.
 *
 * P3 (IAP §6–§7): mutasi adalah SATU-SATUNYA pembuang Antibodi. Harganya
 * mengikuti INDEKS mutasi (mutasi ke-1 termurah) dengan kurva yang seluruhnya
 * ada di data/economy.json — bukan `bioCost` lama per mutasi:
 *    ke-1 100 → ke-2 150 → ke-3 218 → ke-4 309 → ke-5 432 …
 * Kekurangan antibodi MENGUNCI kartu, tetapi TIDAK PERNAH memblokir permainan
 * (§10): selalu ada jaring pengaman, dan pemain tetap lanjut bertempur.
 */

import { getMutations, getData } from '../core/data-store.js';
import { mutationCost, canAffordMutation, spendAntibody, runAntibody, recordEconomyEvent } from './antibody-economy.js';

/** Harga mutasi berikutnya untuk run ini (indeks = jumlah mutasi + 1). */
export function mutationPriceFor(run) {
  const n = ((run && run.activeMutations) || []).length;
  return mutationCost(n + 1);
}

/** Tier yang boleh muncul di level tertentu (bible §4.1). */
export function tiersForLevel(level) {
  if (level <= 4) return [1];
  if (level <= 8) return [1, 2];
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
  const harga = mutationPriceFor(run);
  const mampu = canAffordMutation(run, active.length + 1);

  // Kandidat: tier cocok + belum dipilih + tidak konflik. Harga mengikuti
  // INDEKS mutasi, jadi semua kartu dalam satu tawaran sama mahalnya — pemain
  // memilih BENTUK yang diinginkan, bukan yang termurah. Kekurangan antibodi
  // membuat kartu terkunci (tetap tampil sebagai info), tetapi tidak pernah
  // memblokir: jaring pengaman di bawah selalu menyisipkan pilihan valid.
  const conflicts = new Set();
  for (const id of active) {
    const def = all.find((m) => m.id === id);
    if (def && def.conflicts) for (const c of def.conflicts) conflicts.add(c);
  }
  // PHAGOS Sprint 1: applyMutation menolak DUA arah (def vs active); filter
  // tawaran harus sama — kecualikan juga def yang konflik KE active, agar
  // modal tak pernah menawarkan kartu yang pasti ditolak saat dipilih.
  for (const m of all) {
    if (m.conflicts && m.conflicts.some((c) => active.includes(c))) conflicts.add(m.id);
  }
  const layak = (m) => tiers.includes(m.tier) && !active.includes(m.id) && !conflicts.has(m.id);
  const affordable = all.filter(layak).filter(() => mampu);
  const locked = all.filter(layak).filter(() => !mampu);

  const safety = level >= 2 && level <= 4;
  const needMutations = safety ? 2 : 3;
  const picked = shuffle([...affordable]).slice(0, needMutations);
  // Isi kurang → tambah kartu terkunci (info) agar slot penuh
  if (picked.length < needMutations) {
    for (const m of shuffle([...locked])) {
      if (picked.length >= needMutations) break;
      picked.push({ ...m, lockedByAntibody: true, cost: harga });
    }
  }
  const cards = picked.map((m) => ({ ...m, isMutation: true, kind: 'mutation' }));

  if (safety) {
    // 1 kartu upgrade stat lama sebagai jaring pengaman
    const u = rollLegacySafety(run);
    if (u) {
      cards.push(u);
    } else if (locked.length > 0) {
      cards.push({ ...locked[0], isMutation: true, kind: 'mutation', lockedByAntibody: true, cost: harga });
    }
  }
  // Acak urutan akhir agar posisi tidak tertebak
  const final = shuffle(cards).slice(0, 3).map((c) => (c.isMutation ? { ...c, cost: harga, lockedByAntibody: !mampu } : c));
  // PHAGOS iterasi — KATUP ANTI-BUNTU: modal tak boleh hanya berisi kartu
  // terkunci (mis. Bio habis di Lv5+ tanpa safety net). Selipkan 1 upgrade
  // lama di slot terakhir agar selalu ada pilihan valid.
  if (final.length > 0 && !final.some((c) => !c.lockedByAntibody)) {
    const u = rollLegacySafety(run);
    if (u) return [...final.slice(0, 2), u];
  }
  return final;
}

/**
 * Terapkan pilihan mutasi ke run.
 * @returns {{ok:boolean, reason?:string, mutation?:object}}
 */
export function applyMutation(run, mutationId, opts = {}) {
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
  // P3 (IAP §6): bayar dengan ANTIBODI; harga mengikuti indeks mutasi.
  const cost = opts.cost != null ? opts.cost : mutationPriceFor(run);
  if (!opts.skipCost && !spendAntibody(run, cost)) {
    return { ok: false, reason: `Butuh ${cost} Antibodi` };
  }
  run.antibodySpent = (run.antibodySpent || 0) + cost;
  recordEconomyEvent('mutation_purchased', { id: mutationId, cost, remaining: runAntibody(run) });
  active.push(mutationId);
  run.mutationHistory = run.mutationHistory || [];
  run.mutationHistory.push({ id: mutationId, level: run.level, wave: run.spawnSys ? run.spawnSys.wave : 1 });
  return { ok: true, mutation: def };
}

/** Definisi satu mutasi dari data (dipakai renderer overlay). */
export function mutationDef(id) {
  try {
    const all = (getMutations() && getMutations().mutations) || [];
    return all.find((m) => m.id === id) || null;
  } catch {
    return null;
  }
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

/**
 * Satu kartu upgrade stat lama yang masih bermakna untuk membran
 * (damage→DPS kontak via scale, maxHP/moveSpeed/magnet→survivalitas).
 * attackSpeed dikeluarkan (tak ada proyektil → kartu mati).
 * @returns {object|null} kartu upgrade atau null bila pool habis
 */
function rollLegacySafety(run) {
  // PHAGOS Sprint 2: pool = 5 stat boost §4.1 (seluruh pool = safety net).
  const pool = (getData().upgrades.levelUpPool || []).filter((u) =>
    (run.upgrades[u.id] || 0) < (u.maxStacks || 99));
  if (pool.length === 0) return null;
  const u = pool[Math.floor(Math.random() * pool.length)];
  return { ...u, isMutation: false, kind: 'upgrade' };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
