/**
 * body-system.js — META-LAYER: tubuh sebagai sistem organisme yang dikelola.
 *
 * Tujuan game = menjaga "universe-tubuh" tetap sehat (bukan sekadar survive):
 * 5 sistem (Sirkulasi, Pencernaan, Saraf, Imun, Limfatik) punya nilai 0-100
 * dan SALING MEMENGARUHI:
 *   - Pencernaan sehat → hasilkan Energi per run
 *   - Sirkulasi_efektif = Sirkulasi_base * (Pencernaan / 100)
 *   - Combat → hasilkan Racun: kills * racunPerKill - limfatik * cleansePer
 *   - Limfatik overload → racun meracuni Pencernaan (siklus memburuk)
 *   - Sistem < 20 = kondisi kritis → modifier run (bukan game over)
 * Milestone makro: SEMUA sistem ≥ 80 selama N hari berturut-turut
 * → "Tubuh Sehat Sempurna". Sesi in-run TIDAK berubah — layer ini murni
 * antar-run (dashboard kondisi tubuh + pilih fokus run).
 */

import { getData } from '../core/data-store.js';
import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';

const todayStr = () => new Date().toISOString().slice(0, 10);

/** Selisih hari kalender (string YYYY-MM-DD). */
function daysBetween(fromStr, toStr) {
  if (!fromStr) return 1;
  const a = new Date(fromStr + 'T00:00:00Z');
  const b = new Date(toStr + 'T00:00:00Z');
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Kondisi default meta.bodyState (di-merge deep saat load save). */
export function createDefaultBodyState() {
  const systems = {};
  for (const def of getData().bodySystems.systems) {
    systems[def.id] = { health: def.startHealth, lastCaredDay: null };
  }
  return {
    systems,
    energi: 40,
    racun: 15,
    lastVisitedDay: null,
    perfectStreak: 0,
    milestoneDone: false,
    narrativeStage: 0, // index ke dalam arc naratif (0 = terinfeksi kronis)
  };
}

/** Ambil state tubuh dari meta, merge default untuk save lama. */
export function getBodyState(meta = STATE.meta) {
  const def = createDefaultBodyState();
  const st = meta.bodyState || def;
  const merged = { ...def, ...st };
  merged.systems = { ...def.systems };
  for (const key of Object.keys(def.systems)) {
    if (st.systems && st.systems[key]) merged.systems[key] = { ...def.systems[key], ...st.systems[key] };
  }
  return merged;
}

export function getSystemDef(id) {
  return getData().bodySystems.systems.find((s) => s.id === id);
}

export function clampHealth(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ---------------------------------------------------------------------------
// DAILY DECAY — tiap sistem -1/hari bila tidak "dirawat" (run fokus yang
// menang / suplemen). Hari yang terlewat saat offline dihitung (cap 7 hari).
// ---------------------------------------------------------------------------
export function applyDailyDecay(meta = STATE.meta) {
  const cfg = getData().bodySystems;
  const st = getBodyState(meta);
  const today = todayStr();
  const elapsed = daysBetween(st.lastVisitedDay, today);
  if (elapsed <= 0) return { decayed: [], days: 0 };

  const decayed = [];
  for (const sysDef of cfg.systems) {
    const sys = st.systems[sysDef.id];
    // hari terakhir dirawat vs hari terakhir kunjungan: decay hanya bila
    // TIDAK dirawat pada hari-hari yang berlalu
    const caredElapsed = daysBetween(sys.lastCaredDay, today);
    if (caredElapsed >= 1) {
      const drop = Math.min(cfg.decayPerDay * Math.min(caredElapsed, 7), sys.health);
      if (drop > 0) {
        sys.health = clampHealth(sys.health - drop);
        decayed.push(sysDef.id);
      }
    }
  }
  st.lastVisitedDay = today;
  meta.bodyState = st;
  writeSave(meta);
  return { decayed, days: elapsed };
}

/** Tandai sistem "dirawat" hari ini (run fokus menang / suplemen / iklan). */
export function markCared(sysId, meta = STATE.meta) {
  const st = getBodyState(meta);
  st.systems[sysId].lastCaredDay = todayStr();
  meta.bodyState = st;
}

// ---------------------------------------------------------------------------
// KALKULASI EFEK SILANG
// ---------------------------------------------------------------------------

/** Sirkulasi_efektif = Sirkulasi_base * (Pencernaan / 100) — rumus inti. */
export function sirkulasiEfektif(meta = STATE.meta) {
  const st = getBodyState(meta);
  return st.systems.sirkulasi.health * (st.systems.pencernaan.health / 100);
}

/** Daftar sistem dalam kondisi kritis (< threshold). */
export function getCriticalSystems(meta = STATE.meta) {
  const cfg = getData().bodySystems;
  const st = getBodyState(meta);
  return cfg.systems
    .filter((def) => st.systems[def.id].health < cfg.criticalThreshold)
    .map((def) => ({ def, health: st.systems[def.id].health }));
}

/** Gabungan modifier run dari SEMUA sistem kritis (mis. musuh +20% cepat). */
export function getCriticalModifiers(meta = STATE.meta) {
  const mods = {};
  for (const { def } of getCriticalSystems(meta)) {
    for (const [k, v] of Object.entries(def.critical.modifier)) {
      mods[k] = (mods[k] || 1) * v;
    }
  }
  return mods;
}

/**
 * Modifier in-run dari KONDISI TUBUH (bukan kritis — bonus bertahap):
 * tiap sistem memberi stat 0.8..1.2 sebanding kesehatannya. Dipakai
 * game.startRun — gameplay inti tetap sama, hanya disetel kondisi tubuh.
 */
export function getBodyRunModifiers(meta = STATE.meta) {
  const st = getBodyState(meta);
  const sirk = sirkulasiEfektif(meta);
  return {
    // respons imun (attack speed) mengikuti Sirkulasi EFEKTIF
    cooldownScale: 1.25 - 0.25 * (sirk / 100),
    // nutrisi mengikuti Pencernaan
    nutrientMult: 0.8 + 0.4 * (st.systems.pencernaan.health / 100),
    // deteksi dini (XP) mengikuti Saraf
    xpMult: 0.9 + 0.2 * (st.systems.saraf.health / 100),
    // kekuatan hero mengikuti Imun
    damageMult: 0.85 + 0.3 * (st.systems.imun.health / 100),
    // kecepatan bersih racun mengikuti Limfatik
    racunCleanseMult: 0.6 + 0.8 * (st.systems.limfatik.health / 100),
    ...getCriticalModifiers(meta), // kritis MENIMPA bonus bertahap
  };
}

/** Label arc naratif kondisi tubuh (terinfeksi kronis → sehat sempurna). */
export function getNarrativeStage(meta = STATE.meta) {
  const st = getBodyState(meta);
  const avg = Object.values(st.systems).reduce((a, s) => a + s.health, 0) / Object.keys(st.systems).length;
  if (st.milestoneDone) return { index: 4, label: 'Sehat Sempurna', avg };
  if (avg < 35) return { index: 0, label: 'Terinfeksi Kronis', avg };
  if (avg < 60) return { index: 1, label: 'Tubuh Mulai Melawan', avg };
  if (avg < 80) return { index: 2, label: 'Zaman Pemulihan', avg };
  return { index: 3, label: 'Hampir Sehat', avg };
}

/** Progres milestone makro: semua ≥80 berturut-turut N hari. */
export function getMilestoneProgress(meta = STATE.meta) {
  const cfg = getData().bodySystems;
  const st = getBodyState(meta);
  const allHealthy = Object.values(st.systems).every((s) => s.health >= cfg.perfectThreshold);
  return {
    allHealthy,
    streak: st.perfectStreak,
    target: cfg.perfectDays,
    done: st.milestoneDone,
    pct: Math.min(1, st.perfectStreak / cfg.perfectDays),
  };
}

// ---------------------------------------------------------------------------
// REGISTER HASIL RUN — loop tertutup antar-sistem
// ---------------------------------------------------------------------------

/**
 * Terapkan konsekuensi run ke kondisi tubuh:
 *  - Racun dihasilkan: kills * 0.3 - limfatik * 0.02 (formula user), lalu
 *    disaring lagi oleh focus detoks & Limfatik.
 *  - Energi dihasilkan Pencernaan; dipakai memulihkan sistem fokus.
 *  - Sistem fokus naik bila run "cukup baik" (wave ≥ 3), turun kecil bila
 *    gagal total; sistem lain +kecil saat menang.
 *  - Racun overflow → meracuni Pencernaan (racunToxicSeep).
 *  - Milestone harian: semua sehat → streak++, else reset.
 * @returns {object} ringkasan dampak (untuk UI gameover/toast)
 */
export function registerRunResult(meta, { kills, wave, focusId }) {
  const cfg = getData().bodySystems;
  const st = getBodyState(meta);
  const today = todayStr();
  const impact = { racunGained: 0, energiGained: 0, systemGains: {}, toxicSeep: 0, detox: 0, milestone: null };

  // ---- 1. Racun sisa pertarungan (formula dari desain) ----
  const limfatik = st.systems.limfatik.health;
  let racunGained = kills * cfg.racunPerKill - limfatik * cfg.racunCleansePerLimfatik;
  racunGained = Math.max(0, racunGained);
  // fokus detoks: saring ekstra
  const focusDef = cfg.focusRuns.find((f) => f.id === focusId);
  if (focusDef && focusDef.target === 'limfatik') {
    const extra = cfg.detoxCleanseBase + limfatik * 0.05;
    racunGained = Math.max(0, racunGained - extra);
    impact.detox = Math.round(extra);
  }
  // kondisi kritis limfatik: penumpukan dipercepat
  if (limfatik < cfg.criticalThreshold) racunGained *= 1.5;
  st.racun = Math.min(cfg.racunMax, st.racun + racunGained);
  impact.racunGained = Math.round(racunGained * 10) / 10;

  // ---- 2. Energi dari Pencernaan ----
  const penc = st.systems.pencernaan.health;
  const energiGained = Math.round(cfg.energiPerRun * (0.5 + penc / 200) + wave); // 0.5x..1.5x + wave
  st.energi = Math.min(cfg.energiMax, st.energi + energiGained);
  impact.energiGained = energiGained;

  // ---- 3. Pemulihan sistem ----
  const won = wave >= 3; // "menang" = bertahan minimal sampai wave 3
  const gainMap = {};
  if (focusDef && focusDef.target) {
    gainMap[focusDef.target] = won ? cfg.focusGainWon : cfg.focusGainShort;
  } else if (won) {
    for (const def of cfg.systems) gainMap[def.id] = cfg.passiveGainWon;
  }
  // energi membantu: sistem fokus +1 ekstra per 25 energi (dipakai/dikurangi)
  if (focusDef && focusDef.target && st.energi >= 25) {
    const boost = Math.floor(st.energi / 25);
    gainMap[focusDef.target] = (gainMap[focusDef.target] || 0) + boost;
    st.energi -= boost * 25;
  }
  for (const [sysId, gain] of Object.entries(gainMap)) {
    const sys = st.systems[sysId];
    const before = sys.health;
    sys.health = clampHealth(sys.health + gain);
    impact.systemGains[sysId] = sys.health - before;
    if (sys.health >= cfg.perfectThreshold || (won && focusDef && focusDef.target === sysId)) {
      markCared(sysId, meta);
    }
  }

  // ---- 4. Limfatik overload → racun meracuni Pencernaan ----
  if (st.racun >= 70) {
    const seep = cfg.racunToxicSeep;
    st.systems.pencernaan.health = clampHealth(st.systems.pencernaan.health - seep);
    impact.toxicSeep = seep;
  }

  // ---- 5. Milestone makro: semua ≥80 hari ini → streak ----
  const allHealthy = Object.values(st.systems).every((s) => s.health >= cfg.perfectThreshold);
  if (allHealthy) {
    if (st.lastPerfectDay !== today) {
      st.perfectStreak += 1;
      st.lastPerfectDay = today;
    }
  } else {
    st.perfectStreak = 0;
    st.lastPerfectDay = null;
  }
  if (!st.milestoneDone && st.perfectStreak >= cfg.perfectDays) {
    st.milestoneDone = true;
    impact.milestone = 'perfect';
  }
  st.narrativeStage = getNarrativeStage(meta).index;

  meta.bodyState = st;
  writeSave(meta);
  return impact;
}

/** Pulihkan sistem via iklan reward (kondisi kritis) — logic asli + cap. */
export function recoverViaAd(meta = STATE.meta) {
  const cfg = getData().bodySystems;
  const st = getBodyState(meta);
  const criticals = getCriticalSystems(meta);
  if (criticals.length === 0) return null;
  const worst = criticals.sort((a, b) => a.health - b.health)[0];
  const sys = st.systems[worst.def.id];
  const before = sys.health;
  sys.health = clampHealth(sys.health + cfg.recoveryAdGain);
  markCared(worst.def.id, meta);
  meta.bodyState = st;
  writeSave(meta);
  return { systemId: worst.def.id, gained: sys.health - before, name: worst.def.name };
}

/** Suplemen (beli currency / IAP simulasi): +20 sistem, tandai dirawat. */
export function applySuplemen(sysId, meta = STATE.meta) {
  const cfg = getData().bodySystems;
  const st = getBodyState(meta);
  if (!st.systems[sysId]) return null;
  const sys = st.systems[sysId];
  const before = sys.health;
  sys.health = clampHealth(sys.health + cfg.suplemenGain);
  markCared(sysId, meta);
  meta.bodyState = st;
  writeSave(meta);
  return { systemId: sysId, gained: sys.health - before };
}
