// Audit statik v2 (2026-09-13): i18n (kunci = teks id), event bus (import-aware),
// features.json gates vs HUD_MENU_GATES vs dock nav, walk-anim cross-ref, pola bug.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const F = [];
for (const e of fs.readdirSync(path.join(ROOT, 'js'), { withFileTypes: true })) {
  const walk = (d) => {
    for (const x of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const p = `${d}/${x.name}`;
      if (x.isDirectory()) { if (x.name !== 'vendor') walk(p); }
      else if (x.name.endsWith('.js')) F.push(p);
    }
  };
  walk('js');
}
const SRC = Object.fromEntries(F.map((f) => [f, read(f)]));
const findings = [];
const add = (sev, file, line, msg) => findings.push({ sev, file, line, msg });
const pushTo = (map, key, val) => { (map.get(key) || map.set(key, []).get(key)).push(val); };
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

// ---------- 1. i18n: t('kunci') vs lang.strings ----------
const lang = JSON.parse(read('data/lang.json'));
const langKeys = new Set(Object.keys(lang.strings || {}));
const tRe = /(?<![\w.])t\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*[^)]+)?\)/g;
const used = new Map();
for (const [f, src] of Object.entries(SRC)) {
  let m;
  while ((m = tRe.exec(src))) pushTo(used, m[1], `${f}:${lineOf(src, m.index)}`);
}
let missing = 0, total = 0;
for (const [k, locs] of used) {
  total++;
  // abaikan jika k adalah teks panjang (fallback string, bukan kunci) — tapi tetap laporkan
  if (!langKeys.has(k)) { missing++; if (missing <= 40) add('bug', 'i18n', locs[0].split(':')[1], `t('${k.slice(0, 60)}') tidak ada di lang.strings → ${locs.slice(0, 3).join(', ')}`); }
}
add(missing ? 'bug' : 'ok', 'i18n', '', `${total} kunci t() unik — ${missing} TIDAK ADA di lang.strings`);

// ---------- 2. Event bus: import-aware ----------
const importers = {};
for (const [f, src] of Object.entries(SRC)) {
  const m = src.match(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]*ui-bridge\.js['"]/);
  if (m) importers[f] = m[1].split(',').map((s) => s.trim());
}
const emitted = new Map(), listened = new Map();
for (const [f, fns] of Object.entries(importers)) {
  const src = SRC[f];
  let m;
  if (fns.includes('emit')) { const re = /(?<![\w.])emit\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g; while ((m = re.exec(src))) pushTo(emitted, m[1], `${f}:${lineOf(src, m.index)}`); }
  if (fns.includes('on')) { const re = /(?<![\w.])on\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g; while ((m = re.exec(src))) pushTo(listened, m[1], `${f}:${lineOf(src, m.index)}`); }
}
for (const [ev, locs] of emitted) if (!listened.has(ev)) add('warn', 'event-bus', '', `event '${ev}' di-emit (${locs.join(', ')}) — TIDAK ADA listener`);
for (const [ev, locs] of listened) if (!emitted.has(ev)) add('warn', 'event-bus', '', `listener '${ev}' (${locs.join(', ')}) — TIDAK ADA yang emit`);
add('ok', 'event-bus', '', `${emitted.size} event di-emit, ${listened.size} event di-listen`);

// ---------- 3. features.json gates vs HUD_MENU_GATES vs dock nav ----------
const feat = JSON.parse(read('data/features.json'));
const gates = feat.gates || [];
const gateSet = new Set(gates.map((g) => `${g.target}/${g.id}`));
const fgSrc = SRC['js/systems/feature-gate.js'] || '';
const hudRe = /\[(\w+),\s*'(\w+)'\]/g;
let m;
const hudGates = new Set();
const fgStart = fgSrc.indexOf('HUD_MENU_GATES');
const fgBlock = fgSrc.slice(fgStart, fgSrc.indexOf('};', fgStart));
while ((m = hudRe.exec(fgBlock))) { hudGates.add(`${m[1]}/${m[2]}`); if (!gateSet.has(`${m[1]}/${m[2]}`)) add('bug', 'features', '', `HUD_MENU_GATES '${m[1]}/${m[2]}' TIDAK terdaftar di features.json (fail-closed → selamanya terkunci)`); }
// dock nav ids di index.html harus punya gate (target dock) atau sengaja tanpa gate?
const idx = read('index.html');
const navRe = /data-nav="([a-z0-9-]+)"/g;
const navIds = new Set();
while ((m = navRe.exec(idx))) navIds.add(m[1]);
for (const id of navIds) {
  if (!gateSet.has(`dock/${id}`) && !gateSet.has(`secondary/${id}`)) add('info', 'features', '', `data-nav="${id}" di index.html tanpa gate features.json (terbuka tanpa syarat — cek apakah disengaja)`);
}
add('ok', 'features', '', `${gates.length} gate, ${hudGates.size} di HUD_MENU_GATES, ${navIds.size} data-nav di index.html`);

// ---------- 4. walk-anim.json: id char vs heroes.json/enemies.json ----------
const walkAnim = JSON.parse(read('data/walk-anim.json'));
const heroesJson = JSON.parse(read('data/heroes.json'));
const enemiesJson = JSON.parse(read('data/enemies.json'));
const heroIds = new Set(Object.keys(heroesJson.heroes || heroesJson));
const enemyList = enemiesJson.enemies || enemiesJson;
const enemyIds = new Set(Array.isArray(enemyList) ? enemyList.map((e) => e.id) : Object.keys(enemyList));
const waChars = { ...(walkAnim.heroes || {}), ...(walkAnim.enemies || {}) };
for (const id of Object.keys(waChars)) {
  if (!heroIds.has(id) && !enemyIds.has(id)) add('bug', 'walk-anim', '', `char '${id}' di walk-anim.json tidak ada di heroes.json/enemies.json`);
}
for (const id of heroIds) if (!waChars[id]) add('warn', 'walk-anim', '', `hero '${id}' TIDAK punya entry walk-anim (fallback legacy sprite — ok? cek sengaja)`);
for (const id of enemyIds) if (!waChars[id]) add('warn', 'walk-anim', '', `enemy '${id}' TIDAK punya entry walk-anim (fallback legacy sprite — ok? cek sengaja)`);
add('ok', 'walk-anim', '', `${Object.keys(waChars).length} char (hero ${Object.keys(walkAnim.heroes || {}).length} + enemy ${Object.keys(walkAnim.enemies || {}).length})`);

// ---------- 5. Sprite: path di JSON → file di disk ----------
const spritePaths = new Set();
const collectSprites = (o) => {
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && /\.(png|jpg|jpeg|webp|svg|mp3|ogg|wav)$/i.test(v)) spritePaths.add(v);
    else if (typeof v === 'object') collectSprites(v);
  }
};
for (const f of fs.readdirSync(path.join(ROOT, 'data'))) collectSprites(JSON.parse(read(`data/${f}`)));
let missingFiles = 0;
for (const p of spritePaths) {
  if (!fs.existsSync(path.join(ROOT, p))) { missingFiles++; add('bug', 'sprites', '', `path '${p}' di data/*.json — FILE TIDAK ADA`); }
}
add(missingFiles ? 'bug' : 'ok', 'sprites', '', `${spritePaths.size} path aset di data/*.json, ${missingFiles} hilang`);

// ---------- 6. Pola bug ----------
for (const [f, src] of Object.entries(SRC)) {
  let m2;
  // parseInt tanpa radix (pola kuat: digit pertama langsung, tanpa , di arg pertama)
  while ((m2 = /parseInt\(\s*[A-Za-z_$.()"\s+\-*/]+\)\s*[,;)\n]/g.exec(src))) add('info', f, lineOf(src, m2.index), `parseInt tanpa radix: ${src.split('\n')[lineOf(src, m2.index) - 1].trim().slice(0, 70)}`);
  // setInterval tanpa clearInterval
  const nSet = (src.match(/setInterval\(/g) || []).length;
  const nClear = (src.match(/clearInterval\(/g) || []).length;
  if (nSet > nClear) add('warn', f, '', `setInterval x${nSet} vs clearInterval x${nClear} — cek cleanup`);
  // (pembagian-by-zero: review manual — deteksi statik terlalu bising)
}

// ---------- keluaran ----------
const bySev = { bug: [], warn: [], info: [], ok: [] };
for (const x of findings) (bySev[x.sev] || bySev.info).push(x);
console.log(`\n========== HASIL AUDIT STATIK v2 ==========`);
console.log(`BUG: ${bySev.bug.length}  WARN: ${bySev.warn.length}  INFO: ${bySev.info.length}`);
for (const s of ['bug', 'warn']) {
  if (bySev[s].length) { console.log(`\n---- ${s.toUpperCase()} ----`); for (const x of bySev[s]) console.log(` [${s}] ${x.file}:${x.line || '?'} ${x.msg}`); }
}
console.log(`\n---- INFO (${bySev.info.length}) ----`);
for (const x of bySev.info) console.log(` [info] ${x.file}:${x.line || '?'} ${x.msg}`);
console.log(`\n---- OK ----`);
for (const x of bySev.ok) console.log(` [ok] ${x.msg}`);
