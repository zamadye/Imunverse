/**
 * hero-detail-screen.js — HERO PAGE v2 (layout mengikuti referensi Rise of Kingdoms).
 *
 * Analisis referensi RoK commander screen:
 *   • RAIL KIRI vertikal: daftar commander (hex portrait, terpilih menonjol,
 *     belum dimiliki = gelap) — pemilihan TIDAK pindah halaman (bukan 2 page).
 *   • TENGAH: model commander besar di atas landasan — anchor visual utama.
 *   • PANEL KANAN: judul + nama + rarity → chip kelas (hex) → bintang/level +
 *     XP bar → baris ikon SKILL (unlock = berwarna, locked = gelap) → aksi besar.
 *   • Detail skill = POPUP SATU LEVEL menempel di ikon (nama/tipe/deskripsi/
 *     "Upgrade Preview"/syarat merah) — bukan halaman kedua, bukan nested.
 * Mapping Imunverse: rail=koleksi hero·tengah=sprite hero + "Cell Power"·
 * panel=identitas+mastery+DMG/HP/DEF/PWR+bar 4 ikon skill (3 skill + pasif ✦)
 * + jalur equity via float satu level. Hero-upgrade/pasukan berbayar DICABUT
 * (workflow minimal — kekuatan murni dari mutasi in-run, bukan pembelian).
 * Kelas yang dipakai suite E2E lama (.hl-equity-card/.hl-passive/.hl-mastery/
 * .hl-arrow/.hl-sprite) DIPERTAHANKAN.
 */

import { STATE } from '../../core/state-manager.js';
import { getData, getCharacterDesigns } from '../../core/data-store.js';
import { el, screenManager } from '../screen-manager.js';
import { skillChip } from '../skill-icons.js';
import { roleIconSrc, roleTint } from '../menu-icons.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { createHeroEquityPreview } from '../../render/character-preview.js';
import { getEvoStageDef } from '../../systems/evolution-system.js';
import { squadMultipliers } from '../../systems/upgrade-system.js';
import { t as tr } from '../../systems/i18n.js';
import { masteryInfo } from '../../systems/mastery-system.js';
import { SKILL_UNLOCK_LEVELS, SKILL_RANK2_LEVEL } from '../../systems/skill-unlock.js';
import { SKILL_TRIGGER_LABEL } from '../../systems/skill-system.js';
import { getHeroStatus, purchaseHero } from '../../systems/unlock-system.js';
import { emit } from '../../core/ui-bridge.js';
import { audio } from '../../systems/audio-system.js';
import { writeSave } from '../../save/save-manager.js';

let heroId = null;
let keyHandler = null;
let floatEl = null;

/* ================= FLOAT SATU LEVEL (gaya popup skill RoK) ================= */
function ensureFloat() {
  if (floatEl && document.contains(floatEl)) return floatEl;
  const shell = document.querySelector('#hero-detail-body .hd-rok');
  if (!shell) return null;
  floatEl = el('div', { class: 'hd-rok-float hidden', role: 'dialog', 'aria-modal': 'false' }, [
    el('button', { class: 'hd-rok-float-close', 'aria-label': tr('Tutup'), text: '✕', onclick: () => closeFloat() }),
    el('div', { class: 'hd-rok-float-content', id: 'hd-rok-float-content' }),
  ]);
  shell.appendChild(floatEl);
  return floatEl;
}

function openFloat(contentNode, anchorClass = '') {
  const f = ensureFloat();
  if (!f) return;
  const box = f.querySelector('#hd-rok-float-content');
  box.textContent = '';
  box.appendChild(contentNode);
  f.className = `hd-rok-float ${anchorClass}`.trim();
}

function closeFloat() {
  if (!floatEl) return;
  floatEl.classList.add('hidden');
  const content = floatEl.querySelector('#hd-rok-float-content');
  const equityCard = content ? content.querySelector('.hl-equity-card') : null;
  const slot = document.getElementById('hd-equity-slot');
  if (equityCard && slot) slot.appendChild(equityCard);
  if (content && content.firstChild) content.textContent = '';
  document.querySelectorAll('.hd-rok-skill-ico.sel').forEach((b) => b.classList.remove('sel'));
}

/* ---------- Detail skill / pasif (isi float, gaya kartu RoK: nama/tipe/desk/lvl/syarat) ---------- */
function describeSkillEffects(def) {
  return (def.effects || []).map((fx) => {
    switch (fx.kind) {
      case 'area': return tr(`Ledakan area — radius ${fx.radius}, damage ×${fx.mult || 1}`);
      case 'strike': return tr(`Serangan tunggal — damage ×${fx.mult || 1}`);
      case 'heal': return tr(`Pulihkan ${fx.amount} HP`) + (fx.radius ? tr(' (+area)') : '');
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
      case 'instant_multi': return tr(`Hantam ${fx.count || 3} target terdekat sekaligus`);
      case 'instant_hits': return tr(`Hantaman beruntun ×${fx.hits || 3}`);
      case 'annihilate': return tr(`Anihilasi target + percikan area`);
      case 'shield_self': return tr(`Membran +${fx.amount}`);
      default: return fx.kind;
    }
  });
}

function buildSkillFloatContent(heroDef, index) {
  const skillDefs = (heroDef.skills || []).map((id) => getData().skills.skills.find((sk) => sk.id === id)).filter(Boolean);
  const def = skillDefs[index];
  if (!def) return el('div', { text: '—' });
  const isUlt = index === 2;
  const unlockLv = SKILL_UNLOCK_LEVELS[index];
  return el('div', { class: 'hd-skill-pop', style: `--sk:${def.color || heroDef.color}` }, [
    el('div', { class: 'hd-skill-pop-head' }, [
      el('div', { class: 'hd-skill-modal-ico' }, [skillChip(def, { ult: isUlt })]),
      el('div', { class: 'hd-skill-pop-titles' }, [
        el('b', { class: 'hd-skill-pop-name', text: tr(def.name) }),
        el('span', { class: 'hd-skill-pop-tag', text: `${isUlt ? 'ULTIMATE' : tr('Pasif')} · ${SKILL_TRIGGER_LABEL[def.trigger] || def.trigger} · CD ${def.cooldown}s` }),
      ]),
    ]),
    el('p', { class: 'hd-skill-pop-desc', text: tr(def.description || '') }),
    el('ul', { class: 'hd-skill-effects' }, describeSkillEffects(def).slice(0, 2).map((x) => el('li', { text: x }))),
    el('div', { class: 'hd-skill-req' }, [
      el('span', { class: 'hd-skill-req-chip', text: tr(`Terbuka di Level ${unlockLv} (dalam run)`) }),
      el('span', { class: 'hd-skill-req-chip upg', text: tr(`Rank 2 otomatis di Level ${SKILL_RANK2_LEVEL}`) }),
    ]),
  ]);
}

function buildPassiveFloatContent(heroDef) {
  return el('div', { class: 'hd-skill-pop' }, [
    el('b', { class: 'hd-skill-pop-name', text: `✦ ${heroDef.passive.name}` }),
    el('span', { class: 'hd-skill-pop-tag', text: tr('Pasif — selalu aktif saat run') }),
    el('p', { class: 'hd-skill-pop-desc', text: heroDef.passive.desc }),
  ]);
}

/* ---------- Kartu jalur equity (kelas E2E dipertahankan; tampil via float) ---------- */
function renderEquityPathCard(heroDef, currentStage) {
  const designs = getCharacterDesigns();
  const heroDesign = designs?.heroes?.[heroDef.id];
  if (!heroDesign) return null;
  const evoStages = getData().evolutions.stages || [];
  const stageMeta = new Map(evoStages.map((s) => [s.stage, s]));
  const rows = [
    { stage: 0, label: stageMeta.get(0)?.collectionLabel || 'Stage 0 Polos', name: 'Base Polos', anatomy: 'silhouette dasar', visualCue: heroDesign.baseCue, color: stageMeta.get(0)?.tierColor || '#9db1a8' },
    ...(heroDesign.equity || []).map((item) => ({ ...item, label: stageMeta.get(item.stage)?.collectionLabel || `Equity ${item.stage}` })),
  ];
  return el('div', { class: 'card hero-lab-card hl-equity-card', style: `--hero-color:${heroDef.color};` }, [
    el('div', { class: 'hl-equity-head' }, [
      el('div', { class: 'hl-equity-titlewrap' }, [
        el('b', { class: 'hl-equity-title', text: 'Jalur Design Equity' }),
        el('span', { class: 'hl-equity-sub', text: 'Stage 0 tetap polos; Equity I–Full Equity membuka cue anatomi unik hero ini.' }),
      ]),
      el('span', { class: 'hl-equity-current', text: `Aktif: ${stageMeta.get(currentStage)?.collectionLabel || stageMeta.get(currentStage)?.name || `Stage ${currentStage}`}` }),
    ]),
    el('div', { class: 'hl-equity-ladder' }, rows.map((item) => {
      const stateClass = item.stage === currentStage ? ' active' : (item.stage < currentStage ? ' done' : ' locked');
      return el('div', { class: `hl-equity-step${stateClass}`, style: `--eq:${item.color || heroDef.color};`, title: `${item.label}: ${item.visualCue}` }, [
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

/* ---------- Banner unlock (hero terkunci): syarat gratis ATAU beli Antibodi ---------- */
function buildUnlockBanner(meta, heroDef, status) {
  const rows = [
    el('div', { class: 'hd-unlock-row hd-unlock-free' }, [
      el('span', { class: 'hd-unlock-ico', text: status.conditionMet ? '✓' : '○' }),
      el('span', { class: 'hd-unlock-label', text: tr(status.conditionLabel) }),
    ]),
  ];
  if (status.shopCost > 0) {
    rows.push(el('div', { class: 'hd-unlock-row hd-unlock-buy' }, [
      el('span', { class: 'hd-unlock-ico', text: '◉' }),
      el('span', { class: 'hd-unlock-label', text: `${status.shopCost.toLocaleString('id-ID')} Antibodi (kamu punya ${Math.round(meta.currency || 0).toLocaleString('id-ID')})` }),
      el('button', {
        class: 'btn btn-gold hd-unlock-btn',
        id: 'btn-buy-hero',
        text: status.canBuy ? tr('BELI HERO') : tr('KURANG ANTIBODI'),
        disabled: status.canBuy ? undefined : 'true',
        onclick: () => {
          const res = purchaseHero(meta, heroDef);
          if (res.ok) {
            audio.coin();
            emit('toast', { message: `${heroDef.name} terbuka! -${res.cost} Antibodi`, kind: 'gold' });
            meta.selectedHero = heroDef.id;
            writeSave(meta);
            selectHero(0);
          } else {
            audio.warn();
            emit('toast', { message: res.reason || 'Gagal membeli', kind: 'warn' });
          }
        },
      }),
    ]));
  }
  return el('div', { class: 'hd-unlock-banner' }, [
    el('b', { class: 'hd-unlock-title', text: tr('BELUM TERBUKA — pilih salah satu jalur') }),
    ...rows,
  ]);
}

/* ================= SELEKSI HERO — bangun ulang halaman ================= */
function selectHero(dir = 0) {
  const meta = STATE.meta;
  const heroes = getData().heroes.heroes;
  const heroDef = heroes.find((h) => h.id === heroId) || heroes[0];
  heroId = heroDef.id;
  const stageDef = getEvoStageDef(meta);

  const base = heroDef.baseStats;
  const sq = squadMultipliers();
  const nowDamage = base.damage * sq.damage * sq.weapon;
  const nowHP = Math.round(base.maxHP * sq.maxHP);
  const defense = Math.round(nowHP / 12 + base.speed / 50);
  const power = Math.round((nowDamage * (base.projectileCount || 1)) / base.attackCooldown);

  const box = document.getElementById('hero-detail-body');
  box.textContent = '';
  floatEl = null;

  const heroPos = heroes.findIndex((h) => h.id === heroDef.id);
  const stepHero = (d) => {
    heroId = heroes[(heroPos + d + heroes.length) % heroes.length].id;
    closeFloat();
    selectHero(d);
  };

  const skillDefs = (heroDef.skills || []).map((id) => getData().skills.skills.find((sk) => sk.id === id)).filter(Boolean);
  const tier = (getData().heroes.tiers || {})[heroDef.tier] || {};
  const unlockedSet = new Set(meta.unlockedHeroes || []);
  // Workflow minimal: dua jalur unlock — gratis (syarat statistik) ATAU beli
  // instan dengan Antibodi (meta.currency). status.unlocked = false berarti
  // kartu ini menampilkan BANNER unlock, bukan stat langsung dipakai.
  const status = getHeroStatus(meta, heroDef);

  /* ---------- RAIL KIRI: daftar hero (carousel terintegrasi, gaya RoK) ---------- */
  const railItems = heroes.map((h, i) => {
    const locked = !unlockedSet.has(h.id) && unlockedSet.size > 0;
    return el('button', {
      class: 'hd-rok-hero' + (i === heroPos ? ' sel' : '') + (locked ? ' locked' : ''),
      style: `--hero-color:${h.color}`,
      'aria-label': locked ? `${h.name} (${tr('Terkunci')})` : h.name,
      'aria-current': i === heroPos && !locked ? 'true' : undefined,
      'aria-disabled': locked ? 'true' : undefined,
      title: locked ? `${h.name} — ${tr('Terkunci')}` : h.name,
      onclick: () => { heroId = h.id; closeFloat(); selectHero(i > heroPos ? 1 : -1); },
    }, [
      el('img', { src: spriteToDataURL(h.spritePortrait || h.spriteIdle), alt: h.name, draggable: 'false' }),
      locked ? el('img', { class: 'hd-rok-lock', src: 'assets/icons/ui-lock.svg', alt: '' }) : null,
    ]);
  });
  const rail = el('aside', { class: 'hd-rok-rail', role: 'tablist', 'aria-label': tr('Pilih hero') }, [
    el('button', { class: 'hl-arrow hd-rok-arrow up', 'aria-label': 'Hero sebelumnya', text: '▲', onclick: () => stepHero(-1) }),
    el('div', { class: 'hd-rok-rail-items' }, railItems),
    el('button', { class: 'hl-arrow hd-rok-arrow down', 'aria-label': 'Hero berikutnya', text: '▼', onclick: () => stepHero(1) }),
  ]);

  /* ---------- TENGAH: panggung hero (pedestal + power chip ala RoK) ---------- */
  const stage = el('div', { class: 'hd-rok-stage', style: `--hero-color:${heroDef.color}` }, [
    el('div', { class: 'hd-hero-figure hd-rok-figure' }, [
      el('span', { class: 'hd-hero-halo', 'aria-hidden': 'true' }),
      el('img', {
        class: 'hl-sprite hd-hero-sprite' + (dir !== 0 ? ` slide-${dir > 0 ? 'r' : 'l'}` : ''),
        src: spriteToDataURL(heroDef.spritePortrait || heroDef.spriteIdle),
        alt: heroDef.name,
        draggable: 'false',
      }),
      el('span', { class: 'hd-rok-pedestal', 'aria-hidden': 'true' }),
    ]),
    el('span', { class: 'hd-rok-power', title: tr('Power score — damage per detik efektif') }, [
      el('i', { 'aria-hidden': 'true', text: '⚔' }),
      el('b', { text: `${tr('Kekuatan Sel')}: ${power.toLocaleString('id-ID')}` }),
    ]),
  ]);

  /* ---------- PANEL KANAN: identitas → level → stats → skill → pasukan ---------- */
  const mi = masteryInfo(meta, heroId);

  const skillRow = el('div', { class: 'hd-rok-skill-row' }, [
    ...skillDefs.map((sk, i) => el('button', {
      class: 'hd-rok-skill-ico' + (i === 2 ? ' ult' : ''),
      'aria-label': `${tr(sk.name)} — ${tr('detail skill')}`,
      title: `${tr(sk.name)} — ${tr('ketuk untuk detail')}`,
      onclick: (ev) => {
        const btn = ev.currentTarget;
        if (btn.classList.contains('sel')) { closeFloat(); return; }
        document.querySelectorAll('.hd-rok-skill-ico.sel').forEach((b) => b.classList.remove('sel'));
        btn.classList.add('sel');
        openFloat(buildSkillFloatContent(heroDef, i), 'pop-skill');
      },
    }, [
      skillChip(sk, { ult: i === 2 }),
      el('span', { class: 'hd-skill-lvtag', text: `Lv${SKILL_UNLOCK_LEVELS[i]}` }),
    ])),
    heroDef.passive ? el('button', {
      class: 'hd-rok-skill-ico passive',
      'aria-label': `${heroDef.passive.name} — ${tr('detail skill')}`,
      title: `${heroDef.passive.name} — ${tr('ketuk untuk detail')}`,
      onclick: (ev) => {
        const btn = ev.currentTarget;
        if (btn.classList.contains('sel')) { closeFloat(); return; }
        document.querySelectorAll('.hd-rok-skill-ico.sel').forEach((b) => b.classList.remove('sel'));
        btn.classList.add('sel');
        openFloat(buildPassiveFloatContent(heroDef), 'pop-skill');
      },
    }, [
      el('span', { class: 'hd-rok-passive-ico', text: '✦' }),
      el('span', { class: 'hd-skill-lvtag', text: tr('Pasif') }),
    ]) : null,
  ]);

  const panel = el('aside', { class: 'hd-rok-panel' }, [
    // Identitas
    el('header', { class: 'hd-rok-id' }, [
      el('span', { class: 'hd-rok-title', text: tr(heroDef.title) }),
      el('div', { class: 'hd-rok-namerow' }, [
        el('b', { class: 'hd-name', text: heroDef.name }),
        roleIconSrc(heroDef.role)
          ? el('span', { class: 'hl-banner-role hd-rok-role', style: `background:${roleTint(heroDef.role)}`, title: heroDef.role }, [el('img', { src: roleIconSrc(heroDef.role), alt: heroDef.role })])
          : el('span', { class: 'hl-banner-role hd-rok-role', style: `background:${heroDef.roleColor || heroDef.color}`, text: (heroDef.role || heroDef.name).slice(0, 3).toUpperCase() }),
        el('span', { class: 'hd-rok-tier', style: `background:${tier.color || stageDef.tierColor}`, text: tier.label || stageDef.tier }),
      ]),
      // Ringkasan pasif (kelas .hl-passive — kompat E2E/i18n: nama+desc terbaca)
      heroDef.passive ? el('span', { class: 'hl-passive hd-rok-passline', text: `✦ ${heroDef.passive.name} — ${heroDef.passive.desc}` }) : null,
      el('div', { class: 'hl-mastery hd-rok-mastery' }, [
        el('span', { style: 'color:#c39bd3;font-weight:900', text: `★ Mastery Lv ${mi.level}${mi.title ? ` — ${mi.title}` : ''}` }),
        el('div', { class: 'hl-mastery-bar' }, [
          el('div', { style: `height:100%;width:${Math.round(mi.pct * 100)}%;background:#c39bd3;border-radius:3px` }),
        ]),
      ]),
    ]),
    // Workflow minimal: hero terkunci → banner dua jalur (gratis/beli) di
    // atas stat, stat di bawahnya tetap tampil sebagai PREVIEW kekuatannya.
    status.unlocked ? null : buildUnlockBanner(meta, heroDef, status),
    // Stat strip (kekuatan hero murni dari mutasi in-run, bukan pembelian)
    el('div', { class: 'hl-chips hd-stats hd-rok-stats' }, [
      el('span', { class: 'hl-chip atk', title: tr('Damage per serangan') }, [el('small', { text: 'DMG' }), el('b', { text: `${Math.round(nowDamage)}` })]),
      el('span', { class: 'hl-chip hp', title: tr('HP maksimum') }, [el('small', { text: 'HP' }), el('b', { text: `${nowHP}` })]),
      el('span', { class: 'hl-chip def', title: tr('Ketahanan komposit — dari HP & kecepatan') }, [el('small', { text: 'DEF' }), el('b', { text: `${defense}` })]),
      el('span', { class: 'hl-chip pwr', title: tr('Power score — damage per detik efektif') }, [el('small', { text: 'PWR' }), el('b', { text: `${power}` })]),
    ]),
    // SKILL (RoK: label + baris ikon → detail = popup satu level)
    el('div', { class: 'hd-rok-sec' }, [
      el('span', { class: 'hd-rok-sec-title', text: tr('SKILL') }),
      skillRow,
    ]),
    // Pintasan (satu level)
    el('div', { class: 'hd-rok-links' }, [
      el('button', {
        class: 'btn hd-rok-link', text: tr('Jalur Design Equity →'),
        onclick: () => {
          const slot = document.getElementById('hd-equity-slot');
          const card = slot && slot.querySelector('.hl-equity-card');
          if (card) openFloat(card, 'pop-equity');
        },
      }),
    ]),
  ]);

  const shell = el('div', { class: 'hd-rok', style: `--hero-color:${heroDef.color}` }, [rail, stage, panel]);
  box.appendChild(shell);

  // Jalur equity tetap di DOM screen ini (slot tersembunyi; float meminjamkannya)
  const equityHost = el('div', { id: 'hd-equity-slot' });
  const equityCard = renderEquityPathCard(heroDef, stageDef.stage || 0);
  if (equityCard) equityHost.appendChild(equityCard);
  box.appendChild(equityHost);

  // Swipe carousel pada panggung (RoK: geser model untuk ganti commander)
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
  if (keyHandler) window.removeEventListener('keydown', keyHandler);
  keyHandler = (e) => {
    if (!document.getElementById('screen-herodetail')?.classList.contains('active')) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape') { closeFloat(); return; }
    const heroes = getData().heroes.heroes;
    const heroPos = heroes.findIndex((h) => h.id === heroId);
    if (e.key === 'ArrowRight') { heroId = heroes[(heroPos + 1 + heroes.length) % heroes.length].id; closeFloat(); selectHero(1); }
    else if (e.key === 'ArrowLeft') { heroId = heroes[(heroPos - 1 + heroes.length) % heroes.length].id; closeFloat(); selectHero(-1); }
  };
  window.addEventListener('keydown', keyHandler);
}

export function hide() {
  closeFloat();
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
}
