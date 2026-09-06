/**
 * data-store.js — Penyimpan data game hasil parse file JSON (data/*.json).
 * Semua konten game (hero, musuh, nutrisi, wave, upgrade, misi) TIDAK
 * di-hardcode di file logic — semuanya dibaca dari JSON ini.
 */

import { t } from '../systems/i18n.js';
// Fase 17: retention-system MEMBACA data lewat getData() — tidak diimpor di sini
// (hindari siklus modul); konsumen mengimpor langsung dari systems/retention-system.js.

const store = {
  loaded: false,
  raw: {}, // salinan mentah semua JSON — sumber toggle bahasa
  heroes: null,     // data/heroes.json
  enemies: null,    // data/enemies.json
  nutrients: null,  // data/nutrients.json
  waves: null,      // data/waves.json
  upgrades: null,   // data/upgrades.json
  missions: null,   // data/missions.json
  evolutions: null, // data/evolutions.json
  battlepass: null, // data/battlepass.json (Fase 14: Battle Pass + offerwall)
  cosmetics: null,  // data/cosmetics.json (Fase 14: skin & aksesori)
  abilities: null,  // data/abilities.json
  arenas: null,     // data/arenas.json
  bodySystems: null, // data/body-systems.json (meta-layer kondisi tubuh)
  retention: null,  // data/retention.json (Fase 17: parameter 5 retention trigger)
  progression: null, // data/progression.json (Fase 18: kurva early/mid/late + gatekeeper)
  ranks: null,       // data/ranks.json (Fase 19: pangkat penjaga — tujuan pemain)
};

import { BUILD } from './version.js';

/** Muat semua file JSON game secara paralel. */
export async function loadAllData() {
  const files = {
    heroes: 'data/heroes.json',
    skills: 'data/skills.json',
    enemies: 'data/enemies.json',
    nutrients: 'data/nutrients.json',
    waves: 'data/waves.json',
    upgrades: 'data/upgrades.json',
    missions: 'data/missions.json',
    evolutions: 'data/evolutions.json',
    battlepass: 'data/battlepass.json',
    cosmetics: 'data/cosmetics.json',
    abilities: 'data/abilities.json',
    arenas: 'data/arenas.json',
    modes: 'data/modes.json',
    mutators: 'data/mutators.json',
    campaign: 'data/campaign.json',
    cinematics: 'data/cinematics.json',
    coach: 'data/coach.json',
    factions: 'data/factions.json',
    premium: 'data/premium.json',
    bodySystems: 'data/body-systems.json',
    codex: 'data/codex.json',
    retention: 'data/retention.json',
    progression: 'data/progression.json',
    ranks: 'data/ranks.json',
  };

  const entries = await Promise.all(
    Object.entries(files).map(async ([key, path]) => {
      let res;
      try {
        res = await fetch(`${path}?v=${BUILD}`);
      } catch {
        res = await fetch(`${path}?v=${BUILD}&r=${Date.now()}`); // retry tanpa cache
      }
      if (!res.ok) throw new Error(`Gagal memuat ${path}: HTTP ${res.status} (update game belum penuh?)`);
      const json = await res.json();
      return [key, json];
    })
  );

  for (const [key, json] of entries) {
    store.raw[key] = json;
    store[key] = json;
  }
  store.loaded = true;
  return store;
}

// Field data yang tampil ke pemain (diterjemahkan saat bahasa EN aktif).
const TRANSLATE_FIELDS = new Set([
  'name', 'description', 'desc', 'label', 'title', 'organ', 'story',
  'objective', 'sub', 'role', 'hint', 'effect', 'line', 'short',
  'question', 'answer', 'text', 'goal', 'tagline', 'funKid', 'fact',
]);

function cloneMaybeTranslate(v, force) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((x) => cloneMaybeTranslate(x, force));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) {
      const val = v[k];
      o[k] = (force && TRANSLATE_FIELDS.has(k) && typeof val === 'string') ? t(val) : cloneMaybeTranslate(val, force);
    }
    return o;
  }
  return v;
}

/**
 * Terapkan bahasa ke SELURUH data game dari salinan mentah.
 * 'id' → apa adanya; 'en' → field tampilan diterjemahkan via kamus i18n.
 */
export function applyDataLanguage(lang) {
  if (!store.loaded) return;
  for (const key of Object.keys(store.raw)) {
    store[key] = cloneMaybeTranslate(store.raw[key], lang === 'en');
  }
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
 *  lalu dipercepat multiplier wave — dengan floor tetap dijaga.
 *  Fase 18: × band kurva (early longgar 1.3×, late padat 0.78×). */
export function getSpawnInterval(waveNumber) {
  const cfg = getWaveConfig();
  const base = cfg.spawnIntervalBase - waveNumber * cfg.spawnIntervalWaveDecay;
  const band = getProgressionBand(waveNumber);
  return Math.max(cfg.spawnIntervalMin, base / getSpawnMultiplier(waveNumber)) * band.spawnMult;
}

/** Scaling HP musuh: baseHP * (1 + (wave-1)*hpScale) × band kurva (Fase 18). */
export function getEnemyHPScale(waveNumber) {
  const cfg = getWaveConfig();
  return (1 + (waveNumber - 1) * cfg.enemyHPScalePerWave) * getProgressionBand(waveNumber).enemyHPMult;
}

/** Scaling speed musuh dengan batas atas (+ bonus band late agar musuh
 *  level tinggi lebih gesit — Fase 18). */
export function getEnemySpeedScale(waveNumber) {
  const cfg = getWaveConfig();
  const band = getProgressionBand(waveNumber);
  return Math.min(
    cfg.enemySpeedScaleMax + 0.15 + band.enemySpeedBonus,
    1 + (waveNumber - 1) * cfg.enemySpeedScalePerWave + band.enemySpeedBonus,
  );
}

// ===== Fase 19: pangkat penjaga (data/ranks.json) =====

/** Seluruh config pangkat (tier ladder, formula GP, musim). */
export function getRanks() {
  return getData().ranks;
}

// ===== Fase 18: kurva progresi early/mid/late (data/progression.json) =====

/** Seluruh config progresi. */
export function getProgression() {
  return getData().progression;
}

/** Band kurva untuk wave tertentu: early (1–5), mid (6–15), late (16+). */
export function getProgressionBand(waveNumber) {
  const bands = getData().progression.bands;
  for (const b of bands) {
    if (waveNumber <= b.maxWave) return b;
  }
  return bands[bands.length - 1];
}

/** xpToNextLevel = ceil(base * level^exponent), default 10 * level^1.5 */
export function xpToNextLevel(level) {
  const { base, exponent } = getData().upgrades.xpCurve;
  return Math.ceil(base * Math.pow(level, exponent));
}
