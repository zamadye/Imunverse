extends Node2D
## RoomFeature — perilaku level-RUANGAN khas zona (bukan area, tapi seluruh room):
##   peristaltic (usus besar): tiap 8 dtk gelombang mendorong SEMUA ke satu arah
##   contraction (lambung): tiap 12 dtk dinding menyempit sementara
##   heartbeat  (jantung): tiap 1 dtk getar + gelombang; sediakan fase denyut
##              → Pulse SAAT denyut = bonus (dibaca agent gameplay via beat_phase())
##   airshift   (paru): tiap 5 dtk arah aliran udara global dibalik
## Semua efek mengenai hero DAN musuh (ATURAN 2).

var feature := ""
var params := {}
var _clock := 0.0
var _room = null
var _walls: Array = []       # untuk contraction
var _wall_home: Array = []
var _air_dirs := [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]
var _air_idx := 0
var beat_phase := 0.0        # 0.0 = TEPAT denyut (jendela bonus Pulse)

func setup(feat: Dictionary, room_ref) -> void:
	feature = feat.get("type", "")
	params = feat.get("params", {})
	_room = room_ref
	if feature == "contraction":
		_walls = _room.get_node("WallBodies").get_children() if _room.has_node("WallBodies") else []
		for w in _walls:
			_wall_home.append((w as Node2D).position)

func _physics_process(delta: float) -> void:
	_clock += delta
	match feature:
		"peristaltic":
			var period := float(params.get("period", 8.0))
			if _clock >= period:
				_clock = 0.0
				_wave_push()
		"contraction":
			_contraction(delta)
		"heartbeat":
			_heartbeat(delta)
		"airshift":
			var flip := float(params.get("flip_sec", 5.0))
			if _clock >= flip:
				_clock = 0.0
				_air_flip()

func _all_bodies() -> Array:
	var out := []
	out.append_array(get_tree().get_nodes_in_group("hero"))
	out.append_array(get_tree().get_nodes_in_group("enemy"))
	return out

func _wave_push() -> void:
	var d: Array = params.get("dir", [0, -1])
	var dir := Vector2(d[0], d[1])
	var stren := float(params.get("strength", 300.0))
	for b in _all_bodies():
		if b is CharacterBody2D and _inside_room(b):
			b.velocity += dir * stren

func _contraction(delta: float) -> void:
	var period := float(params.get("period", 12.0))
	var hold := float(params.get("hold", 2.5))
	var sq := float(params.get("squeeze", 0.25))
	var t := fmod(_clock, period)
	var k := 0.0
	if t < 1.0:
		k = t  # dinding masuk
	elif t < 1.0 + hold:
		k = 1.0  # tahan
	elif t < 2.0 + hold:
		k = 1.0 - (t - 1.0 - hold)  # kembali
	var c: Vector2 = _room.room_center_px()
	for i in range(_walls.size()):
		var w: Node2D = _walls[i]
		var home: Vector2 = _wall_home[i]
		w.position = home.lerp(c, k * sq * 0.35)

func _heartbeat(delta: float) -> void:
	var period := float(params.get("period", 1.0))
	beat_phase = fmod(_clock, period) / period
	if beat_phase < delta / period + 0.001:
		# DENYUT: getar kamera + dorong semua sedikit ke tengah
		var cam := get_viewport().get_camera_2d()
		if cam != null and cam.has_method("add_shake"):
			cam.add_shake(float(params.get("shake", 3.0)))
		var c: Vector2 = _room.room_center_px() + _room.position
		for b in _all_bodies():
			if b is CharacterBody2D and _inside_room(b):
				var to_c: Vector2 = (c - (b as Node2D).global_position)
				if to_c.length() > 40.0:
					b.velocity += to_c.normalized() * 120.0

## Jendela bonus: dipanggil agent gameplay saat Pulse. ±12% dari denyut = bonus.
func is_beat_window() -> bool:
	return beat_phase < 0.12 or beat_phase > 0.88

func _air_flip() -> void:
	_air_idx = (_air_idx + 1) % _air_dirs.size()
	for h in _room.get_hazards():
		if h.has_method("set_air_dir"):
			h.set_air_dir(_air_dirs[_air_idx])

func _inside_room(b: Node) -> bool:
	var size: Vector2 = _room.room_size_px()
	var lp: Vector2 = (b as Node2D).global_position - _room.global_position
	return lp.x > 0.0 and lp.y > 0.0 and lp.x < size.x and lp.y < size.y
