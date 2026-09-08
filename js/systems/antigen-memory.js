/**
 * antigen-memory.js — R3 (Rebuild): MODUL A — Antigen Memory.
 *
 * Combat doc §2: build adaptif per-run. Membunuh tipe patogen tertentu
 * berulang → memori antigen tipe itu naik tier → bonus stacking:
 *   T1 +15% dmg · T2 +30% dmg + 10% ignore-armor · T3 +50% dmg + splash kill.
 * Threshold: killsRequired(tier) = round(baseKills × tier^tierExp)
 * (15 / 37 / 63). Lore: RIA — sistem yang menyimpan ingatan musuh (story doc).
 *
 * Semua efek di belakang flag moduleEnabled('antigenMemory'). Telemetry:
 * tier-up dicatat sebagai module_trigger (metrics.js) untuk evaluasi §7.
 */

import { moduleEnabled, moduleConfig } from './module-flags.js';
import { recordModuleTrigger } from './metrics.js';
import { emit } from '../core/ui-bridge.js';

/** Kill dibutuhkan untuk mencapai tier ke-n (1-based). */
export function killsRequired(tier, cfg = moduleConfig('antigenMemory')) {
  return Math.round((cfg.baseKills || 15) * Math.pow(tier, cfg.tierExp || 1.3));
}

/** Inisialisasi state antigen run baru. */
export function initAntigenRun(run) {
  run.antigen = { kills: {}, tiers: {} };
}

/** Tier aktif untuk tipe musuh (0 bila modul mati / belum ada). */
function tierOf(run, typeId) {
  return (run.antigen && run.antigen.tiers[typeId]) || 0;
}

/**
 * Multiplier damage ke musuh berdasarkan memori tipe-nya.
 * Dipanggil di SEMUA jalur damage pemain (proyektil + melee) — 1 titik logika.
 */
export function antigenDamageMult(run, enemy) {
  if (!moduleEnabled('antigenMemory') || !run.antigen || !enemy.def) return 1;
  const t = tierOf(run, enemy.def.id);
  if (t <= 0) return 1;
  const cfg = moduleConfig('antigenMemory');
  return 1 + (cfg.tierDamage[t - 1] || 0);
}

/** T2+: kadang menembus pertahanan (pakai takeDamageRaw). */
export function antigenIgnoreArmor(run, enemy) {
  if (!moduleEnabled('antigenMemory') || !run.antigen || !enemy.def) return false;
  if (tierOf(run, enemy.def.id) < 2) return false;
  const cfg = moduleConfig('antigenMemory');
  return Math.random() < (cfg.ignoreArmorChance || 0.1);
}

/**
 * Hook kill: hitung memori, cek tier-up (toast + telemetry + label),
 * splash T3 di sekitar korban.
 */
export function onAntigenKill(run, enemy, game) {
  if (!moduleEnabled('antigenMemory') || !run.antigen || !enemy.def) return;
  const cfg = moduleConfig('antigenMemory');
  const id = enemy.def.id;
  run.antigen.kills[id] = (run.antigen.kills[id] || 0) + 1;
  const cur = tierOf(run, id);
  emit('antigen', { near: nearestThresholdType(run) }); // HUD chip refresh

  // Tier-up?
  if (cur < (cfg.maxTier || 3) && run.antigen.kills[id] >= killsRequired(cur + 1, cfg)) {
    run.antigen.tiers[id] = cur + 1;
    const name = enemy.def.name || id;
    emit('toast', { message: `MEMORI ANTIGEN: ${name} Tier ${cur + 1}! Damage ke ${name} +${Math.round(cfg.tierDamage[cur] * 100)}%`, kind: 'ria' });
    if (run.effects) run.effects.spawnLabel(enemy.x, enemy.y - enemy.radius - 30, `MEMORI T${cur + 1}!`, '#c39bd3');
    recordModuleTrigger('antigenMemory', { wave: run.spawnSys ? run.spawnSys.wave : 0, tier: cur + 1, type: id });
  }

  // T3: splash kecil setiap kill tipe ini
  if (tierOf(run, id) >= 3 && game) {
    const sp = cfg.splash || { radius: 70, dmgPct: 0.35 };
    const dmg = Math.max(1, (enemy.lastHitDamage || 10) * sp.dmgPct);
    for (const e of run.enemies) {
      if (!e.alive || e === enemy) continue;
      const dx = e.x - enemy.x; const dy = e.y - enemy.y;
      if (dx * dx + dy * dy <= sp.radius * sp.radius) {
        const died = e.takeDamage(dmg);
        if (run.effects) run.effects.spawnLabel(e.x, e.y - e.radius - 14, Math.round(dmg), '#c39bd3');
        if (died) game.onEnemyKilled(e, null);
      }
    }
  }
}

/**
 * Tipe dengan progress terbesar ke tier berikutnya — untuk HUD chip dan
 * syarat kartu upgrade "Memori Antigen" (≥70% = earned, doc §2.3).
 * @returns {{typeId, kills, needed, tier, pct} | null}
 */
export function nearestThresholdType(run) {
  if (!moduleEnabled('antigenMemory') || !run.antigen) return null;
  const cfg = moduleConfig('antigenMemory');
  let best = null;
  for (const [id, kills] of Object.entries(run.antigen.kills)) {
    const tier = tierOf(run, id);
    if (tier >= (cfg.maxTier || 3)) continue;
    const needed = killsRequired(tier + 1, cfg);
    const pct = kills / needed;
    if (!best || pct > best.pct) best = { typeId: id, kills, needed, tier, pct };
  }
  return best;
}

/** Apakah kartu upgrade antigen boleh muncul di roll level-up? */
export function antigenUpgradeAvailable(run) {
  const near = nearestThresholdType(run);
  const cfg = moduleConfig('antigenMemory');
  return !!(near && near.pct >= (cfg.upgradeHintPct || 0.7));
}

/** Ambil kartu upgrade: langsung naikkan tier tipe terdekat threshold. */
export function applyAntigenUpgrade(run) {
  const near = nearestThresholdType(run);
  if (!near) return null;
  run.antigen.tiers[near.typeId] = near.tier + 1;
  recordModuleTrigger('antigenMemory', { wave: run.spawnSys ? run.spawnSys.wave : 0, tier: near.tier + 1, type: near.typeId, via: 'upgrade' });
  return near.typeId;
}

/** Simpan rekor tier tertinggi per tipe ke meta (encounter record, doc §2.3). */
export function recordAntigenMeta(meta, run) {
  if (!run.antigen) return;
  meta.antigenRecords = meta.antigenRecords || {};
  for (const [id, tier] of Object.entries(run.antigen.tiers)) {
    if (tier > (meta.antigenRecords[id] || 0)) meta.antigenRecords[id] = tier;
  }
}
