/**
 * bench-node.mjs — Feasibility Check 3D (Task 1): ukur biaya JS REAL per frame.
 *
 * Variant A: scene three.js NYATA (BufferGeometry, Mesh, Points, material) —
 *   diukur: (1) biaya build scene, (2) biaya per-tick = logika scene.mjs +
 *   scene.updateMatrixWorld() + update matrix kamera + write BufferAttribute
 *   (sebagaimana dilakukan renderer sebelum draw). TIDAK termasuk: rasterisasi
 *   GPU & upload texture (diukur di device nyata via benchmark.html).
 *
 * Variant B: logika 2.5D scene.mjs (parallax/sprite/partikel) — biaya canvas
 *   2D rasterisasi ditopang bukti existing: game sudah render 151 musuh + efek
 *   @16,6 ms/frame vsync (ROADMAP Fase 5.3 dst.), cutscene 2D jauh lebih ringan
 *   dari scene gameplay itu.
 *
 * Prasyarat: three.js terpasang (dev-only). Path lewat env THREE_PATH atau
 * default /tmp/pw/node_modules/three/build/three.module.min.js.
 * Jalankan: node tools/featcheck/bench-node.mjs
 */
import { createScene, CONFIG } from './scene.mjs';

const THREE_PATH = process.env.THREE_PATH || '/tmp/pw/node_modules/three/build/three.module.js';
const three = await import(THREE_PATH).catch(() => null);
if (!three) { console.error('three.js tidak ditemukan di', THREE_PATH, '(dev-only: npm i three)'); process.exit(1); }

const DT = 1 / 60;
const RUNS = 5;          // 5 sampel
const WARMUP = 300;      // 5 dtk
const FRAMES = 3600;     // 60 dtk per sampel
const VIEWS = [844, 390]; // viewport e2e standar repo (landscape)

function pct(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]; }

// ---------------------------------------------------------------------
// Variant A — bangun scene three.js nyata sesuai CONFIG.A
// ---------------------------------------------------------------------
function buildThreeScene(cfg) {
  const { Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, Points, PointsMaterial, Mesh, PlaneGeometry, BoxGeometry, MeshBasicMaterial, CylinderGeometry, MeshBasicMaterial: M2 } = three;
  const scene = new Scene();
  const camera = new PerspectiveCamera(55, VIEWS[0] / VIEWS[1], 0.1, 100);

  // Tabung pembuluh darah (96 seg) — material basic (termurah) untuk feasibility
  const tunnel = new Mesh(new CylinderGeometry(2.6, 2.6, 24, cfg.tunnelSeg, 1, true), new M2({ color: 0x7a1f2b, side: 2 }));
  tunnel.rotation.x = Math.PI / 2; tunnel.position.z = -14;
  scene.add(tunnel);

  // Ruangan periksa: 10 mesh sederhana (dinding/lantai/perabot)
  const wallMat = new MeshBasicMaterial({ color: 0xfdf6e3 });
  const roomGeos = [new PlaneGeometry(8, 4), new PlaneGeometry(8, 4), new PlaneGeometry(8, 5), new BoxGeometry(2.2, 0.7, 1.4), new BoxGeometry(0.8, 1.4, 0.8), new PlaneGeometry(1.2, 1.6)];
  for (let i = 0; i < cfg.roomMeshes; i++) {
    const m = new Mesh(roomGeos[i % roomGeos.length], wallMat);
    m.position.set((i % 3) * 2 - 2, (i > 3 ? 2.2 : i > 1 ? -2 : 0), i < 3 ? -3 : 0);
    m.rotation.y = i % 2 ? Math.PI / 2 : 0;
    scene.add(m);
  }

  // Billboard: plane 1×1 (tekstur = sprite PNG game saat di browser)
  const bbMat = new MeshBasicMaterial({ color: 0x2f9c8f, side: 2 });
  const bbGeo = new PlaneGeometry(1, 1);
  const bbs = [];
  for (let i = 0; i < cfg.billboards; i++) { const b = new Mesh(bbGeo, bbMat); scene.add(b); bbs.push(b); }

  // Partikel: Points + Float32Array (300 RIA + 150 virion + 120 sel darah)
  function makePoints(n) {
    const geo = new BufferGeometry();
    const arr = new Float32Array(n * 3);
    geo.setAttribute('position', new BufferAttribute(arr, 3));
    const pts = new Points(geo, new PointsMaterial({ color: 0x9be8d8, size: 0.05 }));
    scene.add(pts);
    return { pts, arr, attr: geo.getAttribute('position') };
  }
  const pRia = makePoints(cfg.riaParticles);
  const pVir = makePoints(cfg.virionParticles);
  const pBld = makePoints(cfg.bloodParticles);

  const sceneA = createScene('A');
  let tickCount = 0;
  function frame(dt) {
    const s = sceneA.tick(dt);
    // — persis apa yang renderer three.js lakukan tiap frame sebelum draw —
    // 1) copy posisi partikel ke BufferAttribute (upload GPU terjadi di draw)
    pRia.attr.array.set(s.ria); pRia.attr.needsUpdate = true;
    pVir.attr.array.set(s.vir); pVir.attr.needsUpdate = true;
    pBld.attr.array.set(s.bld); pBld.attr.needsUpdate = true;
    // 2) posisikan billboard dari state scene
    for (let i = 0; i < bbs.length; i++) {
      const bb = s.billboards[i];
      bbs[i].position.set(bb.p[0], bb.p[1], bb.p[2]);
      bbs[i].rotation.set(0, bb.q[0], 0);
    }
    // 3) update matrix world seluruh scene graph + kamera
    camera.position.set(s.camPos[0], s.camPos[1], s.camPos[2]);
    camera.lookAt(new three.Vector3(s.camLook[0], s.camLook[1], s.camLook[2]));
    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    // 4) projection matrix (termahal sedikit — dibuat ulang bila aspect berubah; di sini per frame utk konservatif)
    camera.updateProjectionMatrix();
    tickCount++;
  }
  const bytesPerFrameUpload = (cfg.riaParticles + cfg.virionParticles + cfg.bloodParticles) * 3 * 4;
  return { frame, label: 'A (three.js 3D)', bytesPerFrameUpload, scene };
}

// ---------------------------------------------------------------------
// Variant B — logika 2.5D (canvas rasterisasi ditopang bukti existing, lihat header)
// ---------------------------------------------------------------------
function buildSceneB() {
  const sceneB = createScene('B');
  function frame(dt) {
    const s = sceneB.tick(dt);
    // representative per-frame browser work (tanpa rasterisasi): transform layer & sprite
    const o = s.layerOffset;
    for (let i = 0; i < o.length; i++) o[i] = o[i] * 0.999; // (no-op murah — placeholder sinkronisasi)
    const sp = s.sprites;
    for (let i = 0; i < sp.length; i++) sp[i].y += Math.sin(s.t * 1.6 + i) * 0.001;
  }
  return { frame, label: 'B (2.5D canvas2d — logika)', bytesPerFrameUpload: 0 };
}

// ---------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------
async function bench(label, factory) {
  const t0 = performance.now();
  const { frame, bytesPerFrameUpload } = factory();
  const buildMs = performance.now() - t0;
  for (let i = 0; i < WARMUP; i++) frame(DT);
  const samples = [];
  for (let r = 0; r < RUNS; r++) {
    const ts = new Float64Array(FRAMES);
    for (let i = 0; i < FRAMES; i++) {
      const a = performance.now();
      frame(DT);
      ts[i] = performance.now() - a;
    }
    samples.push(...ts);
  }
  samples.sort((a, b) => a - b);
  // skip fast-forward: 1 tick dt besar (pola skip button)
  const tSkip = performance.now();
  frame(5);
  const skipMs = performance.now() - tSkip;
  return { label, buildMs, p50: pct(samples, 0.5), p95: pct(samples, 0.95), p99: pct(samples, 0.99), max: samples[samples.length - 1], skipMs, bytesPerFrameUpload };
}

const hostCores = (await import('node:os')).cpus().length;
console.log('=== BENCH NODE — biaya JS per frame (host: ' + hostCores + ' core, Node ' + process.version + ') ===');
console.log('Viewport ' + VIEWS.join('×') + ' · ' + FRAMES + ' frame/sampel × ' + RUNS + ' sampel · warmup ' + WARMUP + ' frame');
console.log();
const resA = await bench('A', () => buildThreeScene(CONFIG.A));
const resB = await bench('B', buildSceneB);
const fmt = (r) => `  ${r.label.padEnd(30)} build ${r.buildMs.toFixed(1).padStart(8)} ms | tick p50 ${r.p50.toFixed(3).padStart(8)} ms | p95 ${r.p95.toFixed(3).padStart(8)} ms | p99 ${r.p99.toFixed(3).padStart(8)} ms | max ${r.max.toFixed(2).padStart(8)} ms | skip ${(r.skipMs*1000|0)/1000} ms | upload/frame ${r.bytesPerFrameUpload} B`;
console.log(fmt(resA));
console.log(fmt(resB));
console.log();
console.log('Config scene: A =', JSON.stringify(CONFIG.A));
console.log('           B =', JSON.stringify(CONFIG.B));
console.log();
console.log('CATATAN: angka = biaya JS host desktop. Biaya rasterisasi GPU TIDAK termasuk');
console.log('(dilihat di benchmark.html pada device nyata). Faktor CPU device menengah-bawah');
console.log('(ARM low-power core) ≈ 2–4× vs core desktop modern untuk workload JS — asumsi,');
console.log('dikalibrasi ulang oleh benchmark.html pada device uji Audit Agent.');
