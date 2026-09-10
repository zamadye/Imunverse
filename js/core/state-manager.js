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
    lang: 'id', // bahasa UI ('id' | 'en') — dipakai sistem i18n
    codexSeen: {}, // Kodex Sel (Bio-Pedia): id entitas yang pernah ditemui
    currency: 0,
    unlockedHeroes: ['tcd8'],
    selectedHero: 'macrophage',
    selectedArena: 'limfe',
    selectedMode: 'kampanye',
    selectedChapter: 'bab_luka',
    campaignCleared: {},
    allies: 1, // pasukan imun permanen (tumbuh per bab bersih, maks 6)
    heroLevels: {},  // { heroId: level } — level per hero (upgrade antibodi)
    allyLevel: 0,    // level pasukan (damage & gesit)
    coachDone: false,
    account: null, // { uid, username, faction, createdAt } — diisi saat sign-up/login
    cinematicsSeen: {},
    // R3 (Narrative-Cinematic): penanda momen "first-time experience" (Task 4)
    // — masing-masing diputar SEKALI SEJAK PERNAH (VO + presenter, non-blocking)
    nft: { move: false, levelup: false, skill: false, revive: false },
    bossRevealSeen: false, // reveal boss bab kanker (cutscene 6.3) — sekali
    leaderboard: [],
    evoStage: 0,
    evoParts: { equity_receptor: 0, equity_membrane: 0, equity_effector: 0, equity_memory_core: 0 },
    adDaily: { date: null, count: 0 },
    focusRun: 'seimbang',
    tutorialDone: false,
    soundMuted: false,
    musicOn: true, // F23: musik latar prosedural (Profil → Pengaturan)
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
    questState: { periodKey: null, accepted: {}, claimed: {}, baseline: {} },
    globalUpgrades: {},   // Fase 17: upgrade permanen global (Imun Coin, semua hero)
    heroNotices: [],      // Fase 17: antrean notifikasi "HERO BARU" (overlay dashboard)
    stats: {
      wins: 0,
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
  // MIGRASI Fase 12: id hero lama → roster 11 hero baru (save pemain lama aman)
  const HERO_MAP = {
    sel_t: 'tcd8', makrofag: 'macrophage', neutrofil: 'neutrophil',
    sel_b: 'bcell', sel_nk: 'nkcell', eosinofil: 'eosinophil',
  };
  const mapId = (id) => HERO_MAP[id] || id;
  // R2 (Rebuild): remap penuh campaign organ → kondisi (story doc §5)
  const CH_MAP = {
    bab_mulut: 'bab_luka', bab_lambung: 'bab_demam', bab_usus: 'bab_racun',
    bab_paru: 'bab_alergi', bab_limfe: 'bab_kanker', bab_jantung: 'bab_final',
  };
  const mapCh = (id) => CH_MAP[id] || id;
  if (meta.selectedChapter) meta.selectedChapter = mapCh(meta.selectedChapter);
  if (meta.campaignCleared && typeof meta.campaignCleared === 'object') {
    const mc = {};
    for (const [k, v] of Object.entries(meta.campaignCleared)) mc[mapCh(k)] = v;
    meta.campaignCleared = mc;
  }
  // R3: merge penanda naratif baru (save lama aman)
  meta.nft = { ...base.nft, ...(meta.nft && typeof meta.nft === 'object' ? meta.nft : {}) };
  if (typeof meta.bossRevealSeen !== 'boolean') meta.bossRevealSeen = false;
  if (meta.cinematicsSeen && typeof meta.cinematicsSeen === 'object') {
    const ms = {};
    for (const [k, v] of Object.entries(meta.cinematicsSeen)) {
      let nk = k;
      for (const [o, nu] of Object.entries(CH_MAP)) nk = nk.replace(o, nu);
      ms[nk] = v;
    }
    meta.cinematicsSeen = ms;
  }
  if (Array.isArray(meta.unlockedHeroes)) meta.unlockedHeroes = [...new Set(meta.unlockedHeroes.map(mapId))];
  if (meta.selectedHero) meta.selectedHero = mapId(meta.selectedHero);
  if (meta.heroLevels && typeof meta.heroLevels === 'object') {
    const mapped = {};
    for (const [k, v] of Object.entries(meta.heroLevels)) mapped[mapId(k)] = v;
    meta.heroLevels = mapped;
  }
  if (meta.codexSeen && typeof meta.codexSeen === 'object') {
    const mapped = {};
    for (const [k, v] of Object.entries(meta.codexSeen)) mapped[mapCh(mapId(k))] = v;
    meta.codexSeen = mapped;
  }
  // Character Agent: migrasi part evolusi lama ke fragmen equity baru.
  if (meta.evoParts && typeof meta.evoParts === 'object') {
    const PART_MAP = {
      silia: 'equity_receptor',
      pseudopodia: 'equity_membrane',
      mikropedang: 'equity_effector',
      inti_elemen: 'equity_memory_core',
    };
    const mappedParts = {};
    for (const [k, v] of Object.entries(meta.evoParts)) {
      const nk = PART_MAP[k] || k;
      mappedParts[nk] = (mappedParts[nk] || 0) + (v || 0);
    }
    meta.evoParts = mappedParts;
  }
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
