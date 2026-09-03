#!/usr/bin/env python3
"""
gen_sprites.py — Generator aset sprite PNG transparan untuk Imunverse.
Menggambar sel imun / patogen / nutrisi secara prosedural (Pillow) dengan
supersampling 4x agar halus. Output: assets/sprites/*.png (dipakai game via
path di data JSON; field sprite/spriteIdle/spriteAttack).

Jalankan: python3 tools/gen_sprites.py
"""

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

SS = 4  # faktor supersampling
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(c1, c2, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c1, c2))


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def new_canvas(size):
    img = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def finish(img, size):
    return img.resize((size, size), Image.LANCZOS)


def radial_gradient(size, cx, cy, r, inner, outer, steps=64):
    """Layer RGBA gradien radial (lingkaran konsentris)."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(steps, 0, -1):
        t = i / steps
        rr = r * t
        col = rgba(mix(inner, outer, 1 - t))
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=col)
    return layer


def blob_polygon(cx, cy, r, points=40, wobble=0.12, seed=0, lobes=5):
    """Titik-titik poligon 'blob' organik dengan wobble sinusoidal."""
    rnd = random.Random(seed)
    ph1 = rnd.uniform(0, math.tau)
    ph2 = rnd.uniform(0, math.tau)
    amp2 = wobble * rnd.uniform(0.3, 0.6)
    pts = []
    for i in range(points):
        a = math.tau * i / points
        rr = r * (
            1.0
            + wobble * math.sin(a * lobes + ph1)
            + amp2 * math.sin(a * (lobes + 3) + ph2)
        )
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return pts


def paste_masked(base, layer, mask_draw_fn):
    """Paste layer ke base dengan mask hasil mask_draw_fn(mask_draw)."""
    mask = Image.new("L", base.size, 0)
    md = ImageDraw.Draw(mask)
    mask_draw_fn(md)
    base.paste(layer, (0, 0), mask)


def add_glow(base, color, radius, alpha=90):
    """Glow lembut di bawah konten yang sudah ada."""
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    cx, cy = base.size[0] / 2, base.size[1] / 2
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=rgba(color, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(radius * 0.35))
    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    out = Image.alpha_composite(out, glow)
    out = Image.alpha_composite(out, base)
    return out


def specular_highlight(img, cx, cy, r, alpha=110):
    d = ImageDraw.Draw(img)
    hi = Image.new("RGBA", img.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(hi)
    hd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, alpha))
    hi = hi.filter(ImageFilter.GaussianBlur(r * 0.6))
    return Image.alpha_composite(img, hi)


# ----------------------------------------------------------------------
# HEROES
# ----------------------------------------------------------------------

def draw_cell_hero(size, color, seed, attack=False, style="tcell"):
    """Sel imun generik: membran blob + inti + reseptor; varian attack lebih 'terang'."""
    img, d = new_canvas(size)
    S = size * SS
    cx = cy = S / 2
    R = S * 0.36
    col = hex_rgb(color)

    if attack:
        img = add_glow(img, col, R * 1.15, 110)
        d = ImageDraw.Draw(img)

    body_col = tuple(min(255, int(c * (1.25 if attack else 1.0))) for c in col)

    # --- reseptor / duri di rim (untuk NK: duri panjang) ---
    if style == "spiky":
        n = 14
        for i in range(n):
            a = math.tau * i / n + (0.2 if attack else 0)
            x1, y1 = cx + math.cos(a) * R * 0.92, cy + math.sin(a) * R * 0.92
            x2, y2 = cx + math.cos(a) * R * 1.18, cy + math.sin(a) * R * 1.18
            d.line([x1, y1, x2, y2], fill=rgba(mix(body_col, (255, 255, 255), 0.25)), width=int(S * 0.02))
            d.ellipse([x2 - S * 0.02, y2 - S * 0.02, x2 + S * 0.02, y2 + S * 0.02],
                      fill=rgba(mix(body_col, (255, 255, 255), 0.5)))
    elif style == "macrophage":
        # pseudopodia: tonjolan blob besar
        pts = blob_polygon(cx, cy, R * 1.12, points=48, wobble=0.16, seed=seed, lobes=6)
        d.polygon(pts, fill=rgba(mix(body_col, (0, 0, 0), 0.25)))
    else:
        # reseptor titik kecil di rim
        n = 10
        for i in range(n):
            a = math.tau * i / n + seed
            px, py = cx + math.cos(a) * R * 1.02, cy + math.sin(a) * R * 1.02
            rr = S * 0.028
            d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=rgba(mix(body_col, (255, 255, 255), 0.45)))

    # --- tubuh (gradien radial) dengan mask blob ---
    grad = radial_gradient(S, cx - R * 0.15, cy - R * 0.15, R * 1.05,
                           mix(body_col, (255, 255, 255), 0.55),
                           mix(body_col, (0, 0, 0), 0.35))
    body_pts = blob_polygon(cx, cy, R, points=44, wobble=0.08, seed=seed + 1,
                            lobes=5 if style != "macrophage" else 7)
    paste_masked(img, grad, lambda md: md.polygon(body_pts, fill=255))

    # --- membran luar ---
    d = ImageDraw.Draw(img)
    d.line(body_pts + [body_pts[0]], fill=rgba(mix(body_col, (255, 255, 255), 0.6), 200), width=int(S * 0.016), joint="curve")

    # --- organel kecil ---
    rnd = random.Random(seed + 7)
    for _ in range(5):
        a = rnd.uniform(0, math.tau)
        rr = rnd.uniform(0.25, 0.62) * R
        ox, oy = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        orr = S * rnd.uniform(0.018, 0.034)
        oc = rgba(mix(body_col, (0, 0, 0), 0.35), 180)
        d.ellipse([ox - orr, oy - orr, ox + orr, oy + orr], fill=oc)

    # --- inti (nucleus) ---
    nR = R * (0.34 if style != "macrophage" else 0.30)
    nuc = radial_gradient(S, cx, cy, nR * 1.1,
                          mix(body_col, (255, 255, 255), 0.15),
                          mix(body_col, (0, 0, 0), 0.62))
    paste_masked(img, nuc, lambda md: md.ellipse([cx - nR, cy - nR, cx + nR, cy + nR], fill=255))
    d = ImageDraw.Draw(img)
    d.ellipse([cx - nR, cy - nR, cx + nR, cy + nR], outline=rgba(mix(body_col, (255, 255, 255), 0.4), 170),
              width=int(S * 0.012))

    img = specular_highlight(img, cx - R * 0.35, cy - R * 0.42, R * 0.32, 95)

    if attack:
        # kilat energi kecil di sekeliling saat attack
        rnd = random.Random(seed + 21)
        for _ in range(6):
            a = rnd.uniform(0, math.tau)
            rr = R * rnd.uniform(1.0, 1.14)
            px, py = cx + math.cos(a) * rr, cy + math.sin(a) * rr
            d = ImageDraw.Draw(img)
            d.line([px, py, px + math.cos(a) * S * 0.05, py + math.sin(a) * S * 0.05],
                   fill=(255, 255, 255, 210), width=int(S * 0.014))

    return finish(img, size)


def draw_bakteri(size, attack=False):
    """Bakteri: batang merah kapsul + flagela."""
    img, d = new_canvas(size)
    S = size * SS
    cx = cy = S / 2
    col = hex_rgb("#ff6b6b")
    L, W = S * 0.36, S * 0.14
    ang = math.radians(-30)

    def rot(px, py):
        dx, dy = px - cx, py - cy
        return (cx + dx * math.cos(ang) - dy * math.sin(ang),
                cy + dx * math.sin(ang) + dy * math.cos(ang))

    # flagela (3 heliks kecil di kedua ujung)
    rnd = random.Random(5)
    for side in (-1, 1):
        for k in range(3):
            pts = []
            bx = cx + side * L * 0.92
            for t in range(8):
                tt = t / 7
                px = bx + side * tt * S * 0.13
                py = cy + (k - 1) * W * 0.5 + math.sin(tt * math.pi * 2 + k) * S * 0.035
                pts.append(rot(px, py))
            d.line(pts, fill=rgba(mix(col, (255, 255, 255), 0.25), 220), width=int(S * 0.014), joint="curve")

    # tubuh kapsul (gradien)
    grad = radial_gradient(S, cx - S * 0.05, cy - S * 0.05, L * 1.05,
                           mix(col, (255, 255, 255), 0.55), mix(col, (0, 0, 0), 0.4))
    # tubuh kapsul (gradien) = rect + 2 lingkaran ujung
    body = [rot(cx - L, cy - W), rot(cx + L, cy - W), rot(cx + L, cy + W), rot(cx - L, cy + W)]
    cL, cR = rot(cx - L, cy), rot(cx + L, cy)

    def _bakteri_mask(md):
        md.polygon(body, fill=255)
        md.ellipse([cL[0] - W, cL[1] - W, cL[0] + W, cL[1] + W], fill=255)
        md.ellipse([cR[0] - W, cR[1] - W, cR[0] + W, cR[1] + W], fill=255)

    paste_masked(img, grad, _bakteri_mask)
    d = ImageDraw.Draw(img)
    # outline membran
    d.line(body + [body[0]], fill=rgba(mix(col, (255, 255, 255), 0.6), 210), width=int(S * 0.014))
    for ex in (cx - L, cx + L):
        c = rot(ex, cy)
        d.ellipse([c[0] - W, c[1] - W, c[0] + W, c[1] + W], outline=rgba(mix(col, (255, 255, 255), 0.6), 210),
                  width=int(S * 0.014))
    # inti memanjang
    nuc = radial_gradient(S, cx, cy, W * 0.9, mix(col, (255, 255, 255), 0.2), mix(col, (0, 0, 0), 0.6))
    paste_masked(img, nuc, lambda md: md.ellipse([cx - L * 0.62, cy - W * 0.52, cx + L * 0.62, cy + W * 0.52], fill=255))
    # strip sel dinding
    d = ImageDraw.Draw(img)
    for t in (-0.4, 0.0, 0.4):
        x = cx + L * t
        d.line([rot(x, cy - W), rot(x, cy + W)], fill=rgba(mix(col, (0, 0, 0), 0.3), 140), width=int(S * 0.012))
    img = specular_highlight(img, cx - S * 0.08, cy - W * 0.8, S * 0.08, 110)
    return finish(img, size)


def draw_virus(size, spikes=12, small=False, attack=False):
    """Virus berduri (corona-like). small=True untuk virion."""
    img, d = new_canvas(size)
    S = size * SS
    cx = cy = S / 2
    col = hex_rgb("#9be15d" if not small else "#c7f464")
    R = S * (0.22 if small else 0.3)

    if attack:
        img = add_glow(img, col, R * 1.4, 120)
        d = ImageDraw.Draw(img)

    # duri
    for i in range(spikes):
        a = math.tau * i / spikes
        x1, y1 = cx + math.cos(a) * R * 0.95, cy + math.sin(a) * R * 0.95
        x2, y2 = cx + math.cos(a) * R * 1.42, cy + math.sin(a) * R * 1.42
        wdt = int(S * (0.016 if small else 0.024))
        d.line([x1, y1, x2, y2], fill=rgba(mix(col, (0, 0, 0), 0.15)), width=wdt)
        hr = S * (0.022 if small else 0.036)
        d.ellipse([x2 - hr, y2 - hr, x2 + hr, y2 + hr], fill=rgba(mix(col, (255, 255, 255), 0.35)))

    # kepala (gradien)
    grad = radial_gradient(S, cx - R * 0.2, cy - R * 0.2, R * 1.15,
                           mix(col, (255, 255, 255), 0.6), mix(col, (0, 0, 0), 0.35))
    paste_masked(img, grad, lambda md: md.ellipse([cx - R, cy - R, cx + R, cy + R], fill=255))
    d = ImageDraw.Draw(img)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=rgba(mix(col, (255, 255, 255), 0.6), 200),
              width=int(S * 0.014))

    # DNA inti: garis berkelok
    pts = []
    rnd = random.Random(3 if small else 9)
    for t in range(14):
        tt = t / 13
        px = cx - R * 0.5 + tt * R
        py = cy + math.sin(tt * math.pi * 3 + rnd.uniform(0, 1)) * R * 0.28
        pts.append((px, py))
    d.line(pts, fill=rgba(mix(col, (0, 0, 0), 0.45)), width=int(S * 0.016), joint="curve")
    img = specular_highlight(img, cx - R * 0.3, cy - R * 0.35, R * 0.28, 120)
    return finish(img, size)


def draw_parasit(size):
    """Parasit: cacing magenta bersegmen melengkung."""
    img, d = new_canvas(size)
    S = size * SS
    col = hex_rgb("#e15fd0")
    # jalur tubuh: kurva S
    pts = []
    for t in range(30):
        tt = t / 29
        x = S * (0.16 + 0.68 * tt)
        y = S * 0.5 + math.sin(tt * math.pi * 1.6 + 0.4) * S * 0.16
        pts.append((x, y))

    # gambar segmen dari ekor ke kepala (besar→kecil→besar)
    for i, (x, y) in enumerate(reversed(pts)):
        t = 1 - i / (len(pts) - 1)
        r = S * (0.055 + 0.03 * math.sin(t * math.pi * 3.2) + (1 - t) * 0.05)
        shade = mix(col, (0, 0, 0), 0.05 * (i % 2))
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(shade))
    # gradient overlay sederhana: highlight atas
    hl = Image.new("RGBA", img.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    for i, (x, y) in enumerate(reversed(pts)):
        t = 1 - i / (len(pts) - 1)
        r = S * (0.055 + 0.03 * math.sin(t * math.pi * 3.2) + (1 - t) * 0.05)
        hd.ellipse([x - r * 0.7, y - r * 0.75, x + r * 0.2, y - r * 0.15], fill=(255, 255, 255, 46))
    img = Image.alpha_composite(img, hl.filter(ImageFilter.GaussianBlur(S * 0.012)))
    d = ImageDraw.Draw(img)
    # mata sederhana di kepala
    hx, hy = pts[-1]
    er = S * 0.016
    d.ellipse([hx + S * 0.02 - er, hy - S * 0.05 - er, hx + S * 0.02 + er, hy - S * 0.05 + er], fill=(30, 10, 25, 255))
    d.ellipse([hx + S * 0.045 - er, hy - S * 0.02 - er, hx + S * 0.045 + er, hy - S * 0.02 + er], fill=(30, 10, 25, 255))
    return finish(img, size)


def draw_spora(size):
    """Spora jamur: bulat tebal berbenjol (kitin)."""
    img, d = new_canvas(size)
    S = size * SS
    cx = cy = S / 2
    col = hex_rgb("#f2c14e")
    R = S * 0.32

    # benjolan luar
    pts = blob_polygon(cx, cy, R * 1.05, points=26, wobble=0.14, seed=11, lobes=8)
    d.polygon(pts, fill=rgba(mix(col, (0, 0, 0), 0.3)))
    # tubuh
    grad = radial_gradient(S, cx - R * 0.2, cy - R * 0.2, R * 1.1,
                           mix(col, (255, 255, 255), 0.5), mix(col, (0, 0, 0), 0.3))
    paste_masked(img, grad, lambda md: md.polygon(blob_polygon(cx, cy, R, 30, 0.07, 12, 7), fill=255))
    d = ImageDraw.Draw(img)
    # pori-pori
    rnd = random.Random(4)
    for _ in range(7):
        a = rnd.uniform(0, math.tau)
        rr = rnd.uniform(0.3, 0.75) * R
        px, py = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        pr = S * rnd.uniform(0.018, 0.032)
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=rgba(mix(col, (0, 0, 0), 0.4), 200))
    d.line(pts + [pts[0]], fill=rgba(mix(col, (255, 255, 255), 0.45), 180), width=int(S * 0.014), joint="curve")
    img = specular_highlight(img, cx - R * 0.3, cy - R * 0.4, R * 0.3, 100)
    return finish(img, size)


def draw_sel_kanker(size, attack=False):
    """Bos: sel kanker raksasa tidak beraturan, inti gelapmultilobed."""
    img, d = new_canvas(size)
    S = size * SS
    cx = cy = S / 2
    col = hex_rgb("#d7263d")
    R = S * 0.4

    if attack:
        img = add_glow(img, (255, 80, 90), R * 1.1, 130)
        d = ImageDraw.Draw(img)

    # duri permukaan (papillary) khas sel kanker
    rnd = random.Random(8)
    for i in range(18):
        a = math.tau * i / 18 + rnd.uniform(-0.1, 0.1)
        x1, y1 = cx + math.cos(a) * R * 0.95, cy + math.sin(a) * R * 0.95
        x2, y2 = cx + math.cos(a) * R * (1.12 + rnd.uniform(0, 0.1)), cy + math.sin(a) * R * (1.12 + rnd.uniform(0, 0.1))
        d.line([x1, y1, x2, y2], fill=rgba(mix(col, (0, 0, 0), 0.35)), width=int(S * 0.02))

    # tubuh tidak beraturan (multilobed nuclei style)
    body_pts = blob_polygon(cx, cy, R, points=64, wobble=0.14, seed=13, lobes=4)
    grad = radial_gradient(S, cx - R * 0.2, cy - R * 0.25, R * 1.1,
                           mix(col, (255, 255, 255), 0.35), mix(col, (0, 0, 0), 0.5))
    paste_masked(img, grad, lambda md: md.polygon(body_pts, fill=255))
    d = ImageDraw.Draw(img)
    d.line(body_pts + [body_pts[0]], fill=rgba(mix(col, (255, 255, 255), 0.5), 190), width=int(S * 0.014), joint="curve")

    # inti gelap besar lobus
    nR = R * 0.42
    nuc_pts = blob_polygon(cx, cy, nR, points=30, wobble=0.22, seed=17, lobes=5)
    nuc = radial_gradient(S, cx, cy, nR * 1.1, (90, 20, 40), (25, 5, 12))
    paste_masked(img, nuc, lambda md: md.polygon(nuc_pts, fill=255))
    # nukleolus
    d = ImageDraw.Draw(img)
    for _ in range(3):
        a = rnd.uniform(0, math.tau)
        rr = rnd.uniform(0, nR * 0.4)
        px, py = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        pr = S * 0.028
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(160, 40, 60, 235))
    img = specular_highlight(img, cx - R * 0.32, cy - R * 0.4, R * 0.3, 80)
    return finish(img, size)


# ----------------------------------------------------------------------
# ITEMS
# ----------------------------------------------------------------------

def draw_glukosa(size):
    """Kristal heksagon kuning."""
    img, d = new_canvas(size)
    S = size * SS
    cx = cy = S / 2
    col = hex_rgb("#ffd93d")
    R = S * 0.34
    pts = [(cx + math.cos(math.tau * i / 6 + math.pi / 6) * R,
            cy + math.sin(math.tau * i / 6 + math.pi / 6) * R) for i in range(6)]
    grad = radial_gradient(S, cx - R * 0.2, cy - R * 0.2, R * 1.2,
                           mix(col, (255, 255, 255), 0.7), mix(col, (0, 0, 0), 0.25))
    paste_masked(img, grad, lambda md: md.polygon(pts, fill=255))
    d = ImageDraw.Draw(img)
    d.line(pts + [pts[0]], fill=rgba(mix(col, (255, 255, 255), 0.8), 230), width=int(S * 0.02), joint="curve")
    # kilau dalam
    d.line([cx - R * 0.4, cy + R * 0.1, cx - R * 0.05, cy - R * 0.45], fill=(255, 255, 255, 190), width=int(S * 0.03))
    img = specular_highlight(img, cx - R * 0.15, cy - R * 0.3, R * 0.22, 140)
    return finish(img, size)


def draw_amino(size):
    """Klaster 3 bola hijau (rantai asam amino)."""
    img, d = new_canvas(size)
    S = size * SS
    col = hex_rgb("#7ae582")
    balls = [(S * 0.42, S * 0.58, S * 0.16), (S * 0.58, S * 0.4, S * 0.13), (S * 0.62, S * 0.66, S * 0.1)]
    for (bx, by, br) in balls:
        grad = radial_gradient(S, bx - br * 0.3, by - br * 0.3, br * 1.3,
                               mix(col, (255, 255, 255), 0.7), mix(col, (0, 0, 0), 0.3))
        paste_masked(img, grad, lambda md, bx=bx, by=by, br=br: md.ellipse([bx - br, by - br, bx + br, by + br], fill=255))
    d = ImageDraw.Draw(img)
    # ikatan
    for i in range(len(balls) - 1):
        x1, y1 = balls[i][0], balls[i][1]
        x2, y2 = balls[i + 1][0], balls[i + 1][1]
        d.line([x1, y1, x2, y2], fill=rgba(mix(col, (0, 0, 0), 0.35), 220), width=int(S * 0.022))
    return finish(img, size)


def draw_vitamin_c(size):
    """Kapsul pil oranye-putih."""
    img, d = new_canvas(size)
    S = size * SS
    cx = cy = S / 2
    col = hex_rgb("#ff9f1c")
    L, W = S * 0.28, S * 0.17
    ang = math.radians(-35)

    def rot(px, py):
        dx, dy = px - cx, py - cy
        return (cx + dx * math.cos(ang) - dy * math.sin(ang),
                cy + dx * math.sin(ang) + dy * math.cos(ang))

    body = [rot(cx - L, cy - W), rot(cx + L, cy - W), rot(cx + L, cy + W), rot(cx - L, cy + W)]
    e1, e2 = rot(cx - L, cy), rot(cx + L, cy)
    grad = radial_gradient(S, cx - S * 0.05, cy - S * 0.05, L * 1.2,
                           mix(col, (255, 255, 255), 0.6), mix(col, (0, 0, 0), 0.2))

    def _vitamin_mask(md):
        md.polygon(body, fill=255)
        md.ellipse([e1[0] - W, e1[1] - W, e1[0] + W, e1[1] + W], fill=255)
        md.ellipse([e2[0] - W, e2[1] - W, e2[0] + W, e2[1] + W], fill=255)

    paste_masked(img, grad, _vitamin_mask)
    # setengah putih (kanan)
    white = Image.new("RGBA", img.size, (0, 0, 0, 0))
    wd = ImageDraw.Draw(white)
    wd.pieslice([e2[0] - W, e2[1] - W, e2[0] + W, e2[1] + W], -90, 90, fill=(245, 245, 250, 255))
    wd.polygon([rot(cx, cy - W), rot(cx + L, cy - W), rot(cx + L, cy + W), rot(cx, cy + W)], fill=(245, 245, 250, 255))
    white = white.filter(ImageFilter.GaussianBlur(S * 0.004))
    img = Image.alpha_composite(img, white)
    d = ImageDraw.Draw(img)
    d.line([rot(cx, cy - W), rot(cx, cy + W)], fill=(200, 160, 90, 220), width=int(S * 0.012))
    img = specular_highlight(img, cx - W * 0.5, cy - W * 0.9, S * 0.09, 130)
    return finish(img, size)


def draw_antibodi(size):
    """Antibodi: bentuk Y cyan."""
    img, d = new_canvas(size)
    S = size * SS
    col = hex_rgb("#4cc9f0")
    cx = S * 0.5
    cy = S * 0.56
    arm = S * 0.26
    stem = S * 0.3
    w = int(S * 0.055)

    top = (cx, cy - stem * 0.55)
    left = (cx - arm, cy - stem * 0.55 - arm * 0.9)
    right = (cx + arm, cy - stem * 0.55 - arm * 0.9)
    bottom = (cx, cy + stem)

    img = add_glow(img, col, S * 0.3, 80)
    d = ImageDraw.Draw(img)
    d.line([bottom, top], fill=rgba(col), width=w)
    d.line([top, left], fill=rgba(col), width=w)
    d.line([top, right], fill=rgba(col), width=w)
    # ujung antigen-binding
    for p in (left, right):
        d.ellipse([p[0] - w * 0.75, p[1] - w * 0.75, p[0] + w * 0.75, p[1] + w * 0.75],
                  fill=rgba(mix(col, (255, 255, 255), 0.6)))
    # inti pangkal
    d.ellipse([bottom[0] - w * 0.8, bottom[1] - w * 0.8, bottom[0] + w * 0.8, bottom[1] + w * 0.8],
              fill=rgba(mix(col, (0, 0, 0), 0.2)))
    img = specular_highlight(img, cx - arm * 0.5, cy - stem * 1.1, S * 0.07, 150)
    return finish(img, size)


def draw_sitokin(size):
    """Sinyal sitokin: titik pusat + gelombang radiasi pink."""
    img, d = new_canvas(size)
    S = size * SS
    cx = cy = S / 2
    col = hex_rgb("#f72585")
    img = add_glow(img, col, S * 0.28, 100)
    d = ImageDraw.Draw(img)
    # 3 cincin gelombang
    for k, rr in enumerate((S * 0.16, S * 0.26, S * 0.36)):
        alpha = 230 - k * 70
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=rgba(col, alpha), width=int(S * (0.03 - k * 0.006)))
    # titik pusat
    grad = radial_gradient(S, cx, cy, S * 0.12, mix(col, (255, 255, 255), 0.7), col)
    paste_masked(img, grad, lambda md: md.ellipse([cx - S * 0.1, cy - S * 0.1, cx + S * 0.1, cy + S * 0.1], fill=255))
    return finish(img, size)


# ----------------------------------------------------------------------
# Render semua
# ----------------------------------------------------------------------

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    sprites = {
        # heroes (idle & attack)
        "hero_sel_t_idle.png": draw_cell_hero(128, "#35d0ba", seed=1, style="tcell"),
        "hero_sel_t_attack.png": draw_cell_hero(128, "#35d0ba", seed=1, attack=True, style="tcell"),
        "hero_makrofag_idle.png": draw_cell_hero(128, "#b07fd8", seed=2, style="macrophage"),
        "hero_makrofag_attack.png": draw_cell_hero(128, "#b07fd8", seed=2, attack=True, style="macrophage"),
        "hero_sel_b_idle.png": draw_cell_hero(128, "#5aa2ff", seed=3, style="bcell"),
        "hero_sel_b_attack.png": draw_cell_hero(128, "#5aa2ff", seed=3, attack=True, style="bcell"),
        "hero_sel_nk_idle.png": draw_cell_hero(128, "#ff8c42", seed=4, style="spiky"),
        "hero_sel_nk_attack.png": draw_cell_hero(128, "#ff8c42", seed=4, attack=True, style="spiky"),
        # enemies
        "enemy_bakteri.png": draw_bakteri(128),
        "enemy_virus.png": draw_virus(128, spikes=12),
        "enemy_virion.png": draw_virus(96, spikes=7, small=True),
        "enemy_parasit.png": draw_parasit(128),
        "enemy_spora.png": draw_spora(128),
        "enemy_sel_kanker.png": draw_sel_kanker(256),
        "enemy_sel_kanker_attack.png": draw_sel_kanker(256, attack=True),
        # items
        "item_glukosa.png": draw_glukosa(96),
        "item_amino.png": draw_amino(96),
        "item_vitamin_c.png": draw_vitamin_c(96),
        "item_antibodi.png": draw_antibodi(96),
        "item_sitokin.png": draw_sitokin(96),
    }

    for name, img in sprites.items():
        path = os.path.join(OUT_DIR, name)
        img.save(path, "PNG")
        kb = os.path.getsize(path) / 1024
        print(f"  ✓ {name} ({img.size[0]}x{img.size[1]}, {kb:.1f} KB)")

    print(f"\n{len(sprites)} sprite tersimpan di {os.path.abspath(OUT_DIR)}")


if __name__ == "__main__":
    main()
