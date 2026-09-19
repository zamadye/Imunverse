/**
 * mako-animation.js — frame-driven Mako state machine.
 *
 * This module is deliberately separate from the legacy static-sprite renderer
 * until the frame pack in assets/character-anim-src/mako/ is complete.
 * It owns direction quantization, state transitions, frame selection, and
 * one-shot animation events. VFX/gameplay code should consume `events` from
 * update(); it must not use a second timer to guess impact timing.
 */

export const MAKO_DIRECTIONS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
export const MAKO_STATES = ['idle', 'walk', 'attack', 'devour', 'hit', 'death'];

const TAU = Math.PI * 2;
const DEFAULT_DIRECTION_ANGLES = {
  e: 0,
  se: Math.PI / 4,
  s: Math.PI / 2,
  sw: (Math.PI * 3) / 4,
  w: Math.PI,
  nw: (-Math.PI * 3) / 4,
  n: -Math.PI / 2,
  ne: -Math.PI / 4,
};

function wrapAngle(a) {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x <= -Math.PI) x += TAU;
  return x;
}

function nearestDirection(angle, angles = DEFAULT_DIRECTION_ANGLES) {
  let best = MAKO_DIRECTIONS[0];
  let bestDistance = Infinity;
  for (const id of MAKO_DIRECTIONS) {
    const distance = Math.abs(wrapAngle(angle - (angles[id] ?? 0)));
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function readStateConfig(manifest, state) {
  return manifest?.states?.[state] || null;
}

function readDirectionConfig(stateConfig, direction) {
  if (!stateConfig) return null;
  return stateConfig.directions?.find((d) => d.direction === direction) || null;
}

function frameFor(stateConfig, direction, index) {
  const d = readDirectionConfig(stateConfig, direction);
  if (!d || !Array.isArray(d.frames) || d.frames.length === 0) return null;
  return d.frames[Math.max(0, Math.min(d.frames.length - 1, index))] || null;
}

/**
 * Quantize a world/screen angle to the nearest one of Mako's eight directions.
 * The manifest may override the default compass mapping.
 */
export function quantizeMakoDirection(angle, manifest) {
  const angles = manifest?.directionAngles || DEFAULT_DIRECTION_ANGLES;
  return nearestDirection(Number.isFinite(angle) ? angle : 0, angles);
}

/** Return an empty manifest-safe snapshot useful to loaders and tests. */
function snapshot(machine, events = []) {
  const cfg = readStateConfig(machine.manifest, machine.state);
  const frameCount = Math.max(1, cfg?.framesPerDirection || 1);
  const duration = frameCount / Math.max(1, cfg?.fps || 1);
  const progress = cfg?.loop
    ? ((machine.elapsed / duration) % 1)
    : clamp01(machine.elapsed / duration);
  const frame = cfg?.loop
    ? Math.floor(progress * frameCount) % frameCount
    : Math.min(frameCount - 1, Math.floor(progress * frameCount));
  return {
    state: machine.state,
    direction: machine.direction,
    frame,
    frameCount,
    fps: cfg?.fps || 0,
    progress,
    duration,
    loop: !!cfg?.loop,
    finished: !!machine.finished,
    framePath: frameFor(cfg, machine.direction, frame),
    events,
  };
}

/**
 * Create a deterministic, data-driven Mako animation controller.
 *
 * @param {object} manifest data/mako-animation.json
 * @param {object} [options]
 * @returns {object} state machine API
 */
export function createMakoAnimator(manifest, options = {}) {
  const initialState = MAKO_STATES.includes(options.state) ? options.state : (manifest?.runtime?.defaultState || 'idle');
  const machine = {
    manifest: manifest || { states: {} },
    state: initialState,
    direction: quantizeMakoDirection(options.angle ?? Math.PI / 2, manifest),
    elapsed: 0,
    finished: false,
    eventCursor: 0,
    eventCycle: 0,
  };

  const eventsFor = (state) => Array.isArray(machine.manifest?.events?.[state])
    ? machine.manifest.events[state]
    : [];

  const canInterrupt = (from, to) => {
    const table = machine.manifest?.interrupts || {};
    const allowed = table[from];
    return !Array.isArray(allowed) || allowed.includes(to);
  };

  const enter = (state, opts = {}) => {
    if (!MAKO_STATES.includes(state)) return false;
    if (!opts.force && machine.state !== state && !machine.finished && !canInterrupt(machine.state, state)) return false;
    machine.state = state;
    machine.elapsed = 0;
    machine.finished = false;
    machine.eventCursor = 0;
    machine.eventCycle = 0;
    return true;
  };

  const setDirection = (angleOrId) => {
    machine.direction = typeof angleOrId === 'string'
      ? (MAKO_DIRECTIONS.includes(angleOrId) ? angleOrId : machine.direction)
      : quantizeMakoDirection(angleOrId, machine.manifest);
    return machine.direction;
  };

  const update = (dt = 0) => {
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    const cfg = readStateConfig(machine.manifest, machine.state);
    const frameCount = Math.max(1, cfg?.framesPerDirection || 1);
    const fps = Math.max(1, cfg?.fps || 1);
    const duration = frameCount / fps;
    const previousProgress = cfg?.loop ? ((machine.elapsed / duration) % 1) : clamp01(machine.elapsed / duration);
    const previousCycle = Math.floor(machine.elapsed / duration);

    if (!machine.finished || cfg?.loop) machine.elapsed += step;
    const currentCycle = Math.floor(machine.elapsed / duration);
    const progress = cfg?.loop ? ((machine.elapsed / duration) % 1) : clamp01(machine.elapsed / duration);
    const events = eventsFor(machine.state);
    const fired = [];

    // Loop states start a fresh event cycle. Non-loop states emit each event once.
    if (cfg?.loop && currentCycle > previousCycle) {
      machine.eventCursor = 0;
      machine.eventCycle = currentCycle;
    }
    while (machine.eventCursor < events.length) {
      const event = events[machine.eventCursor];
      const at = clamp01(Number(event.at) || 0);
      const wrapped = cfg?.loop && currentCycle > previousCycle;
      const crossed = cfg?.loop
        ? (wrapped ? (at > previousProgress || at <= progress) : (at > previousProgress && at <= progress))
        : (at > previousProgress && at <= progress);
      if (!crossed) break;
      fired.push({ ...event, state: machine.state, direction: machine.direction, frame: Math.min(frameCount - 1, Math.floor(at * frameCount)) });
      machine.eventCursor += 1;
    }

    if (!cfg?.loop && machine.elapsed >= duration) machine.finished = true;
    return snapshot(machine, fired);
  };

  const getSnapshot = () => snapshot(machine);

  return {
    enter,
    setState: enter,
    setDirection,
    update,
    snapshot: getSnapshot,
    get state() { return machine.state; },
    get direction() { return machine.direction; },
    get finished() { return machine.finished; },
  };
}

export { DEFAULT_DIRECTION_ANGLES };
