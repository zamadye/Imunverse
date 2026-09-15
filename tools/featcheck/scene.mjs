/**
 * scene.mjs — Logika scene cutscene pembuka (Feasibility Check 3D, Task 1).
 *
 * Sumber shot list & naskah: docs/design/imunverse-story-narrative-design-doc.md
 *   Bagian 7.2 (5 shot pembuka) + Bagian 6.1 (naskah Dr. Amara & RIA — final, TIDAK diubah).
 *
 * Modul ini murni LOGIKA (tanpa renderer): timeline shot, interpolasi kamera,
 * sistem partikel, sinkronisasi dialog. Dipakai oleh:
 *  - bench-node.mjs  : ukur biaya JS per frame (Node)
 *  - spike-3d.html   : variant A — 3D penuh (three.js di browser)
 *  - spike-2d.html   : variant B — 2.5D layered (Canvas 2D, sesuai story doc 7.1)
 *  - benchmark.html  : self-test di device nyata
 *
 * Kontrak: createScene(variant) → { state, tick(dt, t), shotAt(t), sizeInfo() }
 */

// ---------------------------------------------------------------------
// Timeline (durasi total 48 dtk sesuai story doc 7.3: pembuka 45-60 dtk)
// ---------------------------------------------------------------------
export const SHOTS = [
  { id: 'ruang_wide',   t0: 0,  t1: 8,  label: 'Wide ruang periksa' },
  { id: 'tangan_close', t0: 8,  t1: 14, label: 'Close-up luka tangan Inang' },
  { id: 'matchcut',     t0: 14, t1: 17, label: 'Match-cut: zoom masuk luka → dunia mikro' },
  { id: 'ria_sinyal',   t0: 17, t1: 25, label: 'RIA sinyal menyala di HUD' },
  { id: 'mikro_estab',  t0: 25, t1: 48, label: 'Establishing dunia mikro (pembuluh darah)' },
];

// Naskah = story doc 6.1 VERBATIM (final). Durasi VO = ukur file TTS aktual
// (assets/audio/narration/*, tag Xing: 426 frame @32kHz = 15.3 s; 577 frame = 20.8 s).
export const DIALOG = [
  { t: 1.0,  who: 'amara', dur: 20.8, text: 'Cuma luka gores kok, tapi tetap harus diperhatikan — kalau kotor sedikit saja, bisa infeksi. Untungnya tubuh kita udah ada pasukan sendiri yang langsung siaga begitu ada luka.' },
  { t: 18.5, who: 'ria',   dur: 15.3, text: 'Woy, bangun! Ada celah masuk di lengan sebelah sini, dan bakteri udah mulai nyusup duluan. Lo satu-satunya yang deket lokasi — gerak sekarang, gih!' },
];

export function shotAt(t) {
  for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].t0) return SHOTS[i];
  return SHOTS[0];
}

const smooth = (x) => x * x * (3 - 2 * x); // smoothstep
const lerp = (a, b, k) => a + (b - a) * k;
function lerp3(out, a, b, k) { out[0] = lerp(a[0], b[0], k); out[1] = lerp(a[1], b[1], k); out[2] = lerp(a[2], b[2], k); return out; }

// ---------------------------------------------------------------------
// Konfigurasi kedua varian — angka = spec scene aktual (bukan placeholder)
// ---------------------------------------------------------------------
const CONFIG = {
  A: { // 3D penuh (three.js)
    riaParticles: 300,      // swarm sinyal RIA (doc 7.1: RIA = partikel)
    virionParticles: 150,   // patogen melayang di pembuluh darah
    bloodParticles: 120,    // sel darah latar
    tunnelSeg: 96,          // segment tabung pembuluh
    roomMeshes: 10,         // dinding/lantai/perabot (plane & box)
    billboards: 3,          // Mako, Dr. Amara, siluet Inang (tekstur PNG game)
  },
  B: { // 2.5D layered (Canvas 2D, story doc 7.1)
    parallaxLayers: 3,      // per scene: bg/mid/fg
    riaParticles: 300,
    virionParticles: 150,
    sprites: 4,             // Mako, Amara, Inang-siluet, luka
  },
};

// ---------------------------------------------------------------------
// Variant A — dunia 3D (posisi/keyframe kamera; partikel di Float32Array)
// ---------------------------------------------------------------------
function createSceneA(cfg) {
  const nRia = cfg.riaParticles, nVir = cfg.virionParticles, nBld = cfg.bloodParticles;
  const ria = new Float32Array(nRia * 3);
  const vir = new Float32Array(nVir * 3);
  const bld = new Float32Array(nBld * 3);
  const virAng = new Float32Array(nVir), virR = new Float32Array(nVir), virY = new Float32Array(nVir), virW = new Float32Array(nVir);
  const bldV = new Float32Array(nBld * 3);
  for (let i = 0; i < nRia; i++) { ria[i*3] = (Math.random()-0.5)*2.4; ria[i*3+1] = (Math.random()-0.5)*1.6; ria[i*3+2] = (Math.random()-0.5)*1.2; }
  for (let i = 0; i < nVir; i++) { virAng[i] = Math.random()*6.283; virR[i] = 1.6+Math.random()*2.2; virY[i] = -1.2+Math.random()*2.4; virW[i] = 0.15+Math.random()*0.35; }
  for (let i = 0; i < nBld; i++) { bld[i*3] = (Math.random()-0.5)*14; bld[i*3+1] = (Math.random()-0.5)*7; bld[i*3+2] = (Math.random()-0.5)*10; bldV[i*3] = 0.1+Math.random()*0.2; bldV[i*3+1] = (Math.random()-0.5)*0.05; bldV[i*3+2] = 0; }

  // Keyframe kamera per shot (7.2): wide → close luka → match-cut → RIA → establishing mikro
  const CAM = {
    ruang_wide:   { pos: [0, 1.6, 5.2],  look: [0, 1.0, 0] },
    tangan_close: { pos: [0.4, 1.1, 1.4], look: [0.2, 0.9, 0] },
    matchcut:     { pos: [0.2, 0.9, 0.55], look: [0.2, 0.9, 0] },
    ria_sinyal:   { pos: [0, 0.4, -2.0], look: [0, 0.3, -6] },
    mikro_estab:  { pos: [0, 0.3, -4.0], look: [0, 0.2, -14] },
  };

  const state = {
    cfg, t: 0,
    camPos: [0, 0, 0], camLook: [0, 0, -1],
    matchcut: 0, // 0..1 (zoom + shift warna; shift warna di-exec di renderer)
    billboards: [ // (x,y,z) world — Mako, Amara, Inang
      { p: [0, 0, -1.5], q: [0, 0, 0] },
      { p: [0.55, 0.55, 0.4], q: [0, 0, 0] },
      { p: [-0.7, 0.7, 0.2], q: [0, 0, 0] },
    ],
    ria, vir, bld,
    curShot: SHOTS[0], shotK: 0,
    diaIndex: -1,
  };

  function tick(dt) {
    const s = state;
    s.t += dt;
    const t = s.t % 48;
    const shot = shotAt(t);
    if (shot !== s.curShot) { s.curShot = shot; s.shotK = 0; }
    s.shotK = Math.min(1, s.shotK + dt / 1.2); // ease-in 1.2 dtk antar shot
    const k = smooth(s.shotK);
    const c = CAM[shot.id];
    if (shot.id === 'matchcut') {
      // kamera MELEBAR keluar saat match-cut (dari luka → mikro)
      const mk = (t - 14) / 3;
      s.camPos = [lerp(0.2, 0, mk), lerp(0.9, 0.4, mk), lerp(0.55, -2.0, mk)];
      s.camLook = [lerp(0.2, 0, mk), lerp(0.9, 0.3, mk), lerp(0, -6, mk)];
      s.matchcut = Math.sin(mk * Math.PI); // 0→1→0: puncak transformasi
    } else {
      s.camPos = [c.pos[0], c.pos[1], c.pos[2]];
      s.camLook = [c.look[0], c.look[1], c.look[2]];
      s.matchcut *= Math.max(0, 1 - dt * 3);
    }
    // RIA pulse (sinyal berdenyut — doc 7.1)
    const pulse = 1 + 0.18 * Math.sin(t * 3.1);
    for (let i = 0; i < nRia; i++) {
      ria[i*3]   = (ria[i*3]   * 0.985) + (Math.random()-0.5)*0.02;
      ria[i*3+1] = (ria[i*3+1] * 0.985) + (Math.random()-0.5)*0.02;
      ria[i*3+2] = (ria[i*3+2] * 0.985) + (Math.random()-0.5)*0.015;
      // tarik kembali ke radius pulse
      const d = Math.hypot(ria[i*3], ria[i*3+1], ria[i*3+2]) || 1;
      if (d > 1.3 * pulse) { ria[i*3] *= (1.3*pulse)/d; ria[i*3+1] *= (1.3*pulse)/d; ria[i*3+2] *= (1.3*pulse)/d; }
    }
    // Virion: spiral pelan di sekitar sumbu pembuluh
    for (let i = 0; i < nVir; i++) {
      virAng[i] += virW[i] * dt;
      vir[i*3]   = Math.cos(virAng[i]) * virR[i];
      vir[i*3+1] = virY[i] + Math.sin(t * 0.7 + i) * 0.08;
      vir[i*3+2] = -6 - (i % 10) * 1.1 + Math.sin(virAng[i]) * virR[i] * 0.35;
    }
    // Sel darah: drift (parallax gerak alami)
    for (let i = 0; i < nBld; i++) {
      bld[i*3]   += bldV[i*3] * dt;
      bld[i*3+1] += bldV[i*3+1] * dt;
      bld[i*3+2] -= 0.12 * dt; // mengalir ke arah kamera
      if (bld[i*3+2] > 4) { bld[i*3] = (Math.random()-0.5)*14; bld[i*3+1] = (Math.random()-0.5)*7; bld[i*3+2] = -12; }
    }
    // Billboard menghadap kamera (lookAt sederhana: yaw + pitch)
    for (const bb of s.billboards) {
      const dx = s.camPos[0]-bb.p[0], dy = s.camPos[1]-bb.p[1], dz = s.camPos[2]-bb.p[2];
      bb.q[0] = Math.atan2(dx, dz);
      bb.q[1] = Math.atan2(dy, Math.hypot(dx, dz));
    }
    // Dialog: indeks baris aktif (VO sync di browser; di sini logika timing)
    let idx = -1;
    for (let i = 0; i < DIALOG.length; i++) if (t >= DIALOG[i].t && t < DIALOG[i].t + DIALOG[i].dur) { idx = i; break; }
    s.diaIndex = idx;
    return s;
  }

  return { state, tick, sizeInfo: () => ({
    note: 'three.js: scene graph ' + cfg.roomMeshes + ' mesh + 3 Points(' + nRia + '+' + nVir + '+' + nBld + ' partikel) + tabung ' + cfg.tunnelSeg + ' seg + ' + cfg.billboards + ' billboard tekstur',
  })};
}

// ---------------------------------------------------------------------
// Variant B — 2.5D layered (angka = spec render Canvas 2D yang identik
// secara cerita; parallax 3 layer + sprite keyframe + partikel 2D)
// ---------------------------------------------------------------------
function createSceneB(cfg) {
  const nRia = cfg.riaParticles, nVir = cfg.virionParticles;
  const ria = new Float32Array(nRia * 2);
  const vir = new Float32Array(nVir * 2);
  const virAng = new Float32Array(nVir), virR = new Float32Array(nVir), virW = new Float32Array(nVir);
  for (let i = 0; i < nRia; i++) { ria[i*2] = (Math.random()-0.5)*420; ria[i*2+1] = (Math.random()-0.5)*260; }
  for (let i = 0; i < nVir; i++) { virAng[i] = Math.random()*6.283; virR[i] = 60+Math.random()*160; virW[i] = 8+Math.random()*18; }

  // Keyframe kamera-2D: pan (px) + zoom per shot, relatif viewport 844×390
  const CAM2D = {
    ruang_wide:   { pan: 0,   zoom: 1.00, scene: 'ruang' },
    tangan_close: { pan: 90,  zoom: 1.90, scene: 'ruang' },
    matchcut:     { pan: 0,   zoom: 3.40, scene: 'ruang' },
    ria_sinyal:   { pan: -60, zoom: 1.20, scene: 'mikro' },
    mikro_estab:  { pan: -140,zoom: 1.05, scene: 'mikro' },
  };

  const state = {
    cfg, t: 0,
    pan: 0, zoom: 1, scene: 'ruang',
    layerOffset: [0, 0, 0], // parallax: fg/mid/bg = faktor × pan
    matchcut: 0,
    sprites: [ // {x,y,skew,breath} — Mako, Amara, Inang, luka
      { x: 0, y: 0, breath: 0 }, { x: 0, y: 0, breath: 0 }, { x: 0, y: 0, breath: 0 }, { x: 0, y: 0, breath: 0 },
    ],
    ria, vir, curShot: SHOTS[0], shotK: 0, diaIndex: -1,
  };

  function tick(dt) {
    const s = state;
    s.t += dt;
    const t = s.t % 48;
    const shot = shotAt(t);
    if (shot !== s.curShot) { s.curShot = shot; s.shotK = 0; }
    s.shotK = Math.min(1, s.shotK + dt / 1.2);
    const c = CAM2D[shot.id];
    const prev = CAM2D[s.curShot.id];
    const k = smooth(s.shotK);
    s.pan  = lerp(prev.pan, c.pan, k);
    s.zoom = lerp(prev.zoom, c.zoom, k);
    s.scene = c.scene;
    // Parallax: faktor kedalaman 1.0 / 0.55 / 0.25 (doc 7.1: 2-3 layer beda kecepatan)
    s.layerOffset[0] = s.pan * 1.0;
    s.layerOffset[1] = s.pan * 0.55;
    s.layerOffset[2] = s.pan * 0.25;
    if (shot.id === 'matchcut') {
      s.matchcut = Math.sin(((t - 14) / 3) * Math.PI);
    } else s.matchcut *= Math.max(0, 1 - dt * 3);
    // Sprite: breathing (idle motion doc 7.1: "cukup gerakan kepala/mulut + idle breathing")
    for (let i = 0; i < s.sprites.length; i++) s.sprites[i].breath = Math.sin(t * 1.6 + i * 1.3) * 2.2;
    // RIA 2D
    const pulse = 1 + 0.18 * Math.sin(t * 3.1);
    for (let i = 0; i < nRia; i++) {
      ria[i*2]   = ria[i*2]   * 0.985 + (Math.random()-0.5)*6;
      ria[i*2+1] = ria[i*2+1] * 0.985 + (Math.random()-0.5)*6;
      const d = Math.hypot(ria[i*2], ria[i*2+1]) || 1;
      if (d > 130 * pulse) { ria[i*2] *= (130*pulse)/d; ria[i*2+1] *= (130*pulse)/d; }
    }
    // Virion 2D (kiri-kanan, parallax ukuran)
    for (let i = 0; i < nVir; i++) {
      virAng[i] += (virW[i] * dt) / 40;
      vir[i*2]   = Math.cos(virAng[i]) * virR[i] - 422 - s.pan * 0.4;
      vir[i*2+1] = 195 + Math.sin(virAng[i] * 0.7 + i) * virR[i] * 0.5;
    }
    let idx = -1;
    for (let i = 0; i < DIALOG.length; i++) if (t >= DIALOG[i].t && t < DIALOG[i].t + DIALOG[i].dur) { idx = i; break; }
    s.diaIndex = idx;
    return s;
  }

  return { state, tick, sizeInfo: () => ({
    note: 'canvas2d: ' + cfg.parallaxLayers + ' layer parallax/scene × 2 scene + ' + cfg.sprites + ' sprite PNG (aset game existing) + partikel 2D ' + nRia + '+' + nVir,
  })};
}

export function createScene(variant) {
  if (variant === 'A') return createSceneA(CONFIG.A);
  if (variant === 'B') return createSceneB(CONFIG.B);
  throw new Error('variant tidak dikenal: ' + variant);
}
export { CONFIG };
