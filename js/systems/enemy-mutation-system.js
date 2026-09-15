/**
 * enemy-mutation-system.js — PHAGOS eksperimen: Adaptasi Patogen.
 *
 * Di wave 6/10/14 (atau boss-1), sistem membaca build pemain
 * (run.activeMutations + run.membrane.stats + engulfStats) lalu memilih
 * SATU trait yang meng-counter kelemahan build. Trait diterapkan sebagai
 * MODIFIER pada musuh existing (bukan tipe baru).
 *
 * Sinyal anti-curang: peringatan 5 dtk + label STRAIN BERMUTASI + RIA + tint.
 */

import { getEnemyMutations } from '../core/data-store.js';
import { emit } from '../core/ui-bridge.js';
import { showPresenter } from '../ui/presenter.js';
import { currentStrainId, WEEKLY_STRAIN_CHANCE, WEEKLY_STRAIN_MIN_WAVE } from './weekly-strain-system.js'; // ADDENDUM §3.5

function cfg() {
  try {
    return getEnemyMutations();
  } catch {
    return null;
  }
}

export function mutationWaves() {
  const c = cfg();
  return (c && c.mutationWaves) || [6, 10, 14];
}

/**
 * Pilih trait counter berdasarkan statistik build pemain.
 * PHAGOS iterasi: ACAK di antara semua trigger yang cocok (bukan first-match
 * — dulu wave mutasi hampir selalu trait yang sama karena engulfCount selalu
 * besar), dan hindari trait yang sudah dipakai di wave mutasi sebelumnya
 * agar tiap wave mutasi terasa berbeda.
 */
export function selectCounterTrait(run) {
  const c = cfg();
  if (!c) return null;
  const stats = (run.membrane && run.membrane.stats) || {};
  const traits = c.traits || [];
  // Kumpulkan SEMUA yang cocok (selain fallback acak)
  const matched = traits.filter((tr) =>
    tr.id !== 'acak_bermutasi' && triggerMatches(tr.trigger, stats, run));
  const pool = matched.length > 0
    ? matched
    : traits.filter((t) => t.id === 'acak_bermutasi');
  if (pool.length === 0) return null;
  // Anti-ulang: coret trait yang sudah muncul (bila masih ada pilihan lain)
  const hist = new Set(
    ((run.enemyMutation && run.enemyMutation.history) || []).map((h) => h.trait));
  const fresh = pool.filter((t) => !hist.has(t.id));
  const src = fresh.length > 0 ? fresh : pool;
  return src[Math.floor(Math.random() * src.length)];
}

function triggerMatches(trigger, stats, run) {
  if (!trigger) return false;
  const stat = trigger.stat;
  const th = trigger.threshold ?? 0;
  const cmp = trigger.compare || '>';
  let val = 0;
  switch (stat) {
    case 'totalRadiusMult': val = stats.totalRadiusMult || 1; break;
    case 'contactDpsMult': val = stats.contactDpsMult || 1; break;
    case 'engulfCount': val = stats.engulfCount || 0; break;
    case 'pulseCount': val = stats.pulseCount || 0; break;
    case 'trailUptime': val = stats.trailUptime || 0; break;
    case 'balanced': return false; // fallback
    default: return false;
  }
  void run;
  switch (cmp) {
    case '>': return val > th;
    case '>=': return val >= th;
    case '<': return val < th;
    case '==': return val === th;
    default: return false;
  }
}

/**
 * Dipanggil saat wave BARU dimulai. Menjadwalkan atau mengeksekusi mutasi.
 * - Jika wave+1 adalah wave mutasi → peringatan 5 dtk (flash + teks + RIA teaser).
 * - Jika wave ini adalah wave mutasi → pilih trait + inject ke spawn berikutnya.
 */
export function onNewWave(game, wave) {
  const run = game.run;
  const c = cfg();
  if (!c || !run) return;
  run.enemyMutation = run.enemyMutation || { activeTrait: null, warnedWave: 0, history: [] };
  const waves = mutationWaves();
  if (waves.includes(wave)) {
    const trait = selectCounterTrait(run);
    run.enemyMutation.activeTrait = trait ? trait.id : null;
    run.enemyMutation.history.push({ wave, trait: trait ? trait.id : null });
    if (trait) {
      emit('toast', { message: `STRAIN BERMUTASI: ${traitName(trait)}!`, kind: 'danger' });
      try {
        showPresenter('ria', trait.riaLine || 'Mereka bermutasi! Beradaptasilah!', { duration: 5 });
      } catch { /* presenter belum siap */ }
      run.camera.addShake(0.5);
    }
  } else if (waves.includes(wave + 1) && run.enemyMutation.warnedWave !== wave + 1) {
    // Peringatan dini di wave sebelumnya? Spec: 5 dtk SEBELUM wave mutasi.
    // Karena wave berganti lewat fase clear (tidak pasti 5 dtk), warning juga
    // dipicu dari checkPreWarning tiap frame. Di sini cukup tandai.
    run.enemyMutation.warnedWave = 0; // reset agar checkPreWarning bisa bunyi
  }
}

/**
 * Cek tiap frame: jika wave mutasi akan tiba ~5 dtk lagi (fase waveClearing
 * wave sebelumnya), tampilkan peringatan. Sederhana: saat waveClearing aktif
 * dan wave+1 adalah wave mutasi → warning sekali.
 */
export function checkPreWarning(game) {
  const run = game.run;
  if (!run || !run.spawnSys) return;
  const waves = mutationWaves();
  const next = run.spawnSys.wave + 1;
  if (!waves.includes(next)) return;
  if (!run.spawnSys.waveClearing) return;
  run.enemyMutation = run.enemyMutation || { activeTrait: null, warnedWave: 0, history: [] };
  if (run.enemyMutation.warnedWave === next) return;
  run.enemyMutation.warnedWave = next;
  emit('toast', { message: 'PATOGEN BERMUTASI...', kind: 'danger' });
  // Flash merah arena sesaat
  run._mutationFlashT = 1.2;
  try {
    showPresenter('ria', 'Getaran aneh... mereka BERUBAH! Siap-siap!', { duration: 4 });
  } catch { /* abaikan */ }
}

/**
 * Terapkan trait aktif ke musuh yang baru spawn (peluang 35% per musuh,
 * boss tidak pernah). Dipanggil dari game.spawnEnemy.
 */
export function maybeApplyTrait(run, enemy) {
  if (!run || !enemy || enemy.isBoss) return;
  const traitId = run.enemyMutation && run.enemyMutation.activeTrait;
  if (traitId && Math.random() <= 0.35) {
    applyTraitToEnemy(run, enemy, traitId);
    return;
  }
  // ADDENDUM §3.5 — Strain of the Week: 15% musuh wave 4+ membawa trait
  // mingguan global (hanya yang belum punya trait counter-build).
  try {
    const wave = run.spawnSys ? run.spawnSys.wave : 1;
    if (wave < WEEKLY_STRAIN_MIN_WAVE) return;
    if (enemy.mutTrait) return;
    if (Math.random() > WEEKLY_STRAIN_CHANCE) return;
    applyTraitToEnemy(run, enemy, currentStrainId());
  } catch { /* abaikan */ }
}

export function applyTraitToEnemy(run, enemy, traitId) {
  const c = cfg();
  const trait = c && (c.traits || []).find((t) => t.id === traitId);
  if (!trait) return;
  enemy.mutTrait = traitId;
  enemy.mutLabelT = (c.labelDurationSec || 5);
  enemy.mutTint = trait.tint || '#c39bd3';
  const ap = trait.apply || {};
  if (ap.rangedAttack) {
    // Penembak Asam: pasang shooter jarak jauh + AI jaga jarak
    enemy.armShooter?.();
    if (enemy.shooter) {
      enemy.shooter.range = ap.attackRange || 280;
      enemy.shooter.speed = ap.attackProjectileSpeed || 200;
      enemy.shooter.dmg = Math.max(4, Math.round((ap.attackDps || 15) * 0.5));
      enemy.shooter.holdMin = ap.preferredDistance || 250;
      enemy.shooter.color = '#b6ff3d';
    } else {
      // Behavior non-chase (hazard/boss) tidak bisa armShooter — beri shooter manual
      enemy.shooter = {
        range: ap.attackRange || 280, cd: 1.5, rate: 2.4,
        speed: ap.attackProjectileSpeed || 200,
        dmg: Math.max(4, Math.round((ap.attackDps || 15) * 0.5)),
        radius: 6.5, color: '#b6ff3d', holdMin: ap.preferredDistance || 250,
      };
    }
  }
  if (ap.knockbackImmune) {
    // Ditangani di membrane-system (cek mutTrait) — tidak perlu flag tambahan
  }
  if (ap.randomTrait) {
    // Acak_bermutasi: trait aktif berganti tiap 10 dtk
    enemy.mutActive = randomSubTrait();
    enemy.mutSwapT = ap.swapIntervalSec || 10;
  }
  void run;
}

function randomSubTrait() {
  const pool = ['penembak_asam', 'kebal_membran', 'beracun_saat_diserap', 'kebal_knockback', 'pemurni'];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Update per-frame trait dinamis (acak_bermutasi swap, label timer). */
export function updateEnemyMutations(game, dt) {
  const run = game.run;
  if (!run) return;
  for (const e of run.enemies) {
    if (!e.alive) continue;
    if (e.mutLabelT > 0) e.mutLabelT -= dt;
    if (e.mutTrait === 'acak_bermutasi' && e.mutSwapT !== undefined) {
      e.mutSwapT -= dt;
      if (e.mutSwapT <= 0) {
        e.mutSwapT = 10;
        e.mutActive = randomSubTrait();
        e.mutLabelT = 2;
        run.effects.spawnBurst(e.x, e.y, '#c39bd3', 8, 160, 3);
      }
    }
  }
}

/** Nama display trait dari id (dipakai banner strain mingguan). */
export function traitDisplayName(traitId) {
  return traitName({ id: traitId });
}

function traitName(trait) {
  const names = {
    penembak_asam: 'Penembak Asam',
    kebal_membran: 'Kebal Membran',
    beracun_saat_diserap: 'Beracun Saat Diserap',
    kebal_knockback: 'Kebal Knockback',
    pemurni: 'Pemurni',
    acak_bermutasi: 'Bermutasi Acak',
  };
  return names[trait.id] || trait.id;
}

/** Label di atas musuh bermutasi (dipakai renderer). */
export function mutationLabelFor(enemy) {
  if (!enemy.mutTrait || !(enemy.mutLabelT > 0)) return null;
  const c = cfg();
  return (c && c.spawnLabel) || 'STRAIN BERMUTASI';
}
