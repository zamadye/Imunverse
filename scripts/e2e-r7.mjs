/**
 * e2e-r7.mjs — R7 (Rebuild): Modul E — Chemotaxis Trail.
 * Verifikasi: skill dash/buff_self mengaktifkan jendela emisi; segmen jatuh
 * per interval+jarak saat bergerak (diam = tidak ada); lifetime 4 s + cleanup;
 * segmen muda tidak membuff vs matang membuff ×1.18 (lepas → 1); cap 60;
 * telemetry per jendela; flag OFF mati total.
 * Jalankan: node scripts/e2e-r7.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require(process.env.PW_PATH || '/tmp/pw/node_modules/playwright-core');

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs:/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
const log = (k, v, extra) => console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${extra ? ' ' + extra : ''}`);

try {
  await page.goto('http://localhost:8000/?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }

  const flag = await page.evaluate(() => window.__IMUNVERSE.getData().modules.modules.chemotaxisTrail.enabled);
  log('module-e-enabled', flag === true);

  // NK punya shadowstep (dash, slot 1) — aktivator jejak paling jelas
// Stabilizer: mekanik diuji pada kepadatan rendah (sandbox CPU-render;
  // mitigasi flake frame-rate — perilaku gameplay tak berubah v2/fitur tetap)
  await page.evaluate(() => {
    const w = window.__IMUNVERSE.getData().waves;
    w.ecosystem = { ...w.ecosystem, targetBase: 12, targetMax: 40 };
    w.maxAliveEnemies = 60;
  });

    await page.evaluate(() => window.__IMUNVERSE.game.startRun('nkcell'));
  await page.waitForTimeout(900);

  // ---- 1) skill dash mengaktifkan jendela emisi ----
  const act = await page.evaluate(() => {
    const g = window.__IMUNVERSE.game, run = g.run;
    const before = run.chemoActiveT;
    g.run.skills.slots.forEach((s) => { if (s) s.unlocked = true; });
    const used = g.useAbilityBySlot(1); // shadowstep (kind 'dash')
    return { before, used, after: run.chemoActiveT };
  });
  log('dash-activates-window', act.before <= 0 && act.used === true && act.after > 5.5, JSON.stringify(act));

  // ---- 2) bergerak → segmen per interval + jarak; diam → berhenti ----
  const emit = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game, run = g.run, input = window.__IMUNVERSE.input;
    run.chemoTrail.length = 0;
    input.keys.add('right'); // gerak kanan
    await new Promise((r) => setTimeout(r, 1000));
    const nMoving = run.chemoTrail.length;
    input.keys.delete('right'); // diam
    // deselerasi ~0.08s masih gerakan NYATA — boleh menjatuhkan ≤1 segmen;
    // yang diuji: setelah benar-benar diam, emisi BERHENTI total.
    await new Promise((r) => setTimeout(r, 400));
    const nIdle = run.chemoTrail.length;
    await new Promise((r) => setTimeout(r, 500));
    const nIdle2 = run.chemoTrail.length;
    // jarak antar segmen ≥ minSegDist
    let minGap = 1e9;
    for (let i = 1; i < run.chemoTrail.length; i++) {
      const a = run.chemoTrail[i - 1], b = run.chemoTrail[i];
      minGap = Math.min(minGap, Math.hypot(b.x - a.x, b.y - a.y));
    }
    return { nMoving, nIdle, nIdle2, minGap };
  });
  // 1 s gerak @0.15 s/segmen → ~5-7 segmen; diam tidak menambah
  log('segments-emit-on-move-only', emit.nMoving >= 3 && emit.nIdle - emit.nMoving <= 1 && emit.nIdle2 === emit.nIdle, JSON.stringify(emit));
  log('min-segment-distance', emit.minGap >= 17.5, `minGap=${Math.round(emit.minGap * 10) / 10}`);

  // ---- 3) lifetime + cleanup per frame ----
  const clean = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game, run = g.run;
    run.chemoTrail.length = 0;
    run.chemoTrail.push({ x: run.player.x + 500, y: run.player.y, t: run.time - 10, buffType: 'speed', buffValue: 1.18 }); // kadaluwarsa
    run.chemoTrail.push({ x: run.player.x + 550, y: run.player.y, t: run.time - 1, buffType: 'speed', buffValue: 1.18 });  // hidup
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    return { n: run.chemoTrail.length, aliveT: run.chemoTrail[0] ? Math.round(run.time - run.chemoTrail[0].t) : -1 };
  });
  log('lifetime-cleanup', clean.n === 1 && clean.aliveT === 1, JSON.stringify(clean));

  // ---- 4) buff overlap: muda TIDAK, matang YA (×1.18), lepas → 1 ----
  const buff = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game, run = g.run, p = run.player;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    run.chemoTrail.length = 0;
    // segmen MUDA tepat di kaki hero
    run.chemoTrail.push({ x: p.x, y: p.y, t: run.time, buffType: 'speed', buffValue: 1.18 });
    await frame(); await frame();
    const young = run.chemoSpeedMult;
    // jadikan matang (usia > 0.5 s)
    run.chemoTrail[0].t = run.time - 1;
    await frame(); await frame();
    const mature = run.chemoSpeedMult;
    // jauhkan segmen → buff lepas seketika
    run.chemoTrail[0].x = p.x + 900;
    await frame(); await frame();
    const off = run.chemoSpeedMult;
    return { young, mature, off };
  });
  log('young-segment-no-buff', buff.young === 1, JSON.stringify(buff));
  log('mature-overlap-buffs-1.18', Math.abs(buff.mature - 1.18) < 1e-9);
  log('buff-drops-off-trail', buff.off === 1);

  // ---- 5) buff benar-benar mempercepat gerak nyata ----
  const speed = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game, run = g.run, p = run.player, input = window.__IMUNVERSE.input;
    const dist = async () => {
      const x0 = p.x, y0 = p.y;
      await new Promise((r) => setTimeout(r, 600));
      return Math.hypot(p.x - x0, p.y - y0);
    };
    run.chemoTrail.length = 0;
    run.chemoActiveT = 0; // matikan emisi agar jejak tak nambah sendiri
    input.keys.add('right');
    await new Promise((r) => setTimeout(r, 300)); // lewati ramp akselerasi
    const dPlain = await dist();
    // karpet segmen matang di sepanjang jalur ke kanan
    for (let i = 0; i < 50; i++) run.chemoTrail.push({ x: p.x + i * 24, y: p.y, t: run.time - 1, buffType: 'speed', buffValue: 1.18 });
    await new Promise((r) => setTimeout(r, 150));
    const dBuffed = await dist();
    input.keys.delete('right');
    return { dPlain: Math.round(dPlain), dBuffed: Math.round(dBuffed), ratio: dBuffed / dPlain };
  });
  log('buff-speeds-up-movement', speed.ratio > 1.1 && speed.ratio < 1.3, JSON.stringify(speed));

  // ---- 6) cap 60 segmen ----
  const cap = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game, run = g.run, input = window.__IMUNVERSE.input;
    run.chemoTrail.length = 0;
    for (let i = 0; i < 60; i++) run.chemoTrail.push({ x: run.player.x + 2000 + i, y: run.player.y, t: run.time - 0.1, buffType: 'speed', buffValue: 1.18 });
    run.chemoActiveT = 6; run.chemoEmitT = 0;
    input.keys.add('down');
    await new Promise((r) => setTimeout(r, 500));
    input.keys.delete('down');
    return { n: run.chemoTrail.length };
  });
  log('max-segments-cap-60', cap.n <= 60, JSON.stringify(cap));

  // ---- 7) telemetry per jendela emisi (biarkan jendela habis) ----
  const tel = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game, run = g.run;
    run.chemoActiveT = 0.05; // percepat akhir jendela
    run.chemoStat = { segments: 7, buffSec: 1.25 };
    await new Promise((r) => setTimeout(r, 300));
    const db = JSON.parse(localStorage.getItem('imunverse.metrics.v1') || '{}');
    const ev = (db.moduleEvents || []).filter((e) => e.moduleId === 'chemotaxisTrail');
    return { n: ev.length, last: ev[ev.length - 1] || null };
  });
  log('telemetry-chemo-window', tel.n >= 1 && tel.last && tel.last.segments === 7 && Math.abs(tel.last.buffSec - 1.3) < 0.11, `n=${tel.n} last=${JSON.stringify(tel.last)}`);

  // ---- 8) screenshot: jejak sinyal + rim matang ----
  await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game, run = g.run, input = window.__IMUNVERSE.input;
    run.chemoTrail.length = 0;
    g.run.skills.slots.forEach((s) => { if (s) s.unlocked = true; });
    g.useAbilityBySlot(1); // shadowstep → jendela + label
    input.keys.add('right'); input.keys.add('down');
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const i = window.__IMUNVERSE.input; i.keys.delete('down'); i.keys.delete('right'); i.keys.add('left'); });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__IMUNVERSE.input.keys.delete('left'));
  await page.screenshot({ path: 'shots/review/r7-chemo-trail.png' });
  log('screenshot-saved', true, 'shots/review/r7-chemo-trail.png');

  // ---- 9) flag OFF: tanpa jendela, tanpa segmen, mult tetap 1 ----
  await page.evaluate(() => localStorage.setItem('imunverse.module.chemotaxisTrail', '0'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }
  const off = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game, input = window.__IMUNVERSE.input;
    g.startRun('nkcell');
    await new Promise((r) => setTimeout(r, 700));
    const run = g.run;
    g.run.skills.slots.forEach((s) => { if (s) s.unlocked = true; });
    const used = g.useAbilityBySlot(1); // shadowstep tetap jalan (dash lama)
    input.keys.add('right');
    await new Promise((r) => setTimeout(r, 600));
    input.keys.delete('right');
    // paksa segmen manual pun → chemoUpdate flag OFF tidak membuff
    run.chemoTrail.push({ x: run.player.x, y: run.player.y, t: run.time - 1, buffType: 'speed', buffValue: 1.18 });
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    return { used, activeT: run.chemoActiveT, emitted: run.chemoTrail.length <= 1, mult: run.chemoSpeedMult };
  });
  log('flag-off-dead', off.used === true && off.activeT <= 0 && off.emitted === true && off.mult === 1, JSON.stringify(off));
  await page.evaluate(() => localStorage.removeItem('imunverse.module.chemotaxisTrail'));

  log('zero-pageerror', errors.length === 0, errors.join(' | '));
} catch (err) {
  console.log('FAIL suite-crash', err.message);
} finally {
  await browser.close();
}
