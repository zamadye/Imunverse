/**
 * hero-detail-screen.js — DETAIL & UPGRADE HERO (dibuka dari menu Heroes).
 *
 * Dashboard satu hero: portrait + level + slider + tombol LEVEL UP (antibodi)
 * + statistik senjata (damage/HP termasuk bonus level & squad) + panel
 * PASUKAN (level pasukan, jumlah sel, upgrade) + pintasan ke Lab Tim.
 * Semua efek nyata (computePlayerStats & ally level membaca data ini).
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { writeSave } from '../../save/save-manager.js';
import { el, screenManager } from '../screen-manager.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { heroLevelCost, purchaseHeroLevel, allyLevelCost, purchaseAllyLevel } from '../../systems/economy-system.js';
import { getEvoStageDef } from '../../systems/evolution-system.js';
import { squadMultipliers } from '../../systems/upgrade-system.js';
import { t as tr } from '../../systems/i18n.js';

let heroId = null;

function selectHero() {
  const meta = STATE.meta;
  const heroDef = getData().heroes.heroes.find((h) => h.id === heroId) || getData().heroes.heroes[0];
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

  const box = document.getElementById('hero-detail-body');
  box.textContent = '';

  // ===== PANEL HERO (ala referensi: karakter besar di panggung + nama + tingkatan) =====
  const skillDefs = (heroDef.skills || []).map((id) => getData().skills.skills.find((sk) => sk.id === id)).filter(Boolean);
  box.appendChild(el('div', { class: 'card hero-lab-card hl-hero-panel', style: `background:linear-gradient(180deg,${heroDef.color}22,var(--card) 62%)` }, [
    el('div', { class: 'hl-head' }, [
      el('span', { class: 'hl-count', text: `${stageDef.name} · ${stageDef.tier}` }),
      el('span', { class: 'hl-level', style: `background:${heroDef.color}`, text: `Lv ${level}` }),
    ]),
    el('div', { class: 'hl-stage' }, [
      el('img', { class: 'hl-sprite', src: spriteToDataURL(heroDef.spritePortrait || heroDef.spriteIdle), alt: heroDef.name }),
      el('div', { class: 'hl-skill-col' }, skillDefs.map((sk, i) =>
        el('div', { class: 'hl-skill' + (i === 2 ? ' ult' : ''), title: `${sk.name} — tombol ${i + 1}` }, [
          el('span', { class: 'hl-skill-key', text: i === 2 ? 'ULT' : String(i + 1) }),
          el('span', { class: 'hl-skill-dot', style: `background:${sk.color}` }),
        ])
      )),
    ]),
    el('b', { class: 'hl-name', text: heroDef.name }),
    el('span', { class: 'hl-title', text: tr(heroDef.title) }),
    // Stat chips (damage merah / HP hijau) — gaya kartu game modern
    el('div', { class: 'hl-chips' }, [
      el('span', { class: 'hl-chip atk' }, [
        el('img', { src: 'assets/sprites/icon_sword.png', alt: '' }),
        el('b', { text: `${Math.round(nowDamage)}` }),
        el('i', { text: `+${Math.round((nextDamage - nowDamage) * 10) / 10}` }),
      ]),
      el('span', { class: 'hl-chip hp' }, [
        el('img', { src: 'assets/sprites/icon_heart.png', alt: '' }),
        el('b', { text: `${nowHP}` }),
        el('i', { text: `+${nextHP - nowHP}` }),
      ]),
    ]),
    el('div', { class: 'hl-slider upg-slider' + (maxed ? ' maxed' : '') }, [
      el('div', { class: 'upg-fill', style: `width:${(level / cfg.maxLevel) * 100}%` }),
      el('div', { class: 'upg-knob', style: `left:${(level / cfg.maxLevel) * 100}%` }),
    ]),
    el('button', {
      class: 'btn btn-primary btn-hl-up',
      disabled: maxed || meta.currency < cost,
      text: maxed ? 'LEVEL MAKSIMAL ✓' : `UPGRADE — ${cost} antibodi`,
    }),
    el('span', { class: 'hl-hint', text: cfg.desc }),
  ]));
  box.querySelector('.btn-hl-up').addEventListener('click', () => {
    const res = purchaseHeroLevel(meta, heroId);
    if (res.ok) show();
  });

  // ---------- Panel PASUKAN ----------
  const aLvl = meta.allyLevel || 0;
  const aMaxed = aLvl >= allyCfg.maxLevel;
  const aCost = allyLevelCost(allyCfg, aLvl);
  box.appendChild(el('div', { class: 'card hero-lab-card ally-panel', style: 'background:linear-gradient(180deg,#4aa3e022,var(--card) 62%)' }, [
    el('div', { class: 'hl-head' }, [
      el('span', { class: 'hl-count', text: `${meta.allies || 1} sel ikut bertarung` }),
      el('span', { class: 'hl-level ally', text: `Lv ${aLvl}` }),
    ]),
    el('div', { class: 'hl-ally-row' }, [
      el('div', { class: 'hl-ally-cell' }, [
        el('img', { class: 'hl-ally', src: spriteToDataURL('assets/sprites/hero_bcell_idle.png'), alt: 'Sel B' }),
        el('span', { class: 'hl-ally-tag', text: 'Sel B' }),
      ]),
      el('div', { class: 'hl-ally-cell' }, [
        el('img', { class: 'hl-ally', src: spriteToDataURL('assets/sprites/hero_nkcell_idle.png'), alt: 'Sel NK' }),
        el('span', { class: 'hl-ally-tag', text: 'Sel NK' }),
      ]),
      el('div', { class: 'hl-ally-cell' }, [
        el('img', { class: 'hl-ally', src: spriteToDataURL('assets/sprites/hero_macrophage_idle.png'), alt: 'Makrofag' }),
        el('span', { class: 'hl-ally-tag', text: 'Makrofag' }),
      ]),
    ]),
    el('b', { class: 'hl-name', text: 'Pasukan Imun' }),
    el('div', { class: 'hl-chips' }, [
      el('span', { class: 'hl-chip atk' }, [
        el('img', { src: 'assets/sprites/icon_sword.png', alt: '' }),
        el('b', { text: `+${Math.round(allyCfg.dmgPerLevel * aLvl * 100)}%` }),
        el('i', { text: 'damage' }),
      ]),
      el('span', { class: 'hl-chip spd' }, [
        el('img', { src: 'assets/sprites/icon_bolt.png', alt: '' }),
        el('b', { text: `+${Math.round(((0.95 - Math.max(0.55, 0.95 - allyCfg.speedPerLevel * aLvl)) / 0.95) * 100)}%` }),
        el('i', { text: 'tempo' }),
      ]),
    ]),
    el('button', {
      class: 'btn btn-primary btn-ally-up',
      disabled: aMaxed || meta.currency < aCost,
      text: aMaxed ? 'LEVEL MAKSIMAL ✓' : `UPGRADE PASUKAN — ${aCost}`,
    }),
    el('span', { class: 'hl-hint', text: `${allyCfg.desc} · jumlah sel bertambah tiap bab kampanye bersih` }),
  ]));
  box.querySelector('.btn-ally-up').addEventListener('click', () => {
    const res = purchaseAllyLevel(meta);
    if (res.ok) show();
  });

  // ---------- Pintasan ke Lab Tim ----------
  box.appendChild(el('button', {
    class: 'btn btn-hl-lab',
    text: 'Laboratorium Tim (senjata, jurus, pertahanan) →',
    onclick: () => screenManager.show('upgrade'),
  }));

  document.getElementById('hd-currency').textContent = meta.currency.toLocaleString('id-ID');
}

export function show(params) {
  heroId = (params && params.heroId) || STATE.meta.selectedHero;
  selectHero();
}

export function hide() {}
