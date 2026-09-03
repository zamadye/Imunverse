/**
 * dashboard-screen.js — Dashboard ala reference user:
 * topbar currency + panggung hero pastel + strip statistik + daily +
 * misi, dengan dock navigasi (Play/Heroes/Squad/Shop) di index.html.
 */

import { STATE } from '../../core/state-manager.js';
import { getData, getHero } from '../../core/data-store.js';
import { canClaimDailyReward, claimDailyReward } from '../../systems/economy-system.js';
import { getMissionProgressList } from '../../systems/mission-system.js';
import { checkDailyLives } from '../../systems/monetization.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
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

  // ---- Panggung hero: sprite + nama hero terpilih + badge gelombang terbaik ----
  const heroDef = getHero(meta.selectedHero) || getData().heroes.heroes[0];
  const img = document.getElementById('dash-hero-img');
  if (heroDef) {
    img.src = spriteToDataURL(heroDef.spriteIdle);
    document.getElementById('dash-hero-name').textContent = heroDef.name;
    document.getElementById('dash-hero-title').textContent = heroDef.title;
  }
  const badge = document.getElementById('dash-best-badge');
  badge.textContent = '';
  badge.appendChild(el('img', { class: 'badge-ico', src: 'assets/sprites/icon_trophy.png', alt: '' }));
  badge.appendChild(el('span', { text: `Gel. ${meta.stats.bestWave}` }));

  // ---- Strip statistik (3 sel) ----
  const stats = meta.stats;
  const strip = document.getElementById('dash-stats');
  strip.textContent = '';
  strip.appendChild(el('div', { class: 'stat-cell' }, [el('b', { text: stats.totalKills.toLocaleString('id-ID') }), el('span', { text: 'Total Kill' })]));
  strip.appendChild(el('div', { class: 'stat-cell' }, [el('b', { text: fmtTime(stats.bestSurvivalTime) }), el('span', { text: 'Waktu Terbaik' })]));
  strip.appendChild(el('div', { class: 'stat-cell' }, [el('b', { text: stats.totalRuns }), el('span', { text: 'Total Run' })]));

  // ---- Daily reward (hook monetisasi + logic asli) ----
  const dailyCard = document.getElementById('daily-card');
  dailyCard.textContent = '';
  const livesAvailable = checkDailyLives(); // HOOK: ketersediaan "daily lives" dari SDK/backend
  const claimable = livesAvailable && canClaimDailyReward(meta);
  const info = el('div', { class: 'daily-info' }, [
    el('b', { class: 'ico-title' }, [
      el('img', { class: 't-ico', src: 'assets/sprites/icon_star.png', alt: '' }),
      el('span', { text: 'Bonus Harian' }),
    ]),
    el('span', { class: 'claim-line' }, claimable ? [
      el('b', { text: `${getData().upgrades.economy.dailyReward}` }),
      el('img', { class: 'inline-coin', src: 'assets/sprites/icon_coin.png', alt: 'antibodi' }),
      el('span', { text: ' menantimu — klaim sekarang!' }),
    ] : [el('span', { text: 'Sudah diklaim hari ini. Kembali besok.' })]),
  ]);
  const btn = el('button', {
    class: 'btn ' + (claimable ? 'btn-gold' : ''),
    text: claimable ? 'KLAIM' : '✓ DIKLAIM',
    disabled: !claimable,
    onclick: () => {
      const amount = claimDailyReward(STATE.meta); // logic asli + auto-save
      if (amount > 0) {
        emit('toast', { message: `Bonus harian +${amount} !`, kind: 'gold' });
        show(); // refresh angka currency
      }
    },
  });
  dailyCard.appendChild(info);
  dailyCard.appendChild(btn);

  // ---- Misi (3 progres teratas yang belum selesai) ----
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
        el('span', { class: 'm-reward' }, [
        el('span', { text: `+${m.def.reward}` }),
        el('img', { class: 'inline-coin', src: 'assets/sprites/icon_coin.png', alt: '' }),
      ]),
      ]),
      el('div', { class: 'm-row' }, [
        el('span', { class: 'mission-more', text: `${m.def.desc} — ${m.value.toLocaleString('id-ID')}/${m.target.toLocaleString('id-ID')}` }),
      ]),
      el('div', { class: 'mission-track' }, [
        el('div', { class: 'mission-fill', style: `width:${pct}%` }),
      ]),
    ]);
    list.appendChild(item);
  }
  if (active.length === 0) {
    list.appendChild(el('p', { class: 'mission-more', text: `Semua misi selesai! (${doneCount}/${progress.length}) 🎉` }));
  } else if (doneCount > 0) {
    list.appendChild(el('p', { class: 'mission-more', text: `+${doneCount} misi lainnya sudah selesai ✓` }));
  }
}

export function hide() {}
