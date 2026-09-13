#!/usr/bin/env node
/**
 * scripts/unit-fase-nav.mjs — uji headless §6 Navigasi (BUILD 59a)
 *
 * Yang dikunci di sini:
 *   • SATU sheet "Perjalanan": sidebar, quick row, secondary dock, dan DUA
 *     menu HUD (menu1/menu2) benar-benar hilang dari markup & wiring
 *   • dock bawah permanen 5 slot (slot 1 = Perjalanan)
 *   • semua destinasi sheet terdaft di data/features.json — audit fail-closed:
 *     id tak terdaftar = terkunci (journeyGate)
 *   • perilaku gerbang: 0 run → hanya Heroes; 5 run + wave 10 → bertambah;
 *     15 run → pangkat terbuka
 *   • topbar permanen: chip Pangkat + chip Battle Pass + item teratas session hook
 *   • CSS ikut cache-busting ?v=BUILD (bug laten 55a–58a: main.css berubah,
 *     ?v=54 tetap → pemain lama melihat gaya basi)
 *
 *   node scripts/unit-fase-nav.mjs    # atau: npm run test:fasenav
 */

import { readFileSync } from 'node:fs';

/* ---------- shim lingkungan (fetch + localStorage) ---------- */

globalThis.fetch = async (url) => {
  const p = String(url).split('?')[0];
  const body = readFileSync(p, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
};
globalThis.localStorage = globalThis.window.localStorage;

/* ---------- harness ---------- */

const results = [];
const check = (label, cond, detail = '') => {
  results.push({ label, ok: !!cond, detail });
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const { loadAllData } = await import('../js/core/data-store.js');
const data = await loadAllData();
const { STATE } = await import('../js/core/state-manager.js');
const { journeyGate, journeyEntries, gateDef } = await import('../js/systems/feature-gate.js');

/* ---------- 1. features.json: sistem lama dicabut, gerbang sheet terdaftar ---------- */

console.log('\n=== 1. data/features.json ===');
const gates = data.features.gates;
check('gate target "side" DIHAPUS (sidebar sudah tidak ada)', !gates.some((g) => g.target === 'side'));
check('gate "quick" tinggal quests (quick row dihapus; panel Misi HUD tetap)', gates.filter((g) => g.target === 'quick').every((g) => g.id === 'quests') && gates.some((g) => g.target === 'quick' && g.id === 'quests'));
check('gerbang dock & secondary utuh (dipakai journeyGate)', ['dock', 'secondary'].every((t) => gates.some((g) => g.target === t)));
const entries = journeyEntries();
check('9 destinasi sheet', entries.length === 9, entries.map((e) => e.screenId).join(','));
check('SETIAP destinasi terdaftar di features.json (audit fail-closed)', entries.every((e) => gateDef(e.target, e.id) !== null), entries.filter((e) => !gateDef(e.target, e.id)).map((e) => `${e.target}/${e.id}`).join(',') || 'semua terdaftar');

/* ---------- 2. perilaku journeyGate (STATE stub) ---------- */

console.log('\n=== 2. journeyGate: progressive disclosure ===');
STATE.meta = { stats: { totalRuns: 0, bestWave: 0, bossKills: 0, totalCurrencyEarned: 0 }, currency: 0 };
check('0 run: Heroes (roster) TERBUKA — pintu awal', journeyGate('roster').locked === false);
check('0 run: campaign terkunci (butuh 3 run)', journeyGate('campaign').locked === true);
check('0 run: rank terkunci (butuh 15 run)', journeyGate('rank').locked === true);
check('id tak terdaftar → TERKUNCI (fail-closed)', journeyGate('focus').locked === true && journeyGate('ngawur').locked === true);

STATE.meta = { stats: { totalRuns: 5, bestWave: 10, bossKills: 1, totalCurrencyEarned: 400 }, currency: 400 };
check('5 run + wave 10: campaign/codex/shop/arena/bag/upgrade terbuka', ['campaign', 'codex', 'shop', 'arena', 'bag', 'upgrade'].every((id) => journeyGate(id).locked === false), ['campaign', 'codex', 'shop', 'arena', 'bag', 'upgrade'].filter((id) => journeyGate(id).locked).join(',') || 'semua terbuka');
check('5 run: bp masih terkunci (butuh 6 run)', journeyGate('bp').locked === true);
check('5 run: rank masih terkunci (butuh 15 run)', journeyGate('rank').locked === true);

STATE.meta = { stats: { totalRuns: 15, bestWave: 12, bossKills: 4, totalCurrencyEarned: 900 }, currency: 900 };
check('15 run: SEMUA destinasi terbuka', entries.every((e) => journeyGate(e.screenId).locked === false), entries.filter((e) => journeyGate(e.screenId).locked).map((e) => e.screenId).join(',') || '9/9 terbuka');

/* ---------- 3. index.html: markup lama hilang, markup baru ada ---------- */

console.log('\n=== 3. index.html ===');
const html = read('index.html');
check('sidebar (.side-nav / #side-*) DIHAPUS', !html.includes('class="side-nav"') && !html.includes('id="side-home"') && !html.includes('id="side-campaign"'));
check('quick row DIHAPUS', !html.includes('id="quick-row"'));
check('secondary dock DIHAPUS', !html.includes('secondary-dock'));
check('menu HUD lama (menu1/menu2) DIHAPUS', !html.includes('hud-game-menu') && !html.includes('hud-menu2-toggle') && !html.includes('data-menu-screen') && !html.includes('data-menu2-screen'));
const dockBtns = (html.match(/class="dock-btn"/g) || []).length;
check('dock permanen 5 SLOT', dockBtns === 5, `${dockBtns} tombol`);
check('slot 1 dock = Perjalanan (btn-journey)', html.includes('id="btn-journey"') && html.indexOf('id="btn-journey"') < html.indexOf('data-nav="herodetail"'));
check('HUD: SATU toggle perjalanan + badge', html.includes('id="hud-journey-toggle"') && html.includes('id="journey-badge"'));
check('markup sheet ada (backdrop + dialog + list + tutup)', ['journey-backdrop', 'journey-sheet', 'journey-list', 'journey-close'].every((id) => html.includes(`id="${id}"`)));
check('sheet = role dialog (label Perjalanan)', /id="journey-sheet"[^>]*role="dialog"[^>]*aria-label="Perjalanan"/.test(html));
check('topbar permanen: chip Pangkat + BP + hook', html.includes('id="rank-chip"') && html.includes('id="bp-chip"') && html.includes('id="hook-chip"'));

/* ---------- 4. cache-busting seragam (bug laten CSS) ---------- */

console.log('\n=== 4. Cache-busting ?v=BUILD untuk JS DAN CSS ===');
const build = (read('js/core/version.js').match(/BUILD\s*=\s*'([^']+)'/) || [])[1];
check('BUILD = 59a', build === '59a', `BUILD=${build}`);
check('main.js?v=BUILD', html.includes(`main.js?v=${build}`));
check('main.css?v=BUILD (dulu ?v=54 statis — gaya basi di 55a–58a)', html.includes(`styles/main.css?v=${build}`));
check('dashboard-focus.css?v=BUILD', html.includes(`styles/dashboard-focus.css?v=${build}`));

/* ---------- 5. wiring (scan sumber) ---------- */

console.log('\n=== 5. Wiring modul ===');
const js = read('js/ui/journey-sheet.js');
const main = read('js/main.js');
const dash = read('js/ui/screens/dashboard-screen.js');
const fg = read('js/systems/feature-gate.js');
const sm = read('js/ui/screen-manager.js');
const ih = read('js/input/input-handler.js');
const ub = read('js/systems/unlock-badge-system.js');
const css = read('styles/dashboard-focus.css');

check('journey-sheet: item terkunci tidak dirender (disclosure)', js.includes('if (gate.locked) continue;'));
check('journey-sheet: dari HUD → pause + musik stop (perilaku menu lama)', js.includes('game.pause()') && js.includes('music.stop()') && js.includes('openedFromRun'));
check('journey-sheet: buka = markSeen + renderBadges (F25 dipertahankan)', js.includes("markSeen('journey')") && js.includes('renderBadges()'));
check('journey-sheet: 4 jalur dibuka/ditutup (dock, HUD toggle, backdrop, tombol tutup)', ['btn-journey', 'hud-journey-toggle', 'journey-close'].every((id) => js.includes(id)) && js.includes('backdrop?.addEventListener'));
check('screen-manager: pindah layar menutup sheet', sm.includes('window.__IMUNVERSE_closeJourneySheet?.()'));
check('main.js: wireJourneySheet dipanggil; wiring menu lama hilang', main.includes('wireJourneySheet();') && !main.includes('hudMenuGate(') && !main.includes('applyHudMenuGates(') && !main.includes('openHudMenuScreen'));
check('main.js: listener sidebar hilang', !main.includes('side-campaign') && !main.includes('side-body'));
check('main.js: applyHudDisclosure tetap gerbangi panel Misi + menutup sheet', /applyHudDisclosure[\s\S]{0,600}gateFor\('quick', 'quests'\)[\s\S]{0,400}__IMUNVERSE_closeJourneySheet/.test(main));
check('feature-gate: HUD_MENU_GATES menu1/menu2 hilang, JOURNEY_GATES fail-closed', !fg.includes('HUD_MENU_GATES') && fg.includes('JOURNEY_GATES') && fg.includes('locked: !isDevMode()'));
check('unlock-badge: satu badge journey', ub.includes("badge: 'journey-badge'") && !ub.includes('menu1-badge'));
check('dashboard: renderQuickRow hilang, refreshTopbarIndicators dipakai', !dash.includes('function renderQuickRow') && dash.includes('refreshTopbarIndicators(meta);') && !dash.includes("applyGateVisual(b, 'side'") && !dash.includes("applyGateVisual(b, 'secondary'"));
check('dashboard: chip BP gerbang journeyGate + chip hook pakai buildSessionHook', dash.includes("journeyGate('bp')") && dash.includes('buildSessionHook') && dash.includes('prettifyEvolutionLabels'));
check('dashboard: countdown pindah ke topbar', dash.includes("mountResetCountdown(topbar, 'dashboard')"));
check('input-handler: zona UI mencakup sheet (bukan menu2 yang sudah dihapus)', ih.includes('.journey-backdrop') && ih.includes('.journey-sheet') && !ih.includes('hud-game-menu2'));
check('CSS: dock 5 kolom + gaya sheet + chip topbar', css.includes('repeat(5, auto)') && css.includes('.journey-sheet') && css.includes('.bp-chip') && css.includes('.hook-chip'));
const lang = JSON.parse(read('data/lang.json'));
check('lang.json: "Perjalanan" terdaftar', typeof lang.strings['Perjalanan'] === 'string');

/* ---------- ringkasan ---------- */

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? '✅' : '❌'} ${results.length - failed.length}/${results.length} pemeriksaan lulus`);
if (failed.length) {
  for (const f of failed) console.log(`  GAGAL: ${f.label}${f.detail ? ` — ${f.detail}` : ''}`);
  process.exit(1);
}
