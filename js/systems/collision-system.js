/**
 * collision-system.js — Deteksi tabrakan circle-to-circle dengan spatial
 * partitioning grid sederhana.
 *
 * Dunia dibagi menjadi grid sel berukuran tetap (cellSize px). Setiap frame,
 * musuh dimasukkan ke sel sesuai posisinya; pemeriksaan tabrakan hanya
 * dilakukan terhadap objek di sel yang sama / sel berdekatan — sehingga
 * performa tetap baik dengan 100+ entity aktif (O(n·k), bukan O(n²)).
 *
 * Kollision circle: jarak antar center < jumlah radius (pakai perbandingan
 * kuadrat agar tak perlu sqrt).
 */

export class SpatialGrid {
  constructor(cellSize = 96) {
    this.cellSize = cellSize;
    this.cells = new Map(); // "cx,cy" → array entity
    this._stamp = 0;        // penanda query untuk dedup
  }

  clear() {
    this.cells.clear();
  }

  _key(cx, cy) {
    return cx + ',' + cy;
  }

  /** Sisipkan entity ke seluruh sel yang ter-cover bounding circle-nya. */
  insert(entity, radius) {
    const cs = this.cellSize;
    const x0 = Math.floor((entity.x - radius) / cs);
    const x1 = Math.floor((entity.x + radius) / cs);
    const y0 = Math.floor((entity.y - radius) / cs);
    const y1 = Math.floor((entity.y + radius) / cs);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this._key(cx, cy);
        let arr = this.cells.get(k);
        if (!arr) {
          arr = [];
          this.cells.set(k, arr);
        }
        arr.push(entity);
      }
    }
  }

  /**
   * Query semua unik entity yang sel-selnya overlap lingkaran (x, y, r).
   * @param {(entity)=>void} fn
   */
  queryCircle(x, y, r, fn) {
    const cs = this.cellSize;
    const x0 = Math.floor((x - r) / cs);
    const x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs);
    const y1 = Math.floor((y + r) / cs);
    this._stamp++;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this._key(cx, cy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const e = arr[i];
          if (e.__qstamp === this._stamp) continue; // sudah dikunjungi query ini
          e.__qstamp = this._stamp;
          fn(e);
        }
      }
    }
  }
}

export class CollisionSystem {
  constructor(cellSize = 96) {
    this.grid = new SpatialGrid(cellSize);
  }

  /** Bangun ulang grid musuh untuk frame ini. */
  rebuildEnemyGrid(enemies) {
    this.grid.clear();
    for (const e of enemies) {
      if (e.alive) this.grid.insert(e, e.radius);
    }
  }

  /** Cari musuh terdekat dalam radius tertentu dari titik (x, y). */
  findNearestEnemy(x, y, range) {
    let best = null;
    let bestD2 = range * range;
    this.grid.queryCircle(x, y, range, (e) => {
      if (!e.alive) return;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      // kompensasi radius musuh: gunakan center-to-center dikurangi radius
      const eff = d2 - e.radius * e.radius * 0.5;
      if (eff < bestD2) {
        bestD2 = eff;
        best = e;
      }
    });
    return best;
  }

  /**
   * Kollision proyektil vs musuh (grid query per proyektil).
   * @returns {string[]} uid musuh yang mati frame ini
   */
  handleProjectileHits(projectiles, onHit) {
    const killed = [];
    for (const p of projectiles) {
      if (!p.alive) continue;
      this.grid.queryCircle(p.x, p.y, p.radius + 50, (e) => {
        if (!p.alive || !e.alive) return;
        if (p.hitSet.has(e.uid)) return;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const rr = e.radius + p.radius;
        if (dx * dx + dy * dy < rr * rr) {
          p.hitSet.add(e.uid);
          const died = onHit(p, e);
          if (died) killed.push(e.uid);
          if (p.hitSet.size >= p.pierce) {
            p.alive = false;
          }
        }
      });
    }
    return killed;
  }

  /**
   * Kollision player vs musuh (contact damage).
   * @returns {{enemy, damage} | null}
   */
  checkPlayerCollision(player) {
    let hit = null;
    this.grid.queryCircle(player.x, player.y, player.radius + 50, (e) => {
      if (hit || !e.alive) return;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const rr = e.radius + player.radius;
      if (dx * dx + dy * dy < rr * rr) {
        hit = { enemy: e, damage: e.damage };
      }
    });
    return hit;
  }

  /**
   * Separation antar musuh: dorong entitas yang saling tumpang tindih agar
   * kumpulan musuh tidak menyatu jadi satu titik.
   */
  separateEnemies(enemies) {
    for (const e of enemies) {
      if (!e.alive) continue;
      this.grid.queryCircle(e.x, e.y, e.radius * 2 + 8, (o) => {
        if (o === e || !o.alive || !e.alive) return;
        const dx = o.x - e.x;
        const dy = o.y - e.y;
        const rr = e.radius + o.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.0001 && d2 < rr * rr) {
          const d = Math.sqrt(d2);
          const push = (rr - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          // Boss (massa besar) tidak terdorong
          if (!e.isBoss) {
            e.x -= nx * push;
            e.y -= ny * push;
          }
          if (!o.isBoss) {
            o.x += nx * push;
            o.y += ny * push;
          }
        }
      });
    }
  }
}

/** Uji circle-to-circle murni: jarak center < jumlah radius. */
export function circleOverlap(ax, ay, ar, bx, by, br) {
  const dx = bx - ax;
  const dy = by - ay;
  const rr = ar + br;
  return dx * dx + dy * dy < rr * rr;
}
