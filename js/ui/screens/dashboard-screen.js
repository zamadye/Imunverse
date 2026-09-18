/**
 * dashboard-screen.js — Dashboard UI-REBUILD P8 (permintaan owner).
 *
 * Prinsip baru: **dashboard BERSIH**.
 *   latar foto  +  PETA TUBUH (slideshow bab, geser kiri/kanan)  +  MAIN besar
 *   +  4 menu footer (Hero · Tas · Misi · Lab Genom).
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
import { drainHeroNotices } from '../../systems/retention-system.js';
import { applyGateVisual } from '../../systems/feature-gate.js';
import { getSession } from '../../systems/account-system.js';
import { screenManager, el } from '../screen-manager.js';
import { currentChapterId, chapterStatus } from '../../systems/chapters.js';
import { emit } from '../../core/ui-bridge.js';
import { currentStrainId } from '../../systems/weekly-strain-system.js';
import { traitDisplayName } from '../../systems/enemy-mutation-system.js';

let chapterIndex = 0; // indeks slide aktif (bukan selalu = bab terpilih)

function chapters() {
  return getData().campaign.chapters;
}

// ---------------------------------------------------------------------
// PETA TUBUH — slideshow bab
// ---------------------------------------------------------------------

function buildSlide(ch, i, meta) {
  const status = chapterStatus(ch, meta);
  const list = chapters();
  const slide = el('article', {
    class: `chap-slide ${status}${meta.selectedChapter === ch.id ? ' selected' : ''}`,
    'data-ch': ch.id,
    'data-i': String(i),
    role: 'button',
    tabindex: status === 'locked' ? '-1' : '0',
    'aria-label': `Bab ${i + 1}: ${ch.title}`,
  });

  slide.appendChild(el('img', {
    class: 'chap-art',
    src: ch.art || 'assets/ui/bg-dashboard.jpg',
    alt: '',
    draggable: 'false',
    loading: i > 1 ? 'lazy' : 'eager',
  }));

  const badge = status === 'cleared' ? 'BERSIH ✓'
    : status === 'current' ? 'AKTIF'
      : 'TERKUNCI 🔒';
  slide.appendChild(el('span', { class: `chap-status ${status}`, text: badge }));

  slide.appendChild(el('div', { class: 'chap-info' }, [
    el('span', { class: 'chap-no', text: `BAB ${i + 1}` }),
    el('b', { class: 'chap-title', text: ch.title }),
    el('span', { class: 'chap-organ', text: `${ch.organ} · ${ch.mapTag || ''}` }),
    el('span', { class: 'chap-obj', text: ch.objective || '' }),
  ]));

  if (status === 'locked') {
    const prev = list[i - 1];
    slide.appendChild(el('div', { class: 'chap-lock' }, [
      el('span', { text: '🔒 SELESAIKAN DULU' }),
      el('span', { text: prev ? `BAB ${i}: ${prev.title}` : '' }),
    ]));
  }

  if (status !== 'locked') {
    slide.addEventListener('click', () => selectChapter(ch.id));
    slide.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectChapter(ch.id); }
    });
  } else {
    slide.addEventListener('click', () => {
      audio.warn();
      emit('toast', { message: 'Bab ini terkunci — bersihkan bab sebelumnya dulu!', kind: 'warn' });
    });
  }
  return slide;
}

function renderMap(meta) {
  const track = document.getElementById('chapter-track');
  const dots = document.getElementById('map-dots');
  if (!track) return;
  const list = chapters();
  track.textContent = '';
  dots.textContent = '';

  // Bab terpilih wajib valid (save lama / bab terkunci).
  const selId = list.some((c) => c.id === meta.selectedChapter)
    ? meta.selectedChapter
    : currentChapterId(meta);
  if (meta.selectedChapter !== selId) { meta.selectedChapter = selId; writeSave(meta); }
  const selIdx = Math.max(0, list.findIndex((c) => c.id === selId));

  list.forEach((ch, i) => {
    track.appendChild(buildSlide(ch, i, meta));
    const dot = el('button', {
      class: `map-dot${chapterStatus(ch, meta) === 'cleared' ? ' cleared' : ''}`,
      'aria-label': `Bab ${i + 1}`,
      onclick: () => scrollToIndex(i),
    });
    dots.appendChild(dot);
  });

  // Posisi awal = bab yang sedang/terakhir dimainkan.
  scrollToIndex(selIdx, true);
  updateMapChrome(meta, selIdx);

  const sub = document.getElementById('play-sub');
  const sel = list[selIdx];
  if (sub && sel) sub.textContent = `Bab ${selIdx + 1} · ${sel.organ}`;
}

function scrollToIndex(i, instant = false) {
  const vp = document.getElementById('map-viewport');
  const list = chapters();
  const idx = Math.max(0, Math.min(list.length - 1, i));
  chapterIndex = idx;
  if (!vp) return;
  const left = idx * (vp.clientWidth || 0);
  try {
    vp.scrollTo({ left, behavior: instant ? 'auto' : 'smooth' });
  } catch {
    vp.scrollLeft = left;
  }
  updateMapChrome(STATE.meta, idx);
  commitChapter(idx); // bab yang terlihat = bab yang dimainkan tombol MAIN
}

function updateMapChrome(meta, idx = chapterIndex) {
  const list = chapters();
  const pos = document.getElementById('map-pos');
  if (pos) pos.textContent = `BAB ${idx + 1}/${list.length}`;
  const dots = document.querySelectorAll('#map-dots .map-dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  const prev = document.getElementById('map-prev');
  const next = document.getElementById('map-next');
  if (prev) prev.disabled = idx <= 0;
  if (next) next.disabled = idx >= list.length - 1;
  // Label di bawah tombol MAIN mengikuti bab yang sedang terlihat — kalau tidak,
  // pemain menggeser ke Bab 3 tapi label & run tetap Bab 1.
  const sub = document.getElementById('play-sub');
  const ch = list[idx];
  if (sub && ch) {
    const locked = chapterStatus(ch, meta) === 'locked';
    sub.textContent = locked ? `Bab ${idx + 1} · Terkunci` : `Bab ${idx + 1} · ${ch.organ}`;
  }
}

/**
 * Simpan bab yang sedang terlihat sebagai bab terpilih (bila terbuka), supaya
 * tombol MAIN memulai run di bab yang tampil di peta — bukan bab lama.
 */
function commitChapter(idx) {
  const list = chapters();
  const meta = STATE.meta;
  const ch = list[idx];
  if (!ch || !meta || meta.selectedChapter === ch.id) return;
  if (chapterStatus(ch, meta) === 'locked') return;
  meta.selectedChapter = ch.id;
  try { markSeen(ch.id); } catch { /* abaikan */ }
  writeSave(meta);
}

/** Validasi sebelum MAIN: bab terkunci → peringatan, jangan mulai run. */
export function canPlaySelected() {
  const list = chapters();
  const meta = STATE.meta;
  const ch = list[chapterIndex] || list.find((c) => c.id === meta.selectedChapter) || list[0];
  if (!ch) return false;
  if (chapterStatus(ch, meta) === 'locked') {
    audio.warn();
    emit('toast', { message: 'Bab ini terkunci — bersihkan bab sebelumnya dulu!', kind: 'warn' });
    return false;
  }
  commitChapter(chapterIndex);
  return true;
}

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

/** Geser satu slide (panah ‹ ›). */
function step(dir) {
  scrollToIndex(chapterIndex + dir);
  audio.ui();
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
  // Kartu atas #1: level pasukan (angka nyata dari save — game belum punya
  // level akun ber-XP, jadi yang ditampilkan level pasukan yang bisa di-upgrade).
  const lv = document.getElementById('card-level-val');
  if (lv) lv.textContent = 'Lv ' + (meta.allyLevel || 0);

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

  const vp = document.getElementById('map-viewport');
  if (vp) {
    let t = 0;
    vp.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const idx = Math.round(vp.scrollLeft / Math.max(1, vp.clientWidth));
        if (idx !== chapterIndex) { chapterIndex = idx; updateMapChrome(STATE.meta, idx); }
      }, 90);
    }, { passive: true });
  }

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
