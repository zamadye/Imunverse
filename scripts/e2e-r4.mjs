/**
 * e2e-r4.mjs — R4 (Rebuild): Modul B — Phagocytosis (Telan).
 * Verifikasi: window eligible <20% HP (1.8s, hangus sekali), boss exempt,
 * telan instan tanpa loot, fallback strike, meter→ULT, HUD meter, flag OFF.
 * Jalankan: node scripts/e2e-r4.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require(process.env.PW_PATH || '/tmp/pw/node_modules/playwright-core');

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs:/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
const log = (k, v, extra) => console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${extra ? ' ' + extra : ''}`);

try {
  await page.goto('http://localhost:8000/?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }

  const flag = await page.evaluate(() => window.__IMUNVERSE.getData().modules.modules.phagocytosis.enabled);
  log('module-b-enabled', flag === true);

  await page.evaluate(() => window.__IMUNVERSE.game.startRun('macrophage'));
  await page.waitForTimeout(900);

  // ---- 1) window eligible: <20% HP → eligible; window habis → hangus ----
  const win = await page.evaluate(async () => {
    const mod = await import('/js/systems/phagocytosis.js');
    const g = window.__IMUNVERSE.game;
    g.spawnEnemy('bakteri', false);
    const e = g.run.enemies[g.run.enemies.length - 1];
    e.armorLayers = 0;
    const before = e.phagoEligible;
    e.hp = e.maxHP * 0.15;
    mod.phagoUpdateEnemy(e, 0.016);
    const during = e.phagoEligible;
    const windowT = e.phagoWindowT;
    // habiskan window
    mod.phagoUpdateEnemy(e, 5);
    const after = e.phagoEligible;
    const spent = e.phagoSpent;
    // masih <20% tapi hangus → tidak eligible lagi
    mod.phagoUpdateEnemy(e, 0.016);
    const reEligible = e.phagoEligible;
    return { before, during, windowT, after, spent, reEligible };
  });
  log('window-opens-below-20pct', win.before === false && win.during === true && Math.abs(win.windowT - 1.8) < 0.01, JSON.stringify(win));
  log('window-expires-and-burns', win.after === false && win.spent === true && win.reEligible === false);

  // ---- 2) boss tidak pernah eligible ----
  const boss = await page.evaluate(async () => {
    const mod = await import('/js/systems/phagocytosis.js');
    const g = window.__IMUNVERSE.game;
    g.spawnEnemy('sel_kanker', true);
    const b = g.run.enemies[g.run.enemies.length - 1];
    b.hp = b.maxHP * 0.05;
    mod.phagoUpdateEnemy(b, 0.016);
    return { eligible: b.phagoEligible };
  });
  log('boss-never-eligible', boss.eligible === false);

  // ---- 3) telan instan: tanpa loot, heal, meter naik ----
  const devour = await page.evaluate(async () => {
    const mod = await import('/js/systems/phagocytosis.js');
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    const p = run.player;
    g.spawnEnemy('bakteri', false);
    const e = run.enemies[run.enemies.length - 1];
    e.armorLayers = 0;
    e.x = p.x + 60; e.y = p.y;
    e.hp = e.maxHP * 0.1;
    mod.phagoUpdateEnemy(e, 0.016);
    p.hp = Math.max(1, p.maxHP - 30);
    const hp0 = p.hp;
    const xp0 = run.xpGained;
    const pickups0 = run.pickups.length;
    const meter0 = run.phagoMeter || 0;
    const kills0 = run.kills;
    const ok = mod.tryDevour(g, { player: p });
    return {
      ok, dead: !e.alive, devoured: e.devoured,
      healed: p.hp - hp0, meterGain: (run.phagoMeter || 0) - meter0,
      xpGain: run.xpGained - xp0, pickupsGain: run.pickups.length - pickups0,
      killCounted: run.kills - kills0,
    };
  });
  log('devour-instant-kill', devour.ok === true && devour.dead === true && devour.devoured === true);
  log('devour-heals-8', devour.healed >= 8, `healed=${devour.healed} (8 telan + passive Mako +2)`);
  log('devour-meter-25', devour.meterGain === 25);
  log('devour-no-normal-loot', devour.xpGain === 0 && devour.pickupsGain === 0, JSON.stringify(devour));
  log('devour-still-counts-kill', devour.killCounted === 1);

  // ---- 4) fallback strike bila tak ada eligible ----
  const fb = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    // bersihkan eligible
    for (const e of run.enemies) { e.phagoEligible = false; e.phagoSpent = true; }
    g.spawnEnemy('bakteri', false);
    const t = run.enemies[run.enemies.length - 1];
    t.armorLayers = 0;
    t.x = run.player.x + 50; t.y = run.player.y;
    const hp0 = t.hp;
    // reset cooldown devour (slot dgn def.id devour)
    const slot = run.skills.slots.findIndex((s) => s.def.id === 'devour');
    if (slot < 0) return { skip: true };
    run.skills.slots[slot].cdLeft = 0;
    g.useAbilityBySlot(slot);
    return { skip: false, damaged: t.hp < hp0 || !t.alive };
  });
  log('devour-fallback-strike', fb.skip ? 'SKIP' : fb.damaged === true);

  // ---- 5) meter penuh → ULT cd 0 + reset meter ----
  const ult = await page.evaluate(async () => {
    const mod = await import('/js/systems/phagocytosis.js');
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    run.phagoMeter = 75;
    run.skills.slots[2].cdLeft = 18; // ULT sedang cooldown panjang
    mod.addPhagoMeter(run, 25, g); // → 100 → trigger
    return { meterAfter: run.phagoMeter, ultCd: run.skills.slots[2].cdLeft };
  });
  log('meter-full-resets-ult', ult.meterAfter === 0 && ult.ultCd === 0, JSON.stringify(ult));

  // ---- 6) HUD meter tampil setelah telan ----
  const hud = await page.evaluate(() => {
    const box = document.getElementById('phago-meter');
    return { exists: !!box, visible: box && !box.classList.contains('hidden') };
  });
  log('hud-meter-visible', hud.exists && hud.visible === true, JSON.stringify(hud));
  await page.screenshot({ path: 'shots/review/r4-phago-meter.png' });

  // ---- 7) telemetry ----
  const tele = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('imunverse.metrics.v1') || '{}');
    return ((db.moduleEvents || []).filter((e) => e.moduleId === 'phagocytosis')).length;
  });
  log('telemetry-phago', tele > 0, `n=${tele}`);

  // ---- 8) flag OFF → mati total ----
  const off = await page.evaluate(async () => {
    localStorage.setItem('imunverse.module.phagocytosis', '0');
    const mod = await import('/js/systems/phagocytosis.js');
    const g = window.__IMUNVERSE.game;
    g.spawnEnemy('bakteri', false);
    const e = g.run.enemies[g.run.enemies.length - 1];
    e.hp = e.maxHP * 0.1;
    mod.phagoUpdateEnemy(e, 0.016);
    const eligible = e.phagoEligible;
    const dev = mod.tryDevour(g, { player: g.run.player });
    localStorage.removeItem('imunverse.module.phagocytosis');
    return { eligible, dev };
  });
  log('flag-off-dead', off.eligible === false && off.dev === false);

  log('zero-pageerror', errors.length === 0);
  if (errors.length) for (const e of errors.slice(0, 5)) log('err', e);
} catch (e) {
  log('suite-crash', false);
  console.error(e);
} finally {
  await browser.close();
}
