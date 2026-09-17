/**
 * shop-screen.js — Modal SHOP (dibuka dari kartu atas dashboard).
 *
 * Isi diambil dari data NYATA, bukan dikarang:
 *  - Paket CADANGAN  → data/economy.json → iap.packs (lewat purchase-provider.js)
 *  - Iklan reward    → monetization.js → triggerRewardedAdAntibody()
 *
 * Semua pembelian memakai provider MOCK (tidak ada uang nyata, tidak ada
 * jaringan). Karena itu tombol Beli otomatis nonaktif bila `iapEnabled()`
 * false — tombol yang tidak bisa melakukan apa pun tidak boleh ditampilkan
 * seolah-olah hidup.
 */
import { STATE } from '../../core/state-manager.js';
import { addCurrency } from '../../systems/economy-system.js';
import { iapPacks, iapEnabled, buyReservePack } from '../../systems/purchase-provider.js';
import { adStatus, triggerRewardedAdAntibody } from '../../systems/monetization.js';
import { reserveBalance } from '../../systems/reserve-system.js';
import { writeSave } from '../../save/save-manager.js';
import { emit } from '../../core/ui-bridge.js';
import { screenManager } from '../screen-manager.js';
import { audio } from '../../systems/audio-system.js';

let bound = false;

const rp = (n) => Number(n || 0).toLocaleString('id-ID');

function renderPacks() {
  const meta = STATE.meta;
  const box = document.getElementById('shop-packs');
  if (!box) return;
  box.textContent = '';
  const packs = iapPacks();
  if (!packs.length) {
    const p = document.createElement('p');
    p.className = 'shop-sub';
    p.textContent = 'Tidak ada paket cadangan yang dijual saat ini.';
    box.appendChild(p);
    return;
  }
  for (const pk of packs) {
    const row = document.createElement('div');
    row.className = 'shop-pack';

    const info = document.createElement('div');
    const judul = document.createElement('b');
    judul.textContent = pk.label || pk.id;
    const sub = document.createElement('small');
    sub.textContent = `+${rp(pk.grant)} cadangan`;
    info.append(judul, sub);

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Beli';
    btn.disabled = !iapEnabled();
    btn.addEventListener('click', async () => {
      audio.ui();
      btn.disabled = true;
      btn.textContent = 'Memproses…';
      let hasil;
      try {
        hasil = await buyReservePack(meta, pk.id);
      } catch (e) {
        hasil = { ok: false, reason: 'error' };
      }
      btn.disabled = !iapEnabled();
      btn.textContent = 'Beli';
      if (hasil && hasil.ok) {
        emit('toast', { message: `+${rp(hasil.granted)} cadangan`, kind: 'gold' });
      } else {
        emit('toast', { message: 'Pembelian gagal (' + ((hasil && hasil.reason) || '?') + ')', kind: 'warn' });
      }
      refresh();
    });

    row.append(info, btn);
    box.appendChild(row);
  }
}

/** Segarkan angka cadangan + daftar paket. */
export function refresh() {
  const meta = STATE.meta;
  const r = document.getElementById('shop-reserve');
  if (r) r.textContent = `Cadangan: ${rp(reserveBalance(meta))}`;
  renderPacks();
}

export function show() {
  refresh();
  bindOnce();
}

export function hide() {}

function bindOnce() {
  if (bound) return;
  bound = true;
  document.getElementById('btn-shop-close')?.addEventListener('click', () => {
    audio.ui();
    screenManager.show('dashboard');
  });
  document.getElementById('btn-shop-ad')?.addEventListener('click', () => {
    const meta = STATE.meta;
    const st = adStatus(meta);
    if (!st.canWatch) {
      emit('toast', { message: 'Iklan belum tersedia — coba lagi nanti', kind: 'warn' });
      return;
    }
    audio.ui();
    triggerRewardedAdAntibody(
      meta,
      () => {
        addCurrency(meta, st.reward || 0);
        writeSave(meta);
        emit('toast', { message: `+${rp(st.reward)} Antibodi`, kind: 'gold' });
        const cur = document.getElementById('dash-currency');
        if (cur) cur.textContent = rp(meta.currency);
        const lv = document.getElementById('shop-reserve');
        if (lv) lv.textContent = `Cadangan: ${rp(reserveBalance(meta))}`;
      },
      () => emit('toast', { message: 'Iklan dibatalkan', kind: 'warn' }),
    );
  });
}
