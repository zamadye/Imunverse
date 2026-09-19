#!/usr/bin/env python3
"""
Lembar kontak foto mutasi — susunan 11 hero × 5 kolom (dasar, mut1 idle,
mut1 serang, mut2 idle, mut2 serang) dalam satu PNG, untuk memeriksa
44 foto sekaligus tanpa membuka berkas satu per satu.

Pakai:  python3 tools/make-contact-sheet.py [keluaran.png]
"""
import importlib.util
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILDER = os.path.join(ROOT, "tools", "build-mutation-sprites.py")

spec = importlib.util.spec_from_file_location("bms", BUILDER)
bms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bms)  # pakai decode/resize/encode PNG bawaan (stdlib saja)

CELL = 116
PAD = 6
BG = (14, 26, 31)      # papan gelap
CELL_BG = (22, 39, 46) # kotak sel

KOLOM = [
    ("dasar", "hero_%s_idle.png"),
    ("mut1 idle", "hero_%s_mut1_idle.png"),
    ("mut1 serang", "hero_%s_mut1_attack.png"),
    ("mut2 idle", "hero_%s_mut2_idle.png"),
    ("mut2 serang", "hero_%s_mut2_attack.png"),
]


def main() -> None:
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "tools", "mutation-art", "CONTACT-SHEET.png")
    with open(os.path.join(ROOT, "data", "heroes.json"), encoding="utf-8") as f:
        heroes = [h["id"] for h in json.load(f)["heroes"]]

    W = len(KOLOM) * CELL + PAD * 2
    H = len(heroes) * CELL + PAD * 2
    canvas = bytearray(W * H * 4)
    for i in range(0, len(canvas), 4):
        canvas[i], canvas[i + 1], canvas[i + 2], canvas[i + 3] = BG[0], BG[1], BG[2], 255

    size = CELL - PAD * 2
    hilang = []
    for r, hid in enumerate(heroes):
        for c, (_label, tpl) in enumerate(KOLOM):
            p = os.path.join(ROOT, "assets", "sprites", tpl % hid)
            ox, oy = PAD + c * CELL + PAD, PAD + r * CELL + PAD
            if not os.path.exists(p):
                hilang.append(os.path.basename(p))
                continue
            w, h, buf = bms.decode_png(p)
            small = bms.resize_rgba(buf, w, h, size, size)
            for y in range(size):
                dst = (oy + y) * W * 4
                src = y * size * 4
                for x in range(size):
                    d = dst + (ox + x) * 4
                    s = src + x * 4
                    a = small[s + 3]
                    if a == 0:
                        canvas[d], canvas[d + 1], canvas[d + 2] = CELL_BG
                        continue
                    sa = a / 255.0
                    k = 1 - sa
                    canvas[d] = int(small[s] * sa + CELL_BG[0] * k)
                    canvas[d + 1] = int(small[s + 1] * sa + CELL_BG[1] * k)
                    canvas[d + 2] = int(small[s + 2] * sa + CELL_BG[2] * k)

    bms.encode_png(out, W, H, canvas)
    print(f"ok {out} {W}x{H} ({os.path.getsize(out) // 1024} KB)" + (f" — belum ada: {len(hilang)}" if hilang else ""))


if __name__ == "__main__":
    main()
