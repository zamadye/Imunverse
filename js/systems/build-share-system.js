/**
 * build-share-system.js — ADDENDUM P2 (§6.6): bagikan build via link.
 *
 * Build = hero + daftar mutasi run. Dikode base64url di `?build=` — penerima
 * melihat modal resep build + tombol "Mainkan Hero Ini" (mutasi jadi panduan
 * karena run roguelike tetap acak). Tanpa server, tanpa gambar.
 */

import { STATE } from '../core/state-manager.js';
import { getHero } from '../core/data-store.js';
import { screenManager } from '../ui/screen-manager.js';
import { writeSave } from '../save/save-manager.js';
import { emit } from '../core/ui-bridge.js';
import { mutationDef, isMutationId } from './mutation-system.js';
import { shareBaseUrl } from './challenge-system.js';

/** Ambil build dari run aktif → string kode (null bila tak ada run). */
export function encodeCurrentBuild(game) {
  const run = game && game.run;
  if (!run) return null;
  const payload = {
    v: 1,
    hero: run.heroDef ? run.heroDef.id : null,
    mut: [...(run.activeMutations || [])].filter(isMutationId),
    wave: run.spawnSys ? run.spawnSys.wave : 1,
    kills: run.kills || 0,
    by: (STATE.meta && STATE.meta.account && STATE.meta.account.username) || 'Penjaga Tanpa Nama',
  };
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return null;
  }
}

/** URL lengkap untuk kode build. */
export function makeBuildUrl(code) {
  return `${shareBaseUrl()}?build=${code}`;
}

/** Urai kode build → objek (null bila rusak). */
export function decodeBuild(code) {
  if (!code || typeof code !== 'string') return null;
  try {
    let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '='; // padding dilucuti saat encode
    const json = decodeURIComponent(escape(atob(b64)));
    const o = JSON.parse(json);
    if (!o || o.v !== 1 || !getHero(o.hero)) return null;
    o.mut = Array.isArray(o.mut) ? o.mut.filter(isMutationId) : [];
    return o;
  } catch {
    return null;
  }
}

/** Modal resep build + tombol mainkan hero yang sama. */
export function showBuildModal(build) {
  if (!build) return;
  closeBuildModal();
  const hero = getHero(build.hero);
  const ov = document.createElement('div');
  ov.id = 'build-modal';
  ov.className = 'challenge-modal';
  const box = document.createElement('div');
  box.className = 'modal-box challenge-box';
  const title = document.createElement('h2');
  title.textContent = '🧬 BUILD TEMAN';
  const sub = document.createElement('p');
  sub.className = 'challenge-sub';
  sub.textContent = `${build.by || 'Temanmu'} mencapai wave ${build.wave} (${build.kills} kill) dengan:`;
  const heroLine = document.createElement('p');
  heroLine.className = 'build-hero';
  heroLine.textContent = `Hero: ${hero ? hero.name : build.hero}`;
  const chips = document.createElement('div');
  chips.className = 'build-chips';
  if (build.mut.length === 0) {
    const none = document.createElement('small');
    none.textContent = 'Tanpa mutasi — build dasar.';
    chips.appendChild(none);
  }
  for (const id of build.mut.slice(0, 12)) {
    const def = mutationDef(id);
    const c = document.createElement('span');
    c.className = 'build-chip';
    c.textContent = def ? def.name : id;
    chips.appendChild(c);
  }
  const note = document.createElement('small');
  note.className = 'build-note';
  note.textContent = 'Mutasi bersifat panduan — setiap run tetap acak.';
  const btns = document.createElement('div');
  btns.className = 'btn-row';
  const play = document.createElement('button');
  play.className = 'btn btn-primary';
  play.textContent = 'Mainkan Hero Ini';
  play.addEventListener('click', () => {
    const meta = STATE.meta;
    const owned = meta && meta.unlockedHeroes && meta.unlockedHeroes.includes(build.hero);
    closeBuildModal();
    if (!owned) {
      emit('toast', { message: 'Hero build ini belum kamu miliki!', kind: 'warn' });
      screenManager.show('dashboard');
      return;
    }
    meta.selectedHero = build.hero;
    try { writeSave(meta); } catch { /* abaikan */ }
    screenManager.show('prep');
  });
  const close = document.createElement('button');
  close.className = 'btn';
  close.textContent = 'Tutup';
  close.addEventListener('click', closeBuildModal);
  btns.append(play, close);
  box.append(title, sub, heroLine, chips, note, btns);
  ov.appendChild(box);
  document.body.appendChild(ov);
}

/** Tutup modal build bila ada. */
export function closeBuildModal() {
  document.getElementById('build-modal')?.remove();
}
