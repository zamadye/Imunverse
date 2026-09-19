/**
 * Verify the T-Bolt separable part pack cut from a single sheet.
 * Checks: 21 files exist, manifest valid, PNG 512x512 RGBA,
 * corners fully transparent, L files are exact horizontal mirrors of R.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PARTS = path.join(ROOT, 'assets', 'character-anim-src', 'tbolt', 'parts');
const errors = [];
const results = {};
const check = (name, ok, detail = '') => {
  results[name] = ok ? 'OK' : `GAGAL — ${detail}`;
  if (!ok) errors.push(`${name}: ${detail}`);
};

function readPng(file) {
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('bukan PNG');
  let pos = 8; let width = 0; let height = 0; let bitDepth = 0; let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (colorType !== 6 || bitDepth !== 8) throw new Error(`RGBA8 diharapkan, dapat colorType=${colorType} bit=${bitDepth}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = Buffer.alloc(width * height * 4);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? px[y * stride + x - 4] : 0;
      const up = y > 0 ? px[(y - 1) * stride + x] : 0;
      const upLeft = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      let v = raw[p++];
      if (filter === 1) v = (v + left) & 255;
      else if (filter === 2) v = (v + up) & 255;
      else if (filter === 3) v = (v + ((left + up) >> 1)) & 255;
      else if (filter === 4) {
        const q = left + up - upLeft;
        const pa = Math.abs(q - left); const pb = Math.abs(q - up); const pc = Math.abs(q - upLeft);
        v = (v + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
      }
      px[y * stride + x] = v;
    }
  }
  return { width, height, px };
}

const manifestPath = path.join(PARTS, 'parts-manifest.json');
check('manifest exists', fs.existsSync(manifestPath));
let manifest = null;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  check('manifest valid JSON + 21 parts', Array.isArray(manifest.parts) && manifest.parts.length === 21,
    `dapat ${manifest.parts?.length}`);
} catch (e) { check('manifest valid JSON + 21 parts', false, e.message); }

const pix = {};
for (const part of manifest?.parts || []) {
  const file = path.join(PARTS, part.file);
  if (!fs.existsSync(file)) { check(`file ${part.file}`, false, 'hilang'); continue; }
  try {
    const { width, height, px } = readPng(file);
    pix[part.id] = { width, height, px };
    const corners = [3, width * 4 - 1, (height - 1) * width * 4 + 3, height * width * 4 - 1]
      .map((i) => px[i]);
    check(`${part.id} 512x512 RGBA + sudut transparan`,
      width === 512 && height === 512 && corners.every((c) => c === 0),
      `${width}x${height} sudut=[${corners}]`);
  } catch (e) { check(`file ${part.file}`, false, e.message); }
}

for (const part of manifest?.parts || []) {
  if (part.side !== 'left' || !part.mirrorOf) continue;
  const a = pix[part.mirrorOf]; const b = pix[part.id];
  if (!a || !b) { check(`mirror ${part.mirrorOf} -> ${part.id}`, false, 'piksel tak termuat'); continue; }
  let diff = 0;
  for (let y = 0; y < 512 && diff === 0; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const j = (y * 512 + (511 - x)) * 4;
      for (let k = 0; k < 4; k++) {
        if (a.px[i + k] !== b.px[j + k]) { diff++; break; }
      }
      if (diff) break;
    }
  }
  check(`mirror ${part.mirrorOf} -> ${part.id} (cermin tepat)`, diff === 0, `${diff} piksel beda`);
}

const sheet = path.join(ROOT, 'assets', 'character-anim-src', 'tbolt', 'CONTACT-SHEET.png');
check('CONTACT-SHEET exists', fs.existsSync(sheet));

console.log(JSON.stringify(results, null, 2));
console.log(`\n=== ERROR (${errors.length}) ===`);
for (const e of errors) console.log('- ' + e);
process.exit(errors.length ? 1 : 0);
