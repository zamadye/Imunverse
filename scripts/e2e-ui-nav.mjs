/**
 * e2e-ui-nav.mjs — UI/UX: navigasi & progressive disclosure (menu gameplay).
 *
 * INFO  = peta hasil audit (tidak dinilai).
 * PASS/FAIL = invarian:
 *   - dashboard = launcher: tidak ada destinasi sekunder untuk pemain 0 run.
 *   - menu HUD: item terkunci TIDAK dirender (display:none), toggle menu hilang bila
 *     tidak ada item terbuka, item tak terdaftar di features.json = terkunci (fail-closed).
 *   - klik programatik item terkunci TIDAK pernah berpindah layar.
 *   - disclosure bertahap benar untuk 0 / 3 / 5 run / wave 10; badge unlock muncul lalu hilang saat menu dibuka.
 *   - prep = 1 langkah (hero) sebelum Endless terbuka; tidak ada langkah Fokus/Arena.
 *   - profil tanpa label fraksi; gameover tidak menumpuk baris `.go-parts`.
 * Exit code 1 bila ada FAIL / pageerror (issue #6: FAIL tidak boleh exit 0).
 * Jalankan: node scripts/e2e-ui-nav.mjs (server :8000 + chromium /tmp)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require(process.env.PW_PATH || '/tmp/pw/node_modules/playwright-core');

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs:/tmp/alibs/lib' },
});
let fails = 0;
const log = (k, v, extra) => {
  if (v === false) fails += 1;
  console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${extra ? ' ' + extra : ''}`);
};
const errors = [];

const VIS_FN = `(el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && !!el.closest('.screen.active'); }`;

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
  await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  return { ctx, page };
}

// ---------- A) DASHBOARD: destinasi yang tampak per tahap progres ----------
async function auditDashboard(label, seed) {
  const { ctx, page } = await newPage();
  await page.evaluate(async (s) => {
    const W = window.__IMUNVERSE;
    Object.assign(W.STATE.meta.stats, s.stats || {});
    if (s.currency !== undefined) W.STATE.meta.currency = s.currency;
    localStorage.setItem('imunverse.save.v1', JSON.stringify(W.STATE.meta));
    const acc = await import('/js/systems/account-system.js');
    if (!acc.hasAccount()) acc.signUp({ username: 'AuditUser', password: '1234', faction: 'imun' });
    W.screenManager.show('dashboard');
  }, seed);
  await page.waitForTimeout(800);
  const res = await page.evaluate((visSrc) => {
    const vis = eval(visSrc);
    const out = [];
    const add = (group, el, dest) => { if (vis(el)) out.push(`${group}:${dest}`); };
    document.querySelectorAll('#screen-dashboard .side-btn').forEach((b) => add('side', b, b.id.replace('side-', '')));
    document.querySelectorAll('#screen-dashboard .quick-tile').forEach((b) => add('quick', b, b.title || b.textContent.trim()));
    document.querySelectorAll('#screen-dashboard .dock-btn[data-nav]').forEach((b) => add('dock', b, b.dataset.nav));
    document.querySelectorAll('#screen-dashboard .secondary-dock [data-nav]').forEach((b) => add('secondary', b, b.dataset.nav));
    add('cta', document.getElementById('btn-play'), 'PLAY');
    add('cta', document.getElementById('btn-play-big'), 'MULAI');
    add('chip', document.getElementById('account-chip'), 'profile');
    add('chip', document.getElementById('rank-chip'), 'rank');
    add('chip', document.getElementById('dash-level-badge'), 'upgrade');
    add('banner', document.querySelector('#banner-chapter .bn-cta'), 'campaign');
    add('banner', document.querySelector('#banner-endless .bn-cta'), 'prep');
    add('card', document.querySelector('#mode-endless .mc-btn'), 'prep');
    add('card', document.querySelector('#mode-lab .mc-btn'), 'upgrade');
    add('card', document.querySelector('#arena-card .btn'), 'arena');
    add('card', document.querySelector('#evo-card .btn'), 'evolve');
    add('card', document.querySelector('#body-card .btn'), 'body');
    add('card', document.querySelector('#daily-card .btn'), 'daily');
    add('lang', document.getElementById('btn-lang-dash'), 'lang');
    return { minimal: document.getElementById('screen-dashboard').classList.contains('minimal-home'), targets: out };
  }, VIS_FN);
  const distinct = new Set(res.targets.map((t) => t.split(':')[1]));
  log(`dash-${label}`, undefined, `minimal-home=${res.minimal} | ${res.targets.length} tombol | ${distinct.size} destinasi → ${res.targets.join(', ')}`);
  await page.screenshot({ path: `shots/ui-nav/dash-${label}.png` }).catch(() => {});
  await ctx.close();
  return res;
}

const d0 = await auditDashboard('0run', { stats: { totalRuns: 0, bestWave: 0 }, currency: 0 });
await auditDashboard('15runs', { stats: { totalRuns: 15, bestWave: 12, totalCurrencyEarned: 900 }, currency: 900 });
const secondaryVisible0 = d0.targets.filter((t) => /^(side|quick|dock|secondary|card):/.test(t));
log('dash-0run-no-secondary-destinations', secondaryVisible0.length === 0, secondaryVisible0.join(',') || '(bersih)');

// ---------- B) HUD: disclosure per tahap progres ----------
async function hudState(page) {
  return page.evaluate((visSrc) => {
    const vis = eval(visSrc);
    const shown = (sel, k) => [...document.querySelectorAll(sel)].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.dataset[k]);
    const hidden = (sel, k) => [...document.querySelectorAll(sel)].filter((b) => getComputedStyle(b).display === 'none').map((b) => b.dataset[k]);
    return {
      t1: vis(document.getElementById('hud-menu-toggle')), t2: vis(document.getElementById('hud-menu2-toggle')),
      quests: vis(document.getElementById('hud-quests')),
      m1: shown('.hud-menu-link', 'menuScreen'), m2: shown('.hud-menu2-link', 'menu2Screen'),
      h1: hidden('.hud-menu-link', 'menuScreen'), h2: hidden('.hud-menu2-link', 'menu2Screen'),
      b1: document.getElementById('menu1-badge'), b2: document.getElementById('menu2-badge'),
      badge1: vis(document.getElementById('menu1-badge')) ? document.getElementById('menu1-badge').textContent : '',
      badge2: vis(document.getElementById('menu2-badge')) ? document.getElementById('menu2-badge').textContent : '',
    };
  }, VIS_FN);
}
async function startRunWith(page, stats) {
  await page.evaluate((s) => { const W = window.__IMUNVERSE; Object.assign(W.STATE.meta.stats, s); W.game.startRun('macrophage'); }, stats);
  await page.waitForTimeout(1100);
}
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

{
  // 0 run — run pertama: hanya Heroes; menu1 tidak ada; panel Misi ada (quests tanpa syarat)
  const { ctx, page } = await newPage();
  await startRunWith(page, { totalRuns: 0, bestWave: 0, totalCurrencyEarned: 0 });
  const s = await hudState(page);
  log('hud-0run-state', undefined, JSON.stringify({ t1: s.t1, t2: s.t2, quests: s.quests, m1: s.m1, m2: s.m2 }));
  log('hud-0run-menu1-toggle-hidden', s.t1 === false);
  log('hud-0run-menu2-only-heroes', s.t2 === true && same(s.m2, ['roster']));
  log('hud-0run-locked-items-not-rendered', same(s.h1, ['campaign', 'rank', 'codex', 'bp']) && same(s.h2, ['codex', 'shop', 'arena', 'upgrade']));
  // klik programatik semua item (termasuk yang tersembunyi) — tidak boleh berpindah layar kecuali roster
  const clicks = await page.evaluate(async () => {
    const sm = window.__IMUNVERSE.screenManager;
    const res = [];
    const tryClick = async (sel, id) => {
      const btn = document.querySelector(sel); if (!btn) { res.push({ id, missing: true }); return; }
      btn.click(); await new Promise((r) => setTimeout(r, 300));
      res.push({ id, reached: sm.getCurrentId() });
      if (sm.getCurrentId() !== 'hud') { window.__IMUNVERSE_backToContext(); await new Promise((r) => setTimeout(r, 250)); }
    };
    for (const id of ['campaign', 'rank', 'codex', 'bp']) await tryClick(`.hud-menu-link[data-menu-screen="${id}"]`, 'm1:' + id);
    for (const id of ['roster', 'codex', 'shop', 'arena', 'upgrade']) await tryClick(`.hud-menu2-link[data-menu2-screen="${id}"]`, 'm2:' + id);
    return res;
  });
  const leaks = clicks.filter((c) => !c.missing && c.reached !== 'hud' && c.id !== 'm2:roster');
  log('hud-0run-locked-never-navigate', leaks.length === 0, leaks.map((c) => `${c.id}→${c.reached}`).join(',') || '(tidak ada bocor)');
  log('hud-0run-roster-opens', clicks.some((c) => c.id === 'm2:roster' && c.reached === 'roster'));
  // gate fail-closed: id yang tidak terdaftar dianggap terkunci
  const failClosed = await page.evaluate(async () => {
    const fg = await import('/js/systems/feature-gate.js');
    return { unknown: fg.hudMenuGate('menu2', 'tidak_ada').locked, codex: fg.hudMenuGate('menu2', 'codex').locked, arena: fg.hudMenuGate('menu2', 'arena').locked };
  });
  log('hud-gate-fail-closed', failClosed.unknown && failClosed.codex && failClosed.arena, JSON.stringify(failClosed));
  await page.screenshot({ path: 'shots/ui-nav/hud-0run.png' }).catch(() => {});
  await ctx.close();
}
{
  // 3 run: Peta Tubuh (menu1) + Arena (menu2) terbuka; badge unlock muncul, hilang saat menu dibuka
  const { ctx, page } = await newPage();
  await page.evaluate(() => { window.__IMUNVERSE.STATE.meta.seenUnlocks = []; });
  await startRunWith(page, { totalRuns: 3, bestWave: 4, totalCurrencyEarned: 90 });
  const s = await hudState(page);
  log('hud-3run-state', undefined, JSON.stringify({ t1: s.t1, m1: s.m1, m2: s.m2, badge1: s.badge1, badge2: s.badge2 }));
  log('hud-3run-campaign-and-arena', s.t1 === true && same(s.m1, ['campaign']) && same(s.m2, ['roster', 'arena']));
  log('hud-3run-badges-shown', s.badge1 === '1' && s.badge2 === '1', `badge1=${s.badge1} badge2=${s.badge2}`);
  await page.click('#hud-menu-toggle', { force: true });
  await page.waitForTimeout(300);
  const after = await hudState(page);
  log('hud-3run-badge-cleared-on-open', after.badge1 === '' && after.badge2 === '1', `badge1=${after.badge1} badge2=${after.badge2}`);
  await page.screenshot({ path: 'shots/ui-nav/hud-3run.png' }).catch(() => {});
  await ctx.close();
}
{
  // 5 run + 150 antibodi: Shop & Lab Pasukan ikut terbuka; wave 10 + 15 run: semua terbuka
  const { ctx, page } = await newPage();
  await startRunWith(page, { totalRuns: 5, bestWave: 6, totalCurrencyEarned: 200 });
  const s5 = await hudState(page);
  log('hud-5run-shop-upgrade', same(s5.m2, ['roster', 'shop', 'arena', 'upgrade']) && same(s5.m1, ['campaign']), JSON.stringify({ m1: s5.m1, m2: s5.m2 }));
  await page.evaluate(() => window.__IMUNVERSE.game.finishRun(false));
  await page.waitForTimeout(500);
  await startRunWith(page, { totalRuns: 15, bestWave: 10, totalCurrencyEarned: 900 });
  const s15 = await hudState(page);
  log('hud-15run-all-open', same(s15.m1, ['campaign', 'rank', 'codex', 'bp']) && same(s15.m2, ['roster', 'codex', 'shop', 'arena', 'upgrade']), JSON.stringify({ m1: s15.m1, m2: s15.m2 }));
  // ikon menu = set ikon game (assets/icons/menu-*.svg), bukan ikon tools generik
  const icons = await page.evaluate(() => [...document.querySelectorAll('#hud-menu-toggle img, #hud-menu2-toggle img, .hud-menu-link img, .hud-menu2-link img, #hud-quests-toggle img')].map((i) => i.getAttribute('src')));
  log('hud-icons-game-set', icons.length === 12 && icons.every((s) => /^assets\/icons\/menu-[a-z]+\.svg$/.test(s)), `${icons.length} ikon`);
  const iconOk = await page.evaluate(async () => {
    const srcs = [...new Set([...document.querySelectorAll('#screen-hud img[src^="assets/icons/"]')].map((i) => i.getAttribute('src')))];
    const r = await Promise.all(srcs.map((s) => fetch('/' + s).then((x) => x.ok)));
    return r.every(Boolean);
  });
  log('hud-icons-all-200', iconOk === true);
  // gameover: baris go-parts tidak menumpuk antar render
  const goDup = await page.evaluate(async () => {
    const W = window.__IMUNVERSE;
    W.game.finishRun(false); await new Promise((r) => setTimeout(r, 400));
    const n1 = document.querySelectorAll('#gameover-summary ~ .go-parts').length;
    const payload = W.STATE.lastGameoverSummary;
    if (!payload) return { skip: true };
    W.screenManager.show('gameover', payload); await new Promise((r) => setTimeout(r, 300));
    W.screenManager.show('gameover', payload); await new Promise((r) => setTimeout(r, 300));
    const n3 = document.querySelectorAll('#gameover-summary ~ .go-parts').length;
    return { n1, n3 };
  });
  log('gameover-go-parts-no-stacking', goDup.skip ? undefined : goDup.n1 > 0 && goDup.n3 === goDup.n1, JSON.stringify(goDup));
  await page.screenshot({ path: 'shots/ui-nav/hud-15run.png' }).catch(() => {});
  await ctx.close();
}

// ---------- C) PREP: 1 langkah sebelum Endless terbuka; tidak ada Fokus/Arena ----------
{
  const { ctx, page } = await newPage();
  const prep = await page.evaluate(async () => {
    const W = window.__IMUNVERSE;
    const meta = W.STATE.meta;
    meta.stats.wins = 0; meta.selectedMode = 'endless'; meta.focusRun = 'limfatik'; // nilai "salah" harus di-default-kan
    W.screenManager.show('prep'); await new Promise((r) => setTimeout(r, 300));
    const steps = [...document.querySelectorAll('#screen-prep .prep-step')].filter((h) => getComputedStyle(h).display !== 'none' && !h.closest('.hidden'));
    const before = { steps: steps.length, labels: steps.map((h) => h.textContent.trim().replace(/\s+/g, ' ')), mode: meta.selectedMode, focus: meta.focusRun,
      focusRow: !!document.getElementById('prep-focus-row'), arenaRow: !!document.getElementById('prep-arena-row') };
    meta.stats.wins = 1; // Endless terbuka → langkah Mode muncul (maks 2)
    W.screenManager.show('prep'); await new Promise((r) => setTimeout(r, 300));
    const steps2 = [...document.querySelectorAll('#screen-prep .prep-step')].filter((h) => getComputedStyle(h).display !== 'none' && !h.closest('.hidden'));
    meta.stats.wins = 0; meta.selectedMode = 'kampanye';
    return { before, after: { steps: steps2.length } };
  });
  log('prep-state', undefined, JSON.stringify(prep));
  log('prep-single-step-before-endless', prep.before.steps === 1 && /Hero/i.test(prep.before.labels[0]));
  log('prep-defaults-forced', prep.before.mode === 'kampanye' && prep.before.focus === 'seimbang');
  log('prep-no-focus-arena-steps', prep.before.focusRow === false && prep.before.arenaRow === false);
  log('prep-max-two-steps-after-endless', prep.after.steps === 2);
  await page.screenshot({ path: 'shots/ui-nav/prep.png' }).catch(() => {});
  // profil tanpa label fraksi
  const prof = await page.evaluate(async () => {
    const W = window.__IMUNVERSE;
    const acc = await import('/js/systems/account-system.js');
    if (!acc.hasAccount()) acc.signUp({ username: 'AuditUser', password: '1234', faction: 'imun' });
    W.screenManager.show('profile'); await new Promise((r) => setTimeout(r, 300));
    const txt = document.getElementById('screen-profile').textContent;
    return { factionEl: !!document.getElementById('profile-faction'), tagCls: !!document.querySelector('.faction-tag'), mentionsPasukan: /Pasukan (Imun|Virus)/.test(txt), css: getComputedStyle(document.documentElement).getPropertyValue('--faction-color').trim() };
  });
  log('profile-no-faction-label', !prof.factionEl && !prof.tagCls && !prof.mentionsPasukan && prof.css === '', JSON.stringify(prof));
  await ctx.close();
}

log('zero-pageerror', errors.length === 0);
if (errors.length) for (const e of errors.slice(0, 5)) log('err', e);
await browser.close();
console.log(fails === 0 ? '\nSEMUA INVARIAN LOLOS ✔' : `\nGAGAL: ${fails} FAIL`);
process.exit(fails === 0 && errors.length === 0 ? 0 : 1);
