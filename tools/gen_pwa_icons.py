#!/usr/bin/env python3
"""
tools/gen_pwa_icons.py — generator ikon PWA (Fase 2.6)

Menghasilkan ikon aplikasi dari PALET DESIGN SYSTEM repo (styles/main.css :root),
tanpa dependensi apa pun — PNG ditulis manual (zlib + struct) karena Pillow tidak
selalu tersedia di lingkungan kerja. Motifnya satu sel imun: membran teal, sitoplasma
teal-light, inti coral, dan tiga titik gold (antigen) di sekelilingnya.

    python3 tools/gen_pwa_icons.py

Keluaran (semuanya di assets/icons/pwa/):
    icon-192.png            ikon manifest 192×192
    icon-512.png            ikon manifest 512×512
    icon-maskable-512.png   varian maskable (motif diperkecil ke safe zone 80%)
    apple-touch-icon.png    180×180 untuk iOS (iOS mengabaikan ikon manifest)

Catatan: ini ikon PLACEHOLDER yang konsisten dengan warna game. Ganti dengan art
final pemilik bila sudah ada — jalankan ulang skrip ini hanya untuk placeholder.
Bila art final dipakai, ukuran dan nama berkas harus tetap sama karena
manifest.webmanifest dan index.html menunjuk ke jalur ini.
"""

import os
import struct
import zlib
import math

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets", "icons", "pwa")

# Palet dari styles/main.css :root — jangan mengarang warna baru di sini.
CREAM = (0xFD, 0xF6, 0xE3)      # --cream
CREAM_2 = (0xF7, 0xED, 0xD9)    # --cream-2
TEAL = (0x2F, 0x9C, 0x8F)       # --teal
TEAL_DEEP = (0x1F, 0x7A, 0x70)  # --teal-deep
TEAL_LIGHT = (0xBF, 0xE3, 0xD8) # --teal-light
CORAL = (0xF2, 0x82, 0x5C)      # --coral
CORAL_DEEP = (0xE9, 0x6A, 0x4C) # --coral-deep
GOLD = (0xF5, 0xC6, 0x4F)       # --gold
INK = (0x12, 0x3F, 0x3A)        # --ink


def mix(dst, src, a):
    """Campur warna dengan alpha (0..1)."""
    if a <= 0:
        return dst
    if a >= 1:
        return src
    return (
        int(dst[0] * (1 - a) + src[0] * a),
        int(dst[1] * (1 - a) + src[1] * a),
        int(dst[2] * (1 - a) + src[2] * a),
    )


def cover(dist, radius, feather):
    """Cakupan anti-alias sebuah lingkaran: 1 di dalam, 0 di luar."""
    t = (radius - dist) / feather + 0.5
    return 0.0 if t <= 0 else (1.0 if t >= 1 else t)


def ring(dist, r_outer, width, feather):
    """Cakupan cincin (membran)."""
    r_inner = r_outer - width
    return min(cover(dist, r_outer, feather), 1 - cover(dist, r_inner, feather))


def render(size, maskable=False):
    """Render ikon size×size → list bytearray RGB per baris."""
    # Varian maskable memperkecil motif ke safe zone (Android memotong ikon).
    k = 0.78 if maskable else 1.0
    c = 0.5
    feather = 1.15 / size  # ~1 px dalam satuan ternormalisasi

    # geometri (ternormalisasi 0..1)
    r_cell = 0.360 * k
    w_membrane = 0.040 * k
    r_nuk = 0.135 * k
    c_nuk = (0.455, 0.530)
    r_nukleolus = 0.048 * k
    c_nukleolus = (0.425, 0.495)
    r_dot = 0.036 * k
    dots = []
    for ang in (35, 155, 275):
        a = math.radians(ang)
        dots.append((c + math.cos(a) * 0.455 * k, c + math.sin(a) * 0.455 * k))

    rows = []
    for y in range(size):
        row = bytearray()
        fy = (y + 0.5) / size
        for x in range(size):
            fx = (x + 0.5) / size
            px = CREAM
            # latar: gradasi cream → cream-2 sangat halus di pojok bawah
            g = max(0.0, (fx + fy) / 2 - 0.35) * 0.55
            px = mix(px, CREAM_2, g)

            d_cell = math.hypot(fx - c, fy - c)
            # sitoplasma
            px = mix(px, TEAL_LIGHT, cover(d_cell, r_cell - w_membrane, feather))
            # membran
            px = mix(px, TEAL_DEEP, ring(d_cell, r_cell, w_membrane, feather))

            # inti sel + nukleolus
            d_nuk = math.hypot(fx - c_nuk[0], fy - c_nuk[1])
            px = mix(px, CORAL, cover(d_nuk, r_nuk, feather))
            d_nu = math.hypot(fx - c_nukleolus[0], fy - c_nukleolus[1])
            px = mix(px, CORAL_DEEP, cover(d_nu, r_nukleolus, feather))

            # tiga antigen gold
            for (dx, dy) in dots:
                d = math.hypot(fx - dx, fy - dy)
                a = cover(d, r_dot, feather)
                if a > 0:
                    px = mix(px, GOLD, a)
                    px = mix(px, INK, ring(d, r_dot, 0.012 * k, feather) * 0.35)

            row += bytes(px)
        rows.append(row)
    return rows


def write_png(path, size, rows):
    """Tulis PNG 8-bit RGB (color type 2) tanpa dependensi eksternal."""
    raw = b"".join(b"\x00" + bytes(r) for r in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    return len(png)


def main():
    os.makedirs(OUT, exist_ok=True)
    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ]
    print("=== GENERATOR IKON PWA (palet styles/main.css) ===")
    for name, size, maskable in targets:
        path = os.path.join(OUT, name)
        rows = render(size, maskable)
        n = write_png(path, size, rows)
        rel = os.path.relpath(path, ROOT)
        print(f"  ✓ {rel}  {size}×{size}  {'maskable' if maskable else 'any'}  {n/1024:.1f} KB")
    print("PWA_ICONS_OK")


if __name__ == "__main__":
    main()
