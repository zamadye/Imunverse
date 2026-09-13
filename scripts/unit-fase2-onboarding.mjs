#!/usr/bin/env node
/**
 * scripts/unit-fase2-onboarding.mjs — uji headless Fase 2.1 + 2.3
 *
 * Fase 2.1 (auto-fire) dan 2.3 (gerbang landscape hanya saat gameplay) adalah
 * perilaku runtime (canvas/DOM), jadi yang bisa dikunci headless adalah:
 *   • default & migrasi save untuk meta.settings.autoFire
 *   • struktur keputusan di game.js: manual menang, auto hanya bila ADA target
 *     dalam jangkauan, dan pasukan mengikuti ritme tembakan hero
 *   • gerbang rotate dibatasi `body.in-run` (tidak global lagi)
 *   • toggle di Profil terhubung ke id yang benar, hint HUD ikut pengaturan
 *
 *   node scripts/unit-fase2-onboarding.mjs     # atau: npm run test:fase2onb
 */

import { readFileSync } from 'node:fs';

const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
};
globalThis.localStorage = globalThis.window.localStorage;

const results = [];
const check = (label, cond, detail = '') => {
  results.push({ label, ok: !!cond, detail });
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

/* ---------- 1. state: default + migrasi ---------- */

console.log('\n=== 1. meta.settings.autoFire: default NYALA, save lama aman ===');
const { createDefaultMeta, mergeMetaDefaults } = await import('../js/core/state-manager.js');
const fresh = createDefaultMeta();
check('save baru: autoFire = true (default brief §2.1)', fresh.settings?.autoFire === true, JSON.stringify(fresh.settings));

const oldSave = JSON.parse(JSON.stringify(fresh));
delete oldSave.settings;
oldSave.currency = 777;
const merged = mergeMetaDefaults(oldSave);
check('save BUILD lama tanpa settings → autoFire diisi default', merged.settings?.autoFire === true);
check('data pemain lama tidak hilang', merged.currency === 777);

const offSave = JSON.parse(JSON.stringify(fresh));
offSave.settings = { autoFire: false };
check('pilihan pemain (MATI) bertahan lewat merge', mergeMetaDefaults(offSave).settings.autoFire === false);

/* ---------- 2. game.js: struktur keputusan auto-fire ---------- */

console.log('\n=== 2. game.js: manual menang, auto hanya bila ada target ===');
const game = readFileSync('js/core/game.js', 'utf8');
check('membaca preferensi dari meta.settings.autoFire', game.includes('STATE.meta.settings.autoFire !== false'));
check('manual fire diperiksa LEBIH DULU (ambil alih)', /const manualFire = !!\(this\.input\.isFiring[\s\S]{0,220}?if \(manualFire\) \{\s*player\.tryFire\(this\);/.test(game));
check('auto-fire HANYA saat ada target dalam jangkauan', /findAttackTarget\(player\.x, player\.y, player\.stats\.effectiveAttackRange\)/.test(game));
check('auto-fire tidak swing sia-sia (guard sebelum tryFire)', /firingNow = !!this\.findAttackTarget[\s\S]{0,80}?if \(firingNow\) player\.tryFire\(this\);/.test(game));
check('pasukan mengikuti ritme tembakan hero (bukan input mentah)', /let firingNow = manualFire;[\s\S]{0,700}?for \(const ally of run\.allies\)/.test(game) && !/const firingNow = this\.input\.isFiring/.test(game));
check('assist-aim player.tryFire tetap utuh (regresi)', readFileSync('js/entities/player.js', 'utf8').includes('findAttackTarget'));

/* ---------- 3. Fase 2.3: gerbang landscape hanya gameplay ---------- */

console.log('\n=== 3. Gerbang rotate dibatasi body.in-run ===');
const css = readFileSync('styles/main.css', 'utf8');
const mq = css.match(/@media \(orientation: portrait\) \{([\s\S]*?)\n\}/);
check('media query portrait ada', !!mq);
check('di dalamnya HANYA body.in-run #rotate-hud', !!mq && mq[1].includes('body.in-run #rotate-hud') && !/#rotate-hud \{\s*display: flex; \}/.test(mq[1].replace('body.in-run #rotate-hud', '')));
check('screen-manager memasang in-run saat layar hud', readFileSync('js/ui/screen-manager.js', 'utf8').includes("classList.toggle('in-run', id === 'hud')"));

/* ---------- 4. toggle Profil + hint HUD ---------- */

console.log('\n=== 4. Toggle di Profil & hint HUD adaptif ===');
const html = readFileSync('index.html', 'utf8');
check('baris toggle ada di Profil (index.html)', html.includes('btn-profile-autofire') && html.includes('Serang Otomatis'));
const prof = readFileSync('js/ui/screens/profile-screen.js', 'utf8');
check('profile-screen mengwire toggle + writeSave', prof.includes("getElementById('btn-profile-autofire')") && prof.includes('writeSave(meta)'));
const hud = readFileSync('js/ui/screens/hud-screen.js', 'utf8');
check('hint HUD menyebut auto-fire saat NYALA', hud.includes('hero menembak sendiri'));
check('hint HUD tetap punya varian manual saat MATI', hud.includes('Tahan <span class="k">SERANG</span>, tarik untuk mengarahkan'));
const lang = JSON.parse(readFileSync('data/lang.json', 'utf8'));
check('string baru terdaftar di lang.json', 'Serang Otomatis' in lang.strings, lang.strings['Serang Otomatis']);

/* ---------- hasil ---------- */

const fail = results.filter((r) => !r.ok);
console.log(`\n--- Hasil: ${results.length - fail.length}/${results.length} lolos ---`);
if (fail.length) {
  for (const f of fail) console.log(`  GAGAL: ${f.label}${f.detail ? ` (${f.detail})` : ''}`);
  process.exit(1);
}
console.log('UNIT_FASE2_ONB_PASS');
