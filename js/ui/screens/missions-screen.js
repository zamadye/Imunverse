/**
 * missions-screen.js — Modal MISI & QUEST (footer "Misi" di dashboard).
 *
 * UI-REBUILD P8: kartu Misi/Quest di dashboard DICABUT (dashboard harus
 * bersih). Semua misi harian, quest mingguan, dan prestasi pindah ke modal
 * ini yang dibuka dari salah satu dari 4 tombol footer.
 *
 * Sumber data: data/missions.json via systems/mission-system.js
 *  - getQuestProgress(meta)       → quest harian + mingguan (auto-aktif)
 *  - getMissionProgressList(meta) → prestasi (klaim otomatis saat selesai)
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { writeSave } from '../../save/save-manager.js';
import {
  getQuestProgress, getMissionProgressList, acceptQuest, claimQuest,
  msUntilDailyReset, formatResetCountdown,
} from '../../systems/mission-system.js';
import { audio } from '../../systems/audio-system.js';
import { el } from '../screen-manager.js';
import { screenManager } from '../screen-manager.js';
import { emit } from '../../core/ui-bridge.js';

let tab = 'daily';

function coinIcon() {
  return el('img', { src: 'assets/icons/cur-antibodi.svg', alt: 'Biokredit' });
}

/** Baris quest (harian/mingguan) dengan tombol KLAIM. */
function questCard(q, meta, refresh) {
  const pct = Math.min(100, Math.round((q.value / q.def.target) * 100));
  const card = el('div', {
    class: `miss-card${q.done && !q.claimed ? ' done' : ''}${q.claimed ? ' claimed' : ''}`,
  }, [
    el('div', { class: 'miss-top' }, [
      el('b', { text: q.def.name }),
      el('span', { text: `${Math.min(q.value, q.def.target)}/${q.def.target}` }),
    ]),
    el('span', { class: 'miss-desc', text: q.def.desc }),
    el('div', { class: 'miss-bar' }, [el('i', { style: `width:${pct}%` })]),
    el('div', { class: 'miss-reward' }, [
      coinIcon(),
      el('span', { text: `+${q.def.reward} Biokredit` }),
      q.def.bpXp ? el('span', { text: `· +${q.def.bpXp} XP Mitosis` }) : el('span', { text: '' }),
    ]),
  ]);

  if (q.done && !q.claimed) {
    card.appendChild(el('button', {
      class: 'miss-act',
      text: 'KLAIM',
      onclick: () => {
        const got = claimQuest(meta, q.def.id);
        if (got) {
          emit('toast', { message: `Quest selesai: +${got} Biokredit`, kind: 'gold' });
          audio.chest();
        }
        refresh();
      },
    }));
  } else if (q.claimed) {
    card.appendChild(el('span', { class: 'miss-act', text: '✓ DIKLAIM', disabled: 'disabled' }));
  }
  return card;
}

/** Baris prestasi (klaim otomatis oleh checkMissions saat run berakhir). */
function missionCard(m) {
  const pct = Math.min(100, Math.round((m.value / m.target) * 100));
  return el('div', { class: `miss-card${m.claimed ? ' claimed' : ''}${m.done && !m.claimed ? ' done' : ''}` }, [
    el('div', { class: 'miss-top' }, [
      el('b', { text: m.def.name }),
      el('span', { text: `${m.value}/${m.target}` }),
    ]),
    el('span', { class: 'miss-desc', text: m.def.desc }),
    el('div', { class: 'miss-bar' }, [el('i', { style: `width:${pct}%` })]),
    el('div', { class: 'miss-reward' }, [
      coinIcon(),
      el('span', { text: `+${m.def.reward} Biokredit` }),
      m.claimed ? el('span', { text: '· selesai ✓' }) : el('span', { text: '' }),
    ]),
  ]);
}

function render() {
  const meta = STATE.meta;
  const body = document.getElementById('missions-body');
  if (!body) return;
  const refresh = () => render();

  // Quest di-AMBIL otomatis (tanpa tombol AMBIL — langkah tanpa makna).
  for (const q0 of getQuestProgress(meta)) {
    if (!q0.accepted && !q0.claimed) acceptQuest(meta, q0.def.id);
  }

  const reset = document.getElementById('miss-reset');
  if (reset) {
    const ms = msUntilDailyReset();
    reset.textContent = `⏳ Reset ${formatResetCountdown(ms)}`;
    reset.style.color = ms < 4 * 3600e3 ? '#ff9f43' : '';
  }

  body.textContent = '';
  if (tab === 'achievement') {
    const list = getMissionProgressList(meta);
    const done = list.filter((m) => m.claimed).length;
    body.appendChild(el('p', {
      class: 'miss-empty',
      text: `Prestasi ${done}/${list.length} — hadiah diklaim otomatis saat misi selesai.`,
    }));
    // Belum selesai dulu (goal gradient), lalu yang sudah selesai di bawah.
    for (const m of list.filter((x) => !x.claimed)) body.appendChild(missionCard(m));
    for (const m of list.filter((x) => x.claimed)) body.appendChild(missionCard(m));
    return;
  }

  const quests = getQuestProgress(meta).filter((q) => q.kind === tab);
  if (quests.length === 0) {
    body.appendChild(el('p', { class: 'miss-empty', text: 'Belum ada quest untuk periode ini.' }));
    return;
  }
  const active = quests.filter((q) => !q.claimed);
  const claimed = quests.filter((q) => q.claimed);
  for (const q of active) body.appendChild(questCard(q, meta, refresh));
  for (const q of claimed) body.appendChild(questCard(q, meta, refresh));
}

export function show() {
  // Header judul mengikuti tab aktif.
  const title = document.getElementById('missions-title');
  if (title) {
    title.textContent = tab === 'daily' ? 'MISI HARIAN'
      : tab === 'weekly' ? 'QUEST MINGGUAN' : 'PRESTASI';
  }
  document.querySelectorAll('.miss-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.missTab === tab);
  });
  render();
  bindOnce();
}

let bound = false;
function bindOnce() {
  if (bound) return;
  bound = true;
  document.querySelectorAll('.miss-tab').forEach((b) => {
    b.addEventListener('click', () => {
      tab = b.dataset.missTab || 'daily';
      audio.ui();
      show();
    });
  });
  document.getElementById('miss-close')?.addEventListener('click', () => {
    audio.ui();
    screenManager.show('dashboard');
  });
  // Tap di luar sheet = tutup.
  document.getElementById('screen-missions')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'screen-missions') screenManager.show('dashboard');
  });
}

export function hide() {}
