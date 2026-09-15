/**
 * membrane-system.js — PHAGOS eksperimen: medan membran + PULSE + engulf.
 *
 * Kata kerja inti baru:
 *  - Kontak = damage (pasif, tick 0.1 dtk, selalu aktif saat bergerak ke musuh)
 *  - PULSE = ledakan medan (satu tombol, expand-shrink 0.4 dtk)
 *  - Engulf = fagositosis otomatis (<15% HP di dalam medan → serap, heal + Bio-Point)
 *
 * Modul ini sengaja standalone: menerima `game` (untuk onEnemyKilled,
 * spawnHitFeedback, fireSkillTrigger, damagePlayer hooks) dan `run`.
 * D3: SEMUA damage hero di sini INSTAN (tanpa proyektil pemain).
 * Tidak menyentuh wave/spawner/ekonomi/save.
 */

import { getData, getMembrane, getGameFeel, getMutations } from '../core/data-store.js';
import {
  passiveCritBonus, modifyOutgoingDamage, passiveOnHit,
} from './passive-system.js';
import { antigenDamageMult, antigenIgnoreArmor } from './antigen-memory.js';
import { tagOnHit } from './tag-cascade.js';
import { audio } from './audio-system.js';
import { buzz } from './haptics.js';

// ---------------------------------------------------------------------
// INIT & STATS
// ---------------------------------------------------------------------

/**
 * Inisialisasi state membran run. Dipanggil dari game.startRun.
 */
export function initMembrane(run, heroDef) {
  const cfg = safeMembraneConfig();
  const m = heroDef.membrane || {};
  run.membrane = {
    shape: m.shape || 'circle',
    // Base dari hero; efektif dihitung tiap frame via getMembraneStats
    // Mastia: baseRadius 0 = tak ada medan pasif (?? agar 0 selamat — || akan jatuh ke fallback!).
    baseRadius: m.baseRadius ?? Math.round((heroDef.baseStats?.radius || 15) * 3.2),
    baseContactDps: m.contactDps || cfg.contactDpsBase || 8, // PHAGOS Sprint 1: hero menang (D10), 8 = fallback bible §2.1
    basePulseCooldown: m.pulseCooldown || 2.0,
    engulfSpecial: m.engulfSpecial || null,
    shapeParams: m.shapeParams || {},
    // Runtime
    pulseCdLeft: 0,
    pulseAnimT: -1, // >=0 saat animasi pulse berjalan (0..duration)
    pulseDidHit: false,
    contactTickT: 0,
    autoPulseT: m.shape === 'pulse_only' ? 0 : 4.0,
    trail: [], // {x,y,t,life,dps}
    satellites: [], // simbiosis {angle,dist,t,dps,radius}
    pendingWaves: [], // nova gelombang kedua {t, pull}
    activeContacts: 0,
    lastPulseWasAuto: false,
    // Living membrane (medan_hidup)
    livingHp: 0,
    livingMaxHp: 0,
    livingDownT: 0,
    // Metamorfosis (evolusi_total)
    metaActiveT: 0,
    metaRootT: 0,
    metaCdLeft: 0,
    // Nyx invisible accumulation {uid: dmg}
    nyxAccum: new Map(),
    // Bella antibodies stacking
    bellaBonusRate: 0,
    bellaAntibodyT: 0,
    // Mastia armor stacks
    mastiaArmorStacks: 0,
    // Helia squad buff
    heliaBuffT: 0,
    // Treg immunity
    tregImmuneT: 0,
    // Eos/Baso clouds
    clouds: [], // {x,y,r,t,life,dps}
    // Dendri sweep
    sweepT: -1,
    // T-Bolt dash
    dashT: 0,
    dashAngle: 0,
    // Nyx vanish + teleportasi (timer frame)
    vanishT: 0,
    nyxTeleport: null,
    nyxTeleportT: 0,
    // Adaptive (adaptif mutation) cached bonus
    adaptiveBonus: null,
    // Stats untuk trigger mutasi musuh
    stats: {
      totalRadiusMult: 1,
      contactDpsMult: 1,
      engulfCount: 0,
      pulseCount: 0,
      trailUptime: 0,
    },
    // Visual pulse peak (0..1) untuk renderer
    pulsePeak: 0,
    currentRadius: 0,
  };
  void cfg;
  return run.membrane;
}

function safeMembraneConfig() {
  try {
    return getMembrane();
  } catch {
    return null;
  }
}

function membraneCfg() {
  const m = safeMembraneConfig();
  return (m && m.defaults) || {
    contactTickSec: 0.1, maxContactTargets: 12,
    pulseRadiusMult: 3.0, pulseDurationSec: 0.4,
    pulseExpandSec: 0.15, pulseHoldSec: 0.1, pulseShrinkSec: 0.15,
    pulseDamageMult: 4.0,
    engulfThreshold: 0.15, engulfHealPct: 0.02, bioPointPerEngulf: 1,
  };
}

/**
 * Agregasi efek mutasi aktif menjadi multiplier tunggal.
 * @returns {object} {radiusMult, contactDmgMult, pulseRadiusMult, pulseCooldownMult, ...flags}
 */
export function aggregateMutationEffects(run) {
  const out = {
    radiusMult: 1, contactDmgMult: 1,
    pulseRadiusMult: 1, pulseCooldownMult: 1,
    engulfThreshold: null, engulfHealMult: 1,
    knockbackOnContact: false, knockbackForce: 0,
    contactSlowPct: 0, pullToCenter: 0,
    trailPoison: false, trailDpsMult: 0.4, trailDurationSec: 1.5,
    pulsePull: false, pulseCenterDmgMult: 1,
    dualRing: false, innerRadiusMult: 0.8, innerDmgMult: 1.6,
    outerRadiusMult: 1.5, outerDmgMult: 0.4, outerSlowPct: 0.3,
    engulfExplode: false, engulfExplodeMult: 2, engulfExplodeRadius: 90,
    autoPulse: false, autoPulseIntervalSec: 4, autoPulseDmgMult: 0.6,
    regenWhenClearPct: 0, reflectPct: 0,
    doubleWave: false, secondWaveDelaySec: 0.3, secondWavePull: true,
    engulfSatellite: false, maxSatellites: 3, satelliteDurationSec: 8, satelliteDpsMult: 0.8,
    metamorphosis: false, metaRadiusMult: 2.5, metaRootSec: 3, metaCooldownSec: 30,
    metaEngulfThreshold: 0.3, metaDmgMult: 6,
    chainOnKill: false, chainRadiusMult: 0.5, chainDmgMult: 0.3, chainMax: 5,
    adaptive: false, livingMembrane: false, membraneHpPct: 0.5, membraneDownSec: 5,
  };
  const acts = (run && run.activeMutations) || [];
  for (const id of acts) {
    const def = getMutationDef(id);
    if (!def || !def.effects) continue;
    const e = def.effects;
    if (e.radiusMult) out.radiusMult *= e.radiusMult;
    if (e.contactDmgMult) out.contactDmgMult *= e.contactDmgMult;
    if (e.pulseRadiusMult) out.pulseRadiusMult *= e.pulseRadiusMult;
    if (e.pulseCooldownMult) out.pulseCooldownMult *= e.pulseCooldownMult;
    if (e.engulfThreshold) out.engulfThreshold = Math.max(out.engulfThreshold || 0, e.engulfThreshold);
    if (e.engulfHealMult) out.engulfHealMult *= e.engulfHealMult;
    if (e.knockbackOnContact) { out.knockbackOnContact = true; out.knockbackForce = Math.max(out.knockbackForce, e.knockbackForce || 150); }
    if (e.contactSlowPct) out.contactSlowPct = Math.max(out.contactSlowPct, e.contactSlowPct);
    if (e.pullToCenter) out.pullToCenter = Math.max(out.pullToCenter, e.pullToCenter);
    if (e.trailPoison) out.trailPoison = true;
    if (e.trailDpsMult) out.trailDpsMult = e.trailDpsMult;
    if (e.trailDurationSec) out.trailDurationSec = e.trailDurationSec;
    if (e.pulsePull) out.pulsePull = true;
    if (e.pulseCenterDmgMult) out.pulseCenterDmgMult = Math.max(out.pulseCenterDmgMult, e.pulseCenterDmgMult);
    if (e.dualRing) {
      out.dualRing = true;
      out.innerRadiusMult = e.innerRadiusMult || out.innerRadiusMult;
      out.innerDmgMult = e.innerDmgMult || out.innerDmgMult;
      out.outerRadiusMult = e.outerRadiusMult || out.outerRadiusMult;
      out.outerDmgMult = e.outerDmgMult || out.outerDmgMult;
      out.outerSlowPct = e.outerSlowPct || out.outerSlowPct;
    }
    if (e.engulfExplode) { out.engulfExplode = true; out.engulfExplodeMult = e.engulfExplodeMult || 2; out.engulfExplodeRadius = e.engulfExplodeRadius || 90; }
    if (e.autoPulse) { out.autoPulse = true; out.autoPulseIntervalSec = e.autoPulseIntervalSec || 4; out.autoPulseDmgMult = e.autoPulseDmgMult || 0.6; }
    if (e.regenWhenClearPct) out.regenWhenClearPct = Math.max(out.regenWhenClearPct, e.regenWhenClearPct);
    if (e.reflectPct) out.reflectPct = Math.max(out.reflectPct, e.reflectPct);
    if (e.doubleWave) { out.doubleWave = true; out.secondWaveDelaySec = e.secondWaveDelaySec || 0.3; out.secondWavePull = e.secondWavePull !== false; }
    if (e.engulfSatellite) { out.engulfSatellite = true; out.maxSatellites = e.maxSatellites || 3; out.satelliteDurationSec = e.satelliteDurationSec || 8; out.satelliteDpsMult = e.satelliteDpsMult || 0.8; }
    if (e.metamorphosis) {
      out.metamorphosis = true;
      out.metaRadiusMult = e.metaRadiusMult || 2.5; out.metaRootSec = e.metaRootSec || 3;
      out.metaCooldownSec = e.metaCooldownSec || 30; out.metaEngulfThreshold = e.metaEngulfThreshold || 0.3;
      out.metaDmgMult = e.metaDmgMult || 6;
    }
    if (e.chainOnKill) { out.chainOnKill = true; out.chainRadiusMult = e.chainRadiusMult || 0.5; out.chainDmgMult = e.chainDmgMult || 0.3; out.chainMax = e.chainMax || 5; }
    if (e.adaptive) out.adaptive = true;
    if (e.livingMembrane) { out.livingMembrane = true; out.membraneHpPct = e.membraneHpPct || 0.5; out.membraneDownSec = e.membraneDownSec || 5; }
  }
  return out;
}

function getMutationDef(id) {
  try {
    const list = getMutations()?.mutations || [];
    return list.find((m) => m.id === id) || null;
  } catch {
    return null;
  }
}

/**
 * Statistik membran efektif saat ini (radius, dps, pulse, engulf).
 * DPS diskalakan dari stats.damage agar upgrade/squad/serum tetap bermakna:
 *   scale = stats.damage / base.damage
 */
export function getMembraneStats(run) {
  const mem = run.membrane;
  const player = run.player;
  const heroDef = run.heroDef;
  const cfg = membraneCfg();
  const fx = aggregateMutationEffects(run);
  // PHAGOS safety net (bible §4.1): Enzim Lisosom +20% kontak, Sinyal
  // Kalsium −15% cooldown Pulse, Pseudopodia +15% heal engulf (per stack).
  const safety = run.upgrades || {};
  const contactSafety = 1 + (safety.contact_boost || 0) * 0.20;
  const pulseSafety = Math.pow(0.85, safety.pulse_boost || 0);
  const engulfSafety = 1 + (safety.engulf_boost || 0) * 0.15;
  const baseDmg = heroDef?.baseStats?.damage || 10;
  const curDmg = player?.stats?.damage || baseDmg;
  const scale = baseDmg > 0 ? curDmg / baseDmg : 1;

  // Sprint 3.19: level hero memperbesar membran (+1,5%/lv — roadmap "scaling membran").
  const heroCfg = (getData().upgrades && getData().upgrades.heroUpgrade) || {};
  const heroLvl = run.heroLvl || 0;
  let radius = mem.baseRadius * fx.radiusMult * (1 + (heroCfg.membranePerLevel || 0) * heroLvl);
  // Baso: radius berdenyut 0.7–1.3× per 2 dtk
  if (mem.shape === 'pulsing') {
    const t = run.time || 0;
    const period = mem.shapeParams?.periodSec || 2.0;
    const osc = 0.5 - 0.5 * Math.cos((t / period) * Math.PI * 2);
    radius *= 0.7 + 0.6 * osc;
  }
  // Metamorfosis aktif: radius membesar drastis
  if (mem.metaActiveT > 0) radius *= fx.metaRadiusMult;

  let contactDps = mem.baseContactDps * fx.contactDmgMult * scale * contactSafety;
  // Helia support: damage rendah
  if (mem.shape === 'support') contactDps *= 0.45;
  // Mastia pulse_only: tidak ada kontak pasif
  if (mem.shape === 'pulse_only') contactDps = 0;
  // Living membrane down: tidak ada medan
  if (mem.livingDownT > 0) contactDps = 0;

  // Adaptive bonus (dihitung dari engulfStats dominan)
  const adapt = computeAdaptiveBonus(run, fx);
  if (adapt) {
    if (adapt.damageMult) contactDps *= adapt.damageMult;
    if (adapt.radiusMult) radius *= adapt.radiusMult;
  }
  // ADDENDUM §2 — item: Enzim Litik contact ×2; Membran Cadangan = medan
  // kedua 0,5× radius & 50% DPS ≈ total contact ×1,5 (+ visual cincin kedua)
  const ibuf = run.itemBuffs || {};
  const itime = run.time || 0;
  if (itime < (ibuf.enzimUntil || 0)) contactDps *= 2;
  if (itime < (ibuf.cadanganUntil || 0)) contactDps *= 1.5;

  const heroMem = run.heroDef?.membrane || {};
  const pulseCooldown = mem.basePulseCooldown * fx.pulseCooldownMult * pulseSafety;
  // Mastia (pulse_only): radius kontak 0, tapi pulse punya basis sendiri
  const pulseBase = mem.shape === 'pulse_only'
    ? (heroMem.shapeParams?.pulseBaseRadius || 64) * fx.radiusMult
    : radius;
  const pulseRadius = pulseBase * (heroMem.pulseRadiusMult || cfg.pulseRadiusMult || 3) * fx.pulseRadiusMult;
  const pulseDamage = (mem.shape === 'pulse_only'
    ? mem.baseContactDps * scale * (cfg.pulseDamageMult || 4)
    : contactDps * (cfg.pulseDamageMult || 4));
  let engulfThreshold = fx.engulfThreshold || (run.heroDef?.membrane?.engulfThreshold) || cfg.engulfThreshold || 0.15;
  if (itime < (ibuf.enzimUntil || 0)) engulfThreshold = 0.30; // ADDENDUM §2: Enzim Litik
  const engulfHealPct = ((run.heroDef?.membrane?.engulfHealPct) ?? cfg.engulfHealPct ?? 0.02) * fx.engulfHealMult * engulfSafety;

  // Simpan untuk trigger mutasi musuh + HUD
  mem.stats.totalRadiusMult = fx.radiusMult * (mem.metaActiveT > 0 ? fx.metaRadiusMult : 1);
  mem.stats.contactDpsMult = fx.contactDmgMult;
  mem.currentRadius = radius;

  return {
    radius, contactDps, pulseCooldown, pulseRadius, pulseDamage,
    engulfThreshold, engulfHealPct, fx, scale, adaptive: adapt,
  };
}

function computeAdaptiveBonus(run, fx) {
  if (!fx.adaptive) return null;
  const st = run.engulfStats || {};
  let best = null; let bestN = 0;
  for (const [k, v] of Object.entries(st)) {
    if (v > bestN) { bestN = v; best = k; }
  }
  if (!best || bestN <= 0) return null;
  // bakteri→+damage, virus→+speed, parasit→+radius, spora→+armor, kanker→+heal
  if (best === 'bakteri') return { kind: 'bakteri', damageMult: 1.35, color: '#ff6b6b' };
  if (best === 'virus') return { kind: 'virus', speedMult: 1.25, color: '#9be15d' };
  if (best === 'parasit') return { kind: 'parasit', radiusMult: 1.3, color: '#e15fd0' };
  if (best === 'spora') return { kind: 'spora', armorMult: 0.8, color: '#f2c14e' };
  if (best === 'kanker') return { kind: 'kanker', healMult: 1.5, color: '#d7263d' };
  return null;
}

/** Kelompok adaptif dari definisi musuh. */
export function engulfFamilyOf(enemy) {
  const id = enemy?.def?.id || '';
  if (id.includes('bakteri')) return 'bakteri';
  if (id === 'virus' || id === 'virion') return 'virus';
  if (id === 'parasit' || id === 'protozoa') return 'parasit';
  if (id === 'spora') return 'spora';
  if (id.includes('kanker') || id.includes('toksin') || id.includes('abnormal') || id.includes('prion')) return 'kanker';
  return 'bakteri';
}

// ---------------------------------------------------------------------
// SHAPE TESTS
// ---------------------------------------------------------------------

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/**
 * Apakah musuh berada di dalam medan? Mengembalikan {inside, ring}
 * ring: 'inner'|'outer'|'main' (untuk dual-ring).
 */
export function membraneContains(run, enemy, radiusOverride = null) {
  const mem = run.membrane;
  const player = run.player;
  if (!mem || !player || !player.alive) return { inside: false, ring: null };
  if (mem.shape === 'pulse_only') return { inside: false, ring: null };
  if (mem.livingDownT > 0) return { inside: false, ring: null };
  if (mem.vanishT > 0 && mem.shape === 'invisible') {
    // Nyx menghilang: medan ikut menghilang sesaat? Tidak — medan tetap aktif.
  }
  const st = getMembraneStats(run);
  const fx = st.fx;
  const R = radiusOverride ?? st.radius;
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const dist = Math.hypot(dx, dy);
  const er = (enemy.radius || 12) * 0.5;

  // Dual ring: inner lingkaran kecil, outer lingkaran besar
  if (fx.dualRing) {
    const inner = R * fx.innerRadiusMult;
    const outer = R * fx.outerRadiusMult;
    if (dist < inner + er) return { inside: true, ring: 'inner' };
    if (dist < outer + er) return { inside: true, ring: 'outer' };
    return { inside: false, ring: null };
  }

  switch (mem.shape) {
    case 'circle':
    case 'support':
    case 'invisible':
    case 'pulsing':
    default: {
      return dist < R + er ? { inside: true, ring: 'main' } : { inside: false, ring: null };
    }
    case 'cone': {
      const arc = (mem.shapeParams?.arcDeg ?? 90) * Math.PI / 180;
      const range = R * (mem.shapeParams?.rangeMult ?? 1.6);
      if (dist > range + er) return { inside: false, ring: null };
      const ang = Math.atan2(dy, dx);
      return angleDiff(ang, player.facing || 0) <= arc / 2
        ? { inside: true, ring: 'main' } : { inside: false, ring: null };
    }
    case 'cone_trail': {
      // Eos: cone depan 45° + cone belakang (jejak)
      const arcF = 45 * Math.PI / 180;
      const range = R * 1.6;
      if (dist > range + er) return { inside: false, ring: null };
      const ang = Math.atan2(dy, dx);
      const f = player.facing || 0;
      if (angleDiff(ang, f) <= arcF / 2) return { inside: true, ring: 'main' };
      if (angleDiff(ang, f + Math.PI) <= arcF / 2) return { inside: true, ring: 'main' };
      return { inside: false, ring: null };
    }
    case 'tentacles': {
      const count = mem.shapeParams?.count ?? 3;
      const arc = (mem.shapeParams?.arcDeg ?? 32) * Math.PI / 180;
      const range = R * (mem.shapeParams?.rangeMult ?? 1.9);
      if (dist > range + er) return { inside: false, ring: null };
      const ang = Math.atan2(dy, dx);
      const base = player.facing || 0;
      // Dendri sweep: saat pulse, tentakel menyapu +90° (visual + hitbox ikut)
      const sweepOff = mem.sweepT >= 0 ? (1 - mem.sweepT / 0.4) * Math.PI : 0;
      for (let i = 0; i < count; i++) {
        const dir = base + sweepOff + (i * Math.PI * 2) / count;
        if (angleDiff(ang, dir) <= arc / 2) return { inside: true, ring: 'main' };
      }
      return { inside: false, ring: null };
    }
  }
}

// ---------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------

/**
 * Update membran per frame: contact tick, pulse anim, trail, satelit, auto-pulse.
 * Dipanggil dari game.update (tahap membran).
 */
export function updateMembrane(game, dt) {
  const run = game.run;
  const mem = run.membrane;
  if (!mem) return;
  const player = run.player;
  const cfg = membraneCfg();
  const st = getMembraneStats(run);
  const fx = st.fx;

  // Cooldowns
  if (mem.pulseCdLeft > 0) mem.pulseCdLeft -= dt;
  if (mem.metaCdLeft > 0) mem.metaCdLeft -= dt;
  if (mem.metaActiveT > 0) {
    mem.metaActiveT -= dt;
    if (mem.metaActiveT <= 0) mem.metaActiveT = 0;
  }
  if (mem.metaRootT > 0) mem.metaRootT -= dt;
  if (mem.livingDownT > 0) {
    mem.livingDownT -= dt;
    if (mem.livingDownT <= 0) {
      // Regen penuh
      mem.livingHp = mem.livingMaxHp;
      run.effects.spawnBlast(player.x, player.y, st.radius, '#7ae582');
      run.effects.spawnLabel(player.x, player.y - 40, 'MEMBRAN PULIH!', '#7ae582');
    }
  }
  if (mem.tregImmuneT > 0) mem.tregImmuneT -= dt;
  if (mem.heliaBuffT > 0) mem.heliaBuffT -= dt;
  if (mem.dashT > 0) {
    mem.dashT -= dt;
    // T-Bolt thrust: dorong hero ke depan
    const sp = 520;
    player.x += Math.cos(mem.dashAngle) * sp * dt;
    player.y += Math.sin(mem.dashAngle) * sp * dt;
  }
  if (mem.vanishT > 0) mem.vanishT -= dt;
  if (mem.nyxTeleportT > 0) { // Nyx: teleport mendarat sebelum vanish habis
    mem.nyxTeleportT -= dt;
    if (mem.nyxTeleportT <= 0 && mem.nyxTeleport && player.alive && !run.ended) {
      player.x = mem.nyxTeleport.x;
      player.y = mem.nyxTeleport.y;
      try { game.arenaClamp(player, player.radius || 15); } catch { /* abaikan */ }
      run.effects.spawnBurst(player.x, player.y, '#4a235a', 12, 200, 4);
    }
    if (mem.nyxTeleportT <= 0) mem.nyxTeleport = null;
  }
  if (mem.sweepT >= 0) {
    mem.sweepT -= dt;
    if (mem.sweepT < 0) mem.sweepT = -1;
  }

  // Pulse animasi
  if (mem.pulseAnimT >= 0) {
    mem.pulseAnimT += dt;
    const dur = cfg.pulseDurationSec || 0.4;
    const ex = cfg.pulseExpandSec || 0.15;
    const hold = cfg.pulseHoldSec || 0.1;
    if (mem.pulseAnimT < ex) mem.pulsePeak = easeOut(mem.pulseAnimT / ex);
    else if (mem.pulseAnimT < ex + hold) mem.pulsePeak = 1;
    else if (mem.pulseAnimT < dur) {
      const k = (mem.pulseAnimT - ex - hold) / Math.max(0.001, dur - ex - hold);
      mem.pulsePeak = 1 - easeIn(k);
    } else {
      mem.pulseAnimT = -1;
      mem.pulsePeak = 0;
      mem.pulseDidHit = false;
    }
  }

  // Nova gelombang kedua
  for (let i = mem.pendingWaves.length - 1; i >= 0; i--) {
    const wv = mem.pendingWaves[i];
    wv.t -= dt;
    if (wv.t <= 0) {
      mem.pendingWaves.splice(i, 1);
      pulseHit(game, { ...wv.opts, isSecondWave: true, pull: wv.pull });
      run.effects.spawnBlast(player.x, player.y, wv.opts.pulseRadius, '#c39bd3');
      run.camera.addShake(0.3);
    }
  }

  // Auto-pulse (mutasi medan_pulsa)
  if (fx.autoPulse && player.alive) {
    mem.autoPulseT -= dt;
    if (mem.autoPulseT <= 0) {
      mem.autoPulseT = fx.autoPulseIntervalSec;
      tryPulse(game, { auto: true, dmgMult: fx.autoPulseDmgMult });
    }
  }

  // Jejak toksik (mutasi beracun): spawn saat bergerak
  if (fx.trailPoison && player.alive && player.moving) {
    mem._trailAcc = (mem._trailAcc || 0) + dt;
    if (mem._trailAcc > 0.12) {
      mem._trailAcc = 0;
      mem.trail.push({
        x: player.x, y: player.y, t: 0,
        life: fx.trailDurationSec || 1.5,
        dps: st.contactDps * (fx.trailDpsMult ?? 0.4),
        r: 26,
      });
      if (mem.trail.length > 60) mem.trail.shift();
      mem.stats.trailUptime += 0.12;
    }
  }
  // Update trail: damage musuh yang berdiri di atasnya
  for (let i = mem.trail.length - 1; i >= 0; i--) {
    const tr = mem.trail[i];
    tr.t += dt;
    if (tr.t >= tr.life) { mem.trail.splice(i, 1); continue; }
    // Pemurni trait bisa membersihkan: ditangani di enemy-mutation (skip di sini)
    tr.tick = (tr.tick || 0) - dt;
    if (tr.tick > 0) continue;
    tr.tick = 0.25;
    dealTrailDamage(game, tr);
  }

  // Clouds (Baso histamin): area denial
  for (let i = mem.clouds.length - 1; i >= 0; i--) {
    const c = mem.clouds[i];
    c.t += dt;
    if (c.t >= c.life) { mem.clouds.splice(i, 1); continue; }
    c.tick = (c.tick || 0) - dt;
    if (c.tick > 0) continue;
    c.tick = 0.25;
    dealCloudDamage(game, c);
  }

  // Satelit simbiosis: orbit + damage kontak
  for (let i = mem.satellites.length - 1; i >= 0; i--) {
    const s = mem.satellites[i];
    s.t -= dt;
    s.angle += dt * 2.4;
    if (s.t <= 0) {
      mem.satellites.splice(i, 1);
      run.effects.spawnBurst(player.x + Math.cos(s.angle) * s.dist, player.y + Math.sin(s.angle) * s.dist, '#8df7d2', 8, 140, 3);
      continue;
    }
    s.tick = (s.tick || 0) - dt;
    if (s.tick > 0) continue;
    s.tick = 0.2;
    const sx = player.x + Math.cos(s.angle) * s.dist;
    const sy = player.y + Math.sin(s.angle) * s.dist;
    dealSatelliteDamage(game, sx, sy, s);
  }

  // Bella: antibodi otomatis 1/dtk ke musuh TERJAUH di medan (+stack engulf)
  if (mem.shape === 'circle' && mem.engulfSpecial === 'antibody_stack') {
    mem.bellaAntibodyT -= dt;
    const rate = 1 + Math.min(5, mem.bellaBonusRate || 0);
    if (mem.bellaAntibodyT <= 0) {
      mem.bellaAntibodyT = 1 / rate;
      fireBellaAntibody(game, rate);
    }
  }

  // Regenerasi saat medan bersih
  if (fx.regenWhenClearPct > 0 && player.alive) {
    if (mem.activeContacts === 0) {
      player.heal(player.maxHP * fx.regenWhenClearPct * dt);
    }
  }

  // Helia support: heal pelan selama medan aktif (hero selalu di dalam)
  if (mem.shape === 'support' && player.alive) {
    player.heal(player.maxHP * 0.02 * dt);
  }

  // ---- CONTACT TICK (inti!) ----
  mem.contactTickT -= dt;
  if (mem.contactTickT <= 0) {
    mem.contactTickT = cfg.contactTickSec || 0.1;
    contactTick(game);
  }

  // Squad membranes (Opsi A): kontak pasif mini
  updateSquadMembranes(game, dt);
}

function easeOut(k) { return 1 - (1 - Math.min(1, Math.max(0, k))) ** 2; }
function easeIn(k) { const t = Math.min(1, Math.max(0, k)); return t * t; }

// ---------------------------------------------------------------------
// CONTACT DAMAGE
// ---------------------------------------------------------------------

/**
 * Satu tick kontak: semua musuh di dalam medan terluka.
 * Cap maxContactTargets untuk performa.
 */
function contactTick(game) {
  const run = game.run;
  const mem = run.membrane;
  const player = run.player;
  if (!player.alive) { mem.activeContacts = 0; return; }
  const st = getMembraneStats(run);
  if (st.contactDps <= 0) { mem.activeContacts = 0; return; }
  const cfg = membraneCfg();
  const tick = cfg.contactTickSec || 0.1;
  const cap = cfg.maxContactTargets || 12;
  const fx = st.fx;
  const gf = safeGameFeel();

  let count = 0;
  // Kumpulkan kandidat via grid (radius besar untuk cone/tentakel range)
  const queryR = st.radius * 2 + 60;
  const candidates = [];
  run.collision.grid.queryCircle(player.x, player.y, queryR, (e) => {
    if (!e.alive) return;
    const hit = membraneContains(run, e);
    if (hit.inside) candidates.push({ e, ring: hit.ring });
  });
  // Prioritas: yang terdekat dulu (rasa adil), cap 12
  candidates.sort((a, b) => (dist2(player, a.e) - dist2(player, b.e)));
  const sliced = candidates.slice(0, cap);
  mem.activeContacts = sliced.length;

  for (const { e, ring } of sliced) {
    // Trait kebal_membran: reduction 80% kontak
    let dmgMult = 1;
    if (e.mutTrait === 'kebal_membran') dmgMult *= 0.2;
    if (e.mutTrait === 'acak_bermutasi' && e.mutActive === 'kebal_membran') dmgMult *= 0.2;
    // Dual ring: inner tinggi, outer rendah
    if (ring === 'inner') dmgMult *= fx.innerDmgMult;
    else if (ring === 'outer') dmgMult *= fx.outerDmgMult;

    let dmg = st.contactDps * tick * dmgMult;
    // Treg: medan memperlambat SEMUA (musuh slow, hero juga slow 10% — hero slow via speed check di tempat lain)
    // Slow on contact (lengket / dual outer)
    const slowPct = Math.max(fx.contactSlowPct || 0, ring === 'outer' ? fx.outerSlowPct : 0);
    if (slowPct > 0) e.applySlow(1 - slowPct, 0.25);
    // Treg (bible §3): medan slow 50% semua musuh di dalam (hero slow 10% via tregSlow)
    if (mem.engulfSpecial === 'balance_slow') e.applySlow(0.5, 0.25);
    // Lengket: tarik pelan ke pusat
    if (fx.pullToCenter > 0) {
      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * fx.pullToCenter * tick;
      e.y += (dy / d) * fx.pullToCenter * tick;
    }
    // Berduri: knockback saat kontak
    if (fx.knockbackOnContact && !e.isBoss && e.mutTrait !== 'kebal_knockback') {
      const dx = e.x - player.x, dy = e.y - player.y;
      const d = Math.hypot(dx, dy) || 1;
      e.vx += (dx / d) * fx.knockbackForce * 0.12;
      e.vy += (dy / d) * fx.knockbackForce * 0.12;
    }
    // Tandai waktu di dalam medan (untuk trait kebal_knockback: pulse butuh soak 2 dtk)
    e.membraneSoakT = (e.membraneSoakT || 0) + tick;

    // Nyx invisible: akumulasi tanpa angka sampai keluar medan
    if (mem.shape === 'invisible') {
      const dealt = dealMembraneDamage(game, e, dmg, { silent: true, sourceKind: 'membrane' });
      if (dealt > 0) mem.nyxAccum.set(e.uid, (mem.nyxAccum.get(e.uid) || 0) + dealt);
      // Cek mati tetap via dealMembraneDamage
    } else {
      dealMembraneDamage(game, e, dmg, { sourceKind: 'membrane', small: true });
    }
    count++;
    void gf;
  }

  // Nyx: musuh yang KELUAR medan → damage muncul sekaligus
  if (mem.shape === 'invisible') {
    for (const [uid, accum] of [...mem.nyxAccum.entries()]) {
      const e = run.enemies.find((x) => x.uid === uid);
      if (!e || !e.alive) { mem.nyxAccum.delete(uid); continue; }
      const still = membraneContains(run, e);
      if (!still.inside && accum > 1) {
        run.effects.spawnDamageNumber(e.x, e.y - e.radius - 14, Math.round(accum), '#c39bd3', 18);
        run.effects.spawnSpark(e.x, e.y, true);
        mem.nyxAccum.delete(uid);
      }
    }
  }

  // Metamorfosis aktif: tick masif + auto-engulf <30%
  if (mem.metaActiveT > 0) {
    const metaDmg = st.contactDps * fx.metaDmgMult * tick;
    for (const { e } of sliced) {
      if (!e.alive) continue;
      dealMembraneDamage(game, e, metaDmg, { sourceKind: 'metamorphosis' });
    }
    // Auto-engulf agresif
    for (const { e } of sliced) {
      if (!e.alive || e.isBoss) continue;
      if (e.hp / e.maxHP < fx.metaEngulfThreshold) tryEngulf(game, e, { force: true });
    }
  }
}

function dist2(p, e) {
  const dx = e.x - p.x, dy = e.y - p.y;
  return dx * dx + dy * dy;
}

function safeGameFeel() {
  try { return getGameFeel(); } catch { return {}; }
}

/**
 * Damage membran ke satu musuh — melewati jalur combat standar
 * (mark/execute, antigen, armor, tag, passive) agar progresi meta tetap jalan.
 * @returns {number} damage aktual yang masuk (0 bila diserap)
 */
export function dealMembraneDamage(game, enemy, amount, opts = {}) {
  const run = game.run;
  if (!enemy.alive) return 0;
  // Crit roll (kecil untuk tick kontak agar tidak terlalu bising)
  let dmg = amount;
  let crit = false;
  if (!opts.noCrit && Math.random() < 0.04) {
    crit = true;
    try { dmg *= getGameFeel().crit?.mult || 1.5; } catch { dmg *= 1.5; }
  }
  dmg = modifyOutgoingDamage(run, enemy, dmg);
  dmg *= antigenDamageMult(run, enemy);
  // Eos (bible §3): ×3 damage ke parasit (semua damage membran lewat jalur ini)
  if (run.membrane?.engulfSpecial === 'parasite_hunter' && enemy.def?.id === 'parasit') dmg *= 3;
  enemy.lastHitDamage = dmg;
  const died = antigenIgnoreArmor(run, enemy) ? enemy.takeDamageRaw(dmg) : enemy.takeDamage(dmg);
  game.provokeEnemy(enemy);
  if (!enemy.lastHitAbsorbed) passiveOnHit(run, enemy, dmg);
  if (opts.silent) {
    // Nyx: tanpa angka/spark (damage disembunyikan)
    if (died) game.onEnemyKilled(enemy, 'contact');
    return enemy.lastHitAbsorbed ? 0 : dmg;
  }
  // Feedback kecil untuk tick kontak (hierarki: kontak < pulse)
  if (!opts.noFeedback) {
    // Throttle spark per musuh agar tick 10/dtk tidak membanjiri partikel
    enemy._memFxT = (enemy._memFxT || 0);
    const now = run.time || 0;
    if (died || now - enemy._memFxT > 0.3) {
      enemy._memFxT = now;
      game.spawnHitFeedback(enemy, enemy.lastHitAbsorbed ? 0 : dmg, died, crit, {
        dirX: enemy.x - run.player.x, dirY: enemy.y - run.player.y,
        sourceKind: opts.sourceKind || 'membrane',
      });
    }
  }
  if (!enemy.lastHitAbsorbed) game.onDamageDealt(dmg);
  if (died) {
    game.onEnemyKilled(enemy, 'contact');
  } else {
    // Cek engulf threshold setiap tick (otomatis!)
    const st = getMembraneStats(run);
    const thresh = effEngulfThresh(run, st, enemy);
    if (!enemy.isBoss && enemy.hp / enemy.maxHP < thresh) {
      tryEngulf(game, enemy);
    }
  }
  return enemy.lastHitAbsorbed ? 0 : dmg;
}

// ---------------------------------------------------------------------
// ENGULF (fagositosis otomatis)
// ---------------------------------------------------------------------

/**
 * Threshold engulf efektif per musuh (ADDENDUM §2: Opsonin → 35%).
 * Trait kebal_membran (5%) tetap menang atas segalanya.
 */
function effEngulfThresh(run, st, enemy) {
  if (enemy.mutTrait === 'kebal_membran' || enemy.mutActive === 'kebal_membran') return 0.05;
  if ((enemy.opsoninUntil || 0) > (run.time || 0)) return Math.max(st.engulfThreshold, 0.35);
  return st.engulfThreshold;
}

/**
 * Coba engulf satu musuh. Boss tidak pernah bisa di-engulf.
 * @returns {boolean} true bila terserap
 */
/**
 * PACING D14 - hibah Bio-Point engulf. Engulf umum (laju nyata +-50%, bukan
 * 5% asumsi bible) hanya memberi Bio tiap ke-N (bioPointEveryEngulf = 8,
 * hasil +-20 Bio/run sesuai ekonomi bible S4). Korban OPSONIN selalu
 * memberi (jendela panen konsumabel). @returns {number} Bio yang dihibahkan
 */
function grantEngulfBio(game, enemy) {
  const run = game.run;
  const mem = run.membrane;
  const cfg = membraneCfg();
  const every = Math.max(1, cfg.bioPointEveryEngulf || 8);
  const opsonin = (enemy.opsoninUntil || 0) > (run.time || 0);
  run.bioEngulfCounter = (run.bioEngulfCounter || 0) + 1;
  if (!opsonin && run.bioEngulfCounter % every !== 0) return 0;
  let bio = cfg.bioPointPerEngulf || 1;
  if (mem.engulfSpecial === 'heal_bonus') bio = Math.ceil(bio * 1.3);
  if (run.itemBuffs && run.itemBuffs.katalis) bio *= 2; // ADDENDUM S2: Katalis Mitosis (2x final)
  run.bioPoints = (run.bioPoints || 0) + bio;
  return bio;
}

export function tryEngulf(game, enemy, opts = {}) {
  const run = game.run;
  const mem = run.membrane;
  const player = run.player;
  if (!enemy.alive || enemy.isBoss) return false;
  if (!player.alive) return false;
  const st = getMembraneStats(run);
  const thresh = effEngulfThresh(run, st, enemy);
  if (!opts.force && enemy.hp / enemy.maxHP >= thresh) return false;
  // T-Bolt insta-kill <25%, Nyx insta-kill <30% (di sini sebagai engulf paksa)
  // (threshold efektif sudah dinaikkan di hero membrane.engulfThreshold)

  // Simbiosis: BUKAN serap — rekrut sebagai satelit
  const fx = st.fx;
  if (fx.engulfSatellite && mem.satellites.length < fx.maxSatellites) {
    recruitSatellite(game, enemy, fx, st);
    return true;
  }

  // --- Serap! ---
  enemy.alive = false;
  enemy.hp = 0;
  enemy.devoured = false; // PHAGOS engulf = kill normal + bonus (XP/drop tetap jalan agar run 3-8 mnt terjaga)
  mem.stats.engulfCount += 1;
  const fam = engulfFamilyOf(enemy);
  run.engulfStats = run.engulfStats || {};
  run.engulfStats[fam] = (run.engulfStats[fam] || 0) + 1;

  // Bio-Point (run-only) — via counter D14 (opsonin selalu hibah)
  const bio = grantEngulfBio(game, enemy);

  // Heal
  let healPct = st.engulfHealPct;
  if (mem.engulfSpecial === 'heal_bonus') healPct *= 1.5;
  if (st.adaptive?.healMult) healPct *= st.adaptive.healMult;
  player.heal(player.maxHP * healPct);

  // Visual engulf: tarikan + partikel hijau + flash
  run.effects.spawnBurst(enemy.x, enemy.y, '#5ce8c8', 10, 160, 3);
  if (bio > 0) run.effects.spawnLabel(enemy.x, enemy.y - enemy.radius - 10, `+${bio} BIO`, '#8df7d2');
  player.squash = Math.max(player.squash, 0.12);

  // Hit-stop UNIK engulf: lebih lambat, lebih "basah"
  try {
    const gf = getGameFeel();
    const es = gf.engulf?.hitStop ?? 0.06;
    if (run.hitStopCool <= 0) { game.hitStopRun(es); run.hitStopCool = 0.3; }
  } catch { /* abaikan */ }

  // Parasit (Infeksi Balik): korban meledak AOE
  if (fx.engulfExplode) {
    const boomDmg = st.contactDps * fx.engulfExplodeMult;
    run.effects.spawnBlast(enemy.x, enemy.y, fx.engulfExplodeRadius, '#9be15d');
    run.camera.addShake(0.2);
    for (const o of run.enemies) {
      if (!o.alive || o === enemy) continue;
      if (Math.hypot(o.x - enemy.x, o.y - enemy.y) > fx.engulfExplodeRadius + o.radius) continue;
      const odmg = boomDmg;
      o.lastHitDamage = odmg;
      const odied = o.takeDamage(odmg);
      game.spawnHitFeedback(o, odmg, odied, false, { sourceKind: 'engulf_burst' });
      if (odied) game.onEnemyKilled(o, 'parasit'); // ledakan engulf (parasit) = insidental
    }
  }

  // Trait beracun_saat_diserap: backfire 15% max HP
  if (enemy.mutTrait === 'beracun_saat_diserap' || enemy.mutActive === 'beracun_saat_diserap') {
    game.damagePlayer(Math.round(player.maxHP * 0.15));
    run.effects.spawnLabel(player.x, player.y - 44, 'KERACUNAN!', '#7dff5e');
  }

  // Engulf specials per hero
  applyEngulfSpecial(game, enemy);

  // Kill normal (XP, drop, chain) — PHAGOS: engulf tetap kill
  game.onEnemyKilled(enemy, 'engulf');
  // PHAGOS D5: skill pasif pemicu 'engulf'
  try { game.fireSkillTrigger('engulf'); } catch { /* abaikan */ }
  try { audio.collect(); } catch { /* headless */ }
  return true;
}

function recruitSatellite(game, enemy, fx, st) {
  const run = game.run;
  const mem = run.membrane;
  enemy.alive = false;
  enemy.hp = 0;
  mem.stats.engulfCount += 1;
  const fam = engulfFamilyOf(enemy);
  run.engulfStats = run.engulfStats || {};
  run.engulfStats[fam] = (run.engulfStats[fam] || 0) + 1;
  run.bioPoints = (run.bioPoints || 0) + 1;
  mem.satellites.push({
    angle: Math.random() * Math.PI * 2,
    dist: st.radius * 0.75,
    t: fx.satelliteDurationSec || 8,
    dps: st.contactDps * (fx.satelliteDpsMult || 0.8),
    radius: Math.min(16, enemy.radius || 12),
    color: enemy.def?.color || '#8df7d2',
    tick: 0,
  });
  run.effects.spawnLabel(enemy.x, enemy.y - 20, 'SIMBIOSIS!', '#8df7d2');
  game.onEnemyKilled(enemy, 'engulf');
}

function applyEngulfSpecial(game, enemy) {
  const run = game.run;
  const mem = run.membrane;
  const player = run.player;
  const sp = mem.engulfSpecial;
  if (!sp) return;
  switch (sp) {
    case 'mark_nearby': { // Dendri: tandai sekitar (+30% dmg 3 dtk)
      for (const o of run.enemies) {
        if (!o.alive) continue;
        if (Math.hypot(o.x - enemy.x, o.y - enemy.y) > 140) continue;
        o.markMult = 1.3; o.markT = 3;
      }
      break;
    }
    case 'speed_boost': { // Neutron: +20% speed 3 dtk
      run.tempBuffs.speed.mult *= 1.2;
      run.tempBuffs.speed.t = Math.max(run.tempBuffs.speed.t, 3);
      game.recomputePlayerStats();
      break;
    }
    case 'slow_all': { // Baso: semua musuh layar slow 20% 2 dtk
      for (const o of run.enemies) if (o.alive) o.applySlow(0.8, 2);
      break;
    }
    case 'armor_stack': { // Mastia: +5% DR, maks 10 stack
      mem.mastiaArmorStacks = Math.min(10, (mem.mastiaArmorStacks || 0) + 1);
      break;
    }
    case 'shield_gain': { // Helia: shield 10% maxHP
      run.shield = (run.shield || 0) + Math.round(player.maxHP * 0.1);
      break;
    }
    case 'balance_slow': { // Treg (bible §3): hapus 1 efek negatif — satu-satunya
      // efek negatif in-run = hazard arena → musnahkan hazard terdekat.
      if (run.hazards.length > 0) {
        let bi = 0; let bd = Infinity;
        run.hazards.forEach((h, i) => {
          const d = Math.hypot(h.x - player.x, h.y - player.y);
          if (d < bd) { bd = d; bi = i; }
        });
        run.hazards.splice(bi, 1);
        run.effects.spawnLabel(player.x, player.y - 40, 'DIMURNIKAN', '#7ae582');
      }
      break;
    }
    case 'antibody_stack': { // Bella: +1 antibodi/dtk (maks +5)
      mem.bellaBonusRate = Math.min(5, (mem.bellaBonusRate || 0) + 1);
      break;
    }
    case 'assassin_root': { // Nyx: harus diam 0.5 dtk (root)
      mem.metaRootT = Math.max(mem.metaRootT, 0.5);
      break;
    }
    default: break;
  }
}

// ---------------------------------------------------------------------
// PULSE
// ---------------------------------------------------------------------

/**
 * Coba eksekusi Pulse (manual via tombol / otomatis via mutasi).
 * @returns {boolean} true bila meledak
 */
export function tryPulse(game, opts = {}) {
  const run = game.run;
  const mem = run.membrane;
  if (!mem || !run.player.alive || run.ended) return false;
  const st = getMembraneStats(run);
  const fx = st.fx;

  // Metamorfosis menggantikan Pulse
  if (fx.metamorphosis) {
    if (mem.metaCdLeft > 0) return false;
    if (opts.auto) return false; // meta tidak auto
    mem.metaCdLeft = fx.metaCooldownSec;
    mem.metaActiveT = fx.metaRootSec;
    mem.metaRootT = fx.metaRootSec;
    mem.stats.pulseCount += 1;
    run.effects.spawnBlast(run.player.x, run.player.y, st.radius * fx.metaRadiusMult, '#c39bd3');
    run.effects.spawnLabel(run.player.x, run.player.y - 50, 'METAMORFOSIS!', '#c39bd3');
    run.camera.addShake(0.8);
    try { game.hitStopRun(0.12); audio.evolve(); buzz('boss'); } catch { /* abaikan */ }
    game.provokeEnemyNear?.(run.player.x, run.player.y, 400);
    return true;
  }

  if (mem.pulseCdLeft > 0 && !opts.ignoreCd) return false;
  if (mem.livingDownT > 0) return false;

  const dmgMult = opts.dmgMult ?? 1;
  // ADDENDUM §2 — Ledakan ATP: pulse instan GRATIS (CD tak diubah) + 3 berikut −60%
  if (!opts.ignoreCd) {
    mem.pulseCdLeft = st.pulseCooldown;
    if (run.itemBuffs && run.itemBuffs.atpPulsesLeft > 0) {
      run.itemBuffs.atpPulsesLeft -= 1;
      mem.pulseCdLeft *= 0.4;
    }
  }
  mem.pulseAnimT = 0;
  mem.pulseDidHit = false;
  mem.lastPulseWasAuto = !!opts.auto;
  if (!opts.auto) mem.stats.pulseCount += 1;

  // Hit utama saat expand (frame ini juga — rasa responsif)
  pulseHit(game, {
    pulseRadius: st.radius,
    // radius aktual dihitung di pulseHit dari stats (termasuk pulseRadiusMult)
    dmgMult,
    pull: fx.pulsePull,
    centerDmgMult: fx.pulseCenterDmgMult,
  });

  // Nova: jadwalkan gelombang kedua (pull)
  if (fx.doubleWave && !opts.isSecondWave) {
    mem.pendingWaves.push({
      t: fx.secondWaveDelaySec,
      pull: fx.secondWavePull,
      opts: { pulseRadius: st.radius, dmgMult, pull: fx.secondWavePull, centerDmgMult: 1 },
    });
  }

  // Juice: shake BESAR + hit-stop 0.1 dtk + ripple
  try {
    const gf = getGameFeel();
    run.camera.addShake(gf.pulse?.shake ?? 0.45);
    if (!opts.auto) game.hitStopRun(gf.pulse?.hitStop ?? 0.1);
    else game.hitStopRun(0.03);
    audio.evolve();
    buzz('elite');
  } catch { /* headless */ }

  // Per-hero pulse behavior
  applyPulseSpecial(game, opts);

  // PHAGOS D5: skill pasif pemicu 'pulse' (manual maupun otomatis)
  try { game.fireSkillTrigger('pulse'); } catch { /* abaikan */ }

  return true;
}

/**
 * Damage area Pulse ke semua musuh dalam pulseRadius.
 */
export function pulseHit(game, opts = {}) {
  const run = game.run;
  const mem = run.membrane;
  const player = run.player;
  const st = getMembraneStats(run);
  const R = st.pulseRadius;
  const baseDmg = st.pulseDamage * (opts.dmgMult ?? 1);
  const pull = opts.pull ?? false;
  const centerMult = opts.centerDmgMult ?? 1;

  run.collision.grid.queryCircle(player.x, player.y, R + 60, (e) => {
    if (!e.alive) return;
    const dx = e.x - player.x, dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > R + e.radius * 0.5) return;
    // Trait kebal_knockback: butuh soak >2 dtk di medan sebelum pulse melukai
    if ((e.mutTrait === 'kebal_knockback' || e.mutActive === 'kebal_knockback') && (e.membraneSoakT || 0) < 2.0) {
      run.effects.spawnLabel(e.x, e.y - e.radius - 8, 'TERJANGKAR!', '#ff9f43');
      return;
    }
    // Damage pusat ×2 untuk implosi
    const centerK = 1 - Math.min(1, dist / R);
    let dmg = baseDmg * (pull ? (1 + (centerMult - 1) * centerK) : 1);
    if ((e.opsoninUntil || 0) > (run.time || 0)) dmg *= 1.3; // ADDENDUM §2: Opsonin
    // Mastia pulse_only: damage dari baseContactDps tetap (contactDps=0!) → pakai fallback
    if (mem.shape === 'pulse_only' && !(dmg > 0)) {
      const scale = st.scale || 1;
      dmg = mem.baseContactDps * scale * (membraneCfg().pulseDamageMult || 4) * (opts.dmgMult ?? 1);
    }
    dmg = modifyOutgoingDamage(run, e, dmg);
    dmg *= antigenDamageMult(run, e);
    e.lastHitDamage = dmg;
    const died = antigenIgnoreArmor(run, e) ? e.takeDamageRaw(dmg) : e.takeDamage(dmg);
    game.provokeEnemy(e);
    if (!e.lastHitAbsorbed) passiveOnHit(run, e, dmg);
    // Push / pull (boss imun, kebal_knockback imun)
    if (!e.isBoss && e.mutTrait !== 'kebal_knockback' && e.mutActive !== 'kebal_knockback') {
      const d = dist || 1;
      const dir = pull ? -1 : 1;
      const pushMult = run.heroDef?.membrane?.shapeParams?.pushMult || 1;
      const force = (opts.isSecondWave ? 260 : 340) * pushMult;
      e.vx += (dx / d) * force * dir;
      e.vy += (dy / d) * force * dir;
    }
    game.spawnHitFeedback(e, e.lastHitAbsorbed ? 0 : dmg, died, false, {
      dirX: dx, dirY: dy, sourceKind: opts.isSecondWave ? 'pulse_wave2' : 'pulse',
    });
    if (!e.lastHitAbsorbed) game.onDamageDealt(dmg);
    if (died) {
      // PHAGOS iterasi: Mastia (pulse_only) tidak punya kontak/engulf —
      // kill via Pulse DIANGGAP engulf-lite agar ekonomi Bio & stack armor
      // tetap jalan (Pulse ADALAH cara ia menelan).
      if (mem.shape === 'pulse_only') {
        const bioLite = grantEngulfBio(game, e);
        mem.stats.engulfCount += 1;
        player.heal(player.maxHP * st.engulfHealPct);
        if (bioLite > 0) run.effects.spawnLabel(e.x, e.y - e.radius - 10, `+${bioLite} BIO`, '#8df7d2');
        try { applyEngulfSpecial(game, e); } catch { /* abaikan */ }
      }
      game.onEnemyKilled(e, 'pulse');
    }
    else {
      // Pulse juga bisa memicu engulf bila musuh sekarat di dalam medan
      // (Mastia pulse_only: pulse radius dianggap medan sesaat)
      const inMem = mem.shape === 'pulse_only' ? { inside: true } : membraneContains(run, e);
      if (inMem.inside && e.hp / e.maxHP < st.engulfThreshold) tryEngulf(game, e);
    }
  });

  // Ripple shockwave visual
  run.effects.spawnBlast(player.x, player.y, R, player.heroDef?.color || '#35d0ba');
}

function applyPulseSpecial(game, opts) {
  const run = game.run;
  const mem = run.membrane;
  const player = run.player;
  const heroId = run.heroDef?.id;
  const st = getMembraneStats(run);
  switch (heroId) {
    case 'tcd8': { // Thrust ke depan: dash 0.3 dtk
      mem.dashT = 0.3;
      mem.dashAngle = player.facing || 0;
      break;
    }
    case 'dendritic': { // Tentakel menyapu 180°
      mem.sweepT = 0.4;
      break;
    }
    case 'eosinophil': { // Granul ke 5 target terdekat — instan (D3: tanpa proyektil)
      const targets = nearestEnemies(run, player.x, player.y, 420, 5);
      for (const t of targets) {
        const dmg5 = Math.max(4, st.contactDps * 1.2);
        const ang5 = Math.atan2(t.y - player.y, t.x - player.x);
        run.effects.spawnSwipe(player.x, player.y, ang5, 52, 1.0, '#ff6b81');
        run.effects.spawnBurst(t.x, t.y, '#ff6b81', 5, 170, 3);
        const died5 = t.takeDamage(dmg5);
        game.spawnHitFeedback(t, dmg5, died5);
        if (died5) game.onEnemyKilled(t, 'pulse');
      }
      break;
    }
    case 'basophil': { // Awan histamin 3 dtk
      mem.clouds.push({
        x: player.x, y: player.y, r: st.radius * 1.4, t: 0, life: 3,
        dps: st.contactDps * 0.8, tick: 0,
      });
      break;
    }
    case 'tcd4': { // Buff squad 20% 3 dtk
      mem.heliaBuffT = 3;
      run.effects.spawnLabel(player.x, player.y - 50, 'SQUAD +20%!', '#f1c40f');
      break;
    }
    case 'treg': { // Hapus debuff + immunity 3 dtk
      mem.tregImmuneT = 3;
      run.tempBuffs.cooldown.mult = 1; run.tempBuffs.cooldown.t = 0;
      if (run.hazards.length > 0) { // cleanse: musnahkan hazard terdekat
        let bi = 0; let bd = Infinity;
        run.hazards.forEach((h, i) => {
          const d = Math.hypot(h.x - player.x, h.y - player.y);
          if (d < bd) { bd = d; bi = i; }
        });
        run.hazards.splice(bi, 1);
      }
      if (player.iframes < 0.5) player.iframes = 0.5;
      run.effects.spawnLabel(player.x, player.y - 50, 'IMUN 3 DTK!', '#2ecc71');
      break;
    }
    case 'bcell': { // 8 antibodi segala arah — instan ke ≤8 target (D3: tanpa proyektil)
      const targets8 = nearestEnemies(run, player.x, player.y, st.pulseRadius + 60, 8);
      for (const t of targets8) {
        const dmg8 = Math.max(4, st.contactDps * 1.5);
        const ang8 = Math.atan2(t.y - player.y, t.x - player.x);
        run.effects.spawnSwipe(player.x, player.y, ang8, 60, 0.9, '#bb8fce');
        run.effects.spawnBurst(t.x, t.y, '#bb8fce', 5, 160, 3);
        const died8 = t.takeDamage(dmg8);
        game.spawnHitFeedback(t, dmg8, died8);
        if (died8) game.onEnemyKilled(t, 'pulse');
      }
      break;
    }
    case 'nkcell': { // Hilang 0.5 dtk lalu teleport ke belakang musuh terdekat
      mem.vanishT = 0.5;
      player.iframes = Math.max(player.iframes, 0.6);
      const near = nearestEnemies(run, player.x, player.y, 420, 1)[0];
      if (near) {
        // Teleport ke belakang musuh (relatif ke arah hadap musuh→player lama).
        // Timer FRAME (bukan setTimeout) agar hormat pause/hit-stop/akhir run.
        const ang = Math.atan2(player.y - near.y, player.x - near.x);
        mem.nyxTeleport = { x: near.x + Math.cos(ang) * (near.radius + 30), y: near.y + Math.sin(ang) * (near.radius + 30) };
        mem.nyxTeleportT = 0.48;
      }
      break;
    }
    default: break; // Mako/Neutron/Mastia: push standar (sudah di pulseHit)
  }
  void opts;
}

function nearestEnemies(run, x, y, range, n) {
  const out = [];
  run.collision.grid.queryCircle(x, y, range, (e) => {
    if (!e.alive) return;
    out.push(e);
  });
  out.sort((a, b) => ((a.x - x) ** 2 + (a.y - y) ** 2) - ((b.x - x) ** 2 + (b.y - y) ** 2));
  return out.slice(0, n);
}

// ---------------------------------------------------------------------
// TRAIL / CLOUD / SATELLITE / BELLA damage
// ---------------------------------------------------------------------

function dealTrailDamage(game, tr) {
  const run = game.run;
  run.collision.grid.queryCircle(tr.x, tr.y, tr.r + 40, (e) => {
    if (!e.alive) return;
    if (e.mutTrait === 'pemurni' || e.mutActive === 'pemurni') {
      // Pemurni: kebal + membersihkan jejak + heal musuh sekitar
      tr.t = tr.life; // hapus jejak ini
      for (const o of run.enemies) {
        if (!o.alive) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) > 120) continue;
        o.hp = Math.min(o.maxHP, o.hp + o.maxHP * 0.05);
      }
      run.effects.spawnLabel(e.x, e.y - 20, 'DIMURNIKAN', '#eaf6ff');
      return;
    }
    if (Math.hypot(e.x - tr.x, e.y - tr.y) > tr.r + e.radius * 0.5) return;
    const dmg = tr.dps * 0.25;
    dealMembraneDamage(game, e, dmg, { sourceKind: 'trail', noCrit: true });
  });
}

function dealCloudDamage(game, c) {
  const run = game.run;
  run.collision.grid.queryCircle(c.x, c.y, c.r + 40, (e) => {
    if (!e.alive) return;
    if (Math.hypot(e.x - c.x, e.y - c.y) > c.r + e.radius * 0.5) return;
    e.applySlow(0.7, 0.4);
    dealMembraneDamage(game, e, c.dps * 0.25, { sourceKind: 'cloud', noCrit: true });
  });
}

function dealSatelliteDamage(game, sx, sy, s) {
  const run = game.run;
  run.collision.grid.queryCircle(sx, sy, s.radius + 40, (e) => {
    if (!e.alive) return;
    if (Math.hypot(e.x - sx, e.y - sy) > s.radius + e.radius * 0.5 + 10) return;
    dealMembraneDamage(game, e, s.dps * 0.2, { sourceKind: 'satellite', noCrit: true });
  });
}

function fireBellaAntibody(game, rate) {
  const run = game.run;
  const mem = run.membrane;
  const player = run.player;
  const st = getMembraneStats(run);
  // Target TERJAUH di dalam medan
  let best = null; let bd = -1;
  run.collision.grid.queryCircle(player.x, player.y, st.radius + 60, (e) => {
    if (!e.alive) return;
    const hit = membraneContains(run, e);
    if (!hit.inside) return;
    const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
    if (d > bd) { bd = d; best = e; }
  });
  if (!best) return;
  // D3 (owner): TANPA entitas proyektil — damage instan + visual antibodi.
  const dmg = Math.max(3, st.contactDps * 0.8);
  const ang = Math.atan2(best.y - player.y, best.x - player.x);
  run.effects.spawnSwipe(player.x, player.y, ang, 46, 1.1, '#bb8fce');
  run.effects.spawnBurst(best.x, best.y, '#bb8fce', 6, 170, 3);
  const died = best.takeDamage(dmg);
  game.spawnHitFeedback(best, dmg, died);
  if (died) game.onEnemyKilled(best, 'antibody');
  void rate; void mem;
}

// ---------------------------------------------------------------------
// SQUAD MEMBRANES (Opsi A)
// ---------------------------------------------------------------------

function updateSquadMembranes(game, dt) {
  const run = game.run;
  if (!run.allies || run.allies.length === 0) return;
  const st = getMembraneStats(run);
  const cfg = safeMembraneConfig();
  const sq = (cfg && cfg.squad) || { radiusMult: 0.5, dpsMult: 0.3 };
  let buff = 1;
  if (run.membrane.heliaBuffT > 0) buff = 1.2;
  if (run.itemBuffs && (run.time || 0) < (run.itemBuffs.sinapsisUntil || 0)) buff *= 2; // ADDENDUM §2: Sinapsis
  const r = st.radius * (sq.radiusMult || 0.5);
  const dps = st.contactDps * (sq.dpsMult || 0.3) * buff;
  if (dps <= 0 || r <= 0) return;
  // Tick per 0.2 dtk (lebih jarang dari hero — hemat)
  run._squadMemT = (run._squadMemT || 0) - dt;
  if (run._squadMemT > 0) return;
  run._squadMemT = 0.2;
  for (const a of run.allies) {
    run.collision.grid.queryCircle(a.x, a.y, r + 40, (e) => {
      if (!e.alive) return;
      if (Math.hypot(e.x - a.x, e.y - a.y) > r + e.radius * 0.5) return;
      dealMembraneDamage(game, e, dps * 0.2, { sourceKind: 'squad', noCrit: true, noFeedback: false });
    });
  }
}

// ---------------------------------------------------------------------
// CHAIN (rantai) — dipanggil dari game.onEnemyKilled
// ---------------------------------------------------------------------

export function membraneOnKill(game, enemy, depth = 0) {
  const run = game.run;
  const mem = run.membrane;
  if (!mem) return;
  const st = getMembraneStats(run);
  const fx = st.fx;
  if (!fx.chainOnKill) return;
  if (depth >= (fx.chainMax || 5)) return;
  // Hanya kill DI DALAM medan yang memicu
  // (cek jarak ke player karena enemy sudah mati — pakai posisi terakhir)
  const player = run.player;
  const R = st.radius;
  if (Math.hypot(enemy.x - player.x, enemy.y - player.y) > R + 60) return;
  const cr = R * (fx.chainRadiusMult || 0.5);
  const cdmg = st.contactDps * (fx.chainDmgMult || 0.3) * 2; // ×2 agar bermakna sebagai burst
  run.effects.spawnBlast(enemy.x, enemy.y, cr, '#ffd93d');
  run.collision.grid.queryCircle(enemy.x, enemy.y, cr + 40, (o) => {
    if (!o.alive || o === enemy) return;
    if (Math.hypot(o.x - enemy.x, o.y - enemy.y) > cr + o.radius * 0.5) return;
    o.lastHitDamage = cdmg;
    const died = o.takeDamage(cdmg);
    game.spawnHitFeedback(o, cdmg, died, false, { sourceKind: 'chain' });
    if (died) {
      // Rantai lanjutan ditangani game.onEnemyKilled → membraneOnKill
      // (dibatasi _chainDepth ≤ 5 di game.js); tanpa rekursi langsung
      // agar tidak ada ledakan ganda pada korban yang sama.
      game.onEnemyKilled(o, 'rantai'); // rantai = insidental
    }
  });
}

// ---------------------------------------------------------------------
// LIVING MEMBRANE & REFLECT hooks (dipanggil dari game.damagePlayer)
// ---------------------------------------------------------------------

/**
 * Serap damage ke membran hidup. @returns {number} sisa damage untuk hero.
 */
export function membraneAbsorbDamage(run, amount) {
  const mem = run.membrane;
  if (!mem) return amount;
  const st = getMembraneStats(run);
  // Treg immunity: kebal penuh
  if (mem.tregImmuneT > 0) {
    run.effects.spawnLabel(run.player.x, run.player.y - 44, 'KEBAL!', '#2ecc71');
    return 0;
  }
  // Nyx vanish: invincible
  if (mem.vanishT > 0) return 0;
  // Mastia armor stacks: DR 5%/stack
  if (mem.mastiaArmorStacks > 0) {
    amount = Math.max(1, Math.round(amount * (1 - mem.mastiaArmorStacks * 0.05)));
  }
  // Adaptif spora: armor (damage ×0.8)
  if (st.adaptive?.armorMult) {
    amount = Math.max(1, Math.round(amount * st.adaptive.armorMult));
  }
  // Living membrane: hero kebal selama membran HP ada
  if (st.fx.livingMembrane) {
    if (mem.livingMaxHp <= 0) {
      mem.livingMaxHp = Math.round(run.player.maxHP * st.fx.membraneHpPct);
      mem.livingHp = mem.livingMaxHp;
    }
    if (mem.livingDownT > 0) return amount; // membran mati — hero rentan
    mem.livingHp -= amount;
    run.effects.spawnLabel(run.player.x, run.player.y - 44, 'MEMBRAN!', '#7ae582');
    if (mem.livingHp <= 0) {
      mem.livingHp = 0;
      mem.livingDownT = st.fx.membraneDownSec;
      run.effects.spawnBlast(run.player.x, run.player.y, st.radius, '#ff6b6b');
      run.effects.spawnLabel(run.player.x, run.player.y - 50, 'MEMBRAN HANCUR!', '#ff6b6b');
    }
    return 0;
  }
  return amount;
}

/** Refleksi cermin: dipanggil SETELAH hero menerima damage. */
export function membraneOnPlayerHit(game, amount) {
  const run = game.run;
  const mem = run.membrane;
  if (!mem) return;
  const st = getMembraneStats(run);
  if (st.fx.reflectPct > 0) {
    // Pantulkan ke musuh terdekat DI DALAM medan
    let best = null; let bd = Infinity;
    run.collision.grid.queryCircle(run.player.x, run.player.y, st.radius + 40, (e) => {
      if (!e.alive) return;
      const hit = membraneContains(run, e);
      if (!hit.inside) return;
      const d = (e.x - run.player.x) ** 2 + (e.y - run.player.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    });
    if (best) {
      const rdmg = amount * st.fx.reflectPct;
      best.lastHitDamage = rdmg;
      const died = best.takeDamage(rdmg);
      game.spawnHitFeedback(best, rdmg, died, false, { sourceKind: 'reflect' });
      if (died) game.onEnemyKilled(best, 'cermin'); // refleksi = insidental
    }
  }
}

// ---------------------------------------------------------------------
// PULSE VIEW (HUD cooldown)
// ---------------------------------------------------------------------

export function pulseView(run) {
  const mem = run.membrane;
  if (!mem) return { ready: true, cdLeft: 0, cdTotal: 1, metamorphosis: false };
  const st = getMembraneStats(run);
  if (st.fx.metamorphosis) {
    return {
      ready: mem.metaCdLeft <= 0, cdLeft: Math.max(0, mem.metaCdLeft),
      cdTotal: st.fx.metaCooldownSec, metamorphosis: true,
    };
  }
  return {
    ready: mem.pulseCdLeft <= 0, cdLeft: Math.max(0, mem.pulseCdLeft),
    cdTotal: st.pulseCooldown, metamorphosis: false,
  };
}
