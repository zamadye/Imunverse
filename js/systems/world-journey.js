/**
 * world-journey.js — P4: DUNIA KONTINU (PHAGOS_V2_REBUILD.txt §21–§30, §47).
 *
 * Tidak ada lagi "pilih stage → loading → main". Perjalanan biologis berjalan
 * TERUS: pemain bertempur, dan DI TENGAH PERTEMPURAN lingkungan berubah.
 *
 *   LUNG → BRONCHIOLE → ALVEOLI → CAPILLARY → BLOODSTREAM → HEART → …
 *
 * Tiga aturan yang tidak bisa ditawar:
 *   1. TRANSITION ZONE (§24): pergantian zona berlangsung 20–60 dtk (data)
 *      dengan lingkungan LAMA+BARU dan musuh LAMA+BARU bercampur. Tidak ada
 *      layar loading, tidak ada stage select.
 *   2. LINGKUNGAN MENGUBAH GAMEPLAY (§25): tiap zona punya mekanik nyata —
 *      arus darah mendorong, kapiler menyempitkan ruang, jantung berdenyut.
 *      Bukan sekadar ganti gambar latar.
 *   3. WAVE = PACING, BUKAN ARENA (§27): wave hanya menandai intensitas spawn
 *      di dalam zona. Progresi dunia = urutan zona + landmark (§47).
 */

import { getData } from '../core/data-store.js';
import { setArenaPalette } from '../render/background.js';
import { audio } from './audio-system.js';
import { bindWorldJourney } from './spawn-system.js';

// Sambungkan pool musuh zona ke spawn-system (satu arah — spawn-system tidak
// mengimpor modul ini, jadi tidak ada impor melingkar).
bindWorldJourney({ enemyPoolFor });

function zones() {
  const z = getData() && getData().zones;
  return (z && z.route) ? z.route : [];
}

function zoneAt(i) {
  const list = zones();
  if (!list.length) return null;
  return list[Math.max(0, Math.min(list.length - 1, i))] || null;
}

function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

// ---------------------------------------------------------------- warna
function hexToRgb(h) {
  const s = String(h || '#000000').replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Campur dua warna hex (dipakai untuk transisi lingkungan yang mulus). */
export function mixHex(a, b, t) {
  const A = hexToRgb(a); const B = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex({ r: A.r + (B.r - A.r) * k, g: A.g + (B.g - A.g) * k, b: A.b + (B.b - A.b) * k });
}

function arenaPalet(arenaId) {
  const list = (getData() && getData().arenas && getData().arenas.arenas) || [];
  const a = list.find((x) => x.id === arenaId);
  const first = list[0];
  const pal = (a || first || {}).palette || {};
  return {
    hex: pal.hex || '#e2ecc9',
    vignette: pal.vignette || 'rgba(24,70,52,0.28)',
    props: pal.props || ['prop_weed.png', 'prop_cell.png'],
    cornerWeed: pal.cornerWeed, cornerReef: pal.cornerReef,
    ground: pal.ground || { shade: '50,100,70', features: [] },
    ambient: pal.ambient, element: pal.element, pulse: pal.pulse, bubbles: pal.bubbles,
  };
}

/**
 * Palet hasil campuran dua zona. Fitur tanah ikut bercampur: fitur zona lama
 * memudar (1-t) dan zona baru menguat (t) — jadi lingkungan lama & baru
 * benar-benar terlihat bersamaan selama transisi (§24).
 */
export function blendedPalette(fromZoneId, toZoneId, t) {
  const list = zones();
  const a = list.find((z) => z.id === fromZoneId) || list[0];
  const b = list.find((z) => z.id === toZoneId) || a;
  const pa = arenaPalet(a && a.arenaId);
  const pb = arenaPalet(b && b.arenaId);
  const k = Math.max(0, Math.min(1, t));
  const scale = (feats, f) => (feats || []).map((x) => ({ ...x,
    alpha: (x.alpha == null ? 0.5 : x.alpha) * f,
    density: (x.density == null ? 0.5 : x.density) * f,
  }));
  return {
    hex: mixHex(pa.hex, pb.hex, k),
    vignette: k < 0.5 ? pa.vignette : pb.vignette,
    props: k < 0.5 ? pa.props : pb.props,
    cornerWeed: k < 0.5 ? pa.cornerWeed : pb.cornerWeed,
    cornerReef: k < 0.5 ? pa.cornerReef : pb.cornerReef,
    ambient: pb.ambient || pa.ambient,
    element: pb.element || pa.element,
    pulse: pb.pulse || pa.pulse,
    bubbles: pb.bubbles || pa.bubbles,
    ground: {
      shade: pa.ground.shade,
      // Campur FITUR: yang lama memudar, yang baru menguat.
      features: [...scale(pa.ground.features, 1 - k), ...scale(pb.ground.features, k)],
    },
  };
}

// ---------------------------------------------------------------- state
/** Mulai perjalanan di zona pertama. */
export function initJourney(run) {
  const list = zones();
  const start = list[0] || null;
  run.journey = {
    index: 0,
    zoneId: start ? start.id : null,
    nextIndex: start ? Math.min(1, list.length - 1) : 0,
    phase: 'combat',        // 'combat' | 'transition'
    t: 0,                   // waktu di fase sekarang
    waveInZone: 1,
    lastWave: 1,
    blend: 0,
    landmark: null,         // {x, y, zoneId, t} — penanda yang diingat pemain
    drift: { x: 0, y: 0 },  // arus (bloodstream)
    driftT: 0,
    mechanicT: 0,           // timer mekanik lingkungan
    heartBeats: 0,          // event masuk jantung (§28)
    visited: [start ? start.id : null].filter(Boolean),
  };
  if (start) {
    const pal = arenaPalet(start.arenaId);
    setArenaPalette(pal);
    run.journey.landmark = { zoneId: start.id, t: 0 };
  }
  return run.journey;
}

/** Zona aktif sekarang. */
export function currentZone(run) {
  const j = run && run.journey;
  if (!j) return zoneAt(0);
  return zoneAt(j.index);
}

/** Zona berikutnya (sedang bercampur saat transisi). */
export function nextZone(run) {
  const j = run && run.journey;
  if (!j) return zoneAt(1);
  return zoneAt(j.nextIndex);
}

/** Apakah sedang di transition zone? */
export function inTransition(run) {
  return !!(run && run.journey && run.journey.phase === 'transition');
}

/** 0..1 — seberapa jauh perjalanan (untuk HUD, §26). */
export function journeyProgress(run) {
  const list = zones();
  if (!list.length) return 0;
  const j = run && run.journey;
  if (!j) return 0;
  const per = 1 / list.length;
  return Math.min(1, (j.index + (j.phase === 'transition' ? j.blend : 0)) * per);
}

/** Data minimal untuk HUD: zona sekarang, zona berikutnya, landmark (§26). */
export function journeyHud(run) {
  const cur = currentZone(run);
  const nxt = nextZone(run);
  const j = run && run.journey;
  return {
    zone: cur ? cur.name : '',
    zoneId: cur ? cur.id : '',
    next: nxt && nxt !== cur ? nxt.name : '',
    progress: journeyProgress(run),
    waveInZone: j ? j.waveInZone : 1,
    wavesPerZone: cur ? num(cur.wavesPerZone, 3) : 3,
    transitioning: inTransition(run),
    blend: j ? j.blend : 0,
    landmark: j && j.landmark ? (cur ? cur.landmark : '') : '',
  };
}

/**
 * Kolam musuh untuk zona sekarang. Saat transisi, musuh LAMA dan BARU
 * bercampur dengan bobot mengikuti `blend` (§24).
 */
export function enemyPoolFor(run) {
  const cur = currentZone(run);
  const nxt = nextZone(run);
  const j = run && run.journey;
  if (!cur) return null;
  const k = j && j.phase === 'transition' ? j.blend : 0;
  const pool = new Map();
  const add = (ids, w) => {
    for (const id of ids || []) pool.set(id, (pool.get(id) || 0) + w);
  };
  add(cur.enemies, 1 - k * 0.5);
  if (nxt && nxt !== cur && k > 0) add(nxt.enemies, k);
  return pool; // Map<enemyId, bobot>
}

// ---------------------------------------------------------------- update
/**
 * Satu langkah perjalanan dunia. Dipanggil tiap frame dari game.update()
 * SETELAH spawn-system (supaya kenaikan wave terbaca di frame yang sama).
 */
export function updateJourney(game, dt) {
  const run = game && game.run;
  if (!run) return;
  let j = run.journey;
  if (!j) j = initJourney(run);
  const list = zones();
  if (!list.length) return;

  if (j.landmark) j.landmark.t = (j.landmark.t || 0) + dt;

  // 1. Wave hanya PACING (§27): hitung wave di dalam zona.
  const wave = run.spawnSys ? run.spawnSys.wave : 1;
  if (wave !== j.lastWave) {
    const naik = Math.max(0, wave - j.lastWave);
    j.waveInZone += naik;
    j.lastWave = wave;
  }

  // 2. Fase: pertempuran → transisi → zona baru (tanpa loading).
  const cur = zoneAt(j.index);
  const perZone = num(cur && cur.wavesPerZone, 3);
  if (j.phase === 'combat') {
    if (j.waveInZone > perZone && j.index < list.length - 1) {
      j.phase = 'transition';
      j.t = 0;
      j.blend = 0;
      j.nextIndex = j.index + 1;
      const nxt = zoneAt(j.nextIndex);
      try {
        run.effects.spawnLabel(run.player.x, run.player.y - 70, `MENUJU ${(nxt && nxt.name || '').toUpperCase()}`, '#8df7d2');
      } catch { /* abaikan */ }
      // Event khusus masuk JANTUNG (§28): dua denyut besar — penanda zona
      // datang dari getaran & dorongan, bukan teks level bernomor.
      if (nxt && nxt.heartEntry) {
        j.heartBeats = 2;
        j.heartBeatT = 1.0; // denyut pertama 1 dtk setelah transisi mulai
      }
    }
  } else {
    const dur = num(cur && cur.transitionSec, 30);
    j.t += dt;
    j.blend = Math.max(0, Math.min(1, j.t / dur));
    if (j.t >= dur) {
      // Komit ke zona baru — landmark muncul, lingkungan berganti penuh.
      j.index = j.nextIndex;
      j.phase = 'combat';
      j.t = 0;
      j.blend = 0;
      j.waveInZone = 1;
      const now = zoneAt(j.index);
      if (now) {
        j.zoneId = now.id;
        j.visited.push(now.id);
        j.landmark = { zoneId: now.id, t: 0 };
        setArenaPalette(arenaPalet(now.arenaId));
        try {
          run.effects.spawnLabel(run.player.x, run.player.y - 70, `⬡ ${now.landmark}`, '#f5c64f');
          run.effects.spawnBlast(run.player.x, run.player.y, 220, '#f5c64f');
        } catch { /* abaikan */ }
        try { game.emit && game.emit('landmark', { zoneId: now.id, landmark: now.landmark }); } catch { /* abaikan */ }
      }
    }
  }

  // 3. Lingkungan: warna & fitur bercampur saat transisi (§24).
  if (j.phase === 'transition') {
    setArenaPalette(blendedPalette(zoneAt(j.index).id, zoneAt(j.nextIndex).id, j.blend));
  }

  // 4. Mekanik lingkungan mengubah gameplay (§25).
  applyMechanics(game, dt);
}

/** Terapkan mekanik zona aktif (arus, ruang sempit, denyut, oksigen…). */
function applyMechanics(game, dt) {
  const run = game.run;
  const j = run.journey;
  const z = zoneAt(j.index);
  if (!z) return;
  const p = z.params || {};
  const t = (j.mechanicT += dt);
  const player = run.player;

  switch (z.mechanic) {
    case 'oxygenMucus': {
      // Paru: kantung oksigen menyembuhkan; lendir memperlambat (bahaya napas).
      if (t >= num(p.oxygenEverySec, 18)) {
        j.mechanicT = 0;
        try { player.heal(num(p.oxygenHeal, 6)); run.effects.spawnLabel(player.x, player.y - 40, '+OKSIGEN', '#8df7d2'); } catch { /* abaikan */ }
      }
      if (t >= num(p.mucusEverySec, 22) * 0.5 && !j.mucusDone) {
        j.mucusDone = true;
        const a = Math.random() * Math.PI * 2;
        const d = 220 + Math.random() * 160;
        run.hazards.push({
          x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d,
          r: num(p.mucusRadius, 95), dps: num(p.mucusDps, 3), life: 12, slow: num(p.mucusSlow, 0.65),
        });
      }
      break;
    }
    case 'narrowPath':
    case 'narrowMovement': {
      // Ruang menyempit: batas arena mengecil perlahan ke radius zona.
      const target = num(p.arenaRadius, 560);
      const B = run.arenaBounds;
      if (B && typeof B.r === 'number' && B.r > target) {
        B.r = Math.max(target, B.r - dt * 26);
      }
      break;
    }
    case 'gasExchange': {
      if (t >= num(p.healEverySec, 20)) {
        j.mechanicT = 0;
        try { player.heal(num(p.healAmount, 5)); run.effects.spawnLabel(player.x, player.y - 40, '+OKSIGEN', '#8df7d2'); } catch { /* abaikan */ }
      }
      break;
    }
    case 'bloodCurrent': {
      // Arus darah: mendorong pemain & musuh (§25).
      j.driftT += dt;
      if (j.driftT >= num(p.turnEverySec, 14)) {
        j.driftT = 0;
        const a = Math.random() * Math.PI * 2;
        const s = num(p.driftStrength, 48);
        j.drift.x = Math.cos(a) * s;
        j.drift.y = Math.sin(a) * s;
      }
      const dx = j.drift.x * dt; const dy = j.drift.y * dt;
      player.x += dx; player.y += dy;
      for (const e of run.enemies) if (e.alive) { e.x += dx * 0.75; e.y += dy * 0.75; }
      break;
    }
    case 'heartbeatPulse': {
      // Jantung: denyut berkala menggetarkan & mendorong segalanya.
      const iv = num(p.intervalSec, 3.2);
      if (t >= iv) {
        j.mechanicT = 0;
        const F = num(p.pushForce, 265);
        for (const e of run.enemies) {
          if (!e.alive) continue;
          const a = Math.atan2(e.y - player.y, e.x - player.x);
          e.x += Math.cos(a) * F * 0.12; e.y += Math.sin(a) * F * 0.12;
        }
        player.x += Math.cos(player.facing || 0) * F * 0.05;
        player.y += Math.sin(player.facing || 0) * F * 0.05;
        try {
          run.camera.addShake(num(p.shake, 0.8));
          run.effects.spawnBlast(player.x, player.y, num(p.ringRadius, 240), '#ff8f8f');
        } catch { /* abaikan */ }
        try { audio.heartbeat(); } catch { /* abaikan */ }
      }
      break;
    }
    default: break;
  }

  // Event masuk JANTUNG (§28): dua denyut BESAR saat transisi — pemain sadar
  // "saya sudah sampai jantung" lewat getaran & dorongan, bukan teks stage.
  if (j.heartBeats > 0 && j.phase === 'transition') {
    const nxt = zoneAt(j.nextIndex);
    if (nxt && nxt.heartEntry && j.t >= (j.heartBeatT || 1)) {
      const iv = num((nxt.params || {}).intervalSec, 3.2);
      j.heartBeatT = (j.heartBeatT || 1) + iv * 0.8;
      j.heartBeats -= 1;
      try {
        run.camera.addShake(1.1);
        run.effects.spawnBlast(player.x, player.y, 320, '#ff6b6b');
        audio.heartbeat();
      } catch { /* abaikan */ }
      for (const e of run.enemies) {
        if (!e.alive) continue;
        const a = Math.atan2(e.y - player.y, e.x - player.x);
        e.x += Math.cos(a) * 30; e.y += Math.sin(a) * 30;
      }
    }
  }
}

/**
 * Gambar landmark (§47): struktur world-anchored yang diingat pemain —
 * "saya sudah melewati gugus alveoli itu".
 */
export function drawLandmark(ctx, run, project) {
  const j = run && run.journey;
  if (!j || !j.landmark) return;
  const z = zoneAt(j.index);
  if (!z) return;
  const a = Math.max(0, 1 - (j.landmark.t || 0) / 6); // memudar setelah 6 dtk
  if (a <= 0) return;
  const p = project(run.player.x + 260, run.player.y - 180);
  if (!p) return;
  ctx.save();
  ctx.globalAlpha = 0.5 * a;
  ctx.strokeStyle = '#f5c64f';
  ctx.lineWidth = 2;
  if (z.id === 'lung' || z.id === 'alveoli') {
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(ang) * 26, p.y + Math.sin(ang) * 26, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (z.id === 'heart') {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 40, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 24, Math.PI + 0.3, -0.3);
    ctx.stroke();
  } else if (z.id === 'bloodstream' || z.id === 'capillary') {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(p.x - 60, p.y + i * 18);
      ctx.quadraticCurveTo(p.x, p.y + i * 18 + 12, p.x + 60, p.y + i * 18);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.75 * a;
  ctx.fillStyle = '#ffe9b0';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(z.landmark, p.x, p.y - 52);
  ctx.restore();
}

/** Untuk penguji: paksa pindah zona (tanpa menunggu wave). */
export function _forceAdvance(run) {
  const j = run && run.journey;
  if (!j) return null;
  j.waveInZone = num(zoneAt(j.index) && zoneAt(j.index).wavesPerZone, 3) + 1;
  return j;
}
