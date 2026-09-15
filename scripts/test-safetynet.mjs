/**
 * test-safetynet.mjs — PHAGOS: jaring pengaman level-up (bible §4.1).
 *
 * Menggantikan e2e-v2phase4 (evolusi senjata — sistemnya sudah dicabut).
 * Node + jsdom, tanpa browser: boot data ASLI, lalu uji pool safety net,
 * roll/apply upgrade-system, dan pengali safety net di getMembraneStats.
 *
 * Jalankan: node scripts/test-safetynet.mjs (cwd = root repo)
 * Butuh: /tmp/vfy/node_modules (jsdom) atau VERIFY_PATH.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const VFY = process.env.VERIFY_PATH || '/tmp/vfy/node_modules';
const { JSDOM } = require(path.join(VFY, 'jsdom'));
const ROOT = process.cwd();

// ---------- DOM minimal (cukup untuk impor kode game) ----------
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:8123/' });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.localStorage = dom.window.localStorage;
global.HTMLElement = dom.window.HTMLElement;

const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  const s = String(url);
  if (/^https?:\/\//.test(s)) return realFetch(url, opts);
  const rel = s.split('?')[0].replace(/^\.\//, '');
  const fp = path.join(ROOT, rel);
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(fp, 'utf8')), text: async () => fs.readFileSync(fp, 'utf8') };
};

// ---------- Impor kode game ASLI ----------
const mod = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { loadAllData, getData } = await mod('js/core/data-store.js');
await loadAllData();
const { rollLevelUpChoices, applyLevelUp } = await mod('js/systems/upgrade-system.js');
const { rollMutationChoices, tiersForLevel } = await mod('js/systems/mutation-system.js');
const { getMembraneStats } = await mod('js/systems/membrane-system.js');

// ---------- Uji ----------
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, info = '') {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; fails.push(name); console.log(`FAIL ${name}${info ? ' ' + info : ''}`); }
}

const data = getData();
const EXPECT_IDS = ['hp_boost', 'speed_boost', 'contact_boost', 'pulse_boost', 'engulf_boost'];

// 1. Pool = tepat 5 stat boost biologis (bible §4.1)
const pool = data.upgrades.levelUpPool || [];
ok('pool-5-safetynet', pool.length === 5 && EXPECT_IDS.every((id) => pool.some((u) => u.id === id)),
  JSON.stringify(pool.map((u) => u.id)));
ok('pool-all-common-99', pool.every((u) => u.rarity === 'common' && u.maxStacks === 99));
ok('pool-icons-exist', pool.every((u) => fs.existsSync(path.join(ROOT, u.icon))),
  JSON.stringify(pool.filter((u) => !fs.existsSync(path.join(ROOT, u.icon))).map((u) => u.id)));
ok('pool-no-shooter-terms', !/(proyektil|projectile|attackSpeed|attackRange|tembus|pierce)/i.test(JSON.stringify(pool)));
ok('evolutions-gone', !('evolutions' in data.upgrades));

// 2. Roll: selalu dari pool, tanpa kartu evo
const mockRun = () => ({ upgrades: {}, heroDef: { attackPattern: 'melee_swipe' }, luPity: 0 });
let rollOk = true, evoSeen = false, nSeen = 0;
for (let i = 0; i < 50; i++) {
  const picks = rollLevelUpChoices(mockRun());
  nSeen = picks.length;
  if (picks.length !== 3 || !picks.every((u) => EXPECT_IDS.includes(u.id))) { rollOk = false; break; }
  if (picks.some((u) => u.isEvo)) { evoSeen = true; break; }
}
ok('roll-3-from-pool-x50', rollOk && nSeen === 3);
ok('roll-no-evo', !evoSeen);

// 3. Apply: stack + heal Sitoskeleton; id asing melempar
{
  const run = { upgrades: {}, player: { maxHP: 200 } };
  const r1 = applyLevelUp(run, 'contact_boost');
  const r2 = applyLevelUp(run, 'contact_boost');
  ok('apply-stacks', run.upgrades.contact_boost === 2 && r1.healAmount === 0 && r2.healAmount === 0);
  const rh = applyLevelUp(run, 'hp_boost');
  ok('apply-hp-heal-15pct', rh.healAmount === 30, `heal=${rh.healAmount}`);
  let threw = false;
  try { applyLevelUp(run, 'damage'); } catch { threw = true; }
  ok('apply-unknown-throws', threw);
}

// 4. Pengali safety net di getMembraneStats
function mockMemRun(upgrades) {
  return {
    upgrades,
    activeMutations: [],
    engulfStats: {},
    time: 10,
    itemBuffs: {},
    player: { stats: { damage: 10 } },
    heroDef: { baseStats: { damage: 10 }, membrane: {} },
    membrane: {
      baseRadius: 50, baseContactDps: 8, basePulseCooldown: 2.0,
      shape: 'circle', livingDownT: 0, metaActiveT: 0, stats: {},
    },
  };
}
{
  const base = getMembraneStats(mockMemRun({}));
  const boosted = getMembraneStats(mockMemRun({ contact_boost: 1, pulse_boost: 1, engulf_boost: 1 }));
  ok('safety-contact-x1.2', Math.abs(boosted.contactDps / base.contactDps - 1.2) < 1e-9,
    `${base.contactDps} → ${boosted.contactDps}`);
  ok('safety-pulse-x0.85', Math.abs(boosted.pulseCooldown / base.pulseCooldown - 0.85) < 1e-9,
    `${base.pulseCooldown} → ${boosted.pulseCooldown}`);
  ok('safety-engulf-x1.15', Math.abs(boosted.engulfHealPct / base.engulfHealPct - 1.15) < 1e-9,
    `${base.engulfHealPct} → ${boosted.engulfHealPct}`);
  const double = getMembraneStats(mockMemRun({ contact_boost: 2 }));
  ok('safety-contact-stacks', Math.abs(double.contactDps / base.contactDps - 1.4) < 1e-9);
}

// 5. Hit-stop satu sumber: engulf 0,15 (bible §2.2), tanpa duplikat mati
{
  const gf = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/gamefeel.json'), 'utf8'));
  const mem = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/membrane.json'), 'utf8'));
  ok('engulf-hitstop-0.15', gf.engulf && gf.engulf.hitStop === 0.15, JSON.stringify(gf.engulf));
  ok('hitstop-no-dups', !('pulse' in gf.hitStop) && !('engulf' in gf.hitStop), JSON.stringify(gf.hitStop));
  ok('membrane-no-hitstop-key', !('pulseHitStopSec' in (mem.defaults || {})), JSON.stringify(Object.keys(mem.defaults || {})));
}

// 6. Aturan pool §4.1: tier per level + safety net L2-4 + katup anti-buntu
{
  ok('tiers-L2-4', JSON.stringify(tiersForLevel(2)) === '[1]' && JSON.stringify(tiersForLevel(4)) === '[1]');
  ok('tiers-L5-8', JSON.stringify(tiersForLevel(5)) === '[1,2]' && JSON.stringify(tiersForLevel(8)) === '[1,2]');
  ok('tiers-L9+', JSON.stringify(tiersForLevel(9)) === '[2,3]' && JSON.stringify(tiersForLevel(20)) === '[2,3]');
  const mock = (level, bio, active) => ({ level, bioPoints: bio, activeMutations: active || [], upgrades: {} });
  const c3 = rollMutationChoices(mock(3, 0));
  ok('L3-2mut-1safety', c3.length === 3 && c3.filter((c) => c.isMutation).length === 2 && c3.filter((c) => !c.isMutation).length === 1,
    JSON.stringify(c3.map((c) => c.id)));
  ok('L3-safety-new-pool', c3.filter((c) => !c.isMutation).every((c) => EXPECT_IDS.includes(c.id)));
  ok('L3-mut-tier1', c3.filter((c) => c.isMutation).every((c) => c.tier === 1));
  const c6 = rollMutationChoices(mock(6, 0));
  ok('L6-no-tier2-broke', c6.every((c) => !c.isMutation || c.tier !== 2 || c.lockedByBio),
    JSON.stringify(c6.map((c) => [c.id, c.lockedByBio])));
  // Katup: L9 bio 0 → 2 mutasi terkunci + 1 safety (tak pernah 3 terkunci)
  const c9 = rollMutationChoices(mock(9, 0));
  ok('L9-valve-inserts-safety', c9.length === 3 && c9.filter((c) => !c.lockedByBio && !c.isMutation).length === 1
    && c9.some((c) => !c.lockedByBio), JSON.stringify(c9.map((c) => [c.id, !!c.lockedByBio])));
  // Pool habis total → [] (game.js fallback ke rollLevelUpChoices — by design)
  const allIds = data.mutations.mutations.map((m) => m.id);
  const cEmpty = rollMutationChoices(mock(9, 9999, allIds));
  ok('pool-exhausted-empty', Array.isArray(cEmpty) && cEmpty.length === 0);
}

// 7. Ambang trigger musuh §4.2 (data)
{
  const tr = Object.fromEntries(data.enemyMutations.traits.map((t) => [t.id, t.trigger]));
  ok('trig-radius-2x', tr.penembak_asam.threshold === 2.0 && tr.penembak_asam.compare === '>');
  ok('trig-contact-2x', tr.kebal_membran.threshold === 2.0 && tr.kebal_membran.compare === '>');
  ok('trig-engulf-10', tr.beracun_saat_diserap.threshold === 10 && tr.beracun_saat_diserap.compare === '>');
  ok('trig-pulse-8', tr.kebal_knockback.threshold === 8 && tr.kebal_knockback.compare === '>');
  ok('trig-waves-6-10-14', JSON.stringify(data.enemyMutations.mutationWaves) === '[6,10,14]');
}

// 8. Angka hero = tabel bible §3 (radius + cooldown)
{
  const expect = {
    macrophage: [52, 2.0], tcd8: [44, 1.5], dendritic: [40, 2.5], neutrophil: [32, 1.0],
    eosinophil: [40, 2.0], basophil: [44, 2.5], mastcell: [0, 4.0], tcd4: [48, 2.0],
    treg: [48, 3.0], bcell: [36, 2.5], nkcell: [40, 2.0],
  };
  const hs = Object.fromEntries(data.heroes.heroes.map((h) => [h.id, (h.membrane || {})]));
  const bad = Object.entries(expect).filter(([id, [r, cd]]) => hs[id].baseRadius !== r || hs[id].pulseCooldown !== cd);
  ok('heroes-11-radius-cd', bad.length === 0, JSON.stringify(bad));
  ok('mastia-pulsebase-56', hs.mastcell.shapeParams && hs.mastcell.shapeParams.pulseBaseRadius === 56);
  ok('tbolt-insta25', hs.tcd8.engulfThreshold === 0.25);
  ok('nyx-insta30', hs.nkcell.engulfThreshold === 0.3);
}

console.log(`\nRESULT: ${pass} PASS, ${fail} FAIL${fails.length ? ' → ' + fails.join(', ') : ''}`);
process.exit(fail ? 1 : 0);
