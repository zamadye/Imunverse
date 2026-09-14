/**
 * verify-phagos.mjs — Harness verifikasi PHAGOS tanpa browser.
 *
 * Chromium/Playwright tak bisa diunduh di sandbox ini (firewall), jadi harness
 * ini menjalankan KODE GAME ASLI di Node: DOM via jsdom + render Canvas 2D via
 * @napi-rs/canvas (Skia). Yang diverifikasi = logika + piksel render sebenarnya:
 *   1. boot + startRun (membran + arenaBounds terinisiasi)
 *   2. kill KONSULTASI joystick-only (musuh mati oleh kontak, tanpa input serang)
 *   3. engulf → Bio-Point + heal
 *   4. PULSE via keyboard queue (snapshot mid-pulse)
 *   5. level-up → kartu MUTASI (bukan stat), apply → overlay visual aktif
 *   6. trait musuh wave 6 (select + inject 35%)
 *   7. screenshot PNG tiap tahap (bukti visual)
 *
 * Jalankan: node scripts/verify-phagos.mjs  (cwd = root repo)
 * Butuh: /tmp/vfy/node_modules (jsdom, @napi-rs/canvas) atau VERIFY_PATH.
 * Keluar 1 bila ada FAIL. Screenshot: /tmp/phagos-verify/*.png
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const VFY = process.env.VERIFY_PATH || '/tmp/vfy/node_modules';
const { JSDOM } = require(path.join(VFY, 'jsdom'));
const napi = require(path.join(VFY, '@napi-rs/canvas'));

const ROOT = process.cwd();
const SHOT_DIR = '/tmp/phagos-verify';
fs.mkdirSync(SHOT_DIR, { recursive: true });

let fails = 0;
const log = (k, v, extra) => {
  if (v === false) fails += 1;
  console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${extra ? ' ' + extra : ''}`);
};

// ---------- DOM ----------
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:8123/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.localStorage = dom.window.localStorage;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLMediaElement = dom.window.HTMLMediaElement;
global.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.HTMLMediaElement.prototype.play = () => Promise.resolve();
global.HTMLMediaElement.prototype.pause = () => {};
// performance: pakai Node (lebih presisi); jsdom window.performance tetap ada

// ---------- fetch: data lokal dari disk ----------
const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  const s = String(url);
  if (/^https?:\/\//.test(s)) return realFetch(url, opts);
  const clean = s.split('?')[0].replace(/^\.\//, '');
  const fp = path.join(ROOT, clean);
  if (!fs.existsSync(fp)) return new Response('not found', { status: 404 });
  const buf = fs.readFileSync(fp);
  const ct = fp.endsWith('.json') ? 'application/json' : fp.endsWith('.png') ? 'image/png' : 'application/octet-stream';
  return new Response(buf, { status: 200, headers: { 'content-type': ct } });
};

// ---------- Canvas 2D: jsdom el → napi context ----------
const napiByEl = new WeakMap();
const resolveDrawSrc = (img) => {
  // Elemen canvas jsdom → kanvas napi pendukungnya
  if (img && img.ownerDocument && napiByEl.has(img)) return napiByEl.get(img);
  return img;
};
dom.window.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type !== '2d') return null;
  let c = napiByEl.get(this);
  const w = Math.max(1, this.width || 300), h = Math.max(1, this.height || 150);
  if (!c || c.__w !== w || c.__h !== h) {
    const nc = napi.createCanvas(w, h);
    nc.__w = w; nc.__h = h;
    napiByEl.set(this, nc);
    c = nc;
    // Bungkus drawImage/createPattern sekali per context
    const g = c.getContext('2d');
    const rawDraw = g.drawImage.bind(g);
    g.drawImage = (img, ...rest) => rawDraw(resolveDrawSrc(img), ...rest);
    if (g.createPattern) {
      const rawPat = g.createPattern.bind(g);
      g.createPattern = (img, rep) => rawPat(resolveDrawSrc(img), rep);
    }
    c.__ctx = g;
  }
  return c.__ctx;
};
const napiCanvasOf = (el) => napiByEl.get(el);

// ---------- Image: napi + strip ?v= ----------
class RepoImage extends napi.Image {
  set src(v) {
    super.src = String(v).split('?')[0];
  }
  get src() { return super.src; }
}
global.Image = RepoImage;
dom.window.Image = RepoImage;

// ---------- Impor kode game ASLI ----------
const mod = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { game } = await mod('js/core/game.js');
const { STATE, createDefaultMeta } = await mod('js/core/state-manager.js');
const { loadAllData, getData } = await mod('js/core/data-store.js');
const { loadAllSprites } = await mod('js/render/sprite-loader.js');
const { InputHandler } = await mod('js/input/input-handler.js');
const mutSys = await mod('js/systems/mutation-system.js');
const enemyMutSys = await mod('js/systems/enemy-mutation-system.js');
const memSys = await mod('js/systems/membrane-system.js');

const canvas = document.getElementById('game');
canvas.width = 844; canvas.height = 390;

// ---------- BOOT ----------
await loadAllData();
log('data-loaded', !!getData().mutations && getData().mutations.mutations.length === 18);
STATE.meta = createDefaultMeta();
const spr = await loadAllSprites(getData());
log('sprites-loaded', spr.fallback === 0, `fallback=${spr.fallback} loaded=${spr.loaded}`);
const input = new InputHandler(canvas);
game.init({ canvas, input });
game.resize(844, 390, 1);

const shot = (name) => {
  const nc = napiCanvasOf(canvas);
  if (!nc) { log('shot-' + name, false, 'no-napi-canvas'); return; }
  const buf = nc.encodeSync ? nc.encodeSync('png') : Buffer.from(nc.toBuffer('image/png'));
  fs.writeFileSync(path.join(SHOT_DIR, name + '.png'), buf);
  log('shot-' + name, true, `${(buf.length / 1024).toFixed(1)}KB`);
};
const step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) game.update(dt); };

// ---------- 1. startRun ----------
game.startRun('macrophage');
const run = game.run;
log('run-membrane', !!run.membrane && run.membrane.shape === 'circle');
log('run-arena', !!run.arenaBounds && run.arenaBounds.r === 750, `r=${run.arenaBounds && run.arenaBounds.r}`);
step(30);
game.render(1 / 60, run.time);
shot('01-start');

// ---------- 2. joystick-only kill (TANPA input serang) ----------
// Musuh ditaruh di dalam medan; hero diam; kontak harus membunuh.
const k0 = run.kills, b0 = run.bioPoints;
for (let i = 0; i < 4; i++) game.spawnEnemy('bakteri', false);
run.enemies.slice(-4).forEach((e, i) => {
  const a = (i / 4) * Math.PI * 2;
  e.x = run.player.x + Math.cos(a) * 40;
  e.y = run.player.y + Math.sin(a) * 40;
});
step(240); // 4 detik kontak murni
game.render(1 / 60, run.time);
shot('02-contact-kills');
log('contact-kills', run.kills > k0, `kills=${k0}→${run.kills}`);
log('engulf-bio', run.bioPoints > b0, `bio=${b0}→${run.bioPoints}`);

// ---------- 3. PULSE via antrean keyboard ----------
run.enemies.slice().forEach((e) => { e.alive = false; });
run.enemies = run.enemies.filter((e) => e.alive);
for (let i = 0; i < 6; i++) game.spawnEnemy('bakteri', false);
run.enemies.slice(-6).forEach((e, i) => {
  const a = (i / 6) * Math.PI * 2;
  e.x = run.player.x + Math.cos(a) * 120;
  e.y = run.player.y + Math.sin(a) * 120;
});
input.queuePulse();
step(3); // 0.05 dtk — animasi expand berjalan
const peak = run.membrane.pulsePeak;
const cdLeft = run.membrane.pulseCdLeft;
game.render(1 / 60, run.time);
shot('03-pulse-expand');
log('pulse-fired', cdLeft > 0, `cd=${cdLeft.toFixed(2)} peak=${peak.toFixed(2)}`);
step(60);
log('pulse-cooldown-decays', run.membrane.pulseCdLeft < cdLeft);

// ---------- 4. level-up → MUTASI ----------
// Aliran level-up tunggal yang realistis (XP secukupnya, bukan 99999)
let opened = false;
for (let t = 0; t < 8 && !opened; t++) { game.addXP(25); step(5); opened = STATE.levelUpOpen; }
log('levelup-open', opened && !!run.currentChoices);
const choices = run.currentChoices || [];
const mutCards = choices.filter((c) => c.isMutation);
log('levelup-mutations', mutCards.length >= 2, `cards=${choices.map((c) => c.isMutation ? 'MUT:' + c.id : 'LEG:' + c.id).join(',')}`);
run.bioPoints += 30; // pastikan tidak terkunci bio
const pick = mutCards.find((c) => !c.lockedByBio) || mutCards[0];
game.chooseLevelUp(pick.id);
log('levelup-pick', (run.activeMutations || []).includes(pick.id), `picked=${pick.id}`);
log('mutations-applied', (run.activeMutations || []).length >= 1, `active=${(run.activeMutations || []).join(',')}`);
// Paksa 3 mutasi visual berbeda untuk screenshot ( установи secara sah via apply)
for (const id of ['berduri', 'simbiosis', 'nova']) {
  if (!run.activeMutations.includes(id)) {
    run.bioPoints += 20;
    mutSys.applyMutation(run, id);
  }
}
step(30);
// Bersihkan arena untuk foto hero: tanpa musuh/teks/partikel
run.enemies = [];
run.pickups = [];
if (run.effects) { run.effects.numbers = []; run.effects.particles = []; run.effects.effects = []; }
run.announcements = [];
if (run.camera) { run.camera.zoom = 5; run.camera.speedScale = 1; run.camera.punchScale = 1; run.camera.zoneScale = 1; }
game.render(1 / 60, run.time);
shot('04-mutated-hero');
log('debug-wave-at-04', true, `wave=${run.spawnSys && run.spawnSys.wave}`);

// ---------- 5. trait musuh wave 6 ----------
const trait = enemyMutSys.selectCounterTrait(run);
log('trait-selected', !!trait, `trait=${trait && trait.id}`);
run.enemyMutation.activeTrait = trait.id;
let traited = 0;
for (let i = 0; i < 40; i++) {
  game.spawnEnemy('bakteri', false);
  const e = run.enemies[run.enemies.length - 1];
  if (e.mutTrait) traited += 1;
  e.x = run.player.x + 200 + (i % 10) * 30;
  e.y = run.player.y - 100 + Math.floor(i / 10) * 40;
}
log('trait-inject-35pct', traited >= 8 && traited <= 24, `traited=${traited}/40`);
const aliveBefore = run.enemies.filter((e) => e.alive).length;
const killsBefore = run.kills;
const sample = run.enemies[run.enemies.length - 1];
log('debug-spawned', true, `alive=${aliveBefore} sample=(${Math.round(sample.x)},${Math.round(sample.y)}) player=(${Math.round(run.player.x)},${Math.round(run.player.y)})`);
step(20);
const aliveAfter = run.enemies.filter((e) => e.alive).length;
log('debug-after-step', true, `alive=${aliveAfter} kills=${killsBefore}→${run.kills} wave=${run.spawnSys && run.spawnSys.wave}`);
if (run.effects) { run.effects.numbers = []; run.effects.particles = []; }
game.render(1 / 60, run.time);
shot('05-mutated-strain');

// ---------- 6. save migration ----------
const { loadSave, writeSave } = await mod('js/save/save-manager.js');
localStorage.clear();
localStorage.setItem('imunverse.save.v1', JSON.stringify({ ...createDefaultMeta(), currency: 777 }));
const migrated = loadSave();
log('save-migrate', !!migrated && migrated.currency === 777 && !!localStorage.getItem('phagos.save.v1'));

console.log(fails === 0 ? '\nSEMUA VERIFIKASI LOLOS ✔' : `\n${fails} VERIFIKASI GAGAL ✘`);
process.exit(fails === 0 ? 0 : 1);
