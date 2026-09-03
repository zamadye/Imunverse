/**
 * game-loop.js — Loop utama berbasis requestAnimationFrame dengan delta-time.
 *
 * dt dihitung dari selisih timestamp rAF (dalam detik), BUKAN asumsi 60fps,
 * sehingga gameplay konsisten di device 30/60/120/144 Hz.
 * dt di-clamp agar lonjakan besar (tab di-background, GC stall) tidak
 * membuat entity "menembus" collision.
 */

export class GameLoop {
  /**
   * @param {(dt:number, time:number)=>void} updateFn  update logika (dipanggil saat tidak paused)
   * @param {(dt:number, time:number)=>void} renderFn  render frame (selalu dipanggil)
   */
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.paused = false;
    this.running = false;
    this.time = 0;          // akumulasi waktu game (detik, sudah dikurangi pause)
    this._last = 0;
    this._rafId = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  setPaused(v) {
    this.paused = v;
    // reset _last agar tidak ada lompatan dt saat resume
    this._last = performance.now();
  }

  _tick(now) {
    if (!this.running) return;
    // Delta-time nyata dari timestamp rAF, dalam detik.
    let dt = (now - this._last) / 1000;
    this._last = now;
    // Clamp: maksimum 50ms per step (device lambat mendapat slow-mo,
    // bukan teleport/tembus collision).
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;

    if (!this.paused) {
      this.time += dt;
      this.updateFn(dt, this.time);
    }
    this.renderFn(dt, this.time);

    this._rafId = requestAnimationFrame(this._tick);
  }
}
