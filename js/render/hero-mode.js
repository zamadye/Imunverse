/**
 * hero-mode.js — pemilih CARA MENGGAMBAR hero (prototipe yang dibandingkan).
 *
 * Tiga mode berjalan berdampingan supaya bisa dinilai di gameplay nyata:
 *   · 'foto'     — ③ deformasi prosedural pada foto (keadaan sekarang, baseline)
 *   · 'hibrida'  — ④ foto sebagai inti badan + kaki/anggota prosedural
 *   · 'makhluk'  — ② makhluk vektor penuh (rig Godot, arah 360° diblend)
 *
 * PEMILIH MODE TIDAK MENYENTuh MEKANIK PERMAINAN — hanya mengganti fungsi
 * gambar di `game.js`. Posisi, HP, kecepatan, dan damage tetap sama persis.
 */
import { drawCreature, creatureAvailable, creatureStateInfo } from './creature-rig.js';

const MODES = ['foto', 'hibrida', 'makhluk'];
// DEFAULT GLOBAL = 'foto' (10 hero non-pilot masih memakai foto lama).
//
// PILOT "Abstract Bio-Forms": brief "human anime chibi" DIBATALKAN owner —
// hero pilot (Mako/macrophage) TAMPIL SEBAGAI MAKHLUK VEKTOR ABSTRAK (tanpa
// mata/mulut) secara bawaan, walau mode global masih 'foto'. Hero lain tidak
// tersentuh sampai pilot divalidasi. Pemain/penguji tetap bisa memaksa
// 'foto' untuk pembanding lewat ?heroMode=foto / tombol M (mode EKSPLISIT
// mengalahkan bawaan pilot).
export const PILOT_CREATURE_HEROES = ['macrophage'];
let _mode = 'foto';
let _explicit = false; // true bila pemain/URL memilih mode secara sadar
let _lastT = 0;

/** Mode aktif (global). */
export function heroMode() { return _mode; }
/** Mode EFEKTIF untuk satu hero: hero pilot → 'makhluk' kecuali dipilih eksplisit. */
export function heroModeFor(heroId) {
  if (!_explicit && PILOT_CREATURE_HEROES.includes(heroId) && creatureAvailable(heroId)) return 'makhluk';
  return _mode;
}
export function isPilotCreatureHero(heroId) { return PILOT_CREATURE_HEROES.includes(heroId); }
export function heroModes() { return MODES.slice(); }
export function setHeroMode(m) { if (MODES.includes(m)) { _mode = m; _explicit = true; try { localStorage.setItem('phagos.heroMode', m); } catch { /* abaikan */ } } }
/** Kembalikan ke bawaan (hero pilot = makhluk, lainnya = foto) — untuk penguji/lab. */
export function resetHeroMode() { _mode = 'foto'; _explicit = false; try { localStorage.removeItem('phagos.heroMode'); } catch { /* abaikan */ } }
export function cycleHeroMode() { setHeroMode(MODES[(MODES.indexOf(_mode) + 1) % MODES.length]); return _mode; }

/** Baca preferensi dari URL (?heroMode=makhluk) atau localStorage. */
export function initHeroMode(search) {
  try {
    const q = new URLSearchParams(search || (typeof location !== 'undefined' ? location.search : ''));
    const m = q.get('heroMode');
    if (m && MODES.includes(m)) { _mode = m; _explicit = true; return _mode; }
    const s = localStorage.getItem('phagos.heroMode');
    if (s && MODES.includes(s)) { _mode = s; _explicit = true; }
  } catch { /* abaikan */ }
  return _mode;
}

/** Nama mode yang enak dibaca (untuk tombol & toast). */
export function heroModeLabel(m) {
  return ({ foto: 'FOTO (lama)', hibrida: 'HIBRIDA', makhluk: 'MAKHLUK' })[m || _mode] || String(m || _mode);
}

/**
 * Keadaan animasi hero saat ini + progresnya (0..1).
 * Urutan prioritas: mati → mutasi → skill (Pulse) → kena hit → serang →
 * belok → jalan → diam.
 */
export function heroAnimState(player, run, timeSec, dtSec) {
  const t = player.__anim || (player.__anim = { state: 'idle', t: 0, u: 0 });
  const dt = Math.max(0, Math.min(0.1, dtSec || 0));

  let want = 'idle';
  if (!player.alive) want = 'death';
  else if (run && run.__mutasiFxT > 0) want = 'mutate';
  else if (run && run.membrane && run.membrane.pulseCdLeft > 0
    && run.membrane.pulseCdLeft > (run.membrane.pulseCooldown || 1) - 0.75) want = 'skill';
  else if (player.iframes > 0 && player.iframes > 0.28) want = 'hit';
  else if (player.attackFlash > 0 || player.swing > 0) want = 'attack';
  else if (Math.abs(player.facingVel || 0) > 2.2) want = 'turn';
  else if ((player.moveAmt || 0) > 0.12) want = 'walk';

  if (want !== t.state) { t.state = want; t.t = 0; }
  t.t += dt;

  let u;
  if (want === 'walk') u = (player.walkPhase || 0) / (Math.PI * 2);        // terkunci JARAK
  else if (want === 'idle') u = (timeSec || 0) / 2.6;                      // siklus napas
  else {
    const info = creatureStateInfo((player.heroDef && player.heroDef.id) || '', want);
    u = (info && info.dur) ? t.t / info.dur : 0;
  }
  t.u = u;
  return t;
}

/**
 * Gambar badan hero sesuai mode. Mengembalikan true bila yang menggambar
 * adalah rig makhluk (foto tidak perlu digambar lagi oleh pemanggil).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o { player, run, x, y, size, time (detik), dt (detik), alpha }
 * @returns {'none'|'photo'|'hybrid'|'creature'}
 */
export function drawHeroBody(ctx, o) {
  const player = o.player;
  const id = player.heroDef && player.heroDef.id;
  const mode = heroModeFor(id);
  if (mode === 'foto' || !creatureAvailable(id)) return 'none';
  if (o.limbsOnly) return gambar(ctx, o, true);
  return gambar(ctx, o, mode === 'hibrida');
}

/** Hanya anggota geraknya (mode hibrida: foto sudah digambar lebih dulu). */
export function drawHeroLimbs(ctx, o) {
  const player = o.player;
  const id = player.heroDef && player.heroDef.id;
  if (!creatureAvailable(id)) return false;
  return gambar(ctx, o, true) === 'hybrid';
}

function gambar(ctx, o, limbsOnly) {
  const player = o.player;
  const id = player.heroDef && player.heroDef.id;

  const st = heroAnimState(player, o.run, o.time, o.dt);
  // proyeksi kamera: makhluk digambar di ruang layar yang sudah dikalikan
  // skala perspektif, jari-jari & ketebalan ikut membesar saat mendekat.
  const pj = o.proyeksi;
  ctx.save();
  if (pj) { ctx.translate(pj.x, pj.y); ctx.scale(pj.s, pj.s); }
  const ok = drawCreature(ctx, {
    id,
    state: st.state,
    u: st.u,
    x: o.x || 0,
    y: o.y || 0,
    size: o.size,
    facing: player.facing || 0,
    time: o.time || 0,
    alpha: o.alpha == null ? 1 : o.alpha,
    limbsOnly: !!limbsOnly,
  });
  ctx.restore();
  return ok ? (limbsOnly ? 'hybrid' : 'creature') : 'none';
}
