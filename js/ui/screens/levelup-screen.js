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
  previewMutation(null);

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
  card.addEventListener('pointerenter', () => previewMutation(def));
  card.addEventListener('pointerleave', () => previewMutation(null));
  card.addEventListener('focus', () => previewMutation(def));
  card.addEventListener('blur', () => previewMutation(null));
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

export function hide() { previewMutation(null); }


function previewMutation(def) {
  const name = document.getElementById('mut-preview-name');
  const desc = document.getElementById('mut-preview-desc');
  const cv = document.getElementById('mut-preview-canvas');
  if (!name || !desc) return;
  if (!def) {
    name.textContent = 'Pratinjau mutasi';
    desc.textContent = 'Mutasi ini akan mengubah bentuk membranmu.';
    drawMutPreview(cv, null);
    return;
  }
  name.textContent = def.name;
  desc.textContent = def.lore || def.desc || 'Mutasi ini akan mengubah bentuk membranmu.';
  drawMutPreview(cv, def);
}

function drawMutPreview(cv, def) {
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const w = cv.width;
  const h = cv.height;
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w * 0.7);
  bg.addColorStop(0, '#0a2430');
  bg.addColorStop(1, '#04111a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const x = w / 2;
  const y = h / 2;
  const r = 28;
  const vis = def && def.visualChange;
  const col = vis === 'dark_aura' ? '#a78bfa' : vis === 'spikes' ? '#ff3d5a' : vis === 'green_pulse' ? '#a8e63d' : '#00e5c4';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.6);
  halo.addColorStop(0, col);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (vis === 'wobble' || vis === 'breathing_organism') {
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const wob = 1 + 0.12 * Math.sin(a * 4);
      const px = x + Math.cos(a) * r * wob;
      const py = y + Math.sin(a) * r * wob;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (vis === 'spikes') {
    for (let i = 0; i < 10; i++) {
      const a = i * 0.628;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45);
      ctx.stroke();
    }
  } else if (vis === 'double_ring' || vis === 'double_shockwave') {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.28, 0, Math.PI * 2);
    ctx.stroke();
  } else if (vis === 'orbiters') {
    for (let i = 0; i < 3; i++) {
      const a = i * 2.094;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35, 4, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }
  } else if (vis === 'trail') {
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(x - r * 1.4, y + 8);
    ctx.quadraticCurveTo(x, y + 18, x + r * 1.4, y + 8);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}
