#!/usr/bin/env python3
"""
build-mutation-sprites.py — Olah foto mutasi hero menjadi sprite transparan.

Latar belakang
--------------
Sistem mutasi tadinya memakai overlay generik `assets/sprites/mut_*.png` yang
ditumpuk di atas sprite karakter (jelek & tidak menyatu). Sekarang setiap hero
punya foto bentuk MUTASI-nya sendiri (`assets/sprites/hero_<id>_mut_*.png`)
yang bentuk & gerakannya serupa dengan sprite dasar — tinggal dipakai renderer.

Alur
----
1. Foto sumber (AI-generated, latar MAGENTA murni #FF00FF) taruh di
   `tools/.mutsrc/<nama>.png`.
2. Skrip ini: buang latar magenta (chroma-key + despill ringan) → potong
   bounding box isi → pad → skala ke 256 px → tulis PNG RGBA.
3. Hasil: `assets/sprites/<nama>.png`, siap dipakai `sprite-loader`.

Nol dependensi (stdlib saja) — sama seperti `tools/gen_sprites.py`.

Pakai:
    python3 tools/build-mutation-sprites.py            # olah semua di .mutsrc
    python3 tools/build-mutation-sprites.py nama.png   # olah satu berkas
"""

from __future__ import annotations

import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "tools", ".mutsrc")
OUT_DIR = os.path.join(ROOT, "assets", "sprites")
OUT_SIZE = 256          # sprite logis (drawSprite menskala otomatis)
PAD_PCT = 0.04          # margin tipis agar outline tidak kepotong
KEY = (255, 0, 255)     # magenta murni = latar yang dibuang
KEY_SIM = 96            # ambang jarak warna ke latar (0-441)
KEY_SOFT = 34           # jarak tempat alpha mulai memudar (anti-bergigi)


# --------------------------------------------------------------- PNG I/O
def decode_png(path: str):
    """Dekode PNG (truecolor 8-bit, ±alpha) → (w, h, bytearray RGBA)."""
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "bukan PNG: " + path
    pos = 8
    idat = bytearray()
    w = h = depth = ctype = None
    while pos < len(data):
        (ln,) = struct.unpack(">I", data[pos:pos + 4])
        tag = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + ln]
        if tag == b"IHDR":
            w, h, depth, ctype = struct.unpack(">IIBB", body[:10])
        elif tag == b"IDAT":
            idat += body
        elif tag == b"IEND":
            break
        pos += 12 + ln
    assert depth == 8, "hanya mendukung 8-bit: " + path
    channels = {0: 1, 2: 3, 4: 2, 6: 4}[ctype]
    raw = zlib.decompress(bytes(idat))
    stride = w * channels
    out = bytearray(w * h * 4)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        ft = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if ft == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif ft == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ft == 3:
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ft == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = prev[i]
                c = prev[i - channels] if i >= channels else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        for x in range(w):
            s = x * channels
            d = (y * w + x) * 4
            if channels >= 3:
                out[d] = line[s]
                out[d + 1] = line[s + 1]
                out[d + 2] = line[s + 2]
                out[d + 3] = line[s + 3] if channels == 4 else 255
            else:  # grayscale
                out[d] = out[d + 1] = out[d + 2] = line[s]
                out[d + 3] = line[s + 1] if channels == 2 else 255
        prev = line
    return w, h, out


def encode_png(path: str, w: int, h: int, rgba: bytearray) -> None:
    def chunk(tag: bytes, body: bytes) -> bytes:
        return (struct.pack(">I", len(body)) + tag + body
                + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF))

    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw.extend(rgba[y * w * 4:(y + 1) * w * 4])
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(png)


# --------------------------------------------------------------- olah
def chroma_key(w: int, h: int, buf: bytearray) -> None:
    """Buang latar magenta: alpha = 0 di latar, mulus di tepi, + despill."""
    kr, kg, kb = KEY
    for i in range(w * h):
        d = i * 4
        r, g, b, a = buf[d], buf[d + 1], buf[d + 2], buf[d + 3]
        dist = abs(r - kr) + abs(g - kg) + abs(b - kb)
        if dist <= KEY_SIM:
            buf[d + 3] = 0
            continue
        if dist < KEY_SIM + KEY_SOFT:
            buf[d + 3] = int(a * (dist - KEY_SIM) / KEY_SOFT)
        # Despill: kurangi semburat magenta pada piksel tepi (r & b tinggi, g rendah)
        if buf[d + 3] > 0 and g + 24 < min(r, b):
            k = min(r, b) - g
            if k > 90:
                buf[d] = max(g, r - (k - 90) // 2)
                buf[d + 2] = max(g, b - (k - 90) // 2)


def content_box(w: int, h: int, buf: bytearray, thresh: int = 24):
    min_x, min_y, max_x, max_y = w, h, -1, -1
    for y in range(h):
        row = y * w * 4
        for x in range(w):
            if buf[row + x * 4 + 3] > thresh:
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
                if y < min_y:
                    min_y = y
                if y > max_y:
                    max_y = y
    if max_x < 0:
        return 0, 0, w, h
    return min_x, min_y, max_x + 1, max_y + 1


def crop(buf: bytearray, w: int, box) -> tuple[int, int, bytearray]:
    x0, y0, x1, y1 = box
    nw, nh = x1 - x0, y1 - y0
    out = bytearray(nw * nh * 4)
    for y in range(nh):
        src = ((y0 + y) * w + x0) * 4
        dst = y * nw * 4
        out[dst:dst + nw * 4] = buf[src:src + nw * 4]
    return nw, nh, out


def scale(buf: bytearray, w: int, h: int, size: int) -> bytearray:
    """Skala bilinear dengan alpha premultiply (ujian: tepi tetap halus)."""
    side = max(w, h)
    pad = int(side * PAD_PCT)
    sw, sh = w + pad * 2, h + pad * 2
    canvas = bytearray(sw * sh * 4)
    for y in range(h):
        src = y * w * 4
        dst = ((y + pad) * sw + pad) * 4
        canvas[dst:dst + w * 4] = buf[src:src + w * 4]
    out = bytearray(size * size * 4)
    fx, fy = sw / size, sh / size
    for y in range(size):
        sy0 = int(y * fy)
        sy1 = min(sw * sh and sh - 1, int(y * fy) + 1)
        wy = y * fy - sy0
        for x in range(size):
            sx0 = int(x * fx)
            sx1 = min(sw - 1, sx0 + 1)
            wx = x * fx - sx0
            acc = [0.0, 0.0, 0.0, 0.0]
            for yy, wgt_y in ((sy0, 1 - wy), (sy1, wy)):
                base = yy * sw * 4
                for xx, wgt_x in ((sx0, 1 - wx), (sx1, wx)):
                    i = base + xx * 4
                    a = canvas[i + 3] / 255.0
                    wgt = wgt_x * wgt_y
                    acc[0] += canvas[i] * a * wgt
                    acc[1] += canvas[i + 1] * a * wgt
                    acc[2] += canvas[i + 2] * a * wgt
                    acc[3] += canvas[i + 3] * wgt
            d = (y * size + x) * 4
            a = acc[3]
            if a <= 0.0001:
                continue
            # acc[0..2] premultiplied (warna x alpha 0..1), acc[3] dalam skala 0..255
            # → un-premultiply dengan faktor 255/a.
            k = 255.0 / a
            out[d] = min(255, int(acc[0] * k))
            out[d + 1] = min(255, int(acc[1] * k))
            out[d + 2] = min(255, int(acc[2] * k))
            out[d + 3] = min(255, int(a))
    return out


def build_one(name: str) -> str:
    src = os.path.join(SRC_DIR, name)
    w, h, buf = decode_png(src)
    chroma_key(w, h, buf)
    nw, nh, cropped = crop(buf, w, content_box(w, h, buf))
    out = scale(cropped, nw, nh, OUT_SIZE)
    dst = os.path.join(OUT_DIR, name)
    encode_png(dst, OUT_SIZE, OUT_SIZE, out)
    return dst


def main() -> None:
    if not os.path.isdir(SRC_DIR):
        print("Tidak ada tools/.mutsrc — tidak ada yang diolah.")
        return
    names = sys.argv[1:] or sorted(f for f in os.listdir(SRC_DIR) if f.lower().endswith(".png"))
    for n in names:
        dst = build_one(n)
        print("ok", os.path.relpath(dst, ROOT), os.path.getsize(dst) // 1024, "KB")


if __name__ == "__main__":
    main()
