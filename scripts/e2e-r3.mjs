/**
 * e2e-r3.mjs — R3 (Rebuild): Modul A — Antigen Memory.
 * Verifikasi: flag on/off, threshold 15/37/63, mult per tier, ignore-armor T2,
 * splash T3, kartu upgrade bersyarat 70%, HUD chip, telemetry, encounter record.
 * Jalankan: node scripts/e2e-r3.mjs
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

  // ---- 1) data & threshold ----
  const cfg = await page.evaluate(async () => {
    const m = window.__IMUNVERSE.getData().modules;
    const mod = await import('/js/systems/antigen-memory.js');
    return {
      enabled: m.modules.antigenMemory.enabled,
      t1: mod.killsRequired(1), t2: mod.killsRequired(2), t3: mod.killsRequired(3),
    };
  });
  log('modules-json-loaded', cfg.enabled === true);
  log('thresholds-15-37-63', cfg.t1 === 15 && cfg.t2 === 37 && cfg.t3 === 63, JSON.stringify(cfg));

  // ---- 2) mulai run, unit tes inti ----
  await page.evaluate(() => window.__IMUNVERSE.game.startRun('macrophage'));
  await page.waitForTimeout(900);

  const unit = await page.evaluate(async () => {
    const mod = await import('/js/systems/antigen-memory.js');
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    // sanitasi: fresh antigen
    mod.initAntigenRun(run);
    const mk = (typeId) => { g.spawnEnemy(typeId, false); return run.enemies[run.enemies.length - 1]; };
    const bak = mk('bakteri');
    const vir = mk('virus');

    // T0: mult 1.0
    const m0 = mod.antigenDamageMult(run, bak);
    // 15 kill bakteri → T1
    for (let i = 0; i < 15; i++) mod.onAntigenKill(run, bak, null);
    const m1 = mod.antigenDamageMult(run, bak);
    const mOther = mod.antigenDamageMult(run, vir); // tipe lain tetap 1.0
    // sampai 37 → T2
    for (let i = 0; i < 22; i++) mod.onAntigenKill(run, bak, null);
    const m2 = mod.antigenDamageMult(run, bak);
    // ignore armor T2: statistik 300 sampel
    let ig = 0;
    for (let i = 0; i < 300; i++) if (mod.antigenIgnoreArmor(run, bak)) ig++;
    // sampai 63 → T3
    for (let i = 0; i < 26; i++) mod.onAntigenKill(run, bak, null);
    const m3 = mod.antigenDamageMult(run, bak);
    const tiers = { ...run.antigen.tiers };
    return { m0, m1, m2, m3, mOther, igPct: ig / 300, tiers };
  });
  log('t0-mult-1', unit.m0 === 1);
  log('t1-mult-115', Math.abs(unit.m1 - 1.15) < 1e-9, `m1=${unit.m1}`);
  log('t2-mult-130', Math.abs(unit.m2 - 1.30) < 1e-9);
  log('t3-mult-150', Math.abs(unit.m3 - 1.50) < 1e-9);
  log('other-type-unaffected', unit.mOther === 1);
  log('t2-ignore-armor-10pct', unit.igPct > 0.04 && unit.igPct < 0.18, `pct=${unit.igPct.toFixed(3)}`);
  log('tiers-recorded', unit.tiers.bakteri === 3, JSON.stringify(unit.tiers));

  // ---- 3) splash T3 membunuh musuh sekitar ----
  const splash = await page.evaluate(async () => {
    const mod = await import('/js/systems/antigen-memory.js');
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    // bakteri sudah T3 dari unit test di atas
    g.spawnEnemy('bakteri', false);
    const victim = run.enemies[run.enemies.length - 1];
    g.spawnEnemy('bakteri', false);
    const nearby = run.enemies[run.enemies.length - 1];
    victim.x = 500; victim.y = 500; nearby.x = 540; nearby.y = 500; // dalam radius 70
    nearby.hp = 3; nearby.armorLayers = 0;
    victim.lastHitDamage = 100; // splash = 35 dmg
    const before = nearby.alive;
    mod.onAntigenKill(run, victim, g);
    return { before, after: nearby.alive };
  });
  log('t3-splash-kills-nearby', splash.before === true && splash.after === false, JSON.stringify(splash));

  // ---- 4) kartu upgrade bersyarat 70% ----
  const upg = await page.evaluate(async () => {
    const mod = await import('/js/systems/antigen-memory.js');
    const us = await import('/js/systems/upgrade-system.js');
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    // reset: tidak ada progress → kartu TIDAK boleh muncul
    mod.initAntigenRun(run);
    run.upgrades = {};
    let seen0 = false;
    for (let i = 0; i < 30; i++) {
      if (us.rollLevelUpChoices(run).some((c) => c.id === 'antigen_boost')) { seen0 = true; break; }
    }
    // progress 80% ke T1 (12/15) → kartu BOLEH muncul
    g.spawnEnemy('virus', false);
    const v = run.enemies[run.enemies.length - 1];
    for (let i = 0; i < 12; i++) mod.onAntigenKill(run, v, null);
    let seen1 = false;
    for (let i = 0; i < 60; i++) {
      if (us.rollLevelUpChoices(run).some((c) => c.id === 'antigen_boost')) { seen1 = true; break; }
    }
    // apply → tier virus jadi 1 walau kill belum 15
    const res = us.applyLevelUp(run, 'antigen_boost');
    return { seen0, seen1, applied: res.antigenType, tierAfter: run.antigen.tiers[res.antigenType] };
  });
  log('upgrade-hidden-below-70', upg.seen0 === false);
  log('upgrade-appears-above-70', upg.seen1 === true);
  log('upgrade-applies-tier', upg.applied === 'virus' && upg.tierAfter === 1, JSON.stringify(upg));

  // ---- 5) HUD chip tampil setelah kill nyata ----
  const hud = await page.evaluate(async () => {
    const mod = await import('/js/systems/antigen-memory.js');
    const g = window.__IMUNVERSE.game;
    mod.initAntigenRun(g.run);
    g.spawnEnemy('bakteri', false);
    const e = g.run.enemies[g.run.enemies.length - 1];
    e.hp = 1;
    mod.onAntigenKill(g.run, e, g); // emit antigen → chip
    await new Promise((r) => setTimeout(r, 300));
    const chip = document.getElementById('hud-antigen');
    return { visible: chip && !chip.classList.contains('hidden'), text: chip ? chip.textContent : '' };
  });
  log('hud-chip-visible', hud.visible === true, hud.text);
  await page.screenshot({ path: 'shots/review/r3-hud-antigen.png' });

  // ---- 6) telemetry module_trigger tercatat ----
  const tele = await page.evaluate(() => {
    const raw = localStorage.getItem('imunverse.metrics.v1');
    const db = raw ? JSON.parse(raw) : {};
    const evs = (db.moduleEvents || []).filter((e) => e.moduleId === 'antigenMemory');
    return { n: evs.length, sample: evs[0] || null };
  });
  log('telemetry-module-trigger', tele.n > 0, `n=${tele.n}`);

  // ---- 7) encounter record ke meta + codex ----
  const rec = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    // pastikan ada tier di run, lalu finish
    const mod = await import('/js/systems/antigen-memory.js');
    g.spawnEnemy('bakteri', false);
    const e = g.run.enemies[g.run.enemies.length - 1];
    for (let i = 0; i < 15; i++) mod.onAntigenKill(g.run, e, null);
    g.finishRun(false);
    const meta = window.__IMUNVERSE.STATE.meta;
    return { records: meta.antigenRecords || null };
  });
  log('meta-antigen-records', !!rec.records && (rec.records.bakteri || 0) >= 1, JSON.stringify(rec.records));

  // ---- 8) flag OFF → sistem mati total ----
  const off = await page.evaluate(async () => {
    localStorage.setItem('imunverse.module.antigenMemory', '0');
    const mod = await import('/js/systems/antigen-memory.js');
    const g = window.__IMUNVERSE.game;
    g.startRun('macrophage');
    await new Promise((r) => setTimeout(r, 400));
    g.spawnEnemy('bakteri', false);
    const e = g.run.enemies[g.run.enemies.length - 1];
    for (let i = 0; i < 20; i++) mod.onAntigenKill(g.run, e, null);
    const mult = mod.antigenDamageMult(g.run, e);
    const near = mod.nearestThresholdType(g.run);
    localStorage.removeItem('imunverse.module.antigenMemory');
    return { mult, near, tiers: g.run.antigen.tiers };
  });
  log('flag-off-no-effect', off.mult === 1 && off.near === null && Object.keys(off.tiers).length === 0, JSON.stringify(off));

  log('zero-pageerror', errors.length === 0);
  if (errors.length) for (const e of errors.slice(0, 5)) log('err', e);
} catch (e) {
  log('suite-crash', false);
  console.error(e);
} finally {
  await browser.close();
}
