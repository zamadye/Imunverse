/**
 * mako-animation.js — Mako V2 motion identity.
 *
 * Visual-only procedural animation layer for the authored Mako V2 sprites.
 * It never changes movement, combat, cooldown, hitbox, or progression values.
 *
 * Motion personality: heavy / powerful / friendly.
 * - idle: breathing and relaxed weight shift
 * - move: heavy steps, torso sway, readable walk/run weight
 * - pulse: anticipation → engulfing impact → recovery
 * - skills: body-language cues for Taunt, Defensive Stance, and Devour
 * - reactions: hit recoil, low-HP instability, spawn and victory/death pose
 */

const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const easeOut = (t) => 1 - (1 - clamp(t)) ** 3;
const easeIn = (t) => clamp(t) ** 2;
const smooth = (t) => t * t * (3 - 2 * t);

export function createMakoMotionState() {
  return {
    age: 0,
    spawnT: 0.72,
    hitT: 0,
    skillT: 0,
    skillId: null,
    prevPulseT: -1,
    prevIframes: 0,
    prevSkillCd: [],
    deathAt: 0,
    victoryAt: 0,
  };
}

/**
 * Observe existing gameplay state and record only visual animation moments.
 * Called from the game loop after the existing skill/membrane systems have
 * updated. No gameplay state is written here.
 */
export function updateMakoMotion(run, dt) {
  const state = run?.makoMotion;
  const player = run?.player;
  if (!state || !player || run.heroDef?.id !== 'macrophage') return;

  state.age += dt;
  state.spawnT = Math.max(0, state.spawnT - dt);
  state.hitT = Math.max(0, state.hitT - dt);
  state.skillT = Math.max(0, state.skillT - dt);

  const pulseT = run.membrane?.pulseAnimT ?? -1;
  if (pulseT >= 0 && state.prevPulseT < 0) {
    // The membrane system already owns the pulse timing and damage. This is
    // only the character's anticipation/impact/recovery pose window.
    state.skillT = 0;
    state.skillId = null;
  }
  state.prevPulseT = pulseT;

  const isIframed = player.iframes > 0;
  if (isIframed && state.prevIframes <= 0) state.hitT = 0.26;
  state.prevIframes = isIframed ? 1 : 0;

  const slots = run.skills?.slots || [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const current = slot?.cdLeft || 0;
    const previous = state.prevSkillCd[i] || 0;
    // A cooldown rising means an existing passive skill just triggered.
    if (current > previous + 0.05) {
      state.skillT = slot.def?.id === 'devour' ? 0.86 : 0.5;
      state.skillId = slot.def?.id || null;
    }
    state.prevSkillCd[i] = current;
  }

  if (!player.alive && !state.deathAt) {
    state.deathAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
  if (run.victory && !state.victoryAt) {
    state.victoryAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}

/**
 * Return a render-only pose for Mako. Values are deliberately small enough
 * to keep the authored silhouette readable at gameplay scale.
 */
export function getMakoMotionStyle(player, run, state, time) {
  const speed = Math.hypot(player.vx || 0, player.vy || 0);
  const maxSpeed = Math.max(1, player.stats?.speed || 130);
  const speed01 = clamp(speed / maxSpeed);
  const moving = !!player.moving || speed > 4;
  const phase = player.walkPhase || 0;
  const t = state?.age ?? time;

  let scaleX = 1;
  let scaleY = 1;
  let bob = 0;
  let tilt = 0;
  let lunge = 0;
  let alpha = 1;
  let spriteState = 'idle';

  if (moving) {
    // Heavy foot cadence: the torso compresses on each planted step and
    // relaxes between steps. Run speed adds a stronger forward commitment.
    const step = Math.sin(phase);
    const planted = Math.abs(step);
    bob = planted * (1.2 + speed01 * 2.6);
    scaleX += planted * (0.025 + speed01 * 0.025);
    scaleY -= planted * (0.035 + speed01 * 0.045);
    tilt += Math.sin(phase * 0.5) * (0.018 + speed01 * 0.035);
    tilt += speed01 * 0.018;
  } else {
    // Friendly, relaxed breathing and a slow weight shift while idle.
    const breath = Math.sin(t * 2.15);
    const weight = Math.sin(t * 1.08 + 0.7);
    scaleX -= breath * 0.014;
    scaleY += breath * 0.032;
    bob = breath * 0.85;
    tilt += weight * 0.032;
  }

  const mem = run.membrane;
  const pulseT = mem?.pulseAnimT ?? -1;
  if (pulseT >= 0) {
    const duration = 0.4;
    const p = clamp(pulseT / duration);
    const peak = mem?.pulsePeak ?? (p < 0.4 ? easeOut(p / 0.4) : 1 - easeIn((p - 0.4) / 0.6));
    spriteState = 'attack';
    lunge = peak * 8;
    if (p < 0.38) {
      // Anticipation: crouch and gather mass before the engulfing burst.
      const k = smooth(p / 0.38);
      scaleX -= 0.055 * k;
      scaleY += 0.075 * k;
      tilt -= 0.045 * k;
      bob -= 1.5 * k;
    } else if (p < 0.7) {
      // Impact: large torso commitment and a readable belly expansion.
      const k = smooth((p - 0.38) / 0.32);
      scaleX += 0.13 * k;
      scaleY -= 0.09 * k;
      tilt += 0.055 * k;
      bob += 2.4 * k;
    } else {
      // Recovery: settle back into the heavy friendly silhouette.
      const k = 1 - smooth((p - 0.7) / 0.3);
      scaleX += 0.13 * k;
      scaleY -= 0.09 * k;
      tilt += 0.055 * k;
    }
  } else if (state?.skillT > 0 && state.skillId) {
    const skill = state.skillId;
    const total = skill === 'devour' ? 0.86 : 0.5;
    const p = clamp(1 - state.skillT / total);
    const anticipation = smooth(clamp(p / 0.3));
    const recovery = p > 0.62 ? 1 - smooth((p - 0.62) / 0.38) : 0;

    if (skill === 'devour') {
      // Devour is the signature skill: lower body roots while the belly maw
      // takes over the pose. The authored attack sprite opens the maw.
      spriteState = 'attack';
      scaleX += 0.08 * anticipation + 0.07 * recovery;
      scaleY -= 0.05 * anticipation;
      lunge = 5 * anticipation;
      bob -= 1.8 * anticipation;
    } else if (skill === 'taunt') {
      // Chest-forward, friendly-but-overwhelming callout.
      scaleX -= 0.035 * anticipation;
      scaleY += 0.055 * anticipation;
      tilt -= 0.035 * anticipation;
      bob += 1.5 * anticipation;
    } else if (skill === 'defensive_stance') {
      // Brace low and wide; the existing shield/protect VFX remains separate.
      scaleX += 0.065 * anticipation;
      scaleY -= 0.045 * anticipation;
      bob -= 1.2 * anticipation;
      tilt += 0.02 * anticipation;
    }
  }

  if (state?.hitT > 0) {
    const p = clamp(state.hitT / 0.26);
    const recoil = Math.sin((1 - p) * Math.PI);
    scaleX -= 0.075 * recoil;
    scaleY += 0.085 * recoil;
    tilt -= 0.085 * recoil;
    lunge -= 4 * recoil;
  }

  const hp01 = player.maxHP > 0 ? clamp(player.hp / player.maxHP) : 1;
  if (hp01 < 0.25 && player.alive) {
    const panic = (0.25 - hp01) / 0.25;
    tilt += Math.sin(t * 16) * 0.012 * panic;
    scaleY += Math.sin(t * 8) * 0.012 * panic;
  }

  if (state?.spawnT > 0) {
    const p = 1 - clamp(state.spawnT / 0.72);
    const k = easeOut(p);
    scaleX *= 0.82 + 0.18 * k;
    scaleY *= 0.72 + 0.28 * k;
    bob -= (1 - k) * 8;
    alpha = 0.35 + 0.65 * k;
  }

  if (state?.deathAt && !player.alive) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const p = clamp((now - state.deathAt) / 650);
    scaleX *= 1 + p * 0.1;
    scaleY *= 1 - p * 0.72;
    bob -= p * 10;
    tilt += p * 0.9;
    alpha = 1 - p;
  }

  if (state?.victoryAt && run.victory) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const p = (now - state.victoryAt) / 1000;
    const bounce = Math.abs(Math.sin(p * 5.2));
    scaleY += bounce * 0.045;
    scaleX -= bounce * 0.025;
    bob += bounce * 2.4;
  }

  return {
    scaleX: Math.max(0.55, scaleX),
    scaleY: Math.max(0.35, scaleY),
    bob,
    tilt,
    lunge,
    alpha: clamp(alpha),
    spriteState,
  };
}
