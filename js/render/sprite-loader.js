import { BUILD } from '../core/version.js';
import { isDevMode } from '../core/dev-mode.js'; // #19: placeholder loud hanya di dev
/**
 * sprite-loader.js — Preload & cache sprite PNG transparan.
 *
 * Semua path sprite tersimpan di file data JSON (field `sprite` /
 * `spriteIdle` / `spriteAttack`). loadAllSprites() memuat SEMUA path jadi
 * object Image SEKALI di awal game (mengembalikan Promise) — drawImage()
 * tidak pernah dipanggil sebelum load selesai (loading screen menunggu).
 *
 * Placeholder generator (bentuk sederhana digambar via canvas offscreen)
 * HANYA dipakai sebagai fallback development bila file sprite belum
 * tersedia — kode utama mengasumsikan sprite asli (assets/sprites/*.png).
 */

const cache = new Map(); // path → {image, isPlaceholder, width, height}
const metaByPath = new Map(); // path → {color, label} untuk fallback placeholder

/** Kumpulkan semua path sprite unik dari data JSON yang dimuat. */
export function collectSpritePaths(data) {
  const paths = new Set();
  const record = (path, color, label) => {
    if (!path) return;
    paths.add(path);
    if (!metaByPath.has(path)) metaByPath.set(path, { color: color || '#35d0ba', label: label || '?' });
  };

  for (const h of data.heroes.heroes) {
    record(h.sprite, h.color, h.name);
    record(h.spriteIdle, h.color, h.name);
    record(h.spriteAttack, h.color, h.name);
    record(h.spritePortrait, h.color, h.name);
  }
  for (const e of data.enemies.enemies) {
    record(e.sprite, e.color, e.name);
    record(e.spriteIdle, e.color, e.name);
    record(e.spriteAttack, e.color, e.name);
  }
  for (const n of data.nutrients.nutrients) {
    record(n.sprite, n.color, n.name);
  }
  if (data.evolutions) {
    for (const p of data.evolutions.parts) {
      record(p.sprite, '#b07ae0', p.name);
    }
  }
  if (data.abilities) {
    for (const a of data.abilities.abilities) {
      record(a.icon, '#1f7a70', a.name);
    }
  }
  // Rebuild 8-arah: sheet animasi jalan (11 hero + 13 virus) —
  // field `sheet` di data/walk-anim.json.
  if (data.walkAnim) {
    for (const set of ['heroes', 'enemies']) {
      for (const entry of Object.values(data.walkAnim[set] || {})) {
        record(entry.sheet, '#35d0ba', 'walk');
      }
    }
  }
  return [...paths];
}

/**
 * Aset yang dirender lewat drawSprite() dengan path HARDCODE di kode
 * (bukan dari data JSON) — wajib ikut di-preload supaya tidak jatuh ke
 * placeholder dev. Daftar: properti background, efek, joystick, dekorasi.
 */
const EXTRA_PRELOAD = [
  'assets/sprites/prop_cell.png',
  'assets/sprites/prop_reef.png',
  'assets/sprites/prop_weed.png',
  'assets/sprites/prop_asam.png', // MAP: properti lambung (data arenas.json)
  'assets/sprites/prop_kristal.png', // MAP: properti saraf (data arenas.json)
  'assets/sprites/prop_dots.png', // MAP: properti paru/saraf/jantung (data arenas.json)
  'assets/sprites/fx_hit.png',
  'assets/sprites/fx_joystick_base.png',
  'assets/sprites/fx_joystick_knob.png',
  'assets/sprites/deco_aura.png',
  'assets/sprites/deco_weed_big.png',
  'assets/sprites/deco_reef_big.png',
  // MAP #19: keluarga deco arena (tak dirujuk saat ini, tapi wajib siap pakai)
  'assets/sprites/deco_bubble_coral.png',
  'assets/sprites/deco_bubble_mint.png',
  'assets/sprites/deco_bubble_sage.png',
  'assets/sprites/deco_germ_coral.png',
  'assets/sprites/deco_germ_sage.png',
  'assets/sprites/deco_germ_teal.png',
  // Overlay evolusi hero (digambar via drawSprite, path hardcode di game.js)
  'assets/sprites/ov_silia.png',
  'assets/sprites/ov_pseudopodia.png',
  'assets/sprites/ov_pedang.png',
  'assets/sprites/ov_inti.png',
  // E1 poin 8: karakter naratif hidup — pose idle/talk (Dr. Amara & RIA)
  'assets/sprites/amara_pose_idle.png',
  'assets/sprites/amara_pose_talk.png',
  'assets/sprites/ria_pose_idle.png',
  'assets/sprites/ria_pose_talk.png',
];

/**
 * Muat semua sprite. @returns {Promise<{loaded:number, fallback:number}>}
 * Resolve (bukan reject) bila sebagian gagal — yang gagal digantikan
 * placeholder development supaya game tetap bisa dites.
 */
export function loadAllSprites(data, onProgress) {
  const paths = [...new Set([...collectSpritePaths(data), ...EXTRA_PRELOAD])];
  let done = 0;
  let fallback = 0;

  const jobs = paths.map(
    (path) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          cache.set(path, { image: img, isPlaceholder: false, width: img.naturalWidth, height: img.naturalHeight });
          done++;
          onProgress?.(done, paths.length, path, false);
          resolve();
        };
        img.onerror = () => {
          // FALLBACK: file sprite belum ada → placeholder LOUD di dev,
          // netral di production (#19 — jangan tampilkan '?' ke pemain).
          const meta = metaByPath.get(path) || { color: '#35d0ba', label: '?' };
          const canvas = isDevMode() ? generatePlaceholderSprite(meta.color, meta.label) : generateNeutralSprite();
          cache.set(path, { image: canvas, isPlaceholder: true, width: canvas.width, height: canvas.height });
          fallback++;
          done++;
          console.warn(`[sprite-loader] sprite tidak ditemukan, memakai placeholder: ${path}`);
          onProgress?.(done, paths.length, path, true);
          resolve();
        };
        img.src = `${path}?v=${BUILD}`; // cache-busting (kunci cache tetap path)
      })
  );

  return Promise.all(jobs).then(() => ({ loaded: paths.length, fallback }));
}

const warnedPaths = new Set(); // #19: peringatan fallback sekali per path
/** Ambil entri cache sprite. Fallback on-demand bila belum pernah dimuat. */
export function getSprite(path) {
  let entry = cache.get(path);
  if (!entry) {
    if (!warnedPaths.has(path)) {
      warnedPaths.add(path);
      console.warn(`[sprite-loader] sprite tidak di-preload, memakai fallback: ${path}`);
    }
    const meta = metaByPath.get(path) || { color: '#35d0ba', label: '?' };
    const canvas = isDevMode() ? generatePlaceholderSprite(meta.color, meta.label) : generateNeutralSprite();
    entry = { image: canvas, isPlaceholder: true, width: canvas.width, height: canvas.height };
    cache.set(path, entry);
  }
  return entry;
}

/**
 * Gambar sprite pada posisi dunia (x,y) dengan ukuran target & rotasi.
 * @param {string} path    path sprite dari data JSON
 * @param {number} size    ukuran bounding (px dunia)
 * @param {number} [rotation] radian
 * @param {object} [opts]  { alpha, flash (0..1), flip }
 */
export function drawSprite(ctx, path, x, y, size, rotation = 0, opts = {}) {
  const entry = getSprite(path);
  const img = entry.image;
  const scale = size / Math.max(entry.width, entry.height);
  const w = entry.width * scale;
  const h = entry.height * scale;

  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  // sprite dibuat dengan margin — gambar sesuai rasio aslinya
  ctx.drawImage(img, -w / 2, -h / 2, w, h);

  // Flash saat kena hit (overlay lingkaran lembut; V2 Phase 5: warna bisa
  // dioverride — merah utk boss enrage)
  if (opts.flash && opts.flash > 0) {
    ctx.globalAlpha = opts.flash * 0.75;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = opts.flashColor || '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Gambar SATU SEL (col,row) dari sheet sprite (grid cols x rows) — dipakai
 * animasi jalan 8 arah (js/render/walk-anim.js). Ukuran & flash mengikuti
 * semantik drawSprite: `size` = bounding maksimum sel.
 *
 * @param {string} path   path sheet PNG (mis. assets/sprites/walk/*_walk.png)
 * @param {number} col    kolom sheet (0-based)
 * @param {number} row    baris sheet (0-based)
 * @param {number} cols   jumlah kolom
 * @param {number} rows   jumlah baris
 * @param {object} [opts] { mirror, alpha, flash, flashColor, image (override) }
 */
export function drawSheetCell(ctx, path, x, y, size, col, row, cols, rows, opts = {}) {
  const entry = getSprite(path);
  const img = opts.image || entry.image; // override = canvas tint (size sama dgn sheet)
  const cw = entry.width / cols;
  const ch = entry.height / rows;
  const scale = size / Math.max(cw, ch);
  const w = cw * scale;
  const h = ch * scale;

  ctx.save();
  ctx.translate(x, y);
  if (opts.mirror) ctx.scale(-1, 1); // W/NW/SW = mirror horizontal (tanpa file ekstra)
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.drawImage(img, col * cw, row * ch, cw, ch, -w / 2, -h / 2, w, h);

  if (opts.flash && opts.flash > 0) {
    ctx.globalAlpha = opts.flash * 0.75;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = opts.flashColor || '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Fase 14: cache tint skin — {src|color} → canvas. */
const tintCache = new Map();

/**
 * Sprite berwarna SKIN (kosmetik): gambar asli di-overlay warna alpha.
 * Membuat Image baru bila perlu; hasilnya canvas (aman drawImage kapan pun
 * karena dipanggil SETELAH loadAllSprites() resolve).
 */
export function getTintedSprite(path, color) {
  const key = `${path}|${color}`;
  if (tintCache.has(key)) return tintCache.get(key);
  const entry = getSprite(path);
  const c = document.createElement('canvas');
  c.width = entry.width;
  c.height = entry.height;
  const g = c.getContext('2d');
  g.drawImage(entry.image, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.5;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'soft-light';
  g.globalAlpha = 0.45;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  // E1 poin 5: soft-light mengisi SELURUH kanvas (termasuk piksel transparan)
  // → muncul "kotak warna neon" di belakang karakter. Clip ulang ke alpha
  // sprite asli supaya tint hanya menempel di tubuh karakter.
  g.globalCompositeOperation = 'destination-in';
  g.globalAlpha = 1;
  g.drawImage(entry.image, 0, 0);
  g.globalCompositeOperation = 'source-over';
  tintCache.set(key, c);
  return c;
}

/** DataURL untuk <img> di UI (roster portrait, HUD, dsb). */
export function spriteToDataURL(path) {
  const entry = getSprite(path);
  if (entry.image instanceof HTMLCanvasElement) return entry.image.toDataURL();
  return path; // file asli bisa dipakai langsung sebagai src
}

// ------------------------------------------------------------------
// FALLBACK DEV ONLY — placeholder generator via canvas offscreen.
// Tidak pernah dipakai selama file PNG di assets/sprites tersedia.
// ------------------------------------------------------------------
export function generatePlaceholderSprite(color, label) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // tubuh: lingkaran radial gradient
  const g = ctx.createRadialGradient(size * 0.42, size * 0.4, 6, size / 2, size / 2, size * 0.42);
  g.addColorStop(0, shade(color, 1.35));
  g.addColorStop(0.75, color);
  g.addColorStop(1, shade(color, 0.55));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // membran luar
  ctx.strokeStyle = shade(color, 1.5);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
  ctx.stroke();

  // inti
  ctx.fillStyle = shade(color, 0.4);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // huruf inisial (identitas saat dev)
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((label || '?').slice(0, 2).toUpperCase(), size / 2, size * 0.78);

  return canvas;
}

/** #19: fallback NETRAL production — kotak abu tembus pandang tanpa '?'.
 *  Kontrak render tetap (selalu kembalikan canvas 128px), tapi tak ada lagi
 *  artefak dev yang terlihat pemain. Dipakai saat BUKAN dev mode. */
export function generateNeutralSprite() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(40,48,58,0.55)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/** Terangkan/gelapkan warna hex. */
function shade(hex, factor) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const r = Math.min(255, Math.round(((int >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((int >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((int & 255) * factor));
  return `rgb(${r},${g},${b})`;
}
