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
  rute[0] === 'capillary' && rute.includes('bloodstream') && rute.includes('heart') && rute[rute.length - 1] === 'lymphNode' && urut && punyaLandmark,
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
  waveDiZona === 3 && currentZone(runW).id === 'capillary' && !inTransition(runW), // MIGRASI: wave != gerbang maju; zona = posisi
  `waveInZone=${waveDiZona} zona=${currentZone(runW).id}`);

// ---------- 6. EVENT MASUK JANTUNG (§28) ----------
game.startRun('macrophage');
const runE = game.run;
initJourney(runE);
runE.journey.index = zon.route.findIndex((z) => z.id === 'alveoli'); // rute fisik: heart tepat setelah alveoli
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

// ---------- 9. PILOT "ORGAN ASCENT" — arena bersiluet organ (jantung) ----------
// docs/ARENA-CHARACTER-REDESIGN-STRATEGY.md §5: dari cawan bundar → koridor
// vertikal bersiluet organ. PILOT hanya jantung; 6 organ lain tetap cawan.
// Yang dijamin: (a) bentuk aktif tepat saat masuk zona jantung, lepas saat
// keluar; (b) clamp menahan semua entitas DI DALAM siluet; (c) luas setara
// cawan lama (kepadatan spawn tak berubah); (d) mekanik tak berubah.
const _jumpToZone = WD._jumpToZone;
const arenasDef = baca('data/arenas.json').arenas;
const { buildCorridorShape, insideShape, clampToShape } = await import('../js/systems/arena-shape.js');
const luasCawan = Math.PI * 750 * 750;
const berbentuk = arenasDef.filter((a) => a.shape && (a.shape.kind === 'corridor' || a.shape.kind === 'branch')).map((a) => a.id);
cek('ORGAN ASCENT: semua 7 organ punya siluet (corridor/branch) — scale dari pilot jantung',
  berbentuk.length === arenasDef.length && arenasDef.length === 7, `berbentuk=[${berbentuk.join(',')}]`);
// OPEN-WORLD (mandat owner 2026-09-21): arena TANPA batas — clamp no-op,
// persimpangan antar-cabang lolos, pemain bebas explore; shape = struktur
// visual + panduan spawn. Guard lama (luas≈cawan, dinding menahan) DIHAPUS.
for (const a of arenasDef) {
  const S = buildCorridorShape(Object.assign({ id: a.id }, a.shape), 0, 0);
  const hs = []; const cxs = [];
  for (let k = 0; k <= 20; k++) { const y = S.bottomY - (k / 20) * S.height; hs.push(S.halfAt(y)); }
  // kelok = rentang lateral SELURUH lajur (branch: cabang melebar jauh = struktur
  // penuh bercabang; corridor: kelokan pusat profil)
  if (S.lanes && S.lanes.length) {
    for (const L of S.lanes) for (let k = 0; k <= 10; k++) { const y = L.bottomY - (k / 10) * (L.bottomY - L.topY); cxs.push(L.centerAt(y)); }
  } else {
    for (let k = 0; k <= 20; k++) { const y = S.bottomY - (k / 20) * S.height; cxs.push(S.centerAt(y)); }
  }
  // (a) open: clamp TIDAK menggeser titik mana pun, inside selalu true
  let geser = 0, luarN = 0;
  for (let k = 0; k < 200; k++) {
    const x = (Math.random() - 0.5) * 6000, y = S.bottomY - Math.random() * S.height * 1.4 + 300;
    const e = { x, y };
    clampToShape(S, e, 14);
    if (e.x !== x || e.y !== y) geser++;
    if (!insideShape(S, e.x, e.y, 0)) luarN++;
  }
  // (b) struktur PENUH: tinggi besar, bervariasi, berkelok (bukan lorong lurus/loop)
  const rasio = Math.max(...hs) / Math.min(...hs);
  const kelok = Math.max(...cxs) - Math.min(...cxs);
  const zona = ((a.shape.wall || {}).zones || []).length;
  const kelokMin = S.lanes && S.lanes.length > 1 ? 400 : 120; // cabang = melebar jauh
  cek(`OPEN-WORLD [${a.id}]: clamp no-op, inside selalu true, struktur penuh (tinggi≥5000, rasio≥1.6, kelok≥${kelokMin}), zona warna≥2`,
    S.open === true && geser === 0 && luarN === 0 && S.height >= 5000 && rasio >= 1.6 && kelok >= kelokMin && zona >= 2,
    `${S.kind} tinggi=${S.height} rasio=${rasio.toFixed(2)} kelok=${Math.round(kelok)} zona=${zona} lajur=${S.summary.lanes} geser=${geser}`);
}
// organ bercabang: cabang terpisah DI PUNCAK, dan PERSIMPANGAN bisa dilewati —
// titik di cabang kiri maupun di celah antar-cabang TIDAK ditarik ke mana pun.
for (const idB of arenasDef.filter((a) => a.shape.kind === 'branch').map((a) => a.id)) {
  const S = buildCorridorShape(Object.assign({ id: idB }, arenasDef.find((a) => a.id === idB).shape), 0, 0);
  const yTop = S.topY + 200;
  const ln = S.lanesAt(yTop);
  const kiri = ln.find((L) => L.centerAt(yTop) < -50), kanan = ln.find((L) => L.centerAt(yTop) > 50);
  const celah = kiri && kanan && (kanan.centerAt(yTop) - kanan.halfAt(yTop)) - (kiri.centerAt(yTop) + kiri.halfAt(yTop)) > 50;
  const eK = { x: kiri ? kiri.centerAt(yTop) : 0, y: yTop };
  const eC = { x: 0, y: yTop }; // di celah/persimpangan
  clampToShape(S, eK, 14); clampToShape(S, eC, 14);
  cek(`OPEN-WORLD [${idB}]: kind=branch — cabang terpisah di puncak, persimpangan LOLOS (titik di cabang & celah tak digeser)`,
    S.kind === 'branch' && !!kiri && !!kanan && celah
    && Math.abs(eK.x - kiri.centerAt(yTop)) < 1 && eC.x === 0 && eC.y === yTop,
    `lajur puncak=${ln.length} kiri=${kiri ? Math.round(kiri.centerAt(yTop)) : '-'} kanan=${kanan ? Math.round(kanan.centerAt(yTop)) : '-'} celah=${Math.round(celah || 0)}`);
}

game.startRun('macrophage');
const runS = game.run;
cek('SPEC ARENA: MAP bukan ruang main — run.bodyWorld null, denah hanya overlay macro',
  runS.bodyWorld == null && !!runS.worldMapDef === false || runS.bodyWorld == null,
  `bodyWorld=${runS.bodyWorld} worldMapDef=${!!runS.worldMapDef}`);
const CH0 = runS.chamber;
cek('SPEC ARENA: instance BioChamber tertutup aktif sejak zona pertama (state lockdown/entry)',
  !!CH0 && (CH0.state === 'lockdown' || CH0.state === 'entry'), `state=${CH0 && CH0.state} R=${CH0 && Math.round(CH0.R)}`);
// state machine: lockdown -> swarm setelah ~1,2 dtk
for (let i = 0; i < 90; i++) game.update(1 / 60);
cek('SPEC ARENA: state machine LOCKDOWN -> SWARM (katup terkunci lalu patogen keluar)',
  runS.chamber.state === 'swarm', `state=${runS.chamber.state}`);
// dinding tertutup: pemain didorong keluar 6 dtk tetap DI DALAM membran
{
  const pl = runS.player; const ch = runS.chamber;
  pl.x = ch.cx; pl.y = ch.cy; pl.vx = 0; pl.vy = 0;
  for (let i = 0; i < 360; i++) { pl.update(1 / 60, { x: 1, y: 0.3, magnitude: 1 }, game); game.arenaClamp(pl, pl.radius || 15); }
  const r = Math.hypot(pl.x - ch.cx, pl.y - ch.cy);
  const wall = ch.radiusAt(Math.atan2(pl.y - ch.cy, pl.x - ch.cx));
  cek('SPEC ARENA: arena TERTUTUP — sprint 6 dtk ke luar tetap tertahan dinding membran (tak bisa kabur)',
    r <= wall + 1, `r=${r.toFixed(0)} wall=${wall.toFixed(0)}`);
}
// dinding soft-body: impact membuat simpul penyok
{
  const ch = runS.chamber;
  const dev0 = Math.max(...ch.points.map((p) => Math.abs(p.r - p.base)));
  ch.applyImpact(0.7, 20);
  for (let i = 0; i < 10; i++) ch.update(1 / 60, runS, {});
  const dev1 = Math.max(...ch.points.map((p) => Math.abs(p.r - p.base)));
  cek('SPEC ARENA: dinding soft-body — impact membuat simpul PENYOK lalu membal (jiggle)',
    dev1 > dev0 + 1, `dev ${dev0.toFixed(1)} -> ${dev1.toFixed(1)}`);
}
// purified -> open: basmi semua musuh
{
  const ch = runS.chamber;
  for (const e of runS.enemies) e.alive = false;
  runS.enemies = [];
  ch.t = 5; // penuhi durasi minimum swarm
  for (let i = 0; i < 120; i++) game.update(1 / 60);
  cek('SPEC ARENA: patogen habis -> PURIFIED (shockwave) lalu OPEN (katup terbuka)',
    (ch.state === 'open' || ch.state === 'purified'), `state=${ch.state} shock=${(ch.shock || 0).toFixed(2)} open=${(ch.openAmt || 0).toFixed(2)}`);
}
// proyektil diserap dinding
{
  const ch = runS.chamber;
  const a = 1.3; const rr = ch.radiusAt(a) + 80;
  const prj = { x: ch.cx + Math.cos(a) * rr, y: ch.cy + Math.sin(a) * rr, alive: true, update() {} };
  runS.projectiles.push(prj);
  game.update(1 / 60);
  cek('SPEC ARENA: proyektil yang melewati membran diserap dinding (mati + dinding penyok)',
    prj.alive === false, `alive=${prj.alive}`);
}
// spawn selalu di dalam chamber
{
  let luar = 0;
  for (let k = 0; k < 40; k++) {
    const p = game.organSpawnPosition();
    const r = Math.hypot(p.x - runS.chamber.cx, p.y - runS.chamber.cy);
    if (r > runS.chamber.R * 1.05) luar++;
  }
  cek('SPEC ARENA: 40 spawn patogen semuanya DI DALAM chamber (pori dinding/ring dalam)', luar === 0, `${luar}/40 luar`);
}
// mekanik inti tak berubah
{
  const pl = runS.player;
  const hpSebelum = pl.hp, spdSebelum = pl.speed;
  for (let i = 0; i < 60; i++) { pl.update(1 / 60, { x: 0, y: -1, magnitude: 1 }, game); game.arenaClamp(pl, pl.radius || 15); }
  cek('SPEC ARENA: mekanik inti tak berubah — HP & kecepatan identik setelah collision chamber',
    pl.hp === hpSebelum && pl.speed === spdSebelum, `hp ${hpSebelum}→${pl.hp}, speed ${spdSebelum}→${pl.speed}`);
}
// kamera: di koridor sedikit menjauh (target < 1), keluar → kembali 1; tidak pernah ekstrem
_jumpToZone(game, 'heart');
{
  const cam = runS.camera;
  // SNAP MACRO (mandat owner, bukti "arena full"): awal run kamera auto-fit
  // SELURUH struktur organ ke layar; target harus == macroFitZoom(shape) & kecil.
  runS.introT = 0; runS.macroSnapped = false;
  for (let i = 0; i < 10; i++) { game.update && game.update(1 / 60); }
  const establishing = cam.corridorTarget;
  // macro kini mem-fit PETA TUBUH bila body-map.json ada (fallback: koridor zona)
  const bmDef = API.getData().bodyMap;
  const fitHarap = bmDef
    ? cam.macroFitZoom({ height: bmDef.world.h, lanes: [{ topY: 0, bottomY: bmDef.world.h, centerAt: () => bmDef.world.w / 2, halfAt: () => bmDef.world.w / 2 }] })
    : cam.macroFitZoom(runS.arenaShape);
  cek('OPEN-WORLD: SNAP MACRO — awal run kamera auto-fit SELURUH struktur/peta (target == macroFitZoom, < 0,2)',
    Math.abs(establishing - fitHarap) < 1e-6 && establishing < 0.2,
    `target=${establishing.toFixed(4)} fit=${fitHarap.toFixed(4)} sumber=${bmDef ? 'body-map' : 'koridor'}`);
  // tombol M: tahan kapan pun → macro lagi, lepas → kembali zoom starter
  runS.introT = 10;
  for (let i = 0; i < 90; i++) { game.update && game.update(1 / 60); }
  const zoomStarter = cam.corridorTarget;
  game.input.keys.add('map');
  for (let i = 0; i < 30; i++) { game.update && game.update(1 / 60); }
  const zoomM = cam.corridorTarget;
  // hitung pada momen yang sama (peta tubuh bila ada)
  const fitM = bmDef
    ? cam.macroFitZoom({ height: bmDef.world.h, lanes: [{ topY: 0, bottomY: bmDef.world.h, centerAt: () => bmDef.world.w / 2, halfAt: () => bmDef.world.w / 2 }] })
    : cam.macroFitZoom(runS.arenaShape);
  game.input.keys.delete('map');
  for (let i = 0; i < 120; i++) { game.update && game.update(1 / 60); }
  const zoomLepas = cam.corridorTarget;
  cek('OPEN-WORLD: tahan M = SNAP MACRO kapan pun; lepas → kembali zoom starter',
    zoomM < 0.2 && Math.abs(zoomM - fitM) < 1e-6 && zoomStarter >= 0.55 && zoomLepas >= 0.55,
    `starter=${zoomStarter} M=${zoomM.toFixed(4)} fitM=${fitM.toFixed(4)} lepas=${zoomLepas}`);
  for (let i = 0; i < 120; i++) { game.update && game.update(1 / 60); }
  const diKoridor = cam.corridorTarget;
  _jumpToZone(game, 'artery');
  for (let i = 0; i < 120; i++) { game.update && game.update(1 / 60); }
  const diArteri = cam.corridorTarget;
  const shTmp = runS.arenaShape; runS.arenaShape = null;
  for (let i = 0; i < 60; i++) { game.update && game.update(1 / 60); }
  const diCawan = cam.corridorTarget; runS.arenaShape = shTmp;
  // ARENA_ZOOM_OUT_REFERENCE_.png (commit owner 8acc8c5): arena harus terbaca LEBAR —
  // struktur organ/rute terlihat, bukan lorong rapat. Rentang kamera karenanya turun
  // dari 0,8-0,95 (pilot lama) menjadi 0,55-0,75 (zoom-out).
  cek('MIGRASI: kamera zoom-out per zona organ (0,55-0,75 dari zone.zoom; rujukan ARENA_ZOOM_OUT_REFERENCE) sepanjang dunia kontinu',
    diKoridor >= 0.55 && diKoridor <= 0.75 && diArteri >= 0.55 && diArteri <= 0.75 && diCawan >= 0.55 && diCawan <= 0.75,
    `jantung=${diKoridor} arteri=${diArteri} tanpaShape=${diCawan}`);
}
// render koridor tidak error & tidak NaN (ctx perekam)
_jumpToZone(game, 'heart');
{
  let nan = 0, ops = 0;
  const grad = { addColorStop() {} };
  const base = { canvas: { width: 400, height: 300 }, createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => null, measureText: () => ({ width: 0 }), getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }), createImageData: (w, h) => ({ data: new Uint8ClampedArray(4), width: w, height: h }), putImageData() {} };
  const ctx = new Proxy(base, { get(t, p) { if (p in t) return t[p]; if (typeof p !== 'string') return undefined; if (/Style$|^font$|^line(Width|Cap|Join|DashOffset)$|^global|^text|^filter$|^shadow|^imageSmoothing|^miterLimit$|^direction$/.test(p)) return ''; return (t[p] = (...a) => { ops++; for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) nan++; }); }, set(t, p, v) { t[p] = v; return true; } });
  let err = null;
  try { game.ctx = ctx; game.viewW = 400; game.viewH = 300; game.dpr = 1; game.render(16, 3000); } catch (e) { err = e.message; }
  cek('PILOT: render koridor organ berjalan tanpa error & tanpa NaN', !err && nan === 0 && ops > 0, err || `ops=${ops} nan=${nan}`);
}

// ---------- SNAP MACRO: PETA TUBUH (data/body-map.json + js/render/world-map.js) ----------
{
  const def = API.getData().bodyMap;
  const okData = !!def && Array.isArray(def.organs) && def.organs.length >= 9
    && Array.isArray(def.vessels) && def.vessels.length >= 9
    && def.anchors && def.anchors.start && def.anchors.goal;
  cek('WORLD MAP: body-map.json dimuat — 9 chamber organ, ≥9 pembuluh, anchor START/GOAL',
    okData, def ? `organs=${def.organs.length} vessels=${def.vessels.length} world=${def.world.w}x${def.world.h}` : 'null');
  let routeOk = false, detail = '';
  if (def) {
    const r = def.vessels.find((v) => v.kind === 'route');
    if (r) {
      routeOk = r.points.every((p, i) => i === 0 || Math.hypot(p[0] - r.points[i - 1][0], p[1] - r.points[i - 1][1]) < 0.35)
        && Math.hypot(r.points[0][0] - def.anchors.start.x, r.points[0][1] - def.anchors.start.y) < 0.05
        && Math.hypot(r.points[r.points.length - 1][0] - def.anchors.goal.x, r.points[r.points.length - 1][1] - def.anchors.goal.y) < 0.08;
      detail = `route pts=${r.points.length}`;
    }
  }
  cek('WORLD MAP: rute teal START→GOAL kontinu (tanpa lompatan > 0,35)', routeOk, detail);
  let nan = 0, ops = 0, err = null;
  const grad = { addColorStop() {} };
  const base = { canvas: { width: 400, height: 300 }, createLinearGradient: () => grad, createRadialGradient: () => grad, measureText: () => ({ width: 40 }), roundRect() {} };
  const ctx2 = new Proxy(base, { get(t, p) { if (p in t) return t[p]; if (typeof p !== 'string') return undefined; if (/Style$|^font$|^line(Width|Cap|Join|DashOffset)$|^global|^text|^filter$|^shadow|^imageSmoothing|^miterLimit$|^direction$/.test(p)) return ''; return (t[p] = (...a) => { ops++; for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) nan++; }); }, set(t, p, v) { t[p] = v; return true; } });
  try {
    const { drawWorldMap } = await import('../js/render/world-map.js');
    const P2 = { w: 400, h: 300, project: (x, y) => ({ x: x * 0.1, y: y * 0.1, s: 0.1 }) };
    drawWorldMap(ctx2, P2, def, 1.23);
  } catch (e) { err = e.message; }
  cek('WORLD MAP: render macro berjalan tanpa error & tanpa NaN', !err && nan === 0 && ops > 0, err || `ops=${ops} nan=${nan}`);
  runS.worldMapDef = def; runS.introT = 0; runS.macroSnapped = false;
  for (let i = 0; i < 10; i++) { game.update && game.update(1 / 60); }
  const tMap = runS.camera.corridorTarget;
  cek('WORLD MAP: SNAP MACRO auto-fit SELURUH tubuh (target < 0,12)', tMap < 0.12, `target=${tMap.toFixed(4)}`);
  runS.introT = 10; runS.worldMapDef = undefined; runS.macroSnapped = false;
}

// ---------- HUD ARENA TERTUTUP (spec owner): 5 elemen kanvas ----------
{
  const texts = [];
  let nan = 0, ops = 0, err = null;
  const grad = { addColorStop() {} };
  const base = {
    canvas: { width: 400, height: 300 },
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    measureText: () => ({ width: 40 }), roundRect() {},
    fillText: (t) => { ops++; texts.push(String(t)); },
  };
  const ctxH = new Proxy(base, { get(t, p) { if (p in t) return t[p]; if (typeof p !== 'string') return undefined; if (/Style$|^font$|^line(Width|Cap|Join|DashOffset)$|^global|^text|^filter$|^shadow|^imageSmoothing|^miterLimit$|^direction$/.test(p)) return ''; return (t[p] = (...a) => { ops++; for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) nan++; }); }, set(t, p, v) { t[p] = v; return true; } });
  try {
    const { drawArenaHud } = await import('../js/ui/hud-arena.js');
    const PH = { w: 400, h: 300, project: (x, y) => ({ x: 200 + x * 0.05, y: 150 + y * 0.05, s: 0.05 }) };
    runS.chamber.spawned = Math.max(runS.chamber.spawned || 0, runS.enemies.length + 2);
    drawArenaHud(ctxH, PH, runS, game, 4.2);
  } catch (e) { err = e.message; }
  const joined = texts.join('|');
  const lima = ['SPECIMEN BIO-CORE', 'THREAT RADAR', 'Patogen Tersisa', 'VITAL STABILITY', 'Bio-Essence']
    .every((k) => joined.includes(k));
  cek('HUD ARENA: 5 elemen spec owner tergambar (A bio-core, B radar+X/Y+katup, C crosshair, D vitals 5-seg+ATP+essence, E slot)',
    !err && nan === 0 && lima, err || `teks=${texts.length} nan=${nan} labels=[${joined.slice(0, 120)}]`);
  const gembok = joined.includes('TERKUNCI') || joined.includes('KATUP TERBUKA');
  cek('HUD ARENA: ikon katup radar mengikuti state chamber (TERKUNCI saat lockdown/swarm, KATUP TERBUKA saat open)',
    gembok, `state=${runS.chamber.state} label katup ada=${gembok}`);
}

// ---------- MAP = DENAH: penanda status organ (cleared/active/locked) ----------
{
  let nan = 0, opsNo = 0, opsSt = 0, err = null;
  const grad = { addColorStop() {} };
  const mk = () => {
    const base = { canvas: { width: 400, height: 300 }, createLinearGradient: () => grad, createRadialGradient: () => grad, measureText: () => ({ width: 40 }), roundRect() {} };
    return new Proxy(base, { get(t, p) { if (p in t) return t[p]; if (typeof p !== 'string') return undefined; if (/Style$|^font$|^line(Width|Cap|Join|DashOffset)$|^global|^text|^filter$|^shadow|^imageSmoothing|^miterLimit$|^direction$/.test(p)) return ''; return (t[p] = (...a) => { for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) nan++; }); }, set(t, p, v) { t[p] = v; return true; } });
  };
  try {
    const { drawWorldMap } = await import('../js/render/world-map.js');
    const P2 = { w: 400, h: 300, project: (x, y) => ({ x: x * 0.1, y: y * 0.1, s: 0.1 }) };
    const defM = API.getData().bodyMap;
    const ctxA = mk(); drawWorldMap(ctxA, P2, defM, 1.0);
    opsNo = 1;
    const states = {};
    for (const o of defM.organs) states[o.id] = 'locked';
    states[defM.organs[0].id] = 'active';
    if (defM.organs[1]) states[defM.organs[1].id] = 'cleared';
    const ctxB = mk(); drawWorldMap(ctxB, P2, defM, 1.0, states);
    opsSt = 1;
  } catch (e) { err = e.message; }
  cek('MAP DENAH: penanda status organ (cleared ✓ / active cincin teal / locked gembok) render tanpa error & NaN',
    !err && nan === 0 && opsNo > 0 && opsSt > 0, err || `nan=${nan}`);
}

console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 15)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
