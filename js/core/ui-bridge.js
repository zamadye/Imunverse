/**
 * ui-bridge.js — Jembatan event kecil tanpa dependensi silang.
 *
 * core/game.js (gameplay) TIDAK boleh mengimpor modul UI screen, dan modul UI
 * TIDAK diimpor oleh game.js — keduanya berkomunikasi lewat event di sini.
 * main.js yang mendaftarkan handler (mis. event 'levelup' → tampilkan modal).
 *
 * Event yang dipakai:
 *  - 'runstart'       : run dimulai
 *  - 'levelup'        : {level, choices} → tampilkan modal level-up
 *  - 'pause'          : tampilkan modal pause
 *  - 'revive'         : tampilkan modal tawaran revive (rewarded ad hook)
 *  - 'gameover'       : summary hasil run
 *  - 'toast'          : {message, kind}
 *  - 'playerHit'      : {damage} → flash vignette
 *  - 'wave'           : {wave, isBoss} → announce banner
 */

const handlers = new Map();

export function on(event, fn) {
  if (!handlers.has(event)) handlers.set(event, []);
  handlers.get(event).push(fn);
}

export function off(event, fn) {
  const list = handlers.get(event);
  if (!list) return;
  const i = list.indexOf(fn);
  if (i >= 0) list.splice(i, 1);
}

export function emit(event, payload) {
  const list = handlers.get(event);
  if (!list) return;
  for (const fn of list) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[ui-bridge] handler error pada event "${event}":`, err);
    }
  }
}
