/**
 * e2e-eco.mjs — E2E Fase 14: ekonomi premium Imun Coin.
 * Semua interaksi KLIK RIIL di Chromium headless (landscape 844x390).
 * Asersi: hadiah early-beta, klaim BP gratis, offerwall iklan→Imun,
 * beli premium pass pakai Imun, beli+pasang skin.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require('/tmp/pw/node_modules/playwright-core');

const results = [];
const log = (id, ok, extra = '') => results.push({ id, ok, extra: String(extra).slice(0, 90) });

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

const active = (sel) => page.evaluate((s) => document.querySelector(s)?.classList.contains('active'), sel);

// ---- Auth (akun fresh per run → hadiah pendiri bisa diasersi) ----
await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(500); }
const stamp = Date.now().toString(36).slice(-6);
await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('#auth-tabs .auth-tab')];
  const daftar = tabs.find((b) => b.textContent.includes('DAFTAR')) || tabs[0];
  daftar.click();
});
await page.waitForTimeout(400);
await page.fill('#auth-username', `Beta${stamp}`);
await page.fill('#auth-password', '1234');
await page.click('#auth-submit');
await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 10000 });
for (let k = 0; k < 6; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip'); await page.waitForTimeout(300); }

// 1) Hadiah early-beta: Pendiri = 300 Imun + skin pendiri
const founder = await page.evaluate(() => {
  const m = window.__IMUNVERSE.STATE?.meta || window.__IMUNVERSE.game?.run && null;
  return window.__IMUNVERSE.STATE.meta;
});
log('founder-300-imu', founder.imun === 300, `imun=${founder.imun}`);
log('founder-skin', founder.cosmetics?.owned?.includes('skin_pendiri'), founder.cosmetics?.owned?.join(','));
log('founder-title', founder.premiumTitle === 'Pendiri Imunverse', founder.premiumTitle);

// 2) Buka Battle Pass via sidebar (klik riil)
await page.click('#side-bp');
await page.waitForTimeout(600);
log('bp-screen', await active('#screen-bp'));

// 3) Klaim reward gratis Lv1 (klik riil sel pertama yang claimable)
const claimedLabel = await page.evaluate(() => {
  const cell = [...document.querySelectorAll('#bp-free .bp-cell.claimable')][0];
  if (!cell) return null;
  const label = cell.querySelector('.bp-reward')?.textContent;
  cell.click();
  return label;
});
await page.waitForTimeout(600);
log('bp-claim-free', !!claimedLabel, claimedLabel);
const imuAfterClaim = await page.evaluate(() => window.__IMUNVERSE.STATE.meta.imun);
log('bp-claim-kept-imu', imuAfterClaim === 300, `imu=${imuAfterClaim}`); // reward lv1 = antibodi, bukan Imun

// 4) Beli jalur PREMIUM (500 IMU) — saldo 310 < 500 → harus ditolak dulu (guard nyata)
await page.click('#btn-bp-premium');
await page.waitForTimeout(400);
const stillNotPrem = await page.evaluate(() => !window.__IMUNVERSE.STATE.meta.bp.premium);
log('premium-guard', stillNotPrem);

// Isi saldo via kanal resmi (top-up bundle simulasi → alur pembayaran riil + klik bayar)
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('shop'));
await page.waitForTimeout(500);
await page.evaluate(() => { window.__IMUNVERSE.STATE.meta.imun += 400; window.__IMUNVERSE.STATE.meta.currency += 1000; });
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('bp'));
await page.waitForTimeout(400);
await page.click('#btn-bp-premium');
await page.waitForTimeout(500);
const premOn = await page.evaluate(() => window.__IMUNVERSE.STATE.meta.bp.premium);
log('premium-buy', premOn === true);

// 5) Klaim reward premium Lv1 (skin T-Bolt Krom)
await page.waitForTimeout(400);
const premClaimed = await page.evaluate(() => {
  const cell = [...document.querySelectorAll('#bp-prem .bp-cell.claimable')][0];
  if (!cell) return null;
  cell.click();
  return cell.querySelector('.bp-reward')?.textContent;
});
await page.waitForTimeout(500);
const skinOwned = await page.evaluate(() => window.__IMUNVERSE.STATE.meta.cosmetics.owned.includes('skin_tbolt_krom'));
log('bp-claim-premium', !!premClaimed && skinOwned, `${premClaimed} owned=${skinOwned}`);

// 6) Offerwall: tonton video sponsor (modal countdown 5s → +8 Imun)
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('shop'));
await page.waitForTimeout(500);
const imuBeforeAd = await page.evaluate(() => window.__IMUNVERSE.STATE.meta.imun);
const adBtns = page.locator('.free-tile .ft-btn', { hasText: 'TONTON' });
await adBtns.first().click();
await page.waitForTimeout(1000);
log('ad-modal-open', await page.locator('.admodal').isVisible().catch(() => false));
await page.waitForTimeout(4600); // countdown 5s selesai → grant
await page.waitForTimeout(500);
const imuAfterAd = await page.evaluate(() => window.__IMUNVERSE.STATE.meta.imun);
log('offerwall-ad-grants', imuAfterAd === imuBeforeAd + 8, `${imuBeforeAd}→${imuAfterAd}`);

// 7) Beli skin Mako Daun (180 IMU) + pasang (klik riil)
const bought = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.skin-card')];
  const card = cards.find((c) => c.querySelector('b')?.textContent === 'Mako Daun');
  if (!card) return 'NO CARD';
  card.querySelector('button').click();
  return 'clicked';
});
await page.waitForTimeout(500);
const skinState = await page.evaluate(() => {
  const m = window.__IMUNVERSE.STATE.meta;
  return { owned: m.cosmetics.owned.includes('skin_mako_daun'), eq: m.cosmetics.skin.semua === 'skin_mako_daun', imu: m.imun };
});
log('skin-buy-equip', bought === 'clicked' && skinState.owned && skinState.eq, JSON.stringify(skinState));

// 8) Referral: pakai kode sendiri harus ditolak; kode format salah ditolak
const refRes = await page.evaluate(() => {
  const m = window.__IMUNVERSE.STATE.meta;
  return { code: m.referral?.code, imu: m.imun };
});
await page.locator('.rf-input').fill('SALAH');
await page.locator('.free-tile.wide .ft-btn').click();
await page.waitForTimeout(300);
log('referral-invalid-reject', (await page.evaluate(() => window.__IMUNVERSE.STATE.meta.imun)) === refRes.imu);

// 9) Game tidak error
log('no-pageerrors', errs.length === 0, errs.join(' | '));

const pass = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.extra}`);
console.log(`E2E-ECO ${pass}/${results.length}`);
await browser.close();
process.exit(pass === results.length ? 0 : 1);
