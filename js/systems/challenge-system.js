/**
 * challenge-system.js — ADDENDUM §3.3: Challenge link "Bisa pecahkan rekor saya?"
 *
 * Setelah run, pemain generate link phagos.space/?challenge=[runId] berisi
 * ringkasan run (wave, kill, hero, mutasi). Penerima menekan TANTANG BALIK →
 * langsung main dengan hero yang sama. MVP: localStorage (satu perangkat);
 * server-side nanti. Kompetisi mikro tanpa infrastruktur PvP.
 */

import { STATE } from '../core/state-manager.js';
import { getHero } from '../core/data-store.js';
import { screenManager } from '../ui/screen-manager.js';
import { writeSave } from '../save/save-manager.js';
import { emit } from '../core/ui-bridge.js';

const KEY_PREFIX = 'phagos.challenges.';

/** Basis URL share (fallback domain produksi bila bukan http). */
export function shareBaseUrl() {
  try {
    if (location.protocol.startsWith('http')) return location.origin + location.pathname;
  } catch { /* abaikan */ }
  return 'https://phagos.space/';
}

/** Simpan ringkasan run aktif (idempoten per run). @returns {{runId, url}|null} */
export function saveCurrentRun(game) {
  const run = game && game.run;
  const meta = STATE.meta;
  if (!run || !meta) return null;
  try {
    if (!run.challengeId) {
      const uid = (meta.account && meta.account.uid) || meta.guestUid || 'anon';
      run.challengeId = `${uid}-${Date.now().toString(36)}`;
    }
    const summary = {
      runId: run.challengeId,
      uid: (meta.account && meta.account.uid) || meta.guestUid || 'anon',
      username: (meta.account && meta.account.username) || 'Penjaga Tanpa Nama',
      heroId: run.heroDef ? run.heroDef.id : meta.selectedHero,
      wave: run.spawnSys ? run.spawnSys.wave : 1,
      level: run.level || 1,
      kills: run.kills || 0,
      engulfs: (run.membrane && run.membrane.stats && run.membrane.stats.engulfCount) || 0,
      mutations: [...(run.activeMutations || [])],
      victory: !!run.victory,
      date: new Date().toISOString(),
    };
    localStorage.setItem(KEY_PREFIX + run.challengeId, JSON.stringify(summary));
    return { runId: run.challengeId, url: makeChallengeUrl(run.challengeId) };
  } catch {
    return null;
  }
}

/** URL challenge untuk runId. */
export function makeChallengeUrl(runId) {
  return `${shareBaseUrl()}?challenge=${encodeURIComponent(runId)}`;
}

/** Baca ringkasan challenge (null bila tak ada / beda perangkat). */
export function getChallenge(runId) {
  if (!runId) return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + runId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Modal perbandingan challenge + tombol TANTANG BALIK. */
export function showChallengeModal(summary) {
  if (!summary) return;
  closeChallengeModal();
  const hero = getHero(summary.heroId);
  const ov = document.createElement('div');
  ov.id = 'challenge-modal';
  ov.className = 'challenge-modal';
  const box = document.createElement('div');
  box.className = 'modal-box challenge-box';
  const title = document.createElement('h2');
  title.textContent = '⚔️ TANTANGAN!';
  const sub = document.createElement('p');
  sub.className = 'challenge-sub';
  sub.textContent = `${summary.username} menantangmu dengan ${hero ? hero.name : summary.heroId}!`;
  const grid = document.createElement('div');
  grid.className = 'summary-grid';
  const rows = [
    ['Hero', hero ? hero.name : summary.heroId],
    ['Wave', String(summary.wave)],
    ['Kill', String(summary.kills)],
    ['Engulf', String(summary.engulfs)],
    ['Mutasi', summary.mutations.length > 0 ? summary.mutations.length + ' (' + summary.mutations.slice(0, 3).join(', ') + (summary.mutations.length > 3 ? '…' : '') + ')' : '—'],
    ['Hasil', summary.victory ? 'Menang' : 'Gugur'],
  ];
  for (const [k, v] of rows) {
    const r = document.createElement('div');
    r.className = 'sum-row';
    const a = document.createElement('span'); a.textContent = k;
    const b = document.createElement('b'); b.textContent = v;
    r.append(a, b);
    grid.appendChild(r);
  }
  const btns = document.createElement('div');
  btns.className = 'btn-row';
  const back = document.createElement('button');
  back.className = 'btn btn-primary';
  back.textContent = 'TANTANG BALIK';
  back.addEventListener('click', () => {
    const meta = STATE.meta;
    const owned = meta && meta.unlockedHeroes && meta.unlockedHeroes.includes(summary.heroId);
    closeChallengeModal();
    if (!owned) {
      emit('toast', { message: 'Hero penantang belum kamu miliki!', kind: 'warn' });
      screenManager.show('dashboard');
      return;
    }
    meta.selectedHero = summary.heroId;
    try { writeSave(meta); } catch { /* abaikan */ }
    screenManager.show('prep');
  });
  const close = document.createElement('button');
  close.className = 'btn';
  close.textContent = 'Tutup';
  close.addEventListener('click', closeChallengeModal);
  btns.append(back, close);
  box.append(title, sub, grid, btns);
  ov.appendChild(box);
  document.body.appendChild(ov);
}

/** Tutup modal challenge bila ada. */
export function closeChallengeModal() {
  document.getElementById('challenge-modal')?.remove();
}

/** Salin teks ke clipboard (fallback textarea bila API tak ada). */
export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
