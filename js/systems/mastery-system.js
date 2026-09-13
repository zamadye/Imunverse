/**
 * mastery-system.js — V2 Phase 6: HERO MASTERY.
 *
 * Progres per-hero yang tumbuh HANYA dari memainkan hero itu (tidak bisa
 * dibeli — selaras premium cap 30% & filosofi rank tanpa penalti):
 *   xp = kills×perKill + wave×perWave + victoryBonus (data/mastery.json)
 * 10 level per hero, reward ANTIBODI (soft) per level — RONDE-4: Imun Coin
 * premium hanya dari pembelian & Battle Pass — gelar di level 3/6/9/10.
 *
 * State: meta.heroMastery[heroId] = { xp, level, kills, runs, wins }
 * (lazy init — save lama tanpa field ini aman). Sekaligus menjadi tracker
 * statistik per-hero untuk KPI Phase 11 (win-rate/play-rate per hero).
 */

import { getMastery } from '../core/data-store.js';
import { writeSave } from '../save/save-manager.js';
import { addCurrency } from './economy-system.js';

/** Entry mastery hero (lazy init). */
function entry(meta, heroId) {
  meta.heroMastery = meta.heroMastery || {};
  if (!meta.heroMastery[heroId]) {
    meta.heroMastery[heroId] = { xp: 0, level: 0, kills: 0, runs: 0, wins: 0 };
  }
  return meta.heroMastery[heroId];
}

/** Level untuk total XP (levels[i] = ambang level i+1). */
function levelFor(xp) {
  const levels = getMastery().levels;
  let lvl = 0;
  for (let i = 0; i < levels.length; i++) {
    if (xp >= levels[i]) lvl = i + 1;
  }
  return Math.min(lvl, levels.length);
}

/** Gelar untuk level (null bila belum bergelar). */
export function titleFor(level) {
  const titles = getMastery().titles || {};
  let best = null;
  for (const [lvl, name] of Object.entries(titles)) {
    if (level >= Number(lvl)) best = name;
  }
  return best;
}

/**
 * Tambah XP mastery di akhir run. Reward level otomatis (Imun Coin).
 * @returns {{xp:number, levelsGained:number, level:number, title:string|null, reward:number}}
 */
export function addMasteryXP(meta, heroId, { kills = 0, wave = 0, victory = false } = {}) {
  const cfg = getMastery();
  const f = cfg.xpFormula;
  const gained = Math.max(0, Math.round(kills * f.perKill + wave * f.perWave + (victory ? f.victoryBonus : 0)));
  const m = entry(meta, heroId);
  m.xp += gained;
  m.kills += kills;
  m.runs += 1;
  if (victory) m.wins += 1;
  const newLevel = levelFor(m.xp);
  const levelsGained = Math.max(0, newLevel - m.level);
  let reward = 0;
  if (levelsGained > 0) {
    m.level = newLevel;
    reward = cfg.rewardPerLevel * levelsGained;
    addCurrency(meta, reward); // RONDE-4: mastery menghadiahi Antibodi (soft) — Imun Coin premium hanya via beli & Battle Pass
  }
  writeSave(meta);
  return { xp: gained, levelsGained, level: m.level, title: titleFor(m.level), reward };
}

/**
 * Info mastery untuk UI (hero detail / gameover).
 * @returns {{level:number, title:string|null, xp:number, intoLevel:number,
 *            needed:number, pct:number, kills:number, runs:number, wins:number, maxed:boolean}}
 */
export function masteryInfo(meta, heroId) {
  const m = (meta.heroMastery && meta.heroMastery[heroId]) || { xp: 0, level: 0, kills: 0, runs: 0, wins: 0 };
  const levels = getMastery().levels;
  const level = levelFor(m.xp);
  const maxed = level >= levels.length;
  const floor = level > 0 ? levels[level - 1] : 0;
  const ceil = maxed ? levels[levels.length - 1] : levels[level];
  const span = Math.max(1, ceil - floor);
  return {
    level,
    title: titleFor(level),
    xp: m.xp,
    intoLevel: m.xp - floor,
    needed: span,
    pct: maxed ? 1 : Math.max(0, Math.min(1, (m.xp - floor) / span)),
    kills: m.kills,
    runs: m.runs,
    wins: m.wins,
    maxed,
  };
}
