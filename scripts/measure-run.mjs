/**
 * measure-run.mjs — PHAGOS Sprint 1: ukur RUN REFERENSI headless.
 *
 * Menjalankan satu run penuh kode game ASLI (jsdom + @napi-rs/canvas) dengan
 * AI sederhana: cari musuh terdekat (8 arah), Pulse tiap siap, auto-pilih
 * mutasi pertama. Mencatat kill per cause, engulf, level, XP, Biokredit,
 * durasi, wave — fondasi angka Sprint 3 (bible §1.2 target: 400 kill,
 * 262 kontak / 120 Pulse / 18 engulf, level 8, 916 BK, 5–7 mnt).
 *
 * Jalankan: node scripts/measure-run.mjs [heroId] (cwd = root repo)
 * Butuh: /tmp/vfy/node_modules (jsdom, @napi-rs/canvas) atau VERIFY_PATH.
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

// ---------- DOM (salinan boot verify-phagos) ----------
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

const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  const s = String(url);
  if (/^https?:\/\//.test(s)) return realFetch(url, opts);
  const rel = s.split('?')[0].replace(/^\.\//, '');
  const fp = path.join(ROOT, rel);
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(fp, 'utf8')), text: async () => fs.readFileSync(fp, 'utf8') };
};

class RepoImage extends napi.Image {
  set src(v) { super.src = String(v).split('?')[0]; }
  get src() { return super.src; }
}
global.Image = RepoImage;
dom.window.Image = RepoImage;

// ---------- Impor kode game ASLI ----------
const mod = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { game } = await mod('js/core/game.js');
const { STATE, createDefaultMeta } = await mod('js/core/state-manager.js');
const { loadAllData } = await mod('js/core/data-store.js');
const { loadAllSprites } = await mod('js/render/sprite-loader.js');
const { InputHandler } = await mod('js/input/input-handler.js');

const canvas = document.getElementById('game');
canvas.width = 844; canvas.height = 390;
await loadAllData();
STATE.meta = createDefaultMeta();
STATE.meta.selectedMode = 'endless'; // run referensi: 15 wave, bukan kuota kampanye
await loadAllSprites((await mod('js/core/data-store.js')).getData());
const input = new InputHandler(canvas);
game.init({ canvas, input });

// ---------- Run + AI sederhana ----------
const heroId = process.argv[2] || 'macrophage';
game.startRun(heroId);
const run = game.run;

const tally = {};
const origKill = game.onEnemyKilled.bind(game);
game.onEnemyKilled = (enemy, source) => {
  const k = typeof source === 'string' ? source : (source && source.pattern ? 'proj' : 'none');
  tally[k] = (tally[k] || 0) + 1;
  return origKill(enemy, source);
};

let out_death = null;
const dt = 1 / 60;
const MAX_FRAMES = 60 * 60 * 40; // kap 40 menit sim (pacing wave lambat — temuan Sprint 1)
let frames = 0;
let picks = 0;
const t0 = Date.now();
while (!run.ended && frames < MAX_FRAMES) {
  // 1) auto-pilih mutasi
  if (STATE.levelUpOpen && run.currentChoices && run.currentChoices.length > 0) {
    const owned = run.activeMutations || [];
    const ordered = [...run.currentChoices].sort((a, b) => {
      const score = (x) => (x.isMutation && !owned.includes(x.id) && !x.lockedByBio ? 0 : x.isMutation ? 2 : 1);
      return score(a) - score(b);
    });
    for (const c of ordered) { // coba-berikutnya: jangan macet di 1 kartu gagal
      const q0 = run.levelUpQueue || 0;
      if (q0 <= 0) break;
      try { game.chooseLevelUp(c.id); } catch { /* abaikan */ }
      picks += Math.max(0, q0 - (run.levelUpQueue || 0));
      if ((run.levelUpQueue || 0) < q0) break;
    }
  }
  // 2b) diagnosa modal macet
  if ((run.levelUpQueue || 0) > 0 && frames % 3600 === 0) {
    console.error(`[diag] f=${frames} q=${run.levelUpQueue} open=${STATE.levelUpOpen} bio=${run.bioPoints} owned=${(run.activeMutations || []).length}`);
  }
  // 2c) mati = selesai (headless tak bisa klik revive)
  if (!run.player.alive) {
    out_death = { deathWave: run.spawnSys ? run.spawnSys.wave : -1, deathTimeSec: Math.round(run.time || 0) };
    break;
  }
  // 2) cari musuh terdekat (8 arah via injeksi keys)
  input.keys.clear();
  let best = null;
  let bd = Infinity;
  for (const e of run.enemies) {
    if (!e.alive) continue;
    const d = (e.x - run.player.x) ** 2 + (e.y - run.player.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  if (best) {
    // kite primitif: HP<35% → menjauh (survive), else dekati (contact DPS)
    const flee = run.player.hp < run.player.maxHP * 0.35 ? -1 : 1;
    const dx = (best.x - run.player.x) * flee;
    const dy = (best.y - run.player.y) * flee;
    if (dx > 20) input.keys.add('right'); else if (dx < -20) input.keys.add('left');
    if (dy > 20) input.keys.add('down'); else if (dy < -20) input.keys.add('up');
  }
  // 3) Pulse tiap siap
  try { game.triggerPulse(); } catch { /* abaikan */ }
  game.update(dt);
  frames += 1;
  // berhenti setelah wave 15 selesai (boss 15 tumbang → victory biasanya)
  if (run.spawnSys && run.spawnSys.wave > 15) break;
}
const wallSec = Math.round((Date.now() - t0) / 1000);

const out = {
  hero: heroId,
  frames,
  wallSec,
  timeSec: Math.round(run.time || 0),
  wave: run.spawnSys ? run.spawnSys.wave : -1,
  victory: !!run.victory,
  ended: !!run.ended,
  kills: run.kills || 0,
  byCause: tally,
  engulfCount: (run.membrane && run.membrane.stats && run.membrane.stats.engulfCount) || 0,
  pulseCount: (run.membrane && run.membrane.stats && run.membrane.stats.pulseCount) || 0,
  level: run.level || 1,
  levelPicks: picks,
  xpGained: Math.round(run.xpGained || 0),
  currencyEarned: Math.round(run.currencyEarned || 0),
  bioPoints: run.bioPoints || 0,
  bossKills: run.bossKills || 0,
  playerHp: Math.round(run.player ? run.player.hp : 0),
  death: out_death,
  mutations: run.activeMutations || [],
};
console.log(JSON.stringify(out, null, 1));
process.exit(0);
