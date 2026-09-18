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
    coachDone: false,
    // V2 gameplay-first onboarding (blueprint §48-49, roadmap ROADMAP.md §"P7"):
    // save BARU (belum pernah main) → false → loading langsung ke gameplay
    // dengan Mako, bukan dashboard. Sekali run pertama dimulai, jadi true
    // selamanya (lihat main.js boot + mergeMetaDefaults di bawah untuk save lama).
    onboardingDone: false,
    // Modal "openbox" (reveal hero bonus T-Bolt) tampil sekali di level-up
    // pertama pemain baru — lihat main.js on('levelup'/'resume').
    onboardingBoxSeen: false,
    account: null, // { uid, username, faction, createdAt } — diisi saat sign-up/login
    guestUid: null, // ADDENDUM §1.5/§3.2: UID tamu utk link referral/share (akun boleh belum ada)
    leaderboard: [],
    evoStage: 0,
    evoParts: { fragmen_diferensiasi: 0 },
    adDaily: { date: null, count: 0 },
    adLastAt: 0,      // P5: stempel iklan reward terakhir (jeda antar-iklan)
    reserve: 0,       // P5: CADANGAN — resource eksternal, terpisah dari Antibodi (IAP §14)
    focusRun: 'seimbang',
    tutorialDone: false,
    soundMuted: false,
    musicOn: true, // F23: musik latar prosedural (Profil → Pengaturan)
    bodyState: null, // diisi createDefaultBodyState() saat body-system pertama dipakai
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
      totalEngulfs: 0,
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
    // Sprint 3.19: nilai boolean lama = Normal (0); nilai baru = indeks tier tertinggi.
    for (const [k, v] of Object.entries(meta.campaignCleared)) mc[mapCh(k)] = (v === true ? 0 : v);
    meta.campaignCleared = mc;
  }
  // Save yang SUDAH ADA (lewat jalur ini, bukan createDefaultMeta) berarti
  // pemainnya sudah pernah main sebelum onboarding gameplay-first ini ada —
  // jangan paksa mereka lewat onboarding lagi di boot berikutnya.
  if (typeof meta.onboardingDone !== 'boolean') meta.onboardingDone = true;
  if (typeof meta.onboardingBoxSeen !== 'boolean') meta.onboardingBoxSeen = true;
  if (Array.isArray(meta.unlockedHeroes)) meta.unlockedHeroes = [...new Set(meta.unlockedHeroes.map(mapId))];
  if (meta.selectedHero) meta.selectedHero = mapId(meta.selectedHero);
  if (meta.codexSeen && typeof meta.codexSeen === 'object') {
    const mapped = {};
    for (const [k, v] of Object.entries(meta.codexSeen)) mapped[mapCh(mapId(k))] = v;
    meta.codexSeen = mapped;
  }
  // Sprint 3.19: semua part lama (era silia & era equity) dilebur jadi Fragmen Diferensiasi.
  if (meta.evoParts && typeof meta.evoParts === 'object') {
    const PART_MAP = {
      silia: 'fragmen_diferensiasi',
      pseudopodia: 'fragmen_diferensiasi',
      mikropedang: 'fragmen_diferensiasi',
      inti_elemen: 'fragmen_diferensiasi',
      equity_receptor: 'fragmen_diferensiasi',
      equity_membrane: 'fragmen_diferensiasi',
      equity_effector: 'fragmen_diferensiasi',
      equity_memory_core: 'fragmen_diferensiasi',
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
