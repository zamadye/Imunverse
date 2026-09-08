/**
 * e2e-r2.mjs — R2 (Rebuild): Narrative Layer.
 * Verifikasi: campaign remap 6 kondisi, migrasi save lama, cutscene dua-lapis
 * (Dr. Amara + RIA), bark boss RIA 1×/run, bark akhir run, coach RIA,
 * glossary, codex id baru. Jalankan: node scripts/e2e-r2.mjs
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
const log = (k, v, extra) => console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${extra ? ' ' + extra : ''}`);
const active = (id) => page.evaluate((s) => document.querySelector(s)?.classList.contains('active') || false, id);

try {
  // ---- 0) Simulasi SAVE LAMA sebelum load (untuk uji migrasi) ----
  await page.goto('http://localhost:8000/?dev=1', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const KEY = Object.keys(localStorage).find((k) => k.includes('imunverse') && k.includes('save')) || 'imunverse.save.v1';
    const old = {
      selectedChapter: 'bab_usus',
      campaignCleared: { bab_mulut: true, bab_lambung: true },
      cinematicsSeen: { onboarding: true, intro: true, brief_bab_mulut: true, clear_bab_mulut: true },
      codexSeen: { bab_paru: true },
      coachDone: true,
      stats: { totalRuns: 6, bestWave: 12 },
    };
    localStorage.setItem(KEY, JSON.stringify(old));
    localStorage.setItem('imunverse.save.v1', JSON.stringify(old));
  });
  await page.goto('http://localhost:8000/?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }
  if (await active('#screen-title')) {
    await page.click('#btn-title-login', { force: true });
    await page.waitForTimeout(400);
    if (await active('#screen-auth')) {
      await page.fill('#auth-username', 'NarasiTester');
      await page.fill('#auth-password', '1234');
      await page.click('#auth-submit');
      await page.waitForTimeout(800);
    }
  }
  for (let k = 0; k < 8; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip').catch(() => {}); await page.waitForTimeout(300); }

  // ---- 1) Campaign = 6 bab kondisi ----
  const camp = await page.evaluate(() => {
    const chs = window.__IMUNVERSE.getData().campaign.chapters;
    return { ids: chs.map((c) => c.id), organs: chs.map((c) => c.organ), bosses: chs.map((c) => c.boss && c.boss.name) };
  });
  const expIds = ['bab_luka', 'bab_demam', 'bab_racun', 'bab_alergi', 'bab_kanker', 'bab_final'];
  log('campaign-6-conditions', JSON.stringify(camp.ids) === JSON.stringify(expIds), JSON.stringify(camp.ids));
  log('campaign-condition-titles', camp.organs[0] === 'Luka Kecil' && camp.organs[5] === 'Pertahanan Terakhir');
  log('campaign-bosses-remap', camp.bosses[1] === 'Raja Flu Mutan' && camp.bosses[4] === 'Bayang Dalam' && camp.bosses[5] === 'Mahakrisis');

  // ---- 2) Migrasi save lama ----
  const mig = await page.evaluate(() => {
    const m = window.__IMUNVERSE.STATE.meta;
    return {
      sel: m.selectedChapter,
      cleared: m.campaignCleared,
      cine: Object.keys(m.cinematicsSeen || {}),
      codex: Object.keys(m.codexSeen || {}),
    };
  });
  log('migrate-selectedChapter', mig.sel === 'bab_racun', mig.sel);
  log('migrate-campaignCleared', mig.cleared.bab_luka === true && mig.cleared.bab_demam === true && !mig.cleared.bab_mulut, JSON.stringify(mig.cleared));
  log('migrate-cinematicsSeen', mig.cine.includes('brief_bab_luka') && !mig.cine.includes('brief_bab_mulut'), JSON.stringify(mig.cine));
  log('migrate-codexSeen', mig.codex.includes('bab_alergi'), JSON.stringify(mig.codex));

  // ---- 3) Cutscene dua-lapis: intro memuat Dr. Amara DAN RIA ----
  const cine = await page.evaluate(() => {
    const scenes = window.__IMUNVERSE.getData().cinematics.scenes;
    const intro = scenes.find((s) => s.id === 'intro');
    const txt = intro.shots.map((s) => s.text).join(' | ');
    const briefs = scenes.filter((s) => s.id.startsWith('brief_'));
    const briefTwoLayer = briefs.every((b) => b.shots.length === 2 && b.shots[0].text.includes('Dr. Amara') && b.shots[1].text.includes('RIA'));
    const epilog = scenes.find((s) => s.id === 'clear_bab_final');
    return {
      introDr: txt.includes('Dr. Amara'), introRia: txt.includes('RIA'),
      nBriefs: briefs.length, briefTwoLayer,
      epilogShots: epilog ? epilog.shots.length : 0,
      epilogReveal: epilog ? epilog.shots.some((s) => s.text.includes('anak kecil')) : false,
    };
  });
  log('intro-two-layers', cine.introDr && cine.introRia);
  log('briefs-doctor-then-ria', cine.nBriefs === 6 && cine.briefTwoLayer, `n=${cine.nBriefs}`);
  log('epilog-host-reveal', cine.epilogShots >= 3 && cine.epilogReveal);

  // ---- 4) narrative.json: glossary ≥9, barks lengkap ----
  const narr = await page.evaluate(() => {
    const n = window.__IMUNVERSE.getData().narrative;
    return {
      guide: n.guide.name, doctor: n.doctor.name,
      gloss: n.glossary.length,
      bossBarks: Object.keys(n.bossBarks).length,
      winB: n.winBarks.length, loseB: n.loseBarks.length,
    };
  });
  log('narrative-data', narr.guide === 'RIA' && narr.doctor === 'Dr. Amara' && narr.gloss >= 9 && narr.bossBarks >= 6 && narr.winB >= 3 && narr.loseB >= 3, JSON.stringify(narr));

  // ---- 5) Bark boss RIA: 1×/run, toast kind ria ----
  const barkUnit = await page.evaluate(async () => {
    const mod = await import('/js/systems/narrative-system.js');
    mod.resetNarrativeRun();
    const t1 = mod.bossBark('bab_kanker');
    const t2 = mod.bossBark('bab_kanker'); // kedua → null (1×/run)
    mod.resetNarrativeRun();
    const t3 = mod.bossBark('bab_tidak_ada'); // fallback default
    return { t1: !!t1 && t1.includes('RIA'), t2: t2 === null, t3: !!t3 };
  });
  log('bossbark-once-per-run', barkUnit.t1 && barkUnit.t2);
  log('bossbark-default-fallback', barkUnit.t3);

  // ---- 6) Bark boss live: mainkan bab dengan kuota kecil ----
  await page.evaluate(() => {
    const m = window.__IMUNVERSE.STATE.meta;
    m.selectedChapter = 'bab_demam'; m.selectedMode = 'kampanye';
    const ch = window.__IMUNVERSE.getData().campaign.chapters.find((c) => c.id === 'bab_demam');
    ch.killQuota = 1; // percepat: 1 kill → boss spawn
    window.__IMUNVERSE.game.startRun(m.selectedHero || 'macrophage');
  });
  await page.waitForTimeout(1200);
  const barkLive = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    g.run.kills = 5; // kuota lewat → frame berikutnya boss + bark
    await new Promise((r) => setTimeout(r, 600));
    const toasts = [...document.querySelectorAll('#toasts .toast')];
    const ria = toasts.find((t) => t.classList.contains('ria'));
    return {
      bossSpawned: g.run.objective && g.run.objective.bossSpawned,
      riaToast: !!ria, text: ria ? ria.textContent.slice(0, 50) : '',
    };
  });
  log('bossbark-live-on-spawn', barkLive.bossSpawned && barkLive.riaToast, barkLive.text);
  await page.screenshot({ path: 'shots/review/r2-ria-bossbark.png' });

  // ---- 7) Bark akhir run di gameover ----
  await page.evaluate(() => window.__IMUNVERSE.game.finishRun(false));
  await page.waitForTimeout(900);
  const goBark = await page.evaluate(() => {
    const b = document.getElementById('go-ria-bark');
    return { has: !!b, text: b ? b.textContent.slice(0, 60) : '' };
  });
  log('gameover-ria-bark', goBark.has, goBark.text);
  await page.screenshot({ path: 'shots/review/r2-gameover-bark.png' });

  // ---- 8) Coach tampil sebagai RIA ----
  const coachRia = await page.evaluate(async () => {
    // paksa render coach layer
    const mod = await import('/js/ui/coach.js');
    if (mod.startIfFirstTime) {
      window.__IMUNVERSE.STATE.meta.coachDone = false;
      window.__IMUNVERSE.screenManager.show('dashboard');
      mod.startIfFirstTime();
    }
    await new Promise((r) => setTimeout(r, 500));
    const g = document.querySelector('.coach-guide');
    return { has: !!g, text: g ? g.textContent : '' };
  });
  log('coach-as-ria', coachRia.has && coachRia.text.includes('RIA'), coachRia.text);

  // ---- 9) Codex id bab baru ----
  const codex = await page.evaluate(() => {
    const c = window.__IMUNVERSE.getData().codex;
    const arr = c.entries || c.items || [];
    const ids = arr.map((e) => e.id);
    return { hasNew: ids.includes('bab_luka') && ids.includes('bab_final'), hasOld: ids.includes('bab_mulut') };
  });
  log('codex-new-chapter-ids', codex.hasNew && !codex.hasOld);

  log('zero-pageerror', errors.length === 0);
  if (errors.length) for (const e of errors.slice(0, 5)) log('err', e);
} catch (e) {
  log('suite-crash', false);
  console.error(e);
} finally {
  await browser.close();
}
