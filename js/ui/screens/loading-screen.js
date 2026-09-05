/**
 * loading-screen.js — Screen loading awal (progress preload sprite & data).
 */

const bar = () => document.getElementById('loading-bar');
const label = () => document.getElementById('loading-label');

export function show() {
  setProgress(0, 'Menyiapkan organisme…');
}

export function hide() {}

export function setProgress(pct, text) {
  const b = bar();
  if (b) b.style.width = Math.max(0, Math.min(100, pct)) + '%';
  const l = label();
  if (l && text) l.textContent = text;
}

/** Gagal muat: tampilkan pesan merah + saran perbaikan (bukan diam selamanya). */
export function showBootError(message) {
  const l = label();
  if (l) {
    l.textContent = 'Gagal memuat game';
    l.style.color = '#d63a4e';
    l.style.fontWeight = '900';
  }
  const b = bar();
  if (b) { b.style.width = '100%'; b.style.background = '#d63a4e'; }
  let box = document.getElementById('boot-error');
  if (!box) {
    box = document.createElement('div');
    box.id = 'boot-error';
    box.style.cssText = 'margin-top:10px;font-size:11px;font-weight:700;color:#8a4b3a;max-width:300px;text-align:center;line-height:1.5';
    l?.parentElement?.appendChild(box);
  }
  box.innerHTML = `${String(message || '').replace(/[<>&]/g, '')}<br><br>Coba: <b>hard refresh</b> (Ctrl+Shift+R / tutup tab lalu buka lagi). Pastikan server dijalankan dari folder game terbaru: <b>python3 tools/server.py</b>`;
}
