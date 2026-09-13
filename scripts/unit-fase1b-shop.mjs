#!/usr/bin/env node
/**
 * scripts/unit-fase1b-shop.mjs — uji headless Fase 1B (adaptasi Toko ke katalog v2)
 *
 * Menutup kriteria terima ROADMAP §4 tanpa browser:
 *   • tidak ada produk `active:false` yang tampil atau bisa dipesan
 *   • harga/nilai/badge dihitung runtime (tidak ada `priceLabel`/`valueNote`,
 *     tidak ada string "HEMAT n%" tulis tangan di js/)
 *   • metode pembayaran = objek, urutan QRIS → e-wallet → kartu
 *   • membeli Paket Perdana benar-benar memberi skin (+ bentuk meta.cosmetics
 *     tetap kanonik, G13) dan menghormati `limit.perAccount`
 *   • membeli Kartu Imun memberi 300 Imun + tetesan 50/hari × 30 + perk
 *     (kuota iklan 6 → 8), tetesan hangus bila tidak diklaim
 *   • bonus pembelian pertama 2× hanya sekali per tier
 *   • produk yang hilang dari katalog tidak membuat payOrder() melempar
 *
 *   node scripts/unit-fase1b-shop.mjs      # atau: npm run test:fase1b
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* ---------- shim lingkungan ---------- */

globalThis.fetch = async (url) => {
  const p = String(url).split('?')[0];
  return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(p, 'utf8')) };
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

const DAY = 86400000;
const results = [];
const check = (label, cond, detail = '') => {
  results.push({ label, ok: !!cond, detail });
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const { loadAllData } = await import('../js/core/data-store.js');
const data = await loadAllData();
const { createDefaultMeta, mergeMetaDefaults, STATE } = await import('../js/core/state-manager.js');
const pay = await import('../js/systems/payment-system.js');
const imun = await import('../js/systems/imun-economy.js');
const { canWatchAd } = await import('../js/systems/monetization.js');

/** Meta uji dengan akun (pembelian wajib akun) dan waktu pembuatan save. */
function freshMeta(createdAt = new Date().toISOString()) {
  const m = mergeMetaDefaults(createDefaultMeta());
  m.createdAt = createdAt;
  m.account = { uid: 'u_test', username: 'tester', faction: 'merah', createdAt: createdAt.slice(0, 10) };
  m.imun = 0;
  m.currency = 0;
  STATE.meta = m;
  return m;
}

/** Bayar satu produk lewat jalur nyata: createOrder → setMethod → payOrder. */
async function buy(productId, methodId = 'qris') {
  const ord = pay.createOrder(productId);
  if (!ord.ok) return ord;
  const sm = pay.setMethod(ord.order.orderId, methodId);
  if (!sm.ok) return sm;
  return pay.payOrder(ord.order.orderId);
}

/* ---------- 1. katalog ---------- */

console.log('\n=== 1. Katalog v2: hanya produk aktif yang tampil ===');
const meta = freshMeta();
const visible = pay.getVisibleCatalog(meta).map((p) => p.id);
check('imun_12000 (nonaktif) tidak tampil', !visible.includes('imun_12000'), visible.join(', '));
check('bundle_noads (nonaktif/pensiun) tidak tampil', !visible.includes('bundle_noads'));
check('7 produk aktif tampil', visible.length === 7, `${visible.length}: ${visible.join(', ')}`);
check('produk nonaktif tidak bisa dipesan', pay.createOrder('imun_12000').ok === false && pay.createOrder('bundle_noads').ok === false);
check('produk tak dikenal tidak melempar', pay.createOrder('bundle_welcome').ok === false);

console.log('\n=== 2. Jendela penawaran 72 jam (limit.visibleForHoursAfterFirstLogin) ===');
const lama = freshMeta(new Date(Date.now() - 4 * DAY).toISOString());
check('save berusia 4 hari tidak melihat Paket Perdana', !pay.getVisibleCatalog(lama).some((p) => p.id === 'bundle_perdana'));
check('save baru melihat Paket Perdana', pay.getVisibleCatalog(freshMeta()).some((p) => p.id === 'bundle_perdana'));

/* ---------- 3. nilai & badge runtime ---------- */

console.log('\n=== 3. Harga, nilai isi, dan badge dihitung runtime ===');
check('formatRp(15000) = "Rp 15.000"', pay.formatRp(15000) === 'Rp 15.000', pay.formatRp(15000));
const perdana = pay.findProduct('bundle_perdana');
const ris = pay.findProduct('bundle_riset');
const im1000 = pay.findProduct('imun_1000');
check('valueSummary tidak menghasilkan undefined', !pay.valueSummary(perdana).includes('undefined'), pay.valueSummary(perdana));
check('valueSummary menyebut nilai Rp dari anchors', /Nilai isi ± Rp [\d.]+/.test(pay.valueSummary(perdana)));
check('badge bundle_riset = HEMAT n% (dihitung, bukan tulis tangan)', /^HEMAT \d+%$/.test(pay.badgeForProduct(ris) || ''), pay.badgeForProduct(ris));
check('badge imun_1000 = +n% BONUS vs tier referensi imun_500', /^\+\d+% BONUS$/.test(pay.badgeForProduct(im1000) || ''), pay.badgeForProduct(im1000));
check('badge tier referensi = badge data/null (tanpa klaim bonus)', pay.badgeForProduct(pay.findProduct('imun_500')) === null);
check('badge pass_bulanan = HEMAT n% (drip 1.800 Imun dinilai penuh; label data hanya fallback)', /^HEMAT \d+%$/.test(pay.badgeForProduct(pay.findProduct('pass_bulanan')) || ''), pay.badgeForProduct(pay.findProduct('pass_bulanan')));

/* ---------- 4. metode pembayaran ---------- */

console.log('\n=== 4. Metode pembayaran = objek, QRIS dulu, kartu terakhir ===');
const order = pay.getMethodsSorted().map((m) => m.id);
check('urutan qris → ewallet → kartu', order.join(',') === 'qris,ewallet,kartu', order.join(' → '));
check('nama metode dari data (bukan peta tulis tangan)', pay.getMethodsSorted()[1].name.includes('GoPay'), pay.getMethodsSorted().map((m) => m.name).join(' | '));
const o2 = pay.createOrder('imun_500');
check('setMethod(id) diterima', pay.setMethod(o2.order.orderId, 'qris').ok === true);
check('setMethod(objek) ditolak (regresi G8)', pay.setMethod(o2.order.orderId, pay.getMethods()[0]).ok === false);
check('setMethod(id tak dikenal) ditolak', pay.setMethod(o2.order.orderId, 'bitcoin').ok === false);
check('methodName tahan receipt lama', pay.methodName('qris') === 'QRIS' && typeof pay.methodName(undefined) === 'string');

/* ---------- 5. Paket Perdana ---------- */

console.log('\n=== 5. Paket Perdana memberi skin + isi lengkap (kriteria terima §4) ===');
const m5 = freshMeta();
const res5 = await buy('bundle_perdana');
check('pembayaran berhasil', res5.ok === true, JSON.stringify(res5.error || ''));
check('skin_pendiri benar-benar diberikan', (m5.cosmetics?.owned || []).includes('skin_pendiri'), JSON.stringify(m5.cosmetics?.owned));
check('bentuk meta.cosmetics kanonik: skin = {} bukan null (G13)', m5.cosmetics && typeof m5.cosmetics.skin === 'object' && m5.cosmetics.skin !== null);
check('400 Imun + 2.000 Antibodi masuk', m5.imun === 400 && m5.currency === 2000, `imun=${m5.imun} antibodi=${m5.currency}`);
check('consumables masuk (2 serum_awal, 2 vaksin_awal)', m5.consumables.serum_awal === 2 && m5.consumables.vaksin_awal === 2);
check('struk menyebut skin', res5.granted.some((g) => g.includes('skin')), res5.granted.join(' · '));
check('purchaseCount tercatat', m5.purchaseCount.bundle_perdana === 1);
check('tidak tampil lagi setelah dibeli (limit.perAccount 1)', !pay.getVisibleCatalog(m5).some((p) => p.id === 'bundle_perdana'));
check('order kedua ditolak dengan alasan jelas', pay.createOrder('bundle_perdana', m5).error?.includes('Maksimal'), pay.createOrder('bundle_perdana', m5).error);

/* ---------- 6. Kartu Imun 30 Hari ---------- */

console.log('\n=== 6. Kartu Imun 30 Hari: 300 Imun + tetesan 50/hari + perk ===');
const m6 = freshMeta();
const res6 = await buy('pass_bulanan');
check('pembayaran berhasil', res6.ok === true);
check('300 Imun instan masuk', m6.imun === 300, `${m6.imun}`);
check('tetesan tersimpan 50 Imun × 30 hari', m6.drip?.imunPerDay === 50 && m6.drip?.days === 30);
check('perk noForcedAds + adDailyLimitPlus2 aktif 30 hari', imun.hasPerk(m6, 'noForcedAds') && imun.hasPerk(m6, 'adDailyLimitPlus2'), JSON.stringify(m6.perks));
check('kuota iklan harian 6 → 8 karena perk', imun.adLimitBonusFromPerks(m6) === 2);
m6.adDaily = { date: new Date().toISOString().slice(0, 10), count: 6 };
check('canWatchAd masih true pada tayangan ke-7 (limit 8)', canWatchAd(m6) === true);
m6.adDaily.count = 8;
check('canWatchAd false pada tayangan ke-9', canWatchAd(m6) === false);
const st = imun.dripStatus(m6);
check('status kartu: hari 1/30, belum diklaim', st.dayNumber === 1 && st.daysLeft === 30 && st.claimedToday === false, JSON.stringify({ d: st.dayNumber, left: st.daysLeft }));
const c1 = imun.claimDrip(m6);
check('klaim hari 1 → +50 Imun (total 350)', c1.ok && m6.imun === 350, `${m6.imun}`);
check('klaim kedua pada hari yang sama ditolak', imun.claimDrip(m6).ok === false && imun.claimDrip(m6).error === 'Sudah diklaim hari ini');
const c2 = imun.claimDrip(m6, Date.now() + DAY);
check('hari berikutnya bisa klaim lagi (hari 2/30)', c2.ok && c2.dayNumber === 2 && m6.imun === 400, `${m6.imun}`);
const habis = imun.dripStatus(m6, m6.drip.startTs + 30 * DAY + 1000);
check('setelah 30 hari kartu tidak aktif', habis.active === false && habis.daysLeft === 0);
check('tetesan hari yang terlewat HANGUS (tidak menumpuk)', imun.claimDrip(m6, m6.drip.startTs + 30 * DAY + 1000).ok === false);

/* ---------- 7. bonus pembelian pertama ---------- */

console.log('\n=== 7. Bonus pembelian pertama 2× (sekali per tier) ===');
const m7 = freshMeta();
const b1 = await buy('imun_500');
check('pembelian pertama imun_500 → 1.000 Imun (2×)', m7.imun === 1000 && m7.firstBuy.imun_500 === true, `${m7.imun}`);
check('struk menyebut bonus', b1.granted.some((g) => g.includes('bonus pembelian pertama')), b1.granted.join(' · '));
const b2 = await buy('imun_500');
check('pembelian kedua → 500 Imun (bonus habis)', b2.ok && m7.imun === 1500, `${m7.imun}`);
check('bonus tidak berlaku di tier 2.500 (sesuai data)', (await (async () => { const m = freshMeta(); await buy('imun_2500'); return m.imun; })()) === 2500);

/* ---------- 8. toleransi katalog berubah ---------- */

console.log('\n=== 8. Produk hilang dari katalog tidak membuat payOrder melempar ===');
const m8 = freshMeta();
const ord8 = pay.createOrder('imun_1000');
pay.setMethod(ord8.order.orderId, 'qris');
const bundles = data.premium.bundles;
const idx = bundles.findIndex((b) => b.id === 'imun_1000');
const removed = bundles[idx];
bundles.splice(idx, 1); // simulasi katalog diubah saat order masih terbuka
let thrown = null;
let res8 = null;
try { res8 = await pay.payOrder(ord8.order.orderId); } catch (e) { thrown = e; }
bundles.splice(idx, 0, removed); // kembalikan katalog seperti semula
check('tidak melempar', thrown === null, thrown ? thrown.message : '');
check('menolak dengan pesan jelas, Imun tidak bertambah', res8 && res8.ok === false && m8.imun === 0, JSON.stringify(res8 && res8.error));

/* ---------- 9. pemindaian sumber (regresi UI tidak boleh kembali) ---------- */

console.log('\n=== 9. Pemindaian sumber: field katalog v1 & badge tulis tangan ===');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
const shopSrc = strip(readFileSync('js/ui/screens/shop-screen.js', 'utf8'));
for (const banned of ['priceLabel', 'valueNote', 'METHOD_LABEL', 'triggerRewardedAdOfferwall', '.method.toUpperCase()']) {
  check(`shop-screen tidak lagi memakai ${banned}`, !shopSrc.includes(banned));
}
for (const required of ['getVisibleCatalog', 'badgeForProduct', 'valueSummary', 'formatRp', 'getMethodsSorted', 'dripStatus', 'claimDrip']) {
  check(`shop-screen memakai ${required}`, shopSrc.includes(required));
}
const jsFiles = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) jsFiles.push(p);
  }
})('js');
const handwritten = [];
for (const f of jsFiles) {
  if (f.includes('pricing-model.js')) continue; // di sini badge MEMANG dihitung
  const src = strip(readFileSync(f, 'utf8'));
  if (/HEMAT \d/.test(src)) handwritten.push(f);
}
check('tidak ada badge "HEMAT n%" tulis tangan di js/ (selain pricing-model)', handwritten.length === 0, handwritten.join(', '));
const dataFiles = readdirSync('data').filter((f) => f.endsWith('.json') && f !== 'economy-anchors.json');
const handData = dataFiles.filter((f) => /"HEMAT \d/.test(readFileSync(join('data', f), 'utf8')));
check('tidak ada badge HEMAT tulis tangan di data/*.json', handData.length === 0, handData.join(', '));

/* ---------- hasil ---------- */

const fail = results.filter((r) => !r.ok);
console.log(`\n--- Hasil: ${results.length - fail.length}/${results.length} lolos ---`);
if (fail.length) {
  for (const f of fail) console.log(`  GAGAL: ${f.label}${f.detail ? ` (${f.detail})` : ''}`);
  process.exit(1);
}
console.log('UNIT_FASE1B_PASS');
