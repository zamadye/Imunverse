import { STATE } from '../../core/state-manager.js';
import { getSession, logout } from '../../systems/account-system.js';
import { screenManager } from '../screen-manager.js';
import { music } from '../../systems/music-system.js';
import { audio } from '../../systems/audio-system.js';
import { clearSave, writeSave } from '../../save/save-manager.js';
import { createDefaultMeta } from '../../core/state-manager.js';
import { myCode, myReferralLink, pendingRewards, claimPending } from '../../systems/referral-system.js'; // ADDENDUM P2 §3.4
import { copyText } from '../../systems/challenge-system.js';
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

  // ADDENDUM P2 §3.4 — referral dua arah (kode + link + klaim)
  try {
    document.getElementById('profile-refcode').textContent = myCode(meta);
    const btnClaim = document.getElementById('btn-ref-claim');
    const refreshClaim = () => {
      const p = pendingRewards(meta);
      btnClaim.textContent = `KLAIM (${p.hits + p.milestones})`;
    };
    refreshClaim();
    document.getElementById('btn-ref-link').onclick = async () => {
      const ok = await copyText(myReferralLink(meta));
      emit('toast', { message: ok ? 'Link undangan tersalin! 💌' : 'Gagal menyalin link.', kind: ok ? 'gold' : 'warn' });
    };
    btnClaim.onclick = () => {
      const r = claimPending(meta);
      if (r.total > 0) {
        audio.collect();
        emit('toast', { message: `Klaim referral: +${r.total} Biokredit! 🎉`, kind: 'gold' });
        document.getElementById('profile-currency').textContent = (meta.currency || 0).toLocaleString('id-ID');
        refreshClaim();
      } else {
        emit('toast', { message: 'Belum ada hadiah referral.', kind: 'warn' });
      }
    };
  } catch { /* abaikan */ }

  document.getElementById('btn-profile-logout').onclick = () => {
    logout();
    music.stop();
    screenManager.show('auth');
  };
}

export function hide() {}
