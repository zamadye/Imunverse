/**
 * e2e-v2phase1.mjs — V2 Phase 0 (metrics KPI) + Phase 1 (GAME FEEL).
 * Semua asersi terhadap kondisi runtime nyata di browser (bukan unit mock).
 * Jalankan: PW_PATH=/tmp/pw node scripts/e2e-v2phase1.mjs
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

  // ---- login pemain lama (akun e2e persist) ----
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
  log('dashboard-active', await active('#screen-dashboard'));

  // ---- Phase 1 pra-run: gamefeel.json termuat di data-store ----
  const gf = await page.evaluate(() => window.__IMUNVERSE.getData().gamefeel);
  log('gamefeel-loaded', !!gf && typeof gf.crit.chance === 'number' && typeof gf.hitStop.kill === 'number');
  log('gamefeel-values', `crit=${gf?.crit?.chance} killStop=${gf?.hitStop?.kill} kb=${gf?.knockback?.projectile}`);

  // reset metrics agar hitungan deterministik
  await page.evaluate(() => window.localStorage.removeItem('imunverse.metrics.v1'));

  // ---- mulai run #1 ----
// Stabilizer: mekanik diuji pada kepadatan rendah (sandbox CPU-render;
  // mitigasi flake frame-rate — perilaku gameplay tak berubah v2/fitur tetap)
  await page.evaluate(() => {
    const w = window.__IMUNVERSE.getData().waves;
    w.ecosystem = { ...w.ecosystem, targetBase: 12, targetMax: 40 };
    w.maxAliveEnemies = 60;
  });

    await page.click('#btn-play', { timeout: 8000, force: true });
  await page.waitForTimeout(600);
  if (await page.evaluate(() => document.querySelector('#screen-prep')?.classList.contains('active'))) {
    await page.locator('.prep-hero:not(.locked)').first().click({ timeout: 4000 }).catch(() => {});
    await page.click('#btn-prep-start', { timeout: 8000 });
  }
  for (let k = 0; k < 6; k++) {
    if (await page.locator('#cine-skip').isVisible().catch(() => false)) await page.click('#cine-skip');
    await page.waitForTimeout(600);
    if (await active('#screen-hud')) break;
  }
  log('hud-active', await active('#screen-hud'));

  // god mode supaya observasi tidak terganggu kematian
  await page.evaluate(() => { const p = window.__IMUNVERSE.game.run.player; p.maxHP = 50000; p.hp = 50000; p.iframes = 99999; });

  // F26: musuh menunggu di sarang jauh — tarik ke dekat player agar auto-attack
  // benar-benar menembak (feedback chain diuji lewat jalur combat NYATA).
  // hp: 'tank' = HP besar (uji knockback: musuh harus SELAMAT dari hit),
  //     'fragile' = HP 1 (uji kill feedback), null = apa adanya.
  const pullEnemies = (hpMode) => page.evaluate((mode) => {
    const g = window.__IMUNVERSE.game;
    const p = g.run.player;
    let n = 0;
    for (const e of g.run.enemies) {
      if (!e.alive || e.isBoss) continue;
      const a = Math.random() * Math.PI * 2;
      const d = 90 + Math.random() * 90;
      e.x = p.x + Math.cos(a) * d;
      e.y = p.y + Math.sin(a) * d;
      e.homeX = null; e.homeY = null; // lepaskan dari sarang → kejar player
      if (mode === 'tank') { e.maxHP = 99999; e.hp = 99999; }
      else if (mode === 'fragile') { e.hp = Math.min(e.hp, 1); }
      if (++n >= 14) break;
    }
    return n;
  }, hpMode || null);
  log('enemies-pulled', String(await pullEnemies('tank')));

  // ---- Phase 1: knockback — sampling e.vx/vy dari auto-attack nyata ----
  const kb = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    let maxV = 0;
    for (let i = 0; i < 240; i++) {
      for (const e of g.run.enemies) {
        if (e.alive && !e.isBoss) maxV = Math.max(maxV, Math.hypot(e.vx, e.vy));
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return maxV;
  });
  log('knockback-on-hit', kb > 30);
  log('knockback-maxV', kb.toFixed(1) + ' px/s');

  // ---- Phase 1: hit-stop on-kill + death pop — sampling saat kill bertambah ----
  await pullEnemies('fragile'); // musuh HP 1 → kill pasti terjadi saat sampling
  const killFeel = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    g.run.critChanceOverride = 0; // isolasi: hit-stop dari kill, bukan crit
    const startKills = g.run.kills;
    let sawStop = false, sawPop = false;
    for (let i = 0; i < 600 && !(sawStop && sawPop); i++) {
      if (g.run.kills > startKills && g.run.hitStop > 0) sawStop = true;
      if (g.run.effects.effects.some((fx) => fx.type === 'killpop')) sawPop = true;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { sawStop, sawPop, kills: g.run.kills - startKills };
  });
  log('hitstop-on-kill', killFeel.sawStop);
  log('deathpop-spawned', killFeel.sawPop);
  log('kills-observed', String(killFeel.kills));

  // ---- Phase 1: crit — override chance=1 → angka oranye & lebih besar ----
  await pullEnemies(); // pasok musuh segar untuk sampling angka
  const crit = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const gfl = window.__IMUNVERSE.getData().gamefeel;
    g.run.critChanceOverride = 1;
    let critNum = null, normalSize = null;
    for (let i = 0; i < 360 && !critNum; i++) {
      for (const n of g.run.effects.numbers) {
        if (n.color === gfl.crit.color) critNum = { size: n.size, color: n.color };
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    g.run.critChanceOverride = 0;
    for (let i = 0; i < 360 && normalSize === null; i++) {
      for (const n of g.run.effects.numbers) {
        if (n.color === '#ffffff') normalSize = n.size;
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    g.run.critChanceOverride = undefined;
    return { critNum, normalSize, base: gfl.damageNumber.base };
  });
  log('crit-number-color', !!crit.critNum);
  log('crit-number-bigger', !!crit.critNum && crit.critNum.size > (crit.normalSize ?? crit.base));
  log('number-sizes', `crit=${crit.critNum?.size} normal=${crit.normalSize}`);

  // ---- Phase 1: haptics guard tidak melempar error (headless) ----
  const hap = await page.evaluate(async () => {
    const mod = await import('/js/systems/haptics.js');
    try { const r = mod.buzz('kill'); return { ok: true, returned: typeof r === 'boolean' }; }
    catch (e) { return { ok: false, err: e.message }; }
  });
  log('haptics-guarded', hap.ok && hap.returned);

  await page.screenshot({ path: 'shots/review/v2p1-gamefeel.png' });

  // ---- Phase 0: akhiri run #1 (jalur finishRun nyata → emit gameover) ----
  await page.evaluate(() => window.__IMUNVERSE.game.finishRun(true));
  await page.waitForTimeout(900);
  log('gameover-active', await active('#screen-gameover'));
  const m1 = await page.evaluate(() => JSON.parse(window.localStorage.getItem('imunverse.metrics.v1') || 'null'));
  log('metrics-run-recorded', !!m1 && m1.runs.length === 1 && m1.runs[0].retryOf === null);
  log('metrics-fields', m1 ? `hero=${m1.runs[0].hero} wave=${m1.runs[0].wave} quit=${m1.runs[0].quit}` : 'null');

  // ---- Phase 0: "satu run lagi" via tombol Main Lagi → retryOf terisi ----
  await page.click('#btn-retry', { timeout: 6000, force: true });
  await page.waitForTimeout(1200);
  for (let k = 0; k < 4; k++) {
    if (await page.locator('#cine-skip').isVisible().catch(() => false)) await page.click('#cine-skip');
    await page.waitForTimeout(500);
    if (await active('#screen-hud')) break;
  }
  log('retry-hud-active', await active('#screen-hud'));
  await page.evaluate(() => window.__IMUNVERSE.game.finishRun(true));
  await page.waitForTimeout(900);
  const m2 = await page.evaluate(() => JSON.parse(window.localStorage.getItem('imunverse.metrics.v1') || 'null'));
  log('metrics-retry-marked', !!m2 && m2.runs.length === 2 && m2.runs[1].retryOf !== null);

  // ---- Phase 0: getMetricsSummary dari modul yang sama ----
  const summary = await page.evaluate(async () => {
    const mod = await import('/js/systems/metrics.js');
    return mod.getMetricsSummary();
  });
  log('metrics-summary', summary.runs === 2 && summary.oneMoreRunRate === 1);
  log('summary-values', JSON.stringify(summary));

  await page.screenshot({ path: 'shots/review/v2p1-metrics-gameover.png' });

  log('zero-pageerror', errors.length === 0);
  if (errors.length) for (const e of errors.slice(0, 6)) log('err', e);
} catch (e) {
  log('suite-crash', false);
  console.error(e);
} finally {
  await browser.close();
}
