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
# Ukur "kemagentaan" = min(r,b) - g. Latar hasil generasi kadang TIDAK persis
# #FF00FF (mis. #d719cd), jadi jarak warna mentah tidak cukup — yang dipakai
# adalah selisih kanal: latar (>158) dibuang, karakter (<118) utuh, di
# antaranya alpha memudar supaya tepi tidak bergigi.
KEY_LO = 118            # di bawah ini = pasti karakter
KEY_HI = 158            # di atas ini = pasti latar


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
    """Buang latar magenta berdasar SELISIH KANAL (tahan latar tak presisi)."""
    span = KEY_HI - KEY_LO
    for i in range(w * h):
        d = i * 4
        r, g, b, a = buf[d], buf[d + 1], buf[d + 2], buf[d + 3]
        m = r if r < b else b
        mag = m - g
        if mag >= KEY_HI:
            buf[d + 3] = 0
            continue
        if mag > KEY_LO:
            buf[d + 3] = int(a * (1.0 - (mag - KEY_LO) / span))
        # Despill: kurangi semburat magenta pada piksel tepi (r & b tinggi, g rendah)
        if buf[d + 3] > 0 and mag > 0:
            if mag > 90:
                buf[d] = max(g, r - (mag - 90) // 2)
                buf[d + 2] = max(g, b - (mag - 90) // 2)


def content_box(w: int, h: int, buf: bytearray, thresh: int = 24):
    """
    Bounding box isi — TAHAN BINTIK: baris/kolom baru dihitung isi kalau
    punya cukup piksel buram (bukan cuma 1-2 piksel sisa latar/ fringe di
    tepi kanvas). Tanpa ini, beberapa piksel nyasar di pojok membuat kotak
    isi membesar dan karakter jadi kecil & bergeser.
    """
    min_row = max(3, int(w * 0.004))
    min_col = max(3, int(h * 0.004))
    top = bottom = left = right = None
    for y in range(h):
        cnt = 0
        base = y * w * 4
        for x in range(w):
            if buf[base + x * 4 + 3] > thresh:
                cnt += 1
                if cnt >= min_row:
                    break
        if cnt >= min_row:
            if top is None:
                top = y
            bottom = y
    for x in range(w):
        cnt = 0
        for y in range(h):
            if buf[(y * w + x) * 4 + 3] > thresh:
                cnt += 1
                if cnt >= min_col:
                    break
        if cnt >= min_col:
            if left is None:
                left = x
            right = x
    if top is None or left is None:
        return 0, 0, w, h
    return left, top, right + 1, bottom + 1


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


def resize_rgba(buf: bytearray, w: int, h: int, nw: int, nh: int) -> bytearray:
    """Ubah ukuran RGBA (bilinear, alpha premultiplied) — tepi tetap halus."""
    out = bytearray(nw * nh * 4)
    fx, fy = w / nw, h / nh
    for y in range(nh):
        sy0 = min(h - 1, int(y * fy))
        sy1 = min(h - 1, sy0 + 1)
        wy = min(1.0, max(0.0, y * fy - sy0))
        for x in range(nw):
            sx0 = min(w - 1, int(x * fx))
            sx1 = min(w - 1, sx0 + 1)
            wx = min(1.0, max(0.0, x * fx - sx0))
            ar = ag = ab = aa = 0.0
            for yy, wgt_y in ((sy0, 1 - wy), (sy1, wy)):
                base = yy * w * 4
                for xx, wgt_x in ((sx0, 1 - wx), (sx1, wx)):
                    i = base + xx * 4
                    a = buf[i + 3] / 255.0
                    wgt = wgt_x * wgt_y
                    ar += buf[i] * a * wgt
                    ag += buf[i + 1] * a * wgt
                    ab += buf[i + 2] * a * wgt
                    aa += buf[i + 3] * wgt
            d = (y * nw + x) * 4
            if aa <= 0.0001:
                continue
            k = 255.0 / aa
            out[d] = min(255, int(ar * k))
            out[d + 1] = min(255, int(ag * k))
            out[d + 2] = min(255, int(ab * k))
            out[d + 3] = min(255, int(aa))
    return out


def ref_metrics(hero_id: str):
    """
    Ukur frame sprite DASAR hero (idle & attack) — tinggi isi, posisi dasar,
    dan pusat horizontal — dalam pecahan kanvas (0..1).
    Foto mutasi dipasang mengikuti angka ini supaya saat sprite berganti
    (idle↔attack, hadap kiri/kanan, bob naik-turun) tidak ada lompatan
    ukuran/posisi: gerakannya tetap natural.
    """
    ratios = []
    for suffix in ("idle", "attack", ""):
        path = os.path.join(OUT_DIR, f"hero_{hero_id}_{suffix}.png") if suffix else os.path.join(OUT_DIR, f"hero_{hero_id}.png")
        if not os.path.exists(path):
            continue
        try:
            w, h, buf = decode_png(path)
        except Exception:
            continue
        x0, y0, x1, y1 = content_box(w, h, buf, 24)
        if x1 <= x0 or y1 <= y0:
            continue
        ratios.append(((y1 - y0) / h, y1 / h, ((x0 + x1) / 2) / w))
    if not ratios:
        return None
    n = len(ratios)
    return (
        sum(r[0] for r in ratios) / n,  # tinggi isi
        sum(r[1] for r in ratios) / n,  # dasar isi (kaki)
        sum(r[2] for r in ratios) / n,  # pusat horizontal
    )


def compose(buf: bytearray, w: int, h: int, box, size: int, target_h: int, cx: float, bottom: float) -> bytearray:
    """Tempel isi ke kanvas size×size pada tinggi/posisi yang diminta."""
    x0, y0, x1, y1 = box
    cw, ch = x1 - x0, y1 - y0
    nw, nh, cropped = crop(buf, w, box)
    scale_f = target_h / max(1, ch)
    tw = max(1, int(round(cw * scale_f)))
    th = max(1, int(round(ch * scale_f)))
    # Catatan: sengaja TIDAK mengecilkan demi lebar. Bila pose lebih lebar dari
    # kanvas (mis. mahkota dendrit), bagian ujung yang di-clip — yang penting
    # UKURAN BADAN tetap sama dengan sprite dasar, jadi gerakan tidak melompat.
    small = resize_rgba(cropped, nw, nh, tw, th)
    canvas = bytearray(size * size * 4)
    left = int(round(cx * size - tw / 2))
    top = int(round(bottom * size - th))
    for y in range(th):
        dy = top + y
        if dy < 0 or dy >= size:
            continue
        src = y * tw * 4
        dst = (dy * size) * 4
        row = small[src:src + tw * 4]
        for i in range(0, tw * 4, 4):
            dx = left + i // 4
            if dx < 0 or dx >= size:
                continue
            a = row[i + 3]
            if a == 0:
                continue
            d = dst + dx * 4
            if a == 255 or canvas[d + 3] == 0:
                canvas[d] = row[i]
                canvas[d + 1] = row[i + 1]
                canvas[d + 2] = row[i + 2]
                canvas[d + 3] = a
            else:  # alpha-over (jarang: hanya bila tumpang tindih)
                sa, da = a / 255.0, canvas[d + 3] / 255.0
                oa = sa + da * (1 - sa)
                canvas[d] = int((row[i] * sa + canvas[d] * da * (1 - sa)) / oa)
                canvas[d + 1] = int((row[i + 1] * sa + canvas[d + 1] * da * (1 - sa)) / oa)
                canvas[d + 2] = int((row[i + 2] * sa + canvas[d + 2] * da * (1 - sa)) / oa)
                canvas[d + 3] = int(oa * 255)
    return canvas


def measure(canvas: bytearray, size: int, thresh: int = 24):
    """Ukur tinggi/dasar/pusat isi pada kanvas hasil (pakai ambang alpha lebih
    tinggi agar cahaya/glow tipis tidak menggeser pembacaan)."""
    x0, y0, x1, y1 = content_box(size, size, canvas, thresh)
    if x1 <= x0 or y1 <= y0:
        return 0.0, 1.0, 0.5
    return ((y1 - y0) / size, y1 / size, ((x0 + x1) / 2) / size)


def build_one(name: str) -> str:
    src = os.path.join(SRC_DIR, name)
    w, h, buf = decode_png(src)
    chroma_key(w, h, buf)
    box = content_box(w, h, buf, 96)
    hero_id = name.split("_")[1] if name.startswith("hero_") and len(name.split("_")) > 1 else ""
    metrics = ref_metrics(hero_id) if hero_id else None
    if not metrics:
        metrics = (0.88, 0.96, 0.5)  # tanpa acuan: frame lega standar
    want_h, want_bottom, want_cx = metrics

    # Iterasi koreksi: ukur hasil, lalu perbaiki skala & posisi sampai frame
    # foto mutasi menempel pada frame sprite dasar (gerakan tetap natural saat
    # idle↔attack bertukar, karakter dibalik kiri/kanan, atau bob naik-turun).
    target_h = int(want_h * OUT_SIZE)
    cx, bottom = want_cx, want_bottom
    canvas = None
    for _ in range(8):
        canvas = compose(buf, w, h, box, OUT_SIZE, target_h, cx, bottom)
        got_h, got_bottom, got_cx = measure(canvas, OUT_SIZE)
        if got_h <= 0:
            break
        d_h = want_h / got_h          # koreksi skala
        d_cx = want_cx - got_cx       # koreksi geser horizontal
        d_bottom = want_bottom - got_bottom
        if abs(d_h - 1) < 0.01 and abs(d_cx) < 0.003 and abs(d_bottom) < 0.003:
            break
        target_h = max(8, min(int(OUT_SIZE * 0.99), int(target_h * d_h)))
        # gain 1.6: kalau isi ter-clip di tepi kanvas, geser terasa setengahnya
        cx = max(0.20, min(0.80, cx + max(-0.05, min(0.05, d_cx * 1.6))))
        bottom = max(0.35, min(1.00, bottom + max(-0.05, min(0.05, d_bottom * 1.6))))

    dst = os.path.join(OUT_DIR, name)
    encode_png(dst, OUT_SIZE, OUT_SIZE, canvas)
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
