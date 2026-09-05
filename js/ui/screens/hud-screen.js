/**
 * hud-screen.js — Gameplay HUD ala reference: pill HP cream (portrait +
 * heart + bar), wave pill teal gelap, timer chip, kill/currency chips,
 * minimap bulat, XP bar dengan chip level. Murni "view adapter".
 */

let minimapCtx = null;
let announceTimer = null;
let hintTimer = null;
let xpGhost = 0;      // trail putih yang "mengejar" fill XP (efek kejar)
let lastXpPct = 0;

import { getData } from '../../core/data-store.js';
import { STATE } from '../../core/state-manager.js';
import { game } from '../../core/game.js';
import { t } from '../../systems/i18n.js';

export function show() {
  // Level hero & pasukan (terhubung ke Lab) — diisi sekali saat run tampil
  try {
    const meta = STATE.meta;
    const heroId = meta.selectedHero;
    const heroLvl = (meta.heroLevels && meta.heroLevels[heroId]) || 0;
    const chipH = document.getElementById('hud-hero-lvl');
    const chipA = document.getElementById('hud-ally-lvl');
    if (chipH) chipH.textContent = `Hero Lv ${heroLvl}`;
    if (chipA) chipA.textContent = `Pasukan Lv ${meta.allyLevel || 0} · ${meta.allies || 1} sel`;
  } catch { /* STATE belum siap */ }
}

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
    : 'Gerak: <span class="k">W</span><span class="k">A</span><span class="k">S</span><span class="k">D</span> / panah / tarik mouse · Tembak: <span class="k">tahan tombol / Spasi</span> · Jeda: <span class="k">Esc</span>';
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
  const pct = Math.max(0, Math.min(1, data.xpPct || 0));
  // Ghost trail: kalau fill melonjak (banyak orb terambil), trail putih menyusul pelan
  if (pct < lastXpPct - 0.05) xpGhost = 1;       // naik level → mulai penuh lalu menyusut
  xpGhost = Math.max(pct, Math.min(1, xpGhost - 0.008));
  lastXpPct = pct;
  setBar('hud-xp-ghost', xpGhost);
  setBar('hud-xp-fill', pct);
  const chip = document.getElementById('hud-level');
  chip.textContent = `Lv ${data.level}`;
  chip.classList.toggle('ready', pct >= 0.8); // hampir naik level → chip menyala
  document.getElementById('hud-wave').textContent = `WAVE ${data.wave}`;
  document.getElementById('hud-timer-text').textContent = data.timerText;
  document.getElementById('hud-kills').textContent = data.kills;
  document.getElementById('hud-currency').textContent = data.currency;

  updateAbilityBar(data.abilities);
  updateBuffChips();

  // Combo pill (juice): tampil saat >= 3 kill beruntun
  const comboNode = document.getElementById('hud-combo');
  if (comboNode) {
    const count = data.combo?.count || 0;
    if (count >= 3) {
      comboNode.classList.remove('hidden');
      comboNode.innerHTML = `x${count} <small>COMBO</small>`;
      // restart animasi pop tiap kenaikan angka
      if (comboNode.dataset.last !== String(count)) {
        comboNode.dataset.last = String(count);
        comboNode.style.animation = 'none';
        void comboNode.offsetWidth;
        comboNode.style.animation = '';
      }
    } else {
      comboNode.classList.add('hidden');
      comboNode.dataset.last = '0';
    }
  }

  // Mission tracker kampanye: kuota bersih → boss
  const missionNode = document.getElementById('hud-mission');
  if (missionNode) {
    const m = data.mission;
    if (m && !m.bossSpawned) {
      missionNode.classList.remove('hidden');
      const done = Math.min(m.quota, m.kills);
      document.getElementById('hud-mission-text').textContent = `Misi: bersihkan ${m.quota} patogen (${done}/${m.quota})`;
      document.getElementById('hud-mission-fill').style.width = `${(done / m.quota) * 100}%`;
    } else if (m && m.bossSpawned) {
      missionNode.classList.remove('hidden');
      document.getElementById('hud-mission-text').textContent = `BOSS: Kalahkan ${m.bossName || 'Boss'}!`;
      document.getElementById('hud-mission-fill').style.width = '100%';
    } else {
      missionNode.classList.add('hidden');
    }
  }

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

/**
 * Fase 8.4 (dokumen entitas): chip buff tempur aktif di bawah bar atas —
 * zinc/zat besi (damage), probiotik (cooldown), serat (XP), regen (air/vit D).
 */
function updateBuffChips() {
  const el = document.getElementById('hud-buffs');
  if (!el) return;
  const run = game.run;
  if (!run || !run.tempBuffs) {
    if (el.dataset.html) { el.innerHTML = ''; el.dataset.html = ''; }
    return;
  }
  const defs = {
    damage: ['item_zat_besi', t('DMG')],
    cooldown: ['item_probiotik', t('CEPAT')],
    xp: ['item_serat', t('XP')],
  };
  let html = '';
  for (const k of Object.keys(defs)) {
    const b = run.tempBuffs[k];
    if (b && b.t > 0) {
      html += `<span class="hud-buff-chip"><img src="assets/sprites/${defs[k][0]}.png" alt="" />${defs[k][1]} ${Math.ceil(b.t)}s</span>`;
    }
  }
  if (run.permBoost && run.permBoost.regen > 0) {
    html += '<span class="hud-buff-chip"><img src="assets/sprites/item_air.png" alt="" />REGEN</span>';
  }
  if (el.dataset.html !== html) {
    el.innerHTML = html;
    el.dataset.html = html;
  }
}
