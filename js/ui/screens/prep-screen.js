/**
 * prep-screen.js — BATTLE PREP: SATU layar, SATU keputusan (pola Archero/Survivor.io).
 *
 * UI/UX Task 3 (pre-run 4 langkah → maks 1–2):
 *  1. Hero — satu-satunya keputusan esensial; selalu tampil.
 *  2. Mode — HANYA bila Endless sudah terbuka (≥1 bab kampanye tamat); sebelum itu
 *     baris mode tidak dirender dan mode dipaksa `kampanye` (default otomatis).
 *  Fokus Run & Arena dihapus dari alur:
 *  - fokusRun → selalu `seimbang` (body-system di-PARK per docs/v2/phase-00 §3; nilai
 *    fokus tak terasa pemain) — data & sistemnya tidak disentuh.
 *  - arena → kampanye: ditentukan bab (game.getRunArena, sudah begitu sejak R2);
 *    endless: arena terbuka terbaik dipilih otomatis (auto-default, bukan pertanyaan).
 *  Ringkasan loadout tetap menampilkan mode/bab/arena hasil default agar transparan.
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { writeSave } from '../../save/save-manager.js';
import { getHeroStatus } from '../../systems/unlock-system.js';
import { getEvoStageDef } from '../../systems/evolution-system.js';
import { arenaUnlockStatus } from './arena-screen.js';
import { getModeUnlockStatus, getTodayMutator } from '../../systems/liveops-system.js';
import { playOnce } from '../cinematic.js';
import { playCutscene } from '../cutscene-player.js'; // R3 (Narrative-Cinematic): transisi bab
import { heroLevelBadge } from '../../systems/economy-system.js';
import { game } from '../../core/game.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { el } from '../screen-manager.js';
import { skillChip } from '../skill-icons.js';

let heroRowWired = false;

function selectHero(heroId) {
  const meta = STATE.meta;
  meta.selectedHero = heroId;
  writeSave(meta);
  renderAll();
}

function selectMode(modeId) {
  const meta = STATE.meta;
  meta.selectedMode = modeId;
  writeSave(meta);
  renderAll();
}

/** Mode yang bisa dipilih pemain saat ini (default selalu ada). */
function unlockedModes(meta) {
  return getData().modes.modes.filter((m) => getModeUnlockStatus(m, meta).unlocked);
}

/**
 * Auto-default pilihan non-esensial (idempoten, dipanggil tiap show()):
 * mode valid, fokus seimbang, arena otomatis. Mengembalikan true bila ada perubahan.
 */
export function applyPrepDefaults(meta = STATE.meta) {
  let changed = false;
  const modes = unlockedModes(meta);
  const wanted = meta.selectedMode || 'kampanye';
  if (!modes.some((m) => m.id === wanted)) {
    meta.selectedMode = (modes.find((m) => m.id === 'kampanye') || modes[0] || { id: 'kampanye' }).id;
    changed = true;
  }
  if (meta.focusRun !== 'seimbang') { meta.focusRun = 'seimbang'; changed = true; }
  if (meta.selectedMode !== 'kampanye') {
    // Endless: arena terbuka TERAKHIR (terbaik) — variasi tanpa bertanya
    const list = getData().arenas.arenas;
    const open = list.filter((a) => arenaUnlockStatus(a, meta).unlocked);
    const best = open[open.length - 1] || list[0];
    if (best && meta.selectedArena !== best.id) { meta.selectedArena = best.id; changed = true; }
  }
  if (changed) writeSave(meta);
  return changed;
}

function renderModeRow(meta) {
  const block = document.getElementById('prep-mode-block');
  const row = document.getElementById('prep-mode-row');
  if (!block || !row) return;
  row.textContent = '';
  const modes = unlockedModes(meta);
  // Belum ada pilihan nyata (hanya Kampanye) → baris tidak ditampilkan sama sekali
  block.classList.toggle('hidden', modes.length < 2);
  if (modes.length < 2) return;
  const mutToday = getTodayMutator();
  for (const modeDef of modes) {
    const selected = (meta.selectedMode || 'kampanye') === modeDef.id;
    const chip = el('button', { class: `prep-chip mode${selected ? ' selected' : ''}`, title: modeDef.description }, [
      el('img', { src: modeDef.icon, alt: '' }),
      el('span', { text: modeDef.name }),
      modeDef.id === 'endless' ? el('small', { class: 'chip-sub', text: `Mutator: ${mutToday.def.name}` }) : null,
    ]);
    if (!selected) chip.addEventListener('click', () => selectMode(modeDef.id));
    row.appendChild(chip);
  }
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
        ? el('span', { class: 'ph-stage', style: `background:${stageDef.tierColor}`, text: `T${stageDef.stage + 1} · ${heroLevelBadge(meta, heroDef.id)}` })
        : el('img', { class: 'ph-lock', src: 'assets/icons/ui-lock.svg', alt: 'terkunci' }),
    ]);
    if (status.unlocked) item.addEventListener('click', () => selectHero(heroDef.id));
    row.appendChild(item);
  }
}

/** Ringkasan loadout: hero + tahap evolusi + skill + (mode · bab/arena hasil default). */
function renderSummary(meta) {
  const box = document.getElementById('prep-summary');
  box.textContent = '';
  const heroDef = getData().heroes.heroes.find((h) => h.id === meta.selectedHero) || getData().heroes.heroes[0];
  const stageDef = getEvoStageDef(meta);
  const arenaDef = game.getRunArena(); // sumber kebenaran yang sama dengan startRun

  // Fase 12: loadout = 3 skill aktif hero (S1/S2/Ult) dari data/skills.json
  const skillDefs = (heroDef.skills || []).map((id) => getData().skills.skills.find((s) => s.id === id)).filter(Boolean);

  box.appendChild(el('img', { class: 'ps-hero', src: spriteToDataURL(heroDef.spriteIdle), alt: heroDef.name }));
  const mid = el('div', { class: 'ps-mid' }, [
    el('b', { text: heroDef.name }),
    el('span', { class: 'ps-tier', style: `color:${stageDef.tierColor}`, text: `${stageDef.name} · ${stageDef.tier}` }),
    // UI/UX BUILD 43: chip hex + ikon per-skill yang sama dengan HUD (js/ui/skill-icons.js)
    el('span', { class: 'ps-abilities' }, skillDefs.length
      ? skillDefs.map((s, i) => skillChip(s, { ult: i === 2, cls: 'ps-skill-chip', title: `${s.name} (tombol ${i + 1}) — ${s.description}` }))
      : [el('span', { class: 'ps-noab', text: 'Kemampuan terbuka lewat evolusi' })]),
  ]);
  box.appendChild(mid);
  const modeDef = getData().modes.modes.find((m) => m.id === (meta.selectedMode || 'kampanye')) || getData().modes.modes[0];
  const chapter = modeDef.id === 'kampanye' && getData().campaign
    ? (getData().campaign.chapters.find((c) => c.id === meta.selectedChapter) || getData().campaign.chapters[0])
    : null;
  box.appendChild(el('div', { class: 'ps-meta' }, [
    el('div', {}, [
      el('img', { src: modeDef.icon, alt: '' }),
      el('span', { text: chapter ? `${modeDef.name} · ${chapter.organ}` : modeDef.name }),
    ]),
    el('div', {}, [
      el('img', { src: arenaDef.thumb, alt: '' }),
      el('span', { text: arenaDef.name }),
    ]),
  ]));
}

function renderAll() {
  const meta = STATE.meta;
  applyPrepDefaults(meta);
  document.getElementById('prep-currency').textContent = meta.currency.toLocaleString('id-ID');
  renderHeroRow(meta);
  renderModeRow(meta);
  renderSummary(meta);
  // tombol MULAI
  const heroDef = getData().heroes.heroes.find((h) => h.id === meta.selectedHero);
  const status = heroDef ? getHeroStatus(meta, heroDef) : null;
  const btn = document.getElementById('btn-prep-start');
  btn.disabled = !(status && status.unlocked);
  btn.textContent = status && status.unlocked ? `MULAI — ${heroDef.name.toUpperCase()}` : 'PILIH HERO DULU';
}

export function show() {
  syncCampaignArenaDefault(); // MAP: default picker = organ bab
  renderAll();
  if (!heroRowWired) {
    heroRowWired = true;
    document.getElementById('btn-prep-start').addEventListener('click', () => {
      // RONDE-6: full-screen dari gesture MULAI (idempoten; anti-gagal)
      try {
        const d = document.documentElement;
        const p = d.requestFullscreen || d.webkitRequestFullscreen || d.mozRequestFullScreen || d.msRequestFullscreen;
        if (p) d[p]().catch?.(() => {});
      } catch { /* noop */ }
      try { screen.orientation?.lock?.('landscape').catch?.(() => {}); } catch { /* noop */ }
      const meta = STATE.meta;
      const heroDef = getData().heroes.heroes.find((h) => h.id === meta.selectedHero);
      if (!heroDef) return;
      const status = getHeroStatus(meta, heroDef);
      if (!status.unlocked) return;
      applyPrepDefaults(meta); // MAP: normalisasi pilihan prep (mode/arena/fokus)
      // R3 (Narrative-Cinematic): bab BARU → cutscene produksi 2-panel
      // (naskah final bila ada: 6.2 utk bab_demam; teks R2 utk sisanya).
      // bab_luka memakai CUTSCENE PEMBUKA (6.1) bila belum pernah dilihat.
      // Kampanye: bab BARU tanpa cutscene produksi → sinematik briefing (story organ sakit)
      const cs = getData().cutscenes;
      const prodId = meta.selectedChapter === 'bab_luka' ? 'pembuka' : ('transisi_' + meta.selectedChapter);
      const prod = cs && cs.scenes ? cs.scenes[prodId] : null;
      const prodNew = prod && !(meta.cinematicsSeen || {})[prod.seenKey];
      const isCampaignNew = meta.selectedMode === 'kampanye'
        && (prodNew || !(meta.cinematicsSeen || {})['brief_' + meta.selectedChapter]);
      if (prodNew) {
        playCutscene(prodId, () => game.startRun(heroDef.id));
      } else if (isCampaignNew) {
        playOnce('brief_' + meta.selectedChapter, () => game.startRun(heroDef.id));
      } else {
        game.startRun(heroDef.id); // 'runstart' → HUD
      }
    });
  }
}

// MAP: di mode kampanye, default-kan pilihan arena ke organ bab aktif agar
// penceritaan bab (organ sakit) selaras dengan map ter-render. Pemain tetap
// bebas memilih organ lain — getRunArena menghormati pilihan yang terbuka.
function syncCampaignArenaDefault() {
  const meta = STATE.meta;
  if (meta.selectedMode !== 'kampanye' || !getData().campaign) return;
  const chs = getData().campaign.chapters;
  const ch = chs.find((c) => c.id === meta.selectedChapter) || chs[0];
  if (ch && ch.arenaId && meta.selectedArena !== ch.arenaId) meta.selectedArena = ch.arenaId;
}

export function hide() {}
