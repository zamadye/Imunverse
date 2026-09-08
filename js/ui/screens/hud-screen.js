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

import { STATE } from '../../core/state-manager.js';
import { getData, getCharacterDesigns } from '../../core/data-store.js';
import { game } from '../../core/game.js';
import { t } from '../../systems/i18n.js';

export function show() {
  // Combat HUD hanya menampilkan informasi yang berguna selama pertarungan.
  // Level meta hero/pasukan tetap tersedia di layar roster dan tidak diulang di arena.
}

export function hide() {
  clearAnnounce();
}

/**
 * Fase 12 — grid skill ala MLBB: S1, S2 (atas) + ULTIMATE (bawah, lebar).
 * Data dari run.skills (data/skills.json) — setiap tombol punya overlay
 * cooldown (gelap + angka sisa detik) & label tombol keyboard 1/2/3.
 */
// E1 poin 2: GLYPH SVG BERKARAKTER per jenis skill — bukan ikon PNG generik.
// Setiap glyph digambar khusus: siluet tebal, satu bentuk ikonik per makna,
// currentColor supaya otomatis mengikuti warna skill (--sk).
const KIND_GLYPH = {
  // E2 poin 3: glyph berbasis MEKANISME IMUN NYATA (imunologi):
  // strike=perforin+granzim (jarum menembus membran, granzim masuk);
  // area=oxidative burst (ledakan ROS); mark=opsonisasi (antibodi menandai);
  // devour=fagositosis; annihilate=MAC C5b-9 (8 subunit membentuk pori);
  // summon_homing=antibodi netralisasi homing; instant_hits=NET
  // (Neutrophil Extracellular Trap — jaring DNA penjerat).
  strike: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 7.6a6.4 6.4 0 1 1 0 12.8 6.4 6.4 0 0 1 0-12.8zm0 2.8a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z"/><path d="M10.7 1h2.6v6.8L12 9.6l-1.3-1.8z"/><circle cx="12" cy="14" r="1.7"/></svg>',
  area: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.4"/><path d="M12 1.4l1.5 4.2h-3zM12 22.6l-1.5-4.2h3zM1.4 12l4.2-1.5v3zM22.6 12l-4.2 1.5v-3zM4.6 4.6l4 1.8-2.2 2.2zM19.4 19.4l-4-1.8 2.2-2.2zM19.4 4.6l-1.8 4-2.2-2.2zM4.6 19.4l1.8-4 2.2 2.2z"/></svg>',
  heal: '<svg viewBox="0 0 24 24"><path d="M12 21.4C7 17.2 2.6 13.6 2.6 9.2 2.6 6 5 3.8 7.8 3.8c1.7 0 3.3.8 4.2 2.1a5.2 5.2 0 0 1 4.2-2.1c2.8 0 5.2 2.2 5.2 5.4 0 4.4-4.4 8-9.4 12.2zm-1.2-12h2.4v2.8H16v2.4h-2.8v2.8h-2.4v-2.8H8v-2.4h2.8z"/></svg>',
  shield_self: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 1.8 21 5v6.6c0 5.2-3.6 9.5-9 11-5.4-1.5-9-5.8-9-11V5l9-3.2zm0 5.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2zm0 2.4a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z"/></svg>',
  protect_self: '<svg viewBox="0 0 24 24"><path d="M12 1.8 21 5v6.6c0 5.2-3.6 9.5-9 11-5.4-1.5-9-5.8-9-11V5l9-3.2zm-1.6 13.4-3-3 1.7-1.7 1.3 1.3 4.5-4.5 1.7 1.7z"/></svg>',
  buff_self: '<svg viewBox="0 0 24 24"><path d="M12 2 15 8.2l6.8 1-4.9 4.7 1.2 6.8L12 17.5l-6.1 3.2 1.2-6.8L2.2 9.2l6.8-1z"/></svg>',
  buff_allies: '<svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="3.1"/><circle cx="17" cy="8" r="3.1"/><path d="M1.6 19.4c0-3 2.4-5.4 5.4-5.4s5.4 2.4 5.4 5.4v1H1.6zm10.9 1v-1c0-1.9-.7-3.6-1.8-4.9a5.4 5.4 0 0 1 11.7 4.9v1z"/></svg>',
  mark: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 21.5a9.5 9.5 0 1 1 0-19 9.5 9.5 0 0 1 0 19zm0-2.6a6.9 6.9 0 1 0 0-13.8 6.9 6.9 0 0 0 0 13.8z" opacity=".4"/><path d="M10.9 12.4 7 7.2l1.9-1.4 3.1 4.1 3.1-4.1L17 7.2l-3.9 5.2v5.4h-2.2z"/></svg>',
  execute: '<svg viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 1 8 8c0 2.9-1.6 5.5-4 6.9V20a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-3.1A8 8 0 0 1 12 2zM9 10.2a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zm6 0a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z"/></svg>',
  annihilate: '<svg viewBox="0 0 24 24"><circle cx="12" cy="3.4" r="2"/><circle cx="12" cy="20.6" r="2"/><circle cx="3.4" cy="12" r="2"/><circle cx="20.6" cy="12" r="2"/><circle cx="5.9" cy="5.9" r="2"/><circle cx="18.1" cy="5.9" r="2"/><circle cx="5.9" cy="18.1" r="2"/><circle cx="18.1" cy="18.1" r="2"/><path fill-rule="evenodd" d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zm0 2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"/></svg>',
  summon_homing: '<svg viewBox="0 0 24 24"><path d="M5.6 9.6 3 6.1l1.6-1.2 2 2.7 2-2.7L10.2 6.1 7.6 9.6v3.2H5.6zM16.4 9.6l-2.6-3.5 1.6-1.2 2 2.7 2-2.7 1.6 1.2-2.6 3.5v3.2h-2zM11 18.4l-3-4 1.7-1.3 2.3 3.1 2.3-3.1 1.7 1.3-3 4v3.4h-2z"/></svg>',
  instant_hits: '<svg viewBox="0 0 24 24"><path d="M11 2h2v20h-2z"/><path d="M2 11h20v2H2z"/><path d="M4.6 3.2 20.8 19.4l-1.4 1.4L3.2 4.6zm14.8 0 1.4 1.4L4.6 20.8l-1.4-1.4z" opacity=".6"/><circle cx="12" cy="12" r="2.6"/></svg>',
  dash: '<svg viewBox="0 0 24 24"><path d="M2 6.6h9.8v2.4H2zm3 4.2h9.8v2.4H5zm3 4.2h9.8v2.4H8zM15 4l7 8-7 8-1.7-1.7L18.6 13H13v-2h5.6l-5.3-5.3z"/></svg>',
  pull: '<svg viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 1 9-9h-2.5A6.5 6.5 0 1 0 12 18.5zm0-5.4L7.5 11h3V4.6h3V11h3z"/></svg>',
  devour: '<svg viewBox="0 0 24 24"><path d="M20.8 7.3A9.6 9.6 0 1 0 20.8 16.7L12.4 12z"/><path d="M19.4 8.6l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z"/></svg>',
};

function currentHeroSkillVisual(run) {
  const heroDef = run?.heroDef;
  const design = heroDef ? getCharacterDesigns()?.heroes?.[heroDef.id] : null;
  const stage = Math.max(0, Math.min(4, STATE.meta.evoStage || 0));
  const eq = stage > 0 ? (design?.equity || []).find((e) => e.stage === stage) : null;
  const stageDef = (getData().evolutions.stages || []).find((s) => s.stage === stage);
  return {
    archetype: design?.archetype || 'generic',
    heroColor: heroDef?.color || '#35d0ba',
    equityColor: eq?.color || stageDef?.tierColor || heroDef?.color || '#35d0ba',
    stageLabel: stageDef?.collectionLabel || (stage > 0 ? `Equity ${stage}` : 'Polos'),
    cue: eq?.visualCue || design?.baseCue || '',
  };
}

export function buildAbilityBar() {
  const bar = document.getElementById('ability-bar');
  if (!bar) return;
  bar.textContent = '';
  const run = game.run;
  const visual = currentHeroSkillVisual(run);
  const views = run && run.skills ? run.skills.getView() : [];
  views.forEach((view, i) => {
    const def = getData().skills.skills.find((s) => s.id === view.id);
    const iconKind = def && def.effects[0] ? def.effects[0].kind : 'strike';
    const glyph = KIND_GLYPH[iconKind] || KIND_GLYPH.strike;
    const btn = document.createElement('button');
    btn.className = `ability-btn character-skill${view.ult ? ' ult' : ''}`;
    btn.id = `ability-${view.id}`;
    btn.dataset.archetype = visual.archetype;
    btn.dataset.stage = visual.stageLabel;
    btn.style.setProperty('--sk', view.color || '#35d0ba');
    btn.style.setProperty('--hero', visual.heroColor);
    btn.style.setProperty('--eq', visual.equityColor);
    btn.setAttribute('aria-label', `${view.name} — ${visual.stageLabel}`);
    btn.title = visual.cue ? `${visual.stageLabel}: ${visual.cue}` : visual.stageLabel;
    btn.innerHTML =
      `<span class="sk-bio-accent" aria-hidden="true"></span>` +
      `<span class="sk-ico sk-glyph">${glyph}</span>` +
      `<span class="sk-name">${view.name}</span>` +
      `<div class="cd-fill"></div>` +
      `<span class="cd-num"></span>` +
      `<span class="key-tag">${i + 1}</span>`;
    btn.addEventListener('click', () => game.useAbilityBySlot(i));
    bar.appendChild(btn);
  });
}

/** Sinkronkan tombol skill tiap frame: overlay cooldown + angka sisa detik. */
export function updateAbilityBar(abilities) {
  if (!abilities) return;
  abilities.forEach((view, i) => {
    const node = document.getElementById(`ability-${view.id}`);
    if (!node) return;
    node.classList.toggle('ready', view.ready);
    node.classList.toggle('ult', !!view.ult);
    const fill = node.querySelector('.cd-fill');
    const num = node.querySelector('.cd-num');
    // Fase 17 (trigger 5C): overlay cooldown SIRKULAR yang berputar
    if (fill) {
      if (view.ready) fill.style.background = 'transparent';
      else {
        const pct = Math.max(0, Math.min(100, (view.cdLeft / view.cdTotal) * 100));
        fill.style.background = `conic-gradient(rgba(12,60,54,.42) ${pct}%, transparent ${pct}%)`;
      }
    }
    if (num) num.textContent = view.ready ? '' : Math.ceil(view.cdLeft);
  });
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
  const imuEl0 = document.getElementById('hud-imu');
  if (imuEl0) imuEl0.textContent = '0';
  document.getElementById('hud-timer-text').textContent = '00:00';
  document.getElementById('hud-boss-bar-wrap').classList.add('hidden');
  document.getElementById('hp-pill').classList.remove('low');
  buildAbilityBar();

  // Portrait hero: pakai aset potret khusus (bukan sprite tubuh penuh)
  const portrait = document.getElementById('hud-portrait');
  const getter = window.__IMUNVERSE_getHeroPortrait;
  if (portrait && getter) portrait.src = getter();

  // Character Agent: chip equity stage langsung di portrait HUD gameplay.
  const eqNode = document.getElementById('hud-equity-stage');
  if (eqNode) {
    const heroDef = game.run?.heroDef || getData().heroes.heroes.find((h) => h.id === STATE.meta.selectedHero);
    const stage = Math.max(0, Math.min(4, STATE.meta.evoStage || 0));
    const stageDef = (getData().evolutions.stages || []).find((s) => s.stage === stage);
    const design = heroDef ? getCharacterDesigns()?.heroes?.[heroDef.id] : null;
    const cue = stage > 0 ? (design?.equity || []).find((e) => e.stage === stage) : null;
    const color = cue?.color || stageDef?.tierColor || heroDef?.color || '#35d0ba';
    eqNode.textContent = stageDef?.collectionLabel || stageDef?.name || (stage > 0 ? `Equity ${stage}` : 'Polos');
    eqNode.title = stage > 0 ? `${cue?.name || eqNode.textContent}: ${cue?.visualCue || ''}` : (design?.baseCue || 'Stage 0 polos');
    eqNode.style.setProperty('--eq', color);
  }

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
  // Fase 17: chip Imun Coin live (pulse halus saat angka berubah)
  const imuEl = document.getElementById('hud-imu');
  if (imuEl && imuEl.textContent !== String(data.imu ?? 0)) {
    imuEl.textContent = data.imu ?? 0;
    const chipEl = document.getElementById('hud-imu-chip');
    if (chipEl) {
      chipEl.classList.remove('imu-pulse');
      void chipEl.offsetWidth;
      chipEl.classList.add('imu-pulse');
    }
  }

  updateAbilityBar(data.abilities);
  updateBuffChips();

  // Combo pill (juice): tampil saat >= 3 kill beruntun
  // Fase 18: pill GERBANG DITUTUP — penjaga boss harus dikalahkan dulu
  const gateNode = document.getElementById('hud-gate');
  if (gateNode) {
    gateNode.classList.toggle('hidden', !data.gate);
    // Fase 18 XP BANK: label "ditahan" — XP menunggu penjaga tumbang
    const bankNode = document.getElementById('hud-gate-bank');
    if (bankNode) {
      const bank = data.gateBank || 0;
      bankNode.classList.toggle('hidden', !(data.gate && bank > 0));
      if (data.gate && bank > 0) bankNode.textContent = `+${bank} XP ${t('ditahan')}`;
    }
  }

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
