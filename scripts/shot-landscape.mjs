import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require('/tmp/pw/node_modules/playwright-core');
const browser = await pw.launch({ executablePath: '/tmp/chromium', args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs/lib' } });
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 150)));
await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(500); }
await page.fill('#auth-username', 'PemainHebat'); await page.fill('#auth-password', '1234');
await page.click('#auth-submit');
await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
for (let k = 0; k < 6; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip'); await page.waitForTimeout(300); }
await page.waitForTimeout(800);
await page.evaluate(() => { document.querySelector('.dash-scroll').scrollTop = 0; });
await page.screenshot({ path: 'shots/55-landscape-dash.png' });
// gameplay landscape
await page.click('#btn-play-big'); await page.waitForTimeout(700);
await page.locator('.camp-node:not(.locked)').first().click(); await page.waitForTimeout(400);
await page.click('#btn-campaign-go'); await page.waitForTimeout(600);
await page.locator('.prep-hero:not(.locked)').first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(400);
await page.click('#btn-prep-start', { timeout: 8000 });
await page.waitForTimeout(1100);
for (let k = 0; k < 4; k++) {
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) await page.click('#cine-skip');
  await page.waitForTimeout(500);
  if (await page.evaluate(() => document.querySelector('#screen-hud')?.classList.contains('active'))) break;
}
await page.waitForTimeout(3500);
await page.screenshot({ path: 'shots/56-landscape-hud.png' });
console.log('done; errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
