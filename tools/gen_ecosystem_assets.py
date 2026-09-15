#!/usr/bin/env python3
"""
gen_ecosystem_assets.py — Art Director asset ecosystem generator.

Generates deterministic additive assets for the post-pivot visual ecosystem:
- hero-as-tower pose frames under assets/heroes/towers/
- path-based pathogen readable variants under assets/enemies/path/
- organic colony building stage sprites under assets/buildings/
- JSON art specs under src/{characters,enemies,buildings}/data/

This does not overwrite legacy runtime sprites in assets/sprites/.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

import gen_sprites as base

ROOT = Path(__file__).resolve().parents[1]
HERO_TOWER_DIR = ROOT / "assets" / "heroes" / "towers"
ENEMY_PATH_DIR = ROOT / "assets" / "enemies" / "path"
BUILDING_DIR = ROOT / "assets" / "buildings"
SRC_CHAR_DIR = ROOT / "src" / "characters" / "data"
SRC_ENEMY_DIR = ROOT / "src" / "enemies" / "data"
SRC_BUILDING_DIR = ROOT / "src" / "buildings" / "data"

BUILDINGS = [
    {
        "id": "markas_sel",
        "name": "Markas Sel",
        "category": "inti",
        "base": "#38bfa7",
        "accent": "#fff3b0",
        "form": "nucleus_dome",
        "bioCue": "nucleus dome, colony membrane, capillary roots",
        "unlocks": ["tower_macrophage"],
    },
    {
        "id": "barak_sel",
        "name": "Barak Sel",
        "category": "militer",
        "base": "#ff9f43",
        "accent": "#72d66b",
        "form": "budding_pods",
        "bioCue": "budding immune-cell pods and granule ports",
        "unlocks": ["tower_neutrophil", "tower_eosinophil", "tower_tcd8"],
    },
    {
        "id": "pos_sinyal",
        "name": "Pos Sinyal Sitokin",
        "category": "dukungan",
        "base": "#4dd6ff",
        "accent": "#f1c40f",
        "form": "cytokine_beacon",
        "bioCue": "dendrite antenna, cytokine halo, signal vesicles",
        "unlocks": ["tower_tcd4", "tower_basophil", "tower_dendritic"],
    },
    {
        "id": "lab_membran",
        "name": "Lab Membran",
        "category": "pertahanan",
        "base": "#7b6ee6",
        "accent": "#80c7ff",
        "form": "membrane_shell",
        "bioCue": "layered membrane shell and shield valves",
        "unlocks": ["tower_mastcell"],
    },
    {
        "id": "pusat_riset",
        "name": "Pusat Riset Imun",
        "category": "riset",
        "base": "#bb8fce",
        "accent": "#ffd76a",
        "form": "organelle_lab",
        "bioCue": "research organelle, DNA ribbon, antibody motif",
        "unlocks": ["tower_bcell", "tower_dendritic", "tower_treg", "tower_nkcell"],
    },
    {
        "id": "menara_limfa",
        "name": "Menara Limfa",
        "category": "infrastruktur",
        "base": "#2ecc71",
        "accent": "#9be7ff",
        "form": "lymph_vessel",
        "bioCue": "lymph-vessel spire with organic valves",
        "unlocks": ["tower_nkcell"],
    },
    {
        "id": "monumen_imun",
        "name": "Monumen Imun",
        "category": "kosmetik",
        "base": "#ffe082",
        "accent": "#ffffff",
        "form": "antibody_pearl",
        "bioCue": "antibody-Y pearl monument on living membrane",
        "unlocks": [],
    },
]

TOWER_UNLOCKS = {
    "tower_macrophage": {"heroId": "macrophage", "source": ["markas_sel"], "rule": "default anchor"},
    "tower_neutrophil": {"heroId": "neutrophil", "source": ["barak_sel"], "rule": "barak_sel stage 1"},
    "tower_tcd4": {"heroId": "tcd4", "source": ["pos_sinyal"], "rule": "pos_sinyal stage 1"},
    "tower_eosinophil": {"heroId": "eosinophil", "source": ["barak_sel"], "rule": "barak_sel stage 2"},
    "tower_tcd8": {"heroId": "tcd8", "source": ["barak_sel"], "rule": "barak_sel stage 2"},
    "tower_basophil": {"heroId": "basophil", "source": ["pos_sinyal"], "rule": "pos_sinyal stage 2"},
    "tower_mastcell": {"heroId": "mastcell", "source": ["lab_membran"], "rule": "lab_membran stage 2"},
    "tower_bcell": {"heroId": "bcell", "source": ["pusat_riset"], "rule": "pusat_riset stage 1"},
    "tower_dendritic": {"heroId": "dendritic", "source": ["pos_sinyal", "pusat_riset"], "rule": "signal + research bridge"},
    "tower_treg": {"heroId": "treg", "source": ["pusat_riset"], "rule": "pusat_riset stage 2"},
    "tower_nkcell": {"heroId": "nkcell", "source": ["pusat_riset", "menara_limfa"], "rule": "mature research + lymph tower"},
}

ARCHETYPE_LABELS = {
    "phagocyte": "rooted engulfing pseudopodia",
    "dendritic": "radial sensor dendrites",
    "net": "anchored NET filament pad",
    "granule_lance": "static granule lance",
    "vesicle_cloud": "histamine vesicle sacs",
    "granule_tank": "membrane tank with degranulation valves",
    "cytotoxic": "perforin scanner lance",
    "helper": "cytokine command halo",
    "regulator": "tolerance shield mantle",
    "antibody": "BCR antenna and antibody-Y wings",
    "nk_spike": "stress-sensor crown and spike burst",
}

PATH_MARKERS = {
    "bacterium": "capsule division stripe",
    "armored_bacterium": "double membrane rim",
    "toxic_bacterium": "violet outer-membrane notch",
    "virus": "top spike glint",
    "parasite": "head marker and lane-aligned ruffle",
    "fungus": "chitin cap spot",
    "cancer": "red mutation nucleus",
    "protozoa": "lateral cilia comb",
    "toxin": "droplet bubble marker",
    "crystal": "bright protein-fold edge",
    "abnormal_cell": "unstable nucleus dot",
    "toxin_boss": "giant toxic membrane crest",
}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def ensure_dirs() -> None:
    for p in [HERO_TOWER_DIR, ENEMY_PATH_DIR, BUILDING_DIR, SRC_CHAR_DIR, SRC_ENEMY_DIR, SRC_BUILDING_DIR]:
        p.mkdir(parents=True, exist_ok=True)


def load_json(path: str):
    with open(ROOT / path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def color(value: str):
    return base.hex_rgb(value)


def tower_roots(c: base.Canvas, cx: float, cy: float, radius: float, main, accent, stage: int = 1):
    c.ellipse(cx, cy + radius * 0.53, radius * 1.04, radius * 0.28, (0, 0, 0), 0.14)
    c.ellipse(cx, cy + radius * 0.34, radius * 0.9, radius * 0.25, base.shade(main, 0.72), 0.34)
    c.ring(cx, cy + radius * 0.34, radius * 0.9, base.shade(main, 1.35), 2.2, 0.5)
    root_count = 5 + stage
    for i in range(root_count):
        a = -math.pi + math.tau * i / root_count
        x1 = cx + math.cos(a) * radius * 0.28
        y1 = cy + radius * 0.36 + math.sin(a) * radius * 0.08
        x2 = cx + math.cos(a) * radius * (0.82 + 0.06 * stage)
        y2 = cy + radius * (0.55 + 0.04 * (i % 2)) + abs(math.sin(a)) * radius * 0.28
        c.line(x1, y1, x2, y2, base.shade(main, 0.82), 2.0, 0.52)
        if i % 2 == 0:
            c.circle(x2, y2, 2.4, accent, 0.55)


def draw_archetype_cue(c: base.Canvas, archetype: str, cx: float, cy: float, r: float, main, accent, state: str):
    attack = state == "attack"
    upgrade = state == "upgrade"
    cue_alpha = 0.92 if not upgrade else 1.0
    if archetype == "antibody":
        for dx, rot in [(-22, -0.45), (22, 0.45)]:
            c.antibody_y(cx + dx, cy - 10, 30, accent, rot, 4.0, cue_alpha)
        if attack:
            c.antibody_y(cx + 34, cy - 30, 26, (255, 243, 176), 0.7, 3.4, 0.95)
    elif archetype == "phagocyte":
        c.line(cx - r * 0.55, cy + 4, cx - r * 1.04, cy - 18, accent, 6, 0.75)
        c.line(cx + r * 0.55, cy + 4, cx + r * 1.02, cy - 12, accent, 6, 0.75)
        if attack:
            c.ring(cx + r * 0.72, cy - 10, r * 0.36, accent, 4, 0.8)
    elif archetype == "dendritic":
        for i in range(8):
            a = math.tau * i / 8 + 0.18
            c.line(cx, cy - 4, cx + math.cos(a) * r * 1.05, cy - 4 + math.sin(a) * r * 0.86, accent, 3, 0.75)
            c.circle(cx + math.cos(a) * r * 1.05, cy - 4 + math.sin(a) * r * 0.86, 3.2, (255, 243, 176), 0.75)
    elif archetype == "net":
        for i in range(5):
            off = -24 + i * 12
            c.line(cx - 34, cy + off, cx + 34, cy - off * 0.25, accent, 1.8, 0.55)
            c.line(cx + off, cy - 30, cx - off * 0.25, cy + 30, (255, 255, 255), 1.2, 0.38)
        if attack:
            c.line(cx - 42, cy - 10, cx + 50, cy - 42, (255, 255, 255), 3.2, 0.8)
    elif archetype == "granule_lance":
        for i in range(5):
            c.circle(cx - 18 + i * 9, cy + 12 + (i % 2) * 5, 3.4, accent, 0.86)
        c.line(cx + 4, cy - 18, cx + (52 if attack else 32), cy - (46 if attack else 34), accent, 5.2, 0.88)
    elif archetype == "vesicle_cloud":
        for i in range(8):
            a = math.tau * i / 8
            c.circle(cx + math.cos(a) * r * 0.82, cy + math.sin(a) * r * 0.58, 4.6, accent, 0.7)
        if attack:
            for i in range(5):
                c.circle(cx + 34 + i * 5, cy - 18 - i * 3, 4.0, (255, 243, 176), 0.58)
    elif archetype == "granule_tank":
        c.ring(cx, cy, r * 0.76, accent, 4, 0.76)
        for i in range(6):
            a = math.tau * i / 6
            c.circle(cx + math.cos(a) * r * 0.58, cy + math.sin(a) * r * 0.48, 5.2, (255, 209, 90), 0.78)
    elif archetype == "cytotoxic":
        c.ring(cx, cy - 4, r * 0.76, accent, 2.8, 0.72)
        c.line(cx + 6, cy - 18, cx + (54 if attack else 34), cy - 36, (255, 255, 255), 4.2, 0.88)
        c.star_spikes(cx + (54 if attack else 34), cy - 36, 5.5, accent, 6, 6, 0.8)
    elif archetype == "helper":
        c.ring(cx, cy - r * 0.72, r * 0.55, accent, 3.2, 0.78)
        c.line(cx, cy - 6, cx, cy - r * 1.25, accent, 2.8, 0.58)
        if attack:
            c.ring(cx + 40, cy - 30, 16, (255, 243, 176), 2.4, 0.7)
    elif archetype == "regulator":
        c.polygon([(cx, cy - r * 0.98), (cx + r * 0.72, cy - r * 0.32), (cx + r * 0.42, cy + r * 0.64), (cx, cy + r * 0.92), (cx - r * 0.42, cy + r * 0.64), (cx - r * 0.72, cy - r * 0.32)], accent, 0.22)
        c.ring(cx, cy, r * 0.78, accent, 3, 0.68)
    elif archetype == "nk_spike":
        c.star_spikes(cx, cy, r * 0.74, accent, 11, 11 if attack else 7, 0.72, rot=0.08)
        c.ring(cx, cy - r * 0.76, r * 0.38, (255, 243, 176), 2.6, 0.64)
    if upgrade:
        c.ring(cx, cy, r * 1.18, (255, 224, 130), 4.5, 0.72)
        c.ring(cx, cy, r * 1.38, accent, 2.4, 0.46)
        for i in range(10):
            a = math.tau * i / 10
            c.circle(cx + math.cos(a) * r * 1.22, cy + math.sin(a) * r * 1.02, 3.4, (255, 255, 255), 0.56)


def draw_tower_hero(hero: dict, design: dict, state: str) -> base.Canvas:
    c = base.Canvas(128)
    cx, cy = 64, 66
    r = 30
    main = color(hero.get("color", "#35d0ba"))
    accent_hex = (design.get("equity") or [{}])[-1].get("color", hero.get("color", "#35d0ba"))
    accent = color(accent_hex)
    tower_roots(c, cx, cy, r, main, accent, 2 if state == "upgrade" else 1)
    if state == "attack":
        cx += 2
        cy -= 1
    base.body(c, cx, cy, r, hero.get("color", "#35d0ba"), seed=sum(map(ord, hero["id"])), sx=1.02, sy=0.96, wobble=0.08)
    nucleus_kind = "segmented" if hero["id"] == "neutrophil" else "crescent" if hero["id"] in {"bcell", "nkcell"} else "single"
    base.nucleus(c, cx, cy - 2, 18, base.shade(main, 0.55), nucleus_kind)
    base.eyes(c, cx, cy - 12, aggressive=state == "attack")
    draw_archetype_cue(c, design.get("archetype", "generic"), cx, cy, r, main, accent, state)
    return c


def draw_building(b: dict, stage: int) -> base.Canvas:
    c = base.Canvas(192)
    cx, cy = 96, 105
    main = color(b["base"])
    accent = color(b["accent"])
    scale = [0.74, 0.94, 1.12][stage - 1]
    r = 42 * scale
    # Shared living pad/root system.
    c.ellipse(cx, cy + 42, 62 * scale, 16 * scale, (0, 0, 0), 0.16)
    c.ellipse(cx, cy + 30, 56 * scale, 18 * scale, base.shade(main, 0.72), 0.28)
    for i in range(4 + stage):
        a = math.pi + math.tau * i / (4 + stage)
        x2 = cx + math.cos(a) * (48 + 8 * stage)
        y2 = cy + 38 + abs(math.sin(a)) * (22 + 3 * stage)
        c.line(cx + math.cos(a) * 16, cy + 24, x2, y2, base.shade(main, 0.78), 3.0, 0.48)
        c.circle(x2, y2, 3.5, accent, 0.45)

    form = b["form"]
    if form == "nucleus_dome":
        c.radial_ellipse(cx - 8, cy - 8, r * 0.98, r * 0.74, base.shade(main, 1.55), main, steps=32)
        c.ring(cx, cy - 4, r * 0.92, accent, 4.0, 0.76)
        c.circle(cx, cy - 7, 17 * scale, base.shade(main, 0.46), 0.82)
        if stage >= 2:
            c.ring(cx, cy - 8, 29 * scale, (255, 255, 255), 2.2, 0.46)
        if stage >= 3:
            c.star_spikes(cx, cy - 38, 9, accent, 10, 10, 0.62)
    elif form == "budding_pods":
        for i in range(3 + stage):
            a = math.tau * i / (3 + stage) - 0.3
            px = cx + math.cos(a) * r * 0.55
            py = cy + math.sin(a) * r * 0.38
            c.radial_ellipse(px - 4, py - 5, 20 * scale, 16 * scale, base.shade(main, 1.45), main, steps=20)
            c.ring(px, py, 18 * scale, base.shade(main, 0.58), 2.4, 0.72)
            c.circle(px, py, 5.5 * scale, accent, 0.74)
        c.ring(cx, cy, r * 0.84, accent, 2.8, 0.58)
    elif form == "cytokine_beacon":
        c.radial_ellipse(cx - 6, cy + 6, r * 0.66, r * 0.74, base.shade(main, 1.45), main, steps=26)
        for i in range(5 + stage):
            a = -math.pi * 0.95 + math.pi * 1.9 * i / (4 + stage)
            c.line(cx, cy - 6, cx + math.cos(a) * r * 1.05, cy - 10 + math.sin(a) * r * 0.9, main, 3.0, 0.72)
            c.circle(cx + math.cos(a) * r * 1.05, cy - 10 + math.sin(a) * r * 0.9, 4.2, accent, 0.82)
        c.ring(cx, cy - r * 0.72, 14 + stage * 6, accent, 3, 0.64)
    elif form == "membrane_shell":
        for k in range(3):
            c.ring(cx, cy - 3, r * (0.56 + k * 0.18), base.shade(main, 1.22 - k * 0.08), 4.0, 0.58)
        c.radial_ellipse(cx - 5, cy, r * 0.72, r * 0.62, base.shade(main, 1.42), main, steps=24, alpha=0.72)
        for i in range(4 + stage):
            a = math.tau * i / (4 + stage)
            c.circle(cx + math.cos(a) * r * 0.68, cy + math.sin(a) * r * 0.52, 5 * scale, accent, 0.72)
    elif form == "organelle_lab":
        c.radial_ellipse(cx - 8, cy - 4, r * 0.86, r * 0.72, base.shade(main, 1.48), main, steps=28)
        for i in range(2 + stage):
            y = cy - 24 + i * 16
            c.line(cx - 36 * scale, y, cx + 36 * scale, y + 9 * math.sin(i), accent, 2.4, 0.62)
            c.line(cx - 30 * scale, y + 9, cx + 30 * scale, y - 5 * math.sin(i + 1), (255, 255, 255), 1.5, 0.4)
        c.antibody_y(cx + 18, cy - 10, 34 * scale, accent, 0.3, 4.0, 0.78)
    elif form == "lymph_vessel":
        c.ellipse(cx, cy + 8, 22 * scale, 55 * scale, main, 0.82)
        c.ring(cx, cy - 6, 28 * scale, accent, 3.4, 0.62)
        for i in range(3 + stage):
            yy = cy + 35 - i * 24 * scale
            c.line(cx - 18 * scale, yy, cx + 18 * scale, yy - 8, accent, 3.0, 0.7)
        c.circle(cx, cy - 52 * scale, 10 + stage * 3, (255, 255, 255), 0.46)
        c.circle(cx, cy - 52 * scale, 6 + stage * 2, accent, 0.75)
    elif form == "antibody_pearl":
        c.radial_ellipse(cx - 5, cy + 5, r * 0.7, r * 0.58, base.shade(main, 1.35), main, steps=26, alpha=0.8)
        c.antibody_y(cx, cy - 10, 62 * scale, accent, 0, 7.0, 0.86)
        c.ring(cx, cy - 6, r * 0.74, accent, 4, 0.48)
        if stage >= 2:
            c.star_spikes(cx, cy - 50 * scale, 8, (255, 255, 255), 8, 7, 0.55)
    # universal wet highlights
    c.circle(cx - r * 0.25, cy - r * 0.32, 5 + stage, (255, 255, 255), 0.38)
    c.ring(cx, cy, r * 0.95, base.shade(main, 0.48), 3.2, 0.45)
    return c


def draw_path_enemy(enemy: dict) -> base.Canvas:
    size = 256 if enemy.get("isBoss") or enemy.get("tier") == "boss" or enemy.get("radius", 0) >= 38 else 128
    kind = enemy.get("visualFamily") or "bacterium"
    c = base.draw_enemy(kind, enemy.get("color", "#ff6b6b"), size=size, attack=False)
    cx = cy = size / 2
    scale = size / 128
    main = color(enemy.get("color", "#ff6b6b"))
    accent = (255, 243, 176)
    # Lane readability overlay: subtle belly shadow + dorsal marker.
    c.ellipse(cx, cy + 39 * scale, 41 * scale, 9 * scale, (0, 0, 0), 0.18)
    if kind in {"bacterium", "armored_bacterium", "toxic_bacterium"}:
        c.line(cx - 24 * scale, cy - 10 * scale, cx + 24 * scale, cy + 10 * scale, accent, 3.2 * scale, 0.58)
        if kind != "bacterium":
            c.ring(cx, cy, 33 * scale, base.shade(main, 0.48), 3.0 * scale, 0.58)
    elif kind == "virus":
        c.star_spikes(cx, cy, 29 * scale, accent, 10, 5 * scale, 0.38)
        c.circle(cx - 8 * scale, cy - 10 * scale, 4.5 * scale, accent, 0.62)
    elif kind == "parasite":
        c.circle(cx + 24 * scale, cy - 11 * scale, 5 * scale, accent, 0.68)
        c.line(cx - 32 * scale, cy + 12 * scale, cx + 38 * scale, cy + 8 * scale, base.shade(main, 1.45), 2.2 * scale, 0.48)
    elif kind == "fungus":
        c.circle(cx, cy - 24 * scale, 7 * scale, accent, 0.72)
        c.circle(cx - 14 * scale, cy - 13 * scale, 4.4 * scale, (255, 255, 255), 0.48)
    elif kind in {"cancer", "abnormal_cell"}:
        c.circle(cx, cy, 10 * scale, (255, 93, 115), 0.7)
        c.ring(cx, cy, 37 * scale, (255, 93, 115), 3.2 * scale, 0.5)
    elif kind == "protozoa":
        for i in range(6):
            yy = cy - 24 * scale + i * 9 * scale
            c.line(cx - 41 * scale, yy, cx - 53 * scale, yy + (3 if i % 2 else -3) * scale, accent, 1.8 * scale, 0.48)
            c.line(cx + 41 * scale, yy, cx + 53 * scale, yy - (3 if i % 2 else -3) * scale, accent, 1.8 * scale, 0.48)
    elif kind in {"toxin", "toxin_boss"}:
        for i in range(5 if kind == "toxin" else 9):
            a = math.tau * i / (5 if kind == "toxin" else 9)
            c.circle(cx + math.cos(a) * 30 * scale, cy + math.sin(a) * 23 * scale, 4.2 * scale, accent, 0.46)
        c.ring(cx, cy, 35 * scale, base.shade(main, 1.35), 2.5 * scale, 0.55)
    elif kind == "crystal":
        c.line(cx - 24 * scale, cy + 22 * scale, cx + 27 * scale, cy - 30 * scale, accent, 3.0 * scale, 0.62)
    else:
        c.circle(cx, cy - 18 * scale, 5 * scale, accent, 0.62)
    return c


def write_specs(heroes: list[dict], designs: dict, enemies: list[dict]):
    hero_items = []
    for hero in heroes:
        d = designs.get(hero["id"], {})
        tower_id = next((tid for tid, info in TOWER_UNLOCKS.items() if info["heroId"] == hero["id"]), f"tower_{hero['id']}")
        hero_items.append({
            "heroId": hero["id"],
            "towerId": tower_id,
            "name": hero.get("name", hero["id"]),
            "sourceColor": hero.get("color"),
            "archetype": d.get("archetype", "generic"),
            "identityRule": ARCHETYPE_LABELS.get(d.get("archetype"), "immune-cell tower"),
            "legacySprites": {
                "idle": hero.get("spriteIdle") or hero.get("sprite"),
                "attack": hero.get("spriteAttack"),
                "portrait": hero.get("portrait"),
            },
            "towerSprites": {
                "idle": f"assets/heroes/towers/{hero['id']}_tower_idle.png",
                "attack": f"assets/heroes/towers/{hero['id']}_tower_attack.png",
                "upgrade": f"assets/heroes/towers/{hero['id']}_tower_upgrade.png",
            },
            "animation": {
                "idle": "rooted breathing 2-4% scale; no locomotion",
                "attack": "upper biological cue leans/fires toward lane while root base stays fixed",
                "upgrade": "cytokine/equity bloom at anchor, then settle back to idle",
            },
            "biologicalCueMinimum": (d.get("equity") or [{}])[-1].get("visualCue") or d.get("baseCue"),
        })
    (SRC_CHAR_DIR / "hero-tower-poses.json").write_text(json.dumps({
        "schemaVersion": 1,
        "doc": "Art Director post-pivot hero-as-tower pose spec. Additive assets only; does not replace legacy survival sprites until pivot runtime consumes these paths.",
        "artBible": "assets/ART_BIBLE.md",
        "migrationReference": "src/core/MIGRATION_BRIEF.md",
        "items": hero_items,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    enemy_items = []
    for enemy in enemies:
        fam = enemy.get("visualFamily") or enemy["id"]
        enemy_items.append({
            "enemyId": enemy["id"],
            "name": enemy.get("name", enemy["id"]),
            "family": fam,
            "sourceColor": enemy.get("color"),
            "legacySprite": enemy.get("spriteIdle") or enemy.get("sprite"),
            "pathSprite": f"assets/enemies/path/{enemy['id']}_path.png",
            "pathReadability": {
                "stackMarker": PATH_MARKERS.get(fam, "dorsal highlight marker"),
                "laneFootprint": "keep appendages within ~0.35 body radius from lane centerline",
                "queueRule": "alternate slight rotation/offset in renderer; do not scale below 32px without rim",
            },
            "biologicalCueMinimum": PATH_MARKERS.get(fam, "visible hostile biological marker"),
        })
    (SRC_ENEMY_DIR / "pathogen-path-style.json").write_text(json.dumps({
        "schemaVersion": 1,
        "doc": "Art Director path-based pathogen visual spec for narrow lane swarms and queues.",
        "artBible": "assets/ART_BIBLE.md",
        "items": enemy_items,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    building_items = []
    for b in BUILDINGS:
        building_items.append({
            "buildingId": b["id"],
            "name": b["name"],
            "category": b["category"],
            "palette": {"base": b["base"], "accent": b["accent"]},
            "visualMetaphor": b["bioCue"],
            "sprites": {
                "stage1": f"assets/buildings/{b['id']}_stage1.png",
                "stage2": f"assets/buildings/{b['id']}_stage2.png",
                "stage3": f"assets/buildings/{b['id']}_stage3.png",
            },
            "growthRule": [
                "stage1 bud: small living membrane + one function cue",
                "stage2 growing: roots and organelles extend",
                "stage3 mature: full silhouette + extra ring/valve/beacon",
            ],
            "coveredTowerUnlocks": b["unlocks"],
        })
    (SRC_BUILDING_DIR / "colony-buildings-art.json").write_text(json.dumps({
        "schemaVersion": 1,
        "doc": "Art Director colony building asset spec aligned to Agent 8 building ids and tower unlock linkage.",
        "artBible": "assets/ART_BIBLE.md",
        "migrationReference": "src/core/MIGRATION_BRIEF.md",
        "towerUnlockCoverage": TOWER_UNLOCKS,
        "items": building_items,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ensure_dirs()
    heroes = load_json("data/heroes.json")["heroes"]
    designs = load_json("data/character-designs.json")["heroes"]
    enemies = load_json("data/enemies.json")["enemies"]

    generated = 0
    for hero in heroes:
        d = designs.get(hero["id"], {})
        for state in ["idle", "attack", "upgrade"]:
            draw_tower_hero(hero, d, state).save(HERO_TOWER_DIR / f"{hero['id']}_tower_{state}.png")
            generated += 1

    for enemy in enemies:
        draw_path_enemy(enemy).save(ENEMY_PATH_DIR / f"{enemy['id']}_path.png")
        generated += 1

    for b in BUILDINGS:
        for stage in [1, 2, 3]:
            draw_building(b, stage).save(BUILDING_DIR / f"{b['id']}_stage{stage}.png")
            generated += 1

    write_specs(heroes, designs, enemies)
    print(f"Generated {generated} ecosystem asset PNGs + 3 art spec JSON files.")


if __name__ == "__main__":
    main()
