/**
 * key-sprites.mjs — chroma-key (magenta/lime) → PNG transparan, crop ke isi,
 * pad ke persegi, downscale ke ukuran target. Dijalankan di Chromium headless
 * (tidak ada dependensi gambar native di sandbox).
 *
 *   LD_LIBRARY_PATH=/tmp/al2023-lib/lib node tools/key-sprites.mjs in.png out.png [size]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium: pw } = require('playwright-core');
const jobs = JSON.parse(process.argv[2]); // [{in,out,size}]
let exe = process.env.CHROMIUM_PATH;
if (!exe) { try { const c = require('@sparticuz/chromium'); exe = await (c.default || c).executablePath(); } catch { exe = '/tmp/chromium'; } }
const browser = await pw.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
for (const j of jobs) {
  const b64 = fs.readFileSync(j.in).toString('base64');
  const out = await page.evaluate(async ({ b64, size }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height); const p = d.data;
    // deteksi warna kunci dari pojok
    const kr = p[0], kg = p[1], kb = p[2];
    const isKey = (r, g2, b) => {
      const dist = Math.abs(r - kr) + Math.abs(g2 - kg) + Math.abs(b - kb);
      return dist < 140;
    };
    let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (isKey(p[i], p[i + 1], p[i + 2])) { p[i + 3] = 0; continue; }
      // de-spill: tepi yang kena semburat warna kunci → tarik ke gelap
      const dist = Math.abs(p[i] - kr) + Math.abs(p[i + 1] - kg) + Math.abs(p[i + 2] - kb);
      if (dist < 260) { const a = (dist - 140) / 120; p[i + 3] = Math.round(255 * a); p[i] *= 0.4; p[i + 1] *= 0.4; p[i + 2] *= 0.4; }
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    g.putImageData(d, 0, 0);
    const w = maxX - minX + 1, h = maxY - minY + 1, s = Math.max(w, h);
    const sq = document.createElement('canvas'); sq.width = s; sq.height = s;
    sq.getContext('2d').drawImage(c, minX, minY, w, h, (s - w) / 2, (s - h) / 2, w, h);
    const o = document.createElement('canvas'); o.width = size; o.height = size;
    const og = o.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
    og.drawImage(sq, 0, 0, size, size);
    return o.toDataURL('image/png').split(',')[1];
  }, { b64, size: j.size || 256 });
  fs.mkdirSync(path.dirname(j.out), { recursive: true });
  fs.writeFileSync(j.out, Buffer.from(out, 'base64'));
  console.log('ok', j.out);
}
await browser.close();
