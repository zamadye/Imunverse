/**
 * rank-screen.js — Fase 19: Modal PANGKAT PENJAGA (tujuan pemain).
 * Ladder 13 pangkat (data/ranks.json), progres GP musim berjalan, cara dapat GP.
 * Diakses dari chip pangkat di topbar dashboard (klik riil).
 */

import { getRanks } from '../../core/data-store.js';
import { playerRank, tierIndexFor, currentSeason } from '../../systems/rank-system.js';
import { STATE } from '../../core/state-manager.js';
import { screenManager } from '../screen-manager.js';
import { t } from '../../systems/i18n.js';

function emblem(cls, tier) {
  const el = document.createElement('span');
  el.className = `rank-emblem ${cls || ''}`;
  el.style.background = `linear-gradient(160deg, ${tier.color}, ${tier.color}cc)`;
  el.textContent = tier.insignia;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export function show() {
  const meta = STATE.meta;
  const info = playerRank();
  const tiers = getRanks().tiers;

  // --- Ringkasan pangkat saat ini ---
  document.getElementById('rank-modal-emblem').outerHTML = '';
  const heroEmblem = emblem('big', info.tier);
  heroEmblem.id = 'rank-modal-emblem';
  document.querySelector('#screen-rank .rank-hero').prepend(heroEmblem);

  document.getElementById('rank-modal-tier').textContent = t(info.tier.name);
  document.getElementById('rank-modal-gp').textContent = info.gp.toLocaleString('id-ID');
  const fill = document.getElementById('rank-modal-fill');
  fill.style.width = `${Math.round(info.pct * 100)}%`;
  fill.style.background = info.tier.color;
  document.getElementById('rank-modal-next').textContent = info.next
    ? `${info.need} ${t('GP lagi ke')} ${t(info.next.name)}`
    : t('Pangkat tertinggi — kamu Penjaga Nomor 1!');

  // --- Garis musim (urgensi ala season MLBB/CoD:M) ---
  const season = currentSeason();
  document.getElementById('rank-season-line').textContent =
    `${t('Musim')} ${season.number} · ${t('berakhir dalam')} ${season.endsInDays} ${t('hari')} — ${t('GP tidak turun, pangkatmu aman')}`;

  // --- Ladder semua tier (current disorot, sudah dicapai dicentang) ---
  const list = document.getElementById('rank-ladder');
  list.textContent = '';
  const curIdx = tierIndexFor(info.gp);
  tiers.forEach((tier, i) => {
    const li = document.createElement('li');
    li.className = `rank-row${i === curIdx ? ' current' : ''}${info.gp >= tier.min ? ' reached' : ''}`;
    const left = document.createElement('span');
    left.className = 'rank-row-left';
    left.appendChild(emblem('sm', tier));
    const name = document.createElement('b');
    name.textContent = t(tier.name);
    left.appendChild(name);
    li.appendChild(left);
    const right = document.createElement('span');
    right.className = 'rank-row-right';
    right.textContent = info.gp >= tier.min ? '✓' : `${tier.min.toLocaleString('id-ID')} GP`;
    li.appendChild(right);
    list.appendChild(li);
  });

  // Pastikan pangkat saat ini terlihat di ladder (modal pendek → ladder di-scroll)
  list.querySelector('.rank-row.current')?.scrollIntoView({ block: 'center' });

  // --- Cara dapat GP (dari data/ranks.json → points) ---
  const pts = getRanks().points;
  document.getElementById('rank-earn').textContent =
    `${t('Dapat GP dari setiap run')}: ${t('per gelombang')} +${pts.perWave} · ${t('per patogen')} +${pts.perKill} · ${t('per boss')} +${pts.perBoss} · ${t('menang')} +${pts.victoryBonus}`;
}

export function hide() {}

export function wire() {
  document.getElementById('btn-rank-close').addEventListener('click', () => {
    screenManager.show('dashboard');
  });
}
