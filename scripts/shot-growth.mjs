import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require('/tmp/pw/node_modules/playwright-core');
const browser = await pw.launch({ executablePath: '/tmp/chromium', args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs/lib' } });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(500); }
await page.fill('#auth-username', 'PemainHebat'); await page.fill('#auth-password', '1234');
await page.click('#auth-submit');
await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
for (let k = 0; k < 6; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip'); await page.waitForTimeout(300); }
await page.click('#btn-play-big');
await page.waitForTimeout(700);
await page.locator('.camp-node:not(.locked)').first().click();
await page.waitForTimeout(400);
await page.click('#btn-campaign-go');
await page.waitForTimeout(600);
await page.locator('.prep-hero:not(.locked)').first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('.prep-start')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(300);
await page.click('#btn-prep-start', { timeout: 8000 });
await page.waitForTimeout(1000);
if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(400); }
await page.waitForTimeout(1200);

const forceLevel = async (target) => {
  await page.evaluate(async (tgt) => {
    const g = window.__IMUNVERSE.game;
    const need = (lv) => Math.ceil(10 * Math.pow(lv, 1.5));
    while (g.run.level < tgt) {
      g.run.xp = need(g.run.level);
      g.addXP(0);
      let guard = 0;
      while (g.run.currentChoices && guard++ < 40) g.chooseLevelUp(g.run.currentChoices[0].id);
    }
  }, target);
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    let guard = 0;
    while (g.run.currentChoices && guard++ < 40) g.chooseLevelUp(g.run.currentChoices[0].id);
  });
  await page.waitForTimeout(500);
};

// Tahap 0: BULIR (level 1 — tanpa tangan/kaki)
await page.screenshot({ path: 'shots/42e-bulir.png' });
// Tahap 1: KAKI (level 3)
await forceLevel(3);
await page.screenshot({ path: 'shots/42a-berkaki.png' });
// Tahap 2: HUMANOID (level 5 — tangan + senjata)
await forceLevel(5);
await page.screenshot({ path: 'shots/42b-humanoid.png' });
// Tahap 3: BERZIRAH (level 8)
await forceLevel(8);
await page.screenshot({ path: 'shots/42c-berzirah.png' });
// Tahap 4: LEGENDA (level 12 — mahkota + set penuh)
await forceLevel(12);
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/42d-legenda.png' });
console.log('shots done; pageerrors:', errs.length ? errs.join(' | ') : 'none');
console.log('level akhir:', await page.evaluate(() => window.__IMUNVERSE.game.run.level));
await browser.close();
