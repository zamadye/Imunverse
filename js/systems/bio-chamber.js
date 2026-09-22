/**
 * bio-chamber.js — ARENA TERTUTUP (closed bio-chamber) sesuai ARCHITECTURAL SPEC
 * "CLOSED BIOLOGICAL COMBAT ARENA" (owner, 2026-09-21).
 *
 * MAP vs ARENA (model benar):
 *   - MAP  = denah statis/navigasi (data/body-map.json + overlay B) — BUKAN ruang main.
 *   - ARENA = instance bio-chamber ini: ruang pertarungan TERTUTUP. Saat pemain
 *     masuk, katup LOCKDOWN (spasme vaskular), dinding berdenyut (spring-mass
 *     soft-body), patogen keluar dari SPORE VENTS, dan pintu membran berikutnya
 *     baru terbuka setelah ARENA PURIFIED.
 *
 * State machine: ENTRY -> LOCKDOWN -> SWARM -> PURIFIED -> OPEN
 *   ENTRY     : pemain masuk lewat katup kapiler (chamber dibangun di posisinya).
 *   LOCKDOWN  : katup menutup; dinding menggelap ke nada infeksi; ~1,2 dtk.
 *   SWARM     : wave patogen dari pori dinding; combat twin-stick.
 *   PURIFIED  : patogen habis -> shockwave bioluminesensi; katup melunak.
 *   OPEN      : pintu menuju arena berikutnya terbuka (journey lanjut).
 *
 * Dinding = ring titik spring-mass (Verlet/Hooke + damping): proyektil/pemain
 * yang menabrak membuat simpul PENYOK lalu membal elastis (jiggle). Radii hasil
 * simulasi adalah SATU sumber kebenaran untuk collision DAN renderer GL.
 */

const N = 48; // simpul membran
const TAU = Math.PI * 2;

function hash1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

export class BioChamber {
  /**
   * @param {object} def   definisi arena (data/arenas.json): {id, chamber:{radius, lobes, bpm, amp}, wall:{...}}
   * @param {number} cx    pusat dunia chamber
   * @param {number} cy
   */
  constructor(def, cx, cy) {
    this.def = def || {};
    const ch = (def && def.chamber) || {};
    this.cx = cx; this.cy = cy;
    this.R = Math.max(240, ch.radius || 620);
    this.bpm = ch.bpm || 72;
    this.amp = ch.amp || 10;
    this.lobes = Math.max(3, ch.lobes || 5);
    this.seed = hash1((def && def.id ? def.id.length : 3) * 12.7 + this.R);
    // BENTUK ARENA (analisis Pathogenic, docs/PATHOGENIC-ARENA-SHAPE-ANALYSIS.md):
    // blob asimetris = harmonik amplitudo besar + elongasi miring; BUKAN lingkaran.
    const sh = ch.shape || {};
    this.harmonics = (Array.isArray(sh.harmonics) && sh.harmonics.length)
      ? sh.harmonics
      : [[this.lobes, 0.10, this.seed * 6], [this.lobes * 2 + 1, 0.05, -this.seed * 3]];
    const st = Array.isArray(sh.stretch) ? sh.stretch : [1, 1, 0];
    this.stretch = { sx: Math.max(0.4, st[0] || 1), sy: Math.max(0.4, st[1] || 1), rot: st[2] || 0 };
    this.points = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      let harm = 1;
      for (const h of this.harmonics) harm += (h[1] || 0) * Math.sin((h[0] || 2) * a + (h[2] || 0));
      harm = Math.max(0.35, harm);
      const b = a - this.stretch.rot;
      const ell = 1 / Math.hypot(Math.cos(b) / this.stretch.sx, Math.sin(b) / this.stretch.sy);
      const base = this.R * harm * ell;
      this.points.push({ a, base, r: base, v: 0 });
    }
    // PILAR internal (massa gelap melengkung) -> ruang NON-KONVEKS ala chamber jantung
    this.pillars = [];
    for (const pl of sh.pillars || []) {
      const dist = (pl.d != null ? pl.d : 0.4) * this.R;
      const ax = pl.a || 0;
      const c0x = Math.cos(ax) * dist, c0y = Math.sin(ax) * dist;
      const dir = ax + Math.PI / 2;
      const len = pl.len || 240, wid = pl.wid || 90, bend = pl.bend || 0;
      for (let k2 = 0; k2 < 3; k2++) {
        const t2 = (k2 / 2 - 0.5) * len;
        const bow = bend * len * 0.22 * Math.sin(Math.PI * (k2 / 2));
        let x = c0x + Math.cos(dir) * t2 - Math.sin(dir) * bow;
        let y = c0y + Math.sin(dir) * t2 + Math.cos(dir) * bow;
        // clamp: pilar tetap DI DALAM membran (tak menembus dinding)
        const pa = Math.atan2(y, x);
        const wr = this.radiusAt(pa) - wid * 0.5 - 24;
        const rr0 = Math.hypot(x, y);
        if (rr0 > wr && rr0 > 1e-6) { x *= wr / rr0; y *= wr / rr0; }
        this.pillars.push({ x: this.cx + x, y: this.cy + y, r: wid * 0.5 });
      }
    }
    this.k = ch.stiffness || 0.16;     // kekakuan pegas membran
    this.damp = ch.damping || 0.86;    // peredaman fluida daging
    this.time = 0;
    this.state = 'entry';
    this.t = 0;
    this.spawned = 0;        // total patogen keluar sejak chamber aktif (radar X/Y)
    this.shock = 0;          // 0..1 gelombang purified
    this.doorAngle = -Math.PI / 2; // arah pintu keluar (menuju rute berikutnya)
    this.openAmt = 0;        // 0 tertutup .. 1 terbuka
    this.vents = this._makeVents(ch.vents || 5);
    this.impacts = 0;
  }

  _makeVents(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ a: (i / n) * TAU + (hash1(i * 7.7 + this.seed) - 0.5) * 0.6, cool: 0 });
    }
    return out;
  }

  get lockdown() { return this.state === 'lockdown'; }
  get swarm() { return this.state === 'swarm'; }
  get purified() { return this.state === 'purified'; }
  get open() { return this.state === 'open'; }

  /** Masuk arena: mulai LOCKDOWN (katup mengunci). */
  enter() { this.state = 'lockdown'; this.t = 0; this.openAmt = 0; }

  /** Radius membran terdeformasi pada sudut a (interpolasi linier antar simpul). */
  radiusAt(a) {
    const f = ((a % TAU) + TAU) % TAU / TAU * N;
    const i = Math.floor(f) % N, j = (i + 1) % N;
    const t = f - Math.floor(f);
    return this.points[i].r * (1 - t) + this.points[j].r * t;
  }

  /** Tabrakan ke dinding: simpul terdekat + tetangga penyok (jiggle elastis). */
  applyImpact(a, force) {
    const f = ((a % TAU) + TAU) % TAU / TAU * N;
    const i = Math.round(f) % N;
    for (const [o, w] of [[-2, 0.25], [-1, 0.55], [0, 1], [1, 0.55], [2, 0.25]]) {
      const p = this.points[((i + o) % N + N) % N];
      p.v += force * w;
    }
    this.impacts++;
  }

  /**
   * Collision entitas ke dinding tertutup: tahan di dalam membran terdeformasi.
   * Return true bila terjadi kontak (dinding penyok lewat applyImpact).
   */
  collide(ent, rad = 14) {
    if (!ent) return false;
    const dx = ent.x - this.cx, dy = ent.y - this.cy;
    const r = Math.hypot(dx, dy) || 1e-6;
    const a = Math.atan2(dy, dx);
    const wall = this.radiusAt(a);
    // pintu OPEN = mulut keluar: jangan tahan di sektor pintu saat open
    if (this.openAmt > 0.4) {
      let da = Math.abs(((a - this.doorAngle + Math.PI * 3) % TAU) - Math.PI);
      if (da < 0.30 * this.openAmt) return false;
    }
    // pilar internal: dorong keluar massa gelap (cover bullet-hell)
    for (const pi of this.pillars) {
      let pdx = ent.x - pi.x, pdy = ent.y - pi.y;
      let pr = Math.hypot(pdx, pdy);
      if (pr < 1e-4) { // tepat di pusat pilar: dorong ke arah radial chamber
        const ea = Math.atan2(pi.y - this.cy, pi.x - this.cx);
        pdx = Math.cos(ea); pdy = Math.sin(ea); pr = 1;
      }
      const plim = pi.r + rad;
      if (pr < plim) {
        const ux = pdx / pr, uy = pdy / pr;
        ent.x = pi.x + ux * plim;
        ent.y = pi.y + uy * plim;
        const vn = (ent.vx || 0) * ux + (ent.vy || 0) * uy;
        if (vn < 0) { ent.vx = (ent.vx || 0) - 1.5 * vn * ux; ent.vy = (ent.vy || 0) - 1.5 * vn * uy; }
        return true;
      }
    }
    const lim = wall - rad;
    if (r <= lim) return false;
    const nx = dx / r, ny = dy / r;
    ent.x = this.cx + nx * lim;
    ent.y = this.cy + ny * lim;
    const vn = (ent.vx || 0) * nx + (ent.vy || 0) * ny;
    if (vn > 0) {
      ent.vx = (ent.vx || 0) - 1.55 * vn * nx;
      ent.vy = (ent.vy || 0) - 1.55 * vn * ny;
      this.applyImpact(a, Math.min(26, vn * 0.10 + 3)); // daging penyok lalu membal
    }
    return true;
  }

  /** Posisi pori dinding untuk spawn patogen (spore vents). */
  ventPosition(i, inset = 46) {
    const v = this.vents[i % this.vents.length];
    const r = this.radiusAt(v.a) - inset;
    return this.freeSpot(this.cx + Math.cos(v.a) * r, this.cy + Math.sin(v.a) * r, v.a);
  }

  /** Geser titik keluar dari pilar internal (spawn/vent tak boleh di dalam massa). */
  freeSpot(x, y, a = null) {
    let px = x, py = y;
    for (const pi of this.pillars) {
      const dx = px - pi.x, dy = py - pi.y;
      const rr = Math.hypot(dx, dy) || 1e-6;
      if (rr < pi.r + 26) {
        px = pi.x + (dx / rr) * (pi.r + 26);
        py = pi.y + (dy / rr) * (pi.r + 26);
      }
    }
    return { x: px, y: py, a: a != null ? a : Math.atan2(py - this.cy, px - this.cx) };
  }

  insidePillar(x, y, margin = 0) {
    for (const pi of this.pillars) {
      if (Math.hypot(x - pi.x, y - pi.y) < pi.r + margin) return true;
    }
    return false;
  }

  /**
   * Update fisika dinding + state machine.
   * @param {number} dt
   * @param {object} run  run aktif (untuk query musuh hidup)
   * @param {object} hook { onSwarmStart, onPurified, onOpen } callback game
   */
  update(dt, run, hook = {}) {
    this.time += dt; this.t += dt;
    const beat = Math.sin(this.time * (this.bpm / 60) * TAU) * this.amp;
    for (let i = 0; i < N; i++) {
      const p = this.points[i];
      const target = p.base + beat;
      const f = (target - p.r) * this.k;
      p.v = (p.v + f) * this.damp;
      p.r += p.v;
    }
    switch (this.state) {
      case 'entry': this.enter(); break;
      case 'lockdown':
        if (this.t > 1.2) { this.state = 'swarm'; this.t = 0; if (hook.onSwarmStart) hook.onSwarmStart(this); }
        break;
      case 'swarm': {
        const alive = (run.enemies || []).filter((e) => e.alive).length;
        const quotaDone = run.spawnSys ? (run.spawnSys.waveQuotaDone || alive === 0) : alive === 0;
        if (alive === 0 && quotaDone && this.t > 2) {
          this.state = 'purified'; this.t = 0; this.shock = 0;
          if (hook.onPurified) hook.onPurified(this);
        }
        break;
      }
      case 'purified':
        this.shock = Math.min(1, this.t / 0.9);
        if (this.t > 1.0) { this.state = 'open'; this.t = 0; if (hook.onOpen) hook.onOpen(this); }
        break;
      case 'open':
        this.openAmt = Math.min(1, this.openAmt + dt * 1.6);
        break;
      default: break;
    }
  }

  /** Ring terdeformasi sebagai array radii (untuk renderer GL / snapshot). */
  radiiArray(out = new Float32Array(N)) {
    for (let i = 0; i < N; i++) out[i] = this.points[i].r;
    return out;
  }
}

export const CHAMBER_POINTS = N;
