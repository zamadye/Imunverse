#!/usr/bin/env node
/**
 * scripts/unit-fase3.mjs — uji headless FASE 3 Monetisasi (BUILD 60a)
 *
 * Yang dikunci di sini:
 *   • Larangan brief §7: kurs Imun/Antibodi TIDAK berubah (pin angka),
 *     imun_12000 & bundle_noads tetap nonaktif, sink Imun HANYA dua
 *   • 3.2 bonus pembelian pertama 2×: hanya imun_500 & imun_1000, sekali per
 *     tier (resolveImunGrant/markFirstPurchase), penanda UI hilang setelah terpakai
 *   • 3.3 Kartu Imun: dripStatus (sisa hari, hangus) + tampil di topbar dashboard
 *     dan profil
 *   • 3.4 Lanjut Run 50 Imun (1/run, pakai confirmRevive yang sama) & Peti Riset
 *     150 Imun (2×, jalur & penanda TERPISAH dari iklan — tidak menyentuh kuota)
 *   • 3.5 audit bebas iklan: perilaku SAAT INI dipin sampai G15 dijawab —
 *     noAds mematikan SEMUA rewarded; revive & double-currency bebas kuota;
 *     peti boss, pemulihan, dan iklan toko dalam kuota
 *
 *   node scripts/unit-fase3.mjs    # atau: npm run test:fase3
 */

import { readFileSync } from 'node:fs';

/* ---------- shim lingkungan (fetch + localStorage) ---------- */

globalThis.fetch = async (url) => {
  const p = String(url).split('?')[0];
  const body = readFileSync(p, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
};
globalThis.localStorage = globalThis.window.localStorage;

/* ---------- harness ---------- */

const results = [];
const check = (label, cond, detail = '') => {
  results.push({ label, ok: !!cond, detail });
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY_MS = 86400000;

const { loadAllData } = await import('../js/core/data-store.js');
const data = await loadAllData();
const { getImunSinks } = await import('../js/core/data-store.js');
const { resolveImunGrant, markFirstPurchase } = await import('../js/systems/pricing-model.js');
const { spendImun, startDrip, dripStatus, hasPerk } = await import('../js/systems/imun-economy.js');
const { canWatchAd } = await import('../js/systems/monetization.js');

const anchors = data.anchors;
const premium = data.premium;

/* ---------- 1. Pin larangan brief §7 ---------- */

console.log('\n=== 1. Larangan brief: kurs tetap, produk terlarang nonaktif, sink hanya dua ===');
check('kurs Imun TETAP Rp 30/Imun (baseRateRp)', anchors.currency.imun.baseRateRp === 30, `baseRateRp=${anchors.currency.imun.baseRateRp}`);
check('kurs TETAP 1 Imun = 40 Antibodi (perImun)', anchors.currency.antibodi.perImun === 40, `perImun=${anchors.currency.antibodi.perImun}`);
check('tier referensi tetap imun_500', anchors.currency.imun.referenceTierId === 'imun_500');
const byId = Object.fromEntries(premium.bundles.map((b) => [b.id, b]));
check('imun_12000 TETAP nonaktif', byId.imun_12000 && byId.imun_12000.active === false);
check('bundle_noads TETAP nonaktif', byId.bundle_noads && byId.bundle_noads.active === false);
const sinks = getImunSinks();
check('imunSinks HANYA dua entri (continueRun + researchChest)', Object.keys(sinks).filter((k) => k !== 'doc').length === 2, Object.keys(sinks).filter((k) => k !== 'doc').join(','));
check('Lanjut Run = 50 Imun, batas 1/run', sinks.continueRun.costImun === 50 && sinks.continueRun.perRunLimit === 1);
check('Peti Riset = 150 Imun', sinks.researchChest.costImun === 150);

/* ---------- 2. Bonus pembelian pertama 2× (3.2) ---------- */

console.log('\n=== 2. Bonus pembelian pertama 2× — imun_500 & imun_1000 saja, sekali per tier ===');
const fpb = premium.firstPurchaseBonus;
check('config: enabled, 100%, sekali per tier', fpb.enabled === true && fpb.bonusPct === 100 && fpb.oncePerTier === true);
check('config: appliesTo HANYA [imun_500, imun_1000]', JSON.stringify(fpb.appliesTo) === JSON.stringify(['imun_500', 'imun_1000']), fpb.appliesTo.join(','));

const meta = { imun: 0, firstBuy: {} };
const p500 = byId.imun_500;
const g1 = resolveImunGrant(p500, premium, meta);
check('imun_500 pembelian PERTAMA → 2× (1000)', g1.imun === 1000 && g1.bonusApplied === true, `imun=${g1.imun}`);
markFirstPurchase(p500, meta);
check('penanda tersimpan di meta.firstBuy', meta.firstBuy.imun_500 === true);
const g2 = resolveImunGrant(p500, premium, meta);
check('imun_500 pembelian KEDUA → tanpa bonus (500)', g2.imun === 500 && g2.bonusApplied === false, `imun=${g2.imun}`);
const g3 = resolveImunGrant(byId.imun_1000, premium, meta);
check('imun_1000 pertama → 2× (2000) — once PER TIER, bukan per akun', g3.imun === 2000 && g3.bonusApplied === true, `imun=${g3.imun}`);
const tier2500 = premium.bundles.find((b) => b.class === 'currency_ladder' && b.id !== 'imun_500' && b.id !== 'imun_1000' && b.active);
const g4 = resolveImunGrant(tier2500, premium, meta);
check(`tier atas (${tier2500.id}) TIDAK dapat bonus`, g4.bonusApplied === false);

/* ---------- 3. spendImun + status Kartu Imun (3.3) ---------- */

console.log('\n=== 3. spendImun & dripStatus ===');
const m2 = { imun: 120 };
check('spendImun cukup → true, saldo terpotong', spendImun(m2, 50) === true && m2.imun === 70);
check('spendImun kurang → false, saldo UTUH (tidak jadi dipotong)', spendImun(m2, 150) === false && m2.imun === 70);

const now = Date.now();
const m3 = { imun: 0 };
startDrip(m3, { imunPerDay: 50, days: 30 }, 'kartu_imun_30', now);
let st = dripStatus(m3, now);
check('hari pertama: aktif, sisa 30 hari, belum klaim', st.active && st.dayNumber === 1 && st.daysLeft === 30 && st.claimedToday === false);
st = dripStatus(m3, now + 29 * DAY_MS);
check('hari ke-30: aktif, sisa 1 hari', st.active && st.dayNumber === 30 && st.daysLeft === 1);
st = dripStatus(m3, now + 31 * DAY_MS);
check('hari ke-32: kartu berakhir (tidak aktif)', st.active === false);
check('tanpa kartu → null (chip/baris disembunyikan)', dripStatus({ imun: 0 }, now) === null);

/* ---------- 4. Audit bebas iklan (3.5) — perilaku dipin sampai G15 dijawab ---------- */

console.log('\n=== 4. Audit 3.5: kuota & noAds (perilaku saat ini, G15 tetap terbuka) ===');
const today = new Date().toISOString().slice(0, 10);
check('noAds → canWatchAd false (G15b: mematikan SEMUA rewarded — perilaku lama dipin)', canWatchAd({ noAds: true, adDaily: null }) === false);
check('kuota habis (6/6) → false', canWatchAd({ adDaily: { date: today, count: 6 } }) === false);
check('kuota 5/6 → true', canWatchAd({ adDaily: { date: today, count: 5 } }) === true);
check('kemarin 99x → hari ini kuota baru → true', canWatchAd({ adDaily: { date: '2000-01-01', count: 99 } }) === true);
check('perk adDailyLimitPlus2 → 7/8 masih boleh', canWatchAd({ perks: { adDailyLimitPlus2: 0 }, adDaily: { date: today, count: 7 } }) === true);
check('perk adDailyLimitPlus2 → 8/8 penuh', canWatchAd({ perks: { adDailyLimitPlus2: 0 }, adDaily: { date: today, count: 8 } }) === false);

// BUG FIX 60a: hasPerk lama menolak nilai 0 (falsy) padahal kontraknya 0 = permanen.
check('hasPerk: 0 = PERMANEN → berlaku (bug fix 60a)', hasPerk({ perks: { noForcedAds: 0 } }, 'noForcedAds') === true);
check('hasPerk: untilTs masa depan → berlaku', hasPerk({ perks: { x: Date.now() + 60000 } }, 'x') === true);
check('hasPerk: untilTs lewat → gugur', hasPerk({ perks: { x: Date.now() - 60000 } }, 'x') === false);
check('hasPerk: perk tidak ada → false (bukan undefined)', hasPerk({ perks: {} }, 'x') === false && hasPerk({}, 'x') === false);

const gameSrc = read('js/core/game.js');
const reqRevive = (gameSrc.match(/requestRevive\(\)\s*\{[\s\S]*?\n  \},/) || [''])[0];
check('G15a dipin: revive iklan BEBAS kuota (tanpa canWatchAd/trackAdWatch)', reqRevive.includes('triggerRewardedAdRevive') && !reqRevive.includes('canWatchAd') && !reqRevive.includes('trackAdWatch'));
const dbl = (gameSrc.match(/applyDoubleCurrency\(\)\s*\{[\s\S]*?\n  \},/) || [''])[0];
check('G15a dipin: double-currency BEBAS kuota', dbl.includes('addCurrency') && !dbl.includes('canWatchAd') && !dbl.includes('trackAdWatch'));
const chestAd = (gameSrc.match(/claimBossChestDouble\(\)\s*\{[\s\S]*?\n  \},/) || [''])[0];
check('peti boss iklan DALAM kuota (canWatchAd + trackAdWatch)', chestAd.includes('canWatchAd') && chestAd.includes('trackAdWatch'));
const dashSrc = read('js/ui/screens/dashboard-screen.js');
check('pemulihan iklan (dashboard) DALAM kuota', dashSrc.includes('canWatchAd(meta)') && dashSrc.includes('trackAdWatch(meta)'));
const shopSrc = read('js/ui/screens/shop-screen.js');
check('iklan sponsor toko DALAM kuota', shopSrc.includes('canWatchAd(meta)') && shopSrc.includes('trackAdWatch(meta)'));
check('interstitial tidak pernah dipakai (noForcedAds saat ini tanpa efek)', !read('js/main.js').includes('triggerInterstitialAd') && !gameSrc.includes('triggerInterstitialAd'));

/* ---------- 5. Sink Imun (3.4): pemisahan jalur & wiring ---------- */

console.log('\n=== 5. Lanjut Run & Peti Riset: jalur terpisah, wiring lengkap ===');
const cont = (gameSrc.match(/continueWithImun\(\)\s*\{[\s\S]*?\n  \},/) || [''])[0];
check('continueWithImun: potong Imun → confirmRevive yang sama', cont.includes('spendImun(STATE.meta, cfg.costImun)') && cont.includes('this.confirmRevive()'));
check('continueWithImun: batas per-run + tolak bila run berakhir/revive dipakai', cont.includes('run.imunContinueUsed') && cont.includes('run.reviveUsed') && cont.includes('run.ended'));
check('continueWithImun TIDAK menyentuh kuota iklan (terpisah dari revive iklan)', !cont.includes('canWatchAd') && !cont.includes('trackAdWatch'));
const research = (gameSrc.match(/buyResearchChest\(\)\s*\{[\s\S]*?\n  \},/) || [''])[0];
check('buyResearchChest: potong Imun → _grantBossChest(true)', research.includes('spendImun(STATE.meta, cost)') && research.includes('this._grantBossChest(true)'));
check('buyResearchChest: penanda riset TERPISAH (chest.researchBought), bukan kuota iklan', research.includes('chest.researchBought') && !research.includes('canWatchAd') && !research.includes('trackAdWatch') && !research.includes('adDaily'));
check('openBossChest mengirim saldo + biaya riset ke UI', gameSrc.includes('researchCost: getImunSinks().researchChest.costImun') && gameSrc.includes('researchAvailable'));
check('run state punya imunContinueUsed', gameSrc.includes('imunContinueUsed: 0'));

const reviveSrc = read('js/ui/screens/revive-screen.js');
check('revive-screen: tombol Imun dari data + disabled saat saldo kurang', reviveSrc.includes('getImunSinks().continueRun') && reviveSrc.includes('imunBtn.disabled = saldo < cfg.costImun') && reviveSrc.includes('game.continueWithImun()'));
const chestSrc = read('js/ui/screens/bosschest-screen.js');
check('bosschest-screen: tombol Peti Riset + disabled saat saldo kurang', chestSrc.includes('btn-chest-research') && chestSrc.includes('rBtn.disabled = !payload.researchAvailable || saldo < payload.researchCost') && chestSrc.includes('game.buyResearchChest()'));

/* ---------- 6. Penanda 2× & Kartu Imun di UI (3.2/3.3) ---------- */

console.log('\n=== 6. UI: penanda pembelian pertama + sisa hari kartu ===');
check('shop: firstBuyAvailable membaca meta.firstBuy (penanda hilang setelah terpakai)', shopSrc.includes('function firstBuyAvailable') && shopSrc.includes('meta.firstBuy[bundle.id]'));
check('shop: pita "2× PEMBELIAN PERTAMA" di kartu + baris di modal bayar', shopSrc.includes('prem-firstbuy') && shopSrc.includes('pay-firstbuy'));
check('dashboard: chip card-chip dari dripStatus, klik → Toko', dashSrc.includes("dripStatus(meta)") && dashSrc.includes('card-chip') && dashSrc.includes(`screenManager.show('shop')`));
const profSrc = read('js/ui/screens/profile-screen.js');
check('profil: baris sisa hari + tombol klaim (claimDrip)', profSrc.includes('profile-card-line') && profSrc.includes('drip.daysLeft') && profSrc.includes('claimDrip(meta)'));

const html = read('index.html');
check('markup: btn-imun-revive & btn-chest-research & card-chip & profile-card-line', ['btn-imun-revive', 'btn-chest-research', 'card-chip', 'profile-card-line'].every((id) => html.includes(`id="${id}"`)));
const build = (read('js/core/version.js').match(/BUILD\s*=\s*'([^']+)'/) || [])[1];
check('BUILD pola <angka><huruf> dan semua ?v=BUILD (JS + 2 CSS)', /^\d+[a-z]$/.test(build) && (html.match(new RegExp(`\\?v=${build}`, 'g')) || []).length === 3, `BUILD=${build}`);
check('CSS: gaya chip kartu + pita firstbuy + tombol sink ada', read('styles/dashboard-focus.css').includes('.card-chip') && read('styles/main.css').includes('.prem-firstbuy') && read('styles/main.css').includes('#btn-chest-research'));
const lang = JSON.parse(read('data/lang.json'));
check('lang.json: string baru terdaftar', ['Lanjut Run', 'Peti Riset', 'Kartu Imun', '2× PEMBELIAN PERTAMA'].every((k) => typeof lang.strings[k] === 'string'));

/* ---------- ringkasan ---------- */

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? '✅' : '❌'} ${results.length - failed.length}/${results.length} pemeriksaan lulus`);
if (failed.length) {
  for (const f of failed) console.log(`  GAGAL: ${f.label}${f.detail ? ` — ${f.detail}` : ''}`);
  process.exit(1);
}
