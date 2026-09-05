/**
 * focus-screen.js — Modal pilih FOKUS RUN (meta-layer kondisi tubuh).
 * Fokus menentukan sistem tubuh yang dipulihkan oleh run berikutnya —
 * gameplay in-run tetap sama, konsekuensi metanya berbeda:
 * "Run Detoksifikasi Limfatik" membersihkan racun ekstra,
 * "Run Respons Cepat" memulihkan Sirkulasi, dst.
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { writeSave } from '../../save/save-manager.js';
import { emit } from '../../core/ui-bridge.js';
import { markSeen } from '../../systems/codex-system.js';
import { el, screenManager } from '../screen-manager.js';

export function show() {
  const meta = STATE.meta;
  const list = document.getElementById('focus-list');
  list.textContent = '';

  for (const focusDef of getData().bodySystems.focusRuns) {
    const selected = (meta.focusRun || 'seimbang') === focusDef.id;
    const item = el('button', { class: `focus-item${selected ? ' selected' : ''}` }, [
      el('img', { src: focusDef.icon, alt: '' }),
      el('div', { class: 'fi-mid' }, [
        el('div', { class: 'fi-name', text: focusDef.name }),
        el('div', { class: 'fi-desc', text: focusDef.desc }),
      ]),
      selected ? el('span', { class: 'ai-check', text: '✓' }) : null,
    ]);
    if (!selected) {
      item.addEventListener('click', () => {
        meta.focusRun = focusDef.id;
        if (focusDef.target) markSeen(focusDef.target); // Bio-Pedia: sistem fokus
        writeSave(meta);
        emit('toast', { message: `Fokus run: ${focusDef.name}` });
        screenManager.show('dashboard');
      });
    }
    list.appendChild(item);
  }
}

export function hide() {}
