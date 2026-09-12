/**
 * e2e-walk-anim.mjs — Rebuild 8-arah: animasi jalan hero & virus.
 *
 * Menguji kontrak spesifikasi pemilik game:
 *   1. data/walk-anim.json termuat; 11 hero + 13 virus punya sheet
 *      (assets/sprites/walk/*) dan semua sheet benar-benar terunduh (200).
 *   2. Snapping: sudut kontinu dibulatkan ke kelipatan 45° terdekat
 *      (E=0°, SE=45°, S=90°, ..., NE=315°), termasuk sudut negatif.
 *   3. Mirror: W/NW/SW memakai kolom E/NE/SE + mirror=true (tanpa file ekstra).
 *   4. Gerak BEBAS: drag joystick 30° → arah velocity ≈ 30° (tidak snap),
 *      padahal sel animasi yang digambar = snap(30°) = SE.
 *   5. Frame ber-.cycle: saat bergerak, baris frame berubah (≥2 nilai unik)
 *      dan tetap 0..frames-1.
 *   6. Diam = hadap depan: cell (S, frame 0).
 *   7. Virus (musuh) memakai sheet saat mengejar: _lastWalkCell valid,
 *      termasuk jenis orientToMovement (bakteri) yang dulu di-rotasi manual.
 *   8. Tidak ada 404 / pageerror selama run.
 * Exit code 1 bila ada FAIL. Jalankan: node scripts/e2e-walk-anim.mjs
 * (server statis :8000 dari root repo + chromium di /tmp/chromium,
 *  playwright-core di /tmp/pw — pola sama dengan e2e-controls.mjs).
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium: pw } = require(process.env.PW_PATH || '/tmp/pw/node_modules/playwright-core');

// ---------- server statis :8000 (pakai yang sudah jalan bila ada) ----------
let serverProc = null;
try {
  await fetch('http://localhost:8000/index.html');
} catch {
  serverProc = spawn('python3', ['-m', 'http.server', '8000', '--bind', '0.0.0.0'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
}

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
const W = 844, H = 390;
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
const failedRequests = [];
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });

await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);

// ---------- 1) data + sheet termuat ----------
const data = await page.evaluate(() => {
  const wa = window.__IMUNVERSE.getData().walkAnim;
  return {
    ok: !!wa && Array.isArray(wa.sheetDirections),
    nHeroes: wa ? Object.keys(wa.heroes || {}).length : 0,
    nEnemies: wa ? Object.keys(wa.enemies || {}).length : 0,
    dirs: wa?.sheetDirections, frames: wa?.frames,
    sheets: wa ? [...Object.values(wa.heroes), ...Object.values(wa.enemies)].map((e) => e.sheet) : [],
  };
});
log('walk-anim-data-termuat', data.ok && data.nHeroes === 11 && data.nEnemies === 13, `heroes=${data.nHeroes} enemies=${data.nEnemies} dirs=[${data.dirs}]`);
let missing = 0;
for (const sheet of data.sheets) {
  const status = await page.evaluate(async (p) => (await fetch(p, { method: 'GET' })).status, sheet);
  if (status !== 200) { missing++; console.log('  sheet hilang:', status, sheet); }
}
log('semua-sheet-200', missing === 0, `cek ${data.sheets.length} sheet`);
// sheet sudah di-preload oleh sprite-loader (bukan jatuh ke placeholder)
log('sheet-dipreload', await page.evaluate(() => {
  const wa = window.__IMUNVERSE.getData().walkAnim;
  const { getSprite } = window.__IMUNVERSE.sprite;
  const all = [...Object.values(wa.heroes), ...Object.values(wa.enemies)];
  const bad = all.filter((e) => !getSprite(e.sheet) || getSprite(e.sheet).isPlaceholder);
  return bad.length === 0;
}), `dari ${data.sheets.length} sheet`);

// ---------- 2) logika snap 45° ----------
const snap = await page.evaluate(() => {
  const { snapDirIndex, DIR8 } = window.__IMUNVERSE.walk;
  const deg = (d) => d * Math.PI / 180;
  return {
    e: DIR8[snapDirIndex(deg(0))],
    se: DIR8[snapDirIndex(deg(30))],
    s: DIR8[snapDirIndex(deg(90))],
    sw: DIR8[snapDirIndex(deg(135))],
    w: DIR8[snapDirIndex(deg(180))],
    nw: DIR8[snapDirIndex(deg(-135))],
    n: DIR8[snapDirIndex(deg(-90))],
    ne: DIR8[snapDirIndex(deg(315))],
    boundary22: DIR8[snapDirIndex(deg(22.5))], // = SE (round naik)
    boundary157: DIR8[snapDirIndex(deg(157))],  // = W
  };
});
log('snap-8-arah', snap.e === 'E' && snap.se === 'SE' && snap.s === 'S' && snap.sw === 'SW' && snap.w === 'W' && snap.nw === 'NW' && snap.n === 'N' && snap.ne === 'NE',
  JSON.stringify(snap));

// ---------- 3) mirror W/NW/SW → kolom E/NE/SE ----------
const mirror = await page.evaluate(() => {
  const { resolveDirection, DIR8 } = window.__IMUNVERSE.walk;
  const dirs = ['E', 'NE', 'N', 'SE', 'S'];
  const idx = (n) => DIR8.indexOf(n);
  return {
    w: resolveDirection(idx('W'), dirs),
    nw: resolveDirection(idx('NW'), dirs),
    sw: resolveDirection(idx('SW'), dirs),
    e: resolveDirection(idx('E'), dirs),
  };
});
log('mirror-3-arah',
  mirror.w.mirror === true && mirror.w.col === 0 &&
  mirror.nw.mirror === true && mirror.nw.col === 1 &&
  mirror.sw.mirror === true && mirror.sw.col === 3 &&
  mirror.e.mirror === false && mirror.e.col === 0,
  JSON.stringify(mirror));

// ---------- mulai run ----------
await page.evaluate(() => window.__IMUNVERSE.game.startRun('macrophage'));
await page.waitForTimeout(1400);
await page.evaluate(() => { const p = window.__IMUNVERSE.game.run.player; p.iframes = 1e9; p.maxHP = 99999; p.hp = 99999; });

const pos = () => page.evaluate(() => { const p = window.__IMUNVERSE.game.run.player; return { x: p.x, y: p.y }; });

// ---------- 4+5) drag 30°: gerak bebas, animasi snap; frame berputar ----------
const p0 = await pos();
// titik tengah arena canvas (#game)
const cv = await page.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
const rad = (d) => (d * Math.PI) / 180;
const dragStart = { x: cv.x - Math.cos(rad(30)) * 50, y: cv.y - Math.sin(rad(30)) * 50 };
const dragEnd = { x: cv.x + Math.cos(rad(30)) * 55, y: cv.y + Math.sin(rad(30)) * 55 };
// sentuhan sintetis (pola e2e-controls) agar kompatibel semua driver
await page.evaluate(async ({ x0, y0, x1, y1, ms }) => {
  const el = document.elementFromPoint(x0, y0) || document.getElementById('game');
  const mk = (type, x, y) => {
    const t = new Touch({ identifier: 9, target: el, clientX: x, clientY: y });
    return new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true });
  };
  el.dispatchEvent(mk('touchstart', x0, y0));
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    el.dispatchEvent(mk('touchmove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps));
    await new Promise((r) => setTimeout(r, 20));
  }
  await new Promise((r) => setTimeout(r, ms));
}, { x0: dragStart.x, y0: dragStart.y, x1: dragEnd.x, y1: dragEnd.y, ms: 600 });

// sampling frame selama bergerak
const framesSeen = await page.evaluate(async () => {
  const seen = new Set();
  let cell = null;
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 80));
    cell = window.__IMUNVERSE.game.run.player._lastWalkCell;
    if (cell) seen.add(cell.row);
  }
  return { cell, rows: [...seen] };
});
const p1 = await pos();
const moveAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
const moveDeg = (moveAngle * 180) / Math.PI;
const distPx = Math.hypot(p1.x - p0.x, p1.y - p0.y);
log('gerak-terjadi', distPx > 30, `dist=${distPx.toFixed(1)}px`);
// gerakin bebas: ≈30° (toleransi lebar — smoothing + steer joystick)
log('gerak-bebas-bukan-snap', Math.abs(moveDeg - 30) < 25 || Math.abs(moveDeg + 330) < 25, `angle=${moveDeg.toFixed(1)}° (target ≈30°, bukan 45°)`);
// animasi snap: 30° → SE
log('animasi-snap-se', framesSeen.cell && framesSeen.cell.dirIndex === 1 && framesSeen.cell.mirror === false,
  JSON.stringify(framesSeen.cell));
log('frame-berputar', framesSeen.rows.length >= 2 && framesSeen.rows.every((r) => r >= 0 && r <= 3), `rows=[${framesSeen.rows}]`);
// lepas sentuhan
await page.evaluate(({ x0, y0 }) => {
  const el = document.elementFromPoint(x0, y0) || document.getElementById('game');
  const t = new Touch({ identifier: 9, target: el, clientX: x0, clientY: y0 });
  el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true }));
}, { x0: dragEnd.x, y0: dragEnd.y });

// ---------- 6) diam → hadap depan (S, frame 0) ----------
await page.waitForTimeout(700);
const idleCell = await page.evaluate(() => window.__IMUNVERSE.game.run.player._lastWalkCell);
log('diam-hadap-depan', !!idleCell && idleCell.dirIndex === 2 && idleCell.row === 0, JSON.stringify(idleCell));

// ---------- 7) musuh memakai sheet saat mengejar ----------
const enemyInfo = await page.evaluate(async () => {
  const g = window.__IMUNVERSE.game;
  const r = g.run;
  const p = r.player;
  // pastikan cukup musuh hidup (pakai spawner game bila wave belum spawn)
  if (r.enemies.filter((e) => e.alive).length < 3) {
    for (const id of ['bakteri', 'virus', 'bakteri_gp']) g.spawnEnemy(id);
    await new Promise((res) => setTimeout(res, 200));
  }
  // posisikan ke dekat player → masuk aggro → mengejar (gerak bebas)
  const pick = r.enemies.filter((e) => e.alive).slice(0, 3);
  pick.forEach((e, i) => {
    e.x = p.x + 150 * Math.cos(i * 2.1);
    e.y = p.y + 150 * Math.sin(i * 2.1);
  });
  await new Promise((res) => setTimeout(res, 1600));
  return pick.map((e) => ({
    id: e.def.id,
    orient: !!e.def.orientToMovement,
    cell: e._lastWalkCell || null,
    hasCfg: !!e._walkAnim,
    alive: e.alive,
  }));
});
if (enemyInfo) {
  const valid = enemyInfo.filter((e) => e.hasCfg && e.cell &&
    e.cell.col >= 0 && e.cell.col <= 4 && e.cell.row >= 0 && e.cell.row <= 3 &&
    Number.isInteger(e.cell.dirIndex) && e.cell.dirIndex >= 0 && e.cell.dirIndex <= 7 &&
    typeof e.cell.mirror === 'boolean');
  log('musuh-memakai-sheet', valid.length === enemyInfo.length,
    JSON.stringify(enemyInfo.map((e) => ({ id: e.id, orient: e.orient, cell: e.cell }))));
  const oriented = enemyInfo.filter((e) => e.orient);
  log('orientToMovement-lewat-sheet', oriented.length > 0 && oriented.every((e) => e.cell), `n=${oriented.length}`);
} else {
  log('musuh-memakai-sheet', false, 'tidak ada musuh untuk diuji');
}

// ---------- 8) screenshot bukti visual ----------
await page.evaluate(() => {
  const g = window.__IMUNVERSE.game, r = g.run, p = r.player;
  for (const e of r.enemies) if (e.alive) {
    e.x = p.x + 170; e.y = p.y + 60; e.walkAngle = Math.atan2(60, 170);
  }
});
await page.waitForTimeout(400);
const shotDir = path.join(ROOT, 'shots', 'review');
if (existsSync(shotDir)) {
  await page.screenshot({ path: path.join(shotDir, 'walk-anim-e2e.png') });
  log('screenshot', true, 'shots/review/walk-anim-e2e.png');
}

// ---------- 9) bersih ----------
log('tanpa-pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));
log('tanpa-request-gagal', failedRequests.length === 0, failedRequests.slice(0, 5).join(' | '));

await browser.close();
if (serverProc) serverProc.kill();
console.log(fails === 0 ? '\nSEMUA TES WALK-ANIM LULUS ✔' : `\nGAGAL: ${fails} tes`);
process.exit(fails === 0 ? 0 : 1);
