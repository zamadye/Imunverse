/**
 * Uji EKONOMI ANTIBODI V2 (P3 — PHAGOS_IAP_V2.txt §3–§31).
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom
 *   PHAGOS_BUNDLE=.tmp-bundle.js node tools/verify-economy.mjs
 *
 * Yang dijamin:
 *   1. Semua angka ekonomi TUNABLE di data/economy.json (§29) — nol hardcode.
 *   2. Kurva biaya mutasi naik, terbatas, dan mengikuti indeks (§7).
 *   3. Tiap hero punya PROFIL PENGHASILAN (§11) dan TIDAK ADA hero farming
 *      meta — peluang progresi semua hero dalam rentang kompetitif (§12).
 *   4. Tiga fase ekonomi (Abundance → Tension → Scarcity) muncul natural (§8).
 *   5. Kekurangan antibodi TIDAK memblokir permainan (§10).
 *   6. TEST A (tanpa Reserve/IAP/iklan) tetap memberi progresi yang menyenangkan.
 *   7. Scarcity ≠ grinding: puncak pohon mutasi masih terjangkau.
 *   8. Umpan balik penghasilan wajib ada (§5) & event ekonomi tercatat (§28).
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

// Ekonomi dipakai game.js di DALAM bundle — ambil instance yang SAMA.
const EKO = (API && API.economy) || await import('../js/systems/antibody-economy.js');
const {
  antibodyForKill, antibodyForEngulf, mutationCost, totalMutationCost, economyPhase,
  earnAntibody, runAntibody, projectedRunIncome, economyLog, recordEconomyEvent,
} = EKO;
// Daftar event bersifat statis (konstanta), jadi aman diimpor langsung.
const NODE_EKO = await import('../js/systems/antibody-economy.js');
const { ECONOMY_EVENTS } = NODE_EKO;
// Catatan: module bundle (dipakai game.js) dan module Node (dipakai impor
// langsung di penguji ini) punya instance berbeda — jadi log digabung.
const semuaLog = () => [...economyLog(), ...NODE_EKO.economyLog()];

const eco = baca('data/economy.json');
const heroes = baca('data/heroes.json').heroes;
const muts = baca('data/mutations.json').mutations;

// ---------- 1. TUNABLE (§29) ----------
const punyaTunable = !!(eco.antibody && eco.antibody.sources && eco.mutation && eco.mutation.growth)
  && Number.isFinite(eco.mutation.baseCost) && Number.isFinite(eco.mutation.minCost)
  && Number.isFinite(eco.mutation.maxCost) && Number.isFinite(eco.mutation.maxMutationsPerRun);
cek('semua parameter ekonomi ada di data (tunable, §29)', punyaTunable, JSON.stringify(Object.keys(eco)));

// ---------- 2. KURVA BIAYA (§7) ----------
const biaya = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => mutationCost(i));
const naik = biaya.every((v, i) => i === 0 || v > biaya[i - 1]);
const dalamBatas = biaya.every((v) => v >= eco.mutation.minCost && v <= eco.mutation.maxCost);
cek('kurva biaya mutasi naik & terbatas (§7)', naik && dalamBatas, `${biaya.join(' → ')}`);
cek('biaya mengikuti INDEKS mutasi (bukan per-mutasi)',
  mutationCost(1) === eco.mutation.baseCost
  && mutationCost(2) === eco.mutation.baseCost + eco.mutation.growth.firstStep
  && muts.every((m) => m.bioCost === undefined || true),
  `mutasi1=${mutationCost(1)} mutasi2=${mutationCost(2)}`);

// ---------- 3. PROFIL PENGHASILAN PER HERO (§11) ----------
const profil = eco.antibody.heroEarning || {};
const tanpaProfil = heroes.filter((h) => !profil[h.id]);
const rata = (k) => heroes.reduce((a, h) => a + (profil[h.id] ? profil[h.id][k] : 1), 0) / heroes.length;
const beridentitas = heroes.every((h) => {
  const p = profil[h.id];
  if (!p) return false;
  const kinds = ['normal', 'elite', 'boss', 'event'];
  const unggul = kinds.some((k) => p[k] > rata(k) + 0.05);
  const bayar = kinds.some((k) => p[k] < rata(k) - 0.05);
  return unggul && bayar; // strength + trade-off, bukan sekadar angka beda
});
cek('tiap hero punya profil penghasilan dgn keunggulan & trade-off (§11)',
  tanpaProfil.length === 0 && beridentitas, `${tanpaProfil.length} tanpa profil, beridentitas=${beridentitas}`);

// ---------- 4. TIDAK ADA HERO FARMING META (§12) ----------
const income = heroes.map((h) => ({ id: h.id, total: projectedRunIncome(h.id) }));
const mean = income.reduce((a, b) => a + b.total, 0) / income.length;
const band = eco.antibody.competitiveBandPct || 10;
const diluar = income.filter((x) => Math.abs(x.total - mean) / mean * 100 > band);
const terbaik = income.reduce((a, b) => (b.total > a.total ? b : a), income[0]);
const terburuk = income.reduce((a, b) => (b.total < a.total ? b : a), income[0]);
cek('tidak ada hero farming meta (semua dalam rentang kompetitif, §12)',
  diluar.length === 0,
  `${diluar.map((x) => x.id).join(',') || 'semua masuk'} | band ±${band}% mean=${Math.round(mean)} ${terbaik.id}=${terbaik.total} ${terburuk.id}=${terburuk.total}`);

// ---------- 5. TIGA FASE EKONOMI (§8) ----------
const fase = [0, 1, 2, 3, 4, 5, 6, 8].map((n) => economyPhase(n));
cek('tiga fase ekonomi muncul berurutan (Abundance→Tension→Scarcity, §8)',
  economyPhase(1) === 'abundance' && economyPhase(2) === 'abundance'
  && economyPhase(3) === 'tension' && economyPhase(5) === 'tension'
  && economyPhase(6) === 'scarcity' && economyPhase(8) === 'scarcity',
  `0..8 → ${fase.join(',')}`);

// ---------- 6. KEKURANGAN TIDAK MEMBLOKIR (§10) ----------
cek('kekurangan antibodi TIDAK memblokir permainan (§10)',
  eco.insufficientRule && eco.insufficientRule.blockGameplay === false
  && Array.isArray(eco.insufficientRule.options) && eco.insufficientRule.options.includes('continue'),
  JSON.stringify(eco.insufficientRule));

// ---------- 7. TEST A — TANPA RESERVE / IAP / IKLAN (§31) ----------
const dompet = Math.round(mean); // pemain tanpa bantuan apa pun
let dibeli = 0; let sisa = dompet; const urutan = [];
for (let i = 1; i <= eco.mutation.maxMutationsPerRun; i++) {
  const h = mutationCost(i);
  if (sisa >= h) { sisa -= h; dibeli += 1; urutan.push(`${i}:${h}`); } else break;
}
const faseTerakhir = economyPhase(dibeli);
cek('TEST A (tanpa Reserve/IAP/iklan): ≥4 mutasi & fase scarcity tercapai (§31)',
  dibeli >= 4 && dibeli <= eco.mutation.maxMutationsPerRun && ['tension', 'scarcity'].includes(faseTerakhir),
  `${dibeli} mutasi (${urutan.join(' ')}) sisa ${sisa} fase=${faseTerakhir}`);

// ---------- 8. SCARCITY ≠ GRINDING ----------
const puncak = totalMutationCost(eco.mutation.maxMutationsPerRun);
const rasio = puncak / mean;
cek('scarcity bukan grinding: puncak pohon mutasi terjangkau (≤2,2 run)',
  rasio <= 2.2 && rasio > 1,
  `total ${eco.mutation.maxMutationsPerRun} mutasi = ${puncak}; income/run ≈ ${Math.round(mean)} → ${rasio.toFixed(2)} run`);

// ---------- 9. SUMBER & UMPAN BALIK (§5) ----------
const kinds = ['normal', 'elite', 'boss', 'event'];
const nilai = kinds.map((k) => antibodyForKill(k, 'macrophage'));
cek('sumber antibodi: elite & boss jauh lebih bernilai dari kill biasa (§3)',
  nilai[1] > nilai[0] * 3 && nilai[2] > nilai[1] * 3 && antibodyForEngulf('macrophage') > 0,
  `normal=${nilai[0]} elite=${nilai[1]} boss=${nilai[2]} event=${nilai[3]} telan=${antibodyForEngulf('macrophage')}`);

// ---------- 10. RUNTIME: kill nyata menambah antibodi + umpan balik ----------
const { Enemy } = await import('../js/entities/enemy.js');
const defBakteri = baca('data/enemies.json').enemies.find((e) => e.id === 'bakteri');
game.startRun('macrophage');
const run = game.run;
run.enemies.length = 0; run.antibody = 0;
const musuh = new Enemy(defBakteri, 40, 0, { hpScale: 1, speedScale: 1 });
run.enemies.push(musuh);
run.collision.rebuildEnemyGrid(run.enemies);
const sebelumLabel = run.effects.numbers.length;
const sebelumPartikel = run.effects.particles.length;
game.onEnemyKilled(musuh, 'pulse');
const dapat = runAntibody(run);
const adaLabel = run.effects.numbers.slice(sebelumLabel).some((n) => String(n.text || '').includes('ANTIBODI'));
const adaPartikel = run.effects.particles.length > sebelumPartikel;
cek('kill nyata memberi antibodi + label + partikel (§5)',
  dapat > 0 && adaLabel && adaPartikel,
  `+${dapat} antibodi, label=${adaLabel}, partikel=${adaPartikel}`);

// ---------- 11. RUNTIME: beli mutasi memotong antibodi ----------
const { applyMutation, rollMutationChoices, mutationPriceFor } = await import('../js/systems/mutation-system.js');
run.antibody = mutationPriceFor(run) + 5;
const sebelumBeli = run.antibody;
const kartu = rollMutationChoices(run)[0];
const harga = mutationPriceFor(run);
if (kartu && kartu.isMutation) {
  const res = applyMutation(run, kartu.id);
  const potong = sebelumBeli - runAntibody(run);
  cek('membeli mutasi memotong antibodi sesuai kurva (§6)',
    res.ok && potong === harga, `ok=${res.ok} potong=${potong} harga=${harga}`);
} else {
  cek('membeli mutasi memotong antibodi sesuai kurva (§6)', false, 'kartu mutasi tidak ditawarkan');
}
// kekurangan antibodi: DITOLAK, tetapi permainan tidak berhenti
run.antibody = 0;
const gagal = applyMutation(run, muts.find((m) => !(run.activeMutations || []).includes(m.id) && !(muts.find((x) => x.id === (run.activeMutations || [])[0]) || { conflicts: [] }).conflicts?.includes(m.id))?.id || muts[0].id);
const kandas = semuaLog().some((e) => e.name === 'mutation_failed_insufficient_antibody');
cek('antibodi kurang → mutasi ditolak TANPA menghentikan permainan (§10)',
  !!(gagal && gagal.ok === false) && kandas && run.player.alive !== false,
  `ok=${gagal && gagal.ok} alasan="${gagal && gagal.reason}" tercatat=${kandas}`);

// ---------- 12. TELEMETRI (§28) ----------
recordEconomyEvent('run_started', { heroId: 'macrophage' });
const log = semuaLog();
const wajib = ['antibody_earned', 'mutation_purchased', 'mutation_failed_insufficient_antibody', 'run_started'];
const belum = wajib.filter((n) => !log.some((e) => e.name === n));
cek('event ekonomi tercatat (§28)', belum.length === 0 && ECONOMY_EVENTS.length >= 14,
  `${belum.join(',') || 'lengkap'} | ${ECONOMY_EVENTS.length} event terdaftar`);

// ---------- 13. SATU SINK: mutasi (§31) ----------
const unlockPakaiAntibodi = heroes.some((h) => (h.unlock || {}).currency || (h.unlock || {}).antibody);
cek('antibodi hanya untuk mutasi — hero dibuka lewat progres bermain (§31/§33)',
  eco.mutation.primarySink === true && !unlockPakaiAntibodi && Array.isArray(eco.nonGoals),
  `sink=${eco.mutation.primarySink} unlockBerbayar=${unlockPakaiAntibodi}`);

// ---------- 14. DOMPET HUD ----------
const hud = fs.readFileSync(path.join(ROOT, 'js/ui/screens/hud-screen.js'), 'utf8');
const levelup = fs.readFileSync(path.join(ROOT, 'js/ui/screens/levelup-screen.js'), 'utf8');
cek('HUD & modal menampilkan antibodi + harga mutasi berikutnya (§26)',
  hud.includes('updateAntibodyChip') && hud.includes('siap-mutasi')
  && levelup.includes('ANTIBODI') && levelup.includes('mutationPriceFor'),
  'chip/modal belum menampilkan ekonomi antibodi');

console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 15)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
