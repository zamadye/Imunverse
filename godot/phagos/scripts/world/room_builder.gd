extends RefCounted
## RoomBuilder — membangun SELURUH isi ruangan dari JSON (ATURAN 6).
## Struktur hasil (sesuai spek scene ruangan):
##   Floor/Walls/Deco/Foreground (TileMapLayer) + WallBodies (StaticBody2D,
##   gap di tiap pintu) + HazardAreas + SpawnPoints + Doors + Destructibles +
##   Collectibles + Lights (≤6) + FX (partikel, wow, feature).
## Dipakai Room, Corridor (sebagian), dan Guard (uji headless).

const TILE := 64
const Tilesets = preload("res://scripts/world/tileset_factory.gd")
const HazardArea = preload("res://scripts/hazards/hazard_area.gd")
const RoomFeature = preload("res://scripts/hazards/room_feature.gd")
const Door = preload("res://scripts/world/door.gd")
const Pickup = preload("res://scripts/actors/pickup.gd")
const Vendor = preload("res://scripts/actors/npc_vendor.gd")
const Wow = preload("res://scripts/fx/wow_feature.gd")
const Particles = preload("res://scripts/fx/ambient_particles.gd")
const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")
const ValveGate = preload("res://scripts/hazards/valve_gate.gd")
const Kupffer = preload("res://scripts/hazards/kupffer_cell.gd")
const Islet = preload("res://scripts/hazards/islet_cell.gd")
const Fragile = preload("res://scripts/hazards/fragile_wall.gd")
const Crystal = preload("res://scripts/hazards/sharp_crystal.gd")

static func build(room: Node2D, zone_def: Dictionary, room_def: Dictionary) -> void:
	var zone_id: String = zone_def.get("id", "usus_besar")
	var pal: Dictionary = zone_def.get("palette", {})
	var rng := RandomNumberGenerator.new()
	rng.seed = int(room_def.get("seed", 1))
	var tw := int(room_def["size_tiles"][0])
	var th := int(room_def["size_tiles"][1])
	var size_px := Vector2(tw * TILE, th * TILE)
	var ts: TileSet = Tilesets.make_tileset(zone_id, pal)
	# --- containers ---
	var floor_l := _layer(room, "Floor", ts, 0)
	var walls_l := _layer(room, "Walls", ts, 1)
	var deco_l := _layer(room, "Deco", ts, 2)
	var fore_l := _layer(room, "Foreground", ts, 20)
	fore_l.modulate = Color(1, 1, 1, 0.30)
	_paint(floor_l, walls_l, deco_l, fore_l, tw, th, rng, str(room_def.get("wall_style", "fold")))
	var wall_bodies := _container(room, "WallBodies")
	_build_walls(wall_bodies, tw, th, room_def.get("doors", []))
	_build_covers(wall_bodies, room_def.get("covers", []), pal, rng)
	# --- hazards (spesialis vs generik) ---
	var hz := _container(room, "HazardAreas")
	var light_budget := _lights(room, pal, size_px, rng)
	for hdef in room_def.get("hazards", []):
		var node: Node2D = null
		match str(hdef.get("type", "")):
			"valve_gate": node = ValveGate.new()
			"kupffer_cell": node = Kupffer.new()
			"islet_cell": node = Islet.new()
			"fragile_wall": node = Fragile.new()
			"sharp_crystal": node = Crystal.new()
			_: node = HazardArea.new()
		hz.add_child(node)
		node.setup(hdef)
		if light_budget > 0 and node is HazardArea and (node as HazardArea).mode in ["fog", "tide", "ph_cycle", "vapor"]:
			light_budget -= 1  # glow besar hanya hazard "berat"; sisanya viz poligon
	# --- spawn points ---
	var sp := _container(room, "SpawnPoints")
	for i in range((room_def.get("spawns", []) as Array).size()):
		var p: Array = room_def["spawns"][i]
		var m := Marker2D.new()
		m.name = "SpawnPoint_%d" % i
		m.position = Vector2(p[0], p[1])
		sp.add_child(m)
	if room_def.has("boss_spawn"):
		var b: Array = room_def["boss_spawn"]
		var bm := Marker2D.new()
		bm.name = "BossSpawn"
		bm.position = Vector2(b[0], b[1])
		sp.add_child(bm)
	# --- doors ---
	var dc := _container(room, "Doors")
	for ddef in room_def.get("doors", []):
		var d := Door.new()
		dc.add_child(d)
		d.setup(ddef, room)
	# --- destructibles / collectibles / vendor ---
	var desc := _container(room, "Destructibles")
	for ddef in room_def.get("destructibles", []):
		if str(ddef.get("kind", "tissue")) == "crystal":
			var c := Crystal.new()
			desc.add_child(c)
			c.setup_custom(Vector2(ddef["pos"][0], ddef["pos"][1]), 34.0,
				int(ddef.get("hp", 2)), 8.0, int(ddef.get("drop", 4)),
				Color(pal.get("glow", "#FFFFFF")))
		else:
			var f := Fragile.new()
			desc.add_child(f)
			f.setup_custom(Vector2(ddef["pos"][0], ddef["pos"][1]), Vector2(70, 70),
				int(ddef.get("hp", 2)), "prop", Color(pal.get("wall", "#888888")).lightened(0.2),
				int(ddef.get("drop", 3)))
	var col := _container(room, "Collectibles")
	for pdef in room_def.get("collectibles", []):
		var pk := Pickup.new()
		col.add_child(pk)
		pk.setup(pdef)
	if room_def.has("vendor"):
		var v := Vendor.new()
		room.add_child(v)
		v.setup(room_def["vendor"])
	# --- FX: partikel ambient + wow + feature ruangan ---
	var fx := _container(room, "FX")
	Particles.build(fx, zone_id, size_px)
	var wow := Wow.new()
	fx.add_child(wow)
	wow.setup(room_def.get("wow", {}), pal)
	if room_def.get("feature") != null:
		var feat := RoomFeature.new()
		feat.name = "Feature"
		room.add_child(feat)
		feat.setup(room_def["feature"], room)

static func _container(room: Node, name: String) -> Node2D:
	var n := Node2D.new()
	n.name = name
	room.add_child(n)
	return n

static func _layer(room: Node, name: String, ts: TileSet, z: int) -> TileMapLayer:
	var l := TileMapLayer.new()
	l.name = name
	l.tile_set = ts
	l.z_index = z
	room.add_child(l)
	return l

static func _paint(floor_l: TileMapLayer, walls_l: TileMapLayer, deco_l: TileMapLayer,
		fore_l: TileMapLayer, tw: int, th: int, rng: RandomNumberGenerator, style: String) -> void:
	for y in range(th):
		for x in range(tw):
			floor_l.set_cell(Vector2i(x, y), 0, Tilesets.floor_variant(rng))
			var border := x == 0 or y == 0 or x == tw - 1 or y == th - 1
			var bump := false
			if not border and style != "smooth":
				var near_edge := x == 1 or y == 1 or x == tw - 2 or y == th - 2
				var chance := 0.30 if style == "fold" else 0.16
				bump = near_edge and rng.randf() < chance
			if border or bump:
				# mask tetangga "dalam ruangan" → varian organik
				var mask := 0
				if x > 0 and not (x - 1 == 0): mask += 1
				if x < tw - 1 and not (x + 1 == tw - 1): mask += 2
				if y > 0 and not (y - 1 == 0): mask += 4
				if y < th - 1 and not (y + 1 == th - 1): mask += 8
				walls_l.set_cell(Vector2i(x, y), 0, Tilesets.wall_variant(mask))
			elif rng.randf() < 0.05:
				deco_l.set_cell(Vector2i(x, y), 0, Vector2i(rng.randi_range(0, 3), 2))
			elif rng.randf() < 0.03:
				fore_l.set_cell(Vector2i(x, y), 0, Vector2i(rng.randi_range(0, 3), 3))

## Dinding fisik perimeter + gap di tiap pintu + cover sudah di WallBodies.
static func _build_walls(parent: Node2D, tw: int, th: int, doors: Array) -> void:
	var w := tw * TILE
	var h := th * TILE
	var t := 64.0
	var gaps := {"N": [], "S": [], "E": [], "W": []}
	for d in doors:
		var p: Array = d["pos"]
		if d["dir"] in ["N", "S"]:
			(gaps[d["dir"]] as Array).append([p[0] - 90.0, p[0] + 90.0])
		else:
			(gaps[d["dir"]] as Array).append([p[1] - 90.0, p[1] + 90.0])
	_h_wall(parent, gaps["N"], w, t / 2)          # atas
	_h_wall(parent, gaps["S"], w, h - t / 2)      # bawah
	_v_wall(parent, gaps["W"], h, t / 2, w, h)    # kiri
	_v_wall(parent, gaps["E"], h, w - t / 2, w, h) # kanan

static func _h_wall(parent: Node2D, gaps: Array, w: float, cy: float) -> void:
	var segs := _subtract([[0.0, w]], gaps)
	for s in segs:
		_solid(parent, Vector2((s[0] + s[1]) * 0.5, cy), Vector2(s[1] - s[0], 64))

static func _v_wall(parent: Node2D, gaps: Array, h: float, cx: float, _w: float, _h: float) -> void:
	var segs := _subtract([[0.0, h]], gaps)
	for s in segs:
		_solid(parent, Vector2(cx, (s[0] + s[1]) * 0.5), Vector2(64, s[1] - s[0]))

static func _subtract(base: Array, cuts: Array) -> Array:
	var out := base
	for c in cuts:
		var next := []
		for s in out:
			if c[1] <= s[0] or c[0] >= s[1]:
				next.append(s)
			else:
				if c[0] > s[0]:
					next.append([s[0], c[0]])
				if c[1] < s[1]:
					next.append([c[1], s[1]])
		out = next
	return out.filter(func(s): return s[1] - s[0] > 8.0)

static func _solid(parent: Node2D, pos: Vector2, size: Vector2) -> StaticBody2D:
	var b := StaticBody2D.new()
	b.position = pos
	b.collision_layer = 1
	b.collision_mask = 0
	var cs := CollisionShape2D.new()
	var rs := RectangleShape2D.new()
	rs.size = size
	cs.shape = rs
	b.add_child(cs)
	parent.add_child(b)
	return b

static func _build_covers(parent: Node2D, covers: Array, pal: Dictionary,
		rng: RandomNumberGenerator) -> void:
	for cdef in covers:
		var b := StaticBody2D.new()
		b.position = Vector2(cdef["pos"][0], cdef["pos"][1])
		b.collision_layer = 1
		b.collision_mask = 0
		var cs := CollisionShape2D.new()
		var circ := CircleShape2D.new()
		circ.radius = float(cdef.get("r", 60))
		cs.shape = circ
		b.add_child(cs)
		var blob := Polygon2D.new()
		var pts := PackedVector2Array()
		for i in range(10):
			var a := i * TAU / 10.0
			pts.append(Vector2(cos(a), sin(a)) * circ.radius * rng.randf_range(0.85, 1.1))
		blob.polygon = pts
		blob.color = Color(pal.get("wall", "#555555")).lightened(0.15)
		blob.z_index = 2
		b.add_child(blob)
		parent.add_child(b)

## Cahaya ambient ruangan (2) → kembalikan sisa budget untuk hazard berat.
static func _lights(room: Node2D, pal: Dictionary, size_px: Vector2,
		_rng: RandomNumberGenerator) -> int:
	var lc := _container(room, "Lights")
	var warm := ZoneLighting.make_light(Color(1, 0.85, 0.75, 0.5), 0.45, 6.0)
	warm.position = Vector2(size_px.x * 0.3, size_px.y * 0.4)
	lc.add_child(warm)
	var cool := ZoneLighting.make_light(Color(pal.get("glow", "#AAAAFF"), 0.45), 0.45, 6.0)
	cool.position = Vector2(size_px.x * 0.7, size_px.y * 0.6)
	lc.add_child(cool)
	return 2  # sisa budget: hero(1)+wow(1)+ambient(2) = 4 dari 6
