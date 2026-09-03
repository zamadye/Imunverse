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
