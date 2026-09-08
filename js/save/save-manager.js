/**
 * save-manager.js — Persistensi progress permanen ke localStorage.
 * Seluruh data meta dalam format objek JSON murni (bisa di-serialize dengan
 * JSON.stringify / JSON.parse).
 */

const SAVE_KEY = 'imunverse.save.v1';

/** Cek ketersediaan localStorage (bisa gagal di private mode). */
export function isStorageAvailable() {
  try {
    const probe = '__imunverse_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch (err) {
    console.warn('[save-manager] localStorage tidak tersedia:', err);
    return false;
  }
}

/**
 * Muat save dari localStorage. Mengembalikan objek meta hasil merge dengan
 * default (agar save lama dari versi sebelumnya tetap valid), atau null
 * bila belum ada save.
 */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch (err) {
    console.error('[save-manager] gagal membaca save:', err);
    return null;
  }
}

/**
 * Simpan objek meta ke localStorage (JSON.stringify). Dipanggil otomatis
 * setiap perubahan penting: akhir run, pembelian, unlock, daily claim.
 * @returns {boolean} sukses atau tidak
 */
export function writeSave(meta) {
  try {
    meta.updatedAt = new Date().toISOString();
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
    return true;
  } catch (err) {
    console.error('[save-manager] gagal menyimpan save:', err);
    return false;
  }
}

/** Hapus seluruh save (dipakai tombol "Reset Save"). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (err) {
    console.error('[save-manager] gagal menghapus save:', err);
    return false;
  }
}
