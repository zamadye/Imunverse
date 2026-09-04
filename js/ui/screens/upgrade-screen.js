/**
 * upgrade-screen.js — Upgrade Squad ala reference: baris kartu dengan
 * "slider" level (track + knob) dan tombol pill harga dengan ikon .
 */

import { STATE } from '../../core/state-manager.js';
import { getData } from '../../core/data-store.js';
import { squadUpgradeCost, purchaseSquadUpgrade } from '../../systems/upgrade-system.js';
import { heroLevelCost, purchaseHeroLevel, allyLevelCost, purchaseAllyLevel } from '../../systems/economy-system.js';
import { getHeroStatus } from '../../systems/unlock-system.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { el } from '../screen-manager.js';

let activeTab = 'hero';
let heroIdx = 0;

function wireTabs() {
  const tabs = document.getElementById('upg-tabs');
  if (tabs.dataset.wired) return;
  tabs.dataset.wired = '1';
  tabs.querySelectorAll('.upg-tab').forEach((b) => b.addEventListener('click', () => {
    activeTab = b.dataset.tab;
    tabs.querySelectorAll('.upg-tab').forEach((x) => x.classList.toggle('active', x === b));
    show();
  }));
}

export function show() {
  const meta = STATE.meta;
  wireTabs();
  document.getElementById('upgrade-currency').textContent = meta.currency.toLocaleString('id-ID');

  document.getElementById('upg-hero').classList.toggle('hidden', activeTab !== 'hero');
  document.getElementById('upg-pasukan').classList.toggle('hidden', activeTab !== 'pasukan');
  document.getElementById('upgrade-list').classList.toggle('hidden', activeTab !== 'tim');
  document.getElementById('upg-banner').classList.toggle('hidden', activeTab === 'hero');

  if (activeTab === 'hero') { renderHeroTab(meta); return; }
  if (activeTab === 'pasukan') { renderPasukanTab(meta); }

  // Banner ala mockup: tile hero besar + 2 tile musuh kecil (tab TIM)
  const banner = document.getElementById('upg-banner');
  banner.textContent = '';
  const heroDefs = getData().heroes.heroes;
  const selHero = heroDefs.find((h) => h.id === meta.selectedHero) || heroDefs[0];
  const enemyDefs = getData().enemies.enemies;
  const bossDef = enemyDefs.find((e) => e.isBoss) || enemyDefs[0];
  const mobDef = enemyDefs.find((e) => e.id === 'virus') || enemyDefs[0];
  banner.appendChild(el('div', { class: 'ub-tile big' }, [
    el('img', { src: spriteToDataURL(selHero.spriteIdle), alt: selHero.name }),
  ]));
  banner.appendChild(el('div', { class: 'ub-side' }, [
    el('div', { class: 'ub-tile mini coral' }, [el('img', { src: spriteToDataURL(bossDef.sprite), alt: bossDef.name })]),
    el('div', { class: 'ub-tile mini coral light' }, [el('img', { src: spriteToDataURL(mobDef.sprite), alt: mobDef.name })]),
  ]));

  const list = document.getElementById('upgrade-list');
  list.textContent = '';

  for (const def of getData().upgrades.squadUpgrades) {
    const level = meta.squadUpgrades[def.id] || 0;
    const maxed = level >= def.maxLevel;
    const cost = squadUpgradeCost(def, level);
    const pct = (level / def.maxLevel) * 100;

    // Slider ala mockup: fill + knob di ujung level
    const slider = el('div', { class: 'upg-slider' + (maxed ? ' maxed' : ''), role: 'img', 'aria-label': `Level ${level} dari ${def.maxLevel}` }, [
      el('div', { class: 'upg-fill', style: `width:${pct}%` }),
      el('div', { class: 'upg-knob', style: `left:${pct}%` }),
    ]);

    // Label LAYER upgrade (jelas kategori apa yang ditingkatkan)
    const LAYER = {
      sq_damage: 'SERANGAN', sq_weapon: 'SENJATA', sq_jurus: 'JURUS',
      sq_armor: 'PERTAHANAN', sq_vitality: 'PERTAHANAN',
      sq_swift: 'MOBILITAS', sq_attack: 'SERANGAN', sq_range: 'SENJATA',
      sq_nutrition: 'UTILITAS',
    };
    const layerTag = el('span', { class: 'upg-layer', text: LAYER[def.id] || 'LAINNYA' });

    const buyBtn = maxed
      ? el('div', { class: 'btn-buy maxed', text: 'MAX ✓' })
      : el('button', {
          class: 'btn btn-primary btn-buy',
          disabled: meta.currency < cost,
          onclick: () => {
            const res = purchaseSquadUpgrade(STATE.meta, def.id); // logic + auto-save
            if (res.ok) show();
            else if (res.reason) console.warn('[upgrade]', res.reason);
          },
        }, [
          el('img', { class: 'inline-coin', src: 'assets/sprites/icon_coin.png', alt: '' }),
          el('span', { text: cost.toLocaleString('id-ID') }),
        ]);

    const row = el('div', { class: 'upg-row' }, [
      el('div', { class: 'upg-head' }, [
        def.icon.startsWith('assets/')
          ? el('div', { class: 'upg-icon' }, [el('img', { src: def.icon, alt: '', style: 'width:26px;height:26px;object-fit:contain;' })])
          : el('div', { class: 'upg-icon', text: def.icon }),
        el('div', { class: 'upg-info' }, [
          el('b', { class: 'upg-name-wrap' }, [
            el('span', { text: def.name }),
            layerTag,
          ]),
          el('span', { class: 'upg-desc', text: def.desc }),
        ]),
      ]),
      slider,
      el('div', { class: 'upg-foot' }, [
        el('span', { class: 'upg-count', text: `Lv ${level}/${def.maxLevel}` }),
        buyBtn,
      ]),
    ]);
    list.appendChild(row);
  }
}

export function hide() {}


/* ================= TAB HERO: satu hero per layar + tombol upgrade ================= */
function renderHeroTab(meta) {
  const wrap = document.getElementById('upg-hero');
  wrap.textContent = '';
  const cfg = getData().upgrades.heroUpgrade;
  const owned = getData().heroes.heroes.filter((h) => getHeroStatus(meta, h).unlocked);
  if (!owned.length) return;
  if (heroIdx >= owned.length) heroIdx = 0;
  const heroDef = owned[heroIdx];
  const level = (meta.heroLevels && meta.heroLevels[heroDef.id]) || 0;
  const maxed = level >= cfg.maxLevel;
  const cost = heroLevelCost(cfg, level);
  const status = getHeroStatus(meta, heroDef);

  const card = el('div', { class: 'card hero-lab-card' }, [
    el('div', { class: 'hl-head' }, [
      el('span', { class: 'hl-count', text: `${heroIdx + 1} / ${owned.length}` }),
      el('span', { class: 'hl-level', style: `background:${heroDef.color}`, text: `Lv ${level}` }),
    ]),
    el('img', { class: 'hl-sprite', src: spriteToDataURL(heroDef.spritePortrait || heroDef.spriteIdle), alt: heroDef.name }),
    el('b', { class: 'hl-name', text: heroDef.name }),
    el('span', { class: 'hl-title', text: heroDef.title }),
    el('div', { class: 'hl-stats' }, [
      el('span', { text: `DMG +${Math.round(cfg.dmgPerLevel * level * 100)}%` }),
      el('span', { text: `HP +${Math.round(cfg.hpPerLevel * level * 100)}%` }),
    ]),
    el('div', { class: 'hl-slider upg-slider' + (maxed ? ' maxed' : '') }, [
      el('div', { class: 'upg-fill', style: `width:${(level / cfg.maxLevel) * 100}%` }),
      el('div', { class: 'upg-knob', style: `left:${(level / cfg.maxLevel) * 100}%` }),
    ]),
    el('button', {
      class: 'btn btn-primary btn-hl-up',
      disabled: maxed || meta.currency < cost,
      text: maxed ? 'MAX ✓' : `LEVEL UP — ${cost}`,
    }),
    el('div', { class: 'hl-nav' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Sebelumnya' }, [el('img', { src: 'assets/sprites/icon_back.png', alt: '' })]),
      el('span', { class: 'hl-owned', text: `${owned.length} hero dimiliki` }),
      el('button', { class: 'icon-btn hl-next', 'aria-label': 'Berikutnya' }, [el('img', { src: 'assets/sprites/icon_back.png', alt: '', style: 'transform:rotate(180deg)' })]),
    ]),
  ]);
  card.querySelector('.btn-hl-up').addEventListener('click', () => {
    const res = purchaseHeroLevel(meta, heroDef.id);
    if (res.ok) show();
  });
  card.querySelector('.hl-nav .icon-btn').addEventListener('click', () => {
    heroIdx = (heroIdx - 1 + owned.length) % owned.length;
    show();
  });
  card.querySelector('.hl-next').addEventListener('click', () => {
    heroIdx = (heroIdx + 1) % owned.length;
    show();
  });
  wrap.appendChild(card);
  void status;
}

/* ================= TAB PASUKAN: level pasukan ================= */
function renderPasukanTab(meta) {
  const wrap = document.getElementById('upg-pasukan');
  wrap.textContent = '';
  const cfg = getData().upgrades.allyUpgrade;
  const level = meta.allyLevel || 0;
  const maxed = level >= cfg.maxLevel;
  const cost = allyLevelCost(cfg, level);

  const card = el('div', { class: 'card hero-lab-card' }, [
    el('div', { class: 'hl-head' }, [
      el('span', { class: 'hl-count', text: `${meta.allies || 1} sel aktif` }),
      el('span', { class: 'hl-level ally', text: `Lv ${level}` }),
    ]),
    el('div', { class: 'hl-ally-row' }, [
      el('img', { class: 'hl-ally', src: spriteToDataURL('assets/sprites/hero_sel_b_idle.png'), alt: 'Sel B' }),
      el('img', { class: 'hl-ally', src: spriteToDataURL('assets/sprites/hero_sel_nk_idle.png'), alt: 'Sel NK' }),
      el('img', { class: 'hl-ally', src: spriteToDataURL('assets/sprites/hero_makrofag_idle.png'), alt: 'Makrofag' }),
    ]),
    el('b', { class: 'hl-name', text: 'Pasukan Imun' }),
    el('span', { class: 'hl-title', text: 'Ikut bertarung otomatis — menembak patogen' }),
    el('div', { class: 'hl-stats' }, [
      el('span', { text: `DMG +${Math.round(cfg.dmgPerLevel * level * 100)}%` }),
      el('span', { text: `Tempo +${Math.round(((0.95 - Math.max(0.55, 0.95 - cfg.speedPerLevel * level)) / 0.95) * 100)}%` }),
    ]),
    el('div', { class: 'hl-slider upg-slider' + (maxed ? ' maxed' : '') }, [
      el('div', { class: 'upg-fill', style: `width:${(level / cfg.maxLevel) * 100}%` }),
      el('div', { class: 'upg-knob', style: `left:${(level / cfg.maxLevel) * 100}%` }),
    ]),
    el('button', {
      class: 'btn btn-primary btn-hl-up',
      disabled: maxed || meta.currency < cost,
      text: maxed ? 'MAX ✓' : `LEVEL UP — ${cost}`,
    }),
    el('span', { class: 'hl-hint', text: 'Jumlah pasukan bertambah tiap bab kampanye yang dibersihkan (maks 6 sel)' }),
  ]);
  card.querySelector('.btn-hl-up').addEventListener('click', () => {
    const res = purchaseAllyLevel(meta);
    if (res.ok) show();
  });
  wrap.appendChild(card);
}
