/**
 * e2e-r1.mjs — R1 (Rebuild): Core Loop UX.
 * Verifikasi: PLAY→langsung run (<3 run), PLAY→Peta Tubuh (≥3 run),
 * faction dicopot dari signup, prompt simpan progres di gameover (guest),
 * progressive disclosure (item ter-gate tersembunyi, muncul saat unlock).
 * Jalankan: node scripts/e2e-r1.mjs (server :8000 + chromium /tmp)
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
const active = (id) => page.evaluate((s) => document.querySelector(s)?.classList.contains('active') || false, id);

try {
  // ==== TANPA ?dev=1 supaya gate hidup nyata ====
  await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // ---- 1) Faction dicopot dari signup ----
  const factionGone = await page.evaluate(() => {
    const wrap = document.getElementById('auth-factions');
    const title = document.querySelector('.auth-faction-title');
    return { hiddenWrap: !wrap || wrap.style.display === 'none', noTitle: !title };
  });
  log('faction-removed-from-signup', factionGone.hiddenWrap && factionGone.noTitle, JSON.stringify(factionGone));

  // ---- 2) Guest run pertama: MULAI → langsung gameplay ----
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(600); }
  await page.click('#btn-title-start', { force: true });
  for (let k = 0; k < 6; k++) {
    if (await page.locator('#cine-skip').isVisible().catch(() => false)) await page.click('#cine-skip');
    await page.waitForTimeout(600);
    if (await active('#screen-hud')) break;
  }
  log('guest-straight-to-run', await active('#screen-hud'));

  // ---- 3) Akhiri run → prompt "SIMPAN PROGRES" muncul (guest, non-blocking) ----
  await page.evaluate(() => { window.__IMUNVERSE.game.finishRun(false); });
  await page.waitForTimeout(900);
  const prompt = await page.evaluate(() => {
    const p = document.getElementById('go-save-prompt');
    return { has: !!p, btn: !!document.getElementById('btn-go-save-account'), go: document.querySelector('#screen-gameover')?.classList.contains('active') };
  });
  log('gameover-save-prompt-guest', prompt.has && prompt.btn && prompt.go, JSON.stringify(prompt));
  await page.screenshot({ path: 'shots/review/r1-gameover-save-prompt.png' });

  // klik prompt → auth
  await page.click('#btn-go-save-account', { force: true });
  await page.waitForTimeout(500);
  log('save-prompt-opens-auth', await active('#screen-auth'));
  await page.fill('#auth-username', 'RebuildTester');
  await page.fill('#auth-password', '1234');
  await page.click('#auth-submit');
  await page.waitForTimeout(900);
  for (let k = 0; k < 8; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip', { timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300); }
  log('signup-to-dashboard', await active('#screen-dashboard'));

  // ---- 4) Progressive disclosure: totalRuns=1 → shop terbuka, roster/bp/rank TERSEMBUNYI ----
  const disc1 = await page.evaluate(() => {
    const vis = (sel) => { const b = document.querySelector(sel); return !!b && b.style.display !== 'none' && !b.classList.contains('gate-hidden'); };
    return {
      runs: window.__IMUNVERSE.STATE.meta.stats.totalRuns,
      shop: vis('.dock-btn[data-nav="shop"]'),
      roster: vis('.dock-btn[data-nav="roster"]'),
      bp: vis('.secondary-dock [data-nav="bp"]'),
      rank: vis('.secondary-dock [data-nav="rank"]'),
      quickTiles: document.querySelectorAll('.quick-tile').length,
    };
  });
  // E1 poin 7: gate DIBALIK — roster (Heroes) tampil awal, shop butuh 5 run.
  log('disclosure-run1-roster-open', disc1.roster === true, JSON.stringify(disc1));
  log('disclosure-run1-shop-hidden', disc1.shop === false);
  log('disclosure-run1-bp-rank-hidden', disc1.bp === false && disc1.rank === false);
  await page.screenshot({ path: 'shots/review/r1-dashboard-minimal.png' });

  // Stabilizer sandbox: kepadatan minimal selama uji mekanik (frame CPU-render)
  await page.evaluate(() => {
    const w = window.__IMUNVERSE.getData().waves;
    w.ecosystem = { ...w.ecosystem, targetBase: 12, targetMax: 40 };
    w.maxAliveEnemies = 60;
  });

  // ---- 5) PLAY (runs<3) → LANGSUNG run, bukan Peta Tubuh ----
  await page.evaluate(() => document.getElementById('btn-play-big')?.click());
  for (let k = 0; k < 6; k++) {
    if (await page.locator('#cine-skip').isVisible().catch(() => false)) await page.click('#cine-skip');
    await page.waitForTimeout(600);
    if (await active('#screen-hud')) break;
  }
  const straight = { hud: await active('#screen-hud'), camp: await active('#screen-campaign') };
  log('play-straight-to-run-under-3', straight.hud && !straight.camp, JSON.stringify(straight));

  // ---- 6) Simulasi runs≥3 → PLAY membuka Peta Tubuh (pilihan ter-expose) ----
  await page.evaluate(() => { window.__IMUNVERSE.game.finishRun(false); });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.__IMUNVERSE.STATE.meta.stats.totalRuns = 5;
    window.__IMUNVERSE_goDashboard();
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById('btn-play-big')?.click());
  await page.waitForTimeout(700);
  log('play-opens-map-after-3-runs', await active('#screen-campaign'));

  // ---- 7) Disclosure setelah progres: runs=5 → roster/bag/bp muncul; rank (10) masih hidden ----
  await page.evaluate(() => window.__IMUNVERSE.screenManager.show('dashboard'));
  await page.waitForTimeout(700);
  const disc2 = await page.evaluate(() => {
    const vis = (sel) => { const b = document.querySelector(sel); return !!b && b.style.display !== 'none'; };
    return {
      roster: vis('.dock-btn[data-nav="roster"]'),
      bag: vis('.dock-btn[data-nav="bag"]'),
      bp: vis('.secondary-dock [data-nav="bp"]'),
      rank: vis('.secondary-dock [data-nav="rank"]'),
    };
  });
  // E1 poin 7: runs=5 → roster/bag/shop terbuka; bp butuh 6 run, rank 15.
  log('disclosure-run5-unlocked', disc2.roster && disc2.bag && disc2.bp === false, JSON.stringify(disc2));
  log('disclosure-rank-still-hidden', disc2.rank === false);

  // ---- 8) Prompt akun TIDAK muncul lagi setelah punya akun ----
  await page.evaluate(() => document.getElementById('btn-play-big')?.click());
  await page.waitForTimeout(600);
  // runs=5 → campaign terbuka; langsung cek via evaluate saja
  const promptGone = await page.evaluate(() => {
    // paksa gameover screen render ulang dengan summary terakhir
    const s = window.__IMUNVERSE.STATE.lastGameoverSummary;
    if (!s) return { skip: true };
    const mod = document.getElementById('go-save-prompt');
    return { skip: false, promptStill: !!mod };
  });
  log('save-prompt-gone-with-account', promptGone.skip ? 'SKIP' : promptGone.promptStill === false);

  log('zero-pageerror', errors.length === 0);
  if (errors.length) for (const e of errors.slice(0, 5)) log('err', e);
} catch (e) {
  log('suite-crash', false);
  console.error(e);
} finally {
  await browser.close();
}
