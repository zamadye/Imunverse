/**
 * evolution-system.js — P2: POHON EVOLUSI per hero (BASE → MUT1 → MUT2 → APEX).
 *
 * Menggantikan sistem lama "fragmen diferensiasi" (parts drop dari musuh +
 * meta.evoStage). Di V2, evolusi adalah JANTUNG PROGRESI RUN: tahap hero
 * dihitung dari MUTASI YANG AKTIF se-run, bukan dari koleksi meta.
 *
 * Aturan (semua di data/evolutions.json):
 *   BASE (0 mutasi) → MUT1 (≥1) → MUT2 (≥3) → APEX (≥5 mutasi DAN ≥2 mutasi
 *   KHAS hero). Mutasi khas = mutasi yang blok `attack`-nya menyentuh
 *   archetype hero (menimpa payload[archetype] atau mengubah bentuknya lewat
 *   archetypeFrom) — jadi pohon tiap hero berbeda karena cara bertempurnya
 *   berbeda.
 *
 * Yang dipakai game.js: run.evoStage (warna kill-FX, statMult, sprite bentuk)
 * dan evoProgress() untuk HUD/modal.
 */

import { getData } from '../core/data-store.js';

function evo() {
  return (getData() && getData().evolutions) || null;
}

function stages() {
  const e = evo();
  return (e && e.stages) || [];
}

/** Definisi mutasi (untuk menghitung mutasi khas). */
function mutDefs() {
  return (getData() && getData().mutations && getData().mutations.mutations) || [];
}

/** Archetype hero yang sedang dipakai (sumber: identity dari P1). */
function archetypeOf(run, heroDef) {
  const hd = heroDef || (run && run.heroDef) || null;
  return (hd && hd.identity && hd.identity.attackArchetype) || null;
}

/**
 * Daftar id mutasi khas hero: blok `attack` mutasi menyentuh archetype hero.
 * Dipakai syarat APEX — jadi APEX tiap hero beda jalurnya.
 */
export function signatureMutations(heroDef) {
  const e = evo();
  const hd = heroDef || null;
  if (hd && e && e.heroes && e.heroes[hd.id] && Array.isArray(e.heroes[hd.id].signature)) {
    return e.heroes[hd.id].signature.slice();
  }
  // Hitung dari data bila belum tertulis di file (fallback deterministik).
  const arch = archetypeOf(null, hd);
  if (!arch) return [];
  return mutDefs()
    .filter((m) => {
      const a = m.attack || {};
      return !!(a.payload && a.payload[arch]) || !!(a.archetypeFrom && a.archetypeFrom[arch]);
    })
    .map((m) => m.id);
}

/** Jumlah mutasi aktif & jumlah mutasi khas yang sudah diambil. */
export function evoCounts(run, heroDef) {
  const active = (run && run.activeMutations) || [];
  const sig = new Set(signatureMutations(heroDef || (run && run.heroDef)));
  let khas = 0;
  for (const id of active) if (sig.has(id)) khas += 1;
  return { total: active.length, signature: khas, signatureIds: [...sig] };
}

/**
 * Tahap evolusi run sekarang.
 * @returns {object} def tahap + `index` (0..3)
 */
export function evoStageFor(run, heroDef) {
  const list = stages();
  const base = list[0] || { id: 'base', name: 'BASE', tierColor: '#9db1a8', killFx: 'ring', statMult: { maxHP: 1, damage: 1, speed: 1 }, spriteKey: 'spriteIdle' };
  if (!run) return { ...base, index: 0 };
  const hd = heroDef || run.heroDef || null;
  const c = evoCounts(run, hd);
  const e = evo() || {};
  const rule = e.apexRule || { minMutations: 5, minSignature: 2 };
  let picked = base;
  let idx = 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (c.total < (s.minMutations || 0)) break;
    // APEX (dan tahap apa pun bertanda apex) butuh mutasi khas yang cukup.
    if (s.id === 'apex' && c.signature < (rule.minSignature || 2)) break;
    if (s.id === 'apex' && c.total < (rule.minMutations || 5)) break;
    picked = s; idx = i;
  }
  return { ...picked, index: idx, mutations: c.total, signature: c.signature };
}

/** Kompatibilitas nama lama: dipanggil game.js dengan run (dulu meta). */
export function getEvoStageDef(run, heroDef) {
  return evoStageFor(run, heroDef);
}

/** Apakah run sudah mencapai APEX? */
export function isApex(run, heroDef) {
  return (evoStageFor(run, heroDef).id || '') === 'apex';
}

/** Sprite bentuk hero sesuai tahap evolusi (FOTO karakter, bukan overlay). */
export function evoSprite(run, heroDef) {
  const hd = heroDef || (run && run.heroDef) || null;
  if (!hd) return null;
  const st = evoStageFor(run, hd);
  const key = st.spriteKey || 'spriteIdle';
  return hd[key] || hd.spriteMut2Idle || hd.spriteMut1Idle || hd.spriteIdle || hd.sprite || null;
}

/**
 * Kemajuan menuju tahap berikutnya — dipakai HUD & modal mutasi supaya
 * pemain tahu apa yang sedang dia kejar.
 */
export function evoProgress(run, heroDef) {
  const list = stages();
  const st = evoStageFor(run, heroDef);
  const c = evoCounts(run, heroDef || (run && run.heroDef));
  const next = list[st.index + 1] || null;
  return {
    id: st.id,
    name: st.name,
    index: st.index,
    tierColor: st.tierColor,
    mutations: c.total,
    signature: c.signature,
    signatureIds: c.signatureIds,
    next: next ? { id: next.id, name: next.name, needMutations: next.minMutations || 0 } : null,
    needMutations: next ? Math.max(0, (next.minMutations || 0) - c.total) : 0,
    needSignature: next && next.id === 'apex'
      ? Math.max(0, ((evo() && evo().apexRule && evo().apexRule.minSignature) || 2) - c.signature)
      : 0,
  };
}

/** Pengali stat dari tahap evolusi (dipakai recomputePlayerStats). */
export function evoStatMult(run, heroDef) {
  const st = evoStageFor(run, heroDef);
  const m = st.statMult || {};
  return {
    maxHP: typeof m.maxHP === 'number' ? m.maxHP : 1,
    damage: typeof m.damage === 'number' ? m.damage : 1,
    speed: typeof m.speed === 'number' ? m.speed : 1,
  };
}
