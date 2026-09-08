/**
 * e2e-map-showcase.mjs — MAP AGENT: bukti visual tiap map.
 * Memotret layar-pilih arena (5 map) + gameplay endless di tiap map
 * (limfe, lambung, paru, saraf, jantung) dengan warna anatomi & elemen
 * khasnya. Wajib lolos zero-pageerror.
 * Jalankan: node scripts/e2e-map-showcase.mjs
 * (butuh server :8000 + chromium @sparticuz di /tmp/chromium, libs di /tmp/alibs/lib)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require(process.env.PW_PATH || '/tmp/pw/node_modules/playwright-core');

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
const log = (k, v) => console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${v === true || v === false ? '' : ' ' + v}`);
const active = (id) => page.evaluate((s) => document.querySelector(s)?.classList.contains('active') || false, id);

async function bootToDashboard() {
  await page.goto('http://localhost:8000/?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }
  if (await page.locator('#screen-title.active').isVisible().catch(() => false)) {
    await page.click('#btn-title-login', { timeout: 4000, force: true });
    await page.waitForTimeout(400);
  }
  if (await active('#screen-auth')) {
    await page.fill('#auth-username', 'PemainHebat');
    await page.fill('#auth-password', '1234');
    await page.click('#auth-submit');
  }
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 }).catch(() => {});
  for (let k = 0; k < 8; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip', { timeout: 1500 }).catch(() => {}); await page.waitForTimeout(350); }
}

try {
  // ---- 1) layar pilih map: 5 entri +_thumb jantung ----
  await bootToDashboard();
  await page.evaluate(() => window.__IMUNVERSE.screenManager.show('arena'));
  await page.waitForTimeout(900);
  const items = await page.evaluate(() => ({
    n: document.querySelectorAll('.arena-item').length,
    names: [...document.querySelectorAll('.arena-item')].map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)),
    jantungImg: [...document.querySelectorAll('.arena-item img')].some((i) => (i.getAttribute('src') || '').includes('jantung')),
  }));
  log('map-select-5', items.n === 5, JSON.stringify(items.names));
  log('map-select-jantung-thumb', items.jantungImg === true);
  await page.screenshot({ path: 'shots/review/map-select.png' });
  // gulir ke bawah agar Bilik Jantung (item ke-5) tertangkap kamera
  await page.evaluate(() => { const items = document.querySelectorAll('.arena-item'); if (items.length) items[items.length - 1].scrollIntoView({ block: 'end' }); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'shots/review/map-select-2.png' });

  // ---- 2) gameplay tiap map ----
  for (const id of ['limfe', 'lambung', 'paru', 'saraf', 'jantung']) {
    await bootToDashboard();
    await page.evaluate((arenaId) => {
      const I = window.__IMUNVERSE;
      I.STATE.meta.selectedMode = 'endless';
      I.STATE.meta.selectedArena = arenaId;
    }, id);
    await page.click('#btn-play', { timeout: 8000, force: true });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const p = window.__IMUNVERSE.game.run.player; p.maxHP = 50000; p.hp = 50000; p.iframes = 99999; });
    await page.waitForTimeout(4000); // biarkan combat + elemen khas beranimasi
    const got = await page.evaluate(() => window.__IMUNVERSE.game.run.arena.id);
    log(`map-arena-${id}`, got === id, `run.arena=${got}`);
    await page.screenshot({ path: `shots/review/map-${id}.png` });
  }
  log('zero-pageerror', errors.length === 0, errors.join(' | ').slice(0, 300));
} finally {
  await browser.close();
}
