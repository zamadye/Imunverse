extends Area2D
## OrganNode — SATU organ di world map: blob berlobus + label, bisa diklik.
## cleared = bercahaya, open = redup, locked = silhouette gelap.
## Klik = lepas-tanpa-drag (aman dari konflik drag kamera).

signal organ_clicked(zone_id: String)

var zone_id := ""
var label_text := ""
var state := "locked"  # locked | open | cleared
var is_goal := false
var base_color := Color(0.6, 0.25, 0.3)
var _t := 0.0
var _press_pos := Vector2.ZERO
var _pressed := false
var _blob: Polygon2D
var _lobes := 7
var _radius := 90.0

func setup(ndef: Dictionary, pal: Dictionary, p_state: String) -> void:
	zone_id = ndef.get("id", "")
	label_text = ndef.get("label", zone_id)
	is_goal = bool(ndef.get("goal", false))
	state = p_state
	_radius = 120.0 if is_goal else 90.0
	base_color = Color(pal.get("main", "#884455"))
	position = Vector2(ndef["pos"][0], ndef["pos"][1])
	var cs := CollisionShape2D.new()
	var circ := CircleShape2D.new()
	circ.radius = _radius + 20.0
	cs.shape = circ
	add_child(cs)
	_blob = Polygon2D.new()
	add_child(_blob)
	var label := Label.new()
	label.text = label_text
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 30 if is_goal else 26)
	label.add_theme_color_override("font_color", Color(1, 1, 1))
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	label.add_theme_constant_override("shadow_offset_x", 2)
	label.add_theme_constant_override("shadow_offset_y", 2)
	label.position = Vector2(-160, _radius + 6)
	label.size = Vector2(320, 40)
	add_child(label)
	if state == "cleared" or is_goal:
		var l := ZoneLighting.make_light(Color(1, 0.9, 0.7, 0.8), 0.8, 3.2)
		add_child(l)
	input_event.connect(_on_input)

const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")

func _on_input(_vp: Node, ev: InputEvent, _shape: int) -> void:
	if ev is InputEventMouseButton and (ev as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		if (ev as InputEventMouseButton).pressed:
			_pressed = true
			_press_pos = (ev as InputEventMouseButton).global_position
		elif _pressed:
			_pressed = false
			if (ev as InputEventMouseButton).global_position.distance_to(_press_pos) < 14.0:
				organ_clicked.emit(zone_id)

func _process(delta: float) -> void:
	_t += delta
	_draw_blob()

func _draw_blob() -> void:
	var pts := PackedVector2Array()
	var beat := 1.0 + (0.05 * sin(_t * (4.2 if is_goal else 1.6)))
	for i in range(_lobes * 3):
		var a := i * TAU / float(_lobes * 3)
		var lobe := 1.0 + 0.16 * sin(a * _lobes + 1.0)
		pts.append(Vector2(cos(a), sin(a)) * _radius * lobe * beat)
	_blob.polygon = pts
	match state:
		"cleared":
			_blob.color = base_color.lightened(0.25)
		"open":
			_blob.color = base_color
		_:
			_blob.color = base_color.darkened(0.55)
	# inti berdenyut
	var core_r := _radius * 0.45 * (1.0 + 0.08 * sin(_t * 2.2))
	# (digambar sebagai blob kedua via modulate — murah, tanpa node ekstra)
