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
// DEFAULT = 'foto': karakter yang tampil di layar HARUS foto hero asli
// (assets/sprites/*.png) — bukan blob vektor prosedural. 'makhluk' hanya
// prototipe eksperimen, tidak boleh jadi tampilan bawaan pemain.
let _mode = 'foto';
let _lastT = 0;

/** Mode aktif. */
export function heroMode() { return _mode; }
export function heroModes() { return MODES.slice(); }
export function setHeroMode(m) { if (MODES.includes(m)) { _mode = m; try { localStorage.setItem('phagos.heroMode', m); } catch { /* abaikan */ } } }
export function cycleHeroMode() { setHeroMode(MODES[(MODES.indexOf(_mode) + 1) % MODES.length]); return _mode; }

/** Baca preferensi dari URL (?heroMode=makhluk) atau localStorage. */
export function initHeroMode(search) {
  try {
    const q = new URLSearchParams(search || (typeof location !== 'undefined' ? location.search : ''));
    const m = q.get('heroMode');
    if (m && MODES.includes(m)) { _mode = m; return _mode; }
    const s = localStorage.getItem('phagos.heroMode');
    if (s && MODES.includes(s)) _mode = s;
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
  if (_mode === 'foto' || !creatureAvailable(id)) return 'none';
  if (o.limbsOnly) return gambar(ctx, o, true);
  return gambar(ctx, o, _mode === 'hibrida');
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
