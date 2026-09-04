/**
 * prep-screen.js — BATTLE PREP: satu layar keputusan sebelum run
 * (pola Archero/Survivor.io): pilih hero → fokus run → arena → MULAI.
 * Semua pilihan pre-run yang tadinya tersebar di dashboard/modal kini
 * ada di alur linier yang sama, dengan CTA MULAI yang selalu terlihat.
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { writeSave } from '../../save/save-manager.js';
import { getHeroStatus } from '../../systems/unlock-system.js';
import { getEvoStageDef } from '../../systems/evolution-system.js';
import { arenaUnlockStatus } from './arena-screen.js';
import { getModeUnlockStatus, getTodayMutator } from '../../systems/liveops-system.js';
import { playOnce } from '../cinematic.js';
import { game } from '../../core/game.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { el } from '../screen-manager.js';

let heroRowWired = false;

function selectHero(heroId) {
  const meta = STATE.meta;
  meta.selectedHero = heroId;
  writeSave(meta);
  renderAll();
}

function selectFocus(focusId) {
  const meta = STATE.meta;
  meta.focusRun = focusId;
  writeSave(meta);
  renderAll();
}

function selectMode(modeId) {
  const meta = STATE.meta;
  meta.selectedMode = modeId;
  writeSave(meta);
  renderAll();
}

function renderModeRow(meta) {
  const row = document.getElementById('prep-mode-row');
  row.textContent = '';
  const mutToday = getTodayMutator();
  for (const modeDef of getData().modes.modes) {
    const status = getModeUnlockStatus(modeDef, meta);
    const selected = (meta.selectedMode || 'normal') === modeDef.id && status.unlocked;
    const chip = el('button', {
      class: `prep-chip mode${selected ? ' selected' : ''}${status.unlocked ? '' : ' locked'}`,
      title: modeDef.description,
    }, [
      el('img', { src: modeDef.icon, alt: '' }),
      el('span', { text: modeDef.name }),
      modeDef.id === 'endless' && status.unlocked
        ? el('small', { class: 'chip-sub', text: `Mutator: ${mutToday.def.name}` })
        : null,
      status.unlocked ? null : el('small', { class: 'chip-sub lock', text: status.label }),
    ]);
    if (status.unlocked && !selected) chip.addEventListener('click', () => selectMode(modeDef.id));
    row.appendChild(chip);
  }
}

function selectArena(arenaId) {
  const meta = STATE.meta;
  meta.selectedArena = arenaId;
  writeSave(meta);
  renderAll();
}

function renderHeroRow(meta) {
  const row = document.getElementById('prep-hero-row');
  row.textContent = '';
  const heroes = getData().heroes.heroes;
  for (const heroDef of heroes) {
    const status = getHeroStatus(meta, heroDef);
    const selected = meta.selectedHero === heroDef.id;
    const stageDef = getEvoStageDef({ evoStage: meta.evoStage || 0 });
    const item = el('button', {
      class: `prep-hero${selected ? ' selected' : ''}${status.unlocked ? '' : ' locked'}`,
      title: heroDef.name,
    }, [
      el('img', { class: 'ph-sprite', src: spriteToDataURL(heroDef.spriteIdle), alt: heroDef.name }),
      el('span', { class: 'ph-name', text: heroDef.name.split(' ').slice(0, 2).join(' ') }),
      status.unlocked
        ? el('span', { class: 'ph-stage', style: `background:${stageDef.tierColor}`, text: `T${stageDef.stage + 1}` })
        : el('img', { class: 'ph-lock', src: 'assets/sprites/icon_lock.png', alt: 'terkunci' }),
    ]);
    if (status.unlocked) item.addEventListener('click', () => selectHero(heroDef.id));
    row.appendChild(item);
  }
}

function renderFocusRow(meta) {
  const row = document.getElementById('prep-focus-row');
  row.textContent = '';
  for (const focusDef of getData().bodySystems.focusRuns) {
    const selected = (meta.focusRun || 'seimbang') === focusDef.id;
    const chip = el('button', { class: `prep-chip${selected ? ' selected' : ''}` }, [
      el('img', { src: focusDef.icon, alt: '' }),
      el('span', { text: focusDef.name.replace('Run ', '') }),
    ]);
    if (!selected) chip.addEventListener('click', () => selectFocus(focusDef.id));
    row.appendChild(chip);
  }
}

function renderArenaRow(meta) {
  const row = document.getElementById('prep-arena-row');
  row.textContent = '';
  for (const arenaDef of getData().arenas.arenas) {
    const status = arenaUnlockStatus(arenaDef, meta);
    const selected = meta.selectedArena === arenaDef.id && status.unlocked;
    const chip = el('button', { class: `prep-chip arena${selected ? ' selected' : ''}${status.unlocked ? '' : ' locked'}` }, [
      el('img', { src: arenaDef.thumb, alt: '' }),
      el('span', { text: arenaDef.name }),
    ]);
    if (status.unlocked && !selected) chip.addEventListener('click', () => selectArena(arenaDef.id));
    row.appendChild(chip);
  }
}

/** Ringkasan loadout: hero + tahap evolusi + kemampuan terbuka + fokus + arena. */
function renderSummary(meta) {
  const box = document.getElementById('prep-summary');
  box.textContent = '';
  const heroDef = getData().heroes.heroes.find((h) => h.id === meta.selectedHero) || getData().heroes.heroes[0];
  const stageDef = getEvoStageDef(meta);
  const focusDef = getData().bodySystems.focusRuns.find((f) => f.id === (meta.focusRun || 'seimbang'));
  const arenaDef = getData().arenas.arenas.find((a) => a.id === meta.selectedArena) || getData().arenas.arenas[0];

  const abilityIds = getData().evolutions.stages
    .filter((st) => st.stage <= stageDef.stage && st.ability)
    .map((st) => st.ability);
  const abilityDefs = getData().abilities.abilities.filter((a) => abilityIds.includes(a.id));

  box.appendChild(el('img', { class: 'ps-hero', src: spriteToDataURL(heroDef.spriteIdle), alt: heroDef.name }));
  const mid = el('div', { class: 'ps-mid' }, [
    el('b', { text: heroDef.name }),
    el('span', { class: 'ps-tier', style: `color:${stageDef.tierColor}`, text: `${stageDef.name} · ${stageDef.tier}` }),
    el('span', { class: 'ps-abilities' }, abilityDefs.length
      ? abilityDefs.map((a) => el('img', { src: a.icon, alt: a.name, title: `${a.name} (${a.key.toUpperCase()})` }))
      : [el('span', { class: 'ps-noab', text: 'Kemampuan terbuka lewat evolusi' })]),
  ]);
  box.appendChild(mid);
  const modeDef = (getData().modes.modes).find((m) => m.id === (meta.selectedMode || 'normal')) || getData().modes.modes[0];
  box.appendChild(el('div', { class: 'ps-meta' }, [
    el('div', {}, [
      el('img', { src: modeDef.icon, alt: '' }),
      el('span', { text: modeDef.name }),
    ]),
    el('div', {}, [
      el('img', { src: focusDef.icon, alt: '' }),
      el('span', { text: focusDef.name }),
    ]),
    el('div', {}, [
      el('img', { src: arenaDef.thumb, alt: '' }),
      el('span', { text: arenaDef.name }),
    ]),
  ]));
}

function renderAll() {
  const meta = STATE.meta;
  document.getElementById('prep-currency').textContent = meta.currency.toLocaleString('id-ID');
  renderHeroRow(meta);
  renderModeRow(meta);
  renderFocusRow(meta);
  renderArenaRow(meta);
  renderSummary(meta);
  // tombol MULAI
  const heroDef = getData().heroes.heroes.find((h) => h.id === meta.selectedHero);
  const status = heroDef ? getHeroStatus(meta, heroDef) : null;
  const btn = document.getElementById('btn-prep-start');
  btn.disabled = !(status && status.unlocked);
  btn.textContent = status && status.unlocked ? `MULAI — ${heroDef.name.toUpperCase()}` : 'PILIH HERO DULU';
}

export function show() {
  renderAll();
  if (!heroRowWired) {
    heroRowWired = true;
    document.getElementById('btn-prep-start').addEventListener('click', () => {
      const meta = STATE.meta;
      const heroDef = getData().heroes.heroes.find((h) => h.id === meta.selectedHero);
      if (!heroDef) return;
      const status = getHeroStatus(meta, heroDef);
      if (!status.unlocked) return;
      // Kampanye: bab BARU diprakarsai sinematik briefing (story organ sakit)
      const isCampaignNew = meta.selectedMode === 'kampanye'
        && !(meta.cinematicsSeen || {})['brief_' + meta.selectedChapter];
      if (isCampaignNew) {
        playOnce('brief_' + meta.selectedChapter, () => game.startRun(heroDef.id));
      } else {
        game.startRun(heroDef.id); // 'runstart' → HUD
      }
    });
  }
}

export function hide() {}
