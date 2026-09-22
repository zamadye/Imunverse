#!/usr/bin/env python3
"""PHAGOS World — generator data-driven (ATURAN 6: semua layout di JSON).

Menghasilkan SELURUH dunia dari satu sumber deterministik (seed tetap):
  data/zones/<zone>.json        8 zona, 46 ruangan, layout per ruangan
  data/world_map.json           node organ, edge koridor, gate, fast travel
  scenes/zones/<z>/rooms/*.tscn 46 PackedScene ruangan (instance Room.tscn)
  assets/tilesets/<zone>.png    8 atlas tileset preview per biome (256x256)

Jalankan ulang kapan pun (idempoten):
  python3 tools/gen_world.py        # dari godot/phagos/

Total ruangan: 4+5+5+6+5+6+7+8 = 46.
"""
import json, math, os, random, struct, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILE = 64
SEED = 20260922  # deterministik: dunia yang sama setiap generate

# ---------------------------------------------------------------- zona ----
# size preset (tile): combat kecil/besar, boss, koridor, shop, reward, hazard, shortcut, preboss
SIZE = {
    "combat_s": (20, 15), "combat_b": (30, 22), "boss": (35, 28),
    "corridor": (8, 30), "shop": (15, 12), "reward": (16, 12),
    "hazard": (24, 18), "shortcut": (12, 20), "preboss": (18, 14),
}

# rooms: (key, type, size_preset, [connections])
ZONES = [
    {"id": "usus_besar", "name": "Usus Besar", "difficulty": 1,
     "boss_id": "biofilm_colony", "music_key": "usus_besar",
     "ambient_color": "#8B4557", "hazards": ["peristaltic_wave", "mucus_pool"],
     "enemies": ["bakteri", "spora"], "wow": "peristaltic_tunnel",
     "palette": {"main": "#8B4557", "accent": "#7CB68E", "floor": "#6E3547",
                 "wall": "#4A2030", "deep": "#2A0F1A", "glow": "#9FE8B8",
                 "particle": "#B8E6C4", "fog": "#3A1A24"},
     "rooms": [("ub_combat_01", "combat", "combat_s", ["ub_combat_02"]),
               ("ub_combat_02", "combat", "combat_b", ["ub_reward_01", "ub_boss"]),
               ("ub_reward_01", "reward", "reward", []),
               ("ub_boss", "boss", "boss", [])],
     "entry_room": "ub_combat_01"},
    {"id": "usus_halus", "name": "Usus Halus", "difficulty": 1,
     "boss_id": "tapeworm_giant", "music_key": "usus_halus",
     "ambient_color": "#E8889E", "hazards": ["villi_drain", "chyme_current"],
     "enemies": ["parasit", "bakteri_cepat"], "wow": "nutrient_rain",
     "palette": {"main": "#E8889E", "accent": "#F5C64F", "floor": "#B85F74",
                 "wall": "#7A3049", "deep": "#3A1220", "glow": "#FFE08A",
                 "particle": "#FFD98A", "fog": "#4A1E2C"},
     "rooms": [("uh_combat_01", "combat", "combat_s", ["uh_combat_02"]),
               ("uh_combat_02", "combat", "combat_b", ["uh_combat_03", "uh_reward_01"]),
               ("uh_combat_03", "combat", "combat_b", ["uh_boss"]),
               ("uh_reward_01", "reward", "reward", []),
               ("uh_boss", "boss", "boss", [])],
     "entry_room": "uh_combat_01"},
    {"id": "ginjal", "name": "Ginjal", "difficulty": 2,
     "boss_id": "kidney_stone", "music_key": "ginjal",
     "ambient_color": "#4A90D9", "hazards": ["filtration_current", "sharp_crystal", "ph_zone"],
     "enemies": ["toksin", "bakteri_tanky"], "wow": "crystal_cavern",
     "palette": {"main": "#4A90D9", "accent": "#E8E8F0", "floor": "#2E5E8E",
                 "wall": "#1B3A5E", "deep": "#0B1A30", "glow": "#BFE3FF",
                 "particle": "#CFEAFF", "fog": "#14283E"},
     "rooms": [("gj_combat_01", "combat", "combat_s", ["gj_combat_02"]),
               ("gj_combat_02", "combat", "combat_b", ["gj_shop_01"]),
               ("gj_shop_01", "shop", "shop", ["gj_combat_03"]),
               ("gj_combat_03", "combat", "combat_b", ["gj_boss"]),
               ("gj_boss", "boss", "boss", [])],
     "entry_room": "gj_combat_01"},
    {"id": "lambung", "name": "Lambung", "difficulty": 2,
     "boss_id": "ulcer_living", "music_key": "lambung",
     "ambient_color": "#A6B12E", "hazards": ["acid_pool", "acid_vapor", "contraction"],
     "enemies": ["parasit", "hpylori"], "wow": "acid_tide",
     "palette": {"main": "#A6B12E", "accent": "#C0392B", "floor": "#6E7520",
                 "wall": "#454A14", "deep": "#20230A", "glow": "#D8F34E",
                 "particle": "#E2F47A", "fog": "#2E3312"},
     "rooms": [("lb_combat_01", "combat", "combat_s", ["lb_combat_02"]),
               ("lb_combat_02", "combat", "combat_b", ["lb_reward_01", "lb_shop_01"]),
               ("lb_reward_01", "reward", "reward", []),
               ("lb_shop_01", "shop", "shop", ["lb_combat_03"]),
               ("lb_combat_03", "combat", "combat_b", ["lb_boss"]),
               ("lb_boss", "boss", "boss", [])],
     "entry_room": "lb_combat_01"},
    {"id": "pankreas", "name": "Pankreas", "difficulty": 3,
     "boss_id": "pancreatitis", "music_key": "pankreas",
     "ambient_color": "#D4B896", "hazards": ["enzyme_pool", "narrow_channel", "islet_cells"],
     "enemies": ["virus", "sel_abnormal"], "wow": "islet_constellation",
     "palette": {"main": "#D4B896", "accent": "#5DADE2", "floor": "#9A7E58",
                 "wall": "#5E4A30", "deep": "#2E2415", "glow": "#AEE3FF",
                 "particle": "#C9ECFF", "fog": "#3A2E1C"},
     "rooms": [("pk_combat_01", "combat", "combat_s", ["pk_puzzle_01"]),
               ("pk_puzzle_01", "hazard", "hazard", ["pk_combat_02"]),
               ("pk_combat_02", "combat", "combat_b", ["pk_shop_01"]),
               ("pk_shop_01", "shop", "shop", ["pk_boss"]),
               ("pk_boss", "boss", "boss", [])],
     "entry_room": "pk_combat_01"},
    {"id": "hati", "name": "Hati", "difficulty": 4,
     "boss_id": "cirrhosis", "music_key": "hati",
     "ambient_color": "#6B2D2D", "hazards": ["toxin_fog", "kupffer_cells", "bile_channel"],
     "enemies": ["toksin", "virus_hepatitis"], "wow": "kupffer_patrol",
     "palette": {"main": "#6B2D2D", "accent": "#D4AC0D", "floor": "#522222",
                 "wall": "#331414", "deep": "#180808", "glow": "#F2D24B",
                 "particle": "#E8D27A", "fog": "#2A1410"},
     "rooms": [("ht_combat_01", "combat", "combat_s", ["ht_combat_02"]),
               ("ht_combat_02", "combat", "combat_b", ["ht_hazard_01", "ht_reward_01"]),
               ("ht_hazard_01", "hazard", "hazard", ["ht_combat_03"]),
               ("ht_combat_03", "combat", "combat_b", ["ht_boss"]),
               ("ht_reward_01", "reward", "reward", []),
               ("ht_boss", "boss", "boss", [])],
     "entry_room": "ht_combat_01"},
    {"id": "paru", "name": "Paru-paru", "difficulty": 4,
     "boss_id": "pneumonia", "music_key": "paru",
     "ambient_color": "#F5B7B1", "hazards": ["air_flow", "mucus_buildup", "fragile_wall"],
     "enemies": ["virus_influenza", "bakteri_tb"], "wow": "alveolar_window",
     "palette": {"main": "#F5B7B1", "accent": "#85C1E9", "floor": "#C08A86",
                 "wall": "#7E4E4C", "deep": "#3A2020", "glow": "#D6ECFF",
                 "particle": "#E4F2FF", "fog": "#4A2A2A"},
     "rooms": [("pr_combat_01", "combat", "combat_s", ["pr_combat_02", "pr_shortcut_01"]),
               ("pr_combat_02", "combat", "combat_b", ["pr_combat_03", "pr_reward_01"]),
               ("pr_combat_03", "combat", "combat_b", ["pr_combat_04"]),
               ("pr_combat_04", "combat", "combat_b", ["pr_boss"]),
               ("pr_shortcut_01", "shortcut", "shortcut", ["pr_combat_03"]),
               ("pr_reward_01", "reward", "reward", []),
               ("pr_boss", "boss", "boss", [])],
     "entry_room": "pr_combat_01"},
    {"id": "jantung", "name": "Jantung", "difficulty": 5,
     "boss_id": "endocarditis", "music_key": "jantung",
     "ambient_color": "#E74C3C", "hazards": ["heartbeat", "blood_current", "valve_gate"],
     "enemies": ["semua", "sel_kanker"], "wow": "great_valve",
     "palette": {"main": "#E74C3C", "accent": "#2E86C1", "floor": "#A93226",
                 "wall": "#641E16", "deep": "#2E0B08", "glow": "#FFB3A7",
                 "particle": "#FFC4B8", "fog": "#3A0F0C"},
     "rooms": [("jn_combat_01", "combat", "combat_b", ["jn_corridor_01"]),
               ("jn_corridor_01", "corridor", "corridor", ["jn_combat_02"]),
               ("jn_combat_02", "combat", "combat_b", ["jn_combat_03"]),
               ("jn_combat_03", "combat", "combat_b", ["jn_corridor_02"]),
               ("jn_corridor_02", "corridor", "corridor", ["jn_combat_04"]),
               ("jn_combat_04", "combat", "combat_b", ["jn_preboss_01"]),
               ("jn_preboss_01", "preboss", "preboss", ["jn_boss"]),
               ("jn_boss", "boss", "boss", [])],
     "entry_room": "jn_combat_01"},
]

ROOM_SCENE = "res://scenes/zones/{z}/rooms/{r}.tscn"

# --------------------------------------------------------------- util -----
def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])

# ------------------------------------------------------- layout rooms -----
MARGIN = 110  #px dinding + padding

def door_slots(w_px, h_px, n_out):
    """Pintu masuk di Selatan; pintu keluar N/E/W bergantian."""
    slots = [{"dir": "S", "pos": [w_px // 2, h_px - TILE // 2]}]
    outs = ["N", "E", "W", "N2"]
    for i in range(n_out):
        d = outs[i % len(outs)]
        if d == "N":
            slots.append({"dir": "N", "pos": [w_px // 2 - 160 + i * 120, TILE // 2]})
        elif d == "E":
            slots.append({"dir": "E", "pos": [w_px - TILE // 2, h_px // 2 - 120 + i * 60]})
        elif d == "W":
            slots.append({"dir": "W", "pos": [TILE // 2, h_px // 2 - 120 + i * 60]})
        else:
            slots.append({"dir": "N", "pos": [w_px // 2 + 220, TILE // 2]})
    return slots

def scatter(rng, w_px, h_px, n, avoid, min_sep=170, tries=60):
    pts = []
    for _ in range(n):
        for _ in range(tries):
            p = [rng.randint(MARGIN, w_px - MARGIN), rng.randint(MARGIN, h_px - MARGIN)]
            if all(dist(p, a) >= min_sep for a in avoid + pts):
                pts.append(p)
                break
        else:
            pts.append([rng.randint(MARGIN, w_px - MARGIN), rng.randint(MARGIN, h_px - MARGIN)])
    return pts

def clear_of(rect, pts, pad=60):
    x, y, w, h = rect
    return all(not (x - pad <= p[0] <= x + w + pad and y - pad <= p[1] <= y + h + pad) for p in pts)

# ------------------------------------------------------------- hazard -----
def hazards_for(zone_id, rng, room, w_px, h_px, entry, doors):
    outs, H = [], []
    def hz(h):
        h["affects"] = ["hero", "enemy"]  # ATURAN 2: hazard melukai SEMUA
        H.append(h)
    if zone_id == "usus_besar":
        for _ in range(rng.randint(1, 2)):
            w, h = rng.randint(160, 320), rng.randint(140, 260)
            for _ in range(20):
                r = [rng.randint(MARGIN, w_px - MARGIN - w), rng.randint(MARGIN, h_px - MARGIN - h), w, h]
                if clear_of(r, [entry] + [d["pos"] for d in doors]): break
            hz({"type": "mucus_pool", "mode": "slow", "rect": r,
                "params": {"slow": 0.4, "color": "#7CB68E"}})
    elif zone_id == "usus_halus":
        for _ in range(rng.randint(1, 2)):
            w, h = rng.randint(140, 260), rng.randint(140, 260)
            for _ in range(20):
                r = [rng.randint(MARGIN, w_px - MARGIN - w), rng.randint(MARGIN, h_px - MARGIN - h), w, h]
                if clear_of(r, [entry] + [d["pos"] for d in doors]): break
            hz({"type": "villi_drain", "mode": "drain_pct", "rect": r,
                "params": {"pct": 0.03, "color": "#F5C64F"}})
        if room["type"] in ("combat", "boss"):
            vert = rng.random() < 0.5
            r = [MARGIN, rng.randint(MARGIN, h_px - MARGIN - 160), w_px - 2 * MARGIN, 150] if vert \
                else [rng.randint(MARGIN, w_px - MARGIN - 160), MARGIN, 150, h_px - 2 * MARGIN]
            hz({"type": "chyme_current", "mode": "current", "rect": r,
                "params": {"dir": [1, 0] if vert else [0, 1], "strength": 260.0}})
    elif zone_id == "ginjal":
        if room["type"] in ("combat", "boss"):
            vert = rng.random() < 0.5
            r = [MARGIN, rng.randint(MARGIN, h_px - MARGIN - 130), w_px - 2 * MARGIN, 120] if vert \
                else [rng.randint(MARGIN, w_px - MARGIN - 130), MARGIN, 120, h_px - 2 * MARGIN]
            hz({"type": "filtration_current", "mode": "current", "rect": r,
                "params": {"dir": [-1, 0] if vert else [0, -1], "strength": 340.0}})
        for p in scatter(rng, w_px, h_px, rng.randint(1, 3), [entry], 220):
            hz({"type": "sharp_crystal", "mode": "crystal", "rect": [p[0] - 40, p[1] - 40, 80, 80],
                "params": {"dps": 12.0, "hp": 3, "drop": 5, "color": "#E8E8F0"}})
        if rng.random() < 0.7:
            w, h = rng.randint(180, 300), rng.randint(160, 260)
            for _ in range(20):
                r = [rng.randint(MARGIN, w_px - MARGIN - w), rng.randint(MARGIN, h_px - MARGIN - h), w, h]
                if clear_of(r, [entry] + [d["pos"] for d in doors]): break
            hz({"type": "ph_zone", "mode": "ph_cycle", "rect": r,
                "params": {"period": 6.0, "acid_dps": 10.0, "base_heal": 6.0}})
    elif zone_id == "lambung":
        tide_h = int(h_px * rng.uniform(0.22, 0.36))  # pintu S/entry tetap bisa dijangkau
        hz({"type": "acid_pool", "mode": "tide", "rect": [MARGIN, h_px - MARGIN - tide_h, w_px - 2 * MARGIN, tide_h],
            "params": {"dps": 14.0, "period": 9.0, "rise": 0.55, "color": "#A6B12E"}})
        for p in scatter(rng, w_px, h_px, rng.randint(1, 2), [entry], 260):
            hz({"type": "acid_vapor", "mode": "vapor", "rect": [p[0] - 45, MARGIN, 90, h_px - 2 * MARGIN],
                "params": {"dps": 8.0, "color": "#C6D42E"}})
    elif zone_id == "pankreas":
        for p in scatter(rng, w_px, h_px, rng.randint(1, 2), [entry], 280):
            hz({"type": "enzyme_pool", "mode": "damage", "rect": [p[0] - 70, p[1] - 70, 140, 140],
                "params": {"dps": 22.0, "color": "#BFEFFF"}})
        for p in scatter(rng, w_px, h_px, rng.randint(1, 2), [entry], 300):
            hz({"type": "islet_cell", "mode": "islet", "rect": [p[0] - 34, p[1] - 34, 68, 68],
                "params": {"hp": 4, "slow": 0.6, "duration": 3.0, "radius": 260.0, "color": "#5DADE2"}})
    elif zone_id == "hati":
        w, h = rng.randint(260, 420), rng.randint(220, 340)
        for _ in range(20):
            r = [rng.randint(MARGIN, w_px - MARGIN - w), rng.randint(MARGIN, h_px - MARGIN - h), w, h]
            if clear_of(r, [entry] + [d["pos"] for d in doors]): break
        hz({"type": "toxin_fog", "mode": "fog", "rect": r,
            "params": {"dps": 4.0, "slow": 0.15, "clear_sec": 3.0, "color": "#9AA12E"}})
        cx, cy = w_px // 2, h_px // 2
        patrol = [[cx - 220, cy], [cx, cy - 150], [cx + 220, cy], [cx, cy + 150]]
        hz({"type": "kupffer_cell", "mode": "kupffer",
            "rect": [patrol[0][0] - 30, patrol[0][1] - 30, 60, 60],
            "params": {"patrol": patrol, "speed": 90.0, "dps": 15.0, "radius": 70.0}})
        if room["type"] in ("combat", "boss"):
            hz({"type": "bile_channel", "mode": "slippery",
                "rect": [MARGIN, h_px // 2 - 70, w_px - 2 * MARGIN, 140],
                "params": {"friction": 0.08, "color": "#D4AC0D"}})
    elif zone_id == "paru":
        hz({"type": "air_flow", "mode": "air", "rect": [MARGIN, MARGIN, w_px - 2 * MARGIN, h_px - 2 * MARGIN],
            "params": {"strength": 220.0, "flip_sec": 5.0}})
        for p in scatter(rng, w_px, h_px, rng.randint(1, 2), [entry], 280):
            hz({"type": "mucus_buildup", "mode": "buildup", "rect": [p[0] - 90, p[1] - 90, 180, 180],
                "params": {"max_slow": 0.6, "rate": 0.25, "color": "#C9A9A9"}})
        if room["type"] == "shortcut":
            hz({"type": "fragile_wall", "mode": "fragile",
                "rect": [w_px // 2 - 60, TILE, 120, 90],
                "params": {"hp": 2, "color": "#F5D7D7"}})
    elif zone_id == "jantung":
        if room["type"] == "corridor":
            hz({"type": "blood_current", "mode": "current",
                "rect": [MARGIN, MARGIN, w_px - 2 * MARGIN, h_px - 2 * MARGIN],
                "params": {"dir": [0, -1], "strength": 420.0}})
            my = h_px // 2
            hz({"type": "valve_gate", "mode": "valve",
                "rect": [MARGIN, my - 26, w_px - 2 * MARGIN, 52],
                "params": {"period": 4.0, "open_sec": 2.2}})
        else:
            hz({"type": "heartbeat_wave", "mode": "beat_push",
                "rect": [MARGIN, MARGIN, w_px - 2 * MARGIN, h_px - 2 * MARGIN],
                "params": {"period": 1.0, "push": 180.0}})
            if room["type"] == "combat" and rng.random() < 0.6:
                hz({"type": "blood_current", "mode": "current",
                    "rect": [MARGIN, h_px // 2 - 60, w_px - 2 * MARGIN, 120],
                    "params": {"dir": [1, 0], "strength": 300.0}})
    return H

# ---------------------------------------------------------- build room ----
def build_room(zone, key, rtype, size_key, conns, rng):
    tw, th = SIZE[size_key]
    w_px, h_px = tw * TILE, th * TILE
    is_entry = (key == zone["entry_room"])
    slots = door_slots(w_px, h_px, len(conns))
    doors = []
    if not is_entry:
        doors.append({"id": "door_in", "dir": slots[0]["dir"], "pos": slots[0]["pos"], "target": "@prev"})
    for i, c in enumerate(conns):
        s = slots[1 + i]
        doors.append({"id": "door_%d" % i, "dir": s["dir"], "pos": s["pos"], "target": c})
    # hero entry: di dalam pintu masuk (atau tengah-bawah utk entry room zona)
    if not is_entry:
        d = doors[0]["pos"]
        entry = [d[0], d[1] - 150] if doors[0]["dir"] == "S" else [w_px // 2, h_px - 200]
    else:
        entry = [w_px // 2, h_px - 200]
    entry[0] = max(MARGIN, min(w_px - MARGIN, entry[0]))
    entry[1] = max(MARGIN, min(h_px - MARGIN, entry[1]))

    room = {"id": key, "type": rtype, "scene": ROOM_SCENE.format(z=zone["id"], r=key),
            "size_tiles": [tw, th], "connections": conns,
            "seed": rng.randint(1, 999999),
            "wall_style": rng.choice(["fold", "smooth", "ridged"]),
            "hero_entry": entry}

    # spawn musuh (placeholder agent gameplay; boss room + BossSpawn)
    if rtype == "combat":
        room["spawns"] = scatter(rng, w_px, h_px, rng.randint(4, 8), [entry] + [d["pos"] for d in doors], 200)
    elif rtype == "boss":
        room["spawns"] = scatter(rng, w_px, h_px, 4, [entry], 260)
        room["boss_spawn"] = [w_px // 2, 260]
    elif rtype in ("hazard",):
        room["spawns"] = scatter(rng, w_px, h_px, 3, [entry], 260)
    else:
        room["spawns"] = []

    # hazard (combat/boss/hazard/corridor/shortcut wajib >=1; shop/reward/preboss aman)
    if rtype in ("combat", "boss", "hazard", "corridor", "shortcut"):
        room["hazards"] = hazards_for(zone["id"], rng, room, w_px, h_px, entry, doors)
        if not room["hazards"]:
            room["hazards"] = hazards_for("usus_besar", rng, room, w_px, h_px, entry, doors)
    else:
        room["hazards"] = []

    # fitur level-ruangan (zona)
    feat = None
    if zone["id"] == "usus_besar" and rtype in ("combat", "boss"):
        feat = {"type": "peristaltic", "params": {"period": 8.0, "strength": 300.0, "dir": [0, -1]}}
    elif zone["id"] == "lambung" and rtype in ("combat", "boss"):
        feat = {"type": "contraction", "params": {"period": 12.0, "squeeze": 0.25, "hold": 2.5}}
    elif zone["id"] == "jantung":
        feat = {"type": "heartbeat", "params": {"period": 1.0, "shake": 3.0}}
    elif zone["id"] == "paru" and rtype in ("combat", "boss"):
        feat = {"type": "airshift", "params": {"flip_sec": 5.0}}
    room["feature"] = feat

    # cover / destructible / collectible
    avoid = [entry] + [d["pos"] for d in doors]
    if rtype in ("combat", "hazard", "boss"):
        room["covers"] = [{"pos": p, "r": rng.randint(45, 80)} for p in scatter(rng, w_px, h_px, rng.randint(2, 5), avoid, 240)]
        room["destructibles"] = [{"kind": "tissue" if zone["id"] != "ginjal" else "crystal",
                                  "pos": p, "hp": rng.randint(1, 3), "drop": rng.randint(2, 8)}
                                 for p in scatter(rng, w_px, h_px, rng.randint(0, 3), avoid, 260)]
    else:
        room["covers"], room["destructibles"] = [], []
    if rtype == "reward":
        room["collectibles"] = [{"kind": "chest", "pos": [w_px // 2, h_px // 2], "amount": 25}]
        room["collectibles"] += [{"kind": "biokredit", "pos": p, "amount": rng.randint(3, 8)}
                                 for p in scatter(rng, w_px, h_px, 4, avoid, 200)]
    elif rtype == "preboss":
        room["collectibles"] = [{"kind": "biokredit", "pos": p, "amount": rng.randint(2, 5)}
                                for p in scatter(rng, w_px, h_px, 3, avoid, 200)]
    elif rtype == "corridor":
        room["collectibles"] = [{"kind": "fragment", "pos": p, "amount": 1}
                                for p in scatter(rng, w_px, h_px, 3, avoid, 200)]
    else:
        room["collectibles"] = [{"kind": "biokredit", "pos": p, "amount": rng.randint(1, 4)}
                                for p in scatter(rng, w_px, h_px, rng.randint(0, 2), avoid, 220)]
    if rtype == "shop":
        room["vendor"] = {"pos": [w_px // 2, h_px // 2 - 60]}
    room["drop_zone"] = [w_px // 2, h_px // 2]
    room["wow"] = {"kind": zone["wow"], "pos": [w_px // 2, 150], "scale": 1.0}
    room["doors"] = doors
    return room

def build_zone(zone):
    rng = random.Random(SEED + sum(ord(c) for c in zone["id"]))
    rooms = [build_room(zone, k, t, s, c, rng) for (k, t, s, c) in zone["rooms"]]
    return {"id": zone["id"], "name": zone["name"], "difficulty": zone["difficulty"],
            "rooms": rooms, "entry_room": zone["entry_room"], "boss_id": zone["boss_id"],
            "hazards": zone["hazards"], "enemies": zone["enemies"],
            "ambient_color": zone["ambient_color"], "music_key": zone["music_key"],
            "palette": zone["palette"]}

# --------------------------------------------------------- world map ------
def build_world_map():
    nodes = [
        {"id": "usus_besar", "label": "USUS BESAR", "pos": [1050, 1560], "requires": []},
        {"id": "usus_halus", "label": "USUS HALUS", "pos": [550, 1500], "requires": []},
        {"id": "ginjal", "label": "GINJAL", "pos": [1080, 1120], "requires": ["usus_besar"]},
        {"id": "lambung", "label": "LAMBUNG", "pos": [520, 1060], "requires": ["usus_halus"]},
        {"id": "pankreas", "label": "PANKREAS", "pos": [800, 880], "requires": ["ginjal", "lambung"]},
        {"id": "hati", "label": "HATI", "pos": [1080, 600], "requires": ["pankreas"]},
        {"id": "paru", "label": "PARU-PARU", "pos": [520, 560], "requires": ["pankreas"]},
        {"id": "jantung", "label": "JANTUNG (GOAL)", "pos": [800, 160],
         "requires": [], "goal": True},
    ]
    edges = [["usus_besar", "usus_halus"], ["usus_besar", "ginjal"],
             ["usus_halus", "lambung"], ["ginjal", "pankreas"], ["lambung", "pankreas"],
             ["pankreas", "hati"], ["pankreas", "paru"],
             ["hati", "jantung"], ["paru", "jantung"]]
    return {"schema": 1, "canvas": [1600, 2000],
            "doc": "START = Usus Besar ATAU Usus Halus. Gate = requires harus clear. "
                   "GOAL Jantung = 6 dari 7 zona lain clear. Fast travel = zona cleared.",
            "start_ids": ["usus_besar", "usus_halus"],
            "goal_id": "jantung", "goal_requires_cleared": 6,
            "nodes": nodes,
            "edges": [{"a": a, "b": b, "corridor_tiles": 26,
                       "scene": "res://scenes/Corridor.tscn"} for (a, b) in edges]}

# -------------------------------------------------------- room stub -------
STUB = """[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://scenes/Room.tscn" id="1"]

[node name="%s" instance=ExtResource("1")]
zone_id = "%s"
room_id = "%s"
"""

def write_stub(zone_id, room_id):
    d = os.path.join(ROOT, "scenes", "zones", zone_id, "rooms")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, room_id + ".tscn"), "w") as f:
        f.write(STUB % (room_id, zone_id, room_id))

# --------------------------------------------------------------- png ------
def write_png(path, w, h, rows):
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))

def atlas(zone, path):
    """Atlas 256x256 (4x4 tile @64): baris floor / wall / deco / hazard."""
    rng = random.Random(SEED + sum(ord(c) for c in zone["id"]) + 77)
    S, N = 256, 256
    pal = {k: hex_rgb(v) for k, v in zone["palette"].items()}
    grid = [[rng.random() for _ in range(33)] for _ in range(33)]

    def noise(x, y):
        gx, gy = x / 8.0, y / 8.0
        x0, y0 = int(gx), int(gy)
        fx, fy = gx - x0, gy - y0
        x1, y1 = min(x0 + 1, 32), min(y0 + 1, 32)
        return (grid[y0][x0] * (1 - fx) + grid[y0][x1] * fx) * (1 - fy) + \
               (grid[y1][x0] * (1 - fx) + grid[y1][x1] * fx) * fy

    blobs = [(rng.randint(0, 255), rng.randint(0, 255), rng.randint(8, 30)) for _ in range(40)]
    rows = []
    for y in range(N):
        row = bytearray()
        for x in range(N):
            rowkind = (y // 64) % 4
            n = noise(x, y)
            b = 0.0
            for (bx, by, br) in blobs:
                dd = math.hypot(x - bx, y - by) / br
                if dd < 1.0:
                    b += (1.0 - dd)
            b = min(b, 1.0)
            dith = rng.uniform(-8, 8)
            if rowkind == 0:  # floor: hangat + blotch organik
                base, amp = pal["floor"], 34
                c = [max(0, min(255, int(base[i] + (n - 0.5) * amp + dith))) for i in range(3)]
            elif rowkind == 1:  # wall: gelap + lipatan sinus + highlight membran
                fold = math.sin(y * 0.35 + n * 4.0) * 14
                base = pal["wall"]
                c = [max(0, min(255, int(base[i] + fold + (n - 0.5) * 20 + dith))) for i in range(3)]
                if y % 64 < 5:  # highlight tepi membran
                    c = [min(255, c[i] + 46) for i in range(3)]
            elif rowkind == 2:  # deco: deep + speckle aksen
                base = pal["deep"]
                sp = 70 if rng.random() < 0.02 + b * 0.05 else 0
                c = [max(0, min(255, int(base[i] * 0.7 + pal["accent"][i] * 0.3 * (b * 0.5) + sp * (pal["accent"][i] / 255.0) + dith))) for i in range(3)]
            else:  # hazard marker: glow gradient
                t = (math.sin(x * 0.1) + math.cos(y * 0.1)) * 0.25 + 0.5
                c = [int(pal["deep"][i] * (1 - t * 0.6) + pal["glow"][i] * t * 0.6 + dith) for i in range(3)]
                c = [max(0, min(255, v)) for v in c]
            row += bytes((c[0], c[1], c[2], 255))
        rows.append(row)
    write_png(path, S, N, rows)

# --------------------------------------------------------------- main -----
def main():
    total = 0
    for zone in ZONES:
        data = build_zone(zone)
        total += len(data["rooms"])
        with open(os.path.join(ROOT, "data", "zones", zone["id"] + ".json"), "w") as f:
            json.dump(data, f, indent=1)
        for r in data["rooms"]:
            write_stub(zone["id"], r["id"])
        atlas(zone, os.path.join(ROOT, "assets", "tilesets", zone["id"] + ".png"))
        print("zona %-11s %d ruangan" % (zone["id"], len(data["rooms"])))
    with open(os.path.join(ROOT, "data", "world_map.json"), "w") as f:
        json.dump(build_world_map(), f, indent=1)
    print("world_map.json + %d room stubs + 8 atlas  [total %d ruangan]" % (total, total))

if __name__ == "__main__":
    main()

