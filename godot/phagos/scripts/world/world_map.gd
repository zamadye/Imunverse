extends Node2D
## WorldMap — peta tubuh: 8 node organ + jalur pembuluh darah, scrollable/
## zoomable. cleared = bercahaya, locked = silhouette. START = Usus Besar ATAU
## Usus Halus. Gate = requires. GOAL Jantung = 6/7 zona lain clear.
## Fast travel: zona cleared bisa di-warp langsung; kunjungan pertama ke zona
## adjacent = jalan kaki lewat koridor (tanpa combat).

const Json = preload("res://scripts/util/json_loader.gd")
const OrganNode = preload("res://scripts/world/organ_node.gd")

var map_def := {}
var palettes := {}       # zone_id -> palette
var cleared: Array = []
var current_zone := ""
var _game = null
var _cam: Camera2D
var _nodes := {}         # zone_id -> OrganNode
var _hint: Label
var _hint_t := 0.0
var _dragging := false
var _drag_button := false
var _drag_from := Vector2.ZERO
var _cam_from := Vector2.ZERO
var _flow_t := 0.0

func setup(game_ref, cleared_zones: Array, p_current: String) -> void:
	_game = game_ref
	cleared = cleared_zones.duplicate()
	current_zone = p_current
	map_def = Json.load_world_map()
	for zid in ["usus_besar", "usus_halus", "ginjal", "lambung", "pankreas", "hati", "paru", "jantung"]:
		var zd := Json.load_zone(zid)
		palettes[zid] = zd.get("palette", {})
	_build()

func is_unlocked(zone_id: String) -> bool:
	return Rules.is_unlocked(map_def, cleared, zone_id)

func _cleared_others(except_id: String) -> int:
	return Rules.cleared_others(cleared, except_id)

func is_adjacent(a: String, b: String) -> bool:
	return Rules.is_adjacent(map_def, a, b)

func try_travel(zone_id: String) -> void:
	if not is_unlocked(zone_id):
		_show_hint("Terkunci — clear zona di bawahnya dulu.")
		return
	if _game == null:
		return
	if zone_id in cleared or current_zone == "":
		_game.enter_zone(zone_id)  # fast travel / kunjungan awal
	elif is_adjacent(current_zone, zone_id):
		_game.travel_corridor(current_zone, zone_id)  # jalan kaki
	else:
		_show_hint("Belum ada jalur — pilih zona yang terhubung.")
		return

func _build() -> void:
	var canvas: Array = map_def.get("canvas", [1600, 2000])
	# latar tubuh: siluet daging + vignette
	var bg := Polygon2D.new()
	bg.polygon = PackedVector2Array([Vector2(300, -100), Vector2(1300, -100),
		Vector2(1450, 700), Vector2(1350, 1500), Vector2(1100, 2100),
		Vector2(500, 2100), Vector2(250, 1500), Vector2(150, 700)])
	bg.color = Color(0.23, 0.07, 0.10, 1.0)
	bg.z_index = -10
	add_child(bg)
	var cm := CanvasModulate.new()
	cm.color = Color(0.75, 0.7, 0.75)
	add_child(cm)
	# jalur pembuluh (arteri merah / vena biru bergantian)
	var ei := 0
	for e in map_def.get("edges", []):
		_vessel(_node_pos(e["a"]), _node_pos(e["b"]), ei)
		ei += 1
	# node organ
	for n in map_def.get("nodes", []):
		var zid: String = n["id"]
		var st := "locked"
		if zid in cleared:
			st = "cleared"
		elif is_unlocked(zid):
			st = "open"
		var on := OrganNode.new()
		add_child(on)
		on.setup(n, palettes.get(zid, {}), st)
		on.organ_clicked.connect(try_travel)
		_nodes[zid] = on
	# marker pemain (rute teal START→posisi)
	if current_zone != "" and _nodes.has(current_zone):
		var mk := Polygon2D.new()
		mk.polygon = PackedVector2Array([Vector2(0, -26), Vector2(18, 14), Vector2(-18, 14)])
		mk.color = Color(0.2, 0.9, 0.85)
		mk.position = (_nodes[current_zone] as Node2D).position + Vector2(0, -130)
		mk.z_index = 5
		add_child(mk)
	# kamera + hint
	_cam = Camera2D.new()
	_cam.name = "MapCamera"
	_cam.position = Vector2(canvas[0] / 2.0, canvas[1] / 2.0)
	_cam.zoom = Vector2(0.55, 0.55)
	add_child(_cam)
	_cam.make_current()
	var layer := CanvasLayer.new()
	layer.layer = 20
	add_child(layer)
	_hint = Label.new()
	_hint.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_hint.position = Vector2(-400, -90)
	_hint.size = Vector2(800, 40)
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint.add_theme_font_size_override("font_size", 24)
	_hint.add_theme_color_override("font_color", Color(1, 0.9, 0.6))
	_hint.visible = false
	layer.add_child(_hint)

func _node_pos(zid: String) -> Vector2:
	for n in map_def.get("nodes", []):
		if n.get("id") == zid:
			return Vector2(n["pos"][0], n["pos"][1])
	return Vector2.ZERO

func _vessel(a: Vector2, b: Vector2, idx: int) -> void:
	var mid := (a + b) * 0.5 + Vector2(90 if idx % 2 == 0 else -90, 0)
	var line := Line2D.new()
	line.points = PackedVector2Array([a, mid, b])
	line.width = 16.0
	line.default_color = Color(0.55, 0.12, 0.14) if idx % 2 == 0 else Color(0.14, 0.25, 0.55)
	line.z_index = -5
	line.set_meta("flow", true)
	add_child(line)
	var inner := Line2D.new()
	inner.points = PackedVector2Array([a, mid, b])
	inner.width = 6.0
	inner.default_color = Color(0.9, 0.3, 0.3, 0.7) if idx % 2 == 0 else Color(0.35, 0.55, 0.9, 0.7)
	inner.z_index = -4
	add_child(inner)

func _show_hint(text: String) -> void:
	_hint.text = text
	_hint.visible = true
	_hint_t = 2.5

func _process(delta: float) -> void:
	_flow_t += delta
	if _hint_t > 0.0:
		_hint_t -= delta
		if _hint_t <= 0.0:
			_hint.visible = false

func _unhandled_input(ev: InputEvent) -> void:
	if _cam == null:
		return
	if ev is InputEventMouseButton:
		var mb := ev as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			_cam.zoom = (_cam.zoom * 1.12).clamp(Vector2(0.35, 0.35), Vector2(1.6, 1.6))
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			_cam.zoom = (_cam.zoom / 1.12).clamp(Vector2(0.35, 0.35), Vector2(1.6, 1.6))
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			_drag_button = mb.pressed
			if mb.pressed:
				_drag_from = mb.global_position
				_cam_from = _cam.position
	elif ev is InputEventMouseMotion and _drag_button:
		var mm := ev as InputEventMouseMotion
		if (mm.global_position - _drag_from).length() > 10.0:
			_dragging = true
		if _dragging:
			_cam.position = _cam_from - (mm.global_position - _drag_from) / _cam.zoom.x
	elif ev is InputEventScreenDrag:
		var sd := ev as InputEventScreenDrag
		_cam.position -= sd.relative / _cam.zoom.x
	elif ev is InputEventMagnifyGesture:
		var mg := ev as InputEventMagnifyGesture
		_cam.zoom = (_cam.zoom * mg.factor).clamp(Vector2(0.35, 0.35), Vector2(1.6, 1.6))
	if ev is InputEventMouseButton and not (ev as InputEventMouseButton).pressed:
		_dragging = false
