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
import { loadLang, initSweep, sweepAll } from './systems/i18n.js';
import { emit, on } from './core/ui-bridge.js';
import { game } from './core/game.js';
import { Pickup } from './entities/pickup.js';
import { InputHandler } from './input/input-handler.js';
import { loadAllSprites, spriteToDataURL } from './render/sprite-loader.js';
import { loadSave, writeSave, clearSave } from './save/save-manager.js';
import { createDefaultMeta, mergeMetaDefaults } from './core/state-manager.js';
import { getHero } from './core/data-store.js';

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
import * as authScreen from './ui/screens/auth-screen.js';
import * as heroDetailScreen from './ui/screens/hero-detail-screen.js';
import { signUp, hasAccount } from './systems/account-system.js';
import * as coach from './ui/coach.js';
import * as bagScreen from './ui/screens/bag-screen.js';
import * as focusScreen from './ui/screens/focus-screen.js';
import * as bosschestScreen from './ui/screens/bosschest-screen.js';

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
  setTimeout(() => el.remove(), 3200);
  while (box.children.length > 4) box.firstChild.remove();
}

// ---------------------------------------------------------------------
// Wiring event ui-bridge → screen UI
// ---------------------------------------------------------------------
function wireUiBridge() {
  on('toast', showToast);

  on('playerHit', () => {
    vignette.classList.add('flash');
    setTimeout(() => vignette.classList.remove('flash'), 60);
  });

  on('runstart', () => {
    hudScreen.resetHUD();
    screenManager.show('hud');
    tutorialOnRunStart(); // onboarding run pertama (3 langkah)
  });

  on('wave', ({ wave, isBoss }) => {
    hudScreen.showAnnounce(isBoss ? 'BOSS!' : `WAVE ${wave}`, isBoss);
  });

  on('levelup', (payload) => screenManager.show('levelup', payload));
  on('bosschest', (payload) => screenManager.show('bosschest', payload));
  on('pause', () => screenManager.show('pause'));
  on('revive', () => screenManager.show('revive'));
  // Modal tertutup (level-up selesai / resume / revive sukses) → kembali ke HUD
  on('resume', () => {
    if (STATE.screen === 'gameplay') screenManager.show('hud');
  });
  on('gameover', (payload) => screenManager.show('gameover', payload));

  // Banner nama kemampuan saat dicast (impact terlihat jelas)
  let bannerTimer = null;
  on('abilityBanner', ({ name, color }) => {
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
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
async function boot() {
  resize();
  loadingScreen.setProgress(4, 'Menyiapkan organisme…');

  // Input: virtual joystick (touch) + WASD/arrow (desktop)
  const input = new InputHandler(canvas);
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

  // 3) Save / meta
  const raw = loadSave();
  STATE.meta = raw ? mergeMetaDefaults(raw) : createDefaultMeta();
  if (!raw) writeSave(STATE.meta);
  applyDataLanguage(STATE.meta.lang || 'id'); // dwibahasa: data sesuai bahasa tersimpan

  // 4) Wiring UI
  game.init({ canvas, input });
  wireUiBridge();

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
  screenManager.registerScreen('focus', focusScreen);
  screenManager.registerScreen('prep', prepScreen);
  screenManager.registerScreen('campaign', campaignScreen);
  screenManager.registerScreen('auth', authScreen);
  screenManager.registerScreen('herodetail', heroDetailScreen);
  screenManager.registerScreen('bag', bagScreen);
  screenManager.registerScreen('bosschest', bosschestScreen);
  bosschestScreen.wire();

  // Tampilkan loading lewat manager agar transisi berikutnya bersih
  screenManager.show('loading');

  // Tombol HUD pause (elemen statis — di-wire di sini agar hud-screen tetap murni view)
  document.getElementById('btn-pause').addEventListener('click', () => game.pause());

  // Wire tombol modal revive & gameover (sekali saat boot)
  reviveScreen.wireButtons();
  gameoverScreen.wireButtons();
  document.getElementById('btn-arena-close').addEventListener('click', () => screenManager.show('dashboard'));
  document.getElementById('btn-focus-close').addEventListener('click', () => screenManager.show('dashboard'));
  // MULAI → Peta Tubuh (kampanye = alur utama; Endless tetap via prep)
  document.getElementById('btn-play-big').addEventListener('click', () => screenManager.show('campaign'));

  // Tombol TEMBAK (manual): tahan untuk menembak terus
  const fireBtn = document.getElementById('btn-fire');
  const stopFire = () => input.setFire(false);
  fireBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.setFire(true);
    audio.unlock();
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => fireBtn.addEventListener(ev, stopFire));
  window.addEventListener('blur', stopFire);

  // Chip akun: ketuk → layar MASUK (ganti akun / keluar; data tetap tersimpan)
  document.getElementById('account-chip').addEventListener('click', () => screenManager.show('auth'));

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
  document.getElementById('btn-sound-toggle').addEventListener('click', () => {
    audio.toggleMute();
    refreshSoundUI();
  });
  document.getElementById('btn-sound-pause').addEventListener('click', () => {
    audio.toggleMute();
    refreshSoundUI();
  });
  on('pause', () => refreshSoundUI());
  on('resume', () => refreshSoundUI());
  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => screenManager.show(btn.dataset.back));
  });

  // Keyboard kemampuan aktif (j/k/l/o sesuai data/abilities.json + angka 1-4)
  window.addEventListener('keydown', (ev) => {
    if (STATE.screen !== 'gameplay' || STATE.levelUpOpen) return;
    const target = ev.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const key = ev.key.toLowerCase();
    const defs = getData().abilities.abilities;
    const byKey = defs.find((a) => a.key === key);
    const byNum = /^[1-4]$/.test(key) ? defs.find((a) => a.slot === Number(key)) : null;
    const def = byKey || byNum;
    if (def) {
      ev.preventDefault();
      game.useAbilityBySlot(def.slot);
    }
  });

  // Navigasi statis antar screen (atribut data-nav / data-back di index.html)
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.ui();
      screenManager.show(btn.dataset.nav);
    });
  });
  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => screenManager.show(btn.dataset.back));
  });
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
  window.__IMUNVERSE_goDashboard = () => screenManager.show('dashboard');
  // Portrait HUD: pakai aset potret khusus hero (dipakai hud-screen.resetHUD)
  window.__IMUNVERSE_getHeroPortrait = () => {
    const heroDef = getHero(STATE.meta.selectedHero);
    return spriteToDataURL(heroDef ? (heroDef.spritePortrait || heroDef.spriteIdle) : '');
  };

  // Reset save (dashboard footer)
  document.getElementById('btn-reset-save').addEventListener('click', () => {
    if (window.confirm('Hapus seluruh progress (antibodi, unlock, upgrade)?')) {
      clearSave();
      STATE.meta = createDefaultMeta();
      writeSave(STATE.meta);
      showToast({ message: 'Save direset. Organisme baru terbentuk. 🧬' });
      screenManager.show('auth');
    }
  });

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
  window.__IMUNVERSE = { game, STATE, screenManager, input };

  loop.start();
  setPaused(false);
  loadingScreen.setProgress(100, 'Siap!');

  const isAutotest = new URLSearchParams(location.search).get('autotest') === '1';
  if (isAutotest) {
    // Headless: buat sesi akun otomatis agar alur self-test lengkap
    if (!hasAccount()) signUp({ username: 'Tester', password: '1234', faction: 'imun' });
    screenManager.show('dashboard');
    runAutotest();
  } else {
    // Sinematik pembuka (sekali) → AKUN (daftar/masuk) → dashboard → coach
    playOnce('intro', () => {
      if (hasAccount()) {
        screenManager.show('dashboard');
        coach.startIfFirstTime();
      } else {
        screenManager.show('auth'); // user baru: daftar + pilih fraksi dulu
      }
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

    STATE.meta.evoStage = 3; // Fagosit Elite → tebasan/siklon/petir terbuka
    STATE.meta.focusRun = 'limfatik'; // fokus detoks → registerRunResult terukur
    game.startRun('sel_t');
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
    const fired = game.useAbilityBySlot(3);
    log('abilityFired', fired && game.run.abilities.getBySlot(3).cdLeft > 0);

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
  const label = document.getElementById('loading-label');
  if (label) label.textContent = 'Gagal memuat: ' + err.message;
});
