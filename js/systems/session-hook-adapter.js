/**
 * session-hook-adapter.js — Fase 2.4: adapter pemanggil untuk drop-in
 * `session-hook.js` (ROADMAP §2: G1–G5, G7, G12).
 *
 * Modul murni session-hook.js ditulis terhadap skema data BUILD 54a; repo ini
 * punya skema berbeda. Sesuai brief §2.1 drop-in TIDAK diedit — setiap
 * perbedaan diselesaikan di pemanggil, TANPA migrasi save/data:
 *
 *   G1   heroes.json   unlock = {type:'stat', stat, value}  → unlock.stats = {stat: value}
 *        (unlock type 'imu'/'default' = bukan gerbang statistik → dilepas)
 *   G2   arenas.json   unlock = {type:'<statKey>', value}   → peta datar {statKey: value}
 *        (fromArenaUnlocks mengiterasi Object.entries(arena.unlock) langsung;
 *         type 'default' harus dilepas, bukan diadaptasi, agar tidak jadi baris sampah)
 *   G3   ranks.json    tier.min                             → tier.gp
 *   G4   campaign.json killQuota / organ                    → quota / name
 *   G5   retention-config evolution.stageCost: equity_membran/inti_memori
 *        → id repo equity_membrane/equity_memory_core (kunci meta.evoParts)
 *   G7   DATA.retentionConfig                               → disusun sebagai data.retention
 *   G12  meta.bp                                            → meta.battlepass
 *
 * Semua fungsi murni: tidak menyentuh DOM, tidak memutasi input.
 */

/** G5: id bagian config (BUILD 54a) → id repo (evolutions.json / meta.evoParts). */
export const PART_ALIAS = {
  equity_membran: 'equity_membrane',
  inti_memori: 'equity_memory_core',
};

/** G1: gerbang statistik hero → bentuk yang dibaca fromHeroUnlocks. */
export function adaptHero(hero) {
  const u = hero && hero.unlock;
  if (!u || u.type !== 'stat' || !u.stat || typeof u.value !== 'number') {
    return hero ? { ...hero, unlock: null } : hero; // unlock imu/default: bukan jalur statistik
  }
  return { ...hero, unlock: { stats: { [u.stat]: u.value } } };
}

/** G2: gerbang arena → peta datar {statKey: need} (bukan {stats:{…}} seperti hero). */
export function adaptArena(arena) {
  const u = arena && arena.unlock;
  if (!u || u.type === 'default' || typeof u.value !== 'number') {
    return arena ? { ...arena, unlock: null } : arena;
  }
  return { ...arena, unlock: { [u.type]: u.value } };
}

/** G3: tier pangkat repo memakai `min`; drop-in membaca `gp`. */
export function adaptRankTier(tier) {
  return { ...tier, gp: tier.min };
}

/** G4: bab kampanye repo memakai killQuota/organ; drop-in membaca quota/name. */
export function adaptChapter(ch) {
  return { ...ch, quota: ch.killQuota, name: ch.organ || ch.title || ch.id };
}

/** G5: kunci stageCost config → id bagian repo (total fragmen tidak berubah). */
export function remapStageCost(stageCost) {
  const out = {};
  for (const [partId, need] of Object.entries(stageCost || {})) {
    out[PART_ALIAS[partId] || partId] = need;
  }
  return out;
}

/**
 * G7 + G1–G5: susun parameter `data` untuk buildSessionHook dari DATA repo.
 * `retention` diisi retention-config (bukan retention.json — itu trigger Fase 17).
 */
export function composeHookData(DATA) {
  const heroesRaw = (DATA.heroes && DATA.heroes.heroes) || DATA.heroes || [];
  const arenasRaw = (DATA.arenas && DATA.arenas.arenas) || DATA.arenas || [];
  const ranksRaw = DATA.ranks || {};
  const chaptersRaw = (DATA.campaign && DATA.campaign.chapters) || DATA.campaign || [];
  const rc = DATA.retentionConfig || {};
  const evo = rc.evolution || {};
  return {
    ...DATA,
    heroes: (Array.isArray(heroesRaw) ? heroesRaw : Object.values(heroesRaw)).map(adaptHero),
    arenas: (Array.isArray(arenasRaw) ? arenasRaw : Object.values(arenasRaw)).map(adaptArena),
    ranks: { ...ranksRaw, tiers: (ranksRaw.tiers || []).map(adaptRankTier) },
    campaign: (Array.isArray(chaptersRaw) ? chaptersRaw : Object.values(chaptersRaw)).map(adaptChapter),
    retention: { ...rc, evolution: { ...evo, stageCost: remapStageCost(evo.stageCost) } },
  };
}

/** G12: drop-in membaca meta.battlepass; kunci save repo adalah meta.bp. */
export function composeHookMeta(meta) {
  return { ...meta, battlepass: meta.bp };
}

/** Progres misi repo {def,value,target,claimed} → {id,label,current,target,claimed}. */
export function toHookMissions(progressList) {
  return (progressList || []).map((m) => ({
    id: m.def.id,
    label: m.def.name,
    current: m.value,
    target: m.target,
    claimed: m.claimed,
  }));
}

/**
 * Label evolusi dari drop-in berbunyi "Evolusi — <idBagian>" (id teknis).
 * Ganti dengan nama bagian yang layak tampil dari evolutions.json
 * (mis. equity_membrane → "Modul Membran") — di item maupun di headline.
 */
export function prettifyEvolutionLabels(hook, DATA) {
  if (!hook || !Array.isArray(hook.items)) return hook;
  const parts = (DATA && DATA.evolutions && DATA.evolutions.parts) || [];
  const nameById = new Map(parts.map((p) => [p.id, p.name]));
  let headline = hook.headline;
  const items = hook.items.map((it) => {
    if (it.kind !== 'evolusi_tahap') return it;
    const partId = String(it.id).slice(4); // id = `evo_${partId}`
    const name = nameById.get(partId);
    if (!name) return it;
    const label = it.label.replace(partId, name);
    if (headline && headline.includes(it.label)) headline = headline.replace(it.label, label);
    return { ...it, label };
  });
  return { ...hook, headline, items };
}
