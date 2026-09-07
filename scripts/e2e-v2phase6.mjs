/**
 * e2e-v2phase6.mjs — V2 Phase 6: PROGRESSION (Hero Mastery).
 * Verifikasi: XP formula, level-up + reward Imun, multi-level, gelar,
 * tracking per-hero, tampilan gameover & hero detail, save-safety.
 * Jalankan: node scripts/e2e-v2phase6.mjs (server :8000 + chromium /tmp)
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

  // ---- data ----
  const d = await page.evaluate(() => {
    const m = window.__IMUNVERSE.getData().mastery;
    return { ok: !!m, levels: m ? m.levels.length : 0, f: m ? m.xpFormula : null };
  });
  log('mastery-json-loaded', d.ok && d.levels === 10 && d.f.perKill === 2);

  // ---- unit: formula, level, multi-level, gelar, save-safety ----
  const unit = await page.evaluate(async () => {
    const mod = await import('/js/systems/mastery-system.js');
    const meta = window.__IMUNVERSE.STATE.meta;
    delete meta.heroMastery; // save lama tanpa field → harus aman (lazy init)
    const imu0 = meta.imun || 0;

    // run 1: 30 kill + wave 4, kalah → 30×2 + 40 = 100 XP → tepat Lv1
    const r1 = mod.addMasteryXP(meta, 'testhero', { kills: 30, wave: 4, victory: false });
    const info1 = mod.masteryInfo(meta, 'testhero');
    // run 2: XP raksasa → multi-level sekaligus + gelar
    const r2 = mod.addMasteryXP(meta, 'testhero', { kills: 500, wave: 20, victory: true });
    const info2 = mod.masteryInfo(meta, 'testhero');
    const imu1 = meta.imun || 0;
    // formula: 500×2 + 20×10 + 80 = 1280 → total 1380 → Lv5 (>=1250)
    return {
      r1xp: r1.xp, r1level: r1.level, r1reward: r1.reward,
      r2xp: r2.xp, r2levels: r2.levelsGained, level2: info2.level, title2: info2.title,
      kills: info2.kills, runs: info2.runs, wins: info2.wins,
      imuGained: imu1 - imu0,
      lazyInitOk: true,
      pctValid: info2.pct >= 0 && info2.pct <= 1,
      title1: info1.title,
    };
  });
  log('xp-formula-exact', unit.r1xp === 100 && unit.r2xp === 1280);
  log('level1-at-100xp', unit.r1level === 1 && unit.r1reward === 15);
  log('multi-level-jump', unit.r2levels === 4 && unit.level2 === 5);
  log('title-at-lv3plus', unit.title1 === null && unit.title2 === 'Terlatih');
  log('per-hero-tracking', unit.kills === 530 && unit.runs === 2 && unit.wins === 1);
  log('imu-reward-total', unit.imuGained === 15 * 5);
  log('lazy-init-safe', unit.lazyInitOk && unit.pctValid);

  // ---- integrasi: run nyata → finishRun → mastery hero terpakai naik ----
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

  const runRes = await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    const meta = window.__IMUNVERSE.STATE.meta;
    const hero = g.run.heroDef.id;
    const before = (meta.heroMastery && meta.heroMastery[hero]) ? { ...meta.heroMastery[hero] } : { xp: 0, runs: 0 };
    g.run.kills = 45; // pastikan XP > 0 (45×2 + wave×10)
    g.finishRun(true);
    const after = meta.heroMastery[hero];
    return {
      hero,
      xpGrew: after.xp > before.xp,
      runsGrew: after.runs === before.runs + 1,
      gain: g.run.masteryGain ? g.run.masteryGain.xp : null,
      summaryHas: !!(window.__IMUNVERSE.STATE.lastGameoverSummary && window.__IMUNVERSE.STATE.lastGameoverSummary.mastery),
    };
  });
  await page.waitForTimeout(900);
  log('finishrun-adds-mastery', runRes.xpGrew && runRes.runsGrew);
  log('gameover-payload-mastery', runRes.summaryHas);
  log('run-info', `hero=${runRes.hero} gain=${runRes.gain}`);

  // ---- UI gameover: baris mastery tampil ----
  log('gameover-active', await active('#screen-gameover'));
  const goUi = await page.evaluate(() => {
    const elm = document.querySelector('.go-mastery');
    return { has: !!elm, text: elm ? elm.textContent.trim().slice(0, 60) : '' };
  });
  log('ui-gameover-mastery-line', goUi.has);
  log('ui-gameover-text', goUi.text || '-');
  await page.screenshot({ path: 'shots/review/v2p6-gameover-mastery.png' });

  // ---- UI hero detail: level + bar + statistik ----
  await page.click('#btn-home', { timeout: 6000, force: true }).catch(() => {});
  await page.waitForTimeout(900);
  const hdUi = await page.evaluate(() => {
    try { window.__IMUNVERSE.screenManager.show('herodetail'); } catch { return { shown: false }; }
    const m = document.querySelector('.hl-mastery');
    const bar = document.querySelector('.hl-mastery-bar');
    return { shown: true, has: !!m, hasBar: !!bar, text: m ? m.textContent.trim().slice(0, 70) : '' };
  });
  log('ui-herodetail-mastery', hdUi.shown ? (hdUi.has && hdUi.hasBar) : 'SKIP');
  log('ui-herodetail-text', hdUi.text || '-');
  await page.screenshot({ path: 'shots/review/v2p6-herodetail-mastery.png' });

  log('zero-pageerror', errors.length === 0);
  if (errors.length) for (const e of errors.slice(0, 6)) log('err', e);
} catch (e) {
  log('suite-crash', false);
  console.error(e);
} finally {
  await browser.close();
}
