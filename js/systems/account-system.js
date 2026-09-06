/**
 * account-system.js — AKUN USER (fondasi online).
 *
 * Alur: DAFTAR (pilih fraksi) / MASUK → sesi tersimpan di save. Identity
 * user mengikat: leaderboard (nama pemain), progres hero/level, dan yang
 * paling krusial PEMBELIAN (shop/IAP) — tanpa akun, transaksi ditolak.
 *
 * SERVER-READY: seluruh game memanggil API modul ini (signUp/login/logout/
 * hasAccount/getSession/requireAccount). Untuk mengganti backend lokal
 * menjadi server nyata, CUKUP ubah internal modul ini menjadi fetch() —
 * satu file, tanpa menyentuh UI/game.js (pola sama dengan monetization.js).
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { getData } from '../core/data-store.js';
import { emit } from '../core/ui-bridge.js';
import { screenManager } from '../ui/screen-manager.js';

const REGISTRY_KEY = 'imunverse.accounts.v1'; // daftar akun di perangkat (bukan sesi)

/** Registry akun perangkat: { [username]: {uid, username, auth, faction, createdAt} } */
function readRegistry() {
  try {
    return JSON.parse(window.localStorage.getItem(REGISTRY_KEY)) || {};
  } catch {
    return {};
  }
}

function writeRegistry(reg) {
  try {
    window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
  } catch (err) {
    console.warn('[account] registry tidak tersimpan:', err);
  }
}

const USERNAME_MIN = 3;
const USERNAME_MAX = 16;
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const PASSWORD_MIN = 4;

/** Hash lokal (bukan pengganti server hash — server nanti pakai bcrypt/argon2). */
export function hashPassword(username, password) {
  let h = 5381;
  const str = `${username}::${password}::imunverse`;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return 'h' + h.toString(36);
}

/** @returns {{ok:boolean, error?:string}} validasi nama akun. */
export function validateUsername(username) {
  if (!username || username.length < USERNAME_MIN) return { ok: false, error: `Nama minimal ${USERNAME_MIN} karakter` };
  if (username.length > USERNAME_MAX) return { ok: false, error: `Nama maksimal ${USERNAME_MAX} karakter` };
  if (!USERNAME_RE.test(username)) return { ok: false, error: 'Hanya huruf, angka, dan garis bawah' };
  return { ok: true };
}

export function validatePassword(password) {
  if (!password || password.length < PASSWORD_MIN) return { ok: false, error: `Sandi minimal ${PASSWORD_MIN} karakter` };
  return { ok: true };
}

/** Sudah ada sesi akun di save? */
export function hasAccount() {
  return !!(STATE.meta && STATE.meta.account && STATE.meta.account.uid);
}

/** Sesi aktif (atau null). */
export function getSession() {
  return STATE.meta && STATE.meta.account ? STATE.meta.account : null;
}

/** Fraksi sesi aktif (default imun). */
export function getFaction() {
  return (getSession() && getSession().faction) || 'imun';
}

/** Definisi fraksi dari data/factions.json. */
export function getFactionDef(factionId) {
  return getData().factions.factions.find((f) => f.id === factionId) || getData().factions.factions[0];
}

/** Fraksi mana yang bisa dimainkan sekarang (virus menyusul). */
export function isFactionPlayable(factionId) {
  const def = getFactionDef(factionId);
  return def.status === 'live';
}

/**
 * DAFTAR akun baru + pilih fraksi.
 * @returns {{ok:boolean, error?:string, account?:object}}
 */
export function signUp({ username, password, faction }) {
  const vU = validateUsername(username);
  if (!vU.ok) return vU;
  const vP = validatePassword(password);
  if (!vP.ok) return vP;
  if (!isFactionPlayable(faction)) {
    return { ok: false, error: `Fraksi ${getFactionDef(faction).name} belum dibuka — segera hadir!` };
  }
  if (hasAccount()) {
    return { ok: false, error: `Sedang masuk sebagai "${getSession().username}". Keluar dulu untuk membuat akun baru.` };
  }
  const registry = readRegistry();
  if (registry[username]) {
    return { ok: false, error: 'Nama itu sudah terdaftar di perangkat ini — gunakan tab MASUK.' };
  }
  const record = {
    uid: 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    username,
    auth: hashPassword(username, password), // hash lokal — server nanti pakai bcrypt/argon2
    faction,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  registry[username] = record;
  writeRegistry(registry);
  // Sesi aktif di save (tanpa hash) → progres, level & pembelian terikat user ini
  const session = { uid: record.uid, username: record.username, faction: record.faction, createdAt: record.createdAt };
  STATE.meta.account = session;
  writeSave(STATE.meta);
  return { ok: true, account: session };
}

/**
 * MASUK — cek kredensial akun yang tersimpan di perangkat ini.
 * (Dengan server nanti: fetch POST /login; di sini verifikasi lokal.)
 */
export function login(username, password) {
  const registry = readRegistry();
  const record = registry[username];
  if (!record) {
    return { ok: false, error: 'Akun tidak ditemukan di perangkat ini' };
  }
  if (record.auth !== hashPassword(username, password)) {
    return { ok: false, error: 'Sandi salah' };
  }
  const session = { uid: record.uid, username: record.username, faction: record.faction, createdAt: record.createdAt };
  STATE.meta.account = session;
  writeSave(STATE.meta);
  return { ok: true, account: session };
}

/** Keluar sesi — akun & data TETAP di registry; login untuk kembali. */
export function logout() {
  if (STATE.meta && STATE.meta.account) {
    STATE.meta.account = null;
    writeSave(STATE.meta);
  }
}

/** Ada akun terdaftar di perangkat ini? (untuk hint di layar auth) */
export function hasRegisteredAccount() {
  return Object.keys(readRegistry()).length > 0;
}

/** Daftar username terdaftar di perangkat (urut pendaftaran). */
export function getRegisteredUsernames() {
  return Object.keys(readRegistry());
}

/**
 * Penjaga transaksi: pembelian/leaderboard hanya boleh dengan akun.
 * @returns {boolean} true = boleh lanjut; false = sudah dialihkan ke auth.
 */
export function requireAccount(returnScreen = 'shop') {
  if (hasAccount()) return true;
  emit('toast', { message: 'Daftar/masuk dulu agar pembelian & rekor tersimpan ke akunmu', kind: 'gold' });
  screenManager.show('auth', { from: returnScreen });
  return false;
}
