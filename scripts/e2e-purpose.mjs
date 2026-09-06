/**
 * e2e-purpose.mjs — Fase 19: TUJUAN PEMAIN (PANGKAT PENJAGA).
 * Verifikasi KLIK RIIL (bukan API-mock): chip pangkat → modal ladder, GP dari
 * run nyata (kalah pun dapat), ceremony NAIK PANGKAT, musim, i18n EN.
 * Akun khusus: RankTester (biar state bersih dari akun lain).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require('/tmp/pw/node_modules/playwright-core');

const results = [];
function log(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`);
}

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message).split('\n')[0]));

try {
  await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2400);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip', { timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400); }
  await page.fill('#auth-username', 'RankTester');
  await page.fill('#auth-password', '1234');
  await page.click('#auth-submit');
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
  for (let k = 0; k < 8; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip', { timeout: 1200 }).catch(() => {}); await page.waitForTimeout(250); }
  await page.waitForTimeout(600);

  // ---- 1) Chip pangkat tampil + pangkat awal ----
  log('rank-chip-visible', await page.locator('#rank-chip').isVisible());
  const chip0 = await page.evaluate(() => ({
    tier: document.getElementById('rank-tier-name').textContent,
    sub: document.getElementById('rank-sub').textContent,
    gp: (window.__IMUNVERSE && window.__IMUNVERSE.STATE.meta.rank && window.__IMUNVERSE.STATE.meta.rank.gp) || 0,
  }));
  log('rank-initial-sel-baru', chip0.tier === 'Sel Baru', JSON.stringify(chip0));

  // ---- 2) Klik riil chip → modal PANGKAT PENJAGA ----
  await page.click('#rank-chip', { timeout: 4000 });
  await page.waitForTimeout(500);
  log('rank-modal-opens', await page.evaluate(() => document.querySelector('#screen-rank')?.classList.contains('active')));
  log('ladder-13-rows', await page.evaluate(() => document.querySelectorAll('#rank-ladder .rank-row').length === 13));
  log('ladder-current-highlighted', await page.evaluate(() => !!document.querySelector('#rank-ladder .rank-row.current')));
  const seasonLine = await page.evaluate(() => document.getElementById('rank-season-line').textContent);
  log('season-line-shown', /Musim \d+/.test(seasonLine) && /hari/.test(seasonLine), seasonLine);
  // tutup via klik riil
  await page.click('#btn-rank-close', { timeout: 4000 });
  await page.waitForTimeout(400);
  log('rank-modal-closes', await page.evaluate(() => !document.querySelector('#screen-rank')?.classList.contains('active')));

  // ---- 3) Run nyata → GP diberikan (kalah pun dapat — usaha dihargai) ----
  const playRun = async () => {
    await page.evaluate(() => { const sc = document.querySelector('.dash-scroll'); if (sc) sc.scrollTop = 0; });
    await page.click('#btn-play-big');
    await page.waitForTimeout(700);
    await page.locator('.camp-node:not(.locked)').first().click();
    await page.waitForTimeout(400);
    await page.click('#btn-campaign-go', { timeout: 8000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('.prep-start')?.scrollIntoView({ block: 'center' }));
    await page.click('#btn-prep-start', { timeout: 8000 });
    await page.waitForTimeout(900);
    for (let k = 0; k < 4; k++) { if (!(await page.locator('#cine-skip').isVisible().catch(() => false))) break; await page.click('#cine-skip'); await page.waitForTimeout(350); }
    await page.waitForFunction(() => document.querySelector('#screen-hud')?.classList.contains('active'), null, { timeout: 15000 });
    await page.waitForTimeout(1200);
    const tut = page.locator('.tut-skip');
    if (await tut.isVisible().catch(() => false)) { await tut.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400); }
  };
  const closeLU = async () => {
    for (let k = 0; k < 12; k++) {
      const open = await page.evaluate(() => document.querySelector('#screen-levelup')?.classList.contains('active'));
      if (!open) break;
      await page.locator('#levelup-choices .choice-card').first().click({ force: true, timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(450);
    }
  };
  const endRunByDeath = async () => {
    // realistis: player tumbang → modal revive → klik riil "Tidak, Akhiri Run"
    for (let k = 0; k < 10; k++) {
      if (await page.locator('#screen-revive.active').isVisible().catch(() => false)) break;
      await closeLU(); // modal level-up menyela → tutup dulu (pause menggagalkan death)
      await page.evaluate(() => {
        const g = window.__IMUNVERSE.game;
        const p = g.run.player;
        p.iframes = 0;
        p.takeDamage(p.hp + 10);
      });
      await page.waitForTimeout(700);
    }
    const reviveOpen = await page.locator('#screen-revive.active').isVisible().catch(() => false);
    if (reviveOpen) { await page.click('#btn-skip-revive', { timeout: 3000 }); await page.waitForTimeout(600); }
    // fallback: pause → akhiri run
    if (!(await page.evaluate(() => document.querySelector('#screen-gameover')?.classList.contains('active')))) {
      await closeLU();
      await page.click('#btn-pause', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      await page.click('#btn-quit-run', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
    }
    await page.waitForFunction(() => document.querySelector('#screen-gameover')?.classList.contains('active'), null, { timeout: 8000 });
  };

  await playRun();
  await endRunByDeath();
  const rankLine = await page.evaluate(() => document.querySelector('.go-parts.go-rank')?.textContent || '');
  log('gp-awarded-on-run', /\+\d+ GP/.test(rankLine), rankLine);
  // kembali ke dashboard
  await page.click('#btn-home', { timeout: 4000 });
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
  await page.waitForTimeout(600);
  const chip1 = await page.evaluate(() => ({
    gp: window.__IMUNVERSE.STATE.meta.rank.gp,
    sub: document.getElementById('rank-sub').textContent,
  }));
  log('chip-gp-updated', chip1.gp > chip0.gp, JSON.stringify(chip1));

  // ---- 4) Ceremony NAIK PANGKAT (setup: gp tepat di bawah ambang tier 2) ----
  await page.evaluate(() => {
    const meta = window.__IMUNVERSE.STATE.meta;
    const NEED = 250; // ambang Patroli Imun III (data/ranks.json)
    meta.rank.gp = NEED - 5;
    if (window.__IMUNVERSE) { /* sim via save manager pada finishRun */ }
  });
  await playRun();
  await endRunByDeath();
  const rankupShown = await page.evaluate(() => !document.getElementById('go-rankup')?.classList.contains('hidden'));
  const rankupTier = await page.evaluate(() => document.getElementById('go-rankup-tier')?.textContent || '');
  log('rankup-ceremony-shown', rankupShown && /Patroli Imun/.test(rankupTier), rankupTier);
  await page.click('#btn-home', { timeout: 4000 });
  await page.waitForTimeout(600);
  const chip2 = await page.evaluate(() => ({
    tier: document.getElementById('rank-tier-name').textContent,
    gp: window.__IMUNVERSE.STATE.meta.rank.gp,
  }));
  log('tier-promoted-on-chip', chip2.tier === 'Patroli Imun III', JSON.stringify(chip2));

  // ---- 5) i18n: EN mengubah seluruh modal pangkat (ganti bahasa di dashboard,
  //         lalu buka modal — topbar tertutup overlay modal saat modal aktif) ----
  await page.click('#btn-lang-dash', { timeout: 4000 });
  await page.waitForTimeout(600);
  await page.click('#rank-chip', { timeout: 4000 });
  await page.waitForTimeout(400);
  const enState = await page.evaluate(() => ({
    title: document.querySelector('#screen-rank .rank-title')?.textContent.trim(),
    tier: document.getElementById('rank-modal-tier')?.textContent,
    ladderFirst: document.querySelector('#rank-ladder .rank-row b')?.textContent,
  }));
  log('i18n-en-rank', /GUARDIAN RANK/.test(enState.title) && enState.tier === 'Immune Patrol III' && enState.ladderFirst === 'New Cell', JSON.stringify(enState));
  await page.click('#btn-rank-close', { timeout: 3000 }).catch(() => {});
  await page.click('#btn-lang-dash', { timeout: 3000 }).catch(() => {}); // balik ke ID
  await page.waitForTimeout(400);

  log('no-pageerrors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  await page.screenshot({ path: '/tmp/fail-purpose.png' });
  console.log('FATAL', e.message.split('\n')[0]);
  try {
    console.log('STATE:', await page.evaluate(() => JSON.stringify({
      active: [...document.querySelectorAll('.screen.active')].map((s) => s.id),
      screen: window.__IMUNVERSE?.STATE?.screen,
    })));
  } catch (pe) { console.log('state-err', pe.message.split('\n')[0]); }
  console.log('ERRORS:', errors.slice(0, 8).join(' | '));
}
const pass = results.filter((r) => r.ok).length;
console.log(`RESULT: ${pass} PASS, ${results.length - pass} FAIL`);
await browser.close();
process.exit(pass === results.length ? 0 : 1);
