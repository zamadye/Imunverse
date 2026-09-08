/**
 * battlepass-system.js — BATTLE PASS (Fase 14, mesin retensi Pilar 2).
 *
 * Jalur gratis terbuka untuk semua; jalur premium dibuka dengan Imun Coin.
 * XP diperoleh dari bermain (akhir run). Total Imun jalur premium > harga
 * pass → pass "membayar dirinya" untuk musim berikutnya (self-sustaining).
 */

import { getData } from '../core/data-store.js';
import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { addImun, ownsCosmetic } from './imun-economy.js';

/** Pastikan struktur BP ada & musim sesuai. */
export function ensureBp(meta) {
  const cfg = getData().battlepass;
  if (!meta.bp || meta.bp.season !== cfg.season) {
    meta.bp = { season: cfg.season, xp: 0, level: 1, premium: false, claimedFree: [], claimedPrem: [] };
  }
  return meta.bp;
}

export function xpNeed(level) {
  const { base, step } = getData().battlepass.xpNeed;
  return base + step * level;
}

/**
 * Tambah XP BP (dipanggil di akhir run). @returns {{levels:int, from:int, to:int}}
 */
export function addBpXP(meta, amount) {
  const bp = ensureBp(meta);
  const cfg = getData().battlepass;
  const from = bp.level;
  bp.xp += amount;
  let levels = 0;
  while (bp.level < cfg.maxLevel && bp.xp >= xpNeed(bp.level)) {
    bp.xp -= xpNeed(bp.level);
    bp.level += 1;
    levels += 1;
  }
  if (bp.level >= cfg.maxLevel) bp.xp = Math.min(bp.xp, xpNeed(cfg.maxLevel));
  writeSave(meta);
  return { levels, from, to: bp.level };
}

export function isPremium(bpOrMeta) {
  const bp = bpOrMeta?.season !== undefined ? bpOrMeta : ensureBp(bpOrMeta);
  return !!bp.premium;
}

/** Beli jalur premium dengan Imun Coin. */
export function buyPremiumPass(meta) {
  const cfg = getData().battlepass;
  const bp = ensureBp(meta);
  if (bp.premium) return { ok: false, error: 'Premium sudah aktif' };
  if ((meta.imun || 0) < cfg.premiumCostImun) return { ok: false, error: 'Imun Coin tidak cukup' };
  meta.imun -= cfg.premiumCostImun;
  bp.premium = true;
  writeSave(meta);
  return { ok: true };
}

function rewardLabel(rw) {
  switch (rw.type) {
    case 'currency': return `+${rw.n} antibodi`;
    case 'imun': return `+${rw.n} Imun`;
    case 'consumable': return `${rw.n}× ${rw.id.replace(/_/g, ' ')}`;
    case 'part': return `+${rw.n} ${rw.id.replace(/_/g, ' ')}`;
    default: return cosmeticName(rw.id) || rw.id;
  }
}

function cosmeticName(id) {
  const cfg = getData().cosmetics;
  return [...cfg.skins, ...cfg.accs].find((c) => c.id === id)?.name || null;
}

function cosmeticIcon(id) {
  const cfg = getData().cosmetics;
  const skin = cfg.skins.find((s) => s.id === id);
  if (skin) return 'assets/sprites/deco_star_pop.png';
  const acc = cfg.accs.find((a) => a.id === id);
  if (acc) return acc.kind === 'crown' ? 'assets/sprites/deco_chest.png' : 'assets/sprites/deco_aura.png';
  return 'assets/sprites/deco_star_pop.png';
}

/** Reward siap diklaim? (level tercapai, jalur sesuai, belum diklaim) */
export function canClaim(meta, track, lv) {
  const bp = ensureBp(meta);
  if (bp.level < lv) return false;
  if (track === 'prem' && !bp.premium) return false;
  const list = track === 'free' ? bp.claimedFree : bp.claimedPrem;
  return !list.includes(lv);
}

/** Klaim satu reward. @returns {{ok, reward?, label?, error?}} */
export function claimReward(meta, track, lv) {
  const cfg = getData().battlepass;
  const bp = ensureBp(meta);
  if (!canClaim(meta, track, lv)) return { ok: false, error: 'Belum bisa diklaim' };
  const rw = (track === 'free' ? cfg.free : cfg.premium).find((r) => r.lv === lv);
  if (!rw) return { ok: false, error: 'Reward tidak ada' };
  const granted = grantReward(meta, rw);
  (track === 'free' ? bp.claimedFree : bp.claimedPrem).push(lv);
  writeSave(meta);
  return { ok: true, reward: rw, label: granted };
}

/** Terapkan isi reward ke meta. @returns {string} label hasil. */
export function grantReward(meta, rw) {
  switch (rw.type) {
    case 'currency':
      meta.currency += rw.n;
      return `+${rw.n} antibodi`;
    case 'imun':
      addImun(meta, rw.n);
      return `+${rw.n} Imun Coin`;
    case 'consumable':
      meta.consumables[rw.id] = (meta.consumables[rw.id] || 0) + rw.n;
      return `${rw.n}× ${rw.id.replace(/_/g, ' ')}`;
    case 'part':
      meta.evoParts[rw.id] = (meta.evoParts[rw.id] || 0) + rw.n;
      return `+${rw.n} ${rw.id.replace(/_/g, ' ')}`;
    case 'skin':
    case 'acc':
      if (!ownsCosmetic(meta, rw.id)) {
        meta.cosmetics = meta.cosmetics || { owned: [], skin: {}, crown: null, aura: null };
        meta.cosmetics.owned.push(rw.id);
      }
      return cosmeticName(rw.id);
    case 'title':
      meta.premiumTitle = rw.id;
      return `Gelar "${rw.id}"`;
    default:
      return rewardLabel(rw);
  }
}

export { rewardLabel, cosmeticName, cosmeticIcon };

/** Data siap-render untuk layar BP. */
export function getTrackData(meta, track) {
  const cfg = getData().battlepass;
  const bp = ensureBp(meta);
  const claimed = track === 'free' ? bp.claimedFree : bp.claimedPrem;
  return (track === 'free' ? cfg.free : cfg.premium).map((rw) => ({
    ...rw,
    label: rewardLabel(rw),
    claimed: claimed.includes(rw.lv),
    claimable: canClaim(meta, track, rw.lv),
    premiumLocked: track === 'prem' && !bp.premium,
  }));
}
