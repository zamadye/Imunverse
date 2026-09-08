/**
 * codex-screen.js — Kodex Sel (Bio-Pedia): grid kartu sains per kategori.
 * Terkunci = siluet (sprite gelap + tanda tanya). Terbuka = kartu penuh,
 * diklik menampilkan detail dua kedalaman: "Untuk kamu" (anak) dan
 * "Tahukah kamu?" (dewasa muda). Semua teks dwibahasa via mesin i18n.
 */

let wired = false;

import { STATE } from '../../core/state-manager.js';
import { getData, getHero, getCharacterDesigns } from '../../core/data-store.js';
import { el } from '../screen-manager.js';
import { isSeen, progress } from '../../systems/codex-system.js';
import { audio } from '../../systems/audio-system.js';

const CATEGORIES = [
  { id: 'hero', label: 'HERO' },
  { id: 'enemy', label: 'MUSUH' },
  { id: 'nutrient', label: 'NUTRISI' },
  { id: 'system', label: 'SISTEM TUBUH' },
  { id: 'organ', label: 'ORGAN' },
];

/** Resolusi nama & gambar kartu dari data sumber (bukan duplikasi). */
function resolve(id, category) {
  if (category === 'hero') {
    const h = getHero(id);
    return h ? { name: h.name, img: h.spriteIdle || h.sprite } : null;
  }
  if (category === 'enemy') {
    const e = (getData().enemies.enemies || []).find((x) => x.id === id);
    return e ? { name: e.name, img: e.sprite } : null;
  }
  if (category === 'nutrient') {
    const n = (getData().nutrients.nutrients || []).find((x) => x.id === id);
    return n ? { name: n.name, img: n.sprite } : null;
  }
  if (category === 'system') {
    const s = (getData().bodySystems.systems || []).find((x) => x.id === id);
    return s ? { name: s.name, img: s.icon } : null;
  }
  if (category === 'organ') {
    const ch = (getData().campaign.chapters || []).find((x) => x.id === id);
    if (!ch) return null;
    const ar = (getData().arenas.arenas || []).find((a) => a.id === ch.arena);
    return { name: ch.organ, img: ar && ar.thumb ? ar.thumb : null };
  }
  return null;
}

function entryById(id) {
  return (getData().codex.entries || []).find((e) => e.id === id);
}

function enemyFamilyDesign(enemyId) {
  const designs = getCharacterDesigns();
  const def = (getData().enemies.enemies || []).find((x) => x.id === enemyId);
  const family = def?.visualFamily || designs?.pathogens?.enemyMap?.[enemyId] || enemyId;
  return {
    family,
    def,
    design: designs?.pathogens?.families?.[family] || null,
    tiers: designs?.pathogens?.mutationTiers || [],
  };
}

function appendHeroEquityDesign(box, heroId) {
  const hero = getHero(heroId);
  const heroDesign = getCharacterDesigns()?.heroes?.[heroId];
  if (!hero || !heroDesign) return;
  const stages = getData().evolutions.stages || [];
  const rows = [
    {
      stage: 0,
      label: stages.find((s) => s.stage === 0)?.collectionLabel || 'Stage 0 Polos',
      name: 'Base Polos',
      cue: heroDesign.baseCue,
      color: stages.find((s) => s.stage === 0)?.tierColor || '#9db1a8',
    },
    ...(heroDesign.equity || []).map((item) => {
      const st = stages.find((s) => s.stage === item.stage) || {};
      return {
        stage: item.stage,
        label: st.collectionLabel || `Equity ${item.stage}`,
        name: item.name,
        cue: `${item.visualCue} · ${item.anatomy}`,
        color: item.color || st.tierColor || hero.color,
      };
    }),
  ];
  box.appendChild(el('div', { class: 'cxd-kicker', text: 'Design Equity Hero' }));
  box.appendChild(el('div', { class: 'cxd-mutation-panel cxd-equity-panel' }, [
    el('div', { class: 'cxd-family-head' }, [
      el('b', { text: `${hero.name} — ${heroDesign.archetype || 'immune cell'}` }),
      el('span', { text: 'Koleksi Bio-Pedia menampilkan bentuk polos sampai Full Equity supaya identitas biologis hero tetap terbaca di luar arena.' }),
    ]),
    el('div', { class: 'cxd-tier-grid' }, rows.map((row) => el('div', {
      class: 'cxd-tier-chip cxd-equity-chip',
      style: `--tier:${row.color};`,
      title: row.cue,
    }, [
      el('span', { class: 'cxd-tier-no', text: String(row.stage) }),
      el('b', { text: row.label }),
      el('small', { text: row.name }),
      el('em', { text: row.cue }),
    ]))),
  ]));
}

function appendEnemyMutationDesign(box, enemyId) {
  const { family, design, tiers } = enemyFamilyDesign(enemyId);
  if (!design || !tiers.length) return;
  box.appendChild(el('div', { class: 'cxd-kicker', text: 'Design Mutasi Pathogen' }));
  box.appendChild(el('div', { class: 'cxd-mutation-panel' }, [
    el('div', { class: 'cxd-family-head' }, [
      el('b', { text: design.label || family }),
      el('span', { text: design.baseCue || '' }),
    ]),
    el('p', { class: 'cxd-mutation-focus', text: design.mutationFocus || '' }),
    el('div', { class: 'cxd-tier-grid' }, tiers.map((tier) => {
      const cue = (design.tierCues || [])[tier.tier] || tier.visualRule || '';
      return el('div', {
        class: `cxd-tier-chip tier-${tier.tier}`,
        style: `--tier:${tier.color || '#ff5d73'};`,
        title: cue,
      }, [
        el('span', { class: 'cxd-tier-no', text: tier.tier === 0 ? '0' : String(tier.tier) }),
        el('b', { text: tier.label }),
        el('small', { text: tier.tier <= 0 ? 'base/polos' : `mulai wave ${tier.fromWave || (tier.tier * 4 + 1)}` }),
        el('em', { text: cue }),
      ]);
    })),
  ]));
}

function entryDesignTag(e) {
  if (e.category === 'hero') return 'EQUITY 0–4';
  if (e.category === 'enemy') return 'MUTASI 0–4';
  return '';
}

function renderGrid() {
  const box = document.getElementById('codex-grid');
  if (!box) return;
  box.textContent = '';
  const prog = progress();
  const progEl = document.getElementById('codex-progress');
  if (progEl) progEl.textContent = `Ditemukan ${prog.seen} / ${prog.total}`;

  for (const cat of CATEGORIES) {
    const entries = (getData().codex.entries || []).filter((e) => e.category === cat.id);
    if (!entries.length) continue;
    box.appendChild(el('div', { class: 'codex-cat', text: cat.label }));
    const grid = el('div', { class: 'codex-cards' });
    for (const e of entries) {
      const seen = isSeen(e.id);
      const src = resolve(e.id, e.category);
      const card = el('button', { class: `codex-card${seen ? ' seen' : ''}`, 'data-id': e.id });
      if (seen && src) {
        card.appendChild(el('img', { class: 'codex-img', src: src.img, alt: '' }));
        card.appendChild(el('span', { class: 'codex-name', text: src.name }));
        const tag = entryDesignTag(e);
        if (tag) card.appendChild(el('span', { class: 'codex-design-tag', text: tag }));
      } else {
        card.appendChild(el('span', { class: 'codex-q', text: '?' }));
        card.appendChild(el('span', { class: 'codex-name', text: 'Belum ditemukan' }));
      }
      grid.appendChild(card);
    }
    box.appendChild(grid);
  }
}

function showDetail(id) {
  const e = entryById(id);
  if (!e || !isSeen(id)) return;
  const src = resolve(id, e.category);
  const box = document.getElementById('codex-detail-box');
  box.textContent = '';
  const head = el('div', { class: 'cxd-head' });
  if (src && src.img) head.appendChild(el('img', { class: 'cxd-img', src: src.img, alt: '' }));
  const title = el('div', { class: 'cxd-titlewrap' });
  title.appendChild(el('b', { class: 'cxd-name', text: src ? src.name : e.id }));
  title.appendChild(el('span', { class: 'cxd-real', text: e.realName || '' }));
  head.appendChild(title);
  box.appendChild(head);
  box.appendChild(el('div', { class: 'cxd-kicker', text: 'Untuk kamu' }));
  box.appendChild(el('p', { class: 'cxd-kid', text: e.funKid || '' }));
  box.appendChild(el('div', { class: 'cxd-kicker', text: 'Tahukah kamu?' }));
  box.appendChild(el('p', { class: 'cxd-fact', text: e.fact || '' }));
  if (e.category === 'hero') appendHeroEquityDesign(box, id);
  if (e.category === 'enemy') appendEnemyMutationDesign(box, id);
  // R3 Modul A: encounter record — tier memori antigen tertinggi (collection)
  const agTier = (STATE.meta.antigenRecords || {})[e.id] || 0;
  if (agTier > 0) {
    box.appendChild(el('p', {
      class: 'cxd-antigen',
      style: 'color:#c39bd3;font-weight:900;font-size:12px',
      text: `Ag· Memori Antigen: Tier ${agTier} — pasukan mengingat musuh ini`,
    }));
  }
  const wrap = document.getElementById('codex-detail');
  wrap.classList.remove('hidden');
  sweepSubtree(box);
}

/** Terjemahan langsung untuk subtree (layar dirender dinamis). */
function sweepSubtree(root) {
  import('../../systems/i18n.js').then(({ translateTree }) => translateTree(root));
}

export function show() {
  renderGrid();
  document.getElementById('codex-detail')?.classList.add('hidden');
  sweepSubtree(document.getElementById('screen-codex'));
  if (!wired) {
    wired = true;
    const grid = document.getElementById('codex-grid');
    grid.addEventListener('click', (ev) => {
      const card = ev.target.closest('.codex-card');
      if (!card || !card.classList.contains('seen')) return;
      audio.collect();
      showDetail(card.dataset.id);
    });
    document.getElementById('codex-detail-close').addEventListener('click', () => {
      document.getElementById('codex-detail').classList.add('hidden');
    });
  }
}

export function hide() {
  document.getElementById('codex-detail')?.classList.add('hidden');
}
