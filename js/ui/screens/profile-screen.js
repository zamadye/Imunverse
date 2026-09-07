import { STATE } from '../../core/state-manager.js';
import { getSession, getFactionDef, logout } from '../../systems/account-system.js';
import { screenManager } from '../screen-manager.js';

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
  document.getElementById('btn-profile-logout').onclick = () => {
    logout();
    screenManager.show('auth');
  };
}

export function hide() {}
