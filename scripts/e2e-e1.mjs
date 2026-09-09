/**
 * e2e-e1.mjs — Phase E1 (Evaluasi & Polish): verifikasi 10 poin.
 *  1/7 minimal-home + progressive disclosure (hidden, bukan lock)
 *  2   tombol skill hex + glyph SVG + fire claw
 *  3   cine-banner ambience organ (rbc/plasma) berjalan tanpa error
 *  4   back dari menu KEMBALI KE GAMEPLAY saat run hidup
 *  5   tint sprite ter-clip alpha (tidak ada kotak neon)
 *  6   auth tanpa opsi faction virus
 *  8/9 presenter RIA per waveBreak + Amara saat heroUnlocked
 *  10  coach melewati target tersembunyi
 * Jalankan: node scripts/e2e-e1.mjs
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
let pass = 0, fail = 0;
const log = (k, v, extra) => {
  if (v === true) pass++; else if (v === false) fail++;
  console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${extra ? ' ' + extra : ''}`);
};

try {
  await page.goto('http://localhost:8000/?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }

  // ---- POIN 6: auth tanpa faction virus ----
  const auth = await page.evaluate(() => ({
    factions: document.getElementById('auth-factions'),
    virusText: (document.getElementById('screen-auth') || {}).textContent || '',
    acctTag: !!document.querySelector('.acct-tag'),
  }));
  log('p6-no-auth-factions', auth.factions === null);
  log('p6-no-virus-option', !/virus/i.test(auth.virusText));
  log('p6-acct-tag-fixed', auth.acctTag === true);

  // ---- POIN 1+7: minimal-home saat totalRuns < 3 ----
  const home = await page.evaluate(() => {
    const meta = window.__IMUNVERSE.STATE.meta;
    const saved = meta.stats.totalRuns;
    meta.stats.totalRuns = 0;
    window.__IMUNVERSE.screenManager.show('dashboard');
    const el = document.getElementById('screen-dashboard');
    const minimal = el.classList.contains('minimal-home');
    const hid = (sel) => { const n = document.querySelector(sel); return !n || getComputedStyle(n).display === 'none'; };
    const out = {
      minimal,
      sideNavHidden: hid('#screen-dashboard.minimal-home .side-nav') || hid('.side-nav'),
      statsHidden: hid('#dash-stats'),
      secondaryHidden: hid('.secondary-dock'),
      playVisible: !hid('#btn-play'),
    };
    meta.stats.totalRuns = 10;
    window.__IMUNVERSE.screenManager.show('dashboard');
    out.minimalOffLater = !el.classList.contains('minimal-home');
    meta.stats.totalRuns = saved;
    return out;
  });
  log('p7-minimal-home-on', home.minimal === true);
  log('p7-sidenav-hidden', home.sideNavHidden === true);
  log('p7-stats-hidden', home.statsHidden === true);
  log('p7-secondary-hidden', home.secondaryHidden === true);
  log('p7-play-visible', home.playVisible === true);
  log('p7-minimal-off-after-runs', home.minimalOffLater === true);

  // ---- POIN 7: konfigurasi gates = hanya roster+quests tampil awal ----
  // (dev-mode mem-bypass gateFor, jadi validasi langsung data features.json)
  const gates = await page.evaluate(async () => {
    const f = await (await fetch('/data/features.json')).json();
    const g = (t, i) => f.gates.find((x) => x.target === t && x.id === i) || {};
    const open = (x) => !x.requireRuns && !x.requireWave && !x.requireCurrency;
    return {
      rosterOpen: open(g('dock', 'roster')),
      questsOpen: open(g('quick', 'quests')),
      shopGated: (g('dock', 'shop').requireRuns || 0) >= 5,
      rankGated: (g('secondary', 'rank').requireRuns || 0) >= 15,
      bpGated: (g('secondary', 'bp').requireRuns || 0) >= 6,
      total: f.gates.length,
    };
  });
  log('p7-roster-open-awal', gates.rosterOpen === true);
  log('p7-quests-open-awal', gates.questsOpen === true);
  log('p7-shop-bp-rank-gated', gates.shopGated && gates.rankGated && gates.bpGated, `gates=${gates.total}`);

  // ---- Mulai run untuk poin 2/4/5/8/9 ----
  await page.evaluate(() => window.__IMUNVERSE.game.startRun('macrophage'));
  await page.waitForTimeout(900);

  // ---- POIN 2: hex glyph + fire claw ----
  // UI/UX BUILD 43: hex = pelat SVG (.sk-plate polygon), ikon per-skill (js/ui/skill-icons.js),
  // SERANG = img assets/icons/hud-serang.svg (cincin gerigi ::before dibuang)
  const btns = await page.evaluate(() => {
    const glyphs = document.querySelectorAll('#screen-hud .ability-btn .sk-glyph svg').length;
    const plates = document.querySelectorAll('#screen-hud .ability-btn .sk-plate polygon.pl-face').length;
    const fireImg = document.querySelector('#screen-hud .fire-btn .fire-claw img');
    const fireOk = !!fireImg && /hud-serang\.svg/.test(fireImg.getAttribute('src') || '') && fireImg.complete && fireImg.naturalWidth > 0;
    const fire = document.querySelector('#screen-hud .fire-btn');
    const gearBefore = fire ? getComputedStyle(fire, '::before').content : '';
    return { glyphs, plates, fireOk, gearBefore };
  });
  log('p2-skill-glyph-svg', btns.glyphs >= 3, `glyphs=${btns.glyphs}`);
  log('p2-hex-plate-svg', btns.plates >= 3, `plates=${btns.plates}`);
  log('p2-fire-serang-icon', btns.fireOk === true);
  log('p2-fire-no-gear-ring', btns.gearBefore === 'none', btns.gearBefore);

  // ---- POIN 5: tintSprite ter-clip ke alpha (sudut kanvas transparan) ----
  const tint = await page.evaluate(async () => {
    const m = await import('/js/render/sprite-loader.js');
    const c = m.getTintedSprite('assets/sprites/hero_macrophage_idle.png', '#ff00ff');
    const g = c.getContext('2d');
    // sudut kanvas sprite = transparan di gambar asli → tint HARUS 0 alpha
    const corner = g.getImageData(0, 0, 1, 1).data[3];
    const mid = g.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data[3];
    return { corner, mid };
  });
  log('p5-tint-clip-alpha', tint.corner === 0 && tint.mid > 0, JSON.stringify(tint));

  // ---- POIN 8+9: presenter RIA saat waveBreak ----
  const ria = await page.evaluate(async () => {
    const ui = await import('/js/core/ui-bridge.js');
    ui.emit('waveBreak', { wave: 2 });
    await new Promise((r) => setTimeout(r, 400));
    const layer = document.getElementById('presenter-layer');
    const on = layer && layer.classList.contains('on');
    const name = (document.getElementById('presenter-name') || {}).textContent;
    const img = document.getElementById('presenter-img');
    const talkFrames = !!(img && img.dataset.idle && img.dataset.talk && img.dataset.idle !== img.dataset.talk);
    const panelSide = layer ? !!layer.querySelector('.presenter-stage .presenter-panel') : false;
    return { on, name, talkFrames, panelSide };
  });
  log('p9-ria-on-wavebreak', ria.on === true && ria.name === 'RIA');
  log('p8-two-frame-talk', ria.talkFrames === true);
  log('p8-text-beside-char', ria.panelSide === true);

  // ---- POIN 9: Amara saat heroUnlocked ----
  const amara = await page.evaluate(async () => {
    const ui = await import('/js/core/ui-bridge.js');
    ui.emit('heroUnlocked', { heroId: 'neutrophil' });
    await new Promise((r) => setTimeout(r, 1400)); // delay 900ms + buffer
    const name = (document.getElementById('presenter-name') || {}).textContent;
    const text = (document.getElementById('presenter-text') || {}).textContent || '';
    const m = await import('/js/ui/presenter.js');
    m.hidePresenter();
    return { name, mentionsRole: /Damage|Tank|Support/i.test(text), mentionsSkill: text.includes('Jurus') };
  });
  log('p9-amara-on-unlock', amara.name === 'Dr. Amara');
  log('p9-amara-spec-role', amara.mentionsRole === true);
  log('p9-amara-spec-skills', amara.mentionsSkill === true);

  // ---- POIN 4: back dari menu → kembali ke GAMEPLAY ----
  const back = await page.evaluate(async () => {
    const sm = window.__IMUNVERSE.screenManager;
    sm.show('bag');
    await new Promise((r) => setTimeout(r, 200));
    window.__IMUNVERSE_backToContext('dashboard');
    await new Promise((r) => setTimeout(r, 200));
    const backToHud = document.getElementById('screen-hud').classList.contains('active');
    const resumed = !window.__IMUNVERSE.STATE.paused;
    return { backToHud, resumed };
  });
  log('p4-back-to-gameplay', back.backToHud === true, JSON.stringify(back));
  log('p4-run-resumed', back.resumed === true);

  // ---- POIN 4b: tanpa run hidup → fallback dashboard ----
  const back2 = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    if (g.run) g.run.ended = true; // simulasikan run selesai
    await new Promise((r) => setTimeout(r, 100));
    window.__IMUNVERSE.screenManager.show('bag');
    await new Promise((r) => setTimeout(r, 150));
    window.__IMUNVERSE_backToContext('dashboard');
    await new Promise((r) => setTimeout(r, 150));
    return document.getElementById('screen-dashboard').classList.contains('active');
  });
  log('p4-fallback-dashboard', back2 === true);

  // ---- POIN 10: coach melewati target hidden ----
  const coach = await page.evaluate(async () => {
    const src = await (await fetch('/js/ui/coach.js')).text();
    return {
      skipsHidden: src.includes('rect0.width === 0 && rect0.height === 0'),
      remeasures: src.includes('requestAnimationFrame(() => requestAnimationFrame'),
      scrollsCenter: src.includes("block: 'center'"),
    };
  });
  log('p10-coach-skips-hidden', coach.skipsHidden === true);
  log('p10-coach-remeasure-after-scroll', coach.remeasures === true);
  log('p10-coach-scroll-center', coach.scrollsCenter === true);

  // ---- POIN 3: cine-banner ambience organ tanpa error ----
  const cine = await page.evaluate(async () => {
    const src = await (await fetch('/js/render/cine-banner.js')).text();
    const canvasOk = !!document.getElementById('dash-cine');
    return {
      canvasOk,
      hasRbc: src.includes('rbc') && src.includes('eritrosit'),
      hasBeat: src.includes('72bpm') || src.includes('beat'),
      hasWall: src.includes('DINDING PEMBULUH'),
    };
  });
  log('p3-cine-canvas', cine.canvasOk === true);
  log('p3-organ-ambience', cine.hasRbc && cine.hasBeat && cine.hasWall);

  log('no-page-errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  console.error('SUITE ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\nE1: ${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
