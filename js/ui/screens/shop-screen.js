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
import { iconEl, roleIconSrc, roleTint, namedIconEl } from '../menu-icons.js';

const PASTEL = ['c-teal', 'c-green', 'c-coral'];

/**
 * UI/UX work order #3 — Bagian toko dalam URUTAN keputusan pemain (bekal run dulu,
 * monetisasi belakangan) + ikon bagian bespoke (assets/icons/sec-*.svg).
 * Chip-nav di atas menggulung ke bagian; bagian aktif disorot saat scroll.
 */
const SECTIONS = [
  { id: 'item', label: 'Item', icon: 'assets/icons/sec-item.svg', title: 'BEKAL RUN' },
  { id: 'hero', label: 'Hero', icon: 'assets/icons/menu-heroes.svg', title: 'BUKA HERO' },
  { id: 'skin', label: 'Skin', icon: 'assets/icons/sec-skin.svg', title: 'SKIN & GAYA' },
  { id: 'sup', label: 'Suplemen', icon: 'assets/icons/sec-suplemen.svg', title: 'SUPLEMEN SISTEM TUBUH' },
  { id: 'free', label: 'Gratis', icon: 'assets/icons/sec-gratis.svg', title: 'DAPATKAN IMUN GRATIS' },
  { id: 'prem', label: 'Premium', icon: 'assets/icons/sec-premium.svg', title: 'PAKET PREMIUM' },
];

/** Kepala bagian: ikon bespoke + judul + keterangan singkat (satu pola untuk semua bagian). */
function sectionEl(id, sub) {
  const def = SECTIONS.find((x) => x.id === id);
  const sec = el('section', { class: 'shop-section', id: `shop-sec-${id}`, 'data-sec': id });
  sec.appendChild(el('div', { class: 'ss-head' }, [
    el('img', { class: 'ss-ico', src: def.icon, alt: '' }),
    el('div', { class: 'ss-text' }, [
      el('h3', { text: def.title }),
      sub ? el('span', { class: 'ss-sub', text: sub }) : null,
    ]),
  ]));
  return sec;
}

/** Label harga dengan ikon mata uang (antibodi / Imun Coin) — dipakai di price-tag & tombol. */
function priceEl(amount, cur = 'antibodi', cls = '') {
  return el('span', { class: `price ${cls}`.trim() }, [
    el('img', { class: 'inline-coin', src: cur === 'imun' ? 'assets/icons/cur-imun.svg' : 'assets/icons/cur-antibodi.svg', alt: cur === 'imun' ? 'Imun Coin' : 'Antibodi' }),
    el('span', { text: typeof amount === 'number' ? amount.toLocaleString('id-ID') : String(amount) }),
  ]);
}

let navObserver = null;
/** Chip-nav bagian (scroll-spy sederhana): klik → gulung; bagian di viewport → chip aktif. */
function buildNav(wrap) {
  const nav = document.getElementById('shop-nav');
  if (!nav) return;
  nav.textContent = '';
  for (const def of SECTIONS) {
    const chip = el('button', { class: 'shop-chip', 'data-sec': def.id, type: 'button' }, [
      el('img', { src: def.icon, alt: '' }),
      el('span', { text: def.label }),
    ]);
    chip.addEventListener('click', () => {
      audio.click();
      document.getElementById(`shop-sec-${def.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nav.querySelectorAll('.shop-chip').forEach((c) => c.classList.toggle('active', c === chip));
    });
    nav.appendChild(chip);
  }
  nav.querySelector('.shop-chip')?.classList.add('active');
  if (navObserver) navObserver.disconnect();
  if (typeof IntersectionObserver !== 'undefined') {
    navObserver = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!vis) return;
      nav.querySelectorAll('.shop-chip').forEach((c) => c.classList.toggle('active', c.dataset.sec === vis.target.dataset.sec));
    }, { root: document.getElementById('screen-shop'), rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    wrap.querySelectorAll('.shop-section').forEach((sec) => navObserver.observe(sec));
  }
}

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
  let iv = null;
  const done = () => { if (iv) { clearInterval(iv); iv = null; } modal.remove(); onReward(); };
  const cancel = modal.querySelector('.pay-cancel');
  // fix T1 (audit 2026-09-13): cancel harus membatalkan interval — sebelumnya
  // countdown tetap jalan dan 5 dtk kemudian onReward() tetap terpanggil
  // (hadiah masuk walau "hadiah batal"; survei juga menghanguskan jatah 1×/hari).
  cancel.addEventListener('click', () => { if (iv) { clearInterval(iv); iv = null; } modal.remove(); });
  iv = setInterval(() => {
    left -= 1;
    if (left <= 0) { done(); return; }
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
    box.appendChild(el('img', { class: 'pay-ok-ico', src: 'assets/icons/ui-star.svg', alt: '' }));
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
  const heroes = getData().heroes.heroes;
  const tiers = getData().heroes.tiers || {};

  // ============ 1) BEKAL RUN (item consumable — Antibodi) ============
  const itemSection = sectionEl('item', 'Bekal sekali pakai — otomatis aktif di run berikutnya.');
  const itemGrid = el('div', { class: 'shop-grid' });
  getData().upgrades.shopItems.forEach((def, i) => {
    const owned = meta.consumables[def.id] || 0;
    const card = el('div', { class: `shop-card ${PASTEL[i % PASTEL.length]}` }, [
      el('div', { class: 'price-tag' }, [priceEl(def.cost)]),
      iconEl(def, 'shop-ico'),
      el('b', { text: def.name }),
      el('div', { class: 's-desc', text: def.desc }),
      el('div', { class: 's-owned' + (owned ? ' has' : ''), text: `Dimiliki: ${owned}` }),
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

  // ============ 2) BUKA HERO (Imun Coin / misi) ============
  const openCount = heroes.filter((h) => meta.unlockedHeroes.includes(h.id)).length;
  const heroSection = sectionEl('hero', `${openCount}/${heroes.length} hero dimiliki — jalur Imun Coin bisa dibuka di sini, jalur misi lewat progres run.`);
  const heroGrid = el('div', { class: 'shop-grid' });
  heroes.forEach((heroDef, i) => {
    const unlocked = meta.unlockedHeroes.includes(heroDef.id);
    const tierCfg = tiers[heroDef.tier];
    const card = el('div', { class: `shop-card hero ${PASTEL[i % PASTEL.length]}${unlocked ? ' owned' : ''}` });
    // Peran (Tank/Damage/Support) = badge kiri-atas; tier = pill kanan-bawah (bahasa sama dengan roster)
    const roleSrc = roleIconSrc(heroDef.role);
    if (roleSrc) card.appendChild(el('img', { class: 'role-badge', src: roleSrc, alt: heroDef.role, title: heroDef.role, style: `--role:${roleTint(heroDef.role)}` }));
    if (!unlocked && (heroDef.unlock?.imuCost || 0) > 0) {
      card.appendChild(el('div', { class: 'price-tag imu' }, [priceEl(heroDef.unlock.imuCost, 'imun')]));
    }
    card.appendChild(el('img', { class: 'shop-sprite', src: spriteToDataURL(heroDef.spriteIdle), alt: heroDef.name }));
    card.appendChild(el('b', { text: heroDef.name }));
    if (tierCfg) card.appendChild(el('span', { class: 'tier-pill', style: `background:${tierCfg.color}`, text: tierCfg.label }));
    card.appendChild(el('div', { class: 's-desc', text: heroDef.description }));

    const uType = heroDef.unlock && heroDef.unlock.type;
    const imuCost = (heroDef.unlock && heroDef.unlock.imuCost) || 0;
    if (unlocked) {
      card.appendChild(el('div', { class: 's-owned has', text: '✓ Dimiliki' }));
    } else if (uType === 'stat' || uType === 'default') {
      card.appendChild(el('div', { class: 's-owned', text: 'Buka via misi' }));
      card.appendChild(el('img', { class: 'lock-badge', src: 'assets/icons/ui-lock.svg', alt: 'terkunci' }));
    } else {
      const canBuy = uType === 'imu' || isPurchasable(meta, heroDef);
      card.appendChild(el('button', {
        class: 'btn btn-gold',
        text: canBuy ? 'BUKA' : 'SYARAT MISI BELUM',
        disabled: !canBuy || (meta.imun || 0) < imuCost,
        onclick: () => {
          if (!requireAccount('shop')) return; // transaksi wajib akun
          const res = purchaseHeroUnlock(STATE.meta, heroDef); // logic + auto-save
          if (res.ok) { queueHeroNotice(heroDef.id); show(); }
        },
      }));
      card.appendChild(el('img', { class: 'lock-badge', src: 'assets/icons/ui-lock.svg', alt: 'terkunci' }));
    }
    heroGrid.appendChild(card);
  });
  heroSection.appendChild(heroGrid);
  wrap.appendChild(heroSection);

  // ============ 3) SKIN & GAYA (kosmetik Imun — tanpa pay-to-win) ============
  const cosCfg = getData().cosmetics;
  const skinSection = sectionEl('skin', 'Warna & aksesori visual saja — tidak menambah kekuatan.');
  const skinGrid = el('div', { class: 'skin-grid' });
  const heroFor = (id) => heroes.find((h) => h.id === id) || heroes[0];
  for (const sk of cosCfg.skins) {
    const owned = ownsCosmetic(meta, sk.id);
    const equipped = meta.cosmetics?.skin?.[sk.hero] === sk.id;
    const preview = getTintedSprite(heroFor(sk.hero === 'semua' ? meta.selectedHero : sk.hero).spritePortrait || heroFor(meta.selectedHero).spriteIdle, sk.color);
    const card = el('div', { class: `skin-card${equipped ? ' on' : ''}`, style: `--swatch:${sk.color}` }, [
      el('span', { class: 'skin-swatch', 'aria-hidden': 'true' }),
      el('img', { class: 'skin-preview', src: preview.toDataURL(), alt: sk.name }),
      el('b', { text: sk.name }),
      el('span', { class: 'skin-desc', text: sk.desc }),
    ]);
    const btn = el('button', { class: 'btn ' + (equipped ? '' : 'btn-primary') + ' ft-btn', disabled: equipped });
    if (equipped) btn.textContent = '✓ DIPAKAI';
    else if (owned) btn.textContent = 'PAKAI';
    else if (sk.priceImun > 0) btn.appendChild(priceEl(sk.priceImun, 'imun'));
    else btn.textContent = 'GRATIS';
    card.appendChild(btn);
    btn.addEventListener('click', () => {
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
    const card = el('div', { class: `skin-card acc${equipped ? ' on' : ''}` }, [
      el('span', { class: 'skin-preview acc-ico' }, [
        el('img', { src: ac.kind === 'crown' ? 'assets/icons/sec-premium.svg' : 'assets/icons/ui-star.svg', alt: ac.name }),
      ]),
      el('b', { text: ac.name }),
      el('span', { class: 'skin-desc', text: ac.desc }),
    ]);
    const btn = el('button', { class: 'btn ' + (equipped ? '' : 'btn-primary') + ' ft-btn' });
    if (equipped) btn.textContent = '✓ LEPAS';
    else if (owned) btn.textContent = 'PAKAI';
    else btn.appendChild(priceEl(ac.priceImun, 'imun'));
    card.appendChild(btn);
    btn.addEventListener('click', () => {
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
  wrap.appendChild(skinSection);

  // ============ 4) SUPLEMEN SISTEM TUBUH (meta-layer kondisi tubuh) ============
  const bodyCfg = getData().bodySystems;
  const supSection = sectionEl('sup', `+${bodyCfg.suplemenGain} kesehatan sistem per suplemen — kondisi tubuh memengaruhi bonus run.`);
  const supGrid = el('div', { class: 'shop-grid' });
  bodyCfg.systems.forEach((sysDef, i) => {
    const card = el('div', { class: `shop-card ${PASTEL[i % PASTEL.length]}` }, [
      el('div', { class: 'price-tag' }, [priceEl(bodyCfg.suplemenCost)]),
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
    namedIconEl('vitality', 'shop-ico'),
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

  // ============ 5) BONUS ANTIBODI (offerwall utk non-paying) ============
  // RONDE-4: ini SOFT currency. Imun Coin premium hanya dari bundle di atas
  // & reward Battle Pass — tidak dari video/survei/referral.
  const offers = getData().battlepass.offers;
  const freeSection = sectionEl('free', 'Bonus Antibodi: tonton sponsor, isi survei, atau ajak teman. Imun Coin (premium) tersedia lewat pembelian & musim Battle Pass.');
  const freeGrid = el('div', { class: 'free-grid' });

  const adTile = el('div', { class: 'free-tile' }, [
    el('div', { class: 'ft-head' }, [
      el('img', { class: 'ft-ico', src: 'assets/icons/menu-quest.svg', alt: '' }),
      el('b', { text: 'Tonton Video Sponsor' }),
    ]),
    el('span', { text: `+${offers.adAntibodi} Antibodi per tontonan (simulasi iklan reward)` }),
  ]);
  const adBtn = el('button', { class: 'btn btn-primary ft-btn', text: 'TONTON' });
  adBtn.addEventListener('click', () => {
    if (!canWatchAd(meta)) { emit('toast', { message: 'Kuota iklan harian sudah habis.', kind: 'coral' }); return; }
    openAdModal(() => {
      trackAdWatch(meta);
      addCurrency(meta, offers.adAntibodi);
      writeSave(meta);
      audio.collect();
      emit('toast', { message: `+${offers.adAntibodi} Antibodi!`, kind: 'gold' });
      show();
    });
  });
  adTile.appendChild(adBtn);

  const svTile = el('div', { class: 'free-tile' }, [
    el('div', { class: 'ft-head' }, [
      el('img', { class: 'ft-ico', src: 'assets/icons/menu-codex.svg', alt: '' }),
      el('b', { text: 'Survei Sponsor' }),
    ]),
    el('span', { text: `+${offers.surveyAntibodi} Antibodi, 1× per hari (simulasi offerwall)` }),
  ]);
  const svBtn = el('button', { class: 'btn btn-primary ft-btn', text: canSurveyToday(meta) ? 'ISI' : '✓ SELESAI' });
  svBtn.disabled = !canSurveyToday(meta);
  svBtn.addEventListener('click', () => {
    openAdModal(() => {
      markSurveyDone(meta);
      addCurrency(meta, offers.surveyAntibodi);
      writeSave(meta);
      audio.collect();
      emit('toast', { message: `Survei selesai: +${offers.surveyAntibodi} Antibodi!`, kind: 'gold' });
      show();
    }, 'SURVEI SPONSOR (SIMULASI)');
  });
  svTile.appendChild(svBtn);

  const ref = ensureReferral(meta);
  const rfTile = el('div', { class: 'free-tile wide' }, [
    el('div', { class: 'ft-head' }, [
      el('img', { class: 'ft-ico', src: 'assets/icons/menu-heroes.svg', alt: '' }),
      el('b', { text: 'Ajak Teman' }),
    ]),
    el('span', {}, [
      el('span', { text: `Kode kamu: ` }),
      el('b', { class: 'rf-code', text: ref.code }),
    ]),
    el('span', { text: `Teman memakai kodemu → kamu +${offers.referralAntibodi} Antibodi. Masukkan kode teman:` }),
  ]);
  const rfRow = el('div', { class: 'rf-row' });
  const rfInput = el('input', { class: 'rf-input', placeholder: 'IMUN-XXXXX', maxlength: 12, 'aria-label': 'Kode referral teman' });
  const rfBtn = el('button', { class: 'btn btn-primary ft-btn', text: 'PAKAI' });
  rfBtn.addEventListener('click', () => {
    const res = applyReferralCode(meta, rfInput.value);
    if (res.ok) {
      audio.collect();
      emit('toast', { message: `Referral sukses: +${res.reward} Antibodi!`, kind: 'gold' });
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
  wrap.appendChild(freeSection);

  // ============ 6) PAKET PREMIUM (bundle + gateway simulasi) ============
  const premSection = sectionEl('prem', 'Uang sungguhan (simulasi gateway) — mendukung pengembang, tanpa pay-to-win.');
  const premGrid = el('div', { class: 'premium-grid' });
  for (const bundle of getCatalog()) {
    const owned = bundle.contents.noAds && meta.noAds;
    const card = el('div', { class: 'premium-card', style: `--pc:${bundle.color}` }, [
      bundle.badge ? el('span', { class: 'prem-badge', text: bundle.badge }) : null,
      el('img', { class: 'prem-ico', src: 'assets/icons/sec-premium.svg', alt: '' }),
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

  buildNav(wrap);
}

export function hide() {
  if (navObserver) { navObserver.disconnect(); navObserver = null; }
}
