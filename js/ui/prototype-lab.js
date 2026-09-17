/**
 * prototype-lab.js — LAB PROTOTIPE MAKHLUK.
 *
 * Tiga pendekatan DIGAMBAR BERDAMPINGAN, memakai state & arah yang sama,
 * supaya bisa dibandingkan secara jujur bukan sekadar dibayangkan:
 *
 *   ① FOTO      — deformasi prosedural pada foto (keadaan sekarang)
 *   ② HIBRIDA   — foto sebagai inti badan + anggota gerak prosedural
 *   ③ MAKHLUK   — makhluk vektor penuh: rig Godot, depan/samping/belakang
 *                  diblend terus-menerus, kaki menapak, gerak sekunder
 *
 * Buka dengan tombol **P** di dalam game, atau `?lab=mako`.
 * Tombol **M** mengganti mode yang dipakai di ARENA (bisa dirasakan saat main).
 *
 * Lab ini TIDAK menyentuh mekanik permainan — ia hanya menggambar.
 */
import { getData } from '../core/data-store.js';
import { drawSprite } from '../render/sprite-loader.js';
import { crawlPose } from '../systems/crawl-rig.js';
import { drawCreature, creatureStateInfo, creatureAvailable, creatureStates } from '../render/creature-rig.js';
import { heroMode, setHeroMode, heroModes } from '../render/hero-mode.js';

const TAU = Math.PI * 2;
const STATES = [
  ['idle', 'Diam / napas'],
  ['walk', 'Jalan'],
  ['turn', 'Belok'],
  ['attack', 'Serang'],
  ['skill', 'Skill (Pulse)'],
  ['hit', 'Kena hit'],
  ['death', 'Mati'],
  ['mutate', 'Mutasi A→B'],
];
const ARAH = [
  ['→', 0], ['↘', Math.PI / 4], ['↓', Math.PI / 2], ['↙', 3 * Math.PI / 4],
  ['←', Math.PI], ['↖', -3 * Math.PI / 4], ['↑', -Math.PI / 2], ['↗', -Math.PI / 4],
];

let panel = null;
let raf = 0;
let keadaan = 'walk';
let arah = 0;
let putar = true;
let laju = 1;
let siklus = false;
let mutT = 0;          // 0..1 transformasi A → B
let u = 0;
let terakhir = 0;
let urutSiklus = 0;
let sisaSiklus = 0;

const el = (tag, cls, teks) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (teks != null) e.textContent = teks;
  return e;
};

function kanvasAi(lebar = 220, tinggi = 190) {
  const dpr = Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1);
  const c = document.createElement('canvas');
  c.width = lebar * dpr;
  c.height = tinggi * dpr;
  c.style.width = lebar + 'px';
  c.style.height = tinggi + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  c.__ctx = ctx;
  c.__w = lebar;
  c.__h = tinggi;
  return c;
}

/** Gambar satu mode di kanvasnya sendiri. */
function gambarMode(c, mode, heroId, waktu) {
  const ctx = c.__ctx;
  const W = c.__w, H = c.__h;
  ctx.clearRect(0, 0, W, H);
  // latar & alas
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b1a18');
  g.addColorStop(1, '#071110');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const tanahY = H * 0.72;
  ctx.strokeStyle = 'rgba(143,230,200,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, tanahY);
  ctx.lineTo(W, tanahY);
  ctx.stroke();

  const info = creatureStateInfo(heroId, keadaan) || { loop: true, dur: 1 };
  const size = Math.min(W, H) * 0.52;
  const cx = W / 2;
  const cy = tanahY - size * 0.42;

  if (mode === 'makhluk') {
    drawCreature(ctx, {
      id: heroId, state: keadaan, u, x: cx, y: cy, size,
      facing: arah, time: waktu, mut: mutT, mutColor: '#b6f26f',
    });
  } else {
    // ---- foto (①) dan hibrida (②) memakai rig merayap yang sudah ada ----
    const heroes = (getData().heroes && getData().heroes.heroes) || [];
    const def = heroes.find((h) => h.id === heroId) || null;
    const path = def ? (def.spriteIdle || def.sprite) : null;
    const pose = crawlPose(heroId, u * TAU, keadaan === 'walk' ? 1 : 0.35, arah, waktu);
    const sx = (pose && pose.sx) || 1;
    const sy = (pose && pose.sy) || 1;
    const shear = (pose && pose.shear) || 0;
    const flip = Math.cos(arah) < 0 ? -1 : 1;
    const halfH = size / 2;
    ctx.save();
    ctx.translate(cx, tanahY - halfH - halfH * (sy - 1));   // poros BAWAH (anti mengambang)
    ctx.scale(flip * sx, sy);
    if (shear) ctx.transform(1, 0, -shear, 1, shear * halfH, 0);
    if (path) drawSprite(ctx, path, 0, 0, size, 0, {});
    ctx.restore();
    if (mode === 'hibrida') {
      drawCreature(ctx, {
        id: heroId, state: keadaan, u, x: cx, y: cy, size,
        facing: arah, time: waktu, limbsOnly: true,
      });
    }
  }

  // label
  ctx.fillStyle = 'rgba(224,244,236,0.55)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(info.loop ? (keadaan + ' · berulang') : (keadaan + ' · ' + (info.dur || 1).toFixed(2) + 's'), W / 2, H - 8);
}

function gelung(ts) {
  raf = requestAnimationFrame(gelung);
  if (!panel) return;
  const dt = Math.min(0.05, (ts - (terakhir || ts)) / 1000);
  terakhir = ts;
  if (putar) arah = (arah + dt * 0.55) % TAU;

  if (siklus) {
    sisaSiklus -= dt;
    if (sisaSiklus <= 0) {
      urutSiklus = (urutSiklus + 1) % STATES.length;
      keadaan = STATES[urutSiklus][0];
      sisaSiklus = 2.2;
      u = 0;
      tandaiKeadaan();
    }
  }
  const info = creatureStateInfo(panel.__id, keadaan) || { loop: true, dur: 1 };
  u += (dt * laju) / (info.dur || 1);
  if (info.loop) u = u % 1; else if (u > 1) u = siklus ? 1 : 1;
  if (keadaan === 'mutate') mutT = Math.min(1, u);
  else if (keadaan === 'idle') mutT = Math.max(0, mutT - dt * 0.8);

  for (const m of heroModes()) {
    const c = panel.__kanvas[m];
    if (c) gambarMode(c, m, panel.__id, ts / 1000);
  }
}

function tandaiKeadaan() {
  if (!panel) return;
  for (const b of panel.__tombolKeadaan) b.classList.toggle('aktif', b.dataset.state === keadaan);
}

function bangun(id) {
  const wrap = el('div', 'lab-backdrop');
  const box = el('div', 'lab-panel');
  const kepala = el('div', 'lab-head');
  kepala.appendChild(el('h3', null, 'LAB PROTOTIPE MAKHLUK'));
  kepala.appendChild(el('span', 'lab-sub', `fondasi konsep — hero: ${id.toUpperCase()}`));
  const tutup = el('button', 'lab-close', 'Tutup (P)');
  tutup.onclick = () => tutupLab();
  kepala.appendChild(tutup);
  box.appendChild(kepala);

  // ---- tiga kanvas berdampingan ----
  const deret = el('div', 'lab-row');
  panel.__kanvas = {};
  const NAMA = { foto: '① Deformasi foto', hibrida: '② Hibrida (foto + anggota)', makhluk: '③ Makhluk vektor — rig Godot' };
  for (const m of heroModes()) {
    const sel = el('div', 'lab-cell' + (heroMode() === m ? ' terpilih' : ''));
    sel.appendChild(el('div', 'lab-judul', NAMA[m] || m));
    const c = kanvasAi();
    sel.appendChild(c);
    panel.__kanvas[m] = c;
    const pakai = el('button', 'lab-pakai', heroMode() === m ? 'Dipakai di arena' : 'Pakai di arena');
    pakai.onclick = () => {
      setHeroMode(m);
      for (const s of deret.children) s.classList.remove('terpilih');
      sel.classList.add('terpilih');
      for (const b of deret.querySelectorAll('.lab-pakai')) b.textContent = 'Pakai di arena';
      pakai.textContent = 'Dipakai di arena';
    };
    sel.appendChild(pakai);
    deret.appendChild(sel);
  }
  box.appendChild(deret);

  // ---- kendali keadaan ----
  const baris = el('div', 'lab-bar');
  baris.appendChild(el('span', 'lab-label', 'Keadaan'));
  panel.__tombolKeadaan = [];
  for (const [k, label] of STATES) {
    const b = el('button', 'lab-btn' + (k === keadaan ? ' aktif' : ''), label);
    b.dataset.state = k;
    b.onclick = () => { keadaan = k; u = 0; siklus = false; tandaiKeadaan(); };
    panel.__tombolKeadaan.push(b);
    baris.appendChild(b);
  }
  const bSiklus = el('button', 'lab-btn', '▶ Siklus semua');
  bSiklus.onclick = () => { siklus = !siklus; sisaSiklus = 0.01; bSiklus.classList.toggle('aktif', siklus); };
  baris.appendChild(bSiklus);
  box.appendChild(baris);

  // ---- kendali arah ----
  const baris2 = el('div', 'lab-bar');
  baris2.appendChild(el('span', 'lab-label', 'Arah'));
  for (const [simbol, sudut] of ARAH) {
    const b = el('button', 'lab-btn lab-arah', simbol);
    b.onclick = () => { arah = sudut; putar = false; };
    baris2.appendChild(b);
  }
  const bPutar = el('button', 'lab-btn aktif', '⟳ Putar 360°');
  bPutar.onclick = () => { putar = !putar; bPutar.classList.toggle('aktif', putar); };
  baris2.appendChild(bPutar);
  baris2.appendChild(el('span', 'lab-label', 'Laju'));
  const geser = el('input');
  geser.type = 'range';
  geser.min = '20';
  geser.max = '200';
  geser.value = String(Math.round(laju * 100));
  geser.className = 'lab-range';
  geser.oninput = () => { laju = Number(geser.value) / 100; };
  baris2.appendChild(geser);
  box.appendChild(baris2);

  // ---- catatan ----
  const catat = el('div', 'lab-note');
  catat.innerHTML = 'Tombol <b>P</b> buka/tutup lab ini · tombol <b>M</b> ganti mode di arena · '
    + 'parameter <code>?heroMode=makhluk</code> untuk membuka game langsung memakai mode tertentu. '
    + 'Semua mode memakai mekanik permainan yang <b>sama persis</b> — yang berbeda hanya cara menggambar.';
  box.appendChild(catat);

  wrap.appendChild(box);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) tutupLab(); });
  document.body.appendChild(wrap);
  panel = Object.assign(panel || {}, { __wrap: wrap, __box: box, __id: id });
  return wrap;
}

/** Buka lab. */
export function bukaLab(id) {
  const heroId = id || 'macrophage';
  if (panel && panel.__id === heroId && panel.__wrap && panel.__wrap.isConnected) return;
  tutupLab(true);
  panel = { __id: heroId };
  bangun(heroId);
  if (!raf) raf = requestAnimationFrame(gelung);
}

export function tutupLab(diam = false) {
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  if (panel && panel.__wrap && panel.__wrap.isConnected) panel.__wrap.remove();
  panel = null;
  if (!diam) { /* biarkan pemanggil yang mengatur fokus */ }
}

export function gantiLab() {
  if (panel) tutupLab();
  else {
    const id = Object.keys((getData().creatureRigs && getData().creatureRigs.creatures) || {})[0] || 'macrophage';
    bukaLab(id);
  }
}

export function labTerbuka() { return !!panel; }

/** Dipanggil saat data siap: buka otomatis bila URL meminta ?lab=… */
export function initLab(search) {
  try {
    const q = new URLSearchParams(search || (typeof location !== 'undefined' ? location.search : ''));
    const m = q.get('lab');
    if (m) bukaLab(m === '1' ? 'macrophage' : m);
  } catch { /* abaikan */ }
}

/** Daftar keadaan yang tersedia (dipakai penguji). */
export function labStates() { return STATES.map((s) => s[0]); }
export { creatureStates, creatureAvailable };
