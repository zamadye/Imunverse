#!/usr/bin/env python3
"""
gen_phagos_mutations.py — PHAGOS eksperimen: overlay visual 18 mutasi hero.

Menghasilkan assets/sprites/mut_{id}.png (128x128, transparan) yang digambar
BERTUMPUK di atas sprite hero via drawSprite (game.js). Memakai ulang Canvas
stdlib dari gen_sprites.py (gaya kawaii repo: warna lembut + aksen putih).

Tubuh hero = r34 di tengah (64,64); aksesori hidup di sabuk r36-60.
Jalankan: python3 tools/gen_phagos_mutations.py
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_sprites import Canvas, hex_rgb, shade  # noqa: E402

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")
SIZE = 128
CX = CY = 64.0


def ring_soft(c, r, color, width=3.0, alpha=1.0):
    c.ring(CX, CY, r, color, width, alpha)


def sparkle(c, x, y, r, color, alpha=1.0):
    pts = [
        (x, y - r), (x + r * 0.22, y - r * 0.22), (x + r, y),
        (x + r * 0.22, y + r * 0.22), (x, y + r), (x - r * 0.22, y + r * 0.22),
        (x - r, y), (x - r * 0.22, y - r * 0.22),
    ]
    c.polygon(pts, color, alpha)


def drop(c, x, y, r, color, alpha=1.0):
    c.circle(x, y, r, color, alpha)
    c.polygon([(x - r * 0.8, y - r * 0.3), (x, y - r * 1.9), (x + r * 0.8, y - r * 0.3)], color, alpha)
    c.circle(x - r * 0.3, y - r * 0.3, r * 0.28, (255, 255, 255), alpha * 0.9)


def draw_mut(mid: str) -> Canvas:
    c = Canvas(SIZE)
    if mid == "berduri":  # spikes: 12 duri krem
        c.star_spikes(CX, CY, 38, hex_rgb("#e8dcc0"), count=12, length=17, alpha=1.0)
        c.star_spikes(CX, CY, 38, hex_rgb("#fff6e0"), count=12, length=10, alpha=1.0)
    elif mid == "lengket":  # sticky: tetes madu di busur bawah
        for i in range(5):
            a = math.pi * (0.15 + 0.175 * i)
            x, y = CX + math.cos(a) * 44, CY + math.sin(a) * 44
            drop(c, x, y + 6, 4.5, hex_rgb("#f2b134"))
        c.circle(CX - 30, CY + 34, 3, hex_rgb("#ffd93d"), 0.9)
        c.circle(CX + 28, CY + 36, 2.5, hex_rgb("#ffd93d"), 0.9)
    elif mid == "beracun":  # trail: tetes toksik neon + gelembung
        for i, (dx, dy, r) in enumerate([(-38, 26, 5), (-20, 42, 4), (2, 46, 5), (24, 40, 3.5), (40, 24, 4)]):
            drop(c, CX + dx, CY + dy, r, hex_rgb("#a8e10c"))
        c.circle(CX - 44, CY + 8, 2.5, hex_rgb("#d4f76a"), 0.9)
        c.circle(CX + 46, CY + 6, 2, hex_rgb("#d4f76a"), 0.9)
    elif mid == "elastis":  # wobble: cincin gelombang
        pts = []
        for i in range(97):
            a = math.tau * i / 96
            rr = 46 + 5 * math.sin(a * 5)
            pts.append((CX + math.cos(a) * rr, CY + math.sin(a) * rr))
        c.polyline(pts, hex_rgb("#35d0ba"), 3.5, 1.0)
    elif mid == "penyerap":  # dark_aura: halo ungu gelap berlapis
        c.ring(CX, CY, 56, hex_rgb("#2b3a55"), 6, 0.35)
        c.ring(CX, CY, 49, hex_rgb("#2b3a55"), 5, 0.55)
        c.ring(CX, CY, 43, hex_rgb("#5b6b8c"), 3, 0.8)
    elif mid == "tipis":  # thin_wide: cincin tipis lebar
        c.ring(CX, CY, 59, hex_rgb("#bfeef2"), 2, 0.85)
    elif mid == "ledakan_dalam":  # implosion: 8 chevron ke dalam
        for i in range(8):
            a = math.tau * i / 8
            r0, r1 = 56, 42
            w = 0.16
            c.polygon([
                (CX + math.cos(a - w) * r0, CY + math.sin(a - w) * r0),
                (CX + math.cos(a) * r1, CY + math.sin(a) * r1),
                (CX + math.cos(a + w) * r0, CY + math.sin(a + w) * r0),
            ], hex_rgb("#8e44ad"), 1.0)
    elif mid == "membran_ganda":  # double_ring: dua cincin emas+putih
        c.ring(CX, CY, 40, hex_rgb("#ffd93d"), 3.5, 1.0)
        c.ring(CX, CY, 54, hex_rgb("#ffffff"), 2.5, 0.9)
    elif mid == "parasit":  # swell_burst: ledakan oranye
        c.star_spikes(CX, CY, 40, hex_rgb("#ff6b6b"), count=10, length=12, alpha=1.0)
        c.star_spikes(CX, CY, 40, hex_rgb("#ff9f43"), count=10, length=6, alpha=1.0, rot=0.31)
        for i in range(5):
            a = math.tau * i / 5 + 0.2
            c.circle(CX + math.cos(a) * 56, CY + math.sin(a) * 56, 2.5, hex_rgb("#ffd93d"), 0.9)
    elif mid == "medan_pulsa":  # rhythmic: garis EKG (jangan putar)
        pts = [(28, 92), (44, 92), (50, 78), (58, 100), (66, 84), (70, 92), (100, 92)]
        c.polyline(pts, hex_rgb("#ff6b81"), 4, 1.0)
        c.circle(100, 92, 3.5, hex_rgb("#ff6b81"), 1.0)
        c.circle(28, 92, 3.5, hex_rgb("#ffb3c0"), 1.0)
    elif mid == "regenerasi":  # green_pulse: plus hijau + kilau
        c.polygon([(58, 84), (58, 100), (70, 100), (70, 84)], hex_rgb("#5eff8a"), 1.0)
        c.polygon([(56, 88), (72, 88), (72, 96), (56, 96)], hex_rgb("#5eff8a"), 1.0)
        sparkle(c, 40, 40, 6, hex_rgb("#d6ffe0"), 0.95)
        sparkle(c, 90, 44, 4, hex_rgb("#d6ffe0"), 0.9)
        sparkle(c, 84, 92, 3, hex_rgb("#d6ffe0"), 0.9)
    elif mid == "cermin":  # mirror_shine: kilau kaca (jangan putar)
        sparkle(c, 92, 34, 11, hex_rgb("#ffffff"), 0.95)
        sparkle(c, 40, 88, 6, hex_rgb("#ffffff"), 0.85)
        c.line(30, 52, 52, 30, hex_rgb("#ffffff"), 3, 0.7)
    elif mid == "nova":  # double_shockwave: bintang ganda
        c.star_spikes(CX, CY, 42, hex_rgb("#c39bd3"), count=8, length=14, alpha=1.0)
        c.star_spikes(CX, CY, 40, hex_rgb("#ffffff"), count=8, length=7, alpha=0.95, rot=0.39)
        c.ring(CX, CY, 40, hex_rgb("#7b2fa0"), 2.5, 0.9)
    elif mid == "simbiosis":  # orbiters: 3 bola orbit + lintasan samar
        c.ring(CX, CY, 50, hex_rgb("#ffffff"), 1.5, 0.35)
        for i, col in enumerate(["#4ae3c2", "#ffd93d", "#ff8ab3"]):
            a = math.tau * i / 3
            x, y = CX + math.cos(a) * 50, CY + math.sin(a) * 50
            c.circle(x, y, 6, hex_rgb(col), 1.0)
            c.circle(x - 1.5, y - 1.5, 2, (255, 255, 255), 0.9)
    elif mid == "evolusi_total":  # giant_form: chevron mahkota (jangan putar)
        for k in range(3):
            y = 30 - k * 9
            c.polyline([(44, y), (64, y - 8), (84, y)], hex_rgb("#ffd93d"), 5, 1.0)
        c.circle(64, 8, 3, hex_rgb("#fff3c4"), 1.0)
    elif mid == "rantai":  # chain_ripples: 8 mata rantai melingkar
        for i in range(8):
            a = math.tau * i / 8
            x, y = CX + math.cos(a) * 48, CY + math.sin(a) * 48
            c.ring(x, y, 6.5, hex_rgb("#ffd93d") if i % 2 == 0 else hex_rgb("#8a8f98"), 3, 1.0)
    elif mid == "adaptif":  # shifting_hue: 5 tetes pelangi
        for i, col in enumerate(["#ff6b6b", "#ff9f43", "#ffd93d", "#5eff8a", "#5eb9ff"]):
            a = math.tau * i / 5 - math.pi / 2
            drop(c, CX + math.cos(a) * 48, CY + math.sin(a) * 48 + 4, 5, hex_rgb(col))
    elif mid == "medan_hidup":  # breathing_organism: organisme mini + gelembung
        c.circle(88, 88, 13, hex_rgb("#7ae582"), 1.0)
        c.circle(88, 88, 6, hex_rgb("#2e7d4f"), 1.0)
        c.circle(84, 84, 2.5, (255, 255, 255), 0.9)
        c.circle(104, 66, 3, hex_rgb("#b8f0c8"), 0.9)
        c.circle(66, 104, 2.5, hex_rgb("#b8f0c8"), 0.9)
        ring_soft(c, 40, hex_rgb("#7ae582"), 2, 0.5)
    else:
        raise ValueError(f"mutasi tak dikenal: {mid}")
    return c


MUTATIONS = [
    "berduri", "lengket", "beracun", "elastis", "penyerap", "tipis",
    "ledakan_dalam", "membran_ganda", "parasit", "medan_pulsa", "regenerasi", "cermin",
    "nova", "simbiosis", "evolusi_total", "rantai", "adaptif", "medan_hidup",
]

# Overlay yang TIDAK boleh berputar (orientasi bermakna: EKG, mahkota, kilau)
NO_SPIN = {"medan_pulsa", "evolusi_total", "cermin"}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for mid in MUTATIONS:
        draw_mut(mid).save(os.path.join(OUT_DIR, f"mut_{mid}.png"))
    print(f"Generated {len(MUTATIONS)} mutation overlays in {OUT_DIR}")


if __name__ == "__main__":
    main()
