/**
 * mission-system.js — Misi / achievement: progress dihitung dari statistik
 * meta (totalKills, bestWave, dll.). Reward diberikan otomatis saat stat
 * melewati target; daftar misi & target ada di data/missions.json.
 */

import { getData } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';
import { addCurrency } from './economy-system.js';
import { addImun } from './imun-economy.js';

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
      // Fase 17: reward misi = IMUN COIN (retention trigger 1D)
      addImun(meta, m.reward);
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
function periodKey(kind, now = new Date()) {
  if (kind === 'daily') return `d:${now.toISOString().slice(0, 10)}`;
  const first = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now - first) / 86400000) + first.getDay() + 1) / 7);
  return `w:${now.getFullYear()}-${week}`;
}

function ensureQuestPeriod(meta) {
  meta.questState = meta.questState || { periodKey: null, accepted: {}, claimed: {}, baseline: {} };
  const key = `${periodKey('daily')}|${periodKey('weekly')}`;
  if (meta.questState.periodKey !== key) {
    meta.questState = { periodKey: key, accepted: {}, claimed: {}, baseline: {} };
    writeSave(meta);
  }
  return meta.questState;
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
