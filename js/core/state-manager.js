/**
 * state-manager.js — Pusat state global aplikasi Imunverse.
 * Single source of truth untuk: layar aktif, status pause, meta progress.
 * Meta progress (permanen) disimpan via save-manager; state run (transient)
 * dikelola oleh core/game.js.
 */

export const STATE = {
  /** 'loading' | 'dashboard' | 'roster' | 'upgrade' | 'shop' | 'gameplay' | 'gameover' */
  screen: 'loading',
  /** gameplay dijeda (pause modal / levelup modal / revive modal) */
  paused: false,
  /** modal level-up sedang terbuka */
  levelUpOpen: false,
  /** data meta permanen (currency, unlock, upgrade, misi, statistik) */
  meta: null,
};

export function setScreen(name) {
  STATE.screen = name;
}

export function setPaused(v) {
  STATE.paused = v;
}

export function setLevelUpOpen(v) {
  STATE.levelUpOpen = v;
}

/**
 * Struktur default data meta yang akan di-persist ke localStorage.
 * Harus JSON-serializable penuh (JSON.stringify/parse).
 */
export function createDefaultMeta() {
  return {
    version: 1,
    currency: 0,
    unlockedHeroes: ['sel_t'],
    selectedHero: 'sel_t',
    selectedArena: 'limfe',
    evoStage: 0,
    evoParts: { silia: 0, pseudopodia: 0, mikropedang: 0, inti_elemen: 0 },
    adDaily: { date: null, count: 0 },
    focusRun: 'seimbang',
    tutorialDone: false,
    /** Preferensi audio (Fase 6): toggle SFX & musik, dipersist di save. */
    audio: { sfx: true, music: true },
    bodyState: null, // diisi createDefaultBodyState() saat body-system pertama dipakai
    squadUpgrades: {
      sq_damage: 0,
      sq_vitality: 0,
      sq_swift: 0,
      sq_attack: 0,
      sq_range: 0,
      sq_nutrition: 0,
    },
    consumables: { serum_awal: 0 },
    missionsClaimed: [],
    stats: {
      totalKills: 0,
      bossKills: 0,
      bestWave: 0,
      bestSurvivalTime: 0,
      totalSurviveSeconds: 0,
      totalRuns: 0,
      totalNutrients: 0,
      totalCurrencyEarned: 0,
      totalXP: 0,
    },
    lastDailyClaim: null, // string tanggal "YYYY-MM-DD"
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
}

/**
 * Merge deep bertingkat: pastikan save lama (versi sebelumnya) tetap valid
 * bila ada field baru di default meta.
 */
export function mergeMetaDefaults(meta) {
  const base = createDefaultMeta();
  const merged = deepMerge(base, meta || {});
  return merged;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    const s = source[key];
    if (isPlainObject(s) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], s);
    } else if (s !== undefined) {
      out[key] = s;
    }
  }
  return out;
}
