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
await page.screenshot({ path: 'shots/48-dashboard13.png' });
// slide 2 (bab) & slide 3 (endless) via dot
await page.evaluate(() => document.querySelectorAll('#banner-dots .b-dot')[1].click());
await page.waitForTimeout(700);
await page.screenshot({ path: 'shots/49-dashboard13-bab.png' });
await page.evaluate(() => document.querySelectorAll('#banner-dots .b-dot')[2].click());
await page.waitForTimeout(700);
await page.screenshot({ path: 'shots/50-dashboard13-endless.png' });
console.log('done; errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
