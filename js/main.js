/**
 * main.js — Bootstrap Imunverse.
 * Urutan init:
 *  1. Siapkan canvas + input (joystick touch / WASD).
 *  2. Muat semua data JSON (data/*.json).
 *  3. loadAllSprites() — preload semua sprite PNG (Promise, progress bar).
 *  4. Muat save (localStorage) → merge default.
 *  5. Daftarkan screen UI + wiring event ui-bridge.
 *  6. Start game loop (rAF + delta-time).
 */

import { STATE, setPaused } from './core/state-manager.js';
import { GameLoop } from './core/game-loop.js';
import { loadAllData, getData, applyDataLanguage } from './core/data-store.js';
import { initMetrics } from './systems/metrics.js'; // V2 Phase 0: instrumen KPI
import { loadLang, initSweep, sweepAll, t } from './systems/i18n.js';
import { emit, on } from './core/ui-bridge.js';
import { game } from './core/game.js';
import { Pickup } from './entities/pickup.js';
import { InputHandler } from './input/input-handler.js';
import { loadAllSprites, spriteToDataURL } from './render/sprite-loader.js';
import { loadSave, writeSave } from './save/save-manager.js';
import { createDefaultMeta, mergeMetaDefaults } from './core/state-manager.js';
import { getHero } from './core/data-store.js';
import { isDevMode } from './core/dev-mode.js';
import { music } from './systems/music-system.js';
import { gateFor, hudMenuGate, applyHudMenuGates } from './systems/feature-gate.js';
import { renderBadges, markSeen } from './systems/unlock-badge-system.js';
import { getQuestProgress, acceptQuest, claimQuest } from './systems/mission-system.js';

import * as screenManager from './ui/screen-manager.js';
import * as loadingScreen from './ui/screens/loading-screen.js';
import * as dashboardScreen from './ui/screens/dashboard-screen.js';
import * as rosterScreen from './ui/screens/roster-screen.js';
import * as upgradeScreen from './ui/screens/upgrade-screen.js';
import * as shopScreen from './ui/screens/shop-screen.js';
import * as hudScreen from './ui/screens/hud-screen.js';
import * as levelupScreen from './ui/screens/levelup-screen.js';
import * as pauseScreen from './ui/screens/pause-screen.js';
import * as reviveScreen from './ui/screens/revive-screen.js';
import * as gameoverScreen from './ui/screens/gameover-screen.js';
import * as arenaScreen from './ui/screens/arena-screen.js';
import * as prepScreen from './ui/screens/prep-screen.js';
import { onRunStart as tutorialOnRunStart } from './systems/tutorial-system.js';
import { audio } from './systems/audio-system.js';
import { cinematic, playOnce } from './ui/cinematic.js';
import * as campaignScreen from './ui/screens/campaign-screen.js';
import * as codexScreen from './ui/screens/codex-screen.js';
import * as battlepassScreen from './ui/screens/battlepass-screen.js';
import * as authScreen from './ui/screens/auth-screen.js';
import * as heroDetailScreen from './ui/screens/hero-detail-screen.js';
import { signUp, hasAccount } from './systems/account-system.js';
import { isDockGated } from './systems/feature-gate.js';
import * as coach from './ui/coach.js';
import * as bagScreen from './ui/screens/bag-screen.js';
import * as bosschestScreen from './ui/screens/bosschest-screen.js';
import * as rankScreen from './ui/screens/rank-screen.js';
import * as profileScreen from './ui/screens/profile-screen.js';
import * as titleScreen from './ui/screens/title-screen.js';
import { showPresenter } from './ui/presenter.js'; // E1 poin 8+9: karakter naratif hidup
import { playWaveCinematic, waveCineActive } from './ui/wave-cinematic.js'; // E2 poin 6: cinematic wave penting
import { playCutscene, prewarmCutscenes, cutsceneActive } from './ui/cutscene-player.js'; // R3 (Narrative-Cinematic)
import { vo } from './systems/vo-system.js'; // R3: lapisan VO

const canvas = document.getElementById('game');
const vignette = document.getElementById('damage-vignette');

// ---------------------------------------------------------------------
// Canvas sizing (DPR-aware, cap 2 untuk performa)
// ---------------------------------------------------------------------
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  game.resize(w, h, dpr);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------
function showToast({ message, kind = '' }) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = message;
  box.appendChild(el);
  // R2: bark RIA = beat naratif — tampil lebih lama & tidak tergusur toast lain
  setTimeout(() => el.remove(), kind === 'ria' ? 5200 : 3200);
  while (box.children.length > 4) {
    const victim = [...box.children].find((c) => !c.classList.contains('ria')) || box.firstChild;
    victim.remove();
  }
}

// ---------------------------------------------------------------------
// Wiring event ui-bridge → screen UI
// ---------------------------------------------------------------------
function wireUiBridge() {
  on('toast', (payload) => {
    // Fase 12c: jangan menumpuk — maksimal 2 toast, yang tertua dihapus
    const live = [...document.querySelectorAll('#toasts .toast')];
    if (live.length >= 2) {
      // R2: jangan gusur bark RIA — korbankan toast non-naratif tertua
      const victim = live.find((c) => !c.classList.contains('ria')) || live[0];
      victim.remove();
    }
    showToast(payload);
  });

  // R4 Modul B: meter fagositosis — fill per telan
  on('phago', ({ meter, max, enabled }) => {
    const box = document.getElementById('phago-meter');
    if (!box) return;
    if (!enabled) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const fill = document.getElementById('phago-fill');
    if (fill) fill.style.width = `${Math.round((meter / max) * 100)}%`;
  });

  // R3 Modul A: chip memori antigen di HUD — tipe terdekat tier berikutnya
  on('antigen', ({ near }) => {
    const chip = document.getElementById('hud-antigen');
    if (!chip) return;
    if (!near) { chip.classList.add('hidden'); return; }
    const enemyDef = (getData().enemies.enemies || []).find((e) => e.id === near.typeId);
    const label = enemyDef ? enemyDef.name : near.typeId;
    chip.innerHTML = '';
    const nm = document.createElement('span');
    nm.textContent = `Ag· ${label}${near.tier > 0 ? ` T${near.tier}` : ''}`;
    const bar = document.createElement('span'); bar.className = 'ag-bar';
    const fill = document.createElement('span'); fill.className = 'ag-fill';
    fill.style.width = `${Math.min(100, Math.round(near.pct * 100))}%`;
    bar.appendChild(fill);
    chip.appendChild(nm); chip.appendChild(bar);
    chip.classList.toggle('tiered', near.tier > 0);
    chip.classList.remove('hidden');
  });

  on('playerHit', () => {
    vignette.classList.add('flash');
    setTimeout(() => vignette.classList.remove('flash'), 60);
  });

  on('runstart', () => {
    hudScreen.resetHUD();
    document.getElementById('hud-antigen')?.classList.add('hidden'); // R3: chip reset
    document.getElementById('phago-meter')?.classList.add('hidden'); // R4: meter reset
    const pf = document.getElementById('phago-fill'); if (pf) pf.style.width = '0%';
    screenManager.show('hud');
    tutorialOnRunStart(); // onboarding run pertama (3 langkah)
    // R3 (Narrative-Cinematic, D3): tema musik prosedural PER CHAPTER
    const _chId = (STATE.meta.selectedChapter || '').replace('bab_', '');
    music.setTheme(_chId);
    music.start(); // F23: musik latar prosedural saat bermain
    applyHudDisclosure(); // UI/UX: item menu terkunci DISEMBUNYIKAN, toggle ikut hilang bila kosong
    renderBadges(); // F25: badge unlock baru pada ikon menu
    renderQuestPanel(); // F25: panel misi harian/mingguan (kiri tengah)
    setQuestPanelOpen(false); // UI/UX BUILD 42: mulai TERLIPAT — badan panel 168×134 px menelan tarikan joystick di sisi kiri
  });

  on('wave', ({ wave, isBoss }) => {
    hudScreen.showAnnounce(isBoss ? 'BOSS!' : `WAVE ${wave}`, isBoss);
  });
  // F25: panel quest kiri-tengah — AMBIL → progres → KLAIM (hadiah TIDAK otomatis)
  /**
   * UI/UX — progressive disclosure menu gameplay. Dashboard = launcher 1 tombol
   * (F24), maka SEMUA destinasi hidup di HUD: item yang belum terbuka tidak
   * dirender ke pemain (bukan dipajang lalu ditolak), toggle menu tersembunyi
   * sampai ada minimal 1 item terbuka, panel Misi ikut gerbang `quick/quests`.
   * Sumber kebenaran tunggal: data/features.json via feature-gate.js.
   */
  function applyHudDisclosure() {
    applyHudMenuGates('menu1', '.hud-menu-link', document.getElementById('hud-menu-toggle'), 'menuScreen');
    applyHudMenuGates('menu2', '.hud-menu2-link', document.getElementById('hud-menu2-toggle'), 'menu2Screen');
    const quests = document.getElementById('hud-quests');
    if (quests) {
      const g = gateFor('quick', 'quests');
      const locked = !!(g && g.locked);
      quests.classList.toggle('gate-hidden', locked);
      quests.style.display = locked ? 'none' : '';
    }
    // menu yang sedang terbuka ditutup — daftar isinya mungkin baru berubah
    for (const [menuId, toggleId] of [['hud-game-menu', 'hud-menu-toggle'], ['hud-game-menu2', 'hud-menu2-toggle']]) {
      document.getElementById(menuId)?.classList.add('hidden');
      document.getElementById(toggleId)?.setAttribute('aria-expanded', 'false');
    }
  }
  window.__IMUNVERSE_applyHudDisclosure = applyHudDisclosure;

  function renderQuestPanel() {
    const body = document.getElementById('hud-quests-body');
    const badge = document.getElementById('quests-badge');
    if (!body) return;
    try {
      const meta = STATE.meta;
      // E2 poin 5: quest AKTIF OTOMATIS — tombol AMBIL dihapus (langkah ekstra
      // tanpa makna); pemain cukup bermain, progres jalan sendiri, lalu KLAIM.
      for (const q0 of getQuestProgress(meta)) {
        if (!q0.accepted && !q0.claimed) acceptQuest(meta, q0.def.id);
      }
      const quests = getQuestProgress(meta).filter((q) => !q.claimed).slice(0, 3);
      let claimable = 0;
      body.textContent = '';
      for (const q of quests) {
        const pct = Math.min(100, Math.round((q.value / q.def.target) * 100));
        const row = document.createElement('div');
        row.className = 'hq-row';
        row.innerHTML = `<div class="hq-top"><b>${q.def.name}</b><span>${q.value}/${q.def.target}</span></div>
          <div class="hq-bar"><i style="width:${pct}%"></i></div>`;
        if (q.done) {
          // hanya quest SELESAI yang punya tombol — KLAIM emas
          const act = document.createElement('button');
          act.className = 'hq-act claim';
          act.textContent = 'KLAIM';
          act.addEventListener('click', () => {
            const reward = claimQuest(meta, q.def.id);
            if (reward) showToast({ message: `Quest selesai: +${reward} Antibodi`, kind: 'gold' });
            audio.ui();
            renderQuestPanel();
          });
          row.appendChild(act);
          claimable += 1;
        }
        body.appendChild(row);
      }
      badge.textContent = String(claimable);
      badge.classList.toggle('hidden', claimable === 0);
    } catch { /* meta belum siap */ }
  }
  window.__IMUNVERSE_renderQuestPanel = renderQuestPanel;

  /** Buka/lipat badan panel Misi (kepala tetap terlihat; badge KLAIM tetap tampil saat terlipat). */
  function setQuestPanelOpen(open) {
    const body = document.getElementById('hud-quests-body');
    const head = document.getElementById('hud-quests-toggle');
    if (!body || !head) return;
    body.classList.toggle('hidden', !open);
    head.setAttribute('aria-expanded', String(open));
    document.getElementById('hud-quests')?.classList.toggle('collapsed', !open);
  }
  window.__IMUNVERSE_setQuestPanelOpen = setQuestPanelOpen;
  document.getElementById('hud-quests-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('hud-quests-body');
    setQuestPanelOpen(body.classList.contains('hidden'));
    audio.ui();
  });

  on('waveBreak', ({ wave }) => {
    hudScreen.showAnnounce(`ARENA BERSIH · WAVE ${wave}`, false);
    // E2 poin 6: WAVE PENTING (kelipatan boss, mis. 5/10/15) → cinematic
    // kemenangan 3 babak: diserang → melawan & menang → ancaman lebih besar
    // muncul. Gameplay dipause, selesai → resume → RIA menyambut.
    const bossEvery = (getData().waves && getData().waves.bossWaveEvery) || 5;
    if (wave > 0 && wave % bossEvery === 0) {
      // playWaveCinematic DULU (set flag aktif) baru pause — supaya handler
      // on('pause') tahu ini cinematic, bukan modal jeda.
      playWaveCinematic(wave, () => {
        game.resume();
        setTimeout(() => showPresenter('ria',
          `Luar biasa! Wave ${wave} kita menangkan... tapi kurasakan getaran patogen yang JAUH lebih besar mendekat. Bersiaplah — aku di sini bersamamu!`,
          { duration: 5.5 }), 350);
      });
      game.pause();
      return;
    }
    // E1 poin 9: RIA muncul TIAP selesai wave — karakter hidup (pose bicara
    // + gestur), teks di samping, auto-hilang cepat agar ritme tak terganggu.
    const riaBarks = [
      `Wave ${wave} bersih! Patogen mundur — tarik napas, sebentar lagi datang lebih banyak.`,
      `Kerja bagus! Wave ${wave} selesai. Kuperbarui peta ancaman... siap-siap ya!`,
      `Area aman! Itu tadi wave ${wave}. Pungut nutrisi selagi sempat!`,
      `Wave ${wave} tumbang! Sinyal inflamasi menurun... tapi jangan lengah.`,
    ];
    showPresenter('ria', riaBarks[wave % riaBarks.length], { duration: 4 });
  });

  // R3 (Narrative-Cinematic): REVEAL BOSS BAB 5 (naskah final 6.3) —
  // cutscene 2-panel 1× sejak pernah; selain itu = bark VO 3-5 dtk (7.3).
  on('bossBark', ({ chapterId }) => {
    const meta = STATE.meta;
    const cs = getData().cutscenes;
    if (chapterId === 'bab_kanker' && !meta.bossRevealSeen) {
      meta.bossRevealSeen = true;
      writeSave(meta);
      // reveal twist: pause → cutscene → resume (pola cinematic wave;
      // cutsceneActive() di-set sinkron oleh playCutscene sebelum pause)
      playCutscene('boss_reveal_bab_kanker', () => game.resume());
      game.pause();
      return;
    }
    const voPath = cs && cs.bossVo ? (cs.bossVo[chapterId] || cs.bossVo.default) : null;
    if (voPath) vo.play(voPath);
  });

  // R3 Task 4: FIRST-TIME EXPERIENCE RIA (sekali sejak pernah, non-blocking,
  // bisa di-tap untuk skip — presenter + VO, nada bersemangat/jenaka).
  // RONDE-3 visual fix: presenter TIDAK boleh menumpuk di atas modal Level-Up /
  // pause — bark ditunda sampai momen resume (antrian 1 baris).
  let pendingBark = null;
  function flushBark() {
    const b = pendingBark;
    pendingBark = null;
    if (b) setTimeout(() => {
      // Level-up beruntun: jangan menimpa modal yang baru terbuka — antri ulang
      if (STATE.levelUpOpen || (game.run && game.run.paused)) { pendingBark = b; return; }
      showPresenter(b.who, b.text, b.opts);
    }, 420);
  }
  function nftFirst(key, event) {
    const meta = STATE.meta;
    if (meta.nft && meta.nft[key]) return;
    const nft = getData().cutscenes && getData().cutscenes.nft;
    const line = nft && nft[key];
    if (!line) return;
    meta.nft = meta.nft || {};
    meta.nft[key] = true;
    writeSave(meta);
    if (STATE.levelUpOpen || (game.run && game.run.paused)) {
      pendingBark = { who: 'ria', text: line.text, opts: { vo: line.vo } };
    } else {
      showPresenter('ria', line.text, { vo: line.vo });
    }
    if (event) event.preventDefault?.();
  }
  on('nftMove', () => nftFirst('move'));
  on('levelup', (payload) => {
    nftFirst('levelup');
    screenManager.show('levelup', payload);
  });
  on('revive', () => {
    nftFirst('revive');
    screenManager.show('revive');
  });
  // skill pertama = cast kemampuan pertama (banner nama kemampuan)
  let bannerTimer = null;
  on('abilityBanner', ({ name, color }) => {
    nftFirst('skill');
    const b = document.getElementById('ability-banner');
    if (!b) return;
    b.textContent = name;
    b.style.color = color;
    b.style.borderColor = color;
    b.classList.remove('show');
    void b.offsetWidth; // restart animasi
    b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), 1100);
  });

  // E1 poin 9: AMARA muncul saat pemain MENDAPAT HERO BARU — menjelaskan
  // spesifikasi (role + skill) dengan bahasa awam, karakter penuh bergestur.
  on('heroUnlocked', ({ heroId }) => {
    const h = getData().heroes.heroes.find((x) => x.id === heroId);
    if (!h) return;
    const skillNames = (h.skills || []).map((sid) => {
      const sd = getData().skills.skills.find((x) => x.id === sid);
      return sd ? sd.name : sid;
    }).join(', ');
    setTimeout(() => showPresenter('amara',
      `Selamat! ${h.name} — ${h.title} — bergabung dengan pasukanmu. Perannya ${h.role}. Jurus andalannya: ${skillNames}. Coba dia di run berikutnya!`,
      { duration: 9 }), 900);
  });

  on('bosschest', (payload) => screenManager.show('bosschest', payload));
  on('pause', () => { if (!waveCineActive() && !cutsceneActive()) screenManager.show('pause'); }); // E2 poin 6 + R3: cinematic ≠ modal pause
  // Modal tertutup (level-up selesai / resume / revive sukses) → kembali ke HUD
  on('resume', () => {
    if (STATE.screen === 'gameplay') screenManager.show('hud');
    flushBark(); // bark NFT yang ditunda saat modal terbuka → tampil bersih di HUD
  });
  on('gameover', (payload) => { music.stop(); screenManager.show('gameover', payload); });
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
async function boot() {
  resize();
  loadingScreen.setProgress(4, 'Menyiapkan organisme…');

  // Input: virtual joystick (touch) + WASD/arrow (desktop)
  const input = new InputHandler(canvas);
  // Keyboard gerak HANYA saat gameplay (layar HUD / modal jeda). Di dashboard,
  // form akun, dsb. tombol W/A/S/D/Spasi dibiarkan ke browser (bisa mengetik).
  input.isActive = () => STATE.screen === 'gameplay';
  input.onPauseKey = () => {
    const cur = screenManager.getCurrentId();
    if (STATE.screen !== 'gameplay' || STATE.levelUpOpen) return;
    if (cur === 'pause') {
      game.resume();
      screenManager.hideCurrent();
    } else if (cur === 'hud') {
      game.pause();
    }
  };

  // 1) Data JSON
  const data = await loadAllData();
  loadingScreen.setProgress(12, 'Data patogen dimuat…');

  // 1b) Dwibahasa: muat kamus + pasang observer DOM (bahasa diterapkan setelah save dimuat)
  await loadLang();
  initSweep();

  // 2) Sprite preload (jangan drawImage sebelum selesai)
  await loadAllSprites(data, (done, total, path, isFallback) => {
    const pct = 12 + Math.round((done / total) * 84);
    loadingScreen.setProgress(pct, `Memuat sprite… (${done}/${total})${isFallback ? ' [fallback dev]' : ''}`);
  });
  loadingScreen.setProgress(98, 'Mengaktifkan sistem imun…');

  // R3 (Narrative-Cinematic): prewarm cutscene (modul three.js + VO pembuka)
  // di background — jank init WebGL keluar dari jalur kritis cutscene.
  prewarmCutscenes();

  // 3) Save / meta
  const raw = loadSave();
  STATE.meta = raw ? mergeMetaDefaults(raw) : createDefaultMeta();
  if (isDevMode()) {
    // In-memory only: dev access never overwrites the player's real save.
    STATE.meta.imun = 999999;
    STATE.meta.currency = 999999;
    STATE.meta.stats = { ...STATE.meta.stats, wins: 99, totalKills: 9999, bossKills: 99, bestWave: 99, totalRuns: 99 };
    STATE.meta.unlockedHeroes = data.heroes.heroes.map((h) => h.id);
    STATE.meta.campaignCleared = Object.fromEntries(data.campaign.chapters.map((c) => [c.id, true]));
    STATE.meta.evoStage = 4;
    STATE.meta.evoParts = { equity_receptor: 999, equity_membrane: 999, equity_effector: 999, equity_memory_core: 999 };
    STATE.meta.allies = 6;
    STATE.meta.allyLevel = 99;
    for (const def of (data.upgrades.globalUpgrades || [])) {
      STATE.meta.globalUpgrades[def.id] = def.maxLevel;
    }
  }
  if (!raw) writeSave(STATE.meta);
  applyDataLanguage(STATE.meta.lang || 'id'); // dwibahasa: data sesuai bahasa tersimpan

  // 4) Wiring UI
  game.init({ canvas, input });
  wireUiBridge();
  initMetrics(); // V2 Phase 0: rekam KPI run (localStorage, pasif via event bus)

  screenManager.registerScreen('loading', loadingScreen);
  screenManager.registerScreen('dashboard', dashboardScreen);
  screenManager.registerScreen('roster', rosterScreen);
  screenManager.registerScreen('upgrade', upgradeScreen);
  screenManager.registerScreen('shop', shopScreen);
  screenManager.registerScreen('hud', hudScreen);
  screenManager.registerScreen('levelup', levelupScreen);
  screenManager.registerScreen('pause', pauseScreen);
  screenManager.registerScreen('revive', reviveScreen);
  screenManager.registerScreen('gameover', gameoverScreen);
  screenManager.registerScreen('arena', arenaScreen);
  screenManager.registerScreen('prep', prepScreen);
  screenManager.registerScreen('campaign', campaignScreen);
  screenManager.registerScreen('codex', codexScreen);
  screenManager.registerScreen('bp', battlepassScreen);
  screenManager.registerScreen('auth', authScreen);
  screenManager.registerScreen('herodetail', heroDetailScreen);
  screenManager.registerScreen('bag', bagScreen);
  screenManager.registerScreen('bosschest', bosschestScreen);
  screenManager.registerScreen('rank', rankScreen);
  screenManager.registerScreen('profile', profileScreen);
  screenManager.registerScreen('title', titleScreen);
  screenManager.registerScreen('curguide', {}); // modal panduan currency (konten diisi main.js saat dibuka)
  bosschestScreen.wire();
  rankScreen.wire(); // Fase 19: modal pangkat
  titleScreen.wire(); // F21: layar judul gameplay-first

  // Tampilkan loading lewat manager agar transisi berikutnya bersih
  screenManager.show('loading');

  // Tombol HUD pause (elemen statis — di-wire di sini agar hud-screen tetap murni view)
  document.getElementById('btn-pause').addEventListener('click', () => game.pause());

  // ---------- PANDUAN CURRENCY (HUD, tanda "+") ----------
  // Daftar sumber penghasilan (jujur ke mekanik eksisting):
  const CUR_GUIDE = {
    anti: {
      title: 'Cara Mendapatkan Antibodi',
      icon: 'assets/icons/cur-antibodi.svg',
      balance: () => STATE.meta.currency || 0,
      tasks: [
        '<b>Bunuh patogen</b> — tiap kill di gameplay mengeluarkan antibodi.',
        '<b>Selesaikan wave & boss</b> — wave tuntas memberi bonus; boss membuka Peti Boss.',
        '<b>Klaim misi harian / mingguan</b> — dari panel Misi di HUD & dashboard.',
        '<b>Selesaikan bab kampanye</b> — tiap bab bersih memberi hadiah besar.',
        '<b>Upgrade hero & squad membayar dengan antibodi</b> — kumpulkan lebih banyak per run!',
      ],
    },
    imu: {
      title: 'Cara Mendapatkan Imuncoin',
      icon: 'assets/icons/cur-imun.svg',
      balance: () => Math.floor(STATE.meta.imun || 0),
      tasks: [
        '<b>Main run berulang</b> — tiap kill patogen memberi Imuncoin kecil.',
        '<b>Selesaikan tiap wave</b> — bonus Imuncoin per wave tuntas.',
        '<b>Kalahkan boss</b> — hadiah Imuncoin besar tiap boss tumbang.',
        '<b>Naikkan Mastery hero</b> — reward Imuncoin di akhir run (sistem Mastery).',
        '<b>Imuncoin dipakai untuk Battle Pass premium</b> — kumpulkan dari run ke run!',
      ],
    },
  };

  let guideAutoPaused = false;
  function closeCurGuide() {
    const pr = document.getElementById('presenter-layer');
    if (pr) pr.style.visibility = '';
    // kembali ke dunia yang aktif; resume hanya bila kami yang mem-pause sebelumnya
    if (guideAutoPaused && game.run && !game.run.ended && game.run.paused) {
      game.resume();
      screenManager.show('hud');
    } else if (game.run && !game.run.ended) {
      screenManager.show('hud');
    } else {
      screenManager.show('dashboard');
    }
    guideAutoPaused = false;
  }

  function openCurGuide(kind) {
    const g = CUR_GUIDE[kind];
    if (!g) return;
    document.getElementById('curguide-title').textContent = g.title;
    document.getElementById('curguide-icon').src = g.icon;
    document.getElementById('curguide-balance').textContent = g.balance();
    const ul = document.getElementById('curguide-tasks');
    ul.innerHTML = g.tasks.map((t) => `<li>${t}</li>`).join('');
    // tetap adil: baca panduan tidak membuat player mati di belakang modal
    if (game.run && !game.run.ended && !game.run.paused && !game.run.cinematic) {
      game.pause();
      guideAutoPaused = true;
    }
    screenManager.show('curguide');
    // presenter naratif (RIA) jangan menimpa tombol baca— sembunyikan sementara
    const pr = document.getElementById('presenter-layer');
    if (pr) pr.style.visibility = 'hidden';
  }

  const antiChip = document.getElementById('hud-anti-chip');
  const imuChip = document.getElementById('hud-imu-chip');
  if (antiChip) {
    antiChip.querySelector('.cur-plus').addEventListener('click', (ev) => { ev.stopPropagation(); openCurGuide('anti'); });
    antiChip.addEventListener('click', () => openCurGuide('anti'));
    antiChip.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openCurGuide('anti'); } });
  }
  if (imuChip) {
    imuChip.querySelector('.cur-plus').addEventListener('click', (ev) => { ev.stopPropagation(); openCurGuide('imu'); });
    imuChip.addEventListener('click', () => openCurGuide('imu'));
    imuChip.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openCurGuide('imu'); } });
  }
  const cgClose = document.getElementById('btn-curguide-close');
  if (cgClose) cgClose.addEventListener('click', closeCurGuide);
  // Tap-area overlay modal curguide → tutup bila klik di luar kotak (konsisten dgn pola game)
  document.getElementById('screen-curguide').addEventListener('click', (ev) => {
    if (ev.target.id === 'screen-curguide') closeCurGuide();
  });
  // Profil hero di HUD = juga tindakan pause (Misi/Status) — sebelumnya hanya protected-movement tanpa aksi.
  // Zona ini sudah UI-protected (isGameplayInputTarget=false) → aman dari joystick/aim.
  const hpPill = document.getElementById('hp-pill');
  if (hpPill) {
    hpPill.addEventListener('click', () => { if (game.run && !game.run.ended && !game.run.paused) game.pause(); });
    hpPill.setAttribute('title', 'Status hero — ketuk untuk jeda');
    hpPill.setAttribute('role', 'button');
    hpPill.setAttribute('aria-label', 'Status hero — jeda');
    hpPill.tabIndex = 0;
    hpPill.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); hpPill.click(); }
    });
  }
  const hudMenu = document.getElementById('hud-game-menu');
  const hudMenuToggle = document.getElementById('hud-menu-toggle');
  hudMenuToggle?.addEventListener('click', () => {
    const open = hudMenu.classList.toggle('hidden') === false;
    hudMenuToggle.setAttribute('aria-expanded', String(open));
    if (open) markSeen('menu1'); // F25: badge unlock dianggap dilihat saat menu dibuka
  });
  // F25: MENU 2 — Hero/Collection/Shop/Battle/Squad (pojok kanan-bawah, melebar ke kiri)
  const hudMenu2 = document.getElementById('hud-game-menu2');
  const hudMenu2Toggle = document.getElementById('hud-menu2-toggle');
  hudMenu2Toggle?.addEventListener('click', () => {
    const open = hudMenu2.classList.toggle('hidden') === false;
    hudMenu2Toggle.setAttribute('aria-expanded', String(open));
    if (open) markSeen('menu2');
  });
  // UI/UX: satu jalur untuk kedua menu — gerbang fail-closed (item tak terdaftar
  // = terkunci), item terkunci memang tak terlihat; toast hanya jaga-jaga (mis. klik
  // programatik) agar tidak pernah ada jalur menuju layar yang belum terbuka.
  const openHudMenuScreen = (menuId, screenId, menuEl) => {
    const gate = hudMenuGate(menuId, screenId);
    if (gate.locked) {
      showToast({ message: `${t(gate.label || 'Terus bermain')} ${t('untuk membuka!')}` });
      audio.ui();
      return;
    }
    game.pause();
    menuEl?.classList.add('hidden');
    music.stop(); // keluar arena → musik berhenti; mulai lagi saat runstart berikutnya
    screenManager.show(screenId);
  };
  document.querySelectorAll('.hud-menu2-link').forEach((btn) => btn.addEventListener('click', () => {
    openHudMenuScreen('menu2', btn.dataset.menu2Screen, hudMenu2);
  }));
  document.querySelectorAll('.hud-menu-link').forEach((btn) => btn.addEventListener('click', () => {
    openHudMenuScreen('menu1', btn.dataset.menuScreen, hudMenu);
  }));

  // Wire tombol modal revive & gameover (sekali saat boot)
  reviveScreen.wireButtons();
  gameoverScreen.wireButtons();
  document.getElementById('btn-arena-close').addEventListener('click', () => backToContext());
  // R1 (Rebuild): PLAY → LANGSUNG masuk run (addendum UX — core loop dulu).
  // Default otomatis: mode kampanye + bab aktif + hero terpilih. Pilihan bab
  // (Peta Tubuh) baru di-expose setelah run ke-3 — trigger-based, bukan waktu.
  // Fase 13: tombol dirender ulang saat dashboard tampil → pakai delegasi
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#btn-play-big')) return;
    const meta = STATE.meta;
    const runs = (meta.stats && meta.stats.totalRuns) || 0;
    if (runs >= 3) {
      screenManager.show('campaign'); // pemain sudah paham loop → boleh memilih
      return;
    }
    // Default otomatis: bab pertama yang belum tamat, mode kampanye
    const chapters = (getData().campaign && getData().campaign.chapters) || [];
    const ch = chapters.find((c) => !meta.campaignCleared?.[c.id]) || chapters[0];
    if (ch) { meta.selectedChapter = ch.id; meta.selectedMode = 'kampanye'; }
    const heroDef = getHero(meta.selectedHero);
    const unlocked = heroDef && (heroDef.unlock?.type === 'default' || meta.unlockedHeroes.includes(heroDef.id));
    game.startRun(unlocked ? heroDef.id : (getData().heroes.heroes.find((h) => h.unlock?.type === 'default') || getData().heroes.heroes[0]).id);
  });
  // Sidebar (fitur — berbeda dari dock inti): Home/Kampanye/Bio/Rekor/Tubuh
  const sideHome = document.getElementById('side-home');
  if (sideHome) sideHome.addEventListener('click', () => {
    document.querySelector('.dash-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('side-campaign')?.addEventListener('click', () => screenManager.show('campaign'));
  document.getElementById('side-codex')?.addEventListener('click', () => screenManager.show('codex'));
  document.getElementById('side-bp')?.addEventListener('click', () => screenManager.show('bp'));
  document.getElementById('side-records')?.addEventListener('click', () => document.getElementById('leaderboard-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  document.getElementById('side-body')?.addEventListener('click', () => document.getElementById('body-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));

  // Tombol SERANG (Fase 12c): hold = tembak terus; setiap TAP juga langsung merespons.
  // UI/UX BUILD 42: TAHAN + TARIK tombol ini = mengarahkan serangan (aim stick ala
  // MLBB) — menggantikan zona aim tak kasatmata di kanan layar. Pointer di-capture
  // oleh InputHandler (jari meleset keluar tombol tidak memutus tembakan).
  const fireBtn = document.getElementById('btn-fire');
  input.bindFireButton(fireBtn, {
    onPress: () => {
      audio.unlock();
      game.triggerAttack(); // respons instan di karakter (swing/lunge) meski cd berjalan
    },
  });
  // Pindah layar saat run hidup (menu HUD, level-up, jeda) → lepas semua input
  // supaya tombol/joystick yang tertahan tidak "menyangkut" saat kembali.
  on('pause', () => input.releaseAll());

  // Chip akun: ketuk → layar MASUK (ganti akun / keluar; data tetap tersimpan)
  document.getElementById('account-chip').addEventListener('click', () => screenManager.show('profile'));
  // Chip pangkat: handler dipasang di dashboard-screen.js (rankChip.onclick) — jangan digandakan di sini

  // ---- AUDIO: unlock di gesture pertama (kebijakan autoplay browser) ----
  const unlockAudio = () => audio.unlock();
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  // Toggle suara (dashboard + modal pause) — ikon & label sinkron
  const soundIcon = () => document.getElementById('img-sound-icon');
  const refreshSoundUI = () => {
    if (soundIcon()) soundIcon().src = audio.muted ? 'assets/sprites/icon_sound_off.png' : 'assets/sprites/icon_sound_on.png';
    const pauseBtn = document.getElementById('btn-sound-pause');
    if (pauseBtn) pauseBtn.textContent = `Suara: ${audio.muted ? 'MATI' : 'AKTIF'}`;
  };
  document.getElementById('btn-sound-pause').addEventListener('click', () => {
    audio.toggleMute();
    refreshSoundUI();
  });
  // Fase 12: layar Jeda — Lanjutkan / Akhiri Run (dua tombol nyata, logic asli)
  document.getElementById('btn-resume').addEventListener('click', () => game.resume());
  document.getElementById('btn-quit-run').addEventListener('click', () => {
    audio.ui();
    game.finishRun(true);
  });
  on('pause', () => refreshSoundUI());
  on('resume', () => refreshSoundUI());
  // E1 poin 4: BACK KONTEKSTUAL — bila ada run yang masih hidup, tombol
  // kembali/tutup pulang ke GAMEPLAY (HUD + resume), bukan melempar pemain
  // ke dashboard (yang terasa seperti keluar dari pertandingan).
  const backToContext = (fallback = 'dashboard') => {
    if (game.run && !game.run.ended && game.run.player && game.run.player.alive) {
      screenManager.show('hud');
      window.__IMUNVERSE_applyHudDisclosure?.(); // stats/currency bisa berubah di layar menu → evaluasi ulang gerbang
      game.resume();
      return;
    }
    screenManager.show(fallback);
  };
  window.__IMUNVERSE_backToContext = backToContext;
  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => backToContext(btn.dataset.back));
  });

  // Keyboard kemampuan aktif (j/k/l/o sesuai data/abilities.json + angka 1-4)
  window.addEventListener('keydown', (ev) => {
    if (STATE.screen !== 'gameplay' || STATE.levelUpOpen) return;
    const target = ev.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const key = ev.key;
    // Fase 12: 1/2/3 = skill hero (slot 3 = ultimate), 4 = SERANG manual
    // Skill combat unlock: 1/2/3 cast (guard Lv 3/5/10 di game.useAbilityBySlot);
    // Shift+1/2/3 = UPGRADE skill (guard Lv 15 di game.upgradeAbilityBySlot).
    // ev.code dipakai agar Shift+digit (yang mengubah ev.key jadi '!' dst.) tetap dikenali.
    const digitSlot = { Digit1: 0, Digit2: 1, Digit3: 2 }[ev.code];
    if (digitSlot !== undefined) {
      ev.preventDefault();
      if (ev.shiftKey) game.upgradeAbilityBySlot(digitSlot);
      else game.useAbilityBySlot(digitSlot);
      return;
    }
    if (key === '4' || key.toLowerCase() === 't' || key === ' ') {
      ev.preventDefault();
      game.triggerAttack();
    }
  });

  // Navigasi statis antar screen (atribut data-nav / data-back di index.html)
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // F21: gerbang bertahap — menu terbuka sesuai Gelombang terbaik (data/features.json)
      const gate = isDockGated(btn);
      if (gate) {
        showToast({ message: `${gate.label || 'Terus bermain'} untuk membuka!` });
        audio.ui();
        return;
      }
      audio.ui();
      screenManager.show(btn.dataset.nav);
    });
  });
  // (handler data-back sudah kontekstual di atas — duplikasi dihapus E1 poin 4)
  document.getElementById('btn-play').addEventListener('click', () => {
    // Fast path: Play langsung memulai run dengan hero terpilih.
    // Bila hero terpilih ternyata terkunci (save lama), buka roster.
    const heroDef = getHero(STATE.meta.selectedHero);
    const unlocked = heroDef && STATE.meta.unlockedHeroes.includes(heroDef.id);
    if (heroDef && (heroDef.unlock?.type === 'default' || unlocked)) {
      game.startRun(heroDef.id);
    } else {
      screenManager.show('roster');
    }
  });
  document.getElementById('btn-start-run').addEventListener('click', () => rosterScreen.startSelectedRun());

  // Helper global kecil (dipakai tombol "Dashboard" di gameover)
  // F21: akun WAJIB sebelum dashboard — run pertama berakhir → daftar (simpan progres)
  window.__IMUNVERSE_goDashboard = () => {
    if (!hasAccount()) {
      showToast({ message: 'Buat akun untuk menyimpan perjalananmu!' });
      screenManager.show('auth');
      return;
    }
    screenManager.show('dashboard');
  };
  // Portrait HUD: pakai aset potret khusus hero (dipakai hud-screen.resetHUD)
  window.__IMUNVERSE_getHeroPortrait = () => {
    const heroDef = getHero(STATE.meta.selectedHero);
    return spriteToDataURL(heroDef ? (heroDef.spritePortrait || heroDef.spriteIdle) : '');
  };

  // 5) Game loop (rAF + delta-time) — update hanya saat gameplay aktif
  const loop = new GameLoop(
    (dt) => {
      if (STATE.screen === 'gameplay' && !STATE.paused && !STATE.levelUpOpen) {
        game.update(dt);
      }
    },
    (dt, time) => game.render(dt, time)
  );


// Toggle bahasa ID/EN satu-klik (seluruh UI + data, tanpa reload)
  const updateLangButtons = () => {
    const lang = STATE.meta.lang || 'id';
    document.querySelectorAll('.lang-pill').forEach((b) => { b.textContent = lang === 'id' ? 'EN' : 'ID'; });
  };
  document.querySelectorAll('.lang-pill').forEach((b) => b.addEventListener('click', () => {
    const lang = (STATE.meta.lang || 'id') === 'id' ? 'en' : 'id';
    STATE.meta.lang = lang;
    writeSave(STATE.meta);
    applyDataLanguage(lang);
    sweepAll();
    updateLangButtons();
  }));
  updateLangButtons();

  // Auto-pause saat tab disembunyikan
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && STATE.screen === 'gameplay' && !STATE.paused && !STATE.levelUpOpen) {
      game.pause();
    }
  });

  // expose untuk debugging & self-test headless
  // Helper e2e (Fase 8.4): uji pickup buff TANPA menunggu drop acak
  window.__IMUNVERSE_testGiveBuff = (id) => {
    if (!game.run) return false;
    const def = getData().nutrients.nutrients.find((n) => n.id === id);
    if (!def) return false;
    const pl = game.run.player;
    game.collectPickup(new Pickup(def, pl.x + 12, pl.y));
    return true;
  };
  window.__IMUNVERSE = { game, STATE, screenManager, input, getData }; // getData: harness e2e

  loop.start();
  setPaused(false);
  loadingScreen.setProgress(100, 'Siap!');

  const isAutotest = new URLSearchParams(location.search).get('autotest') === '1';
  if (isAutotest) {
    // Headless: buat sesi akun otomatis agar alur self-test lengkap
    if (!hasAccount()) signUp({ username: 'Tester', password: '1234', faction: 'imun' });
    screenManager.show('dashboard');
    runAutotest();
  } else if (!hasAccount()) {
    // F21 GAMEPLAY-FIRST: user baru disambut layar judul → cerita → LANGSUNG
    // gameplay (bukan dashboard/daftar akun dulu). Akun diminta setelah run pertama.
    screenManager.show('title');
  } else {
    // Pemain lama: sinematik pembuka (sekali) → dashboard → coach
    playOnce('intro', () => {
      screenManager.show('dashboard');
      coach.startIfFirstTime();
    });
  }
}

// ---------------------------------------------------------------------
// Self-test headless (dipakai saat pengembangan: index.html?autotest=1).
// Menjalankan alur gameplay nyata & mencetak hasil ke console.
// ---------------------------------------------------------------------
async function runAutotest() {
  const results = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, timeoutMs = 20000) => {
    const t0 = Date.now();
    while (!fn()) {
      if (Date.now() - t0 > timeoutMs) throw new Error('timeout menunggu kondisi');
      await sleep(50);
    }
  };
  const log = (k, v) => {
    results[k] = v;
    console.log('SELFTEST_STEP', k, v);
  };

  try {
    log('metaLoaded', !!STATE.meta && typeof STATE.meta.currency === 'number');
    await until(() => STATE.screen === 'dashboard');
    log('dashboardShown', true);

    STATE.meta.evoStage = 3; // Equity III → tebasan/siklon/petir terbuka
    STATE.meta.focusRun = 'limfatik'; // fokus detoks → registerRunResult terukur
    game.startRun('tcd8');
    log('runStarted', STATE.screen === 'gameplay');

    // Tempatkan musuh dekat player; TEMBAK manual dinyalakan untuk self-test
    game.input.setFire(true);
    for (let i = 0; i < 6; i++) game.spawnEnemy('bakteri', false);
    game.run.enemies.slice(-6).forEach((e, i) => {
      const a = (i / 6) * Math.PI * 2;
      e.x = game.run.player.x + Math.cos(a) * 110;
      e.y = game.run.player.y + Math.sin(a) * 110;
    });

    await until(() => game.run.kills > 0, 12000, 'ada kill');
    log('enemiesSpawned', game.run.enemies.length + game.run.kills > 0);
    log('shotsFired', game.run.stats.shotsFired > 0);
    log('killsCounted', game.run.kills);

    // Level-up: beri XP besar → modal muncul → pilih upgrade sampai antrean habis
    const levelBefore = game.run.level;
    game.addXP(500);
    await until(() => STATE.levelUpOpen, 5000, 'modal level-up');
    log('levelUpModal', game.run.level > levelBefore);
    let guard = 0;
    while (STATE.levelUpOpen && guard++ < 30 && game.run.currentChoices) {
      const choiceId = game.run.currentChoices[0].id;
      game.chooseLevelUp(choiceId);
      await sleep(30);
    }
    log('upgradeApplied', Object.keys(game.run.upgrades).length >= 1 && !STATE.levelUpOpen);

    // Kemampuan aktif: petir (slot 3) terluncur → cooldown berjalan
    // (skill combat unlock Lv 3/5/10: harness membuka slot manual — pola yang
    // sama dengan scripts/e2e-mlbb.mjs — agar efek skill tetap teruji langsung)
    game.run.skills.slots.forEach((s) => { if (s) s.unlocked = true; });
    const fired = game.useAbilityBySlot(2);
    log('abilityFired', fired && game.run.skills.slots[2].cdLeft > 0);

    // Drop bagian evolusi: bunuh 30 musuh elite (30%/kill) → pasti dapat,
    // lalu teleport semua pickup bagian ke player dan proses pengambilan.
    for (let i = 0; i < 30; i++) game.spawnEnemy('parasit', false);
    for (const e of game.run.enemies) {
      if (e.def.elite && e.alive) {
        const died = e.takeDamage(999999);
        if (died) game.onEnemyKilled(e, null);
      }
    }
    for (const p of game.run.pickups) {
      if (p.pickupType === 'part') { p.x = game.run.player.x; p.y = game.run.player.y; }
    }
    game.updatePickups(0.02);
    const partsTotal = Object.values(game.run.parts).reduce((a, b) => a + b, 0);
    log('evolutionPartsDropped', partsTotal > 0);

    // Damage → kena vignette; mati → modal revive → tolak → game over
    game.run.player.iframes = 0; // reset i-frames (musuh mungkin baru saja memukul)
    game.damagePlayer(10);
    log('tookDamage', game.run.player.hp < game.run.player.maxHP);
    game.run.player.iframes = 0;
    game.damagePlayer(999999);
    await sleep(100); // beri waktu emit 'revive' → modal tampil
    if (!game.run.ended && game.run.reviveOffered) {
      game.declineRevive(); // alur revive diuji terpisah; di sini lanjut game over
    }
    await until(() => STATE.screen === 'gameover', 8000, 'gameover');
    log('gameoverShown', true);
    log('currencyPersisted', STATE.meta.currency >= 0 && STATE.meta.stats.totalRuns >= 1);
    log('saveWritten', !!STATE.meta.updatedAt);
    const metaParts = Object.values(STATE.meta.evoParts).reduce((a, b) => a + b, 0);
    log('evolutionPersisted', metaParts > 0);

    // META-LAYER kondisi tubuh: run menghasilkan racun & fokus memulihkan
    // sistem; state tubuh tersimpan di save.
    const bodyBefore = STATE.meta.bodyState ? STATE.meta.bodyState.racun : null;
    log('bodyRacunRegistered', bodyBefore !== null && bodyBefore > 0);
    log('bodyStatePersisted', !!STATE.meta.bodyState && typeof STATE.meta.bodyState.energi === 'number');

    console.log('SELFTEST_PASS ' + JSON.stringify(results));
  } catch (err) {
    console.error('SELFTEST_FAIL', err && err.stack ? err.stack : err);
  }
}

boot().catch((err) => {
  console.error('[main] boot gagal:', err);
  loadingScreen.showBootError(err && err.message ? err.message : String(err));
});
