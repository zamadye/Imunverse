import { STATE } from '../../core/state-manager.js';
import { getSession, logout } from '../../systems/account-system.js';
import { screenManager } from '../screen-manager.js';
import { music } from '../../systems/music-system.js';
import { audio } from '../../systems/audio-system.js';
import { clearSave, writeSave } from '../../save/save-manager.js';
import { createDefaultMeta } from '../../core/state-manager.js';
import { dripStatus, claimDrip } from '../../systems/imun-economy.js'; // §7.3: Kartu Imun di profil
import { emit } from '../../core/ui-bridge.js';

export function show() {
  const meta = STATE.meta;
  const session = getSession();
  const hero = document.getElementById('profile-avatar');
  const name = document.getElementById('profile-name');
  name.textContent = session?.username || 'Penjaga Imun';
  document.getElementById('profile-currency').textContent = (meta.currency || 0).toLocaleString('id-ID');
  document.getElementById('profile-imun').textContent = (meta.imun || 0).toLocaleString('id-ID');
  const selected = (meta.stats && meta.stats.totalRuns) || 0;
  const best = (meta.stats && meta.stats.bestWave) || 0;
  document.getElementById('profile-stats').innerHTML = `
    <span><b>${selected}</b><small>Run</small></span>
    <span><b>${best}</b><small>Best Wave</small></span>
    <span><b>${(meta.stats?.totalKills || 0).toLocaleString('id-ID')}</b><small>Patogen</small></span>`;
  if (hero && window.__IMUNVERSE_getHeroPortrait) hero.src = window.__IMUNVERSE_getHeroPortrait();

  // §7.3: sisa hari Kartu Imun 30 Hari juga tampil di profil (bukan hanya di Toko).
  const cardLine = document.getElementById('profile-card-line');
  if (cardLine) {
    const drip = dripStatus(meta);
    if (drip && drip.active) {
      cardLine.classList.remove('hidden');
      cardLine.textContent = `Kartu Imun: hari ${drip.dayNumber}/${drip.days} · sisa ${drip.daysLeft} hari`;
      if (drip.claimedToday) {
        cardLine.append(' · ✓ jatah hari ini sudah diklaim');
      } else {
        const b = document.createElement('button');
        b.className = 'btn btn-gold btn-sm';
        b.textContent = `Klaim ${drip.imunPerDay} Imun`;
        b.onclick = () => {
          const res = claimDrip(meta);
          if (res.ok) {
            audio.collect();
            emit('toast', { message: `Kartu Imun hari ${res.dayNumber}/${drip.days}: +${res.imun} Imun!`, kind: 'gold' });
            show();
          } else {
            emit('toast', { message: res.error, kind: 'coral' });
          }
        };
        cardLine.append(b);
      }
    } else {
      cardLine.classList.add('hidden');
      cardLine.textContent = '';
    }
  }

  // F23: Pengaturan suara (letak umum: di dalam Profil, bukan tersebar di UI)
  const btnMusic = document.getElementById('btn-profile-music');
  const btnSfx = document.getElementById('btn-profile-sfx');
  const refresh = () => {
    btnMusic.textContent = music.on ? 'AKTIF' : 'MATI';
    btnSfx.textContent = audio.muted ? 'MATI' : 'AKTIF';
  };
  refresh();
  btnMusic.onclick = () => {
    music.setOn(!music.on);
    audio.ui();
    refresh();
  };
  btnSfx.onclick = () => {
    audio.toggleMute();
    refresh();
  };

  // Fase 2.1: toggle Serang Otomatis (default NYALA; tersimpan di meta.settings).
  // Aim manual / tahan tombol SERANG tetap menang saat pemain mengambil alih.
  const btnAuto = document.getElementById('btn-profile-autofire');
  if (btnAuto) {
    const autoOn = () => (meta.settings ? meta.settings.autoFire !== false : true);
    const refreshAuto = () => { btnAuto.textContent = autoOn() ? 'AKTIF' : 'MATI'; };
    refreshAuto();
    btnAuto.onclick = () => {
      meta.settings = Object.assign({ autoFire: true }, meta.settings || {});
      meta.settings.autoFire = !autoOn();
      writeSave(meta);
      audio.ui();
      refreshAuto();
    };
  }

  // Reset save (dipindah dari footer dashboard yang dihapus desain gameplay-first)
  document.getElementById('btn-profile-reset').onclick = () => {
    if (window.confirm('Hapus seluruh progress (antibodi, unlock, upgrade)?')) {
      music.stop();
      clearSave();
      STATE.meta = createDefaultMeta();
      writeSave(STATE.meta);
      logout();
      screenManager.show('auth');
    }
  };

  document.getElementById('btn-profile-logout').onclick = () => {
    logout();
    music.stop();
    screenManager.show('auth');
  };
}

export function hide() {}
