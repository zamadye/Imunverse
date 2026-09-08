/**
 * campaign-screen.js — PETA TUBUH: peta perjalanan kampanye "Perang Sang Tubuh".
 *
 * Path vertikal organ (Rongga Mulut → … → Sumbu Kehidupan). Node:
 *  - ✓ bersih  (bisa diulang)
 *  - ● AKTIF   (pulsing — bab berikutnya yang harus dikerjakan)
 *  - 🔒 terkunci (bersihkan bab sebelumnya)
 *
 * Tap node → panel BRIEFING: cerita organ sakit + tujuan misi + reward
 * + jumlah pasukan imun → CTA "SIAP TEMPUR" → Battle Prep.
 * Alur maju terus (eksplorasi), level tidak mengulang otomatis.
 */

import { STATE } from '../../core/state-manager.js';
import { markSeen } from '../../systems/codex-system.js';
import { getData } from '../../core/data-store.js';
import { writeSave } from '../../save/save-manager.js';
import { el } from '../screen-manager.js';
import { screenManager } from '../screen-manager.js';

function chapters() {
  return getData().campaign.chapters;
}

export function currentChapterId(meta) {
  const cleared = meta.campaignCleared || {};
  const next = chapters().find((c) => !cleared[c.id]);
  return next ? next.id : chapters()[chapters().length - 1].id;
}

function statusOf(ch, meta) {
  const cleared = meta.campaignCleared || {};
  if (cleared[ch.id]) return 'cleared';
  return currentChapterId(meta) === ch.id ? 'current' : 'locked';
}

function selectChapter(chId) {
  const meta = STATE.meta;
  meta.selectedChapter = chId;
  markSeen(chId); // Bio-Pedia: organ ditemui di Peta Tubuh
  writeSave(meta);
  renderAll();
}

function gotoPrep() {
  screenManager.show('prep');
}

function renderPath(meta) {
  const wrap = document.getElementById('campaign-path');
  wrap.textContent = '';
  const list = chapters();
  list.forEach((ch, i) => {
    const status = statusOf(ch, meta);
    const arenaDef = getData().arenas.arenas.find((a) => a.id === ch.arenaId) || getData().arenas.arenas[0];
    const node = el('button', {
      class: `camp-node ${status}${meta.selectedChapter === ch.id && status !== 'locked' ? ' selected' : ''}`,
      'data-ch': ch.id,
    }, [
      el('span', { class: 'camp-ico-wrap' }, [
        el('img', { class: 'camp-ico', src: arenaDef.thumb, alt: ch.organ }),
        status === 'cleared' ? el('span', { class: 'camp-check', text: '✓' }) : null,
        status === 'locked' ? el('img', { class: 'camp-lock', src: 'assets/sprites/icon_lock.png', alt: 'terkunci' }) : null,
        status === 'current' ? el('span', { class: 'camp-here', text: 'MISI' }) : null,
      ]),
      el('span', { class: 'camp-label' }, [
        el('b', { class: 'camp-organ', text: `${i + 1}. ${ch.organ}` }),
        el('span', { class: 'camp-title', text: ch.title }),
        el('span', { class: 'camp-obj', text: ch.objective }),
      ]),
    ]);
    if (status !== 'locked') node.addEventListener('click', () => selectChapter(ch.id));
    wrap.appendChild(node);
    if (i < list.length - 1) wrap.appendChild(el('div', { class: `camp-line ${status === 'cleared' ? 'done' : ''}` }));
  });
}

function renderBriefing(meta) {
  const box = document.getElementById('campaign-brief');
  box.textContent = '';
  const ch = chapters().find((c) => c.id === meta.selectedChapter) || chapters()[0];
  const status = statusOf(ch, meta);
  const clearedCount = Object.keys(meta.campaignCleared || {}).length;

  box.appendChild(el('div', { class: 'camp-brief-head' }, [
    el('b', { text: `${ch.organ} — ${ch.title}` }),
    status === 'cleared' ? el('span', { class: 'camp-badge done', text: '✓ BERSIH' }) : null,
    status === 'current' ? el('span', { class: 'camp-badge now', text: 'MISI AKTIF' }) : null,
    status === 'locked' ? el('span', { class: 'camp-badge lock', text: 'TERKUNCI' }) : null,
  ]));
  box.appendChild(el('p', { class: 'camp-story', text: `“${ch.story}”` }));
  box.appendChild(el('div', { class: 'camp-brief-meta' }, [
    el('span', { class: 'camp-goal', text: `Tujuan: ${ch.objective}` }),
    el('span', { class: 'camp-reward', text: `Reward: +${ch.reward} antibodi` }),
    el('span', { class: 'camp-squad', text: `Pasukan ikut: ${meta.allies || 1} sel imun` }),
  ]));

  const cta = el('button', { id: 'btn-campaign-go', class: 'btn btn-primary btn-camp-go' });
  cta.textContent = clearedCount === 0 ? 'MULAI PERANG PERTAMA' : (status === 'cleared' ? 'ULANGI BAB INI' : 'SIAP TEMPUR');
  cta.addEventListener('click', gotoPrep);
  box.appendChild(cta);
}

function renderAll() {
  const meta = STATE.meta;
  const cur = document.getElementById('campaign-currency');
  if (cur) cur.textContent = meta.currency.toLocaleString('id-ID');
  renderPath(meta);
  renderBriefing(meta);
}

export function show() {
  // Pastikan bab terpilih selalu bab yang sedang berjalan (bila terkunci/invalid)
  const meta = STATE.meta;
  const sel = chapters().find((c) => c.id === meta.selectedChapter);
  if (!sel || statusOf(sel, meta) === 'locked') meta.selectedChapter = currentChapterId(meta);
  renderAll();
}

export function hide() {}
