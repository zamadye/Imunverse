/**
 * dashboard-screen.js — Dashboard ala reference user:
 * topbar currency + panggung hero pastel + strip statistik + daily +
 * misi, dengan dock navigasi (Play/Heroes/Squad/Shop) di index.html.
 */

import { STATE } from '../../core/state-manager.js';
import { getData, getHero } from '../../core/data-store.js';
import { writeSave } from '../../save/save-manager.js';
import { recordLoginDay, canClaimStreak, claimStreakReward, streakRewardFor } from '../../systems/comeback-system.js';
import { shouldShowInstallBanner, promptInstall, dismissInstallBanner } from '../../systems/pwa.js';
import { getMissionProgressList, getQuestProgress, acceptQuest, claimQuest, msUntilDailyReset, formatResetCountdown } from '../../systems/mission-system.js';
import { checkDailyLives } from '../../systems/monetization.js';
import { audio } from '../../systems/audio-system.js';
import { t as tr } from '../../systems/i18n.js';
import { markSeen } from '../../systems/codex-system.js';
import { drainHeroNotices } from '../../systems/retention-system.js';
import { ensureBp, xpNeed } from '../../systems/battlepass-system.js';
import { globalUpgradeCost, globalUpgradeLevel } from '../../systems/retention-system.js';
import { heroLevelCost, allyLevelCost } from '../../systems/economy-system.js';
import { getEvoStageDef, getNextEvoStageDef, canEvolve, evolve } from '../../systems/evolution-system.js';
import {
  getBodyState, getCriticalSystems, getMilestoneProgress, getNarrativeStage,
  applyDailyDecay, recoverViaAd,
} from '../../systems/body-system.js';
import { canWatchAd, trackAdWatch, triggerRewardedAdRecovery } from '../../systems/monetization.js';
import { playerRank } from '../../systems/rank-system.js';
import { applyGateVisual, gateFor } from '../../systems/feature-gate.js';
import { arenaUnlockStatus } from './arena-screen.js';
import { getModeUnlockStatus, getTodayMutator } from '../../systems/liveops-system.js';
import { currentChapterId } from './campaign-screen.js';
import { getSession } from '../../systems/account-system.js';
import { heroLevelBadge, allyLevelBadge } from '../../systems/economy-system.js';
import { ensureFounderReward } from '../../systems/imun-economy.js';
import { screenManager } from '../screen-manager.js';
import { isCapsulePending, isCapsuleSnoozed } from '../../systems/welcome-box-system.js'; // ADDENDUM §1
import { currentStrainId } from '../../systems/weekly-strain-system.js'; // ADDENDUM §3.5
import { traitDisplayName } from '../../systems/enemy-mutation-system.js';
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

let dashWasHidden = true; // Fase 15 audit: reset scroll hanya saat masuk layar

/** Sprint 5.26 (§11.1): panggung TETAP — cinematic selalu jalan (tanpa carousel). */
function startStageCine() {
  import('../../render/cine-banner.js').then((m) => {
    const cv = document.getElementById('dash-cine');
    if (cv) m.startBannerCine(cv);
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
    el('img', { src: 'assets/icons/ui-play.svg', alt: '' }),
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
  lab.appendChild(el('img', { class: 'mc-ico', src: 'assets/icons/menu-squad.svg', alt: '' }));
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

/**
 * Overlay progress gameplay di atas background image dashboard.
 * Menggantikan dark gradient overlay — menampilkan data nyata dari STATE.
 */
function renderBgProgress(meta) {
  const scr = document.getElementById('screen-dashboard');
  if (!scr) return;
  let overlay = scr.querySelector('.dash-bg-progress');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'dash-bg-progress';
    scr.insertBefore(overlay, scr.firstChild);
  }
  const stats = meta.stats || {};
  const rank = playerRank(meta);
  const rankLabel = rank ? rank.name : '—';

  const items = [
    { val: stats.bestWave || 0, lbl: 'Gel. Terbaik' },
    { val: stats.totalKills.toLocaleString('id-ID'), lbl: 'Total Kill' },
    { val: rankLabel, lbl: 'Pangkat' },
    { val: fmtTime(stats.bestSurvivalTime || 0), lbl: 'Waktu Terbaik' },
    { val: stats.totalRuns || 0, lbl: 'Total Run' },
    { val: stats.wins || 0, lbl: 'Menang' },
  ];

  overlay.innerHTML = '';
  for (const item of items) {
    const cell = document.createElement('div');
    cell.className = 'bp-stat';
    const b = document.createElement('b');
    b.textContent = item.val;
    const s = document.createElement('span');
    s.textContent = item.lbl;
    cell.appendChild(b);
    cell.appendChild(s);
    overlay.appendChild(cell);
  }
}

/** Overlay tahap diferensiasi di panggung dashboard; stage 0 tetap polos/tanpa ikon. */
function renderStageEvoOverlay(meta) {
  let box = document.getElementById('stage-evo');
  if (!box) {
    box = el('div', { id: 'stage-evo' });
    document.getElementById('dash-stage').appendChild(box);
  }
  box.textContent = '';
  const stage = meta.evoStage || 0;
  const layers = [
    ['assets/sprites/part_equity_memory_core.png', 'eq-memory', stage >= 4, 'Diferensiasi IV'],
    ['assets/sprites/part_equity_effector.png', 'eq-effector', stage >= 3, 'Diferensiasi III'],
    ['assets/sprites/part_equity_membrane.png', 'eq-membrane', stage >= 2, 'Diferensiasi II'],
    ['assets/sprites/part_equity_receptor.png', 'eq-receptor', stage >= 1, 'Diferensiasi I'],
  ];
  for (const [src, cls, on, alt] of layers) {
    if (on) box.appendChild(el('img', { class: cls, src, alt }));
  }
}

/** Kartu diferensiasi: tahap sekarang, fragmen terkumpul, progres & tombol BEREVOLUSI. */
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
    card.appendChild(el('div', { class: 'evo-progress', text: `Berdiferensiasi ke ${next.name} (${next.tier}) — buka kemampuan baru & bentuk baru!` }));
    const btn = el('button', { class: 'btn btn-primary', text: ready ? `DIFERENSIASI → ${next.name.toUpperCase()}` : 'KUMPULKAN BAGIAN DIFERENSIASI' });
    btn.disabled = !ready;
    btn.addEventListener('click', () => {
      const newStage = evolve(meta);
      if (newStage) {
        audio.evolve();
        emit('toast', { message: `Hero berdiferensiasi: ${newStage.name} (${newStage.tier})!`, kind: 'gold' });
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
      el('b', { class: 'body-title', text: `Imunitas: ${narrative.label}` }),
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
          el('img', { class: 'lock-ico', src: 'assets/icons/ui-lock.svg', alt: '' }),
          el('span', { text: ` ${status.text}` }),
        ]),
  ]));
  const btn = el('button', { class: 'btn btn-primary', text: 'GANTI' });
  btn.addEventListener('click', () => screenManager.show('arena'));
  card.appendChild(btn);
}

// ADDENDUM §3.5 — banner Strain of the Week di puncak dashboard.
function renderStrainBanner() {
  const slot = document.getElementById('strain-slot');
  if (!slot) return;
  slot.textContent = '';
  const b = document.createElement('div');
  b.id = 'strain-banner';
  b.className = 'strain-banner';
  slot.appendChild(b);
  const name = traitDisplayName(currentStrainId());
  b.innerHTML = '';
  const tag = document.createElement('span');
  tag.className = 'strain-tag';
  tag.textContent = 'STRAIN MINGGU INI';
  const nm = document.createElement('b');
  nm.textContent = name;
  const hint = document.createElement('small');
  hint.textContent = '15% musuh wave 4+ membawa trait ini. Sesuaikan mutasimu!';
  b.append(tag, nm, hint);
}

/** Sprint 5.26 (§11.1): bar progres Siklus Mitosis → tap buka Pass. */
function renderBpBar(meta) {
  const bar = document.getElementById('bp-bar');
  if (!bar) return;
  const bp = ensureBp(meta);
  const need = xpNeed(bp.level);
  const pct = Math.min(100, Math.round((bp.xp / Math.max(1, need)) * 100));
  bar.textContent = '';
  bar.appendChild(el('span', { class: 'bp-tag', text: '⬡ SIKLUS MITOSIS' }));
  bar.appendChild(el('b', { class: 'bp-lv', text: `Lv ${bp.level}` }));
  bar.appendChild(el('span', { class: 'bp-track' }, [el('i', { class: 'bp-fill', style: `width:${pct}%` })]));
  bar.appendChild(el('span', { class: 'bp-pct', text: `${pct}%` }));
  bar.onclick = () => { audio.ui(); screenManager.show('bp'); };
}

/** Sprint 5.26 (§11.1): kartu Kapsul Membran — hanya bila belum dibuka. */
function renderKapsul(meta) {
  const card = document.getElementById('kapsul-card');
  if (!card) return;
  if (meta.welcomeBox && meta.welcomeBox.opened) {
    card.classList.add('hidden');
    card.textContent = '';
    return;
  }
  card.classList.remove('hidden');
  card.textContent = '';
  card.appendChild(el('img', { class: 'kapsul-ico', src: 'assets/icons/ui-chest.svg', alt: '' }));
  card.appendChild(el('span', { class: 'kapsul-txt' }, [
    el('b', { text: 'Kapsul Membran belum dibuka!' }),
    el('small', { text: 'Hero gratis menunggumu' }),
  ]));
  card.appendChild(el('span', { class: 'kapsul-go', text: 'BUKA ▸' }));
  card.onclick = () => { audio.ui(); screenManager.show('capsule'); };
}

/** Sprint 5.26 (§11.1): badge dock — jujur (hanya muncul bila ada aksi). */
function renderDockBadges(meta) {
  const set = (id, txt) => {
    const b = document.getElementById(id);
    if (!b) return;
    if (!txt) { b.classList.add('hidden'); b.textContent = ''; return; }
    b.classList.remove('hidden');
    b.textContent = txt;
  };
  const hu = getData().upgrades.heroUpgrade;
  const heroOk = (meta.unlockedHeroes || []).some((hid) => {
    const lv = (meta.heroLevels || {})[hid] || 0;
    return lv < hu.maxLevel && (meta.currency || 0) >= heroLevelCost(hu, lv);
  });
  set('badge-hero', heroOk ? '•' : '');
  const nItem = Object.values(meta.consumables || {}).reduce((a, b) => a + (b || 0), 0);
  set('badge-bag', nItem > 0 ? String(Math.min(99, nItem)) : '');
  const au = getData().upgrades.allyUpgrade;
  const allyLv = meta.allyLevel || 0;
  set('badge-squad', au && allyLv < au.maxLevel && (meta.currency || 0) >= allyLevelCost(au, allyLv) ? '•' : '');
  const labOk = (getData().upgrades.globalUpgrades || []).some((def) => {
    const lv = globalUpgradeLevel(meta, def.id);
    if (lv >= def.maxLevel) return false;
    const { cost, currency } = globalUpgradeCost(def, lv);
    return currency === 'genom' ? (meta.imun || 0) >= cost : (meta.currency || 0) >= cost;
  });
  set('badge-lab', labOk ? '•' : '');
}

/** Sprint 5.26 (§11.1): medan berdenyut di belakang hero (warna hero). */
function renderMedan(heroDef) {
  const m = document.getElementById('stage-medan');
  if (!m) return;
  const c = (heroDef && heroDef.color) || '#4ae3c2';
  m.style.setProperty('--medan', c);
}

export function show() {
  // ADDENDUM §1: kapsul pending & tak ditunda → alihkan otomatis (sekali per sesi)
  try {
    if (isCapsulePending(STATE.meta) && !isCapsuleSnoozed()) {
      screenManager.show('capsule', { onLater: () => screenManager.show('dashboard') });
      return;
    }
  } catch { /* abaikan */ }
  // Sprint 6.31 (§10.1): catat login harian (streak + deteksi comeback).
  try { recordLoginDay(STATE.meta); } catch { /* abaikan */ }
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
  try { renderStrainBanner(); } catch { /* abaikan */ } // ADDENDUM §3.5
  // Fase 14: saldo Imun Coin + hadiah early-beta (idempoten)
  ensureFounderReward(meta);
  const imuEl = document.getElementById('dash-imun');
  if (imuEl) imuEl.textContent = (meta.imun || 0).toLocaleString('id-ID');

  // AKUN: chip nama pemain (UI/UX Task 4: tanpa warna/label fraksi — satu pasukan saja saat ini)
  const session = getSession();
  const chip = document.getElementById('account-chip');
  if (chip) {
    if (session) {
      chip.classList.remove('hidden');
      chip.querySelector('#account-name').textContent = session.username;
      // E1 poin 6: tag fraksi dicopot — fokus Imun (elemen #account-faction dihapus)
    } else {
      chip.classList.add('hidden');
    }
  }

  // F21: GERBANG MENU BERTAHAP — dock terbuka sesuai bestWave
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
  badge.appendChild(el('img', { class: 'badge-ico', src: 'assets/icons/ui-star.svg', alt: '' }));
  badge.appendChild(el('span', { text: `Gel. ${meta.stats.bestWave}` }));

  // LEVEL HERO & PASUKAN terhubung: chip di panggung (klik → Lab)
  const lvlBadge = document.getElementById('dash-level-badge');
  if (lvlBadge) {
    lvlBadge.textContent = '';
    lvlBadge.appendChild(el('img', { class: 'badge-ico', src: 'assets/icons/menu-squad.svg', alt: '' }));
    lvlBadge.appendChild(el('span', { text: `${heroDef ? heroLevelBadge(meta, heroDef.id) : 'Lv 0'} · Pasukan ${allyLevelBadge(meta)}` }));
    lvlBadge.onclick = () => { audio.ui(); screenManager.show('upgrade'); };
  }

  // CTA MULAI: bila kampanye → tunjuk bab aktif (tujuan jelas sejak dashboard)
  renderMedan(heroDef);
  const playSub = document.getElementById('play-sub') || document.getElementById('play-big-sub');
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

  // E1 poin 1+7: MINIMAL HOME — awal game fokus feel: stage + PLAY + 1-2
  // menu. Kartu sekunder DISEMBUNYIKAN via CSS (bukan dihapus/lock) dan
  // muncul bertahap begitu trigger unlock tercapai (progressive disclosure).
  const scr = document.getElementById('screen-dashboard');
  if (scr) scr.classList.toggle('minimal-home', (meta.stats.totalRuns || 0) < 3);

  renderBgProgress(meta); // overlay progress gameplay di atas background image
  startStageCine(); // Sprint 5.26: panggung tetap (§11.1)
  renderBpBar(meta); // Sprint 5.26: bar Mitosis (§11.1)
  renderKapsul(meta); // Sprint 5.26: kapsul kondisional (§11.1)
  renderDockBadges(meta); // Sprint 5.26: badge dock (§11.1)
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
  // Sprint 6.31 (§10.1): hadiah kembali menanti → modal comeback dulu.
  if (STATE.meta.comeback && STATE.meta.comeback.pending) {
    screenManager.show('comeback');
    return;
  }
  renderBodyCard(meta);

  // ---- Overlay evolusi di panggung (bentuk hero berubah sesuai tahap) ----
  renderStageEvoOverlay(meta);

  // ---- Kartu EVOLUSI HERO: sesuatu yang selalu dikejar user ----
  renderEvoCard(meta);

  // ---- Kartu ARENA terpilih + tombol ganti ----
  renderArenaCard(meta);

  // ---- Bonus harian berbasis STREAK (Sprint 6.31 §10.1) ----
  const dailyCard = document.getElementById('daily-card');
  dailyCard.textContent = '';
  const livesAvailable = checkDailyLives(); // HOOK: ketersediaan "daily lives" dari SDK/backend
  const claimable = livesAvailable && canClaimStreak(meta);
  const streak = (meta.loginStreak && meta.loginStreak.streak) || 0;
  const rw = streakRewardFor(Math.max(1, streak));
  const rwBits = [`+${rw.bk.toLocaleString('id-ID')} BK`];
  if (rw.genom > 0) rwBits.push(`+${rw.genom} Genom`);
  const info = el('div', { class: 'daily-info' }, [
    el('b', { class: 'ico-title' }, [
      el('img', { class: 't-ico', src: 'assets/icons/ui-star.svg', alt: '' }),
      el('span', { text: `🔥 Streak Hari ${streak}${rw.milestone ? ` — Milestone ${rw.milestone}!` : ''}` }),
    ]),
    el('span', { class: 'claim-line' }, claimable ? [
      el('b', { text: rwBits.join(' ') }),
      el('img', { class: 'inline-coin', src: 'assets/icons/cur-antibodi.svg', alt: 'biokredit' }),
      el('span', { text: ' menantimu — klaim sekarang!' }),
    ] : [el('span', { text: 'Sudah diklaim hari ini. Kembali besok.' })]),
  ]);
  const btn = el('button', {
    class: 'btn ' + (claimable ? 'btn-gold' : ''),
    text: claimable ? 'KLAIM' : '✓ DIKLAIM',
    disabled: !claimable,
    onclick: () => {
      const got = claimStreakReward(STATE.meta); // Sprint 6.31 + auto-save
      if (got.ok) {
        emit('toast', { message: `Streak hari ${got.streak}: +${got.bk} BK${got.genom ? ` +${got.genom} Genom` : ''}!`, kind: 'gold' });
        show(); // refresh angka currency
      }
    },
  });
  dailyCard.appendChild(info);
  dailyCard.appendChild(btn);

  // ---- Banner PASANG aplikasi (Sprint 6.35: prompt run ke-3) ----
  document.getElementById('pwa-banner')?.remove();
  if (shouldShowInstallBanner(meta)) {
    const pwa = el('div', { id: 'pwa-banner', class: 'card pwa-banner' }, [
      el('img', { class: 'pwa-ico', src: 'assets/icons/pwa-192.png', alt: '' }),
      el('div', { class: 'pwa-text' }, [
        el('b', { text: 'Pasang PHAGOS' }),
        el('span', { text: 'Main offline + buka lebih cepat.' }),
      ]),
      el('button', {
        class: 'btn btn-primary pwa-btn', text: 'PASANG',
        onclick: async () => {
          const ok = await promptInstall();
          if (ok) document.getElementById('pwa-banner')?.remove();
        },
      }),
      el('button', {
        class: 'pwa-x', text: '✕', 'aria-label': 'Tutup',
        onclick: () => { dismissInstallBanner(STATE.meta); document.getElementById('pwa-banner')?.remove(); },
      }),
    ]);
    dailyCard.insertAdjacentElement('afterend', pwa);
  }

  // ---- Misi (3 progres teratas yang belum selesai) ----
  // Sprint 5.30 (§10.4): chip hitung mundur reset harian di judul kartu.
  const mCard = document.querySelector('.missions-card .card-title');
  if (mCard && !document.getElementById('dash-reset')) {
    const ms = msUntilDailyReset();
    const chip = el('span', { id: 'dash-reset', class: 'reset-chip' + (ms < 4 * 3600e3 ? ' urgent' : ''),
      text: `⏳ Reset ${formatResetCountdown(ms)}` });
    mCard.appendChild(chip);
  } else if (mCard) {
    const ms = msUntilDailyReset();
    const chip = document.getElementById('dash-reset');
    chip.textContent = `⏳ Reset ${formatResetCountdown(ms)}`;
    chip.classList.toggle('urgent', ms < 4 * 3600e3);
  }
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
        el('img', { class: 'inline-coin', src: 'assets/icons/cur-antibodi.svg', alt: 'Biokredit', title: 'Biokredit' }),
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
  {
    // Sprint 5.30 (§10.4): countdown juga di panel quest.
    const ms = msUntilDailyReset();
    questBox.appendChild(el('span', { class: 'reset-chip' + (ms < 4 * 3600e3 ? ' urgent' : ''),
      text: `⏳ Reset harian ${formatResetCountdown(ms)}` }));
  }
  // E2 poin 5: quest auto-aktif — tanpa tombol AMBIL; tombol hanya KLAIM.
  for (const q0 of getQuestProgress(meta)) {
    if (!q0.accepted && !q0.claimed) acceptQuest(meta, q0.def.id);
  }
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
    if (q.done && !q.claimed) {
      row.appendChild(el('button', {
        class: 'btn btn-sm quest-action',
        text: 'KLAIM',
        onclick: () => {
          const reward = claimQuest(meta, q.def.id);
          if (reward) emit('toast', { message: `Quest selesai: +${reward} Biokredit`, kind: 'gold' });
          show();
        },
      }));
    } else if (q.claimed) {
      row.appendChild(el('span', { class: 'quest-done-mark', text: '✓' }));
    }
    questBox.appendChild(row);
  }
  list.appendChild(questBox);
}

export function hide() {
  dashWasHidden = true;
  import('../../render/cine-banner.js').then((m) => m.stopBannerCine()).catch(() => {});
}
