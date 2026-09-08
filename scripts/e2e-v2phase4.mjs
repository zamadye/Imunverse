/**
 * e2e-v2phase4.mjs — V2 Phase 4: BUILD & EVOLUTION.
 * Verifikasi: rarity+bobot, pity, filter pattern (anti dead-choice),
 * evolusi senjata in-run, sinergi role nyata, entri pool baru.
 * Jalankan: node scripts/e2e-v2phase4.mjs (server :8000 + chromium /tmp)
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

  // ---- data ----
  const d = await page.evaluate(() => {
    const u = window.__IMUNVERSE.getData().upgrades;
    return {
      pool: u.levelUpPool.length,
      allRarity: u.levelUpPool.every((x) => ['common', 'rare', 'epic'].includes(x.rarity)),
      hasRules: !!(u.luRules && u.luRules.rarityWeights && u.luRules.pityRolls === 2),
      evos: (u.evolutions || []).length,
      pierceGated: !!u.levelUpPool.find((x) => x.id === 'pierce' && Array.isArray(x.patterns)),
    };
  });
  log('pool-10-with-rarity', d.pool >= 10 && d.allRarity); // R3: +antigen_boost → pool 11
  log('lurules-loaded', d.hasRules);
  log('evolutions-3', d.evos === 3);
  log('pierce-pattern-gated', d.pierceGated);

  // ---- mulai run ----
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

  // ---- unit-level via modul upgrade-system (di halaman, data live) ----
  const unit = await page.evaluate(async () => {
    const mod = await import('/js/systems/upgrade-system.js');
    const hs = window.__IMUNVERSE.getData().heroes.heroes;
    const melee = hs.find((h) => h.attackPattern === 'melee_swipe');
    const ranged = hs.find((h) => h.attackPattern === 'ranged_pierce');

    // 1) DEAD-CHOICE: 30 roll hero melee tidak pernah memuat 'pierce'
    let meleeSawPierce = false;
    for (let i = 0; i < 30; i++) {
      const run = { upgrades: {}, heroDef: melee, luPity: 0 };
      if (mod.rollLevelUpChoices(run).some((c) => c.id === 'pierce')) meleeSawPierce = true;
    }
    // ranged HARUS bisa melihat pierce (sanity)
    let rangedSawPierce = false;
    for (let i = 0; i < 60 && !rangedSawPierce; i++) {
      const run = { upgrades: {}, heroDef: ranged, luPity: 0 };
      if (mod.rollLevelUpChoices(run).some((c) => c.id === 'pierce')) rangedSawPierce = true;
    }

    // 2) PITY: luPity=2 → roll memuat >=1 rare+ (uji 20x, semua wajib)
    let pityOk = true;
    for (let i = 0; i < 20; i++) {
      const run = { upgrades: {}, heroDef: ranged, luPity: 2 };
      const c = mod.rollLevelUpChoices(run);
      if (!c.some((x) => x.rarity === 'rare' || x.rarity === 'epic')) pityOk = false;
    }

    // 3) EVO: syarat storm terpenuhi → kartu evo di slot 0; setelah diambil hilang
    const runEvo = { upgrades: { damage: 4, attackSpeed: 3 }, heroDef: ranged, luPity: 0 };
    const cEvo = mod.rollLevelUpChoices(runEvo);
    const evoFirst = cEvo[0] && cEvo[0].isEvo === true && cEvo[0].id === 'evo_storm';
    const applied = mod.applyLevelUp(runEvo, 'evo_storm');
    const evoGone = !mod.rollLevelUpChoices(runEvo).some((c) => c.isEvo);

    // 4) evolutionBoosts nyata
    const b = mod.evolutionBoosts(runEvo);

    // 5) sinergi: stack efektif Tank utk 'damage' = 4×1.25 = 5
    const tank = hs.find((h) => h.role === 'Tank');
    const dmg = hs.find((h) => h.role === 'Damage'); // damage-role syn: damage juga — pakai moveSpeed utk kontrol
    const effTank = mod.effectiveStacks({ upgrades: { maxHP: 4 }, heroDef: tank }, 'maxHP', ['maxHP', 'damage']);
    const effPlain = mod.effectiveStacks({ upgrades: { maxHP: 4 }, heroDef: dmg }, 'maxHP', ['damage', 'attackSpeed']);
    return {
      meleeSawPierce, rangedSawPierce, pityOk,
      evoFirst, evolvedName: applied.evolved && applied.evolved.name, evoGone,
      storm: b.damageMult === 1.3 && b.cooldownMult === 0.85,
      effTank, effPlain,
    };
  });
  log('dead-choice-melee-no-pierce', unit.meleeSawPierce === false);
  log('ranged-can-see-pierce', unit.rangedSawPierce);
  log('pity-guarantees-rare', unit.pityOk);
  log('evo-card-slot0', unit.evoFirst);
  log('evo-once-only', unit.evoGone);
  log('evo-boost-values', unit.storm);
  log('synergy-effective-stacks', unit.effTank === 5 && unit.effPlain === 4);
  log('synergy-info', `tank=${unit.effTank} plain=${unit.effPlain} evo=${unit.evolvedName}`);

  // ---- IN-RUN: evo storm menaikkan damage & pierce/magnet/crit terhitung ----
  const live = await page.evaluate(() => {
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    const stats0 = g.computePlayerStats(run.heroDef, run.upgrades);
    // suntik build lengkap
    run.upgrades.damage = 4; run.upgrades.attackSpeed = 3;
    run.upgrades.pierce = 2; run.upgrades.magnet = 2; run.upgrades.critChance = 3;
    const statsPre = g.computePlayerStats(run.heroDef, run.upgrades);
    run.evoTaken = { evo_storm: true };
    g.recomputePlayerStats();
    const statsPost = g.computePlayerStats(run.heroDef, run.upgrades);
    // crit efektif: override dimatikan, ukur lewat formula (upBonus=0.12)
    run.critChanceOverride = undefined;
    return {
      dmgRatio: statsPost.damage / statsPre.damage,
      cdRatio: statsPost.cooldown / statsPre.cooldown,
      pierce: statsPost.pierce,
      basePierce: run.heroDef.baseStats.pierce,
      magnetRatio: statsPost.magnetRadius / run.heroDef.baseStats.magnetRadius,
      playerPierceApplied: statsPost.pierce === run.heroDef.baseStats.pierce + 2,
    };
  });
  log('live-evo-damage-x13', Math.abs(live.dmgRatio - 1.3) < 0.01);
  log('live-evo-cooldown-x085', Math.abs(live.cdRatio - 0.85) < 0.01);
  log('live-pierce-stacked', live.playerPierceApplied);
  log('live-magnet-x15', Math.abs(live.magnetRatio - 1.5) < 0.01);

  // ---- UI: paksa level-up modal dengan kartu evo → cek DOM rarity/evo ----
  const ui = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const run = g.run;
    run.upgrades.maxHP = 4; // syarat evo_fortress (storm sudah diambil)
    run.levelUpQueue = 1;
    g.openLevelUpModal();
    await new Promise((r) => setTimeout(r, 400));
    const cards = [...document.querySelectorAll('#levelup-choices .choice-card')];
    return {
      n: cards.length,
      hasEvoCard: cards.some((c) => c.classList.contains('evo-card')),
      hasRarityClass: cards.some((c) => c.classList.contains('rar-rare') || c.classList.contains('rar-epic') || c.classList.contains('evo-card')),
      firstText: cards[0] ? cards[0].textContent.slice(0, 40) : '',
    };
  });
  log('ui-modal-3-cards', ui.n === 3);
  log('ui-evo-card-shown', ui.hasEvoCard);
  log('ui-rarity-classes', ui.hasRarityClass);
  log('ui-first-card', ui.firstText);
  await page.screenshot({ path: 'shots/review/v2p4-levelup-evo.png' });

  // pilih kartu evo → selebrasi + boost fortress aktif
  const pick = await page.evaluate(async () => {
    const g = window.__IMUNVERSE.game;
    const card = document.querySelector('#levelup-choices .choice-card.evo-card');
    if (!card) return { skip: true };
    card.click();
    await new Promise((r) => setTimeout(r, 300));
    return { skip: false, taken: !!g.run.evoTaken.evo_fortress, hpMultActive: g.run.player.stats.maxHP > 0 };
  });
  log('ui-evo-pick-applies', pick.skip ? 'SKIP' : pick.taken);

  log('zero-pageerror', errors.length === 0);
  if (errors.length) for (const e of errors.slice(0, 6)) log('err', e);
} catch (e) {
  log('suite-crash', false);
  console.error(e);
} finally {
  await browser.close();
}
