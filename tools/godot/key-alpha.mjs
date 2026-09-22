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


const [inp, out, gainArg] = process.argv.slice(2);
const gain = parseFloat(gainArg || '2.0');
const { w, h, rgba } = decodePng(inp);
for (let i2 = 0; i2 < w * h; i2++) {
  const r = rgba[i2 * 4], g = rgba[i2 * 4 + 1], b = rgba[i2 * 4 + 2];
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  rgba[i2 * 4 + 3] = Math.max(0, Math.min(255, Math.round(l * gain * 255)));
}
writePng(out, rgba, w, h);
console.log(`[key-alpha] ${inp} -> ${out}`);
