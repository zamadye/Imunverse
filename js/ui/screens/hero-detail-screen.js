/**
 * hero-detail-screen.js — DETAIL & UPGRADE HERO (dibuka dari menu Heroes).
 *
 * UI/UX REBUILD — SINGLE-HERO FOCUS SCREEN:
 *   • Satu hero tampil besar di tengah (visual anchor) — carousel ❮ ❯ / swipe.
 *   • Rails: SKILL di kiri (ikon → modal detail), TROOPS/LOADOUT di kanan.
 *   • Strip stat inti di bawah (DMG / HP / DEF / PWR) + aksi upgrade.
 *   • Semua detail sekunder (detail skill, detail pasukan, jalur equity) =
 *     MODAL overlay — overview utama muat dalam SATU viewport.
 * Kelas lama yang dipakai suite E2E (.hl-equity-card/.hl-passive/.hl-mastery/
 * .btn-hl-up/.btn-ally-up/.hl-arrow) dipertahankan.
 */

import { STATE } from '../../core/state-manager.js';
import { getData, getCharacterDesigns } from '../../core/data-store.js';
import { el, screenManager } from '../screen-manager.js';
import { skillChip } from '../skill-icons.js';
import { roleIconSrc, roleTint } from '../menu-icons.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { createHeroEquityPreview } from '../../render/character-preview.js';
import { heroLevelCost, purchaseHeroLevel, allyLevelCost, purchaseAllyLevel } from '../../systems/economy-system.js';
import { getEvoStageDef } from '../../systems/evolution-system.js';
import { squadMultipliers } from '../../systems/upgrade-system.js';
import { t as tr } from '../../systems/i18n.js';
import { masteryInfo } from '../../systems/mastery-system.js'; // V2 Phase 6
import { SKILL_UNLOCK_LEVELS, SKILL_UPGRADE_LEVEL, SKILL_MAX_RANK } from '../../systems/skill-unlock.js';

let heroId = null;
let keyHandler = null;

/* ================================================================
   MODAL — satu lapisan overlay per screen; konten disuntik per jenis.
   ================================================================ */
let modalWrap = null;

function ensureModal() {
  if (modalWrap && document.contains(modalWrap)) return modalWrap;
  const host = document.getElementById('screen-herodetail');
  modalWrap = el('div', { class: 'hd-modal hidden', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'hd-modal-backdrop', onclick: () => closeModal() }),
    el('div', { class: 'hd-modal-box' }, [
      el('button', { class: 'hd-modal-close', 'aria-label': tr('Tutup'), text: '✕', onclick: () => closeModal() }),
      el('div', { class: 'hd-modal-content', id: 'hd-modal-content' }),
      // Slot tersembunyi: jalur equity SELALU hadir di DOM screen ini (dipindah
      // ke #hd-modal-content saat modal dibuka, kemudian dikembalikan ke sini).
      el('div', { id: 'hd-equity-slot' }),
    ]),
  ]);
  host.appendChild(modalWrap);
  return modalWrap;
}

function openModal(contentNode) {
  const wrap = ensureModal();
  const box = wrap.querySelector('#hd-modal-content');
  box.textContent = '';
  box.appendChild(contentNode);
  wrap.classList.remove('hidden');
}

function closeModal() {
  if (!modalWrap) return;
  modalWrap.classList.add('hidden');
  // Kembalikan kartu equity ke slot tersembunyi & kosongkan konten modal.
  const content = modalWrap.querySelector('#hd-modal-content');
  const equityCard = content ? content.querySelector('.hl-equity-card') : null;
  const slot = modalWrap.querySelector('#hd-equity-slot');
  if (equityCard && slot) slot.appendChild(equityCard);
  if (content && content.firstChild) content.textContent = '';
}

/* ---------- Konten modal: DETAIL SKILL ---------- */
function describeSkillEffects(def) {
  return (def.effects || []).map((fx) => {
    switch (fx.kind) {
      case 'area': return tr(`Ledakan area — radius ${fx.radius}, damage ×${fx.mult || 1}`);
      case 'strike': return tr(`Serangan tunggal — damage ×${fx.mult || 1}`);
      case 'heal': return tr(`Pulihkan ${fx.amount} HP`) + (fx.radius ? tr(' (+area)') : '');
      case 'shield_self': return tr(`Perisai +${fx.amount}`);
      case 'buff_self': {
        const bits = [];
        if (fx.damage) bits.push(`DMG +${fx.damage}%`);
        if (fx.speed) bits.push(`speed +${fx.speed}%`);
        if (fx.cd) bits.push(`cooldown −${fx.cd}%`);
        return tr(`Buff diri ${fx.duration}s — `) + bits.join(', ');
      }
      case 'dash': return tr(`Dash ${fx.distance}px + kebal sesaat`);
      case 'pull': return tr(`Tarik musuh — radius ${fx.radius}`);
      case 'devour': return tr(`Telan musuh sekarat — jadi bahan bakar`);
      case 'execute': return tr(`Eksekusi bila target sekarat (×${fx.execMult})`);
      case 'mark': return tr(`Tandai target — damage diterima +${fx.dmg}% (${fx.duration}s)`);
      case 'summon_homing': return tr(`Luncurkan ${fx.count || 3} proyektil pemburu`);
      case 'instant_hits': return tr(`Hantaman beruntun ×${fx.hits || 3}`);
      case 'annihilate': return tr(`Anihilasi target + percikan area`);
      default: return fx.kind;
    }
  });
}

function buildSkillModalContent(heroDef, index) {
  const skillDefs = (heroDef.skills || []).map((id) => getData().skills.skills.find((sk) => sk.id === id)).filter(Boolean);
  const def = skillDefs[index];
  if (!def) return el('div', { text: '—' });
  const isUlt = index === 2;
  const unlockLv = SKILL_UNLOCK_LEVELS[index];
  return el('div', { class: 'hd-skill-detail', style: `--sk:${def.color || heroDef.color}` }, [
    el('div', { class: 'hd-skill-detail-head' }, [
      el('div', { class: 'hd-skill-modal-ico' }, [skillChip(def, { ult: isUlt, cls: 'hd-skill-modal-chip' })]),
      el('div', { class: 'hd-skill-detail-titles' }, [
        el('b', { class: 'hd-skill-detail-name', text: tr(def.name) }),
        el('span', { class: 'hd-skill-detail-tag', text: `${isUlt ? 'ULTIMATE · ' : ''}SLOT ${index + 1} · CD ${def.cooldown}s` }),
      ]),
    ]),
    el('p', { class: 'hd-skill-detail-desc', text: tr(def.description || '') }),
    el('div', { class: 'hd-skill-detail-sec' }, [
      el('b', { text: tr('Efek') }),
      el('ul', { class: 'hd-skill-effects' }, describeSkillEffects(def).map((x) => el('li', { text: x }))),
    ]),
    el('div', { class: 'hd-skill-detail-sec' }, [
      el('b', { text: tr('Level') }),
      el('p', { class: 'hd-skill-detail-line', text: tr(`Rank ${1}/${SKILL_MAX_RANK} — penggandaan damage +28%/rank & cooldown −7%/rank`) }),
    ]),
    el('div', { class: 'hd-skill-req' }, [
      el('span', { class: 'hd-skill-req-chip', text: tr(`Terbuka di Level ${unlockLv} (dalam run)`) }),
      el('span', { class: 'hd-skill-req-chip upg', text: tr(`Upgrade terbuka di Level ${SKILL_UPGRADE_LEVEL} (dalam run)`) }),
    ]),
    el('button', {
      class: 'btn btn-primary hd-skill-up-btn',
      disabled: true,
      text: tr(`UPGRADE SAAT RUN — butuh Level ${SKILL_UPGRADE_LEVEL}`),
      title: tr('Upgrade skill dilakukan di dalam run lewat badge (+) pada tombol skill (Lv 15+)'),
    }),
  ]);
}

/* ---------- Konten modal: DETAIL PASUKAN ---------- */
function buildTroopModalContent(troop) {
  return el('div', { class: 'hd-skill-detail' }, [
    el('div', { class: 'hd-skill-detail-head' }, [
      el('img', { class: 'hd-troop-modal-img', src: troop.src, alt: troop.name }),
      el('div', { class: 'hd-skill-detail-titles' }, [
        el('b', { class: 'hd-skill-detail-name', text: troop.name }),
        el('span', { class: 'hd-skill-detail-tag', text: tr('Pasukan imun — ikut bertarung otomatis') }),
      ]),
    ]),
    el('p', { class: 'hd-skill-detail-desc', text: troop.desc }),
    el('div', { class: 'hd-skill-req' }, [
      el('span', { class: 'hd-skill-req-chip', text: tr('Menembak otomatis ke patogen terdekat') }),
    ]),
  ]);
}

/* ---------- Kartu jalur equity (tampil di modal, kelas dipertahankan) ---------- */
function renderEquityPathCard(heroDef, currentStage) {
  const designs = getCharacterDesigns();
  const heroDesign = designs?.heroes?.[heroDef.id];
  if (!heroDesign) return null;
  const evoStages = getData().evolutions.stages || [];
  const stageMeta = new Map(evoStages.map((s) => [s.stage, s]));
  const rows = [
    {
      stage: 0,
      label: stageMeta.get(0)?.collectionLabel || 'Stage 0 Polos',
      name: 'Base Polos',
      anatomy: 'silhouette dasar',
      visualCue: heroDesign.baseCue,
      color: stageMeta.get(0)?.tierColor || '#9db1a8',
    },
    ...(heroDesign.equity || []).map((item) => ({
      ...item,
      label: stageMeta.get(item.stage)?.collectionLabel || `Equity ${item.stage}`,
    })),
  ];

  return el('div', {
    class: 'card hero-lab-card hl-equity-card',
    style: `--hero-color:${heroDef.color};`,
  }, [
    el('div', { class: 'hl-equity-head' }, [
      el('div', { class: 'hl-equity-titlewrap' }, [
        el('b', { class: 'hl-equity-title', text: 'Jalur Design Equity' }),
        el('span', {
          class: 'hl-equity-sub',
          text: 'Stage 0 tetap polos; Equity I–Full Equity membuka cue anatomi unik hero ini.',
        }),
      ]),
      el('span', {
        class: 'hl-equity-current',
        text: `Aktif: ${stageMeta.get(currentStage)?.collectionLabel || stageMeta.get(currentStage)?.name || `Stage ${currentStage}`}`,
      }),
    ]),
    el('div', { class: 'hl-equity-ladder' }, rows.map((item) => {
      const stateClass = item.stage === currentStage ? ' active' : (item.stage < currentStage ? ' done' : ' locked');
      return el('div', {
        class: `hl-equity-step${stateClass}`,
        style: `--eq:${item.color || heroDef.color};`,
        title: `${item.label}: ${item.visualCue}`,
      }, [
        el('span', { class: 'hl-equity-node', text: item.stage === 0 ? '0' : String(item.stage) }),
        el('span', { class: 'hl-equity-line' }),
        createHeroEquityPreview(heroDef, item.stage, { size: 54, className: 'hl-equity-preview character-preview' }),
        el('div', { class: 'hl-equity-copy' }, [
          el('b', { text: item.label }),
          el('small', { text: `${item.name} · ${item.anatomy}` }),
          el('em', { text: item.visualCue }),
        ]),
      ]);
    })),
  ]);
}

/* ================================================================
   SELECT HERO — bangun ulang layout single-hero focus.
   ================================================================ */
function selectHero(dir = 0) {
  const meta = STATE.meta;
  const heroes = getData().heroes.heroes;
  const heroDef = heroes.find((h) => h.id === heroId) || heroes[0];
  heroId = heroDef.id;
  const cfg = getData().upgrades.heroUpgrade;
  const allyCfg = getData().upgrades.allyUpgrade;
  const level = (meta.heroLevels && meta.heroLevels[heroId]) || 0;
  const maxed = level >= cfg.maxLevel;
  const cost = heroLevelCost(cfg, level);
  const stageDef = getEvoStageDef(meta);

  // Statistik efek nyata (formula sama dengan game)
  const base = heroDef.baseStats;
  const sq = squadMultipliers(meta);
  const nowDamage = base.damage * sq.damage * sq.weapon * (1 + cfg.dmgPerLevel * level);
  const nextDamage = base.damage * sq.damage * sq.weapon * (1 + cfg.dmgPerLevel * (level + 1));
  const nowHP = Math.round(base.maxHP * sq.maxHP * (1 + cfg.hpPerLevel * level));
  const nextHP = Math.round(base.maxHP * sq.maxHP * (1 + cfg.hpPerLevel * (level + 1)));
  // DEF = ketahanan komposit (HP + kecepatan); PWR = power score (DPS efektif)
  const defense = Math.round(nowHP / 12 + base.speed / 50);
  const power = Math.round((nowDamage * (base.projectileCount || 1)) / base.attackCooldown);

  const box = document.getElementById('hero-detail-body');
  box.textContent = '';

  const heroPos = heroes.findIndex((h) => h.id === heroDef.id);
  const stepHero = (d) => {
    heroId = heroes[(heroPos + d + heroes.length) % heroes.length].id;
    closeModal();
    selectHero(d);
  };

  const skillDefs = (heroDef.skills || []).map((id) => getData().skills.skills.find((sk) => sk.id === id)).filter(Boolean);
  const tier = (getData().heroes.tiers || {})[heroDef.tier] || {};

  /* ---------- KIRI: rail SKILL (ikon → modal detail) ---------- */
  const skillRail = el('aside', { class: 'hd-rail hd-left' }, [
    el('span', { class: 'hd-rail-title', text: tr('SKILL') }),
    el('div', { class: 'hl-skill-col hd-skill-list' }, skillDefs.map((sk, i) =>
      el('button', {
        class: 'hl-skill hd-skill-btn' + (i === 2 ? ' ult' : ''),
        title: `${tr(sk.name)} — ${tr('ketuk untuk detail')}`,
        'aria-label': `${tr(sk.name)} — ${tr('detail skill')} ${i + 1}`,
        onclick: () => openModal(buildSkillModalContent(heroDef, i)),
      }, [
        skillChip(sk, { ult: i === 2, cls: 'hl-skill-chip' }),
        el('span', { class: 'hl-skill-key', text: i === 2 ? 'ULT' : String(i + 1) }),
        el('span', { class: 'hd-skill-lvtag', text: `Lv${SKILL_UNLOCK_LEVELS[i]}` }),
      ])
    )),
    // Passive (kelas .hl-passive dipertahankan — identitas hero terbaca langsung)
    heroDef.passive ? el('button', {
      class: 'hl-passive hd-passive-chip',
      title: `${heroDef.passive.name} — ${tr('detail di daftar info')}`,
      onclick: () => openModal(el('div', { class: 'hd-skill-detail' }, [
        el('b', { class: 'hd-skill-detail-name', text: `✦ ${heroDef.passive.name}` }),
        el('p', { class: 'hd-skill-detail-desc', text: heroDef.passive.desc }),
        el('div', { class: 'hd-skill-req' }, [el('span', { class: 'hd-skill-req-chip', text: tr('Pasif — selalu aktif saat run') })]),
      ])),
      text: `✦ ${heroDef.passive.name} — ${heroDef.passive.desc}`,
    }) : null,
  ]);

  /* ---------- TENGAH: panggung HERO (visual anchor terbesar) ---------- */
  const spriteWrap = el('div', {
    class: 'hd-hero-figure',
    style: `--hero-color:${heroDef.color}`,
  }, [
    el('span', { class: 'hd-hero-halo', 'aria-hidden': 'true' }),
    el('img', {
      class: 'hl-sprite hd-hero-sprite' + (dir !== 0 ? ` slide-${dir > 0 ? 'r' : 'l'}` : ''),
      src: spriteToDataURL(heroDef.spritePortrait || heroDef.spriteIdle),
      alt: heroDef.name,
      draggable: 'false',
    }),
  ]);
  const mi = masteryInfo(meta, heroId);
  const stage = el('div', { class: 'hd-stage' }, [
    el('button', { class: 'hl-arrow hd-arrow', 'aria-label': 'Hero sebelumnya', text: '❮', onclick: () => stepHero(-1) }),
    el('div', { class: 'hd-stage-center' }, [
      // Banner identitas: role icon + nama + tier/rarity
      el('div', { class: 'hl-banner hd-banner' }, [
        roleIconSrc(heroDef.role)
          ? el('span', { class: 'hl-banner-role', style: `background:${roleTint(heroDef.role)}`, title: heroDef.role }, [el('img', { src: roleIconSrc(heroDef.role), alt: heroDef.role })])
          : el('span', { class: 'hl-banner-role', style: `background:${heroDef.roleColor || heroDef.color}`, text: (heroDef.role || heroDef.name).slice(0, 3).toUpperCase() }),
        el('b', { class: 'hl-banner-name', text: heroDef.name }),
        el('span', { class: 'hl-banner-tier', style: `background:${tier.color || stageDef.tierColor}`, text: tier.label || stageDef.tier }),
      ]),
      spriteWrap,
      // Nama + level + gelar
      el('div', { class: 'hd-nameplate' }, [
        el('b', { class: 'hl-name hd-name', text: heroDef.name }),
        el('span', { class: 'hl-level', style: `background:${heroDef.color}`, text: `Lv ${level}` }),
      ]),
      el('span', { class: 'hl-title hd-title', text: `${tr(heroDef.title)} · ${stageDef.name}` }),
      // Mastery chip (kelas dipertahankan)
      el('div', { class: 'hl-mastery' }, [
        el('span', {
          style: 'color:#c39bd3;font-weight:900',
          text: `★ Mastery Lv ${mi.level}${mi.title ? ` — ${mi.title}` : ''}`,
        }),
        el('div', { class: 'hl-mastery-bar' }, [
          el('div', { style: `height:100%;width:${Math.round(mi.pct * 100)}%;background:#c39bd3;border-radius:3px` }),
        ]),
      ]),
      // Dots carousel
      el('div', { class: 'hd-dots', role: 'tablist', 'aria-label': tr('Pilih hero') },
        heroes.map((h, i) => el('button', {
          class: 'hd-dot' + (i === heroPos ? ' active' : ''),
          style: `--hero-color:${h.color}`,
          'aria-label': h.name,
          onclick: () => { heroId = h.id; closeModal(); selectHero(0); },
        }))),
    ]),
    el('button', { class: 'hl-arrow hd-arrow', 'aria-label': 'Hero berikutnya', text: '❯', onclick: () => stepHero(1) }),
  ]);

  /* ---------- KANAN: rail TROOPS / LOADOUT ---------- */
  const aLvl = meta.allyLevel || 0;
  const aMaxed = aLvl >= allyCfg.maxLevel;
  const aCost = allyLevelCost(allyCfg, aLvl);
  const troops = [
    { name: 'Sel B', src: spriteToDataURL('assets/sprites/hero_bcell_idle.png'), desc: tr('Spesialis antibodi — proyektil pemburu otomatis.') },
    { name: 'Sel NK', src: spriteToDataURL('assets/sprites/hero_nkcell_idle.png'), desc: tr('Pembunuh alami — agresif ke target sekarat.') },
    { name: 'Makrofag', src: spriteToDataURL('assets/sprites/hero_macrophage_idle.png'), desc: tr('Fagosit garis depan — menyerap dan menghabisi patogen.') },
  ];
  const allyVisible = Math.max(0, Math.min(6, Math.max(meta.allies || 1, 1 + Math.floor(aLvl / (allyCfg.membersPerLevels || 3)))));
  const troopRail = el('aside', { class: 'hd-rail hd-right' }, [
    el('span', { class: 'hd-rail-title', text: tr('PASUKAN') }),
    el('div', { class: 'hl-ally-row hd-troop-list' }, troops.map((tp) =>
      el('button', {
        class: 'hl-ally-cell hd-troop-cell',
        title: `${tp.name} — ${tr('ketuk untuk detail')}`,
        onclick: () => openModal(buildTroopModalContent(tp)),
      }, [
        el('img', { class: 'hl-ally', src: tp.src, alt: tp.name }),
        el('span', { class: 'hl-ally-tag', text: tp.name }),
      ])
    )),
    el('span', { class: 'hl-count hd-troop-count', text: tr(`${allyVisible} sel ikut bertarung`) }),
    el('span', { class: 'hl-level ally', text: `Lv ${aLvl}` }),
    el('div', { class: 'hl-chips hd-troop-chips' }, [
      el('span', { class: 'hl-chip atk' }, [
        el('b', { text: `+${Math.round(allyCfg.dmgPerLevel * aLvl * 100)}%` }),
        el('i', { text: 'damage' }),
      ]),
    ]),
    el('button', {
      class: 'btn btn-primary btn-ally-up hd-ally-up',
      disabled: aMaxed || meta.currency < aCost,
      text: aMaxed ? 'LEVEL MAKSIMAL ✓' : `UPGRADE PASUKAN — ${aCost}`,
    }),
    el('span', { class: 'hl-hint', text: tr(`${allyCfg.desc} · jumlah sel bertambah tiap bab kampanye bersih`) }),
    el('button', {
      class: 'btn btn-hl-lab hd-lab-btn',
      text: tr('Laboratorium Tim →'),
      onclick: () => screenManager.show('upgrade'),
    }),
    el('button', {
      class: 'btn hd-equity-btn',
      text: tr('Jalur Design Equity →'),
      onclick: () => {
        const slot = modalWrap && modalWrap.querySelector('#hd-equity-slot');
        const card = slot && slot.querySelector('.hl-equity-card');
        if (card) openModal(card);
      },
    }),
  ]);

  /* ---------- BAWAH: strip stat inti + aksi ---------- */
  const bottom = el('div', { class: 'hd-bottom' }, [
    el('div', { class: 'hl-chips hd-stats' }, [
      el('span', { class: 'hl-chip atk', title: tr('Damage per serangan (termasuk bonus level & tim)') }, [el('small', { text: 'DMG' }), el('b', { text: `${Math.round(nowDamage)}` }), el('i', { text: `+${Math.round((nextDamage - nowDamage) * 10) / 10}` })]),
      el('span', { class: 'hl-chip hp', title: tr('HP maksimum (termasuk bonus level & tim)') }, [el('small', { text: 'HP' }), el('b', { text: `${nowHP}` }), el('i', { text: `+${nextHP - nowHP}` })]),
      el('span', { class: 'hl-chip def', title: tr('Ketahanan komposit — dari HP & kecepatan') }, [el('small', { text: 'DEF' }), el('b', { text: `${defense}` })]),
      el('span', { class: 'hl-chip pwr', title: tr('Power score — damage per detik efektif') }, [el('small', { text: 'PWR' }), el('b', { text: `${power}` })]),
    ]),
    el('div', { class: 'hd-up-row' }, [
      el('div', { class: 'hl-slider upg-slider hd-up-slider' + (maxed ? ' maxed' : '') }, [
        el('div', { class: 'upg-fill', style: `width:${(level / cfg.maxLevel) * 100}%` }),
        el('div', { class: 'upg-knob', style: `left:${(level / cfg.maxLevel) * 100}%` }),
      ]),
      el('button', {
        class: 'btn btn-primary btn-hl-up',
        disabled: maxed || meta.currency < cost,
        text: maxed ? 'LEVEL MAKSIMAL ✓' : `UPGRADE — ${cost} antibodi`,
      }),
    ]),
  ]);

  box.appendChild(el('div', { class: 'hd-shell', style: `--hero-color:${heroDef.color}`, 'data-dir': dir > 0 ? 'r' : dir < 0 ? 'l' : '' }, [
    skillRail, stage, troopRail, bottom,
  ]));

  // Jalur equity TETAP dirender di layar ini — di-host di slot tersembunyi di
  // dalam modal overlay (tetap ada di DOM untuk suite E2E) sampai tombol rail
  // membukanya sebagai modal; setelah tutup dikembalikan ke slot.
  ensureModal();
  const equitySlot = modalWrap.querySelector('#hd-equity-slot');
  equitySlot.textContent = '';
  const equityCard = renderEquityPathCard(heroDef, stageDef.stage || 0);
  if (equityCard) equitySlot.appendChild(equityCard);

  box.querySelector('.btn-hl-up').addEventListener('click', () => {
    const res = purchaseHeroLevel(meta, heroId);
    if (res.ok) selectHero(0);
  });
  box.querySelector('.btn-ally-up').addEventListener('click', () => {
    const res = purchaseAllyLevel(meta);
    if (res.ok) selectHero(0);
  });

  // Swipe carousel pada area panggung
  let sx = null;
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 42) stepHero(dx < 0 ? 1 : -1);
  });

  document.getElementById('hd-currency').textContent = meta.currency.toLocaleString('id-ID');
}

export function show(params) {
  heroId = (params && params.heroId) || STATE.meta.selectedHero;
  selectHero(0);
  // Carousel keyboard (kiri/kanan) — aktif hanya saat layar ini terbuka
  if (keyHandler) window.removeEventListener('keydown', keyHandler);
  keyHandler = (e) => {
    if (!document.getElementById('screen-herodetail')?.classList.contains('active')) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape') { closeModal(); return; }
    const heroes = getData().heroes.heroes;
    const heroPos = heroes.findIndex((h) => h.id === heroId);
    if (e.key === 'ArrowRight') {
      heroId = heroes[(heroPos + 1 + heroes.length) % heroes.length].id;
      closeModal(); selectHero(1);
    } else if (e.key === 'ArrowLeft') {
      heroId = heroes[(heroPos - 1 + heroes.length) % heroes.length].id;
      closeModal(); selectHero(-1);
    }
  };
  window.addEventListener('keydown', keyHandler);
}

export function hide() {
  closeModal();
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
}
