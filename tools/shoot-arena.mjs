/**
 * shoot-arena.mjs — bukti visual ARENA TERTUTUP + HUD 5 elemen + MAP denah.
 * Chromium headless (playwright-core + @sparticuz/chromium) membuka index.html
 * dari server statis lokal, memulai run nyata, lalu memotret momen spec:
 *   1. after-chamber-lockdown.jpg  — ENTRY/LOCKDOWN: katup terkunci, warna infeksi
 *   2. after-chamber-swarm-hud.jpg — SWARM: patogen dari pori dinding + HUD lengkap
 *   3. after-chamber-purified.jpg  — PURIFIED/OPEN: shockwave + pintu terbuka
 *   4. after-map-denah-states.jpg  — MAP (tahan M): denah + penanda status organ
 *
 *   LD_LIBRARY_PATH=/tmp/al2023/lib node tools/shoot-arena.mjs [outDir]
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium: pw } = require('playwright-core');

const OUT = process.argv[2] || 'docs/vision-snapshot';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json' };

// server statis repo
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(process.cwd(), p);
  if (!f.startsWith(process.cwd()) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(8123, '127.0.0.1', r));

let exe = process.env.CHROMIUM_PATH;
if (!exe) { try { const c = require('@sparticuz/chromium'); exe = await (c.default || c).executablePath(); } catch { exe = '/tmp/chromium'; } }
const browser = await pw.launch({
  executablePath: exe,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
await page.waitForFunction('!!window.__IMUNVERSE && !!window.__IMUNVERSE.game', null, { timeout: 60000 });

// mulai run nyata
await page.evaluate(() => {
  const G = window.__IMUNVERSE;
  G.game.startRun('macrophage');
  G.STATE.screen = 'gameplay';
  G.game.run.introT = 10; // lewati snap macro intro — langsung ke arena
});
await page.waitForTimeout(2500);

const glInfo = await page.evaluate(() => {
  const g = window.__IMUNVERSE.game;
  return { gl: !!(g._bodyGL && g._bodyGL.ok), state: g.run.chamber && g.run.chamber.state, zone: g.run.chamber && g.run.chamber.zoneId };
});
console.log('[info] renderer GL aktif =', glInfo.gl, '| chamber state =', glInfo.state, '| zona =', glInfo.zone);

const shot = async (name) => {
  const f = path.join(OUT, name);
  await page.screenshot({ path: f, type: 'jpeg', quality: 88, timeout: 120000 });
  console.log('[shot]', f);
};
await shot('after-chamber-lockdown.jpg');

// SWARM: tunggu state machine + biarkan patogen menumpuk
await page.waitForFunction('window.__IMUNVERSE.game.run.chamber && window.__IMUNVERSE.game.run.chamber.state === "swarm"', null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(4000);
await shot('after-chamber-swarm-hud.jpg');

// PURIFIED/OPEN: basmi semua patogen (jalan sah — mekanisme kill nyata)
await page.evaluate(() => {
  const run = window.__IMUNVERSE.game.run;
  for (const e of run.enemies) if (e.takeDamage) e.takeDamage(99999);
});
await page.waitForTimeout(900);
await shot('after-chamber-purified.jpg');
await page.waitForFunction('(window.__IMUNVERSE.game.run.chamber||{}).state === "open" || (window.__IMUNVERSE.game.run.chamber||{}).openAmt > 0.5', null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(600);
await shot('after-chamber-open-door.jpg');

// MAP denah: tahan tombol M (snap macro) — penanda status organ
await page.evaluate(() => { window.__IMUNVERSE.game.input.keys.add('map'); });
await page.waitForTimeout(1200);
await shot('after-map-denah-states.jpg');
await page.evaluate(() => { window.__IMUNVERSE.game.input.keys.delete('map'); });

await browser.close();
server.close();
console.log('[done] semua tangkapan di', OUT);
process.exit(0);
