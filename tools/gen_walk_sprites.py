#!/usr/bin/env python3
"""
gen_walk_sprites.py — Generator sheet animasi jalan 8-arah (hero & virus).

Spesifikasi (rebuild karakter, 2026-09):
- Animasi jalan DIGAMBAR ULANG untuk 5 arah unik — DEPAN (S), BELAKANG (N),
  SAMPING (E), dan dua diagonal (NE, SE). Arah W, NW, SW TIDAK disimpan;
  di-runtime mereka di-mirror horizontal (W=E, NW=NE, SW=SE).
- Ini BUKAN rotasi matematis sprite — tiap arah punya siklus geraknya sendiri:
  amplitud bob/lunge/lean beda per sudut, mata & nukleus bergeser parallax
  sesuai arah hadap, dan timing playback-nya juga beda per arah
  (lihat dirSpeed di data/walk-anim.json).
- Sheet per karakter: assets/sprites/walk/{id}_walk.png
  grid 5 kolom (E, NE, N, SE, S) x 4 baris (frame siklus).
- S/frame-0 untuk karakter "bulat" identik pixel dengan sprite idle saat ini
  (di-blit dari assets/sprites/*), jadi tampilan diam TIDAK berubah.
  Untuk tipe kapsul/cacing (bakteri*, parasit) yang idle-nya memang
  side-view, frame S digambar baru (front-view) — bagian dari rebuild.
- Primitif gambar di-reuse dari tools/gen_sprites.py (Character Agent) —
  bentuk tubuh, warna, nucleus, wajah kawaii tetap persis sama.

Butuh Pillow (venv). Jalankan:
    /tmp/venv-imunverse/bin/python tools/gen_walk_sprites.py [--only macrophage,bakteri]
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_sprites as gs  # noqa: E402  (primitif bersama)

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow dibutuhkan: python3 -m venv /tmp/v && pip install pillow, lalu jalankan dengan python venv")

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, "..", "assets", "sprites", "walk")
SPR_DIR = os.path.join(ROOT, "..", "assets", "sprites")

COLS = ["E", "NE", "N", "SE", "S"]  # urutan kolom sheet — WAJIB sama dengan data/walk-anim.json
FRAMES = 4
SS = gs.SS

# Vektor hadap (screen, y-down) & sudut rotasi frame lokal (front = +x)
FACING = {"E": (1, 0), "NE": (math.sqrt(2) / 2, -math.sqrt(2) / 2),
          "N": (0, -1), "SE": (math.sqrt(2) / 2, math.sqrt(2) / 2),
          "S": (0, 1)}
# Parameter gait per arah (keputusan art, skala 128px):
#   bob   = angkat badan (px)     lunge = dorong maju-mundur sepanjang arah (px)
#   sx/sy = squash badan relatif  (samping = lebar+pendek, depan = tegak)
GAIT = {
    "E":  {"bob": 2.2, "lunge": 5.0, "sx": 1.10, "sy": 0.88},
    "NE": {"bob": 2.6, "lunge": 3.2, "sx": 1.02, "sy": 0.96},
    "N":  {"bob": 2.4, "lunge": 0.0, "sx": 1.02, "sy": 0.95},
    "SE": {"bob": 2.4, "lunge": 4.2, "sx": 1.06, "sy": 0.92},
    "S":  {"bob": 3.0, "lunge": 0.0, "sx": 1.00, "sy": 1.00},
}
# Jarak offset wajah/sepasang-mata sepanjang arah hadap (fraksi radius).
# N = 0 → tidak ada mata (tampak punggung; nukleus terlihat).
EYE_F = {"S": 0.0, "NE": 0.35, "SE": 0.65, "E": 0.9, "N": 0.0}


def rot_pt(p, A):
    c, s = math.cos(A), math.sin(A)
    return p[0] * c - p[1] * s, p[0] * s + p[1] * c


def eyes(c, ex, ey, agg=False, k=1.0, col=(18, 63, 58)):
    """Sepasang mata kawaii (replica gs.eyes + skala)."""
    if agg:
        c.line(ex - 15 * k, ey - 6 * k, ex - 6 * k, ey - 3 * k, col, 3 * k)
        c.line(ex + 15 * k, ey - 6 * k, ex + 6 * k, ey - 3 * k, col, 3 * k)
    else:
        c.circle(ex - 10 * k, ey - 6 * k, 2.2 * k, col, 0.95)
        c.circle(ex + 10 * k, ey - 6 * k, 2.2 * k, col, 0.95)


def body_no_shadow(c, cx, cy, r, color, seed, sx, sy, wb):
    """gs.body tanpa bayangan ter-bake (bayangan sheet di-gambar terpisah di tanah)."""
    rgb = gs.hex_rgb(color)
    c.blob(cx, cy, r, gs.shade(rgb, 0.82), seed=seed, sx=sx, sy=sy, wobble=wb, alpha=1)
    c.radial_ellipse(cx - r * 0.18, cy - r * 0.2, r * 0.8 * sx, r * 0.68 * sy, gs.shade(rgb, 1.45), rgb, steps=24)
    c.ring(cx, cy, r * 0.86, gs.shade(rgb, 1.25), width=2.2, alpha=0.55)


def gait_offsets(dirn, f, sc):
    """Offset badan per frame: lunge (sepanjang arah) + bob (vertikal)."""
    g = GAIT[dirn]
    ph = math.tau * f / FRAMES
    lunge = math.sin(ph) * g["lunge"] * sc
    bob = -abs(math.sin(math.pi * f / FRAMES)) * g["bob"] * sc
    return lunge, bob, ph


def cell_image(c, cell):
    """Canvas SS → Image logis (downsample C-speed via Pillow)."""
    big = Image.frombytes("RGBA", (c.w, c.h), bytes(c.buf))
    return big.resize((cell, cell), Image.LANCZOS)


# ---------------------------------------------------------------------------
# HEROES
# ---------------------------------------------------------------------------

HERO_BODY = {  # rf/sx/sy/wobble/seed — persis seperti draw_hero di gen_sprites.py
    "phagocyte":     dict(rf=1.00, sx=1.08, sy=0.92, wb=0.16, seed=10),
    "dendritic":     dict(rf=0.86, sx=0.95, sy=0.90, wb=0.10, seed=12),
    "net":           dict(rf=0.94, sx=0.90, sy=0.95, wb=0.07, seed=13),
    "granule_lance": dict(rf=0.95, sx=0.94, sy=0.90, wb=0.06, seed=14),
    "vesicle_cloud": dict(rf=0.92, sx=0.96, sy=0.96, wb=0.05, seed=15),
    "granule_tank":  dict(rf=1.02, sx=1.03, sy=0.95, wb=0.05, seed=16),
    "cytotoxic":     dict(rf=0.92, sx=0.88, sy=1.02, wb=0.04, seed=17),
    "helper":        dict(rf=0.92, sx=0.92, sy=0.98, wb=0.04, seed=18),
    "regulator":     dict(rf=0.92, sx=0.93, sy=0.98, wb=0.04, seed=19),
    "antibody":      dict(rf=0.90, sx=0.94, sy=0.98, wb=0.04, seed=20),
    "nk_spike":      dict(rf=0.90, sx=0.90, sy=1.00, wb=0.05, seed=21),
}
NUCLEUS = {  # offset (px 128-scale) & radius — persis seperti draw_hero
    "phagocyte":     dict(off=(-3, 4), rf=16, kind="single"),
    "dendritic":     dict(off=(0, 1), rf=15, kind="crescent"),
    "net":           dict(off=(0, 1), rf=18, kind="segmented"),
    "granule_lance": dict(off=(-2, 1), rf=15, kind="crescent"),
    "vesicle_cloud": dict(off=(2, 1), rf=13, kind="single"),
    "granule_tank":  dict(off=(0, 3), rf=14, kind="single"),
    "cytotoxic":     dict(off=(0, 4), rf=14, kind="single"),
    "helper":        dict(off=(0, 3), rf=14, kind="single"),
    "regulator":     dict(off=(0, 4), rf=14, kind="single"),
    "antibody":      dict(off=(0, 5), rf=14, kind="single"),
    "nk_spike":      dict(off=(0, 4), rf=13, kind="single"),
}


def hero_extras(c, arch, rgb, cx, cy, r, sc, ph):
    """Bagian khas per archetype dengan fase langkah (sw = swing sinus)."""
    def sw(i):
        return math.sin(ph + i * math.pi / 2)

    if arch == "phagocyte":
        for i, a in enumerate([-2.8, -0.25, 0.45, 2.7]):
            aa = a + 0.10 * sw(i)
            kk = 1 + 0.09 * sw(i)
            c.line(cx + math.cos(a) * r * 0.55, cy + math.sin(a) * r * 0.35,
                   cx + math.cos(aa) * r * 1.16 * kk, cy + math.sin(aa) * r * 0.92 * kk,
                   gs.shade(rgb, 1.15), 5 * sc, 0.9)
        c.ellipse(cx + 10 * sc, cy + 13 * sc, 14 * sc * (1 + 0.08 * sw(2)), 7 * sc,
                  gs.shade(rgb, 0.38), 0.8, rot=0.1)
    elif arch == "dendritic":
        for i, a in enumerate([-2.7, -2.15, -1.35, -0.55, 0.05, 0.85, 1.7, 2.4]):
            kk = 1 + 0.07 * sw(i)
            ex = cx + math.cos(a) * r * 1.45 * kk
            ey = cy + math.sin(a) * r * 1.25 * kk
            c.line(cx + math.cos(a) * r * 0.45, cy + math.sin(a) * r * 0.4, ex, ey,
                   gs.shade(rgb, 1.2), 4.2 * sc, 0.92)
            if i % 2 == 0:
                c.circle(ex, ey, 3.5 * sc * (1 + 0.3 * abs(sw(i))), (255, 215, 106), 0.9)
    elif arch == "granule_lance":
        for i in range(6):
            a = math.tau * i / 6
            c.circle(cx + math.cos(a) * r * 0.52, cy + 4 * sc + math.sin(a) * r * 0.38,
                     3.2 * sc, (255, 159, 67), 0.60 + 0.12 * abs(sw(i)))
    elif arch == "vesicle_cloud":
        for i in range(13):
            a = math.tau * i / 13
            c.circle(cx + math.cos(a) * r * 0.7, cy + 4 * sc + math.sin(a) * r * 0.56,
                     3.8 * sc * (1 + 0.12 * sw(i)), gs.shade(rgb, 1.45), 0.82)
    elif arch == "granule_tank":
        for i in range(6):
            a = math.tau * i / 6
            c.circle(cx + math.cos(a) * r * 0.48, cy + 4 * sc + math.sin(a) * r * 0.38,
                     3.4 * sc * (1 + 0.15 * sw(i)), (255, 179, 71), 0.6)
    elif arch == "antibody":
        for i in range(5):
            a = math.tau * i / 5 + 0.2
            c.circle(cx + math.cos(a) * r * 0.55, cy + 5 * sc + math.sin(a) * r * 0.42,
                     2.8 * sc, gs.shade(rgb, 1.35), 0.55)
    elif arch == "nk_spike":
        for i in range(7):
            a = math.tau * i / 7
            c.circle(cx + math.cos(a) * r * 0.48, cy + 4 * sc + math.sin(a) * r * 0.42,
                     2.8 * sc * (1 + 0.2 * sw(i)), (179, 157, 219), 0.5)


def hero_cell(hero_id, color, arch, cell, dirn, f):
    c = gs.Canvas(cell)
    S = cell
    sc = S / 128
    rgb = gs.hex_rgb(color)
    F = FACING[dirn]
    g = GAIT[dirn]
    lunge, bob, ph = gait_offsets(dirn, f, sc)

    hb = HERO_BODY[arch]
    r = 34 * hb["rf"] * sc
    cx = S / 2 + F[0] * lunge
    cy = S / 2 + F[1] * lunge + bob

    # bayangan tetap di tanah (tidak ikut bob) — karakter terlihat "melangkah"
    c.ellipse(S / 2 + F[0] * lunge * 0.7, S / 2 + r * 0.85, r * 0.95, r * 0.38, (0, 0, 0), 0.14)
    # badan: seed di-vary per frame → membran bergelombang organik
    body_no_shadow(c, cx, cy, r, color, hb["seed"] + f, hb["sx"] * g["sx"], hb["sy"] * g["sy"], hb["wb"])
    # nukleus: parallax — mundur dari arah hadap (punggung = besar & tengah)
    nu = NUCLEUS[arch]
    par = 0.18 * r if dirn != "N" else 0.0
    gs.nucleus(c,
               cx + (nu["off"][0] - F[0] * par) * sc,
               cy + (nu["off"][1] - F[1] * par) * sc,
               nu["rf"] * sc * (1.12 if dirn == "N" else 1.0), rgb, nu["kind"])
    hero_extras(c, arch, rgb, cx, cy, r, sc, ph)
    # wajah: bergeser ke arah hadap; N = punggung (tanpa mata)
    fe = EYE_F[dirn]
    if fe > 0:
        eyes(c, cx + F[0] * r * fe, cy + F[1] * r * fe - 6 * sc, agg=False)
    return c


# ---------------------------------------------------------------------------
# ENEMIES
# ---------------------------------------------------------------------------


def capsule(c, rgb, cx, cy, r, sc, A, ph, kind):
    """Kapsul bakteri (3 varian) — sumbu sepanjang arah hadap (front = +x lokal)."""
    P = rot_pt((0, 1), A)  # tegak lurus arah (sebelah kiri-atas)
    if kind == "bakteri":
        c.ellipse(cx, cy, r * 1.1, r * 0.48, gs.shade(rgb, 0.82), 1, rot=A)
        hp = rot_pt((-8, -5), A)
        c.radial_ellipse(cx + hp[0] * sc, cy + hp[1] * sc, r * 0.95, r * 0.38,
                         gs.shade(rgb, 1.45), rgb, rot=A, steps=18)
        for x in (-22, 0, 22):
            p1 = rot_pt((x, -19), A)
            p2 = rot_pt((x + 6, 17), A)
            c.line(cx + p1[0] * sc, cy + p1[1] * sc, cx + p2[0] * sc, cy + p2[1] * sc,
                   gs.shade(rgb, 0.55), 2.3 * sc, 0.55)
    elif kind == "bakteri_gp":
        c.ellipse(cx, cy, r * 1.12, r * 0.55, gs.shade(rgb, 0.7), 1, rot=A)
        c.ring(cx, cy, r * 0.72, (245, 198, 79), 5 * sc, 0.85)
        for x in (-28, -10, 10, 28):
            p1 = rot_pt((x, -24), A)
            p2 = rot_pt((x + 7, 25), A)
            c.line(cx + p1[0] * sc, cy + p1[1] * sc, cx + p2[0] * sc, cy + p2[1] * sc,
                   (255, 224, 130), 3 * sc, 0.78)
    else:  # bakteri_gn (toksik)
        c.ellipse(cx, cy, r * 1.05, r * 0.5, gs.shade(rgb, 0.82), 1, rot=A)
        c.ring(cx, cy, r * 0.92, (110, 240, 110), 4 * sc, 0.72)
        c.ring(cx, cy, r * 0.6, gs.shade(rgb, 1.35), 2.3 * sc, 0.8)
        for i in range(6):
            a = i * math.tau / 6
            q = rot_pt((math.cos(a) * r * 0.62, math.sin(a) * r * 0.35), A)
            c.circle(cx + q[0] * sc, cy + q[1] * sc, 4 * sc * (1 + 0.15 * math.sin(ph + i)),
                     (110, 240, 110), 0.8)
    # flagela/ekor di ujung BELAKANG (-x lokal), bergelombang per frame
    for k, y0 in enumerate((-7, 7)):
        pts = []
        for s in range(4):
            t = s / 3
            lx = -r * 0.95 - t * r * 0.55
            ly = y0 + math.sin(ph + k * 1.7 + t * 3.2) * 5 * sc * t
            pts.append((cx + rot_pt((lx, ly), A)[0] * sc, cy + rot_pt((lx, ly), A)[1] * sc))
        c.polyline(pts, gs.shade(rgb, 1.2), 3 * sc, 0.8)
    # posisi mata di ujung DEPAN (N = punggung, tanpa mata)
    return rot_pt((r * 0.55, -8), A)


def enemy_cell(kind, color, cell, dirn, f):
    c = gs.Canvas(cell)
    S = cell
    sc = S / 128
    rgb = gs.hex_rgb(color)
    r = 34 * sc if cell <= 128 else 72 * sc
    F = FACING[dirn]
    A = math.atan2(F[1], F[0])
    lunge, bob, ph = gait_offsets(dirn, f, sc)
    cx = S / 2 + F[0] * lunge
    cy = S / 2 + F[1] * lunge + bob
    has_face = EYE_F[dirn] > 0 or dirn in ("E", "NE", "SE")  # lihat di bawah per kind

    c.ellipse(S / 2 + F[0] * lunge * 0.7, S / 2 + r * 0.8, r * 1.0, r * 0.32, (0, 0, 0), 0.15)

    if kind in ("bakteri", "bakteri_gp", "bakteri_gn"):
        front = capsule(c, rgb, cx, cy, r, sc, A, ph, kind)
        if dirn != "N":
            eyes(c, cx + front[0] * sc, cy + front[1] * sc, agg=True, k=sc)
        return c

    if kind in ("virus", "virion"):
        spike_r = r * 0.82 if kind == "virus" else r * 0.58
        spike_len = 11 * sc if kind == "virus" else 8 * sc
        c.star_spikes(cx, cy, spike_r, gs.shade(rgb, 0.8 if kind == "virus" else 0.82),
                      14 if kind == "virus" else 10, spike_len,
                      0.92, rot=A + f * 0.16)
        c.radial_ellipse(cx - 5 * sc, cy - 7 * sc, r * 0.74, r * 0.74, gs.shade(rgb, 1.45), rgb,
                         steps=22 if kind == "virus" else 18)
        if kind == "virus":
            for i in range(6):
                a = i * math.tau / 6 + 0.2
                c.line(cx, cy, cx + math.cos(a) * r * 0.62, cy + math.sin(a) * r * 0.62,
                       gs.shade(rgb, 0.55), 2 * sc, 0.48)
        if dirn != "N":
            eyes(c, cx + F[0] * r * 0.25, cy + F[1] * r * 0.25 - 7 * sc, agg=True, k=sc)
        return c

    if kind == "parasit":
        # cacing: tubuh sinusoidal sepanjang arah hadap, kepala di ujung depan,
        # undulasi bergerak ke ekor (fase -ph), amplitudo membesar ke ekor
        def swp(i):
            return math.sin(ph + i * math.pi / 2)
        pts = []
        for i in range(22):
            t = i / 21
            base = (-42 + t * 84) * sc
            amp = 13 * sc * (0.45 + 0.55 * (1 - t))
            wob = math.sin(i * 0.75 - ph) * amp
            q = rot_pt((base, wob), A)
            pts.append((cx + q[0], cy + q[1]))
        c.polyline(pts, gs.shade(rgb, 0.75), 17 * sc, 1)
        c.polyline(pts, gs.shade(rgb, 1.25), 9 * sc, 0.95)
        perp = rot_pt((0, -15), A)
        for i, (x, y) in enumerate(pts[::3]):
            wig = math.sin(ph + i) * 3 * sc
            c.line(x, y, x + perp[0] + wig, y + perp[1], gs.shade(rgb, 1.35), 2.1 * sc, 0.8)
        hx, hy = pts[-1]
        hf = rot_pt((3, -3), A)
        c.circle(hx + hf[0], hy + hf[1], 7 * sc, (255, 224, 130), 0.95)
        if dirn != "N":
            eyes(c, hx + hf[0] + F[0] * 2, hy + hf[1] + F[1] * 2, agg=True, k=0.55 * sc)
        return c

    if kind == "spora":
        c.star_spikes(cx, cy, r * 0.75, gs.shade(rgb, 0.75), 9, 7 * sc, 0.5, rot=f * 0.1)
        c.radial_ellipse(cx, cy, r * 0.82, r * 0.72, gs.shade(rgb, 1.35), rgb, steps=24)
        c.ring(cx, cy, r * 0.55, gs.shade(rgb, 0.6), 3 * sc, 0.65)
        for i in range(10):
            a = i * math.tau / 10
            c.circle(cx + math.cos(a) * r * 0.45, cy + math.sin(a) * r * 0.38,
                     3.2 * sc * (1 + 0.18 * math.sin(ph + i * math.pi / 2)), gs.shade(rgb, 0.55), 0.7)
        if dirn != "N":
            eyes(c, cx + F[0] * r * 0.3, cy + F[1] * r * 0.3 - 4 * sc, agg=True, k=sc)
        return c

    if kind == "sel_kanker":
        c.blob(cx, cy, r * 0.9, gs.shade(rgb, 0.75), seed=77 + f, lobes=9, wobble=0.2, sx=1.05, sy=0.92)
        c.radial_ellipse(cx - 12 * sc, cy - 12 * sc, r * 0.7, r * 0.58, gs.shade(rgb, 1.35), rgb, steps=25)
        for i in range(9):
            a = i * math.tau / 9
            kk = 1 + 0.08 * math.sin(ph + i * math.pi / 2)
            c.line(cx + math.cos(a) * r * 0.45, cy + math.sin(a) * r * 0.38,
                   cx + math.cos(a + 0.2) * r * 1.15 * kk, cy + math.sin(a + 0.2) * r * 1.0 * kk,
                   gs.shade(rgb, 0.62), 5 * sc, 0.82)
        c.circle(cx + 3 * sc, cy + 2 * sc, r * 0.25, gs.shade(rgb, 0.35), 0.92)
        if dirn != "N":
            eyes(c, cx + F[0] * r * 0.2, cy + F[1] * r * 0.2 - 5 * sc, agg=True, k=sc * 1.15)
        return c

    if kind == "protozoa":
        c.ellipse(cx, cy, r * 0.8, r * 1.0, gs.shade(rgb, 0.78), 1, rot=A - 0.35)
        c.radial_ellipse(cx - 6 * sc, cy - 8 * sc, r * 0.65, r * 0.8, gs.shade(rgb, 1.45), rgb,
                         rot=A - 0.35, steps=20)
        for i in range(18):
            a = i * math.tau / 18
            kk = 1 + 0.25 * math.sin(ph + i * math.pi)
            p1 = rot_pt((math.cos(a) * r * 0.72, math.sin(a) * r * 0.9), A)
            p2 = rot_pt((math.cos(a) * r * 1.0 * kk, math.sin(a) * r * 1.15 * kk), A)
            c.line(cx + p1[0] * sc, cy + p1[1] * sc, cx + p2[0] * sc, cy + p2[1] * sc,
                   gs.shade(rgb, 1.25), 2 * sc, 0.8)
        c.ellipse(cx + 4 * sc, cy + 6 * sc, 10 * sc, 16 * sc, gs.shade(rgb, 0.42), 0.8, rot=A - 0.35)
        if dirn != "N":
            eyes(c, cx + F[0] * r * 0.3, cy + F[1] * r * 0.3 - 6 * sc, agg=True, k=sc)
        return c

    if kind == "toksin":
        # tetesan: ujung runcing menara belakang (lokal -y = belakang)
        pts = [(0, -r * 0.85), (r * 0.65, -r * 0.06), (r * 0.38, r * 0.72), (0, r * 0.9),
               (-r * 0.38, r * 0.72), (-r * 0.65, -r * 0.06)]
        c.polygon([(cx + rot_pt(p, A)[0] * sc, cy + rot_pt(p, A)[1] * sc) for p in pts], gs.shade(rgb, 0.8), 1)
        c.radial_ellipse(cx - 8 * sc, cy - 3 * sc, r * 0.45, r * 0.72, gs.shade(rgb, 1.55), rgb, steps=18)
        c.circle(cx - 9 * sc, cy - 18 * sc, 5 * sc, (255, 255, 255), 0.45)
        # tetesan drip berdenyut
        c.circle(cx + 30 * sc * (1 + 0.06 * math.sin(ph)), cy + 11 * sc, 7 * sc * (1 + 0.1 * math.sin(ph * 2)), rgb, 0.55)
        c.circle(cx - 34 * sc, cy + 19 * sc, 6 * sc * (1 + 0.1 * math.cos(ph * 2)), rgb, 0.45)
        return c

    if kind == "prion":
        # kristal: sedikit berguling mengikuti arah + kilau faset
        pts = [(0, -r), (r * 0.66, -r * 0.22), (r * 0.34, r * 0.9), (-r * 0.45, r * 0.78), (-r * 0.7, -r * 0.15)]
        rp = [(cx + rot_pt(p, A)[0] * sc, cy + rot_pt(p, A)[1] * sc) for p in pts]
        c.polygon(rp, gs.shade(rgb, 0.82), 1)
        c.polygon([rp[0], rp[1], (cx + 2 * sc, cy + 2 * sc)], gs.shade(rgb, 1.45), 0.8)
        c.polygon([rp[0], rp[4], (cx + 2 * sc, cy + 2 * sc)], gs.shade(rgb, 1.15), 0.75)
        q1 = rot_pt((-r * 0.55, -r * 0.1), A)
        q2 = rot_pt((r * 0.55, r * 0.05), A)
        c.line(cx + q1[0] * sc, cy + q1[1] * sc, cx + q2[0] * sc, cy + q2[1] * sc,
               (255, 255, 255), 2 * sc, 0.3 + 0.15 * abs(math.sin(ph)))
        return c

    if kind == "sel_abnormal":
        c.blob(cx, cy, r * 0.86, gs.shade(rgb, 0.8), seed=91 + f, lobes=7, wobble=0.18, alpha=0.82)
        c.ring(cx, cy, r * 0.88, (179, 157, 219), 3 * sc, 0.52)
        c.circle(cx + 5 * sc, cy + 4 * sc, r * 0.26, gs.shade(rgb, 0.35), 0.55)
        q1 = rot_pt((-20, -18), A)
        q2 = rot_pt((24, 18), A)
        c.line(cx + q1[0] * sc, cy + q1[1] * sc, cx + q2[0] * sc, cy + q2[1] * sc,
               (255, 243, 176), 2.4 * sc, 0.35)
        if dirn != "N":
            eyes(c, cx + F[0] * r * 0.3, cy + F[1] * r * 0.3 - 6 * sc, agg=False, k=sc)
        return c

    if kind == "toksin_raksasa":
        c.blob(cx, cy, r * 0.72, gs.shade(rgb, 0.7), seed=111 + f, lobes=8, wobble=0.15, sx=1.0, sy=1.05)
        c.star_spikes(cx, cy, r * 0.58, gs.shade(rgb, 0.55), 14, 14 * sc, 0.86, rot=f * 0.12 + A)
        c.radial_ellipse(cx - 18 * sc, cy - 22 * sc, r * 0.48, r * 0.6, gs.shade(rgb, 1.55), rgb, steps=24)
        for i in range(8):
            a = i * math.tau / 8
            c.circle(cx + math.cos(a) * r * 0.42, cy + math.sin(a) * r * 0.45,
                     7 * sc * (1 + 0.14 * math.sin(ph + i * math.pi / 2)), (255, 243, 176), 0.55)
        if dirn != "N":
            eyes(c, cx + F[0] * r * 0.25, cy + F[1] * r * 0.25 - 8 * sc, agg=True, k=sc * 1.2)
        return c

    body_no_shadow(c, cx, cy, r, color, 1, 1, 1, 0.06)
    gs.nucleus(c, cx, cy, 14 * sc, rgb)
    return c


# ---------------------------------------------------------------------------
# Sheet assembly
# ---------------------------------------------------------------------------

HEROES = [
    ("macrophage", "#4a7c59", "phagocyte", 128),
    ("dendritic", "#ff8c00", "dendritic", 128),
    ("neutrophil", "#1a5276", "net", 128),
    ("eosinophil", "#ff6b81", "granule_lance", 128),
    ("basophil", "#8e44ad", "vesicle_cloud", 128),
    ("mastcell", "#a03328", "granule_tank", 128),
    ("tcd8", "#00d2ff", "cytotoxic", 128),
    ("tcd4", "#f1c40f", "helper", 128),
    ("treg", "#2ecc71", "regulator", 128),
    ("bcell", "#bb8fce", "antibody", 128),
    ("nkcell", "#4a235a", "nk_spike", 128),
]

# id data/enemies.json → (kind, color, sheet_cell, idle_png_dipakai_untuk_S_f0)
ENEMIES = [
    ("bakteri", "bakteri", "#ff6b6b", 128, None),          # kapsul: S digambar baru
    ("bakteri_gp", "bakteri_gp", "#8d5fb3", 128, None),
    ("bakteri_gn", "bakteri_gn", "#b39ddb", 128, None),
    ("virus", "virus", "#9be15d", 128, "enemy_virus.png"),
    ("virion", "virion", "#c7f464", 96, "enemy_virion.png"),
    ("parasit", "parasit", "#e15fd0", 128, None),           # cacing: S digambar baru
    ("spora", "spora", "#f2c14e", 128, "enemy_spora.png"),
    ("sel_kanker", "sel_kanker", "#d7263d", 192, "enemy_sel_kanker.png"),
    ("protozoa", "protozoa", "#3ecfb2", 128, "enemy_protozoa.png"),
    ("toksin", "toksin", "#6ef06e", 128, "enemy_toksin.png"),
    ("prion", "prion", "#9b8fae", 128, "enemy_prion.png"),
    ("sel_abnormal", "sel_abnormal", "#2fb89f", 128, "enemy_sel_abnormal.png"),
    ("toksin_raksasa", "toksin_raksasa", "#7ed957", 192, "enemy_toksin_raksasa.png"),
]


def make_sheet(draw_fn, cell, idle_png, filename):
    sheet = Image.new("RGBA", (len(COLS) * cell, FRAMES * cell), (0, 0, 0, 0))
    for ci, dirn in enumerate(COLS):
        for f in range(FRAMES):
            if dirn == "S" and f == 0 and idle_png:
                img = Image.open(os.path.join(SPR_DIR, idle_png)).convert("RGBA")
                if img.size != (cell, cell):
                    img = img.resize((cell, cell), Image.LANCZOS)
            else:
                img = cell_image(draw_fn(dirn, f), cell)
            sheet.paste(img, (ci * cell, f * cell))
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, filename)
    sheet.save(path)
    return path


def main():
    only = None
    if len(sys.argv) > 2 and sys.argv[1] == "--only":
        only = set(sys.argv[2].split(","))

    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for hero_id, color, arch, cell in HEROES:
        if only and hero_id not in only:
            continue
        p = make_sheet(lambda d, f, _id=hero_id, _c=color, _a=arch, _s=cell:
                       hero_cell(_id, _c, _a, _s, d, f),
                       cell, f"hero_{hero_id}_idle.png", f"{hero_id}_walk.png")
        total += os.path.getsize(p)
        print(f"  hero  {hero_id:<14} → {os.path.relpath(p, ROOT)}")
    for eid, kind, color, cell, idle in ENEMIES:
        if only and eid not in only:
            continue
        p = make_sheet(lambda d, f, _k=kind, _c=color, _s=cell:
                       enemy_cell(_k, _c, _s, d, f),
                       cell, idle, f"enemy_{eid}_walk.png")
        total += os.path.getsize(p)
        print(f"  enemy {eid:<14} → {os.path.relpath(p, ROOT)}")
    print(f"\nSelesai: {len(HEROES) + len(ENEMIES)} sheet, total {total / 1024:.0f} KB di {os.path.relpath(OUT_DIR, ROOT)}")


if __name__ == "__main__":
    main()
