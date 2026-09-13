/**
 * mission-system.js — Misi / achievement: progress dihitung dari statistik
 * meta (totalKills, bestWave, dll.). Reward diberikan otomatis saat stat
 * melewati target; daftar misi & target ada di data/missions.json.
 */

import { getData } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';
import { addCurrency } from './economy-system.js';

/** Nilai progress stat; 'unlockedHeroes' = jumlah hero dimiliki (Fase 17). */
function statValue(meta, stat) {
  if (stat === 'unlockedHeroes') return meta.unlockedHeroes.length;
  return meta.stats[stat] || 0;
}

/**
 * Cek semua misi; klaim reward untuk yang baru tercapai.
 * @returns {object[]} daftar misi baru selesai (untuk toast)
 */
export function checkMissions(meta) {
  const completed = [];
  for (const m of getData().missions.missions) {
    if (meta.missionsClaimed.includes(m.id)) continue;
    const value = statValue(meta, m.stat);
    if (value >= m.target) {
      meta.missionsClaimed.push(m.id);
      // RONDE-4 (ekonomi premium ketat): reward misi = ANTIBODI (soft currency).
      // Imun Coin premium hanya dari pembelian & Battle Pass — misi bukan
      // jalur premium lagi.
      addCurrency(meta, m.reward);
      completed.push(m);
    }
  }
  if (completed.length > 0) writeSave(meta); // auto-save setelah reward misi
  return completed;
}

/**
 * Data progress misi untuk UI dashboard.
 * @returns {Array<{def, value:number, target:number, done:boolean, claimed:boolean}>}
 */
const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Periode quest. F8 (keputusan user 2026-09-13): ROLLING 24 jam (harian) /
 * 7 hari (mingguan) — di-anchor ke aktivitas user sendiri, bukan tanggal
 * kalender: "kalau klaim jam 8, jam 8 pula refresh-nya, bebas tiap user."
 * Save lama (schema periodKey) dimigrasikan: siklus di-reset sekali saat
 * update pertama.
 */
function ensureQuestPeriod(meta, now = Date.now()) {
  const st = meta.questState || { accepted: {}, claimed: {}, baseline: {} };
  meta.questState = st;
  let changed = false;
  if (st.periodKey !== undefined) { delete st.periodKey; changed = true; } // migrasi schema lama
  if (typeof st.dailyAnchor !== 'number' || now - st.dailyAnchor >= DAY_MS) {
    st.dailyAnchor = now;
    changed = true;
    for (const q of questDefs('daily')) {
      delete st.accepted[q.id]; delete st.claimed[q.id]; delete st.baseline[q.id];
    }
  }
  if (typeof st.weeklyAnchor !== 'number' || now - st.weeklyAnchor >= WEEK_MS) {
    st.weeklyAnchor = now;
    changed = true;
    for (const q of questDefs('weekly')) {
      delete st.accepted[q.id]; delete st.claimed[q.id]; delete st.baseline[q.id];
    }
  }
  if (changed) writeSave(meta);
  return st;
}

function questDefs(kind) { return (getData().missions && getData().missions[kind]) || []; }
function questValue(meta, q) { return statValue(meta, q.stat); }

/** Daily/weekly quest yang dipilih pemain; reward berupa Antibodi soft currency. */
export function getQuestProgress(meta) {
  const state = ensureQuestPeriod(meta);
  return ['daily', 'weekly'].flatMap((kind) => questDefs(kind).map((def) => {
    const accepted = !!state.accepted[def.id];
    const baseline = state.baseline[def.id] || 0;
    const value = accepted ? Math.max(0, questValue(meta, def) - baseline) : 0;
    return { kind, def, accepted, claimed: !!state.claimed[def.id], value: Math.min(def.target, value), done: value >= def.target };
  }));
}

export function acceptQuest(meta, id) {
  const all = [...questDefs('daily'), ...questDefs('weekly')];
  const def = all.find((q) => q.id === id);
  if (!def) return false;
  const state = ensureQuestPeriod(meta);
  if (state.accepted[id]) return true;
  state.accepted[id] = true;
  state.baseline[id] = questValue(meta, def);
  writeSave(meta);
  return true;
}

export function claimQuest(meta, id) {
  const item = getQuestProgress(meta).find((q) => q.def.id === id);
  if (!item || !item.accepted || item.claimed || !item.done) return 0;
  const state = ensureQuestPeriod(meta);
  state.claimed[id] = true;
  addCurrency(meta, item.def.reward);
  writeSave(meta);
  return item.def.reward;
}

export function getMissionProgressList(meta) {
  return getData().missions.missions.map((m) => {
    const value = statValue(meta, m.stat);
    const claimed = meta.missionsClaimed.includes(m.id);
    return {
      def: m,
      value: Math.min(value, m.target),
      target: m.target,
      done: value >= m.target,
      claimed,
    };
  });
}
