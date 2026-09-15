/**
 * comeback-screen.js — Sprint 6.31 (bible §10.1): modal "Antibodi
 * Selamat Datang" untuk pemain yang absen ≥3 hari. Hadiah berjenjang +
 * pemulihan Imunitas gratis.
 */

import { STATE } from '../../core/state-manager.js';
import { screenManager } from '../screen-manager.js';
import { audio } from '../../systems/audio-system.js';
import { claimComeback } from '../../systems/comeback-system.js';
import { emit } from '../../core/ui-bridge.js';

export function show() {
  const pending = STATE.meta.comeback && STATE.meta.comeback.pending;
  if (!pending) {
    screenManager.show('dashboard');
    return;
  }
  document.getElementById('comeback-desc').textContent =
    `Kamu absen ${pending.absentDays} hari — Inang merindukanmu!`;
  const bits = [`+${pending.tier.bk.toLocaleString('id-ID')} Biokredit`];
  if (pending.tier.genom > 0) bits.push(`+${pending.tier.genom} Genom`);
  bits.push('Imunitas pulih penuh');
  document.getElementById('comeback-reward').textContent = bits.join(' · ');
  document.getElementById('btn-comeback-claim').onclick = () => {
    const got = claimComeback(STATE.meta);
    audio.evolve();
    if (got) {
      emit('toast', { message: `Antibodi Selamat Datang: +${got.bk.toLocaleString('id-ID')} BK — tubuh pulih!`, kind: 'gold' });
    }
    screenManager.show('dashboard');
  };
  document.getElementById('btn-comeback-later').onclick = () => {
    screenManager.show('dashboard');
  };
}

export function hide() {}
