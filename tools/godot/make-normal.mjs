/**
 * make-normal.mjs — pembangkit NORMAL MAP dari tinggi (luminance) tekstur.
 * Godot Light2D/PointLight2D butuh texture_normal agar permukaan terlihat
 * basah & timbul (mandat owner: pencahayaan normal-map, bukan garis kanvas).
 *
 *   node tools/godot/make-normal.mjs in.png out.png [strength]
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

/** Decoder PNG minimal (RGB/RGBA, 8-bit, non-interlace) + unfilter standar. */
function decodePng(file) {
  const buf = fs.readFileSync(file);
  let off = 8, w = 0, h = 0, color = 6;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); color = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const ch = color === 6 ? 4 : color === 2 ? 3 : 0;
  if (!ch) throw new Error('color type不支持: ' + color);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (ft === 1) v = (v + a) & 255;
      else if (ft === 2) v = (v + b) & 255;
      else if (ft === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (ft === 4) v = (v + paeth(a, b, c)) & 255;
      line[x] = v;
    }
    for (let x = 0; x < w; x++) {
      const si = x * ch, di = (y * w + x) * 4;
      px[di] = line[si]; px[di + 1] = line[si + 1]; px[di + 2] = line[si + 2];
      px[di + 3] = ch === 4 ? line[si + 3] : 255;
    }
    prev = line;
  }
  return { w, h, rgba: px };
}

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
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(file, rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * stride + 1);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

const [inp, out, strengthArg] = process.argv.slice(2);
const strength = parseFloat(strengthArg || '2.2');
const { w, h, rgba } = decodePng(inp);
if (!rgba) { console.error('decode gagal', inp); process.exit(1); }
const lum = new Float32Array(w * h);
for (let i = 0; i < w * h; i++) {
  lum[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
}
const at = (x, y) => lum[((y + h) % h) * w + ((x + w) % w)];
const nrm = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    let nx = -dx, ny = -dy, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    nrm[i] = Math.round((nx * 0.5 + 0.5) * 255);
    nrm[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    nrm[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    nrm[i + 3] = 255;
  }
}
writePng(out, nrm, w, h);
console.log(`[normal-map] ${inp} -> ${out} (${w}x${h}, strength ${strength})`);
