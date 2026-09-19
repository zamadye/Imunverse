/**
 * Regression test for the actual T-Bolt browser loader, not just the Rive CLI.
 * The CLI can validate a .riv even when gameplay fails before fetching it
 * (e.g. the missing BUILD import that produced the RIVE?/err? marker).
 *
 * Start the game with npm start, then run npm run verify:tbolt-runtime.
 * Requires Playwright + Chromium, like the other scripts/e2e-* checks:
 *   PW_PATH=/path/to/node_modules/playwright CHROMIUM_PATH=/path/to/chromium \
 *     npm run verify:tbolt-runtime
 * BASE_URL, CHROME_LIB_PATH, and OUT_DIR are optional overrides.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
for (const spec of [process.env.PW_PATH, 'playwright', 'playwright-core'].filter(Boolean)) {
  try { ({ chromium } = require(spec)); break; } catch { /* try the next installation */ }
}
assert.ok(chromium, 'Playwright belum tersedia. Pasang Playwright + Chromium atau tentukan PW_PATH dan CHROMIUM_PATH.');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';
const OUT_DIR = process.env.OUT_DIR || 'shots/tbolt-rive';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: {
    ...process.env,
    LD_LIBRARY_PATH: [process.env.CHROME_LIB_PATH, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
  },
});

try {
  // A fresh context without SW interception tests the files currently on disk.
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const errors = [];
  const rigResponses = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || (message.type() === 'warning' && message.text().includes('[tbolt-rive]'))) {
      errors.push(message.text());
    }
  });
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('/tbolt-rive-draft.riv')) {
      rigResponses.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__IMUNVERSE, null, { timeout: 30000 });
  await page.evaluate(() => {
    Object.assign(window.__IMUNVERSE.STATE.meta, {
      onboardingDone: true, tutorialDone: true, coachDone: true, soundMuted: true, musicOn: false,
    });
  });
  // Let the delayed bootstrap screen selection finish before starting the run.
  await page.waitForFunction(() => window.__IMUNVERSE.STATE.screen === 'dashboard');

  const loaded = await page.evaluate(async () => {
    const { game, STATE } = window.__IMUNVERSE;
    game.startRun('tcd8');
    STATE.paused = true; // deterministic animation probes; rendering still runs
    const rive = await import(new URL('js/render/tbolt-rive.js', document.baseURI).href);
    const { BUILD } = await import(new URL('js/core/version.js', document.baseURI).href);
    const first = rive.ensureTBoltRive();
    const reused = first === rive.ensureTBoltRive();
    const status = await first;
    return { status, reused, error: rive.tboltRiveError(), build: BUILD, hero: game.run.player.heroDef.id };
  });
  assert.equal(loaded.hero, 'tcd8');
  assert.equal(loaded.status, 'ready', `T-Bolt loader failed: ${loaded.error}`);
  assert.equal(loaded.error, null);
  assert.equal(loaded.reused, true, 'concurrent callers should share the same load');
  assert.equal(rigResponses.length, 1, 'gameplay must fetch the actual .riv exactly once');
  assert.equal(rigResponses[0].status, 200);
  assert.equal(new URL(rigResponses[0].url).searchParams.get('v'), loaded.build, 'rig cache-buster must use the imported BUILD');
  console.log(`PASS T-Bolt loader: ready, .riv HTTP 200, build ${loaded.build}`);

  const visual = await page.evaluate(async () => {
    const rive = await import(new URL('js/render/tbolt-rive.js', document.baseURI).href);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const markers = [];
    const fillText = ctx.fillText.bind(ctx);
    ctx.fillText = (...args) => { markers.push(String(args[0])); return fillText(...args); };
    const step = (frames, options = {}) => {
      for (let i = 0; i < frames; i++) rive.updateTBoltRive(1 / 60, options);
    };
    const snapshots = [];
    const capture = (label) => {
      ctx.clearRect(0, 0, 512, 512);
      const drawn = rive.drawTBoltRive(ctx, 256, 450, 360);
      const data = ctx.getImageData(0, 0, 512, 512).data;
      let pixels = 0;
      let hash = 2166136261;
      for (let i = 0; i < data.length; i++) {
        if (i % 4 === 3 && data[i] > 16) pixels++;
        hash = Math.imul(hash ^ data[i], 16777619) >>> 0;
      }
      snapshots.push({ label, drawn, pixels, hash, state: rive.tboltRiveState() });
    };

    rive.setTBoltRiveInput('stage', 0);
    rive.resetTBoltRive();
    step(24, { moving: false });
    capture('idle');
    const png = canvas.toDataURL('image/png');
    step(12, { moving: true, direction: 'e' });
    capture('walk-a');
    step(12, { moving: true });
    capture('walk-b');
    step(12, { moving: false });
    capture('idle-after-walk');
    rive.fireTBoltRive('attack');
    step(6);
    capture('attack');
    step(60, { moving: false });
    for (const stage of [1, 2, 3]) {
      step(36, { stage });
      capture(`stage-${stage}`);
    }
    rive.setTBoltRiveInput('stage', 0);
    rive.resetTBoltRive();
    step(24, { moving: false });
    return { snapshots, markers, error: rive.tboltRiveError(), status: rive.tboltRiveStatus(), png };
  });
  assert.equal(visual.status, 'ready');
  assert.equal(visual.error, null, 'renderer must not silently fall back after loading');
  assert.deepEqual(visual.markers, [], 'drawTBoltRive must draw artwork, not the RIVE?/err? marker');
  for (const shot of visual.snapshots) {
    assert.ok(shot.drawn && shot.pixels > 1000, `${shot.label}: T-Bolt artwork is empty (${shot.pixels} pixels)`);
  }
  const shot = (label) => visual.snapshots.find((item) => item.label === label);
  assert.equal(shot('walk-a').state, 'walk');
  assert.equal(shot('idle-after-walk').state, 'idle');
  assert.equal(shot('attack').state, 'attack');
  assert.notEqual(shot('walk-a').hash, shot('walk-b').hash, 'walk animation must change visible pixels');
  for (const stage of [1, 2, 3]) assert.equal(shot(`stage-${stage}`).state, `equip${stage}`);
  // Mako uses the same Canvas Advanced integration and needs frame resolution too.
  const mako = await page.evaluate(async () => {
    const rive = await import(new URL('js/render/mako-rive.js', document.baseURI).href);
    const status = await rive.ensureMakoRive();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    rive.updateMakoRive(1 / 60, { moving: false });
    const drawn = rive.drawMakoRive(ctx, 256, 450, 360);
    const data = ctx.getImageData(0, 0, 512, 512).data;
    let pixels = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 16) pixels++;
    return { status, drawn, pixels, error: rive.makoRiveError() };
  });
  assert.equal(mako.status, 'ready', `Mako loader failed: ${mako.error}`);
  assert.equal(mako.error, null);
  assert.ok(mako.drawn && mako.pixels > 1000, `Mako artwork is empty (${mako.pixels} pixels)`);
  assert.deepEqual(errors, [], 'browser must not report loader/render errors');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'tbolt-artboard.png'), Buffer.from(visual.png.split(',')[1], 'base64'));
  await page.waitForFunction(() => document.querySelector('#screen-hud')?.classList.contains('active'));
  await page.screenshot({ path: path.join(OUT_DIR, 'tbolt-gameplay.png') });
  console.log('PASS artwork pixels, idle/walk/attack, evolution stages 1–3, no RIVE error marker');
  console.log('PASS Mako artwork also renders with explicit Canvas frame resolution');
  console.log(`Screenshots: ${OUT_DIR}/tbolt-artboard.png and ${OUT_DIR}/tbolt-gameplay.png`);
} finally {
  await browser.close();
}
