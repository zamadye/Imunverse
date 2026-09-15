/** test-map-camera.mjs — MAP AGENT: epic zoom zona kamera (node, tanpa browser).
 * Cakupan: init, konvergensi masuk/keluar, kick tepi-naik, clamp, reset,
 * rasio proyeksi ×zoneScale, independensi vs punch-zoom. Exit 1 bila FAIL.
 * Jalankan: node scripts/test-map-camera.mjs */
import { Camera, ZONE_ZOOM } from '../js/render/camera.js';

let fails = 0, checks = 0;
const log = (k, ok, d = '') => { checks++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${k}${d ? ' ' + d : ''}`); };
const step = (cam, n, dt = 1 / 60) => { for (let i = 0; i < n; i++) cam.update(dt); };

// 1) init
{
  const c = new Camera();
  log('cam-init', c.zoneScale === 1 && c.zoneTarget === 1 && c.punchScale === 1);
  log('cam-tuning', ZONE_ZOOM.BOSS === 1.18 && ZONE_ZOOM.DANGER === 1.1 && ZONE_ZOOM.BOSS_RANGE === 520);
}
// 2) konvergensi masuk (~1 dtk sinematik) & keluar (cepat)
{
  const c = new Camera(); c.reset(0, 0);
  c.setZoneZoom(ZONE_ZOOM.BOSS);
  step(c, 180);
  const rin = Math.abs(c.zoneScale - 1.18);
  c.setZoneZoom(1);
  step(c, 120);
  const rout = Math.abs(c.zoneScale - 1);
  log('cam-converge', rin < 0.01 && rout < 0.01, `in≈${c.zoneScale.toFixed(3)}`);
}
// 3) kick hanya di tepi naik
{
  const c = new Camera(); c.reset(0, 0);
  c.setZoneZoom(1.18);
  const t1 = c.shakeTrauma;
  c.setZoneZoom(1.18);
  const t2 = c.shakeTrauma;
  c.setZoneZoom(1);
  const t3 = c.shakeTrauma;
  log('cam-kick-edge', t1 > 0 && t2 === t1 && t3 === t1, `t=${t1}`);
}
// 4) clamp target
{
  const c = new Camera(); c.reset(0, 0);
  c.setZoneZoom(9);
  const hi = c.zoneTarget;
  c.setZoneZoom(0.5);
  const lo = c.zoneTarget;
  c.setZoneZoom(undefined);
  const un = c.zoneTarget;
  log('cam-clamp', hi === 1.35 && lo === 1 && un === 1, `${hi}/${lo}/${un}`);
}
// 5) reset membersihkan
{
  const c = new Camera(); c.reset(0, 0);
  c.setZoneZoom(1.18); step(c, 60);
  c.reset(100, 200);
  log('cam-reset', c.zoneScale === 1 && c.zoneTarget === 1 && c.x === 100 && c.y === 200);
}
// 6) proyeksi diskalakan ×zoneScale (set langsung, tanpa trauma)
{
  const c = new Camera(); c.reset(0, 0);
  const P = c.makeProjector(844, 390);
  const q1 = P.project(100, 0);
  c.zoneScale = 1.18;
  const q2 = P.project(100, 0);
  const r = (q2.x - 422) / (q1.x - 422);
  log('cam-project-ratio', Math.abs(r - 1.18) < 0.001, `r=${r.toFixed(4)}`);
}
// 7) punch × zona saling independen (multiplikatif)
{
  const c = new Camera(); c.reset(0, 0);
  const P = c.makeProjector(844, 390);
  const s0 = P.project(50, 50).s;
  c.punchScale = 1.09; c.zoneScale = 1.18;
  const s1 = P.project(50, 50).s;
  log('cam-layers', Math.abs(s1 / s0 - 1.09 * 1.18) < 1e-9, `r=${(s1 / s0).toFixed(4)}`);
}
console.log(`--- ${checks - fails}/${checks} PASS ---`);
process.exitCode = fails ? 1 : 0;
