/**
 * e2e-pilot-jantung.mjs — screenshot pixel-level pilot "Organ Ascent"
 * (arena Bilik Jantung) + pilot "Abstract Bio-Form" (Mako/macrophage).
 *
 * Dipakai untuk bukti BEFORE/AFTER di PR: menjalankan game asli di Chromium
 * headless, memaksa arena `jantung` + hero `macrophage`, lalu menyimpan:
 *   - <tag>-arena-wide.png   : gameplay penuh (kamera di posisi spawn)
 *   - <tag>-arena-up.png     : setelah player berjalan naik beberapa detik
 *   - <tag>-hero-crop.png    : crop 3× di sekitar hero (verifikasi bentuk)
 *   - <tag>-lab.png          : Lab prototipe (3 mode berdampingan)
 *   - <tag>-metrics.json     : posisi/HP/arenaBounds — bukti mekanik identik
 *
 *   python3 -m http.server 8000 --bind 0.0.0.0 &
 *   TAG=before LD_LIBRARY_PATH=/tmp/al2023-lib/lib node scripts/e2e-pilot-jantung.mjs
 *
 * Tidak menambah dependency ke package.json (playwright-core + @sparticuz/chromium
 * dipasang lokal dengan `npm i -D --no-save`, sama seperti skrip e2e lain).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const TAG = process.env.TAG || 'shot';
const OUT_DIR = process.env.OUT_DIR || 'shots/pilot-jantung';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';
const VIEW = { width: Number(process.env.VIEW_W || 900), height: Number(process.env.VIEW_H || 600) };
const WALK_SEC = Number(process.env.WALK_SEC || 4);
const ZONE = process.env.ZONE || 'heart'; // id zona di data/zones.json (lung, capillary, bloodstream, heart, tissue, lymphatic, tumor, …)

const { chromium: pw } = require(process.env.PW_PATH || 'playwright-core');
let exe = process.env.CHROMIUM_PATH;
if (!exe) {
  try { const c = require('@sparticuz/chromium'); exe = await (c.default || c).executablePath(); } catch { exe = '/tmp/chromium'; }
}
fs.mkdirSync(OUT_DIR, { recursive: true });
const out = (n) => path.join(OUT_DIR, `${TAG}-${n}`);

const browser = await pw.launch({
  executablePath: exe, headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--use-gl=swiftshader'],
});
const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(`${BASE_URL}?dev=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__IMUNVERSE?.STATE?.meta && !!window.__IMUNVERSE?.getData?.()?.arenas, null, { timeout: 30000 });
await page.addStyleTag({ content: `*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}
  #rotate-hud,#toasts{display:none!important}` });
// Tunggu layar awal (dashboard/onboarding) selesai dipilih main.js (timer 450 ms)
await page.waitForFunction(() => window.__IMUNVERSE.STATE.screen !== 'loading', null, { timeout: 15000 });
await page.waitForTimeout(700);

// Paksa arena jantung + hero Mako, lalu mulai run.
await page.evaluate(({ process_env_STAY_LUNG, process_env_FORCE_FOTO, ZONE }) => {
  const app = window.__IMUNVERSE;
  const { STATE, game } = app;
  const meta = STATE.meta;
  meta.account = meta.account || { uid: 'pilot', username: 'Pilot', faction: 'imun', createdAt: new Date().toISOString() };
  meta.coachDone = true; meta.tutorialDone = true; meta.onboardingDone = true;
  meta.soundMuted = true; meta.musicOn = false;
  meta.selectedHero = 'macrophage';
  meta.selectedArena = 'jantung';
  meta.unlockedArenas = Array.from(new Set([...(meta.unlockedArenas || []), 'jantung']));
  if (!meta.stats) meta.stats = {};
  meta.stats.bestWave = Math.max(meta.stats.bestWave || 0, 30);
  STATE.paused = false; STATE.levelUpOpen = false;
  // Mode hero TIDAK dipaksa: yang difoto adalah BAWAAN (pilot Mako = makhluk).
  try { app.hero && app.hero.resetHeroMode && app.hero.resetHeroMode(); } catch { /* abaikan */ }
  if (process_env_FORCE_FOTO) { try { app.hero.setHeroMode('foto'); } catch { /* abaikan */ } }
  if (game.run) { try { game.run.ended = true; } catch { /* abaikan */ } }
  app.screenManager.show('dashboard');
  game.startRun('macrophage');
  const p = game.run.player;
  p.maxHP = 99999; p.hp = 99999; p.iframes = 99999;
  // Perjalanan dunia (world-journey) menentukan organ aktif — lompat ke zona
  // JANTUNG persis seperti saat pemain benar-benar sampai di sana.
  if (!process_env_STAY_LUNG) {
    app.world._jumpToZone(game, ZONE);
  }
  document.getElementById('tutorial-layer')?.classList.add('hidden');
  document.querySelectorAll('.presenter, .toast').forEach((el) => el.remove());
}, { process_env_STAY_LUNG: process.env.STAY_LUNG === '1', process_env_FORCE_FOTO: process.env.FORCE_FOTO === '1', ZONE });
await page.waitForFunction(() => document.querySelector('#screen-hud')?.classList.contains('active'), null, { timeout: 8000 });
await page.waitForTimeout(600);

const metrics0 = await page.evaluate(() => {
  const { game } = window.__IMUNVERSE;
  const r = game.run;
  return {
    arena: game.getRunArena().id, heroMode: window.__IMUNVERSE.hero?.heroMode?.(), heroModeMako: window.__IMUNVERSE.hero?.heroModeFor?.('macrophage'), zone: r.journey && r.journey.zoneId,
    player: { x: r.player.x, y: r.player.y, hp: r.player.hp, radius: r.player.radius, speed: r.player.speed },
    arenaBounds: r.arenaBounds, arenaShape: r.arenaShape ? { kind: r.arenaShape.kind, ...(r.arenaShape.summary || {}) } : null,
  };
});
await page.screenshot({ path: out('arena-wide.png') });

// Sembunyikan petunjuk kontrol yang menutupi hero (bukan bagian arena).
await page.evaluate(() => { document.querySelectorAll('.hud-hint, #hud-hint, .control-hint').forEach((el) => { el.style.display = 'none'; }); });
// Crop area hero (pixel-level) + versi diperbesar 4× (nearest) untuk inspeksi bentuk.
const heroBox = await page.evaluate(() => {
  const { game } = window.__IMUNVERSE;
  const cam = game.run.camera;
  const p = game.run.player;
  const q = cam.getPlayerScreen() || cam.worldToScreen(p.x, p.y, game.viewW, game.viewH);
  return { sx: q.x, sy: q.y, S: p.radius * 2.667 * (q.s || cam.totalZoom()) };
});
{
  const w = Math.round(heroBox.S * 2.4), h = Math.round(heroBox.S * 2.4);
  const x = Math.max(0, Math.round(heroBox.sx - w / 2)), y = Math.max(0, Math.round(heroBox.sy - h / 2 - heroBox.S * 0.2));
  const clip = { x, y, width: Math.min(w, VIEW.width - x), height: Math.min(h, VIEW.height - y) };
  await page.screenshot({ path: out('hero-crop.png'), clip });
  // perbesar 4× lewat kanvas di halaman (pixel asli, tanpa smoothing)
  const buf = fs.readFileSync(out('hero-crop.png')).toString('base64');
  const big = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width * 4; c.height = img.height * 4;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
  }, buf);
  fs.writeFileSync(out('hero-crop-4x.png'), Buffer.from(big, 'base64'));
}

// Jalan NAIK (arah -y) beberapa detik — di arena vertikal ini adalah arah "mendaki".
await page.keyboard.down('KeyW');
await page.waitForTimeout(WALK_SEC * 1000);
await page.keyboard.up('KeyW');
await page.waitForTimeout(200);
const metrics1 = await page.evaluate(() => {
  const { game } = window.__IMUNVERSE;
  const r = game.run;
  return { player: { x: r.player.x, y: r.player.y, hp: r.player.hp }, arenaBounds: r.arenaBounds, wave: r.spawnSys?.wave, enemies: r.enemies.filter((e) => e.alive).length };
});
await page.screenshot({ path: out('arena-up.png') });

// Jalan ke kiri sampai mentok dinding → uji visual clamp sisi.
await page.keyboard.down('KeyA');
await page.waitForTimeout(WALK_SEC * 1000);
await page.keyboard.up('KeyA');
await page.waitForTimeout(200);
const metrics2 = await page.evaluate(() => {
  const { game } = window.__IMUNVERSE;
  const r = game.run;
  return { player: { x: r.player.x, y: r.player.y, hp: r.player.hp }, arenaBounds: r.arenaBounds };
});
await page.screenshot({ path: out('arena-wall.png') });

// COMBAT: tarik musuh ke pemain lalu Pulse beberapa kali → bukti hit-flash,
// angka damage, telegraph. (Hanya memindahkan posisi musuh — bukan mekanik baru.)
if (process.env.COMBAT === '1') {
  try {
    await page.evaluate(() => {
      const r = window.__IMUNVERSE.game.run; const p = r.player; let k = 0;
      for (const e of r.enemies) { if (!e.alive) continue; const a = (k++ / 8) * Math.PI * 2; e.x = p.x + Math.cos(a) * 70; e.y = p.y + Math.sin(a) * 70; if (k >= 8) break; }
    });
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(350); }
    await page.waitForTimeout(120);
    await page.screenshot({ path: out('arena-combat.png') });
    const cb = await page.evaluate(() => { const v = window.__IMUNVERSE.game.run.player; return { x: v.x, y: v.y }; });
    await page.screenshot({ path: out('arena-combat-crop.png'), clip: { x: Math.max(0, VIEW.width / 2 - 220), y: Math.max(0, VIEW.height * 0.62 - 200), width: 440, height: 340 } });
  } catch (e) { errors.push('combat: ' + e.message); }
}

// Lab prototipe (3 mode berdampingan) — bukti bentuk hero.
let labOk = false;
try {
  await page.evaluate(() => window.__IMUNVERSE.hero.bukaLab());
  await page.waitForTimeout(900);
  await page.screenshot({ path: out('lab.png') });
  labOk = true;
  await page.evaluate(() => window.__IMUNVERSE.hero.tutupLab());
} catch (e) { errors.push('lab: ' + e.message); }

const report = { tag: TAG, viewport: VIEW, metrics0, metrics1, metrics2, labOk, errors };
fs.writeFileSync(out('metrics.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (errors.length) { console.error('ADA ERROR BROWSER:', errors); process.exit(1); }
