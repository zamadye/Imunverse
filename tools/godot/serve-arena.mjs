/**
 * serve-arena.mjs — menjalankan vertical slice Godot (godot/arena) di Chromium
 * headless sebagai bukti visual: mesin wasm-web Godot diboot di halaman nyata
 * (canvas WebGL2 sungguhan, bukan shim headless), berkas project disalin ke
 * MEMFS persis seperti tools/godot/run.mjs, lalu main scene dirender.
 *
 *   LD_LIBRARY_PATH=/tmp/alx/lib:/tmp/alx node tools/godot/serve-arena.mjs [outPrefix]
 *
 * Menghasilkan: docs/vision-snapshot/<outPrefix>-1.jpg & -2.jpg
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium: pw } = require('playwright-core');

const ROOT = process.cwd();
const PROJ = path.join(ROOT, 'godot/arena');
const ENGINE = path.join(ROOT, 'tools/godot/engine');
const OUT = process.argv[2] || 'docs/vision-snapshot/godot-arena';
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.png': 'image/png', '.gd': 'text/plain', '.godot': 'text/plain', '.tscn': 'text/plain', '.gdshader': 'text/plain', '.json': 'application/json' };

const walk = (dir, base = dir, out = []) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, base, out);
    else out.push({ rel: path.relative(base, p).split(path.sep).join('/'), memfs: p });
  }
  return out;
};
const manifest = walk(PROJ);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#0b0206;overflow:hidden}canvas{width:1280px;height:720px;display:block}
</style></head><body>
<canvas id="canvas" width="1280" height="720"></canvas>
<script type="module">
window.__boot = 'start';
import Godot from '/engine/godot.mjs';
try {
  const wasm = new Uint8Array(await (await fetch('/engine/godot.wasm')).arrayBuffer());
  const man = await (await fetch('/__manifest')).json();
  const M = await Godot({ wasmBinary: wasm, canvas: document.getElementById('canvas'), locateFile: (p) => '/engine/' + p });
  if (M.initConfig) M.initConfig({ canvas: document.getElementById('canvas'), locale: 'en', canvasResizePolicy: 0 });
  for (const f of man) {
    const buf = new Uint8Array(await (await fetch('/proj/' + f.rel)).arrayBuffer());
    M.copyToFS(f.memfs, buf);
  }
  window.__boot = 'callMain';
  M.callMain(['--audio-driver', 'Dummy', '--path', ${JSON.stringify(PROJ)}]);
  window.__boot = 'running';
} catch (e) { window.__boot = 'error: ' + (e && e.message) + ' | ' + (e && e.stack ? String(e.stack).split(String.fromCharCode(10)).slice(0,4).join(' ~ ') : ''); document.title = 'BOOTERR'; }
</script></body></html>`;

fs.writeFileSync('/tmp/page.html', PAGE);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/' || u === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(PAGE); return; }
  if (u === '/__manifest') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(manifest)); return; }
  if (u.startsWith('/engine/')) {
    let name = u.slice(8);
    if (name === 'godot.wasm') name = 'godot.web.template_release.wasm32.nothreads.wasm';
    if (name === 'godot.mjs') name = 'godot.mjs';
    const f = path.join(ENGINE, name);
    if (fs.existsSync(f)) { res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); return; }
  }
  if (u.startsWith('/proj/')) {
    const f = path.join(PROJ, u.slice(6));
    if (fs.existsSync(f)) { res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); return; }
  }
  res.writeHead(404); res.end('nf');
});
await new Promise((r) => server.listen(8126, '127.0.0.1', r));

let exe = process.env.CHROMIUM_PATH;
if (!exe) { try { const c = require('@sparticuz/chromium'); exe = await (c.default || c).executablePath(); } catch { exe = '/tmp/chromium'; } }
const browser = await pw.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(240000);
page.on('console', (m) => { const t = m.text(); if (/error|ERROR|WARNING: GLES|fail|DBG/i.test(t)) console.log('[page]', t.slice(0, 240)); });
page.on('pageerror', (e) => console.log('[pageerror]', String(e.message).slice(0, 200)));
await page.goto('http://127.0.0.1:8126/', { waitUntil: 'load' });
await page.waitForFunction("window.__boot === 'running'", null, { timeout: 120000 }).catch(async () => {
  console.log('[boot]', String(await page.evaluate('window.__boot')).slice(0, 600));
});
await page.waitForTimeout(6000);
console.log('[canvas]', await page.evaluate(() => { const c = document.querySelector('canvas'); return c.width + 'x' + c.height + ' css ' + c.clientWidth + 'x' + c.clientHeight; }));
await page.screenshot({ path: OUT + '-1.jpg', type: 'jpeg', quality: 88, timeout: 120000 });
console.log('[shot]', OUT + '-1.jpg');
await page.waitForTimeout(6000);
await page.screenshot({ path: OUT + '-2.jpg', type: 'jpeg', quality: 88, timeout: 120000 });
console.log('[shot]', OUT + '-2.jpg');
await browser.close();
server.close();
console.log('[done]');
process.exit(0);
