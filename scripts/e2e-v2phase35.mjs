/**
 * e2e-v2phase35.mjs — V2 Phase 3 (HERO IDENTITY) + Phase 5 (ENEMY & BOSS).
 * Diuji dalam satu boot: passive hero (data + hook runtime), konsumsi mark,
 * elite affix + spawn terencana, boss enrage, volatile blast.
 * Jalankan: node scripts/e2e-v2phase35.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require(process.env.PW_PATH || '/tmp/pw/node_modules/playwright-core');

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
const log = (k, v) => console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${v === true || v === false ? '' : ' ' + v}`);
const active = (id) => page.evaluate((s) => document.querySelector(s)?.classList.contains('active') || false, id);

try {
  await page.goto('http://localhost:8000/?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }
  if (await page.locator('#screen-title.active').isVisible().catch(() => false)) {
    await page.click('#btn-title-login', { timeout: 4000, force: true });
    await page.waitForTimeout(400);
  }
  if (await active('#screen-auth')) {
    await page.fill('#auth-username', 'PemainHebat');
    await page.fill('#auth-password', '1234');
    await page.click('#auth-submit');
  }
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 }).catch(() => {});
  for (let k = 0; k < 8; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip', { timeout: 1500 }).catch(() => {}); await page.waitForTimeout(350); }

  // ============ PHASE 3 — data & unit-level (sebelum run) ============
  const p3data = await page.evaluate(() => {
    const hs = window.__IMUNVERSE.getData().heroes.heroes;
    return {
      total: hs.length,
      withPassive: hs.filter((h) => h.passive && h.passive.name && h.passive.desc && h.passive.type).length,
      types: [...new Set(hs.map((h) => h.passive?.type))].length,
    };
  });
  log('passive-11-of-11', p3data.total === 11 && p3data.withPassive === 11);
  log('passive-all-unique', p3data.types === 11);

  const deadCode = await page.evaluate(async () => {
    const r = await fetch('/js/core/game.js?v=x' + Date.now());
    const src = await r.text();
    return { selNkGone: !src.includes("heroDef.id === 'sel_nk'") };
  });
  log('dead-selnk-removed', deadCode.selNkGone);

  // ============ mulai run (hero default macrophage) ============
  await page.click('#btn-play', { timeout: 8000, force: true });
  await page.waitForTimeout(600);
  if (await page.evaluate(() => document.querySelector('#screen-prep')?.classList.contains('active'))) {
    await page.locator('.prep-hero:not(.locked)').first().click({ timeout: 4000 }).catch(() => {});
    await page.click('#btn-prep-start', { timeout: 8000 });
  }
  for (let k = 0; k < 6; k++) {
    if (await page.locator('#cine-skip').isVisible().catch(() => false)) await page.click('#cine-skip');
    await page.waitForTimeout(600);
    if (await active('#screen-hud')) break;
  }
  log('hud-active', await active('#screen-hud'));

  // ---- P3: Mako lifesteal_kill — kill memulihkan HP ----
  const mako = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const p = g.run.player;
    p.iframes = 99999;
    if (g.run.heroDef.id !== 'macrophage') return { skip: true, hero: g.run.heroDef.id };
    p.hp = Math.max(1, p.maxHP - 50); // beri ruang heal
    const hp0 = p.hp;
    const e = g.run.enemies.find((en) => en.alive && !en.isBoss);
    if (!e) return { skip: true };
    e.hp = 1; e.x = p.x + 40; e.y = p.y; e.homeX = null; e.homeY = null;
    g.run.collision.rebuildEnemyGrid(g.run.enemies);
    for (let i = 0; i < 240 && e.alive; i++) await new Promise((r) => requestAnimationFrame(r));
    return { skip: false, killed: !e.alive, healed: p.hp > hp0, delta: p.hp - hp0 };
  });
  log('p3-mako-lifesteal-kill', mako.skip ? `SKIP ${mako.hero || ''}` : (mako.killed && mako.healed));
  log('p3-mako-heal-delta', String(mako.delta ?? '-'));

  // ---- P3: markMult DIKONSUMSI (fix no-op V1) ----
  const mark = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const p = g.run.player;
    g.run.critChanceOverride = 0;
    const e = g.run.enemies.find((en) => en.alive && !en.isBoss);
    if (!e) return { skip: true };
    e.maxHP = 999999; e.hp = 999999; e.frozen = 99999; // tank beku: ukur damage per hit
    e.x = p.x + 60; e.y = p.y; e.homeX = null; e.homeY = null;
    e.armorLayers = 0;
    g.run.collision.rebuildEnemyGrid(g.run.enemies);
    // tanpa mark
    e.markMult = 1; e.markT = 0;
    let hpA = e.hp;
    for (let i = 0; i < 200; i++) { if (e.hp < hpA) break; await new Promise((r) => requestAnimationFrame(r)); }
    const dmgNoMark = hpA - e.hp;
    // dengan mark +50% (durasi panjang supaya tak meluruh saat sampling)
    e.markMult = 1.5; e.markT = 30;
    let hpB = e.hp;
    for (let i = 0; i < 200; i++) { if (e.hp < hpB) break; await new Promise((r) => requestAnimationFrame(r)); }
    const dmgMark = hpB - e.hp;
    // markT meluruh?
    const t0 = e.markT;
    await new Promise((r) => setTimeout(r, 400));
    const decays = e.markT < t0;
    e.frozen = 0; e.markMult = 1; e.markT = 0;
    g.run.critChanceOverride = undefined;
    return { skip: false, dmgNoMark, dmgMark, consumed: dmgMark > dmgNoMark * 1.3, decays };
  });
  log('p3-mark-consumed', mark.skip ? 'SKIP' : mark.consumed);
  log('p3-mark-decays', mark.skip ? 'SKIP' : mark.decays);
  log('p3-mark-dmg', `plain=${mark.dmgNoMark} marked=${mark.dmgMark}`);

  // ---- P3: hook stat — crit bonus (bcell) & skill haste (tcd4) via modul ----
  const hooks = await page.evaluate(async () => {
    const mod = await import('/js/systems/passive-system.js');
    const hs = window.__IMUNVERSE.getData().heroes.heroes;
    const bcell = hs.find((h) => h.id === 'bcell');
    const tcd4 = hs.find((h) => h.id === 'tcd4');
    const fakeRunB = { heroDef: bcell };
    return {
      critBonus: mod.passiveCritBonus(fakeRunB),
      cdMult: mod.passiveSkillCdMult(tcd4),
      cdMultOthers: mod.passiveSkillCdMult(hs.find((h) => h.id === 'macrophage')),
    };
  });
  log('p3-bcell-crit-bonus', hooks.critBonus === 0.06);
  log('p3-tcd4-skill-haste', hooks.cdMult === 0.85 && hooks.cdMultOthers === 1);

  // ---- P3: treg regen & masta retaliate via passiveTick/OnPlayerHit langsung ----
  const direct = await page.evaluate(async () => {
    const mod = await import('/js/systems/passive-system.js');
    const g = window.__IMUNVERSE.game;
    const hs = window.__IMUNVERSE.getData().heroes.heroes;
    const run = g.run;
    const realHero = run.heroDef;
    // treg regen
    run.heroDef = hs.find((h) => h.id === 'treg');
    const p = run.player;
    p.hp = Math.max(1, p.maxHP - 20);
    const hp0 = p.hp;
    mod.passiveTick(run, 1.0); // 1 detik simulasi
    const regenWorks = p.hp > hp0;
    // masta retaliate: musuh dekat kena damage saat player dipukul
    run.heroDef = hs.find((h) => h.id === 'mastcell');
    const e = run.enemies.find((en) => en.alive && !en.isBoss);
    let retaliateWorks = null;
    if (e) {
      e.x = p.x + 50; e.y = p.y; e.armorLayers = 0; e.maxHP = 99999; e.hp = 99999;
      const ehp0 = e.hp;
      mod.passiveOnPlayerHit(run, g);
      retaliateWorks = e.hp < ehp0;
    }
    run.heroDef = realHero;
    return { regenWorks, retaliateWorks };
  });
  log('p3-treg-regen', direct.regenWorks);
  log('p3-masta-retaliate', direct.retaliateWorks === null ? 'SKIP' : direct.retaliateWorks);

  // ============ PHASE 5 ============
  // ---- elite spawn terencana: paksa wave 3 + spawn sarang ----
  const elite = await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    const cfg = window.__IMUNVERSE.getData().waves;
    const ss = g.run.spawnSys;
    ss.wave = 3;
    ss.nestsSpawnedForWave = 0;
    ss.spawnWaveNests(g, cfg.explore);
    const elites = g.run.enemies.filter((e) => e.alive && e.eliteAffix);
    const sample = elites[0] || null;
    let hpRatio = null;
    if (sample) {
      // pembanding SEGAR dari def sama (musuh lama bisa sudah dimutasi uji lain)
      const n0 = g.run.enemies.length;
      g.spawnEnemy(sample.def.id, false);
      const twin = g.run.enemies[g.run.enemies.length - 1];
      if (g.run.enemies.length > n0 && twin && !twin.eliteAffix) {
        hpRatio = sample.maxHP / twin.maxHP;
        twin.alive = false; // bereskan
      }
    }
    return {
      count: elites.length,
      affixes: elites.map((e) => e.eliteAffix),
      hpRatio,
      defElite: sample ? !!sample.def.elite : null,
      hasAffixCfg: sample ? !!(sample.affixCfg && sample.affixCfg.label) : null,
    };
  });
  log('p5-elite-planned-spawn', elite.count >= 1);
  log('p5-elite-def-flag', elite.defElite === true);
  log('p5-elite-affix-cfg', elite.hasAffixCfg === true);
  log('p5-elite-hp-mult', elite.hpRatio === null ? 'INFO no-twin' : (elite.hpRatio > 2.2 && elite.hpRatio < 3.0));
  log('p5-elite-info', `n=${elite.count} affixes=${elite.affixes.join(',')} hpRatio=${elite.hpRatio?.toFixed(2)}`);

  // ---- affix swift & regen (paksa lewat makeElite) ----
  const affix = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const cfg = window.__IMUNVERSE.getData().waves.elite;
    const pool = g.run.enemies.filter((e) => e.alive && !e.isBoss && !e.eliteAffix);
    if (pool.length < 2) return { skip: true };
    const [a, b] = pool;
    const speed0 = a.speed;
    a.makeElite('swift', cfg);
    b.makeElite('regen', cfg);
    b.hp = b.maxHP * 0.5;
    const bhp0 = b.hp;
    await new Promise((r) => setTimeout(r, 600));
    return {
      skip: false,
      swiftFaster: a.speed > speed0 * 1.2,
      swiftWindup: a.windupOverride === cfg.affixParams.swift.windup,
      regenHeals: b.hp > bhp0,
    };
  });
  log('p5-affix-swift', affix.skip ? 'SKIP' : (affix.swiftFaster && affix.swiftWindup));
  log('p5-affix-regen', affix.skip ? 'SKIP' : affix.regenHeals);

  // ---- volatile: kill → pendingBlast → damage bila dekat ----
  const volatile = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const cfg = window.__IMUNVERSE.getData().waves.elite;
    const p = g.run.player;
    const e = g.run.enemies.find((en) => en.alive && !en.isBoss);
    if (!e) return { skip: true };
    e.makeElite('volatile', cfg);
    e.x = p.x + 30; e.y = p.y;
    p.iframes = 0; p.maxHP = 50000; p.hp = 50000;
    g.run.shield = 0; g.run.evadeCharges = 0;
    if (g.runFlags) g.runFlags.pelindung = false;
    const hp0 = p.hp;
    e.hp = 1;
    e.takeDamage(5);
    g.onEnemyKilled(e, null);
    const blastQueued = g.run.pendingBlasts.length > 0;
    let hurt = false;
    for (let i = 0; i < 90; i++) {
      p.x = e.x - 30; p.y = e.y; p.vx = 0; p.vy = 0; p.iframes = 0; // tetap dalam radius
      if (p.hp < hp0) { hurt = true; break; }
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { skip: false, blastQueued, hurt, dmg: hp0 - p.hp };
  });
  log('p5-volatile-blast-queued', volatile.skip ? 'SKIP' : volatile.blastQueued);
  log('p5-volatile-blast-hurts', volatile.skip ? 'SKIP' : volatile.hurt);

  // ---- boss enrage: spawn boss, set HP 35% → enrage sekali ----
  const enrage = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    g.spawnEnemy('sel_kanker', true);
    const boss = g.run.boss;
    if (!boss) return { skip: true };
    const p = g.run.player;
    boss.x = p.x + 260; boss.y = p.y;
    p.iframes = 99999; p.hp = 50000; p.maxHP = 50000;
    const interval0 = boss.def.areaAttack.interval;
    const speed0 = boss.speed;
    boss.hp = boss.maxHP * 0.35;
    for (let i = 0; i < 90 && !boss.enraged; i++) await new Promise((r) => requestAnimationFrame(r));
    const speed1 = boss.speed;
    // panggilan kedua tidak boleh menumpuk
    g.tryBossEnrage(boss);
    const speed2 = boss.speed;
    const out = {
      skip: false,
      enraged: boss.enraged,
      fasterAoe: boss.def.areaAttack.interval < interval0,
      fasterMove: speed1 > speed0,
      once: speed2 === speed1,
    };
    boss.hp = 0; boss.alive = false; g.run.boss = null; // bereskan
    return out;
  });
  log('p5-boss-enrage-triggers', enrage.skip ? 'SKIP' : enrage.enraged);
  log('p5-boss-enrage-faster', enrage.skip ? 'SKIP' : (enrage.fasterAoe && enrage.fasterMove));
  log('p5-boss-enrage-once', enrage.skip ? 'SKIP' : enrage.once);

  await page.screenshot({ path: 'shots/review/v2p35-elite-boss.png' });

  // ---- P3: passive tampil di layar hero detail ----
  await page.evaluate(() => window.__IMUNVERSE.game.finishRun(true));
  await page.waitForTimeout(800);
  await page.click('#btn-home', { timeout: 6000, force: true }).catch(() => {});
  await page.waitForTimeout(900);
  const passiveUi = await page.evaluate(() => {
    const sm = window.__IMUNVERSE.screenManager;
    try { sm.show('herodetail'); } catch { return { shown: false }; }
    const elp = document.querySelector('.hl-passive');
    return { shown: true, hasPassive: !!elp, text: elp ? elp.textContent.slice(0, 60) : '' };
  });
  log('p3-passive-in-ui', passiveUi.shown ? passiveUi.hasPassive : 'SKIP');
  log('p3-passive-ui-text', passiveUi.text || '-');
  await page.screenshot({ path: 'shots/review/v2p35-hero-passive.png' });

  log('zero-pageerror', errors.length === 0);
  if (errors.length) for (const e of errors.slice(0, 6)) log('err', e);
} catch (e) {
  log('suite-crash', false);
  console.error(e);
} finally {
  await browser.close();
}
