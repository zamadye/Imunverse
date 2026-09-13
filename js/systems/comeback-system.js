/**
 * comeback-system.js — Imunverse
 *
 * Memperbaiki satu perilaku yang secara aktif mengusir pemain: peluruhan
 * kondisi tubuh 1 poin per hari secara rolling. Pemain yang kembali setelah
 * dua minggu menemukan kelima sistem tubuhnya kritis dan run pertamanya
 * dihukum — persis di momen paling rapuh dalam hidup seorang pemain.
 *
 * Modul ini melakukan tiga hal, semuanya di satu titik panggil saat boot:
 *   1. membatasi peluruhan offline
 *   2. menghitung dan memberi hadiah kembali
 *   3. mengelola streak harian dengan hari pengampunan
 *
 * Integrasi (`main.js:boot()`, setelah loadSave / mergeMetaDefaults, sebelum
 * dashboard dirender):
 *
 *   import { runComebackPass } from './systems/comeback-system.js';
 *   const cb = runComebackPass({ meta, cfg: DATA.retention.comeback, now: Date.now() });
 *   if (cb.returnGift || cb.streakReward) showComebackModal(cb);
 *   if (cb.changed) writeSave(meta);
 */

const DAY_MS = 86400000;

/* ------------------------------------------------------------------ */
/* Utilitas hari                                                       */
/* ------------------------------------------------------------------ */

/** Jumlah hari penuh antara dua timestamp, minimal 0. */
export function daysBetween(fromTs, toTs) {
  if (!fromTs) return 0;
  return Math.max(0, Math.floor((toTs - fromTs) / DAY_MS));
}

/* ------------------------------------------------------------------ */
/* 1. Batas peluruhan offline                                          */
/* ------------------------------------------------------------------ */

/**
 * Mengembalikan jumlah hari peluruhan yang BOLEH diterapkan body-system.
 * Panggil ini sebelum `body-system` menerapkan decay; teruskan hasilnya
 * sebagai jumlah hari, bukan selisih tanggal mentah.
 *
 * Absen 2 hari tetap meluruh penuh (menjaga tekanan harian tetap nyata);
 * absen 30 hari juga hanya meluruh 2 hari.
 */
export function cappedDecayDays(meta, cfg, now) {
  const last = meta.lastPlayedAt || meta.updatedAt || now;
  const raw = daysBetween(last, now);
  return { rawDays: raw, appliedDays: Math.min(raw, cfg.maxOfflineDecayDays) };
}

/**
 * Memulihkan seluruh sistem tubuh ke 100 dan membersihkan racun.
 * Dipakai oleh hadiah kembali yang memuat `restoreBody`.
 */
export function restoreBody(meta) {
  const body = meta.bodyState;
  if (!body || !body.systems) return false;
  for (const key of Object.keys(body.systems)) {
    const sys = body.systems[key];
    if (sys && typeof sys.health === 'number') sys.health = 100;
    else body.systems[key] = 100;
  }
  if (typeof body.toxin === 'number') body.toxin = 0;
  if (typeof body.energy === 'number') body.energy = 100;
  return true;
}

/* ------------------------------------------------------------------ */
/* 2. Hadiah kembali                                                   */
/* ------------------------------------------------------------------ */

/** Tingkat hadiah yang cocok untuk jumlah hari absen, atau null. */
export function returnGiftTier(daysAway, cfg) {
  for (const tier of cfg.returnGift) {
    if (daysAway >= tier.minDaysAway && daysAway <= tier.maxDaysAway) return tier;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 3. Streak harian                                                    */
/* ------------------------------------------------------------------ */

/**
 * Memutakhirkan streak. `graceDays` berarti melewatkan satu hari tidak
 * mematahkan streak — pengampunan ini terbukti menaikkan retensi jauh lebih
 * banyak daripada yang hilang dari kelonggarannya, karena kehilangan streak
 * panjang adalah alasan berhenti yang paling umum.
 *
 * @returns {{day:number, advanced:boolean, broken:boolean}}
 */
export function updateStreak(meta, cfg, now) {
  if (!meta.streak) meta.streak = { day: 0, lastDayTs: 0, best: 0 };
  const st = meta.streak;
  const gap = daysBetween(st.lastDayTs, now);

  if (st.lastDayTs && gap === 0) {
    return { day: st.day, advanced: false, broken: false };
  }

  const broken = st.lastDayTs !== 0 && gap > 1 + cfg.streak.graceDays;
  st.day = broken ? 1 : st.day + 1;
  st.lastDayTs = now;
  if (st.day > st.best) st.best = st.day;
  return { day: st.day, advanced: true, broken };
}

/**
 * Hadiah untuk hari streak tertentu. Setelah `cycleAfterDay`, tangga
 * berputar kembali ke `cycleRepeatFromDay` sehingga pemain jangka panjang
 * tidak pernah kehabisan alasan untuk login.
 */
export function streakRewardFor(day, cfg) {
  const s = cfg.streak;
  let effective = day;
  if (day > s.cycleAfterDay) {
    const span = s.cycleAfterDay - s.cycleRepeatFromDay + 1;
    effective = s.cycleRepeatFromDay + ((day - s.cycleRepeatFromDay) % span);
  }
  let match = null;
  for (const r of s.rewards) {
    if (r.day === effective) return r;
    if (r.day < effective && (!match || r.day > match.day)) match = r;
  }
  return match;
}

/* ------------------------------------------------------------------ */
/* Pemberian hadiah                                                    */
/* ------------------------------------------------------------------ */

/**
 * Menerapkan satu paket hadiah ke meta. Sengaja menulis langsung ke meta
 * dan bukan lewat economy-system agar pass ini bisa berjalan sebelum sistem
 * lain siap saat boot; ringkasan yang dikembalikan dipakai untuk modal.
 */
export function applyReward(meta, reward) {
  const granted = { currency: 0, imun: 0, consumables: {}, bodyRestored: false };
  if (!reward) return granted;

  if (reward.currency) {
    meta.currency = (meta.currency || 0) + reward.currency;
    granted.currency = reward.currency;
  }
  if (reward.imun) {
    meta.imun = (meta.imun || 0) + reward.imun;
    granted.imun = reward.imun;
  }
  if (reward.consumables) {
    if (!meta.consumables) meta.consumables = {};
    for (const [id, qty] of Object.entries(reward.consumables)) {
      meta.consumables[id] = (meta.consumables[id] || 0) + qty;
      granted.consumables[id] = qty;
    }
  }
  if (reward.restoreBody) granted.bodyRestored = restoreBody(meta);
  return granted;
}

/* ------------------------------------------------------------------ */
/* Pass utama                                                          */
/* ------------------------------------------------------------------ */

/**
 * Satu-satunya fungsi yang perlu dipanggil saat boot.
 *
 * @returns {{
 *   daysAway:number, decayDays:number,
 *   streak:{day:number, advanced:boolean, broken:boolean},
 *   streakReward:Object|null, returnGift:Object|null,
 *   granted:Object, changed:boolean
 * }}
 */
export function runComebackPass({ meta, cfg, now = Date.now() }) {
  const last = meta.lastPlayedAt || meta.updatedAt || 0;
  const daysAway = daysBetween(last, now);
  const decay = cappedDecayDays(meta, cfg, now);

  const streak = updateStreak(meta, cfg, now);

  let streakReward = null;
  let returnGift = null;
  const granted = { currency: 0, imun: 0, consumables: {}, bodyRestored: false };

  if (streak.advanced) {
    streakReward = streakRewardFor(streak.day, cfg);
    const g = applyReward(meta, streakReward);
    granted.currency += g.currency;
    granted.imun += g.imun;
    granted.bodyRestored = granted.bodyRestored || g.bodyRestored;
    for (const [k, v] of Object.entries(g.consumables)) {
      granted.consumables[k] = (granted.consumables[k] || 0) + v;
    }
  }

  if (daysAway >= 3) {
    returnGift = returnGiftTier(daysAway, cfg);
    const g = applyReward(meta, returnGift);
    granted.currency += g.currency;
    granted.imun += g.imun;
    granted.bodyRestored = granted.bodyRestored || g.bodyRestored;
    for (const [k, v] of Object.entries(g.consumables)) {
      granted.consumables[k] = (granted.consumables[k] || 0) + v;
    }
  }

  meta.lastPlayedAt = now;

  return {
    daysAway,
    decayDays: decay.appliedDays,
    rawDecayDays: decay.rawDays,
    streak,
    streakReward,
    returnGift,
    granted,
    changed: streak.advanced || returnGift !== null
  };
}
