/**
 * comeback-modal.js — Fase 1.3 retensi v2.0 (13 Sep 2026)
 *
 * SATU modal untuk seluruh hasil pass comeback: hari streak, hadiah streak,
 * hadiah kembali, dan pernyataan bahwa kondisi tubuh sudah dipulihkan.
 * Brief §1.3: "Satu modal, bukan tiga."
 *
 * Sengaja memakai kelas CSS yang sudah ada (.pay-modal / .pay-box /
 * .pay-summary / .pay-granted / .pg-item / .pay-cancel) sehingga tidak menambah
 * CSS baru dan tidak punya gaya yang menyimpang dari modal pembayaran.
 *
 * Non-blocking: modal hanya ditawarkan saat dashboard dibuka, dan satu klik
 * menutupnya. Tidak pernah muncul di dalam run.
 *
 * Alur: main.js:boot() → runComebackPass() → hasil disimpan di
 * STATE.pendingComeback → dashboard-screen.show() → showComebackModal().
 * Modul js/systems/comeback-system.js tetap murni (tidak menyentuh DOM);
 * tampilan adalah tugas modul ini.
 */

import { el } from './screen-manager.js';
import { STATE } from '../core/state-manager.js';
import { t } from '../systems/i18n.js';

/** Apakah ada hasil pass comeback yang belum ditampilkan? */
export function hasPendingComeback() {
  return !!STATE.pendingComeback;
}

/** Ringkasan hadiah yang benar-benar diberikan, sebagai chip. */
function grantedChips(granted) {
  const chips = [];
  if (granted.currency) chips.push(`+${granted.currency.toLocaleString('id-ID')} ${t('Antibodi')}`);
  if (granted.imun) chips.push(`+${granted.imun} Imun`);
  for (const [id, qty] of Object.entries(granted.consumables || {})) {
    chips.push(`${qty}× ${id.replace(/_/g, ' ')}`);
  }
  return chips;
}

/**
 * Tampilkan modal comeback sekali, lalu bersihkan penandanya.
 * @returns {boolean} true bila modal benar-benar ditampilkan
 */
export function showComebackModal() {
  const cb = STATE.pendingComeback;
  if (!cb) return false;
  STATE.pendingComeback = null; // sekali tampil — jangan diulang saat dashboard dirender ulang

  const rows = [];

  // 1) Streak harian (+ penanda hari pengampunan bila streak hampir putus)
  if (cb.streak && cb.streak.advanced) {
    rows.push(el('span', { text: `${t('Streak harian')}: ${t('Hari ke-')}${cb.streak.day}` }));
  }

  // 2) Peluruhan tubuh yang dibatasi — ini inti perbaikannya
  if (cb.rawDecayDays > cb.decayDays) {
    rows.push(el('span', {
      text: `${t('Peluruhan tubuh dibatasi')}: ${cb.rawDecayDays} ${t('hari absen dihitung sebagai')} ${cb.decayDays} ${t('hari')}`,
    }));
  }

  // 3) Hadiah kembali (absen ≥ 3 hari)
  if (cb.returnGift) {
    rows.push(el('span', { text: `${t('Kamu absen')} ${cb.daysAway} ${t('hari')} — ${t('ini hadiah kembalimu')}` }));
  }

  // 4) Pemulihan tubuh
  if (cb.granted && cb.granted.bodyRestored) {
    rows.push(el('b', { text: t('Kondisi tubuh dipulihkan ke 100%') }));
  }

  const chips = grantedChips(cb.granted || {});

  const layer = el('div', { class: 'pay-modal', id: 'comeback-modal' }, [
    el('div', { class: 'pay-box' }, [
      el('h3', { class: 'pay-title', text: cb.returnGift ? t('SELAMAT DATANG KEMBALI!') : t('STREAK HARIAN') }),
      el('div', { class: 'pay-summary' }, rows),
      chips.length
        ? el('div', { class: 'pay-granted' }, chips.map((c) => el('span', { class: 'pg-item', text: c })))
        : null,
      el('button', { class: 'btn btn-primary', text: t('MULAI') }),
      el('button', { class: 'pay-cancel', text: t('Tutup') }),
    ]),
  ]);

  const close = () => layer.remove();
  layer.querySelectorAll('button').forEach((b) => b.addEventListener('click', close));

  document.body.appendChild(layer);
  return true;
}
