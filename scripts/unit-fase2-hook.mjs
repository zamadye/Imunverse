#!/usr/bin/env node
/**
 * scripts/unit-fase2-hook.mjs — uji headless Fase 2.4 (hook akhir sesi)
 *
 * Yang dikunci di sini:
 *   • adapter pemanggil (session-hook-adapter.js) menutup SEMUA temuan
 *     integrasi G1–G5, G7, G12 TANPA mengedit drop-in session-hook.js dan
 *     tanpa migrasi save/data
 *   • buildSessionHook end-to-end dengan data repo asli + meta sintetis:
 *     baris hero/BP/pangkat/bab/arena/evolusi muncul dengan angka benar,
 *     maks maxItems baris, satu baris per jenis, urut ETA, headline cocok
 *   • filter data dihormati: minPctToShow & maxEtaRuns (pemain yang jauh
 *     dari semua progres → headline null, layar tidak menampilkan hook)
 *
 *   node scripts/unit-fase2-hook.mjs    # atau: npm run test:fase2hook
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

const results = [];
const check = (label, cond, detail = '') => {
  results.push({ label, ok: !!cond, detail });
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const { loadAllData } = await import('../js/core/data-store.js');
const data = await loadAllData();
const { buildSessionHook } = await import('../js/systems/session-hook.js');
const { getMissionProgressList } = await import('../js/systems/mission-system.js');
const A = await import('../js/systems/session-hook-adapter.js');

const cfg = data.retentionConfig.sessionHook;

/* ---------- 1. adapter unit (G1–G5, G7, G12) ---------- */

console.log('\n=== 1. Adapter: bentuk data repo → bentuk drop-in ===');

// G1 — hero: hanya unlock statistik yang jadi gates; imu/default dilepas.
const hStat = A.adaptHero({ id: 'x', name: 'X', unlock: { type: 'stat', stat: 'totalRuns', value: 15 } });
check('G1 hero stat → unlock.stats = {totalRuns:15}', JSON.stringify(hStat.unlock.stats) === '{"totalRuns":15}');
const hImu = A.adaptHero({ id: 'y', name: 'Y', unlock: { type: 'imu', imuCost: 150 } });
check('G1 hero unlock imu → dilepas (bukan gerbang statistik)', hImu.unlock === null);
const hDef = A.adaptHero({ id: 'z', name: 'Z', unlock: { type: 'default' } });
check('G1 hero unlock default → dilepas', hDef.unlock === null);

// G2 — arena: peta DATAR {statKey: need}; default dilepas (bukan baris sampah).
const aStat = A.adaptArena({ id: 'paru', name: 'Paru', unlock: { type: 'bestWave', value: 8 } });
check('G2 arena → peta datar {bestWave:8}', aStat.unlock.bestWave === 8 && !('stats' in aStat.unlock));
const aDef = A.adaptArena({ id: 'limfe', name: 'Limfe', unlock: { type: 'default', value: 0 } });
check('G2 arena default → unlock null (tidak diiterasi jadi sampah)', aDef.unlock === null);

// G3 — pangkat: min → gp.
const tMin = A.adaptRankTier({ id: 'patroli_3', name: 'Patroli Imun III', min: 250 });
check('G3 tier.min 250 → tier.gp 250 (field asli utuh)', tMin.gp === 250 && tMin.min === 250 && tMin.name === 'Patroli Imun III');

// G4 — kampanye: killQuota/organ → quota/name.
const ch = A.adaptChapter({ id: 'bab_luka', organ: 'Luka Kecil', title: 'Goresan Pertama', killQuota: 55 });
check('G4 bab: quota = killQuota, name = organ', ch.quota === 55 && ch.name === 'Luka Kecil');

// G5 — evolusi: alias id bagian config → id repo; total tidak berubah.
const cost = A.remapStageCost(data.retentionConfig.evolution.stageCost);
check('G5 equity_membran → equity_membrane', cost.equity_membrane === 50 && cost.equity_membran === undefined);
check('G5 inti_memori → equity_memory_core', cost.equity_memory_core === 17 && cost.inti_memori === undefined);
check('G5 kunci tanpa alias tetap (equity_receptor/effector)', cost.equity_receptor === 50 && cost.equity_effector === 50);
check('G5 total fragmen tetap 167', Object.values(cost).reduce((a, b) => a + b, 0) === 167);
const evoIds = Object.keys(data.evolutions.parts.reduce((m, p) => ({ ...m, [p.id]: 1 }), {}));
check('G5 semua kunci stageCost = id bagian repo', Object.keys(cost).every((k) => evoIds.includes(k)), evoIds.join(','));

// G7 + G12 — komposisi data & meta.
const composed = A.composeHookData(data);
check('G7 data.retention = retentionConfig (punya sessionHook)', !!composed.retention.sessionHook);
check('G7 data.retention BUKAN retention.json (tak ada xpPerKill)', composed.retention.xpPerKill === undefined);
check('G7 heroes teradaptasi (array, unlock.stats/null saja)', composed.heroes.every((h) => !h.unlock || h.unlock.stats));
check('G7 ranks.tiers semua punya gp', composed.ranks.tiers.every((t) => typeof t.gp === 'number'));
check('G7 campaign = bab teradaptasi dengan quota & name', composed.campaign.every((c) => typeof c.quota === 'number' && !!c.name));

const metaMini = { bp: { level: 5, xp: 200 }, stats: {} };
const composedMeta = A.composeHookMeta(metaMini);
check('G12 meta.battlepass === meta.bp', composedMeta.battlepass === metaMini.bp);
check('G12 meta asli tidak dimutasi', !('battlepass' in metaMini));

// Misi repo → bentuk drop-in.
const misi = A.toHookMissions([{ def: { id: 'first_blood', name: 'Deteksi Dini' }, value: 4, target: 10, claimed: false, done: false }]);
check('misi: {id,label,current,target,claimed}', misi[0].id === 'first_blood' && misi[0].label === 'Deteksi Dini' && misi[0].current === 4 && misi[0].target === 10 && misi[0].claimed === false);

// Prettify label evolusi (id teknis → nama bagian), tanpa mutasi input.
const hookFake = { headline: 'Satu run lagi: Evolusi — equity_membrane', items: [{ id: 'evo_equity_membrane', kind: 'evolusi_tahap', label: 'Evolusi — equity_membrane' }] };
const pretty = A.prettifyEvolutionLabels(hookFake, data);
check('prettify: label pakai nama bagian dari evolutions.json', pretty.items[0].label === 'Evolusi — Modul Membran', pretty.items[0].label);
check('prettify: headline ikut diganti', pretty.headline === 'Satu run lagi: Evolusi — Modul Membran');
check('prettify: input tidak dimutasi', hookFake.items[0].label === 'Evolusi — equity_membrane');

/* ---------- 2. end-to-end dengan data repo + meta sintetis ---------- */

console.log('\n=== 2. buildSessionHook end-to-end (data repo asli) ===');

const heroesArr = data.heroes.heroes;
const eos = heroesArr.find((h) => h.unlock && h.unlock.type === 'stat' && h.unlock.stat === 'totalRuns');
check('data punya hero bergerbang totalRuns (bahan uji G1)', !!eos, eos && `${eos.id}=${eos.unlock.value} run`);

const meta = {
  unlockedHeroes: ['macrophage'],
  selectedHero: 'macrophage',
  selectedChapter: 'bab_luka',
  missionsClaimed: [],
  rank: { season: 1, gp: 240, best: 240 },
  bp: { season: data.battlepass.season, level: 5, xp: 200, premium: false, claimedFree: [], claimedPrem: [], runXpDay: null, runXpToday: 0 },
  heroMastery: { macrophage: { xp: 90, level: 0, kills: 100, runs: 10, wins: 1 } },
  evoParts: { equity_receptor: 50, equity_membrane: 49, equity_effector: 50, equity_memory_core: 17 },
  stats: { wins: 2, totalKills: 2000, bossKills: 3, bestWave: 10, totalRuns: 14, totalCurrencyEarned: 5000 },
};
const lastRun = { kills: 50, wave: 6, victory: false };
const metaForHook = A.composeHookMeta(meta);
const hook = A.prettifyEvolutionLabels(buildSessionHook({
  meta: metaForHook,
  lastRun,
  data: composed,
  cfg,
  missionProgress: A.toHookMissions(getMissionProgressList(metaForHook)),
}), data);

const byKind = (k) => hook.items.find((i) => i.kind === k);
check('headline ada untuk pemain "hampir di mana-mana"', !!hook.headline, String(hook.headline));
check('headline = "Satu run lagi: " + label item teratas (eta 1)', hook.items[0] && hook.items[0].etaRuns === 1 && hook.headline === `Satu run lagi: ${hook.items[0].label}`);
check(`maks ${cfg.maxItems} baris (maxItems dari data)`, hook.items.length === cfg.maxItems, `${hook.items.length} baris`);
check('satu baris per jenis (tidak ada alasan kembar)', new Set(hook.items.map((i) => i.kind)).size === hook.items.length);
check('urut ETA menaik', hook.items.every((it, i) => i === 0 || hook.items[i - 1].etaRuns <= it.etaRuns));

// Semua sistem lewat adapter — cek lewat maxItems longgar agar semua kandidat tampil.
const hookAll = A.prettifyEvolutionLabels(buildSessionHook({
  meta: metaForHook, lastRun, data: composed, cfg: { ...cfg, maxItems: 8 },
  missionProgress: A.toHookMissions(getMissionProgressList(metaForHook)),
}), data);
const all = (k) => hookAll.items.find((i) => i.kind === k);

check('G1: baris unlock_hero 14/15, eta 1 run', !!all('unlock_hero') && all('unlock_hero').current === 14 && all('unlock_hero').target === eos.unlock.value && all('unlock_hero').etaRuns === 1, all('unlock_hero')?.label);
check('G12: baris battlepass_level 200/225 (100+25×5)', !!all('battlepass_level') && all('battlepass_level').current === 200 && all('battlepass_level').target === 225);
check('G3: baris pangkat_tier 240/250 (tier.min)', !!all('pangkat_tier') && all('pangkat_tier').current === 240 && all('pangkat_tier').target === 250, all('pangkat_tier')?.label);
check('G4: baris kuota_bab "Luka Kecil" 50/55 (killQuota)', !!all('kuota_bab') && all('kuota_bab').current === 50 && all('kuota_bab').target === 55 && all('kuota_bab').label.includes('Luka Kecil'));
check('G2: baris unlock_arena jantung 10/12 (bestWave)', !!all('unlock_arena') && all('unlock_arena').current === 10 && all('unlock_arena').target === 12, all('unlock_arena')?.label);
check('G5: baris evolusi_tahap 49/50 fragmen', !!all('evolusi_tahap') && all('evolusi_tahap').current === 49 && all('evolusi_tahap').target === 50);
check('G5: label evolusi = nama bagian, bukan id teknis', all('evolusi_tahap')?.label === 'Evolusi — Modul Membran', all('evolusi_tahap')?.label);
check('baris mastery_level 90/100 hero yang dimainkan', !!all('mastery_level') && all('mastery_level').current === 90 && all('mastery_level').target === 100);

// Laju seumur hidup dari meta.stats (runHistory tidak dikirim — rekaman metrics
// belum memuat bossKills/currency, jadi rata-rata seumur hidup lebih jujur).
check('rates.kills = totalKills/totalRuns', Math.abs(hook.rates.kills - 2000 / 14) < 1e-9);
check('rates.bossKills = bossKills/totalRuns', Math.abs(hook.rates.bossKills - 3 / 14) < 1e-9);

// Misi harian: kandidat hanya bila ada misi berjalan dengan pct ≥ minPctToShow.
const misiCandidates = A.toHookMissions(getMissionProgressList(metaForHook))
  .filter((m) => !m.claimed && m.current < m.target && m.current / m.target >= cfg.minPctToShow);
if (misiCandidates.length) {
  check('misi_harian tampil & jadi prioritas pertama (eta 1)', !!all('misi_harian') && hookAll.items[0].kind === 'misi_harian', hookAll.items[0].kind);
} else {
  check('tidak ada misi layak → tidak ada baris misi_harian (konsisten data)', !all('misi_harian'));
}

/* ---------- 3. filter data: pemain jauh dari semua progres ---------- */

console.log('\n=== 3. minPctToShow / maxEtaRuns dari data ===');
const metaFar = {
  ...meta,
  missionsClaimed: getMissionProgressList(A.composeHookMeta(meta)).map((m) => m.def.id), // semua misi diklaim
  bp: { ...meta.bp, level: 1, xp: 0 },
  rank: { season: 1, gp: 0, best: 0 },
  heroMastery: {},
  evoParts: { equity_receptor: 0, equity_membrane: 0, equity_effector: 0, equity_memory_core: 0 },
  stats: { wins: 0, totalKills: 5, bossKills: 0, bestWave: 1, totalRuns: 3, totalCurrencyEarned: 60 },
};
const hookFar = buildSessionHook({
  meta: A.composeHookMeta(metaFar),
  lastRun: { kills: 5, wave: 1, victory: false },
  data: composed,
  cfg,
  missionProgress: A.toHookMissions(getMissionProgressList(A.composeHookMeta(metaFar))),
});
check('pemain baru/jauh → tidak ada baris layak (pct < 0.35 / eta > 6)', hookFar.items.length === 0, JSON.stringify(hookFar.items.map((i) => [i.kind, i.pct.toFixed(2), i.etaRuns])));
check('  headline null → pemanggil tidak merender apa pun', hookFar.headline === null);

/* ---------- 4. wiring layar & kebersihan integrasi ---------- */

console.log('\n=== 4. Wiring gameover-screen + drop-in tidak disentuh ===');
const go = read('js/ui/screens/gameover-screen.js');
const dropin = read('js/systems/session-hook.js');
const css = read('styles/main.css');
const lang = JSON.parse(read('data/lang.json'));

check('gameover mengimpor buildSessionHook dari drop-in', go.includes("from '../../systems/session-hook.js'"));
check('gameover memakai adapter (composeHookData/Meta, toHookMissions, prettify)', ['composeHookData', 'composeHookMeta', 'toHookMissions', 'prettifyEvolutionLabels'].every((f) => go.includes(f)));
check('renderSessionHook dipanggil dari show()', /export function show\(summary\)[\s\S]*renderSessionHook\(summary\)/.test(go));
check('hook dipasang DI ATAS tombol Main Lagi (.btn-row)', go.includes("insertAdjacentElement('beforebegin', box)") && go.includes("card.querySelector('.btn-row')"));
check('render lama dibersihkan sebelum render ulang', go.includes("card.querySelector('#go-session-hook')?.remove()"));
check('hook tidak bisa menjatuhkan layar gameover (try/catch)', /try\s*{[\s\S]*buildSessionHook[\s\S]*}\s*catch\s*{/.test(go));
check('maxItems dibaca dari cfg data (bukan angka tulis tangan)', go.includes('cfg.maxItems'));
check('drop-in TIDAK diedit: tidak tahu skema repo (killQuota/meta.bp)', !dropin.includes('killQuota') && !dropin.includes('meta.bp') && !dropin.includes('equity_membrane'));
check('CSS punya .go-hook + baris + pill ETA', css.includes('.go-hook') && css.includes('.go-hook-row') && css.includes('.go-hook-eta'));
check('lang.json punya "Progres terdekat"', typeof lang.strings['Progres terdekat'] === 'string');

const version = read('js/core/version.js');
const html = read('index.html');
const build = (version.match(/BUILD\s*=\s*'([^']+)'/) || [])[1];
check('BUILD = 57a', build === '57a', `BUILD=${build}`);
check('index.html memuat main.js?v=BUILD yang sama', html.includes(`main.js?v=${build}`));

/* ---------- ringkasan ---------- */

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? '✅' : '❌'} ${results.length - failed.length}/${results.length} pemeriksaan lulus`);
if (failed.length) {
  for (const f of failed) console.log(`  GAGAL: ${f.label}${f.detail ? ` — ${f.detail}` : ''}`);
  process.exit(1);
}
