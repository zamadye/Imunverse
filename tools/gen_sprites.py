#!/usr/bin/env python3
"""
gen_sprites.py — Character Agent sprite generator (stdlib only).

Generates visible gameplay sprites for the character-owned scope:
- all immune heroes: idle, attack, portrait
- all pathogen/enemy characters: idle/attack where data uses them
- equity collection part icons

No Pillow dependency and no old generic evolution overlays. Stage 0 remains the
plain/base body. Stage 1-4 equity is rendered live by js/render/character-visuals.js
from data/character-designs.json.
"""

from __future__ import annotations

import math
import os
import random
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")
SS = 3


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.strip().lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def mix(a, b, t):
    return tuple(max(0, min(255, int(round(a[i] + (b[i] - a[i]) * t)))) for i in range(3))


def shade(c, k):
    if k >= 1:
        return mix(c, (255, 255, 255), min(1, k - 1))
    return mix(c, (0, 0, 0), min(1, 1 - k))


def png_bytes(w: int, h: int, rgba: bytearray) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw.extend(rgba[y * stride:(y + 1) * stride])
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


class Canvas:
    def __init__(self, size: int):
        self.size = size
        self.w = size * SS
        self.h = size * SS
        self.buf = bytearray(self.w * self.h * 4)

    def S(self, v):
        return v * SS

    def blend_px(self, ix: int, iy: int, color, alpha: float = 1.0):
        if ix < 0 or iy < 0 or ix >= self.w or iy >= self.h or alpha <= 0:
            return
        sr, sg, sb = color
        sa = max(0, min(255, int(round(255 * alpha))))
        if sa <= 0:
            return
        off = (iy * self.w + ix) * 4
        dr, dg, db, da = self.buf[off], self.buf[off + 1], self.buf[off + 2], self.buf[off + 3]
        inv = 255 - sa
        out_a = sa + (da * inv + 127) // 255
        if out_a == 0:
            return
        self.buf[off] = max(0, min(255, (sr * sa + dr * da * inv // 255) // out_a))
        self.buf[off + 1] = max(0, min(255, (sg * sa + dg * da * inv // 255) // out_a))
        self.buf[off + 2] = max(0, min(255, (sb * sa + db * da * inv // 255) // out_a))
        self.buf[off + 3] = max(0, min(255, out_a))

    def ellipse(self, cx, cy, rx, ry, color, alpha=1.0, rot=0.0):
        cx, cy, rx, ry = self.S(cx), self.S(cy), self.S(rx), self.S(ry)
        pad = max(rx, ry) + 2 * SS
        x0, x1 = int(cx - pad), int(cx + pad)
        y0, y1 = int(cy - pad), int(cy + pad)
        cr, sr = math.cos(-rot), math.sin(-rot)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                ux = dx * cr - dy * sr
                uy = dx * sr + dy * cr
                q = (ux * ux) / (rx * rx) + (uy * uy) / (ry * ry)
                if q <= 1:
                    edge = min(1.0, max(0.0, (1 - q) * 7))
                    self.blend_px(x, y, color, alpha * edge)

    def circle(self, cx, cy, r, color, alpha=1.0):
        self.ellipse(cx, cy, r, r, color, alpha)

    def radial_ellipse(self, cx, cy, rx, ry, inner, outer, rot=0.0, steps=30, alpha=1.0):
        for i in range(steps, 0, -1):
            t = i / steps
            col = mix(inner, outer, t)
            self.ellipse(cx, cy, rx * t, ry * t, col, alpha, rot)

    def line(self, x1, y1, x2, y2, color, width=3, alpha=1.0):
        x1, y1, x2, y2, hw = self.S(x1), self.S(y1), self.S(x2), self.S(y2), self.S(width) / 2
        xmin, xmax = int(min(x1, x2) - hw - 2), int(max(x1, x2) + hw + 2)
        ymin, ymax = int(min(y1, y2) - hw - 2), int(max(y1, y2) + hw + 2)
        vx, vy = x2 - x1, y2 - y1
        den = vx * vx + vy * vy or 1
        for y in range(ymin, ymax + 1):
            for x in range(xmin, xmax + 1):
                t = max(0, min(1, ((x + 0.5 - x1) * vx + (y + 0.5 - y1) * vy) / den))
                px, py = x1 + vx * t, y1 + vy * t
                d = math.hypot(x + 0.5 - px, y + 0.5 - py)
                if d <= hw + 1:
                    a = alpha * max(0, min(1, hw + 1 - d))
                    self.blend_px(x, y, color, a)
        # round caps
        self.circle(x1 / SS, y1 / SS, width / 2, color, alpha)
        self.circle(x2 / SS, y2 / SS, width / 2, color, alpha)

    def polyline(self, pts, color, width=3, alpha=1.0):
        for a, b in zip(pts, pts[1:]):
            self.line(a[0], a[1], b[0], b[1], color, width, alpha)

    def polygon(self, pts, color, alpha=1.0):
        pts2 = [(self.S(x), self.S(y)) for x, y in pts]
        xs = [p[0] for p in pts2]
        ys = [p[1] for p in pts2]
        x0, x1 = int(min(xs) - 2), int(max(xs) + 2)
        y0, y1 = int(min(ys) - 2), int(max(ys) + 2)
        n = len(pts2)
        for y in range(y0, y1 + 1):
            yy = y + 0.5
            for x in range(x0, x1 + 1):
                xx = x + 0.5
                inside = False
                j = n - 1
                for i in range(n):
                    xi, yi = pts2[i]
                    xj, yj = pts2[j]
                    if ((yi > yy) != (yj > yy)) and (xx < (xj - xi) * (yy - yi) / ((yj - yi) or 1e-9) + xi):
                        inside = not inside
                    j = i
                if inside:
                    self.blend_px(x, y, color, alpha)

    def ring(self, cx, cy, r, color, width=3, alpha=1.0, segments=90):
        pts = []
        for i in range(segments + 1):
            a = math.tau * i / segments
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        self.polyline(pts, color, width, alpha)

    def star_spikes(self, cx, cy, r, color, count=10, length=14, alpha=1.0, rot=0.0):
        for i in range(count):
            a = rot + math.tau * i / count
            pts = [
                (cx + math.cos(a - 0.13) * r, cy + math.sin(a - 0.13) * r),
                (cx + math.cos(a) * (r + length), cy + math.sin(a) * (r + length)),
                (cx + math.cos(a + 0.13) * r, cy + math.sin(a + 0.13) * r),
            ]
            self.polygon(pts, color, alpha)

    def blob(self, cx, cy, r, color, seed=1, lobes=5, wobble=0.1, sx=1.0, sy=1.0, alpha=1.0):
        rnd = random.Random(seed)
        p1, p2 = rnd.random() * math.tau, rnd.random() * math.tau
        pts = []
        for i in range(56):
            a = math.tau * i / 56
            rr = r * (1 + wobble * math.sin(a * lobes + p1) + wobble * 0.45 * math.sin(a * (lobes + 3) + p2))
            pts.append((cx + math.cos(a) * rr * sx, cy + math.sin(a) * rr * sy))
        self.polygon(pts, color, alpha)
        self.polyline(pts + [pts[0]], shade(color, 0.55), max(2.0, r * 0.07), min(1.0, alpha))

    def antibody_y(self, cx, cy, s, color, rot=0, width=4, alpha=1.0):
        def tr(p):
            x, y = p
            c, sn = math.cos(rot), math.sin(rot)
            return cx + x * c - y * sn, cy + x * sn + y * c
        self.line(*tr((0, s * 0.42)), *tr((0, -s * 0.05)), color, width, alpha)
        self.line(*tr((0, -s * 0.05)), *tr((-s * 0.35, -s * 0.48)), color, width, alpha)
        self.line(*tr((0, -s * 0.05)), *tr((s * 0.35, -s * 0.48)), color, width, alpha)

    def save(self, path):
        small = bytearray(self.size * self.size * 4)
        for y in range(self.size):
            for x in range(self.size):
                acc = [0, 0, 0, 0]
                for yy in range(SS):
                    for xx in range(SS):
                        off = ((y * SS + yy) * self.w + (x * SS + xx)) * 4
                        for k in range(4):
                            acc[k] += self.buf[off + k]
                out = (y * self.size + x) * 4
                div = SS * SS
                for k in range(4):
                    small[out + k] = acc[k] // div
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(png_bytes(self.size, self.size, small))


def body(c: Canvas, cx, cy, r, color, seed=1, sx=1, sy=1, wobble=0.06):
    rgb = hex_rgb(color)
    c.ellipse(cx + 4, cy + 8, r * 0.95 * sx, r * 0.42 * sy, (0, 0, 0), 0.16)
    c.blob(cx, cy, r, shade(rgb, 0.82), seed=seed, sx=sx, sy=sy, wobble=wobble, alpha=1)
    c.radial_ellipse(cx - r * 0.18, cy - r * 0.2, r * 0.8 * sx, r * 0.68 * sy, shade(rgb, 1.45), rgb, steps=24)
    c.ring(cx, cy, r * 0.86, shade(rgb, 1.25), width=2.2, alpha=0.55)


def nucleus(c: Canvas, cx, cy, r, color, kind="single"):
    rgb = hex_rgb(color) if isinstance(color, str) else color
    dark = shade(rgb, 0.45)
    hi = shade(rgb, 1.65)
    if kind == "segmented":
        for dx, dy in [(-8, 0), (0, -5), (8, 2)]:
            c.ellipse(cx + dx, cy + dy, r * 0.55, r * 0.4, dark, 0.86, rot=dx * 0.04)
            c.circle(cx + dx - 2, cy + dy - 2, r * 0.13, hi, 0.8)
    elif kind == "crescent":
        c.ellipse(cx, cy, r * 0.76, r * 0.42, dark, 0.84, rot=-0.6)
        c.ellipse(cx + 5, cy - 3, r * 0.6, r * 0.32, shade(rgb, 1.1), 0.48, rot=-0.6)
    else:
        c.ellipse(cx, cy, r * 0.48, r * 0.36, dark, 0.86, rot=0.4)
        c.circle(cx - r * 0.12, cy - r * 0.13, r * 0.11, hi, 0.9)


def eyes(c: Canvas, cx, cy, aggressive=False):
    if aggressive:
        c.line(cx - 15, cy - 6, cx - 6, cy - 3, (18, 63, 58), 3)
        c.line(cx + 15, cy - 6, cx + 6, cy - 3, (18, 63, 58), 3)
    else:
        c.circle(cx - 10, cy - 6, 2.2, (18, 63, 58), 0.95)
        c.circle(cx + 10, cy - 6, 2.2, (18, 63, 58), 0.95)


def draw_hero(hero_id: str, color: str, archetype: str, size=128, attack=False, portrait=False) -> Canvas:
    c = Canvas(size)
    cx = cy = size / 2
    scale = size / 128
    rgb = hex_rgb(color)
    r = 34 * scale if not portrait else 40 * scale

    if archetype == "phagocyte":
        body(c, cx, cy + 4 * scale, r, color, seed=10, sx=1.08, sy=0.92, wobble=0.16)
        for a in [-2.8, -0.25, 0.45, 2.7]:
            c.line(cx + math.cos(a) * r * 0.55, cy + math.sin(a) * r * 0.35,
                   cx + math.cos(a) * r * 1.16, cy + math.sin(a) * r * 0.92, shade(rgb, 1.15), 5 * scale, 0.9)
        nucleus(c, cx - 3 * scale, cy + 4 * scale, 16 * scale, rgb)
        c.ellipse(cx + 10 * scale, cy + 13 * scale, 14 * scale, 7 * scale, shade(rgb, 0.38), 0.8, rot=0.1)
        if attack:
            c.line(cx + 18 * scale, cy + 5 * scale, cx + 54 * scale, cy - 8 * scale, shade(rgb, 1.35), 8 * scale, 0.9)
    elif archetype == "dendritic":
        body(c, cx, cy + 4 * scale, r * 0.86, color, seed=12, sx=0.95, sy=0.9, wobble=0.1)
        for i, a in enumerate([-2.7, -2.15, -1.35, -0.55, 0.05, 0.85, 1.7, 2.4]):
            end = (cx + math.cos(a) * r * 1.45, cy + math.sin(a) * r * 1.25)
            c.line(cx + math.cos(a) * r * 0.45, cy + math.sin(a) * r * 0.4, end[0], end[1], shade(rgb, 1.2), 4.2 * scale, 0.92)
            if i % 2 == 0:
                c.circle(end[0], end[1], 3.5 * scale, (255, 215, 106), 0.9)
        nucleus(c, cx, cy + 1 * scale, 15 * scale, rgb, "crescent")
        if attack:
            c.ring(cx, cy, r * 1.3, (128, 199, 255), 3.4 * scale, 0.78)
    elif archetype == "net":
        # Stage 0 polos: segmented nucleus only; NET filaments are Equity II.
        body(c, cx, cy + 3 * scale, r * 0.94, color, seed=13, sx=0.9, sy=0.95, wobble=0.07)
        nucleus(c, cx, cy + 1 * scale, 18 * scale, rgb, "segmented")
        if attack:
            c.ring(cx, cy + 2 * scale, r * 0.92, (169, 232, 255), 2.6 * scale, 0.42)
    elif archetype == "granule_lance":
        body(c, cx, cy + 4 * scale, r * 0.95, color, seed=14, sx=0.94, sy=0.9, wobble=0.06)
        nucleus(c, cx - 2 * scale, cy + 1 * scale, 15 * scale, rgb, "crescent")
        for i in range(6):
            a = math.tau * i / 6
            c.circle(cx + math.cos(a) * r * 0.52, cy + 4 * scale + math.sin(a) * r * 0.38, 3.2 * scale, (255, 159, 67), 0.72)
        if attack:
            c.ring(cx + 3 * scale, cy, r * 0.82, (255, 159, 67), 2.8 * scale, 0.38)
    elif archetype == "vesicle_cloud":
        body(c, cx, cy + 4 * scale, r * 0.92, color, seed=15, sx=0.96, sy=0.96, wobble=0.05)
        nucleus(c, cx + 2 * scale, cy + 1 * scale, 13 * scale, rgb)
        for i in range(13):
            a = math.tau * i / 13
            c.circle(cx + math.cos(a) * r * 0.7, cy + 4 * scale + math.sin(a) * r * 0.56, 3.8 * scale, shade(rgb, 1.45), 0.82)
        if attack:
            for i in range(6):
                c.circle(cx + (25 + i * 6) * scale, cy + (-20 + i % 3 * 8) * scale, 4 * scale, (247, 220, 111), 0.82)
    elif archetype == "granule_tank":
        # Stage 0 polos: bulky mast cell body; large granule sacs are equity.
        body(c, cx, cy + 5 * scale, r * 1.02, color, seed=16, sx=1.03, sy=0.95, wobble=0.05)
        for i in range(6):
            a = math.tau * i / 6
            c.circle(cx + math.cos(a) * r * 0.48, cy + 4 * scale + math.sin(a) * r * 0.38, 3.4 * scale, (255, 179, 71), 0.6)
        nucleus(c, cx, cy + 3 * scale, 14 * scale, rgb)
        if attack:
            c.ring(cx, cy + 4 * scale, r * 0.88, (255, 179, 71), 3 * scale, 0.35)
    elif archetype == "cytotoxic":
        # Stage 0 polos: compact killer T cell; TCR/perforin/granzyme appear via equity overlay.
        body(c, cx, cy + 4 * scale, r * 0.92, color, seed=17, sx=0.88, sy=1.02, wobble=0.04)
        nucleus(c, cx, cy + 4 * scale, 14 * scale, rgb)
        if attack:
            c.ring(cx, cy + 4 * scale, r * 0.9, (127, 219, 255), 2.8 * scale, 0.42)
    elif archetype == "helper":
        # Stage 0 polos: no command halo/staff yet.
        body(c, cx, cy + 4 * scale, r * 0.92, color, seed=18, sx=0.92, sy=0.98, wobble=0.04)
        nucleus(c, cx, cy + 3 * scale, 14 * scale, rgb)
        if attack:
            c.ring(cx, cy + 2 * scale, r * 0.95, (255, 224, 130), 2.8 * scale, 0.38)
    elif archetype == "regulator":
        # Stage 0 polos: calm green body; CTLA/TGF shields are equity.
        body(c, cx, cy + 4 * scale, r * 0.92, color, seed=19, sx=0.93, sy=0.98, wobble=0.04)
        nucleus(c, cx, cy + 4 * scale, 14 * scale, rgb)
        if attack:
            c.ring(cx, cy + 4 * scale, r * 0.88, (118, 215, 196), 2.8 * scale, 0.36)
    elif archetype == "antibody":
        # Stage 0 polos: plain B cell body; BCR/antibody-Y wings are equity.
        body(c, cx, cy + 5 * scale, r * 0.9, color, seed=20, sx=0.94, sy=0.98, wobble=0.04)
        for i in range(5):
            a = math.tau * i / 5 + 0.2
            c.circle(cx + math.cos(a) * r * 0.55, cy + 5 * scale + math.sin(a) * r * 0.42, 2.8 * scale, shade(rgb, 1.35), 0.55)
        nucleus(c, cx, cy + 5 * scale, 14 * scale, rgb)
        if attack:
            c.ring(cx, cy + 5 * scale, r * 0.9, (215, 189, 226), 2.8 * scale, 0.38)
    elif archetype == "nk_spike":
        # Stage 0 polos: dark NK body; missing-self scanner and perforin ring are equity.
        body(c, cx, cy + 4 * scale, r * 0.9, color, seed=21, sx=0.9, sy=1.0, wobble=0.05)
        for i in range(7):
            a = math.tau * i / 7
            c.circle(cx + math.cos(a) * r * 0.48, cy + 4 * scale + math.sin(a) * r * 0.42, 2.8 * scale, (179, 157, 219), 0.5)
        nucleus(c, cx, cy + 4 * scale, 13 * scale, rgb)
        if attack:
            c.ring(cx, cy + 4 * scale, r * 0.94, (255, 93, 115), 2.8 * scale, 0.4)
    else:
        body(c, cx, cy, r, color)
        nucleus(c, cx, cy, 14 * scale, rgb)

    eyes(c, cx, cy - 6 * scale, aggressive=attack)
    if portrait:
        c.ring(cx, cy, size * 0.43, shade(rgb, 1.25), 4 * scale, 0.8)
    return c


HEROES = [
    ("macrophage", "#4a7c59", "phagocyte"),
    ("dendritic", "#ff8c00", "dendritic"),
    ("neutrophil", "#1a5276", "net"),
    ("eosinophil", "#ff6b81", "granule_lance"),
    ("basophil", "#8e44ad", "vesicle_cloud"),
    ("mastcell", "#a03328", "granule_tank"),
    ("tcd8", "#00d2ff", "cytotoxic"),
    ("tcd4", "#f1c40f", "helper"),
    ("treg", "#2ecc71", "regulator"),
    ("bcell", "#bb8fce", "antibody"),
    ("nkcell", "#4a235a", "nk_spike"),
]


def draw_enemy(kind: str, color: str, size=128, attack=False) -> Canvas:
    c = Canvas(size)
    cx = cy = size / 2
    scale = size / 128
    rgb = hex_rgb(color)
    r = 34 * scale if size <= 128 else 72 * scale

    if kind == "bacterium":
        c.ellipse(cx + 4 * scale, cy + 9 * scale, r * 1.05, r * 0.35, (0, 0, 0), 0.16)
        c.ellipse(cx, cy, r * 1.1, r * 0.48, shade(rgb, 0.82), 1, rot=0.25)
        c.radial_ellipse(cx - 8 * scale, cy - 5 * scale, r * 0.95, r * 0.38, shade(rgb, 1.45), rgb, rot=0.25, steps=18)
        for x in [-22, 0, 22]:
            c.line(cx + x * scale, cy - 19 * scale, cx + (x + 6) * scale, cy + 17 * scale, shade(rgb, 0.55), 2.3 * scale, 0.55)
        for a in [-2.7, 2.7]:
            c.line(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.45, cx + math.cos(a) * r * 1.45, cy + math.sin(a) * r * 0.9, shade(rgb, 1.2), 3 * scale, 0.8)
        if attack:
            c.star_spikes(cx + 28 * scale, cy - 8 * scale, 10 * scale, shade(rgb, 1.2), 5, 8 * scale, 0.8)
    elif kind == "armored_bacterium":
        c.ellipse(cx, cy, r * 1.12, r * 0.55, shade(rgb, 0.7), 1, rot=-0.2)
        c.ring(cx, cy, r * 0.72, (245, 198, 79), 5 * scale, 0.85)
        for x in [-28, -10, 10, 28]:
            c.line(cx + x * scale, cy - 24 * scale, cx + (x + 7) * scale, cy + 25 * scale, (255, 224, 130), 3 * scale, 0.78)
        if attack:
            c.star_spikes(cx, cy, r * 0.84, (255, 217, 61), 8, 8 * scale, 0.55)
    elif kind == "toxic_bacterium":
        c.ellipse(cx, cy, r * 1.05, r * 0.5, shade(rgb, 0.82), 1, rot=0.1)
        c.ring(cx, cy, r * 0.92, (110, 240, 110), 4 * scale, 0.72)
        c.ring(cx, cy, r * 0.6, shade(rgb, 1.35), 2.3 * scale, 0.8)
        for i in range(6):
            a = i * math.tau / 6
            c.circle(cx + math.cos(a) * r * 0.62, cy + math.sin(a) * r * 0.35, 4 * scale, (110, 240, 110), 0.8)
        if attack:
            for i in range(5):
                c.circle(cx + (24 + i * 7) * scale, cy + (-18 + i % 2 * 16) * scale, 4 * scale, (110, 240, 110), 0.82)
    elif kind == "virus":
        c.star_spikes(cx, cy, r * 0.82, shade(rgb, 0.8), 14, 11 * scale, 0.92, rot=0.2)
        c.radial_ellipse(cx - 5 * scale, cy - 7 * scale, r * 0.74, r * 0.74, shade(rgb, 1.45), rgb, steps=22)
        for i in range(6):
            a = i * math.tau / 6 + 0.2
            c.line(cx, cy, cx + math.cos(a) * r * 0.62, cy + math.sin(a) * r * 0.62, shade(rgb, 0.55), 2 * scale, 0.48)
        if attack:
            c.ring(cx, cy, r * 1.02, (255, 93, 115), 4 * scale, 0.6)
    elif kind == "virion":
        c.star_spikes(cx, cy, r * 0.58, shade(rgb, 0.82), 10, 8 * scale, 0.9)
        c.radial_ellipse(cx - 3 * scale, cy - 4 * scale, r * 0.52, r * 0.52, shade(rgb, 1.45), rgb, steps=18)
    elif kind == "parasite":
        pts = []
        for i in range(22):
            x = cx - 42 * scale + i * 4 * scale
            y = cy + math.sin(i * 0.75) * 13 * scale
            pts.append((x, y))
        c.polyline(pts, shade(rgb, 0.75), 17 * scale, 1)
        c.polyline(pts, shade(rgb, 1.25), 9 * scale, 0.95)
        for x, y in pts[::3]:
            c.line(x, y, x, y - 15 * scale, shade(rgb, 1.35), 2.1 * scale, 0.8)
        c.circle(cx + 43 * scale, cy - 3 * scale, 7 * scale, (255, 224, 130), 0.95)
        if attack:
            c.line(cx + 42 * scale, cy - 3 * scale, cx + 60 * scale, cy - 17 * scale, (255, 107, 129), 4 * scale, 0.95)
    elif kind == "fungus":
        c.star_spikes(cx, cy, r * 0.75, shade(rgb, 0.75), 9, 7 * scale, 0.5)
        c.radial_ellipse(cx, cy, r * 0.82, r * 0.72, shade(rgb, 1.35), rgb, steps=24)
        c.ring(cx, cy, r * 0.55, shade(rgb, 0.6), 3 * scale, 0.65)
        for i in range(10):
            a = i * math.tau / 10
            c.circle(cx + math.cos(a) * r * 0.45, cy + math.sin(a) * r * 0.38, 3.2 * scale, shade(rgb, 0.55), 0.7)
    elif kind == "cancer":
        c.blob(cx, cy, r * 0.9, shade(rgb, 0.75), seed=77, lobes=9, wobble=0.2, sx=1.05, sy=0.92)
        c.radial_ellipse(cx - 12 * scale, cy - 12 * scale, r * 0.7, r * 0.58, shade(rgb, 1.35), rgb, steps=25)
        for i in range(9):
            a = i * math.tau / 9
            c.line(cx + math.cos(a) * r * 0.45, cy + math.sin(a) * r * 0.38,
                   cx + math.cos(a + 0.2) * r * 1.15, cy + math.sin(a + 0.2) * r * 1.0,
                   shade(rgb, 0.62), 5 * scale, 0.82)
        c.circle(cx + 3 * scale, cy + 2 * scale, r * 0.25, shade(rgb, 0.35), 0.92)
        if attack:
            c.star_spikes(cx, cy, r * 0.95, (255, 93, 115), 12, 18 * scale, 0.55, rot=0.1)
    elif kind == "protozoa":
        c.ellipse(cx, cy, r * 0.8, r * 1.0, shade(rgb, 0.78), 1, rot=-0.35)
        c.radial_ellipse(cx - 6 * scale, cy - 8 * scale, r * 0.65, r * 0.8, shade(rgb, 1.45), rgb, rot=-0.35, steps=20)
        for i in range(18):
            a = i * math.tau / 18
            c.line(cx + math.cos(a) * r * 0.72, cy + math.sin(a) * r * 0.9,
                   cx + math.cos(a) * r * 1.0, cy + math.sin(a) * r * 1.15,
                   shade(rgb, 1.25), 2 * scale, 0.8)
        c.ellipse(cx + 4 * scale, cy + 6 * scale, 10 * scale, 16 * scale, shade(rgb, 0.42), 0.8, rot=-0.35)
    elif kind == "toxin":
        c.ellipse(cx, cy + 18 * scale, r * 0.9, r * 0.26, (0, 0, 0), 0.18)
        pts = [(cx, cy - r * 0.85), (cx + r * 0.65, cy - r * 0.06), (cx + r * 0.38, cy + r * 0.72), (cx, cy + r * 0.9), (cx - r * 0.38, cy + r * 0.72), (cx - r * 0.65, cy - r * 0.06)]
        c.polygon(pts, shade(rgb, 0.8), 1)
        c.radial_ellipse(cx - 8 * scale, cy - 3 * scale, r * 0.45, r * 0.72, shade(rgb, 1.55), rgb, steps=18)
        c.circle(cx - 9 * scale, cy - 18 * scale, 5 * scale, (255, 255, 255), 0.45)
        if attack:
            c.circle(cx + 30 * scale, cy + 11 * scale, 7 * scale, rgb, 0.55)
            c.circle(cx - 34 * scale, cy + 19 * scale, 6 * scale, rgb, 0.45)
    elif kind == "crystal":
        pts = [(cx, cy - r), (cx + r * 0.66, cy - r * 0.22), (cx + r * 0.34, cy + r * 0.9), (cx - r * 0.45, cy + r * 0.78), (cx - r * 0.7, cy - r * 0.15)]
        c.polygon(pts, shade(rgb, 0.82), 1)
        c.polygon([(cx, cy - r), (cx + r * 0.66, cy - r * 0.22), (cx + 2 * scale, cy + 2 * scale)], shade(rgb, 1.45), 0.8)
        c.polygon([(cx, cy - r), (cx - r * 0.7, cy - r * 0.15), (cx + 2 * scale, cy + 2 * scale)], shade(rgb, 1.15), 0.75)
        c.line(cx - r * 0.55, cy - r * 0.1, cx + r * 0.55, cy + r * 0.05, (255, 255, 255), 2 * scale, 0.4)
        if attack:
            c.ring(cx, cy, r * 0.9, (255, 255, 255), 3 * scale, 0.45)
    elif kind == "abnormal_cell":
        c.blob(cx, cy, r * 0.86, shade(rgb, 0.8), seed=91, lobes=7, wobble=0.18, alpha=0.82)
        c.ring(cx, cy, r * 0.88, (179, 157, 219), 3 * scale, 0.52)
        c.circle(cx + 5 * scale, cy + 4 * scale, r * 0.26, shade(rgb, 0.35), 0.55)
        c.line(cx - 20 * scale, cy - 18 * scale, cx + 24 * scale, cy + 18 * scale, (255, 243, 176), 2.4 * scale, 0.35)
    elif kind == "toxin_boss":
        c.blob(cx, cy, r * 0.72, shade(rgb, 0.7), seed=111, lobes=8, wobble=0.15, sx=1.0, sy=1.05)
        c.star_spikes(cx, cy, r * 0.58, shade(rgb, 0.55), 14, 14 * scale, 0.86, rot=0.15)
        c.radial_ellipse(cx - 18 * scale, cy - 22 * scale, r * 0.48, r * 0.6, shade(rgb, 1.55), rgb, steps=24)
        for i in range(8):
            a = i * math.tau / 8
            c.circle(cx + math.cos(a) * r * 0.42, cy + math.sin(a) * r * 0.45, 7 * scale, (255, 243, 176), 0.55)
        if attack:
            c.star_spikes(cx, cy, r * 0.72, (255, 93, 115), 16, 22 * scale, 0.62)
    else:
        body(c, cx, cy, r, color)

    # hostile eyes/core; bosses keep large core from their branch.
    if kind not in {"toxin", "crystal"}:
        eyes(c, cx, cy - 7 * scale, aggressive=True)
    return c


ENEMIES = [
    ("enemy_bakteri.png", "bacterium", "#ff6b6b", 128, False),
    ("enemy_bakteri_gp.png", "armored_bacterium", "#8d5fb3", 128, False),
    ("enemy_bakteri_gn.png", "toxic_bacterium", "#b39ddb", 128, False),
    ("enemy_virus.png", "virus", "#9be15d", 128, False),
    ("enemy_virion.png", "virion", "#c7f464", 96, False),
    ("enemy_parasit.png", "parasite", "#e15fd0", 128, False),
    ("enemy_spora.png", "fungus", "#f2c14e", 128, False),
    ("enemy_sel_kanker.png", "cancer", "#d7263d", 256, False),
    ("enemy_sel_kanker_attack.png", "cancer", "#d7263d", 256, True),
    ("enemy_protozoa.png", "protozoa", "#3ecfb2", 128, False),
    ("enemy_toksin.png", "toxin", "#6ef06e", 128, False),
    ("enemy_prion.png", "crystal", "#9b8fae", 128, False),
    ("enemy_sel_abnormal.png", "abnormal_cell", "#2fb89f", 128, False),
    ("enemy_toksin_raksasa.png", "toxin_boss", "#7ed957", 256, False),
    ("enemy_toksin_raksasa_attack.png", "toxin_boss", "#7ed957", 256, True),
]


def part_icon(kind: str, color: str) -> Canvas:
    c = Canvas(112)
    cx = cy = 56
    rgb = hex_rgb(color)
    c.ellipse(cx + 3, cy + 8, 34, 14, (0, 0, 0), 0.18)
    c.radial_ellipse(cx - 5, cy - 7, 33, 33, shade(rgb, 1.45), rgb, steps=25)
    c.ring(cx, cy, 34, shade(rgb, 0.55), 3.2, 0.9)
    if kind == "receptor":
        for rot in [-0.7, 0, 0.7]:
            c.antibody_y(cx, cy + 4, 42, (255, 243, 176), rot, 4.2, 0.92)
    elif kind == "membrane":
        for rr in [20, 29, 38]:
            c.ring(cx, cy, rr, (128, 199, 255), 2.5, 0.72)
        c.line(cx - 24, cy, cx + 24, cy, (255, 255, 255), 3, 0.55)
    elif kind == "effector":
        c.line(cx - 18, cy + 20, cx + 22, cy - 24, (255, 255, 255), 7, 0.9)
        c.star_spikes(cx + 21, cy - 24, 8, (255, 209, 90), 6, 8, 0.9)
    else:
        c.polygon([(cx, cy - 35), (cx + 31, cy - 6), (cx + 19, cy + 32), (cx - 19, cy + 32), (cx - 31, cy - 6)], (255, 243, 176), 0.82)
        c.circle(cx, cy, 13, shade(rgb, 0.45), 0.84)
        c.ring(cx, cy, 43, (255, 224, 130), 3, 0.65)
    return c


PARTS = [
    ("part_equity_receptor.png", "receptor", "#63c76a"),
    ("part_equity_membrane.png", "membrane", "#4aa3e0"),
    ("part_equity_effector.png", "effector", "#b07ae0"),
    ("part_equity_memory_core.png", "memory", "#f5c64f"),
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for hero_id, color, archetype in HEROES:
        draw_hero(hero_id, color, archetype, 128, attack=False).save(os.path.join(OUT_DIR, f"hero_{hero_id}_idle.png"))
        draw_hero(hero_id, color, archetype, 128, attack=True).save(os.path.join(OUT_DIR, f"hero_{hero_id}_attack.png"))
        draw_hero(hero_id, color, archetype, 128, attack=False, portrait=True).save(os.path.join(OUT_DIR, f"portrait_{hero_id}.png"))
    for filename, kind, color, size, attack in ENEMIES:
        draw_enemy(kind, color, size, attack).save(os.path.join(OUT_DIR, filename))
    for filename, kind, color in PARTS:
        part_icon(kind, color).save(os.path.join(OUT_DIR, filename))
    print(f"Generated {len(HEROES) * 3 + len(ENEMIES) + len(PARTS)} character sprites in {OUT_DIR}")


if __name__ == "__main__":
    main()
