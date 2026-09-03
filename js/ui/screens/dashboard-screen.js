/**
 * dashboard-screen.js — Dashboard utama: statistik global, daily reward
 * (lewat hook monetisasi checkDailyLives), progress misi & navigasi.
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { canClaimDailyReward, claimDailyReward } from '../../systems/economy-system.js';
import { getMissionProgressList } from '../../systems/mission-system.js';
import { checkDailyLives } from '../../systems/monetization.js';
import { emit } from '../../core/ui-bridge.js';
import { el } from '../screen-manager.js';

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function show() {
  const meta = STATE.meta;
  document.getElementById('dash-currency').textContent = meta.currency.toLocaleString('id-ID');

  // ---- Strip statistik ----
  const stats = meta.stats;
  const strip = document.getElementById('dash-stats');
  strip.textContent = '';
  strip.appendChild(el('div', { class: 'stat-cell' }, [el('b', { text: stats.bestWave }), el('span', { text: 'Gelombang Terbaik' })]));
  strip.appendChild(el('div', { class: 'stat-cell' }, [el('b', { text: stats.totalKills.toLocaleString('id-ID') }), el('span', { text: 'Total Kill' })]));
  strip.appendChild(el('div', { class: 'stat-cell' }, [el('b', { text: fmtTime(stats.bestSurvivalTime) }), el('span', { text: 'Waktu Terbaik' })]));
  strip.appendChild(el('div', { class: 'stat-cell' }, [el('b', { text: stats.totalRuns }), el('span', { text: 'Total Run' })]));

  // ---- Daily reward (hook monetisasi + logic asli) ----
  const dailyCard = document.getElementById('daily-card');
  dailyCard.textContent = '';
  const livesAvailable = checkDailyLives(); // HOOK: ketersediaan "daily lives" dari SDK/backend
  const claimable = livesAvailable && canClaimDailyReward(meta);
  const info = el('div', { class: 'daily-info' }, [
    el('b', { text: '🎁 Bonus Harian' }),
    el('span', { text: claimable ? `${getData().upgrades.economy.dailyReward} 🛡️ menantimu — klaim sekarang!` : 'Sudah diklaim hari ini. Kembali besok.' }),
  ]);
  const btn = el('button', {
    class: 'btn ' + (claimable ? 'btn-primary' : ''),
    text: claimable ? 'KLAIM' : '✓ DIKLAIM',
    disabled: !claimable,
    onclick: () => {
      const amount = claimDailyReward(STATE.meta); // logic asli + auto-save
      if (amount > 0) {
        emit('toast', { message: `🎁 Bonus harian +${amount} 🛡️!`, kind: 'gold' });
        show(); // refresh angka currency
      }
    },
  });
  dailyCard.appendChild(info);
  dailyCard.appendChild(btn);

  // ---- Misi (top 4 progres teratas yang belum klaim, sisanya selesai) ----
  const list = document.getElementById('dash-missions');
  list.textContent = '';
  const progress = getMissionProgressList(meta);
  const active = progress.filter((m) => !m.claimed).slice(0, 3);
  const doneCount = progress.filter((m) => m.claimed).length;
  for (const m of active) {
    const pct = Math.min(100, Math.round((m.value / m.target) * 100));
    const item = el('div', { class: 'mission-item' + (m.done ? ' done' : '') }, [
      el('div', { class: 'm-row' }, [
        el('span', { class: 'm-name', text: m.def.name }),
        el('span', { class: 'm-reward', text: `+${m.def.reward} 🛡️` }),
      ]),
      el('div', { class: 'm-row' }, [
        el('span', { style: 'color:var(--text-dim);font-size:11px', text: `${m.def.desc} — ${m.value.toLocaleString('id-ID')}/${m.target.toLocaleString('id-ID')}` }),
      ]),
      el('div', { class: 'mission-track' }, [
        el('div', { class: 'mission-fill', style: `width:${pct}%` }),
      ]),
    ]);
    list.appendChild(item);
  }
  if (active.length === 0) {
    list.appendChild(el('p', { style: 'color:var(--text-dim);font-size:12px', text: `Semua misi selesai! (${doneCount}/${progress.length}) 🎉` }));
  } else if (doneCount > 0) {
    list.appendChild(el('p', { style: 'color:var(--text-dim);font-size:11px', text: `+${doneCount} misi lainnya sudah selesai ✓` }));
  }
}

export function hide() {}
