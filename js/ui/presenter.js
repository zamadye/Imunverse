/**
 * presenter.js — E1 poin 8+9: KARAKTER NARATIF HIDUP.
 *
 * Overlay presenter: karakter berdiri BESAR di satu sisi layar (full body),
 * "hidup" lewat animasi 2-frame (pose idle ⇄ pose bicara: mulut terbuka +
 * tangan bergestur) plus bob halus — bukan gambar statis. Teks tampil DI
 * SAMPING karakter (speech panel), bukan di bawah.
 *
 * Dua pembicara (naratif dua-lapis R2):
 *  - RIA  (mikro)  → tampil TIAP AKHIR WAVE: rangkuman singkat + semangat.
 *  - AMARA (makro) → tampil saat pemain mendapat HERO/ITEM BARU: menjelaskan
 *    spesifikasi (role, skill, angka) dengan bahasa awam.
 *
 * Non-blocking: auto-dismiss + tap untuk lanjut; gameplay TIDAK dipause
 * untuk bark wave (overlay singkat), penjelasan Amara muncul di layar meta
 * (roster/gameover) yang memang bukan gameplay.
 */

import { vo } from '../systems/vo-system.js';

const SPEAKERS = {
  ria: {
    name: 'RIA',
    title: 'Respons Imun Adaptif',
    idle: 'assets/sprites/ria_pose_idle.png',
    talk: 'assets/sprites/ria_pose_talk.png',
    accent: '#35d0ba',
  },
  amara: {
    name: 'Dr. Amara',
    title: 'Kepala Lab Imunologi',
    idle: 'assets/sprites/amara_pose_idle.png',
    talk: 'assets/sprites/amara_pose_talk.png',
    accent: '#e8a13c',
  },
};

let layer = null;
let interactive = true; // tutorial run-pertama melunakkannya agar drag tembus ke canvas

// Pemuatan di muka: pose narrators dimuat SATU KALI; perubahan gantian idle↔talk
// cukup memakai cache browser — mengikis noise GET 200 -> broken-pipe di server.
for (const spk of Object.values(SPEAKERS)) {
  new Image().src = spk.idle;
  new Image().src = spk.talk;
}

/** Aktif/nonaktifkan interaksi layer presenter (drag tembus saat tutorial pertama). */
export function setPresenterInteractive(v) {
  interactive = !!v;
  if (layer) layer.style.pointerEvents = interactive ? '' : 'none';
}
let talkTimer = 0;
let hideTimer = 0;
let visible = false;
let voHandle = null; // R3: VO bark aktif (dihentikan saat presenter hilang)

function ensureLayer() {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'presenter-layer';
  layer.innerHTML = `
    <div class="presenter-stage">
      <img id="presenter-img" class="presenter-img" alt="" />
      <div class="presenter-panel">
        <div class="presenter-head">
          <b id="presenter-name"></b>
          <small id="presenter-title"></small>
        </div>
        <p id="presenter-text"></p>
        <span class="presenter-hint">ketuk untuk lanjut</span>
      </div>
    </div>`;
  document.body.appendChild(layer);
  layer.style.pointerEvents = interactive ? '' : 'none';
  layer.addEventListener('click', () => hidePresenter());
  return layer;
}

/**
 * Tampilkan presenter.
 * @param {'ria'|'amara'} who
 * @param {string} text
 * @param {{duration?:number}} [opts] duration detik (default 5.5; 0 = manual)
 */
export function showPresenter(who, text, opts = {}) {
  const spk = SPEAKERS[who] || SPEAKERS.ria;
  const el = ensureLayer();
  const img = document.getElementById('presenter-img');
  img.src = spk.idle;
  img.dataset.idle = spk.idle;
  img.dataset.talk = spk.talk;
  el.style.setProperty('--pr-accent', spk.accent);
  document.getElementById('presenter-name').textContent = spk.name;
  document.getElementById('presenter-title').textContent = spk.title;
  document.getElementById('presenter-text').textContent = text;
  el.classList.add('on');
  visible = true;

  // ANIMASI BICARA: pose idle ⇄ talk bergantian selama teks "diucapkan" —
  // mulut & tangan benar-benar bergerak (2-frame talk cycle klasik).
  clearInterval(talkTimer);
  let f = 0;
  const talkDur = Math.min(4200, 1400 + text.length * 34);
  const t0 = Date.now();
  talkTimer = setInterval(() => {
    if (Date.now() - t0 > talkDur) {
      img.src = img.dataset.idle;
      clearInterval(talkTimer);
      return;
    }
    f = 1 - f;
    img.src = f ? img.dataset.talk : img.dataset.idle;
  }, 260);

  // R3 (Narrative-Cinematic): VO bark opsional (Task 4: first-time RIA;
  // boss bark). Non-blocking: durasi tampil mengikuti VO bila duration tak
  // diberikan eksplisit — presenter tetap bisa di-tap untuk skip.
  if (opts.vo) {
    voHandle = vo.play(opts.vo);
    if (opts.duration === undefined) {
      const d = awaitVoDur(opts.vo, 5.5);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => hidePresenter(), (d + 0.8) * 1000);
    }
  }

  clearTimeout(hideTimer);
  const dur = opts.duration === undefined ? 5.5 : opts.duration;
  if (dur > 0 && !opts.vo) hideTimer = setTimeout(() => hidePresenter(), dur * 1000);
}

async function awaitVoDur(path, fallbackSec) {
  try { const d = await vo.duration(path); return d ? d : fallbackSec; } catch { return fallbackSec; }
}

export function hidePresenter() {
  if (!layer || !visible) return;
  visible = false;
  clearInterval(talkTimer);
  clearTimeout(hideTimer);
  if (voHandle) { voHandle.stop(); voHandle = null; }
  layer.classList.remove('on');
}

export function presenterVisible() {
  return visible;
}
