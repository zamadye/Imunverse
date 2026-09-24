/**
 * erythrocytes.js — PILAR 4 SPEC "CLOSED BIOLOGICAL COMBAT ARENA":
 * partikel ERITROSIT (sel darah merah) yang hanyut oleh FLUID DRAG di dalam
 * chamber tertutup. Bukan dekorasi statis: tiap partikel punya vel yang
 * ditarik menuju medan arus (curl-noise prosedural + drift zona + swirl
 * lembut mengelilingi arena), lalu diredam drag cairan — gerakannya lembam,
 * bukan linier. Tabrakan dinding membran memakai radiusAt chamber sehingga
 * arus ikut "menggenang" di lekukan dinding.
 *
 * Render: cakram bikonkaf (donat) — cincin terang + lekuk tengah gelap —
 * diorientasikan searah kecepatan, alpha & skala mengikuti kedalaman z.
 * Murni presentasi (tidak memengaruhi collision/combat).
 */

const TAU = Math.PI * 2;

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Medan arus curl-noise murah (sudut aliran di titik x,y pada waktu t). */
function flowAngle(x, y, t, seed) {
  const s = 0.0035;
  const n = Math.sin(x * s + t * 0.35 + seed) + Math.cos(y * s * 1.3 - t * 0.27)
    + Math.sin((x + y) * s * 0.6 + t * 0.18);
  return n * 2.1;
}

export class ErythroFlow {
  constructor(count = 84) {
    this.count = count;
    this.ps = [];
    this.zoneKey = null;
  }

  /** (Re)sebar partikel di dalam chamber (dipanggil saat zona berganti). */
  seed(chamber) {
    if (!chamber) return;
    this.zoneKey = chamber.zoneId || null;
    this.ps = [];
    // Bentuk room non-lingkaran (alveoli/dual/koil): tolak sampel di dinding.
    const hasSdf = typeof chamber.sdf === 'function';
    for (let i = 0; i < this.count; i++) {
      let px = chamber.cx, py = chamber.cy;
      for (let tries = 0; tries < 8; tries++) {
        const a = hash2(i, 1.7 + tries * 13.1) * TAU;
        const rr = chamber.R * (0.18 + 0.74 * hash2(i, 9.2 + tries * 7.7));
        px = chamber.cx + Math.cos(a) * rr;
        py = chamber.cy + Math.sin(a) * rr;
        if (!hasSdf || chamber.sdf(px, py) < -6) break;
      }
      this.ps.push({
        x: px,
        y: py,
        vx: 0, vy: 0,
        z: 0.45 + 0.55 * hash2(i, 4.4),   // kedalaman: paralax & alpha
        spin: hash2(i, 7.9) * TAU,
        r: 7 + 6 * hash2(i, 2.2),
      });
    }
  }

  /**
   * @param {number} dt
   * @param {object} chamber BioChamber aktif
   * @param {object} drift {x,y} arus zona (bloodstream dll.), boleh null
   * @param {number} time detik global
   */
  update(dt, chamber, drift, time) {
    if (!chamber || !this.ps.length) return;
    const drag = 2.6;              // kekentalan plasma — makin tinggi makin lembam
    const flowSpd = 46 + (chamber.swarm ? 34 : 0); // swarm = arus lebih gelisah
    const dx0 = drift ? drift.x : 0, dy0 = drift ? drift.y : 0;
    for (const p of this.ps) {
      const fa = flowAngle(p.x, p.y, time, p.spin);
      // swirl lembut mengelilingi pusat arena (arus melingkar khas pembuluh)
      const rx = p.x - chamber.cx, ry = p.y - chamber.cy;
      const rl = Math.hypot(rx, ry) || 1;
      const swx = -ry / rl, swy = rx / rl;
      const tvx = Math.cos(fa) * flowSpd + swx * 22 + dx0 * 30;
      const tvy = Math.sin(fa) * flowSpd + swy * 22 + dy0 * 30;
      // fluid drag: vel mengejar medan arus secara eksponensial
      const k = 1 - Math.exp(-drag * dt);
      p.vx += (tvx - p.vx) * k;
      p.vy += (tvy - p.vy) * k;
      p.x += p.vx * dt * (0.55 + 0.45 * p.z);
      p.y += p.vy * dt * (0.55 + 0.45 * p.z);
      // pilar internal: jangan menembus massa gelap
      for (const pi of chamber.pillars || []) {
        const ddx = p.x - pi.x, ddy = p.y - pi.y;
        const rr2 = Math.hypot(ddx, ddy) || 1;
        if (rr2 < pi.r + 14) { p.x = pi.x + (ddx / rr2) * (pi.r + 14); p.y = pi.y + (ddy / rr2) * (pi.r + 14); }
      }
      // containment dinding membran: dorong masuk + redam
      const a = Math.atan2(p.y - chamber.cy, p.x - chamber.cx);
      const wall = chamber.radiusAt(a) - 26;
      const rr = Math.hypot(p.x - chamber.cx, p.y - chamber.cy);
      if (rr > wall) {
        const ux = (p.x - chamber.cx) / rr, uy = (p.y - chamber.cy) / rr;
        p.x = chamber.cx + ux * wall;
        p.y = chamber.cy + uy * wall;
        const vn = p.vx * ux + p.vy * uy;
        p.vx -= 1.6 * vn * ux; p.vy -= 1.6 * vn * uy;
      }
    }
  }

  /** Gambar di atas interior chamber, di bawah entitas. */
  draw(ctx, P, chamber) {
    if (!chamber || !this.ps.length) return;
    ctx.save();
    for (const p of this.ps) {
      const q = P.project(p.x, p.y);
      const s = q.s * (0.6 + 0.55 * p.z);
      const rad = p.r * s;
      if (rad < 0.8) continue;
      const ang = Math.atan2(p.vy, p.vx);
      const alpha = 0.16 + 0.34 * p.z;
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(ang);
      ctx.scale(1, 0.62); // cakram dimiringkan (perspektif sel mengapung)
      // cincin terang (tepi sel)
      const g = ctx.createRadialGradient(0, 0, rad * 0.2, 0, 0, rad);
      g.addColorStop(0, `rgba(120,18,26,${alpha * 0.9})`);   // lekuk bikonkaf
      g.addColorStop(0.55, `rgba(196,44,52,${alpha})`);
      g.addColorStop(0.85, `rgba(232,86,84,${alpha * 1.05})`);
      g.addColorStop(1, 'rgba(232,86,84,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}
