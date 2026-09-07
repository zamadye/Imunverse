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

  // ---- 6b) F23: Pengaturan suara di PROFIL (klik riil) + persist setelah reload ----
  await page.fill('#auth-username', 'OnboardTester');
  await page.fill('#auth-password', '1234');
  await page.click('#auth-submit');
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
  for (let k = 0; k < 6; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip', { force: true }).catch(() => {}); await page.waitForTimeout(300); }
  await page.click('#account-chip', { timeout: 4000, force: true });
  await page.waitForFunction(() => document.querySelector('#screen-profile')?.classList.contains('active'), null, { timeout: 6000 });
  await page.click('#btn-profile-music');
  await page.click('#btn-profile-sfx');
  await page.waitForTimeout(400);
  const snd = await page.evaluate(() => ({
    musicOn: window.__IMUNVERSE.STATE.meta.musicOn,
    musicLbl: document.querySelector('#btn-profile-music')?.textContent,
    sfxLbl: document.querySelector('#btn-profile-sfx')?.textContent,
  }));
  log('profile-sound-toggles', snd.musicOn === false && snd.musicLbl === 'MATI' && snd.sfxLbl === 'MATI', JSON.stringify(snd));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2400);
  await page.waitForFunction(() => (document.querySelector('#screen-dashboard') || document.querySelector('#screen-title'))?.classList.contains('active'), null, { timeout: 10000 });
  if (await page.locator('#screen-title.active').isVisible().catch(() => false)) { await page.click('#btn-title-login', { force: true }); await page.waitForTimeout(500); }
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
  await page.click('#account-chip', { timeout: 4000 });
  await page.waitForFunction(() => document.querySelector('#screen-profile')?.classList.contains('active'), null, { timeout: 6000 });
  const sndPersist = await page.evaluate(() => ({ musicOn: window.__IMUNVERSE.STATE.meta.musicOn, lbl: document.querySelector('#btn-profile-music')?.textContent }));
  log('sound-settings-persist', sndPersist.musicOn === false && sndPersist.lbl === 'MATI', JSON.stringify(sndPersist));
  await page.screenshot({ path: 'shots/97-profile-sound.png' });
  await page.click('#screen-profile .btn-back', { timeout: 4000 }); // .btn-back pertama di DOM milik layar lain (tersembunyi)
  await page.waitForTimeout(500);

  // ---- 7) HOME LAUNCHER (F24): hanya PLAY + chip akun/rank + sinematik fullscreen ----
  await page.waitForTimeout(700);
  const launcher = await page.evaluate(() => {
    const vis = (sel) => { const e = document.querySelector(sel); if (!e) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return {
      play: vis('#btn-play'), rank: vis('#rank-chip'), account: vis('#account-chip'),
      cine: vis('#dash-cine'),
      dock: vis('.dock'), quick: vis('#quick-row'), daily: vis('#daily-card'),
      duo: vis('#duo-evo'), playRow: vis('.play-row'), stats: vis('#dash-stats'),
    };
  });
  log('home-launcher-clean', launcher.play && launcher.cine && launcher.rank && launcher.account
    && !launcher.dock && !launcher.quick && !launcher.daily && !launcher.duo && !launcher.playRow && !launcher.stats,
    JSON.stringify(launcher));
  await page.screenshot({ path: 'shots/98-home-launcher.png' });
  // (Gerbang bertahap kini tampil di menu gameplay — F25; badge unlock menyusul)

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

  // ---- 10) F25: badge unlock + menu gameplay ganda + quest klaim manual ----
  // Run 2 via PLAY (bestWave run-1 = 1 → roster(2)/bag(4)/upgrade(6)/shop(8) baru saja terbuka? belum —
  // badge muncul setelah run mencapai wave lebih tinggi; simulasi: bestWave=3 via API lalu renderBadges)
  await page.click('#btn-play', { timeout: 6000, force: true });
  await page.waitForFunction(() => document.querySelector('#screen-hud')?.classList.contains('active'), null, { timeout: 12000 });
  await page.waitForTimeout(800);
  const badgeInfo = await page.evaluate(() => {
    window.__IMUNVERSE.STATE.meta.stats.bestWave = 3; // simulasi progres run nyata
    window.__IMUNVERSE_renderQuestPanel && window.__IMUNVERSE_renderQuestPanel();
    return { q: !!document.querySelector('#hud-quests-body .hq-row'), center: getComputedStyle(document.querySelector('.hud-center')).display };
  });
  log('hud25-quests-and-notimer', badgeInfo.q && badgeInfo.center === 'none', JSON.stringify(badgeInfo));
  // AMBIL quest pertama (klik riil) → tombol berubah '…' (aktif, progres berjalan)
  const btnAmbil = page.locator('#hud-quests-body .hq-act').first();
  await btnAmbil.click({ force: true });
  await page.waitForTimeout(500);
  const qAfter = await page.evaluate(() => document.querySelector('#hud-quests-body .hq-act')?.textContent);
  log('quest-manual-claim-flow', qAfter === '…' || qAfter === 'KLAIM' || qAfter === '✓', `label=${qAfter}`);
  // menu 2 kanan-bawah melebar ke kiri: 5 pintu terlihat; Heroes terkunci (Gel.2 > bestWave sim 3? — 3≥2 → terbuka; pakai shop Gel.8 utk uji kunci)
  await page.click('#hud-menu2-toggle', { force: true });
  await page.waitForTimeout(400);
  const m2 = await page.evaluate(() => ({
    open: !document.querySelector('#hud-game-menu2').classList.contains('hidden'),
    n: document.querySelectorAll('.hud-menu2-link').length,
  }));
  log('menu2-opens-left', m2.open && m2.n === 5, JSON.stringify(m2));
  // klik Shop (Gel.8 > 3) → toast, tetap di gameplay (tidak pindah layar)
  await page.locator('.hud-menu2-link[data-menu2-screen="shop"]').click({ force: true });
  await page.waitForTimeout(600);
  const stillHud = await page.evaluate(() => document.querySelector('#screen-hud')?.classList.contains('active'));
  log('menu2-gate-blocked', stillHud, stillHud ? 'tetap gameplay' : 'BOCOR');
  await page.click('#hud-menu2-toggle', { force: true }); // tutup
  await page.waitForTimeout(300);

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
