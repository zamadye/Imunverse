// Utilitas PNG minimal (stdlib Node): validasi struktur + decode piksel.
// Dipakai verifikasi foto mutasi tanpa dependensi browser.
import zlib from 'node:zlib';
import fs from 'node:fs';

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Baca & validasi PNG; hasil: {w,h,depth,color,interlace,crcOK,rgba|null}. */
export function readPng(file, { decode = true } = {}) {
  const buf = fs.readFileSync(file);
  const errs = [];
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) errs.push('bukan PNG (signature salah)');
  let off = 8;
  let ihdr = null;
  let crcOK = true;
  const idat = [];
  let sawIEND = false;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (off + 12 + len > buf.length) { errs.push(`chunk ${type} terpotong`); break; }
    const data = buf.subarray(off + 8, off + 8 + len);
    const want = buf.readUInt32BE(off + 8 + len);
    const got = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
    if (got !== want) { crcOK = false; errs.push(`CRC chunk ${type} salah`); }
    if (type === 'IHDR') {
      if (len !== 13) errs.push('IHDR bukan 13 byte');
      ihdr = {
        w: data.readUInt32BE(0), h: data.readUInt32BE(4),
        depth: data[8], color: data[9], compress: data[10], filter: data[11], interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') { sawIEND = true; off += 12 + len; break; }
    off += 12 + len;
  }
  if (!ihdr) errs.push('IHDR tidak ada');
  else {
    if (ihdr.depth !== 8) errs.push(`bit depth ${ihdr.depth} (harus 8)`);
    if (ihdr.color !== 6) errs.push(`color type ${ihdr.color} (harus 6 = RGBA)`);
    if (ihdr.interlace !== 0) errs.push('interlaced (tidak didukung pemeriksa ini)');
  }
  if (!sawIEND) errs.push('IEND tidak ada');

  let rgba = null;
  if (decode && ihdr && !errs.length) {
    try {
      rgba = inflateToRgba(Buffer.concat(idat), ihdr);
    } catch (e) {
      errs.push('gagal decode piksel: ' + e.message);
    }
  }
  return { ok: errs.length === 0, errs, crcOK, ...(ihdr || {}), rgba };
}

function inflateToRgba(idat, ihdr) {
  const raw = zlib.inflateSync(idat);
  const { w, h } = ihdr;
  const bpp = 4;
  const stride = w * bpp;
  const out = Buffer.alloc(stride * h);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      switch (ft) {
        case 0: break;
        case 1: v = v + a; break;
        case 2: v = v + b; break;
        case 3: v = v + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error('filter tidak dikenal: ' + ft);
      }
      cur[i] = v & 0xff;
    }
  }
  return out;
}

/** Metrik isi: tinggi, dasar bawah, pusat-x (rasio kanvas) + tutupan piksel buram. */
export function contentMetrics(rgba, w, h, thresh = 24) {
  const minRow = Math.max(3, Math.round(w * 0.004));
  const minCol = Math.max(3, Math.round(h * 0.004));
  let top = -1, bottom = -1, left = -1, right = -1, opaque = 0;
  for (let y = 0; y < h; y++) {
    let cnt = 0;
    for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3] > thresh) cnt++;
    if (cnt >= minRow) { if (top < 0) top = y; bottom = y; }
  }
  for (let x = 0; x < w; x++) {
    let cnt = 0;
    for (let y = 0; y < h; y++) if (rgba[(y * w + x) * 4 + 3] > thresh) cnt++;
    if (cnt >= minCol) { if (left < 0) left = x; right = x; }
  }
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 200) opaque++;
  if (top < 0) return { height: 0, bottom: 0, cx: 0.5, coverage: 0 };
  return {
    height: (bottom - top + 1) / h,
    bottom: (bottom + 1) / h,
    cx: ((left + right + 1) / 2) / w,
    coverage: opaque / (w * h),
    box: { left, top, right: right + 1, bottom: bottom + 1 },
  };
}

/** Sisa warna latar magenta (#FF00FF) pada piksel buram. */
export function magentaPixels(rgba) {
  let n = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 200) continue;
    if (rgba[i] > 235 && rgba[i + 2] > 235 && rgba[i + 1] < 60) n++;
  }
  return n;
}
