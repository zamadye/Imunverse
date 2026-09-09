/**
 * e2e-character-visual.mjs — Character Agent browser/DOM visual QA.
 *
 * Scope:
 * - Capture real browser screenshots for Character UI surfaces: Roster,
 *   Hero Detail, Bag, Codex hero/enemy detail, HUD equity badge.
 * - Capture real gameplay HUD screenshots for 3 different skill archetype
 *   triggers with cooldown/VFX visible.
 * - Assert no fatal browser console errors and no HTTP 404/5xx assets.
 *
 * Prereq example used in Arena sandbox:
 *   mkdir -p /tmp/pw-character
 *   cd /tmp/pw-character && npm init -y
 *   npm install playwright @sparticuz/chromium chrome-aws-lambda @achingbrain/nss
 *   node -e "require('lambdafs').inflate('node_modules/chrome-aws-lambda/bin/aws.tar.br')"
 *   npm start # from repo root, or: python3 -m http.server 8000 --bind 0.0.0.0
 *   PW_PATH=/tmp/pw-character/node_modules/playwright \
 *   CHROMIUM_PATH=/tmp/chromium \
 *   node scripts/e2e-character-visual.mjs
 *
 * This script intentionally does not add npm dependencies to the game package;
 * existing repo e2e scripts use external Playwright/Chromium paths too.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const OUT_DIR = process.env.OUT_DIR || 'shots/review';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';
const VIEWPORT = { width: Number(process.env.VIEW_W || 844), height: Number(process.env.VIEW_H || 390) };

function requireFirst(candidates) {
  const errors = [];
  for (const spec of candidates.filter(Boolean)) {
    try {
      return require(spec);
    } catch (err) {
      errors.push(`${spec}: ${err.message}`);
    }
  }
  throw new Error(`Tidak bisa load Playwright. Coba set PW_PATH. Kandidat:\n${errors.join('\n')}`);
}

const pwModule = requireFirst([
  process.env.PW_PATH,
  '/tmp/pw-character/node_modules/playwright',
  '/tmp/pw/node_modules/playwright-core',
  'playwright',
  'playwright-core',
]);
const { chromium: pw } = pwModule;
if (!pw) throw new Error('Playwright chromium tidak tersedia dari PW_PATH.');

function browserEnv() {
  const parts = [
    process.env.CHROME_LIB_PATH,
    '/tmp/aws/lib',
    '/tmp/pw-character/node_modules/@achingbrain/nss/linux',
    process.env.LD_LIBRARY_PATH,
  ].filter(Boolean);
  return { ...process.env, LD_LIBRARY_PATH: [...new Set(parts.join(':').split(':').filter(Boolean))].join(':') };
}

function out(name) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  return path.join(OUT_DIR, name);
}

const log = (key, value) => console.log(`${value === true ? 'PASS' : value === false ? 'FAIL' : 'INFO'} ${key}${value === true || value === false ? '' : ' ' + value}`);
const fail = (msg) => { throw new Error(msg); };

const browser = await pw.launch({
  executablePath: process.env.CHROMIUM_PATH || '/tmp/chromium',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--font-render-hinting=none',
  ],
  env: browserEnv(),
});

const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
const badResponses = [];

page.on('pageerror', (err) => errors.push(`PAGEERR ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE ${msg.text()}`);
});
page.on('response', (res) => {
  const status = res.status();
  const url = res.url();
  if (status >= 400 && url.startsWith(BASE_URL.replace(/\/$/, ''))) badResponses.push(`${status} ${url}`);
});

async function waitApp() {
  await page.goto(`${BASE_URL}?dev=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__IMUNVERSE?.STATE?.meta && !!window.__IMUNVERSE?.getData?.()?.heroes?.heroes?.length, null, { timeout: 20000 });
  await page.addStyleTag({ content: `
    *, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; }
    #rotate-hud { display: none !important; }
    #toasts { display: none !important; }
  ` });
  await page.evaluate(() => {
    const app = window.__IMUNVERSE;
    const data = app.getData();
    const meta = app.STATE.meta;
    meta.account = meta.account || { uid: 'character-qa', username: 'CharQA', faction: 'imun', createdAt: new Date().toISOString() };
    meta.coachDone = true;
    meta.tutorialDone = true;
    meta.soundMuted = true;
    meta.musicOn = false;
    meta.selectedHero = 'bcell';
    meta.unlockedHeroes = data.heroes.heroes.map((h) => h.id);
    meta.currency = 999999;
    meta.imun = 999999;
    meta.evoStage = 4;
    meta.evoParts = { equity_receptor: 99, equity_membrane: 99, equity_effector: 99, equity_memory_core: 99 };
    meta.allies = 6;
    meta.allyLevel = 99;
    meta.codexSeen = Object.fromEntries((data.codex.entries || []).map((e) => [e.id, true]));
    meta.stats = { ...(meta.stats || {}), totalRuns: 12, bestWave: 25, wins: 4, totalKills: 1234, bossKills: 12 };
    document.getElementById('tutorial-layer')?.classList.add('hidden');
    document.querySelectorAll('.presenter, .toast').forEach((el) => el.remove());
    app.screenManager.show('dashboard');
  });
  await page.waitForTimeout(250);
}

async function screenshot(name) {
  const file = out(name);
  await page.screenshot({ path: file, fullPage: false });
  log('screenshot', file);
}

async function showScreen(id, params = null) {
  await page.evaluate(({ id, params }) => window.__IMUNVERSE.screenManager.show(id, params), { id, params });
  await page.waitForTimeout(220);
  await page.evaluate(() => document.querySelectorAll('.presenter, .toast').forEach((el) => el.remove()));
}

async function assertCount(label, selector, min) {
  const count = await page.locator(selector).count();
  log(label, count >= min ? `${count}` : false);
  if (count < min) fail(`${label}: expected >= ${min}, got ${count}`);
}

async function scrollInto(selector) {
  await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start', inline: 'nearest' }), selector);
  await page.waitForTimeout(160);
}

async function captureCharacterScreens() {
  await showScreen('roster');
  await assertCount('roster-equity-chips', '#screen-roster.active .roster-equity', 11);
  await assertCount('roster-preview-canvases', '#screen-roster.active canvas.character-preview, #screen-roster.active canvas.roster-hero-preview', 11);
  await screenshot('character-browser-roster.png');

  await showScreen('herodetail', { heroId: 'bcell' });
  await assertCount('hero-detail-equity-steps', '#screen-herodetail.active .hl-equity-step', 5);
  await scrollInto('#screen-herodetail .hl-equity-card');
  await screenshot('character-browser-hero-detail.png');

  await showScreen('bag');
  await assertCount('bag-design-rows', '#screen-bag.active .bag-design-row', 5);
  await scrollInto('#screen-bag .bag-design-panel');
  await screenshot('character-browser-bag.png');

  await showScreen('codex');
  await assertCount('codex-design-tags', '#screen-codex.active .codex-design-tag', 2);
  await page.locator('#screen-codex .codex-card.seen[data-id="bcell"]').click({ timeout: 5000 });
  await page.waitForSelector('#screen-codex .cxd-equity-panel', { timeout: 5000 });
  await assertCount('codex-hero-equity-chips', '#screen-codex .cxd-equity-chip', 5);
  await screenshot('character-browser-codex-hero.png');

  await showScreen('codex');
  await page.locator('#screen-codex .codex-card.seen[data-id="bakteri"]').click({ timeout: 5000 });
  await page.waitForSelector('#screen-codex .cxd-mutation-panel:not(.cxd-equity-panel)', { timeout: 5000 });
  await assertCount('codex-enemy-tier-chips', '#screen-codex .cxd-mutation-panel:not(.cxd-equity-panel) .cxd-tier-chip', 5);
  await screenshot('character-browser-codex-enemy.png');
}

async function startHeroRun(heroId) {
  await page.evaluate((heroId) => {
    const app = window.__IMUNVERSE;
    const { game, STATE } = app;
    STATE.paused = false;
    STATE.levelUpOpen = false;
    STATE.meta.selectedHero = heroId;
    STATE.meta.evoStage = 4;
    STATE.meta.tutorialDone = true;
    game.startRun(heroId);
    const p = game.run.player;
    p.maxHP = 99999;
    p.hp = 99999;
    p.iframes = 99999;
    game.run.enemies.forEach((e) => { e.alive = false; });
    game.run.skills.slots.forEach((slot) => { if (slot) { slot.unlocked = true; slot.cdLeft = 0; } });
    document.getElementById('tutorial-layer')?.classList.add('hidden');
    document.querySelectorAll('.presenter, .toast').forEach((el) => el.remove());
  }, heroId);
  await page.waitForFunction(() => document.querySelector('#screen-hud')?.classList.contains('active'), null, { timeout: 6000 });
  await page.waitForTimeout(240);
}

async function captureHudAndSkills() {
  await startHeroRun('bcell');
  await assertCount('hud-ability-buttons', '#ability-bar .ability-btn', 3);
  const hudStage = await page.locator('#hud-equity-stage').textContent();
  log('hud-equity-stage', hudStage || false);
  if (!hudStage || !/Equity|Full|Lengkap|Polos/i.test(hudStage)) fail(`hud equity stage tidak terbaca: ${hudStage}`);
  await screenshot('character-browser-hud.png');

  const heroes = [
    ['macrophage', 'mako-phagocyte'],
    ['bcell', 'bella-antibody'],
    ['tcd8', 'tbolt-cytotoxic'],
  ];
  for (const [heroId, label] of heroes) {
    await startHeroRun(heroId);
    await page.evaluate(() => {
      const app = window.__IMUNVERSE;
      const { game, STATE } = app;
      const p = game.run.player;
      for (let i = 0; i < 3; i++) game.spawnEnemy('bakteri', false);
      game.run.enemies.forEach((e, i) => {
        if (!e.isBoss) {
          e.alive = true;
          e.maxHP = 99999;
          e.hp = 99999;
          e.x = p.x + 70 + i * 18;
          e.y = p.y + (i % 2 ? 24 : -20);
          e.homeX = null;
          e.homeY = null;
        }
      });
      game.run.skills.slots.forEach((slot) => { if (slot) { slot.unlocked = true; slot.cdLeft = 0; } });
      game.useAbilityBySlot(0);
      for (const fx of game.run.effects.effects) {
        if (fx.type === 'abilityCharge') fx.life = fx.maxLife * 0.52;
        if (fx.type === 'abilityPayoff') fx.life = fx.maxLife * 0.62;
      }
      STATE.paused = true; // keep VFX/cooldown frame stable while render continues
      document.getElementById('tutorial-layer')?.classList.add('hidden');
      document.querySelectorAll('.presenter, .toast').forEach((el) => el.remove());
    });
    await page.waitForTimeout(140);
    const archetype = await page.locator('#ability-bar .ability-btn').first().getAttribute('data-archetype');
    log(`skill-${label}-archetype`, archetype || false);
    if (!archetype) fail(`archetype button kosong untuk ${label}`);
    await screenshot(`character-browser-skill-${label}.png`);
  }
}

try {
  await waitApp();
  await captureCharacterScreens();
  await captureHudAndSkills();

  log('browser-console-errors', errors.length === 0 ? true : errors.join(' | '));
  log('http-bad-responses', badResponses.length === 0 ? true : badResponses.join(' | '));
  if (errors.length || badResponses.length) fail('Browser QA punya error/HTTP bad response.');
  log('viewport', `${VIEWPORT.width}x${VIEWPORT.height}`);
} finally {
  await browser.close().catch(() => {});
}
