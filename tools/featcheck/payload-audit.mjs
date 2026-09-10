/**
 * payload-audit.mjs — Feasibility Check 3D (Task 1): audit payload REAL.
 * Mengukur (tanpa asumsi):
 *  - Ukuran total game saat ini (raw + gzip) per kategori & jumlah request
 *  - Ukuran engine 3D (three.js) dari distribusi resmi
 *  - Ukuran + durasi file VO TTS (assets/audio/narration/*.mp3)
 * Hasil: tabel input untuk model waktu-load & budget per cutscene.
 * Jalankan: node tools/featcheck/payload-audit.mjs
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeMp3 } from './mp3-probe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MB = (n) => (n / 1048576).toFixed(2);

function auditDir(dir, ext = null) {
  let n = 0, b = 0, g = 0;
  const p = path.join(ROOT, dir);
  if (!fs.existsSync(p)) return { n, b, g };
  for (const f of fs.readdirSync(p)) {
    const fp = path.join(p, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) { const r = auditDir(fp.split(ROOT + path.sep).join(path.sep), ext); n += r.n; b += r.b; g += r.g; continue; }
    if (ext && !f.endsWith(ext)) continue;
    const t = fs.readFileSync(fp);
    b += t.length; g += zlib.gzipSync(t, { level: 6 }).length; n++;
  }
  return { n, b, g };
}

console.log('=== PAYLOAD GAME SEKARANG (BUILD 40a) ===');
const cats = [
  ['js', auditDir('js', '.js')],
  ['css', auditDir('styles', '.css')],
  ['data-json', auditDir('data', '.json')],
  ['sprites-png', auditDir('assets/sprites', '.png')],
  ['audio-mp3', auditDir('assets/audio', '.mp3')],
];
let totN = 1, totB = fs.statSync(path.join(ROOT, 'index.html')).size,
    totG = zlib.gzipSync(fs.readFileSync(path.join(ROOT, 'index.html'))).length;
for (const [k, v] of cats) {
  console.log(`  ${k.padEnd(12)} ${String(v.n).padStart(4)} file  raw ${MB(v.b).padStart(7)} MB   gzip ${MB(v.g).padStart(7)} MB`);
  totN += v.n; totB += v.b; totG += v.g;
}
console.log(`  ${'TOTAL'.padEnd(12)} ${String(totN).padStart(4)} file  raw ${MB(totB).padStart(7)} MB   gzip ${MB(totG).padStart(7)} MB`);

console.log('\n=== ENGINE 3D (VENDORED di repo: js/vendor/three.module.js, r160 self-contained) ===');
const threeDir = path.join(ROOT, 'js/vendor');
for (const f of fs.existsSync(threeDir) ? fs.readdirSync(threeDir).filter((x) => x.endsWith('.js')) : []) {
  const t = fs.readFileSync(path.join(threeDir, f));
  console.log(`  ${f.padEnd(24)} raw ${MB(t.length).padStart(7)} MB   gzip ${MB(zlib.gzipSync(t, { level: 6 }).length).padStart(7)} MB`);
}

console.log('\n=== VO NARRASI (TTS, file nyata di repo) ===');
const audDir = path.join(ROOT, 'assets/audio/narration');
for (const f of fs.existsSync(audDir) ? fs.readdirSync(audDir).filter((x) => x.endsWith('.mp3')) : []) {
  const m = probeMp3(path.join(audDir, f));
  const vbr = m.vbr ? `VBR${m.xingTag ? ' (' + m.xingTag + ')' : ''}` : (m.bitrateKbps + ' kbps CBR');
  console.log(`  ${f.padEnd(32)} ${(m.bytes / 1024).toFixed(1).padStart(6)} KB   ${m.dur.toFixed(1).padStart(5)} dtk   (${m.frames} frame, ${vbr}, ${m.sampleRate} Hz)`);
}

console.log('\n=== MODEL WAKTU LOAD (payload gzip ÷ bandwidth, + overhead request) ===');
const reqs = totN; // 1 request per file (tanpa service worker — Fase 9 PWA belum)
const tiers = [
  ['3G lemah', 0.5 * 1024 * 1000 / 8, 250],
  ['3G baik', 1.5 * 1024 * 1000 / 8, 150],
  ['4G rendah', 2 * 1024 * 1000 / 8, 120],
  ['4G baik', 6 * 1024 * 1000 / 8, 80],
];
for (const [name, bps, rtt] of tiers) {
  const download = totG / bps;
  // overhead: tiap request ≈ 1 RTT (TLS/HTTP tanpa multiplexing konservatif) — 3G era lama 6-10 RTT/connection
  const conn = (reqs / 6) * (rtt / 1000);
  console.log(`  ${name.padEnd(12)} bandwidth ${name.includes('3G') ? (name.includes('lemah') ? 0.5 : 1.5) : name.includes('rendah') ? 2 : 6} Mbps → total load ≈ ${(download + conn).toFixed(1)} dtk  (download ${download.toFixed(1)}s + ${reqs} request)`);
}
console.log('  Asumsi: HTTP/1.1 ≈6 koneksi paralel, TLS handshake termasuk dalam RTT efektif. HTTP/2 (server statis python) TIDAK aktif → request berurutan per koneksi.');
