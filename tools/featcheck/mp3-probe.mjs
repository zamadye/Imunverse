/**
 * mp3-probe.mjs — probe durasi/param MP3 tanpa dependensi eksternal.
 * Skip ID3v2 → scan frame header MPEG (tabel bitrate MPEG1 Layer III benar) →
 * hitung durasi dari jumlah frame × 1152 sample, cross-check dengan ukuran÷bitrate.
 * Dipakai payload-audit untuk VO TTS (file CBR dari Lavf/ffmpeg).
 */
import fs from 'node:fs';

const BR_M1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]; // kbps
const SR_M1 = [44100, 48000, 32000];

export function probeMp3(file) {
  const b = fs.readFileSync(file);
  let off = 0;
  // skip ID3v2
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
    const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
    off = 10 + size;
  }
  const dataBytes = b.length - off;

  // 1) Tag Xing/LAME "Info" (ground truth untuk VBR — file TTS Lavf)
  let xingFrames = null, xingBytes = null, xingTag = null;
  for (let i = off; i < Math.min(off + 600, b.length - 4); i++) {
    const isInfo = b[i] === 0x49 && b[i + 1] === 0x6e && b[i + 2] === 0x66 && b[i + 3] === 0x6f;
    const isXing = b[i] === 0x58 && b[i + 1] === 0x69 && b[i + 2] === 0x6e && b[i + 3] === 0x67;
    if (!isInfo && !isXing) continue;
    xingTag = isInfo ? 'Info' : 'Xing';
    const flags = b.readUInt32BE(i + 4);
    let p = i + 8;
    if (flags & 1) { xingFrames = b.readUInt32BE(p); p += 4; }
    if (flags & 2) { xingBytes = b.readUInt32BE(p); p += 4; }
    if (flags & 4) p += 100;
    break;
  }

  // 2) Header frame pertama → sampleRate (sr konstan se-file)
  let i = off, sr = 44100, firstBr = null;
  while (i + 4 < b.length) {
    if (b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0) {
      const v = (b[i + 1] << 4) | (b[i + 2] >> 4);
      const ver = (v >> 3) & 3, layer = (v >> 1) & 3;
      const brIdx = (b[i + 2] >> 2) & 0xf, srIdx = (b[i + 2] >> 6) & 3, pad = (b[i + 2] >> 1) & 1;
      if (ver === 3 && layer === 1 && brIdx > 0 && brIdx < 15 && srIdx < 3) {
        sr = SR_M1[srIdx]; if (!firstBr) firstBr = BR_M1L3[brIdx] * 1000;
        if (xingFrames != null) break; // cukup sr
      }
    }
    i++;
  }

  // 3) Xing/LAME ada → GROUND TRUTH (file TTS Lavf selalu VBR + tag).
  //    Jangan pernah percayai CBR-inference di atas file yang punya tag.
  if (xingFrames != null) {
    return { bytes: b.length, id3Bytes: off, frames: xingFrames, sampleRate: sr, bitrateKbps: Math.round((dataBytes * 8) / (xingFrames * 1152) / 100) * 100, vbr: true, xingTag, xingBytes, dur: xingFrames * 1152 / sr, xingConsistent: xingBytes === dataBytes };
  }

  // 4) Tanpa tag → CBR strict (20 frame sync harus sejajar)
  i = off;
  while (i + 4 < b.length) {
    if (b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0) {
      const v = (b[i + 1] << 4) | (b[i + 2] >> 4);
      const ver = (v >> 3) & 3, layer = (v >> 1) & 3;
      const brIdx = (b[i + 2] >> 2) & 0xf, srIdx = (b[i + 2] >> 6) & 3, pad = (b[i + 2] >> 1) & 1;
      if (ver === 3 && layer === 1 && brIdx > 0 && brIdx < 15 && srIdx < 3) {
        const br = BR_M1L3[brIdx] * 1000;
        const len = Math.floor((144 * br) / SR_M1[srIdx]) + pad;
        if (len > 10) {
          let cbr = true;
          for (let k = 1; k <= 20 && i + k * len + 1 < b.length; k++) {
            if (!(b[i + k * len] === 0xff && (b[i + k * len + 1] & 0xe0) === 0xe0)) { cbr = false; break; }
          }
          if (cbr && i + 20 * len <= b.length + len) {
            const frames = Math.floor(dataBytes / len);
            return { bytes: b.length, id3Bytes: off, frames, sampleRate: SR_M1[srIdx], bitrateKbps: br / 1000, vbr: false, xingTag: null, dur: frames * 1152 / SR_M1[srIdx] };
          }
        }
      }
    }
    i++;
  }
  return { bytes: b.length, id3Bytes: off, frames: null, sampleRate: sr, bitrateKbps: firstBr ? firstBr / 1000 : null, vbr: null, xingTag: null, dur: null };
}

if (process.argv[1] && process.argv[1].endsWith('mp3-probe.mjs')) {
  for (const f of process.argv.slice(2)) {
    const r = probeMp3(f);
    const vbr = r.vbr ? `VBR${r.xingTag ? ' (' + r.xingTag + ')' : ''}` : (r.bitrateKbps ? r.bitrateKbps + ' kbps CBR' : 'n/a');
    console.log(`${f}  →  ${r.bytes} B · ${r.frames ?? '?'} frame · ${r.sampleRate} Hz · ${vbr}  →  durasi ${(r.dur ?? 0).toFixed(1)} s`);
  }
}
