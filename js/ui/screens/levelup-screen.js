/**
 * levelup-screen.js — PHAGOS: modal pilihan MUTASI BENTUK saat level up.
 * Game sudah di-pause oleh game.js sebelum modal ini tampil.
 * Pemain klik satu kartu → mutasi diterapkan (atau upgrade safety-net) → lanjut.
 */

import { STATE } from '../../core/state-manager.js';
import { getData, getHero } from '../../core/data-store.js';
import { game } from '../../core/game.js';
import { synergyFor } from '../../systems/retention-system.js';
import { el } from '../screen-manager.js';
import { iconEl } from '../menu-icons.js';
import { tierLabel } from '../../systems/mutation-system.js';

const MUTATION_ICONS = {
  spikes: '🦔', sticky: '🍯', trail: '☠️', wobble: '🌊',
  dark_aura: '🌑', thin_wide: '⭕', implosion: '🌀', double_ring: '◎',
  swell_burst: '💥', rhythmic: '💓', green_pulse: '💚', mirror_shine: '🪞',
  double_shockwave: '🌟', orbiters: '🪐', giant_form: '🦣', chain_ripples: '⛓️',
  shifting_hue: '🌈', breathing_organism: '🫧',
};

export function show({ level, choices }) {
  // F21: level-up = SCENE sinematik (bukan modal tiba-tiba) — potret hero +
  // subjudul cerita, animasi masuk halus di CSS (.lu-scene)
  const heroDef = getHero(STATE.meta.selectedHero) || getData().heroes.heroes[0];
  const heroImg = document.getElementById('levelup-hero');
  if (heroImg) heroImg.src = heroDef.spritePortrait || heroDef.spriteIdle;
  const luName = heroDef.name;
  const bio = game.run ? (game.run.bioPoints || 0) : 0;
  document.getElementById('levelup-sub').textContent =
    `Level ${level} — ${luName} BERMUTASI! Pilih bentuk baru: (◉ ${bio} BIO)`;
  // retrigger animasi masuk tiap kali scene tampil
  const scene = document.querySelector('#screen-levelup .lu-scene');
  if (scene) {
    scene.classList.remove('anim');
    void scene.offsetWidth;
    scene.classList.add('anim');
  }

  const wrap = document.getElementById('levelup-choices');
  wrap.textContent = '';

  // Fase 17 (trigger 3C): sinergi = upgrade yang cocok dgn peran hero terpilih
  const syn = synergyFor(heroDef);

  for (const def of choices) {
    if (def.isMutation) {
      wrap.appendChild(mutationCard(def, bio));
    } else {
      wrap.appendChild(upgradeCard(def, heroDef, syn));
    }
  }
}

function mutationCard(def, bio) {
  const locked = !!def.lockedByBio || (def.bioCost || 0) > bio;
  const icon = MUTATION_ICONS[def.visualChange] || '🧬';
  // PHAGOS: ikon kartu = aset sprite mutasi (emoji hanya cadangan)
  const iconNode = def.sprite
    ? el('img', { class: 'choice-mut-sprite', src: def.sprite, alt: '', draggable: 'false' })
    : el('div', { class: 'choice-icon mutation-icon', text: icon });
  const card = el('button', {
    class: 'choice-card mutation-card tier-' + (def.tier || 1) + (locked ? ' locked' : ''),
    onclick: () => {
      if (locked) return;
      game.chooseLevelUp(def.id);
      if (STATE.levelUpOpen && game.run && game.run.currentChoices) {
        show({ level: game.run.level, choices: game.run.currentChoices });
      }
    },
  }, [
    iconNode,
    el('div', { class: 'choice-info' }, [
      el('b', {}, [
        el('span', { text: def.name }),
        el('span', { class: 'syn-badge mut-tier', text: tierLabel(def.tier || 1) }),
        (def.bioCost || 0) > 0
          ? el('span', { class: 'syn-badge bio-cost' + (locked ? ' locked' : ''), text: `◉ ${def.bioCost} BIO` })
          : el('span', { class: 'syn-badge bio-free', text: 'GRATIS' }),
      ]),
      el('p', { text: def.desc }),
      def.lore ? el('p', { class: 'mut-lore', text: def.lore }) : null,
      locked ? el('span', { class: 'choice-stack', text: 'Bio-Point kurang — engulf lebih banyak!' }) : null,
    ]),
  ]);
  return card;
}

function upgradeCard(def, heroDef, syn) {
  const stacks = STATE.meta && game.run ? game.run.upgrades[def.id] || 0 : 0;
  const isSyn = syn.includes(def.id);
  const rar = def.rarity || def.tier || 'common';
  const card = el('button', {
    class: 'choice-card safety-card' + (isSyn ? ' synergy' : '') + ` rar-${rar}`,
    onclick: () => {
      game.chooseLevelUp(def.id);
      if (STATE.levelUpOpen && game.run && game.run.currentChoices) {
        show({ level: game.run.level, choices: game.run.currentChoices });
      }
    },
  }, [
    el('div', { class: 'choice-icon' }, [iconEl(def)]),
    el('div', { class: 'choice-info' }, [
      el('b', {}, [
        el('span', { text: def.name }),
        el('span', { class: 'syn-badge safety-badge', text: 'STAT' }),
        isSyn ? el('span', { class: 'syn-badge', title: `Cocok untuk ${heroDef.name}`, text: '✦ Sinergi' }) : null,
        (rar === 'legendary' ? el('span', { class: 'syn-badge rar-badge-legendary', text: 'LEGENDARY' })
          : rar === 'epic' ? el('span', { class: 'syn-badge rar-badge-epic', text: 'EPIC' })
          : rar === 'rare' ? el('span', { class: 'syn-badge rar-badge-rare', text: 'RARE' })
          : rar === 'uncommon' ? el('span', { class: 'syn-badge rar-badge-uncommon', text: 'UNCOMMON' }) : null),
      ]),
      el('p', { text: def.desc }),
      stacks > 0 ? el('span', { class: 'choice-stack', text: `Dimiliki: ${stacks}x` }) : null,
    ]),
  ]);
  return card;
}

export function hide() {}
