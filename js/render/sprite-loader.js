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
  'assets/sprites/fx_hit.png',
  'assets/sprites/fx_joystick_base.png',
  'assets/sprites/fx_joystick_knob.png',
  'assets/sprites/deco_aura.png',
  'assets/sprites/deco_weed_big.png',
  'assets/sprites/deco_reef_big.png',
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
          // FALLBACK DEV: file sprite belum ada → generate placeholder sederhana.
          const meta = metaByPath.get(path) || { color: '#35d0ba', label: '?' };
          const canvas = generatePlaceholderSprite(meta.color, meta.label);
          cache.set(path, { image: canvas, isPlaceholder: true, width: canvas.width, height: canvas.height });
          fallback++;
          done++;
          console.warn(`[sprite-loader] sprite tidak ditemukan, memakai placeholder: ${path}`);
          onProgress?.(done, paths.length, path, true);
          resolve();
        };
        img.src = path;
      })
  );

  return Promise.all(jobs).then(() => ({ loaded: paths.length, fallback }));
}

/** Ambil entri cache sprite. Fallback on-demand bila belum pernah dimuat. */
export function getSprite(path) {
  let entry = cache.get(path);
  if (!entry) {
    const meta = metaByPath.get(path) || { color: '#35d0ba', label: '?' };
    const canvas = generatePlaceholderSprite(meta.color, meta.label);
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

  // Flash putih saat kena hit (overlay lingkaran lembut)
  if (opts.flash && opts.flash > 0) {
    ctx.globalAlpha = opts.flash * 0.75;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
