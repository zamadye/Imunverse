/**
 * tutorial-system.js — Onboarding run pertama (hanya totalRuns === 0).
 * DIBANGUN ULANG (UE-1): tap-click tutorial yang benar-benar menunjuk ke
 * ELEMEN NYATA di layar (diukur via getBoundingClientRect tiap render) —
 * sebelumnya banyak langkah yang menunjuk ke UI lama yang sudah bergeser
 * (label SERANG dihapus, PAUSE pindah ke kluster kanan-bawah, currency
 * pindah ke tengah-atas, profil=fa-pill membuka pause).
 *
 * Alur (gameplay terus berjalan; tanpa pause):
 *   1. Gerak   : tarik di lantai kiri/kanan → advance saat sudah bergerak
 *   2. Serang  : TAHAN tombol SERANG besar → advance saat kill pertama
 *   3. Skill   : slot terbuka di level 3 / 5 / 10 (info — tombol LANJUT)
 *   4. Misi    : batasan objektif ada di atas (info — LANJUT)
 *   5. Currency: Antibodi & Imuncoin kosong di awal — hasilkan dari bermain;
 *                tap "+" p i currency untuk panduan lengkap (info — LANJUT)
 *   6. Pause   : tombol II di kluster kanan-bawah, atau tap pil HP-hero (info)
 *   7. Nutrisi : ambil pickup yang jatuh → advance saat collect pertama
 * Bisa dilewati: tombol LEWATI. Tandai meta.tutorialDone saat selesai.
 */

import { STATE } from '../core/state-manager.js';
import { writeSave } from '../save/save-manager.js';
import { setPresenterInteractive } from '../ui/presenter.js';

const T = (id) => document.getElementById(id);

const steps = [
  {
    id: 'move',
    text: 'BERGERAK: sentuh & tarik di lantai arena (atau W A S D di keyboard) untuk mengendalikan hero!',
    target: null, // zona bebas — jari di titik "mulai drag"
    anchor: (w, h) => ({ x: w * 0.42, y: h * 0.58, dirt: 1, diry: -0.5, drag: true }),
    bubble: 'below',
  },
  {
    id: 'attack',
    text: 'SERANG: TAHAN tombol besar di kanan-bawah — tarik sambil menahan untuk MENGARAHKAN. Bunuh patogen pertama!',
    target: '#btn-fire',
  },
  {
    id: 'skill',
    text: 'SKILL: 3 slot skill terbuka di LEVEL 3 / 5 / 10 — saat terbuka, tap untuk memakainya (upgrade di Level 15).',
    target: '#ability-bar .ability-btn.pos-0',
    info: true,
  },
  {
    id: 'mission',
    text: 'MISI: objektif run ada di kartu Misi — selesaikan untuk progres cepat!',
    target: '#hud-mission',
    fallback: '#hud-quests',
    info: true,
  },
  {
    id: 'currency',
    text: 'CURRENCY: Antibodi & Imuncoin KOSONG di awal — kamu dapat PURE dari bermain: tap tanda "+" untuk panduan cara mengumpulkannya!',
    target: '#hud-anti-chip',
    info: true,
  },
  {
    id: 'pause',
    text: 'JEDA: tombol II di sini — atau ketuk PIL HP hero di kiri-bawah juga membuka menu jeda/status.',
    target: '#btn-pause',
    info: true,
  },
  {
    id: 'collect',
    text: 'NUTRISI: ambil pickup yang jatuh dari patogen — itu XP & item evolusi!',
    target: null,
    anchor: (w, h) => ({ x: w * 0.5, y: h * 0.42 }),
    bubble: 'below',
  },
];

let idx = 0;
let active = false;
let movedDist = 0;
let hudObserver = null;

function shouldRun(meta = STATE.meta) {
  return !meta.tutorialDone && (meta.stats?.totalRuns || 0) === 0;
}

function targetRect(step) {
  const sels = [step.target, step.fallback].filter(Boolean);
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth) return r;
  }
  return null;
}

function bubbleFor(r, bubble, anchor) {
  const W = window.innerWidth, H = window.innerHeight;
  let x, y;
  if (r) {
    x = Math.min(W - 20, Math.max(20, r.x + r.width / 2));
    const above = bubble === 'below' ? false : true;
    // Default: bubble di ATAS target bila target di setengah bawah layar, sebaliknya di bawah
    const onTop = bubble === 'above' ? true : bubble === 'below' ? false : (r.y + r.height / 2) > H * 0.52;
    y = onTop ? Math.max(74, r.y - 8) : Math.min(H - 12, r.y + r.height + 8);
    // perancang: bubble ditranslasikan via CSS (atas: bottom-located)
    return { px: x, py: y, mode: onTop ? 'top' : 'bottom' };
  }
  // Langkah tanpa target (move/collect): gantung tepat di atas jari penunjuk
  if (anchor) {
    return { px: Math.min(W * 0.72, Math.max(W * 0.28, anchor.x)), py: Math.max(96, anchor.y - 24), mode: 'top' };
  }
  return { px: W / 2, py: Math.max(96, H * 0.24), mode: 'top' };
}

function renderStep() {
  const layer = T('tutorial-layer');
  if (!layer) return;
  layer.classList.remove('hidden');
  layer.textContent = '';
  const step = steps[idx];

  const r = targetRect(step);
  const anchor = step.anchor ? step.anchor(window.innerWidth, window.innerHeight) : null;
  const bpos = bubbleFor(r, step.bubble, anchor);

  const bubble = document.createElement('div');
  bubble.className = 'tut-bubble' + (step.info ? ' tut-bubble-info' : '') + (bpos.mode === 'bottom' ? ' tut-below' : '');
  bubble.innerHTML = `<span>${step.text}</span>` +
    (step.info ? '<button class="tut-next btn btn-sm" type="button">LANJUT</button>' : '');
  if (bpos.mode === 'top') {
    bubble.style.left = bpos.px + 'px';
    bubble.style.bottom = Math.min(window.innerHeight - 12, window.innerHeight - bpos.py + 8) + 'px';
    bubble.style.right = 'auto';
    bubble.style.top = 'auto';
  } else {
    bubble.style.left = bpos.px + 'px';
    bubble.style.top = bpos.py + 'px';
    bubble.style.right = 'auto';
    bubble.style.bottom = 'auto';
  }

  // Jari penunjuk: di pusat target (rect), atau di anchor bebas (move/collect)
  const finger = document.createElement('div');
  finger.className = 'tut-finger tut-finger-anim tut-' + step.id;
  let fx, fy;
  if (r) { fx = r.x + r.width / 2; fy = r.y + r.height / 2; }
  else if (anchor) { fx = anchor.x; fy = anchor.y; }
  else { fx = window.innerWidth / 2; fy = window.innerHeight * 0.55; }
  finger.style.left = fx + 'px';
  finger.style.top = fy + 'px';
  if (anchor && anchor.drag) {
    finger.style.setProperty('--tut-dx', (anchor.dirt * 84) + 'px');
    finger.style.setProperty('--tut-dy', (anchor.diry * 84) + 'px');
    finger.classList.add('tut-finger-drag');
  }

  // Fokus-ring di atas target agar jelas tombol mana yang dimaksud
  let ring = null;
  if (r) {
    ring = document.createElement('div');
    ring.className = 'tut-ring';
    const pad = 10;
    ring.style.left = Math.max(4, r.x - pad) + 'px';
    ring.style.top = Math.max(4, r.y - pad) + 'px';
    ring.style.width = Math.min(window.innerWidth - 12, r.width + pad * 2) + 'px';
    ring.style.height = Math.min(window.innerHeight - 12, r.height + pad * 2) + 'px';
  }

  const skip = document.createElement('button');
  skip.className = 'tut-skip btn btn-sm';
  skip.type = 'button';
  skip.textContent = 'LEWATI';
  skip.addEventListener('click', skipTutorial);

  if (ring) layer.appendChild(ring);
  layer.appendChild(bubble);
  layer.appendChild(finger);
  layer.appendChild(skip);
  // Clamp bubble ke dalam viewport (lebar bisa melebihi perkiraan di layar sempit)
  {
    const br = bubble.getBoundingClientRect();
    const minL = 10 + br.width / 2, maxL = Math.max(minL, window.innerWidth - 10 - br.width / 2);
    const curL = parseFloat(bubble.style.left) || bpos.px;
    bubble.style.left = Math.max(minL, Math.min(maxL, curL)) + 'px';
    if (bpos.mode === 'top') {
      // pastikan tepi atas bubble tidak keluar layar
      const half = (bubble.offsetHeight || br.height);
      const bottomPx = parseFloat(bubble.style.bottom) || 0;
      const topEdge = window.innerHeight - bottomPx - half;
      if (topEdge < 8) bubble.style.bottom = Math.max(8, window.innerHeight - 8 - half) + 'px';
    }
  }

  if (step.info) {
    bubble.querySelector('.tut-next').addEventListener('click', advance);
  }

  // jika target belum tampil (mis. misi hidden), rerender ringan supaya anchor menangkapnya nanti
  clearTimeout(hudObserver);
  hudObserver = setTimeout(() => {
    if (active && targetRect(steps[idx])) {
      // target sekarang sudah ada → rerender di tempat yang benar
      clearTimeout(hudObserver);
      renderStep();
    }
  }, 700);
}

function advance() {
  idx += 1;
  if (idx >= steps.length) {
    finish();
    return;
  }
  renderStep();
}

function setPresenterSoft() {
  // Selama tutorial run pertama, presenter naratif (RIA/bark) tidak boleh
  // menyerap drag layar — pemain sedang dilatih menggerakkan hero.
  setPresenterInteractive(false);
}
function clearPresenterSoft() {
  setPresenterInteractive(true);
}

function finish() {
  active = false;
  clearTimeout(hudObserver);
  clearPresenterSoft();
  const layer = T('tutorial-layer');
  if (layer) layer.classList.add('hidden');
  const meta = STATE.meta;
  if (meta) {
    meta.tutorialDone = true;
    writeSave(meta);
  }
}

export function skipTutorial() {
  finish();
}

/** Apakah onboarding run-pertama sedang berjalan (dipakai spawn serenade). */
export function isTutorialActive() {
  return active;
}

/** Dipanggil dari event runstart. */
export function onRunStart() {
  idx = 0;
  movedDist = 0;
  active = shouldRun();
  setPresenterSoft();
  if (active) renderStep();
  else {
    clearPresenterSoft();
    const layer = T('tutorial-layer');
    if (layer) layer.classList.add('hidden');
  }
}

/** Dipanggil tiap frame dari game.update dengan jarak gerak player (dt). */
export function notifyMoved(dist, speed) {
  if (!active || steps[idx]?.id !== 'move') return;
  movedDist += dist;
  // selesai setelah bergerak ~2.5 detik
  if (movedDist > speed * 2.5) advance();
}

/** Dipanggil dari onEnemyKilled. */
export function notifyKill() {
  if (!active) return;
  if (steps[idx]?.id === 'attack') advance();
}

/** Dipanggil dari collectPickup. */
export function notifyCollected() {
  if (!active) return;
  if (steps[idx]?.id === 'collect') advance();
}
