/**
 * shop-screen.js — Toko ala reference: grid kartu pastel 3 kolom, badge harga
 * kuning di pojok kanan-atas, badge gembok di kanan-bawah untuk terkunci.
 */

import { STATE } from '../../core/state-manager.js';
import { requireAccount } from '../../systems/account-system.js';
import { getData } from '../../core/data-store.js';
import { addCurrency, purchaseShopItem, purchaseHeroUnlock } from '../../systems/economy-system.js';
import { isPurchasable } from '../../systems/unlock-system.js';
import { queueHeroNotice } from '../../systems/retention-system.js';
import { applySuplemen } from '../../systems/body-system.js';
import { writeSave } from '../../save/save-manager.js';
import { canWatchAd, trackAdWatch, triggerIAPSuplementPremium, triggerRewardedAdRecovery } from '../../systems/monetization.js';
import { getCatalog, createOrder, setMethod, payOrder, getMethods, getReceipts } from '../../systems/payment-system.js';
import { audio } from '../../systems/audio-system.js';
import { addImun, buyCosmetic, ownsCosmetic, equipSkin, equipAcc, applyReferralCode, ensureReferral, canSurveyToday, markSurveyDone } from '../../systems/imun-economy.js';
import { triggerRewardedAdOfferwall } from '../../systems/monetization.js';
import { getTintedSprite } from '../../render/sprite-loader.js';
import { emit } from '../../core/ui-bridge.js';
import { spriteToDataURL } from '../../render/sprite-loader.js';
import { el } from '../screen-manager.js';

const PASTEL = ['c-teal', 'c-green', 'c-coral'];

/**
 * Fase 14: modal sponsor simulasi — countdown 5 detik lalu grant.
 * Saat SDK ads nyata tersedia, ganti isi modal ini dengan pemutar iklan SDK.
 */
function openAdModal(onReward, title = 'VIDEO SPONSOR (SIMULASI)') {
  const modal = el('div', { class: 'pay-modal admodal' }, [
    el('div', { class: 'pay-box ad-box' }, [
      el('h3', { class: 'pay-title', text: title }),
      el('span', { class: 'pay-note', text: 'Durasi sponsor berjalan — hadiah otomatis masuk setelah selesai.' }),
      el('div', { class: 'ad-count', text: '5' }),
      el('button', { class: 'pay-cancel', text: 'Tutup (hadiah batal)' }),
    ]),
  ]);
  document.body.appendChild(modal);
  let left = 5;
  const countEl = modal.querySelector('.ad-count');
  const done = () => { modal.remove(); onReward(); };
  const cancel = modal.querySelector('.pay-cancel');
  cancel.addEventListener('click', () => modal.remove());
  const iv = setInterval(() => {
    left -= 1;
    if (left <= 0) { clearInterval(iv); done(); return; }
    countEl.textContent = String(left);
  }, 1000);
}

/** Modal pembayaran: ringkasan → pilih metode → bayar (simulasi) → receipt. */
function openPayment(bundle) {
  const orderRes = createOrder(bundle.id);
  if (!orderRes.ok) return;
  const order = orderRes.order;
  const modal = el('div', { class: 'pay-modal' }, [
    el('div', { class: 'pay-box' }, [
      el('h3', { class: 'pay-title', text: bundle.name }),
      el('span', { class: 'pay-note', text: 'Pembayaran SIMULASI — tidak ada tagihan nyata. Gateway siap disambungkan ke PSP.' }),
      el('div', { class: 'pay-summary' }, [
        el('span', { text: bundle.valueNote }),
        el('b', { class: 'pay-price', text: bundle.priceLabel }),
      ]),
      el('div', { class: 'pay-methods' }),
      el('button', { class: 'btn btn-primary pay-confirm', disabled: true, text: 'Pilih metode dulu' }),
      el('button', { class: 'pay-cancel', text: 'Batal' }),
    ]),
  ]);
  const methodsBox = modal.querySelector('.pay-methods');
  const METHOD_LABEL = { qris: 'QRIS', ewallet: 'E-Wallet', kartu: 'Kartu' };
  for (const m of getMethods()) {
    const chip = el('button', { class: 'pay-method', 'data-m': m, text: METHOD_LABEL[m] || m });
    chip.addEventListener('click', () => {
      setMethod(order.orderId, m);
      methodsBox.querySelectorAll('.pay-method').forEach((x) => x.classList.toggle('selected', x === chip));
      const confirm = modal.querySelector('.pay-confirm');
      confirm.disabled = false;
      confirm.textContent = `Bayar ${bundle.priceLabel} — ${(METHOD_LABEL[m] || m).toUpperCase()}`;
    });
    methodsBox.appendChild(chip);
  }
  modal.querySelector('.pay-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('.pay-confirm').addEventListener('click', async () => {
    const confirm = modal.querySelector('.pay-confirm');
    confirm.disabled = true;
    confirm.textContent = 'Memproses…';
    const res = await payOrder(order.orderId);
    if (!res.ok) {
      confirm.textContent = res.error;
      confirm.disabled = false;
      return;
    }
    const box = modal.querySelector('.pay-box');
    box.textContent = '';
    box.appendChild(el('img', { class: 'pay-ok-ico', src: 'assets/sprites/icon_star.png', alt: '' }));
    box.appendChild(el('h3', { class: 'pay-title', text: 'Pembayaran Berhasil!' }));
    box.appendChild(el('div', { class: 'pay-granted' }, res.granted.map((g) => el('span', { class: 'pg-item', text: g }))));
    box.appendChild(el('div', { class: 'pay-receipt', text: `Struk: ${res.receipt.receiptId} · ${res.receipt.method.toUpperCase()} · ${res.receipt.date}` }));
    box.appendChild(el('button', { class: 'btn btn-primary', text: 'Lanjut', onclick: () => { modal.remove(); show(); } }));
  });
  document.body.appendChild(modal);
}

export function show() {
  const meta = STATE.meta;
  document.getElementById('shop-currency').textContent = meta.currency.toLocaleString('id-ID');
  document.getElementById('shop-imun').textContent = (meta.imun || 0).toLocaleString('id-ID'); // Fase 14

  const wrap = document.getElementById('shop-sections');
  wrap.textContent = '';

  // ---------------- Section: buka hero ----------------
  // ---------------- Section: PAKET PREMIUM (bundle + gateway simulasi) ----------------
  const premSection = el('div', { class: 'shop-section' }, [el('h3', { text: 'PAKET PREMIUM' })]);
  const premGrid = el('div', { class: 'premium-grid' });
  for (const bundle of getCatalog()) {
    const owned = bundle.contents.noAds && meta.noAds;
    const card = el('div', { class: 'premium-card', style: `--pc:${bundle.color}` }, [
      bundle.badge ? el('span', { class: 'prem-badge', style: `background:${bundle.color}`, text: bundle.badge }) : null,
      el('b', { class: 'prem-name', text: bundle.name }),
      el('span', { class: 'prem-value', text: bundle.valueNote }),
      el('button', {
        class: 'btn btn-prem',
        text: owned ? '✓ DIMILIKI' : bundle.priceLabel,
        disabled: !!owned,
      }),
    ]);
    const buyBtn = card.querySelector('.btn-prem');
    if (!owned) {
      buyBtn.addEventListener('click', () => {
        if (!requireAccount('shop')) return; // pembelian wajib akun
        openPayment(bundle);
      });
    }
    premGrid.appendChild(card);
  }
  premSection.appendChild(premGrid);
  const receipts = getReceipts().slice(0, 3);
  if (receipts.length) {
    premSection.appendChild(el('div', { class: 'prem-receipts' }, [
      el('span', { class: 'pr-title', text: 'Riwayat pembelian (simulasi):' }),
      ...receipts.map((r) => el('span', { class: 'pr-row', text: `${r.date} · ${r.productName} · ${r.method.toUpperCase()} · ${r.receiptId}` })),
    ]));
  }
  wrap.appendChild(premSection);

  // ============ FASE 14: IMUN COIN GRATIS (offerwall untuk non-paying) ============
  const offers = getData().battlepass.offers;
  const freeSection = el('div', { class: 'shop-section' }, [el('h3', { text: 'DAPATKAN IMUN GRATIS' })]);
  const freeGrid = el('div', { class: 'free-grid' });

  const adTile = el('div', { class: 'free-tile' }, [
    el('b', { text: 'Tonton Video Sponsor' }),
    el('span', { text: `+${offers.adImun} Imun per tontonan (simulasi iklan reward)` }),
  ]);
  const adBtn = el('button', { class: 'btn btn-primary ft-btn', text: 'TONTON' });
  adBtn.addEventListener('click', () => {
    if (!canWatchAd(meta)) { emit('toast', { message: 'Kuota iklan harian sudah habis.', kind: 'coral' }); return; }
    openAdModal(() => {
      trackAdWatch(meta);
      addImun(meta, offers.adImun);
      writeSave(meta);
      audio.collect();
      emit('toast', { message: `+${offers.adImun} Imun Coin!`, kind: 'gold' });
      show();
    });
  });
  adTile.appendChild(adBtn);

  const svTile = el('div', { class: 'free-tile' }, [
    el('b', { text: 'Survei Sponsor' }),
    el('span', { text: `+${offers.surveyImun} Imun, 1× per hari (simulasi offerwall)` }),
  ]);
  const svBtn = el('button', { class: 'btn btn-primary ft-btn', text: canSurveyToday(meta) ? 'ISI' : '✓ SELESAI' });
  svBtn.disabled = !canSurveyToday(meta);
  svBtn.addEventListener('click', () => {
    openAdModal(() => {
      markSurveyDone(meta);
      addImun(meta, offers.surveyImun);
      writeSave(meta);
      audio.collect();
      emit('toast', { message: `Survei selesai: +${offers.surveyImun} Imun Coin!`, kind: 'gold' });
      show();
    }, 'SURVEI SPONSOR (SIMULASI)');
  });
  svTile.appendChild(svBtn);

  const ref = ensureReferral(meta);
  const rfTile = el('div', { class: 'free-tile wide' }, [
    el('b', { text: 'Ajak Teman' }),
    el('span', {}, [
      el('span', { text: `Kode kamu: ` }),
      el('b', { class: 'rf-code', text: ref.code }),
    ]),
    el('span', { text: `Teman memakai kodemu → kamu +${offers.referralImun} Imun. Masukkan kode teman:` }),
  ]);
  const rfRow = el('div', { class: 'rf-row' });
  const rfInput = el('input', { class: 'rf-input', placeholder: 'IMUN-XXXXX', maxlength: 12, 'aria-label': 'Kode referral teman' });
  const rfBtn = el('button', { class: 'btn btn-primary ft-btn', text: 'PAKAI' });
  rfBtn.addEventListener('click', () => {
    const res = applyReferralCode(meta, rfInput.value);
    if (res.ok) {
      audio.collect();
      emit('toast', { message: `Referral sukses: +${res.reward} Imun Coin!`, kind: 'gold' });
      show();
    } else {
      emit('toast', { message: res.error, kind: 'coral' });
    }
  });
  rfRow.appendChild(rfInput);
  rfRow.appendChild(rfBtn);
  rfTile.appendChild(rfRow);

  freeGrid.appendChild(adTile);
  freeGrid.appendChild(svTile);
  freeGrid.appendChild(rfTile);
  freeSection.appendChild(freeGrid);
  wrap.insertBefore(freeSection, wrap.firstChild);

  // ============ FASE 14: SKIN & GAYA (kosmetik Imun — tanpa pay-to-win) ============
  const cosCfg = getData().cosmetics;
  const skinSection = el('div', { class: 'shop-section' }, [el('h3', { text: 'SKIN & GAYA' })]);
  const skinGrid = el('div', { class: 'skin-grid' });
  const heroFor = (id) => getData().heroes.heroes.find((h) => h.id === id) || getData().heroes.heroes[0];
  for (const sk of cosCfg.skins) {
    const owned = ownsCosmetic(meta, sk.id);
    const equipped = meta.cosmetics?.skin?.[sk.hero] === sk.id;
    const preview = getTintedSprite(heroFor(sk.hero === 'semua' ? meta.selectedHero : sk.hero).spritePortrait || heroFor(meta.selectedHero).spriteIdle, sk.color);
    const card = el('div', { class: `skin-card${equipped ? ' on' : ''}` }, [
      el('img', { class: 'skin-preview', src: preview.toDataURL(), alt: sk.name }),
      el('b', { text: sk.name }),
      el('span', { class: 'skin-desc', text: sk.desc }),
      el('button', {
        class: 'btn ' + (equipped ? '' : 'btn-primary') + ' ft-btn',
        text: equipped ? '✓ DIPAKAI' : owned ? 'PAKAI' : `${sk.priceImun} IMU`,
        disabled: equipped,
      }),
    ]);
    card.querySelector('button').addEventListener('click', () => {
      if (!owned) {
        const res = buyCosmetic(meta, sk.id);
        if (!res.ok) { emit('toast', { message: res.error, kind: 'coral' }); return; }
        equipSkin(meta, sk.id, sk.hero);
        audio.collect();
        emit('toast', { message: `Skin "${sk.name}" dibeli & dipakai!`, kind: 'gold' });
      } else {
        equipSkin(meta, sk.id, sk.hero);
        audio.click();
        emit('toast', { message: `Skin "${sk.name}" dipakai.`, kind: 'gold' });
      }
      show();
    });
    skinGrid.appendChild(card);
  }
  for (const ac of cosCfg.accs) {
    const owned = ownsCosmetic(meta, ac.id);
    const equipped = ac.kind === 'crown' ? meta.cosmetics?.crown === ac.id : meta.cosmetics?.aura === ac.id;
    const card = el('div', { class: `skin-card${equipped ? ' on' : ''}` }, [
      el('img', { class: 'skin-preview acc', src: ac.kind === 'crown' ? 'assets/sprites/deco_chest.png' : 'assets/sprites/deco_aura.png', alt: ac.name }),
      el('b', { text: ac.name }),
      el('span', { class: 'skin-desc', text: ac.desc }),
      el('button', {
        class: 'btn ' + (equipped ? '' : 'btn-primary') + ' ft-btn',
        text: equipped ? '✓ LEPAS' : owned ? 'PAKAI' : `${ac.priceImun} IMU`,
      }),
    ]);
    card.querySelector('button').addEventListener('click', () => {
      if (!owned) {
        const res = buyCosmetic(meta, ac.id);
        if (!res.ok) { emit('toast', { message: res.error, kind: 'coral' }); return; }
        equipAcc(meta, ac.id);
        audio.collect();
        emit('toast', { message: `${ac.name} dibeli & dipakai!`, kind: 'gold' });
      } else {
        equipAcc(meta, ac.id);
        audio.click();
      }
      show();
    });
    skinGrid.appendChild(card);
  }
  skinSection.appendChild(skinGrid);
  wrap.insertBefore(skinSection, wrap.children[1] || null);

  const heroSection = el('div', { class: 'shop-section' }, [el('h3', { text: 'BUKA HERO' })]);
  const heroGrid = el('div', { class: 'shop-grid' });
  const heroes = getData().heroes.heroes;
  heroes.forEach((heroDef, i) => {
    const unlocked = meta.unlockedHeroes.includes(heroDef.id);
    const card = el('div', { class: `shop-card ${PASTEL[i % PASTEL.length]}` });
    // Badge kategori bulat kecil di pojok kiri-atas (ala mockup shop)
    const decoIcons = ['assets/sprites/item_glukosa.png', 'assets/sprites/item_antibodi.png', 'assets/sprites/item_vitamin_c.png'];
    card.appendChild(el('img', { class: 'corner-deco', src: decoIcons[i % decoIcons.length], alt: '' }));
    // Badge harga di pojok (untuk yang dijual & belum dimiliki)
    if (!unlocked && (heroDef.unlock?.imuCost || 0) > 0) {
      card.appendChild(el('div', { class: 'price-tag' }, [
        el('img', { class: 'inline-coin', src: 'assets/sprites/icon_imu.png', alt: 'Imun Coin' }),
        el('span', { text: String(heroDef.unlock.imuCost) }),
      ]));
    }
    card.appendChild(el('img', { class: 'shop-sprite', src: spriteToDataURL(heroDef.spriteIdle), alt: heroDef.name }));
    card.appendChild(el('b', { text: heroDef.name }));
    card.appendChild(el('div', { class: 's-desc', text: heroDef.description }));

    const uType = heroDef.unlock && heroDef.unlock.type;
    const imuCost = (heroDef.unlock && heroDef.unlock.imuCost) || 0;
    if (unlocked) {
      card.appendChild(el('div', { class: 's-owned', text: '✓ Dimiliki' }));
    } else if (uType === 'stat' || uType === 'default') {
      card.appendChild(el('div', { class: 's-owned', text: 'Buka via misi' }));
      card.appendChild(el('img', { class: 'lock-badge', src: 'assets/sprites/icon_lock.png', alt: 'terkunci' }));
    } else {
      const canBuy = uType === 'imu' || isPurchasable(meta, heroDef);
      card.appendChild(el('button', {
        class: 'btn btn-gold',
        text: canBuy ? 'BUKA DENGAN IMUN' : 'SYARAT MISI BELUM',
        disabled: !canBuy || (meta.imun || 0) < imuCost,
        onclick: () => {
          if (!requireAccount('shop')) return; // transaksi wajib akun
          const res = purchaseHeroUnlock(STATE.meta, heroDef); // logic + auto-save
          if (res.ok) { queueHeroNotice(heroDef.id); show(); }
        },
      }));
      card.appendChild(el('img', { class: 'lock-badge', src: 'assets/sprites/icon_lock.png', alt: 'terkunci' }));
    }
    heroGrid.appendChild(card);
  });
  heroSection.appendChild(heroGrid);
  wrap.appendChild(heroSection);

  // ---------------- Section: item ----------------
  const itemSection = el('div', { class: 'shop-section' }, [el('h3', { text: 'ITEM' })]);
  const itemGrid = el('div', { class: 'shop-grid' });
  const items = getData().upgrades.shopItems;
  items.forEach((def, i) => {
    const owned = meta.consumables[def.id] || 0;
    const card = el('div', { class: `shop-card ${PASTEL[(i + 2) % PASTEL.length]}` }, [
      el('div', { class: 'price-tag' }, [
        el('img', { class: 'inline-coin', src: 'assets/sprites/icon_coin.png', alt: '' }),
        el('span', { text: String(def.cost) }),
      ]),
      def.icon.startsWith('assets/')
        ? el('img', { class: 'shop-sprite', src: def.icon, alt: '' })
        : el('div', { class: 'icon-sprite', text: def.icon }),
      el('b', { text: def.name }),
      el('div', { class: 's-desc', text: def.desc }),
      el('div', { class: 's-owned', text: `Dimiliki: ${owned}` }),
      el('button', {
        class: 'btn btn-primary',
        text: 'BELI',
        disabled: meta.currency < def.cost,
        onclick: () => {
          if (!requireAccount('shop')) return; // transaksi wajib akun
          const res = purchaseShopItem(STATE.meta, def.id); // logic + auto-save
          if (res.ok) show();
        },
      }),
    ]);
    itemGrid.appendChild(card);
  });
  itemSection.appendChild(itemGrid);
  wrap.appendChild(itemSection);

  // ---------------- Section: SUPLEMEN SISTEM (meta-layer kondisi tubuh) ----------------
  const bodyCfg = getData().bodySystems;
  const supSection = el('div', { class: 'shop-section' }, [el('h3', { text: 'SUPLEMEN SISTEM TUBUH' })]);
  const supGrid = el('div', { class: 'shop-grid' });
  bodyCfg.systems.forEach((sysDef, i) => {
    const card = el('div', { class: `shop-card ${PASTEL[i % PASTEL.length]}` }, [
      el('div', { class: 'price-tag' }, [
        el('img', { class: 'inline-coin', src: 'assets/sprites/icon_coin.png', alt: '' }),
        el('span', { text: String(bodyCfg.suplemenCost) }),
      ]),
      el('img', { class: 'shop-sprite', src: sysDef.icon, alt: sysDef.name }),
      el('b', { text: `Suplemen ${sysDef.name}` }),
      el('div', { class: 's-desc', text: `+${bodyCfg.suplemenGain} kesehatan ${sysDef.name} — ${sysDef.role}.` }),
      el('button', {
        class: 'btn btn-primary',
        text: 'BELI',
        disabled: meta.currency < bodyCfg.suplemenCost,
        onclick: () => {
          if (meta.currency < bodyCfg.suplemenCost) return;
          addCurrency(meta, -bodyCfg.suplemenCost); // sink currency (logic asli)
          const res = applySuplemen(sysDef.id, meta);
          if (res) emit('toast', { message: `Suplemen diminum: ${sysDef.name} +${res.gained}!`, kind: 'gold' });
          show();
        },
      }),
    ]);
    supGrid.appendChild(card);
  });

  // Suplemen Premium via IAP simulasi (+20 SEMUA sistem, 1x/hari via kuota)
  const premiumCard = el('div', { class: 'shop-card c-gold' }, [
    el('img', { class: 'shop-sprite', src: 'assets/sprites/meter_energi.png', alt: '' }),
    el('b', { text: 'Suplemen Premium' }),
    el('div', { class: 's-desc', text: `+${bodyCfg.suplemenGain} SEMUA sistem sekaligus (pembelian simulasi).` }),
    el('button', {
      class: 'btn btn-gold',
      text: canWatchAd(meta) ? 'BELI (IAP SIMULASI)' : 'KUOTA HARIAN PENUH',
      disabled: !canWatchAd(meta),
      onclick: () => {
        if (!canWatchAd(meta)) return;
        triggerIAPSuplementPremium(() => {
          trackAdWatch(meta);
          for (const sysDef of bodyCfg.systems) applySuplemen(sysDef.id, meta);
          emit('toast', { message: 'Suplemen Premium: semua sistem pulih!', kind: 'gold' });
          show();
        });
      },
    }),
  ]);
  supGrid.appendChild(premiumCard);
  supSection.appendChild(supGrid);
  wrap.appendChild(supSection);
}

export function hide() {}
