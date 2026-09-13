/**
 * rare-drop-system.js — Imunverse
 *
 * Implementasi konsep poin 3 owner: kosmetik langka yang bisa didapat pemain
 * gratis lewat bermain konsisten di level menengah-tinggi, dengan RNG + pity.
 *
 * Titik integrasi tunggal: panggil `rollRareDrop` dari `onEnemyKilled`
 * (`game.js:1608`) tepat setelah drop fragmen evolusi dihitung.
 *
 *   import { rollRareDrop } from '../systems/rare-drop-system.js';
 *   const drop = rollRareDrop({
 *     meta, run, enemy, cosmetics: DATA.cosmetics, cfg: DATA.retention.rareDrop
 *   });
 *   if (drop) { grantCosmetic(meta, drop.cosmeticId); emit('rareDrop', drop); }
 *
 * Modul murni: tidak menyentuh DOM, tidak menulis save, tidak memanggil emit.
 * Ia hanya memutuskan dan memutasi konter pity di `meta`.
 */

/* ------------------------------------------------------------------ */
/* Kelayakan                                                           */
/* ------------------------------------------------------------------ */

/**
 * Apakah satu kill layak masuk hitungan drop?
 * Hanya elite dan boss pada wave >= minWave. Kill reguler dan wave rendah
 * tidak pernah dihitung — itu yang membuat farming wave 1 tidak berguna dan
 * memenuhi syarat owner "level menengah-tinggi, bukan rendah".
 */
export function isEligibleKill(enemy, wave, cfg) {
  if (!enemy) return false;
  if (wave < cfg.minWave) return false;
  return enemy.isElite === true || enemy.tier === 'boss';
}

/** Peluang dasar untuk satu kill layak. */
export function baseChanceFor(enemy, cfg) {
  if (enemy.tier === 'boss') return cfg.chanceBoss;
  return cfg.chanceElite;
}

/* ------------------------------------------------------------------ */
/* Kolam hadiah                                                        */
/* ------------------------------------------------------------------ */

/**
 * Kosmetik yang boleh jatuh: ditandai `f2pDroppable` di cosmetics.json dan
 * belum dimiliki. Kolam yang habis berarti tidak ada lagi yang bisa jatuh —
 * konter pity dibekukan, bukan dibuang, supaya musim berikutnya langsung
 * membayar.
 */
export function buildDropPool(meta, cosmetics, cfg) {
  const owned = new Set((meta.cosmetics && meta.cosmetics.owned) || []);
  const pool = [];
  for (const group of ['skins', 'accs']) {
    const entries = cosmetics[group];
    if (!entries) continue;
    for (const item of Object.values(entries)) {
      if (!item || item[cfg.poolField] !== true) continue;
      if (cfg.excludeOwned && owned.has(item.id)) continue;
      pool.push(item.id);
    }
  }
  return pool;
}

/* ------------------------------------------------------------------ */
/* Status pity                                                         */
/* ------------------------------------------------------------------ */

function pityState(meta) {
  if (!meta.dropPity) meta.dropPity = { eligibleKills: 0, totalDrops: 0, lastDropAt: 0 };
  return meta.dropPity;
}

/** Berapa kill layak lagi sampai jaminan. Untuk ditampilkan di codex/profil. */
export function killsUntilPity(meta, cfg) {
  const st = pityState(meta);
  return Math.max(0, cfg.pityEligibleKills - st.eligibleKills);
}

/* ------------------------------------------------------------------ */
/* Roll                                                                */
/* ------------------------------------------------------------------ */

/**
 * Satu keputusan drop untuk satu kill.
 *
 * @param {Object}   p.meta        state pemain (dimutasi: konter pity)
 * @param {Object}   p.run         run aktif — butuh `wave` dan `rareDropsThisRun`
 * @param {Object}   p.enemy       musuh yang baru mati (`isElite`, `tier`)
 * @param {Object}   p.cosmetics   isi cosmetics.json
 * @param {Object}   p.cfg         retention-config.json `rareDrop`
 * @param {Function} [p.rng]       sumber acak, default Math.random (disuntik saat uji)
 * @returns {{cosmeticId:string, viaPity:boolean, wave:number, source:string}|null}
 */
export function rollRareDrop({ meta, run, enemy, cosmetics, cfg, rng = Math.random }) {
  if (!run) return null;
  if ((run.rareDropsThisRun || 0) >= cfg.maxDropsPerRun) return null;
  if (!isEligibleKill(enemy, run.wave, cfg)) return null;

  const st = pityState(meta);
  st.eligibleKills += 1;

  const pool = buildDropPool(meta, cosmetics, cfg);
  if (pool.length === 0) return null;

  const viaPity = st.eligibleKills >= cfg.pityEligibleKills;
  const hit = viaPity || rng() < baseChanceFor(enemy, cfg);
  if (!hit) return null;

  const cosmeticId = pool[Math.floor(rng() * pool.length)];

  if (cfg.pityResetOnDrop) st.eligibleKills = 0;
  st.totalDrops += 1;
  st.lastDropAt = Date.now();
  run.rareDropsThisRun = (run.rareDropsThisRun || 0) + 1;

  return { cosmeticId, viaPity, wave: run.wave, source: enemy.tier === 'boss' ? 'boss' : 'elite' };
}

/**
 * Menambahkan kosmetik ke kepemilikan. Dipisah dari roll supaya pemanggil
 * bisa menunda pemberian sampai animasi peti selesai.
 */
export function grantCosmetic(meta, cosmeticId) {
  if (!meta.cosmetics) meta.cosmetics = { owned: [], skin: null, crown: null, aura: null };
  if (!Array.isArray(meta.cosmetics.owned)) meta.cosmetics.owned = [];
  if (!meta.cosmetics.owned.includes(cosmeticId)) meta.cosmetics.owned.push(cosmeticId);
  return meta;
}

/* ------------------------------------------------------------------ */
/* Peti Riset — pasangan berbayar dari sistem yang sama                */
/* ------------------------------------------------------------------ */

/**
 * Peti Riset memakai kolam dan pity yang TERPISAH dari drop gratis, supaya
 * pembelian tidak pernah memakan progres pity gratis pemain dan sebaliknya.
 *
 * @returns {{cosmeticId:string|null, viaPity:boolean}}
 */
export function openResearchCrate({ meta, cosmetics, cfg, cratePity, rng = Math.random }) {
  if (!meta.cratePity) meta.cratePity = { opens: 0 };
  const st = meta.cratePity;
  st.opens += 1;

  const pool = buildDropPool(meta, cosmetics, cfg);
  if (pool.length === 0) return { cosmeticId: null, viaPity: false };

  const viaPity = st.opens >= cratePity;
  const hit = viaPity || rng() < 1 / cratePity;
  if (!hit) return { cosmeticId: null, viaPity: false };

  const cosmeticId = pool[Math.floor(rng() * pool.length)];
  st.opens = 0;
  return { cosmeticId, viaPity };
}

/* ------------------------------------------------------------------ */
/* Verifikasi tuning                                                   */
/* ------------------------------------------------------------------ */

/**
 * Menghitung ekspektasi jumlah run per drop untuk satu profil run.
 * Dipakai `tools/validate-retention.mjs` supaya tuning tidak pernah dinilai
 * dari perasaan.
 *
 * @param {{eliteKills:number, bossKills:number}} profile kill LAYAK per run
 */
export function expectedRunsPerDrop(profile, cfg) {
  const pNoDrop =
    Math.pow(1 - cfg.chanceElite, profile.eliteKills) *
    Math.pow(1 - cfg.chanceBoss, profile.bossKills);
  const pRun = 1 - pNoDrop;
  const eligiblePerRun = profile.eliteKills + profile.bossKills;
  const pityRuns = eligiblePerRun > 0 ? cfg.pityEligibleKills / eligiblePerRun : Infinity;
  const rngRuns = pRun > 0 ? 1 / pRun : Infinity;
  return { rngRuns, pityRuns, effectiveRuns: Math.min(rngRuns, pityRuns) };
}
