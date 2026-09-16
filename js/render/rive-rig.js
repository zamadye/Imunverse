/**
 * rive-rig.js — Menjalankan animasi Rive (file .riv) sebagai SUMBER GERAKAN hero.
 *
 * KENAPA RIVE
 * -----------
 * Gerakan hero dulu dirakit dari rumus sinus di kode. Rive dipakai supaya
 * siklus jalan (ayun kaki/lengan, head-bob, squash-stretch) jadi DATA
 * animasi sungguhan: bisa di-tune, diputar lebih cepat/lambat tanpa distorsi,
 * dan dicampur (idle ↔ walk) oleh state machine runtime-nya sendiri.
 *
 * YANG TIDAK BERUBAH
 * ------------------
 * Yang digambar di layar TETAP FOTO karakter (syarat mutasi: "bentuk mutasi =
 * foto karakternya sendiri yang ikut bergerak", bukan overlay gambar).
 * Rig .riv ini tidak punya artwork: ia hanya berisi node transform kosong
 * (root → body → head/armF/armB/legF/legB) yang nilainya dibaca tiap frame
 * lalu dipakai menggerakkan foto itu.
 *
 * SINKRONISASI FOOT-PLANTING
 * --------------------------
 * Laju putar animasi jalan dikunci ke JARAK yang ditempuh, bukan ke waktu:
 *   rate = kecepatan / nominalSpeed,  nominalSpeed = 2 × stride / cycleSec
 * Jadi kaki menapak tepat setiap kali hero menempuh satu stride — tidak ada
 * "kaki menyapu tanah lebih cepat dari badan bergerak" (foot sliding).
 *
 * GAGAL = AMAN
 * ------------
 * Runtime Rive (wasm ~1,9 MB) dimuat MALAS dan di luar jalur kritis. Kalau
 * gagal (offline, browser lama tanpa SIMD, file .riv hilang), modul ini
 * berstatus 'fallback' dan game memakai rumus analitik yang sama seperti
 * sebelumnya — tampilan tidak rusak, hanya kurang kaya.
 */

const NODES = ['body', 'head', 'armF', 'armB', 'legF', 'legB'];

/** URL absolut terhadap modul ini; kalau import.meta kosong (bundle IIFE),
 *  jatuh ke jalur relatif terhadap index.html — tetap bisa dimuat browser. */
function vendorUrl(rel) {
  try {
    return new URL(rel, import.meta.url).href;
  } catch {
    return 'js/vendor/rive/' + String(rel).replace(/^\.\.\/vendor\/rive\//, '');
  }
}
const RUNTIME_URL = vendorUrl('../vendor/rive/canvas_advanced.js');
const WASM_URL = vendorUrl('../vendor/rive/rive.wasm');

const state = {
  status: 'idle',      // idle → loading → ready | fallback
  promise: null,
  rive: null,
  file: null,
  artboard: null,
  instIdle: null,
  instWalk: null,
  walkDur: 0.667,
  node: {},            // pegangan node (hidup selama artboard ada)
  walkTime: 0,
  error: null,
};

/** Status rig: 'idle' | 'loading' | 'ready' | 'fallback'. */
export function rigStatus() {
  return state.status;
}

/** Alasan terakhir rig gagal dimuat (untuk log/dev). */
export function rigError() {
  return state.error;
}

/**
 * Muat runtime + file .riv sekali saja. Dipanggil dari player.update() —
 * tidak pernah melempar; kegagalan mengubah status jadi 'fallback'.
 */
export function ensureRig() {
  if (state.status === 'ready' || state.status === 'fallback') return state.promise;
  if (state.promise) return state.promise;
  state.status = 'loading';
  state.promise = (async () => {
    try {
      if (typeof WebAssembly === 'undefined') throw new Error('WebAssembly tidak didukung');
      const cfg = (await import('../core/data-store.js')).getLocomotion?.() || null;
      const riveCfg = cfg?.rive || {};
      if (riveCfg.enabled === false) throw new Error('rive dimatikan di data/locomotion.json');
      const mod = await import(/* @vite-ignore */ RUNTIME_URL);
      const RiveCanvas = mod.default || mod.RiveCanvas || mod;
      if (typeof RiveCanvas !== 'function') throw new Error('runtime Rive tidak berbentuk factory');
      const runtime = await RiveCanvas({
        locateFile: (f) => (String(f).endsWith('.wasm') ? WASM_URL : f),
        // Node/penguji boleh menyuntikkan wasm dari disk lewat opsi ini
        ...(globalThis.__PHAGOS_RIVE_WASM_BINARY ? { wasmBinary: globalThis.__PHAGOS_RIVE_WASM_BINARY } : {}),
      });
      const res = await fetch(riveCfg.rig || 'assets/rive/hero-locomotion.riv');
      if (!res.ok) throw new Error('gagal memuat ' + (riveCfg.rive?.rig || 'rig') + ' (' + res.status + ')');
      const bytes = new Uint8Array(await res.arrayBuffer());
      const file = await runtime.load(bytes);
      const artboard = (riveCfg.artboard && file.artboardByName ? file.artboardByName(riveCfg.artboard) : null) || file.defaultArtboard();
      if (!artboard) throw new Error('artboard rig tidak ditemukan');
      const byDur = new Map();
      for (let i = 0; i < artboard.animationCount(); i++) {
        const a = artboard.animationByIndex(i);
        byDur.set(a.duration, a);
      }
      const pick = (wantDur) => {
        for (let i = 0; i < artboard.animationCount(); i++) {
          const a = artboard.animationByIndex(i);
          if (Math.abs(a.duration - wantDur) < 0.5) return a;
        }
        return null;
      };
      const walkAnim = pick(20) || (artboard.animationCount() > 0 ? artboard.animationByIndex(0) : null);
      const idleAnim = pick(90) || (artboard.animationCount() > 1 ? artboard.animationByIndex(1) : null);
      if (!walkAnim || !idleAnim) throw new Error('animasi walk/idle tidak lengkap');
      for (const n of NODES) state.node[n] = artboard.node(n);
      state.rive = runtime;
      state.file = file;
      state.artboard = artboard;
      state.walkDur = (walkAnim.duration || 20) / (walkAnim.fps || 30);
      state.instWalk = new runtime.LinearAnimationInstance(walkAnim, artboard);
      state.instIdle = new runtime.LinearAnimationInstance(idleAnim, artboard);
      void byDur;
      state.status = 'ready';
    } catch (err) {
      state.status = 'fallback';
      state.error = String(err && err.message ? err.message : err);
      if (typeof console !== 'undefined') console.warn('[rive-rig] jatuh ke animasi analitik:', state.error);
    }
    return state.status;
  })();
  return state.promise;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Satu langkah maju animasi rig.
 * @param {number} dt         delta waktu (detik)
 * @param {object} o
 * @param {number} o.moveAmt  0..1 seberapa kuat berjalan (bobot campuran walk)
 * @param {number} o.speed    kecepatan aktual (px/s)
 * @param {number} o.nominalSpeed kecepatan saat animasi berjalan 1× (px/s)
 * @param {object} o.cfg      data/locomotion.json
 * @returns {object|null} pose terpakai, atau null bila rig belum siap
 */
export function updateRig(dt, o) {
  if (state.status !== 'ready') return null;
  const cfg = (o && o.cfg) || {};
  const riveCfg = cfg.rive || {};
  const moveAmt = clamp((o && o.moveAmt) || 0, 0, 1);
  const nominal = Math.max(1, (o && o.nominalSpeed) || 144);
  const rate = clamp(((o && o.speed) || 0) / nominal, riveCfg.minRate || 0.15, riveCfg.maxRate || 2.8);

  try {
    // Foot-planting: animasi jalan dimajukan sebanding JARAK yang ditempuh.
    state.walkTime += dt * rate;
    state.instWalk.advance(dt * rate);
    state.instIdle.advance(dt);
    state.instIdle.apply(1 - moveAmt);
    state.instWalk.apply(moveAmt);
    state.artboard.advance(dt);
  } catch (err) {
    state.status = 'fallback';
    state.error = String(err && err.message ? err.message : err);
    return null;
  }

  const unit = riveCfg.unitPx || 0.65;
  const bobUnit = riveCfg.bobUnitPx || 1.25;
  const legLenUnits = riveCfg.legLenUnits || 70.9;
  const b = state.node.body || {};
  const lf = state.node.legF || {};
  const lb = state.node.legB || {};
  const pose = {
    bob: (b.y || 0) * bobUnit,
    tilt: (b.rotation || 0),
    sx: b.scaleX || 1,
    sy: b.scaleY || 1,
    headTilt: (state.node.head?.rotation) || 0,
    headLift: (((state.node.head?.y) ?? -30) + 30) * unit,
    legSwing: lf.rotation || 0,
    legSwingB: lb.rotation || 0,
    // kaki dikatakan menapak bila tidak terangkat dari baseline (18 unit)
    legContact: 1 - clamp((18 - (lf.y || 18)) / 2.6, 0, 1),
    legContactB: 1 - clamp((18 - (lb.y || 18)) / 2.6, 0, 1),
    armSwing: (state.node.armF?.rotation) || 0,
    // Telapak kaki relatif terhadap pinggul (px) & seberapa terangkat (px).
    // Dipakai penguji untuk membuktikan FOOT-PLANTING: selama menapak,
    // posisi dunia telapak (jarak tempuh + footX) harus TETAP.
    footX: Math.sin(lf.rotation || 0) * legLenUnits * unit,
    footXB: Math.sin(lb.rotation || 0) * legLenUnits * unit,
    footLift: (18 - (lf.y || 18)) * unit,
    footLiftB: (18 - (lb.y || 18)) * unit,
    cycle: (state.walkTime / (state.walkDur || 0.667)) % 1,
    cycleTotal: state.walkTime / (state.walkDur || 0.667),
    rate,
  };
  return pose;
}

/** Pose terakhir (untuk debug/penguji). */
export function lastRigNode(name) {
  const n = state.node[name];
  if (!n) return null;
  return { x: n.x, y: n.y, rotation: n.rotation, scaleX: n.scaleX, scaleY: n.scaleY };
}

/** Siklus jalan rig (0..1) — dipakai penguji untuk cek sinkronisasi langkah. */
export function rigCycle() {
  return (state.walkTime / (state.walkDur || 0.667)) % 1;
}
