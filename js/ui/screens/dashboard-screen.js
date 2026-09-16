/**
 * dashboard-screen.js — Dashboard SLIM v2 (build 54h):
 *
 * Struktur baru:
 *   [ hero-stage cinematic Mako (40%) ]
 *   [ peta tubuh chapter slideshow — swipe kiri/kanan ]
 *   [ tombol PLAY besar di tengah ]
 *   [ dock 4 tombol: Hero · Tas · Misi · Lab ]
 *
 * Yang dihapus (dipindah ke bottom-sheet atau screen lain):
 *   • bp-bar, kapsul-card, campaign-card, mode-endless, arena-card,
 *   • mode-lab, stat-strip, daily-card, evo-card, body-card,
 *   • duo-row missions, duo-row body, secondary-dock, tombol MAIN dock
 *
 * Bottom-sheet 'quests' berisi Misi · Quest · Battle Pass (tab).
 */

import { STATE } from '../../core/state-manager.js';
import { getData, getHero } from '../../core/data-store.js';
import { writeSave } from '../../save/save-manager.js';
import { recordLoginDay } from '../../systems/comeback-system.js';
import { getMissionProgressList, getQuestProgress, acceptQuest, claimQuest, msUntilDailyReset, formatResetCountdown } from '../../systems/mission-system.js';
import { audio } from '../../systems/audio-system.js';
import { t as tr } from '../../systems/i18n.js';
import { markSeen } from '../../systems/codex-system.js';
import { drainHeroNotices } from '../../systems/retention-system.js';
import { ensureBp, xpNeed, claimReward, rewardLabel, getTrackData } from '../../systems/battlepass-system.js';
import { heroLevelBadge, allyLevelBadge } from '../../systems/economy-system.js';
import { playerRank } from '../../systems/rank-system.js';
import { applyGateVisual } from '../../systems/feature-gate.js';
import { currentChapterId } from './campaign-screen.js';
import { getSession } from '../../systems/account-system.js';
import { ensureFounderReward } from '../../systems/imun-economy.js';
import { screenManager } from '../screen-manager.js';
import { isCapsulePending, isCapsuleSnoozed } from '../../systems/welcome-box-system.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { emit } from '../../core/ui-bridge.js';
import { el } from '../screen-manager.js';

let dashWasHidden = true;
let currentChapterIdx = 0;

/** cine stage (canvas prosedural) */
function startStageCine() {
  import('../../render/cine-banner.js').then((m) => {
    const cv = document.getElementById('dash-cine');
    if (cv) m.startBannerCine(cv);
  }).catch((e) => console.error('cine-banner import gagal:', e));
}

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
  layer.innerHTML = `
    <div class="hn-box">
      <div class="hn-stars"></div>
      <img class="hn-sprite" src="${h.spritePortrait || h.spriteIdle}" alt="${h.name}" />
      <div class="hn-kicker">HERO BARU!</div>
      <b class="hn-name">${h.name}</b>
      <span class="hn-title">${h.title || ''}</span>
    </div>`;
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.className = 'hn-star';
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 260}px`);
    s.style.setProperty('--dy', `${(Math.random() - 0.5) * 200}px`);
    s.style.animationDelay = `${Math.random() * 0.5}s`;
    layer.querySelector('.hn-stars').appendChild(s);
  }
  clearTimeout(showHeroNotice._t);
  showHeroNotice._t = setTimeout(() => { layer.className = ''; }, 3200);
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/** Bangun kartu-kartu chapter di dalam slideshow. */
function renderChapterMap(meta) {
  const track = document.getElementById('cm-track');
  const dots = document.getElementById('cm-dots');
  if (!track || !dots) return;
  const chapters = getData().campaign.chapters;
  const clearedSet = meta.campaignCleared || {};
  // First uncleared, else last
  const activeIdx = chapters.findIndex((c) => !clearedSet[c.id]);
  currentChapterIdx = activeIdx >= 0 ? activeIdx : chapters.length - 1;

  track.innerHTML = '';
  dots.innerHTML = '';
  chapters.forEach((ch, idx) => {
    const cleared = !!clearedSet[ch.id];
    const locked = idx > 0 && !clearedSet[chapters[idx - 1].id] && !cleared && idx > currentChapterIdx;
    const card = document.createElement('article');
    card.className = 'cm-card' + (cleared ? ' cleared' : '') + (locked ? ' locked' : '');
    card.dataset.chapter = ch.id;
    card.dataset.idx = String(idx);
    card.style.backgroundImage = `url('assets/chapters/${ch.id}.jpg')`;
    card.innerHTML = `
      <div class="cm-veil"></div>
      <div class="cm-top">
        <span class="cm-num">BAB ${idx + 1}</span>
        ${cleared ? '<span class="cm-badge">✓ TAKLUKKAN</span>' : ''}
        ${locked ? '<span class="cm-badge locked">TERKUNCI</span>' : ''}
      </div>
      <div class="cm-bottom">
        <b class="cm-organ">${ch.organ}</b>
        <span class="cm-title">${ch.title}</span>
        <p class="cm-obj">${ch.objective || ''}</p>
      </div>`;
    card.addEventListener('click', () => {
      if (locked) { emit('toast', { message: 'Selesaikan bab sebelumnya untuk membuka.', kind: 'warn' }); return; }
      currentChapterIdx = idx;
      scrollToChapter(idx, true);
      updateActiveChapter();
    });
    track.appendChild(card);

    const dot = document.createElement('button');
    dot.className = 'cm-dot' + (idx === currentChapterIdx ? ' active' : '');
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Bab ${idx + 1}`);
    dot.addEventListener('click', () => { currentChapterIdx = idx; scrollToChapter(idx, true); updateActiveChapter(); });
    dots.appendChild(dot);
  });

  // Scroll to current
  requestAnimationFrame(() => scrollToChapter(currentChapterIdx, false));
  updateActiveChapter();

  // Swipe/scroll-snap: track index by scroll position
  const viewport = document.getElementById('cm-viewport');
  if (viewport) {
    let scrollT = null;
    viewport.addEventListener('scroll', () => {
      clearTimeout(scrollT);
      scrollT = setTimeout(() => {
        const cards = track.querySelectorAll('.cm-card');
        const w = viewport.clientWidth;
        const idx = Math.round(viewport.scrollLeft / w);
        if (idx !== currentChapterIdx && idx >= 0 && idx < cards.length) {
          currentChapterIdx = idx;
          updateActiveChapter();
        }
      }, 80);
    }, { passive: true });
  }
}

function scrollToChapter(idx, smooth) {
  const viewport = document.getElementById('cm-viewport');
  if (!viewport) return;
  viewport.scrollTo({ left: idx * viewport.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
}

function updateActiveChapter() {
  const chapters = getData().campaign.chapters;
  const ch = chapters[currentChapterIdx] || chapters[0];
  // Dots
  document.querySelectorAll('.cm-dot').forEach((d, i) => d.classList.toggle('active', i === currentChapterIdx));
  // Cards active state (biar CSS bisa scale sedikit)
  document.querySelectorAll('.cm-card').forEach((c, i) => c.classList.toggle('active', i === currentChapterIdx));
  // Play button sub-label
  const sub = document.getElementById('play-sub');
  if (sub) sub.textContent = `Bab ${currentChapterIdx + 1}: ${ch.organ}`;
  // Persist selected chapter
  STATE.meta.selectedChapter = ch.id;
  STATE.meta.selectedMode = 'kampanye';
  try { writeSave(STATE.meta); } catch { /* abaikan */ }
}

/** Bottom-sheet: bind open/close */
function bindSheet() {
  const sheet = document.getElementById('sheet-quests');
  if (!sheet) return;
  document.querySelectorAll('[data-sheet="quests"]').forEach((btn) => {
    btn.addEventListener('click', () => openSheet());
  });
  sheet.querySelectorAll('[data-sheet-close]').forEach((el) => el.addEventListener('click', closeSheet));
  sheet.querySelectorAll('.sheet-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      sheet.querySelectorAll('.sheet-tab').forEach((t) => t.classList.toggle('active', t === tab));
      const key = tab.dataset.qtab;
      sheet.querySelectorAll('.qtab-panel').forEach((p) => p.classList.toggle('active', p.dataset.qpanel === key));
    });
  });
}

function openSheet() {
  audio.ui();
  const sheet = document.getElementById('sheet-quests');
  if (!sheet) return;
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('open'));
  renderSheetContent();
}

function closeSheet() {
  const sheet = document.getElementById('sheet-quests');
  if (!sheet) return;
  sheet.classList.remove('open');
  setTimeout(() => { sheet.hidden = true; }, 260);
}

function renderSheetContent() {
  const meta = STATE.meta;
  // Countdown reset
  const ms = msUntilDailyReset();
  const resetEl = document.getElementById('sheet-quest-reset');
  if (resetEl) {
    resetEl.textContent = `⏳ Reset harian ${formatResetCountdown(ms)}`;
    resetEl.classList.toggle('urgent', ms < 4 * 3600e3);
  }
  renderSheetMissions(meta);
  renderSheetQuests(meta);
  renderSheetBP(meta);
}

function renderSheetMissions(meta) {
  const box = document.getElementById('sheet-missions');
  if (!box) return;
  box.innerHTML = '';
  const progress = getMissionProgressList(meta);
  const active = progress.filter((m) => !m.claimed).slice(0, 6);
  const doneCount = progress.filter((m) => m.claimed).length;
  if (active.length === 0) {
    box.appendChild(el('p', { class: 'sheet-empty', text: `🎉 Semua misi selesai (${doneCount}/${progress.length}). Kembali besok!` }));
    return;
  }
  for (const m of active) {
    const pct = Math.min(100, Math.round((m.value / m.target) * 100));
    box.appendChild(el('div', { class: 'sheet-item' + (m.done ? ' done' : '') }, [
      el('div', { class: 'si-row' }, [
        el('b', { class: 'si-name', text: m.def.name }),
        el('span', { class: 'si-reward' }, [
          el('span', { text: `+${m.def.reward}` }),
          el('img', { class: 'inline-coin', src: 'assets/icons/cur-antibodi.svg', alt: 'BK' }),
        ]),
      ]),
      el('span', { class: 'si-desc', text: `${m.def.desc} — ${m.value.toLocaleString('id-ID')}/${m.target.toLocaleString('id-ID')}` }),
      el('div', { class: 'si-track' }, [el('i', { style: `width:${pct}%` })]),
    ]));
  }
  if (doneCount > 0) {
    box.appendChild(el('p', { class: 'sheet-hint', text: `+${doneCount} misi lainnya sudah selesai ✓` }));
  }
}

function renderSheetQuests(meta) {
  const box = document.getElementById('sheet-quests-list');
  if (!box) return;
  box.innerHTML = '';
  for (const q0 of getQuestProgress(meta)) {
    if (!q0.accepted && !q0.claimed) acceptQuest(meta, q0.def.id);
  }
  const list = getQuestProgress(meta).slice(0, 6);
  if (list.length === 0) {
    box.appendChild(el('p', { class: 'sheet-empty', text: 'Belum ada quest tersedia.' }));
    return;
  }
  for (const q of list) {
    const pct = Math.round((q.value / q.def.target) * 100);
    const row = el('div', { class: `sheet-item quest ${q.claimed ? 'claimed' : ''} ${q.done ? 'ready' : ''}` });
    row.appendChild(el('div', { class: 'si-row' }, [
      el('span', { class: 'si-kind ' + q.kind, text: q.kind === 'daily' ? 'HARIAN' : 'MINGGUAN' }),
      el('b', { class: 'si-name', text: q.def.name }),
    ]));
    row.appendChild(el('span', { class: 'si-desc', text: `${q.def.desc} · ${q.value}/${q.def.target}` }));
    row.appendChild(el('div', { class: 'si-track' }, [el('i', { style: `width:${pct}%` })]));
    if (q.done && !q.claimed) {
      row.appendChild(el('button', {
        class: 'btn btn-sm btn-gold', text: 'KLAIM',
        onclick: () => {
          const reward = claimQuest(meta, q.def.id);
          if (reward) emit('toast', { message: `Quest: +${reward} BK`, kind: 'gold' });
          renderSheetQuests(meta);
        },
      }));
    } else if (q.claimed) {
      row.appendChild(el('span', { class: 'si-mark', text: '✓' }));
    }
    box.appendChild(row);
  }
}

function renderSheetBP(meta) {
  const box = document.getElementById('sheet-bp');
  if (!box) return;
  box.innerHTML = '';
  const bp = ensureBp(meta);
  const need = xpNeed(bp.level);
  const pct = Math.min(100, Math.round((bp.xp / Math.max(1, need)) * 100));
  box.appendChild(el('div', { class: 'bp-strip' }, [
    el('span', { class: 'bp-tag', text: '⬡ SIKLUS MITOSIS' }),
    el('b', { class: 'bp-lv', text: `Lv ${bp.level}` }),
    el('span', { class: 'bp-track' }, [el('i', { class: 'bp-fill', style: `width:${pct}%` })]),
    el('span', { class: 'bp-pct', text: `${pct}%` }),
  ]));
  box.appendChild(el('button', {
    class: 'btn btn-primary btn-block', text: 'BUKA PASS PENUH',
    onclick: () => { closeSheet(); screenManager.show('bp'); },
  }));
}

/** Badge dock: hanya untuk quest yang siap klaim. */
function renderDockBadges(meta) {
  const set = (id, txt) => {
    const b = document.getElementById(id);
    if (!b) return;
    if (!txt) { b.classList.add('hidden'); b.textContent = ''; return; }
    b.classList.remove('hidden');
    b.textContent = String(txt);
  };
  const questReady = getQuestProgress(meta).filter((q) => q.done && !q.claimed).length;
  set('badge-quest', questReady > 0 ? questReady : '');
  const missionReady = getMissionProgressList(meta).filter((m) => m.done && !m.claimed).length;
  const totalReady = questReady + missionReady;
  set('badge-quest', totalReady > 0 ? totalReady : '');
}

function renderMedan(heroDef) {
  const m = document.getElementById('stage-medan');
  if (!m) return;
  const c = (heroDef && heroDef.color) || '#12e6c8';
  m.style.setProperty('--medan', c);
}

let sheetBound = false;

export function show() {
  try {
    if (isCapsulePending(STATE.meta) && !isCapsuleSnoozed()) {
      screenManager.show('capsule', { onLater: () => screenManager.show('dashboard') });
      return;
    }
  } catch { /* abaikan */ }
  try { recordLoginDay(STATE.meta); } catch { /* abaikan */ }
  showHeroNotice();

  if (!sheetBound) { bindSheet(); sheetBound = true; }

  if (dashWasHidden) {
    requestAnimationFrame(() => {
      const sc = document.querySelector('.dash-body');
      if (sc) sc.scrollTop = 0;
    });
    dashWasHidden = false;
  }

  for (const sid of ['sirkulasi', 'pencernaan', 'saraf', 'imun', 'limfatik']) markSeen(sid);
  const meta = STATE.meta;
  const curEl = document.getElementById('dash-currency');
  if (curEl) curEl.textContent = meta.currency.toLocaleString('id-ID');
  ensureFounderReward(meta);
  const imuEl = document.getElementById('dash-imun');
  if (imuEl) imuEl.textContent = (meta.imun || 0).toLocaleString('id-ID');

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

  document.querySelectorAll('.dock-btn[data-nav]').forEach((b) => {
    applyGateVisual(b, 'dock', b.dataset.nav);
  });

  const rankChip = document.getElementById('rank-chip');
  if (rankChip) {
    const rk = playerRank();
    rankChip.classList.remove('hidden');
    const em = document.getElementById('rank-emblem');
    em.textContent = rk.tier.insignia;
    em.style.background = `linear-gradient(160deg, ${rk.tier.color}, ${rk.tier.color}cc)`;
    document.getElementById('rank-tier-name').textContent = tr(rk.tier.name);
    const rf = document.getElementById('rank-bar-fill');
    rf.style.width = `${Math.round(rk.pct * 100)}%`;
    rf.style.background = rk.tier.color;
    document.getElementById('rank-sub').textContent = rk.next
      ? `${rk.need} ${tr('GP lagi ke')} ${tr(rk.next.name)}`
      : tr('Pangkat tertinggi!');
    rankChip.onclick = () => screenManager.show('rank');
  }

  const heroDef = getHero(meta.selectedHero) || getData().heroes.heroes[0];
  const heroNameEl = document.getElementById('dash-hero-name');
  const heroTitleEl = document.getElementById('dash-hero-title');
  if (heroDef && heroNameEl) {
    heroNameEl.textContent = heroDef.name;
    heroTitleEl.textContent = heroDef.title;
  }
  const badge = document.getElementById('dash-best-badge');
  if (badge) {
    badge.textContent = '';
    badge.appendChild(el('img', { class: 'badge-ico', src: 'assets/icons/ui-star.svg', alt: '' }));
    badge.appendChild(el('span', { text: `Gel. ${meta.stats.bestWave}` }));
  }
  const lvlBadge = document.getElementById('dash-level-badge');
  if (lvlBadge) {
    lvlBadge.textContent = '';
    lvlBadge.appendChild(el('img', { class: 'badge-ico', src: 'assets/icons/menu-squad.svg', alt: '' }));
    lvlBadge.appendChild(el('span', { text: `${heroLevelBadge(meta, heroDef.id)} · Pasukan ${allyLevelBadge(meta)}` }));
    lvlBadge.onclick = () => { audio.ui(); screenManager.show('upgrade'); };
  }

  renderMedan(heroDef);
  renderChapterMap(meta);

  const avatarImg = document.getElementById('dash-avatar');
  if (avatarImg && heroDef) avatarImg.src = spriteToDataURL(heroDef.spritePortrait || heroDef.spriteIdle);

  renderDockBadges(meta);
  startStageCine();

  // Comeback modal jika ada
  if (STATE.meta.comeback && STATE.meta.comeback.pending) {
    screenManager.show('comeback');
  }
}

export function hide() {
  dashWasHidden = true;
  import('../../render/cine-banner.js').then((m) => m.stopBannerCine()).catch(() => {});
  closeSheet();
}
