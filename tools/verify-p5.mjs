/**
 * Uji P5 — RESERVE · REWARDED AD · IAP MOCK (PHAGOS_IAP_V2.txt §14–§21, §34).
 *
 *   npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
 *   npm i -D jsdom
 *   PHAGOS_BUNDLE=.tmp-bundle.js node tools/verify-p5.mjs
 *
 * Yang dijamin:
 *   1. Reserve TERPISAH dari Antibody (§14) & membantu MAKSIMAL X% harga (§15).
 *   2. Batas pakai per run & kapasitas ditegakkan (§15).
 *   3. Hierarki CONTINUE → WATCH AD → USE RESERVE tersedia & urut (§20).
 *   4. Iklan reward: +antibodi, jeda, kuota harian, telemetri (§19, §28).
 *   5. IAP MOCK: menambah cadangan, TANPA payment nyata, provider bisa
 *      ditukar untuk P9 tanpa menyentuh sistem mutasi (§21, §34).
 *   6. TIDAK ADA yang memblokir permainan (§10) & IAP kontekstual (§17, §27).
 *   7. TEST A/B/C/D: nol cadangan, cadangan kecil, cadangan besar, iklan.
 */
import fs from 'node:fs';
import path from 'node:path';
import { API, game, sleep } from './harness.mjs';
import * as HARNESS from './harness.mjs';
const JENDELA = HARNESS.window;

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

if (!API || !game) {
  console.log('bundle/harness belum siap (window.__IMUNVERSE tidak ada)');
  process.exit(1);
}
const R = API.reserve;
const P = API.purchases;
const ECO = API.economy;
const STATE = API.STATE;
cek('permukaan P5 terpasang di game (reserve + purchases)', !!(R && P && ECO), JSON.stringify(Object.keys(API)));

const eco = baca('data/economy.json');
const kodeMonet = fs.readFileSync(path.join(ROOT, 'js/systems/purchase-provider.js'), 'utf8');
const kodeLevelUp = fs.readFileSync(path.join(ROOT, 'js/ui/screens/levelup-screen.js'), 'utf8');
const kodeDashboard = fs.readFileSync(path.join(ROOT, 'js/ui/screens/dashboard-screen.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---------- 1. RESERVE TERPISAH (§14) ----------
const meta = STATE.meta;
meta.reserve = 0;
const run0 = { antibody: 300, activeMutations: [], reserveUses: 0, player: { alive: true } };
const saldoAwal = R.reserveBalance(meta);
R.grantReserve(meta, 2000, 'uji');
cek('cadangan tersimpan terpisah dari antibodi run (§14)',
  R.reserveBalance(meta) === saldoAwal + 2000 && run0.antibody === 300,
  `reserve=${R.reserveBalance(meta)} antibody=${run0.antibody}`);

// ---------- 2. BANTUAN MAKSIMAL X% HARGA (§15) ----------
const HARGA = 1000;
const pct = eco.reserve.assistancePctOfMutationCost;
const maksBantu = R.maxAssistFor(HARGA);
cek('bantuan cadangan dibatasi X% harga mutasi (§15)',
  maksBantu === Math.floor(HARGA * pct) && eco.reserve.assistancePctOfMutationCost > 0
  && eco.reserve.assistancePctOfMutationCost < 1,
  `maks=${maksBantu} (${pct} dari ${HARGA})`);

const runB = { antibody: 0, activeMutations: [], reserveUses: 0, player: { alive: true } };
meta.reserve = 20000; // TEST C — cadangan BESAR
const dibantu = R.useReserve(runB, meta, HARGA);
cek('cadangan besar TIDAK bisa menggantikan gameplay: mutasi tetap harus dibayar antibodi (§15)',
  dibantu === maksBantu && runB.antibody === maksBantu && runB.antibody < HARGA,
  `bantuan=${dibantu} antibody=${runB.antibody}/${HARGA}`);

// ---------- 3. BATAS PAKAI PER RUN & KAPASITAS (§15) ----------
const runC = { antibody: 0, activeMutations: [], reserveUses: 0, player: { alive: true } };
meta.reserve = 20000;
const pakai = [];
for (let i = 0; i < eco.reserve.maxUsesPerRun + 2; i++) pakai.push(R.useReserve(runC, meta, HARGA));
const boleh = pakai.filter((v) => v > 0).length;
cek('cadangan dipakai maksimal N kali per run (§15)',
  boleh === eco.reserve.maxUsesPerRun && pakai.slice(eco.reserve.maxUsesPerRun).every((v) => v === 0),
  `pakai=${pakai.join(',')} (maks ${eco.reserve.maxUsesPerRun})`);
const sisaSetelah = R.reserveBalance(meta);
R.grantReserve(meta, eco.reserve.capacity * 2, 'uji-kapasitas');
cek('kapasitas cadangan dibatasi data (§14)',
  R.reserveBalance(meta) === eco.reserve.capacity,
  `saldo=${R.reserveBalance(meta)} kapasitas=${eco.reserve.capacity} (sebelum ${sisaSetelah})`);

// ---------- 4. IKLAN REWARD: JEDA & KUOTA (§19) ----------
meta.reserve = 0;
meta.adLastAt = 0;
meta.adDaily = { date: null, count: 0 };
meta.noAds = false;
const st1 = P.adStatus(meta);
cek('iklan reward antibodi tersedia & memberi jumlah dari data (§19)',
  st1.canWatch === true && st1.reward === eco.rewardedAds.antibodyReward && eco.rewardedAds.enabled === true,
  `canWatch=${st1.canWatch} reward=${st1.reward}`);

let adDone = null;
P.triggerRewardedAdAntibody(meta, (r) => { adDone = r; });
await sleep(Math.max(1200, (eco.rewardedAds.simulatedSec || 1) * 1000 + 400));
cek('iklan selesai → kuota harian & jeda tercatat (§19)',
  meta.adDaily && meta.adDaily.count >= 1 && meta.adLastAt > 0,
  `count=${meta.adDaily && meta.adDaily.count} lastAt=${meta.adLastAt}`);
const st2 = P.adStatus(meta);
cek('jeda antar-iklan ditegakkan (§19)', st2.canWatch === false && st2.reason === 'jeda',
  `canWatch=${st2.canWatch} alasan=${st2.reason}`);
meta.adLastAt = Date.now() - (eco.rewardedAds.cooldownSec + 5) * 1000;
const st3 = P.adStatus(meta);
cek('setelah jeda habis iklan boleh lagi (§19)', st3.canWatch === true, `alasan=${st3.reason}`);
const hari = new Date().toISOString().slice(0, 10);
meta.adDaily = { date: hari, count: eco.rewardedAds.dailyLimit };
const st4 = P.adStatus(meta);
cek('kuota harian ditegakkan (§19)', st4.canWatch === false && st4.reason === 'kuota-habis',
  `alasan=${st4.reason} sisa=${st4.remainingToday}`);

// ---------- 5. IAP MOCK (§21, §34) ----------
meta.adDaily = { date: hari, count: 0 };
meta.adLastAt = 0;
meta.reserve = 0;
const pk = eco.iap.packs[1]; // reserve_m
const beli = await P.buyReservePack(meta, pk.id);
cek('IAP mock menambah cadangan (§21)', beli.ok === true && R.reserveBalance(meta) === pk.grant,
  `ok=${beli.ok} grant=${beli.granted} saldo=${R.reserveBalance(meta)}`);
cek('TIDAK ADA payment nyata pada prototipe (§21)',
  eco.iap.realPayment === false && P.iapEnabled() === true
  && P.purchaseProvider().realPayment === false && P.purchaseProvider().id === 'mock'
  && !/fetch\(|XMLHttpRequest|https?:\/\//.test(kodeMonet),
  `realPayment=${eco.iap.realPayment} provider=${P.purchaseProvider().id}`);

// TITIK INTEGRASI P9: provider bisa ditukar tanpa menyentuh ekonomi/mutasi
const asli = P.purchaseProvider();
const palsu = {
  id: 'uji-fake', realPayment: true,
  listPacks: () => P.iapPacks(),
  async purchase(id) { return { ok: true, packId: id, grant: 7, provider: 'uji-fake', simulated: false }; },
};
P.setPurchaseProvider(palsu);
const sebelumTukar = R.reserveBalance(meta);
const lewatPalsu = await P.buyReservePack(meta, 'reserve_s');
P.setPurchaseProvider(asli);
cek('provider bisa ditukar untuk P9 tanpa menyentuh sistem mutasi (§34)',
  P.purchaseProvider() === asli && R.reserveBalance(meta) === sebelumTukar + 7,
  `saldo=${R.reserveBalance(meta)} (sebelum ${sebelumTukar}) provider=${P.purchaseProvider().id}`);

// ---------- 6. TELEMETRI (§28) ----------
const log = ECO.economyLog();
const wajib = ['reserve_used', 'rewarded_ad_offered', 'rewarded_ad_completed', 'iap_mock_granted'];
const belum = wajib.filter((n) => !log.some((e) => e.name === n));
cek('event monetisasi tercatat (§28)', belum.length === 0, belum.join(',') || 'lengkap');

// ---------- 7. HIERARKI BANTUAN DI RUNTIME (§20) ----------
game.startRun('macrophage');
const run = game.run;
run.antibody = 0;
run.reserveUses = 0;
run.iapOffers = 0;
meta.reserve = 0;
meta.adDaily = { date: hari, count: 0 };
meta.adLastAt = 0;
const b1 = game.frictionAssist();
cek('hierarki CONTINUE / WATCH AD / USE RESERVE tersedia saat friksi (§20)',
  b1.shortfall > 0 && b1.ad.canWatch === true && b1.reserve.reason === 'kosong'
  && b1.iap.enabled === true,
  `kurang=${b1.shortfall} ad=${b1.ad.canWatch} reserve=${b1.reserve.reason} iap=${b1.iap.enabled}`);
meta.reserve = 500; // TEST B — cadangan KECIL
const b2 = game.frictionAssist();
cek('cadangan kecil terasa berguna namun tetap dibatasi (TEST B, §15)',
  b2.reserve.amount > 0 && b2.reserve.amount <= b2.reserve.cap && b2.reserve.amount < b2.shortfall,
  `bantu=${b2.reserve.amount} cap=${b2.reserve.cap} kurang=${b2.shortfall}`);
meta.reserve = eco.reserve.capacity; // TEST C
const b3 = game.frictionAssist();
cek('cadangan besar tetap tidak menutup seluruh harga (TEST C, §15)',
  b3.reserve.amount === b3.reserve.cap && b3.reserve.amount < b3.shortfall,
  `bantu=${b3.reserve.amount}/${b3.shortfall}`);

// cadangan dipakai lewat game → antibodi run bertambah, cadangan berkurang
const sebelum = { ab: run.antibody, rv: R.reserveBalance(meta) };
const masuk = game.useReserveAssist(() => {});
cek('memakai cadangan menambah antibodi & memotong cadangan (§14)',
  masuk > 0 && run.antibody === sebelum.ab + masuk
  && R.reserveBalance(meta) === sebelum.rv - masuk && run.reserveUses === 1,
  `masuk=${masuk} antibody=${run.antibody} reserve=${R.reserveBalance(meta)}`);

// jalur gratis: CONTINUE tidak memblokir & tidak memotong apa pun (§10, §20)
run.levelUpQueue = 1;
run.currentChoices = [{ id: 'x', isMutation: true, lockedByAntibody: true, cost: 100 }];
STATE.levelUpOpen = true;
const bebasJalan = game.deferLevelUp();
cek('CONTINUE: kekurangan antibodi tidak memblokir permainan (§10, §20)',
  bebasJalan === true && STATE.levelUpOpen === false && run.antibody >= 0
  && ECO.runAntibody(run) === sebelum.ab + masuk,
  `levelUpOpen=${STATE.levelUpOpen} antibody=${run.antibody}`);

// TEST D — iklan dipakai bila tersedia: antibodi bertambah & kartu disegarkan
const sebelumIklan = run.antibody;
let selesai = null;
game.watchAntibodyAd((r) => { selesai = r; });
await sleep(Math.max(1200, (eco.rewardedAds.simulatedSec || 1) * 1000 + 400));
cek('TEST D — iklan menambah antibodi & menyegarkan status kartu (§19)',
  selesai && selesai.granted === eco.rewardedAds.antibodyReward
  && run.antibody === sebelumIklan + eco.rewardedAds.antibodyReward,
  `granted=${selesai && selesai.granted} antibody=${sebelumIklan} → ${run.antibody}`);

// ---------- 8. IAP KONTEKSTUAL, BUKAN DI DASHBOARD (§17, §27) ----------
const panelFriksi = kodeLevelUp.includes('frictionPanel') && kodeLevelUp.includes('butuhBantuan')
  && kodeLevelUp.includes('fric-continue') && kodeLevelUp.includes('fric-ad') && kodeLevelUp.includes('fric-reserve');
cek('tawaran bantuan hanya muncul saat friksi ekonomi (§17, §27)',
  panelFriksi && /\(\s*a\.iap && a\.iap\.enabled/.test(kodeLevelUp),
  'panel friksi/hierarki belum ditemukan di levelup-screen');
// Komentar kode tidak dihitung — yang dilarang adalah UI JUALAN yang nyata.
// CATATAN P7 tahap 4: dashboard kini punya SATU pintu masuk Shop (kartu atas
// ke-3) atas permintaan desain. Yang dilarang §17 adalah ETALASE jualan:
// daftar harga, tombol Beli, atau tawaran IAP yang memenuhi dashboard.
// Jadi aturannya: maksimal 1 pintu masuk, dan TIDAK ADA harga/paket di dashboard.
const dashBersihKomentar = kodeDashboard.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const dashHtml = (html.match(/<section[^>]*id="screen-dashboard"[\s\S]*?<\/section>/) || [''])[0];
const etalaseJualan = /shop-pack|Beli|Rp\.?\s?\d|harga|price|iap|buy/i.test(dashHtml);
const pintuShop = (dashHtml.match(/card-shop|data-nav="shop"/g) || []).length;
const kodeBersih = !/iap|reserve|buyReservePack|shop|toko|cadangan/i.test(dashBersihKomentar);
cek('IAP TIDAK memenuhi dashboard (§17): maksimal 1 pintu masuk & tanpa etalase harga',
  kodeBersih && !etalaseJualan && pintuShop <= 1,
  `kode=${kodeBersih} etalase=${etalaseJualan} pintu=${pintuShop}`);
const kuotaTayang = typeof P.maxIapOffersPerRun() === 'number' && eco.iap.maxOffersPerRun > 0;
cek('kuota tayang IAP per run dibatasi data (§27)', kuotaTayang, `maksOffersPerRun=${eco.iap.maxOffersPerRun}`);

// ---------- 8b. PANEL FRIKSI BENAR-BENAR TAMPIL DI LAYAR MUTASI ----------
game.startRun('macrophage');
const runL = game.run;
runL.antibody = 0;
runL.level = 3;
runL.reserveUses = 0;
runL.iapOffers = 0;
meta.reserve = 500;
meta.adDaily = { date: hari, count: 0 };
meta.adLastAt = 0;
game.openLevelUpModal();
await sleep(400);
const gridKartu = JENDELA.document.querySelectorAll('#screen-levelup #levelup-choices .choice-card');
cek('semua kartu tawaran benar-benar ter-render (modal mutasi tidak boleh error)',
  gridKartu.length === (game.run.currentChoices || []).length && gridKartu.length >= 3,
  `kartu=${gridKartu.length} tawaran=${(game.run.currentChoices || []).length}`);
const panel = JENDELA.document.querySelector('#screen-levelup .lu-friction');
const tombol = panel ? [...panel.querySelectorAll('.fric-btn')] : [];
const urut = tombol.map((b) => (b.classList.contains('fric-continue') ? 'continue'
  : b.classList.contains('fric-ad') ? 'ad' : b.classList.contains('fric-reserve') ? 'reserve' : '?')).join('>');
cek('UI hierarki tampil berurutan CONTINUE → AD → RESERVE (§18, §20)',
  !!panel && urut === 'continue>ad>reserve',
  `panel=${!!panel} urut=${urut || '-'}`);
const continueBtn = tombol[0];
continueBtn && continueBtn.dispatchEvent(new JENDELA.MouseEvent('click', { bubbles: true }));
await sleep(150);
cek('tombol CONTINUE menutup tawaran & run berlanjut (§10, §20)',
  STATE.levelUpOpen === false && !!game.run && game.run.ended !== true,
  `levelUpOpen=${STATE.levelUpOpen} ended=${game.run && game.run.ended}`);

// ---------- 9. TEST A — TANPA CADANGAN / IKLAN / IAP ----------
const { projectedRunIncome, mutationCost, totalMutationCost } = ECO;
const income = projectedRunIncome('macrophage');
const biaya8 = totalMutationCost(8);
cek('TEST A — tanpa Reserve/IAP/iklan, progresi tetap masuk akal (§31)',
  income > 0 && biaya8 / income <= 2.5,
  `income/run=${income} puncak 8 mutasi=${biaya8} (${(biaya8 / income).toFixed(2)} run)`);
// cadangan tidak pernah dipakai otomatis
const runA = { antibody: 0, activeMutations: [], reserveUses: 0, player: { alive: true } };
meta.reserve = 9999;
const autoPakai = mutationCost(1);
cek('cadangan TIDAK pernah dipakai otomatis — harus lewat pilihan pemain (§15)',
  R.reserveBalance(meta) === 9999 && runA.antibody === 0 && autoPakai > 0,
  `reserve=${R.reserveBalance(meta)} antibody=${runA.antibody}`);

console.log(JSON.stringify(hasil, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors.slice(0, 15)) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
