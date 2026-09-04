/**
 * hud-screen.js — Gameplay HUD ala reference: pill HP cream (portrait +
 * heart + bar), wave pill teal gelap, timer chip, kill/currency chips,
 * minimap bulat, XP bar dengan chip level. Murni "view adapter".
 */

let minimapCtx = null;
let announceTimer = null;
let hintTimer = null;

import { getData } from '../../core/data-store.js';
import { game } from '../../core/game.js';

export function show() {}

export function hide() {
  clearAnnounce();
}

/**
 * Bangun 4 tombol kemampuan (1 senjata + 3 kekuatan) dari data/abilities.json.
 * Slot terkunci (belum terbuka via evolusi) tetap tampil redup — jadi user
 * selalu melihat ada yang harus dikejar.
 */
export function buildAbilityBar() {
  const bar = document.getElementById('ability-bar');
  if (!bar) return;
  bar.textContent = '';
  for (const def of getData().abilities.abilities) {
    const btn = document.createElement('button');
    btn.className = 'ability-btn';
    btn.id = `ability-${def.id}`;
    btn.setAttribute('aria-label', def.name);
    btn.innerHTML = `<span class="slot-tag">${def.slot}</span>` +
      `<img src="${def.icon}" alt="${def.name}" />` +
      `<div class="cd-fill"></div>` +
      `<span class="key-tag">${def.key}</span>`;
    btn.addEventListener('click', () => game.useAbilityBySlot(def.slot));
    bar.appendChild(btn);
  }
}

/** Sinkronkan tampilan tombol kemampuan tiap frame (cooldown/lock/ready). */
export function updateAbilityBar(abilities) {
  if (!abilities) return;
  for (const view of abilities) {
    const node = document.getElementById(`ability-${view.id}`);
    if (!node) continue;
    node.classList.toggle('locked', !view.unlocked);
    node.classList.toggle('ready', view.ready);
    const fill = node.querySelector('.cd-fill');
    if (fill) {
      const pct = view.unlocked && view.cdLeft > 0 ? view.cdLeft / view.cdTotal : 0;
      fill.style.height = `${pct * 100}%`;
    }
  }
}

/** Hint kontrol adaptif per perangkat (touch vs keyboard). */
function controlHintText() {
  const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  return isTouch
    ? 'Sentuh & tarik di mana saja untuk bergerak'
    : 'Gerak: <span class="k">W</span><span class="k">A</span><span class="k">S</span><span class="k">D</span> / panah / tarik mouse · Jeda: <span class="k">Esc</span>';
}

/** Reset elemen HUD di awal run (dipanggil via event runstart). */
export function resetHUD() {
  setBar('hud-hp-fill', 1);
  setBar('hud-xp-fill', 0);
  document.getElementById('hud-kills').textContent = '0';
  document.getElementById('hud-currency').textContent = '0';
  document.getElementById('hud-timer-text').textContent = '00:00';
  document.getElementById('hud-boss-bar-wrap').classList.add('hidden');
  document.getElementById('hp-pill').classList.remove('low');
  const comboWrap = document.getElementById('hud-combo');
  if (comboWrap) comboWrap.classList.add('hidden');
  buildAbilityBar();

  // Portrait hero: pakai aset potret khusus (bukan sprite tubuh penuh)
  const portrait = document.getElementById('hud-portrait');
  const getter = window.__IMUNVERSE_getHeroPortrait;
  if (portrait && getter) portrait.src = getter();

  // Hint kontrol (hilang sendiri setelah 8 detik)
  const hint = document.getElementById('hud-hint');
  hint.innerHTML = controlHintText();
  hint.style.display = '';
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { hint.style.display = 'none'; }, 8000);
}

/** Update HUD tiap frame (dipanggil dari game.render). */
export function updateHUD(data) {
  setBar('hud-hp-fill', data.hpPct);
  document.getElementById('hud-hp-text').textContent = data.hpText;
  document.getElementById('hp-pill').classList.toggle('low', data.hpPct < 0.3);
  setBar('hud-xp-fill', Math.max(0, Math.min(1, data.xpPct)));
  document.getElementById('hud-level').textContent = `Lv ${data.level}`;
  document.getElementById('hud-wave').textContent = `WAVE ${data.wave}`;
  document.getElementById('hud-timer-text').textContent = data.timerText;
  document.getElementById('hud-kills').textContent = data.kills;
  document.getElementById('hud-currency').textContent = data.currency;

  updateCombo(data.combo || 0);
  updateAbilityBar(data.abilities);

  const bossWrap = document.getElementById('hud-boss-bar-wrap');
  if (data.boss) {
    bossWrap.classList.remove('hidden');
    setBar('hud-boss-fill', Math.max(0, Math.min(1, data.boss.pct)));
    document.getElementById('hud-boss-name').textContent = data.boss.name.toUpperCase();
  } else {
    bossWrap.classList.add('hidden');
  }
}

function setBar(id, pct) {
  const node = document.getElementById(id);
  if (node) node.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
}

// ---------------------------------------------------------------------
// Combo counter (Fase 6 — juice). Muncul saat combo ≥ 2, tier warna naik
// di 10+ / 20+, dan "pop" saat milestone (event 'combo' dari game.js).
// ---------------------------------------------------------------------
const COMBO_TIERS = [
  { at: 20, className: 'blaze' },
  { at: 10, className: 'hot' },
];
const comboNodeId = 'hud-combo';
const comboCountId = 'hud-combo-count';

export function updateCombo(count) {
  const wrap = document.getElementById(comboNodeId);
  if (!wrap) return;
  if (count < 2) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  document.getElementById(comboCountId).textContent = String(count);
  const tierCls = COMBO_TIERS.find((t) => count >= t.at)?.className || '';
  wrap.classList.toggle('blaze', tierCls === 'blaze');
  wrap.classList.toggle('hot', tierCls === 'hot');
}

/** Pop + sfx visual saat mencapai milestone combo (5/10/20/…). */
export function popCombo(combo) {
  const wrap = document.getElementById(comboNodeId);
  if (!wrap) return;
  wrap.style.animation = 'none';
  void wrap.offsetWidth; // restart animasi
  wrap.style.animation = '';
  wrap.classList.add('pop');
  setTimeout(() => wrap.classList.remove('pop'), 450);
}

/** Banner pengumuman wave / boss (pill besar ala mockup). */
export function showAnnounce(text, isBoss = false) {
  const node = document.getElementById('hud-announce');
  if (!node) return;
  clearAnnounce();
  node.textContent = text;
  node.className = 'hud-announce' + (isBoss ? ' boss' : '');
  // restart CSS animation
  node.style.animation = 'none';
  void node.offsetWidth;
  node.style.animation = '';
  announceTimer = setTimeout(() => {
    node.classList.add('hidden');
  }, 1900);
}

function clearAnnounce() {
  const node = document.getElementById('hud-announce');
  if (node) node.classList.add('hidden');
  if (announceTimer) {
    clearTimeout(announceTimer);
    announceTimer = null;
  }
}

/** Konteks canvas minimap untuk digambar game (shape-renderer.drawMinimap). */
export function getMinimapContext() {
  if (!minimapCtx) {
    const canvas = document.getElementById('hud-minimap');
    if (!canvas) return null;
    minimapCtx = canvas.getContext('2d');
  }
  return minimapCtx;
}
