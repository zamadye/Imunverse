extends Node2D
## Corridor — jalur antar organ: BUKAN loading screen. Koridor pendek
## (pembuluh darah) yang dilewati BERJALAN: tanpa combat, ada collectible
## (Biokredit, fragment), environment berubah GRADUAL dari biome A ke B
## (transisi warna lantai, partikel ganda, vignette campuran).

const TILE := 64
const Tilesets = preload("res://scripts/world/tileset_factory.gd")
const Pickup = preload("res://scripts/actors/pickup.gd")
const Particles = preload("res://scripts/fx/ambient_particles.gd")
const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")
const Json = preload("res://scripts/util/json_loader.gd")

var from_zone := ""
var to_zone := ""
var length_tiles := 26
var _game = null
var _cam: Camera2D
var _exit: Area2D

func setup(p_from: String, p_to: String, game_ref, corridor_tiles: int = 26) -> void:
	from_zone = p_from
	to_zone = p_to
	_game = game_ref
	length_tiles = corridor_tiles
	_build()

func _build() -> void:
	var za := Json.load_zone(from_zone)
	var zb := Json.load_zone(to_zone)
	var pa: Dictionary = za.get("palette", {})
	var pb: Dictionary = zb.get("palette", {})
	var tsa: TileSet = Tilesets.make_tileset(from_zone, pa)
	var h := 8
	var w := length_tiles
	# lantai: 3 dimaksud — pita A, pita campuran, pita B (transisi gradual)
	var la := _layer("FloorA", tsa, 0)
	var lb := _layer("FloorB", Tilesets.make_tileset(to_zone, pb), 0)
	var rng := RandomNumberGenerator.new()
	rng.seed = 99 + hash(from_zone + to_zone) % 10000
	for y in range(h):
		for x in range(w):
			var k := float(x) / float(maxi(1, w - 1))
			if k < 0.45:
				la.set_cell(Vector2i(x, y), 0, Tilesets.floor_variant(rng))
			elif k > 0.55:
				lb.set_cell(Vector2i(x - w, y), 0, Tilesets.floor_variant(rng))
			else:  # pita campuran: selang-seling A/B
				if (x + y) % 2 == 0:
					la.set_cell(Vector2i(x, y), 0, Tilesets.floor_variant(rng))
				else:
					lb.set_cell(Vector2i(x - w, y), 0, Tilesets.floor_variant(rng))
	lb.position.x = w * TILE  # FloorB digeser agar koordinat sel sejajar
	# dinding atas-bawah (paduan warna: pakai tileset A)
	var wl := _layer("Walls", tsa, 1)
	for x in range(w):
		wl.set_cell(Vector2i(x, -1), 0, Vector2i(x % 4, 1))
		wl.set_cell(Vector2i(x, h), 0, Vector2i((x + 2) % 4, 1))
	var bodies := Node2D.new()
	bodies.name = "WallBodies"
	add_child(bodies)
	_solid(bodies, Vector2(w * TILE * 0.5, -32), Vector2(w * TILE, 64))
	_solid(bodies, Vector2(w * TILE * 0.5, h * TILE + 32), Vector2(w * TILE, 64))
	# collectible kecil di tengah
	var col := Node2D.new()
	col.name = "Collectibles"
	add_child(col)
	for i in range(4):
		var pk := Pickup.new()
		col.add_child(pk)
		pk.setup({"kind": "biokredit" if i % 2 == 0 else "fragment",
			"pos": [w * TILE * (0.25 + 0.17 * i), h * TILE * 0.5 + (60 if i % 2 == 0 else -60)],
			"amount": 2 if i % 2 == 0 else 1})
	# partikel ganda (biome A + B) + cahaya campuran
	var fx := Node2D.new()
	fx.name = "FX"
	add_child(fx)
	Particles.build(fx, from_zone, Vector2(w * TILE, h * TILE))
	var cm := CanvasModulate.new()
	var ca := Color(pa.get("deep", "#222222"))
	var cb := Color(pb.get("deep", "#222222"))
	cm.color = ca.lerp(cb, 0.5).lerp(Color(0.6, 0.6, 0.62), 0.4)
	add_child(cm)
	# label transisi
	var layer := CanvasLayer.new()
	layer.layer = 9
	add_child(layer)
	var label := Label.new()
	label.text = "%s  →  %s" % [str(za.get("name", from_zone)), str(zb.get("name", to_zone))]
	label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	label.position = Vector2(-300, 16)
	label.size = Vector2(600, 40)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 26)
	layer.add_child(label)
	# trigger keluar di ujung kanan
	_exit = Area2D.new()
	_exit.collision_layer = 0
	_exit.collision_mask = 2
	var cs := CollisionShape2D.new()
	var rs := RectangleShape2D.new()
	rs.size = Vector2(80, h * TILE)
	cs.shape = rs
	_exit.add_child(cs)
	_exit.position = Vector2(w * TILE - 40, h * TILE * 0.5)
	add_child(_exit)
	_exit.body_entered.connect(_on_exit)
	_cam = Camera2D.new()
	_cam.position_smoothing_enabled = true
	add_child(_cam)
	_cam.make_current()

func hero_entry_pos() -> Vector2:
	return Vector2(120, 4 * TILE)

func _layer(name: String, ts: TileSet, z: int) -> TileMapLayer:
	var l := TileMapLayer.new()
	l.name = name
	l.tile_set = ts
	l.z_index = z
	add_child(l)
	return l

func _solid(parent: Node, pos: Vector2, size: Vector2) -> void:
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

func _on_exit(body: Node2D) -> void:
	if body.is_in_group("hero") and _game != null and _game.has_method("enter_zone"):
		_game.enter_zone(to_zone)

func _process(_delta: float) -> void:
	var hero := get_tree().get_first_node_in_group("hero")
	if hero != null and _cam != null:
		_cam.global_position = (hero as Node2D).global_position
