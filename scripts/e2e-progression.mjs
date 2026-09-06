/**
 * e2e-progression.mjs — Fase 18: kurva progresi & gatekeeper (spek pemilik).
 *
 * Verifikasi:
 *  1. Band kurva early/mid/late ada & memengaruhi interval spawn + HP musuh.
 *  2. GATEKEEPER: wave 5 → boss penjaga muncul, wave TERKUNCI (timer beku,
 *     pill HUD tampil); boss tumbang (auto-attack riil) → gerbang terbuka,
 *     wave lanjut ke 6.
 *  3. Musuh scaling mengikuti level player (HP beda pada level beda).
 *  4. XP band: early 1.6× lebih besar dari mid.
 *  5. Premium cap 30%: serum 25%, koin_ganda 30%.
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require('/tmp/pw/node_modules/playwright-core');

const USER = 'CurveTester';
const PASS = '1234';

let passed = 0;
let failed = 0;
const fails = [];
function ok(name, cond, extra = '') {
  if (cond) { passed++; console.log(`PASS ${name}`); }
  else { failed++; fails.push(name); console.log(`FAIL ${name} ${extra}`); }
}

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 160)));

await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
if (await page.locator('#cine-skip').isVisible().catch(() => false)) {
  await page.click('#cine-skip', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(400);
}

// akun fresh
await page.evaluate(() => { try { localStorage.removeItem('imunverse_save'); } catch {} try { localStorage.removeItem('__imunverse_session'); } catch {} });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
await page.fill('#auth-username', USER);
await page.fill('#auth-password', PASS);
await page.click('#auth-submit');
await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
for (let k = 0; k < 8; k++) {
  if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break;
  await page.click('#coach-skip', { timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(300);
}

// ---- 1) Band kurva ada & mengubah nilai turunan ----
const bands = await page.evaluate(async () => {
  const { getProgressionBand, getSpawnInterval, getEnemyHPScale } = await import('/js/core/data-store.js');
  return {
    early: getProgressionBand(3), mid: getProgressionBand(10), late: getProgressionBand(20),
    intervalEarly: getSpawnInterval(3), intervalMid: getSpawnInterval(10), intervalLate: getSpawnInterval(20),
    hpScaleWave3: getEnemyHPScale(3), hpScaleWave20: getEnemyHPScale(20),
  };
});
ok('bands-exist', bands.early.id === 'early' && bands.mid.id === 'mid' && bands.late.id === 'late');
ok('early-easier-than-mid', bands.intervalEarly > bands.intervalMid, `${bands.intervalEarly} vs ${bands.intervalMid}`);
ok('late-denser-than-mid', bands.intervalLate < bands.intervalMid, `${bands.intervalLate} vs ${bands.intervalMid}`);
ok('early-hp-soft', Math.abs(bands.hpScaleWave3 - (1 + 2 * 0.105) * 0.8) < 0.001, bands.hpScaleWave3.toFixed(3));
ok('late-hp-hard', Math.abs(bands.hpScaleWave20 - (1 + 19 * 0.105) * 1.55) < 0.001, bands.hpScaleWave20.toFixed(3));

// ---- masuk run (klik riil) ----
await page.evaluate(() => { const sc = document.querySelector('.dash-scroll'); if (sc) sc.scrollTop = 0; });
await page.click('#btn-play-big');
await page.waitForTimeout(700);
await page.locator('.camp-node:not(.locked)').first().click();
await page.waitForTimeout(400);
await page.click('#btn-campaign-go', { timeout: 8000 });
await page.waitForTimeout(600);
await page.evaluate(() => document.querySelector('#btn-prep-start')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(250);
await page.click('#btn-prep-start', { timeout: 8000 });
await page.waitForTimeout(900);
for (let k = 0; k < 4; k++) {
  if (!(await page.locator('#cine-skip').isVisible().catch(() => false))) break;
  await page.click('#cine-skip', { timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(350);
}
await page.waitForFunction(() => document.querySelector('#screen-hud')?.classList.contains('active'), null, { timeout: 15000 });
await page.waitForTimeout(600);
await closeModals();
await stabilize();

/** Jaga player hidup & game berjalan: heal + singkirkan kawanan non-boss. */
async function stabilize() {
  await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    if (!run || run.ended) return;
    run.player.hp = run.player.maxHP;
    run.player.alive = true;
    for (const e of run.enemies) {
      if (!e.isBoss) e.alive = false;
    }
    run.enemies = run.enemies.filter((e) => e.alive);
  });
}

/** Tutup modal level-up / peti boss yang mem-pause game (klik riil). */
async function closeModals() {
  for (let i = 0; i < 8; i++) {
    if (await page.locator('#screen-levelup.active').isVisible().catch(() => false)) {
      await page.locator('#levelup-choices .choice-card').first().click();
      await page.waitForTimeout(320);
      continue;
    }
    if (await page.locator('#screen-bosschest.active').isVisible().catch(() => false)) {
      await page.click('#btn-chest-keep', { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(350);
      continue;
    }
    break;
  }
}

// ---- 3) Scaling ikut level player: HP virus di level 1 vs level 4 ----
const lvlScale = await page.evaluate(async () => {
  const g = window.__IMUNVERSE.game;
  const run = g.run;
  const spy = (id) => {
    g.spawnEnemy(id, false);
    const e = run.enemies[run.enemies.length - 1];
    const hp = e.maxHP;
    e.alive = false; // buang dari simulasi (bukan dibunuh — tanpa reward)
    run.enemies.pop();
    return hp;
  };
  const hpLvl1 = spy('virus');
  run.level = 4;
  const hpLvl4 = spy('virus');
  run.level = 1;
  return { hpLvl1, hpLvl4, ratio: hpLvl4 / hpLvl1 };
});
ok('enemy-scale-follows-player-level', Math.abs(lvlScale.ratio - 1.18) < 0.02, JSON.stringify(lvlScale));

// ---- XP band early: addXP(10) → +16 (1.6×) ----
const xpBand = await page.evaluate(() => {
  const g = window.__IMUNVERSE.game;
  const run = g.run;
  const g0 = run.xpGained;
  g.addXP(10);
  return { gained: run.xpGained - g0, xpMult: run.player.stats.xpMult, combo: run.combo.count >= 3 ? 1.2 : 1 };
});
const expectedXp = 10 * xpBand.xpMult * xpBand.combo * 1.6;
ok('xp-band-early-1.6x', Math.abs(xpBand.gained - expectedXp) < 0.05, `gained=${xpBand.gained} expected=${expectedXp}`);

// ---- 2) GATEKEEPER: lompat ke wave 4.9 → wave 5 boss muncul & gerbang terkunci ----
// XP dari stabilize bisa memicu level-up → stabilkan dulu, LALU tutup modal
await stabilize();
await closeModals();
await page.evaluate(() => {
  const ss = window.__IMUNVERSE.game.run.spawnSys;
  ss.wave = 4;
  ss.waveTimer = 24.4; // 0.6 dtk lagi ganti wave
});
// TUNGGU KONDISI (bukan waktu tetap) — tahan beban suite lain mesin lambat
await page.waitForFunction(() => window.__IMUNVERSE.game.run.spawnSys.wave === 5, null, { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(700); // beri waktu boss penjaga spawn
const bossReady = await page.evaluate(() => {
  const run = window.__IMUNVERSE.game.run;
  return run.spawnSys.wave === 5 && !!run.boss;
});
if (!bossReady) { // satu nagihan: dorong timer sekali lagi
  await page.evaluate(() => { window.__IMUNVERSE.game.run.spawnSys.waveTimer = 24.9; });
  await page.waitForTimeout(1500);
}
await closeModals(); // modal sisa (jika ada) — jangan biarkan pause saat mengukur
await page.waitForTimeout(400);
const gate1 = await page.evaluate(() => {
  const run = window.__IMUNVERSE.game.run;
  const S = window.__IMUNVERSE.STATE;
  return {
    wave: run.spawnSys.wave,
    blocked: run.spawnSys.isGateBlocked(),
    bossAlive: !!run.boss && run.boss.alive,
    t1: run.spawnSys.waveTimer,
    pillHidden: document.getElementById('hud-gate').classList.contains('hidden'),
    dbg: { paused: S.paused, screen: S.screen, lvlOpen: S.levelUpOpen, ended: run.ended, time: Math.round(run.time * 10) / 10, modals: [...document.querySelectorAll('.screen.modal.active')].map((m) => m.id), queue: run.levelUpQueue, hitStop: Math.round(run.hitStop * 100) },
  };
});
ok('gate-closed-at-wave5', gate1.wave === 5 && gate1.blocked && gate1.bossAlive, JSON.stringify(gate1));
ok('gate-hud-pill-visible', !gate1.pillHidden);
await closeModals();
await page.waitForTimeout(2600);
const gate2 = await page.evaluate(() => {
  const run = window.__IMUNVERSE.game.run;
  return { wave: run.spawnSys.wave, t2: run.spawnSys.waveTimer };
});
ok('wave-frozen-while-guardian-alive', gate2.wave === 5, `wave=${gate2.wave}`);

// ---- Fase 18 XP BANK: selama gerbang tertutup, XP DITAHAN (tanpa naik level) ----
await closeModals();
const bankState = await page.evaluate(() => {
  const g = window.__IMUNVERSE.game;
  const run = g.run;
  const lvl0 = run.level, xp0 = run.xp, bank0 = run.xpBank || 0;
  g.addXP(25); // jalur riil yang sama dengan pickup orb XP
  g.addXP(25);
  return { lvl0, xp0, bank0, lvl1: run.level, xp1: run.xp, bank1: run.xpBank || 0 };
});
ok('xp-banked-while-gate-closed',
  bankState.bank1 > bankState.bank0 + 40 && bankState.lvl1 === bankState.lvl0 && Math.abs(bankState.xp1 - bankState.xp0) < 0.001,
  JSON.stringify(bankState));

// ---- boss tumbang lewat auto-attack RIIL (boss ditarik ke depan pedang) ----
await page.evaluate(() => {
  const g = window.__IMUNVERSE.game;
  const run = g.run;
  if (run.boss) {
    run.boss.x = run.player.x + 42;
    run.boss.y = run.player.y;
    run.boss.hp = Math.min(run.boss.hp, 6); // percepat: 1-2 tebasan auto-attack
  }
});
let gateOpen = false;
for (let k = 0; k < 20; k++) {
  await page.waitForTimeout(600);
  if (await page.locator('#screen-levelup.active').isVisible().catch(() => false)) {
    await page.locator('#levelup-choices .choice-card').first().click();
    await page.waitForTimeout(300);
    continue;
  }
  // peti boss membuka modal pause → klaim tanpa iklan (klik riil)
  if (await page.locator('#screen-bosschest.active').isVisible().catch(() => false)) {
    await page.click('#btn-chest-keep', { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  await stabilize(); // boss tetap, kawanan kecil dibersihkan & player diheal
  gateOpen = await page.evaluate(() => !window.__IMUNVERSE.game.run.spawnSys.isGateBlocked());
  if (gateOpen) break;
}
ok('gate-opens-after-guardian-dies', gateOpen);

// Fase 18 XP BANK: setelah penjaga tumbang, XP tertahan CAIR (bank kosong, level naik)
const flushed = await page.evaluate(() => {
  const run = window.__IMUNVERSE.game.run;
  return { bank: run.xpBank || 0, lvlEnd: run.level, lvl0: undefined };
});
ok('xp-bank-flushes-on-gate-open', flushed.bank === 0 && typeof bankState.lvl0 === 'number' && flushed.lvlEnd >= bankState.lvl0, JSON.stringify({ ...flushed, lvl0: bankState.lvl0 }));

// wave lanjut setelah durasi wave berikutnya (percepat timer)
await closeModals();
await page.evaluate(() => { window.__IMUNVERSE.game.run.spawnSys.waveTimer = 24.5; });
await page.waitForTimeout(1200);
const advanced = await page.evaluate(() => window.__IMUNVERSE.game.run.spawnSys.wave);
ok('wave-advances-after-gate-open', advanced === 6, `wave=${advanced}`);

// ---- 5) Premium cap 30% ----
const prem = await page.evaluate(async () => {
  const { getData } = await import('/js/core/data-store.js');
  const items = Object.fromEntries(getData().upgrades.shopItems.map((s) => [s.id, s.desc]));
  return { items };
});
ok('serum-25pct-within-cap', /25%/.test(prem.items.serum_awal || ''));
ok('koin-ganda-30pct-within-cap', /30%/.test(prem.items.koin_ganda || ''));

ok('no-pageerrors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`\nRESULT: ${passed} PASS, ${failed} FAIL${fails.length ? ' → ' + fails.join(', ') : ''}`);
await browser.close();
process.exit(failed ? 1 : 0);
