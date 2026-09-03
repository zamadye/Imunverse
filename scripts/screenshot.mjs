/**
 * screenshot.mjs — bukti runtime browser Chromium asli (Imunverse).
 * Jalankan: cd /tmp/pw && LD_LIBRARY_PATH=/tmp/alibs/lib node /home/user/Imunverse/scripts/screenshot.mjs
 * Alur: loading → dashboard → roster → shop → upgrade → roster(mulai)
 *       → gameplay 12 dtk → gameover → retry → pause.
 */
let chromium;
let c;
try {
  ({ chromium } = await import('playwright-core'));
  c = (await import('@sparticuz/chromium')).default;
} catch {
  // fallback saat skrip dijalankan dari repo (node_modules ada di /tmp/pw)
  ({ chromium } = await import('file:///tmp/pw/node_modules/playwright-core/index.mjs'));
  c = (await import('file:///tmp/pw/node_modules/@sparticuz/chromium/build/index.js')).default;
}
import fs from 'node:fs';

const OUT = '/home/user/shots';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8000/index.html';
const errors = [];

const browser = await chromium.launch({
  executablePath: await c.executablePath(),
  args: [...c.args, '--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('response', (r) => { if (r.status() === 404) errors.push(`404 ${r.url()}`); });

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const sleep = (ms) => page.waitForTimeout(ms);
const activeScreen = () => page.evaluate(() => document.querySelector('.screen.active')?.dataset?.screen);

// Throttle jaringan biar loading screen (preload sprite) sempat terlihat
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, latency: 400, downloadThroughput: 120 * 1024, uploadThroughput: 120 * 1024,
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(900);
await shot('01-loading');
// Kembalikan ke kecepatan penuh
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});
await page.waitForSelector('#screen-dashboard.active', { timeout: 30000 });
await sleep(900);
await shot('02-dashboard');

// --- roster (via dock nav) ---
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#screen-dashboard button, #screen-dashboard .nav-item, #screen-dashboard [role]')]
    .find((x) => /roster|hero|tim/i.test(x.textContent || ''));
  if (b) b.click();
});
await sleep(600);
if ((await activeScreen()) === 'roster') {
  await shot('03-roster');
}

// --- shop & squad upgrade (navigasi langsung) ---
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('shop'));
await sleep(600);
await shot('04-shop');
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('upgrade'));
await sleep(600);
await shot('05-upgrade');

// --- mulai run dari roster ---
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('roster'));
await sleep(500);
await page.click('#screen-roster .hero-card:not(.locked)');
await sleep(400);
await shot('06-roster-selected');
await page.click('#btn-start-run');
await sleep(2200);
await shot('07-gameplay-early');

// joystick virtual: tahan & geser
await page.mouse.move(70, 700);
await page.mouse.down();
await page.mouse.move(140, 630, { steps: 8 });
await sleep(4500);
await shot('08-gameplay-mid');
await sleep(5300);
await page.mouse.up();
await shot('09-gameplay-12s');

// --- modal level-up: paksa XP cukup untuk naik level ---
await page.evaluate(() => { window.__IMUNVERSE.game.addXP(9999); });
await sleep(900);
if ((await activeScreen()) === 'levelup' || (await page.locator('#screen-levelup').isVisible())) {
  await shot('10-levelup');
  await page.click('#screen-levelup .choice-card, #screen-levelup button');
  await sleep(500);
}

// --- gameover: paksa HP player habis (lewati penawaran revive) ---
await page.evaluate(() => {
  const g = window.__IMUNVERSE.game;
  if (g?.run?.player) {
    g.run.reviveOffered = true; // lewati modal revive → langsung gameover
    g.run.player.hp = 0;
    g.run.player.alive = false;
    g.handlePlayerDeath(); // trigger alur akhir run yang asli
  }
});
await sleep(1800);
if ((await activeScreen()) === 'gameover') await shot('11-gameover');

// --- retry lalu pause ---
await page.click('#btn-retry');
await sleep(1600);
await page.click('#btn-pause');
await sleep(600);
if ((await activeScreen()) === 'pause' || (await page.locator('#screen-pause').isVisible())) {
  await shot('12-pause');
}

await browser.close();
console.log(`SHOTS_OK ${errors.length === 0 ? 'CLEAN' : 'ERRORS:'}`);
errors.slice(0, 20).forEach((e) => console.log('  !', e));
process.exit(errors.length === 0 ? 0 : 2);
