/**
 * e2e-ui-nav.mjs — Audit navigasi UI (UI/UX): apa yang BENAR-BENAR tampak & bisa
 * diklik pemain di dashboard (0 / 3 / 15 run) dan di menu gameplay (HUD) pada run #1.
 *
 * INFO  = peta hasil audit (tidak dinilai).
 * PASS/FAIL = invarian navigasi:
 *   - menu HUD yang terkunci tidak boleh membawa pemain ke layar tujuan (bocor gate).
 *   - dashboard tidak boleh memunculkan destinasi sekunder ke pemain 0 run.
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
const log = (k, v, extra) => console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${extra ? ' ' + extra : ''}`);
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
await auditDashboard('3runs', { stats: { totalRuns: 3, bestWave: 5, totalCurrencyEarned: 200 }, currency: 200 });
await auditDashboard('15runs', { stats: { totalRuns: 15, bestWave: 12, totalCurrencyEarned: 900 }, currency: 900 });
const secondaryVisible0 = d0.targets.filter((t) => /^(side|quick|dock|secondary|card):/.test(t));
log('dash-0run-no-secondary-destinations', secondaryVisible0.length === 0, secondaryVisible0.join(',') || '(bersih)');

// ---------- B) HUD run #1 (pemain 0 run): menu gameplay & gate ----------
{
  const { ctx, page } = await newPage();
  await page.evaluate(() => window.__IMUNVERSE.game.startRun('macrophage'));
  await page.waitForTimeout(1200);
  const r = await page.evaluate((visSrc) => {
    const vis = eval(visSrc);
    const out = { toggles: {}, menu1: [], menu2: [], quests: vis(document.getElementById('hud-quests')) };
    out.toggles.menu1 = vis(document.getElementById('hud-menu-toggle'));
    out.toggles.menu2 = vis(document.getElementById('hud-menu2-toggle'));
    document.getElementById('hud-game-menu')?.classList.remove('hidden');
    document.getElementById('hud-game-menu2')?.classList.remove('hidden');
    document.querySelectorAll('.hud-menu-link').forEach((b) => out.menu1.push({ id: b.dataset.menuScreen, vis: vis(b), gated: b.classList.contains('gated') }));
    document.querySelectorAll('.hud-menu2-link').forEach((b) => out.menu2.push({ id: b.dataset.menu2Screen, vis: vis(b), gated: b.classList.contains('gated') }));
    document.getElementById('hud-game-menu')?.classList.add('hidden');
    document.getElementById('hud-game-menu2')?.classList.add('hidden');
    return out;
  }, VIS_FN);
  log('hud-run1-toggles', undefined, JSON.stringify(r.toggles) + ` quests=${r.quests}`);
  log('hud-run1-menu1', undefined, r.menu1.map((m) => `${m.id}${m.vis ? '' : '(hidden)'}${m.gated ? '[gated]' : ''}`).join(' '));
  log('hud-run1-menu2', undefined, r.menu2.map((m) => `${m.id}${m.vis ? '' : '(hidden)'}${m.gated ? '[gated]' : ''}`).join(' '));

  const gates = await page.evaluate(async () => {
    const fg = await import('/js/systems/feature-gate.js');
    const m1 = ['campaign', 'rank', 'codex', 'bp'].map((id) => [id, fg.gateFor('secondary', id)]);
    const m2 = ['roster', 'codex', 'shop', 'arena', 'upgrade'].map((id) => [id, fg.gateFor('dock', id)]);
    return { m1, m2 };
  });
  const fmt = (arr) => arr.map(([id, g]) => `${id}=${g === null ? 'NULL(tanpa gate)' : g.locked ? 'locked:' + g.label : 'open'}`).join(' | ');
  log('gateFor-secondary-0run', undefined, fmt(gates.m1));
  log('gateFor-dock-0run', undefined, fmt(gates.m2));

  // Klik nyata setiap item menu: item yang terkunci TIDAK boleh berpindah layar.
  const clicks = await page.evaluate(async () => {
    const fg = await import('/js/systems/feature-gate.js');
    const sm = window.__IMUNVERSE.screenManager;
    const back = () => { window.__IMUNVERSE_backToContext && window.__IMUNVERSE_backToContext(); };
    const res = [];
    const tryClick = async (sel, target, id) => {
      const btn = document.querySelector(sel);
      if (!btn) { res.push({ id, missing: true }); return; }
      const g = fg.gateFor(target, id);
      const locked = !!(g && g.locked);
      btn.click();
      await new Promise((r) => setTimeout(r, 350));
      const now = sm.getCurrentId();
      res.push({ id, locked, reached: now, leak: locked ? now !== 'hud' : false, hiddenVis: getComputedStyle(btn).display === 'none' });
      if (now !== 'hud') { back(); await new Promise((r) => setTimeout(r, 250)); }
    };
    for (const id of ['campaign', 'rank', 'codex', 'bp']) await tryClick(`.hud-menu-link[data-menu-screen="${id}"]`, 'secondary', id);
    for (const id of ['roster', 'codex', 'shop', 'arena', 'upgrade']) await tryClick(`.hud-menu2-link[data-menu2-screen="${id}"]`, 'dock', id);
    return res;
  });
  for (const c of clicks) log(`click-${c.id}`, undefined, JSON.stringify(c));
  const leaks = clicks.filter((c) => c.leak);
  log('hud-locked-items-never-navigate', leaks.length === 0, leaks.map((c) => c.id).join(',') || '(tidak ada bocor)');
  // Item yang tidak punya gerbang sama sekali (null) = destinasi terbuka untuk pemain 0 run.
  const ungated = [...gates.m1, ...gates.m2].filter(([, g]) => g === null).map(([id]) => id);
  log('hud-every-menu-item-has-gate', ungated.length === 0, ungated.length ? 'tanpa gate: ' + ungated.join(',') : '');
  await page.screenshot({ path: 'shots/ui-nav/hud-run1.png' }).catch(() => {});
  await ctx.close();
}

log('zero-pageerror', errors.length === 0);
if (errors.length) for (const e of errors.slice(0, 5)) log('err', e);
await browser.close();
