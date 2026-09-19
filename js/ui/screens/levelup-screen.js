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
import { tierLabel, mutationDef as mutationDefById, mutationPriceFor } from '../../systems/mutation-system.js';
import { describeAttackChange } from '../../systems/attack-archetype.js';
import { economyPhase } from '../../systems/antibody-economy.js';
import { hasSprite } from '../../render/sprite-loader.js'; // UI-REBUILD P8: foto bentuk mutasi
import { t as tr } from '../../systems/i18n.js';

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
  // UI-REBUILD P8: bila hero sudah bermutasi, potret adegan = foto bentuk
  // mutasinya (bukan potret dasar) — mutasi terlihat sebagai wujud karakter.
  const _muts = (game.run && game.run.activeMutations) || [];
  const _topTier = _muts.reduce((mx, id) => Math.max(mx, (mutationDefById(id)?.tier) || 1), 0);
  if (heroImg) {
    const stage = _muts.length === 0 ? 0 : (_topTier >= 2 ? 2 : 1);
    const mut = stage ? heroDef[`spriteMut${stage}Idle`] : null;
    heroImg.src = (mut && hasSprite(mut)) ? mut : (heroDef.spritePortrait || heroDef.spriteIdle);
  }
  const luName = heroDef.name;
  // P3: modal mutasi menampilkan dompet ANTIBODI + harga mutasi berikutnya
  // (IAP §6) supaya pemain tahu apa yang sedang dituju — tanpa hard selling.
  const dompet = game.run ? (game.run.antibody || 0) : 0;
  const harga = mutationPriceFor(game.run);
  const phase = economyPhase((game.run && game.run.activeMutations || []).length);
  const labelFase = { abundance: 'MELIMPAH', tension: 'MENEGANG', scarcity: 'LANGKA' }[phase] || '';
  // P7 (keluhan user): subjudul DIPADATKAN — satu baris, inti saja.
  document.getElementById('levelup-sub').textContent =
    `Lv ${level} · ◉ ${dompet}/${harga}${labelFase ? ` · ${labelFase}` : ''}`;
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
      wrap.appendChild(mutationCard(def, heroDef));
    } else {
      wrap.appendChild(upgradeCard(def, heroDef, syn));
    }
  }

  // P5 (IAP §18-§20): FRIKSI EKONOMI — bila ada kartu mutasi terkunci,
  // tampilkan hierarki bantuan. Panel ini KECIL dan KONTEKSTUAL: hanya muncul
  // saat pemain benar-benar kekurangan antibodi, tidak pernah mengambil alih
  // momen transformasi (§27), dan tidak pernah memblokir (§10).
  const butuhBantuan = choices.some((c) => c.lockedByAntibody);
  const lama = wrap.parentElement && wrap.parentElement.querySelector('.lu-friction');
  if (lama) lama.remove();
  if (butuhBantuan && game.frictionAssist) {
    wrap.insertAdjacentElement('afterend', frictionPanel(level, choices));
  }
}

/**
 * Panel hierarki bantuan: CONTINUE (gratis) → WATCH AD (gratis, berjeda) →
 * USE RESERVE (cadangan/IAP). IAP hanya muncul bila cadangan pun tidak cukup
 * (§17, §20) dan kuota tayang per run belum habis (§27).
 */
function frictionPanel(level, choices) {
  const a = game.frictionAssist();
  const kurang = a.shortfall;

  // --- baris 1: CONTINUE (jalur gratis, selalu ada) ---
  const continueBtn = el('button', {
    class: 'fric-btn fric-continue',
    onclick: () => game.deferLevelUp(),
  }, [
    el('span', { class: 'fric-ico', text: '▶' }),
    el('span', { class: 'fric-label', text: tr('Lanjut bertempur') }),
    el('span', { class: 'fric-sub', text: tr('gratis · mutasi ditawarkan lagi nanti') }),
  ]);

  // --- baris 2: WATCH AD (gratis, +antibodi, ada jeda & kuota) ---
  const ad = a.ad || {};
  const adSub = !ad.enabled ? tr('iklan nonaktif')
    : ad.canWatch ? tr(`+${ad.reward} Antibodi · gratis`)
      : ad.reason === 'jeda' ? tr(`tunggu ${ad.cooldownLeftSec}d`)
        : ad.reason === 'kuota-habis' ? tr('kuota hari ini habis')
          : tr('belum tersedia');
  const adBtn = el('button', {
    class: 'fric-btn fric-ad' + (ad.canWatch ? '' : ' off'),
    disabled: ad.canWatch ? null : 'disabled',
    onclick: () => {
      if (!ad.canWatch) return;
      game.watchAntibodyAd(() => {
        if (game.run && game.run.currentChoices && STATE.levelUpOpen) {
          show({ level: game.run.level, choices: game.run.currentChoices });
        }
      });
    },
  }, [
    el('span', { class: 'fric-ico', text: '🎬' }),
    el('span', { class: 'fric-label', text: tr('Tonton iklan') }),
    el('span', { class: 'fric-sub', text: adSub }),
  ]);

  // --- baris 3: USE RESERVE (bantuan maksimal X% harga, N kali per run) ---
  const rv = a.reserve || {};
  const rvSub = rv.amount > 0
    ? tr(`bantu +${rv.amount} ◉ · maks ${rv.cap} ◉ (${rv.usesLeft}x lagi)`)
    : rv.reason === 'habis-run' ? tr('sudah dipakai di run ini')
      : rv.reason === 'kosong' ? tr(`cadangan ${rv.saldo} ◉`)
        : tr(`cadangan ${rv.saldo} ◉`);
  const rvBtn = el('button', {
    class: 'fric-btn fric-reserve' + (rv.amount > 0 ? '' : ' off'),
    disabled: rv.amount > 0 ? null : 'disabled',
    onclick: () => {
      if (!(rv.amount > 0)) return;
      game.useReserveAssist(() => {
        if (game.run && game.run.currentChoices && STATE.levelUpOpen) {
          show({ level: game.run.level, choices: game.run.currentChoices });
        }
      });
    },
  }, [
    el('span', { class: 'fric-ico', text: '💠' }),
    el('span', { class: 'fric-label', text: tr('Pakai cadangan') }),
    el('span', { class: 'fric-sub', text: rvSub }),
  ]);

  const kids = [
    el('p', { class: 'fric-head', text: tr(`Antibodi kurang ${kurang} ◉ — pilih jalanmu`) }),
    el('div', { class: 'fric-row' }, [continueBtn, adBtn, rvBtn]),
  ];

  // --- baris 4: IAP kontekstual (prototipe mock, paling akhir & paling kecil) ---
  if (a.iap && a.iap.enabled && a.iap.packs.length > 0) {
    kids.push(el('div', { class: 'fric-iap' }, [
      el('span', { class: 'fric-iap-note', text: tr('Atau isi cadangan (prototipe, bukan pembelian nyata):') }),
      ...a.iap.packs.map((pk) => el('button', {
        class: 'fric-pack',
        title: tr('Dev grant — tidak ada pembayaran nyata (IAP §21)'),
        onclick: async (ev) => {
          const btn = ev && ev.currentTarget;
          if (btn) btn.disabled = true;
          await game.buyReservePack(pk.id, () => {
            if (game.run && game.run.currentChoices && STATE.levelUpOpen) {
              show({ level: game.run.level, choices: game.run.currentChoices });
            }
          });
        },
      }, [el('span', { text: `+${pk.grant}` }), el('small', { text: pk.label || pk.id })])),
    ]));
  }

  return el('div', { class: 'lu-friction' }, kids);
}

function mutationCard(def, heroDef) {
  const locked = !!def.lockedByAntibody;
  const dompetKini = (game.run && game.run.antibody) || 0;
  const icon = MUTATION_ICONS[def.visualChange] || '🧬';
  const _mutsKini = (game.run && game.run.activeMutations) || [];
  // P2: apa yang BERUH pada cara bertempur, dibaca langsung dari blok
  // `attack` mutasi (data/mutations.json) — bukan karangan teks.
  const _ubah = describeAttackChange(def, heroDef);
  // PHAGOS: ikon kartu = aset sprite mutasi (emoji hanya cadangan).
  // UI-REBUILD P8: kalau hero punya FOTO bentuk mutasi, itu yang dipakai —
  // pemain melihat wujud barunya, bukan ikon generik.
  // Bentuk yang dijanjikan kartu mengikuti TIER-nya: tier 1 → foto mutasi
  // dasar, tier 2/3 → foto mutasi lanjut (kalau sudah tersedia).
  const _cardStage = (def.tier || 1) >= 2 ? 2 : 1;
  const _form = heroDef ? (heroDef[`spriteMut${_cardStage}Idle`] || heroDef.spriteMut1Idle) : null;
  const _punyaFoto = !!(heroDef && _form && hasSprite(_form));
  // P2: kartu mutasi memperlihatkan BENTUK SEKARANG → BENTUK BARU (foto
  // karakter sendiri, bukan ikon/overlay) supaya mutasi terbaca sebagai
  // evolusi wujud, bukan sekadar daftar angka.
  const _stageKini = (_mutsKini.length === 0) ? 0 : ((_mutsKini.reduce((mx, id) => Math.max(mx, (mutationDefById(id)?.tier) || 1), 0)) >= 2 ? 2 : 1);
  const _formKini = heroDef ? (heroDef[`spriteMut${_stageKini}Idle`] || heroDef.spritePortrait || heroDef.spriteIdle) : null;
  const _fotoKini = (heroDef && _stageKini === 0) ? (heroDef.spritePortrait || heroDef.spriteIdle)
    : (heroDef && _formKini && hasSprite(_formKini) ? _formKini : (heroDef.spritePortrait || heroDef.spriteIdle));
  const iconNode = _punyaFoto
    ? el('div', { class: 'mut-forms' }, [
        el('img', { class: 'choice-mut-sprite mut-form mut-before', src: _fotoKini, alt: 'Bentuk sekarang', draggable: 'false' }),
        el('span', { class: 'mut-arrow', text: '➜' }),
        el('img', { class: 'choice-mut-sprite mut-form mut-after', src: _form, alt: 'Bentuk baru', draggable: 'false' }),
      ])
    : def.sprite
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
        // P7: harga SELALU terbaca — kalau terkunci, tampilkan KEKURANGANNYA.
        (def.cost || 0) > 0
          ? el('span', { class: 'syn-badge bio-cost' + (locked ? ' locked' : ''), text: locked
            ? `◉ ${def.cost} · kurang ${Math.max(0, def.cost - dompetKini)}`
            : `◉ ${def.cost}` })
          : el('span', { class: 'syn-badge bio-free', text: 'GRATIS' }),
      ]),
      // P7: SATU baris saja — yang BERUBAH pada cara bertempur lebih penting
      // dari deskripsi; lore jadi tooltip (tidak memakan ruang kartu).
      el('p', { class: 'mut-line', text: _ubah ? _ubah : def.desc, title: def.lore || def.desc || '' }),
    ]),
  ]);
  return card;
}

function upgradeCard(def, heroDef, syn) {
  const stacks = STATE.meta && game.run ? game.run.upgrades[def.id] || 0 : 0;
  const isSyn = syn.includes(def.id);
  const rar = def.rarity || 'common';
  const card = el('button', {
    class: 'choice-card safety-card' + (isSyn ? ' synergy' : '') +
      (rar !== 'common' ? ` rar-${rar}` : ''),
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
        (rar === 'epic' ? el('span', { class: 'syn-badge', style: 'background:#c39bd3;color:#2c1a38', text: 'EPIC' })
          : rar === 'rare' ? el('span', { class: 'syn-badge', style: 'background:#7fdbff;color:#0b2a33', text: 'RARE' }) : null),
      ]),
      el('p', { text: def.desc }),
      stacks > 0 ? el('span', { class: 'choice-stack', text: `Dimiliki: ${stacks}x` }) : null,
    ]),
  ]);
  return card;
}

export function hide() {}
