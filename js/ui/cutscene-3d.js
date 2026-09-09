/**
 * cutscene-3d.js — R3 (Narrative-Cinematic): renderer 3D (three.js) untuk
 * cutscene pembuka & epilog (keputusan D1: 3D hanya 2 momen besar; gate =
 * hasil benchmark.html di device low-end sebelum produksi).
 *
 * Kebijakan performa (hasil feasibility — docs/featcheck-3d-cutscene.md):
 *  - three.js di-import LALAI (dynamic import) — hanya dimuat bila 3D dipakai
 *  - prewarm(): modul + WebGL context dibuat di latar belakang saat
 *    title/dashboard → jank init KULUAR dari jalur kritis cutscene
 *  - HANYA MeshBasicMaterial/PointsMaterial (tanpa shader kustom) → shader
 *    compile minimal
 *  - Sprite karakter = billboard tekstur dari PNG game (reference sheet yang
 *    SAMA — konsistensi proporsi/warna, tanpa pipeline model 3D terpisah)
 *  - Fail-safe: WebGL tidak tersedia / context error → onFallback() → 2D
 *
 * API: createCutscene3D(canvas, scene, opts) → Promise<{ start, stop }>
 *   reject → caller pakai fallback 2D.
 */

let threePromise = null;
let prewarmedCtx = null;

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

function loadThree() {
  if (!threePromise) threePromise = import('../vendor/three.module.js');
  return threePromise;
}

/** Pra-muat modul three + context WebGL (dipanggil di boot, background). */
export function prewarm3D() {
  if (!webglAvailable()) return;
  loadThree().catch(() => {});
  try {
    const c = document.createElement('canvas');
    prewarmedCtx = c.getContext('webgl2') || c.getContext('webgl');
    if (prewarmedCtx) {
      // buat & hancurkan 1 program sederhana agar driver "hangat"
      const g = prewarmedCtx.createBuffer();
      prewarmedCtx.bindBuffer(prewarmedCtx.ARRAY_BUFFER, g);
      prewarmedCtx.bufferData(prewarmedCtx.ARRAY_BUFFER, new Float32Array(3), prewarmedCtx.STATIC_DRAW);
      const ext = prewarmedCtx.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      prewarmedCtx = null;
    }
  } catch { /* tidak fatal */ }
}

function makeBillboard(THREE, texture, w, h) {
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return m;
}

function makePoints(THREE, scene, n, color, size) {
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = 0; a[i * 3 + 1] = 0; a[i * 3 + 2] = 0; }
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9 }));
  scene.add(p);
  return { p, attr: g.getAttribute('position') };
}

export async function createCutscene3D(canvas, scene, opts) {
  const { onFrame, onEnd, onFallback } = opts;
  let THREE;
  try { THREE = await loadThree(); } catch { if (onFallback) onFallback('three-load'); return null; }
  if (!webglAvailable()) { if (onFallback) onFallback('no-webgl'); return null; }

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  } catch { if (onFallback) onFallback('ctx-error'); return null; }
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene3 = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 120);

  // ------------------------------------------------ lingkungan
  // (a) RUANG PERIKSA — dinding/lantai/ranjang basic material
  const room = new THREE.Group();
  {
    const wallMat = new THREE.MeshBasicMaterial({ color: 0xfdf6e3 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), wallMat);
    back.position.set(0, 1.5, -4); room.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ color: 0xf3e8cf }));
    left.rotation.y = Math.PI / 2; left.position.set(-5, 1.5, 2); room.add(left);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0xe2c9a4 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.2; room.add(floor);
    // ranjang
    const bed = new THREE.Group();
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 1.5), new THREE.MeshBasicMaterial({ color: 0x8fae9f }));
    mattress.position.y = -0.8;
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.5), new THREE.MeshBasicMaterial({ color: 0xf5f0e6 }));
    sheet.position.y = -0.55;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 1.6), new THREE.MeshBasicMaterial({ color: 0x7a9a8c }));
    frame.position.y = -1.05;
    bed.add(mattress, sheet, frame);
    bed.position.set(0.9, 0, -1.2);
    room.add(bed);
    // luka di "tangan" (sisi ranjang) — plane merah kecil berdenyut
    const wound = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ color: 0xff6b5e }));
    wound.position.set(0.9, -0.5, -0.42);
    wound.name = 'wound';
    room.add(wound);
  }
  // (b) DUNIA MIKRO — tabung pembuluh darah (backside)
  const micro = new THREE.Group();
  {
    const tunnel = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, 44, 96, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7a1f2b, side: THREE.BackSide })
    );
    tunnel.rotation.x = Math.PI / 2;
    tunnel.position.z = -16;
    micro.add(tunnel);
    // anyaman
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.35 - i * 0.12, 0.05, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0x93324a, transparent: true, opacity: 0.5 })
      );
      ring.position.z = -8 - i * 8;
      micro.add(ring);
    }
  }
  // (c) KAMAR RS (epilog)
  const hospital = new THREE.Group();
  {
    const wall = new THREE.MeshBasicMaterial({ color: 0xfff6e6 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), wall);
    back.position.set(0, 1.5, -4); hospital.add(back);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0xf3d9b8 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.2; hospital.add(floor);
    // jendela pagi (plane terang = cahaya)
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3), new THREE.MeshBasicMaterial({ color: 0xffe9b8 }));
    win.position.set(-2.4, 1.6, -3.95);
    hospital.add(win);
    // ranjang RS
    const bed = new THREE.Group();
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.4), new THREE.MeshBasicMaterial({ color: 0xd8e6ef }));
    mattress.position.y = -0.7;
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    sheet.position.y = -0.45;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), new THREE.MeshBasicMaterial({ color: 0x9db4c4 }));
    pole.position.set(1.4, 0.3, -0.6);
    bed.add(mattress, sheet, pole);
    bed.position.set(0.8, 0, -1.2);
    hospital.add(bed);
    // Inang — silhouette (kapsul gelap di ranjang; bentuk abstrak disengaja)
    const inang = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), new THREE.MeshBasicMaterial({ color: 0x5a3c46 }));
    head.position.set(-0.7, -0.35, 0);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 12), new THREE.MeshBasicMaterial({ color: 0x5a3c46 }));
    body.rotation.z = Math.PI / 2.4;
    body.position.set(-0.15, -0.45, 0);
    inang.add(head, body);
    inang.position.set(0.8, 0, -1.2);
    inang.name = 'inang';
    hospital.add(inang);
  }
  room.visible = true; micro.visible = false; hospital.visible = false;
  scene3.add(room, micro, hospital);

  // ------------------------------------------------ aktor billboard (sprite riil)
  const texLoader = new THREE.TextureLoader();
  const actors = {};
  function addActor(who, w, h) {
    const path = who === 'amara' ? 'assets/sprites/amara_pose_talk.png'
      : who === 'mako' ? 'assets/sprites/hero_makrofag_idle.png'
      : 'assets/sprites/ria_pose_talk.png';
    const tex = texLoader.load(path);
    const m = makeBillboard(THREE, tex, w, h);
    m.visible = false;
    scene3.add(m);
    actors[who] = m;
  }
  addActor('amara', 1.5, 1.7);
  addActor('mako', 1.6, 1.6);

  // ------------------------------------------------ partikel
  const pRia = makePoints(THREE, scene3, 300, 0x7dffb8, 0.05);
  const pVir = makePoints(THREE, scene3, 150, 0xff5a6e, 0.09);
  const pBld = makePoints(THREE, scene3, 120, 0xffb3c0, 0.12);
  pRia.p.visible = false;
  // sebaran awal
  {
    const a = pBld.attr.array;
    for (let i = 0; i < 120; i++) {
      a[i * 3] = (Math.random() - 0.5) * 4.4;
      a[i * 3 + 1] = (Math.random() - 0.5) * 4.4;
      a[i * 3 + 2] = -4 - Math.random() * 24;
    }
    const v = pVir.attr.array;
    for (let i = 0; i < 150; i++) {
      v[i * 3] = (Math.random() - 0.5) * 4;
      v[i * 3 + 1] = (Math.random() - 0.5) * 4;
      v[i * 3 + 2] = -6 - (i % 12) * 1.4;
    }
  }

  // ------------------------------------------------ timeline
  const shots = scene.shots3d;
  const total = shots[shots.length - 1].t1;
  const v3a = new THREE.Vector3(), v3b = new THREE.Vector3();
  let running = false, startT = 0, lastT = 0, rafId = null, disposed = false;
  let lastEnv = 'ruang';

  function setEnv(env) {
    if (env === lastEnv) return;
    lastEnv = env;
    room.visible = env === 'ruang';
    micro.visible = env === 'mikro';
    hospital.visible = env === 'kamar_rs';
    pVir.p.visible = env === 'mikro';
    pBld.p.visible = env === 'mikro';
    if (env !== 'mikro') { pRia.p.visible = false; }
  }

  function shotAt(t) {
    for (const s of shots) if (t < s.t1) return { s, k: (t - s.t0) / (s.t1 - s.t0) };
    const l = shots[shots.length - 1];
    return { s: l, k: 1 };
  }

  const v3c = new THREE.Vector3(), v3d = new THREE.Vector3();
  function frame(now) {
    if (!running || disposed) return;
    const t = (now - startT) / 1000;
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const { s, k } = shotAt(t);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

    setEnv(s.env);

    // kamera
    const c = s.cam;
    v3a.set(c.from[0], c.from[1], c.from[2]);
    v3b.set(c.to[0], c.to[1], c.to[2]);
    camera.position.lerpVectors(v3a, v3b, e);
    v3c.set(c.lookFrom[0], c.lookFrom[1], c.lookFrom[2]);
    v3d.set(c.lookTo[0], c.lookTo[1], c.lookTo[2]);
    camera.lookAt(v3c.lerp(v3d, e));

    // aktor
    for (const a of s.actors || []) {
      const m = actors[a.who];
      if (!m) continue;
      m.visible = true;
      let ax = a.x;
      if (a.walkTo) {
        const wp = Math.min(1, Math.max(0, (t - a.walkTo.tFrom) / (a.walkTo.tTo - a.walkTo.tFrom)));
        const we = wp < 0.5 ? 2 * wp * wp : 1 - Math.pow(-2 * wp + 2, 2) / 2;
        ax = a.x + (a.walkTo.x - a.x) * we; // x = posisi awal → walkTo.x = target
      }
      m.position.set(ax, a.y + Math.sin(t * 2) * 0.03, a.z);
      m.scale.setScalar((a.s || 1) * (s.env === 'mikro' ? (a.who === 'mako' && (t % 2.4) > 2.0 ? 1.12 : 1) : 1));
      m.lookAt(camera.position);
    }
    // sembunyikan aktor yang tak disebut shot ini (cegah nempel antar shot)
    for (const who of Object.keys(actors)) {
      if (!s.actors || !s.actors.some((a) => a.who === who)) actors[who].visible = false;
    }

    // partikel mikro
    if (s.env === 'mikro') {
      const a = pBld.attr.array;
      for (let i = 0; i < 120; i++) {
        a[i * 3] -= dt * (0.5 + (i % 5) * 0.15);
        if (a[i * 3] < -2.4) a[i * 3] = 2.4;
      }
      pBld.attr.needsUpdate = true;
      const v = pVir.attr.array;
      for (let i = 0; i < 150; i++) {
        v[i * 3] += Math.cos(t * 0.5 + i * 1.7) * dt * 0.3;
        v[i * 3 + 1] += Math.sin(t * 0.4 + i * 2.3) * dt * 0.3;
      }
      pVir.attr.needsUpdate = true;
      // RIA menyala (riaOn)
      if (s.riaOn !== undefined && t >= s.riaOn) {
        pRia.p.visible = true;
        const glow = Math.min(1, (t - s.riaOn) / 1.5);
        const r = pRia.attr.array;
        for (let i = 0; i < 300; i++) {
          const ang = t * (0.25 + (i % 7) * 0.05) + i;
          const rad = (0.25 + (i % 11) * 0.06) * glow;
          r[i * 3] = Math.cos(ang) * rad + 0;
          r[i * 3 + 1] = Math.sin(ang * 1.3) * rad * 0.7 + 0.2;
          r[i * 3 + 2] = -2.5;
        }
        pRia.attr.needsUpdate = true;
        pRia.p.material.opacity = glow;
      } else {
        pRia.p.visible = false;
      }
    }

    // luka denyut (pembuka) & Inang pulse (epilog)
    if (s.env === 'ruang') {
      const w = room.getObjectByName('wound');
      if (w) { const p = 1 + 0.2 * Math.sin(t * 4); w.scale.setScalar(p); w.visible = t > 6.4; }
    }
    if (s.env === 'kamar_rs') {
      const inang = hospital.getObjectByName('inang');
      if (inang && s.props && s.props.some((pr) => pr.type === 'inang' && pr.pulse)) {
        inang.scale.setScalar(1 + 0.05 * Math.sin(t * 2));
      }
    }

    renderer.render(scene3, camera);

    if (onFrame) onFrame(t, s);
    if (t >= total) {
      running = false;
      if (onEnd) onEnd();
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  return {
    start() {
      running = true;
      startT = performance.now();
      lastT = startT;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      if (!disposed) {
        disposed = true;
        try { renderer.dispose(); } catch { /* sudah lepas */ }
      }
    },
  };
}
