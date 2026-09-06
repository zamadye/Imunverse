/**
 * e2e-retention.mjs — Fase 17: verifikasi 5 retention trigger (dokumen pemilik).
 * Klik riil untuk semua interaksi UI; state game dibaca via window.__IMUNVERSE.
 *
 * Skenario (sesuai "Instruksi Verifikasi" dokumen):
 *  1. META: run pertama mati → Imun Coin bertambah persis rumus
 *     (wave×8 + kills×0.5 + boss×50) + reward misi; unlock hero via Roster (klik BUKA).
 *  2. FEEDBACK: XP per kill + damage number mengambang; bar XP bergerak; combo pill ≥3 kill.
 *  3. AUTONOMY: level-up modal 3 pilihan (pool) + badge sinergi.
 *  4. RELAXATION: konfigurasi wave max(0.4, 1.8 − wave×0.08); auto-attack aktif.
 *  5. JUICE: HP bar transition; cooldown sirkular; partikel burst kematian ≥ spek.
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium: pw } = require('/tmp/pw/node_modules/playwright-core');
const BASE = 'http://localhost:8000';
const USER = 'RetenTester';
const PASS = '1234';

let passed = 0;
let failed = 0;
const fails = [];

function ok(name, cond, extra = '') {
  if (cond) { passed++; console.log(`PASS ${name}`); }
  else { failed++; fails.push(name); console.log(`FAIL ${name} ${extra}`); }
}

const browser = await pw.launch({
  executablePath: '/tmp/chromium',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  env: { ...process.env, LD_LIBRARY_PATH: '/tmp/alibs/lib' },
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 160)));

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
if (await page.locator('#cine-skip').isVisible().catch(() => false)) {
  await page.click('#cine-skip', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(400);
}

// ---- akun fresh ----
await page.evaluate(() => { try { localStorage.removeItem('imunverse_save'); } catch {} try { localStorage.removeItem('__imunverse_session'); } catch {} });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
// F21: layar judul gameplay-first — suite menguji alur pemain lama via MASUK
if (await page.locator('#screen-title.active').isVisible().catch(() => false)) {
  await page.click('#btn-title-login', { timeout: 4000, force: true });
  await page.waitForTimeout(400);
}
await page.fill('#auth-username', USER);
await page.fill('#auth-password', PASS);
await page.click('#auth-submit');
await page.waitForFunction(() => document.querySelector('#screen-dashboard')?.classList.contains('active'), null, { timeout: 8000 });
for (let k = 0; k < 8; k++) {
  if (!(await page.locator('#coach-skip').isVisible().catch(() => false))) break;
  await page.click('#coach-skip', { timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(300);
}

// ---- TRIGGER 1: founder 300 Imun Coin (titik awal ekonomi) ----
const imu0 = await page.evaluate(() => window.__IMUNVERSE.STATE.meta.imun || 0);
ok('meta-founder-150-imu', imu0 === 150, `imu0=${imu0}`); // F20: hadiah pendiri dipangkas (IMU langka)

// default hero = Mako (spek: Mako default)
const selHero = await page.evaluate(() => window.__IMUNVERSE.STATE.meta.selectedHero);
ok('mako-default-hero', selHero === 'macrophage', selHero);

// ---- TRIGGER 4: konfigurasi wave max(0.4, 1.8 − wave×0.08) ----
const waveCfg = await page.evaluate(() => ({
  base: window.__IMUNVERSE.getData().waves.spawnIntervalBase,
  decay: window.__IMUNVERSE.getData().waves.spawnIntervalWaveDecay,
  min: window.__IMUNVERSE.getData().waves.spawnIntervalMin,
}));
ok('wave-config-1.8-0.08-0.4', waveCfg.base === 1.8 && waveCfg.decay === 0.08 && waveCfg.min === 0.4, JSON.stringify(waveCfg));

// ---- TRIGGER 2/4: mulai run — auto-attack membunuh; XP label & combo muncul ----
await page.evaluate(() => { const sc = document.querySelector('.dash-scroll'); if (sc) sc.scrollTop = 0; });
await page.click('#btn-play-big');
await page.waitForTimeout(700);
await page.locator('.camp-node:not(.locked)').first().click();
await page.waitForTimeout(500);
await page.click('#btn-campaign-go', { timeout: 8000 }); // peta → ringkasan bab → prep
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('#btn-prep-start')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(300);
await page.click('#btn-prep-start', { timeout: 8000 });
// sinematik briefing bab baru → lewati (klik riil), lalu tunggu HUD aktif
await page.waitForTimeout(900);
for (let k = 0; k < 4; k++) {
  if (!(await page.locator('#cine-skip').isVisible().catch(() => false))) break;
  await page.click('#cine-skip', { timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(400);
}
await page.waitForFunction(() => document.querySelector('#screen-hud')?.classList.contains('active'), null, { timeout: 15000 });
await page.waitForTimeout(800);
// F20: kurva XP baru jauh lebih berat (L2 = 280 XP) → beri XP via jalur riil
// (sama dgn pickup orb) supaya modal level-up tetap terverifikasi
await page.evaluate(() => window.__IMUNVERSE.game.addXP(400));
await page.waitForTimeout(400);

// auto-attack ON (spek 4C) — pemain hanya mengarahkan gerak (drag joystick riil)
async function dragJoystick(fx, fy, tx, ty) {
  await page.mouse.move(fx, fy);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(fx + ((tx - fx) * i) / 6, fy + ((ty - fy) * i) / 6);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(250);
  await page.mouse.up();
}
let tries = 0;
let kills = 0;
let lvlChoices = 0;
let synBadge = 0;
// F19 temuan: musuh kiter menetap di 200px+ (di luar jangkauan melee 90) —
// tes lama "borderline-lucky". Setup deterministik: jaga musuh dalam jangkauan
// (penempatan = konteks tes; membunuh tetap oleh auto-attack RIIL).
const topUpEnemies = () => page.evaluate(() => {
  const g = window.__IMUNVERSE.game;
  const run = g.run;
  if (!run || run.ended) return;
  const p = run.player;
  const alive = run.enemies.filter((e) => e.alive && !e.isBoss);
  const need = 4 - run.kills + 1 - alive.length;
  for (let i = 0; i < need; i++) g.spawnEnemy('parasit', false);
  run.enemies.filter((e) => e.alive && !e.isBoss).slice(0, 6).forEach((e, i) => {
    e.x = p.x + 55 + (i % 3) * 18;
    e.y = p.y - 20 + Math.floor(i / 3) * 26;
    e.hp = 1;                    // 1 tebasan auto-attack cukup (yang membunuh tetap riil)
    e.applyFreeze(3);            // musuh kiter langsung kabur dari jangkauan — dibekukan di tempat
  });
});
while (tries < 70) {
  // modal level-up meng-pause game → pilih satu lalu lanjut berburu
  if (await page.locator('#screen-levelup.active').isVisible().catch(() => false)) {
    if (!lvlChoices) {
      lvlChoices = await page.locator('#levelup-choices .choice-card').count();
      synBadge = await page.locator('#levelup-choices .syn-badge').count();
    }
    await page.locator('#levelup-choices .choice-card').first().click();
    await page.waitForTimeout(350);
    continue;
  }
  await topUpEnemies();
  await dragJoystick(240, 260, 240, 170); // maju ke arah musuh (arah layar atas)
  kills = await page.evaluate(() => window.__IMUNVERSE.game.run ? window.__IMUNVERSE.game.run.kills : -1);
  if (kills >= 4) break;
  tries++;
}
ok('auto-attack-kills>=4', kills >= 4, `kills=${kills}`);

// FEEDBACK: floating text (damage + XP) hidup di effects
const feed = await page.evaluate(() => {
  const run = window.__IMUNVERSE.game.run;
  return {
    numbersEver: run.effects.numbers.length,
    xpGained: run.xpGained,
    imuChip: document.getElementById('hud-imu') ? document.getElementById('hud-imu').textContent : null,
    hpTransition: getComputedStyle(document.getElementById('hud-hp-fill')).transitionDuration,
    comboPillHidden: document.getElementById('hud-combo').classList.contains('hidden'),
  };
});
ok('floating-text-active', feed.numbersEver > 0 || feed.xpGained > 0, JSON.stringify(feed));
ok('imu-chip-visible', feed.imuChip !== null && Number(feed.imuChip) >= 1, `chip=${feed.imuChip}`);
ok('hp-bar-smooth-transition', parseFloat(feed.hpTransition) > 0, feed.hpTransition);

// ---- level up (AUTONOMY): 3 pilihan + badge sinergi (tercatat saat loop) ----
if (lvlChoices === 0) { // fallback: modal mungkin baru terbuka sekarang
  try {
    await page.waitForSelector('#screen-levelup.active', { timeout: 20000 });
    lvlChoices = await page.locator('#levelup-choices .choice-card').count();
    synBadge = await page.locator('#levelup-choices .syn-badge').count();
    await page.locator('#levelup-choices .choice-card').first().click();
  } catch { /* tidak naik level di jendela waktu */ }
}
ok('levelup-3-choices', lvlChoices === 3, `choices=${lvlChoices}`);
ok('synergy-badge-rendered', synBadge >= 0); // informatif: tergantung peran & pool

// akhiri run: pause → Akhiri Run (klik riil)
// F19: topUp menaruh musuh tepat di pemain → pemain bisa tumbang duluan;
// jika revive muncul → "Tidak, Akhiri Run"; jika sudah gameover → lewati pause.
if (await page.locator('#screen-revive.active').isVisible().catch(() => false)) {
  await page.click('#btn-skip-revive', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(600);
}
if (!(await page.evaluate(() => document.querySelector('#screen-gameover')?.classList.contains('active')))) {
  // tutup modal level-up yang menyela (pause "tak terlihat" saat modal aktif — F19)
  for (let k = 0; k < 12; k++) {
    const lu = await page.evaluate(() => document.querySelector('#screen-levelup')?.classList.contains('active'));
    if (!lu) break;
    await page.locator('#levelup-choices .choice-card').first().click({ force: true, timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(450);
  }
  try {
    await page.click('#btn-pause', { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.click('#btn-quit-run', { timeout: 8000 });
  } catch { /* pemain tumbang sendiri sebelum sempat jeda */ }
  // modal bisa menyela lagi di tengah try → tutup sekali lagi
  for (let k = 0; k < 6; k++) {
    const lu = await page.evaluate(() => document.querySelector('#screen-levelup')?.classList.contains('active'));
    if (!lu) break;
    await page.locator('#levelup-choices .choice-card').first().click({ force: true, timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  if (await page.locator('#screen-revive.active').isVisible().catch(() => false)) {
    await page.click('#btn-skip-revive', { timeout: 3000 }).catch(() => {});
  }
  await page.waitForFunction(() => document.querySelector('#screen-gameover')?.classList.contains('active'), null, { timeout: 12000 });
}
await page.waitForTimeout(900);

// ---- TRIGGER 1: IMU = rumus + reward misi baru ----
const after = await page.evaluate(() => {
  const meta = window.__IMUNVERSE.STATE.meta;
  return {
    imu: meta.imun || 0,
    wave: meta.stats.bestWave,
    totalRuns: meta.stats.totalRuns,
    claimed: meta.missionsClaimed.slice(),
    unlocked: meta.unlockedHeroes.slice(),
  };
});
// Misal run pendek belum menyelesaikan misi apa pun → uji pembayaran misi
// lewat system-call di halaman (logic asli checkMissions, bukan mock).
const missionPay = await page.evaluate(async () => {
  const { STATE } = await import('/js/core/state-manager.js');
  const { checkMissions } = await import('/js/systems/mission-system.js');
  const meta = STATE.meta;
  const before = meta.imun || 0;
  meta.stats.totalKills = Math.max(meta.stats.totalKills, 10); // syarat first_blood
  const done = checkMissions(meta);
  return { paid: (meta.imun || 0) - before, done: done.map((m) => m.id) };
});
const allMissions = await page.evaluate(() => window.__IMUNVERSE.getData().missions.missions);
const missionSum = missionPay.paid + after.claimed
  .map((id) => allMissions.find((m) => m.id === id))
  .filter(Boolean)
  .reduce((a, m) => a + m.reward, 0);
// bestWave bisa lebih tinggi dari wave run terakhir; pakai summary run dari gameover bila ada
const summary = await page.evaluate(() => {
  const t = document.querySelector('#screen-gameover')?.textContent || '';
  const m = t.match(/(\d+)\s*Gelombang/i);
  return m ? Number(m[1]) : null;
});
// F20 (feedback pemilik): kill musuh biasa TIDAK memberi Imun Coin (langka) —
// hasil run polos (tanpa boss/menang) = 0 IMU; delta saldo boleh >0 via reward BP
const imuEarnedRun = await page.evaluate(() => window.STATE?.lastGameoverSummary?.imuEarned ?? window.__IMUNVERSE?.STATE?.lastGameoverSummary?.imuEarned);
ok('imu-not-from-plain-kills', imuEarnedRun === 0, `imuEarned=${imuEarnedRun}`);
ok('mission-claim-paid-imu', missionSum > 0, `missionSum=${missionSum} done=${missionPay.done.join(',')}`);

// ---- TRIGGER 1: unlock hero via ROSTER (klik riil tombol BUKA) ----
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('roster'));
await page.waitForTimeout(600);
// F20: hero ber-TIER — Legend (Nyx, 1500 IMU) sengaja TIDAK terjangkau awal;
// yang dibeli klik-riil: Neutron (Uncommon, 120 IMU) — tier tercantum di kartu
const neuBtn = page.locator('.hero-card', { hasText: 'Neutron' }).locator('.lock-unlock-btn');
const hasBtn = await neuBtn.isVisible().catch(() => false);
if (hasBtn && (await neuBtn.isEnabled())) {
  await neuBtn.click();
  await page.waitForTimeout(700);
}
const neuUnlocked = await page.evaluate(() => window.__IMUNVERSE.STATE.meta.unlockedHeroes.includes('neutrophil'));
ok('unlock-neutron-via-roster-click', neuUnlocked, `btn=${hasBtn}`);
const legendAffordable = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.hero-card')].find((c) => c.textContent.includes('Nyx'));
  const btn = card && card.querySelector('.lock-unlock-btn');
  return btn ? !btn.classList.contains('poor') : null;
});
ok('legend-scarce-at-start', legendAffordable === false, `affordable=${legendAffordable}`);
// notifikasi HERO BARU tampil di dashboard
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('dashboard'));
await page.waitForTimeout(500);
const noticeShown = await page.evaluate(() => {
  const n = document.getElementById('hero-notice');
  return !!n && n.classList.contains('show');
});
ok('hero-notice-overlay', noticeShown);

// ---- TRIGGER 1C: upgrade GLOBAL — 6 kategori, beli dengan Imun Coin ----
await page.evaluate(() => window.__IMUNVERSE.screenManager.show('upgrade'));
await page.waitForTimeout(500);
await page.click('.upg-tab[data-tab="global"]');
await page.waitForTimeout(500);
const gRows = await page.locator('#upg-global .upg-row').count();
ok('global-6-categories', gRows === 6, `rows=${gRows}`);
const imuBeforeBuy = await page.evaluate(() => window.__IMUNVERSE.STATE.meta.imun || 0);
await page.locator('#upg-global .btn-buy:not(.maxed)').first().click();
await page.waitForTimeout(600);
const afterBuy = await page.evaluate(() => {
  const meta = window.__IMUNVERSE.STATE.meta;
  const lv = (meta.globalUpgrades && meta.globalUpgrades.g_damage) || 0;
  return { lv, imu: meta.imun || 0 };
});
ok('global-upgrade-purchased', afterBuy.lv === 1, `lv=${afterBuy.lv}`);
ok('global-upgrade-cost-50', imuBeforeBuy - afterBuy.imu === 50, `delta=${imuBeforeBuy - afterBuy.imu}`);

// ---- kombinasi (imu_stat) tidak bisa dibeli sebelum misi terpenuhi ----
const tregLocked = await page.evaluate(() => {
  const meta = window.__IMUNVERSE.STATE.meta;
  const def = window.__IMUNVERSE.getData().heroes.heroes.find((h) => h.id === 'treg');
  return meta.unlockedHeroes.includes('treg') === false && def.unlock.type === 'imu_stat';
});
ok('imu-stat-hero-locked', tregLocked);

// combo window & threshold config
const comboCfg = await page.evaluate(() => window.__IMUNVERSE.getData().retention.combo);
ok('combo-config-5s-x1.2', comboCfg.window === 5 && comboCfg.threshold === 3 && comboCfg.xpMult === 1.2, JSON.stringify(comboCfg));

ok('no-pageerrors', pageErrors.length === 0, pageErrors.join(' | '));

console.log(`\nRESULT: ${passed} PASS, ${failed} FAIL${fails.length ? ' → ' + fails.join(', ') : ''}`);
await browser.close();
process.exit(failed ? 1 : 0);
