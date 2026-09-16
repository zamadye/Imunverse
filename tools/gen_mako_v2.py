#!/usr/bin/env python3
"""
gen_mako_v2.py — Art Agent generator for the Mako V2 Belly Devourer.

Scope is visual only. It creates transparent PNG art layers and deterministic
reference/import metadata; it does not change gameplay numbers or state.

Outputs:
- 5 Mako evolution stages × idle/attack/upgrade
- 5 authored movement views × walk/run × 5 evolution stages (50 directional PNGs)
- 18 mutation overlays (6 visual families × 3 tiers, mapped to existing IDs)
- 5 skin preview sprites
- assets/sprites/mako_v2/manifest.json

Run from repository root:
    python3 tools/gen_mako_v2.py
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

from gen_sprites import Canvas, hex_rgb, mix, shade

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "sprites" / "mako_v2"

STAGES = [
    (0, 1, "belly_devourer"),
    (1, 2, "first_hunger"),
    (2, 4, "phagosome_brute"),
    (3, 7, "pseudopod_breaker"),
    (4, 10, "apex_devourer"),
]
STATES = ("idle", "attack", "upgrade")
MOVE_STATES = ("walk", "run")
DIRECTIONS = ("south", "north", "east", "northeast", "southeast")

MUTATIONS = [
    "berduri", "lengket", "beracun", "elastis", "penyerap", "tipis",
    "ledakan_dalam", "membran_ganda", "parasit", "medan_pulsa", "regenerasi", "cermin",
    "nova", "simbiosis", "evolusi_total", "rantai", "adaptif", "medan_hidup",
]

SKINS = {
    "default_biological": ("#718f3f", "#f4d44c", "#261a43"),
    "rare_lime_colony": ("#8aa83d", "#e8ef68", "#243c35"),
    "epic_deep_sea": ("#287985", "#62e8e3", "#192b53"),
    "legendary_golden_apex": ("#8f742f", "#ffd55b", "#351f35"),
    "event_seasonal": ("#6e8f55", "#f08b66", "#312b54"),
}


def rgba(c, a=1.0):
    return c, max(0.0, min(1.0, a))


def draw_membrane(c: Canvas, cx: float, cy: float, r: float, body: tuple[int, int, int], stage: int, skin: str):
    """Layered, rounded biological torso with a readable silhouette."""
    # shadow and body mass
    c.ellipse(cx, cy + r * 0.92, r * 0.86, r * 0.22, (5, 25, 26), 0.2)
    wobble = 0.04 + stage * 0.025
    c.blob(cx, cy, r, shade(body, 0.72), seed=41 + stage, lobes=5 + stage, wobble=wobble, sx=1.05, sy=1.0)
    c.radial_ellipse(cx - r * 0.18, cy - r * 0.24, r * 0.9, r * 0.82,
                     shade(body, 1.38), body, steps=28)
    c.ring(cx, cy, r * 0.84, shade(body, 0.45), width=2.4, alpha=0.7)
    c.ring(cx - r * 0.12, cy - r * 0.18, r * 0.74, shade(body, 1.22), width=1.4, alpha=0.35)


def draw_eye(c: Canvas, x: float, y: float, scale: float, iris: tuple[int, int, int]):
    c.ellipse(x, y, scale * 0.18, scale * 0.25, (20, 30, 28), 1)
    c.ellipse(x, y - scale * 0.01, scale * 0.09, scale * 0.14, iris, 1)
    c.circle(x - scale * 0.035, y - scale * 0.08, scale * 0.04, (255, 255, 255), 0.95)


def draw_smile(c: Canvas, cx: float, cy: float, s: float, open_mouth: bool):
    if open_mouth:
        c.ellipse(cx, cy, s * 0.2, s * 0.11, (31, 18, 43), 1)
        c.line(cx - s * 0.12, cy - s * 0.02, cx + s * 0.12, cy - s * 0.02, (244, 212, 76), 1.4, 0.8)
    else:
        pts = []
        for i in range(13):
            t = i / 12
            pts.append((cx + (t - 0.5) * s * 0.34, cy + math.sin(t * math.pi) * s * 0.09))
        c.polyline(pts, (38, 43, 31), 1.8, 0.9)


def draw_mako(
    stage: int,
    state: str,
    skin: str = "default_biological",
    direction: str = "south",
    locomotion: str | None = None,
) -> Canvas:
    c = Canvas(128)
    direction = direction if direction in DIRECTIONS else "south"
    locomotion = locomotion if locomotion in MOVE_STATES else None
    body_hex, accent_hex, maw_hex = SKINS[skin]
    body = hex_rgb(body_hex)
    accent = hex_rgb(accent_hex)
    maw = hex_rgb(maw_hex)
    iris = (235, 205, 78) if skin != "epic_deep_sea" else (111, 248, 241)

    cx, cy = 64, 61
    body_r = 28 + stage * 2
    if state == "attack":
        cx, cy = 60, 60
    if locomotion == "run":
        # Run pose is still readable as Mako: wider stride and a small lean.
        cx, cy = cx + (2 if direction in ("east", "northeast", "southeast") else 0), cy - 1
        body_r += 1
    if state == "upgrade":
        body_r += 1
        c.ring(64, 62, 39 + stage * 2, accent, 2.0, 0.55)
        c.ring(64, 62, 34 + stage * 1.4, (255, 247, 176), 1.0, 0.42)

    # Directional locomotion is authored in five views. West-facing views are
    # mirrored at runtime, so only the right-facing source is generated.
    back_view = direction == "north"
    side_view = direction == "east"
    three_quarter = direction in ("northeast", "southeast")
    face_cx = cx + (7 if side_view else 4 if three_quarter else 0)
    face_cy = cy - (19 if locomotion == "run" else 20)
    maw_cx = cx + (9 if side_view else 5 if three_quarter else 0)
    stride = 3 if locomotion == "run" else (1 if locomotion == "walk" else 0)

    # Sturdy legs behind the torso. Run/walk use an asymmetric stride pose;
    # the runtime bob/scale supplies the in-between motion.
    leg = shade(body, 0.72)
    left_leg_x = 51 - stride
    right_leg_x = 77 + stride
    left_foot_x = 50 - stride * 1.5
    right_foot_x = 78 + stride * 1.5
    c.ellipse(left_leg_x, 90, 8.0, 13.0, leg, 1)
    c.ellipse(right_leg_x, 90, 8.0, 13.0, leg, 1)
    c.ellipse(left_foot_x, 101 + stride * 0.15, 10.0, 4.1, shade(body, 0.58), 1)
    c.ellipse(right_foot_x, 101 - stride * 0.15, 10.0, 4.1, shade(body, 0.58), 1)

    # Thick arms, with the selected stage and attack pose changing reach.
    arm = shade(body, 0.86)
    if state == "attack":
        c.line(40, 58, 18, 45, arm, 12, 1)
        c.circle(16, 44, 8, body, 1)
        c.ring(16, 44, 5.5, accent, 1.4, 0.75)
        c.line(88, 61, 108, 53, arm, 12, 1)
        c.circle(110, 52, 8, body, 1)
    else:
        c.line(39, 62, 27, 77, arm, 13, 1)
        c.circle(25, 79, 8, body, 1)
        c.line(89, 62, 101, 76, arm, 13, 1)
        c.circle(103, 78, 8, body, 1)
    c.ring(25 if state != "attack" else 16, 79 if state != "attack" else 44, 5.8, accent, 1.4, 0.72)
    c.ring(103 if state != "attack" else 110, 78 if state != "attack" else 52, 5.8, accent, 1.4, 0.72)

    draw_membrane(c, cx, cy, body_r, body, stage, skin)

    # Biological yellow seam, not armor. The locomotion views intentionally
    # change the read: south = face, north = dorsal back, east = profile,
    # diagonal = three-quarter silhouette.
    c.ring(cx, cy + 2, body_r * 0.88, accent, 1.8, 0.5)
    if back_view:
        c.ellipse(cx, cy - 19, 19 + stage * 0.4, 14 + stage * 0.25, shade(body, 0.94), 1)
        c.ring(cx, cy - 19, 17 + stage * 0.3, shade(accent, 0.82), 1.5, 0.62)
        c.ellipse(cx, cy + 1, 11 + stage, 16 + stage * 0.4, shade(maw, 0.68), 0.82)
        c.ring(cx, cy + 1, 10 + stage, shade(accent, 0.8), 1.1, 0.5)
    else:
        c.ellipse(face_cx, face_cy, 19 + stage * 0.4, 14 + stage * 0.25, shade(body, 1.08), 1)
        c.ring(face_cx, face_cy, 17 + stage * 0.3, accent, 1.5, 0.72)
        if side_view:
            draw_eye(c, face_cx + 4, face_cy + 1, 12, iris)
            draw_smile(c, face_cx + 6, face_cy + 7, 15, state == "attack")
        elif three_quarter:
            draw_eye(c, face_cx - 5, face_cy - 1, 11, iris)
            draw_eye(c, face_cx + 7, face_cy + 1, 9, iris)
            draw_smile(c, face_cx + 3, face_cy + 7, 17, state == "attack")
        else:
            draw_eye(c, face_cx - 7, face_cy - 1, 12, iris)
            draw_eye(c, face_cx + 7, face_cy - 1, 12, iris)
            draw_smile(c, face_cx, face_cy + 7, 18, state == "attack")

    # Nucleus cue behind/inside the belly maw.
    if not back_view:
        c.ellipse(maw_cx, cy + 4, 10 + stage * 0.8, 7 + stage * 0.45, shade(maw, 0.72), 0.92)
        c.ellipse(maw_cx - 3, cy + 4, 5.5 + stage * 0.4, 6 + stage * 0.3, shade(maw, 0.48), 0.7)
        c.ellipse(maw_cx + 3, cy + 4, 5.5 + stage * 0.4, 6 + stage * 0.3, shade(maw, 0.48), 0.7)

    # Signature Belly Devourer maw: frontal/three-quarter views expose it;
    # the north view correctly hides it behind the dorsal membrane.
    maw_w = 15 + stage * 2.8
    maw_h = 7 + stage * 1.5
    if state == "attack":
        maw_w += 4
        maw_h += 3
    if not back_view:
        c.ellipse(maw_cx, cy + 16, maw_w + 2, maw_h + 2, accent, 0.95)
        c.ellipse(maw_cx, cy + 16, maw_w, maw_h, maw, 1)
        c.ellipse(maw_cx, cy + 17, maw_w * 0.67, maw_h * 0.6, shade(maw, 0.7), 0.9)
        c.ring(maw_cx, cy + 16, maw_w * 0.88, (255, 235, 120), 1.2, 0.45)
        if state == "attack" or stage >= 2:
            c.circle(maw_cx - maw_w * 0.36, cy + 13, 2.0 + stage * 0.25, accent, 0.8)
            c.circle(maw_cx + maw_w * 0.3, cy + 18, 1.5 + stage * 0.2, (123, 225, 194), 0.75)

    # Internal swallowed prey vacuoles increase with evolution.
    vac_count = min(6, 1 + stage + (1 if state == "upgrade" else 0))
    for i in range(vac_count):
        a = -1.9 + i * 0.68
        vx = cx + math.cos(a) * (body_r * 0.58)
        vy = cy + math.sin(a) * (body_r * 0.38)
        c.circle(vx, vy, 2.0 + stage * 0.18, (111 + (i * 19) % 90, 147 + (i * 11) % 70, 97 + (i * 27) % 90), 0.62)
        c.ring(vx, vy, 2.6 + stage * 0.2, accent, 0.8, 0.35)

    # Pseudopod evolution: not human arms, short feeding tendrils from body.
    tendrils = [(-2.45, 0.75), (-1.8, 0.92), (-1.15, 0.82), (-0.35, 1.0), (0.35, 1.0), (1.15, 0.82), (1.8, 0.92), (2.45, 0.75)]
    count = [0, 1, 2, 4, 6][stage]
    if count:
        for i in range(count):
            a, length = tendrils[(i + stage) % len(tendrils)]
            if state == "attack" and i == 0:
                length += 0.35
            x1 = cx + math.cos(a) * body_r * 0.72
            y1 = cy + math.sin(a) * body_r * 0.72
            x2 = cx + math.cos(a) * body_r * (1.02 + length * 0.14)
            y2 = cy + math.sin(a) * body_r * (1.02 + length * 0.14)
            c.line(x1, y1, x2, y2, accent, 3.0 + stage * 0.32, 0.82)
            c.circle(x2, y2, 2.4 + stage * 0.2, body, 0.95)
            c.circle(x2, y2, 1.1 + stage * 0.12, maw, 0.75)

    if state == "upgrade":
        for i in range(6 + stage * 2):
            a = math.tau * i / (6 + stage * 2)
            x = 64 + math.cos(a) * (37 + stage * 2)
            y = 62 + math.sin(a) * (37 + stage * 2)
            c.circle(x, y, 1.4, (255, 240, 148), 0.8)

    return c


def draw_mutation(mutation_id: str) -> Canvas:
    c = Canvas(128)
    teal = hex_rgb("#64e6c0")
    green = hex_rgb("#8be26d")
    gold = hex_rgb("#f4d44c")
    violet = hex_rgb("#c38cff")
    coral = hex_rgb("#ff7d75")
    white = (240, 255, 239)

    if mutation_id == "berduri":
        c.star_spikes(64, 62, 31, gold, count=10, length=6, alpha=0.78, rot=0.15)
    elif mutation_id == "lengket":
        for y in (42, 64, 86):
            c.line(35, y, 93, y + 3, teal, 2.0, 0.65)
            c.circle(37, y, 2.5, teal, 0.7)
            c.circle(92, y + 3, 2.5, teal, 0.7)
    elif mutation_id == "beracun":
        for x, y in ((35, 91), (50, 98), (80, 94), (96, 84)):
            c.circle(x, y, 3.2, (166, 235, 55), 0.72)
            c.circle(x - 1, y - 1, 1.0, white, 0.6)
    elif mutation_id == "elastis":
        c.ring(64, 63, 34, teal, 2.2, 0.58)
        c.ring(64, 63, 38, teal, 1.2, 0.3)
    elif mutation_id == "penyerap":
        for x, y in ((43, 52), (84, 52), (40, 76), (88, 76)):
            c.ellipse(x, y, 5, 3.4, violet, 0.62)
            c.ring(x, y, 5.6, teal, 1.0, 0.6)
    elif mutation_id == "tipis":
        c.ring(64, 63, 39, (160, 255, 225), 2.0, 0.42)
        c.ring(64, 63, 34, white, 1.0, 0.28)
    elif mutation_id == "ledakan_dalam":
        c.ring(64, 78, 19, coral, 2.5, 0.75)
        c.ring(64, 78, 26, violet, 1.4, 0.5)
    elif mutation_id == "membran_ganda":
        c.ring(64, 63, 31, gold, 2.0, 0.85)
        c.ring(64, 63, 37, teal, 1.7, 0.6)
    elif mutation_id == "parasit":
        for x, y in ((50, 54), (77, 59), (57, 82)):
            c.blob(x, y, 5, violet, seed=x + y, lobes=4, wobble=0.12, alpha=0.62)
            c.circle(x, y, 1.2, coral, 0.8)
    elif mutation_id == "medan_pulsa":
        c.ring(64, 63, 27, teal, 2.2, 0.75)
        c.ring(64, 63, 36, teal, 1.5, 0.42)
    elif mutation_id == "regenerasi":
        for x, y in ((41, 53), (88, 54), (48, 86), (82, 86)):
            c.circle(x, y, 2.1, green, 0.8)
            c.circle(x - 0.6, y - 0.7, 0.7, white, 0.7)
    elif mutation_id == "cermin":
        c.ring(64, 63, 35, white, 1.5, 0.7)
        c.line(43, 39, 84, 88, white, 1.3, 0.42)
    elif mutation_id == "nova":
        c.star_spikes(64, 62, 29, gold, count=12, length=9, alpha=0.72, rot=0.1)
        c.ring(64, 62, 37, coral, 1.5, 0.5)
    elif mutation_id == "simbiosis":
        for a in (-1.6, 0.0, 1.6):
            x, y = 64 + math.cos(a) * 39, 63 + math.sin(a) * 31
            c.circle(x, y, 4.0, violet, 0.82)
            c.line(64, 63, x, y, teal, 1.1, 0.5)
    elif mutation_id == "evolusi_total":
        c.star_spikes(64, 62, 29, gold, count=8, length=12, alpha=0.82, rot=math.pi / 8)
        c.ring(64, 62, 39, (255, 248, 173), 2.0, 0.56)
    elif mutation_id == "rantai":
        pts = [(35, 49), (48, 66), (65, 50), (82, 67), (96, 50)]
        c.polyline(pts, gold, 2.4, 0.72)
        for x, y in pts:
            c.circle(x, y, 3.0, teal, 0.72)
    elif mutation_id == "adaptif":
        for x, y, col in ((40, 47, coral), (88, 48, violet), (41, 84, green), (88, 83, gold)):
            c.circle(x, y, 4.0, col, 0.65)
            c.ring(x, y, 5.5, teal, 0.9, 0.5)
    elif mutation_id == "medan_hidup":
        c.ring(64, 63, 37, green, 3.0, 0.72)
        c.ring(64, 63, 40, teal, 1.4, 0.4)
        c.circle(64, 63, 3.0, green, 0.7)
    return c


def write_png(canvas: Canvas, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(str(path))


def main():
    stages = []
    movement = []
    for stage, wave, slug in STAGES:
        entry = {"stage": stage, "wave": wave, "slug": slug, "states": {}}
        for state in STATES:
            rel = f"assets/sprites/mako_v2/mako_stage{stage}_{state}.png"
            write_png(draw_mako(stage, state), ROOT / rel)
            entry["states"][state] = rel
        stages.append(entry)

        for direction in DIRECTIONS:
            move_entry = {"stage": stage, "direction": direction, "states": {}}
            for move_state in MOVE_STATES:
                rel = f"assets/sprites/mako_v2/directions/mako_stage{stage}_{direction}_{move_state}.png"
                write_png(draw_mako(stage, "idle", direction=direction, locomotion=move_state), ROOT / rel)
                move_entry["states"][move_state] = rel
            movement.append(move_entry)

    mutations = []
    for mutation_id in MUTATIONS:
        rel = f"assets/sprites/mako_v2/mutations/mako_{mutation_id}.png"
        write_png(draw_mutation(mutation_id), ROOT / rel)
        mutations.append({"id": mutation_id, "path": rel})

    skins = []
    for skin_id in SKINS:
        rel = f"assets/sprites/mako_v2/skins/mako_{skin_id}_idle.png"
        write_png(draw_mako(0, "idle", skin=skin_id), ROOT / rel)
        skins.append({"id": skin_id, "path": rel})

    manifest = {
        "schemaVersion": 1,
        "heroId": "macrophage",
        "heroName": "Mako",
        "direction": "v2_belly_devourer",
        "movementDirections": list(DIRECTIONS),
        "movementStates": list(MOVE_STATES),
        "stages": stages,
        "movement": movement,
        "mutations": mutations,
        "skins": skins,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Generated Mako V2: {len(stages)} stages × {len(STATES)} states")
    print(f"Generated directional movement: {len(movement)} view entries × {len(MOVE_STATES)} states")
    print(f"Generated mutation overlays: {len(mutations)}")
    print(f"Generated skin previews: {len(skins)}")
    print(f"Manifest: {OUT / 'manifest.json'}")


if __name__ == "__main__":
    main()
