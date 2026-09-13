#!/usr/bin/env node
/**
 * scripts/unit-fase1-retune.mjs — uji headless Fase 1 (retune v2.0)
 *
 * Menjalankan jalur boot NYATA terhadap data repo tanpa browser:
 *   loader data → merge save lama → pass comeback → XP Battle Pass → GP → evolusi
 * `fetch` di-shim ke filesystem dan `localStorage` ke memori, sehingga skrip ini
 * bisa jalan di CI (Node saja) maupun lokal:
 *
 *   node scripts/unit-fase1-retune.mjs        # atau: npm run test:fase1
 *
 * Melengkapi self-test browser `index.html?autotest=1` (yang menutup jalur
 * gameplay). Keluar dengan kode 1 bila ada yang gagal.
 */

import { readFileSync } from 'node:fs';

/* ---------- shim lingkungan (fetch + localStorage) ---------- */

globalThis.fetch = async (url) => {
  const p = String(url).split('?')[0];
  const body = readFileSync(p, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
};
globalThis.localStorage = globalThis.window.localStorage;

/* ---------- harness ---------- */

const DAY = 86400000;
const results = [];
const check = (label, cond, detail = '') => {
  results.push({ label, ok: !!cond, detail });
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const { loadAllData } = await import('../js/core/data-store.js');
const data = await loadAllData();

/* ---------- 1. loader data ---------- */

console.log('\n=== 1. Loader data (Fase 1: 2 file baru terdaftar) ===');
const loadedKeys = Object.keys(data).filter((k) => k !== 'loaded' && k !== 'raw' && data[k]);
check('data/retention-config.json terdaftar', !!data.retentionConfig, `v${data.retentionConfig?.version}`);
check('data/economy-anchors.json terdaftar', !!data.anchors, `v${data.anchors?.version}`);
check('34 kunci data termuat (lang.json dimuat terpisah oleh i18n)', loadedKeys.length === 34, `${loadedKeys.length} kunci`);
check('comeback.maxOfflineDecayDays = 2 terbaca', data.retentionConfig.comeback.maxOfflineDecayDays === 2);
check('adEconomy = 10 Imun × 6/hari terbaca', data.anchors.adEconomy.imunPerAd === 10 && data.anchors.adEconomy.dailyLimit === 6);
// ROADMAP §2 G7: kunci `retention` lama (data/retention.json) tidak boleh tertimpa.
check('DATA.retention lama utuh (G7)', data.retention.xpPerKill !== undefined && data.retention.combo !== undefined && data.retention.comeback === undefined);

/* ---------- 2. save lama tetap aman ---------- */

console.log('\n=== 2. Save dari BUILD sebelumnya tetap aman (G9) ===');
const { createDefaultMeta, mergeMetaDefaults } = await import('../js/core/state-manager.js');
const fresh = createDefaultMeta();
const oldSave = JSON.parse(JSON.stringify(fresh));
for (const k of ['streak', 'dropPity', 'cratePity', 'firstBuy', 'lastPlayedAt']) delete oldSave[k];
oldSave.currency = 4321;
oldSave.stats.totalRuns = 7;
oldSave.bp = { season: data.battlepass.season, xp: 50, level: 2, premium: false, claimedFree: [1], claimedPrem: [] }; // tanpa field cap harian
const merged = mergeMetaDefaults(oldSave);
check('field comeback/pity/firstBuy diisi dari default', !!merged.streak && !!merged.dropPity && !!merged.cratePity && !!merged.firstBuy && merged.lastPlayedAt === 0);
check('data pemain lama tidak hilang', merged.currency === 4321 && merged.stats.totalRuns === 7 && merged.bp.level === 2);

/* ---------- 3. pass comeback ---------- */

console.log('\n=== 3. Pass comeback — absen 20 hari ===');
const { runComebackPass } = await import('../js/systems/comeback-system.js');
const { getBodyState } = await import('../js/systems/body-system.js');
const meta = mergeMetaDefaults(JSON.parse(JSON.stringify(fresh)));
meta.lastPlayedAt = Date.now() - 20 * DAY;
meta.currency = 0;
meta.imun = 0;
// main.js melakukan ini sebelum pass; diuji di sini agar restoreBody tidak no-op.
if (!meta.bodyState) meta.bodyState = getBodyState(meta);
meta.bodyState.systems.sirkulasi.health = 12; // seolah kritis setelah lama absen

const cb = runComebackPass({ meta, cfg: data.retentionConfig.comeback, now: Date.now() });
check('hari absen = 20', cb.daysAway === 20, `rawDecayDays=${cb.rawDecayDays}`);
check('peluruhan dibatasi 2 hari', cb.decayDays === 2 && cb.rawDecayDays === 20, `${cb.rawDecayDays} → ${cb.decayDays}`);
check('hadiah kembali tier 14+ (2.500 Antibodi + 60 Imun + 5 item)', cb.returnGift?.currency === 2500 && cb.granted.currency === 2500 && cb.granted.imun === 60, JSON.stringify(cb.granted.consumables));
check('tubuh dipulihkan ke 100 (bukan no-op)', cb.granted.bodyRestored === true && meta.bodyState.systems.sirkulasi.health === 100);
check('streak mulai dari hari 1, tidak "putus" (belum ada streak sebelumnya)', cb.streak.day === 1 && cb.streak.broken === false);
check('meta.lastPlayedAt diperbarui & save ditandai berubah', meta.lastPlayedAt > Date.now() - 60000 && cb.changed === true);

console.log('\n=== 4. Streak — bolos 1 hari diampuni, bolos 20 hari memutus ===');
const m2 = mergeMetaDefaults(JSON.parse(JSON.stringify(fresh)));
let t = Date.UTC(2026, 8, 1, 9, 0, 0);
let last = null;
for (const gap of [1, 1, 1, 2, 1]) { // gap 2 = bolos satu hari
  m2.lastPlayedAt = t;
  t += gap * DAY;
  last = runComebackPass({ meta: m2, cfg: data.retentionConfig.comeback, now: t });
}
check('bolos 1 hari tidak memutus streak', last.streak.broken === false && last.streak.day === 5, `hari ke-${last.streak.day}`);
m2.lastPlayedAt = t;
const afterLong = runComebackPass({ meta: m2, cfg: data.retentionConfig.comeback, now: t + 20 * DAY });
check('absen 20 hari memutus streak + memicu hadiah kembali', afterLong.streak.broken === true && afterLong.streak.day === 1 && !!afterLong.returnGift);

/* ---------- 5. Battle Pass ---------- */

console.log('\n=== 5. Battle Pass — batas XP per run dan per hari ===');
const bpSys = await import('../js/systems/battlepass-system.js');
const m3 = mergeMetaDefaults(JSON.parse(JSON.stringify(fresh)));
check('xpNeed(1) = 125 (100 + 25×1)', bpSys.xpNeed(1) === 125, `${bpSys.xpNeed(1)}`);
const refRun = { heroLevel: 12, wave: 15, kills: 250 }; // profil run referensi
const r1 = bpSys.grantRunBpXP(m3, refRun);
check('run referensi: mentah 194,5 → dibatasi 120/run', r1.raw === 195 && r1.granted === 120 && r1.cappedByRun === true, `raw=${r1.raw} granted=${r1.granted}`);
const r2 = bpSys.grantRunBpXP(m3, refRun);
const r3 = bpSys.grantRunBpXP(m3, refRun);
check('run ke-2 dan ke-3 masih penuh (total 360/hari)', r2.granted === 120 && r3.granted === 120 && m3.bp.runXpToday === 360);
const r4 = bpSys.grantRunBpXP(m3, refRun);
check('run ke-4 pada hari yang sama = 0 (cap harian)', r4.granted === 0 && r4.cappedByDay === true && r4.leftToday === 0);
const mi = bpSys.grantMissionBpXP(m3, 'daily');
check('misi harian memberi 40 XP di luar cap run', mi.granted === 40);
check('4 run referensi + 1 misi harian ≠ tamat (dulu 6,1 run)', m3.bp.level <= 4, `level=${m3.bp.level} xp=${m3.bp.xp}`);
check('reset harian: hari berikutnya dapat 120 lagi', (() => {
  m3.bp.runXpDay = '2000-01-01';
  return bpSys.grantRunBpXP(m3, refRun).granted === 120;
})());

/* ---------- 6. Pangkat & evolusi ---------- */

console.log('\n=== 6. GP pangkat hasil retune (semua nilai ÷ 4,5) ===');
const { computeRunGP } = await import('../js/systems/rank-system.js');
const gpLose = computeRunGP({ wave: 15, kills: 250, bossKills: 3, victory: false, chapterId: null });
const gpWin = computeRunGP({ wave: 15, kills: 250, bossKills: 3, victory: true, chapterId: 'bab_luka' });
check('run referensi kalah = 254 GP (dulu 1.130)', gpLose === 254, `${gpLose}`);
check('run referensi menang + bab = 331 GP', gpWin === 331, `${gpWin}`);
check('13 tier (12.000 GP) ≈ 36–47 run, bukan 10,6', Math.round(12000 / gpWin) >= 30 && Math.round(12000 / gpWin) <= 50, `${Math.round(12000 / gpWin)} run`);

console.log('\n=== 7. Evolusi hasil retune ===');
const ev = data.evolutions;
const fragPerRun = 250 * ev.dropChanceNormal + 27 * ev.dropChanceElite + 3 * ev.bossGuaranteedParts;
const totalCost = ev.stages.reduce((a, s) => a + Object.values(s.cost || {}).reduce((x, y) => x + y, 0), 0);
check('fragmen per run ≈ 5,08 (dulu ≈ 29)', fragPerRun > 5 && fragPerRun < 5.2, fragPerRun.toFixed(2));
check('total biaya pohon = 167 fragmen', totalCost === 167, `${totalCost}`);
check('pohon evolusi ≈ 33 run (dulu 0,6 run)', Math.round(totalCost / fragPerRun) === 33, `${Math.round(totalCost / fragPerRun)} run`);

/* ---------- 8. Kampanye ---------- */

console.log('\n=== 8. Kampanye hasil retune ===');
const quotas = data.campaign.chapters.map((c) => c.killQuota);
check('kuota ×2,2 → [55,66,77,88,99,110]', JSON.stringify(quotas) === JSON.stringify([55, 66, 77, 88, 99, 110]), quotas.join('/'));
check('3 tingkat kesulitan terdefinisi (implementasi Fase 4.1)', (data.campaign.difficulties || []).map((d) => d.id).join(',') === 'normal,sulit,kritis');

/* ---------- hasil ---------- */

const fail = results.filter((r) => !r.ok);
console.log(`\n--- Hasil: ${results.length - fail.length}/${results.length} lolos ---`);
if (fail.length) {
  for (const f of fail) console.log(`  GAGAL: ${f.label}${f.detail ? ` (${f.detail})` : ''}`);
  process.exit(1);
}
console.log('UNIT_FASE1_PASS');
