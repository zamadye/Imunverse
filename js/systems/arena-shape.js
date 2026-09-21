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

/** Satu LAJUR: profil lebar-per-tinggi yang mulus (dipakai corridor & tiap cabang branch). */
function buildLane(def, ox, oy, H, bottomY) {
  const prof = (def.profile && def.profile.length >= 2 ? def.profile : [{ t: 0, half: 300 }, { t: 1, half: 300 }])
    .slice().sort((a, b) => a.t - b.t);
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
  // rentang tinggi lajur (cabang bisa mulai/berakhir di tengah organ)
  const t0 = def.t0 == null ? 0 : def.t0, t1 = def.t1 == null ? 1 : def.t1;
  const laneBottom = bottomY - t0 * H, laneTop = bottomY - t1 * H;
  const tOfLane = (y) => (laneBottom - y) / Math.max(1, laneBottom - laneTop);
  const halfAt = (y) => Math.max(40, sample(tOfLane(y), 'half'));
  const centerAt = (y) => ox + sample(tOfLane(y), 'cx');
  const maxHalf = Math.max(...prof.map((p) => p.half));
  return { id: def.id || 'lane', bottomY: laneBottom, topY: laneTop, halfAt, centerAt, maxHalf, prof };
}

/**
 * Bangun shape organ dari definisi data.
 * @param {object} def  blok `shape` dari arenas.json:
 *   kind:'corridor' → { height, startT?, profile:[{t, half, cx?}] }  (1 lajur)
 *   kind:'branch'   → { height, startT?, lanes:[{profile, t0?, t1?}, ...] } (gabungan lajur;
 *                     lajur pertama = batang utama tempat pemain mulai)
 *   - t: 0 = dasar (y paling besar/bawah), 1 = puncak (y kecil)
 *   - half: setengah lebar; cx: geser pusat (kelokan)
 * @param {number} ox,oy  titik asal dunia (posisi pemain saat aktivasi)
 */
export function buildCorridorShape(def, ox = 0, oy = 0) {
  const H = Math.max(600, def.height || 3000);
  const startT = def.startT == null ? 0.12 : def.startT;
  const bottomY = oy + startT * H;
  const topY = bottomY - H;
  const laneDefs = def.kind === 'branch' && def.lanes && def.lanes.length ? def.lanes : [def];
  const lanes = laneDefs.map((ld, i) => buildLane(Object.assign({ id: ld.id || `lane${i}` }, ld), ox, oy, H, bottomY));

  const lanesAt = (y) => lanes.filter((L) => y <= L.bottomY && y >= L.topY);
  /** Lajur yang paling dekat secara horizontal pada baris y (null bila tak ada). */
  const nearestLane = (x, y) => {
    let best = null, bd = Infinity;
    for (const L of lanesAt(y)) {
      const d = Math.max(0, Math.abs(x - L.centerAt(y)) - L.halfAt(y));
      if (d < bd) { bd = d; best = L; }
    }
    return best;
  };
  // Kompatibilitas: halfAt/centerAt = lajur utama (statistik, kamera, tes)
  const main = lanes[0];
  const halfAt = (y) => main.halfAt(y);
  const centerAt = (y) => main.centerAt(y);
  const tOf = (y) => (bottomY - y) / H;

  // Luas gabungan (integrasi numerik pada grid halus; cabang yang tumpang tindih tidak dihitung dua kali)
  let area = 0;
  const N = 96;
  for (let k = 0; k < N; k++) {
    const y = bottomY - (k + 0.5) / N * H;
    const segs = lanesAt(y).map((L) => [L.centerAt(y) - L.halfAt(y), L.centerAt(y) + L.halfAt(y)]).sort((a, b) => a[0] - b[0]);
    let w = 0, cur = null;
    for (const sgm of segs) {
      if (!cur || sgm[0] > cur[1]) { if (cur) w += cur[1] - cur[0]; cur = sgm.slice(); } else cur[1] = Math.max(cur[1], sgm[1]);
    }
    if (cur) w += cur[1] - cur[0];
    area += w * (H / N);
  }
  const extent = Math.max(...lanes.map((L) => Math.max(...L.prof.map((p) => p.half + Math.abs(p.cx || 0)))));

  return {
    kind: def.kind === 'branch' ? 'branch' : 'corridor',
    id: def.id || 'corridor',
    height: H, bottomY, topY, cx: ox,
    // OPEN-WORLD (mandat owner 2026-09-21): arena TANPA batas — persimpangan
    // antar-cabang harus bisa dilewati, pemain bebas explore maju/samping.
    // shape kini hanya menjadi STRUKTUR VISUAL + panduan spawn, bukan penjara.
    open: def.open !== false,
    lanes, lanesAt, nearestLane,
    halfAt, centerAt, tOf,
    bounds: { x: ox, y: (bottomY + topY) / 2, r: Math.hypot(H / 2, extent) },
    area,
    summary: { height: H, bottomY, topY, area: Math.round(area), maxHalf: main.maxHalf, lanes: lanes.length },
    def,
  };
}

/** Apakah titik di dalam organ (salah satu lajur), dengan margin ke dalam. */
export function insideShape(shape, x, y, margin = 0) {
  if (!shape) return true;
  if (shape.open) return true; // OPEN-WORLD: tidak ada konsep "di luar"
  if (y > shape.bottomY - margin || y < shape.topY + margin) return false;
  for (const L of shape.lanesAt(y)) {
    if (y > L.bottomY - margin || y < L.topY + margin) continue;
    if (Math.abs(x - L.centerAt(y)) <= L.halfAt(y) - margin) return true;
  }
  return false;
}

/**
 * Jepit entitas ke dalam organ — sepadan dengan clamp lingkaran lama:
 * geser minimum ke lajur terdekat (sumbu Y dulu, lalu X pada baris itu).
 * @returns {boolean} true bila posisi digeser
 */
export function clampToShape(shape, ent, margin = 0) {
  if (!shape || !ent) return false;
  // OPEN-WORLD (mandat owner): TIDAK ADA clamp — persimpangan antar-cabang
  // harus lolos, pemain bebas menjelajah maju/samping/berputar.
  if (shape.open) return false;
  const m = Math.max(0, margin);
  let moved = false;
  const yMax = shape.bottomY - m, yMin = shape.topY + m;
  if (ent.y > yMax) { ent.y = yMax; moved = true; } else if (ent.y < yMin) { ent.y = yMin; moved = true; }
  let L = shape.nearestLane(ent.x, ent.y);
  if (!L) {
    // baris ini tidak dicakup lajur mana pun (celah antar cabang) → ke lajur utama
    L = shape.lanes[0];
    const ly = Math.max(L.topY + m, Math.min(L.bottomY - m, ent.y));
    if (ly !== ent.y) { ent.y = ly; moved = true; }
  } else {
    // tepi lajur (cabang berakhir): jangan keluar dari rentang tingginya
    const ly = Math.max(L.topY + m, Math.min(L.bottomY - m, ent.y));
    if (ly !== ent.y) { ent.y = ly; moved = true; }
  }
  const c = L.centerAt(ent.y);
  const h = Math.max(20, L.halfAt(ent.y) - m);
  if (ent.x > c + h) { ent.x = c + h; moved = true; } else if (ent.x < c - h) { ent.x = c - h; moved = true; }
  return moved;
}

/** Jarak (kasar, positif = di luar) dari titik ke dinding terdekat — untuk kill proyektil. */
export function outsideDistance(shape, x, y) {
  if (!shape) return -Infinity;
  if (shape.open) return -Infinity; // OPEN-WORLD: proyektil tidak mati oleh "dinding"
  const yc = Math.max(shape.topY, Math.min(shape.bottomY, y));
  const dy = Math.max(y - shape.bottomY, shape.topY - y, 0);
  let dx = Infinity;
  for (const L of shape.lanes) {
    const ly = Math.max(L.topY, Math.min(L.bottomY, yc));
    const ddy = Math.abs(yc - ly);
    const d = Math.max(0, Math.abs(x - L.centerAt(ly)) - L.halfAt(ly));
    dx = Math.min(dx, Math.hypot(d, ddy));
  }
  return Math.hypot(dx, dy);
}

/**
 * Titik kontur dinding kiri & kanan satu LAJUR antara y0..y1 (untuk render).
 * @returns {{left:Array<[number,number]>, right:Array<[number,number]>}}
 */
export function wallPolyline(shape, y0, y1, step = 40, lane = null) {
  const L = lane || shape.lanes[0];
  const a = Math.max(L.topY, Math.min(y0, y1));
  const b = Math.min(L.bottomY, Math.max(y0, y1));
  const left = [], right = [];
  if (b < a) return { left, right };
  for (let y = a; y <= b + 0.001; y += step) {
    const yy = Math.min(y, b);
    const c = L.centerAt(yy), h = L.halfAt(yy);
    left.push([c - h, yy]);
    right.push([c + h, yy]);
    if (yy === b) break;
  }
  return { left, right };
}

/** Definisi shape dari arena (null bila arena masih model lingkaran lama). */
export function shapeDefOf(arenaDef) {
  const sh = arenaDef && arenaDef.shape;
  return sh && (sh.kind === 'corridor' || sh.kind === 'branch') ? sh : null;
}
