/**
 * game-feel.js — P6: SUTRADARA DAMPAK (PHAGOS_V2_REBUILD.txt §20, §18–§19).
 *
 * §20: setiap serangan butuh kombinasi
 *
 *      ANIMATION + VFX + SFX + ENEMY REACTION + CAMERA RESPONSE
 *
 * dan TIDAK semua butuh screen shake. Karena itu semua dampak dilewatkan
 * satu tangga (ladder) yang seluruhnya ada di data/gamefeel.json → `tiers`:
 *
 *      normal → heavy → elite → ultimate → bossEvent
 *      (minimal)  (micro shake)  (reaksi kuat)  (mayor)  (sinematik)
 *
 * Modul ini juga memegang PENGENDALI KERAMAIAN (`crowd`): saat layar padat,
 * partikel/getar/angka/SFX mengecil supaya "layar tidak kacau saat ramai"
 * tanpa kehilangan keterbacaan hit reaction.
 *
 * Nol angka di sini — semua dari data/gamefeel.json.
 */

import { getGameFeel } from '../core/data-store.js';
import { audio } from './audio-system.js';

/** Urutan tangga dampak (dipakai penguji & dokumentasi). */
export const TIER_ORDER = ['normal', 'heavy', 'elite', 'ultimate', 'bossEvent'];

export function gfCfg() {
  try { return getGameFeel() || {}; } catch { return {}; }
}

/** Satu tingkat tangga dampak. */
export function gfTier(name) {
  const t = (gfCfg().tiers || {})[name];
  return t || (gfCfg().tiers || {}).normal || {};
}

/**
 * Tentukan tingkat dampak dari sebuah peristiwa.
 * @param {{crit?:boolean, isElite?:boolean, isBoss?:boolean,
 *          kind?:'hit'|'kill'|'blast'|'spawn', source?:string}} e
 */
export function tierForEvent(e = {}) {
  if (e.isBoss) return 'bossEvent';
  if (e.source === 'pulse' || e.source === 'ult') return 'ultimate';
  if (e.isElite) return 'elite';
  if (e.crit) return 'heavy';
  return 'normal';
}

/** Jumlah musuh hidup (dipakai pengali keramaian). */
export function enemyCount(run) {
  let n = 0;
  const arr = run && run.enemies;
  if (arr) for (let i = 0; i < arr.length; i++) if (arr[i] && arr[i].alive) n++;
  return n;
}

/**
 * Pengali keramaian: 1 saat sepi, mengecil ke `particleScale`/`shakeScale`
 * saat jumlah musuh mencapai `busyEnemyCount`.
 * @returns {{busy:boolean, t:number, particles:number, shake:number, count:number}}
 */
export function crowdScale(run) {
  const c = gfCfg().crowd || {};
  const n = enemyCount(run);
  const calm = Math.max(1, c.calmEnemyCount ?? 8);
  const busy = Math.max(calm + 1, c.busyEnemyCount ?? 26);
  const t = Math.max(0, Math.min(1, (n - calm) / (busy - calm)));
  const lerp = (to) => 1 - (1 - (typeof to === 'number' ? to : 1)) * t;
  return { busy: t > 0.5, t, particles: lerp(c.particleScale), shake: lerp(c.shakeScale), count: n };
}

/** Status internal per run (token angka + jeda SFX). */
function gfState(run) {
  if (!run) return {};
  if (!run._gameFeel) {
    const c = gfCfg().crowd || {};
    run._gameFeel = {
      numberTokens: c.numbersMax || 18,
      labelTokens: c.labelsMax || 10,
      sfx: {},
    };
  }
  return run._gameFeel;
}

/** Isi ulang token angka damage tiap frame (token bucket). */
export function updateGameFeel(run, dt) {
  const st = gfState(run);
  const c = gfCfg().crowd || {};
  const cap = Math.max(1, c.numbersMax || 18);
  st.numberTokens = Math.min(cap, (st.numberTokens || 0) + (c.numbersPerSec || cap) * Math.max(0, dt || 0));
  const capL = Math.max(1, c.labelsMax || 10);
  st.labelTokens = Math.min(capL, (st.labelTokens || 0) + (c.labelsPerSec || capL) * Math.max(0, dt || 0));
  return st;
}

/** Bolehkah satu angka damage muncul sekarang? (budget + kap layar) */
export function numberAllowed(run) {
  const st = gfState(run);
  if (!st) return true;
  const cap = Math.max(1, (gfCfg().crowd || {}).numbersMax || 18);
  if (run.effects && run.effects.numbers && run.effects.numbers.length >= cap) return false;
  if ((st.numberTokens || 0) < 1) return false;
  st.numberTokens -= 1;
  return true;
}

/**
 * Bolehkah satu TEKS melayang ("+N ANTIBODI", "+XP", …) muncul sekarang?
 * Bucket terpisah dari angka damage: teks lebih informasi, jadi kapasitasnya
 * lebih kecil namun tetap dijamin muncul saat tidak sedang ramai.
 */
export function labelAllowed(run) {
  const st = gfState(run);
  if (!st) return true;
  const c = gfCfg().crowd || {};
  const cap = Math.max(1, c.labelsMax || 10);
  if (run.effects && run.effects.numbers && run.effects.numbers.length >= cap) return false;
  if ((st.labelTokens || 0) < 1) return false;
  st.labelTokens -= 1;
  return true;
}

/**
 * Mainkan SFX ber-THROTTLE per jenis (keramaian: 40 kill tidak boleh
 * menjadi 40 bunyi beruntun — §20: layar & telinga tetap terbaca).
 */
export function playSfx(run, key, fallback) {
  const fn = (typeof key === 'string' && audio[key]) ? () => audio[key]() : (typeof fallback === 'function' ? fallback : null);
  if (!fn) return false;
  const st = gfState(run);
  const ms = (gfCfg().crowd || {}).sfxThrottleMs || {};
  const jeda = ms[key] ?? 0;
  if (jeda > 0 && st) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const last = st.sfx[key] || -1e9;
    if (now - last < jeda) return false;
    st.sfx[key] = now;
  }
  try { fn(); } catch { /* audio tak boleh merusak gameplay */ }
  return true;
}

/**
 * Getar kamera ber-TANGGA & ber-THROTTLE: getar kecil (≤ heavy) dibatasi
 * jaraknya, getar besar (elite/ultimate/boss) selalu lewat; semua dikali
 * pengali keramaian dan di-cap oleh camera.traumaCap.
 */
export function addImpactShake(game, amount, opts = {}) {
  const run = game && game.run;
  if (!run || !run.camera || !(amount > 0)) return 0;
  const cfg = gfCfg();
  const heavyShake = gfTier('heavy').shake || 0.09;
  if (opts.throttle !== false && amount <= heavyShake) {
    const throttle = (cfg.crowd || {}).shakeThrottleSec ?? 0.055;
    const now = run.time || 0;
    if (now - (run.lastImpactShakeAt ?? -999) < throttle) return 0;
    run.lastImpactShakeAt = now;
  }
  const cs = crowdScale(run);
  const v = amount * (opts.scale !== false ? cs.shake : 1);
  run.camera.addShake(v);
  return v;
}

/**
 * REAKSI MUSuh (§20 ENEMY REACTION): flash lebih lama per tingkat, squash
 * (pop) saat terkena, dan stagger (terhuyung) untuk pukulan berat ke atas.
 * Boss imun stagger — reaksinya lewat flash + getar, bukan tersendat.
 * @returns {{tier:string, flash:number, squash:number, stagger:number}}
 */
export function enemyReaction(enemy, tier) {
  const t = gfTier(tier);
  const r = gfCfg().reaction || {};
  const dur = r.squashDurSec || 0.16;
  const out = { tier, flash: 0, squash: 0, stagger: 0 };
  if (!enemy) return out;
  // 1) FLASH — durasi mengikuti tingkat (dulu hardcoded 0.12 untuk semua)
  const flashSec = typeof t.flashSec === 'number' ? t.flashSec : 0.12;
  enemy.hitFlash = Math.max(enemy.hitFlash || 0, flashSec);
  enemy.flashDur = flashSec;
  out.flash = flashSec;
  // 2) SQUASH — pop seketika lalu kembali (dibaca renderer)
  if ((t.squash || 0) > 0) {
    enemy.squashT = dur;
    enemy.squashDur = dur;
    enemy.squashAmt = t.squash;
    out.squash = t.squash;
  }
  // 3) STAGGER — pukulan berat membuat musuh terhuyung (boss kebal)
  const stag = (t.staggerSec || 0);
  if (stag > 0 && !enemy.isBoss && typeof enemy.applySlow === 'function') {
    enemy.applySlow(r.staggerSlowMult ?? 0.35, stag);
    out.stagger = stag;
  }
  return out;
}

/**
 * Skala partikel mengikuti keramaian (di-build dari jumlah dasar).
 * @returns {number} jumlah partikel yang boleh di-spawn
 */
export function particleBudget(run, base) {
  const cs = crowdScale(run);
  return Math.max(2, Math.round(base * cs.particles));
}

/**
 * Pop kematian per tingkat (deathPop di data) — normal/elite/boss punya
 * skala & durasi berbeda supaya kematian terasa bertingkat.
 */
export function deathPopFor(isBoss, isElite) {
  const dp = (gfCfg().reaction || {}).deathPop || {};
  const k = isBoss ? 'boss' : (isElite ? 'elite' : 'normal');
  return dp[k] || dp.normal || { scaleTo: 1.3, dur: 0.15 };
}

/**
 * Satu paket dampak HIT: reaksi musuh + VFX + getar + SFX + hit-stop.
 * Dipanggil game.js di jalur hit (bukan kill) supaya kelima kanal §20
 * selalu menyala bersamaan dan urutannya tidak berubah di banyak tempat.
 */
export function applyHitImpact(game, enemy, opts = {}) {
  const run = game && game.run;
  if (!run || !enemy) return null;
  const tier = tierForEvent({ crit: opts.crit, isElite: enemy.def && enemy.def.elite, isBoss: enemy.isBoss, source: opts.source });
  const t = gfTier(tier);
  const reaction = enemyReaction(enemy, tier);
  if (!(opts.absorbed) && (t.hitSec || 0) > 0 && typeof game.hitStopRun === 'function') {
    game.hitStopRun(t.hitSec);
  }
  if (!opts.absorbed && !opts.died) addImpactShake(game, t.shake || 0);
  playSfx(run, opts.absorbed ? null : (t.sfx || 'hit'));
  return { tier, tierCfg: t, reaction };
}

/**
 * Satu paket dampak KEMATIAN: hit-stop + getar + SFX bertingkat.
 * @returns {{tier:string, tierCfg:object}}
 */
export function applyDeathImpact(game, enemy, opts = {}) {
  const run = game && game.run;
  if (!run || !enemy) return null;
  const isBoss = !!enemy.isBoss;
  const isElite = !!(enemy.def && enemy.def.elite);
  const tier = tierForEvent({ isElite, isBoss, source: opts.source });
  const t = gfTier(tier);
  // Kill BIASA tidak menumpuk freeze: cadence serangan pemain (PULSE) harus
  // tetap responsif di tengah keroyokan (aturan RONDE-7 dipertahankan).
  const gate = !isBoss && !isElite && opts.gate !== false;
  let hitStop = 0;
  if (typeof game.hitStopRun === 'function' && (!gate || (run.hitStopCool || 0) <= 0)) {
    hitStop = t.killSec || 0;
    if (hitStop > 0) game.hitStopRun(hitStop);
    if (gate) run.hitStopCool = opts.cooldownSec ?? 0.24;
  }
  if (!isBoss) addImpactShake(game, t.shake || 0, { throttle: false });
  const bunyi = playSfx(run, isBoss ? 'bossDie' : (opts.source === 'engulf' ? 'engulf' : 'kill'));
  return { tier, tierCfg: t, hitStop, sfx: bunyi };
}
