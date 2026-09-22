extends Control
## Minimap — graf ruangan zona (titik + garis), pojok kanan atas, semi-transparan.
## cleared=putih, active=kuning, locked=abu, boss=merah. Klik / tombol M =
## fullscreen map. Grammar minimap Pathogenic: node blob + konektor teal.

var _zone = null
var fullscreen := false
var _t := 0.0

func setup(zone_ref) -> void:
	_zone = zone_ref
	mouse_filter = MOUSE_FILTER_STOP

func refresh() -> void:
	queue_redraw()

func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventKey and (ev as InputEventKey).pressed and not (ev as InputEventKey).echo:
		if (ev as InputEventKey).keycode == KEY_M:
			fullscreen = not fullscreen
			queue_redraw()

func _gui_input(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and (ev as InputEventMouseButton).pressed:
		fullscreen = not fullscreen
		queue_redraw()

func _process(delta: float) -> void:
	_t += delta
	if _zone != null:
		queue_redraw()

func _draw() -> void:
	if _zone == null:
		return
	var data: Dictionary = _zone.get_minimap_data()
	var rooms: Array = data.get("rooms", [])
	if rooms.is_empty():
		return
	var s := 3.2 if fullscreen else 1.0
	var r := 9.0 * s
	# panel
	var panel := Rect2(Vector2.ZERO, size)
	draw_rect(panel, Color(0, 0, 0, 0.45 if not fullscreen else 0.75))
	# layout grid sederhana dari index
	var cols := 3
	var step := Vector2(46 * s, 40 * s)
	var org := Vector2(30 * s, 30 * s)
	var pos := {}
	for i in range(rooms.size()):
		pos[rooms[i]["id"]] = org + Vector2((i % cols) * step.x, (i / cols) * step.y)
	# konektor teal mengalir
	for e in data.get("edges", []):
		if pos.has(e[0]) and pos.has(e[1]):
			var a: Vector2 = pos[e[0]]
			var b: Vector2 = pos[e[1]]
			draw_line(a, b, Color(0.2, 0.8, 0.75, 0.5), 2.0 * s)
			var k := fmod(_t * 0.6, 1.0)
			draw_circle(a.lerp(b, k), 2.5 * s, Color(0.3, 1, 0.9, 0.9))
	for rm in rooms:
		var p: Vector2 = pos[rm["id"]]
		var c := Color(0.5, 0.5, 0.5)
		match str(rm.get("state", "locked")):
			"cleared": c = Color(1, 1, 1)
			"active": c = Color(1, 0.9, 0.3)
			"locked": c = Color(0.45, 0.45, 0.5)
		if str(rm.get("type", "")) == "boss":
			c = Color(1, 0.25, 0.25)
		# blob asimetris (bukan lingkaran sempurna — grammar organik)
		var pts := PackedVector2Array()
		for i in range(9):
			var a := i * TAU / 9.0
			pts.append(p + Vector2(cos(a), sin(a)) * r * (0.85 + 0.15 * sin(i * 2.4)))
		draw_colored_polygon(pts, c)
		if fullscreen:
			draw_string(ThemeDB.fallback_font, p + Vector2(r + 4, 5), str(rm["id"]),
				HORIZONTAL_ALIGNMENT_LEFT, -1, int(13 * s), Color(1, 1, 1, 0.9))
