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
