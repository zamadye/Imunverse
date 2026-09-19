/**
 * gen-hero-rig.mjs — MEMBUAT file .riv rig lokomosi hero (Rive) dari kode.
 *
 *   node tools/gen-hero-rig.mjs            → assets/rive/hero-locomotion.riv
 *   node tools/gen-hero-rig.mjs --out x.riv
 *
 * KENAPA ADA FILE INI
 * -------------------
 * Rive normalnya diauthor di Rive Editor (.rev). Di repo ini rig-nya
 * DIBUAT DARI KODE supaya bisa di-review, di-diff, dan direproduksi tanpa
 * editor berpemilik: yang disimpan di git adalah HASILnya (.riv) + skrip
 * ini, jadi siapa pun bisa menjalankan ulang dan mendapat byte yang sama.
 *
 * YANG DIHASILKAN: satu artboard berisi rig bertingkat
 *   root → body → head / armF / armB / legF / legB
 * dan dua animasi linear:
 *   · idle  — napas halus (badan mengembang, kepala sedikit naik-turun)
 *   · walk  — 1 siklus = 2 langkah: ayun kaki berlawanan fase, ayun lengan
 *             berlawanan kaki, head-bob dua kali per siklus (turun saat kaki
 *             menapak), sedikit twist badan & squash-stretch.
 *
 * Rig ini TIDAK menggambar apa pun: ia adalah SUMBER GERAKAN. Nilai
 * transform-nya dibaca tiap frame oleh js/render/rive-rig.js lalu dipakai
 * menggerakkan FOTO hero (karakter tetap foto aslinya — lihat constraint
 * "mutasi = foto karakter sendiri yang ikut bergerak").
 *
 * CATATAN FORMAT .riv (ditemukan dari eksperimen, bukan asumsi)
 * ------------------------------------------------------------
 * · parentId = 0 → anak langsung artboard; selainnya = JARAK objek ke
 *   induknya (parent = objects[indeks_berjalan - parentId]), BUKAN jarak ke
 *   leluhur paling atas. Generator pihak ketiga yang kami coba memakai jarak
 *   ke leluhur → keyframe tidak pernah dipakai runtime.
 * · KeyedObject.objectId = indeks LOKAL terhadap artboard (indeks absolut
 *   dikurangi indeks artboard), bukan indeks absolut di file.
 * · Rotasi disimpan dalam RADIAN; interpolasi 'cubic' butuh objek
 *   KeyFrameInterpolator tersendiri, jadi kita pakai 'linear' dengan
 *   sampling rapat (tiap 2 frame) — hasilnya tetap mulus.
 */

import fs from 'node:fs';
import path from 'node:path';

// ====== format .riv: primitif biner ======

class BinaryWriter {
  constructor() { this.buf = []; }
  varUint(v) {
    if (v < 0) throw new Error('varUint negatif: ' + v);
    do { let b = v & 0x7f; v >>>= 7; if (v !== 0) b |= 0x80; this.buf.push(b); } while (v !== 0);
  }
  byte(v) { this.buf.push(v & 0xff); }
  float(v) {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, v, true);
    for (let i = 0; i < 4; i++) this.buf.push(view.getUint8(i));
  }
  uint32(v) { this.buf.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff); }
  string(v) { const b = new TextEncoder().encode(v); this.varUint(b.length); for (const c of b) this.byte(c); }
  toUint8Array() { return new Uint8Array(this.buf); }
}

const OT = { Backboard: 23, Artboard: 1, Node: 2, LinearAnimation: 31, KeyedObject: 25, KeyedProperty: 26, KeyFrameDouble: 30 };
const PK = { name: 4, parentId: 5, width: 7, height: 8, originX: 11, originY: 12, x: 13, y: 14, rotation: 15, scaleX: 16, scaleY: 17, fps: 56, duration: 57, speed: 58, loopValue: 59, objectId: 51, propertyKeyId: 53, frame: 67, interpolationType: 68, keyFrameValue: 70 };
// tipe field per properti: 0 = VarUint, 1 = String, 2 = Float32
const FT = { [PK.name]: 1, [PK.width]: 2, [PK.height]: 2, [PK.originX]: 2, [PK.originY]: 2, [PK.x]: 2, [PK.y]: 2, [PK.rotation]: 2, [PK.scaleX]: 2, [PK.scaleY]: 2, [PK.fps]: 0, [PK.duration]: 0, [PK.speed]: 2, [PK.loopValue]: 0, [PK.objectId]: 0, [PK.propertyKeyId]: 0, [PK.frame]: 0, [PK.interpolationType]: 0, [PK.keyFrameValue]: 2 };

class Riv {
  constructor() { this.objects = []; this.add(OT.Backboard, {}); this.artboardId = 0; }
  add(type, props, absParent) { const id = this.objects.length; this.objects.push({ type, props, absParent }); return id; }
  artboard(name, w, h) {
    const id = this.add(OT.Artboard, { [PK.name]: name, [PK.width]: w, [PK.height]: h, [PK.originX]: 0.5, [PK.originY]: 0.5 });
    this.artboardId = id; return id;
  }
  node(parent, name, x, y) { return this.add(OT.Node, { [PK.name]: name, [PK.x]: x, [PK.y]: y }, parent); }
  anim(parent, name, fps, duration, loop = 1) {
    return this.add(OT.LinearAnimation, { [PK.name]: name, [PK.fps]: fps, [PK.duration]: duration, [PK.speed]: 1, [PK.loopValue]: loop }, parent);
  }
  keyed(animId, targetId) { return this.add(OT.KeyedObject, { [PK.objectId]: targetId - this.artboardId }, animId); }
  prop(koId, key) { return this.add(OT.KeyedProperty, { [PK.propertyKeyId]: key }, koId); }
  /** Tambah satu kurva: daftar [frame, nilai] → keyframe linear. */
  curve(animId, targetId, key, frames) {
    const ko = this.keyed(animId, targetId);
    const kp = this.prop(ko, key);
    for (const [frame, value] of frames) {
      this.add(OT.KeyFrameDouble, { [PK.frame]: frame, [PK.keyFrameValue]: value, [PK.interpolationType]: 1 }, kp);
    }
    return kp;
  }
  export() {
    const w = new BinaryWriter();
    for (const c of 'RIVE') w.byte(c.charCodeAt(0));
    w.varUint(7); w.varUint(0); w.varUint(0); // major.minor, fileId
    w.varUint(160); w.varUint(0); w.uint32(0); // ToC properti ekstensi (kosong)
    for (let i = 0; i < this.objects.length; i++) {
      const o = this.objects[i];
      w.varUint(o.type);
      const keys = Object.keys(o.props).map(Number);
      if (keys.includes(PK.name)) { w.varUint(PK.name); w.string(String(o.props[PK.name])); }
      if (o.absParent !== undefined) {
        // 0 = anak artboard; selainnya jarak mundur ke induk (lihat catatan format)
        const rel = o.absParent === this.artboardId ? 0 : i - o.absParent;
        w.varUint(PK.parentId); w.varUint(rel);
      }
      for (const k of keys) {
        if (k === PK.name) continue;
        w.varUint(k);
        const v = o.props[k];
        const t = FT[k] ?? 2;
        if (t === 0) w.varUint(typeof v === 'boolean' ? (v ? 1 : 0) : Math.round(Number(v)));
        else if (t === 1) w.string(String(v));
        else w.float(Number(v));
      }
      w.varUint(0); // akhir properti objek
    }
    return w.toUint8Array();
  }
}

// ====== definisi rig ======

const RIG = {
  artboard: { name: 'hero', width: 100, height: 100 },
  walk: { fps: 30, duration: 20, sampleEvery: 2 },   // 0,667 s / siklus = 2 langkah
  idle: { fps: 30, duration: 90, sampleEvery: 6 },   // 3 s / siklus napas
  // Posisi lokal (unit artboard; karakter ±30 unit dari pusat)
  pose: { root: [50, 50], body: [0, 0], head: [0, -30], armF: [11, -6], armB: [-11, -6], legF: [8, 18], legB: [-8, 18] },
  amp: {
    bobPx: 3.0,        // head-bob total (naik-turun) per langkah
    twist: 0.035,      // twist badan (rad)
    squash: 0.012,     // squash-stretch badan
    armSwing: 0.32,    // ayun lengan (rad)
    legSpan: 36.9,     // setengah stride (unit rig) = (stride 48px / unitPx 0,65) / 2
    legLen: 70.9,      // panjang kaki model → ayunan maks = asin(36,9/70,9) ≈ 0,55 rad (31°)
    legLift: 2.6,      // angkat kaki saat mengayun (unit)
    headTilt: 0.022,
    headBob: 0.9,
    idleBreath: 0.02,
    idleRise: 0.7,
    idleSwing: 0.03,
  },
};

/**
 * Satu kaki selama siklus: ph = 0..1, di mana 0 = saat telapak mendarat.
 *  · STANCE (0 … 0,5): kaki MENAPAK. Supaya tidak selip, telapak harus diam
 *    di tanah → posisinya terhadap pinggul bergerak MUNDUR lurus sebanyak
 *    satu stride, persis mengimbangi badan yang maju.
 *  · SWING  (0,5 … 1): kaki terangkat lalu maju lagi (siap menapak).
 * Ayunan sinusoidal murni (rotasi = A·sin θ) TIDAK bisa memberi hasil ini:
 * telapaknya justru menyapu tanah ~110% stride (diukur). Makanya bentuknya
 * dibalik dari lintasan telapak yang diinginkan, bukan dari sinus.
 */
function legPose(ph) {
  const A = RIG.amp;
  const cl = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
  const rotOf = (relX) => Math.asin(cl(relX / A.legLen));
  if (ph < 0.5) {
    const u = ph / 0.5;                       // 0 → 1 selama stance
    return { rotation: rotOf(A.legSpan * (1 - 2 * u)), y: RIG.pose.legF[1] };
  }
  const u = (ph - 0.5) / 0.5;                 // 0 → 1 selama swing
  return { rotation: rotOf(A.legSpan * (-1 + 2 * u)), y: RIG.pose.legF[1] - A.legLift * Math.sin(Math.PI * u) };
}

/** Kurva siklus jalan: p = 0..1 (1 siklus = 2 langkah). */
function walkPose(p) {
  const A = RIG.amp;
  const th = Math.PI * 2 * p;               // fase siklus
  const bob = (0.5 - 0.5 * Math.cos(2 * th)); // 2 puncak per siklus (turun saat menapak)
  const legF = legPose(p % 1);
  const legB = legPose((p + 0.5) % 1);      // kaki satunya setengah siklus tertinggal
  return {
    body: { y: A.bobPx * (0.5 - bob), rotation: A.twist * Math.sin(th), scaleX: 1 - A.squash * Math.cos(2 * th), scaleY: 1 + A.squash * Math.cos(2 * th) },
    head: { y: RIG.pose.head[1] - A.headBob * bob, rotation: -A.headTilt * Math.sin(th) },
    armF: { rotation: -A.armSwing * Math.sin(th) },
    armB: { rotation: A.armSwing * Math.sin(th) },
    legF: { rotation: legF.rotation, y: legF.y },
    legB: { rotation: legB.rotation, y: legB.y },
  };
}

/** Kurva diam: napas pelan, kaki diam. */
function idlePose(p) {
  const A = RIG.amp;
  const th = Math.PI * 2 * p;
  const breath = 0.5 - 0.5 * Math.cos(th);
  return {
    body: { y: -A.idleRise * breath, rotation: 0, scaleX: 1 - A.idleBreath * breath, scaleY: 1 + A.idleBreath * breath },
    head: { y: RIG.pose.head[1] - 0.35 * breath, rotation: 0 },
    armF: { rotation: A.idleSwing * Math.sin(th) },
    armB: { rotation: -A.idleSwing * Math.sin(th) },
    legF: { rotation: 0, y: RIG.pose.legF[1] },
    legB: { rotation: 0, y: RIG.pose.legB[1] },
  };
}

/** Sampling pose jadi deretan keyframe per properti. */
function sampleCurve(cfg, fn, prop) {
  const out = [];
  const n = Math.round(cfg.duration / cfg.sampleEvery);
  for (let i = 0; i <= n; i++) {
    const frame = Math.min(cfg.duration, Math.round(i * cfg.sampleEvery));
    const v = fn(frame / cfg.duration)[prop];
    out.push([frame, +Number(v).toFixed(5)]);
  }
  // buang duplikasi frame di ujung (pembulatan)
  return out.filter((f, i) => i === 0 || f[0] !== out[i - 1][0]);
}

export function buildRig() {
  const r = new Riv();
  const ab = r.artboard(RIG.artboard.name, RIG.artboard.width, RIG.artboard.height);
  const P = RIG.pose;
  const root = r.node(ab, 'root', P.root[0], P.root[1]);
  const body = r.node(root, 'body', P.body[0], P.body[1]);
  const head = r.node(body, 'head', P.head[0], P.head[1]);
  const armF = r.node(body, 'armF', P.armF[0], P.armF[1]);
  const armB = r.node(body, 'armB', P.armB[0], P.armB[1]);
  const legF = r.node(body, 'legF', P.legF[0], P.legF[1]);
  const legB = r.node(body, 'legB', P.legB[0], P.legB[1]);

  const parts = { body, head, armF, armB, legF, legB };
  // PENTING: keyframe setiap animasi ditulis MENEMPEL tepat setelah objek
  // animasinya. Kalau dua animasi dibuat dulu baru semua kurvanya, runtime
  // Rive menempelkan kurva ke animasi yang salah (diuji: kurva walk masuk
  // ke animasi idle dan sebaliknya). Jadi: animasi → kurva → animasi → kurva.
  for (const [name, cfg, fn] of [['walk', RIG.walk, walkPose], ['idle', RIG.idle, idlePose]]) {
    const animId = r.anim(ab, name, cfg.fps, cfg.duration, 1);
    for (const [part, id] of Object.entries(parts)) {
      const base = RIG.pose[part] || [0, 0];
      const pose0 = fn(0)[part];
      if (pose0.y !== undefined && base[1] !== undefined) r.curve(animId, id, PK.y, sampleCurve(cfg, (p) => fn(p)[part], 'y'));
      if (pose0.rotation !== undefined) r.curve(animId, id, PK.rotation, sampleCurve(cfg, (p) => fn(p)[part], 'rotation'));
      if (part === 'body') {
        r.curve(animId, id, PK.scaleX, sampleCurve(cfg, (p) => fn(p).body, 'scaleX'));
        r.curve(animId, id, PK.scaleY, sampleCurve(cfg, (p) => fn(p).body, 'scaleY'));
      }
    }
  }
  return r.export();
}

// ====== CLI ======

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (!isMain) { /* diimpor oleh tools/verify-rive.mjs — jangan menulis berkas */ } else {
const arg = process.argv.indexOf('--out');
const out = arg > -1 ? process.argv[arg + 1] : path.join('assets', 'rive', 'hero-locomotion.riv');
const bytes = buildRig();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, bytes);
console.log(`[gen-hero-rig] ${out} — ${bytes.length} byte`);
console.log('[gen-hero-rig] artboard "hero": root→body→{head, armF, armB, legF, legB}; animasi: idle (90f), walk (20f = 2 langkah)');
}

// diekspor untuk tools/verify-rive.mjs (inspeksi struktur .riv di penguji)
export { Riv, OT, PK, RIG, walkPose, idlePose, sampleCurve };
