#!/usr/bin/env python3
"""
gen_assets.py — Pipeline aset Imunverse v2 (gaya KAWAII sesuai mockup user).
51 aset digenerate BERTAHAP (7 stage), semua dirancang untuk DIPAKAI game:
  Stage 1  Karakter hero (idle+attack)      8 aset  → data/heroes.json
  Stage 2  Musuh (idle + boss attack)       7 aset  → data/enemies.json
  Stage 3  Nutrisi                          5 aset  → data/nutrients.json
  Stage 4  Potret wajah hero (lingkaran)    4 aset  → HUD/roster (field spritePortrait)
  Stage 5  Ikon UI                          18 aset → index.html / screens
  Stage 6  FX & kontrol                     6 aset  → shape-renderer/effects/input
  Stage 7  Properti latar                   4 aset  → background.js
Total: 51 aset PNG transparan.
Jalankan: python3 tools/gen_assets.py
"""

import math
import os

from PIL import Image, ImageDraw, ImageFilter

SS = 4
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")

CREAM = (253, 246, 227)
INK = (18, 63, 58)
TEAL = (47, 156, 143)
TEAL_DEEP = (31, 122, 112)
TEAL_LIGHT = (191, 227, 216)
SAGE = (169, 215, 149)
GREEN = (124, 184, 106)
CORAL = (242, 130, 92)
CORAL_DEEP = (233, 106, 76)
CORAL_LIGHT = (248, 178, 154)
GOLD = (245, 198, 79)
GOLD_DEEP = (224, 167, 46)
HEART = (240, 104, 90)
PURPLE = (176, 127, 216)
BLUE = (90, 162, 255)
ORANGE = (255, 140, 66)
YELLOW = (242, 193, 78)
PINK = (225, 95, 208)


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(c1, c2, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c1, c2))


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def canvas(size):
    img = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def done(img, size):
    return img.resize((size, size), Image.LANCZOS)


def blob_pts(cx, cy, r, n=40, wobble=0.06, seed=1, lobes=5):
    import random
    rnd = random.Random(seed)
    p1, p2 = rnd.uniform(0, 6.28), rnd.uniform(0, 6.28)
    pts = []
    for i in range(n):
        a = math.tau * i / n
        rr = r * (1 + wobble * math.sin(a * lobes + p1) + wobble * 0.5 * math.sin(a * (lobes + 2) + p2))
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return pts


def soft_body(d, cx, cy, r, color, outline_k=0.45, squash=1.0):
    """Tubuh kawaii: gradien radial + rim gelap + outline."""
    hi = mix(color, (255, 255, 255), 0.45)
    lo = mix(color, (0, 0, 0), 0.18)
    steps = 22
    for i in range(steps, 0, -1):
        t = i / steps
        rr = r * t
        col = mix(hi, lo, 1 - t)
        d.ellipse([cx - rr, cy - rr * squash, cx + rr, cy + rr * squash], fill=rgba(col))
    d.ellipse([cx - r, cy - r * squash, cx + r, cy + r * squash],
              outline=rgba(mix(color, (0, 0, 0), outline_k)), width=max(2, int(r * 0.07)))


def kawaii_face(d, cx, cy, r, body, mood="happy", eye_k=0.72):
    """Wajah kawaii: mata + kilau + mulut + blush. mood: happy|angry|hurt|determined"""
    dark = mix(body, (0, 0, 0), eye_k)
    ey = cy - r * 0.05
    ex = r * 0.36
    ew, eh = r * 0.11, r * 0.19
    for sx in (-1, 1):
        d.ellipse([cx + sx * ex - ew, ey - eh, cx + sx * ex + ew, ey + eh], fill=rgba(dark))
        # kilau mata
        sr = ew * 0.55
        d.ellipse([cx + sx * ex - ew * 0.2 - sr, ey - eh * 0.45 - sr,
                   cx + sx * ex - ew * 0.2 + sr, ey - eh * 0.45 + sr], fill=(255, 255, 255, 235))
    # alis (angry/determined)
    if mood in ("angry", "determined"):
        bw, bh = r * 0.16, r * 0.05
        tilt = -0.5 if mood == "angry" else 0.35
        for sx in (-1, 1):
            bx = cx + sx * ex
            by = ey - eh * 2.0
            d.line([bx - sx * bw, by - bh * tilt, bx + sx * bw, by + bh * tilt * 0.4],
                   fill=rgba(dark), width=max(2, int(r * 0.05)))
    # mulut
    mw = r * 0.2
    my = cy + r * 0.28
    if mood == "happy":
        d.arc([cx - mw, my - mw, cx + mw, my + mw * 0.8], 15, 165, fill=rgba(dark), width=max(2, int(r * 0.055)))
    elif mood == "angry":
        d.arc([cx - mw, my - mw * 0.4, cx + mw, my + mw], 195, 345, fill=rgba(dark), width=max(2, int(r * 0.055)))
    elif mood == "determined":
        d.line([cx - mw, my, cx + mw, my], fill=rgba(dark), width=max(2, int(r * 0.055)))
    elif mood == "hurt":
        d.ellipse([cx - mw * 0.7, my - mw * 0.5, cx + mw * 0.7, my + mw * 0.5], fill=rgba(dark))
    # blush
    br = r * 0.09
    for sx in (-1, 1):
        bx = cx + sx * r * 0.62
        by = cy + r * 0.16
        d.ellipse([bx - br, by - br * 0.6, bx + br, by + br * 0.6], fill=(255, 255, 255, 70))


def stub_arms(d, cx, cy, r, color, spread=1.05, drop=0.15):
    """Lengan poke kecil di sisi tubuh."""
    ar = r * 0.22
    for sx in (-1, 1):
        ax = cx + sx * r * spread
        ay = cy + r * drop
        d.ellipse([ax - ar, ay - ar, ax + ar, ay + ar], fill=rgba(mix(color, (255, 255, 255), 0.12)))
        d.ellipse([ax - ar, ay - ar, ax + ar, ay + ar], outline=rgba(mix(color, (0, 0, 0), 0.4)),
                  width=max(2, int(r * 0.05)))


def motion_arcs(d, cx, cy, r, color):
    for k, rr in enumerate((1.12, 1.28)):
        a0, a1 = -60 + k * 25, 60 + k * 25
        d.arc([cx - r * rr, cy - r * rr, cx + r * rr, cy + r * rr], a0, a1,
              fill=rgba(mix(color, (255, 255, 255), 0.5), 200), width=max(2, int(r * 0.06)))


def glow(img, color, radius, alpha=80):
    g = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(g)
    w, h = img.size
    gd.ellipse([w / 2 - radius, h / 2 - radius, w / 2 + radius, h / 2 + radius], fill=rgba(color, alpha))
    g = g.filter(ImageFilter.GaussianBlur(radius * 0.3))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out = Image.alpha_composite(out, g)
    return Image.alpha_composite(out, img)


# =====================================================================
# STAGE 1 — HERO (8 aset)
# =====================================================================

def hero(name, color, size=128, mood="happy", attack=False, spikes=0, big=False):
    img, d = canvas(size)
    S = size * SS
    cx = S * 0.5
    cy = S * (0.52 if not big else 0.5)
    r = S * (0.30 if not big else 0.36)
    col = hex_rgb(color)
    if attack:
        img = glow(img, col, r * 1.15, 90)
        d = ImageDraw.Draw(img)
        r *= 1.03
    # duri kecil bulat (NK)
    if spikes:
        for i in range(spikes):
            a = math.tau * i / spikes + (0.2 if attack else 0)
            x1, y1 = cx + math.cos(a) * r * 0.95, cy + math.sin(a) * r * 0.95
            x2, y2 = cx + math.cos(a) * r * 1.16, cy + math.sin(a) * r * 1.16
            d.line([x1, y1, x2, y2], fill=rgba(mix(col, (0, 0, 0), 0.25)), width=int(S * 0.035))
            hr = S * 0.045
            d.ellipse([x2 - hr, y2 - hr, x2 + hr, y2 + hr], fill=rgba(mix(col, (255, 255, 255), 0.35)))
            d.ellipse([x2 - hr, y2 - hr, x2 + hr, y2 + hr], outline=rgba(mix(col, (0, 0, 0), 0.3)),
                      width=max(2, int(S * 0.008)))
    stub_arms(d, cx, cy, r, col)
    soft_body(d, cx, cy, r, col)
    kawaii_face(d, cx, cy, r, col, mood=("determined" if attack else mood))
    if attack:
        motion_arcs(d, cx, cy, r, col)
    return done(img, size)


def gen_stage_heroes(out):
    print("STAGE 1 — Hero kawaii (8 aset)")
    return {
        "hero_sel_t_idle.png": hero("sel_t", "#35d0ba", mood="happy"),
        "hero_sel_t_attack.png": hero("sel_t", "#35d0ba", attack=True),
        "hero_makrofag_idle.png": hero("makrofag", "#b07fd8", big=True),
        "hero_makrofag_attack.png": hero("makrofag", "#b07fd8", big=True, attack=True),
        "hero_sel_b_idle.png": hero("sel_b", "#5aa2ff"),
        "hero_sel_b_attack.png": hero("sel_b", "#5aa2ff", attack=True),
        "hero_sel_nk_idle.png": hero("sel_nk", "#ff8c42", spikes=9),
        "hero_sel_nk_attack.png": hero("sel_nk", "#ff8c42", spikes=9, attack=True),
    }


# =====================================================================
# STAGE 2 — MUSUH (7 aset)
# =====================================================================

def enemy_capsule(size, color, attack=False):
    """Bakteri: kapsul merah dengan flagela + wajah marah."""
    img, d = canvas(size)
    S = size * SS
    cx, cy = S * 0.5, S * 0.5
    col = hex_rgb(color)
    L, W = S * 0.30, S * 0.17
    ang = math.radians(-25)

    def rot(px, py):
        dx, dy = px - cx, py - cy
        return (cx + dx * math.cos(ang) - dy * math.sin(ang), cy + dx * math.sin(ang) + dy * math.cos(ang))

    # flagela
    for side in (-1, 1):
        for k in (-1, 0, 1):
            pts = []
            bx = cx + side * L * 0.95
            for t in range(7):
                tt = t / 6
                px = bx + side * tt * S * 0.11
                py = cy + k * W * 0.55 + math.sin(tt * 6 + k) * S * 0.03
                pts.append(rot(px, py))
            d.line(pts, fill=rgba(mix(col, (0, 0, 0), 0.2)), width=int(S * 0.02), joint="curve")
    # tubuh kapsul
    cL, cR = rot(cx - L, cy), rot(cx + L, cy)
    hi = mix(col, (255, 255, 255), 0.4)
    lo = mix(col, (0, 0, 0), 0.2)
    for i in range(18, 0, -1):
        t = i / 18
        d.ellipse([cx - L - W + (1 - t) * 0, cy - W * t, cx + L + W - (1 - t) * 0, cy + W * t], fill=rgba(mix(hi, lo, 1 - t)))
    d.rounded_rectangle([cx - L, cy - W, cx + L, cy + W], radius=int(W), fill=rgba(col))
    d.ellipse([cL[0] - W, cL[1] - W, cL[0] + W, cL[1] + W], fill=rgba(col))
    d.ellipse([cR[0] - W, cR[1] - W, cR[0] + W, cR[1] + W], fill=rgba(col))
    # wajah marah di pusat
    kawaii_face(d, cx, cy, W * 1.5, col, mood="angry")
    if attack:
        motion_arcs(d, cx, cy, L, col)
    return done(img, size)


def enemy_spikeball(size, color, small=False, attack=False):
    """Virus/virion: bola berduri membulat + wajah."""
    img, d = canvas(size)
    S = size * SS
    cx = cy = S * 0.5
    col = hex_rgb(color)
    r = S * (0.17 if small else 0.24)
    n = 7 if small else 10
    if attack:
        img = glow(img, col, r * 1.3, 100)
        d = ImageDraw.Draw(img)
    for i in range(n):
        a = math.tau * i / n
        x1, y1 = cx + math.cos(a) * r * 0.9, cy + math.sin(a) * r * 0.9
        x2, y2 = cx + math.cos(a) * r * 1.45, cy + math.sin(a) * r * 1.45
        d.line([x1, y1, x2, y2], fill=rgba(mix(col, (0, 0, 0), 0.2)), width=int(S * 0.028))
        hr = S * (0.022 if small else 0.038)
        d.ellipse([x2 - hr, y2 - hr, x2 + hr, y2 + hr], fill=rgba(mix(col, (255, 255, 255), 0.4)))
        d.ellipse([x2 - hr, y2 - hr, x2 + hr, y2 + hr], outline=rgba(mix(col, (0, 0, 0), 0.3)),
                  width=max(2, int(S * 0.007)))
    soft_body(d, cx, cy, r, col)
    kawaii_face(d, cx, cy, r, col, mood="angry")
    return done(img, size)


def enemy_worm(size, color):
    """Parasit: cacing melengkung bersegmen + wajah."""
    img, d = canvas(size)
    S = size * SS
    col = hex_rgb(color)
    pts = []
    for t in range(24):
        tt = t / 23
        pts.append((S * (0.2 + 0.6 * tt), S * 0.52 + math.sin(tt * 3.4) * S * 0.13))
    for i, (x, y) in enumerate(reversed(pts)):
        t = 1 - i / (len(pts) - 1)
        r = S * (0.055 + 0.028 * math.sin(t * 6) + (1 - t) * 0.045)
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(mix(col, (0, 0, 0), 0.06 if i % 2 else 0)))
    hx, hy = pts[-1]
    soft_body(d, hx, hy, S * 0.13, col)
    kawaii_face(d, hx, hy, S * 0.13, col, mood="angry")
    return done(img, size)


def enemy_puffball(size, color):
    """Spora: bola berbenjol mengantuk."""
    img, d = canvas(size)
    S = size * SS
    cx = cy = S * 0.5
    col = hex_rgb(color)
    r = S * 0.30
    pts = blob_pts(cx, cy, r * 1.04, 24, 0.10, 11, 7)
    d.polygon(pts, fill=rgba(mix(col, (0, 0, 0), 0.22)))
    soft_body(d, cx, cy, r, col)
    # wajah mengantuk: mata setengah
    dark = mix(col, (0, 0, 0), 0.7)
    ex = r * 0.36
    for sx in (-1, 1):
        d.ellipse([cx + sx * ex - r * 0.11, cy - r * 0.05 - r * 0.10, cx + sx * ex + r * 0.11, cy - r * 0.05 + r * 0.10],
                  fill=rgba(dark))
        d.ellipse([cx + sx * ex - r * 0.13, cy - r * 0.02, cx + sx * ex + r * 0.13, cy + r * 0.14], fill=rgba(col))
        d.ellipse([cx + sx * ex - r * 0.13, cy - r * 0.02, cx + sx * ex + r * 0.13, cy + r * 0.14],
                  outline=rgba(dark), width=max(2, int(r * 0.05)))
    d.arc([cx - r * 0.18, cy + r * 0.16, cx + r * 0.18, cy + r * 0.42], 20, 160, fill=rgba(dark), width=max(2, int(r * 0.05)))
    return done(img, size)


def boss(size, color, attack=False):
    """Sel kanker: bola runcing besar galak."""
    img, d = canvas(size)
    S = size * SS
    cx = cy = S * 0.5
    col = hex_rgb(color)
    r = S * 0.30
    if attack:
        img = glow(img, CORAL, r * 1.25, 120)
        d = ImageDraw.Draw(img)
    n = 14
    for i in range(n):
        a = math.tau * i / n + 0.15
        x1, y1 = cx + math.cos(a) * r * 0.92, cy + math.sin(a) * r * 0.92
        x2, y2 = cx + math.cos(a) * r * 1.5, cy + math.sin(a) * r * 1.5
        # runcing segitiga
        w = r * 0.16
        nx, ny = -math.sin(a), math.cos(a)
        d.polygon([(x1 + nx * w, y1 + ny * w), (x1 - nx * w, y1 - ny * w), (x2, y2)],
                  fill=rgba(mix(col, (0, 0, 0), 0.15)))
    soft_body(d, cx, cy, r, col, squash=0.95)
    kawaii_face(d, cx, cy, r, col, mood="angry", eye_k=0.8)
    if attack:
        # mulut menganga
        d.ellipse([cx - r * 0.3, cy + r * 0.12, cx + r * 0.3, cy + r * 0.52], fill=rgba(mix(col, (0, 0, 0), 0.6)))
        motion_arcs(d, cx, cy, r, col)
    return done(img, size)


def gen_stage_enemies(out):
    print("STAGE 2 — Musuh kawaii (7 aset)")
    return {
        "enemy_bakteri.png": enemy_capsule(128, "#ff6b6b"),
        "enemy_virus.png": enemy_spikeball(128, "#9be15d"),
        "enemy_virion.png": enemy_spikeball(96, "#c7f464", small=True),
        "enemy_parasit.png": enemy_worm(128, "#e15fd0"),
        "enemy_spora.png": enemy_puffball(128, "#f2c14e"),
        "enemy_sel_kanker.png": boss(256, "#f2825c"),
        "enemy_sel_kanker_attack.png": boss(256, "#f2825c", attack=True),
    }


# =====================================================================
# STAGE 3 — NUTRISI (5 aset)
# =====================================================================

def item_candy_hex(size, color):
    img, d = canvas(size)
    S = size * SS
    cx = cy = S * 0.5
    col = hex_rgb(color)
    r = S * 0.3
    pts = [(cx + math.cos(math.tau * i / 6 + math.pi / 6) * r, cy + math.sin(math.tau * i / 6 + math.pi / 6) * r)
           for i in range(6)]
    soft_body(d, cx, cy, r, col)
    d = ImageDraw.Draw(img)
    d.line(pts + [pts[0]], fill=rgba(mix(col, (255, 255, 255), 0.65)), width=int(S * 0.03), joint="curve")
    kawaii_face(d, cx, cy, r * 0.9, col, mood="happy")
    return done(img, size)


def item_chain(size, color):
    img, d = canvas(size)
    S = size * SS
    col = hex_rgb(color)
    balls = [(S * 0.40, S * 0.58, S * 0.14), (S * 0.60, S * 0.40, S * 0.115), (S * 0.63, S * 0.66, S * 0.095)]
    for i in range(len(balls) - 1):
        d.line([balls[i][0], balls[i][1], balls[i + 1][0], balls[i + 1][1]],
               fill=rgba(mix(col, (0, 0, 0), 0.3)), width=int(S * 0.035))
    for (bx, by, br) in balls:
        soft_body(d, bx, by, br, col)
    x, y, r = balls[0]
    kawaii_face(d, x, y, r * 1.15, col, mood="happy")
    return done(img, size)


def item_capsule(size, color):
    img, d = canvas(size)
    S = size * SS
    cx = cy = S * 0.5
    col = hex_rgb(color)
    L, W = S * 0.24, S * 0.15
    ang = math.radians(-35)

    def rot(px, py):
        dx, dy = px - cx, py - cy
        return (cx + dx * math.cos(ang) - dy * math.sin(ang), cy + dx * math.sin(ang) + dy * math.cos(ang))

    body = [rot(cx - L, cy - W), rot(cx + L, cy - W), rot(cx + L, cy + W), rot(cx - L, cy + W)]
    e2 = rot(cx + L, cy)
    d.polygon(body, fill=rgba(col))
    d.pieslice([e2[0] - W, e2[1] - W, e2[0] + W, e2[1] + W], -90, 90, fill=rgba((250, 250, 252)))
    d.polygon([rot(cx, cy - W), rot(cx + L, cy - W), rot(cx + L, cy + W), rot(cx, cy + W)], fill=rgba((250, 250, 252)))
    d.line([rot(cx, cy - W), rot(cx, cy + W)], fill=rgba(mix(col, (0, 0, 0), 0.3)), width=int(S * 0.016))
    d.rounded_rectangle([rot(cx - L, cy - W)[0], rot(cx - L, cy - W)[1], e2[0], e2[1]] if False else
                        [min(p[0] for p in body), min(p[1] for p in body), max(p[0] for p in body), max(p[1] for p in body)],
                        radius=0)
    # kilau
    d.ellipse([cx - W * 1.1, cy - W * 1.25, cx - W * 0.5, cy - W * 0.75], fill=(255, 255, 255, 190))
    return done(img, size)


def item_y(size, color):
    img, d = canvas(size)
    S = size * SS
    col = hex_rgb(color)
    cx, cy = S * 0.5, S * 0.58
    arm, stem, w = S * 0.24, S * 0.28, int(S * 0.055)
    top = (cx, cy - stem * 0.55)
    left = (cx - arm, top[1] - arm * 0.9)
    right = (cx + arm, top[1] - arm * 0.9)
    bottom = (cx, cy + stem * 0.8)
    d.line([bottom, top], fill=rgba(col), width=w)
    d.line([top, left], fill=rgba(col), width=w)
    d.line([top, right], fill=rgba(col), width=w)
    for p in (left, right):
        d.ellipse([p[0] - w * 0.8, p[1] - w * 0.8, p[0] + w * 0.8, p[1] + w * 0.8], fill=rgba(mix(col, (255, 255, 255), 0.55)))
    # wajah kecil di pangkal
    d.ellipse([cx - w * 0.5, cy - w * 0.9, cx - w * 0.1, cy - w * 0.4], fill=rgba(INK))
    d.ellipse([cx + w * 0.1, cy - w * 0.9, cx + w * 0.5, cy - w * 0.4], fill=rgba(INK))
    d.arc([cx - w * 0.45, cy - w * 0.35, cx + w * 0.45, cy + w * 0.25], 20, 160, fill=rgba(INK), width=max(2, int(S * 0.012)))
    return done(img, size)


def item_signal(size, color):
    img, d = canvas(size)
    S = size * SS
    cx = cy = S * 0.5
    col = hex_rgb(color)
    for k, rr in enumerate((S * 0.16, S * 0.26, S * 0.36)):
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=rgba(col, 235 - k * 65), width=int(S * (0.035 - k * 0.007)))
    soft_body(d, cx, cy, S * 0.11, col)
    kawaii_face(d, cx, cy, S * 0.11 * 1.5, col, mood="happy")
    return done(img, size)


def gen_stage_items(out):
    print("STAGE 3 — Nutrisi kawaii (5 aset)")
    return {
        "item_glukosa.png": item_candy_hex(96, "#f5c64f"),
        "item_amino.png": item_chain(96, "#7cb86a"),
        "item_vitamin_c.png": item_capsule(96, "#ff9f1c"),
        "item_antibodi.png": item_y(96, "#4cc9f0"),
        "item_sitokin.png": item_signal(96, "#f2825c"),
    }


# =====================================================================
# STAGE 4 — POTRET HERO (4 aset)
# =====================================================================

def portrait(size, color, spikes=0):
    img, d = canvas(size)
    S = size * SS
    cx, cy = S * 0.5, S * 0.52
    r = S * 0.4
    col = hex_rgb(color)
    if spikes:
        for i in range(spikes):
            a = math.tau * i / spikes
            x2, y2 = cx + math.cos(a) * r * 1.18, cy + math.sin(a) * r * 1.18
            hr = S * 0.05
            d.ellipse([x2 - hr, y2 - hr, x2 + hr, y2 + hr], fill=rgba(mix(col, (255, 255, 255), 0.3)))
    soft_body(d, cx, cy, r, col)
    kawaii_face(d, cx, cy, r, col, mood="happy")
    return done(img, size)


def gen_stage_portraits(out):
    print("STAGE 4 — Potret hero (4 aset)")
    return {
        "portrait_sel_t.png": portrait(128, "#35d0ba"),
        "portrait_makrofag.png": portrait(128, "#b07fd8"),
        "portrait_sel_b.png": portrait(128, "#5aa2ff"),
        "portrait_sel_nk.png": portrait(128, "#ff8c42", spikes=8),
    }


# =====================================================================
# STAGE 5 — IKON UI (18 aset)
# =====================================================================

def _icon_canvas(size):
    img, d = canvas(size)
    return img, d


def icon_coin(size):
    img, d = _icon_canvas(size)
    S = size * SS
    cx = cy = S * 0.5
    r = S * 0.44
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba(GOLD))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=rgba(GOLD_DEEP), width=int(S * 0.05))
    d.ellipse([cx - r * 0.78, cy - r * 0.78, cx + r * 0.78, cy + r * 0.78], outline=rgba((255, 255, 255, 130)), width=int(S * 0.03))
    # berlian teal di tengah
    dw, dh = r * 0.52, r * 0.6
    pts = [(cx, cy - dh), (cx + dw, cy - dh * 0.25), (cx, cy + dh), (cx - dw, cy - dh * 0.25)]
    d.polygon(pts, fill=rgba(TEAL))
    d.polygon(pts, outline=rgba(TEAL_DEEP), width=int(S * 0.02))
    d.line([pts[3][0], pts[3][1], pts[1][0], pts[1][1]], fill=rgba(mix(TEAL, (255, 255, 255), 0.4)), width=int(S * 0.025))
    return done(img, size)


def icon_heart(size, empty=False):
    img, d = _icon_canvas(size)
    S = size * SS
    cx, cy = S * 0.5, S * 0.55
    k = S * 0.026
    pts = []
    for i in range(140):
        t = math.tau * i / 140
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * k, cy - y * k))
    col = (222, 210, 184) if empty else HEART
    out = mix(col, (0, 0, 0), 0.2)
    d.polygon(pts, fill=rgba(col))
    d.polygon(pts, outline=rgba(out), width=int(S * 0.02))
    if not empty:
        d.ellipse([cx - k * 8.5, cy - k * 9, cx - k * 4, cy - k * 4.5], fill=(255, 255, 255, 170))
    return done(img, size)


def icon_star(size, empty=False):
    img, d = _icon_canvas(size)
    S = size * SS
    cx = cy = S * 0.52
    r = S * 0.44
    col = (222, 210, 184) if empty else GOLD
    out = mix(col, (0, 0, 0), 0.15)
    pts = []
    for i in range(10):
        a = -math.pi / 2 + math.pi * i / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    d.polygon(pts, fill=rgba(col))
    d.polygon(pts, outline=rgba(out), width=int(S * 0.025))
    return done(img, size)


def icon_lock(size):
    img, d = _icon_canvas(size)
    S = size * SS
    cx = S * 0.5
    bw, bh = S * 0.5, S * 0.36
    by = S * 0.5
    d.rounded_rectangle([cx - bw / 2, by - bh / 2, cx + bw / 2, by + bh / 2], radius=int(S * 0.06), fill=rgba(CREAM))
    d.arc([cx - S * 0.16, by - bh * 1.35, cx + S * 0.16, by - bh * 0.35], 180, 360,
          fill=rgba(CREAM), width=int(S * 0.075))
    d.ellipse([cx - S * 0.035, by - S * 0.05, cx + S * 0.035, by + S * 0.02], fill=rgba(TEAL_DEEP))
    d.rounded_rectangle([cx - S * 0.014, by - S * 0.01, cx + S * 0.014, by + bh * 0.32], radius=int(S * 0.01), fill=rgba(TEAL_DEEP))
    return done(img, size)


def _glyph_bg(img, d, size):
    return img, d


def icon_play(size):
    img, d = _icon_canvas(size)
    S = size * SS
    d.polygon([(S * 0.36, S * 0.22), (S * 0.82, S * 0.5), (S * 0.36, S * 0.78)], fill=rgba(TEAL_DEEP))
    return done(img, size)


def icon_heroes(size):
    img, d = _icon_canvas(size)
    S = size * SS
    d.ellipse([S * 0.36, S * 0.12, S * 0.64, S * 0.4], fill=rgba(TEAL_DEEP))
    d.pieslice([S * 0.18, S * 0.42, S * 0.82, S * 1.05], 180, 360, fill=rgba(TEAL_DEEP))
    return done(img, size)


def icon_squad(size):
    img, d = _icon_canvas(size)
    S = size * SS
    pts = [(S * 0.5, S * 0.08), (S * 0.86, S * 0.2), (S * 0.86, S * 0.52), (S * 0.5, S * 0.9), (S * 0.14, S * 0.52), (S * 0.14, S * 0.2)]
    d.polygon(pts, fill=rgba(TEAL_DEEP))
    d.rounded_rectangle([S * 0.44, S * 0.28, S * 0.56, S * 0.62], radius=int(S * 0.04), fill=rgba(CREAM))
    d.rounded_rectangle([S * 0.3, S * 0.39, S * 0.7, S * 0.51], radius=int(S * 0.04), fill=rgba(CREAM))
    return done(img, size)


def icon_shop(size):
    img, d = _icon_canvas(size)
    S = size * SS
    d.rounded_rectangle([S * 0.16, S * 0.3, S * 0.84, S * 0.88], radius=int(S * 0.12), fill=rgba(TEAL_DEEP))
    d.arc([S * 0.34, S * 0.1, S * 0.66, S * 0.44], 180, 360, fill=rgba(TEAL_DEEP), width=int(S * 0.07))
    d.ellipse([S * 0.44, S * 0.5, S * 0.56, S * 0.62], fill=rgba(CREAM))
    return done(img, size)


def icon_gear(size):
    img, d = _icon_canvas(size)
    S = size * SS
    cx = cy = S * 0.5
    r, r2 = S * 0.42, S * 0.3
    for i in range(8):
        a = math.tau * i / 8
        d.polygon([(cx + math.cos(a - 0.18) * r2, cy + math.sin(a - 0.18) * r2),
                   (cx + math.cos(a + 0.18) * r2, cy + math.sin(a + 0.18) * r2),
                   (cx + math.cos(a) * r * 1.08, cy + math.sin(a) * r * 1.08)], fill=rgba(TEAL_DEEP))
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=rgba(TEAL_DEEP))
    d.ellipse([cx - r2 * 0.45, cy - r2 * 0.45, cx + r2 * 0.45, cy + r2 * 0.45], fill=rgba(CREAM))
    return done(img, size)


def icon_pause(size):
    img, d = _icon_canvas(size)
    S = size * SS
    d.rounded_rectangle([S * 0.26, S * 0.2, S * 0.42, S * 0.8], radius=int(S * 0.06), fill=rgba(TEAL_DEEP))
    d.rounded_rectangle([S * 0.58, S * 0.2, S * 0.74, S * 0.8], radius=int(S * 0.06), fill=rgba(TEAL_DEEP))
    return done(img, size)


def icon_back(size):
    img, d = _icon_canvas(size)
    S = size * SS
    d.line([(S * 0.7, S * 0.24), (S * 0.3, S * 0.5), (S * 0.7, S * 0.76)], fill=rgba(TEAL_DEEP),
           width=int(S * 0.1), joint="curve")
    return done(img, size)


def icon_skull(size):
    img, d = _icon_canvas(size)
    S = size * SS
    cx = S * 0.5
    d.ellipse([cx - S * 0.3, S * 0.12, cx + S * 0.3, S * 0.66], fill=rgba(TEAL_DEEP))
    d.rounded_rectangle([cx - S * 0.17, S * 0.6, cx + S * 0.17, S * 0.84], radius=int(S * 0.05), fill=rgba(TEAL_DEEP))
    for ex in (cx - S * 0.13, cx + S * 0.13):
        d.ellipse([ex - S * 0.075, S * 0.3, ex + S * 0.075, S * 0.45], fill=rgba(CREAM))
    d.polygon([(cx, S * 0.52), (cx - S * 0.04, S * 0.62), (cx + S * 0.04, S * 0.62)], fill=rgba(CREAM))
    return done(img, size)


def icon_magnet(size):
    img, d = _icon_canvas(size)
    S = size * SS
    w = int(S * 0.2)
    d.arc([S * 0.22, S * 0.16, S * 0.78, S * 0.72], 180, 360, fill=rgba(CORAL), width=w)
    d.rounded_rectangle([S * 0.22, S * 0.44, S * 0.22 + w, S * 0.78], radius=int(S * 0.03), fill=rgba(CORAL))
    d.rounded_rectangle([S * 0.78 - w, S * 0.44, S * 0.78, S * 0.78], radius=int(S * 0.03), fill=rgba(CORAL))
    d.rounded_rectangle([S * 0.22, S * 0.68, S * 0.22 + w, S * 0.8], radius=int(S * 0.03), fill=rgba(CREAM))
    d.rounded_rectangle([S * 0.78 - w, S * 0.68, S * 0.78, S * 0.8], radius=int(S * 0.03), fill=rgba(CREAM))
    return done(img, size)


def icon_bolt(size):
    img, d = _icon_canvas(size)
    S = size * SS
    d.polygon([(S * 0.58, S * 0.08), (S * 0.28, S * 0.55), (S * 0.48, S * 0.55), (S * 0.4, S * 0.92),
               (S * 0.72, S * 0.42), (S * 0.52, S * 0.42)], fill=rgba(GOLD))
    return done(img, size)


def icon_timer(size):
    img, d = _icon_canvas(size)
    S = size * SS
    cx = cy = S * 0.52
    r = S * 0.36
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=rgba(TEAL_DEEP), width=int(S * 0.075))
    d.line([cx, cy, cx, cy - r * 0.6], fill=rgba(TEAL_DEEP), width=int(S * 0.06))
    d.line([cx, cy, cx + r * 0.45, cy + r * 0.2], fill=rgba(TEAL_DEEP), width=int(S * 0.05))
    d.line([cx, cy - r - S * 0.04, cx, cy - r + S * 0.02], fill=rgba(TEAL_DEEP), width=int(S * 0.06))
    return done(img, size)


def icon_trophy(size):
    img, d = _icon_canvas(size)
    S = size * SS
    cx = S * 0.5
    d.rounded_rectangle([cx - S * 0.2, S * 0.16, cx + S * 0.2, S * 0.5], radius=int(S * 0.06), fill=rgba(GOLD))
    d.arc([cx - S * 0.36, S * 0.18, cx - S * 0.1, S * 0.44], 90, 270, fill=rgba(GOLD_DEEP), width=int(S * 0.055))
    d.arc([cx + S * 0.1, S * 0.18, cx + S * 0.36, S * 0.44], 270, 90, fill=rgba(GOLD_DEEP), width=int(S * 0.055))
    d.rounded_rectangle([cx - S * 0.05, S * 0.5, cx + S * 0.05, S * 0.68], radius=int(S * 0.02), fill=rgba(GOLD_DEEP))
    d.rounded_rectangle([cx - S * 0.2, S * 0.68, cx + S * 0.2, S * 0.8], radius=int(S * 0.05), fill=rgba(GOLD))
    return done(img, size)


def icon_syringe(size):
    img, d = _icon_canvas(size)
    S = size * SS
    ang = math.radians(-40)

    def rot(px, py):
        dx, dy = px - S / 2, py - S / 2
        return (S / 2 + dx * math.cos(ang) - dy * math.sin(ang), S / 2 + dx * math.sin(ang) + dy * math.cos(ang))

    body = [rot(S * 0.28, S * 0.36), rot(S * 0.66, S * 0.36), rot(S * 0.66, S * 0.64), rot(S * 0.28, S * 0.64)]
    d.polygon(body, fill=rgba(TEAL))
    d.line([rot(S * 0.66, S * 0.5), rot(S * 0.86, S * 0.5)], fill=rgba(TEAL_DEEP), width=int(S * 0.045))
    d.line([rot(S * 0.2, S * 0.5), rot(S * 0.3, S * 0.5)], fill=rgba(TEAL_DEEP), width=int(S * 0.06))
    d.rounded_rectangle([rot(S * 0.22, S * 0.3)[0], rot(S * 0.22, S * 0.3)[1], rot(S * 0.3, S * 0.7)[0],
                         rot(S * 0.3, S * 0.7)[1]], radius=int(S * 0.02), fill=rgba(TEAL_DEEP))
    d.ellipse([rot(S * 0.36, S * 0.44)[0], rot(S * 0.36, S * 0.44)[1], rot(S * 0.46, S * 0.56)[0], rot(S * 0.46, S * 0.56)[1]],
              fill=rgba(CREAM))
    return done(img, size)


def icon_diamond(size):
    img, d = _icon_canvas(size)
    S = size * SS
    cx, cy = S * 0.5, S * 0.54
    w, h = S * 0.36, S * 0.4
    pts = [(cx, cy - h), (cx + w, cy - h * 0.2), (cx, cy + h * 0.9), (cx - w, cy - h * 0.2)]
    d.polygon(pts, fill=rgba(TEAL))
    d.polygon(pts, outline=rgba(TEAL_DEEP), width=int(S * 0.03))
    d.line([pts[3], pts[1]], fill=rgba(mix(TEAL, (255, 255, 255), 0.5)), width=int(S * 0.035))
    d.line([(cx - w * 0.5, cy - h * 0.62), (cx + w * 0.5, cy - h * 0.62)], fill=rgba(mix(TEAL, (255, 255, 255), 0.5)), width=int(S * 0.03))
    return done(img, size)


def gen_stage_icons(out):
    print("STAGE 5 — Ikon UI (18 aset)")
    return {
        "icon_coin.png": icon_coin(96),
        "icon_heart.png": icon_heart(96),
        "icon_heart_empty.png": icon_heart(96, empty=True),
        "icon_star.png": icon_star(96),
        "icon_star_empty.png": icon_star(96, empty=True),
        "icon_lock.png": icon_lock(96),
        "icon_play.png": icon_play(96),
        "icon_heroes.png": icon_heroes(96),
        "icon_squad.png": icon_squad(96),
        "icon_shop.png": icon_shop(96),
        "icon_gear.png": icon_gear(96),
        "icon_pause.png": icon_pause(96),
        "icon_back.png": icon_back(96),
        "icon_skull.png": icon_skull(96),
        "icon_magnet.png": icon_magnet(96),
        "icon_bolt.png": icon_bolt(96),
        "icon_timer.png": icon_timer(96),
        "icon_trophy.png": icon_trophy(96),
        "icon_syringe.png": icon_syringe(96),
        "icon_boot.png": icon_boot(96),
        "icon_scope.png": icon_scope(96),
        "icon_multi.png": icon_multi(96),
        "icon_home.png": icon_home(96),
    }




def icon_boot(size):
    img, d = _icon_canvas(size)
    S = size * SS
    d.polygon([(S * 0.3, S * 0.14), (S * 0.52, S * 0.14), (S * 0.5, S * 0.5), (S * 0.78, S * 0.66),
               (S * 0.78, S * 0.82), (S * 0.24, S * 0.82), (S * 0.24, S * 0.6), (S * 0.34, S * 0.44)],
              fill=rgba(TEAL_DEEP))
    d.ellipse([S * 0.6, S * 0.7, S * 0.7, S * 0.78], fill=rgba(CREAM))
    return done(img, size)


def icon_scope(size):
    img, d = _icon_canvas(size)
    S = size * SS
    cx = cy = S * 0.5
    r = S * 0.36
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=rgba(TEAL_DEEP), width=int(S * 0.07))
    d.line([cx - r * 1.3, cy, cx - r * 0.5, cy], fill=rgba(TEAL_DEEP), width=int(S * 0.06))
    d.line([cx + r * 0.5, cy, cx + r * 1.3, cy], fill=rgba(TEAL_DEEP), width=int(S * 0.06))
    d.line([cx, cy - r * 1.3, cx, cy - r * 0.5], fill=rgba(TEAL_DEEP), width=int(S * 0.06))
    d.line([cx, cy + r * 0.5, cx, cy + r * 1.3], fill=rgba(TEAL_DEEP), width=int(S * 0.06))
    d.ellipse([cx - S * 0.05, cy - S * 0.05, cx + S * 0.05, cy + S * 0.05], fill=rgba(CORAL))
    return done(img, size)


def icon_multi(size):
    img, d = _icon_canvas(size)
    S = size * SS
    for k, (dx, rot) in enumerate(((-0.16, -0.5), (0.0, 0.0), (0.16, 0.5))):
        cx = S * (0.5 + dx)
        pts = [(cx - S * 0.06, S * 0.2), (cx - S * 0.06, S * 0.62), (cx + S * 0.06, S * 0.62), (cx + S * 0.06, S * 0.2)]
        d.polygon(pts, fill=rgba([TEAL, GREEN, CORAL][k]))
        d.polygon([(cx - S * 0.09, S * 0.2), (cx + S * 0.09, S * 0.2), (cx, S * 0.08)], fill=rgba([TEAL_DEEP, mix(GREEN, (0,0,0), 0.2), CORAL_DEEP][k]))
    return done(img, size)


def icon_home(size):
    img, d = _icon_canvas(size)
    S = size * SS
    d.polygon([(S * 0.5, S * 0.1), (S * 0.9, S * 0.45), (S * 0.78, S * 0.45), (S * 0.78, S * 0.86),
               (S * 0.22, S * 0.86), (S * 0.22, S * 0.45), (S * 0.1, S * 0.45)], fill=rgba(TEAL_DEEP))
    d.rounded_rectangle([S * 0.42, S * 0.6, S * 0.58, S * 0.86], radius=int(S * 0.03), fill=rgba(CREAM))
    return done(img, size)


# =====================================================================
# STAGE 6 — FX & KONTROL (6 aset)
# =====================================================================

def fx_spark(size):
    img, d = canvas(size)
    S = size * SS
    cx = cy = S * 0.5
    r = S * 0.44
    pts = []
    for i in range(8):
        a = math.pi * i / 4
        rr = r if i % 2 == 0 else r * 0.24
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    d.polygon(pts, fill=(255, 255, 255, 240))
    d.polygon([(cx, cy - r * 0.7), (cx + r * 0.16, cy), (cx, cy + r * 0.7), (cx - r * 0.16, cy)], fill=rgba(GOLD, 200))
    return done(img, size)


def fx_ring(size):
    img, d = canvas(size)
    S = size * SS
    r = S * 0.42
    d.ellipse([S * 0.5 - r, S * 0.5 - r, S * 0.5 + r, S * 0.5 + r], outline=(255, 255, 255, 235), width=int(S * 0.1))
    d.ellipse([S * 0.5 - r, S * 0.5 - r, S * 0.5 + r, S * 0.5 + r], outline=rgba(CORAL, 200), width=int(S * 0.035))
    return done(img, size)


def fx_hit(size):
    img, d = canvas(size)
    S = size * SS
    cx = cy = S * 0.5
    r = S * 0.42
    for i in range(8):
        a = math.tau * i / 8 + 0.3
        r1, r2 = r * 0.25, r * (0.75 + (i % 2) * 0.25)
        d.line([(cx + math.cos(a) * r1, cy + math.sin(a) * r1), (cx + math.cos(a) * r2, cy + math.sin(a) * r2)],
               fill=(255, 255, 255, 220), width=int(S * 0.06))
    d.ellipse([cx - r * 0.3, cy - r * 0.3, cx + r * 0.3, cy + r * 0.3], fill=(255, 255, 255, 200))
    return done(img, size)


def fx_shadow(size):
    img = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = size * SS
    d.ellipse([S * 0.1, S * 0.32, S * 0.9, S * 0.68], fill=(10, 40, 36, 90))
    img = img.filter(ImageFilter.GaussianBlur(S * 0.05))
    return done(img, size)


def joy_base(size):
    img, d = canvas(size)
    S = size * SS
    r = S * 0.46
    d.ellipse([S * 0.5 - r, S * 0.5 - r, S * 0.5 + r, S * 0.5 + r], fill=rgba(CREAM, 90))
    d.ellipse([S * 0.5 - r, S * 0.5 - r, S * 0.5 + r, S * 0.5 + r], outline=rgba(CREAM, 160), width=int(S * 0.035))
    return done(img, size)


def joy_knob(size):
    img, d = canvas(size)
    S = size * SS
    r = S * 0.4
    for i in range(14, 0, -1):
        t = i / 14
        rr = r * t
        d.ellipse([S * 0.5 - rr, S * 0.5 - rr, S * 0.5 + rr, S * 0.5 + rr],
                  fill=rgba(mix(mix(TEAL, (255, 255, 255), 0.5), TEAL_DEEP, 1 - t)))
    d.ellipse([S * 0.5 - r, S * 0.5 - r, S * 0.5 + r, S * 0.5 + r], outline=rgba(CREAM, 230), width=int(S * 0.05))
    return done(img, size)


def gen_stage_fx(out):
    print("STAGE 6 — FX & kontrol (6 aset)")
    return {
        "fx_spark.png": fx_spark(96),
        "fx_ring.png": fx_ring(128),
        "fx_hit.png": fx_hit(96),
        "fx_shadow.png": fx_shadow(128),
        "fx_joystick_base.png": joy_base(128),
        "fx_joystick_knob.png": joy_knob(96),
    }


# =====================================================================
# STAGE 7 — PROPERTI LATAR (4 aset)
# =====================================================================

def prop_reef(size):
    img, d = canvas(size)
    S = size * SS
    col = (18, 88, 79, 255)
    x, y = S * 0.5, S * 0.72
    d.ellipse([x - S * 0.3, y - S * 0.28, x + S * 0.3, y + S * 0.28], fill=col)
    d.ellipse([x + S * 0.18, y - S * 0.42, x + S * 0.52, y], fill=col)
    d.ellipse([x - S * 0.5, y - S * 0.2, x - S * 0.16, y + S * 0.16], fill=col)
    d.rounded_rectangle([x - S * 0.06, y - S * 0.66, x + S * 0.06, y - S * 0.1], radius=int(S * 0.05), fill=col)
    d.ellipse([x - S * 0.1, y - S * 0.72, x + S * 0.1, y - S * 0.52], fill=col)
    return done(img, size)


def prop_weed(size):
    img, d = canvas(size)
    S = size * SS
    col = (150, 205, 175, 255)
    for k, bx in enumerate((0.36, 0.52, 0.66)):
        pts = []
        hgt = S * (0.5 + 0.14 * (k % 2))
        for t in range(16):
            tt = t / 15
            px = S * bx + math.sin(tt * 4 + k) * S * 0.06 * tt
            py = S * 0.94 - tt * hgt
            pts.append((px, py))
        d.line(pts, fill=col, width=int(S * (0.05 - k * 0.01)), joint="curve")
    return done(img, size)


def prop_cell(size):
    img, d = canvas(size)
    S = size * SS
    pts = blob_pts(S * 0.5, S * 0.5, S * 0.4, 30, 0.09, 21, 6)
    d.polygon(pts, fill=(191, 227, 216, 60))
    d.line(pts + [pts[0]], fill=(191, 227, 216, 90), width=int(S * 0.02), joint="curve")
    d.ellipse([S * 0.42, S * 0.42, S * 0.58, S * 0.58], fill=(191, 227, 216, 45))
    return done(img, size)


def prop_dots(size):
    import random
    img, d = canvas(size)
    S = size * SS
    rnd = random.Random(7)
    for _ in range(9):
        x, y = rnd.uniform(S * 0.15, S * 0.85), rnd.uniform(S * 0.15, S * 0.85)
        r = S * rnd.uniform(0.02, 0.05)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 60))
    return done(img, size)


def gen_stage_props(out):
    print("STAGE 7 — Properti latar (4 aset)")
    return {
        "prop_reef.png": prop_reef(256),
        "prop_weed.png": prop_weed(256),
        "prop_cell.png": prop_cell(256),
        "prop_dots.png": prop_dots(128),
    }


# =====================================================================

def main():
    os.makedirs(OUT, exist_ok=True)
    stages = [
        gen_stage_heroes,
        gen_stage_enemies,
        gen_stage_items,
        gen_stage_portraits,
        gen_stage_icons,
        gen_stage_fx,
        gen_stage_props,
    ]
    total = 0
    for stage in stages:
        sprites = stage(OUT)
        for name, img in sprites.items():
            path = os.path.join(OUT, name)
            img.save(path, "PNG")
            total += 1
    print(f"\nTOTAL: {total} aset PNG tersimpan di {os.path.abspath(OUT)}")
    # hapus sprite lama yang sudah tidak dipakai agar folder bersih
    keep = set()
    for stage in stages:
        keep.update(stage(OUT).keys())
    keep.add("ui_shield_emblem.png")
    for f in os.listdir(OUT):
        if f.endswith(".png") and f not in keep:
            os.remove(os.path.join(OUT, f))
            print(f"  ✚ dihapus (usang): {f}")


if __name__ == "__main__":
    main()
