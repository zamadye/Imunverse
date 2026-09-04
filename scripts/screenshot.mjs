/**
 * screenshot.mjs — bukti runtime browser Chromium asli (Imunverse).
 * Jalankan: cd /tmp/pw && LD_LIBRARY_PATH=/tmp/alibs/lib node /home/user/Imunverse/scripts/screenshot.mjs
 * Alur: loading → dashboard (evolusi+arena) → roster → shop → upgrade →
 *       gameplay (ability bar + overlay evolusi) → skill petir → boss chest
 *       → gameover → retry → pause.
 */
let chromium;
let c;
try {
  ({ chromium } = await import('playwright-core'));
  c = (await import('@sparticuz/chromium')).default;
} catch {
  // fallback saat skrip dijalankan dari repo (node_modules ada di /tmp/pw)
  ({ chromium } = await import('file:///tmp/pw/node_modules/playwright-core/index.mjs'));
  c = (await import('file:///tmp/pw/node_modules/@sparticuz/chromium/build/index.js')).default;
}
import fs from 'node:fs';

const OUT = '/home/user/shots';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8000/index.html';
const errors = [];

const browser = await chromium.launch({
  executablePath: await c.executablePath(),
  args: [...c.args, '--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('response', (r) => { if (r.status() === 404) errors.push(`404 ${r.url()}`); });

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const sleep = (ms) => page.waitForTimeout(ms);
const activeScreen = () => page.evaluate(() => document.querySelector('.screen.active')?.dataset?.screen);

// Throttle jaringan biar loading screen (preload sprite) sempat terlihat
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, latency: 400, downloadThroughput: 120 * 1024, uploadThroughput: 120 * 1024,
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(900);
await shot('01-loading');
// Kembalikan ke kecepatan penuh
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});
await page.waitForSelector('#screen-dashboard.active', { timeout: 30000 });
await sleep(900);
await shot('02-dashboard');

// --- layar navigasi (sebelum run): roster, shop, upgrade, arena ---
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#screen-dashboard button, #screen-dashboard .nav-item, #screen-dashboard [role]')]
    .find((x) => /roster|hero|tim/i.test(x.textContent || ''));
  if (b) b.click();
});
await sleep(600);
if ((await activeScreen()) === 'roster') {
  await shot('03-roster');
}
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('shop'));
await sleep(600);
await shot('04-shop');
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('upgrade'));
await sleep(600);
await shot('05-upgrade');
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('dashboard'));
await sleep(500);
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('arena'));
await sleep(600);
await shot('13-arena');
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('dashboard'));
await sleep(400);

// --- simulasi progres: hero evolusi epic (stage 3), arena paru, bagian terkumpul ---
await page.evaluate(() => {
  const m = window.__IMUNVERSE.STATE.meta;
  m.evoStage = 3;
  m.evoParts = { silia: 3, pseudopodia: 2, mikropedang: 1, inti_elemen: 0 };
  m.selectedArena = 'paru';
  m.currency = 850;
  window.__IMUNVERSE.screenManager.show('dashboard');
});
await sleep(900);
await shot('02-dashboard');

// --- kondisi tubuh: kartu default sudah terlihat; buat 1 sistem KRITIS ---
await page.evaluate(() => {
  const m = window.__IMUNVERSE.STATE.meta;
  m.bodyState.systems.limfatik.health = 14; // < 20 → kondisi kritis
  m.bodyState.racun = 74;
  window.__IMUNVERSE.screenManager.show('dashboard');
});
await sleep(900);
await shot('16-body-critical');

// --- modal fokus run ---
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('focus'));
await sleep(600);
await shot('17-focus');
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('dashboard'));
await sleep(400);

// --- shop: section suplemen sistem tubuh ---
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('shop'));
await sleep(500);
// scroll halaman sampai section SUPLEMEN SISTEM TUBUH terlihat
await page.evaluate(() => {
  const h3 = [...document.querySelectorAll('#shop-sections h3')].find((x) => /SUPLEMEN/i.test(x.textContent));
  h3?.scrollIntoView({ block: 'center' });
});
await sleep(400);
await shot('18-shop-suplemen');

// --- TAS / inventory (via dock) ---
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('bag'));
await sleep(600);
await shot('19-bag');
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('dashboard'));
await sleep(400);

// --- BATTLE PREP: MULAI besar → pilih hero/fokus/arena → MULAI RUN ---
await page.click('#btn-play-big');
await sleep(600);
await shot('20-prep');
await page.evaluate(() => {
  // pilih fokus detoks & arena paru via klik nyata pada chip
  const chips = [...document.querySelectorAll('#prep-focus-row .prep-chip')];
  chips.find((c) => /Detoks/i.test(c.textContent))?.click();
});
await sleep(400);
await page.evaluate(() => {
  const chips = [...document.querySelectorAll('#prep-arena-row .prep-chip')];
  chips.find((c) => /Paru/i.test(c.textContent))?.click();
});
await sleep(400);
await page.click('#btn-prep-start');
await sleep(2200);
await shot('07-gameplay-early');

// joystick virtual: tahan & geser
// (tutorial hanya muncul di run pertama — cek kondisi)
const tutVisible = await page.evaluate(() => !document.getElementById('tutorial-layer').classList.contains('hidden'));
if (tutVisible) {
  await sleep(600);
  await shot('21-tutorial');
}

await page.mouse.move(70, 700);
await page.mouse.down();
await page.mouse.move(140, 630, { steps: 8 });
await sleep(2500);
await shot('08-gameplay-mid');

// --- kemampuan petir (slot 3) — VFX petir menyambar musuh ---
await page.evaluate(() => {
  const g = window.__IMUNVERSE.game;
  for (let i = 0; i < 5; i++) {
    g.run.enemies.forEach?.(() => {});
  }
  // spawn beberapa musuh di sekitar player agar petir kena
  for (let i = 0; i < 4; i++) g.spawnEnemy('bakteri', false);
  g.run.enemies.slice(-4).forEach((e, i) => {
    const a = (i / 4) * Math.PI * 2;
    e.x = g.run.player.x + Math.cos(a) * 90;
    e.y = g.run.player.y + Math.sin(a) * 90;
  });
});
await page.evaluate(() => window.__IMUNVERSE.game.useAbilityBySlot(3)); // petir
await sleep(350);
await shot('12-skill-petir');
await page.evaluate(() => window.__IMUNVERSE.game.useAbilityBySlot(1)); // tebasan
await sleep(300);

await sleep(1200);

// --- COMBO juice: paksa combo tinggi agar pill muncul ---
await page.evaluate(() => {
  const g = window.__IMUNVERSE.game;
  if (g.run) {
    g.run.combo.count = 12;
    g.run.combo.timer = 5;
  }
});
await sleep(300);
await shot('22-combo');

await sleep(1400);
await page.mouse.up();
await shot('09-gameplay-12s');

// --- PETI BOSS: spawn boss lalu kalahkan → modal natural break ---
await page.evaluate(() => {
  const g = window.__IMUNVERSE.game;
  g.spawnEnemy('sel_kanker', true);
  const boss = g.run.boss;
  if (boss) {
    boss.x = g.run.player.x + 150;
    boss.y = g.run.player.y;
    g.onEnemyKilled(boss, null); // alur asli: drop + peti boss + pause
  }
});
await sleep(800);
if ((await activeScreen()) === 'bosschest' || (await page.locator('#screen-bosschest').isVisible())) {
  await shot('14-bosschest');
  await page.click('#btn-chest-keep');
  await sleep(600);
}

// --- modal level-up: paksa XP cukup untuk naik level ---
await page.evaluate(() => { window.__IMUNVERSE.game.addXP(9999); });
await sleep(900);
if ((await activeScreen()) === 'levelup' || (await page.locator('#screen-levelup').isVisible())) {
  await shot('10-levelup');
  await page.click('#screen-levelup .choice-card, #screen-levelup button');
  await sleep(500);
}

// --- gameover: paksa HP player habis (lewati penawaran revive) ---
await page.evaluate(() => {
  const g = window.__IMUNVERSE.game;
  if (g?.run?.player) {
    g.run.reviveOffered = true; // lewati modal revive → langsung gameover
    g.run.player.hp = 0;
    g.run.player.alive = false;
    g.handlePlayerDeath(); // trigger alur akhir run yang asli
  }
});
await sleep(1800);
if ((await activeScreen()) === 'gameover') await shot('11-gameover');

// --- retry lalu pause ---
await page.click('#btn-retry');
await sleep(1600);
await page.click('#btn-pause');
await sleep(600);
if ((await activeScreen()) === 'pause' || (await page.locator('#screen-pause').isVisible())) {
  await shot('15-pause');
}

// --- Papan rekor terisi (Fase 7 liveops) — kembali ke dashboard setelah run ---
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('dashboard'));
await sleep(500);
await page.evaluate(() => document.getElementById('leaderboard-card').scrollIntoView({ block: 'center' }));
await sleep(300);
await shot('23-leaderboard');

await browser.close();
console.log(`SHOTS_OK ${errors.length === 0 ? 'CLEAN' : 'ERRORS:'}`);
errors.slice(0, 20).forEach((e) => console.log('  !', e));
process.exit(errors.length === 0 ? 0 : 2);
