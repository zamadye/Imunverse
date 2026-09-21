/**
 * reset-scaffold.js — PERANCAH SEMENTARA UI-RESET (2026-09-21).
 *
 * Konteks: owner mencabut SELURUH aset visual (269 file / ~64 MB) untuk reset
 * UI/UX total — lihat `docs/UI-UX-RESET-AUDIT.md` §4 opsi B. Yang tersisa di
 * `assets/` hanya audio (34) + ikon PWA (3) + 2 README.
 *
 * Masalah yang diselesaikan: markup `index.html` dan belasan modul UI masih
 * menyuntik `<img src="assets/...">` yang sekarang 404. Tanpa penanganan,
 * setiap layar jadi tembok ikon "broken image" — UI baru tidak bisa dievaluasi
 * maupun di-iterasi. Modul ini menandai `<img>` yang gagal dimuat dengan kelas
 * `.asset-missing` supaya CSS menyembunyikannya. Ini BUKAN penambal visual —
 * keadaan "kosong" memang yang diinginkan owner.
 *
 * Pembagian tugas dengan skrip inline di `<head>` index.html:
 *   inline  → pasang penangkap error paling awal + sapu gambar markup
 *   modul   → pantau `<img>` yang dibuat DINAMIS oleh modul UI + ringkasan dev
 *
 * Yang TIDAK disentuh: sprite canvas. `js/render/sprite-loader.js` sudah punya
 * fallback sendiri (placeholder LOUD di dev, kotak abu netral di production)
 * dan itu alat yang benar untuk sisi canvas.
 *
 * HAPUS modul ini + skrip inline-nya + aturan CSS `.asset-missing` begitu
 * UI/UX baru dan asetnya masuk.
 */

/** Apakah sebuah <img> sudah selesai dimuat tapi gagal (0 px lebar alami)? */
function isBroken(img) {
  return img.complete && img.naturalWidth === 0;
}

/** Tandai gambar rusak. Idempoten — aman dipanggil berulang. */
export function markMissing(img) {
  if (img && img.tagName === 'IMG' && !img.classList.contains('asset-missing')) {
    img.classList.add('asset-missing');
    return true;
  }
  return false;
}

/**
 * Pantau subtree DOM untuk `<img>` baru hasil render modul UI (roster, codex,
 * shop, missions, levelup, dsb. semuanya membangun HTML lewat innerHTML).
 * Idempoten.
 */
export function initResetScaffold(doc = document) {
  if (doc.__phagosResetScaffoldWatch) return;
  doc.__phagosResetScaffoldWatch = true;

  const arm = (img) => {
    if (isBroken(img)) markMissing(img);
    else img.addEventListener('error', () => markMissing(img), { once: true });
  };

  const mo = new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'IMG') arm(node);
        if (node.querySelectorAll) node.querySelectorAll('img').forEach(arm);
      }
    }
  });
  mo.observe(doc.documentElement, { childList: true, subtree: true });

  // Sapu sekali untuk gambar yang sudah ada sebelum modul ini termuat.
  doc.querySelectorAll('img').forEach(arm);
}

/**
 * Inventaris aset visual yang hilang — untuk laporan console di dev mode.
 * Menunjukkan lubang mana yang harus diisi UI baru. Bukan logika game.
 * @returns {{count:number, uniquePaths:string[]}}
 */
export function resetScaffoldSummary(doc = document) {
  const paths = new Set();
  doc.querySelectorAll('img.asset-missing').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (src) paths.add(src.split('?')[0]);
  });
  return { count: doc.querySelectorAll('img.asset-missing').length, uniquePaths: [...paths].sort() };
}
