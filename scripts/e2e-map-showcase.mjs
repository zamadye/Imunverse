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
const log = (k, v, d) => console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${d !== undefined ? ' ' + d : v === true || v === false ? '' : ' ' + v}`);
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
    // ---- jelajah jauh: teleport + kamera menyusul, tanah harus ikut ----
    await page.evaluate(() => { const p = window.__IMUNVERSE.game.run.player; p.x += 650; p.y += 420; });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `shots/review/map-${id}-roam.png` });
    const ground = await page.evaluate(() => {
      const I = window.__IMUNVERSE;
      const hex = I.game.run.arena.palette.hex || '#e2ecc9';
      const n = parseInt(hex.slice(1), 16);
      const base = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      const cv = document.getElementById('game');
      const g = cv.getContext('2d');
      const sx = cv.width / 844, sy = cv.height / 390;
      let ok = 0;
      for (const [x, y] of [[282, 115], [562, 115], [282, 275], [562, 275]]) {
        const d = g.getImageData(Math.round(x * sx), Math.round(y * sy), 1, 1).data;
        if (Math.hypot(d[0] - base[0], d[1] - base[1], d[2] - base[2]) < 70) ok++;
      }
      return { ok, hex };
    });
    log(`map-roam-ground-${id}`, ground.ok >= 3, `${ground.ok}/4 ~ ${ground.hex}`);
    // ---- performa: rata-rata frame < 33ms (batas low-end) ----
    const ms = await page.evaluate(() => new Promise((res) => {
      const N = 90; let last = performance.now(), sum = 0, n = 0;
      const fr = (t) => { if (n > 0) sum += t - last; last = t; if (++n < N) requestAnimationFrame(fr); else res(sum / (N - 1)); };
      requestAnimationFrame(fr);
    }));
    log(`map-perf-${id}`, ms < 33, `${ms.toFixed(1)}ms`);
  }
  // ---- 3) regresi: pilihan arena MENANG di mode kampanye (issue merge main) ----
  await bootToDashboard();
  await page.evaluate(() => {
    const I = window.__IMUNVERSE;
    I.STATE.meta.selectedMode = 'kampanye';
    I.STATE.meta.selectedChapter = 'bab_luka';
    I.STATE.meta.cinematicsSeen = { ...I.STATE.meta.cinematicsSeen, brief_bab_luka: true }; // lewati briefing
    I.screenManager.show('prep');
  });
  await page.waitForTimeout(500);
  const presel = await page.evaluate(() => window.__IMUNVERSE.STATE.meta.selectedArena);
  log('map-campaign-default-limfe', presel === 'limfe', `presel=${presel}`);
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('#prep-arena-row .prep-chip'));
    chips[chips.length - 1].click(); // Bilik Jantung
  });
  await page.waitForTimeout(300);
  await page.click('#btn-prep-start');
  await page.waitForTimeout(2000);
  const campArena = await page.evaluate(() => window.__IMUNVERSE.game.run.arena.id);
  log('map-campaign-chip-wins', campArena === 'jantung', `run.arena=${campArena}`);
  await page.screenshot({ path: 'shots/review/map-campaign-jantung.png' });
  log('zero-pageerror', errors.length === 0, errors.join(' | ').slice(0, 300));
} finally {
  await browser.close();
}
