/**
 * share-image.js — ADDENDUM §1.5 & §3.4: generator gambar share 1080×1080.
 *
 * Bukan template statis: di-compose di canvas saat pemain menekan BAGIKAN
 * (hero + medan + tier + teks + link referral). Hasil blob → Web Share API
 * (bila bisa) atau unduhan otomatis. QR code butuh library/server —
 * SEMENTARA diganti URL referral sebagai teks yang mudah dibaca.
 */

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Gambar latar 1080×1080: gradient gelap warna tier + bokeh sel. */
function paintBackground(g, S, tierColor) {
  const bg = g.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, '#0c1f22');
  bg.addColorStop(0.55, '#123334');
  bg.addColorStop(1, '#0a1a1c');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);
  // Bokeh sel samar
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S, y = rnd() * S, r = 18 + rnd() * 90;
    g.globalAlpha = 0.05 + rnd() * 0.07;
    g.fillStyle = i % 3 === 0 ? tierColor : '#7de8d2';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  // Bingkai tier
  g.strokeStyle = tierColor; g.lineWidth = 14;
  roundRectPath(g, 28, 28, S - 56, S - 56, 48); g.stroke();
}

/** Hero + cincin medannya di tengah. */
async function paintHero(g, S, hero, tierColor, cy) {
  const cx = S / 2;
  // Cincin medan
  g.save();
  g.strokeStyle = hero.color || '#8df7d2';
  g.globalAlpha = 0.85; g.lineWidth = 10;
  g.shadowColor = hero.color || '#8df7d2'; g.shadowBlur = 60;
  g.beginPath(); g.arc(cx, cy, 250, 0, Math.PI * 2); g.stroke();
  g.restore();
  // Sprite hero
  try {
    const img = await loadImg(hero.sprite);
    const size = 420;
    g.save();
    g.shadowColor = tierColor; g.shadowBlur = 80;
    g.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    g.restore();
  } catch {
    // Cadangan: lingkaran + inisial bila sprite gagal dimuat
    g.fillStyle = hero.color || '#8df7d2';
    g.beginPath(); g.arc(cx, cy, 170, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0c1f22';
    g.font = '900 200px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((hero.name || '?').slice(0, 1), cx, cy + 10);
  }
}

function paintCenterText(g, S, lines, startY) {
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  let y = startY;
  for (const ln of lines) {
    g.font = ln.font;
    g.fillStyle = ln.color || '#fff';
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 12;
    g.fillText(ln.text, S / 2, y);
    y += ln.gap || 70;
  }
  g.shadowBlur = 0;
}

/**
 * Gambar hasil kapsul: "Saya dapat [HERO]! 🧬 / Hero ke-N dari 11".
 * @returns {Promise<Blob>} PNG 1080×1080
 */
export async function generateCapsuleImage({ hero, tier, tierName, tierColor, heroCount, totalHeroes, refUrl }) {
  const S = 1080;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  paintBackground(g, S, tierColor);
  // Header brand
  paintCenterText(g, S, [
    { text: '⬡ PHAGOS', font: '900 64px system-ui, sans-serif', color: '#8df7d2', gap: 90 },
    { text: 'KAPSUL MEMBRAN', font: '700 40px system-ui, sans-serif', color: '#cfeee6', gap: 60 },
  ], 150);
  await paintHero(g, S, hero, tierColor, 500);
  paintCenterText(g, S, [
    { text: `Saya dapat ${hero.name}! 🧬`, font: '900 72px system-ui, sans-serif', gap: 96 },
    { text: `${tierName} • Medan ${fieldLabel(hero)}`, font: '700 44px system-ui, sans-serif', color: tierColor, gap: 80 },
    { text: `Hero ke-${heroCount} dari ${totalHeroes}`, font: '500 40px system-ui, sans-serif', color: '#cfeee6', gap: 110 },
    { text: 'Main gratis:', font: '500 36px system-ui, sans-serif', color: '#9fd8cc', gap: 60 },
    { text: refUrl, font: '700 44px system-ui, sans-serif', color: '#ffd166', gap: 0 },
  ], 830);
  return new Promise((resolve, reject) => {
    if (cv.toBlob) cv.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob gagal'))), 'image/png');
    else reject(new Error('toBlob tak didukung'));
  });
}

/**
 * Gambar build mutasi (§3.4): hero + daftar mutasi + statistik run.
 * @returns {Promise<Blob>} PNG 1080×1080
 */
export async function generateBuildImage({ hero, tierColor, mutations, wave, kills, engulfs }) {
  const S = 1080;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  paintBackground(g, S, tierColor || '#8df7d2');
  paintCenterText(g, S, [
    { text: '⬡ PHAGOS', font: '900 56px system-ui, sans-serif', color: '#8df7d2', gap: 80 },
    { text: `Build ${hero.name} saya 🧬`, font: '900 60px system-ui, sans-serif', gap: 70 },
  ], 130);
  await paintHero(g, S, hero, tierColor || '#8df7d2', 430);
  // Daftar mutasi (maks 6 baris)
  g.textAlign = 'center';
  const list = (mutations || []).slice(0, 6);
  list.forEach((m, i) => {
    g.font = '600 38px system-ui, sans-serif';
    g.fillStyle = i === 0 ? '#ffd166' : '#eafff7';
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 10;
    g.fillText(`${i + 1}. ${m}`, S / 2, 730 + i * 52);
  });
  g.shadowBlur = 0;
  paintCenterText(g, S, [
    { text: `Wave ${wave} • ${kills} kill • ${engulfs} engulf`, font: '700 44px system-ui, sans-serif', color: '#8df7d2', gap: 90 },
    { text: 'phagos.space', font: '700 44px system-ui, sans-serif', color: '#ffd166', gap: 0 },
  ], 730 + list.length * 52 + 30);
  return new Promise((resolve, reject) => {
    if (cv.toBlob) cv.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob gagal'))), 'image/png');
    else reject(new Error('toBlob tak didukung'));
  });
}

/** Label bentuk medan hero untuk teks share. */
export function fieldLabel(hero) {
  const shape = hero && hero.membrane ? hero.membrane.shape : 'circle';
  switch (shape) {
    case 'cone': return 'Kerucut';
    case 'ring': return 'Cincin';
    case 'line': return 'Garis';
    case 'none': return 'Tak Terlihat';
    default: return 'Lingkaran';
  }
}

/**
 * Bagikan blob gambar: Web Share API (level 2, dengan file) bila bisa,
 * atau unduh otomatis sebagai cadangan. @returns {Promise<'shared'|'downloaded'>}
 */
export async function shareImageBlob(blob, filename, title) {
  const file = new File([blob], filename, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: title || 'PHAGOS' });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'shared'; // batal = anggap selesai
  }
  // Fallback: unduh
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
