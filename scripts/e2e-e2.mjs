/**
 * e2e-e2.mjs — Phase E2 (Polish lanjutan): verifikasi 6 poin user.
 *  1 profil+HP+XP pindah ke kiri-ATAS
 *  2 menu hero (menu2) pindah ke BAWAH dekat skill
 *  3 ikon skill/serang = mekanisme imun nyata (antibodi-Y, perforin, MAC, NET)
 *  4 cinematic home memakai SPRITE GAME ASLI (hero & musuh), bukan blob
 *  5 quest tanpa tombol AMBIL — hanya KLAIM saat selesai
 *  6 wave milestone → cinematic 3 babak → resume → RIA menyambut
 * Jalankan: node scripts/e2e-e2.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require(process.env.PW_PATH || '/tmp/pw/node_modules/playwright-core');

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs:/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
let pass = 0, fail = 0;
const log = (k, v, extra) => {
  if (v === true) pass++; else if (v === false) fail++;
  console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${extra ? ' ' + extra : ''}`);
};

try {
  await page.goto('http://localhost:8000/?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }

  // ---- POIN 4: cine-banner memuat sprite game asli ----
  const cine = await page.evaluate(async () => {
    const src = await (await fetch('/js/render/cine-banner.js')).text();
    return {
      heroSprite: src.includes('hero_macrophage_idle.png') && src.includes('hero_macrophage_attack.png'),
      enemySprite: src.includes('enemy_virus.png') && src.includes('enemy_bakteri.png'),
      drawChar: src.includes('function drawChar'),
    };
  });
  log('p4-cine-real-hero-sprite', cine.heroSprite === true);
  log('p4-cine-real-enemy-sprite', cine.enemySprite === true);
  log('p4-cine-drawchar', cine.drawChar === true);

  // ---- Mulai run ----
  await page.evaluate(() => window.__IMUNVERSE.game.startRun('macrophage'));
  await page.waitForTimeout(1000);

  // ---- POIN 1: profil+HP di kiri-ATAS; XP tepat di bawahnya ----
  const lay = await page.evaluate(() => {
    const r = (sel) => document.querySelector('#screen-hud ' + sel).getBoundingClientRect();
    const hero = r('.hud-hero-status'), xp = r('.hud-xp-top');
    const fire = r('.fire-btn'), m2 = r('.hud-menu2-toggle');
    const coins = r('.hud-stat-right');
    return {
      heroTop: hero.top < 60, heroLeft: hero.left < 40,
      xpUnderHero: xp.top > hero.bottom - 6 && xp.top < hero.bottom + 40 && xp.left < 40,
      coinsOnScreen: coins.right <= window.innerWidth + 1 && coins.top < 60,
      m2Bottom: m2.top > window.innerHeight * 0.6,
      m2NearSkills: Math.abs(m2.bottom - fire.bottom) < 90,
      m2LeftOfFire: m2.right < fire.left,
    };
  });
  log('p1-profil-kiri-atas', lay.heroTop && lay.heroLeft, JSON.stringify(lay));
  log('p1-xp-di-bawah-profil', lay.xpUnderHero === true);
  log('p1-koin-pause-tetap-terlihat', lay.coinsOnScreen === true);

  // ---- POIN 2: menu2 di bawah dekat skill ----
  log('p2-menu2-di-bawah', lay.m2Bottom === true);
  log('p2-menu2-dekat-skill', lay.m2NearSkills && lay.m2LeftOfFire);

  // ---- POIN 3: ikon = mekanisme imun nyata ----
  const icons = await page.evaluate(async () => {
    // UI/UX BUILD 43: sumber ikon skill pindah ke js/ui/skill-icons.js; SERANG = img hud-serang.svg
    const src = await (await fetch('/js/ui/skill-icons.js')).text();
    const fire = document.querySelector('#btn-fire .fire-claw img');
    const fireSvgText = fire ? await (await fetch(fire.getAttribute('src'))).text() : '';
    return {
      immuneTerms: ['perforin', 'fagositosis', 'opsonisasi', 'MAC', 'NET'].every((t) => src.includes(t)),
      fireSvg: !!fire && fire.complete && fire.naturalWidth > 0,
      fireAntibody: /antibodi-Y/i.test(fireSvgText),
      glyphs: document.querySelectorAll('#screen-hud .ability-btn .sk-glyph svg').length,
    };
  });
  log('p3-glyph-immune-mechanisms', icons.immuneTerms === true);
  log('p3-fire-antibody-icon', icons.fireSvg && icons.fireAntibody);
  log('p3-glyphs-rendered', icons.glyphs >= 3, `n=${icons.glyphs}`);

  // ---- POIN 5: quest panel tanpa AMBIL, KLAIM saat done ----
  const quest = await page.evaluate(async () => {
    window.__IMUNVERSE_renderQuestPanel();
    await new Promise((r) => setTimeout(r, 200));
    const btns = [...document.querySelectorAll('#hud-quests-body .hq-act')].map((b) => b.textContent);
    const rows = document.querySelectorAll('#hud-quests-body .hq-row').length;
    // paksa satu quest selesai → tombol KLAIM muncul
    const { getQuestProgress } = await import('/js/systems/mission-system.js');
    const meta = window.__IMUNVERSE.STATE.meta;
    const q = getQuestProgress(meta).find((x) => !x.claimed);
    let claimBtn = null;
    if (q) {
      const st = meta.questState;
      st.baseline[q.def.id] = -999999; // progres pasti tembus target
      window.__IMUNVERSE_renderQuestPanel();
      await new Promise((r) => setTimeout(r, 200));
      claimBtn = [...document.querySelectorAll('#hud-quests-body .hq-act')].map((b) => b.textContent);
    }
    return { rows, noAmbil: !btns.includes('AMBIL'), noDots: !btns.includes('…'), claimBtn };
  });
  log('p5-no-ambil-button', quest.noAmbil && quest.noDots, JSON.stringify(quest.claimBtn));
  log('p5-rows-rendered', quest.rows > 0, `rows=${quest.rows}`);
  log('p5-klaim-when-done', Array.isArray(quest.claimBtn) && quest.claimBtn.includes('KLAIM'));

  // ---- POIN 6: wave milestone → cinematic → resume → RIA ----
  const wc = await page.evaluate(async () => {
    const ui = await import('/js/core/ui-bridge.js');
    ui.emit('waveBreak', { wave: 5 }); // milestone (bossWaveEvery=5)
    await new Promise((r) => setTimeout(r, 700));
    const layer = document.getElementById('wave-cine-layer');
    const paused = window.__IMUNVERSE.STATE.paused;
    const pauseModal = document.getElementById('screen-pause')?.classList.contains('active');
    const title = layer ? layer.querySelector('.wave-cine-title').textContent : '';
    return { layerOn: !!layer, paused, noPauseModal: !pauseModal, title };
  });
  log('p6-cine-on-milestone', wc.layerOn === true, wc.title);
  log('p6-gameplay-paused', wc.paused === true);
  log('p6-no-pause-modal', wc.noPauseModal === true);

  // skip → resume + RIA menyambut
  const after = await page.evaluate(async () => {
    document.getElementById('wave-cine-skip').click();
    await new Promise((r) => setTimeout(r, 900));
    const layerGone = !document.getElementById('wave-cine-layer');
    const resumed = !window.__IMUNVERSE.STATE.paused;
    const pres = document.getElementById('presenter-layer');
    const riaOn = pres && pres.classList.contains('on')
      && document.getElementById('presenter-name').textContent === 'RIA';
    const m = await import('/js/ui/presenter.js');
    m.hidePresenter();
    return { layerGone, resumed, riaOn };
  });
  log('p6-skip-closes', after.layerGone === true);
  log('p6-resume-gameplay', after.resumed === true);
  log('p6-ria-welcomes-back', after.riaOn === true);

  // wave biasa (bukan milestone) → TIDAK ada cinematic
  const normal = await page.evaluate(async () => {
    const ui = await import('/js/core/ui-bridge.js');
    ui.emit('waveBreak', { wave: 3 });
    await new Promise((r) => setTimeout(r, 500));
    const noCine = !document.getElementById('wave-cine-layer');
    const m = await import('/js/ui/presenter.js');
    m.hidePresenter();
    return noCine;
  });
  log('p6-normal-wave-no-cine', normal === true);

  log('no-page-errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  console.error('SUITE ERROR:', e.message);
  fail++;
} finally {
  await browser.close();
}
console.log(`\nE2: ${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
