/**
 * Uji DUNIA KONTINU V2 (P4 — PHAGOS_V2_REBUILD.txt §21–§30, §47).
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom
 *   PHAGOS_BUNDLE=.tmp-bundle.js node tools/verify-world.mjs
 *
 * Yang dijamin:
 *   1. Rute biologis berkesinambungan & berurutan (§22) — bukan daftar stage.
 *   2. TIDAK ADA loading/stage select: pergantian zona terjadi saat combat
 *      berjalan, pemain tetap hidup & musuh tetap ada (§23).
 *   3. TRANSITION ZONE 20–60 dtk: lingkungan lama+baru dan musuh lama+baru
 *      BERCAMPUR (§24).
 *   4. Lingkungan MENGUBAH GAMEPLAY (§25): arus mendorong, ruang menyempit,
 *      denyut jantung menggetarkan & mendorong, oksigen menyembuhkan.
 *   5. Wave = pacing di dalam zona, bukan arena baru (§27).
 *   6. Landmark tiap zona tercatat & terlihat (§47).
 *   7. Event masuk JANTUNG: denyut besar, tanpa teks "STAGE" (§28).
 *   8. HUD progres perjalanan minimal (§26).
 */
import fs from 'node:fs';
import path from 'node:path';
import { API, game } from './harness.mjs';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const errors = [];
const hasil = {};
const cek = (nama, ok, info = '') => {
  hasil[nama] = ok ? 'OK' : 'GAGAL — ' + info;
  if (!ok) errors.push(`${nama}: ${info}`);
};
const baca = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

globalThis.fetch = async (u) => {
  const f = path.join(ROOT, String(u).replace(/^\.?\//, '').split('?')[0]);
  try {
    const t = fs.readFileSync(f, 'utf8');
    return { ok: true, status: 200, async json() { return JSON.parse(t); }, async text() { return t; } };
  } catch { return { ok: false, status: 404, async json() { throw new Error('404 ' + f); }, async text() { return ''; } }; }
};
const { loadAllData } = await import('../js/core/data-store.js');
await loadAllData();

// Dunia dipakai game.js di DALAM bundle — ambil instance yang SAMA.
const WD = (API && API.world) || await import('../js/systems/world-journey.js');
const {
  initJourney, updateJourney, journeyHud, currentZone, nextZone, inTransition,
  enemyPoolFor, blendedPalette, mixHex, journeyProgress,
} = WD;

const zon = baca('data/zones.json');

// ---------- 1. RUTE BERKESINAMBUNGAN (§22) ----------
const rute = zon.route.map((z) => z.id);
const urut = zon.route.every((z, i) => z.order === i + 1);
const punyaLandmark = zon.route.every((z) => !!z.landmark);
cek('rute biologis berurutan & tiap zona punya landmark (§22, §47)',
  rute[0] === 'lung' && rute.includes('bloodstream') && rute.includes('heart') && urut && punyaLandmark,
  `${rute.slice(0, 6).join(' → ')} … (${rute.length} zona)`);

// ---------- 2. TRANSITION 20–60 DTK & TANPA LOADING (§24) ----------
const durasi = zon.route.map((z) => z.transitionSec);
cek('transition zone 20–60 dtk untuk semua zona (§24)',
  durasi.every((d) => typeof d === 'number' && d >= 20 && d <= 60),
  `${Math.min(...durasi)}–${Math.max(...durasi)} dtk`);

// ---------- 3. JALUR NYATA: perjalanan berganti saat combat berjalan (§23) ----------
game.startRun('macrophage');
const run = game.run;
initJourney(run);
const zona0 = currentZone(run).id;
const musuh0 = new (await import('../js/entities/enemy.js')).Enemy(
  baca('data/enemies.json').enemies.find((e) => e.id === 'bakteri'), 60, 0, { hpScale: 4, speedScale: 1 });
run.enemies.length = 0;
run.enemies.push(musuh0);
run.collision.rebuildEnemyGrid(run.enemies);

const _forceAdvance = WD._forceAdvance;
_forceAdvance(run); // paksa lewat batas wave zona
updateJourney(game, 1 / 60);
const masukTransisi = inTransition(run);
const poolTransisi = enemyPoolFor(run);
// majukan separuh transisi lalu cek campuran musuh
const zonaBerikut = nextZone(run).id;
const dur = currentZone(run).transitionSec;
for (let i = 0; i < Math.round((dur * 0.5) * 60); i++) updateJourney(game, 1 / 60);
const campur = enemyPoolFor(run);
const punyaLama = campur.has('bakteri');
const punyaBaru = [...campur.keys()].some((id) => (currentZone(run).enemies || []).includes(id) === false);
const blend = run.journey.blend;

// pemain & musuh TETAP ADA (tidak ada loading / reset arena)
const tetapHidup = run.player.alive && run.enemies.some((e) => e.alive);
// selesaikan transisi
for (let i = 0; i < Math.round((dur * 0.6 + 0.2) * 60); i++) updateJourney(game, 1 / 60);
const zona1 = currentZone(run).id;
const selesai = !inTransition(run);

cek('zona berganti TANPA loading: pemain & musuh tetap ada (§23)',
  masukTransisi && tetapHidup && selesai && zona1 !== zona0,
  `${zona0} → ${zona1}, transisi=${masukTransisi}, blend=${blend.toFixed(2)}, hidup=${tetapHidup}`);
cek('musuh LAMA + BARU bercampur selama transisi (§24)',
  punyaLama && punyaBaru && blend > 0.3 && blend < 0.95,
  `lama=${punyaLama} baru=${punyaBaru} blend=${blend.toFixed(2)} pool=[${[...campur.keys()].join(',')}]`);
cek('landmark zona baru tercatat (§47)',
  !!run.journey.landmark && run.journey.landmark.zoneId === zona1 && run.journey.visited.includes(zona1),
  JSON.stringify(run.journey.landmark));

// ---------- 4. LINGKUNGAN MENGUBAH GAMEPLAY (§25) ----------
// (a) ARUS DARAH: pemain & musuh terdorong
game.startRun('macrophage');
const runC = game.run;
initJourney(runC);
runC.journey.index = zon.route.findIndex((z) => z.id === 'bloodstream');
runC.journey.zoneId = 'bloodstream';
runC.journey.driftT = 999; // paksa ganti arah di frame pertama
const px0 = runC.player.x; const py0 = runC.player.y;
for (let i = 0; i < 60; i++) updateJourney(game, 1 / 60);
const dorong = Math.hypot(runC.player.x - px0, runC.player.y - py0);
cek('BLOODSTREAM: arus mendorong pemain (lingkungan mengubah gameplay, §25)',
  dorong > 10, `perpindahan ${dorong.toFixed(1)} px dalam 1 dtk`);

// (b) KAPILER: ruang menyempit
game.startRun('macrophage');
const runN = game.run;
initJourney(runN);
runN.journey.index = zon.route.findIndex((z) => z.id === 'capillary');
runN.arenaBounds = { x: 0, y: 0, r: 750 };
const r0 = runN.arenaBounds.r;
for (let i = 0; i < 120; i++) updateJourney(game, 1 / 60);
const r1 = runN.arenaBounds.r;
cek('CAPILLARY: ruang gerak menyempit (§25)', r1 < r0, `radius ${r0} → ${Math.round(r1)}`);

// (c) JANTUNG: denyut menggetarkan & mendorong musuh
game.startRun('macrophage');
const runH = game.run;
initJourney(runH);
runH.journey.index = zon.route.findIndex((z) => z.id === 'heart');
const EH = (await import('../js/entities/enemy.js')).Enemy;
const defB = baca('data/enemies.json').enemies.find((e) => e.id === 'bakteri');
runH.enemies.length = 0;
const musuhH = new EH(defB, 120, 0, { hpScale: 6, speedScale: 0 });
musuhH.maxHP = 5000; musuhH.hp = 5000;
runH.enemies.push(musuhH);
runH.collision.rebuildEnemyGrid(runH.enemies);
const hx0 = musuhH.x;
let shake = 0;
runH.camera.addShake = (v) => { shake += v; };
for (let i = 0; i < Math.round(4.2 * 60); i++) updateJourney(game, 1 / 60);
cek('HEART: denyut mendorong musuh & menggetarkan kamera (§25)',
  Math.abs(musuhH.x - hx0) > 5 && shake > 0,
  `geser musuh ${Math.abs(musuhH.x - hx0).toFixed(1)} px, shake ${shake.toFixed(2)}`);

// (d) PARU: oksigen menyembuhkan
game.startRun('macrophage');
const runP = game.run;
initJourney(runP);
runP.journey.index = zon.route.findIndex((z) => z.id === 'lung');
runP.player.hp = Math.max(1, runP.player.maxHP - 40);
const hp0 = runP.player.hp;
for (let i = 0; i < Math.round(19 * 60); i++) updateJourney(game, 1 / 60);
cek('LUNG: oksigen memulihkan HP (§25)', runP.player.hp > hp0, `${hp0} → ${runP.player.hp}`);

// ---------- 5. WAVE = PACING, BUKAN ARENA (§27) ----------
game.startRun('macrophage');
const runW = game.run;
initJourney(runW);
runW.spawnSys.wave = 3;
runW.journey.lastWave = 1;
updateJourney(game, 1 / 60);
const waveDiZona = runW.journey.waveInZone;
cek('wave hanya menandai intensitas di dalam zona (§27)',
  waveDiZona === 3 && currentZone(runW).id === 'lung' && !inTransition(runW),
  `waveInZone=${waveDiZona} zona=${currentZone(runW).id}`);

// ---------- 6. EVENT MASUK JANTUNG (§28) ----------
game.startRun('macrophage');
const runE = game.run;
initJourney(runE);
runE.journey.index = zon.route.findIndex((z) => z.id === 'bloodstream');
runE.journey.nextIndex = zon.route.findIndex((z) => z.id === 'heart');
_forceAdvance(runE);
updateJourney(game, 1 / 60);
let shakeE = 0;
runE.camera.addShake = (v) => { shakeE += v; };
const beats0 = runE.journey.heartBeats;
for (let i = 0; i < Math.round(5 * 60); i++) updateJourney(game, 1 / 60);
const heartbeatTerjadi = runE.journey.heartBeats < beats0 && shakeE > 0;
// Tidak boleh ada lagi label "STAGE n" di sistem dunia (§21): perjalanan
// berkesinambungan, bukan level yang dipilih.
const srcDunia = fs.readFileSync(path.join(ROOT, 'js/systems/world-journey.js'), 'utf8');
const tanpaTeksStage = !/STAGE\s*\d/i.test(srcDunia) && !/'stage'|\.stage\b/i.test(srcDunia);
cek('event masuk JANTUNG: denyut besar, tanpa label "STAGE" (§28)',
  beats0 === 2 && heartbeatTerjadi && tanpaTeksStage,
  `beats ${beats0}→${runE.journey.heartBeats}, shake=${shakeE.toFixed(2)}`);

// ---------- 7. CAMPURAN WARNA LINGKUNGAN (§24) ----------
const tengah = blendedPalette('lung', 'bloodstream', 0.5);
const warnaLung = blendedPalette('lung', 'bloodstream', 0).hex;
const warnaBlood = blendedPalette('lung', 'bloodstream', 1).hex;
// Saat transisi, fitur zona LAMA dan BARU sama-sama TERLIHAT (alpha > 0).
const hidup = (p) => (p.ground.features || []).filter((f) => (f.alpha || 0) > 0).length;
const nLama = hidup(blendedPalette('lung', 'bloodstream', 0));   // hanya zona lama
const nBaru = hidup(blendedPalette('lung', 'bloodstream', 1));   // hanya zona baru
const nTengah = hidup(tengah);                                   // keduanya bersamaan
cek('lingkungan lama & baru bercampur mulus (warna + fitur tanah, §24)',
  tengah.hex !== warnaLung && tengah.hex !== warnaBlood
  && nLama > 0 && nBaru > 0 && nTengah === nLama + nBaru
  && mixHex('#000000', '#ffffff', 0.5) === '#808080',
  `${warnaLung} → ${tengah.hex} → ${warnaBlood}; fitur hidup ${nLama} (lama) + ${nBaru} (baru) = ${nTengah} saat transisi`);

// ---------- 8. HUD MINIMAL (§26) ----------
const hud = journeyHud(runE);
const hudSrc = fs.readFileSync(path.join(ROOT, 'js/ui/screens/hud-screen.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'styles/main.css'), 'utf8');
cek('HUD progres perjalanan minimal (zona → berikutnya, §26)',
  !!hud.zone && !!hud.next && hud.progress >= 0 && hud.progress <= 1
  && hudSrc.includes('updateJourneyBar') && cssSrc.includes('.hud-journey'),
  `${hud.zone} → ${hud.next} (${Math.round(hud.progress * 100)}%)`);

console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 15)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
