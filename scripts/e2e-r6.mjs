/**
 * e2e-r6.mjs — R6 (Rebuild): Modul D — Tag-Cascade / Opsonisasi.
 * Verifikasi: hit men-tag, tagged mati → cascade radius (luar aman), dmg 50%
 * + decay 0.6/hop, chain berhenti di maxHops, T2 tanpa kamera vs T3 punch +
 * hit-stop, punch-zoom ease-out kembali ke 1, throttle, telemetry, flag OFF.
 * Jalankan: node scripts/e2e-r6.mjs
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

  const flag = await page.evaluate(() => window.__IMUNVERSE.getData().modules.modules.tagCascade.enabled);
  log('module-d-enabled', flag === true);

  await page.evaluate(() => window.__IMUNVERSE.game.startRun('macrophage'));
  await page.waitForTimeout(900);

  // Helper: buat musuh tebal di posisi tertentu (frozen agar diam)
  const setup = `
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    const mk = (x, y, hp = 100000) => {
      g.spawnEnemy('bakteri', false);
      const e = run.enemies[run.enemies.length - 1];
      e.x = x; e.y = y; e.hp = e.maxHP = hp; e.armorLayers = 0; e.frozen = 999;
      e.cascadeTag = false; e.cascadeHopIn = 0; e.cascadeDone = false;
      return e;
    };
    run.cascadeTimes.length = 0;
    run.enemies.length = 0; // arena bersih — uji terisolasi dari sisa uji lain
  `;

  // ---- 1) hit hero men-tag musuh (T1) ----
  const tag = await page.evaluate(`(async () => {
    ${setup}
    const e = mk(run.player.x + 900, run.player.y);
    const before = e.cascadeTag;
    g.spawnHitFeedback(e, 5, false);
    return { before, after: e.cascadeTag };
  })()`);
  log('hit-tags-enemy', tag.before === false && tag.after === true, JSON.stringify(tag));

  // ---- 2) tagged mati → tetangga dalam radius kena, luar radius aman ----
  const casc = await page.evaluate(`(async () => {
    ${setup}
    const cx = run.player.x + 900, cy = run.player.y;
    const victim = mk(cx, cy, 1);
    const near = mk(cx + 60, cy);
    const far = mk(cx + 400, cy);
    victim.cascadeTag = true;
    const hn0 = near.hp, hf0 = far.hp;
    victim.takeDamage(99999);
    g.onEnemyKilled(victim, null);
    const expected = Math.max(1, Math.round(run.player.stats.damage * 0.5));
    return { dNear: hn0 - near.hp, dFar: hf0 - far.hp, expected,
             nearTagged: near.cascadeTag, nearHop: near.cascadeHopIn };
  })()`);
  log('cascade-hits-in-radius', casc.dNear === casc.expected && casc.dFar === 0, JSON.stringify(casc));
  log('victims-tagged-next-hop', casc.nearTagged === true && casc.nearHop === 1);

  // ---- 3) chain hop: dmg decay 0.6, berhenti di maxHops ----
  const chain = await page.evaluate(`(async () => {
    ${setup}
    const cx = run.player.x + 900, cy = run.player.y;
    // rantai: v0(mati) → v1 (1 HP, 60px) → v2 (tebal, 60px dari v1, 120+ dari v0)
    const v0 = mk(cx, cy, 1);        v0.cascadeTag = true;
    const v1 = mk(cx + 100, cy, 1);  // dalam radius v0 → mati kena cascade
    const v2 = mk(cx + 200, cy);     // dalam radius v1, LUAR radius v0 (120+r)
    const h2 = v2.hp;
    v0.takeDamage(99999);
    g.onEnemyKilled(v0, null);
    const base = run.player.stats.damage;
    const hop1 = Math.max(1, Math.round(base * 0.5 * 0.6)); // dmg hop-1
    // maxHops: musuh dgn hopIn=4 mati ter-tag → TIDAK ada cascade lagi
    run.cascadeTimes.length = 0;
    const vMax = mk(cx + 2000, cy, 1);
    vMax.cascadeTag = true; vMax.cascadeHopIn = 4;
    const nb = mk(cx + 2060, cy);
    const hnb = nb.hp;
    vMax.takeDamage(99999);
    g.onEnemyKilled(vMax, null);
    return { d2: h2 - v2.hp, hop1, v1dead: !v1.alive, maxHopBlocked: hnb - nb.hp === 0 };
  })()`);
  log('chain-decay-0.6-per-hop', chain.v1dead === true && chain.d2 === chain.hop1, JSON.stringify(chain));
  log('chain-stops-at-max-hops', chain.maxHopBlocked === true);

  // ---- 4) T2 (<3 target) tanpa kamera vs T3 (≥3) punch+hit-stop ----
  const tiers = await page.evaluate(`(async () => {
    ${setup}
    const cx = run.player.x + 900, cy = run.player.y;
    // T2: 1 tetangga
    const a = mk(cx, cy, 1); a.cascadeTag = true;
    mk(cx + 60, cy);
    run.camera.punchScale = 1; run.camera.punchAmp = 0; run.hitStop = 0;
    a.takeDamage(99999); g.onEnemyKilled(a, null);
    const t2punch = run.camera.punchAmp, t2stop = run.hitStop;
    // T3: 3 tetangga
    run.cascadeTimes.length = 0; run.hitStop = 0;
    const b = mk(cx + 1000, cy, 1); b.cascadeTag = true;
    mk(cx + 1060, cy); mk(cx + 940, cy); mk(cx + 1000, cy + 60);
    b.takeDamage(99999); g.onEnemyKilled(b, null);
    return { t2punch, t2stop, t3punch: run.camera.punchAmp, t3stop: run.hitStop };
  })()`);
  // t2stop bisa berisi hit-stop KILL bawaan pra-R6 (gamefeel Phase 1) — yang
  // diuji: cascade T2 tidak menambah punch maupun hit-stop level T3 (0.07).
  log('tier2-no-camera', tiers.t2punch === 0 && tiers.t2stop < 0.07, JSON.stringify(tiers));
  log('tier3-punch-and-hitstop', Math.abs(tiers.t3punch - 0.09) < 1e-9 && Math.abs(tiers.t3stop - 0.07) < 1e-9);

  // ---- 5) punch-zoom ease-out kembali ke 1 ----
  const punch = await page.evaluate(async () => {
    const cam = window.__IMUNVERSE.game.run.camera;
    cam.punchZoom(0.09, 0.28);
    cam.update(0.05);
    const mid = cam.punchScale;
    for (let i = 0; i < 10; i++) cam.update(0.05);
    return { mid, end: cam.punchScale, weaker: (() => { cam.punchScale = 1.05; cam.punchAmp = 0.05; cam.punchDur = 0.28; cam.punchT = 0; cam.punchZoom(0.02, 0.28); return cam.punchAmp; })() };
  });
  log('punch-zoom-ease-out', punch.mid > 1 && punch.mid <= 1.09 && punch.end === 1, JSON.stringify(punch));
  log('weaker-punch-no-override', Math.abs(punch.weaker - 0.05) < 1e-9);

  // ---- 6) throttle: maks 3 cascade per 0.6 s ----
  const throttle = await page.evaluate(`(async () => {
    ${setup}
    const cy = run.player.y;
    let exploded = 0;
    for (let i = 0; i < 5; i++) {
      const cx = run.player.x + 3000 + i * 500;
      const v = mk(cx, cy, 1); v.cascadeTag = true;
      const n = mk(cx + 60, cy);
      const h0 = n.hp;
      v.takeDamage(99999); g.onEnemyKilled(v, null);
      if (h0 - n.hp > 0) exploded++;
    }
    return { exploded, times: run.cascadeTimes.length };
  })()`);
  log('throttle-max-3-per-window', throttle.exploded === 3, JSON.stringify(throttle));

  // ---- 7) telemetry ----
  const tel = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('imunverse.metrics.v1') || '{}');
    const ev = (db.moduleEvents || []).filter((e) => e.moduleId === 'tagCascade');
    return { n: ev.length, sample: ev[ev.length - 1] || null };
  });
  log('telemetry-cascade', tel.n >= 3, `n=${tel.n} sample=${JSON.stringify(tel.sample)}`);

  // ---- 8) screenshot: outline tag + shockwave cascade ----
  await page.evaluate(`(async () => {
    ${setup}
    const cx = run.player.x + 140, cy = run.player.y;
    const v = mk(cx, cy, 1); v.cascadeTag = true;
    mk(cx + 70, cy); mk(cx - 70, cy); mk(cx, cy + 70);
    v.takeDamage(99999); g.onEnemyKilled(v, null);
  })()`);
  await page.waitForTimeout(120);
  await page.screenshot({ path: 'shots/review/r6-tag-cascade.png' });
  log('screenshot-saved', true, 'shots/review/r6-tag-cascade.png');

  // ---- 9) flag OFF: tanpa tag, tanpa cascade, punch tak tersentuh ----
  await page.evaluate(() => localStorage.setItem('imunverse.module.tagCascade', '0'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }
  const off = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    g.startRun('macrophage');
    await new Promise((r) => setTimeout(r, 700));
    const run = g.run;
    g.spawnEnemy('bakteri', false);
    const e = run.enemies[run.enemies.length - 1];
    e.x = run.player.x + 900; e.y = run.player.y; e.hp = e.maxHP = 1; e.frozen = 999;
    g.spawnHitFeedback(e, 5, false);
    const tagged = e.cascadeTag;
    g.spawnEnemy('bakteri', false);
    const n = run.enemies[run.enemies.length - 1];
    n.x = e.x + 60; n.y = e.y; n.hp = n.maxHP = 100000; n.armorLayers = 0; n.frozen = 999;
    const h0 = n.hp;
    e.cascadeTag = true; // paksa pun — flag OFF harus tetap mati
    e.takeDamage(99999); g.onEnemyKilled(e, null);
    return { tagged, cascDmg: h0 - n.hp, punch: run.camera.punchAmp };
  });
  log('flag-off-dead', off.tagged === false && off.cascDmg === 0 && off.punch === 0, JSON.stringify(off));
  await page.evaluate(() => localStorage.removeItem('imunverse.module.tagCascade'));

  log('zero-pageerror', errors.length === 0, errors.join(' | '));
} catch (err) {
  console.log('FAIL suite-crash', err.message);
} finally {
  await browser.close();
}
