import { STATE } from '../../core/state-manager.js';
import { getSession, getFactionDef, logout } from '../../systems/account-system.js';
import { screenManager } from '../screen-manager.js';
import { music } from '../../systems/music-system.js';
import { audio } from '../../systems/audio-system.js';
import { clearSave, writeSave } from '../../save/save-manager.js';
import { createDefaultMeta } from '../../core/state-manager.js';

export function show() {
  const meta = STATE.meta;
  const session = getSession();
  const hero = document.getElementById('profile-avatar');
  const name = document.getElementById('profile-name');
  const faction = document.getElementById('profile-faction');
  const def = getFactionDef(session?.faction || 'imun');
  name.textContent = session?.username || 'Penjaga Imun';
  faction.textContent = def.name;
  faction.style.background = def.color;
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

  document.getElementById('btn-profile-logout').onclick = () => {
    logout();
    music.stop();
    screenManager.show('auth');
  };
}

export function hide() {}
