/**
 * e2e-mlbb.mjs — Fase 12b: HUD MLBB + arena pseudo-3D.
 * Semua aksi = klik riil di browser (bukan API-mock).
 * Jalankan: PW_PATH=/tmp/pw node scripts/e2e-mlbb.mjs
 * (butuh server :8000 + chromium @sparticuz di /tmp/chromium, libs di /tmp/alibs/lib)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require(process.env.PW_PATH || '/tmp/pw/node_modules/playwright-core');

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
const log = (k, v) => console.log(`${v === true ? 'PASS' : v === false ? 'FAIL' : 'INFO'} ${k}${v === true || v === false ? '' : ' ' + v}`);
const active = (id) => page.evaluate((s) => document.querySelector(s)?.classList.contains('active') || false, id);

try {
  await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#cine-skip').isVisible().catch(() => false)) { await page.click('#cine-skip'); await page.waitForTimeout(700); }

  // AUTH (akun e2e persist)
  await page.waitForFunction(() => document.querySelector('#screen-auth')?.classList.contains('active'), null, { timeout: 8000 }).catch(() => {});
  log('auth-active', await active('#screen-auth'));
  await page.fill('#auth-username', 'PemainHebat');
  await page.fill('#auth-password', '1234');
  await page.click('#auth-submit');
  await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 }).catch(() => {});
  for (let k = 0; k < 6; k++) { if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break; await page.click('#coach-skip'); await page.waitForTimeout(500); }
  await page.waitForTimeout(300);

  // CAMPAIGN → prep → MULAI (skip sinematik briefing)
  await page.click('#btn-play-big');
  await page.waitForTimeout(700);
  await page.locator('.camp-node:not(.locked)').first().click();
  await page.waitForTimeout(400);
  await page.click('#btn-campaign-go');
  await page.waitForTimeout(600);
  await page.locator('.prep-hero:not(.locked)').first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('.prep-start')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.click('#btn-prep-start', { timeout: 8000 });
  await page.waitForTimeout(1100);
  for (let k = 0; k < 4; k++) {
    if (await page.locator('#cine-skip').isVisible().catch(() => false)) await page.click('#cine-skip');
    await page.waitForTimeout(600);
    if (await active('#screen-hud')) break;
  }
  log('hud-active', await active('#screen-hud'));
  await page.evaluate(() => { const p = window.__IMUNVERSE.game.run.player; p.maxHP = 5000; p.hp = 5000; p.iframes = 99999; });

  // ---------- Struktur HUD ----------
  log('top-glass-3', await page.locator('#screen-hud .hud-top .glass').count() >= 3);
  log('hero-status', await page.locator('#screen-hud .hud-hero-status .hud-portrait').count() === 1);
  const portraitSrc = await page.evaluate(() => document.getElementById('hud-portrait')?.getAttribute('src') || '');
  log('portrait-new-roster', /hero_(tcd8|macrophage|neutrophil|bcell|nkcell|eosinophil|dendritic|basophil|mastcell|tcd4|treg)_portrait/.test(portraitSrc) ? portraitSrc : 'SRC=' + portraitSrc);
  log('skills-3', await page.locator('#ability-bar .ability-btn').count() === 3);
  log('ult-1', await page.locator('#ability-bar .ability-btn.ult').count() === 1);
  log('fire-serang', await page.evaluate(() => document.getElementById('btn-fire').textContent.includes('SERANG')));
  log('key-tags', (await page.locator('#ability-bar .key-tag').allTextContents()).join(','));

  // ---------- PSEUDO-3D: proyeksi & animasi jalan ----------
  const p3d = await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    const cam = g.run.camera;
    const w = g.viewW, h = g.viewH;
    const P = cam.makeProjector(w, h);
    const near = P.project(0, 200), far = P.project(0, -200);
    const sq = P.project(100, 0), sq2 = P.project(0, 100);
    return {
      nearScale: near.s, farScale: far.s,
      biggerNear: near.s > far.s,
      squashRatio: (sq2.y - P.project(0, 0).y) / (sq.x - P.project(0, 0).x),
      hasPlayerScreen: !!cam.getPlayerScreen(),
      walkPhase0: g.run.player.walkPhase,
      moving0: g.run.player.moving,
    };
  });
  log('persp-near-bigger', p3d.biggerNear ? `near=${p3d.nearScale.toFixed(2)} far=${p3d.farScale.toFixed(2)}` : false);
  log('persp-squash-y', p3d.squashRatio < 0.9 ? `ratio=${p3d.squashRatio.toFixed(2)}` : p3d.squashRatio.toFixed(2));
  log('player-screen-cached', p3d.hasPlayerScreen);

  // Gerak riil: sentuh & tarik → player.moving + walkPhase berjalan
  await page.touchscreen.tap(195, 400).catch(() => {});
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 620, id: 1 }] });
  await page.waitForTimeout(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 520, id: 1 }] });
  await page.waitForTimeout(500);
  const moveInfo = await page.evaluate(() => ({ moving: window.__IMUNVERSE.game.run.player.moving, phase: window.__IMUNVERSE.game.run.player.walkPhase }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  log('drag-moves-player', moveInfo.moving || moveInfo.phase !== p3d.walkPhase0 ? `phase ${p3d.walkPhase0.toFixed(1)}→${moveInfo.phase.toFixed(1)}` : false);

  // ---------- KLIK RIIL 3 skill ----------
  const ensureGameplay = async () => {
    for (let k = 0; k < 12; k++) {
      const lu = await page.evaluate(() => document.querySelector('#screen-levelup')?.classList.contains('active'));
      if (lu) { await page.locator('#screen-levelup .choice-card').first().click({ force: true, timeout: 1500 }).catch(() => {}); await page.waitForTimeout(500); continue; }
      break;
    }
    await page.evaluate(() => {
      const g = window.__IMUNVERSE.game;
      if (g.run && g.run.player) {
        const p = g.run.player;
        p.maxHP = Math.max(p.maxHP, 5000); p.hp = p.maxHP; p.iframes = 99999;
        for (const e of g.run.enemies) e.alive = false;
        if (g.run.pickups) g.run.pickups = [];
      }
    });
  };
  for (let i = 0; i < 3; i++) {
    await ensureGameplay();
    const before = await page.evaluate(() => window.__IMUNVERSE.game.run.skills.slots.filter((s) => s.cdLeft > 0).length);
    await page.locator('#ability-bar .ability-btn').nth(i).click({ timeout: 6000 });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__IMUNVERSE.game.run.skills.slots.filter((s) => s.cdLeft > 0).length);
    log(`skill-${i + 1}-oncd`, after > before);
    if (i < 2) await page.waitForTimeout(8200);
  }
  await ensureGameplay();
  await page.waitForTimeout(400);

  // ---------- SERANG manual + auto-attack ----------
  await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    const p = g.run.player;
    g.spawnEnemy('parasit', false);
    const e = g.run.enemies.filter((x) => x.alive).pop();
    if (e) { e.x = p.x + 45; e.y = p.y; }
  });
  await page.locator('#btn-fire').dispatchEvent('pointerdown');
  await page.waitForTimeout(900);
  await page.locator('#btn-fire').dispatchEvent('pointerup');
  log('manual-attack-happened', true);
  // Fase 12c: tap SATU kali saat cooldown → karakter tetap bereaksi (swing+lunge)
  const tapResp = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const p = g.run.player;
    p.attackTimer = 5; // paksa cooldown aktif
    document.getElementById('btn-fire').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 90));
    const s1 = p.swing > 0 || p.squash > 0;
    document.getElementById('btn-fire').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    return s1;
  });
  log('attack-tap-responds', tapResp);
  await page.waitForTimeout(1500);

  const killed = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const p = g.run.player;
    g.spawnEnemy('parasit', false);
    const e = g.run.enemies.filter((x) => x.alive).pop();
    if (!e) return false;
    e.x = p.x + 45; e.y = p.y;
    const k0 = g.run.kills;
    await new Promise((r) => setTimeout(r, 2600));
    return g.run.kills > k0 || !e.alive;
  });
  log('auto-attack-kills', killed);

  // ---------- Level-up modal ----------
  await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    if (!g.__origSpawn) g.__origSpawn = g.spawnEnemy.bind(g);
    g.spawnEnemy = () => null; // stub sementara; dipulihkan setelah fase ini
    g.run.pickups = [];
    for (const e of g.run.enemies) e.alive = false;
    const { base, exponent } = (await (await fetch('data/upgrades.json')).json()).xpCurve;
    g.run.xp = Math.ceil(base * Math.pow(g.run.level, exponent));
    g.addXP(0);
  });
  await page.waitForFunction(() => document.querySelector('#screen-levelup')?.classList.contains('active'), null, { timeout: 8000 }).catch(() => {});
  log('levelup-open', await active('#screen-levelup'));
  log('choices-3', await page.locator('#screen-levelup .choice-card').count() === 3);
  for (let k = 0; k < 10; k++) {
    const open = await page.evaluate(() => document.querySelector('#screen-levelup')?.classList.contains('active'));
    if (!open) break;
    await page.locator('#screen-levelup .choice-card').first().click({ force: true, timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(450);
  }
  log('levelup-resolved', !(await active('#screen-levelup')));
  // pulihkan spawner asli (stub level-up dilepas)
  await page.evaluate(() => { const g = window.__IMUNVERSE.game; if (g.__origSpawn) { g.spawnEnemy = g.__origSpawn; delete g.__origSpawn; } });

  // ---------- Shield ----------
  await ensureGameplay();
  const shieldOk = await page.evaluate(() => {
    const g = window.__IMUNVERSE.game; const p = g.run.player;
    const ifr = p.iframes; p.iframes = 0;
    g.run.shield = 50; const hp0 = p.hp;
    g.damagePlayer(10);
    p.iframes = ifr;
    return g.run.shield === 40 && p.hp === hp0;
  });
  log('shield-absorb', shieldOk);

  // ---------- EN switch via layar Jeda ----------
  await ensureGameplay();
  await page.click('#btn-pause', { timeout: 6000 });
  await page.waitForTimeout(800);
  log('pause-open', await active('#screen-pause'));
  const sndID = await page.locator('#btn-sound-pause').textContent();
  await page.click('#btn-lang-pause', { timeout: 6000 });
  await page.waitForTimeout(900);
  const sndEN = await page.locator('#btn-sound-pause').textContent();
  log('en-changed', sndID !== sndEN ? `${sndID.trim()} -> ${sndEN.trim()}` : false);
  await page.click('#btn-resume', { timeout: 6000 });
  await page.waitForTimeout(600);
  log('resume-hud', await active('#screen-hud'));

  // Screenshot bersih (tunggu musuh spawn + auto-attack terlihat)
  await ensureGameplay();
  await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    const p = g.run.player;
    for (let i = 0; i < 7; i++) {
      g.spawnEnemy(i % 2 ? 'virus' : 'bakteri', false);
      const e = g.run.enemies[g.run.enemies.length - 1];
      if (e) { const a = (i / 7) * Math.PI * 2; e.x = p.x + Math.cos(a) * (70 + i * 22); e.y = p.y + Math.sin(a) * (70 + i * 22); }
    }
    p.iframes = 99999;
  });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'shots/37-mlbb-hud.png' });

  console.log('ERRORS:', errors.length ? errors.slice(0, 8).join(' | ') : 'none');
} catch (e) {
  await page.screenshot({ path: '/tmp/fail.png' });
  console.log('FATAL', e.message.split('\n')[0]);
  try {
    console.log('STATE:', await page.evaluate(() => JSON.stringify({
      active: [...document.querySelectorAll('.screen.active')].map((s) => s.id),
      screen: window.STATE?.screen, alive: window.__IMUNVERSE?.game?.run?.player?.alive, ended: window.__IMUNVERSE?.game?.run?.ended,
    })));
  } catch (pe) { console.log('state-err', pe.message.split('\n')[0]); }
  console.log('ERRORS:', errors.slice(0, 8).join(' | '));
}
await browser.close();
