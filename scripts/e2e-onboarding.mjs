/**
 * e2e-onboarding.mjs — F21: GAMEPLAY-FIRST (feedback pemilik).
 * User baru: layar judul MULAI → sinematik cerita → LANGSUNG gameplay
 * (bukan dashboard/daftar akun) → coach hint → akhir run → akun WAJIB →
 * dashboard dengan menu terkunci bertahap. Level-up tampil sebagai SCENE.
 * Semua klik riil.
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
  await page.waitForTimeout(2600);

  // ---- 1) Tanpa akun → TITLE screen (bukan auth/dashboard) ----
  log('title-screen-first', await page.evaluate(() => document.querySelector('#screen-title')?.classList.contains('active')));

  // i18n title: klik EN
  await page.click('#btn-lang-title', { timeout: 3000 });
  await page.waitForTimeout(500);
  const titleEn = await page.evaluate(() => document.querySelector('#btn-title-start span')?.textContent);
  log('title-i18n-en', titleEn === 'START', `text=${titleEn}`);
  await page.click('#btn-lang-title', { timeout: 3000 }); // balik ID
  await page.waitForTimeout(400);

  // ---- 2) MASUK tetap tersedia untuk pemain lama ----
  // (diverifikasi di ujung: setelah akun dibuat, reload → tidak ke title)

  // ---- 3) MULAI → sinematik cerita → LANGSUNG gameplay ----
  await page.click('#btn-title-start', { timeout: 4000, force: true }); // tombol beranimasi pulse
  await page.waitForTimeout(900);
  const cine = await page.evaluate(() => !document.getElementById('cinematic-layer')?.classList.contains('hidden'));
  log('onboarding-cinematic-plays', cine);
  const cineText = await page.evaluate(() => document.getElementById('cine-text')?.textContent || '');
  log('onboarding-story-text', /Mako|virus/i.test(cineText), cineText.slice(0, 60));
  await page.click('#cine-skip', { timeout: 3000 });
  await page.waitForTimeout(900);

  // LANGSUNG gameplay — tanpa dashboard/auth di antara
  const direct = await page.evaluate(() => ({
    hud: document.querySelector('#screen-hud')?.classList.contains('active'),
    dash: document.querySelector('#screen-dashboard')?.classList.contains('active'),
    auth: document.querySelector('#screen-auth')?.classList.contains('active'),
  }));
  log('straight-to-gameplay', direct.hud && !direct.dash && !direct.auth, JSON.stringify(direct));
  await page.waitForTimeout(1200);

  // ---- 4) Coach/petunjuk cara main muncul di run pertama ----
  let coachSeen = false;
  for (let k = 0; k < 10; k++) {
    // petunjuk cara main = tutorial in-run (bubble "Tarik di layar…") atau coach
    const hint = await page.evaluate(() => {
      const tl = document.getElementById('tutorial-layer');
      const tutOn = tl && tl.style.display !== 'none' && tl.childElementCount > 0;
      const tip = document.getElementById('coach-tip');
      return { tutOn, tipOn: !!(tip && tip.offsetParent) };
    });
    if (hint.tutOn || hint.tipOn) { coachSeen = true; break; }
    const lu = await page.evaluate(() => document.querySelector('#screen-levelup')?.classList.contains('active'));
    if (lu) { await page.locator('#levelup-choices .choice-card').first().click({ force: true }).catch(() => {}); await page.waitForTimeout(400); continue; }
    const tut = page.locator('.tut-skip');
    if (await tut.isVisible().catch(() => false)) { await tut.click().catch(() => {}); await page.waitForTimeout(300); continue; }
    await page.waitForTimeout(400);
  }
  log('coach-hints-in-first-run', coachSeen);

  // ---- 5) Level-up = SCENE (potret hero + animasi), bukan modal tiba-tiba ----
  await page.evaluate(() => { window.__IMUNVERSE.game.addXP(500); }); // jalur riil → level-up
  await page.waitForTimeout(700);
  const luScene = await page.evaluate(() => {
    const active = document.querySelector('#screen-levelup.active');
    if (!active) return { open: false };
    return {
      open: true,
      hero: !!document.getElementById('levelup-hero')?.src,
      sub: document.getElementById('levelup-sub')?.textContent || '',
      cards: document.querySelectorAll('#levelup-choices .choice-card').length,
      scene: !!document.querySelector('#screen-levelup .lu-scene'),
    };
  });
  log('levelup-is-scene', luScene.open && luScene.scene && luScene.hero && luScene.cards === 3, JSON.stringify(luScene));
  log('levelup-story-subtitle', /beradaptasi/.test(luScene.sub || ''), luScene.sub);
  if (luScene.open) {
    for (let k = 0; k < 10; k++) {
      const open = await page.evaluate(() => document.querySelector('#screen-levelup')?.classList.contains('active'));
      if (!open) break;
      await page.locator('#levelup-choices .choice-card').first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(450);
    }
  }

  // ---- 6) Akhiri run → klik Dashboard → AKUN WAJIB (belum punya akun) ----
  for (let k = 0; k < 14; k++) {
    if (await page.locator('#screen-revive.active').isVisible().catch(() => false)) break;
    if (await page.evaluate(() => window.__IMUNVERSE.game.run && window.__IMUNVERSE.game.run.ended)) break;
    await page.evaluate(() => { const g = window.__IMUNVERSE.game; const p = g.run.player; p.iframes = 0; p.takeDamage(p.hp + 10); });
    await page.waitForTimeout(700);
  }
  if (await page.locator('#screen-revive.active').isVisible().catch(() => false)) { await page.click('#btn-skip-revive', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700); }
  if (!(await page.evaluate(() => document.querySelector('#screen-gameover')?.classList.contains('active')))) {
    await page.click('#btn-pause', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.click('#btn-quit-run', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  await page.waitForFunction(() => document.querySelector('#screen-gameover')?.classList.contains('active'), null, { timeout: 8000 });
  await page.click('#btn-home', { timeout: 4000 });
  await page.waitForTimeout(700);
  const authRequired = await page.evaluate(() => document.querySelector('#screen-auth')?.classList.contains('active'));
  log('account-required-after-first-run', authRequired);

  // ---- 7) Daftar → dashboard dengan MENU TERKUNCI bertahap ----
  await page.fill('#auth-username', 'OnboardTester');
  await page.fill('#auth-password', '1234');
  await page.click('#auth-submit');
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
  await page.waitForTimeout(700);
  const gates = await page.evaluate(() => {
    const dock = [...document.querySelectorAll('.dock-btn[data-nav]')].map((b) => ({
      nav: b.dataset.nav, gated: b.classList.contains('gated'),
      lock: b.querySelector('.gate-lock')?.textContent || null,
    }));
    const tiles = [...document.querySelectorAll('#quick-row .quick-tile')].map((b) => ({
      gated: b.classList.contains('gated'),
      lock: b.querySelector('.gate-lock')?.textContent || null,
    }));
    return { dock, gatedTiles: tiles.filter((t) => t.gated).length, openTiles: tiles.length - tiles.filter((t) => t.gated).length };
  });
  // F21: pemain baru = semua menu ekstra terkunci (Play/Home selalu terbuka);
  // label syarat "🔒 Gel.N" terlihat — menu muncul bertahap jam/hari bermain
  log('dock-gated-gradually', gates.dock.length === 4 && gates.dock.every((d) => d.gated && /Gel\.\d/.test(d.lock || '')), JSON.stringify(gates.dock));
  log('quick-tiles-gated', gates.gatedTiles >= 2 && gates.openTiles >= 1, `gated=${gates.gatedTiles} open=${gates.openTiles}`);

  // klik tile terkunci → toast, TIDAK pindah layar
  const beforeScreen = await page.evaluate(() => window.__IMUNVERSE.STATE.screen);
  await page.locator('#quick-row .quick-tile.gated').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  const afterScreen = await page.evaluate(() => window.__IMUNVERSE.STATE.screen);
  log('gated-click-blocked', beforeScreen === afterScreen, `${beforeScreen}→${afterScreen}`);

  // ---- 8) Dock ramping: tinggi dock < 30% viewport ----
  const dockH = await page.evaluate(() => Math.round(document.querySelector('.dock').getBoundingClientRect().height));
  log('dock-compact', dockH <= 100, `h=${dockH}px (viewport 390)`);

  // ---- 9) Reload dengan akun → TIDAK ke title (alur lama untuk pemain lama) ----
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip', { timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400); }
  await page.waitForTimeout(600);
  const returning = await page.evaluate(() => ({
    dash: document.querySelector('#screen-dashboard')?.classList.contains('active'),
    title: document.querySelector('#screen-title')?.classList.contains('active'),
  }));
  log('returning-skips-title', returning.dash && !returning.title, JSON.stringify(returning));

  log('no-pageerrors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  await page.screenshot({ path: '/tmp/fail-onboarding.png' });
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
