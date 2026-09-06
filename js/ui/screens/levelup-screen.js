/**
 * levelup-screen.js — Modal pilihan 3 upgrade acak saat level up.
 * Game sudah di-pause oleh game.js sebelum modal ini tampil.
 * Pemain klik satu kartu → upgrade diterapkan (logic asli) → lanjut main.
 */

import { STATE } from '../../core/state-manager.js';
import { getData, getHero } from '../../core/data-store.js';
import { game } from '../../core/game.js';
import { synergyFor } from '../../systems/retention-system.js';
import { el } from '../screen-manager.js';

export function show({ level, choices }) {
  // F21: level-up = SCENE sinematik (bukan modal tiba-tiba) — potret hero +
  // subjudul cerita, animasi masuk halus di CSS (.lu-scene)
  const heroDef = getHero(STATE.meta.selectedHero) || getData().heroes.heroes[0];
  const heroImg = document.getElementById('levelup-hero');
  if (heroImg) heroImg.src = heroDef.spritePortrait || heroDef.spriteIdle;
  const luName = heroDef.name;
  document.getElementById('levelup-sub').textContent = `Level ${level} — ${luName} beradaptasi! Pilih evolusi:`;
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
    const stacks = STATE.meta && game.run ? game.run.upgrades[def.id] || 0 : 0;
    const isSyn = syn.includes(def.id);
    const card = el('button', {
      class: 'choice-card' + (isSyn ? ' synergy' : ''),
      onclick: () => {
        game.chooseLevelUp(def.id);
        // bila masih ada level berlebih, game.js membuka modal baru — render ulang
        if (STATE.levelUpOpen && game.run && game.run.currentChoices) {
          show({ level: game.run.level, choices: game.run.currentChoices });
        }
      },
    }, [
      def.icon.startsWith('assets/')
        ? el('div', { class: 'choice-icon' }, [el('img', { src: def.icon, alt: '', style: 'width:28px;height:28px;object-fit:contain;' })])
        : el('div', { class: 'choice-icon', text: def.icon }),
      el('div', { class: 'choice-info' }, [
        el('b', {}, [
          el('span', { text: def.name }),
          isSyn ? el('span', { class: 'syn-badge', title: `Cocok untuk ${heroDef.name}`, text: '✦ Sinergi' }) : null,
        ]),
        el('p', { text: def.desc }),
        stacks > 0 ? el('span', { class: 'choice-stack', text: `Dimiliki: ${stacks}x` }) : null,
      ]),
    ]);
    wrap.appendChild(card);
  }
}

export function hide() {}
