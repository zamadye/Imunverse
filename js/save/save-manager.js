/**
 * save-manager.js — Persistensi progress permanen ke localStorage.
 * Seluruh data meta dalam format objek JSON murni (bisa di-serialize dengan
 * JSON.stringify / JSON.parse).
 *
 * PHAGOS rebrand: key baru `phagos.save.v1` + migrasi sekali dari key lama
 * `imunverse.save.v1` (pemain lama tidak kehilangan save).
 */

const SAVE_KEY = 'phagos.save.v1';
const LEGACY_KEYS = ['imunverse.save.v1'];

/** Cek ketersediaan localStorage (bisa gagal di private mode). */
export function isStorageAvailable() {
  try {
    const probe = '__phagos_probe__';
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
 *
 * Migrasi PHAGOS: jika key baru kosong tapi key lama berisi data → salin
 * sekali ke key baru lalu lanjutkan dari key baru.
 */
export function loadSave() {
  try {
    let raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      for (const legacy of LEGACY_KEYS) {
        const old = window.localStorage.getItem(legacy);
        if (old) {
          try {
            const parsed = JSON.parse(old);
            if (parsed && typeof parsed === 'object') {
              window.localStorage.setItem(SAVE_KEY, old);
              console.info(`[save-manager] migrasi save ${legacy} → ${SAVE_KEY}`);
              raw = old;
              break;
            }
          } catch { /* save lama korup — abaikan */ }
        }
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    migrateConsumableIds(parsed); // Sprint 3.18: ID lama → ID bible §7
    return parsed;
  } catch (err) {
    console.error('[save-manager] gagal membaca save:', err);
    return null;
  }
}

/**
 * Sprint 3.18 — migrasi sekali jalan ID consumable lama → ID bible §7.
 * Stok lama dipindah (dijumlah bila kedua ada), kunci lama dihapus.
 */
export function migrateConsumableIds(meta) {
  if (!meta || !meta.consumables) return meta;
  const map = {
    serum_awal: 'serum_regenerasi', vaksin_awal: 'enzim_litik',
    kopi_limfa: 'sitokin_burst', pelindung_lendir: 'lapisan_mukus',
    koin_ganda: 'katalis_mitosis',
  };
  for (const [oldId, newId] of Object.entries(map)) {
    if (meta.consumables[oldId] > 0) {
      meta.consumables[newId] = (meta.consumables[newId] || 0) + meta.consumables[oldId];
      delete meta.consumables[oldId];
    }
  }
  return meta;
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
    for (const legacy of LEGACY_KEYS) window.localStorage.removeItem(legacy);
    return true;
  } catch (err) {
    console.error('[save-manager] gagal menghapus save:', err);
    return false;
  }
}
