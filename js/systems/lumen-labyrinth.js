/**
 * lumen-labyrinth.js — ARENA SATU KESATUAN (mandat owner 2026-09-22, ref
 * ARENA_ZOOM_OUT_REFERENCE_.png): lumen pembuluh BERKELOK menyambungkan SEMUA
 * chamber organ menjadi satu labirin kontinu — bukan arena putus per zona.
 *
 * Geometri: SDF union( lingkaran chamber , kapsul koridor polyline ) dikurangi
 * obstacle (pilar massa + SEGEL katup saat lockdown/swarm). Koridor sempit
 * (±68 world) supaya ruang terasa tertutup; hanya chamber `big` (jantung)
 * yang lapang. State machine per-room: masuk room belum bersih => LOCKDOWN
 * (mulut koridor disegel) -> SWARM -> PURIFIED -> OPEN (segel lepas, jalan
 * lanjut). Kelas ini meniru interface BioChamber sehingga game.js/renderer
 * tetap satu kode path (def, zoneId, enter, spawned, update, collide,
 * applyImpact, radiusAt, cx/cy, doorAngle, openAmt, vents, pillars, bpm).
 */
export class LumenLabyrinth {
  constructor(lab, def, px, py) {
    this.isLabyrinth = true;
    this.lab = lab;
    this.def = def || { id: 'kapiler' };
    this.zoneId = null;
    this.spawned = 0;
    this.bpm = 72;
    this.shock = 0;
    this.time = 0;
    this.nodes = new Map();
    for (const n of lab.nodes) this.nodes.set(n.id, { ...n, state: 'idle', cleared: false, t: 0 });
    // polyline koridor berkelok: a -> mid(bend) -> b
    this.segs = [];
    this.edgeSegs = [];
    for (const e of lab.edges) {
      const A = this.nodes.get(e.a), B = this.nodes.get(e.b);
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const dx = B.x - A.x, dy = B.y - A.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      const b = e.bend || 0;
      const pts = [
        [A.x, A.y],
        [mx + nx * b * 0.5, my + ny * b * 0.5],
        [mx + nx * b, my + ny * b],
        [B.x, B.y],
      ];
      const w = (e.w || lab.corridorWidth || 68) / 2;
      const list = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const s = { x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1], w };
        this.segs.push(s); list.push(s);
      }
      this.edgeSegs.push({ a: e.a, b: e.b, segs: list, cross: !!e.cross });
    }
    this.route = lab.route || [];
    // pilar cover di chamber besar (massa gelap non-konveks)
    this.pillarDef = lab.pillars || [
      { room: 'jantung', dx: -70, dy: 30, r: 52 },
      { room: 'jantung', dx: 80, dy: -20, r: 46 },
      { room: 'paru', dx: 40, dy: 50, r: 40 },
    ];
    this.pillars = this.pillarDef.map((p) => {
      const n = this.nodes.get(p.room);
      return { x: (n ? n.x : 0) + p.dx, y: (n ? n.y : 0) + p.dy, r: p.r };
    });
    // mulai di room START
    const startId = this.route[0] || lab.nodes[0].id;
    this.activeId = startId;
    const s0 = this.nodes.get(startId);
    this.cx = px != null ? px : s0.x;
    this.cy = py != null ? py : s0.y;
    s0.state = 'lockdown'; s0.t = 0;
    this.state = 'lockdown';
    this._syncActive();
  }

  enter() { /* kompat BioChamber */ }
  get swarm() { return this.state === 'swarm'; }
  get R() { return this.active().r; }
  ventPosition(i) {
    const n = this.active();
    const v = this.vents[((i % this.vents.length) + this.vents.length) % this.vents.length] || { a: 0 };
    return { x: n.x + Math.cos(v.a) * n.r * 0.72, y: n.y + Math.sin(v.a) * n.r * 0.72 };
  }
  applyImpact() { /* dinding labirin statis; impact hanya visual shader via beat */ }

  node(id) { return this.nodes.get(id); }
  active() { return this.nodes.get(this.activeId); }

  /** room tempat titik w berada (dalam lingkaran chamber), else null. */
  roomAt(x, y) {
    for (const n of this.nodes.values()) {
      if (Math.hypot(x - n.x, y - n.y) < n.r * 0.92) return n;
    }
    return null;
  }

  /** SDF: negatif di dalam lumen (koridor+chamber dikurangi obstacle). */
  sdf(x, y, sealed = true) {
    let d = 1e9;
    for (const n of this.nodes.values()) {
      const rr = n.r + 2.0 * this._beat;
      d = Math.min(d, Math.hypot(x - n.x, y - n.y) - rr);
    }
    for (const s of this.segs) d = Math.min(d, this._segD(x, y, s) - s.w);
    // obstacle: pilar selalu; segel katup saat room aktif terkunci
    for (const p of this.pillars) d = Math.max(d, -(Math.hypot(x - p.x, y - p.y) - p.r));
    if (sealed) for (const s of this.seals) d = Math.max(d, -(Math.hypot(x - s.x, y - s.y) - s.r));
    return d;
  }

  _segD(x, y, s) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
    const L2 = dx * dx + dy * dy || 1;
    let t = ((x - s.x0) * dx + (y - s.y0) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (s.x0 + dx * t), y - (s.y0 + dy * t));
  }

  grad(x, y) {
    const e = 1.5;
    const dx = this.sdf(x + e, y) - this.sdf(x - e, y);
    const dy = this.sdf(x, y + e) - this.sdf(x, y - e);
    const L = Math.hypot(dx, dy) || 1;
    return { x: dx / L, y: dy / L };
  }

  /** Tahan entitas di dalam lumen (projeksi SDF + bunuh kecepatan keluar). */
  collide(ent, margin = 0) {
    const m = margin || ent.radius || 14;
    const d = this.sdf(ent.x, ent.y);
    if (d > -m) {
      const g = this.grad(ent.x, ent.y);
      const push = d + m;
      ent.x -= g.x * push; ent.y -= g.y * push;
      const vn = (ent.vx || 0) * g.x + (ent.vy || 0) * g.y;
      if (vn > 0) { ent.vx = (ent.vx || 0) - vn * g.x * 1.6; ent.vy = (ent.vy || 0) - vn * g.y * 1.6; }
    }
    return ent;
  }

  /** jarak dinding dari (cx,cy) ke arah a (ray-march) — kompat radiusAt. */
  radiusAt(a) {
    const step = 14;
    for (let r = step; r < 2600; r += step) {
      const x = this.cx + Math.cos(a) * r, y = this.cy + Math.sin(a) * r;
      if (this.sdf(x, y, false) > 0) return r;
    }
    return 2600;
  }

  /** titik spawn bebas di room aktif (kompat freeSpot/organSpawn). */
  freeSpot(x, y) {
    if (typeof x === 'function' || x == null) return this._randSpot(x || Math.random);
    if (this.sdf(x, y) < -18) return { x, y };
    return this._randSpot(Math.random);
  }

  _randSpot(rng = Math.random) {
    const n = this.active();
    for (let i = 0; i < 24; i++) {
      const a = rng() * Math.PI * 2, rr = rng() * n.r * 0.62;
      const x = n.x + Math.cos(a) * rr, y = n.y + Math.sin(a) * rr;
      if (this.sdf(x, y) < -18) return { x, y };
    }
    return { x: n.x, y: n.y };
  }

  /** arus hemodinamik: dorong entitas sepanjang koridor (spec Layer B). */
  currentAt(x, y) {
    for (const es of this.edgeSegs) {
      for (const s of es.segs) {
        if (this._segD(x, y, s) < s.w * 0.9) {
          const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
          const L = Math.hypot(dx, dy) || 1;
          return { x: (dx / L) * 26, y: (dy / L) * 26 };
        }
      }
    }
    return { x: 0, y: 0 };
  }

  /** segel katup di mulut koridor room aktif saat terkunci. */
  get seals() {
    const out = [];
    const n = this.active();
    if (!n || (n.state !== 'lockdown' && n.state !== 'swarm')) return out;
    for (const es of this.edgeSegs) {
      if (es.a !== n.id && es.b !== n.id) continue;
      const other = es.a === n.id ? es.b : es.a;
      const O = this.nodes.get(other);
      const dx = O.x - n.x, dy = O.y - n.y;
      const L = Math.hypot(dx, dy) || 1;
      const off = n.r * 0.86;
      out.push({ x: n.x + (dx / L) * off, y: n.y + (dy / L) * off, r: 34 });
    }
    return out;
  }
  get sealsOpen() { return this.seals.length === 0; }

  _syncActive() {
    const n = this.active();
    this.cx = n.x; this.cy = n.y;
    this.state = n.state;
    this.openAmt = n.state === 'open' ? 1 : 0;
    this.def = { id: n.organ, name: n.label || n.organ };
    // vents = mulut koridor (sudut dari pusat room) untuk glow SWARM
    this.vents = [];
    for (const es of this.edgeSegs) {
      if (es.a !== n.id && es.b !== n.id) continue;
      const other = es.a === n.id ? es.b : es.a;
      const O = this.nodes.get(other);
      this.vents.push({ a: Math.atan2(O.y - n.y, O.x - n.x) });
    }
    // doorAngle = mulut menuju room route berikutnya
    const idx = this.route.indexOf(n.id);
    const nextId = this.route[idx + 1] || (this.edgeSegs.find((e) => e.a === n.id || e.b === n.id) || {}).b;
    const N = nextId && this.nodes.get(nextId);
    this.doorAngle = N ? Math.atan2(N.y - n.y, N.x - n.x) : 0;
  }

  update(dt, run) {
    this.time += dt;
    this._beat = 0.5 + 0.5 * Math.sin(this.time * (this.bpm / 60) * Math.PI * 2);
    const pl = run && run.player;
    if (pl) {
      const room = this.roomAt(pl.x, pl.y);
      if (room && room.id !== this.activeId) {
        this.activeId = room.id;
        if (room.state === 'idle') { room.state = 'lockdown'; room.t = 0; this.spawned = 0; }
        this._syncActive();
      }
    }
    const n = this.active();
    n.t += dt;
    if (n.state === 'lockdown' && n.t > 1.1) { n.state = 'swarm'; n.t = 0; }
    else if (n.state === 'swarm') {
      const alive = run ? (run.enemies || []).filter((e) => e.alive).length : 1;
      if (alive === 0 && n.t > 0.6) { n.state = 'purified'; n.t = 0; this.shock = 0.001; n.cleared = true; }
    } else if (n.state === 'purified') {
      this.shock = Math.min(1, this.shock + dt * 0.9);
      if (this.shock >= 1) { n.state = 'open'; n.t = 0; this.shock = 0; this._syncActive(); }
    }
    this.state = n.state;
    this.openAmt = n.state === 'open' ? 1 : 0;
    return this;
  }
}
