/**
 * arena-shape.js — PILOT "Organ Ascent": arena berbentuk SILUET ORGAN
 * (koridor vertikal), bukan cawan petri bundar.
 *
 * Status: PILOT satu organ (Bilik Jantung, arenaId "jantung"). Enam organ lain
 * tetap memakai lingkaran `run.arenaBounds` lama — modul ini hanya aktif bila
 * `data/arenas.json` mendefinisikan blok `shape` untuk arena tsb.
 *
 * Prinsip: HANYA geometri batas & visual yang berubah. HP/damage/collision/
 * kecepatan tidak disentuh — `clampToShape()` menggantikan clamp lingkaran di
 * titik yang sama persis (arenaClamp, clamp spawn, kill proyektil).
 *
 * Model siluet: PROFIL LEBAR-PER-TINGGI. Untuk tiap y (dunia, y kecil = atas)
 * koridor punya `center(y)` dan `halfWidth(y)`; kontur dinding = interpolasi
 * mulus (Catmull-Rom) antar titik kontrol `profile` dari data. Ini membuat
 * siluet organ apa pun (jantung, paru bercabang nanti) bisa dinyatakan dengan
 * belasan angka, bukan poligon manual — dan `insideTest` tetap O(1).
 *
 * Keputusan pilot (lihat PR): jalur TUNGGAL, kamera tetap top-down,
 * urat/otot = elemen VISUAL dinding (belum gameplay fungsional).
 */

/** Interpolasi Catmull-Rom 1D (mulus, melewati titik kontrol). */
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/**
 * Bangun shape koridor dari definisi data.
 * @param {object} def  blok `shape` dari arenas.json:
 *   { kind:'corridor', height, profile:[{t, half, cx?}], anchor?:{x,y} }
 *   - t: 0 = dasar (y paling besar/bawah, tempat spawn), 1 = puncak (y kecil)
 *   - half: setengah lebar koridor di titik itu (unit dunia)
 *   - cx: geser pusat koridor (kelokan) — default 0
 * @param {number} ox,oy  titik asal dunia (spawn player) — koridor dipasang di sini
 */
export function buildCorridorShape(def, ox = 0, oy = 0) {
  const H = Math.max(600, def.height || 3000);
  const prof = (def.profile && def.profile.length >= 2 ? def.profile : [{ t: 0, half: 300 }, { t: 1, half: 300 }])
    .slice().sort((a, b) => a.t - b.t);
  // Player mulai di `startT` (porsi tinggi dari dasar) — default sedikit di atas dasar.
  const startT = def.startT == null ? 0.12 : def.startT;
  const bottomY = oy + startT * H;   // y dasar (paling bawah)
  const topY = bottomY - H;          // y puncak (paling atas)
  const cx0 = ox;

  const sample = (t, key) => {
    const tt = Math.max(0, Math.min(1, t));
    let i = 0;
    while (i < prof.length - 2 && prof[i + 1].t <= tt) i++;
    const a = prof[i], b = prof[i + 1];
    const seg = Math.max(1e-6, b.t - a.t);
    const u = Math.max(0, Math.min(1, (tt - a.t) / seg));
    const p0 = prof[Math.max(0, i - 1)], p3 = prof[Math.min(prof.length - 1, i + 2)];
    const g = (p) => (p[key] || 0);
    return catmull(g(p0), g(a), g(b), g(p3), u);
  };

  const tOf = (y) => (bottomY - y) / H;
  const halfAt = (y) => Math.max(40, sample(tOf(y), 'half'));
  const centerAt = (y) => cx0 + sample(tOf(y), 'cx');

  // Luas (untuk paritas kepadatan spawn vs cawan lama) — integrasi numerik.
  let area = 0;
  const N = 64;
  for (let k = 0; k < N; k++) { const y = bottomY - (k + 0.5) / N * H; area += 2 * halfAt(y) * (H / N); }

  const shape = {
    kind: 'corridor',
    id: def.id || 'corridor',
    height: H, bottomY, topY, cx: cx0,
    halfAt, centerAt, tOf,
    // Bounding circle setara — dipakai jalur lama yang hanya butuh "kira-kira".
    bounds: { x: cx0, y: (bottomY + topY) / 2, r: Math.hypot(H / 2, Math.max(...prof.map((p) => p.half + Math.abs(p.cx || 0)))) },
    area,
    summary: { height: H, bottomY, topY, area: Math.round(area), maxHalf: Math.max(...prof.map((p) => p.half)) },
    def,
  };
  return shape;
}

/** Apakah titik di dalam koridor (dengan margin ke dalam). */
export function insideShape(shape, x, y, margin = 0) {
  if (!shape) return true;
  if (y > shape.bottomY - margin || y < shape.topY + margin) return false;
  const c = shape.centerAt(y), h = shape.halfAt(y) - margin;
  return Math.abs(x - c) <= h;
}

/**
 * Jepit entitas ke dalam koridor — sepadan dengan clamp lingkaran lama:
 * geser minimum ke titik dalam terdekat (sumbu Y dulu, lalu X pada baris itu).
 * @returns {boolean} true bila posisi digeser
 */
export function clampToShape(shape, ent, margin = 0) {
  if (!shape || !ent) return false;
  const m = Math.max(0, margin);
  let moved = false;
  const yMax = shape.bottomY - m, yMin = shape.topY + m;
  if (ent.y > yMax) { ent.y = yMax; moved = true; } else if (ent.y < yMin) { ent.y = yMin; moved = true; }
  const c = shape.centerAt(ent.y);
  const h = Math.max(20, shape.halfAt(ent.y) - m);
  if (ent.x > c + h) { ent.x = c + h; moved = true; } else if (ent.x < c - h) { ent.x = c - h; moved = true; }
  return moved;
}

/** Jarak (kasar, positif = di luar) dari titik ke dinding — untuk kill proyektil. */
export function outsideDistance(shape, x, y) {
  if (!shape) return -Infinity;
  const dy = Math.max(y - shape.bottomY, shape.topY - y, 0);
  const c = shape.centerAt(Math.max(shape.topY, Math.min(shape.bottomY, y)));
  const dx = Math.max(0, Math.abs(x - c) - shape.halfAt(Math.max(shape.topY, Math.min(shape.bottomY, y))));
  return Math.hypot(dx, dy);
}

/**
 * Titik kontur dinding kiri & kanan antara y0..y1 (untuk render).
 * @returns {{left:Array<[number,number]>, right:Array<[number,number]>}}
 */
export function wallPolyline(shape, y0, y1, step = 40) {
  const a = Math.max(shape.topY, Math.min(y0, y1));
  const b = Math.min(shape.bottomY, Math.max(y0, y1));
  const left = [], right = [];
  for (let y = a; y <= b + 0.001; y += step) {
    const yy = Math.min(y, b);
    const c = shape.centerAt(yy), h = shape.halfAt(yy);
    left.push([c - h, yy]);
    right.push([c + h, yy]);
    if (yy === b) break;
  }
  return { left, right };
}

/** Definisi shape dari arena (null bila arena masih model lingkaran lama). */
export function shapeDefOf(arenaDef) {
  return arenaDef && arenaDef.shape && arenaDef.shape.kind === 'corridor' ? arenaDef.shape : null;
}
