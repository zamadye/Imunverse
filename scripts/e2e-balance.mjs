/**
 * e2e-balance.mjs — Fase 20: REBALANCE (feedback pemilik).
 * 1) Naik level TIDAK instan (kurva XP berat — L2 ±280 XP ≈ menit, bukan detik)
 * 2) Imun Coin langka: kill biasa = 0 IMU; IMU dari boss & menang
 * 3) Tier hero sejak awal (common–legend), statMult ikut tier, badge di roster
 * 4) Jumlah pasukan bertambah mengikuti level pasukan
 * 5) Dashboard tile kompak (tidak bertumpuk) + tombol hasil run terlihat
 * Akun khusus: BalanceTester.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require('/tmp/pw/node_modules/playwright-core');

const results = [];
function log(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`);
}

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).split('\n')[0]));

try {
  await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2400);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip', { timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400); }
  await page.fill('#auth-username', 'BalanceTester');
  await page.fill('#auth-password', '1234');
  await page.click('#auth-submit');
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
  for (let k = 0; k < 8; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip', { timeout: 1200 }).catch(() => {}); await page.waitForTimeout(250); }
  await page.waitForTimeout(500);

  // ---- 1) Kurva XP dari data & terasa berat ----
  const curve = await page.evaluate(() => {
    const { base, exponent } = window.__IMUNVERSE.getData().upgrades.xpCurve;
    const need = (lvl) => Math.ceil(base * Math.pow(lvl, exponent));
    return { base, exponent, l1: need(1), l2: need(2), l5: need(5), l10: need(10) };
  });
  log('xp-curve-from-data', curve.l1 === 280 && curve.l2 === 383 && curve.l5 === 578, JSON.stringify(curve));
  log('xp-l2-not-trivial', curve.l2 >= 250, `L2=${curve.l2} (≈ ${(curve.l2 / 9).toFixed(0)}+ kill kecil)`);

  // Run nyata: XP sebanyak ±15 kill kecil TIDAK menaikkan level
  const playRun = async () => {
    await page.evaluate(() => { const sc = document.querySelector('.dash-scroll'); if (sc) sc.scrollTop = 0; });
    await page.click('#btn-play-big');
    await page.waitForTimeout(700);
    await page.locator('.camp-node:not(.locked)').first().click();
    await page.waitForTimeout(400);
    await page.click('#btn-campaign-go', { timeout: 8000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('.prep-start')?.scrollIntoView({ block: 'center' }));
    await page.click('#btn-prep-start', { timeout: 8000 });
    await page.waitForTimeout(900);
    for (let k = 0; k < 4; k++) { if (!(await page.locator('#cine-skip').isVisible().catch(() => false))) break; await page.click('#cine-skip'); await page.waitForTimeout(350); }
    await page.waitForFunction(() => document.querySelector('#screen-hud')?.classList.contains('active'), null, { timeout: 15000 });
    await page.waitForTimeout(1000);
    const tut = page.locator('.tut-skip');
    if (await tut.isVisible().catch(() => false)) { await tut.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400); }
  };
  await playRun();
  const slowLevel = await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    const lvl0 = g.run.level;
    g.addXP(100); // jalur riil (setara ±15 kill kecil — bukan "instan")
    return { lvl0, lvl1: g.run.level, xp: Math.round(g.run.xp * 10) / 10 };
  });
  log('no-instant-level', slowLevel.lvl1 === slowLevel.lvl0, JSON.stringify(slowLevel));

  // ---- 2) IMU langka ----
  const imuRules = await page.evaluate(() => {
    const { imuForRun } = window.__IMUNVERSE; // tidak terekspos? fallback import tidak mungkin — hitung via modul sistem di jendela
    return null;
  });
  const imuCalc = await page.evaluate(async () => {
    const mod = await import('/js/systems/retention-system.js');
    return {
      plain: mod.imuForRun(9, 120, 0, false),
      boss: mod.imuForRun(9, 0, 3, false),
      victory: mod.imuForRun(9, 0, 0, true),
      both: mod.imuForRun(12, 200, 2, true),
    };
  });
  log('imu-zero-for-plain-kills', imuCalc.plain === 0, JSON.stringify(imuCalc));
  log('imu-from-boss-and-victory', imuCalc.boss === 60 && imuCalc.victory === 50 && imuCalc.both === 90, JSON.stringify(imuCalc));

  // ---- akhiri run (tumbang → revive skip) untuk lanjut di dashboard ----
  const closeLU = async () => {
    for (let k = 0; k < 12; k++) {
      const open = await page.evaluate(() => document.querySelector('#screen-levelup')?.classList.contains('active'));
      if (!open) break;
      await page.locator('#levelup-choices .choice-card').first().click({ force: true, timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(450);
    }
  };
  for (let k = 0; k < 14; k++) {
    if (await page.locator('#screen-revive.active').isVisible().catch(() => false)) break;
    if (await page.evaluate(() => window.__IMUNVERSE.game.run && window.__IMUNVERSE.game.run.ended)) break;
    await closeLU();
    await page.evaluate(() => { const g = window.__IMUNVERSE.game; const p = g.run.player; p.iframes = 0; p.takeDamage(p.hp + 10); });
    await page.waitForTimeout(700);
  }
  if (await page.locator('#screen-revive.active').isVisible().catch(() => false)) { await page.click('#btn-skip-revive', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700); }
  if (!(await page.evaluate(() => document.querySelector('#screen-gameover')?.classList.contains('active')))) {
    await closeLU();
    await page.click('#btn-pause', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.click('#btn-quit-run', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  await page.waitForFunction(() => document.querySelector('#screen-gameover')?.classList.contains('active'), null, { timeout: 8000 });
  await page.waitForTimeout(500);

  // ---- 5b) tombol hasil run TERLIHAT penuh di viewport (feedback #2) ----
  const goVis = await page.evaluate(() => {
    const H = window.innerHeight;
    const vis = (id) => {
      const e = document.getElementById(id);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), inside: r.top >= 0 && r.bottom <= H + 1 };
    };
    return { home: vis('btn-home'), retry: vis('btn-retry'), dbl: vis('btn-double-currency'), vh: H };
  });
  log('gameover-buttons-visible', !!(goVis.home && goVis.home.inside && goVis.retry && goVis.retry.inside), JSON.stringify(goVis));
  await page.click('#btn-home', { timeout: 4000 });
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
  await page.waitForTimeout(500);

  // ---- 3) Tier hero sejak awal ----
  const tiers = await page.evaluate(() => {
    const d = window.__IMUNVERSE.getData();
    const heroes = d.heroes.heroes;
    const tierTable = d.heroes.tiers || {};
    return {
      count: heroes.length,
      allTiers: heroes.every((h) => tierTable[h.tier]),
      legendNyx: heroes.find((h) => h.id === 'nkcell')?.tier,
      starterMako: heroes.find((h) => h.id === 'macrophage')?.tier,
      multLegend: tierTable.legend?.statMult,
      multCommon: tierTable.common?.statMult,
    };
  });
  log('tier-table-complete', tiers.count === 11 && tiers.allTiers && tiers.legendNyx === 'legend' && tiers.starterMako === 'common', JSON.stringify(tiers));

  // statMult benar-benar diterapkan di statistik (bandingkan Mako common vs Nyx legend)
  const tierStat = await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    const d = window.__IMUNVERSE.getData();
    const mako = d.heroes.heroes.find((h) => h.id === 'macrophage');
    const nyx = d.heroes.heroes.find((h) => h.id === 'nkcell');
    const sCommon = g.computePlayerStats(mako, {});
    const sLegend = g.computePlayerStats(nyx, {});
    return {
      dmgCommon: sCommon.damage, dmgLegend: sLegend.damage,
      ratio: sLegend.damage / sCommon.damage,
      expected: (nyx.baseStats.damage * d.heroes.tiers.legend.statMult) / (mako.baseStats.damage * d.heroes.tiers.common.statMult),
    };
  });
  log('tier-statmult-applied', Math.abs(tierStat.ratio - tierStat.expected) < 0.02 && tierStat.dmgLegend > tierStat.dmgCommon, JSON.stringify({ ratio: Math.round(tierStat.ratio * 100) / 100, expected: Math.round(tierStat.expected * 100) / 100 }));

  // badge tier dirender di roster (klik riil dock Heroes)
  await page.click('.dock-btn[data-nav="roster"]', { timeout: 4000 });
  await page.waitForTimeout(600);
  const badges = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.hero-card .tier-badge')];
    return { n: b.length, sample: b.slice(0, 3).map((x) => x.textContent) };
  });
  log('tier-badges-in-roster', badges.n === 11, JSON.stringify(badges));
  await page.evaluate(() => window.__IMUNVERSE.screenManager.show('dashboard'));
  await page.waitForTimeout(400);

  // ---- 4) Pasukan bertambah mengikuti level pasukan ----
  await page.evaluate(() => { window.__IMUNVERSE.STATE.meta.allyLevel = 6; }); // setup: 1+floor(6/3)=3 anggota
  await playRun();
  const allies = await page.evaluate(() => window.__IMUNVERSE.game.run.allies.length);
  log('allies-grow-with-level', allies === 3, `allies=${allies} (allyLevel=6)`);

  // ---- 5c) tile dashboard kompak, tidak menimpa play-row ----
  await page.evaluate(() => { const g = window.__IMUNVERSE.game; if (g.run && !g.run.ended) { g.finishRun(true); } });
  await page.waitForFunction(() => document.querySelector('#screen-gameover')?.classList.contains('active'), null, { timeout: 8000 });
  await page.click('#btn-home', { timeout: 4000 });
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
  await page.waitForTimeout(600);
  const layout = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#quick-row .quick-tile')];
    const maxH = Math.max(...tiles.map((t) => t.getBoundingClientRect().height));
    const qr = document.getElementById('quick-row').getBoundingClientRect();
    const pr = document.querySelector('.play-row').getBoundingClientRect();
    const overlap = !(qr.left >= pr.right - 1 || qr.right <= pr.left + 1 || qr.top >= pr.bottom - 1 || qr.bottom <= pr.top + 1);
    return { tiles: tiles.length, maxH: Math.round(maxH), overlap };
  });
  log('tiles-compact', layout.tiles === 6 && layout.maxH <= 110, JSON.stringify(layout));
  log('tiles-no-overlap-playrow', !layout.overlap, JSON.stringify(layout));

  log('no-pageerrors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  await page.screenshot({ path: '/tmp/fail-balance.png' });
  console.log('FATAL', e.message.split('\n')[0]);
  try {
    console.log('STATE:', await page.evaluate(() => JSON.stringify({
      active: [...document.querySelectorAll('.screen.active')].map((s) => s.id),
      screen: window.__IMUNVERSE?.STATE?.screen,
    })));
  } catch (pe) { console.log('state-err', pe.message.split('\n')[0]); }
  console.log('ERRORS:', errors.slice(0, 8).join(' | '));
}
const pass = results.filter((r) => r.ok).length;
console.log(`RESULT: ${pass} PASS, ${results.length - pass} FAIL`);
await browser.close();
process.exit(pass === results.length ? 0 : 1);
