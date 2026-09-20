/**
 * e2e-hero-sheet.mjs — contact sheet 7 hero ber-rig (bio-form abstrak) yang
 * dirender oleh drawCreature() ASLI di Chromium: tiap hero 3 sudut (samping,
 * depan, belakang) dalam keadaan jalan. Bukti visual "identitas dari siluet".
 *
 *   TAG=after LD_LIBRARY_PATH=/tmp/al2023-lib/lib node scripts/e2e-hero-sheet.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const TAG = process.env.TAG || 'sheet';
const OUT_DIR = process.env.OUT_DIR || 'shots/pilot-jantung';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000/';
const { chromium: pw } = require(process.env.PW_PATH || 'playwright-core');
let exe = process.env.CHROMIUM_PATH;
if (!exe) { try { const c = require('@sparticuz/chromium'); exe = await (c.default || c).executablePath(); } catch { exe = '/tmp/chromium'; } }
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await pw.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE_URL}?dev=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__IMUNVERSE?.creature && !!window.__IMUNVERSE?.getData?.()?.creatureRigs, null, { timeout: 30000 });

const b64 = await page.evaluate(() => {
  const { creature, getData } = window.__IMUNVERSE;
  const heroes = getData().heroes.heroes;
  const ids = ['macrophage', 'dendritic', 'neutrophil', 'eosinophil', 'basophil', 'mastcell', 'tcd8'];
  const CELL = 150, S = 96;
  const c = document.createElement('canvas'); c.width = CELL * 4 + 40; c.height = CELL * ids.length + 30;
  const g = c.getContext('2d');
  g.fillStyle = '#efd3cf'; g.fillRect(0, 0, c.width, c.height); // tanah organ (merah muda) — kontras nyata
  g.font = '700 13px system-ui, sans-serif'; g.fillStyle = '#2a1a1a';
  const angles = [['samping', 0], ['depan', Math.PI / 2], ['belakang', -Math.PI / 2]];
  angles.forEach(([n], i) => { g.fillText(n, 40 + i * CELL + CELL / 2 - 22, 18); });
  ids.forEach((id, r) => {
    const hd = heroes.find((h) => h.id === id);
    g.save(); g.translate(8, 30 + r * CELL + CELL / 2); g.rotate(-Math.PI / 2); g.fillStyle = '#2a1a1a'; g.fillText((hd && hd.name) || id, -30, 8); g.restore();
    angles.forEach(([, a], i) => {
      const x = 40 + i * CELL + CELL / 2, y = 30 + r * CELL + CELL * 0.5;
      creature.drawCreature(g, { id, state: 'walk', u: 0.3, x, y, size: S, facing: a, time: 1.7 + r });
    });
    // sel 4: idle diperbesar
    creature.drawCreature(g, { id, state: 'idle', u: 0.4, x: 40 + 3 * CELL + CELL / 2, y: 30 + r * CELL + CELL * 0.55, size: S * 1.2, facing: 0.6, time: 2.2 + r });
  });
  return c.toDataURL('image/png').split(',')[1];
});
const file = path.join(OUT_DIR, `${TAG}-hero-sheet.png`);
fs.writeFileSync(file, Buffer.from(b64, 'base64'));
console.log(file, errors.length ? errors : 'ok');
await browser.close();
process.exit(errors.length ? 1 : 0);
