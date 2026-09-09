/**
 * e2e-character-i18n.mjs — Character Agent bilingual/editorial QA.
 *
 * Verifies the English language toggle for Character-facing surfaces after the
 * editorial copy polish pass. Uses the same external Playwright/Chromium setup
 * as the repository's other e2e scripts; no runtime package dependency is added.
 *
 * Example:
 *   PW_PATH=/tmp/pw-character/node_modules/playwright \
 *   CHROMIUM_PATH=/tmp/chromium \
 *   node scripts/e2e-character-i18n.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';
const OUT_DIR = process.env.OUT_DIR || 'shots/review';
const VIEWPORT = { width: Number(process.env.VIEW_W || 844), height: Number(process.env.VIEW_H || 390) };

function requireFirst(candidates) {
  const errors = [];
  for (const spec of candidates.filter(Boolean)) {
    try { return require(spec); }
    catch (err) { errors.push(`${spec}: ${err.message}`); }
  }
  throw new Error(`Tidak bisa load Playwright. Coba set PW_PATH. Kandidat:\n${errors.join('\n')}`);
}

const { chromium: pw } = requireFirst([
  process.env.PW_PATH,
  '/tmp/pw-character/node_modules/playwright',
  '/tmp/pw/node_modules/playwright-core',
  'playwright',
  'playwright-core',
]);

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
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  env: browserEnv(),
});

const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1, isMobile: false, hasTouch: true });
const errors = [];
const badResponses = [];
page.on('pageerror', (err) => errors.push(`PAGEERR ${err.message}`));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`CONSOLE ${msg.text()}`); });
page.on('response', (res) => {
  const status = res.status();
  const url = res.url();
  if (status >= 400 && url.startsWith(BASE_URL.replace(/\/$/, ''))) badResponses.push(`${status} ${url}`);
});

async function setupEnglishCharacterState() {
  await page.goto(`${BASE_URL}?dev=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__IMUNVERSE?.STATE?.meta && !!window.__IMUNVERSE?.getData?.()?.heroes?.heroes?.length, null, { timeout: 20000 });
  await page.addStyleTag({ content: `
    *, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; }
    #rotate-hud, #toasts { display: none !important; }
  ` });
  await page.evaluate(async () => {
    const app = window.__IMUNVERSE;
    const data = app.getData();
    const meta = app.STATE.meta;
    meta.lang = 'en';
    meta.account = meta.account || { uid: 'character-i18n', username: 'CharEN', faction: 'imun', createdAt: new Date().toISOString() };
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
    meta.codexSeen = Object.fromEntries((data.codex.entries || []).map((e) => [e.id, true]));
    const { applyDataLanguage } = await import('/js/core/data-store.js');
    const { sweepAll } = await import('/js/systems/i18n.js');
    applyDataLanguage('en');
    sweepAll();
    app.screenManager.show('dashboard');
    document.getElementById('tutorial-layer')?.classList.add('hidden');
    document.querySelectorAll('.presenter, .toast').forEach((el) => el.remove());
  });
}

async function showScreen(id, params = null) {
  await page.evaluate(({ id, params }) => window.__IMUNVERSE.screenManager.show(id, params), { id, params });
  await page.waitForTimeout(220);
  await page.evaluate(() => {
    document.getElementById('tutorial-layer')?.classList.add('hidden');
    document.querySelectorAll('.presenter, .toast').forEach((el) => el.remove());
  });
}

async function activeText() {
  return page.evaluate(() => document.querySelector('.screen.active')?.innerText || '');
}

function assertIncludes(label, text, needle) {
  const ok = text.includes(needle);
  log(label, ok ? needle : false);
  if (!ok) fail(`${label}: expected text to include ${needle}`);
}

function assertExcludes(label, text, needle) {
  const ok = !text.includes(needle);
  log(label, ok);
  if (!ok) fail(`${label}: unexpected untranslated text ${needle}`);
}

async function screenshot(name) {
  const file = out(name);
  await page.screenshot({ path: file, fullPage: false });
  log('screenshot', file);
}

try {
  await setupEnglishCharacterState();

  await showScreen('roster');
  let text = await activeText();
  assertIncludes('en-roster-pattern-piercing', text, 'Piercing');
  assertIncludes('en-roster-pattern-homing', text, 'Homing');
  assertIncludes('en-roster-pattern-area-slash', text, 'Area Slash');
  assertIncludes('en-roster-start-button', text, 'START — BELLA');
  for (const bad of ['Penembus', 'Penjejak', 'Tebasan Area', 'MULAI —']) assertExcludes(`en-roster-no-${bad}`, text, bad);
  await screenshot('character-i18n-en-roster.png');

  await showScreen('herodetail', { heroId: 'bcell' });
  text = await activeText();
  assertIncludes('en-detail-passive-name', text, 'Antibody Memory');
  assertIncludes('en-detail-passive-desc', text, 'Critical chance +6%.');
  assertIncludes('en-detail-upgrade-button', text, 'UPGRADE — 150 antibodies');
  assertIncludes('en-detail-max-level', text, 'MAX LEVEL ✓');
  assertIncludes('en-detail-squad-copy', text, 'cell count increases as campaign chapters are cleared');
  for (const bad of ['Memori Antibodi', 'Peluang critical', 'LEVEL MAKSIMAL', 'jumlah sel bertambah']) assertExcludes(`en-detail-no-${bad}`, text, bad);
  await page.evaluate(() => document.querySelector('#screen-herodetail .hl-equity-card')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(120);
  await screenshot('character-i18n-en-hero-detail.png');

  await showScreen('bag');
  text = await activeText();
  assertIncludes('en-bag-design-heading', text, 'CHARACTER DESIGN COLLECTION');
  assertIncludes('en-bag-base-parts-copy', text, 'no parts — base/plain form');
  assertExcludes('en-bag-no-tanpa-part', text, 'tanpa part');
  await page.evaluate(() => document.querySelector('#screen-bag .bag-design-panel')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(120);
  await screenshot('character-i18n-en-bag.png');

  await showScreen('codex');
  text = await activeText();
  assertIncludes('en-codex-mutation-tag', text, 'MUTATION 0–4');
  assertExcludes('en-codex-no-mutasi-tag', text, 'MUTASI 0–4');
  await page.locator('#screen-codex .codex-card.seen[data-id="bcell"]').click({ timeout: 5000 });
  await page.waitForSelector('#screen-codex .cxd-equity-panel', { timeout: 5000 });
  text = await page.evaluate(() => document.querySelector('#codex-detail')?.innerText || '');
  assertIncludes('en-codex-hero-archetype-label', text, 'Bella — Antibody Specialist');
  await screenshot('character-i18n-en-codex-hero.png');

  await showScreen('codex');
  await page.locator('#screen-codex .codex-card.seen[data-id="bakteri"]').click({ timeout: 5000 });
  await page.waitForSelector('#screen-codex .cxd-mutation-panel:not(.cxd-equity-panel)', { timeout: 5000 });
  text = await page.evaluate(() => document.querySelector('#codex-detail')?.innerText || '');
  assertIncludes('en-codex-detail-heading', text, 'PATHOGEN MUTATION DESIGN');
  assertIncludes('en-codex-detail-threat', text, 'Threat I: flagella look longer.');
  await screenshot('character-i18n-en-codex-enemy.png');

  await page.evaluate(() => {
    const app = window.__IMUNVERSE;
    app.STATE.meta.selectedHero = 'bcell';
    app.STATE.meta.evoStage = 4;
    app.STATE.paused = false;
    app.STATE.levelUpOpen = false;
    app.game.startRun('bcell');
    const p = app.game.run.player;
    p.maxHP = 99999;
    p.hp = 99999;
    p.iframes = 99999;
    app.game.run.enemies.forEach((e) => { e.alive = false; });
    app.game.run.skills.slots.forEach((slot) => { if (slot) { slot.unlocked = true; slot.cdLeft = 0; } });
    document.getElementById('tutorial-layer')?.classList.add('hidden');
    document.querySelectorAll('.presenter, .toast').forEach((el) => el.remove());
  });
  await page.waitForFunction(() => document.querySelector('#screen-hud')?.classList.contains('active'), null, { timeout: 6000 });
  await page.waitForTimeout(220);
  text = await activeText();
  assertIncludes('en-hud-equity-stage', text, 'FULL EQUITY');
  await screenshot('character-i18n-en-hud.png');

  log('browser-console-errors', errors.length === 0 ? true : errors.join(' | '));
  log('http-bad-responses', badResponses.length === 0 ? true : badResponses.join(' | '));
  if (errors.length || badResponses.length) fail('Character i18n QA punya error/HTTP bad response.');
  log('viewport', `${VIEWPORT.width}x${VIEWPORT.height}`);
} finally {
  await browser.close().catch(() => {});
}
