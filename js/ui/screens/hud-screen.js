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
import { emit } from '../../core/ui-bridge.js';
import { skillIconSvg, skillPlateSvg } from '../skill-icons.js';

export function show() {
  // Combat HUD hanya menampilkan informasi yang berguna selama pertarungan.
  // Level meta hero/pasukan tetap tersedia di layar roster dan tidak diulang di arena.
}

export function hide() {
  clearAnnounce();
}

/**
 * PHAGOS D5 — baris skill PASIF: S1, S2 + ULTIMATE (posisi tetap, muscle
 * memory). BUKAN tombol cast — indikator status: ikon + overlay cooldown +
 * label pemicu (Pulse/Kill/Telan/Terluka) + kunci Lv + pip rank. Klik = info.
 */
// UI/UX BUILD 43: ikon skill PER-SKILL (33 ikon) digambar khusus dalam bahasa visual
// Imunverse (set assets/icons/menu-*.svg) — sumber tunggal js/ui/skill-icons.js, dipakai
// juga oleh Prep & detail hero. Pelat tombol = HEX SVG (outline ink → rim warna skill →
// muka krem), bukan clip-path yang memotong ring/bayangan.

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
  const views = run && run.skills ? run.skills.getView(run ? run.level : Infinity) : [];
  views.forEach((view, i) => {
    const def = getData().skills.skills.find((s) => s.id === view.id);
    const btn = document.createElement('button');
    // UI/UX RADIAL WHEEL: kelas `pos-i` menempatkan skill pada titik tetap
    // relatif terhadap PULSE (muscle memory — posisi TIDAK berubah saat unlock)
    btn.className = `ability-btn character-skill pos-${i}${view.ult ? ' ult' : ''}`;
    btn.id = `ability-${view.id}`;
    btn.dataset.slot = i;
    btn.dataset.archetype = visual.archetype;
    btn.dataset.stage = visual.stageLabel;
    btn.style.setProperty('--sk', view.color || '#35d0ba');
    btn.style.setProperty('--hero', visual.heroColor);
    btn.style.setProperty('--eq', visual.equityColor);
    btn.setAttribute('aria-label', `${view.name} (pasif, picu: ${view.triggerLabel}) — ${visual.stageLabel}`);
    const skillTitle = def?.description ? `${view.name} — ${def.description}` : view.name;
    btn.title = visual.cue ? `${skillTitle} · ${visual.stageLabel}: ${visual.cue}` : `${skillTitle} · ${visual.stageLabel}`;
    btn.innerHTML =
      skillPlateSvg() +
      `<span class="sk-bio-accent" aria-hidden="true"></span>` +
      `<span class="sk-ico sk-glyph">${skillIconSvg(def)}</span>` +
      `<span class="sk-name">${view.name}</span>` +
      `<div class="cd-fill"></div>` +
      `<span class="cd-num"></span>` +
      // PHAGOS D5: label pemicu (pengganti key-tag — tidak ada cast manual)
      `<span class="key-tag sk-trigger">${view.triggerLabel}</span>` +
      // Locked overlay: ikon kunci + level pembuka — slot TETAP di tempatnya
      `<span class="sk-lock" aria-hidden="true"><img src="assets/icons/ui-lock.svg" alt="" draggable="false"/><b>Lv ${view.unlockLevel}</b></span>` +
      // Rank pip tunggal: menyala saat rank 2 (otomatis di Lv 15)
      `<span class="sk-rank" aria-hidden="true"><i data-pip="2"></i></span>`;
    // PHAGOS D5: klik = info (nama + pemicu + deskripsi), BUKAN aksi gameplay.
    btn.addEventListener('click', () => {
      if (btn.classList.contains('locked')) {
        emitLockedHint(view);
        return;
      }
      emitPassiveInfo(view);
    });
    bar.appendChild(btn);
  });
}

/** Feedback saat skill LOCKED diklik — murni info, bukan aksi gameplay. */
let lockHintT = 0;
function emitLockedHint(view) {
  const now = performance.now();
  if (now - lockHintT < 900) return; // anti-spam toast saat spam-klik
  lockHintT = now;
  emit('toast', { message: t(`${view.name} terkunci — Terbuka di Level ${view.unlockLevel}`), kind: 'warn' });
}

/** PHAGOS D5: klik skill pasif aktif → info ringkas (nama + pemicu + rank). */
let passiveInfoT = 0;
function emitPassiveInfo(view) {
  const now = performance.now();
  if (now - passiveInfoT < 900) return;
  passiveInfoT = now;
  const rankTxt = (view.rank || 1) > 1 ? ` · Rank ${view.rank}` : '';
  emit('toast', { message: `${view.name} (pasif — picu: ${view.triggerLabel}${rankTxt})${view.desc ? ` — ${view.desc}` : ''}`, kind: 'info' });
}

/** Sinkronkan tombol skill tiap frame: overlay cooldown + angka sisa detik + lock/rank. */
export function updateAbilityBar(abilities) {
  if (!abilities) return;
  abilities.forEach((view, i) => {
    const node = document.getElementById(`ability-${view.id}`);
    if (!node) return;
    node.classList.toggle('ready', view.ready && !view.locked);
    node.classList.toggle('ult', !!view.ult);
    node.classList.toggle('locked', !!view.locked);
    node.setAttribute('aria-disabled', view.locked ? 'true' : 'false');
    const fill = node.querySelector('.cd-fill');
    const num = node.querySelector('.cd-num');
    // Fase 17 (trigger 5C): overlay cooldown SIRKULAR yang berputar
    if (fill) {
      if (view.ready || view.locked) fill.style.background = 'transparent';
      else {
        const pct = Math.max(0, Math.min(100, (view.cdLeft / view.cdTotal) * 100));
        fill.style.background = `conic-gradient(rgba(12,60,54,.42) ${pct}%, transparent ${pct}%)`;
      }
    }
    if (num) num.textContent = view.ready || view.locked ? '' : Math.ceil(view.cdLeft);
    // Rank pip tunggal: menyala saat rank 2 (otomatis di Lv 15)
    const rankNode = node.querySelector('.sk-rank');
    if (rankNode) {
      rankNode.classList.toggle('visible', (view.rank || 1) > 1);
      rankNode.querySelectorAll('i').forEach((pip) => pip.classList.toggle('on', (view.rank || 1) > 1));
    }
    if (node.dataset.lockHint !== String(!!view.locked)) node.dataset.lockHint = String(!!view.locked);
  });
}

/** Hint kontrol adaptif per perangkat (touch vs keyboard). */
function controlHintText() {
  const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  // PHAGOS: SATU TOMBOL — gerak = damage kontak, PULSE = ledakan medan.
  return isTouch
    ? 'Tarik di lantai arena untuk bergerak — sentuh musuh untuk melukai! · Tekan <span class="k">PULSE</span> untuk meledak'
    : 'Gerak: <span class="k">W</span><span class="k">A</span><span class="k">S</span><span class="k">D</span> (sentuh = luka) · Arah: <span class="k">Mouse</span> · Pulse: <span class="k">Spasi</span> · Jeda: <span class="k">Esc</span>';
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
    // Label ringkas (chip TOP-CENTER): tidak perlu dua kata — "Stage 0 Polos" kesulitan ruang.
    eqNode.textContent = stageDef?.collectionLabelShort || stageDef?.name?.replace(/^Stage\s*\d+\s*/i, '') || (stage > 0 ? `Equity ${stage}` : 'Polos');
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
  // PHAGOS: indikator PULSE + Bio-Point + mutasi aktif + membran hidup
  try { updatePulseButton(data.pulse); } catch { /* abaikan */ }
  try { updateBioChip(data.bioPoints, data.activeMutations); } catch { /* abaikan */ }
  try { updateLivingBar(data.membraneLiving); } catch { /* abaikan */ }

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

/**
 * PHAGOS: indikator radial cooldown PULSE di tombol kanan.
 * Siap = menyala + label PULSE; cooldown = overlay conic + angka detik.
 */
function updatePulseButton(pulse) {
  const btn = document.getElementById('btn-pulse');
  if (!btn) return;
  let fill = btn.querySelector('.pulse-cd');
  let num = btn.querySelector('.pulse-num');
  let lbl = btn.querySelector('.pulse-label');
  if (!fill) {
    fill = document.createElement('div');
    fill.className = 'pulse-cd';
    btn.appendChild(fill);
  }
  if (!num) {
    num = document.createElement('span');
    num.className = 'pulse-num';
    btn.appendChild(num);
  }
  if (!lbl) {
    lbl = document.createElement('span');
    lbl.className = 'pulse-label';
    lbl.textContent = 'PULSE';
    btn.appendChild(lbl);
  }
  if (!pulse) {
    fill.style.background = 'transparent';
    num.textContent = '';
    btn.classList.add('pulse-ready');
    return;
  }
  btn.classList.toggle('pulse-ready', !!pulse.ready);
  btn.classList.toggle('pulse-meta', !!pulse.metamorphosis);
  if (pulse.ready) {
    fill.style.background = 'transparent';
    num.textContent = '';
    lbl.textContent = pulse.metamorphosis ? 'META' : 'PULSE';
  } else {
    const pct = Math.max(0, Math.min(100, (pulse.cdLeft / Math.max(0.001, pulse.cdTotal)) * 100));
    fill.style.background = `conic-gradient(rgba(10,40,36,.55) ${pct}%, transparent ${pct}%)`;
    num.textContent = pulse.cdLeft >= 10 ? Math.ceil(pulse.cdLeft) : pulse.cdLeft.toFixed(1);
    lbl.textContent = pulse.metamorphosis ? 'META' : 'PULSE';
  }
}

/** PHAGOS: chip Bio-Point + ikon mutasi aktif (run-only). */
function updateBioChip(bio, mutations) {
  let chip = document.getElementById('hud-bio-chip');
  if (!chip) {
    const top = document.querySelector('.hud-top .hud-center');
    if (!top) return;
    chip = document.createElement('div');
    chip.id = 'hud-bio-chip';
    chip.className = 'hud-bio-chip';
    chip.title = 'Bio-Point: material mutasi dari engulf';
    top.appendChild(chip);
  }
  const n = bio || 0;
  const muts = mutations || [];
  const html = `<span class="bio-dot">◉</span><b>${n}</b><small>BIO</small>` +
    (muts.length > 0 ? `<span class="bio-muts" title="${muts.join(', ')}">🧬${muts.length}</span>` : '');
  if (chip.dataset.html !== html) {
    chip.innerHTML = html;
    chip.dataset.html = html;
  }
  chip.classList.toggle('rich', n >= 5);
  chip.classList.toggle('richer', n >= 15);
}

/** PHAGOS: bar HP membran hidup (mutasi medan_hidup). */
function updateLivingBar(living) {
  let wrap = document.getElementById('hud-living-wrap');
  if (!living || living.max <= 0) {
    if (wrap) wrap.classList.add('hidden');
    return;
  }
  if (!wrap) {
    const pill = document.getElementById('hp-pill');
    if (!pill || !pill.parentNode) return;
    wrap = document.createElement('div');
    wrap.id = 'hud-living-wrap';
    wrap.className = 'hud-living-wrap';
    wrap.innerHTML = '<span class="hud-living-label">MEMBRAN</span><div class="hud-living-track"><div id="hud-living-fill" class="hud-living-fill"></div></div>';
    pill.parentNode.insertBefore(wrap, pill.nextSibling);
  }
  wrap.classList.remove('hidden');
  wrap.classList.toggle('down', !!living.down);
  const fill = document.getElementById('hud-living-fill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(1, living.hp / living.max)) * 100}%`;
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
