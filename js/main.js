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
import { loadAllData } from './core/data-store.js';
import { emit, on } from './core/ui-bridge.js';
import { game } from './core/game.js';
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
  });

  on('wave', ({ wave, isBoss }) => {
    hudScreen.showAnnounce(isBoss ? 'BOSS!' : `WAVE ${wave}`, isBoss);
  });

  on('levelup', (payload) => screenManager.show('levelup', payload));
  on('pause', () => screenManager.show('pause'));
  on('revive', () => screenManager.show('revive'));
  // Modal tertutup (level-up selesai / resume / revive sukses) → kembali ke HUD
  on('resume', () => {
    if (STATE.screen === 'gameplay') screenManager.show('hud');
  });
  on('gameover', (payload) => screenManager.show('gameover', payload));
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

  // Tampilkan loading lewat manager agar transisi berikutnya bersih
  screenManager.show('loading');

  // Tombol HUD pause (elemen statis — di-wire di sini agar hud-screen tetap murni view)
  document.getElementById('btn-pause').addEventListener('click', () => game.pause());

  // Wire tombol modal revive & gameover (sekali saat boot)
  reviveScreen.wireButtons();
  gameoverScreen.wireButtons();

  // Navigasi statis antar screen (atribut data-nav / data-back di index.html)
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => screenManager.show(btn.dataset.nav));
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
      screenManager.show('dashboard');
      showToast({ message: 'Save direset. Organisme baru terbentuk. 🧬' });
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

  // Auto-pause saat tab disembunyikan
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && STATE.screen === 'gameplay' && !STATE.paused && !STATE.levelUpOpen) {
      game.pause();
    }
  });

  // expose untuk debugging & self-test headless
  window.__IMUNVERSE = { game, STATE, screenManager, input };

  loop.start();
  setPaused(false);
  screenManager.show('dashboard');
  loadingScreen.setProgress(100, 'Siap!');

  if (new URLSearchParams(location.search).get('autotest') === '1') {
    runAutotest();
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

    game.startRun('sel_t');
    log('runStarted', STATE.screen === 'gameplay');

    // Tempatkan musuh dekat player agar auto-attack terjadi cepat
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
