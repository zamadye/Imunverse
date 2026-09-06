/**
 * dashboard-screen.js — Dashboard ala reference user:
 * topbar currency + panggung hero pastel + strip statistik + daily +
 * misi, dengan dock navigasi (Play/Heroes/Squad/Shop) di index.html.
 */

import { STATE } from '../../core/state-manager.js';
import { getData, getHero } from '../../core/data-store.js';
import { writeSave } from '../../save/save-manager.js';
import { canClaimDailyReward, claimDailyReward } from '../../systems/economy-system.js';
import { getMissionProgressList, getQuestProgress, acceptQuest, claimQuest } from '../../systems/mission-system.js';
import { checkDailyLives } from '../../systems/monetization.js';
import { audio } from '../../systems/audio-system.js';
import { t as tr } from '../../systems/i18n.js';
import { markSeen } from '../../systems/codex-system.js';
import { drainHeroNotices } from '../../systems/retention-system.js';
import { getEvoStageDef, getNextEvoStageDef, canEvolve, evolve } from '../../systems/evolution-system.js';
import {
  getBodyState, getCriticalSystems, getMilestoneProgress, getNarrativeStage,
  applyDailyDecay, recoverViaAd,
} from '../../systems/body-system.js';
import { canWatchAd, trackAdWatch, triggerRewardedAdRecovery } from '../../systems/monetization.js';
import { playerRank } from '../../systems/rank-system.js';
import { applyGateVisual, gateFor } from '../../systems/feature-gate.js';
import { arenaUnlockStatus } from './arena-screen.js';
import { getLeaderboard, getModeUnlockStatus, getTodayMutator } from '../../systems/liveops-system.js';
import { currentChapterId } from './campaign-screen.js';
import { getSession, getFactionDef } from '../../systems/account-system.js';
import { heroLevelBadge, allyLevelBadge } from '../../systems/economy-system.js';
import { ensureFounderReward } from '../../systems/imun-economy.js';
import { screenManager } from '../screen-manager.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { emit } from '../../core/ui-bridge.js';
import { el } from '../screen-manager.js';

/** Fase 13: ikon organ per arena (untuk kartu & banner kampanye). */
const ORGAN_ICONS = {
  limfe: 'assets/sprites/icon_limfatik.png',
  lambung: 'assets/sprites/icon_pencernaan.png',
  paru: 'assets/sprites/icon_paru.png',
  saraf: 'assets/sprites/icon_saraf.png',
};

let bannerTimer = null;
let dashWasHidden = true; // Fase 15 audit: reset scroll hanya saat masuk layar
let bannerIdx = 0;

function setBannerSlide(i) {
  const slides = document.querySelectorAll('#dash-banner .banner-slide');
  const dots = document.querySelectorAll('#banner-dots .b-dot');
  if (!slides.length) return;
  bannerIdx = i % slides.length;
  slides.forEach((el, k) => el.classList.toggle('on', k === bannerIdx));
  dots.forEach((el, k) => el.classList.toggle('on', k === bannerIdx));
  // Fase 15: cinematic hanya jalan saat slide panggung (0) tampil
  import('../../render/cine-banner.js').then((m) => {
    const cv = document.getElementById('dash-cine');
    if (bannerIdx === 0 && cv) m.startBannerCine(cv);
    else m.stopBannerCine();
  }).catch((e) => console.error('cine-banner import gagal:', e));
}

/** Fase 17 (trigger 1B): overlay perayaan HERO BARU — potret + partikel bintang. */
function showHeroNotice() {
  const heroes = drainHeroNotices();
  if (!heroes.length) return;
  let layer = document.getElementById('hero-notice');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'hero-notice';
    document.body.appendChild(layer);
  }
  const h = heroes[heroes.length - 1];
  layer.className = 'show';
  layer.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'hn-box';
  box.innerHTML = `
    <div class="hn-stars"></div>
    <img class="hn-sprite" src="${h.spritePortrait || h.spriteIdle}" alt="${h.name}" />
    <div class="hn-kicker">HERO BARU!</div>
    <b class="hn-name">${h.name}</b>
    <span class="hn-title">${h.title || ''}</span>`;
  layer.appendChild(box);
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.className = 'hn-star';
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 260}px`);
    s.style.setProperty('--dy', `${(Math.random() - 0.5) * 200}px`);
    s.style.animationDelay = `${Math.random() * 0.5}s`;
    box.querySelector('.hn-stars').appendChild(s);
  }
  clearTimeout(showHeroNotice._t);
  showHeroNotice._t = setTimeout(() => { layer.className = ''; }, 3200);
}

function stopBannerTimer() {
  if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; }
}

/** Fase 13: banner carousel 3 slide — panggung hero, bab berikutnya, ancaman/endless. */
function renderBanner(meta) {
  const dots = document.getElementById('banner-dots');
  dots.textContent = '';
  document.querySelectorAll('#dash-banner .banner-slide').forEach((_, k) => {
    dots.appendChild(el('button', { class: `b-dot${k === 0 ? ' on' : ''}`, 'aria-label': `Slide ${k + 1}` }));
  });
  [...dots.children].forEach((d, k) => d.addEventListener('click', () => { stopBannerTimer(); setBannerSlide(k); }));

  // Slide 2: bab kampanye berikutnya
  const chapters = getData().campaign.chapters;
  const ch = chapters.find((c) => !STATE.meta.campaignCleared?.[c.id]) || chapters[chapters.length - 1];
  const chIdx = chapters.indexOf(ch);
  const doneCount = chapters.filter((c) => STATE.meta.campaignCleared?.[c.id]).length;
  const sl2 = document.getElementById('banner-chapter');
  sl2.textContent = '';
  sl2.appendChild(el('img', { class: 'bn-organ', src: ORGAN_ICONS[ch.arenaId] || 'assets/sprites/deco_star_pop.png', alt: '' }));
  sl2.appendChild(el('div', { class: 'bn-tag', text: `BAB ${chIdx + 1}/${chapters.length}` }));
  sl2.appendChild(el('b', { class: 'bn-title', text: ch.organ }));
  sl2.appendChild(el('span', { class: 'bn-sub', text: `${ch.title} · ${ch.objective}` }));
  sl2.appendChild(el('button', {
    class: 'btn btn-primary bn-cta',
    text: doneCount ? 'LANJUT BAB' : 'MULAI BAB',
    onclick: () => screenManager.show('campaign'),
  }));

  // Slide 3: ancaman / mode endless
  const endless = getData().modes.modes.find((m) => m.id === 'endless');
  const status = getModeUnlockStatus(endless, meta);
  const mut = getTodayMutator();
  const bossDef = getData().enemies.enemies.find((e) => e.id === 'sel_kanker') || getData().enemies.enemies[0];
  const sl3 = document.getElementById('banner-endless');
  sl3.classList.add('bn-danger');
  sl3.textContent = '';
  sl3.appendChild(el('img', { class: 'bn-organ', src: spriteToDataURL(bossDef.spriteIdle || bossDef.sprite), alt: bossDef.name }));
  sl3.appendChild(el('div', { class: 'bn-tag', text: 'ANCAMAN HARI INI' }));
  sl3.appendChild(el('b', { class: 'bn-title', text: 'Mode Endless' }));
  sl3.appendChild(el('span', { class: 'bn-sub', text: status.unlocked ? `Mutator: ${mut.def.name}` : status.label }));
  sl3.appendChild(el('button', {
    class: 'btn ' + (status.unlocked ? 'btn-gold bn-cta' : 'btn bn-cta'),
    text: status.unlocked ? 'TANTANG' : 'TERKUNCI',
    onclick: () => {
      if (!status.unlocked) { screenManager.show('campaign'); return; }
      STATE.meta.selectedMode = 'endless';
      writeSave(STATE.meta);
      screenManager.show('prep');
    },
  }));

  setBannerSlide(0);
  stopBannerTimer();
  bannerTimer = setInterval(() => setBannerSlide(bannerIdx + 1), 5200);
}

  /** Dashboard focus: empat pintu sekunder; daily/misi tetap hidup sebagai notifikasi di bawah. */
function renderQuickRow(meta) {
  const row = document.getElementById('quick-row');
  row.textContent = '';
  const tiles = [
    { key: 'roster', ico: 'assets/sprites/icon_heroes.png', label: 'Heroes', badge: '', act: () => screenManager.show('roster') },
    { key: 'shop', ico: 'assets/sprites/icon_shop.png', label: 'Shop', badge: '', act: () => screenManager.show('shop') },
    { key: 'codex', ico: 'assets/sprites/icon_scope.png', label: 'Collection', badge: '', act: () => screenManager.show('codex') },
    { key: 'rank', ico: 'assets/sprites/icon_trophy.png', label: 'Stats', badge: '', act: () => screenManager.show('rank') },
  ];
  for (const tl of tiles) {
    const t = el('button', { class: 'quick-tile', title: tl.label }, [
      tl.badge ? el('span', { class: 'qt-badge', text: tl.badge }) : null,
      el('img', { src: tl.ico, alt: '' }),
      el('span', { class: 'qt-label', text: tl.label }),
    ]);
    // F21: gerbang bertahap — tile terkunci menampilkan syarat & toast (buka via main)
    const gate = gateFor('quick', tl.key);
    if (gate && gate.locked) {
      t.classList.add('gated');
      t.appendChild(el('span', { class: 'gate-lock', text: `🔒 Gel.${gate.requireWave}` }));
      t.addEventListener('click', () => {
        emit('toast', { message: `Capai Gelombang ${gate.requireWave} untuk membuka!`, kind: 'gold' });
      });
    } else {
      t.addEventListener('click', tl.act);
    }
    row.appendChild(t);
  }
}

/** Fase 13: kartu KAMPANYE besar (bab aktif + tombol MULAI #btn-play-big). */
function renderCampaignCard(meta) {
  const card = document.getElementById('campaign-card');
  const chapters = getData().campaign.chapters;
  const ch = chapters.find((c) => !meta.campaignCleared?.[c.id]) || chapters[chapters.length - 1];
  const chIdx = chapters.indexOf(ch);
  card.textContent = '';
  card.appendChild(el('div', { class: 'cc-head' }, [
    el('h3', { class: 'card-title', text: 'KAMPANYE' }),
    el('span', { class: 'cc-count', text: `${chIdx + 1}/${chapters.length}` }),
  ]));
  card.appendChild(el('img', { class: 'cc-organ', src: ORGAN_ICONS[ch.arenaId] || 'assets/sprites/deco_star_pop.png', alt: ch.organ }));
  card.appendChild(el('b', { class: 'cc-name', text: ch.organ }));
  card.appendChild(el('span', { class: 'cc-title', text: ch.title }));
  card.appendChild(el('span', { class: 'cc-obj', text: ch.objective }));
  const play = el('button', { id: 'btn-play-big', class: 'btn-play-big', 'aria-label': 'Mulai — persiapan pertempuran' }, [
    el('img', { src: 'assets/sprites/icon_play.png', alt: '' }),
    el('span', { text: 'MULAI' }),
    el('small', { id: 'play-big-sub', text: ch.organ }),
  ]);
  card.appendChild(play);
}

/** Fase 13: kolom mode — Endless (status asli), Arena (kartu lama), Lab Pasukan. */
function renderModeStack(meta) {
  const endless = getData().modes.modes.find((m) => m.id === 'endless');
  const status = getModeUnlockStatus(endless, meta);
  const mut = getTodayMutator();
  const card = document.getElementById('mode-endless');
  card.textContent = '';
  card.classList.toggle('locked', !status.unlocked);
  card.appendChild(el('img', { class: 'mc-ico', src: endless.icon, alt: '' }));
  card.appendChild(el('div', { class: 'mc-body' }, [
    el('b', { text: 'Endless' }),
    el('span', { text: status.unlocked ? `Mutator: ${mut.def.name}` : status.label }),
  ]));
  card.appendChild(el('button', {
    class: 'btn ' + (status.unlocked ? 'btn-primary mc-btn' : 'btn mc-btn'),
    text: status.unlocked ? 'MAIN' : 'TERKUNCI',
    disabled: !status.unlocked,
    onclick: () => {
      STATE.meta.selectedMode = 'endless';
      writeSave(STATE.meta);
      screenManager.show('prep');
    },
  }));

  const lab = document.getElementById('mode-lab');
  lab.textContent = '';
  lab.appendChild(el('img', { class: 'mc-ico', src: 'assets/sprites/icon_squad.png', alt: '' }));
  lab.appendChild(el('div', { class: 'mc-body' }, [
    el('b', { text: 'Lab Pasukan' }),
    el('span', { text: allyLevelBadge(meta) }),
  ]));
  lab.appendChild(el('button', {
    class: 'btn btn-primary mc-btn',
    text: 'UPGRADE',
    onclick: () => screenManager.show('upgrade'),
  }));
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/** Overlay ov_* (silia/kaki/pedang/inti) di panggung sesuai tahap evolusi. */
function renderStageEvoOverlay(meta) {
  let box = document.getElementById('stage-evo');
  if (!box) {
    box = el('div', { id: 'stage-evo' });
    document.getElementById('dash-stage').appendChild(box);
  }
  box.textContent = '';
  const stage = meta.evoStage || 0;
  const layers = [
    ['assets/sprites/ov_inti.png', 'ov-inti', stage >= 4],
    ['assets/sprites/ov_pseudopodia.png', 'ov-pseudopodia', stage >= 2],
    ['assets/sprites/ov_silia.png', 'ov-silia', stage >= 1],
    ['assets/sprites/ov_pedang.png', 'ov-pedang', stage >= 3],
  ];
  for (const [src, cls, on] of layers) {
    if (on) box.appendChild(el('img', { class: cls, src, alt: '' }));
  }
}

/** Kartu evolusi: tahap sekarang, bagian terkumpul, progres & tombol BEREVOLUSI. */
function renderEvoCard(meta) {
  const card = document.getElementById('evo-card');
  card.textContent = '';
  const stage = getEvoStageDef(meta);
  const next = getNextEvoStageDef(meta);
  const parts = getData().evolutions.parts;

  const head = el('div', { class: 'evo-head' }, [
    el('div', { class: 'evo-stage-chip', style: `background:${stage.tierColor}`, text: String(stage.stage + 1) }),
    el('div', { class: 'evo-title' }, [
      el('b', { text: stage.name }),
      el('span', { class: 'evo-tier', style: `color:${stage.tierColor}`, text: `Tier ${stage.tier}` }),
    ]),
    el('span', { class: 'evo-progress', style: 'margin-left:auto', text: `+${Math.round((stage.damageMult - 1) * 100)}% dmg · +${Math.round((stage.maxHPMult - 1) * 100)}% HP` }),
  ]);
  card.appendChild(head);

  // Tag bagian terkumpul + kebutuhan tahap berikutnya
  const partRow = el('div', { class: 'evo-parts' });
  for (const p of parts) {
    const have = meta.evoParts[p.id] || 0;
    const need = next ? (next.cost[p.id] || 0) : 0;
    partRow.appendChild(el('div', { class: `evo-part${need > have ? ' need' : ''}`, title: p.name }, [
      el('img', { src: p.sprite, alt: p.name }),
      el('span', { text: `${have}${need ? `/${need}` : ''}` }),
    ]));
  }
  card.appendChild(partRow);

  if (next) {
    const ready = canEvolve(meta);
    card.appendChild(el('div', { class: 'evo-progress', text: `Berevolusi ke ${next.name} (${next.tier}) — buka kemampuan baru & bentuk baru!` }));
    const btn = el('button', { class: 'btn btn-primary', text: ready ? `BEREVOLUSI → ${next.name.toUpperCase()}` : 'KUMPULKAN BAGIAN EVOLUSI' });
    btn.disabled = !ready;
    btn.addEventListener('click', () => {
      const newStage = evolve(meta);
      if (newStage) {
        audio.evolve();
        emit('toast', { message: `Hero berevolusi: ${newStage.name} (${newStage.tier})!`, kind: 'gold' });
        renderEvoCard(meta);
        renderStageEvoOverlay(meta);
      }
    });
    card.appendChild(btn);
  } else {
    card.appendChild(el('div', { class: 'evo-progress', text: 'Evolusi maksimal — Imun Legenda sejati!' }));
  }
}

/**
 * Kartu KONDISI TUBUH: 5 sistem bar kesehatan + meter energi/racun + label
 * naratif + progres milestone "Sehat Sempurna" + tombol fokus & pemulihan iklan.
 */
/** Papan rekor lokal (top-3 ditampilkan) dari leaderboard per mode. */
function renderLeaderboardCard(meta) {
  const card = document.getElementById('leaderboard-card');
  if (!card) return;
  card.textContent = '';
  const runs = getLeaderboard(meta, 'normal').slice(0, 3);
  card.appendChild(el('h3', { class: 'card-title ico-title' }, [
    el('img', { class: 't-ico', src: 'assets/sprites/icon_trophy.png', alt: '' }),
    el('span', { text: 'Papan Rekor — Klasik' }),
  ]));
  if (!runs.length) {
    card.appendChild(el('p', { class: 'lb-empty', text: 'Belum ada rekor. Selesaikan run pertamamu!' }));
    return;
  }
  const list = el('ol', { class: 'lb-list' });
  runs.forEach((r, i) => {
    list.appendChild(el('li', { class: `lb-row${i === 0 ? ' best' : ''}` }, [
      el('b', { class: 'lb-rank', text: `#${i + 1}` }),
      el('span', { class: 'lb-hero', text: r.heroName }),
      el('span', { class: 'lb-wave', text: `Wave ${r.wave}` }),
      el('span', { class: 'lb-time', text: `${Math.floor(r.time / 60)}m ${r.time % 60}s` }),
    ]));
  });
  card.appendChild(list);
}

function renderBodyCard(meta) {
  const card = document.getElementById('body-card');
  card.textContent = '';
  const cfg = getData().bodySystems;
  const st = getBodyState(meta);
  const narrative = getNarrativeStage(meta);
  const criticals = getCriticalSystems(meta);
  const milestone = getMilestoneProgress(meta);

  // Header: label naratif + tombol fokus
  const focusDef = cfg.focusRuns.find((f) => f.id === (meta.focusRun || 'seimbang'));
  card.appendChild(el('div', { class: 'body-head' }, [
    el('div', { class: 'body-title-wrap' }, [
      el('b', { class: 'body-title', text: `Kondisi Tubuh: ${narrative.label}` }),
      el('span', { class: 'body-sub', text: 'Jaga 5 sistem — tubuh adalah universe-nya.' }),
    ]),
    el('button', { class: 'btn btn-primary btn-sm', text: 'FOKUS', onclick: () => screenManager.show('prep') }),
  ]));

  // Bar 5 sistem
  const rows = el('div', { class: 'body-rows' });
  for (const sysDef of cfg.systems) {
    const sys = st.systems[sysDef.id];
    const crit = sys.health < cfg.criticalThreshold;
    const row = el('div', { class: `body-row${crit ? ' critical' : ''}` });
    row.appendChild(el('img', { class: 'body-ico', src: sysDef.icon, alt: sysDef.name }));
    row.appendChild(el('span', { class: 'body-name', text: sysDef.name }));
    row.appendChild(el('div', { class: 'body-track' }, [
      el('div', {
        class: 'body-fill',
        style: `width:${sys.health}%;background:${sysDef.color}`,
      }),
      el('span', { class: 'body-val', text: String(sys.health) }),
    ]));
    if (crit) {
      row.appendChild(el('img', { class: 'body-crit', src: 'assets/sprites/badge_kritis.png', alt: 'kritis', title: sysDef.critical.label }));
    }
    rows.appendChild(row);
  }
  card.appendChild(rows);

  // Meter energi + racun
  card.appendChild(el('div', { class: 'body-meters' }, [
    el('div', { class: 'meter' }, [
      el('img', { src: 'assets/sprites/meter_energi.png', alt: 'energi' }),
      el('span', { text: `Energi ${st.energi}` }),
    ]),
    el('div', { class: `meter${st.racun >= 70 ? ' danger' : ''}` }, [
      el('img', { src: 'assets/sprites/meter_racun.png', alt: 'racun' }),
      el('span', { text: `Racun ${Math.round(st.racun)}` }),
    ]),
  ]));

  // Milestone makro + pemulihan iklan
  const foot = el('div', { class: 'body-foot' });
  if (!milestone.done) {
    foot.appendChild(el('span', { class: 'body-milestone', text: `🎯 Sehat Sempurna: semua ≥${cfg.perfectThreshold} selama ${cfg.perfectDays} hari — streak ${milestone.streak}/${cfg.perfectDays}` }));
  } else {
    foot.appendChild(el('span', { class: 'body-milestone done', text: '🏆 TUBUH SEHAT SEMPURNA tercapai!' }));
  }
  if (criticals.length > 0 && canWatchAd(meta)) {
    const btn = el('button', { class: 'btn btn-gold btn-sm', text: `+ PEMULIHAN IKLAN (${criticals[0].def.name})` });
    btn.addEventListener('click', () => {
      triggerRewardedAdRecovery(() => {
        trackAdWatch(meta);
        const res = recoverViaAd(meta);
        if (res) emit('toast', { message: `Sistem ${res.name} pulih +${res.gained}!`, kind: 'gold' });
        renderBodyCard(meta);
      });
    });
    foot.appendChild(btn);
  }
  card.appendChild(foot);
}

/** Kartu arena terpilih + tombol GANTI (buka modal pilih arena). */
function renderArenaCard(meta) {
  const card = document.getElementById('arena-card');
  card.textContent = '';
  const arenaDef = getData().arenas.arenas.find((a) => a.id === meta.selectedArena) || getData().arenas.arenas[0];
  const status = arenaUnlockStatus(arenaDef, meta);
  card.appendChild(el('img', { class: 'arena-thumb', src: arenaDef.thumb, alt: arenaDef.name }));
  card.appendChild(el('div', { class: 'arena-info' }, [
    el('b', { text: `Arena: ${arenaDef.name}` }),
    el('span', { text: arenaDef.bonus.desc }),
    status.unlocked
      ? el('span', { text: 'Terbuka ✓' })
      : el('span', { class: 'lock-line' }, [
          el('img', { class: 'lock-ico', src: 'assets/sprites/icon_lock.png', alt: '' }),
          el('span', { text: ` ${status.text}` }),
        ]),
  ]));
  const btn = el('button', { class: 'btn btn-primary', text: 'GANTI' });
  btn.addEventListener('click', () => screenManager.show('arena'));
  card.appendChild(btn);
}

export function show() {
  showHeroNotice(); // Fase 17: perayaan "HERO BARU!" bila ada yang baru terbuka
  if (dashWasHidden) {
    // Fase 15: cegah auto-scroll browser memotong banner saat layar dibuka
    requestAnimationFrame(() => {
      const sc = document.querySelector('.dash-scroll');
      if (sc) sc.scrollTop = 0;
    });
    dashWasHidden = false;
  }
  // Bio-Pedia: peta 5 sistem tubuh selalu tampil di dashboard = 'bertemu' sistem
  for (const sid of ['sirkulasi', 'pencernaan', 'saraf', 'imun', 'limfatik']) markSeen(sid);
  const meta = STATE.meta;
  document.getElementById('dash-currency').textContent = meta.currency.toLocaleString('id-ID');
  // Fase 14: saldo Imun Coin + hadiah early-beta (idempoten)
  ensureFounderReward(meta);
  const imuEl = document.getElementById('dash-imun');
  if (imuEl) imuEl.textContent = (meta.imun || 0).toLocaleString('id-ID');

  // AKUN + FRAKSI: routing konten per pasukan (layout sama, isi beda)
  const session = getSession();
  const faction = getFactionDef(session ? session.faction : 'imun');
  document.documentElement.style.setProperty('--faction-color', faction.color);
  const chip = document.getElementById('account-chip');
  if (chip) {
    chip.style.borderColor = faction.color;
    if (session) {
      chip.classList.remove('hidden');
      chip.querySelector('#account-name').textContent = session.username;
      chip.querySelector('#account-faction').textContent = faction.name.split(' ')[1] || faction.name;
      chip.querySelector('#account-faction').style.background = faction.color;
    } else {
      chip.classList.add('hidden');
    }
  }

  // F21: GERBANG MENU BERTAHAP — side-nav & quick-menu terbuka sesuai bestWave
  document.querySelectorAll('.side-btn').forEach((b) => {
    const id = b.id.replace('side-', '');
    applyGateVisual(b, 'side', id);
  });
  document.querySelectorAll('.dock-btn[data-nav]').forEach((b) => {
    applyGateVisual(b, 'dock', b.dataset.nav);
  });
  document.querySelectorAll('.secondary-dock [data-nav]').forEach((b) => {
    applyGateVisual(b, 'secondary', b.dataset.nav);
  });
  // Fase 19: CHIP PANGKAT PENJAGA — tujuan pemain selalu terlihat (goal gradient)
  const rankChip = document.getElementById('rank-chip');
  if (rankChip) {
    const rk = playerRank();
    rankChip.classList.remove('hidden');
    const em = document.getElementById('rank-emblem');
    em.textContent = rk.tier.insignia;
    em.style.background = `linear-gradient(160deg, ${rk.tier.color}, ${rk.tier.color}cc)`;
    document.getElementById('rank-tier-name').textContent = tr(rk.tier.name);
    const rf = document.getElementById('rank-bar-fill');
    rf.style.width = `${Math.round(rk.pct * 100)}%`;
    rf.style.background = rk.tier.color;
    document.getElementById('rank-sub').textContent = rk.next
      ? `${rk.need} ${tr('GP lagi ke')} ${tr(rk.next.name)}`
      : tr('Pangkat tertinggi!');
    rankChip.onclick = () => screenManager.show('rank');
  }

  // ---- Panggung hero: sprite + nama hero terpilih + badge gelombang terbaik ----
  const heroDef = getHero(meta.selectedHero) || getData().heroes.heroes[0];
  // Fase 15: panggung digambar cinematic canvas — nama/jabatan hero tetap diisi
  const heroNameEl = document.getElementById('dash-hero-name');
  const heroTitleEl = document.getElementById('dash-hero-title');
  if (heroDef && heroNameEl) {
    heroNameEl.textContent = heroDef.name;
    heroTitleEl.textContent = heroDef.title;
  }
  const badge = document.getElementById('dash-best-badge');
  badge.textContent = '';
  badge.appendChild(el('img', { class: 'badge-ico', src: 'assets/sprites/icon_trophy.png', alt: '' }));
  badge.appendChild(el('span', { text: `Gel. ${meta.stats.bestWave}` }));

  // LEVEL HERO & PASUKAN terhubung: chip di panggung (klik → Lab)
  const lvlBadge = document.getElementById('dash-level-badge');
  if (lvlBadge) {
    lvlBadge.textContent = '';
    lvlBadge.appendChild(el('img', { class: 'badge-ico', src: 'assets/sprites/icon_sword.png', alt: '' }));
    lvlBadge.appendChild(el('span', { text: `${heroDef ? heroLevelBadge(meta, heroDef.id) : 'Lv 0'} · Pasukan ${allyLevelBadge(meta)}` }));
    lvlBadge.onclick = () => { audio.ui(); screenManager.show('upgrade'); };
  }

  // CTA MULAI: bila kampanye → tunjuk bab aktif (tujuan jelas sejak dashboard)
  const playSub = document.getElementById('play-big-sub');
  if (playSub) {
    if ((meta.selectedMode || 'kampanye') === 'kampanye' && getData().campaign) {
      const ch = getData().campaign.chapters.find((c) => c.id === (meta.selectedChapter || currentChapterId(meta)))
        || getData().campaign.chapters.find((c) => c.id === currentChapterId(meta));
      if (ch) playSub.textContent = `Bab: ${ch.organ} — ${ch.title} · ${heroDef ? heroLevelBadge(meta, heroDef.id) : ''}`;
    } else {
      playSub.textContent = 'Mode Endless · Mutator Harian';
    }
  }

  // ---- Fase 15: panggung kini milik cinematic canvas — chip musuh statis
  // F13 dipensiunkan (musuh digambar hidup oleh cine-banner.js) ----
  const stageEnemies = document.getElementById('stage-enemies');
  if (stageEnemies) stageEnemies.textContent = '';

  renderLeaderboardCard(meta);
  renderBanner(meta); // Fase 13: banner carousel
  renderQuickRow(meta); // Fase 13: quick menu
  renderCampaignCard(meta); // Fase 13: kartu kampanye besar
  renderModeStack(meta); // Fase 13: kolom mode
  // Fase 13: avatar profil di topbar
  const avatarImg = document.getElementById('dash-avatar');
  if (avatarImg && heroDef) avatarImg.src = spriteToDataURL(heroDef.spritePortrait || heroDef.spriteIdle);

  // ---- Strip statistik (3 sel) ----
  const stats = meta.stats;
  const strip = document.getElementById('dash-stats');
  strip.textContent = '';
  strip.appendChild(el('div', { class: 'stat-cell' }, [el('b', { text: stats.totalKills.toLocaleString('id-ID') }), el('span', { text: 'Total Kill' })]));
  strip.appendChild(el('div', { class: 'stat-cell' }, [el('b', { text: fmtTime(stats.bestSurvivalTime) }), el('span', { text: 'Waktu Terbaik' })]));
  strip.appendChild(el('div', { class: 'stat-cell' }, [el('b', { text: stats.totalRuns }), el('span', { text: 'Total Run' })]));

  // ---- Decay harian + Kartu KONDISI TUBUH (meta-layer organisme) ----
  applyDailyDecay(meta);
  renderBodyCard(meta);

  // ---- Overlay evolusi di panggung (bentuk hero berubah sesuai tahap) ----
  renderStageEvoOverlay(meta);

  // ---- Kartu EVOLUSI HERO: sesuatu yang selalu dikejar user ----
  renderEvoCard(meta);

  // ---- Kartu ARENA terpilih + tombol ganti ----
  renderArenaCard(meta);

  // ---- Daily reward (hook monetisasi + logic asli) ----
  const dailyCard = document.getElementById('daily-card');
  dailyCard.textContent = '';
  const livesAvailable = checkDailyLives(); // HOOK: ketersediaan "daily lives" dari SDK/backend
  const claimable = livesAvailable && canClaimDailyReward(meta);
  const info = el('div', { class: 'daily-info' }, [
    el('b', { class: 'ico-title' }, [
      el('img', { class: 't-ico', src: 'assets/sprites/icon_star.png', alt: '' }),
      el('span', { text: 'Bonus Harian' }),
    ]),
    el('span', { class: 'claim-line' }, claimable ? [
      el('b', { text: `${getData().upgrades.economy.dailyReward}` }),
      el('img', { class: 'inline-coin', src: 'assets/sprites/icon_coin.png', alt: 'antibodi' }),
      el('span', { text: ' menantimu — klaim sekarang!' }),
    ] : [el('span', { text: 'Sudah diklaim hari ini. Kembali besok.' })]),
  ]);
  const btn = el('button', {
    class: 'btn ' + (claimable ? 'btn-gold' : ''),
    text: claimable ? 'KLAIM' : '✓ DIKLAIM',
    disabled: !claimable,
    onclick: () => {
      const amount = claimDailyReward(STATE.meta); // logic asli + auto-save
      if (amount > 0) {
        emit('toast', { message: `Bonus harian +${amount} !`, kind: 'gold' });
        show(); // refresh angka currency
      }
    },
  });
  dailyCard.appendChild(info);
  dailyCard.appendChild(btn);

  // ---- Misi (3 progres teratas yang belum selesai) ----
  const list = document.getElementById('dash-missions');
  list.textContent = '';
  const progress = getMissionProgressList(meta);
  const active = progress.filter((m) => !m.claimed).slice(0, 3);
  const doneCount = progress.filter((m) => m.claimed).length;
  for (const m of active) {
    const pct = Math.min(100, Math.round((m.value / m.target) * 100));
    const item = el('div', { class: 'mission-item' + (m.done ? ' done' : '') }, [
      el('div', { class: 'm-row' }, [
        el('span', { class: 'm-name', text: m.def.name }),
        el('span', { class: 'm-reward' }, [
        el('span', { text: `+${m.def.reward}` }),
        el('img', { class: 'inline-coin', src: 'assets/sprites/icon_imu.png', alt: 'Imun Coin', title: 'Imun Coin' }),
      ]),
      ]),
      el('div', { class: 'm-row' }, [
        el('span', { class: 'mission-more', text: `${m.def.desc} — ${m.value.toLocaleString('id-ID')}/${m.target.toLocaleString('id-ID')}` }),
      ]),
      el('div', { class: 'mission-track' }, [
        el('div', { class: 'mission-fill', style: `width:${pct}%` }),
      ]),
    ]);
    list.appendChild(item);
  }
  if (active.length === 0) {
    list.appendChild(el('p', { class: 'mission-more', text: `Semua misi selesai! (${doneCount}/${progress.length}) 🎉` }));
  } else if (doneCount > 0) {
    list.appendChild(el('p', { class: 'mission-more', text: `+${doneCount} misi lainnya sudah selesai ✓` }));
  }

  // Daily/weekly quest aktif: pemain memilih quest, lalu claim reward Antibodi.
  const questBox = el('div', { class: 'active-quests' });
  questBox.appendChild(el('b', { class: 'quest-heading', text: 'Quest Pilihan' }));
  for (const q of getQuestProgress(meta).slice(0, 4)) {
    const pct = Math.round((q.value / q.def.target) * 100);
    const row = el('div', { class: `quest-row${q.claimed ? ' claimed' : ''}` }, [
      el('div', { class: 'quest-title' }, [
        el('span', { class: 'quest-kind', text: q.kind === 'daily' ? 'HARIAN' : 'MINGGUAN' }),
        el('b', { text: q.def.name }),
      ]),
      el('small', { class: 'quest-desc', text: `${q.def.desc} · ${q.value}/${q.def.target}` }),
      el('div', { class: 'quest-track' }, [el('i', { style: `width:${pct}%` })]),
    ]);
    const action = el('button', {
      class: 'btn btn-sm quest-action',
      text: q.claimed ? '✓' : (q.accepted ? (q.done ? 'KLAIM' : 'AKTIF') : 'AMBIL'),
      disabled: q.claimed || (q.accepted && !q.done),
      onclick: () => {
        if (!q.accepted) acceptQuest(meta, q.def.id);
        else {
          const reward = claimQuest(meta, q.def.id);
          if (reward) emit('toast', { message: `Quest selesai: +${reward} Antibodi`, kind: 'gold' });
        }
        show();
      },
    });
    row.appendChild(action);
    questBox.appendChild(row);
  }
  list.appendChild(questBox);
}

export function hide() {
  stopBannerTimer();
  dashWasHidden = true;
  import('../../render/cine-banner.js').then((m) => m.stopBannerCine()).catch(() => {});
}
