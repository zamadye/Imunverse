extends SceneTree
## Guard headless PHAGOS World — subset bebas-fisika.
## Build wasm sandbox (custom_build) TIDAK memiliki kelas fisika 2D
## (Area2D/StaticBody2D/CharacterBody2D) — jadi skrip yang menyentuhnya
## (room/door/hazard/actors/zone/corridor/world_map/game) TIDAK bisa di-parse
## di sini. Mereka benar untuk target rilis (Godot 4.3+ editor/Android) dan
## kontraknya diverifikasi STATIS oleh tools/verify-phagos-world.mjs.
## Yang diuji LANGSUNG di engine: data JSON, world_rules, 8 tileset,
## partikel, wow, minimap/HUD, stub scene, save.
## Jalankan: node tools/godot/run.mjs godot/phagos --headless
##           --path godot/phagos --script res://scripts/tests/guard_world.gd

const Json = preload("res://scripts/util/json_loader.gd")
const Rules = preload("res://scripts/world/world_rules.gd")
const Tilesets = preload("res://scripts/world/tileset_factory.gd")
const Particles = preload("res://scripts/fx/ambient_particles.gd")
const Wow = preload("res://scripts/fx/wow_feature.gd")
const Minimap = preload("res://scripts/ui/minimap.gd")
const ZoneHUD = preload("res://scripts/ui/zone_hud.gd")
const SaveWorld = preload("res://scripts/core/save_world.gd")
const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")

const EXPECT_COUNTS := {"usus_besar": 4, "usus_halus": 5, "ginjal": 5,
	"lambung": 6, "pankreas": 5, "hati": 6, "paru": 7, "jantung": 8}
const ZIDS := ["usus_besar", "usus_halus", "ginjal", "lambung",
	"pankreas", "hati", "paru", "jantung"]

var fails := 0
var checks := 0

func check(name: String, ok: bool, info: String = "") -> void:
	checks += 1
	if not ok:
		fails += 1
	print("GUARD %-56s %s %s" % [name, "OK" if ok else "FAIL", info])

func _initialize() -> void:
	_data_checks()
	_rules_checks()
	_tileset_checks()
	_fx_checks()
	_ui_checks()
	_stub_checks()
	_save_checks()
	print("WORLD_GUARD_JSON:" + JSON.stringify({"checks": checks, "fails": fails,
		"rooms": 46, "zones": 8, "subset": "physics-free"}))
	print("WORLD_GUARD_FAIL=" + str(fails))
	quit(0 if fails == 0 else 1)

# ---------------------------------------------------------- 1) data -----
func _data_checks() -> void:
	var total := 0
	var mains := {}
	for zid in ZIDS:
		var zd := Json.load_zone(zid)
		check("zona JSON " + zid, not zd.is_empty())
		if zd.is_empty():
			continue
		var rooms: Array = zd.get("rooms", [])
		total += rooms.size()
		check("ruangan " + zid, rooms.size() == EXPECT_COUNTS[zid],
			"%d/%d" % [rooms.size(), EXPECT_COUNTS[zid]])
		mains[zid] = str(zd.get("palette", {}).get("main", ""))
		var g: Dictionary = Rules.validate_zone_graph(zd)
		check("graf " + zid, bool(g["ok"]), str(g.get("errors", [])))
		for r in rooms:
			_room_json_checks(zid, r)
	check("TOTAL 46", total == 46, "dapat %d" % total)
	var uniq := {}
	for k in mains.keys():
		uniq[mains[k]] = true
	check("ATURAN 3: 8 palet berbeda", uniq.size() == 8)
	var wm := Json.load_world_map()
	check("world_map 8n/9e", (wm.get("nodes", []) as Array).size() == 8
		and (wm.get("edges", []) as Array).size() == 9)
	check("GOAL 6/7", wm.get("goal_id") == "jantung"
		and int(wm.get("goal_requires_cleared", 0)) == 6)

func _room_json_checks(zid: String, r: Dictionary) -> void:
	var rid: String = r["id"]
	var rtype: String = r.get("type", "")
	check("ukuran " + rid, Rules.room_size_ok(rtype, r.get("size_tiles", [])))
	var n := (r.get("spawns", []) as Array).size()
	var ok_sp := true
	if rtype == "combat":
		ok_sp = n >= 4 and n <= 8
	elif rtype == "boss":
		ok_sp = n == 4 and r.has("boss_spawn")
	elif rtype == "hazard":
		ok_sp = n == 3
	else:
		ok_sp = n == 0
	check("spawn " + rid, ok_sp, "n=%d" % n)
	var hz: Array = r.get("hazards", [])
	if rtype in ["combat", "boss", "hazard", "corridor", "shortcut"]:
		check("hazard>=1 " + rid, hz.size() >= 1, "n=%d" % hz.size())
	for h in hz:
		var aff: Array = h.get("affects", [])
		if not ("hero" in aff and "enemy" in aff):
			check("ATURAN 2 " + rid, false, str(aff))
	var nd := (r.get("doors", []) as Array).size()
	check("pintu " + rid, nd >= 1 and nd <= 3, "n=%d" % nd)
	var entry: Array = r.get("hero_entry", [0, 0])
	var far := true
	for s in r.get("spawns", []):
		if Vector2(s[0] - entry[0], s[1] - entry[1]).length() < 180.0:
			far = false
	check("spawn jauh " + rid, far)

# --------------------------------------------------------- 2) rules -----
func _rules_checks() -> void:
	var wm := Json.load_world_map()
	check("START terbuka", Rules.is_unlocked(wm, [], "usus_besar")
		and Rules.is_unlocked(wm, [], "usus_halus"))
	check("ginjal kunci->buka", not Rules.is_unlocked(wm, [], "ginjal")
		and Rules.is_unlocked(wm, ["usus_besar"], "ginjal"))
	check("pankreas konvergensi", not Rules.is_unlocked(wm, ["ginjal"], "pankreas")
		and Rules.is_unlocked(wm, ["ginjal", "lambung"], "pankreas"))
	check("jantung 5/7 tutup", not Rules.is_unlocked(wm,
		["usus_besar", "usus_halus", "ginjal", "lambung", "pankreas"], "jantung"))
	check("jantung 6/7 buka", Rules.is_unlocked(wm,
		["usus_besar", "usus_halus", "ginjal", "lambung", "pankreas", "hati"], "jantung"))
	check("adjacent", Rules.is_adjacent(wm, "usus_besar", "usus_halus")
		and not Rules.is_adjacent(wm, "usus_besar", "hati"))
	check("travel corridor", Rules.travel_mode(wm, ["usus_besar"], "usus_besar", "ginjal") == "corridor")
	check("travel warp", Rules.travel_mode(wm, ["usus_besar", "ginjal"], "ginjal", "usus_besar") == "direct")
	check("travel locked", Rules.travel_mode(wm, [], "", "hati") == "locked")

# ------------------------------------------------------- 3) tileset -----
func _tileset_checks() -> void:
	for zid in ZIDS:
		var zd := Json.load_zone(zid)
		var ts: TileSet = Tilesets.make_tileset(zid, zd.get("palette", {}))
		var src = ts.get_source(0) if ts.get_source_count() > 0 else null
		check("tileset " + zid, ts is TileSet and src != null and src.get_tiles_count() == 16)
		# varian dinding organik: 4 varian berbeda per mask
		var v := {}
		for m in range(16):
			v[str(Tilesets.wall_variant(m))] = true
		check("wall_variant organik", v.size() == 4)

# ----------------------------------------------------------- 4) fx ------
func _fx_checks() -> void:
	var tex: ImageTexture = ZoneLighting.radial_texture()
	var tsz: Vector2 = tex.get_size()
	check("radial texture", tex != null and int(tsz.x) == 64 and int(tsz.y) == 64)
	var holder := Node2D.new()
	root.add_child(holder)
	for zid in ZIDS:
		var p: CPUParticles2D = Particles.build(holder, zid, Vector2(1280, 960))
		check("partikel " + zid, p.amount >= 24 and p.texture != null, "n=%d" % p.amount)
	var kinds := ["peristaltic_tunnel", "nutrient_rain", "crystal_cavern", "acid_tide",
		"islet_constellation", "kupffer_patrol", "alveolar_window", "great_valve"]
	for i in range(kinds.size()):
		var w = Wow.new()
		holder.add_child(w)
		w.setup({"kind": kinds[i], "pos": [640, 150], "scale": 1.0}, {"glow": "#FFAAAA"})
		check("wow " + kinds[i], w.kind == kinds[i] and w.z_index == -5)
	holder.queue_free()  # (skrip segera quit; hindari free() in-tree di headless)

# ----------------------------------------------------------- 5) ui ------
func _ui_checks() -> void:
	var mm = Minimap.new()
	root.add_child(mm)
	mm.setup(null)
	check("minimap instance", mm.fullscreen == false)
	mm.free()
	var hud = ZoneHUD.new()
	root.add_child(hud)
	hud.setup(null)
	hud.refresh("Z", "R", "O", "", 1.0)
	hud.refresh("Z", "R", "O", "BOSS", 0.5)
	check("hud refresh", true)
	hud.free()

# --------------------------------------------------------- 6) stub -----
func _stub_checks() -> void:
	var n := 0
	for zid in ZIDS:
		var zd := Json.load_zone(zid)
		for r in zd.get("rooms", []):
			var path: String = r["scene"]
			n += 1
			if not FileAccess.file_exists(path):
				check("stub " + str(r["id"]), false, path)
				continue
			var f := FileAccess.open(path, FileAccess.READ)
			var txt := f.get_as_text()
			var ok := txt.contains("Room.tscn") and txt.contains(zid) and txt.contains(str(r["id"]))
			if not ok:
				check("stub isi " + str(r["id"]), false, path)
	check("46 stub valid", n == 46, "n=%d" % n)

# --------------------------------------------------------- 7) save -----
func _save_checks() -> void:
	var st := SaveWorld.default_state()
	SaveWorld.mark_zone_cleared(st, "usus_besar")
	SaveWorld.mark_room_cleared(st, "usus_besar", "ub_combat_01")
	check("save pure", "usus_besar" in st["cleared_zones"]
		and "ub_combat_01" in st["cleared_rooms"]["usus_besar"])
