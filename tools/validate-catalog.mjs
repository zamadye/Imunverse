#!/usr/bin/env node
/**
 * tools/validate-catalog.mjs
 *
 * Menjalankan audit katalog IAP terhadap data/economy-anchors.json.
 * Keluar dengan kode 1 bila ada error, sehingga bisa dipasang sebagai
 * pre-commit hook atau step CI:
 *
 *   node tools/validate-catalog.mjs
 *
 * Tujuannya sederhana: tidak ada harga yang bisa masuk ke branch produksi
 * tanpa lolos cek monotonisitas, dominasi, konsistensi kurs, dan badge.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  validateCatalog,
  netRevenueRp,
  f2pDaysToReach,
  adPayoutRatio,
  antibodiRateRp,
  resolveImunGrant
} from '../js/systems/pricing-model.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const anchors = JSON.parse(readFileSync(resolve(root, 'data/economy-anchors.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(resolve(root, 'data/premium.json'), 'utf8'));

const rp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const num = (n, d = 2) => (n === null || n === undefined ? '—' : n.toFixed(d).replace('.', ','));
const pad = (s, w, right = false) => {
  s = String(s);
  return right ? s.padStart(w) : s.padEnd(w);
};

const { errors, warnings, rows } = validateCatalog(catalog, anchors);

console.log('\n=== KATALOG IAP IMUNVERSE ===');
console.log(`anchors v${anchors.version} · katalog v${catalog.version} · ${catalog.effectiveDate}`);
console.log(`1 Imun = Rp ${anchors.currency.imun.baseRateRp} (tier referensi) · ` +
            `1 Imun = ${anchors.currency.antibodi.perImun} Antibodi = ` +
            `Rp ${num(antibodiRateRp(anchors), 3)}/Antibodi\n`);

const head = [
  pad('produk', 17), pad('kelas', 16), pad('harga', 12, true),
  pad('Imun', 8, true), pad('Rp/Imun', 9, true), pad('nilai isi', 12, true),
  pad('badge', 16)
].join(' ');
console.log(head);
console.log('-'.repeat(head.length));

for (const r of rows) {
  const line = [
    pad((r.active ? '' : '· ') + r.id, 17),
    pad(r.class, 16),
    pad(rp(r.priceRp), 12, true),
    pad(r.imun || '—', 8, true),
    pad(num(r.rpPerImun), 9, true),
    pad(rp(r.valueRp), 12, true),
    pad(r.badge || '—', 16)
  ].join(' ');
  console.log(line);
}
console.log('\n(· = tidak aktif)');

console.log('\n--- Tangga harga: bonus terhadap tier referensi ---');
for (const r of rows.filter(x => x.class === 'currency_ladder')) {
  const b = r.bonusPct === null ? 0 : r.bonusPct;
  console.log(`${pad(r.id, 15)} ${pad(rp(r.priceRp), 12, true)}  ` +
              `${pad(num(r.rpPerImun) + ' Rp/Imun', 18, true)}  ` +
              `${pad(b <= 0.5 ? 'referensi' : '+' + Math.floor(b) + '%', 12, true)}` +
              `${r.active ? '' : '   (fase 2)'}`);
}

console.log('\n--- Bonus pembelian pertama (2x, sekali per tier) ---');
for (const id of catalog.firstPurchaseBonus.appliesTo) {
  const p = catalog.bundles.find(b => b.id === id);
  const fresh = resolveImunGrant(p, catalog, { firstBuy: {} });
  const repeat = resolveImunGrant(p, catalog, { firstBuy: { [id]: true } });
  console.log(`${pad(id, 15)} pertama: ${pad(fresh.imun + ' Imun', 12, true)} ` +
              `(${num(p.priceRp / fresh.imun)} Rp/Imun)   ` +
              `berikutnya: ${pad(repeat.imun + ' Imun', 12, true)} ` +
              `(${num(p.priceRp / repeat.imun)} Rp/Imun)`);
}

console.log('\n--- Pendapatan bersih per metode (tier 2.500) ---');
const sample = catalog.bundles.find(b => b.id === 'imun_2500');
for (const m of catalog.methods) {
  const n = netRevenueRp(sample.priceRp, m);
  console.log(`${pad(m.name, 34)} biaya ${pad(rp(n.fee), 10, true)} ` +
              `(${num(n.feePct)}%)   bersih ${rp(n.net)}`);
}

console.log('\n--- Jarak jalur gratis vs jalur bayar ---');
const perDay = anchors.adEconomy.imunPerAd * anchors.adEconomy.dailyLimit;
console.log(`Faucet iklan: ${anchors.adEconomy.imunPerAd} Imun x ` +
            `${anchors.adEconomy.dailyLimit}/hari = ${perDay} Imun/hari`);
const targets = [
  ['tier terkecil (500 Imun)', 500],
  ['satu skin 250 Imun', 250],
  ['Battle Pass premium', catalog.battlePass.premiumCostImun],
  ['seluruh 7 hero (2.460)', 2460]
];
for (const [label, t] of targets) {
  console.log(`${pad(label, 30)} ${pad(num(f2pDaysToReach(t, anchors), 1) + ' hari', 12, true)}`);
}

const ad = adPayoutRatio(anchors, 4.0, 16300);
console.log(`\nRasio bayar iklan: nilai diberikan ${rp(ad.payout)}/tayangan vs ` +
            `pendapatan ${rp(ad.revenuePerImpression)}/tayangan = ${num(ad.ratio)}x ` +
            `(asumsi eCPM rewarded USD 4,00 APAC, kurs Rp 16.300)`);

console.log('\n--- Hasil audit ---');
if (warnings.length) {
  for (const w of warnings) console.log('  PERINGATAN  ' + w);
}
if (errors.length) {
  for (const e of errors) console.log('  ERROR       ' + e);
  console.log(`\n${errors.length} error. Katalog TIDAK boleh dirilis.\n`);
  process.exit(1);
}
console.log(`  Lolos. 0 error, ${warnings.length} peringatan.\n`);
