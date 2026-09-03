/**
 * hud-screen.js — Gameplay HUD (overlay pasif di atas canvas):
 * HP, XP bar, wave counter, timer, kill, currency run, boss bar, minimap.
 * Murni "view adapter" — tidak mengimpor core/game (dipakai oleh game.js).
 * Tombol pause di-wire oleh main.js agar modul ini bebas dependensi balik.
 */

let minimapCtx = null;
let announceTimer = null;

export function show() {}

export function hide() {
  clearAnnounce();
}

/** Reset elemen HUD di awal run (dipanggil via event runstart). */
export function resetHUD() {
  setBar('hud-hp-fill', 1);
  setBar('hud-xp-fill', 0);
  document.getElementById('hud-kills').textContent = '0';
  document.getElementById('hud-currency').textContent = '0';
  document.getElementById('hud-timer').textContent = '00:00';
  document.getElementById('hud-boss-bar-wrap').classList.add('hidden');

  // Portrait hero: main.js mendaftarkan getter ini setelah sprite termuat
  const portrait = document.getElementById('hud-portrait');
  const getter = window.__IMUNVERSE_getHeroPortrait;
  if (portrait && getter) portrait.src = getter();
}

/** Update HUD tiap frame (dipanggil dari game.render). */
export function updateHUD(data) {
  setBar('hud-hp-fill', data.hpPct);
  document.getElementById('hud-hp-text').textContent = data.hpText;
  setBar('hud-xp-fill', Math.max(0, Math.min(1, data.xpPct)));
  document.getElementById('hud-wave').textContent = `GELOMBANG ${data.wave} · LV ${data.level}`;
  document.getElementById('hud-timer').textContent = data.timerText;
  document.getElementById('hud-kills').textContent = data.kills;
  document.getElementById('hud-currency').textContent = data.currency;

  const bossWrap = document.getElementById('hud-boss-bar-wrap');
  if (data.boss) {
    bossWrap.classList.remove('hidden');
    setBar('hud-boss-fill', Math.max(0, Math.min(1, data.boss.pct)));
    document.getElementById('hud-boss-name').textContent = data.boss.name.toUpperCase();
  } else {
    bossWrap.classList.add('hidden');
  }
}

function setBar(id, pct) {
  const node = document.getElementById(id);
  if (node) node.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
}

/** Banner pengumuman wave / boss. */
export function showAnnounce(text, isBoss = false) {
  const node = document.getElementById('hud-announce');
  if (!node) return;
  clearAnnounce();
  node.textContent = text;
  node.className = 'hud-announce' + (isBoss ? ' boss' : '');
  // restart CSS animation
  node.style.animation = 'none';
  void node.offsetWidth;
  node.style.animation = '';
  announceTimer = setTimeout(() => {
    node.classList.add('hidden');
  }, 1900);
}

function clearAnnounce() {
  const node = document.getElementById('hud-announce');
  if (node) node.classList.add('hidden');
  if (announceTimer) {
    clearTimeout(announceTimer);
    announceTimer = null;
  }
}

/** Konteks canvas minimap untuk digambar game (shape-renderer.drawMinimap). */
export function getMinimapContext() {
  if (!minimapCtx) {
    const canvas = document.getElementById('hud-minimap');
    if (!canvas) return null;
    minimapCtx = canvas.getContext('2d');
  }
  return minimapCtx;
}
