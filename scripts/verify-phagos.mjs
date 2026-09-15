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
const k0 = run.kills;
for (let i = 0; i < 8; i++) game.spawnEnemy('bakteri', false); // D14: Bio tiap 8 telan
run.enemies.slice(-8).forEach((e, i) => {
  const a = (i / 8) * Math.PI * 2;
  e.x = run.player.x + Math.cos(a) * 40;
  e.y = run.player.y + Math.sin(a) * 40;
});
step(240); // 4 detik kontak murni
game.render(1 / 60, run.time);
shot('02-contact-kills');
log('contact-kills', run.kills > k0, `kills=${k0}→${run.kills}`);
// D14: Bio tiap 8 telan — uji deterministik via tryEngulf langsung
const b1 = run.bioPoints;
for (let i = 0; i < 8; i++) {
  game.spawnEnemy('bakteri', false);
  const oe2 = run.enemies[run.enemies.length - 1];
  oe2.hp = oe2.maxHP * 0.1;
  memSys.tryEngulf(game, oe2);
}
log('engulf-bio', run.bioPoints > b1, `bio=${b1}→${run.bioPoints}`);

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
let pguard = 0;
while (run.membrane.pulseCdLeft <= 0 && pguard++ < 30) step(1); // tunggu api (hit-stop bisa menelan frame)
step(2); // animasi expand berjalan
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

// ---------- 7. Kapsul Membran (ADDENDUM §1) ----------
const wb = await mod('js/systems/welcome-box-system.js');
const m2 = createDefaultMeta();
m2.stats.totalRuns = 1;
log('capsule-pending', wb.onRunComplete(m2) === true && wb.isCapsulePending(m2) === true);
const got = wb.rollCapsule(m2);
log('capsule-roll', !!got && m2.unlockedHeroes.includes(got.heroId), `hero=${got && got.heroId} tier=${got && got.tier} dup=${got && got.duplicate}`);
log('capsule-once', wb.rollCapsule(m2) === null && wb.isCapsulePending(m2) === false);
const m3 = createDefaultMeta(); m3.stats.totalRuns = 1; wb.onRunComplete(m3);
m3.unlockedHeroes = ['neutrophil', 'eosinophil', 'tcd4', 'dendritic', 'bcell', 'basophil'];
const c0 = m3.currency; const g3 = wb.rollCapsule(m3);
log('capsule-duplicate', g3.duplicate === true && m3.currency === c0 + 2000, `comp=${g3.compensation}`);

// Distribusi pool ≈ bobot (300 roll, toleransi longgar)
const counts = {};
for (let i = 0; i < 300; i++) {
  const m = createDefaultMeta(); m.stats.totalRuns = 1; wb.onRunComplete(m);
  const r = wb.rollCapsule(m);
  counts[r.heroId] = (counts[r.heroId] || 0) + 1;
}
const neut = counts.neutrophil || 0, baso = counts.basophil || 0;
log('capsule-weights', neut >= 60 && neut <= 125 && baso <= 25, `neutrophil=${neut}/300 basophil=${baso}/300`);

// ---------- 8. Consumable membran (ADDENDUM §2) ----------
const itemBuffs = await mod('js/systems/item-buffs.js');
const memMod = await mod('js/systems/membrane-system.js');
// Baseline tanpa item
STATE.meta.consumables = createDefaultMeta().consumables;
game.startRun('macrophage');
const baseDps = memMod.getMembraneStats(game.run).contactDps;
const baseSpeed = game.run.player.stats.speed;
// Run penuh dengan semua item
STATE.meta.consumables = {
  serum_awal: 1, vaksin_awal: 1, kopi_limfa: 1, pelindung_lendir: 1, koin_ganda: 1,
  opsonin: 1, atp_surge: 1, membran_cadangan: 1, toksin_balik: 1, sinapsis: 1,
};
game.startRun('macrophage');
const run2 = game.run, ib = run2.itemBuffs;
log('item-consumed', ['vaksin_awal', 'kopi_limfa', 'pelindung_lendir', 'koin_ganda', 'opsonin', 'atp_surge', 'toksin_balik', 'sinapsis'].every((k) => STATE.meta.consumables[k] === 0));
log('item-pending', ib.serumPending === true && ib.cadanganPending === true && STATE.meta.consumables.serum_awal === 1);
log('item-enzim', Math.abs(memMod.getMembraneStats(run2).contactDps - baseDps * 2) < baseDps * 2 * 0.25, `dps=${baseDps}→${memMod.getMembraneStats(run2).contactDps}`); // toleransi: variansi antar-run
log('item-sitokin', run2.player.stats.speed === baseSpeed * 1.4, `spd=${baseSpeed}→${run2.player.stats.speed}`);
log('item-mukus', ib.mukusPool === Math.round(run2.player.maxHP * 0.25), `pool=${ib.mukusPool}`);
log('item-katalis', ib.katalis === true);
log('item-opsonin', run2.enemies.length > 0 && run2.enemies.every((e) => (e.opsoninUntil || 0) > 0), `marked=${run2.enemies.filter((e) => e.opsoninUntil > 0).length}`);
log('item-atp', ib.atpPulsesLeft === 3);
log('item-thorns-sinapsis', itemBuffs.buffActive(run2, 'toksin') && itemBuffs.buffActive(run2, 'sinapsis'));
// ATP: pulse paksa saat CD penuh + diskon 3 berikut
run2.membrane.pulseCdLeft = 2;
log('item-atp-force', game.triggerPulseForce() === true && run2.membrane.pulseCdLeft === 2 && ib.atpPulsesLeft === 3);
run2.membrane.pulseCdLeft = 0;
game.triggerPulse();
log('item-atp-discount', Math.abs(run2.membrane.pulseCdLeft - 0.8) < 0.01 && ib.atpPulsesLeft === 2, `cd=${run2.membrane.pulseCdLeft}`);
// Opsonin: musuh 30% HP bisa ditelan (threshold 35%)
game.spawnEnemy('bakteri', false);
const oe = run2.enemies[run2.enemies.length - 1];
oe.hp = oe.maxHP * 0.3; oe.opsoninUntil = (run2.time || 0) + 8;
const bioBefore = run2.bioPoints;
log('item-opsonin-engulf', memMod.tryEngulf(game, oe) === true && run2.bioPoints === bioBefore + 4, `bio=${bioBefore}→${run2.bioPoints}`);
// Serum: picu saat HP<70% (kuras Mukus dulu agar damage masuk)
run2.itemBuffs.mukusPool = 0;
run2.player.iframes = 0; run2.player.hp = run2.player.maxHP * 0.75;
game.damagePlayer(run2.player.maxHP * 0.1); // → 65%
log('item-serum', STATE.meta.consumables.serum_awal === 0 && run2.player.hp > run2.player.maxHP * 0.9, `hp=${Math.round(run2.player.hp)}/${run2.player.maxHP}`);
// Sitokin kedaluwarsa → speed kembali (tunggu event, bukan frame tetap — hit-stop bisa membekukan sim)
let sguard = 0;
while (itemBuffs.buffActive(run2, 'sitokin') && sguard++ < 1200) game.update(1 / 60);
log('item-sitokin-expire', sguard < 1200 && run2.player.stats.speed >= baseSpeed - 0.001 && !itemBuffs.buffActive(run2, 'sitokin'), `sg=${sguard} alive=${run2.player.alive} ended=${run2.ended} t=${Math.round(run2.time)} until=${Math.round(run2.itemBuffs.sitokinUntil)} spd=${run2.player.stats.speed.toFixed(2)}/${baseSpeed.toFixed(2)}`);

// ---------- 9. Rename mata uang + kamus (ADDENDUM §4.1) ----------
const i18n = await mod('js/systems/i18n.js');
STATE.meta.lang = 'en';
await i18n.loadLang();
log('i18n-biokredit', i18n.t('Biokredit didapat:') === 'Biokredit earned:');
log('i18n-genom', i18n.t('Genom tidak cukup') === 'Not enough Genom' && i18n.t('Buka dengan 150 Genom') === 'Unlock with 150 Genom');
log('i18n-rule', i18n.t('Quest selesai: +50 Biokredit') === 'Quest complete: +50 Biokredit');
log('i18n-item', i18n.t('Sitokin Burst: +40% kecepatan!') === 'Cytokine Burst: +40% speed!'
  && i18n.t('Lapisan Mukus: perisai 30 HP!') === 'Mucus Layer: 30 HP shield!');
log('i18n-mechanic-kept', i18n.t('Memori Antibodi') === 'Antibody Memory' && i18n.t('Respons Imun') === 'Immune Response');
STATE.meta.lang = 'id';
log('i18n-id-passthrough', i18n.t('Biokredit didapat:') === 'Biokredit didapat:');

// ---------- 10. Challenge link + Strain of the Week (ADDENDUM §3.3/§3.5) ----------
const chSys = await mod('js/systems/challenge-system.js');
const strainSys = await mod('js/systems/weekly-strain-system.js');
STATE.meta.account = { uid: 'u1', username: 'Penjaja' };
const fakeGame = { run: { challengeId: null, heroDef: { id: 'amara' }, spawnSys: { wave: 9 }, level: 7, kills: 120, membrane: { stats: { engulfCount: 30 } }, activeMutations: ['m1', 'm2'], victory: true } };
const saved = chSys.saveCurrentRun(fakeGame);
log('challenge-save', !!saved && saved.url.includes('?challenge=u1-') && chSys.getChallenge(saved.runId).wave === 9, saved && saved.url);
log('challenge-idempotent', chSys.saveCurrentRun(fakeGame).runId === saved.runId);
log('challenge-missing', chSys.getChallenge('tidak-ada') === null);
log('strain-rotation', strainSys.currentStrainId(0) === 'penembak_asam'
  && strainSys.currentStrainId(604800000) === 'kebal_membran'
  && strainSys.currentStrainId(5 * 604800000) === 'penembak_asam'
  && !['acak_bermutasi'].includes(strainSys.currentStrainId(Date.now())));
log('strain-name', enemyMutSys.traitDisplayName('pemurni') === 'Pemurni');
const realRandom = Math.random;
Math.random = () => 0.05; // paksa lolos peluang 15%
const wRun = { spawnSys: { wave: 5 }, enemyMutation: {} };
const wEnemy = {};
enemyMutSys.maybeApplyTrait(wRun, wEnemy);
const wRunLow = { spawnSys: { wave: 3 }, enemyMutation: {} };
const wEnemyLow = {};
enemyMutSys.maybeApplyTrait(wRunLow, wEnemyLow);
Math.random = realRandom;
log('strain-apply', wEnemy.mutTrait === strainSys.currentStrainId() && !wEnemyLow.mutTrait, `trait=${wEnemy.mutTrait}`);

// ---------- 11. Referral dua arah + build share (ADDENDUM P2 §3.4/§6.6) ----------
const refSys = await mod('js/systems/referral-system.js');
const buildSys = await mod('js/systems/build-share-system.js');
localStorage.removeItem('phagos.referral.outbox');
const metaA = createDefaultMeta();
metaA.account = { uid: 'alice1', username: 'Alice' };
metaA.guestUid = 'g-alice'; metaA.currency = 0;
const codeA = refSys.myCode(metaA);
const metaB = createDefaultMeta();
metaB.account = { uid: 'bob2', username: 'Bob' };
metaB.guestUid = 'g-bob'; metaB.currency = 0;
const ap = refSys.applyCodeAndRecord(metaB, codeA);
log('referral-apply', ap.ok === true && ap.reward === 250 && metaB.currency === 250 && metaB.referredBy === codeA, `${codeA} +${ap.reward}`);
log('referral-self-reject', refSys.applyCodeAndRecord(metaA, codeA).ok === false);
log('referral-link', refSys.myReferralLink(metaA).includes('?ref=alice1&play=1'));
const ms1 = refSys.checkMilestone({ spawnSys: { wave: 5 } }, metaB);
log('referral-milestone', ms1 === 250 && metaB.currency === 500 && refSys.checkMilestone({ spawnSys: { wave: 9 } }, metaB) === 0);
const pend = refSys.pendingRewards(metaA);
log('referral-pending', pend.hits === 1 && pend.milestones === 1, JSON.stringify(pend));
const cl = refSys.claimPending(metaA);
log('referral-claim', cl.hits === 1 && cl.milestones === 1 && cl.total === 500 && metaA.currency === 500 && refSys.claimPending(metaA).total === 0);
const metaC = createDefaultMeta();
metaC.account = { uid: 'car3', username: 'Car' }; metaC.guestUid = 'g-car';
log('referral-refparam', refSys.handleRefParam(metaC, 'alice1') === true && refSys.handleRefParam(metaC, 'alice1') === false && refSys.handleRefParam(metaA, 'alice1') === false);
const realMut = getData().mutations.mutations[0].id;
const bcode = buildSys.encodeCurrentBuild({ run: { heroDef: { id: 'tcd8' }, spawnSys: { wave: 8 }, kills: 90, activeMutations: [realMut, 'bogus_id'] } });
const bdec = buildSys.decodeBuild(bcode);
log('build-roundtrip', !!bcode && bdec.hero === 'tcd8' && bdec.wave === 8 && bdec.mut.length === 1 && bdec.mut[0] === realMut
  && buildSys.decodeBuild('!!!bukan-base64!!!') === null && buildSys.makeBuildUrl(bcode).includes('?build='));

// ---------- 12. XP bible §5 (PHAGOS Sprint 1) ----------
const { xpToNextLevel: xpNeed1 } = await mod('js/core/data-store.js');
const xpTbl = getData().upgrades.xpByKillType || {};
log('xp-curve', xpNeed1(1) === 115 && xpNeed1(8) === 360 && xpNeed1(9) === 395, `L1=${xpNeed1(1)} L8=${xpNeed1(8)}`);
log('xp-bytype', xpTbl.contact === 3 && xpTbl.pulse === 5 && xpTbl.engulf === 4 && xpTbl.boss === 60, JSON.stringify(xpTbl)); // D14: engulf 4
log('xp-contactdps-fallback', (getData().membrane.defaults.contactDpsBase || 0) === 8);

// ---------- 13. Skill pasif D5 (trigger otomatis, tanpa cast) ----------
game.startRun('nkcell'); // pulse / damaged / engulf
const run3 = game.run;
log('skill-locked-lv1', run3.skills.getView(1).every((x) => x.locked === true));
log('skill-matrix-356', run3.skills.getView(3).map((x) => !x.locked).join('') === 'truefalsefalse'
  && run3.skills.getView(6).map((x) => !x.locked).join('') === 'truetruefalse'
  && run3.skills.getView(10).every((x) => !x.locked));
run3.level = 6;
run3.skills.slots.forEach((s) => { if (s) { s.unlocked = true; s.cdLeft = 0; } });
game.fireSkillTrigger('pulse');
log('skill-trigger-pulse', run3.skills.slots[0].cdLeft > 0 && run3.skills.slots[1].cdLeft === 0 && run3.skills.slots[2].cdLeft === 0);
run3.skills.slots.forEach((s) => { if (s) s.cdLeft = 0; });
game.fireSkillTrigger('damaged');
log('skill-trigger-damaged', run3.skills.slots[1].cdLeft > 0 && run3.skills.slots[0].cdLeft === 0 && run3.skills.slots[2].cdLeft === 0);
run3.skills.slots.forEach((s) => { if (s) s.cdLeft = 0; });
game.fireSkillTrigger('engulf');
log('skill-trigger-engulf', run3.skills.slots[2].cdLeft > 0 && run3.skills.slots[0].cdLeft === 0 && run3.skills.slots[1].cdLeft === 0);
game.startRun('neutrophil'); // slot 1 = adrenaline (kill)
const run4 = game.run;
run4.level = 15;
run4.skills.slots.forEach((s) => { if (s) { s.unlocked = true; s.cdLeft = 0; } });
game.fireSkillTrigger('kill');
log('skill-trigger-kill', run4.skills.slots[1].cdLeft > 0 && run4.skills.slots[0].cdLeft === 0 && run4.skills.slots[2].cdLeft === 0);
log('skill-rank2-auto', run4.skills.slots[1].rank === 2);
log('skill-guard-depth', (run4._skillNotifyDepth || 0) === 0);

console.log(fails === 0 ? '\nSEMUA VERIFIKASI LOLOS ✔' : `\n${fails} VERIFIKASI GAGAL ✘`);
process.exit(fails === 0 ? 0 : 1);
