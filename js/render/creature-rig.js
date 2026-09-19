/**
 * creature-rig.js — perender MAKHLUK (pendekatan ②: rigged 2D, badan prosedural).
 *
 * Angka gerak TIDAK di sini: semuanya hasil PANGGANGAN GODOT
 * (data/creature-rigs.json ← data/character-rigs.json). Modul ini hanya
 * mencuplik trek, memadukan arah pandang, lalu menggambarnya di kanvas.
 *
 * Yang membuatnya terasa HIDUP (bukan gambar yang digeser):
 *  · FOOT PLANTING — ujung kaki bergerak mundur di ruang makhluk tepat sejauh
 *    badan maju, jadi di layar ujung itu DIAM saat menapak (bukan menyapu).
 *  · POROS BAWAH — squash/stretch diputar pada garis alas (cy = tanah), jadi
 *    badan tidak pernah melayang.
 *  · GERAK SEKUNDER — nukleus & organel ikut TERLAMBAT (lag), membran
 *    beriak (`wob`) — berat badan terasa.
 *  · ARAH 360° — depan/samping/belakang DIBLEND terus-menerus dari sudut
 *    hadap; bukan memilih salah satu dari 4 sprite.
 */
import { getData } from '../core/data-store.js';

const TAU = Math.PI * 2;

function panggangan() {
  const d = getData();
  return (d && d.creatureRigs) || null;
}

export function creatureAvailable(id) {
  const b = panggangan();
  return !!(b && b.creatures && b.creatures[id] && b.creatures[id].states);
}

function wrap01(u) {
  let x = u % 1;
  if (x < 0) x += 1;
  return x;
}

function lerp(a, b, t) { return a + (b - a) * t; }

/** Cuplik satu frame keadaan (interpolasi linear, melingkar bila loop). */
export function creaturePose(id, state, u) {
  const b = panggangan();
  const c = b && b.creatures && b.creatures[id];
  const st = c && c.states && c.states[state];
  if (!st || !st.frames || !st.frames.length) return null;
  const frames = st.frames;
  const n = frames.length;
  const uu = st.loop ? wrap01(u) : Math.max(0, Math.min(1, u));
  const p = uu * (st.loop ? n : n - 1);
  const i = Math.min(n - 1, Math.floor(p));
  const f = p - i;
  const A = frames[i];
  const B = frames[Math.min(n - 1, i + 1)];
  const mix = (x, y) => lerp(x, y, f);
  const limbs = A.limbs.map((la, k) => {
    const lb = B.limbs[k] || la;
    return { x: mix(la.x, lb.x), y: mix(la.y, lb.y), plant: f < 0.5 ? la.plant : lb.plant };
  });
  return {
    core: {
      x: mix(A.core.x, B.core.x), y: mix(A.core.y, B.core.y),
      sx: mix(A.core.sx, B.core.sx), sy: mix(A.core.sy, B.core.sy),
      rot: mix(A.core.rot, B.core.rot),
    },
    nuk: { x: mix(A.nuk.x, B.nuk.x), y: mix(A.nuk.y, B.nuk.y), sx: mix(A.nuk.sx, B.nuk.sx), sy: mix(A.nuk.sy, B.nuk.sy) },
    front: mix(A.front, B.front),
    uro: mix(A.uro, B.uro),
    wob: mix(A.wob, B.wob),
    limbs,
  };
}

/** Info keadaan (durasi & loop) — dipakai lab & penguji. */
export function creatureStateInfo(id, state) {
  const b = panggangan();
  const st = b && b.creatures && b.creatures[id] && b.creatures[id].states && b.creatures[id].states[state];
  return st ? { loop: !!st.loop, dur: st.dur || 1 } : null;
}

/** Daftar keadaan yang tersedia untuk makhluk ini. */
export function creatureStates(id) {
  const b = panggangan();
  const c = b && b.creatures && b.creatures[id];
  return c ? Object.keys(c.states) : [];
}

/** Anatomi (warna, jumlah kaki, dll) — untuk lab & skin. */
export function creatureAnatomy(id) {
  const b = panggangan();
  return (b && b.creatures && b.creatures[id]) || null;
}

/**
 * Gambar makhluk.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o { id, state, u, x, y, size, facing, time, alpha, tint, limbsOnly }
 */
export function drawCreature(ctx, o) {
  const b = panggangan();
  const c = b && b.creatures && b.creatures[o.id];
  const pose = creaturePose(o.id, o.state, o.u);
  if (!c || !pose) return false;

  const S = o.size;
  const waktu = o.time || 0;
  const facing = o.facing || 0;
  const alpha = o.alpha == null ? 1 : o.alpha;
  const tanah = 0.42;                  // garis alas (ruang makhluk, y ke bawah +)
  const body = c.body || {};
  const R = body.radius || 0.5;
  const bodyCy = tanah - R;            // badan menempel alas (poros bawah)

  // ---- arah pandang 360° (depan/samping/belakang diblend terus-menerus) ----
  const sf = Math.sin(facing), cf = Math.cos(facing);
  const viewFront = Math.max(0, sf);       // bergerak mendekati kamera → tampak depan
  const viewBack = Math.max(0, -sf);       // menjauh → tampak belakang
  const viewSide = Math.abs(cf);           // menyamping
  // sumbu langkah: kaki mengayun searah gerak di layar (vertikal dipadatkan perspektif)
  const YS = 0.5;
  const gaitLen = Math.hypot(cf, sf * YS) || 1;
  const ax = cf / gaitLen, ay = (sf * YS) / gaitLen;   // sumbu depan-belakang
  const bx = -ay, by = ax;                              // sumbu samping

  const toX = (cx, cy) => o.x + (ax * cx + bx * cy) * S;
  const toY = (cy1, cx, cy2) => o.y + (ay * cx + by * cy2) * S;

  // posisi dalam ruang makhluk → layar (sumbu depan = a, samping = b, + turun)
  const px = (fore, side2, down = 0) => o.x + (ax * fore + bx * side2) * S;
  const py = (fore, side2, down = 0) => o.y + (ay * fore + by * side2) * S + down * S;

  const limb = c.limbs || {};
  const n = limb.count || 6;
  const sides = limb.side || [];
  const warnaKaki = o.tint || limb.color || '#5c9873';
  const warnaUjung = limb.tip || '#8fe6c8';
  const thick = limb.thick || 0.14;
  const taper = limb.taper || 0.32;

  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;

  // ---------- bayangan telapak per kaki (bukan satu lingkaran besar) ----------
  for (let i = 0; i < n; i++) {
    const L = pose.limbs[i];
    if (!L) continue;
    const tinggi = Math.max(0, tanah - L.y);           // 0 = menapak
    const jelas = 1 - Math.min(1, tinggi / 0.22);
    if (jelas <= 0.02) continue;
    const tx = px(L.x, 0), ty = py(L.x, 0) + 0;
    ctx.globalAlpha = alpha * 0.22 * jelas;
    ctx.fillStyle = '#08221d';
    ctx.beginPath();
    ctx.ellipse(tx, ty + S * 0.03, S * 0.075 * (0.7 + 0.3 * jelas), S * 0.032 * (0.7 + 0.3 * jelas), 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;

  // ---------- kaki: yang JAUH digambar lebih dulu (kedalaman) ----------
  const urut = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;          // -1 belakang .. +1 depan
    const sisi = sides[i] != null ? sides[i] : (i < n / 2 ? -1 : 1);
    const fore0 = t * 0.34;
    const side0 = sisi * 0.15;
    const kedalaman = fore0 * ay + side0 * by;            // makin + = makin dekat
    urut.push({ i, kedalaman, fore0, side0, sisi });
  }
  urut.sort((a, z) => a.kedalaman - z.kedalaman);

  const gambarKaki = (ent) => {
    const L = pose.limbs[ent.i];
    if (!L) return;
    // pangkal menempel badan (ikut squash badan, berporos alas)
    const mFore = ent.fore0 * pose.core.sx;
    const mSide = ent.side0 * pose.core.sy;
    const mDown = bodyCy + R * 0.55 * pose.core.sy;
    const mx = px(mFore, mSide, mDown);
    const my = py(mFore, mSide, mDown);
    // ujung: tanah + geser mundur/maju sesuai fase langkah
    const tx = px(L.x, ent.side0 * 0.55);
    const ty = py(L.x, ent.side0 * 0.55) + (L.y - tanah) * S;
    // lutut: melengkung keluar (pseudopodia tidak punya sendi, tapi ada busur)
    const cFore = (mFore + L.x) * 0.5 + ent.sisi * 0.03;
    const cSide = (mSide + ent.side0 * 0.55) * 0.5 + ent.sisi * 0.05;
    const cDown = (mDown + (L.y - tanah)) * 0.5 - 0.02;
    const cx = px(cFore, cSide, cDown);
    const cy = py(cFore, cSide, cDown);

    const w0 = S * thick * (0.55 + 0.45 * pose.core.sy);
    const w1 = S * thick * taper;
    const grd = ctx.createLinearGradient(mx, my, tx, ty);
    grd.addColorStop(0, warnaKaki);
    grd.addColorStop(1, warnaUjung);
    ctx.strokeStyle = grd;
    ctx.lineCap = 'round';
    ctx.lineWidth = w0;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(cx, cy, tx, ty);
    ctx.lineWidth = (w0 + w1) * 0.5;
    ctx.stroke();
    // ujung meruncing
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.lineWidth = w1;
    ctx.stroke();
    // telapak: bintik terang saat menapak
    if (L.plant) {
      ctx.fillStyle = warnaUjung;
      ctx.globalAlpha = alpha * 0.85;
      ctx.beginPath();
      ctx.ellipse(tx, ty, S * 0.035, S * 0.022, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    void urut;
  };

  for (const ent of urut) if (ent.kedalaman <= 0.02) gambarKaki(ent);

  if (!o.limbsOnly) {
    // ---------- badan: blob beriak (gerak sekunder membran) ----------
    const wob = body.wobble || {};
    const lobes = wob.lobes || 7;
    const amp = (wob.amp || 0.03) * pose.wob;
    const speed = wob.speed || 1.6;
    const cxB = o.x + pose.core.x * S * ax + pose.core.x * S * 0;
    const cyB = o.y + pose.core.y * S + bodyCy * S * pose.core.sy * 0 + (bodyCy + R) * S - R * S;
    // pusat badan (berporos alas: skala dihitung dari garis tanah)
    const bx0 = o.x + pose.core.x * S * ax;
    const by0 = o.y + (tanah - R * pose.core.sy + (pose.core.y || 0)) * S;
    void cxB; void cyB;
    const rx = R * S * pose.core.sx;
    const ry = R * S * pose.core.sy;

    ctx.save();
    ctx.translate(bx0, by0);
    ctx.rotate(pose.core.rot * ax + pose.core.rot * 0.35 * (1 - Math.abs(ax)));
    ctx.beginPath();
    const SEG = 40;
    for (let k = 0; k <= SEG; k++) {
      const a = (k / SEG) * TAU;
      const ri = 1
        + Math.sin(a * lobes + waktu * speed) * amp
        + Math.sin(a * (lobes + 3) - waktu * speed * 0.7) * amp * 0.45;
      const ex = Math.cos(a) * rx * ri;
      const ey = Math.sin(a) * ry * ri;
      if (k === 0) ctx.moveTo(ex, ey); else ctx.lineTo(ex, ey);
    }
    ctx.closePath();
    const gB = ctx.createRadialGradient(-rx * 0.25, -ry * 0.35, rx * 0.15, 0, 0, rx * 1.15);
    gB.addColorStop(0, body.rim || '#8fe6c8');
    gB.addColorStop(0.55, body.color || '#4a7c59');
    gB.addColorStop(1, body.belly || '#3a6146');
    ctx.fillStyle = gB;
    ctx.fill();
    ctx.strokeStyle = body.rim || '#8fe6c8';
    ctx.lineWidth = Math.max(1, S * 0.018);
    ctx.globalAlpha = alpha * 0.75;
    ctx.stroke();
    ctx.globalAlpha = alpha;

    // ---------- tepi depan (lamellipodium) — penanda ARAH ----------
    const frontCfg = c.front || {};
    const panjangDepan = pose.front * (0.35 + 0.65 * (viewFront + 0.45 * viewSide));
    if (panjangDepan > 0.03) {
      ctx.beginPath();
      ctx.moveTo(-ry * 0.75, 0);
      ctx.quadraticCurveTo(rx * panjangDepan * 1.5, -ry * 0.25, rx * panjangDepan * 1.5, 0);
      ctx.quadraticCurveTo(rx * panjangDepan * 1.5, ry * 0.25, -ry * 0.75, 0);
      ctx.closePath();
      ctx.fillStyle = frontCfg.color || '#7fe3d0';
      ctx.globalAlpha = alpha * (0.35 + 0.45 * (viewFront + 0.4 * viewSide));
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    // ---------- ekor belakang (uropod) — penanda membelakangi ----------
    const uroCfg = c.uropod || {};
    if (viewBack > 0.05 && pose.uro > 0.05) {
      ctx.beginPath();
      ctx.moveTo(-rx * 0.6, -ry * 0.18);
      ctx.quadraticCurveTo(-rx * (1 + pose.uro * 0.7), 0, -rx * 0.6, ry * 0.18);
      ctx.closePath();
      ctx.fillStyle = uroCfg.color || '#3a6146';
      ctx.globalAlpha = alpha * (0.35 + 0.45 * viewBack);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }

    // ---------- nukleus (massa dalam — ikut terlambat) ----------
    const nuk = c.nucleus || {};
    const nr = (nuk.r || 0.19) * S;
    const nx = pose.nuk.x * S * ax - rx * 0.18 * viewSide * cf;
    const ny = pose.nuk.y * S + (nuk.y || 0) * S + Math.sin(waktu * (nuk.bob ? 1 / nuk.bob : 50) * 0.6) * (nuk.bob || 0) * S;
    ctx.beginPath();
    ctx.ellipse(nx, ny, nr * pose.nuk.sx, nr * pose.nuk.sy, 0, 0, TAU);
    ctx.fillStyle = nuk.color || '#2c5540';
    ctx.globalAlpha = alpha * (0.55 + 0.35 * (1 - viewBack * 0.5));
    ctx.fill();
    ctx.strokeStyle = nuk.rim || '#7fe3d0';
    ctx.lineWidth = Math.max(1, S * 0.012);
    ctx.globalAlpha = alpha * 0.5;
    ctx.stroke();
    ctx.globalAlpha = alpha;

    // ---------- MUTASI A → B: duri & warna muncul perlahan (prosedural) ----------
    const mut = Math.max(0, Math.min(1, o.mut || 0));
    if (mut > 0.01) {
      const duri = 9;
      ctx.globalAlpha = alpha * mut;
      ctx.fillStyle = o.mutColor || '#b6f26f';
      for (let k = 0; k < duri; k++) {
        const a = (k / duri) * TAU + waktu * 0.4;
        const r0 = rx * 0.94, r1 = rx * (1.10 + 0.06 * Math.sin(waktu * 2.4 + k)) * mut;
        const w = 0.055 * (rx + ry) * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * (ry / rx));
        ctx.lineTo(Math.cos(a + 0.09) * r1, Math.sin(a + 0.09) * r1 * (ry / rx));
        ctx.lineTo(Math.cos(a - 0.09) * r1, Math.sin(a - 0.09) * r1 * (ry / rx));
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
    }

    // ---------- organel (gerak sekunder: mengorbit pelan) ----------
    const org = c.organelles || {};
    const jo = org.count || 0;
    for (let k = 0; k < jo; k++) {
      const a = (k / jo) * TAU + waktu * (org.drift || 0.5) * 0.35;
      const rr = (org.orbit || 0.25) * S * (0.8 + 0.2 * Math.sin(waktu * 1.3 + k));
      ctx.beginPath();
      ctx.arc(nx + Math.cos(a) * rr * pose.core.sx, ny + Math.sin(a) * rr * pose.core.sy * 0.8, (org.r || 0.045) * S, 0, TAU);
      ctx.fillStyle = org.color || '#b6f26f';
      ctx.globalAlpha = alpha * 0.5;
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
    ctx.restore();
  }

  for (const ent of urut) if (ent.kedalaman > 0.02) gambarKaki(ent);

  ctx.restore();
  return true;
}

/** Daftar makhluk yang sudah dipanggang (untuk lab/penguji). */
export function creatureIds() {
  const b = panggangan();
  return b ? Object.keys(b.creatures || {}) : [];
}
