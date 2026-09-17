/**
 * crawl-rig.js — Gerak MERAYAP hero dari RIG GODOT (data/crawl-cycles.json).
 *
 * Latar belakang: keluhan pemain "karakter masih mengambang".
 * Penyebab teknisnya (ketemu dari kode, bukan dugaan):
 *   · `billboard()` menskala sprite dari TITIK TENGAH, jadi tiap squash (sy<1)
 *     mengangkat tepi bawah badan dari alas → tampak melayang;
 *   · bob vertikal (`anim.bob`) menggeser SELURUH badan naik-turun.
 *
 * Kunci perbaikannya: sel yang merayak TIDAK PERNAH meninggalkan alas
 * (permukaan bawahnya selalu menempel). Maka kanal vertikal dikunci 0 dan
 * semua "hidup" dipindah ke:
 *   · squash-stretch berporos BAWAH (volume terjaga → tidak karet),
 *   · skew = jangkauan massa ke arah jalan (pseudopodia menjangkau),
 *   · gelombang lobus yang berjalan mengelilingi badan,
 *   · getaran halus (sway) dan daya lekat (contact) untuk debu/langkah.
 *
 * Angka gerak TIDAK di sini — semuanya dipanggang Godot dari data/crawl.json
 * (kontrak ROADMAP.md §5). Yang dilakukan modul ini hanya MEMBACA & MENCAMPUR
 * frame hasil panggangan.
 */
import { getData } from '../core/data-store.js';

const TAU = Math.PI * 2;

/** Ambil peta siklus hasil panggangan Godot. */
function cycles() {
  const d = getData();
  return (d && d.crawlCycles) || null;
}

/** Apakah rig merayap tersedia untuk hero ini? */
export function crawlAvailable(heroId) {
  const c = cycles();
  return !!(c && c.heroes && c.heroes[heroId] && c.heroes[heroId].frames && c.heroes[heroId].frames.length > 1);
}

function wrap01(u) {
  let x = u % 1;
  if (x < 0) x += 1;
  return x;
}

/** Interpolasi linear antar frame (melingkar) untuk satu kanal. */
function sample(frames, u, key) {
  const n = frames.length;
  const p = wrap01(u) * n;
  const i = Math.floor(p);
  const f = p - i;
  const a = frames[i % n][key];
  const b = frames[(i + 1) % n][key];
  const va = typeof a === 'number' ? a : 0;
  const vb = typeof b === 'number' ? b : 0;
  return va + (vb - va) * f;
}

/** Gelombang lobus (0..1) — dipakai penguji & efek membran. */
export function crawlLobe(heroId, walkPhase, index = 0) {
  const c = cycles();
  const hero = c && c.heroes && c.heroes[heroId];
  if (!hero) return 0;
  const lobes = hero.frames[0].lobes || [];
  if (!lobes.length) return 0;
  const n = Math.max(1, hero.lobes || lobes.length);
  const k = ((index % n) + n) % n;
  const raw = sample(hero.frames, walkPhase / TAU, 'lobes');
  // 'lobes' bukan angka → ambil manual
  const frames = hero.frames;
  const nn = frames.length;
  const p = wrap01(walkPhase / TAU) * nn;
  const i = Math.floor(p);
  const f = p - i;
  const la = frames[i % nn].lobes[k] || 1;
  const lb = frames[(i + 1) % nn].lobes[k] || 1;
  void raw;
  return la + (lb - la) * f;
}

/**
 * Pose merayap hero.
 *
 * @param {string} heroId     id hero (data/heroes.json)
 * @param {number} walkPhase  fase langkah TERKUNCI JARAK (player.walkPhase)
 * @param {number} moveAmt    0 = diam, 1 = lari penuh
 * @param {number} facing     arah hadap (radian)
 * @param {number} time       detik (untuk napas saat diam)
 * @returns {null|{sx,sy,shear,rot,x,contact,bob,rigSource}}
 */
export function crawlPose(heroId, walkPhase, moveAmt, facing, time = 0) {
  const c = cycles();
  const hero = c && c.heroes && c.heroes[heroId];
  if (!hero || !hero.frames || hero.frames.length < 2) return null;

  const amt = Math.max(0, Math.min(1, moveAmt || 0));
  const u = walkPhase / TAU;

  // Napas saat diam: TETAP berporos bawah (squash-stretch), bukan naik-turun.
  const breath = Math.sin(time * 2.1) * 0.018 * (1 - amt);
  let bx = 1 + breath;
  let by = 1 / bx;

  if (amt > 0.001) {
    const sx = sample(hero.frames, u, 'sx');
    const sy = sample(hero.frames, u, 'sy');
    // campur: diam = napas, jalan = siklus panggangan
    bx = bx * (1 - amt) + sx * amt;
    by = by * (1 - amt) + sy * amt;
  }

  const skew = sample(hero.frames, u, 'skew') * amt;
  const rot = sample(hero.frames, u, 'rot') * amt;
  const geser = sample(hero.frames, u, 'x') * amt;
  const contact = 1 - (1 - sample(hero.frames, u, 'contact')) * amt;

  // Arah jalan: jangkauan (skew) untuk gerak mendatar, memanjang/memipih untuk
  // gerak tegak — keduanya berporos BAWAH, jadi telapak tidak pernah lepas.
  // Pembagian ini membuat putaran 360° mulus: tak ada lompatan kanal.
  const cos = Math.cos(facing || 0);
  const sin = Math.sin(facing || 0);
  const horiz = Math.abs(cos);
  const vert = Math.abs(sin);
  const shear = skew * horiz;
  // Gerak ke atas (sin<0) = memanjang ke atas; ke bawah (sin>0) = memipih.
  const regang = 1 + (-sin) * Math.abs(skew) * 0.55 * vert;
  let sxOut = bx / Math.sqrt(regang);
  let syOut = by * Math.sqrt(regang);

  return {
    sx: sxOut,
    sy: syOut,
    shear,
    rot,
    x: geser,
    contact: Math.max(0, Math.min(1, contact)),
    bob: 0, // ← SENGAJA NOL: tidak ada lagi badan diangkat naik-turun
    rate: hero.rate || 1,
    style: hero.style || '',
    rigSource: 'crawl-godot',
  };
}

/** Info ringkas untuk HUD debug / penguji. */
export function crawlStatus() {
  const c = cycles();
  if (!c) return { ok: false, heroes: 0, frames: 0, source: null };
  return {
    ok: true,
    heroes: Object.keys(c.heroes || {}).length,
    frames: c.frames || 0,
    source: c.sumber || null,
  };
}
