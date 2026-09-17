/**
 * reserve-system.js — P5: CADANGAN (RESERVE), lapisan bantuan EKSTERNAL.
 *
 * Reserve BUKAN Antibody (IAP §14):
 *
 *   ANTIBODY  → didapat dari BERMAIN (kill · elite · boss · event · telan)
 *               dipakai untuk MUTASI
 *   RESERVE   → resource dukungan EKSTERNAL (IAP / dev grant)
 *               hanya boleh MEMBANTU bila antibodi hasil bermain kurang
 *
 * Aturan yang tidak bisa ditawar (IAP §15):
 *   Reserve TIDAK boleh menghapus requirement gameplay. Karena itu bantuan
 *   dibatasi dua sumbu, keduanya tunable di data/economy.json:
 *
 *     1. assistancePctOfMutationCost — maksIMAL X% dari harga mutasi
 *     2. maxUsesPerRun               — maksimal N kali pakai per run
 *
 *   Jadi meski pemain punya Reserve 20.000 dan antibodi 0, mutasi tetap
 *   tidak bisa dibeli hanya dengan cadangan: ia harus tetap bertempur,
 *   menonton iklan, lalu cadangan menutup sisanya.
 *
 * Nol angka di sini — semua dari data/economy.json → blok `reserve` (§29).
 */

import { economyCfg, recordEconomyEvent, runAntibody, earnAntibody } from './antibody-economy.js';

function num(v, dflt) {
  return typeof v === 'number' && isFinite(v) ? v : dflt;
}

/** Blok konfigurasi cadangan (data/economy.json → reserve). */
export function reserveCfg() {
  return (economyCfg() && economyCfg().reserve) || {};
}

export function reserveEnabled() {
  return reserveCfg().enabled === true && reserveCfg().separateFromAntibody !== false;
}

/** Kapasitas maksimal cadangan yang bisa disimpan. */
export function reserveCapacity() {
  return Math.max(0, Math.round(num(reserveCfg().capacity, 0)));
}

/** Saldo cadangan pemain (tersimpan permanen di meta). */
export function reserveBalance(meta) {
  return Math.max(0, Math.round(num(meta && meta.reserve, 0)));
}

/** Berapa kali cadangan masih boleh dipakai pada run ini. */
export function reserveUsesLeft(run) {
  const max = Math.max(0, Math.floor(num(reserveCfg().maxUsesPerRun, 0)));
  const used = Math.max(0, Math.floor(num(run && run.reserveUses, 0)));
  return Math.max(0, max - used);
}

/**
 * Tambah cadangan (dev grant / IAP mock / hadiah). Dibatasi kapasitas supaya
 * saldo tidak meluap tanpa batas.
 * @returns {number} yang benar-benar masuk
 */
export function grantReserve(meta, amount, source = 'dev') {
  const n = Math.max(0, Math.round(num(amount, 0)));
  if (!meta || n <= 0) return 0;
  const cap = reserveCapacity();
  const before = reserveBalance(meta);
  const after = cap > 0 ? Math.min(cap, before + n) : before + n;
  meta.reserve = after;
  return after - before;
}

/** Bantuan MAKSIMAL yang diizinkan untuk satu harga mutasi (IAP §15). */
export function maxAssistFor(cost) {
  const pct = num(reserveCfg().assistancePctOfMutationCost, 0.5);
  return Math.max(0, Math.floor(num(cost, 0) * Math.max(0, Math.min(1, pct))));
}

/**
 * Hitung bantuan cadangan untuk satu harga mutasi, TANPA mengubah apa pun.
 * @returns {{need:number, shortfall:number, cap:number, amount:number,
 *            usesLeft:number, reason:string}}
 *   `reason` kosong bila boleh dipakai; berisi alasan bila amount = 0.
 */
export function reserveAssistFor(run, meta, cost) {
  const harga = Math.max(0, Math.round(num(cost, 0)));
  const punya = runAntibody(run);
  const shortfall = Math.max(0, harga - punya);
  const cap = maxAssistFor(harga);
  const usesLeft = reserveUsesLeft(run);
  const saldo = reserveBalance(meta);
  let reason = '';
  if (!reserveEnabled()) reason = 'nonaktif';
  else if (shortfall <= 0) reason = 'cukup';
  else if (usesLeft <= 0) reason = 'habis-run';
  else if (saldo <= 0) reason = 'kosong';
  const amount = reason ? 0 : Math.max(0, Math.min(saldo, shortfall, cap));
  return { need: harga, shortfall, cap, amount, usesLeft, saldo, reason };
}

/**
 * Pakai cadangan untuk menutup kekurangan antibodi (maksimal X% harga,
 * maksimal N kali per run). Antibodi yang masuk tetap dicatat sebagai
 * antibody_earned(source: reserve) supaya jejak ekonomi lengkap.
 * @returns {number} antibodi yang didapat (0 bila tidak bisa)
 */
export function useReserve(run, meta, cost) {
  const hit = reserveAssistFor(run, meta, cost);
  if (hit.amount <= 0) return 0;
  meta.reserve = reserveBalance(meta) - hit.amount;
  run.reserveUses = Math.max(0, Math.floor(num(run.reserveUses, 0))) + 1;
  const masuk = earnAntibody(run, hit.amount, { source: 'reserve' });
  recordEconomyEvent('reserve_used', {
    amount: masuk,
    cost: hit.need,
    cap: hit.cap,
    reserveLeft: meta.reserve,
    usesLeft: reserveUsesLeft(run),
  });
  return masuk;
}
