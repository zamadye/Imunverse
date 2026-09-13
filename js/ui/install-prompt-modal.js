/**
 * install-prompt-modal.js — Fase 2.6: penawaran pasang PWA, SEKALI, bisa
 * ditolak permanen (brief §2.6).
 *
 * Muncul hanya dari dashboard (tidak pernah di dalam run — anti-pattern repo),
 * setelah run ke-3, dan hanya bila pwa-system.shouldPromptInstall() mengizinkan.
 * Memakai kelas CSS yang sudah ada (.pay-modal/.pay-box) → nol CSS baru.
 *
 * Dua jalur:
 *   • browser dengan beforeinstallprompt (Android/Chrome/desktop) → tombol
 *     PASANG memicu prompt native
 *   • iOS (tanpa beforeinstallprompt) → petunjuk manual "Bagikan → Tambahkan
 *     ke Layar Utama", karena hanya itu cara memasang PWA di iOS — dan justru
 *     iOS yang paling membutuhkannya (penghapusan penyimpanan 7 hari WebKit).
 */

import { el } from './screen-manager.js';
import { t } from '../systems/i18n.js';
import {
  markPrompted, markDeclined, markInstalled, promptInstallNative,
} from '../systems/pwa-system.js';
import { audio } from '../systems/audio-system.js';
import { emit } from '../core/ui-bridge.js';

/**
 * @param {Object} meta       state pemain
 * @param {{ios?:boolean}} dec keputusan dari shouldPromptInstall()
 */
export function showInstallPromptModal(meta, dec = {}) {
  markPrompted(meta); // sekali — ditandai sebelum keputusan pemain

  const lines = dec.ios
    ? [
        t('Imunverse bisa dipasang seperti aplikasi, dan versi terpasang TIDAK dihapus Safari setelah 7 hari tidak dipakai.'),
        t('Cara pasang di iPhone/iPad: buka menu Bagikan (ikon kotak berpanah), lalu pilih "Tambahkan ke Layar Utama".'),
      ]
    : [
        t('Imunverse bisa dipasang seperti aplikasi: ikon di layar utama, layar penuh, dan tetap bisa dimainkan tanpa jaringan.'),
        t('Versi terpasang juga melindungi progresmu dari pembersihan penyimpanan browser.'),
      ];

  const layer = el('div', { class: 'pay-modal', id: 'install-prompt-modal' }, [
    el('div', { class: 'pay-box' }, [
      el('h3', { class: 'pay-title', text: t('PASANG DI PERANGKAT?') }),
      el('div', { class: 'pay-summary' }, lines.map((s) => el('span', { text: s }))),
      dec.ios
        ? null
        : el('button', { class: 'btn btn-primary', text: t('PASANG SEKARANG') }),
      el('button', { class: 'pay-cancel', text: t('NANTI SAJA — JANGAN TANYAKAN LAGI') }),
    ]),
  ]);

  const close = () => layer.remove();

  const decline = () => {
    markDeclined(meta);
    close();
  };

  if (!dec.ios) {
    const yes = layer.querySelector('.btn-primary');
    yes.addEventListener('click', async () => {
      yes.disabled = true;
      const res = await promptInstallNative();
      if (res.ok) {
        markInstalled(meta);
        audio.collect();
        emit('toast', { message: t('Imunverse terpasang di perangkatmu!'), kind: 'gold' });
      } else {
        emit('toast', { message: t('Pemasangan dibatalkan.'), kind: 'coral' });
      }
      close();
    });
  }

  layer.querySelector('.pay-cancel').addEventListener('click', decline);
  // Menutup lewat klik latar juga dihitung penolakan permanen (sekali ditawarkan).
  layer.addEventListener('click', (e) => { if (e.target === layer) decline(); });

  document.body.appendChild(layer);
  return true;
}
