/**
 * dashboard-screen.js — Dashboard UI-REBUILD P8 (permintaan owner) + P9
 * (peta anatomi tersambung, ala minimap MLBB — rombak workflow minimal).
 *
 * Prinsip baru: **dashboard BERSIH**.
 *   latar foto  +  PETA TUBUH (peta anatomi SATU JALUR tersambung, bab =
 *   node di posisi tubuhnya — bukan lagi carousel geser)  +  MAIN besar
 *   +  4 menu footer (Hero · Tas · Misi · Lab Genom).
 *
 * P9: node bab 'cleared' TETAP bisa diketuk lagi (jalan balik ke bab
 * bawah utk farm antibodi di level lebih rendah — permintaan owner),
 * persis seperti carousel lama, cuma sekarang keliatan sebagai peta
 * spasial bukan kartu geser. Posisi tiap node dari data/campaign.json
 * → chapters[].mapPos, digambar di atas siluet tubuh SVG statis
 * (index.html) yang viewBox-nya (0 0 300 520) sama dengan mapPos.
 *
 * Yang DICABUT (dulu memenuhi layar sebagai kartu/overlay animasi):
 *   panggung hero + canvas cinematic, kartu kampanye, kolom mode (endless/
 *   arena/lab), strip statistik, kartu harian/streak, kartu evolusi, kartu
 *   kondisi tubuh, banner strain, bar Siklus Mitosis, kartu kapsul, dan
 *   dock-sekunder. Nilainya tidak hilang:
 *    - bab & progres kampanye → PETA TUBUH,
 *    - misi & quest          → modal "Misi" (footer),
 *    - fitur sekunder        → menu "…" di topbar,
 *    - tombol MAIN dobel     → DICABUT, tinggal satu CTA di tengah.
 *
 * Semua data bab dibaca dari data/campaign.json (termasuk `art` = foto bab).
 */

import { STATE } from '../../core/state-manager.js';
import { getData, getHero } from '../../core/data-store.js';
import { writeSave } from '../../save/save-manager.js';
import { shouldShowInstallBanner, promptInstall, dismissInstallBanner } from '../../systems/pwa.js';
import {
  getMissionProgressList, getQuestProgress, acceptQuest, claimQuest,
  msUntilDailyReset, formatResetCountdown,
} from '../../systems/mission-system.js';
import { audio } from '../../systems/audio-system.js';
import { music } from '../../systems/music-system.js';
import { t as tr } from '../../systems/i18n.js';
import { markSeen } from '../../systems/codex-system.js';
import { masteryInfo } from '../../systems/mastery-system.js';
import { drainHeroNotices } from '../../systems/retention-system.js';
import { applyGateVisual } from '../../systems/feature-gate.js';
import { getSession } from '../../systems/account-system.js';
import { screenManager, el } from '../screen-manager.js';
import { currentChapterId, chapterStatus } from '../../systems/chapters.js';
import { emit } from '../../core/ui-bridge.js';
import { currentStrainId } from '../../systems/weekly-strain-system.js';
import { traitDisplayName } from '../../systems/enemy-mutation-system.js';

let chapterIndex = 0; // indeks bab TERPILIH (peta sekarang statis — semua node terlihat sekaligus, tak ada lagi "slide yang sedang di-scroll")

function chapters() {
  return getData().campaign.chapters;
}

// ---------------------------------------------------------------------
// PETA TUBUH — peta anatomi TERSAMBUNG satu jalur (ala minimap MLBB),
// menggantikan carousel geser lama. Node = bab, posisi dari
// data/campaign.json → chapters[].mapPos (viewBox SVG 0 0 300 520, sama
// dengan siluet tubuh statis di index.html). Jalur digambar sebagai
// segmen garis antar node berurutan; segmen ke bab terkunci meredup.
// Status locked/current/cleared TIDAK berubah dari sebelumnya (chapters.js)
// — bab 'cleared' tetap bisa diketuk lagi: itulah "jalan balik utk farm".
// ---------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

function statusBadgeText(status) {
  return status === 'cleared' ? 'BERSIH ✓' : status === 'current' ? 'AKTIF' : 'TERKUNCI';
}

function buildNode(ch, i, meta) {
  const status = chapterStatus(ch, meta);
  const selected = meta.selectedChapter === ch.id;
  const pos = ch.mapPos || { x: 150, y: 260 };
  const node = el('button', {
    class: `chap-node ${status}${selected ? ' selected' : ''}`,
    style: `left:${(pos.x / 300) * 100}%; top:${(pos.y / 520) * 100}%;`,
    'data-ch': ch.id,
    'aria-label': `Bab ${i + 1}: ${ch.title}${status === 'locked' ? ' (terkunci)' : ''}`,
    title: ch.title,
  }, [
    el('span', { class: 'chap-node-ring', 'aria-hidden': 'true' }),
    el('span', { class: 'chap-node-no', text: String(i + 1) }),
    status === 'cleared' ? el('img', { class: 'chap-node-badge', src: 'assets/icons/ui-star.svg', alt: '' }) : null,
    status === 'locked' ? el('img', { class: 'chap-node-badge', src: 'assets/icons/ui-lock.svg', alt: '' }) : null,
  ]);
  node.addEventListener('click', () => {
    if (status === 'locked') {
      audio.warn();
      emit('toast', { message: 'Bab ini terkunci — bersihkan bab sebelumnya dulu!', kind: 'warn' });
      return;
    }
    selectChapter(ch.id);
  });
  return node;
}

/** Gambar jalur (segmen garis) antar node berurutan di dalam SVG siluet.
 * `groupId` dipakai dua kali: sekali untuk preview dashboard, sekali untuk
 * peta penuh modal — dua <g> berbeda, isi identik. */
function buildPathSegments(list, meta, groupId = 'chapter-path-group') {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.textContent = '';
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i].mapPos;
    const b = list[i + 1].mapPos;
    if (!a || !b) continue;
    const reachable = chapterStatus(list[i + 1], meta) !== 'locked';
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', a.x);
    line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x);
    line.setAttribute('y2', b.y);
    line.setAttribute('class', `chapter-path-seg${reachable ? ' open' : ' locked'}`);
    group.appendChild(line);
  }
}

/** Isi satu host node (dashboard preview ATAU peta penuh modal) — dipanggil
 * dua kali dari renderMap() supaya keduanya selalu identik/sinkron, tanpa
 * peta penuh perlu me-render ulang sendiri saat dibuka (datanya sudah siap
 * di DOM begitu bab dipilih/pindah, modal cuma menampilkannya). */
function paintHost(list, meta, hostId, groupId) {
  const host = document.getElementById(hostId);
  if (!host) return;
  host.textContent = '';
  buildPathSegments(list, meta, groupId);
  list.forEach((ch, i) => host.appendChild(buildNode(ch, i, meta)));
}

/** Preview dashboard sengaja dipotong pendek (UI-audit: peta penuh di
 * dashboard "terlalu HTML", tak ada efek dramatis) — hanya jendela kecil
 * di sekitar bab AKTIF yang terlihat ("beberapa level saja"), kanvasnya
 * digeser vertikal (bukan di-scale) supaya posisi node tetap presisi 1:1
 * dengan mapPos yang sama dipakai peta penuh. Bab jauh dari titik ini
 * terpotong di luar frame — pemain ketuk untuk buka peta penuh. */
const PREVIEW_CANVAS_H = 480; // harus sama dengan --preview-canvas-h di CSS

function updatePreviewFocus(ch) {
  const viewport = document.getElementById('map-viewport');
  const canvas = document.getElementById('body-map-canvas');
  if (!viewport || !canvas || !ch) return;
  const pos = ch.mapPos || { x: 150, y: 260 };
  const focusYPx = (pos.y / 520) * PREVIEW_CANVAS_H;
  const vpHalf = viewport.clientHeight / 2;
  canvas.style.setProperty('--preview-pan', `${(vpHalf - focusYPx).toFixed(1)}px`);
}

function renderMap(meta) {
  const list = chapters();

  // Bab terpilih wajib valid (save lama / bab terkunci).
  const selId = list.some((c) => c.id === meta.selectedChapter)
    ? meta.selectedChapter
    : currentChapterId(meta);
  if (meta.selectedChapter !== selId) { meta.selectedChapter = selId; writeSave(meta); }
  const selIdx = Math.max(0, list.findIndex((c) => c.id === selId));
  chapterIndex = selIdx;

  paintHost(list, meta, 'chapter-nodes', 'chapter-path-group');
  paintHost(list, meta, 'chapter-nodes-full', 'chapter-path-group-full');

  updateMapChrome(meta, selIdx);
}

function updateMapChrome(meta, idx = chapterIndex) {
  const list = chapters();
  const pos = document.getElementById('map-pos');
  if (pos) pos.textContent = `BAB ${idx + 1}/${list.length}`;
  const posFull = document.getElementById('fullmap-pos');
  if (posFull) posFull.textContent = `BAB ${idx + 1}/${list.length}`;
  const prev = document.getElementById('map-prev');
  const next = document.getElementById('map-next');
  if (prev) prev.disabled = idx <= 0;
  if (next) next.disabled = idx >= list.length - 1;

  const ch = list[idx];
  if (!ch) return;
  const status = chapterStatus(ch, meta);
  const locked = status === 'locked';

  // Label di bawah tombol MAIN mengikuti bab yang terpilih di peta.
  const sub = document.getElementById('play-sub');
  if (sub) sub.textContent = locked ? `Bab ${idx + 1} · Terkunci` : `Bab ${idx + 1} · ${ch.organ}`;

  // Jendela preview dashboard mengikuti bab yang sedang dipilih.
  updatePreviewFocus(ch);

  // Kartu info bab terpilih — dirender ke DUA panel (preview dashboard +
  // peta penuh modal) supaya kontennya identik di mana pun dilihat.
  paintInfoPanel('chap-info-panel', list, idx, ch, status, locked);
  paintInfoPanel('chap-info-panel-full', list, idx, ch, status, locked);
}

function paintInfoPanel(panelId, list, idx, ch, status, locked) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.className = `chap-info-panel ${status}`;
  panel.textContent = '';
  panel.appendChild(el('img', { class: 'cip-art', src: ch.art || 'assets/ui/bg-dashboard.jpg', alt: '', draggable: 'false' }));
  const prevCh = list[idx - 1];
  panel.appendChild(el('div', { class: 'cip-body' }, [
    el('span', { class: `cip-status ${status}`, text: statusBadgeText(status) }),
    el('b', { class: 'cip-title', text: `BAB ${idx + 1} · ${ch.title}` }),
    el('span', { class: 'cip-organ', text: `${ch.organ} · ${ch.mapTag || ''}` }),
    locked
      ? el('span', { class: 'cip-lock', text: `🔒 Selesaikan dulu: BAB ${idx} — ${prevCh ? prevCh.title : ''}` })
      : el('span', { class: 'cip-obj', text: ch.objective || '' }),
  ]));
}

/** Validasi sebelum MAIN: bab terkunci → peringatan, jangan mulai run. */
export function canPlaySelected() {
  const list = chapters();
  const meta = STATE.meta;
  const ch = list.find((c) => c.id === meta.selectedChapter) || list[0];
  if (!ch) return false;
  if (chapterStatus(ch, meta) === 'locked') {
    audio.warn();
    emit('toast', { message: 'Bab ini terkunci — bersihkan bab sebelumnya dulu!', kind: 'warn' });
    return false;
  }
  return true;
}

/** Pilih bab: ketuk node di peta ATAU panah ‹ › — SATU jalur (tak ada lagi
 * "commit" terpisah, memilih langsung menyimpan meta.selectedChapter). */
function selectChapter(chId) {
  const meta = STATE.meta;
  const ch = chapters().find((c) => c.id === chId);
  if (!ch) return;
  if (chapterStatus(ch, meta) === 'locked') {
    audio.warn();
    emit('toast', { message: 'Bab ini terkunci — bersihkan bab sebelumnya dulu!', kind: 'warn' });
    return;
  }
  meta.selectedChapter = chId;
  markSeen(chId); // Bio-Pedia: organ ditemui di Peta Tubuh
  writeSave(meta);
  audio.ui();
  renderMap(meta);
}

/** Pindah bab terpilih satu langkah menurut urutan cerita (panah ‹ ›) —
 * fallback aksesibilitas untuk keyboard/non-sentuh; peta sendiri dipilih
 * langsung via tap node di posisi anatominya. */
function step(dir) {
  const list = chapters();
  const idx = Math.max(0, Math.min(list.length - 1, chapterIndex + dir));
  const ch = list[idx];
  if (ch) selectChapter(ch.id);
}

// ---------------------------------------------------------------------
// MISI — badge di footer + modal
// ---------------------------------------------------------------------

function claimableCount(meta) {
  let n = 0;
  try {
    for (const q0 of getQuestProgress(meta)) {
      if (!q0.accepted && !q0.claimed) acceptQuest(meta, q0.def.id);
    }
    n += getQuestProgress(meta).filter((q) => q.done && !q.claimed).length;
    n += getMissionProgressList(meta).filter((m) => m.done && !m.claimed).length;
  } catch { /* meta belum siap */ }
  return n;
}

function updateMissionBadge() {
  const badge = document.getElementById('badge-missions');
  if (!badge) return;
  const n = claimableCount(STATE.meta);
  badge.textContent = String(n);
  badge.classList.toggle('hidden', n === 0);
}

// ---------------------------------------------------------------------
// Topbar, gerbang menu, floating notices
// ---------------------------------------------------------------------

function renderTopbar(meta) {
  const cur = document.getElementById('dash-currency');
  if (cur) cur.textContent = (meta.currency || 0).toLocaleString('id-ID');
  // Kartu atas #1: mastery hero yang sedang dipakai — satu-satunya "level"
  // yang tersisa sekarang bahwa sistem hero-upgrade/pasukan berbayar dicabut;
  // murni didapat dari bermain (kills/runs/wins), bukan dibeli.
  const lv = document.getElementById('card-level-val');
  if (lv) lv.textContent = 'Lv ' + masteryInfo(meta, meta.selectedHero).level;

  const session = getSession();
  const chip = document.getElementById('account-chip');
  if (chip) {
    if (session) {
      chip.classList.remove('hidden');
      chip.querySelector('#account-name').textContent = session.username;
    } else {
      chip.classList.add('hidden');
    }
  }

  // V2: chip pangkat DIHAPUS (bukan sekadar disembunyikan) — pangkat bukan
  // progresi V2; tujuan pemain adalah mutasi berikutnya (IAP §24).
  document.getElementById('rank-chip')?.remove();
}

function applyGates() {
  // UI-audit: dock 4 menu dicabut — nav yang sama (Hero/Bio-Pedia/Misi/Profil)
  // sekarang tinggal di menu sekunder "…" (#dash-more-menu). Gate 'dock' di
  // data/features.json dipertahankan apa adanya, hanya elemen targetnya pindah.
  document.querySelectorAll('#dash-more-menu button[data-nav]').forEach((b) => {
    applyGateVisual(b, 'dock', b.dataset.nav);
  });
}

/** Notis mengambang (bukan kartu): PWA install & strain mingguan. */
function renderFloaters(meta) {
  document.getElementById('dash-float')?.remove();
  const wrap = el('div', { id: 'dash-float', class: 'dash-float' });

  if (shouldShowInstallBanner(meta)) {
    wrap.appendChild(el('button', {
      class: 'float-pill install',
      onclick: async () => {
        const ok = await promptInstall();
        if (ok) { dismissInstallBanner(STATE.meta); renderFloaters(STATE.meta); }
      },
    }, [
      el('img', { src: 'assets/icons/pwa-192.png', alt: '' }),
      el('b', { text: 'Pasang PHAGOS' }),
      el('span', { text: 'Main offline, buka lebih cepat' }),
    ]));
  }

  try {
    const strain = currentStrainId();
    if (strain) {
      wrap.appendChild(el('div', { class: 'float-pill strain' }, [
        el('b', { text: 'STRAIN MINGGUAN' }),
        el('span', { text: traitDisplayName(strain) || strain }),
      ]));
    }
  } catch { /* abaikan */ }

  if (wrap.children.length > 0) document.getElementById('screen-dashboard').appendChild(wrap);
}

/** Fase 17 (trigger 1B): overlay perayaan HERO BARU — potret + partikel bintang. */
function showHeroNotice() {
  const heroes = drainHeroNotices();
  if (!heroes.length) return;
  let layer = document.getElementById('hero-notice');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'hero-notice';
    document.body.appendChild(layer);
  }
  const h = heroes[heroes.length - 1];
  layer.className = 'show';
  layer.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'hn-box';
  box.innerHTML = `
    <div class="hn-stars"></div>
    <img class="hn-sprite" src="${h.spritePortrait || h.spriteIdle}" alt="${h.name}" />
    <div class="hn-kicker">HERO BARU!</div>
    <b class="hn-name">${h.name}</b>
    <span class="hn-title">${h.title || ''}</span>`;
  layer.appendChild(box);
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.className = 'hn-star';
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 260}px`);
    s.style.setProperty('--dy', `${(Math.random() - 0.5) * 200}px`);
    s.style.animationDelay = `${Math.random() * 0.5}s`;
    box.querySelector('.hn-stars').appendChild(s);
  }
  clearTimeout(showHeroNotice._t);
  showHeroNotice._t = setTimeout(() => { layer.className = ''; }, 3200);
}

// ---------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------

export function show() {
  showHeroNotice();

  const meta = STATE.meta;
  // Bio-Pedia: peta tubuh selalu menampilkan 5 sistem → tandai sudah ditemui.
  for (const sid of ['sirkulasi', 'pencernaan', 'saraf', 'imun', 'limfatik']) markSeen(sid);

  renderTopbar(meta);
  applyGates();
  renderMap(meta);
  updateMissionBadge();
  renderFloaters(meta);

  // AUDIO: trek menu menyambung di dashboard (MP3 CC0, fallback chiptune).
  try { music.setTrack('menu'); music.start(); } catch { /* abaikan */ }

  bindOnce();
}

let bound = false;
function bindOnce() {
  if (bound) return;
  bound = true;
  document.getElementById('map-prev')?.addEventListener('click', () => step(-1));
  document.getElementById('map-next')?.addEventListener('click', () => step(1));

  // Menu "…" (fitur sekunder yang dulu jadi kartu).
  const moreBtn = document.getElementById('btn-dash-more');
  const moreMenu = document.getElementById('dash-more-menu');
  const closeMore = () => {
    moreMenu?.classList.add('hidden');
    moreBtn?.setAttribute('aria-expanded', 'false');
  };
  moreBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = moreMenu?.classList.toggle('hidden') === false;
    moreBtn.setAttribute('aria-expanded', String(open));
    audio.ui();
  });
  // Navigasi ditangani handler global [data-nav] di main.js (sekali klik,
  // satu tujuan) — di sini hanya menutup menu & memberi bunyi klik.
  moreMenu?.querySelectorAll('[data-nav]').forEach((b) => {
    b.addEventListener('click', () => { audio.ui(); closeMore(); });
  });
  document.addEventListener('click', (e) => {
    if (!moreMenu || moreMenu.classList.contains('hidden')) return;
    if (!moreMenu.contains(e.target) && e.target !== moreBtn) closeMore();
  });

  // Footer "Misi" → modal Misi & Quest.
  document.getElementById('dock-missions')?.addEventListener('click', () => {
    audio.ui();
    screenManager.show('missions');
  });

  // Geser bab dengan tombol panah kiri/kanan saat dashboard aktif.
  document.addEventListener('keydown', (e) => {
    if (screenManager.getCurrentId() !== 'dashboard') return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
}

export function hide() {
  document.getElementById('dash-more-menu')?.classList.add('hidden');
}
