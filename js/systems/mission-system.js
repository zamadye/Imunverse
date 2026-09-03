/**
 * mission-system.js — Misi / achievement: progress dihitung dari statistik
 * meta (totalKills, bestWave, dll.). Reward diberikan otomatis saat stat
 * melewati target; daftar misi & target ada di data/missions.json.
 */

import { getData } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';
import { addCurrency } from './economy-system.js';

/**
 * Cek semua misi; klaim reward untuk yang baru tercapai.
 * @returns {object[]} daftar misi baru selesai (untuk toast)
 */
export function checkMissions(meta) {
  const completed = [];
  for (const m of getData().missions.missions) {
    if (meta.missionsClaimed.includes(m.id)) continue;
    const value = meta.stats[m.stat] || 0;
    if (value >= m.target) {
      meta.missionsClaimed.push(m.id);
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
export function getMissionProgressList(meta) {
  return getData().missions.missions.map((m) => {
    const value = meta.stats[m.stat] || 0;
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
