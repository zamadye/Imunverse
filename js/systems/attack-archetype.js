/**
 * attack-archetype.js — EKSEKUSI 8 archetype serangan V2 (§17–§19) pada PULSE.
 *
 * KENAPA MODUL INI ADA
 * -------------------
 * Di PHAGOS hero TIDAK menembak sendiri: damage datang dari medan membran
 * (pasif) + satu tombol PULSE. Jadi identitas serangan hero harus hidup di
 * PULSE itu, bukan di jalur `performAttack` lama yang sudah mati.
 *
 * Dulu yang membedakan hero hanyalah `applyPulseSpecial()` di membrane-system:
 * ada yang langsung melukai 5 target (Eos), ada yang cuma memberi buff (TCD4),
 * ada yang tidak punya apa-apa sama sekali (Makrofag, Neutrofil, Mastia) —
 * dan SEMUA-nya instan, tanpa peringatan. Pemain tidak bisa membaca apa yang
 * sedang terjadi.
 *
 * Sekarang: setiap PULSE menjalankan archetype hero-nya dengan rantai wajib
 *   anticipation → telegraph → execution → impact → recovery
 * (angka fase ada di data/attacks.json). Saat menelegraph, bentuk serangan
 * SUDAH Tergambar di lantai (cincin / garis / busur / sasaran), jadi pemain
 * tahu apa yang akan terjadi sebelum peluru atau ledakannya muncul.
 *
 * DELAPAN ARCHETYPE → 11 HERO
 *   area (Makrofag, Neutrofil, Mastia) · chain (Dendritik) · projectile (Eos)
 *   zone (Basofil, Treg) · beam (TCD8) · summon (TCD4) · homing (Sel B)
 *   melee (Sel NK)
 *
 * CATATAN PENTING: yang digambar sebagai hero tetap FOTO karakternya.
 * Modul ini hanya menambahkan BENTUK SERANGAN (cincin, garis, zona, entitas),
 * bukan mengganti seni karakter.
 */

import { getData, getMutations } from '../core/data-store.js';

const PH = { anticipation: 0.12, telegraph: 0.25, execution: 0.08, impact: 0.06, recovery: 0.18 };
const URUT = ['anticipation', 'telegraph', 'execution', 'impact', 'recovery'];

function phases() {
  const p = (getData().attacks && getData().attacks.telegraphPhases) || {};
  return {
    anticipation: num(p.anticipation, PH.anticipation),
    telegraph: num(p.telegraph, PH.telegraph),
    execution: num(p.execution, PH.execution),
    impact: num(p.impact, PH.impact),
    recovery: num(p.recovery, PH.recovery),
  };
}
function num(v, dflt) { return typeof v === 'number' && isFinite(v) ? v : dflt; }

/** Konfigurasi satu archetype dari data/attacks.json. */
export function archetypeCfg(id) {
  const list = (getData().attacks && getData().attacks.archetypes) || [];
  return list.find((a) => a.id === id) || null;
}

/** Archetype hero (dari identity.attackArchetype — lihat P1). */
export function archetypeForHero(heroDef, run) {
  const base = (heroDef && heroDef.identity && heroDef.identity.attackArchetype) || null;
  if (!base || !run) return base;
  // P2: mutasi boleh MENGUBAH BENTUK serangan (data/mutations.json →
  // attack.archetypeFrom), mis. Reaksi Berantai mengubah proyektil jadi chain.
  const mods = mutationAttackMods(run);
  const swap = mods.archetypeFrom && mods.archetypeFrom[base];
  return swap || base;
}

/**
 * P2 — Teks perubahan tempur untuk kartu mutasi (modal level-up).
 * Diturunkan dari blok `attack` mutasi + archetype hero yang sedang dipakai,
 * jadi yang tertulis di kartu = yang benar-benar terjadi di arena.
 */
const KEY_LABEL = {
  radius: 'radius', radiusMult: 'radius', dmgMult: 'damage', count: 'jumlah',
  spreadDeg: 'sebaran', speed: 'kecepatan', pierce: 'tembus', turnRate: 'putaran',
  arcDeg: 'busur', length: 'panjang', width: 'lebar', maxHops: 'lompatan',
  hopRadius: 'jarak lompat', decay: 'peluruhan', lifeSec: 'durasi', dpsMult: 'DPS',
  slow: 'perlambat', maxEntities: 'entitas', fireIntervalSec: 'interval tembak',
  castRange: 'jarak jangkau',
};
const PENGALI = new Set(['radiusMult', 'dmgMult', 'dpsMult', 'slow', 'decay', 'turnRate']);

function labelArchetype(id) {
  const cfg = archetypeCfg(id);
  return (cfg && cfg.label) || id || '?';
}

export function describeAttackChange(def, heroDef) {
  const a = def && def.attack;
  if (!a) return '';
  const base = archetypeForHero(heroDef, null);
  if (!base) return '';
  const parts = [];
  const swap = a.archetypeFrom && a.archetypeFrom[base];
  if (swap) parts.push(`Bentuk serangan: ${labelArchetype(base)} → ${labelArchetype(swap)}`);
  const pl = (a.payload && a.payload[base]) || null;
  if (pl) {
    for (const k of Object.keys(pl)) {
      const v = pl[k];
      if (typeof v !== 'number' && typeof v !== 'string') continue;
      const lbl = KEY_LABEL[k] || k;
      parts.push(PENGALI.has(k) ? `${lbl} ×${v}` : `${lbl} ${v}`);
    }
  }
  if (typeof a.dmgMult === 'number' && Math.abs(a.dmgMult - 1) > 1e-6) parts.push(`damage ×${a.dmgMult}`);
  return parts.join(' · ');
}

/**
 * P2 — Mutasi bukan cuma angka: ia boleh mengubah BENTUK & angka serangan.
 * Dibaca dari data/mutations.json → tiap mutasi boleh punya blok `attack`:
 *   { dmgMult: 0.85,                     // pengali damage global payload
 *     archetypeFrom: { melee: 'area' },  // ganti bentuk (hanya bila cocok)
 *     payload: { area: { radiusMult: 1.35 } } } // timpa angka per archetype
 * Urutan: defaults archetype → patternParams hero → mutasi (mutasi terakhir,
 * jadi mutasi selalu menang — itu yang membuatnya terasa sebagai Evolusi).
 */
export function mutationAttackMods(run) {
  const out = { dmgMult: 1, archetypeFrom: null, payload: null, ids: [] };
  const ids = (run && run.activeMutations) || null;
  if (!Array.isArray(ids) || ids.length === 0) return out;
  const defs = (getMutations() && getMutations().mutations) || [];
  for (const id of ids) {
    const def = defs.find((m) => m && m.id === id);
    const a = def && def.attack;
    if (!a) continue;
    out.ids.push(id);
    if (typeof a.dmgMult === 'number' && isFinite(a.dmgMult)) out.dmgMult *= a.dmgMult;
    if (a.archetypeFrom && typeof a.archetypeFrom === 'object') {
      out.archetypeFrom = Object.assign(out.archetypeFrom || {}, a.archetypeFrom);
    }
    if (a.payload && typeof a.payload === 'object') {
      out.payload = out.payload || {};
      for (const k of Object.keys(a.payload)) {
        out.payload[k] = Object.assign(out.payload[k] || {}, a.payload[k]);
      }
    }
  }
  return out;
}

function durasi(atk) {
  const p = phases();
  return {
    anticipation: p.anticipation,
    telegraph: Math.max(p.telegraph, (atk.cfg && atk.cfg.telegraphSec) || 0),
    execution: p.execution,
    impact: p.impact,
    recovery: p.recovery,
  };
}

/**
 * Mulai satu eksekusi archetype. Dipanggil dari tryPulse() (membrane-system).
 * @returns {object|null} state serangan yang disimpan di run.attack
 */
export function beginAttack(game, opts = {}) {
  const run = game && game.run;
  if (!run || !run.player || !run.player.alive) return null;
  const id = archetypeForHero(run.heroDef, run);
  if (!id) return null;
  const cfg = archetypeCfg(id);
  if (!cfg) return null;
  const mods = mutationAttackMods(run);
  const player = run.player;
  const target = cariTarget(game, player, opts);
  const atk = {
    id,
    cfg,
    phase: 'anticipation',
    t: 0,
    durs: durasi({ cfg }),
    stats: opts.stats || null,
    dmgMult: (opts.dmgMult ?? 1) * mods.dmgMult,
    color: (run.heroDef && (run.heroDef.roleColor || run.heroDef.color)) || '#8df7d2',
    // Arah & sasaran dikunci SAAT MULAI supaya telegraph jujur: apa yang
    // tergambar saat menelegraph = apa yang benar-benar terjadi saat eksekusi.
    angle: target ? Math.atan2(target.y - player.y, target.x - player.x) : (player.facing || 0),
    targetX: target ? target.x : player.x + Math.cos(player.facing || 0) * 120,
    targetY: target ? target.y : player.y + Math.sin(player.facing || 0) * 120,
    hits: 0,
    done: false,
  };
  run.attack = atk;
  if (run.effects) {
    run.effects.spawnLabel(player.x, player.y - 56, (cfg.label || id).toUpperCase(), atk.color);
  }
  return atk;
}

function cariTarget(game, player, opts) {
  const run = game.run;
  const reach = Math.max(160, (opts.stats && opts.stats.pulseRadius) || 180) + 60;
  if (!run.collision || typeof run.collision.findNearestEnemy !== 'function') return null;
  try { return run.collision.findNearestEnemy(player.x, player.y, reach, (e) => e && e.alive); } catch { return null; }
}

/** Apakah serangan sedang berjalan (dipakai UI/HUD & penguji). */
export function attackActive(run) {
  return !!(run && run.attack && !run.attack.done);
}

/**
 * Satu langkah maju. Dipanggil tiap frame dari game.update().
 */
export function updateAttack(game, dt) {
  const run = game && game.run;
  const atk = run && run.attack;
  if (!atk || atk.done) return;
  atk.t += dt;
  let d = atk.durs[atk.phase] || 0;
  // maju bisa melewati beberapa fase bila dt besar (lag spike)
  let guard = 0;
  while (atk.t >= d && !atk.done && guard++ < 8) {
    atk.t -= d;
    const idx = URUT.indexOf(atk.phase);
    if (idx < 0 || idx >= URUT.length - 1) { atk.done = true; atk.phase = 'done'; break; }
    const next = URUT[idx + 1];
    atk.phase = next;
    if (next === 'execution') jalankanPayload(game, atk);
    d = atk.durs[atk.phase] || 0;
  }
  if (atk.phase === 'done') atk.done = true;
}

/** 0..1 progres dalam fase sekarang (untuk menggambar telegraph). */
export function attackProgress(run) {
  const atk = run && run.attack;
  if (!atk || atk.done) return 0;
  const d = atk.durs[atk.phase] || 1;
  return Math.max(0, Math.min(1, atk.t / d));
}

// ---------------------------------------------------------------- payload

function damageBase(atk, run) {
  const st = atk.stats || {};
  const dps = typeof st.contactDps === 'number' ? st.contactDps : 0;
  if (dps > 0) return dps;
  return (run.player && run.player.stats && run.player.stats.damage) || 8;
}

function kena(game, atk, enemy, dmg, opts = {}) {
  if (!enemy || !enemy.alive) return false;
  const run = game.run;
  const finalDmg = Math.max(1, dmg);
  let died = false;
  try { died = enemy.takeDamage(finalDmg); } catch { return false; }
  atk.hits += 1;
  try { game.provokeEnemy && game.provokeEnemy(enemy); } catch { /* abaikan */ }
  try {
    game.spawnHitFeedback && game.spawnHitFeedback(enemy, finalDmg, died, false, { sourceKind: opts.sourceKind || 'archetype' });
  } catch { /* abaikan */ }
  if (died) { try { game.onEnemyKilled && game.onEnemyKilled(enemy, 'pulse'); } catch { /* abaikan */ } }
  void run;
  return died;
}

/**
 * Angka payload: archetype jadi dasar, lalu patternParams hero MENIMPA kunci
 * yang sama. Jadi satu archetype terasa beda per hero — area Makrofag cincin
 * besar & moderat, area Neutrofil sempit tapi tajam (lihat heroes.json).
 */
function payloadUntuk(run, atk) {
  const dasar = (atk.cfg && atk.cfg.payload) || {};
  const pp = (run.heroDef && run.heroDef.patternParams) || {};
  const mut = (run && mutationAttackMods(run).payload) || null;
  const mutA = (mut && atk && mut[atk.id]) || null;
  const out = {};
  for (const k of Object.keys(dasar)) {
    if (mutA && mutA[k] != null) out[k] = mutA[k];
    else out[k] = (pp[k] != null ? pp[k] : dasar[k]);
  }
  // Kunci yang hanya ada di mutasi (bukan di defaults) tetap ikut terpakai.
  if (mutA) for (const k of Object.keys(mutA)) if (out[k] == null) out[k] = mutA[k];
  return out;
}

function jalankanPayload(game, atk) {
  const run = game.run;
  if (!run || !run.player) return;
  const player = run.player;
  const p = payloadUntuk(run, atk);
  const base = damageBase(atk, run);
  const dmg = Math.max(4, base * (p.dmgMult || 1)) * atk.dmgMult;
  const effects = run.effects;

  switch (atk.id) {
    case 'area': {
      // Cincin ledakan di sekitar hero — identitas: "berdiri di tengah ramai"
      const R = Math.max(60, ((atk.stats && atk.stats.pulseRadius) || 130) * (p.radiusMult || 1.15));
      const kenaList = [];
      run.collision.grid.queryCircle(player.x, player.y, R + 60, (e) => {
        if (!e.alive) return;
        if (Math.hypot(e.x - player.x, e.y - player.y) > R + e.radius * 0.5) return;
        kenaList.push(e);
      });
      for (const e of kenaList) kena(game, atk, e, dmg, { sourceKind: 'area' });
      if (effects) { effects.spawnBlast(player.x, player.y, R, atk.color); effects.spawnBurst(player.x, player.y, atk.color, 12, 220, 4); }
      break;
    }
    case 'beam': {
      // Garis lurus searah hadap — identitas: jarak jauh, satu jalur, presisi
      const len = p.length || 320;
      const halfW = (p.width || 26) * 0.5;
      const ca = Math.cos(atk.angle);
      const sa = Math.sin(atk.angle);
      const kenaList = [];
      run.collision.grid.queryCircle(player.x + ca * len * 0.5, player.y + sa * len * 0.5, len * 0.5 + 80, (e) => {
        if (!e.alive) return;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const sepanjang = dx * ca + dy * sa;           // proyeksi ke garis
        if (sepanjang < 0 || sepanjang > len) return;  // hanya di depan
        const sisi = Math.abs(-dx * sa + dy * ca);     // jarak tegak lurus
        if (sisi > halfW + e.radius * 0.5) return;
        kenaList.push(e);
      });
      for (const e of kenaList) kena(game, atk, e, dmg, { sourceKind: 'beam' });
      if (effects) {
        const ex = player.x + ca * len;
        const ey = player.y + sa * len;
        effects.spawnBurst(ex, ey, atk.color, 10, 260, 3);
        effects.spawnImpact(ex, ey, atk.color, { big: true });
      }
      break;
    }
    case 'chain': {
      // Loncat antar musuh — identitas: multi-target, makin jauh makin lemah
      const hops = Math.max(0, (p.maxHops != null ? p.maxHops : (atk.cfg && atk.cfg.maxHops) || 2));
      const radius = (p.hopRadius != null ? p.hopRadius : (atk.cfg && atk.cfg.hopRadius) || 120);
      const decay = (p.decay != null ? p.decay : (atk.cfg && atk.cfg.decay) != null ? atk.cfg.decay : 0.4);
      const sudah = new Set();
      let cur = null;
      let x = player.x;
      let y = player.y;
      let d = dmg;
      for (let i = 0; i <= hops; i++) {
        const next = run.collision.findNearestEnemy(x, y, i === 0 ? radius * 3 : radius, (e) => e && e.alive && !sudah.has(e));
        if (!next) break;
        sudah.add(next);
        if (cur && effects) effects.spawnBurst(next.x, next.y, atk.color, 6, 180, 3);
        kena(game, atk, next, d, { sourceKind: 'chain' });
        cur = next; x = next.x; y = next.y;
        d *= (1 - decay);
      }
      break;
    }
    case 'projectile':
    case 'homing': {
      const n = Math.max(1, p.count || (atk.id === 'homing' ? 4 : 3));
      const spread = ((p.spreadDeg || (atk.id === 'homing' ? 40 : 14)) * Math.PI) / 180;
      const speed = p.speed || (atk.id === 'homing' ? 380 : 440);
      for (let i = 0; i < n; i++) {
        const a = atk.angle - spread / 2 + (n === 1 ? 0 : (spread / (n - 1)) * i);
        try {
          game.spawnProjectile({
            pattern: atk.id === 'homing' ? 'homing' : 'pierce',
            x: player.x + Math.cos(a) * (player.radius + 4),
            y: player.y + Math.sin(a) * (player.radius + 4),
            angle: a,
            speed,
            damage: dmg,
            pierce: p.pierce || 1,
            turnRate: p.turnRate || (atk.id === 'homing' ? 5.5 : 0),
            color: atk.color,
          });
        } catch { /* abaikan bila sistem proyektil belum siap */ }
      }
      if (effects) effects.spawnBurst(player.x, player.y, atk.color, 6, 200, 3);
      break;
    }
    case 'melee': {
      // Busur tebasan di depan hero — identitas: jarak dekat, arah penting
      const radius = p.radius || 82;
      const arcRad = ((p.arcDeg || (atk.cfg && atk.cfg.arcDeg) || 110) * Math.PI) / 180;
      try { game.applyMeleeSwipe(player, atk.angle, radius, arcRad, dmg); } catch { /* abaikan */ }
      if (effects) effects.spawnSwipe(player.x, player.y, atk.angle, radius, arcRad, atk.color);
      break;
    }
    case 'zone': {
      // Medan yang TINGGAL di lantai — identitas: kendali wilayah
      const mem = run.membrane;
      if (!mem) break;
      const r = p.radius || 120;
      const castR = p.castRange || 140;
      const zx = player.x + Math.cos(atk.angle) * castR * 0.5;
      const zy = player.y + Math.sin(atk.angle) * castR * 0.5;
      mem.clouds.push({
        x: zx, y: zy, r,
        t: 0, life: p.lifeSec || 3,
        dps: Math.max(2, base * (p.dpsMult || 0.8)),
        tick: 0,
        color: p.color || '#b678e0',
        ring: p.ring || '#8e44ad',
        slow: p.slow != null ? p.slow : 0.7,
      });
      if (effects) effects.spawnBlast(zx, zy, r, p.color || '#b678e0');
      break;
    }
    case 'summon': {
      // Memanggil entitas biologis — identitas: bertarung bersama, bukan sendiri
      const maks = p.maxEntities || (atk.cfg && atk.cfg.maxEntities) || 3;
      if (!run.summons) run.summons = [];
      run.summons = run.summons.filter((s) => s && s.t < s.life);
      const slot = run.summons.length;
      if (slot >= maks) {
        // sudah penuh → perpanjang umur yang paling tua (tetap terasa responsif)
        if (run.summons[0]) run.summons[0].t = 0;
        break;
      }
      const ang = (slot / Math.max(1, maks)) * Math.PI * 2;
      run.summons.push({
        x: player.x + Math.cos(ang) * 46,
        y: player.y + Math.sin(ang) * 46,
        angle: ang,
        radius: 11,
        t: 0,
        life: p.lifeSec || 12,
        cd: 0.35,
        fireInterval: p.fireIntervalSec || 0.9,
        damage: Math.max(3, base * (p.dpsMult || 0.9)),
        sprite: p.sprite || 'assets/sprites/hero_bcell_idle.png',
        color: atk.color,
      });
      if (effects) {
        effects.spawnBurst(player.x, player.y, atk.color, 12, 200, 4);
        effects.spawnLabel(player.x, player.y - 44, 'PASUKAN!', atk.color);
      }
      break;
    }
    default: break;
  }
}

// ------------------------------------------------------- summon (berjalan)

/** Update entitas hasil SUMMON: mengorbit hero & menembak musuh terdekat. */
export function updateSummons(game, dt) {
  const run = game && game.run;
  if (!run || !run.summons || run.summons.length === 0) return;
  const player = run.player;
  for (let i = run.summons.length - 1; i >= 0; i--) {
    const s = run.summons[i];
    s.t += dt;
    if (s.t >= s.life || !player || !player.alive) { run.summons.splice(i, 1); continue; }
    s.angle += dt * 1.9;
    const tx = player.x + Math.cos(s.angle) * 46;
    const ty = player.y + Math.sin(s.angle) * 46;
    const k = Math.min(1, dt * 5);
    s.x += (tx - s.x) * k;
    s.y += (ty - s.y) * k;
    s.cd -= dt;
    if (s.cd > 0) continue;
    const target = run.collision ? run.collision.findNearestEnemy(s.x, s.y, 300, (e) => e && e.alive) : null;
    if (!target) { s.cd = 0.25; continue; }
    s.cd = s.fireInterval;
    const a = Math.atan2(target.y - s.y, target.x - s.x);
    try {
      game.spawnProjectile({
        pattern: 'homing',
        x: s.x, y: s.y, angle: a,
        speed: 360,
        damage: s.damage,
        pierce: 1,
        turnRate: 4.5,
        color: s.color,
      });
    } catch { /* abaikan */ }
  }
}

// ------------------------------------------------------------- menggambar

/**
 * Gambar bentuk TELEGRAPH di lantai (dan kilasan saat execution/impact).
 * Dipanggil dari game.render() dengan projector lantai `ground(x, y)`.
 */
export function drawAttack(ctx, run, ground) {
  const atk = run && run.attack;
  if (!atk || atk.done) return;
  const player = run.player;
  if (!player) return;
  const p = payloadUntuk(run, atk);
  const prog = attackProgress(run);
  const fase = atk.phase;

  const garis = (warna, alpha, tebal = 3, putus = null) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = warna;
    ctx.lineWidth = tebal;
    if (putus) ctx.setLineDash(putus);
  };
  const bersih = () => { ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.restore(); };

  if (fase === 'telegraph') {
    // Bentuk tumbuh pelan dari 0 → penuh: pemain membaca "apa" dan "ke mana".
    const t = prog;
    if (atk.id === 'area') {
      const R = Math.max(60, ((atk.stats && atk.stats.pulseRadius) || 130) * (p.radiusMult || 1.15)) * (0.25 + 0.75 * t);
      ground(player.x, player.y);
      garis(atk.color, 0.35 + 0.35 * t, 3, [9, 7]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, R, 0, Math.PI * 2);
      ctx.stroke();
      bersih();
    } else if (atk.id === 'beam') {
      const len = (p.length || 320) * (0.3 + 0.7 * t);
      ground(player.x, player.y);
      const ca = Math.cos(atk.angle);
      const sa = Math.sin(atk.angle);
      const w = (p.width || 26) * 0.5;
      ctx.globalAlpha = 0.3 + 0.3 * t;
      ctx.fillStyle = atk.color;
      ctx.beginPath();
      ctx.moveTo(player.x - sa * w, player.y + ca * w);
      ctx.lineTo(player.x + ca * len - sa * w, player.y + sa * len + ca * w);
      ctx.lineTo(player.x + ca * len + sa * w, player.y + sa * len - ca * w);
      ctx.lineTo(player.x + sa * w, player.y - ca * w);
      ctx.closePath();
      ctx.fill();
      bersih();
    } else if (atk.id === 'zone') {
      const r = (p.radius || 120) * (0.35 + 0.65 * t);
      const castR = p.castRange || 140;
      ground(atk.targetX, atk.targetY);
      garis(p.ring || '#8e44ad', 0.4 + 0.3 * t, 3, [8, 6]);
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(atk.angle) * castR * 0.5, player.y + Math.sin(atk.angle) * castR * 0.5, r, 0, Math.PI * 2);
      ctx.stroke();
      bersih();
    } else if (atk.id === 'melee') {
      const radius = p.radius || 82;
      const arcRad = ((p.arcDeg || (atk.cfg && atk.cfg.arcDeg) || 110) * Math.PI) / 180;
      ground(player.x, player.y);
      garis(atk.color, 0.3 + 0.35 * t, 3, [7, 6]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius * (0.45 + 0.55 * t), atk.angle - arcRad / 2, atk.angle + arcRad / 2);
      ctx.stroke();
      bersih();
    } else {
      // chain / projectile / homing / summon: tandai sasaran
      ground(atk.targetX, atk.targetY);
      garis(atk.color, 0.3 + 0.35 * t, 2.5, [6, 6]);
      ctx.beginPath();
      ctx.arc(atk.targetX, atk.targetY, (18 + 14 * (1 - t)) * (atk.id === 'chain' ? 2.2 : 1), 0, Math.PI * 2);
      ctx.stroke();
      bersih();
      ground(player.x, player.y);
      garis(atk.color, 0.25 + 0.25 * t, 2, [5, 8]);
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(atk.targetX, atk.targetY);
      ctx.stroke();
      bersih();
    }
  } else if (fase === 'execution' || fase === 'impact') {
    // Kilasan bentuk penuh sesaat — "impact" terasa, bukan cuma angka.
    const fade = fase === 'execution' ? 0.75 : 0.4 * (1 - prog);
    if (atk.id === 'beam') {
      const len = p.length || 320;
      const w = (p.width || 26) * 0.6;
      ground(player.x, player.y);
      const ca = Math.cos(atk.angle);
      const sa = Math.sin(atk.angle);
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(player.x - sa * w, player.y + ca * w);
      ctx.lineTo(player.x + ca * len - sa * w, player.y + sa * len + ca * w);
      ctx.lineTo(player.x + ca * len + sa * w, player.y + sa * len - ca * w);
      ctx.lineTo(player.x + sa * w, player.y - ca * w);
      ctx.closePath();
      ctx.fill();
      bersih();
    } else if (atk.id === 'area') {
      const R = Math.max(60, ((atk.stats && atk.stats.pulseRadius) || 130) * (p.radiusMult || 1.15));
      ground(player.x, player.y);
      garis('#ffffff', fade, 5);
      ctx.beginPath();
      ctx.arc(player.x, player.y, R * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      bersih();
    }
  }
}
