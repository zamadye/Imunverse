/**
 * e2e-vision-snapshot.mjs — VISION SNAPSHOT arah UI/UX baru (video referensi).
 *
 * Memotret keadaan NYATA di browser headless (Chromium) supaya perubahan arah
 * visual bisa diverifikasi mata, bukan hanya oleh penguji unit:
 *   1. dashboard            — layar meta pasca-reset
 *   2. <zone>-wide          — arena in-run per organ (interior backlit + dinding baru)
 *   3. jantung-hero-4x      — crop 4× protagonis (siluet spindly + core menyala)
 *   4. hud-anchors          — crop strip kiri (vial charge + bar segmen + orb)
 *
 * Dipakai juga untuk pasangan BEFORE/AFTER: jalankan dua kali dengan BASE_URL
 * berbeda (server commit lama vs commit baru), lalu bandingkan/susun montage.
 *
 *   npm i -D --no-save playwright-core @sparticuz/chromium
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife   # tidak wajib; ES module langsung
 *   BASE_URL=http://127.0.0.1:8000/ OUT_DIR=docs/vision-snapshot TAG=after \
 *     node scripts/e2e-vision-snapshot.mjs
 *
 * Tidak menambah dependency ke package.json.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const TAG = process.env.TAG || 'shot';
const OUT_DIR = process.env.OUT_DIR || 'docs/vision-snapshot';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';
const VIEW = { width: Number(process.env.VIEW_W || 960), height: Number(process.env.VIEW_H || 540) };
const ZONES = (process.env.ZONES || 'heart,lung,capillary,lymphatic').split(',');

const { chromium: pw } = require(process.env.PW_PATH || 'playwright-core');
let exe = process.env.CHROMIUM_PATH;
if (!exe) {
  try { const c = require('@sparticuz/chromium'); exe = await (c.default || c).executablePath(); } catch { exe = '/tmp/chromium'; }
}
fs.mkdirSync(OUT_DIR, { recursive: true });
const out = (n) => path.join(OUT_DIR, `${TAG}-${n}`);

const browser = await pw.launch({
  executablePath: exe, headless: true,
  // @sparticuz/chromium membawa lib NSS/NSPR sendiri; bila belum diekstrak:
  //   node -e "zlib.brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br'))" > /tmp/al2023.tar && tar -xf /tmp/al2023.tar -C /tmp/al2023
  env: {
    ...process.env,
    LD_LIBRARY_PATH: ['/tmp/al2023/lib', '/tmp', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
    FONTCONFIG_PATH: '/tmp/fonts',
  },
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--use-gl=swiftshader'],
});
const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(`${BASE_URL}?dev=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__IMUNVERSE?.STATE?.meta && !!window.__IMUNVERSE?.getData?.()?.arenas, null, { timeout: 30000 });
await page.addStyleTag({ content: `*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}` });
await page.waitForFunction(() => window.__IMUNVERSE.STATE.screen !== 'loading', null, { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: out('dashboard.png') });

// Mulai run + lompat zona, lalu potret arena per organ.
const setup = (ZONE) => page.evaluate((ZONE) => {
  const app = window.__IMUNVERSE;
  const { STATE, game } = app;
  const meta = STATE.meta;
  meta.account = meta.account || { uid: 'snap', username: 'Snapshot', faction: 'imun', createdAt: new Date().toISOString() };
  meta.coachDone = true; meta.tutorialDone = true; meta.onboardingDone = true;
  meta.soundMuted = true; meta.musicOn = false;
  meta.selectedHero = 'macrophage';
  STATE.paused = false; STATE.levelUpOpen = false;
  try { app.hero && app.hero.resetHeroMode && app.hero.resetHeroMode(); } catch { /* abaikan */ }
  if (game.run) { try { game.run.ended = true; } catch { /* abaikan */ } }
  game.startRun('macrophage');
  const p = game.run.player;
  p.maxHP = 99999; p.hp = 99999; p.iframes = 99999;
  try { app.world._jumpToZone(game, ZONE); } catch { /* zona awal */ }
  document.getElementById('tutorial-layer')?.classList.add('hidden');
  // JANGAN remove #hud-hint: resetHUD() masih menulis innerHTML-nya saat runstart.
  // Cukup sembunyikan supaya tidak menutupi arena di snapshot.
  document.querySelectorAll('.presenter, .toast').forEach((el) => el.remove());
  document.querySelectorAll('.hud-hint, #hud-hint, .control-hint').forEach((el) => { el.style.display = 'none'; });
}, ZONE);

for (const ZONE of ZONES) {
  await setup(ZONE);
  await page.waitForFunction(() => document.querySelector('#screen-hud')?.classList.contains('active'), null, { timeout: 8000 });
  await page.waitForTimeout(900); // biarkan denyut/chordae/aliran terlihat
  await page.screenshot({ path: out(`${ZONE}-wide.png`) });
  if (ZONE === ZONES[0]) {
    // crop protagonis 4× (nearest) untuk inspeksi siluet
    const heroBox = await page.evaluate(() => {
      const { game } = window.__IMUNVERSE;
      const cam = game.run.camera;
      const p = game.run.player;
      const q = cam.getPlayerScreen ? (cam.getPlayerScreen() || cam.worldToScreen(p.x, p.y, game.viewW, game.viewH)) : cam.worldToScreen(p.x, p.y, game.viewW, game.viewH);
      return { sx: q.x, sy: q.y, S: p.radius * 2.667 * (q.s || cam.totalZoom()) };
    });
    const w = Math.round(heroBox.S * 2.6), h = Math.round(heroBox.S * 2.6);
    const x = Math.max(0, Math.round(heroBox.sx - w / 2)), y = Math.max(0, Math.round(heroBox.sy - h / 2));
    await page.screenshot({ path: out('hero-crop.png'), clip: { x, y, width: Math.min(w, VIEW.width - x), height: Math.min(h, VIEW.height - y) } });
    const buf = fs.readFileSync(out('hero-crop.png')).toString('base64');
    const big = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width * 4; c.height = img.height * 4;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/png').split(',')[1];
    }, buf);
    fs.writeFileSync(out('hero-crop-4x.png'), Buffer.from(big, 'base64'));
    // strip kiri HUD: vial charge (atas) + bar segmen & orb (bawah)
    await page.screenshot({ path: out('hud-anchors.png'), clip: { x: 0, y: 0, width: 220, height: VIEW.height } });
  }
}

await browser.close();
const fatal = errors.filter((e) => !/favicon|net::ERR|404|Failed to load resource/i.test(e));
console.log(JSON.stringify({ tag: TAG, shots: fs.readdirSync(OUT_DIR).filter((f) => f.startsWith(TAG + '-')), errors: fatal }, null, 1));
if (fatal.length) process.exit(1);
