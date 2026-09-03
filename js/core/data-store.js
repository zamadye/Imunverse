/**
 * data-store.js — Penyimpan data game hasil parse file JSON (data/*.json).
 * Semua konten game (hero, musuh, nutrisi, wave, upgrade, misi) TIDAK
 * di-hardcode di file logic — semuanya dibaca dari JSON ini.
 */

const store = {
  loaded: false,
  heroes: null,     // data/heroes.json
  enemies: null,    // data/enemies.json
  nutrients: null,  // data/nutrients.json
  waves: null,      // data/waves.json
  upgrades: null,   // data/upgrades.json
  missions: null,   // data/missions.json
  evolutions: null, // data/evolutions.json
  abilities: null,  // data/abilities.json
  arenas: null,     // data/arenas.json
};

/** Muat semua file JSON game secara paralel. */
export async function loadAllData() {
  const files = {
    heroes: 'data/heroes.json',
    enemies: 'data/enemies.json',
    nutrients: 'data/nutrients.json',
    waves: 'data/waves.json',
    upgrades: 'data/upgrades.json',
    missions: 'data/missions.json',
    evolutions: 'data/evolutions.json',
    abilities: 'data/abilities.json',
    arenas: 'data/arenas.json',
  };

  const entries = await Promise.all(
    Object.entries(files).map(async ([key, path]) => {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Gagal memuat ${path}: HTTP ${res.status}`);
      const json = await res.json();
      return [key, json];
    })
  );

  for (const [key, json] of entries) store[key] = json;
  store.loaded = true;
  return store;
}

export function getData() {
  if (!store.loaded) throw new Error('data-store belum dimuat — panggil loadAllData() dulu.');
  return store;
}

/** Cari definisi hero berdasarkan id. */
export function getHero(heroId) {
  return getData().heroes.heroes.find((h) => h.id === heroId) || null;
}

/** Cari definisi musuh berdasarkan id. */
export function getEnemyDef(enemyId) {
  return getData().enemies.enemies.find((e) => e.id === enemyId) || null;
}

/** Cari definisi nutrisi berdasarkan id. */
export function getNutrientDef(id) {
  return getData().nutrients.nutrients.find((n) => n.id === id) || null;
}

/** Ambil config wave untuk nomor wave tertentu (multiplier bertingkat). */
export function getWaveConfig() {
  return getData().waves;
}

/**
 * Multiplier spawn untuk wave tertentu: ambil entri waveMultipliers
 * dengan `wave` terbesar yang <= waveNumber (fallback 1.0).
 */
export function getSpawnMultiplier(waveNumber) {
  const list = getWaveConfig().waveMultipliers || [];
  let mult = 1;
  for (const entry of list) {
    if (waveNumber >= entry.wave) mult = entry.spawn;
  }
  return mult;
}

/** Formula interval spawn sesuai spek: max(0.4, 1.8 - wave*0.08),
 *  lalu dipercepat multiplier wave — dengan floor tetap dijaga. */
export function getSpawnInterval(waveNumber) {
  const cfg = getWaveConfig();
  const base = cfg.spawnIntervalBase - waveNumber * cfg.spawnIntervalWaveDecay;
  return Math.max(cfg.spawnIntervalMin, base / getSpawnMultiplier(waveNumber));
}

/** Scaling HP musuh: baseHP * (1 + (wave-1)*0.12) */
export function getEnemyHPScale(waveNumber) {
  const cfg = getWaveConfig();
  return 1 + (waveNumber - 1) * cfg.enemyHPScalePerWave;
}

/** Scaling speed musuh dengan batas atas. */
export function getEnemySpeedScale(waveNumber) {
  const cfg = getWaveConfig();
  return Math.min(cfg.enemySpeedScaleMax, 1 + (waveNumber - 1) * cfg.enemySpeedScalePerWave);
}

/** xpToNextLevel = ceil(base * level^exponent), default 10 * level^1.5 */
export function xpToNextLevel(level) {
  const { base, exponent } = getData().upgrades.xpCurve;
  return Math.ceil(base * Math.pow(level, exponent));
}
