/**
 * pricing-model.js — Imunverse
 *
 * Satu-satunya tempat di mana "nilai" dihitung. Tidak ada angka valuasi yang
 * boleh muncul di UI, di premium.json, atau di sistem lain; semuanya memanggil
 * modul ini dengan anchors dari data/economy-anchors.json.
 *
 * Konsekuensi yang disengaja: setiap badge "HEMAT x%" di layar toko dapat
 * ditelusuri ke satu rumus dan satu kurs, sehingga temuan P0-3 (badge tidak
 * dapat direproduksi) tidak bisa terulang.
 *
 * Modul ini murni: tidak menyentuh DOM, tidak menyentuh save, tidak
 * melempar untuk input yang wajar — kesalahan katalog dikembalikan sebagai
 * daftar error agar dapat diuji di CI.
 */

/* ------------------------------------------------------------------ */
/* Kurs dasar                                                          */
/* ------------------------------------------------------------------ */

/** Rp per 1 Antibodi, diturunkan dari kurs Imun dan kurs tukar resmi. */
export function antibodiRateRp(anchors) {
  const base = anchors.currency.imun.baseRateRp;
  const per = anchors.currency.antibodi.perImun;
  if (!(base > 0) || !(per > 0)) {
    throw new Error('economy-anchors.json: baseRateRp dan antibodi.perImun harus > 0');
  }
  return base / per;
}

/** Nilai Rp satu consumable, dari biaya tokonya dalam Antibodi. */
export function consumableValueRp(itemId, anchors) {
  const costAntibodi = anchors.itemValuation.shopItems[itemId];
  if (typeof costAntibodi !== 'number') return null;
  return costAntibodi * antibodiRateRp(anchors);
}

/** Nilai Rp satu kosmetik. Kosmetik limited memakai limitedValueImun. */
export function cosmeticValueRp(cosmeticId, anchors) {
  const cfg = anchors.cosmeticValuation;
  const priceImun = cfg.prices[cosmeticId];
  if (typeof priceImun !== 'number') return null;
  const effective = priceImun > 0
    ? priceImun
    : (cfg.limited.includes(cosmeticId) ? cfg.limitedValueImun : 0);
  return effective * anchors.currency.imun.baseRateRp;
}

/* ------------------------------------------------------------------ */
/* Valuasi isi produk                                                  */
/* ------------------------------------------------------------------ */

/**
 * Menilai seluruh isi sebuah produk pada kurs dasar.
 * Mengembalikan rincian per komponen supaya angka badge bisa dibuka di audit.
 *
 * @returns {{totalRp:number, breakdown:Object, unknown:string[]}}
 */
export function valueContents(contents, anchors) {
  const baseImun = anchors.currency.imun.baseRateRp;
  const abRate = antibodiRateRp(anchors);
  const breakdown = { imun: 0, antibodi: 0, consumables: 0, cosmetics: 0, drip: 0, entitlements: 0 };
  const unknown = [];

  if (contents.imun) breakdown.imun = contents.imun * baseImun;
  if (contents.currency) breakdown.antibodi = contents.currency * abRate;

  if (contents.drip) {
    const days = contents.drip.days || 0;
    const perDay = contents.drip.imunPerDay || 0;
    breakdown.drip = days * perDay * baseImun;
  }

  if (contents.consumables) {
    for (const [id, qty] of Object.entries(contents.consumables)) {
      const unit = consumableValueRp(id, anchors);
      if (unit === null) { unknown.push(`consumable:${id}`); continue; }
      breakdown.consumables += unit * qty;
    }
  }

  if (Array.isArray(contents.cosmetics)) {
    for (const id of contents.cosmetics) {
      const v = cosmeticValueRp(id, anchors);
      if (v === null) { unknown.push(`cosmetic:${id}`); continue; }
      breakdown.cosmetics += v;
    }
  }

  if (contents.noAds) {
    breakdown.entitlements += anchors.entitlementValuation.noAds;
  }

  const totalRp = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { totalRp, breakdown, unknown };
}

/** Total Imun yang akhirnya diterima pembeli, termasuk drip langganan. */
export function totalImunDelivered(contents) {
  const instant = contents.imun || 0;
  const drip = contents.drip ? (contents.drip.imunPerDay || 0) * (contents.drip.days || 0) : 0;
  return instant + drip;
}

/* ------------------------------------------------------------------ */
/* Metrik tangga harga                                                 */
/* ------------------------------------------------------------------ */

/** Rp yang dibayar per 1 Imun. null bila produk tidak mengandung Imun. */
export function rateRpPerImun(product) {
  const imun = totalImunDelivered(product.contents);
  if (!imun) return null;
  return product.priceRp / imun;
}

/** Imun yang didapat per Rp 1.000 — metrik yang dipakai untuk badge bonus. */
export function imunPerThousandRp(product) {
  const imun = totalImunDelivered(product.contents);
  if (!imun || !product.priceRp) return null;
  return (imun / product.priceRp) * 1000;
}

/**
 * Bonus terhadap tier referensi, memakai definisi yang paling konservatif
 * (perbandingan Imun per Rp terhadap tier terkecil), bukan definisi yang
 * paling mengesankan. Angka ini yang boleh tampil di UI.
 */
export function bonusPctVsReference(product, referenceProduct) {
  const a = imunPerThousandRp(product);
  const b = imunPerThousandRp(referenceProduct);
  if (a === null || b === null || b === 0) return null;
  return (a / b - 1) * 100;
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

/**
 * Persentase hemat sebuah bundle terhadap nilai isinya pada kurs dasar.
 * Dibulatkan ke bawah sesuai badgePolicy sehingga klaim di UI tidak pernah
 * melebihi penghematan sebenarnya.
 */
export function savingPct(product, anchors) {
  const { totalRp } = valueContents(product.contents, anchors);
  if (totalRp <= 0) return null;
  const raw = (1 - product.priceRp / totalRp) * 100;
  const mode = anchors.badgePolicy.roundingMode;
  return mode === 'floor' ? Math.floor(raw) : Math.round(raw);
}

/**
 * Teks badge final untuk satu produk. Mengembalikan null bila produk tidak
 * memenuhi ambang minimum — lebih baik tanpa badge daripada badge yang lemah.
 */
export function badgeFor(product, anchors, referenceProduct) {
  if (product.class === 'currency_ladder') {
    if (referenceProduct && referenceProduct.id !== product.id) {
      const bonus = bonusPctVsReference(product, referenceProduct);
      if (bonus !== null && bonus >= 1) return `+${Math.floor(bonus)}% BONUS`;
    }
    return product.badge || null;
  }
  const pct = savingPct(product, anchors);
  if (pct !== null && pct >= anchors.badgePolicy.minSavingPctToShow) {
    return `HEMAT ${pct}%`;
  }
  return product.badge || null;
}

/* ------------------------------------------------------------------ */
/* Bonus pembelian pertama                                             */
/* ------------------------------------------------------------------ */

/**
 * Menghitung Imun yang benar-benar diberikan, memperhitungkan bonus 2x
 * sekali per tier. Riwayat disimpan di meta.firstBuy sebagai set id produk.
 *
 * @param {Object} product   entri katalog
 * @param {Object} catalog   isi premium.json
 * @param {Object} meta      state pemain (dibaca saja di sini)
 * @returns {{imun:number, bonusApplied:boolean}}
 */
export function resolveImunGrant(product, catalog, meta) {
  const base = product.contents.imun || 0;
  const cfg = catalog.firstPurchaseBonus;
  if (!cfg || !cfg.enabled) return { imun: base, bonusApplied: false };
  if (!cfg.appliesTo.includes(product.id)) return { imun: base, bonusApplied: false };

  const used = (meta && meta.firstBuy) || {};
  if (cfg.oncePerTier && used[product.id]) return { imun: base, bonusApplied: false };

  const bonus = Math.floor(base * (cfg.bonusPct / 100));
  return { imun: base + bonus, bonusApplied: bonus > 0 };
}

/** Menandai tier sebagai sudah memakai bonus pertama. Mutasi eksplisit. */
export function markFirstPurchase(product, meta) {
  if (!meta.firstBuy) meta.firstBuy = {};
  meta.firstBuy[product.id] = true;
  return meta;
}

/* ------------------------------------------------------------------ */
/* Pendapatan bersih                                                   */
/* ------------------------------------------------------------------ */

/**
 * Pendapatan bersih setelah MDR payment gateway dan PPN atas biaya.
 * Dipakai untuk membandingkan margin antar metode, bukan untuk menentukan
 * harga jual (harga jual harus sama di semua metode).
 */
export function netRevenueRp(priceRp, method) {
  const mdr = priceRp * (method.mdrPct / 100) + (method.flatFeeRp || 0);
  const ppn = method.feeIncludesPpn ? 0 : mdr * ((method.ppnOnFeePct || 0) / 100);
  const fee = mdr + ppn;
  return { gross: priceRp, fee, net: priceRp - fee, feePct: (fee / priceRp) * 100 };
}

/* ------------------------------------------------------------------ */
/* Validasi katalog                                                    */
/* ------------------------------------------------------------------ */

/**
 * Apakah produk `a` terdominasi oleh produk `b`?
 * Dominasi = b tidak lebih mahal, dan b memberi setidaknya sama banyak pada
 * SEMUA sumbu yang dinilai pembeli (Imun dan nilai total), dengan minimal
 * satu sumbu yang benar-benar lebih baik.
 *
 * Inilah cek yang akan menangkap kembali kasus bundle_imun vs pass_m1.
 */
export function isDominated(a, b, anchors) {
  if (a.id === b.id) return false;
  if (b.priceRp > a.priceRp) return false;
  const imunA = totalImunDelivered(a.contents);
  const imunB = totalImunDelivered(b.contents);
  const valA = valueContents(a.contents, anchors).totalRp;
  const valB = valueContents(b.contents, anchors).totalRp;
  if (imunB < imunA) return false;
  if (valB < valA) return false;
  return b.priceRp < a.priceRp || imunB > imunA || valB > valA;
}

/**
 * Audit lengkap katalog. Dipanggil di CI sebelum deploy dan oleh
 * tools/validate-catalog.mjs.
 *
 * @returns {{errors:string[], warnings:string[], rows:Object[]}}
 */
export function validateCatalog(catalog, anchors) {
  const errors = [];
  const warnings = [];
  const active = catalog.bundles.filter(b => b.active);

  const reference = catalog.bundles.find(b => b.id === anchors.currency.imun.referenceTierId);
  if (!reference) {
    errors.push(`Tier referensi "${anchors.currency.imun.referenceTierId}" tidak ada di katalog.`);
    return { errors, warnings, rows: [] };
  }

  const refRate = rateRpPerImun(reference);
  if (Math.abs(refRate - anchors.currency.imun.baseRateRp) > 0.005) {
    errors.push(
      `Tier referensi ${reference.id} menghasilkan Rp ${refRate.toFixed(2)}/Imun ` +
      `tetapi baseRateRp = ${anchors.currency.imun.baseRateRp}.`
    );
  }

  for (const p of catalog.bundles) {
    if (p.active && !(p.priceRp > 0)) {
      errors.push(`${p.id}: produk aktif dengan priceRp <= 0 tidak boleh masuk produksi.`);
    }
    const { unknown } = valueContents(p.contents, anchors);
    for (const u of unknown) {
      errors.push(`${p.id}: isi "${u}" tidak punya nilai di economy-anchors.json.`);
    }
  }

  // Monotonisitas tangga: makin mahal tier, makin murah per Imun.
  const ladder = active
    .filter(p => p.class === 'currency_ladder')
    .sort((a, b) => a.priceRp - b.priceRp);
  for (let i = 1; i < ladder.length; i++) {
    const prev = ladder[i - 1];
    const cur = ladder[i];
    if (rateRpPerImun(cur) >= rateRpPerImun(prev)) {
      errors.push(
        `Tangga harga rusak: ${cur.id} (Rp ${rateRpPerImun(cur).toFixed(2)}/Imun) ` +
        `tidak lebih murah per Imun daripada ${prev.id} (Rp ${rateRpPerImun(prev).toFixed(2)}/Imun).`
      );
    }
  }

  // Tidak boleh ada produk aktif yang terdominasi.
  for (const a of active) {
    for (const b of active) {
      if (isDominated(a, b, anchors)) {
        // Produk yang menetes harian atau hanya bisa dibeli sekali bukan
        // substitusi penuh bagi produk yang bisa dibeli berulang kali.
        const gated = p => p.class === 'subscription' || (p.limit && p.limit.perAccount);
        const msg = `${a.id} terdominasi oleh ${b.id} (harga Rp ${b.priceRp} <= Rp ${a.priceRp}).`;
        if (gated(a) || gated(b)) {
          warnings.push(msg + ' Diturunkan ke peringatan: salah satunya menetes harian atau dibatasi sekali per akun.');
        } else {
          errors.push(msg);
        }
      }
    }
  }

  // Pita diskon bundle non-tangga. Karena semua komponen dinilai pada satu
  // kurs, satu-satunya variabel yang tersisa adalah diskon — dan itulah yang
  // harus berada dalam pita sempit agar katalog terasa adil.
  const { minDiscountPct, maxDiscountPct } = anchors.badgePolicy;
  for (const p of active) {
    if (p.class === 'currency_ladder') continue;
    const pct = savingPct(p, anchors);
    if (pct === null) continue;
    if (pct < minDiscountPct) {
      errors.push(
        `${p.id}: diskon ${pct}% di bawah pita minimum ${minDiscountPct}% — ` +
        `pembeli lebih baik membeli Imun langsung.`
      );
    }
    if (pct > maxDiscountPct) {
      errors.push(
        `${p.id}: diskon ${pct}% di atas pita maksimum ${maxDiscountPct}% — ` +
        `bundle ini akan mengkanibal tangga harga.`
      );
    }
  }

  // Badge harus dapat direproduksi.
  for (const p of active) {
    if (p.class === 'currency_ladder') continue;
    const pct = savingPct(p, anchors);
    if (p.badge && String(p.badge).toUpperCase().startsWith('HEMAT')) {
      const claimed = parseInt(String(p.badge).replace(/\D/g, ''), 10);
      if (!Number.isFinite(pct) || claimed > pct) {
        errors.push(`${p.id}: badge mengklaim ${claimed}% tetapi rumus hanya membenarkan ${pct}%.`);
      }
    }
  }

  const rows = catalog.bundles.map(p => {
    const val = valueContents(p.contents, anchors);
    return {
      id: p.id,
      active: p.active,
      class: p.class,
      priceRp: p.priceRp,
      imun: totalImunDelivered(p.contents),
      rpPerImun: rateRpPerImun(p),
      valueRp: val.totalRp,
      savingPct: p.class === 'currency_ladder' ? null : savingPct(p, anchors),
      bonusPct: p.class === 'currency_ladder' ? bonusPctVsReference(p, reference) : null,
      badge: badgeFor(p, anchors, reference)
    };
  });

  return { errors, warnings, rows };
}

/* ------------------------------------------------------------------ */
/* Metrik F2P                                                          */
/* ------------------------------------------------------------------ */

/**
 * Berapa hari seorang pemain gratis butuh untuk mencapai target Imun tertentu,
 * hanya dari iklan. Dipakai untuk menjaga jarak antara jalur gratis dan
 * jalur bayar tetap masuk akal setiap kali kurs berubah.
 */
export function f2pDaysToReach(targetImun, anchors) {
  const perDay = anchors.adEconomy.imunPerAd * anchors.adEconomy.dailyLimit;
  if (perDay <= 0) return Infinity;
  return targetImun / perDay;
}

/**
 * Rasio antara nilai Imun yang diberikan per tayangan iklan dan pendapatan
 * iklan per tayangan. Di atas ~5x, faucet iklan mengkanibal tier termurah.
 */
export function adPayoutRatio(anchors, ecpmUsd, usdRp) {
  const revenuePerImpression = (ecpmUsd / 1000) * usdRp;
  const payout = anchors.adEconomy.imunPerAd * anchors.currency.imun.baseRateRp;
  return { revenuePerImpression, payout, ratio: payout / revenuePerImpression };
}
