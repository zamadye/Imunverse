#!/usr/bin/env node
/**
 * scripts/unit-fase2-countdown.mjs — uji headless Fase 2.5 (hitung mundur reset harian)
 *
 * Yang dikunci di sini:
 *   • batas reset = tengah malam UTC berikutnya (konvensi kunci tanggal UTC yang
 *     sama dipakai mission-system / monetization / imun-economy / body-system /
 *     battlepass-system — `toISOString().slice(0,10)`)
 *   • ambang "segera" (< warnWhenHoursLeft) dibaca dari data, bukan hardcode
 *   • tabel kebenaran waktu: rollover bulan/tahun/kabisat, tepat di ambang,
 *     tepat tengah malam, format HH:MM:SS
 *   • tiga surface dari data (dashboard / gameover / hud-mission-panel) benar-benar
 *     ter-wiring di layar yang sesuai + chip di-unmount saat hide()
 *
 * `fetch` di-shim ke filesystem dan `localStorage` ke memori (pola skrip unit
 * sebelumnya). Keluar dengan kode 1 bila ada yang gagal.
 *
 *   node scripts/unit-fase2-countdown.mjs    # atau: npm run test:fase2count
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
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const { loadAllData } = await import('../js/core/data-store.js');
const data = await loadAllData();
const { getDailyResetInfo, getDailyAnchor, formatCountdown } = await import('../js/systems/daily-reset.js');

/* ---------- 1. anchor dari data ---------- */

console.log('\n=== 1. dailyAnchor (data/retention-config.json) ===');
const anchorData = data.retentionConfig?.dailyAnchor || {};
const anchor = getDailyAnchor();
check('dailyAnchor terbaca dari data', !!anchorData.showCountdown || anchorData.showCountdown === true);
check('showCountdown = true di data', anchor.showCountdown === true);
check('3 surface terdaftar di data', JSON.stringify(anchorData.countdownSurfaces) === JSON.stringify(['dashboard', 'gameover', 'hud-mission-panel']), JSON.stringify(anchor.surfaces));
check('warnWhenHoursLeft = 4 di data', anchorData.warnWhenHoursLeft === 4 && anchor.warnHours === 4);

/* ---------- 2. tabel kebenaran batas reset (UTC midnight) ---------- */

console.log('\n=== 2. Batas reset = tengah malam UTC berikutnya ===');
const utc = (...a) => Date.UTC(...a);

let info = getDailyResetInfo(utc(2026, 8, 13, 8, 0, 0)); // 13 Sep 2026 08:00 UTC
check('08:00 UTC → reset 14 Sep 00:00 UTC', info.resetTs === utc(2026, 8, 14), new Date(info.resetTs).toISOString());
check('  sisa 16 jam, hms "16:00:00"', info.msLeft === 16 * 3600000 && info.hms === '16:00:00', info.hms);
check('  16 jam → TIDAK urgent', info.urgent === false);

info = getDailyResetInfo(utc(2026, 8, 13, 21, 0, 0)); // sisa 3 jam
check('21:00 UTC → sisa 3 jam → urgent', info.hoursLeft === 3 && info.urgent === true);

info = getDailyResetInfo(utc(2026, 8, 13, 20, 0, 0)); // sisa PERSIS 4 jam
check('PERSIS 4 jam → TIDAK urgent (aturan: KURANG dari 4)', info.hoursLeft === 4 && info.urgent === false);

info = getDailyResetInfo(utc(2026, 8, 13, 20, 0, 0) + 1); // 4 jam kurang 1 ms
check('4 jam kurang 1 ms → urgent', info.urgent === true);

info = getDailyResetInfo(utc(2026, 8, 13, 23, 59, 59, 500)); // 500 ms sebelum reset
check('500 ms sebelum tengah malam → hms "00:00:00", urgent', info.msLeft === 500 && info.hms === '00:00:00' && info.urgent === true);

info = getDailyResetInfo(utc(2026, 8, 14, 0, 0, 0)); // tepat tengah malam
check('tepat 00:00 UTC → reset BESOK (siklus baru penuh)', info.resetTs === utc(2026, 8, 15) && info.msLeft === DAY);

info = getDailyResetInfo(utc(2026, 8, 30, 22, 0, 0)); // rollover bulan
check('30 Sep → reset 1 Okt (rollover bulan)', info.resetTs === utc(2026, 9, 1));

info = getDailyResetInfo(utc(2026, 11, 31, 23, 30, 0)); // rollover tahun
check('31 Des 2026 23:30 → reset 1 Jan 2027, hms "00:30:00"', info.resetTs === utc(2027, 0, 1) && info.hms === '00:30:00');

info = getDailyResetInfo(utc(2028, 1, 28, 12, 0, 0)); // tahun kabisat
check('28 Feb 2028 (kabisat) → reset 29 Feb', info.resetTs === utc(2028, 1, 29));

info = getDailyResetInfo(utc(2026, 8, 13, 5, 17, 42, 123));
check('resetTs selalu selaras tengah malam UTC (habis dibagi 86400000)', info.resetTs % DAY === 0 && info.resetTs > utc(2026, 8, 13, 5, 17, 42, 123));
check('msLeft dalam (0, 24 jam]', info.msLeft > 0 && info.msLeft <= DAY);

// Konsistensi dengan kunci harian sistem lain: detik terakhir sebelum reset
// harus masih di tanggal UTC yang sama dengan `now` (misi/kuota belum ganti hari).
const now = utc(2026, 8, 13, 5, 17, 42);
const dayKeyNow = new Date(now).toISOString().slice(0, 10);
const dayKeyLastMs = new Date(getDailyResetInfo(now).resetTs - 1).toISOString().slice(0, 10);
check('kunci tanggal UTC tidak berubah sampai resetTs (sinkron mission-system)', dayKeyNow === dayKeyLastMs, `${dayKeyNow} == ${dayKeyLastMs}`);
check('resetTs sudah tanggal UTC berikutnya', new Date(getDailyResetInfo(now).resetTs).toISOString().slice(0, 10) !== dayKeyNow);

/* ---------- 3. formatCountdown ---------- */

console.log('\n=== 3. formatCountdown ===');
check('0 → "00:00:00"', formatCountdown(0) === '00:00:00');
check('3661000 → "01:01:01"', formatCountdown(3661000) === '01:01:01');
check('59999 → "00:00:59" (floor)', formatCountdown(59999) === '00:00:59');
check('86399999 → "23:59:59"', formatCountdown(86399999) === '23:59:59');
check('negatif → "00:00:00" (clamp)', formatCountdown(-5000) === '00:00:00');

/* ---------- 4. wiring surface (scan sumber) ---------- */

console.log('\n=== 4. Tiga surface dari data ter-wiring ===');
const dash = read('js/ui/screens/dashboard-screen.js');
const go = read('js/ui/screens/gameover-screen.js');
const hud = read('js/ui/screens/hud-screen.js');
const rc = read('js/ui/reset-countdown.js');
const dr = read('js/systems/daily-reset.js');
const css = read('styles/main.css');
const lang = JSON.parse(read('data/lang.json'));

check('dashboard mount surface "dashboard"', dash.includes("mountResetCountdown(list, 'dashboard')"));
check('gameover mount surface "gameover"', go.includes("'gameover'") && go.includes('mountResetCountdown'));
check('hud mount surface "hud-mission-panel"', hud.includes("mountResetCountdown(document.getElementById('hud-quests'), 'hud-mission-panel')"));
const wired = ['dashboard', 'gameover', 'hud-mission-panel'];
check('surface ter-wiring == countdownSurfaces di data', JSON.stringify([...anchor.surfaces].sort()) === JSON.stringify([...wired].sort()));
check('dashboard unmount di hide()', /export function hide\(\)[\s\S]{0,200}unmountResetCountdown\(dashResetChip\)/.test(dash));
check('gameover unmount di hide()', /export function hide\(\)[\s\S]{0,120}unmountResetCountdown\(goResetChip\)/.test(go));
check('hud unmount di hide()', /export function hide\(\)[\s\S]{0,200}unmountResetCountdown\(hudResetChip\)/.test(hud));
check('ticker 1 detik bersama, mati saat chip habis', rc.includes('setInterval') && rc.includes('clearInterval'));

/* ---------- 5. tanpa angka keras ---------- */

console.log('\n=== 5. Angka dari data, bukan hardcode ===');
check('daily-reset membaca getRetentionConfig', dr.includes("getRetentionConfig") && dr.includes('dailyAnchor'));
check('batas diturunkan dari tanggal UTC (+1 hari), bukan jam karangan', /Date\.UTC\([\s\S]*getUTCDate\(\)\s*\+\s*1/.test(dr));
check('tidak memakai getter waktu lokal (getHours/getDate polos)', !/\.getHours\(\)|[^C]\.getDate\(\)|\.getMonth\(\)[^,)]/.test(dr.replace(/getUTC\w+\(\)/g, '')));
check('reset-countdown UI tidak menghitung sendiri (pakai daily-reset)', rc.includes("from '../systems/daily-reset.js'") && !rc.includes('86400000') && !rc.includes('3600000'));
check('CSS punya .reset-count + penekanan .urgent', css.includes('.reset-count') && css.includes('.reset-count.urgent') && css.includes('@keyframes rc-pulse'));
check('lang.json punya 3 string countdown', ['Reset harian', 'Reset harian dalam', 'Reset harian pada'].every((k) => typeof lang.strings[k] === 'string'));

/* ---------- 6. BUILD & cache-busting ---------- */

console.log('\n=== 6. BUILD / cache-busting ===');
const version = read('js/core/version.js');
const html = read('index.html');
const build = (version.match(/BUILD\s*=\s*'([^']+)'/) || [])[1];
check('BUILD terbaca dari version.js', typeof build === 'string' && /^\d+[a-z]$/.test(build), `BUILD=${build}`);
check('index.html memuat main.js?v=BUILD yang sama', html.includes(`main.js?v=${build}`));

/* ---------- ringkasan ---------- */

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? '✅' : '❌'} ${results.length - failed.length}/${results.length} pemeriksaan lulus`);
if (failed.length) {
  for (const f of failed) console.log(`  GAGAL: ${f.label}${f.detail ? ` — ${f.detail}` : ''}`);
  process.exit(1);
}
