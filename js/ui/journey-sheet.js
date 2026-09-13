/**
 * journey-sheet.js — §6 Navigasi (BUILD 59a): SATU sheet "Perjalanan".
 *
 * Menggantikan empat sistem navigasi lama: sidebar (dihapus), quick row
 * (dihapus), secondary dock (dihapus), dan DUA menu HUD F25 (dilebur).
 * Dibuka dari dua tempat dengan sheet yang SAMA:
 *   • dashboard → dock permanen 5 slot, slot ke-5 "Perjalanan"
 *   • HUD saat run → tombol bulat tunggal (id hud-journey-toggle)
 *
 * Gerbang destinasi fail-closed lewat journeyGate() (feature-gate.js ←
 * data/features.json): item terkunci TIDAK dirender (progressive disclosure,
 * R1). Dari HUD, memilih destinasi mem-pause run + menghentikan musik —
 * persis perilaku openHudMenuScreen() lama.
 */

import { screenManager, el } from './screen-manager.js';
import { journeyGate } from '../systems/feature-gate.js';
import { markSeen, renderBadges } from '../systems/unlock-badge-system.js';
import { game } from '../core/game.js';
import { music } from '../systems/music-system.js';

/** Destinasi + tampilan (ikon set menu-*.svg yang sudah ada; label ada di lang.json). */
const DESTINATIONS = [
  { id: 'campaign', icon: 'assets/icons/menu-campaign.svg', label: 'Peta Tubuh' },
  { id: 'rank', icon: 'assets/icons/menu-rank.svg', label: 'Pangkat' },
  { id: 'codex', icon: 'assets/icons/menu-codex.svg', label: 'Bio-Pedia' },
  { id: 'bp', icon: 'assets/icons/menu-pass.svg', label: 'Battle Pass' },
  { id: 'roster', icon: 'assets/icons/menu-heroes.svg', label: 'Heroes' },
  { id: 'arena', icon: 'assets/icons/menu-battle.svg', label: 'Arena' },
  { id: 'upgrade', icon: 'assets/icons/menu-squad.svg', label: 'Lab Pasukan' },
  { id: 'shop', icon: 'assets/icons/menu-shop.svg', label: 'Shop' },
  { id: 'bag', icon: 'assets/icons/sec-item.svg', label: 'Tas' },
];

let openedFromRun = false;

function sheetEls() {
  return {
    backdrop: document.getElementById('journey-backdrop'),
    sheet: document.getElementById('journey-sheet'),
    list: document.getElementById('journey-list'),
    toggle: document.getElementById('hud-journey-toggle'),
  };
}

/** Render isi sheet: hanya destinasi yang gerbangnya TERBUKA (fail-closed). */
export function renderJourneyList() {
  const { list } = sheetEls();
  if (!list) return 0;
  list.textContent = '';
  let open = 0;
  for (const d of DESTINATIONS) {
    const gate = journeyGate(d.id);
    if (gate.locked) continue; // disclosure: yang terkunci tidak dipajang
    open += 1;
    const btn = el('button', { class: 'journey-item', type: 'button', 'data-journey': d.id }, [
      el('span', { class: 'ji-ico' }, [el('img', { src: d.icon, alt: '' })]),
      el('span', { class: 'ji-label', text: d.label }),
    ]);
    btn.addEventListener('click', () => {
      closeJourneySheet();
      // Perilaku menu HUD lama dipertahankan: keluar arena = pause + musik stop.
      if (openedFromRun && game.run && !game.run.ended) {
        game.pause();
        music.stop();
      }
      screenManager.show(d.id);
    });
    list.appendChild(btn);
  }
  return open;
}

export function openJourneySheet(fromRun) {
  const { backdrop, sheet, toggle } = sheetEls();
  if (!sheet) return;
  openedFromRun = !!fromRun;
  renderJourneyList();
  sheet.classList.remove('hidden');
  backdrop?.classList.remove('hidden');
  toggle?.setAttribute('aria-expanded', 'true');
  // F25 dipertahankan: membuka sheet = unlock baru dianggap sudah dilihat.
  markSeen('journey');
  renderBadges();
}

export function closeJourneySheet() {
  const { backdrop, sheet, toggle } = sheetEls();
  if (!sheet) return;
  sheet.classList.add('hidden');
  backdrop?.classList.add('hidden');
  toggle?.setAttribute('aria-expanded', 'false');
}

export function isJourneySheetOpen() {
  const { sheet } = sheetEls();
  return !!sheet && !sheet.classList.contains('hidden');
}

/** Pasang semua listener (sekali saat boot, dari main.js). */
export function wireJourneySheet() {
  const { backdrop } = sheetEls();
  document.getElementById('journey-close')?.addEventListener('click', closeJourneySheet);
  backdrop?.addEventListener('click', closeJourneySheet);
  // Dashboard: dock slot ke-5.
  document.getElementById('btn-journey')?.addEventListener('click', () => openJourneySheet(false));
  // HUD: satu tombol toggle (buka/tutup).
  document.getElementById('hud-journey-toggle')?.addEventListener('click', () => {
    if (isJourneySheetOpen()) closeJourneySheet();
    else openJourneySheet(true);
  });
  // Layar berpindah (back kontekstual, runstart, dll.) → sheet ditutup oleh
  // screen-manager.show() lewat window.__IMUNVERSE_closeJourneySheet.
  window.__IMUNVERSE_closeJourneySheet = closeJourneySheet;
}
