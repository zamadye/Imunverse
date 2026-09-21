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
  // VIDEO-REFERENCE (2026-09-21): posisi kaki datang dari frame BAKE, jadi panjang
  // visual kaki dikendalikan faktor reach data-driven: limbs.len (satuan radius badan,
  // baseline bake 0.6). >1 = kaki menjulur spindly seperti artropoda di video referensi.
  const reach = Math.max(0.4, (limb.len || 0.6) / 0.6);

  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;

  // ---------- bayangan telapak per kaki (bukan satu lingkaran besar) ----------
  for (let i = 0; i < n; i++) {
    const L = pose.limbs[i];
    if (!L) continue;
    const tinggi = Math.max(0, tanah - L.y);           // 0 = menapak
    const jelas = 1 - Math.min(1, tinggi / 0.22);
    if (jelas <= 0.02) continue;
    const tx = px(L.x * reach, 0), ty = py(L.x * reach, 0) + 0;
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
    // ujung: tanah + geser mundur/maju sesuai fase langkah. Reach HANYA pada sumbu
    // depan-belakang (L.x) supaya kontinuitas putaran 360° terjaga; sebaran samping
    // tetap dari bake supaya tidak ada lompatan bentuk saat arah membelok.
    const tx = px(L.x * reach, ent.side0 * 0.55);
    const ty = py(L.x * reach, ent.side0 * 0.55) + (L.y - tanah) * S;
    // lutut: melengkung keluar (pseudopodia tidak punya sendi, tapi ada busur)
    const cFore = (mFore + L.x * reach) * 0.5 + ent.sisi * 0.03;
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

    // ---------- RUFFLE MEMBRAN (opsional, data `body.ruffle`) ----------
    // Identitas makrofag: tepi membran berkerut halus (bukan bulat licin),
    // kerutan paling rapat di sisi depan (arah jangkauan). Tanpa wajah.
    const ruf = body.ruffle || null;
    if (ruf && ruf.count) {
      const nR = ruf.count | 0;
      ctx.strokeStyle = ruf.color || body.rim || '#8fe6c8';
      ctx.lineWidth = Math.max(1, S * (ruf.thick || 0.014));
      ctx.globalAlpha = alpha * (ruf.alpha == null ? 0.55 : ruf.alpha);
      ctx.beginPath();
      for (let k = 0; k < nR; k++) {
        const a = (k / nR) * TAU + waktu * (ruf.spin || 0.15);
        // lebih panjang ke arah depan (cos a > 0 = depan dalam ruang badan)
        const depan = 0.5 + 0.5 * Math.cos(a);
        // sisi bawah (sin a > 0 = menempel alas) hampir tanpa kerutan supaya
        // garis alas makhluk tetap = garis alas foto lama (uji 0,42×S).
        const atas = 0.5 - 0.5 * Math.sin(a);
        const len = (ruf.len || 0.08) * (0.4 + 0.6 * depan) * (0.15 + 0.85 * atas) * (1 + 0.35 * Math.sin(waktu * 3.1 + k * 1.7));
        const ri = 1 + Math.sin(a * lobes + waktu * speed) * amp;
        const x0 = Math.cos(a) * rx * ri, y0 = Math.sin(a) * ry * ri;
        const x1 = Math.cos(a + 0.04) * rx * (ri + len), y1 = Math.sin(a + 0.04) * ry * (ri + len);
        const xm = Math.cos(a - 0.06) * rx * (ri + len * 0.6), ym = Math.sin(a - 0.06) * ry * (ri + len * 0.6);
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(xm, ym, x1, y1);
      }
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    // ---------- tepi depan: MANGKUK FAGOSIT (data `front.cup`) atau lamellipodium ----------
    const frontCfg = c.front || {};
    const panjangDepan = pose.front * (0.35 + 0.65 * (viewFront + 0.45 * viewSide));
    if (frontCfg.cup && panjangDepan > 0.03) {
      // Mangkuk terbuka ke depan — "mulut" biologis yang BUKAN wajah: dua
      // lengan membran melengkung mengapit rongga, lebar ikut pose.front.
      const buka = (frontCfg.cup.open || 0.55) * panjangDepan;
      const reach = rx * (0.55 + 0.9 * panjangDepan);
      ctx.beginPath();
      ctx.moveTo(rx * 0.35, -ry * 0.55);
      ctx.quadraticCurveTo(reach * 1.05, -ry * (0.55 + buka), reach, -ry * buka * 0.45);
      ctx.quadraticCurveTo(reach * 0.72, -ry * buka * 0.1, reach * 0.72, 0);
      ctx.quadraticCurveTo(reach * 0.72, ry * buka * 0.1, reach, ry * buka * 0.45);
      ctx.quadraticCurveTo(reach * 1.05, ry * (0.55 + buka), rx * 0.35, ry * 0.55);
      ctx.closePath();
      ctx.fillStyle = frontCfg.color || '#7fe3d0';
      ctx.globalAlpha = alpha * (0.35 + 0.45 * (viewFront + 0.4 * viewSide));
      ctx.fill();
      // rongga mangkuk: lebih gelap (kedalaman), tanpa fitur wajah
      ctx.beginPath();
      ctx.ellipse(reach * 0.78, 0, rx * 0.16 * panjangDepan, ry * buka * 0.32, 0, 0, TAU);
      ctx.fillStyle = frontCfg.cup.inner || body.belly || '#3a6146';
      ctx.globalAlpha = alpha * 0.55;
      ctx.fill();
      ctx.globalAlpha = alpha;
    } else if (panjangDepan > 0.03) {
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
    if ((nuk.lobes | 0) > 1) {
      // NUKLEUS BERLOBUS (neutrofil/eosinofil/basofil): 2–5 lobus tersambung —
      // penanda identitas granulosit; tidak simetris menghadap kamera.
      const nl = nuk.lobes | 0;
      const spread = (nuk.lobeSpread || 0.55) * nr;
      for (let k = 0; k < nl; k++) {
        // lobeAngle: sudut awal susunan lobus (default miring 0.6 rad; ~1.57 = tersusun vertikal — hindari sepasang lobus horizontal yang terbaca sebagai mata)
        const a = (k / nl) * TAU + (nuk.lobeAngle == null ? 0.6 : nuk.lobeAngle) + Math.sin(waktu * 0.5 + k) * 0.08;
        const lr = nr * (0.62 - 0.06 * nl / 3);
        ctx.moveTo(nx + Math.cos(a) * spread * pose.nuk.sx + lr * pose.nuk.sx, ny + Math.sin(a) * spread * 0.7 * pose.nuk.sy);
        ctx.ellipse(nx + Math.cos(a) * spread * pose.nuk.sx, ny + Math.sin(a) * spread * 0.7 * pose.nuk.sy, lr * pose.nuk.sx, lr * 0.85 * pose.nuk.sy, a, 0, TAU);
      }
    } else {
      ctx.ellipse(nx, ny, nr * pose.nuk.sx, nr * pose.nuk.sy, 0, 0, TAU);
    }
    ctx.fillStyle = nuk.color || '#2c5540';
    ctx.globalAlpha = alpha * (0.55 + 0.35 * (1 - viewBack * 0.5));
    ctx.fill();
    ctx.strokeStyle = nuk.rim || '#7fe3d0';
    ctx.lineWidth = Math.max(1, S * 0.012);
    ctx.globalAlpha = alpha * 0.5;
    ctx.stroke();
    ctx.globalAlpha = alpha;

    // ---------- VAKUOLA FAGOSITOSIS (data `vacuoles`) ----------
    // Identitas "pemakan": gelembung isi (patogen tercerna) melayang pelan di
    // sitoplasma, ukuran berbeda-beda, mengecil-membesar (mencerna). Digambar
    // di atas nukleus tapi tembus pandang — bukan mata (jumlah ganjil, acak,
    // tidak simetris, tidak menghadap kamera).
    const vac = c.vacuoles || null;
    if (vac && vac.count) {
      const nV = vac.count | 0;
      for (let k = 0; k < nV; k++) {
        const seed = k * 2.399 + 0.7;
        const ang = seed + waktu * (vac.drift || 0.18) * (k % 2 ? 1 : -0.7);
        const orb = (vac.orbit || 0.3) * (0.55 + 0.45 * ((k * 7) % 5) / 4);
        const vx = Math.cos(ang) * orb * S * pose.core.sx * 0.9;
        const vy = Math.sin(ang) * orb * S * pose.core.sy * 0.75 + (nuk.y || 0) * S * 0.3;
        const vr = (vac.r || 0.06) * S * (0.6 + 0.4 * ((k * 3) % 4) / 3) * (1 + 0.12 * Math.sin(waktu * 1.9 + seed));
        ctx.beginPath();
        ctx.ellipse(vx, vy, vr * pose.core.sx, vr * pose.core.sy, 0, 0, TAU);
        ctx.fillStyle = vac.color || '#c7f7e5';
        ctx.globalAlpha = alpha * (vac.alpha == null ? 0.42 : vac.alpha);
        ctx.fill();
        ctx.strokeStyle = vac.rim || body.rim || '#8fe6c8';
        ctx.lineWidth = Math.max(1, S * 0.008);
        ctx.globalAlpha = alpha * 0.35;
        ctx.stroke();
        // isi vakuola: butir gelap (sisa patogen), bergeser pelan
        if (vac.content) {
          ctx.beginPath();
          ctx.arc(vx + Math.cos(waktu * 0.9 + seed) * vr * 0.35, vy + Math.sin(waktu * 1.1 + seed) * vr * 0.3, vr * 0.32, 0, TAU);
          ctx.fillStyle = vac.content;
          ctx.globalAlpha = alpha * 0.5;
          ctx.fill();
        }
      }
      ctx.globalAlpha = alpha;
    }

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

    // ---------- GRANULA (data `granules`) — sitoplasma padat butir ----------
    // Eosinofil/basofil/sel mast: identitas dari kepadatan & warna butir, bukan wajah.
    const gr = c.granules || null;
    if (gr && gr.count) {
      const ng = gr.count | 0;
      ctx.fillStyle = gr.color || body.rim || '#8fe6c8';
      ctx.globalAlpha = alpha * (gr.alpha == null ? 0.55 : gr.alpha);
      for (let k = 0; k < ng; k++) {
        // sebaran deterministik (hash) — tidak berkedip antar frame
        const h1 = Math.sin(k * 12.9898 + 78.233) * 43758.5453, u1 = h1 - Math.floor(h1);
        const h2 = Math.sin(k * 39.346 + 11.135) * 24634.6345, u2 = h2 - Math.floor(h2);
        const a = u1 * TAU, rr = Math.sqrt(u2) * (gr.spread || 0.8);
        const gx = Math.cos(a) * rx * rr + Math.sin(waktu * 0.8 + k) * S * 0.006;
        const gy = Math.sin(a) * ry * rr + Math.cos(waktu * 0.7 + k * 1.3) * S * 0.006;
        const grad = (gr.r || 0.028) * S * (0.7 + 0.6 * ((k * 5) % 3) / 2);
        ctx.beginPath();
        ctx.arc(gx, gy, grad, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
    }

    // ---------- TONJOLAN MEMBRAN (data `spikes`) — dendrit / vili / duri ----------
    // Dendritik: dendrit panjang bercabang; sel mast: vili pendek rapat; tcd8: sedikit, tajam.
    const sp = c.spikes || null;
    if (sp && sp.count) {
      const ns = sp.count | 0;
      ctx.strokeStyle = sp.color || body.rim || '#8fe6c8';
      ctx.lineCap = 'round';
      ctx.globalAlpha = alpha * (sp.alpha == null ? 0.8 : sp.alpha);
      for (let k = 0; k < ns; k++) {
        const a = (k / ns) * TAU + (sp.offset || 0.3) + Math.sin(waktu * (sp.sway || 0.9) + k * 2.1) * (sp.swayAmp || 0.06);
        const depan = 0.5 + 0.5 * Math.cos(a);
        const atas = 0.5 - 0.5 * Math.sin(a);
        const len = (sp.len || 0.2) * (0.6 + 0.4 * depan) * (0.3 + 0.7 * atas) * (1 + 0.15 * Math.sin(waktu * 1.7 + k));
        const ri = 1 + Math.sin(a * lobes + waktu * speed) * amp;
        const x0 = Math.cos(a) * rx * ri * 0.96, y0 = Math.sin(a) * ry * ri * 0.96;
        const x1 = Math.cos(a) * rx * (ri + len), y1 = Math.sin(a) * ry * (ri + len);
        ctx.lineWidth = Math.max(1, S * (sp.thick || 0.03));
        ctx.beginPath(); ctx.moveTo(x0, y0);
        if (sp.branch) {
          const xm = Math.cos(a) * rx * (ri + len * 0.55), ym = Math.sin(a) * ry * (ri + len * 0.55);
          ctx.lineTo(xm, ym);
          ctx.lineTo(Math.cos(a + 0.18) * rx * (ri + len), Math.sin(a + 0.18) * ry * (ri + len));
          ctx.moveTo(xm, ym);
          ctx.lineTo(Math.cos(a - 0.14) * rx * (ri + len * 0.9), Math.sin(a - 0.14) * ry * (ri + len * 0.9));
        } else {
          ctx.lineTo(x1, y1);
        }
        ctx.stroke();
        if (sp.tipR) {
          ctx.fillStyle = sp.tip || sp.color || '#8fe6c8';
          ctx.beginPath(); ctx.arc(x1, y1, sp.tipR * S, 0, TAU); ctx.fill();
        }
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
      ctx.globalAlpha = alpha * 0.32; // pudar: organel = tekstur, jangan terbaca sebagai "mata"
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
