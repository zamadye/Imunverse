/**
 * shim.mjs — jembatan DOM minimal agar mesin Godot (build web/wasm) bisa
 * berjalan di Node. Yang dibutuhkan hanyalah objek `window`/`document` yang
 * cukup untuk dilewati saat boot; dengan `--headless` Godot tidak pernah
 * membuat konteks WebGL, jadi tidak ada canvas sungguhan yang diperlukan.
 *
 * jsdom dipakai karena sudah terpasang sebagai devDependency repo
 * (`npm i` bila belum ada).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><canvas id="canvas" tabindex="1"></canvas></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const set = (k, v) => {
  try { globalThis[k] = v; } catch { Object.defineProperty(globalThis, k, { value: v, configurable: true }); }
};
set('window', dom.window);
set('self', dom.window);
set('document', dom.window.document);
set('HTMLCanvasElement', dom.window.HTMLCanvasElement);
set('HTMLElement', dom.window.HTMLElement);
set('Element', dom.window.Element);
set('Image', dom.window.Image);
set('requestAnimationFrame', (cb) => setTimeout(() => cb(Date.now()), 16));
set('cancelAnimationFrame', (id) => clearTimeout(id));
set('addEventListener', (...a) => dom.window.addEventListener(...a));
set('removeEventListener', (...a) => dom.window.removeEventListener(...a));
set('screen', { width: 1280, height: 720, availWidth: 1280, availHeight: 720 });
set('devicePixelRatio', 1);
// Tidak ada WebGL di Node — pengembalian null membuat Godot memilih jalur headless.
try { dom.window.HTMLCanvasElement.prototype.getContext = () => null; } catch { /* abaikan */ }

export { dom };
