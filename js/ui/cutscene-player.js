/**
 * cutscene-player.js — R3 (Narrative-Kinematik): ORKESTRATOR cutscene produksi.
 *
 * Satu entry point untuk semua titik jeda story doc 7.3:
 *   - pembuka (bab 1, 3D + fallback 2D)      → sebelum run pertama
 *   - transisi antar-chapter (2.5D)          → sebelum run bab baru
 *   - reveal boss bab 5 (2.5D)               → saat boss bab kanker muncul
 *   - epilog (3D + fallback 2D)              → setelah bab final menang
 *
 * Tanggung jawab:
 *  - pilih renderer: 3D bila scene punya shots3d & WebGL tersedia (D1),
 *    selain itu 2D layered (canonical story doc 7.1)
 *  - sinkron VO (vo-system) per dialog: start di t, catch-up offset bila
 *    terlambat (tab throttle), ducking musik otomatis
 *  - musik per chapter (music-system.setTheme) — mulai saat cutscene,
 *    LANJUT ke run (seamless, tanpa loading screen — story doc 7.2#5)
 *  - SKIP: tombol / ketuk layer → VO stop, fade, onEnd (run tetap jalan)
 *  - prewarm(): three.js + VO dimuat di background saat boot (jank init
 *    keluar dari jalur kritis — mitigasi bar "freeze ≥ 5 s")
 *
 * Konten: data/cutscenes.json (naskah final 6.1–6.4 verbatim).
 */

import { getData } from '../core/data-store.js';
import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { audio } from '../systems/audio-system.js';
import { music } from '../systems/music-system.js';
import { vo } from '../systems/vo-system.js';
import { createCutscene2D } from './cutscene-2d.js';
import { createCutscene3D, webglAvailable, prewarm3D } from './cutscene-3d.js';

let layer = null;
let canvas = null;
let skipBtn = null;
let dialogEl = null;
let fadeEl = null;
let active = null; // { stop, id }
let starting = false; // di-set SINKRON saat playCutscene mulai (sebelum await)

/** Cutscene produksi sedang aktif (guard: modal pause tidak boleh numpang). */
export function cutsceneActive() { return !!active || starting; }

function ensureDom() {
  if (layer) return;
  layer = document.createElement('div');
  layer.id = 'cutscene-layer';
  layer.style.cssText = 'position:fixed;inset:0;z-index:900;background:#000;display:none;overflow:hidden;cursor:default;';
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  fadeEl = document.createElement('div');
  fadeEl.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .35s;';
  dialogEl = document.createElement('div');
  dialogEl.style.cssText = 'position:absolute;left:50%;bottom:6.5%;transform:translateX(-50%);width:min(92vw,680px);background:rgba(8,14,12,.78);border:1px solid rgba(125,255,184,.25);border-radius:12px;padding:12px 18px 14px;opacity:0;transition:opacity .25s;';
  const nameEl = document.createElement('div');
  nameEl.style.cssText = 'font-weight:800;font-size:12px;letter-spacing:.12em;margin-bottom:4px;';
  const textEl = document.createElement('div');
  textEl.style.cssText = 'color:#fff;font-size:15px;line-height:1.45;font-family:inherit;';
  dialogEl.append(nameEl, textEl);
  skipBtn = document.createElement('button');
  skipBtn.textContent = '⏭ Lewati';
  skipBtn.style.cssText = 'position:absolute;right:16px;bottom:6.5%;z-index:2;background:rgba(10,20,16,.6);color:#cfe;border:1px solid rgba(125,255,184,.4);border-radius:999px;padding:9px 18px;font-size:14px;font-weight:700;cursor:pointer;';
  layer.append(canvas, dialogEl, skipBtn, fadeEl);
  document.body.appendChild(layer);
  dialogEl._name = nameEl;
  dialogEl._text = textEl;
}

/** Pra-muat di boot: modul 3D + VO pembuka (background, non-blocking). */
export function prewarmCutscenes() {
  try {
    prewarm3D();
    const d = getData().cutscenes;
    if (d && d.scenes && d.scenes.pembuka) {
      const paths = d.scenes.pembuka.dialog.map((x) => x.vo).filter(Boolean);
      vo.preload(paths);
    }
  } catch { /* data belum siap — tidak fatal */ }
}

function showText(who, text, speakers) {
  const spk = speakers[who] || { name: who.toUpperCase(), accent: '#ccc' };
  dialogEl._name.textContent = spk.name;
  dialogEl._name.style.color = spk.accent;
  dialogEl._text.textContent = text;
  dialogEl.style.opacity = '1';
}
function hideText() { dialogEl.style.opacity = '0'; }

/**
 * Putar cutscene.
 * @param {string} id — id scene di data/cutscenes.json
 * @param {() => void} onEnd — selesai natural ATAU di-skip
 * @param {{skipIfSeen?:boolean, force2D?:boolean}} [opts]
 *   skipIfSeen: lewati bila meta.cinematicsSeen[scene.seenKey] sudah true
 */
export async function playCutscene(id, onEnd, opts = {}) {
  const data = getData().cutscenes;
  const scene = data && data.scenes && data.scenes[id];
  if (!scene) { if (onEnd) onEnd(); return; }
  const meta = STATE.meta;
  if (opts.skipIfSeen !== false && scene.seenKey && meta.cinematicsSeen && meta.cinematicsSeen[scene.seenKey]) {
    if (onEnd) onEnd();
    return;
  }
  starting = true; // sinkron — guard modal pause efektif sebelum frame pertama
  // tandai SEBELUM putar (agar refresh di tengah cutscene tak mengulang)
  if (scene.seenKey) {
    meta.cinematicsSeen = meta.cinematicsSeen || {};
    meta.cinematicsSeen[scene.seenKey] = true;
    writeSave(meta);
  }

  ensureDom();
  audio.unlock();
  // musik chapter — mulai dari cutscene, lanjut ke run (seamless)
  if (scene.music) { try { music.setTheme(scene.music); } catch { /* tema belum ada */ } music.start(); }
  // pra-decode VO scene ini (background; sync tetap via offset)
  vo.preload(scene.dialog.map((x) => x.vo).filter(Boolean));

  layer.style.display = 'block';
  fadeEl.style.opacity = '1';
  requestAnimationFrame(() => { fadeEl.style.opacity = '0'; });

  const speakers = data.speakers || {};
  const finished = (fromSkip) => {
    const a = active;
    active = null;
    starting = false;
    vo.stopAll();
    hideText();
    if (a) a.stop();
    // musik TIDAK berhenti (seamless ke run — story doc 7.2#5)
    fadeEl.style.opacity = '1';
    setTimeout(() => {
      if (layer) layer.style.display = 'none';
      if (onEnd) onEnd();
    }, fromSkip ? 250 : 350);
  };

  let ended = false;
  const onEndOnce = () => { if (!ended) { ended = true; finished(false); } };
  const onSkip = () => { if (!ended) { ended = true; finished(true); } };

  // sinkron VO + dialog teks per frame (scene time dari renderer)
  const spoken = new Set();
  const onFrame = (t) => {
    for (const d of scene.dialog) {
      if (t >= d.t && t < d.t + d.dur) {
        if (!spoken.has(d)) {
          spoken.add(d);
          showText(d.who, d.text, speakers);
          if (d.vo) vo.play(d.vo, { offset: Math.max(0, t - d.t) });
        }
      } else if (t >= d.t + d.dur && spoken.has(d) && dialogEl._text.textContent === d.text) {
        hideText();
      }
    }
  };

  const want3D = !!scene.shots3d && !opts.force2D;
  let handle = null;
  if (want3D) {
    try {
      handle = await createCutscene3D(canvas, scene, { onFrame, onEnd: onEndOnce, onFallback: () => { handle = null; } });
    } catch { handle = null; }
    if (!handle) {
      // fallback 2D — atau bila 3D gagal di tengah, mulai ulang di 2D
      if (want3D) {
        handle = createCutscene2D(canvas, scene, { speakers, onFrame, onEnd: onEndOnce });
      }
    }
  }
  if (!handle) {
    handle = createCutscene2D(canvas, scene, { speakers, onFrame, onEnd: onEndOnce });
  }
  active = handle;
  skipBtn.onclick = onSkip;
  // ketuk area tengah = skip juga (mobile-first)
  canvas.onclick = onSkip;
  handle.start();
}
