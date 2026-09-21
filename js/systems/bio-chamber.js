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
    this.points = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      // siluet berlobus organik (bukan lingkaran polos) — deterministik per organ
      const lob = 1 + Math.sin(a * this.lobes + this.seed * 6) * 0.10 + Math.sin(a * (this.lobes * 2 + 1) - this.seed * 3) * 0.05;
      const base = this.R * lob;
      this.points.push({ a, base, r: base, v: 0 });
    }
    this.k = ch.stiffness || 0.16;     // kekakuan pegas membran
    this.damp = ch.damping || 0.86;    // peredaman fluida daging
    this.time = 0;
    this.state = 'entry';
    this.t = 0;
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
    return { x: this.cx + Math.cos(v.a) * r, y: this.cy + Math.sin(v.a) * r, a: v.a };
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
