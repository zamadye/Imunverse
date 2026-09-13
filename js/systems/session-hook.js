/**
 * session-hook.js — Imunverse
 *
 * Layar akhir run saat ini menampilkan hasil lalu dua tombol. Yang hilang
 * adalah alasan untuk menekan MAIN LAGI.
 *
 * Modul ini memindai SELURUH sistem progresi, mencari yang paling dekat
 * selesai, dan menyatakan jaraknya dalam RUN, bukan dalam angka mentah.
 * "Kurang 2 run lagi" bekerja; "148 / 150 kill" tidak, karena pemain tidak
 * tahu berapa kill yang biasanya ia dapat.
 *
 * Integrasi (`gameover-screen.js`, saat merender payload `emit('gameover')`):
 *
 *   import { buildSessionHook } from '../../systems/session-hook.js';
 *   const hook = buildSessionHook({ meta, lastRun, data: DATA, cfg: DATA.retention.sessionHook });
 *   renderHookRows(hook.items);      // tampil DI ATAS tombol Main Lagi
 *
 * Modul murni: membaca meta dan data, tidak memutasi apa pun.
 */

/* ------------------------------------------------------------------ */
/* Laju per run                                                        */
/* ------------------------------------------------------------------ */

/**
 * Laju rata-rata pemain ini, bukan rata-rata teoretis. Memakai riwayat run
 * bila tersedia (ring buffer `metrics.js`), jika tidak jatuh ke rata-rata
 * seumur hidup dari `meta.stats`.
 */
export function computeRunRates(meta, runHistory) {
  const stats = meta.stats || {};
  const runs = Math.max(1, stats.totalRuns || 1);

  if (Array.isArray(runHistory) && runHistory.length >= 3) {
    const recent = runHistory.slice(-20);
    const avg = key => recent.reduce((a, r) => a + (r[key] || 0), 0) / recent.length;
    return {
      kills: Math.max(1, avg('kills')),
      wave: Math.max(1, avg('wave')),
      currency: Math.max(1, avg('currency')),
      bossKills: avg('bossKills'),
      sample: recent.length
    };
  }

  return {
    kills: Math.max(1, (stats.totalKills || 0) / runs),
    wave: Math.max(1, (stats.bestWave || 1) * 0.7),
    currency: Math.max(1, (stats.totalCurrencyEarned || 0) / runs),
    bossKills: (stats.bossKills || 0) / runs,
    sample: 0
  };
}

/** Perkiraan run yang tersisa untuk menutup selisih, minimal 1 bila belum selesai. */
function etaRuns(remaining, perRun) {
  if (remaining <= 0) return 0;
  if (!perRun || perRun <= 0) return Infinity;
  return Math.max(1, Math.ceil(remaining / perRun));
}

function item(id, kind, label, current, target, eta) {
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  return { id, kind, label, current: Math.floor(current), target, pct, etaRuns: eta };
}

/* ------------------------------------------------------------------ */
/* Kandidat per sistem                                                 */
/* ------------------------------------------------------------------ */

/** Misi harian yang sedang berjalan. Progres dihitung mission-system. */
function fromMissions(missionProgress) {
  const out = [];
  for (const m of missionProgress || []) {
    if (m.claimed || m.current >= m.target) continue;
    out.push(item(`misi_${m.id}`, 'misi_harian', m.label, m.current, m.target, 1));
  }
  return out;
}

/** Hero berikutnya yang terbuka dari statistik, bukan dari pembelian. */
function fromHeroUnlocks(meta, heroes, rates) {
  const out = [];
  const stats = meta.stats || {};
  const unlocked = new Set(meta.unlockedHeroes || []);

  for (const hero of Object.values(heroes)) {
    if (!hero || !hero.unlock || unlocked.has(hero.id)) continue;
    const gates = hero.unlock.stats;
    if (!gates) continue;

    for (const [statKey, need] of Object.entries(gates)) {
      const have = stats[statKey] || 0;
      if (have >= need) continue;
      const perRun =
        statKey === 'totalKills' ? rates.kills :
        statKey === 'bossKills' ? rates.bossKills :
        statKey === 'bestWave' ? Math.max(0.5, rates.wave * 0.08) : 1;
      out.push(item(
        `hero_${hero.id}_${statKey}`, 'unlock_hero',
        `Buka ${hero.name}`, have, need, etaRuns(need - have, perRun)
      ));
    }
  }
  return out;
}

/** Arena berikutnya. Gerbangnya statistik nyata, jadi selalu bisa dihitung. */
function fromArenaUnlocks(meta, arenas, rates) {
  const out = [];
  const stats = meta.stats || {};
  for (const arena of Object.values(arenas)) {
    if (!arena || !arena.unlock) continue;
    for (const [statKey, need] of Object.entries(arena.unlock)) {
      const have = stats[statKey] || 0;
      if (have >= need) continue;
      const perRun =
        statKey === 'totalKills' ? rates.kills :
        statKey === 'bossKills' ? rates.bossKills :
        statKey === 'bestWave' ? Math.max(0.5, rates.wave * 0.08) : 1;
      out.push(item(
        `arena_${arena.id}`, 'unlock_arena',
        `Buka Arena ${arena.name}`, have, need, etaRuns(need - have, perRun)
      ));
    }
  }
  return out;
}

/** Level Battle Pass berikutnya. */
function fromBattlePass(meta, bpCfg, retentionBp, rates) {
  const bp = meta.battlepass;
  if (!bp || bp.level >= bpCfg.maxLevel) return [];
  const need = retentionBp.xpNeedFormula.base + retentionBp.xpNeedFormula.perLevel * bp.level;
  const have = bp.xp || 0;
  const perRun = Math.min(
    retentionBp.runXp.perRunCap,
    12 * retentionBp.runXp.heroLevelMult +
    rates.wave * retentionBp.runXp.waveMult +
    rates.kills * retentionBp.runXp.killMult
  );
  return [item('bp_level', 'battlepass_level', `Battle Pass Lv ${bp.level + 1}`, have, need, etaRuns(need - have, perRun))];
}

/** Tier pangkat berikutnya. */
function fromRank(meta, ranks, retentionRank, rates) {
  const gp = (meta.rank && meta.rank.gp) || 0;
  const tiers = ranks.tiers || ranks;
  let next = null;
  for (const t of tiers) {
    if (t.gp > gp && (!next || t.gp < next.gp)) next = t;
  }
  if (!next) return [];
  const perRun =
    rates.wave * retentionRank.gpPerWave +
    rates.kills * retentionRank.gpPerKill +
    rates.bossKills * retentionRank.gpPerBoss;
  return [item('rank_next', 'pangkat_tier', `Pangkat ${next.name}`, gp, next.gp, etaRuns(next.gp - gp, perRun))];
}

/** Level mastery hero yang barusan dimainkan. */
function fromMastery(meta, mastery, heroId, rates) {
  const m = (meta.heroMastery || {})[heroId];
  if (!m) return [];
  const levels = mastery.levels || [];
  const next = levels.find(v => v > (m.xp || 0));
  if (next === undefined) return [];
  const perRun = rates.kills * 2 + rates.wave * 10;
  return [item(`mastery_${heroId}`, 'mastery_level', `Mastery Lv ${(m.level || 0) + 1}`, m.xp || 0, next, etaRuns(next - (m.xp || 0), perRun))];
}

/** Tahap evolusi berikutnya — fragmen yang paling kurang. */
function fromEvolution(meta, retentionEvo, rates) {
  const owned = meta.evoParts || {};
  const cost = retentionEvo.stageCost;
  const fragPerRun =
    rates.kills * retentionEvo.dropChanceNormal +
    Math.max(0, rates.wave - 2) * retentionEvo.dropChanceElite +
    rates.bossKills * retentionEvo.bossGuaranteedParts;

  let worst = null;
  for (const [partId, need] of Object.entries(cost)) {
    const have = owned[partId] || 0;
    if (have >= need) continue;
    if (!worst || need - have < worst.remaining) {
      worst = { partId, have, need, remaining: need - have };
    }
  }
  if (!worst) return [];
  return [item(
    `evo_${worst.partId}`, 'evolusi_tahap',
    `Evolusi — ${worst.partId}`, worst.have, worst.need,
    etaRuns(worst.remaining, Math.max(0.1, fragPerRun / Object.keys(cost).length))
  )];
}

/** Bab yang barusan gagal — jarak ke kuota, dinyatakan dalam run. */
function fromChapter(meta, lastRun, campaign, rates) {
  if (!lastRun || lastRun.victory) return [];
  const chapterId = meta.selectedChapter;
  const ch = campaign[chapterId] ||
    (Array.isArray(campaign) ? campaign.find(c => c.id === chapterId) : null);
  if (!ch || !ch.quota) return [];
  const reached = lastRun.kills || 0;
  if (reached >= ch.quota) return [];
  return [item('bab_quota', 'kuota_bab', `${ch.name}: kuota patogen`, reached, ch.quota, 1)];
}

/* ------------------------------------------------------------------ */
/* Perakitan                                                           */
/* ------------------------------------------------------------------ */

/**
 * @param {Object} p.meta
 * @param {Object} p.lastRun  ringkasan run yang baru selesai ({kills, wave, victory, heroId})
 * @param {Object} p.data     seluruh DATA store (heroes, arenas, ranks, mastery, campaign, battlepass, retention)
 * @param {Object} p.cfg      retention-config.json `sessionHook`
 * @param {Array}  [p.missionProgress] progres misi aktif dari mission-system
 * @param {Array}  [p.runHistory]      ring buffer metrics.js
 * @returns {{headline:string|null, items:Array, rates:Object}}
 */
export function buildSessionHook({ meta, lastRun, data, cfg, missionProgress, runHistory }) {
  const rates = computeRunRates(meta, runHistory);
  const ret = data.retention;

  const candidates = [
    ...fromMissions(missionProgress),
    ...fromHeroUnlocks(meta, data.heroes, rates),
    ...fromArenaUnlocks(meta, data.arenas, rates),
    ...fromBattlePass(meta, data.battlepass, ret.battlePass, rates),
    ...fromChapter(meta, lastRun, data.campaign, rates),
    ...fromRank(meta, data.ranks, ret.rank, rates),
    ...fromMastery(meta, data.mastery, (lastRun && lastRun.heroId) || meta.selectedHero, rates),
    ...fromEvolution(meta, ret.evolution, rates)
  ];

  const priority = new Map(cfg.priority.map((k, i) => [k, i]));

  const eligible = candidates.filter(c =>
    c.etaRuns > 0 &&
    c.etaRuns <= cfg.maxEtaRuns &&
    c.pct >= cfg.minPctToShow
  );

  eligible.sort((a, b) => {
    if (a.etaRuns !== b.etaRuns) return a.etaRuns - b.etaRuns;
    const pa = priority.has(a.kind) ? priority.get(a.kind) : 99;
    const pb = priority.has(b.kind) ? priority.get(b.kind) : 99;
    if (pa !== pb) return pa - pb;
    return b.pct - a.pct;
  });

  // Satu baris per jenis sistem: tiga baris "buka hero" bukan tiga alasan,
  // itu satu alasan yang diulang.
  const seen = new Set();
  const items = [];
  for (const c of eligible) {
    if (seen.has(c.kind)) continue;
    seen.add(c.kind);
    items.push(c);
    if (items.length >= cfg.maxItems) break;
  }

  const top = items[0] || null;
  const headline = top
    ? (top.etaRuns === 1 ? `Satu run lagi: ${top.label}` : `${top.etaRuns} run lagi: ${top.label}`)
    : null;

  return { headline, items, rates };
}
