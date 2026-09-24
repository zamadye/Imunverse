/**
 * arena.js — ARENA V2: dunia labirin lumen, ditulis ULANG DARI NOL.
 * (Mandat owner 2026-09-23 §6 roadmap: bukan patch lumen-labyrinth.js.)
 *
 * Kontrak: drop-in pengganti LumenLabyrinth untuk game.js — flag
 * `isLabyrinth`, room state machine (idle → lockdown → swarm → purified →
 * open), SDF + collide + radiusAt, vents/seals/shock/doorAngle, quota,
 * hazardAt/currentAt, freeSpot/ventPosition, nodes/route/activeId.
 * Data 100% dari JSON (lumen-labyrinth.json + arenas.json) — satu-satunya
 * fallback adalah trio pilar bawaan bila data tak menyebut pilar.
 *
 * Aktif via ?arena=v2 (atau window.__ARENA_V2 = true untuk harness).
 */

export function arenaV2Enabled() {
  // CUTOVER: V2 = default. V1 legacy hanya via ?arena=v1 eksplisit.
  try {
    if (typeof window !== 'undefined') {
      if (window.__ARENA_V1 === true) return false;
      if (window.__ARENA_V2 === true) return true;
    }
    if (typeof location !== 'undefined' && location.search) {
      const a = new URLSearchParams(location.search).get('arena');
      if (a === 'v1') return false;
      if (a === 'v2') return true;
    }
  } catch { /* abaikan */ }
  return true;
}

const TAU = Math.PI * 2;

function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Modulasi radius dinding lobed/blobby — dipakai SAMA oleh SDF & renderer
 *  agar visual selalu cocok collision (tidak ada clipping dinding). */
export function lobeMod(theta, seed) {
  return 1 + 0.07 * Math.sin(3 * theta + seed * 9) + 0.045 * Math.sin(5 * theta + seed * 17);
}

/** Precompute geometri bentuk room dari data `shape`:
 *  cavity = 1 blob · alveoli = 1 + 6 kantung · dual = 2 bilik ·
 *  coil = tabung sinusoidal (18 segmen kapsul) · tri = 3 lobus ·
 *  pair = 2 kacang · leaf = daun 3 blob · nodes = 1 + 4 nodul ·
 *  axon = bintang 1 + 4 · vessel = 2 segmen pembuluh. */
function buildRoomShape(room) {
  const seed = roomSeed(room);
  room.shape = room.shape || 'cavity';
  room.blobs = [];
  room.coilSegs = null; room.coilR = 0;
  if (room.shape === 'alveoli') {
    room.blobs.push({ x: room.x, y: room.y, r: room.r * 0.52, seed });
    for (let k = 0; k < 6; k++) {
      const a = seed * TAU + (k / 6) * TAU;
      room.blobs.push({
        x: room.x + Math.cos(a) * room.r * 0.58,
        y: room.y + Math.sin(a) * room.r * 0.58,
        r: room.r * 0.30, seed: seed + k * 7.7 + 1.3,
      });
    }
  } else if (room.shape === 'dual') {
    const ax = seed * TAU;
    for (const sgn of [-1, 1]) {
      room.blobs.push({
        x: room.x + sgn * Math.cos(ax) * room.r * 0.34,
        y: room.y + sgn * Math.sin(ax) * room.r * 0.34,
        r: room.r * 0.66, seed: seed + (sgn > 0 ? 3.1 : 0),
      });
    }
  } else if (room.shape === 'coil') {
    const A = room.r * 0.40, waves = 2.5, N = 18;
    room.coilR = Math.min(46, room.r * 0.30);
    room.coilSegs = [];
    let px = room.x - room.r * 0.78, py = room.y;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const cx = room.x - room.r * 0.78 + t * room.r * 1.56;
      const cy = room.y + Math.sin(t * waves * TAU + seed * 5) * A;
      room.coilSegs.push({ x0: px, y0: py, x1: cx, y1: cy, w: room.coilR });
      px = cx; py = cy;
    }
  } else if (room.shape === 'tri') { // hati: 3 lobus
    room.blobs.push({ x: room.x, y: room.y, r: room.r * 0.60, seed });
    const ax3 = seed * TAU;
    for (const sgn of [-1, 1]) {
      room.blobs.push({
        x: room.x + sgn * Math.cos(ax3) * room.r * 0.48,
        y: room.y + sgn * Math.sin(ax3) * room.r * 0.48,
        r: room.r * 0.40, seed: seed + (sgn > 0 ? 5.2 : 2.6),
      });
    }
  } else if (room.shape === 'pair') { // ginjal: 2 kacang vertikal
    for (const sgn of [-1, 1]) {
      room.blobs.push({
        x: room.x, y: room.y + sgn * room.r * 0.40,
        r: room.r * 0.52, seed: seed + (sgn > 0 ? 4.4 : 1.1),
      });
    }
  } else if (room.shape === 'leaf') { // pankreas: daun memanjang
    const axL = seed * TAU;
    room.blobs.push({ x: room.x, y: room.y, r: room.r * 0.50, seed });
    for (const sgn of [-1, 1]) {
      room.blobs.push({
        x: room.x + sgn * Math.cos(axL) * room.r * 0.52,
        y: room.y + sgn * Math.sin(axL) * room.r * 0.52,
        r: room.r * 0.38, seed: seed + (sgn > 0 ? 6.6 : 3.3),
      });
    }
  } else if (room.shape === 'nodes') { // limfe: gugus nodul mini
    room.blobs.push({ x: room.x, y: room.y, r: room.r * 0.40, seed });
    for (let k = 0; k < 4; k++) {
      const a = seed * TAU + (k / 4) * TAU;
      room.blobs.push({
        x: room.x + Math.cos(a) * room.r * 0.55,
        y: room.y + Math.sin(a) * room.r * 0.55,
        r: room.r * 0.27, seed: seed + k * 3.3 + 2.2,
      });
    }
  } else if (room.shape === 'axon') { // saraf: bintang 4 lengan
    room.blobs.push({ x: room.x, y: room.y, r: room.r * 0.48, seed });
    for (let k = 0; k < 4; k++) {
      const a = seed * TAU + (k / 4) * TAU;
      room.blobs.push({
        x: room.x + Math.cos(a) * room.r * 0.52,
        y: room.y + Math.sin(a) * room.r * 0.52,
        r: room.r * 0.30, seed: seed + k * 5.1 + 0.7,
      });
    }
  } else if (room.shape === 'vessel') { // kapiler/darah: segmen pembuluh
    const axV = seed * TAU;
    for (const sgn of [-1, 1]) {
      room.blobs.push({
        x: room.x + sgn * Math.cos(axV) * room.r * 0.44,
        y: room.y + sgn * Math.sin(axV) * room.r * 0.44,
        r: room.r * 0.60, seed: seed + (sgn > 0 ? 7.9 : 1.9),
      });
    }
  } else {
    room.blobs.push({ x: room.x, y: room.y, r: room.r, seed });
  }
}

/** Jarak titik ke segmen kapsul. */
function segDist(x, y, s) {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - s.x0) * dx + (y - s.y0) * dy) / L2));
  return Math.hypot(x - (s.x0 + dx * t), y - (s.y0 + dy * t));
}

export class Arena {
  constructor(lab, arenaDef, px, py) {
    if (!lab || !Array.isArray(lab.nodes)) throw new Error('[arena-v2] labDef tanpa nodes');
    // ---- rooms ----
    this.rooms = new Map();
    for (const n of lab.nodes) {
      const room = {
        id: n.id, x: n.x, y: n.y, r: n.r,
        organ: n.organ || n.id, motif: n.motif | 0,
        pal: n.pal || null, label: n.label || null,
        enemies: n.enemies || 0, hazard: n.hazard || null,
        junction: !!n.junction, shape: n.shape || 'cavity',
        state: 'idle', t: 0, cleared: false,
      };
      buildRoomShape(room);
      this.rooms.set(n.id, room);
    }
    // Kompat: game.js + peta membaca chamber.nodes (Map) & chamber.node(id).
    this.nodes = this.rooms;
    // ---- links: tiap edge = rantai 3 kapsul melengkung ----
    this.links = [];
    this.segs = [];
    const halfDefault = (lab.corridorWidth || 68) / 2;
    for (const e of lab.edges || []) {
      const A = this.rooms.get(e.a), B = this.rooms.get(e.b);
      if (!A || !B) continue;
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const dx = B.x - A.x, dy = B.y - A.y;
      const L = Math.hypot(dx, dy) || 1;
      const bend = e.bend || 0;
      const nx = (-dy / L) * bend, ny = (dx / L) * bend;
      const pts = [[A.x, A.y], [mx + nx * 0.5, my + ny * 0.5], [mx + nx, my + ny], [B.x, B.y]];
      const w = (e.w || lab.corridorWidth || 68) / 2;
      const list = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const s = { x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1], w };
        list.push(s); this.segs.push(s);
      }
      this.links.push({ a: e.a, b: e.b, segs: list, half: halfDefault });
    }
    // ---- pillars (cover non-konveks, data-driven + fallback) ----
    const pillarDef = lab.pillars || [
      { room: 'jantung', dx: -70, dy: 30, r: 52 },
      { room: 'jantung', dx: 80, dy: -20, r: 46 },
      { room: 'paru', dx: 40, dy: 50, r: 40 },
    ];
    this.pillars = pillarDef.map((p) => {
      const n = this.rooms.get(p.room);
      return { x: (n ? n.x : 0) + (p.dx || 0), y: (n ? n.y : 0) + (p.dy || 0), r: p.r || 40 };
    });
    // ---- run state ----
    this.route = lab.route || [];
    this.arenaDef = arenaDef || null;
    this.zoneId = null;
    this.zoneDef = null;
    this.bpm = 72;
    this.time = 0;
    this._beat = 0;
    this.shock = 0;
    this.spawned = 0;
    this.roomSpawn = 0;
    this.impact = null;
    // Kompat jalur labirin game.js (kamera follow + zoom + proyektil).
    this.isLabyrinth = true;
    this.isArenaV2 = true;
    const startId = this.route[0] || lab.nodes[0].id;
    this.activeId = startId;
    const s0 = this.rooms.get(startId);
    this.cx = px != null ? px : s0.x;
    this.cy = py != null ? py : s0.y;
    s0.state = 'lockdown'; s0.t = 0;
    this.state = 'lockdown';
    this._syncActive();
  }

  enter() { /* kompat BioChamber */ }
  get swarm() { return this.state === 'swarm'; }
  get R() { return this.active().r; }
  get sealsOpen() { return this.seals.length === 0; }
  node(id) { return this.rooms.get(id); }
  active() { return this.rooms.get(this.activeId); }

  neighbors(id) {
    const out = [];
    for (const l of this.links) {
      if (l.a === id) out.push(l.b);
      else if (l.b === id) out.push(l.a);
    }
    return out;
  }

  /** SDF satu room mengikuti bentuknya (lobed/blob/coil). */
  sdfRoom(n, x, y) {
    if (n.shape === 'coil' && n.coilSegs) {
      let d = 1e9;
      for (const s of n.coilSegs) d = Math.min(d, segDist(x, y, s) - s.w);
      return d;
    }
    const beat = 2.0 * this._beat;
    let d = 1e9;
    for (const b of n.blobs) {
      const dx = x - b.x, dy = y - b.y;
      d = Math.min(d, Math.hypot(dx, dy) - (b.r + beat) * lobeMod(Math.atan2(dy, dx), b.seed));
    }
    return d;
  }

  /** Room yang memuat titik (x,y), else null. */
  roomAt(x, y) {
    for (const n of this.rooms.values()) {
      if (this.sdfRoom(n, x, y) < -5) return n;
    }
    return null;
  }

  /** SDF: negatif di dalam lumen (rooms ∪ koridor − pilar − segel). */
  sdf(x, y, sealed = true) {
    let d = 1e9;
    for (const n of this.rooms.values()) {
      d = Math.min(d, this.sdfRoom(n, x, y));
    }
    for (const s of this.segs) d = Math.min(d, segDist(x, y, s) - s.w);
    for (const p of this.pillars) d = Math.max(d, -(Math.hypot(x - p.x, y - p.y) - p.r));
    if (sealed) for (const s of this.seals) d = Math.max(d, -(Math.hypot(x - s.x, y - s.y) - s.r));
    return d;
  }

  grad(x, y) {
    const e = 1.5;
    const dx = this.sdf(x + e, y) - this.sdf(x - e, y);
    const dy = this.sdf(x, y + e) - this.sdf(x, y - e);
    const L = Math.hypot(dx, dy) || 1;
    return { x: dx / L, y: dy / L };
  }

  /** Tahan entitas di dalam lumen (proyeksi SDF + redam kecepatan keluar). */
  collide(ent, margin = 0) {
    const m = margin || ent.radius || 14;
    const d = this.sdf(ent.x, ent.y);
    if (d > -m) {
      const g = this.grad(ent.x, ent.y);
      const push = d + m;
      ent.x -= g.x * push; ent.y -= g.y * push;
      const vn = (ent.vx || 0) * g.x + (ent.vy || 0) * g.y;
      if (vn > 0) {
        ent.vx = (ent.vx || 0) - vn * g.x * 1.6;
        ent.vy = (ent.vy || 0) - vn * g.y * 1.6;
      }
    }
    return ent;
  }

  /** Jarak dinding dari (cx,cy) ke arah a (ray-march). */
  radiusAt(a) {
    for (let r = 14; r < 2600; r += 14) {
      if (this.sdf(this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r, false) > 0) return r;
    }
    return 2600;
  }

  /** Titik spawn bebas di room aktif. */
  freeSpot(x, y) {
    if (typeof x === 'function' || x == null) return this._randSpot(x || Math.random);
    if (this.sdf(x, y) < -18) return { x, y };
    return this._randSpot(Math.random);
  }

  _randSpot(rng = Math.random) {
    const n = this.active();
    for (let i = 0; i < 24; i++) {
      const a = rng() * TAU, rr = rng() * n.r * 0.62;
      const x = n.x + Math.cos(a) * rr, y = n.y + Math.sin(a) * rr;
      if (this.sdf(x, y) < -18) return { x, y };
    }
    return { x: n.x, y: n.y };
  }

  /** Hazard room (acid/mucus/bile) atau null. */
  hazardAt(x, y) {
    const n = this.roomAt(x, y);
    return (n && n.hazard) || null;
  }

  /** Kuota musuh simultan room aktif (data-driven per node). */
  quota() { const n = this.active(); return (n && n.enemies) || 6; }

  /** Arus hemodinamik di dalam koridor (vektor px/dtk). */
  currentAt(x, y) {
    for (const s of this.segs) {
      if (segDist(x, y, s) < s.w * 0.9) {
        const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
        const L = Math.hypot(dx, dy) || 1;
        return { x: (dx / L) * 26, y: (dy / L) * 26 };
      }
    }
    return { x: 0, y: 0 };
  }

  /** Segel katup di mulut koridor room aktif saat terkunci. */
  get seals() {
    const out = [];
    const n = this.active();
    if (!n || (n.state !== 'lockdown' && n.state !== 'swarm')) return out;
    for (const id of this.neighbors(n.id)) {
      const O = this.rooms.get(id);
      if (!O) continue;
      const dx = O.x - n.x, dy = O.y - n.y;
      const L = Math.hypot(dx, dy) || 1;
      const off = n.r * 0.86;
      out.push({ x: n.x + (dx / L) * off, y: n.y + (dy / L) * off, r: 34 });
    }
    return out;
  }

  ventPosition(i) {
    const n = this.active();
    const vs = this.vents && this.vents.length ? this.vents : [{ a: 0 }];
    const v = vs[((i % vs.length) + vs.length) % vs.length];
    return { x: n.x + Math.cos(v.a) * n.r * 0.72, y: n.y + Math.sin(v.a) * n.r * 0.72 };
  }

  applyImpact(a, power) {
    // Dinding statis — impact hanya pulsa visual untuk renderer.
    this.impact = { a: a || 0, power: power || 0, t: this.time };
  }

  _syncActive() {
    const n = this.active();
    this.cx = n.x; this.cy = n.y;
    this.state = n.state;
    this.openAmt = n.state === 'open' ? 1 : 0;
    const pal = n.pal || {};
    const interior = { glow: pal.glow, glowHot: pal.glowHot, edge: pal.fill, mottle: pal.deep };
    this.def = {
      id: n.organ, name: n.label || n.organ,
      wall: { interior },
      shape: { wall: { interior } },
    };
    this.vents = [];
    for (const id of this.neighbors(n.id)) {
      const O = this.rooms.get(id);
      if (O) this.vents.push({ a: Math.atan2(O.y - n.y, O.x - n.x) });
    }
    const idx = this.route.indexOf(n.id);
    const nextId = this.route[idx + 1] || (this.neighbors(n.id)[0] || null);
    const N = nextId && this.rooms.get(nextId);
    this.doorAngle = N ? Math.atan2(N.y - n.y, N.x - n.x) : 0;
  }

  // NOTE scope-arena-murni: V1 (lumen-labyrinth) TIDAK PERNAH memanggil
  // callback efek (onSwarmStart/onPurified/onOpen) — V2 menyamai persis.
  // Label efek adalah domain effects-system; arena tak memicu UI luar
  // arena (mencegah label baru bertumpuk dengan UI lama). opts diabaikan.

  update(dt, run, opts) {
    this.time += dt;
    this._beat = 0.5 + 0.5 * Math.sin(this.time * (this.bpm / 60) * TAU);
    const pl = run && run.player;
    if (pl) {
      const room = this.roomAt(pl.x, pl.y);
      if (room && room.id !== this.activeId) {
        this.activeId = room.id;
        if (room.state === 'idle') {
          if (room.junction) { room.state = 'open'; room.cleared = true; }
          else { room.state = 'lockdown'; room.t = 0; this.spawned = 0; this.roomSpawn = 0; }
        }
        this._syncActive();
      }
    }
    const n = this.active();
    n.t += dt;
    if (n.state === 'lockdown' && n.t > 1.1) {
      n.state = 'swarm'; n.t = 0;
    } else if (n.state === 'swarm') {
      const alive = run ? (run.enemies || []).filter((e) => e.alive).length : 1;
      if (alive === 0 && n.t > 0.6) {
        n.state = 'purified'; n.t = 0; this.shock = 0.001; n.cleared = true;
      }
    } else if (n.state === 'purified') {
      this.shock = Math.min(1, this.shock + dt * 0.9);
      if (this.shock >= 1) {
        n.state = 'open'; n.t = 0; this.shock = 0;
        this._syncActive();
      }
    }
    this.state = n.state;
    this.openAmt = n.state === 'open' ? 1 : 0;
    return this;
  }
}

/** Sudut+seed deterministik per room untuk renderer. */
export function roomSeed(room) {
  let h = 2166136261;
  const s = (room && room.id) || '?';
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296 + hash01(s.length * 3.1) * 0.0;
}
