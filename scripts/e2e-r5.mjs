/**
 * e2e-r5.mjs — R5 (Rebuild): Modul C — Inflammation Zone.
 * Verifikasi: formula intensity t^1.2, telegraph kuning→merah, spawn zona dari
 * skill area, DoT musuh dalam radius saja, cytokine storm (dmg musuh + splash
 * hero bila di dalam / aman di luar), cap maxZones, telemetry, flag OFF.
 * Jalankan: node scripts/e2e-r5.mjs
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

  const flag = await page.evaluate(() => window.__IMUNVERSE.getData().modules.modules.inflammationZone.enabled);
  log('module-c-enabled', flag === true);

  // ---- 1) formula intensity t^1.2 + warna telegraph kuning→merah ----
  const formula = await page.evaluate(async () => {
    const mod = await import('/js/systems/inflammation.js');
    const cfg = { baseRate: 2, intensityExp: 1.2, stormThreshold: 8 };
    const z = { spawnTime: 0, maxIntensity: 10 };
    return {
      i2: mod.inflamIntensity(z, 2, cfg),                 // 2·2^1.2 ≈ 4.595
      iCap: mod.inflamIntensity(z, 100, cfg),             // plafon 10
      colCold: mod.inflamColor(0),                        // kuning #ffd93d
      colHot: mod.inflamColor(1),                         // merah #ff5d73
      heatMid: mod.inflamHeat(z, 2, cfg),                 // 4.595/8 ≈ 0.574
    };
  });
  log('intensity-t-pow-1.2', Math.abs(formula.i2 - 2 * Math.pow(2, 1.2)) < 1e-6 && formula.iCap === 10, JSON.stringify(formula));
  log('telegraph-yellow-to-red', formula.colCold === 'rgb(255,217,61)' && formula.colHot === 'rgb(255,93,115)' && Math.abs(formula.heatMid - formula.i2 / 8) < 1e-6);

  // Neutrophil punya grenade (skill area slot 0)
  await page.evaluate(() => window.__IMUNVERSE.game.startRun('neutrophil'));
  await page.waitForTimeout(900);

  // ---- 2) skill area men-spawn zona inflamasi ----
  const spawn = await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    const before = g.run.inflamZones.length;
    const ok = g.useAbilityBySlot(0); // grenade (kind 'area')
    const after = g.run.inflamZones.length;
    const z = g.run.inflamZones[after - 1];
    return { ok, before, after, radius: z ? z.radius : 0, storm: z ? z.stormTriggered : null };
  });
  log('area-skill-spawns-zone', spawn.ok === true && spawn.after === spawn.before + 1 && spawn.radius > 0 && spawn.storm === false, JSON.stringify(spawn));

  // ---- 3) DoT kena musuh DI DALAM radius, TIDAK yang di luar ----
  const dot = await page.evaluate(async () => {
    const mod = await import('/js/systems/inflammation.js');
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    run.inflamZones.length = 0; // bersihkan zona uji sebelumnya
    const mk = (x, y) => {
      g.spawnEnemy('bakteri', false);
      const e = run.enemies[run.enemies.length - 1];
      e.x = x; e.y = y; e.hp = e.maxHP = 100000; e.armorLayers = 0; e.frozen = 999;
      return e;
    };
    const zx = run.player.x + 400, zy = run.player.y; // jauh dari hero
    const inside = mk(zx + 10, zy);
    const outside = mk(zx + 600, zy);
    mod.spawnInflamZone(g, zx, zy, 90);
    const h0in = inside.hp, h0out = outside.hp;
    await new Promise((r) => setTimeout(r, 1300)); // ≥2 tick DoT (0.5s/tick)
    return { dIn: h0in - inside.hp, dOut: h0out - outside.hp, zones: run.inflamZones.length };
  });
  log('dot-hits-inside-only', dot.dIn > 0 && dot.dOut === 0, JSON.stringify(dot));

  // ---- 4) cytokine storm di threshold: dmg besar musuh + zona lenyap; hero DI LUAR aman ----
  const storm = await page.evaluate(async () => {
    const mod = await import('/js/systems/inflammation.js');
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    run.inflamZones.length = 0;
    g.spawnEnemy('bakteri', false);
    const e = run.enemies[run.enemies.length - 1];
    const zx = run.player.x + 500, zy = run.player.y;
    e.x = zx; e.y = zy; e.hp = e.maxHP = 100000; e.armorLayers = 0; e.frozen = 999;
    const z = mod.spawnInflamZone(g, zx, zy, 90);
    z.spawnTime = run.time - 100; // paksa intensity ≥ threshold frame berikut
    const hpHero0 = run.player.hp;
    const hpE0 = e.hp;
    await new Promise((r) => setTimeout(r, 350));
    const stormDmgMin = Math.round(run.player.stats.damage * 2.5) - 2; // ±rounding
    return {
      eDrop: hpE0 - e.hp, stormDmgMin, zoneGone: run.inflamZones.length === 0,
      heroDrop: hpHero0 - run.player.hp,
    };
  });
  log('storm-damages-enemies', storm.eDrop >= storm.stormDmgMin && storm.zoneGone === true, JSON.stringify(storm));
  log('hero-safe-outside-zone', storm.heroDrop <= 0);

  // ---- 5) hero DI DALAM zona saat storm → splash damage ----
  const splash = await page.evaluate(async () => {
    const mod = await import('/js/systems/inflammation.js');
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    run.inflamZones.length = 0;
    run.player.iframes = 0; run.shield = 0;
    const z = mod.spawnInflamZone(g, run.player.x, run.player.y, 90);
    z.spawnTime = run.time - 100;
    const hp0 = run.player.hp;
    await new Promise((r) => setTimeout(r, 350));
    return { drop: hp0 - run.player.hp, zoneGone: run.inflamZones.length === 0 };
  });
  log('hero-splash-inside-zone', splash.drop > 0 && splash.zoneGone === true, JSON.stringify(splash));

  // ---- 6) cap maxZones: zona tertua dibuang ----
  const cap = await page.evaluate(async () => {
    const mod = await import('/js/systems/inflammation.js');
    const g = window.__IMUNVERSE.game;
    g.run.inflamZones.length = 0;
    const ids = [];
    for (let i = 0; i < 5; i++) {
      const z = mod.spawnInflamZone(g, g.run.player.x + 800 + i * 40, g.run.player.y, 60);
      ids.push(z.id);
    }
    const kept = g.run.inflamZones.map((z) => z.id);
    return { n: kept.length, oldestDropped: !kept.includes(ids[0]) && !kept.includes(ids[1]), newestKept: kept.includes(ids[4]) };
  });
  log('max-zones-cap-3', cap.n === 3 && cap.oldestDropped === true && cap.newestKept === true, JSON.stringify(cap));

  // ---- 7) telemetry module_trigger per storm ----
  const tel = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('imunverse.metrics.v1') || '{}');
    const ev = (db.moduleEvents || []).filter((e) => e.moduleId === 'inflammationZone');
    return { n: ev.length, sample: ev[0] || null };
  });
  log('telemetry-inflam', tel.n >= 1, `n=${tel.n}`);

  // ---- 8) screenshot bukti: zona panas + telegraph ----
  await page.evaluate(async () => {
    const mod = await import('/js/systems/inflammation.js');
    const g = window.__IMUNVERSE.game;
    g.run.inflamZones.length = 0;
    const z = mod.spawnInflamZone(g, g.run.player.x + 120, g.run.player.y, 100);
    z.spawnTime = g.run.time - 2.6; // heat ~0.8 → oranye-merah, pulsa cepat
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'shots/review/r5-inflam-zone.png' });
  log('screenshot-saved', true, 'shots/review/r5-inflam-zone.png');

  // ---- 9) flag OFF: skill area TIDAK membuat zona, spawn manual null ----
  await page.evaluate(() => localStorage.setItem('imunverse.module.inflammationZone', '0'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }
  const off = await page.evaluate(async () => {
    const mod = await import('/js/systems/inflammation.js');
    const g = window.__IMUNVERSE.game;
    g.startRun('neutrophil');
    await new Promise((r) => setTimeout(r, 700));
    const used = g.useAbilityBySlot(0); // grenade tetap jalan (dmg area lama)
    const zones = g.run.inflamZones.length;
    const manual = mod.spawnInflamZone(g, g.run.player.x, g.run.player.y, 90);
    return { used, zones, manualNull: manual === null };
  });
  log('flag-off-dead', off.used === true && off.zones === 0 && off.manualNull === true, JSON.stringify(off));
  await page.evaluate(() => localStorage.removeItem('imunverse.module.inflammationZone'));

  log('zero-pageerror', errors.length === 0, errors.join(' | '));
} catch (err) {
  console.log('FAIL suite-crash', err.message);
} finally {
  await browser.close();
}
