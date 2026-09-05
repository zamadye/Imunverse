/**
 * i18n.js — mesin dwibahasa Indonesia/English satu-klik (vanilla, tanpa dependensi).
 * Pola diadopsi dari riset praktik industri (i18next: kamus JSON + interpolasi;
 * dom-i18n: sapuan DOM) dengan 4 mekanisme supaya TIDAK ADA edit manual per layar:
 *   1. t(s)            — kamus berkunci teks-asli + aturan regex utk string ber-angka.
 *   2. sweepAll()      — DFS seluruh DOM (text node + title/aria/placeholder).
 *   3. MutationObserver— semua render dinamis layar otomatis tersapu begitu dibuat.
 *   4. applyDataLanguage() — terjemahan field data JSON saat load/toggle (raw disimpan).
 * Fallback total: bila kunci tak terdaftar, string asli (ID) tampil apa adanya.
 */

import { STATE } from '../core/state-manager.js';

let DICT = null;

/** Muat kamus dwibahasa. */
export async function loadLang() {
  const res = await fetch('data/lang.json');
  if (!res.ok) throw new Error(`Gagal memuat data/lang.json: HTTP ${res.status}`);
  DICT = await res.json();
}

/** Bahasa aktif dengan guard (meta bisa belum dimuat saat boot). */
function lang() {
  return STATE.meta ? (STATE.meta.lang || 'id') : 'id';
}

/** Terjemahkan satu string (ID → EN) saat bahasa aktif 'en'; selain itu apa adanya. */
export function t(s) {
  if (typeof s !== 'string' || !DICT || lang() !== 'en') return s;
  if (Object.prototype.hasOwnProperty.call(DICT.strings, s)) return DICT.strings[s];
  // Toleran whitespace (teks multi-baris di HTML): normalisasi sebelum lookup
  const norm = s.replace(/\s+/g, ' ').trim();
  if (norm !== s) {
    if (Object.prototype.hasOwnProperty.call(DICT.strings, norm)) return DICT.strings[norm];
  }
  const src = norm !== s ? norm : s;
  for (const r of DICT.rules) {
    const re = new RegExp(r.pattern);
    if (re.test(src)) {
      const groups = re.exec(src).slice(1).map((g) => (g == null ? '' : t(g)));
      const out = src.replace(re, () => r.replace); // bentuk fungsi: $n TIDAK disubstitusi native — rekursi yang menggantikan
      return groups.reduce((acc, g, i) => acc.split('$' + (i + 1)).join(g), out);
    }
  }
  return s;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);
const ATTRS = ['title', 'aria-label', 'placeholder'];

/** Terjemahkan seluruh subtree (DFS). */
export function translateTree(root) {
  if (!root || !DICT || lang() !== 'en') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n.nodeType === 1 && SKIP.has(n.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const targets = [];
  while (walker.nextNode()) targets.push(walker.currentNode);
  for (const n of targets) {
    if (n.nodeType === 3) {
      const raw = n.nodeValue || '';
      if (!raw.trim()) continue;
      const tt = t(raw.trim());
      if (tt !== raw.trim()) n.nodeValue = raw.replace(raw.trim(), tt);
    } else {
      for (const at of ATTRS) {
        const v = n.getAttribute(at);
        if (v) {
          const tt = t(v);
          if (tt !== v) n.setAttribute(at, tt);
        }
      }
    }
  }
}

/** Sapu seluruh dokumen — dipakai saat toggle bahasa & setelah boot. */
export function sweepAll() {
  translateTree(document.body);
}

/** Observer: elemen/text yang baru dirender otomatis diterjemahkan. */
let started = false;
export function initSweep() {
  if (started) return;
  started = true;
  new MutationObserver((muts) => {
    if (!DICT || lang() !== 'en') return;
    const roots = new Set();
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === 1) roots.add(n);
        else if (n.nodeType === 3 && n.parentElement) roots.add(n.parentElement);
      });
    }
    roots.forEach(translateTree);
  }).observe(document.body, { childList: true, subtree: true });
}

export function currentLang() {
  return lang();
}
