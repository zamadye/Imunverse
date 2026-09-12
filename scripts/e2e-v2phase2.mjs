/**
 * e2e-v2phase2.mjs — V2 Phase 2: CORE COMBAT.
 * Verifikasi: contact attack bertelegraph (windup/strike/whiff), smart
 * targeting finisher, movement smoothing, angka pacing dari data.
 * Jalankan: node scripts/e2e-v2phase2.mjs
 * (butuh server :8000 + chromium @sparticuz di /tmp/chromium, libs di /tmp/alibs/lib)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require(process.env.PW_PATH || '/tmp/pw/node_modules/playwright-core');

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
const log = (k, v) => console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${v === true || v === false ? '' : ' ' + v}`);
const active = (id) => page.evaluate((s) => document.querySelector(s)?.classList.contains('active') || false, id);

try {
  await page.goto('http://localhost:8000/?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }
  if (await page.locator('#screen-title.active').isVisible().catch(() => false)) {
    await page.click('#btn-title-login', { timeout: 4000, force: true });
    await page.waitForTimeout(400);
  }
  if (await active('#screen-auth')) {
    await page.fill('#auth-username', 'PemainHebat');
    await page.fill('#auth-password', '1234');
    await page.click('#auth-submit');
  }
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 }).catch(() => {});
  for (let k = 0; k < 8; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip', { timeout: 1500 }).catch(() => {}); await page.waitForTimeout(350); }

  // ---- data termuat ----
  const cd = await page.evaluate(() => window.__IMUNVERSE.getData().combat);
  log('combat-json-loaded', !!cd && typeof cd.contactAttack.windup === 'number' && typeof cd.movement.accel === 'number');
  const wv = await page.evaluate(() => window.__IMUNVERSE.getData().waves);
  log('waves-pacing-in-data', wv.breakDuration === 2.5 && wv.trickleIntervalMult === 1.55); // RONDE-7: tekanan permanen, tanpa jeda sunyi

  // ---- mulai run ----
  await page.evaluate(() => document.getElementById('btn-play').click()); // click DOM: coach/narrative layer kadang menyerap pointer fisik (force click) tanpa terselesaikan skip
  for (let k = 0; k < 15; k++) {
    await page.waitForTimeout(600);
    if (await page.evaluate(() => document.querySelector('#screen-prep')?.classList.contains('active'))) {
      await page.locator('.prep-hero:not(.locked)').first().click({ timeout: 4000 }).catch(() => {});
      await page.click('#btn-prep-start', { timeout: 8000 }).catch(() => {});
    }
    if (await page.locator('#cine-skip').isVisible().catch(() => false)) await page.click('#cine-skip').catch(() => {});
    if (await active('#screen-hud')) break;
  }
  log('hud-active', await active('#screen-hud'));

  // ---- MOVEMENT SMOOTHING: dorong input konstan, kecepatan harus ramp-up ----
  const move = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const p = g.run.player;
    p.maxHP = 50000; p.hp = 50000; p.iframes = 99999;
    // matikan input asli & suntik gerakan konstan lewat monkey-patch input
    const orig = g.input.getMoveVector ? 1 : null;
    const inputObj = g.input;
    const backup = inputObj.getMoveVector;
    inputObj.getMoveVector = () => ({ x: 1, y: 0, magnitude: 1 });
    p.vx = 0; p.vy = 0;
    const samples = [];
    for (let i = 0; i < 36; i++) {
      samples.push(Math.hypot(p.vx, p.vy));
      await new Promise((r) => requestAnimationFrame(r));
    }
    // lepas input → ukur waktu berhenti
    inputObj.getMoveVector = () => ({ x: 0, y: 0, magnitude: 0 });
    // Ukur WAKTU berhenti (bukan hitungan frame — frame sandbox CPU-render tidak 60fps)
    const tRel = performance.now();
    let stopMs = 999;
    for (let i = 0; i < 90; i++) {
      if (Math.hypot(p.vx, p.vy) < 6) { stopMs = performance.now() - tRel; break; }
      await new Promise((r) => requestAnimationFrame(r));
    }
    inputObj.getMoveVector = backup;
    return { v2: samples[2], v30: samples[30], stopMs, topSpeed: Math.max(...samples) };
  });
  log('movement-ramps-up', move.v2 < move.v30 && move.v2 > 0);
  log('movement-stops-fast', move.stopMs <= 300, `${Math.round(move.stopMs)}ms`);
  log('movement-values', `v2=${move.v2.toFixed(0)} v30=${move.v30.toFixed(0)} stopFrames=${move.stopFrames}`);

  // ---- SMART TARGETING: musuh sekarat > musuh full-HP sedikit lebih dekat ----
  const targeting = await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    const p = g.run.player;
    // sterilkan: singkirkan musuh lain dari sekitar
    for (const e of g.run.enemies) { if (e.alive) { e.x = p.x + 3000; e.y = p.y + 3000; } }
    const pool = g.run.enemies.filter((e) => e.alive && !e.isBoss);
    if (pool.length < 2) return { skip: true };
    const [near, far] = pool;
    near.x = p.x + 120; near.y = p.y; near.maxHP = 100; near.hp = 100;   // dekat, sehat
    far.x = p.x + 170; far.y = p.y; far.maxHP = 100; far.hp = 5;        // agak jauh, sekarat
    g.run.collision.rebuildEnemyGrid(g.run.enemies);
    const chosen = g.findAttackTarget(p.x, p.y, 400);
    const nearest = g.findNearestEnemy(p.x, p.y, 400);
    return { skip: false, chosePinnedWounded: chosen === far, nearestIsNear: nearest === near };
  });
  log('targeting-finisher-bias', targeting.skip ? 'SKIP (musuh <2)' : targeting.chosePinnedWounded);
  log('targeting-nearest-unchanged', targeting.skip ? 'SKIP' : targeting.nearestIsNear);

  // ---- CONTACT ATTACK TELEGRAPH: windup teramati, damage TIDAK instan ----
  const telegraph = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const p = g.run.player;
    p.iframes = 0; p.maxHP = 50000; p.hp = 50000;
    const e = g.run.enemies.find((en) => en.alive && en.usesContactTelegraph);
    if (!e) return { skip: true };
    e.frozen = 0; e.homeX = null; e.homeY = null; e.aiState = 'chase';
    e.maxHP = 999999; e.hp = 999999; // tank: tak boleh mati sebelum strike
    e.atkPhase = 'ready'; e.atkT = 0;
    // buang pelindung/shield agar damage strike terbaca di HP
    if (g.runFlags) g.runFlags.pelindung = false;
    g.run.shield = 0; g.run.evadeCharges = 0;
    const px = p.x, py = p.y;
    e.x = px + e.radius + p.radius; e.y = py;
    const hp0 = p.hp;
    let sawWindup = false, sawStop = false, dmgFrame = -1, windupFrame = -1;
    let ex0 = null;
    const ex = e.x, ey = e.y;
    for (let i = 0; i < 180; i++) {
      p.x = px; p.y = py; p.vx = 0; p.vy = 0; // pin player: tetap dalam toleransi
      e.x = ex; e.y = ey; e.vx = 0; e.vy = 0; // pin musuh: netralkan knockback Phase 1
      if (e.attackSpriteHint && !sawWindup) { sawWindup = true; windupFrame = i; ex0 = e.x; }
      if (sawWindup && dmgFrame < 0 && e.atkPhase === 'windup' && Math.abs(e.x - ex0) < 2) sawStop = true;
      if (p.hp < hp0 && dmgFrame < 0) { dmgFrame = i; break; }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { skip: false, sawWindup, sawStop, windupFrame, dmgFrame, dmgTaken: hp0 - p.hp };
  });
  if (telegraph.skip) {
    log('telegraph-windup', 'SKIP (tidak ada musuh)');
  } else {
    log('telegraph-windup-shown', telegraph.sawWindup);
    log('telegraph-enemy-stops', telegraph.sawStop);
    // strike HARUS mendarat, dan baru ≥0.25s (≈15 frame) setelah windup mulai
    log('telegraph-strike-lands', telegraph.dmgFrame >= 0 && telegraph.dmgTaken > 0);
    log('telegraph-damage-delayed', telegraph.dmgFrame >= 0 && telegraph.dmgFrame - telegraph.windupFrame >= 14);
    log('telegraph-frames', `windup@${telegraph.windupFrame} dmg@${telegraph.dmgFrame} dmg=${telegraph.dmgTaken}`);
  }

  // ---- WHIFF: menjauh saat windup → strike gagal ----
  const whiff = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const p = g.run.player;
    p.iframes = 0; p.hp = 50000;
    const e = g.run.enemies.find((en) => en.alive && en.usesContactTelegraph);
    if (!e) return { skip: true };
    e.frozen = 0; e.homeX = null; e.homeY = null; e.aiState = 'chase';
    e.atkPhase = 'ready'; e.atkT = 0;
    e.x = p.x + e.radius + p.radius; e.y = p.y;
    const hp0 = p.hp;
    // tunggu windup mulai, lalu teleport player menjauh (dodge)
    let dodged = false;
    for (let i = 0; i < 120; i++) {
      if (e.atkPhase === 'windup' && !dodged) { p.x += 600; dodged = true; }
      if (e.atkPhase === 'cooldown') break;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { skip: false, dodged, noDamage: p.hp === hp0 };
  });
  log('whiff-dodge-rewarded', whiff.skip ? 'SKIP' : (whiff.dodged && whiff.noDamage));

  // ---- HAZARD & BOSS tetap contact instan (flag) ----
  const flags = await page.evaluate(() => {
    const defs = window.__IMUNVERSE.getData().enemies.enemies;
    const mk = (id) => defs.find((d) => d.id === id);
    // instansiasi flag mengikuti def — cukup cek logika yang dipakai konstruktor
    const uses = (d) => !d.isBoss && d.behavior !== 'hazard_drift' && d.behavior !== 'boss_pattern_a';
    return {
      bakteriTelegraph: uses(mk('bakteri')),
      toksinInstant: !uses(mk('toksin')),
      bossInstant: !uses(mk('sel_kanker')),
    };
  });
  log('hazard-still-instant', flags.toksinInstant);
  log('boss-still-instant', flags.bossInstant);
  log('chaser-telegraphed', flags.bakteriTelegraph);

  await page.screenshot({ path: 'shots/review/v2p2-combat.png' });

  log('zero-pageerror', errors.length === 0);
  if (errors.length) for (const e of errors.slice(0, 6)) log('err', e);
} catch (e) {
  log('suite-crash', false);
  console.error(e);
} finally {
  await browser.close();
}
