/**
 * arena-screen.js — Modal pilih arena (di atas dashboard).
 * Arena terbuka sesuai cara user bermain (statistik meta nyata):
 * Saluran Limfe (default), Lambung Asam (total kill), Paru Kristal
 * (gelombang terbaik), Sumbu Saraf (boss kill). Tiap arena punya bonus run.
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { writeSave } from '../../save/save-manager.js';
import { el } from '../screen-manager.js';

/** Evaluasi syarat unlock arena dari statistik meta. @returns {{unlocked:boolean, text:string, pct:number}} */
export function arenaUnlockStatus(arenaDef, meta = STATE.meta) {
  const { type, value } = arenaDef.unlock;
  const stats = meta.stats;
  switch (type) {
    case 'default':
      return { unlocked: true, text: 'Terbuka sejak awal', pct: 1 };
    case 'totalKills': {
      const v = stats.totalKills || 0;
      return { unlocked: v >= value, text: `Kalahkan ${value} patogen — ${Math.min(v, value)}/${value}`, pct: Math.min(1, v / value) };
    }
    case 'bestWave': {
      const v = stats.bestWave || 0;
      return { unlocked: v >= value, text: `Capai gelombang ${value} — terbaik: ${v}`, pct: Math.min(1, v / value) };
    }
    case 'bossKills': {
      const v = stats.bossKills || 0;
      return { unlocked: v >= value, text: `Kalahkan ${value} Sel Kanker — ${Math.min(v, value)}/${value}`, pct: Math.min(1, v / value) };
    }
    default:
      return { unlocked: false, text: 'Terbuka lewat progres', pct: 0 };
  }
}

export function show() {
  const meta = STATE.meta;
  const list = document.getElementById('arena-list');
  list.textContent = '';

  for (const arenaDef of getData().arenas.arenas) {
    const status = arenaUnlockStatus(arenaDef, meta);
    const selected = meta.selectedArena === arenaDef.id && status.unlocked;
    const item = el('button', { class: `arena-item${selected ? ' selected' : ''}${status.unlocked ? '' : ' locked'}` }, [
      el('img', { src: arenaDef.thumb, alt: arenaDef.name }),
      el('div', { class: 'ai-mid' }, [
        el('div', { class: 'ai-name', text: arenaDef.name }),
        el('div', { class: 'ai-bonus', text: arenaDef.bonus.desc }),
        status.unlocked
          ? el('div', { class: 'ai-unlock', style: 'color:#2f9c8f', text: selected ? 'Terpilih ✓' : 'Terbuka' })
          : el('div', { class: 'ai-unlock lock-line' }, [
              el('img', { class: 'lock-ico', src: 'assets/sprites/icon_lock.png', alt: '' }),
              el('span', { text: ` ${status.text}` }),
            ]),
      ]),
      selected ? el('span', { class: 'ai-check', text: '✓' }) : null,
    ]);
    if (status.unlocked && !selected) {
      item.addEventListener('click', () => {
        meta.selectedArena = arenaDef.id;
        writeSave(meta);
        show(); // render ulang
      });
    }
    list.appendChild(item);
  }
}

export function hide() {}
