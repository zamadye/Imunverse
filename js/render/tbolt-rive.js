/**
 * tbolt-rive.js — direct TBolt artboard renderer (tcd8).
 *
 * Mirrors js/render/mako-rive.js: the gameplay canvas receives the rendered
 * Rive artboard. TBolt's 21 visible parts/meshes ride a 23-bone hierarchical
 * rig (elbows/knees/tails/blades nested at true joints), driven by 13
 * animations (8 Main + 5 Equip stage overlays) and state-machine inputs
 * (moving/attack/skill_lockon/execute/hit/death, damage/hitStop/stage, vfx),
 * all live in tbolt-rive-draft.riv, cut from a single art sheet
 * (assets/character-anim-src/tbolt/).
 *
 * Loading is lazy and failure-safe like Mako's. resetTBoltRive() rebuilds
 * the state-machine instance after death so revive restarts from idle.
 */

import { getLocomotion } from '../core/data-store.js';
import { quantizeMakoDirection, DEFAULT_DIRECTION_ANGLES } from './mako-animation.js';

const DEFAULT_RIVE = 'assets/character-anim-src/tbolt/tbolt-rive-draft.riv';
const DEFAULT_ARTBOARD = 'TBolt';
const DEFAULT_MACHINE = 'TBoltStateMachine';
const ARTBOARD_SIZE = 1024;
// TBolt artwork occupies roughly y=140..880 in the artboard.
const ART_GROUND_Y = 880;
const ART_HEIGHT = 740;

function vendorUrl(rel) {
  try {
    return new URL(rel, import.meta.url).href;
  } catch {
    return `js/vendor/rive/${String(rel).replace(/^\.\.\/vendor\/rive\//, '')}`;
  }
}

const RUNTIME_URL = vendorUrl('../vendor/rive/canvas_advanced.js');
const WASM_URL = vendorUrl('../vendor/rive/rive.wasm');

const state = {
  status: 'idle', // idle → loading → ready | fallback
  promise: null,
  error: null,
  runtime: null,
  file: null,
  artboard: null,
  machine: null,
  machineInstance: null,
  inputs: new Map(),
  renderCanvas: null,
  renderContext: null,
  renderer: null,
  pendingValues: new Map(),
  pendingTriggers: [],
  direction: 's',
  stateName: 'idle',
  lastStage: 0,
};

function cfg() {
  try {
    const loco = getLocomotion() || {};
    return loco.tbolt || {};
  } catch {
    return {};
  }
}

function isJsdomEnvironment() {
  return typeof navigator !== 'undefined' && /jsdom/i.test(String(navigator.userAgent || ''));
}

function setReadyInput(name, value) {
  const input = state.inputs.get(name);
  if (!input) return false;
  try {
    const types = state.runtime?.SMIInput;
    if (types?.bool != null && input.type === types.bool) input.asBool().value = !!value;
    else if (types?.number != null && input.type === types.number) input.asNumber().value = Number(value) || 0;
    else input.value = value;
    return true;
  } catch {
    return false;
  }
}

function fireReadyInput(name) {
  const input = state.inputs.get(name);
  if (!input) return false;
  try {
    const types = state.runtime?.SMIInput;
    if (types?.trigger != null && input.type === types.trigger) input.asTrigger().fire();
    else input.fire();
    return true;
  } catch {
    return false;
  }
}

function readyNumber(name) {
  const input = state.inputs.get(name);
  const types = state.runtime?.SMIInput;
  if (!input || types?.number == null || input.type !== types.number) return 0;
  try { return Number(input.asNumber().value) || 0; } catch { return 0; }
}

function applyQueuedInputs() {
  for (const [name, value] of state.pendingValues) setReadyInput(name, value);
  state.pendingValues.clear();
  for (const name of state.pendingTriggers) fireReadyInput(name);
  state.pendingTriggers.length = 0;
}

function queueValue(name, value) {
  if (!name || value == null || !Number.isFinite(Number(value)) && typeof value !== 'boolean') return;
  if (name === 'stage') state.lastStage = Math.max(0, Math.min(3, Math.round(Number(value) || 0)));
  if (state.status === 'ready' && setReadyInput(name, value)) return;
  state.pendingValues.set(name, value);
}

function queueTrigger(name) {
  if (!name) return;
  if (state.status === 'ready' && fireReadyInput(name)) return;
  if (!state.pendingTriggers.includes(name)) state.pendingTriggers.push(name);
}

async function loadTBolt() {
  try {
    if (typeof document === 'undefined' || isJsdomEnvironment()) throw new Error('Rive TBolt membutuhkan browser Canvas nyata');
    if (typeof WebAssembly === 'undefined') throw new Error('WebAssembly tidak didukung');
    const options = cfg();
    if (options.enabled === false) throw new Error('Rive TBolt dimatikan di data/locomotion.json');

    const mod = await import(/* @vite-ignore */ RUNTIME_URL);
    const factory = mod.default || mod.RiveCanvas || mod;
    if (typeof factory !== 'function') throw new Error('runtime Rive tidak berbentuk factory');
    const runtime = await factory({
      locateFile: (file) => String(file).endsWith('.wasm') ? WASM_URL : file,
      ...(globalThis.__PHAGOS_RIVE_WASM_BINARY ? { wasmBinary: globalThis.__PHAGOS_RIVE_WASM_BINARY } : {}),
    });

    const path = options.rig || DEFAULT_RIVE;
    const response = await fetch(path);
    if (!response.ok) throw new Error(`gagal memuat ${path} (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const file = await runtime.load(bytes);
    const artboard = (file.artboardByName && file.artboardByName(options.artboard || DEFAULT_ARTBOARD))
      || file.defaultArtboard();
    if (!artboard) throw new Error('artboard TBolt tidak ditemukan');

    const machineName = options.stateMachine || DEFAULT_MACHINE;
    const machine = (artboard.stateMachineByName && artboard.stateMachineByName(machineName))
      || (artboard.stateMachineCount() > 0 ? artboard.stateMachineByIndex(0) : null);
    if (!machine) throw new Error('state machine TBolt tidak ditemukan');
    const machineInstance = new runtime.StateMachineInstance(machine, artboard);
    const inputs = new Map();
    for (let i = 0; i < machineInstance.inputCount(); i++) {
      const input = machineInstance.input(i);
      if (input && input.name) inputs.set(input.name, input);
    }

    state.runtime = runtime;
    state.file = file;
    state.artboard = artboard;
    state.machine = machine;
    state.machineInstance = machineInstance;
    state.inputs = inputs;
    state.status = 'ready';
    applyQueuedInputs();
    state.machineInstance.advanceAndApply(0);
    state.artboard.advance(0);
    return state.status;
  } catch (error) {
    state.status = 'fallback';
    state.error = String(error && error.message ? error.message : error);
    if (typeof console !== 'undefined' && !isJsdomEnvironment()) console.warn('[tbolt-rive] direct renderer fallback:', state.error);
    return state.status;
  }
}

/** Load the visible TBolt artboard once. */
export function ensureTBoltRive() {
  if (state.status === 'ready' || state.status === 'fallback') return state.promise || Promise.resolve(state.status);
  if (!state.promise) {
    state.status = 'loading';
    state.promise = loadTBolt();
  }
  return state.promise;
}

export function tboltRiveStatus() { return state.status; }
export function tboltRiveError() { return state.error; }
export function tboltRiveDirection() { return state.direction; }
export function tboltRiveState() { return state.stateName; }

/** Set a numeric/bool Rive input, including before lazy loading completes. */
export function setTBoltRiveInput(name, value) {
  queueValue(name, value);
}

/** Fire a Rive trigger, including before lazy loading completes. */
export function fireTBoltRive(name) {
  queueTrigger(name);
}

/**
 * Advance the state machine that owns TBolt's visible pose.
 * `moving` drives idle↔walk; `stage` selects evolution overlays (0-3).
 * One-shot state changes are trigger inputs.
 */
export function updateTBoltRive(dt = 0, options = {}) {
  if (state.status !== 'ready' || !state.machineInstance || !state.artboard) return null;
  const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
  if (options.moving != null) queueValue('moving', !!options.moving);
  if (options.damage != null) queueValue('damage', Number(options.damage) || 0);
  if (options.hitStop != null) queueValue('hitStop', Number(options.hitStop) || 0);
  if (options.stage != null) queueValue('stage', Math.max(0, Math.min(3, Math.round(Number(options.stage) || 0))));
  if (options.direction != null) {
    state.direction = typeof options.direction === 'string'
      ? (DEFAULT_DIRECTION_ANGLES[options.direction] != null ? options.direction : state.direction)
      : quantizeMakoDirection(Number(options.direction), { directionAngles: DEFAULT_DIRECTION_ANGLES });
  }
  for (const trigger of options.triggers || []) queueTrigger(trigger);
  applyQueuedInputs();
  try {
    const hitStop = readyNumber('hitStop');
    const advanceStep = hitStop > 0 ? 0 : step;
    if (hitStop > 0) setReadyInput('hitStop', Math.max(0, hitStop - step));
    state.machineInstance.advanceAndApply(advanceStep);
    state.artboard.advance(advanceStep);
    if (state.machineInstance.stateChangedCount() > 0) {
      state.stateName = state.machineInstance.stateChangedNameByIndex(state.machineInstance.stateChangedCount() - 1) || state.stateName;
    }
    return { state: state.stateName, direction: state.direction };
  } catch (error) {
    state.status = 'fallback';
    state.error = String(error && error.message ? error.message : error);
    return null;
  }
}

/**
 * Rebuild the state-machine instance after death so revive restarts clean.
 * Death/equipDeath are terminal states; a fresh instance re-enters idle and
 * re-cascades the Equip layer to the last known stage on the next update.
 * No-op unless the artboard is ready (fresh loads already start clean).
 */
export function resetTBoltRive() {
  if (state.status !== 'ready' || !state.runtime || !state.machine || !state.artboard) return false;
  try {
    state.machineInstance?.delete?.();
  } catch { /* ignore */ }
  try {
    const machineInstance = new state.runtime.StateMachineInstance(state.machine, state.artboard);
    const inputs = new Map();
    for (let i = 0; i < machineInstance.inputCount(); i++) {
      const input = machineInstance.input(i);
      if (input && input.name) inputs.set(input.name, input);
    }
    state.machineInstance = machineInstance;
    state.inputs = inputs;
    state.stateName = 'idle';
    state.pendingValues.set('stage', state.lastStage || 0);
    state.pendingValues.set('moving', false);
    state.pendingTriggers.length = 0;
    applyQueuedInputs();
    state.machineInstance.advanceAndApply(0);
    state.artboard.advance(0);
    return true;
  } catch (error) {
    state.status = 'fallback';
    state.error = String(error && error.message ? error.message : error);
    return false;
  }
}

function ensureRenderer() {
  if (state.renderer) return true;
  if (typeof document === 'undefined' || !state.runtime) return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = ARTBOARD_SIZE;
    canvas.height = ARTBOARD_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D tidak tersedia untuk renderer Rive');
    state.renderCanvas = canvas;
    state.renderContext = context;
    state.renderer = state.runtime.makeRenderer(canvas);
    return !!state.renderer;
  } catch (error) {
    state.error = String(error && error.message ? error.message : error);
    return false;
  }
}

function renderArtboard() {
  if (!ensureRenderer() || !state.artboard) return false;
  try {
    state.renderer.clear();
    state.artboard.draw(state.renderer);
    state.renderer.flush();
    return true;
  } catch (error) {
    state.error = String(error && error.message ? error.message : error);
    return false;
  }
}

/**
 * Draw the already-advanced TBolt artboard into the gameplay canvas.
 * @param {CanvasRenderingContext2D} ctx gameplay canvas context
 * @param {number} x screen-space ground x
 * @param {number} y screen-space ground y
 * @param {number} targetHeight visible character height in pixels
 */
export function drawTBoltRive(ctx, x, y, targetHeight, options = {}) {
  if (state.status !== 'ready' || !ctx || !Number.isFinite(targetHeight)) return false;
  if (!renderArtboard()) return false;
  const scale = (targetHeight / ART_HEIGHT) * (options.scale || 1);
  const sx = (options.scaleX == null ? 1 : options.scaleX) * scale;
  const sy = (options.scaleY == null ? 1 : options.scaleY) * scale;
  const rotation = Number(options.rotation) || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(sx, sy);
  ctx.drawImage(state.renderCanvas, -ARTBOARD_SIZE * 0.5, -ART_GROUND_Y, ARTBOARD_SIZE, ARTBOARD_SIZE);
  ctx.restore();
  return true;
}

/** Free WebAssembly references when leaving gameplay. */
export function releaseTBoltRive() {
  try { state.machineInstance?.delete?.(); } catch { /* ignore */ }
  try { state.artboard?.delete?.(); } catch { /* ignore */ }
  try { state.file?.delete?.(); } catch { /* ignore */ }
  state.machineInstance = null;
  state.artboard = null;
  state.file = null;
  state.machine = null;
  state.inputs = new Map();
  state.renderer = null;
  state.renderCanvas = null;
  state.renderContext = null;
  state.status = 'idle';
  state.promise = null;
}
