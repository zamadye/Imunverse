/**
 * reset-countdown.js — Fase 2.5: chip hitung mundur reset harian.
 *
 * SATU helper UI untuk tiga surface yang didaftarkan data
 * (retention-config.json → dailyAnchor.countdownSurfaces):
 *   • "dashboard"          → daftar misi dashboard
 *   • "gameover"           → kartu ringkasan akhir run
 *   • "hud-mission-panel"  → panel "Misi" di HUD arena
 *
 * Angka & ambang "segera" (< warnWhenHoursLeft jam → kelas .urgent) semuanya
 * dari daily-reset.js (data). Satu interval 1 detik bersama untuk semua chip
 * yang ter-mount; interval mati otomatis saat chip terakhir di-unmount.
 */

import { el } from './screen-manager.js';
import { t } from '../systems/i18n.js';
import { getDailyResetInfo } from '../systems/daily-reset.js';

/** Chip aktif → Set; ticker bersama dibuat malas dan dibersihkan saat kosong. */
const mounted = new Set();
let ticker = null;

function paint(chip) {
  if (!chip.isConnected) { mounted.delete(chip); return; } // container dibersihkan pemilik screen
  const info = getDailyResetInfo();
  chip.classList.toggle('urgent', info.urgent);
  const timeNode = chip.querySelector('.rc-time');
  if (timeNode) timeNode.textContent = info.hms;
  const utc = new Date(info.resetTs).toLocaleTimeString('id-ID', {
    timeZone: 'UTC', hour: '2-digit', minute: '2-digit',
  });
  chip.title = `${t('Reset harian pada')} ${utc} UTC`;
}

function ensureTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    for (const chip of [...mounted]) paint(chip);
    if (mounted.size === 0 && ticker) { clearInterval(ticker); ticker = null; }
  }, 1000);
}

/**
 * Pasang chip hitung mundur di `container` untuk surface terdaftar.
 * Bila data mematikan countdown (showCountdown:false) atau surface tidak
 * terdaftar → tidak memasang apa pun (return null).
 */
export function mountResetCountdown(container, surface) {
  if (!container) return null;
  const info = getDailyResetInfo();
  if (!info.showCountdown || !info.surfaces.includes(surface)) return null;
  const chip = el('div', {
    class: 'reset-count' + (info.urgent ? ' urgent' : ''),
    role: 'timer',
    'aria-label': `${t('Reset harian dalam')} ${info.hms}`,
  }, [
    el('span', { class: 'rc-label', text: t('Reset harian') }),
    el('b', { class: 'rc-time', text: info.hms }),
  ]);
  paint(chip);
  container.appendChild(chip);
  mounted.add(chip);
  ensureTicker();
  return chip;
}

/** Lepas chip (dipanggil hide()/re-render screen) + matikan ticker bila kosong. */
export function unmountResetCountdown(chip) {
  if (!chip) return;
  mounted.delete(chip);
  if (mounted.size === 0 && ticker) { clearInterval(ticker); ticker = null; }
  if (chip.isConnected) chip.remove();
}
