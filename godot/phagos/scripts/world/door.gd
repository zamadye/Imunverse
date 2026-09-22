extends StaticBody2D
## Door — gerbang antar ruangan. lock()/unlock() (kontrak gameplay).
## Terkunci = dinding solid + katup tertutup. Terbuka = bisa lewat + trigger
## Area2D aktif → hero masuk → room.request_exit() → Zone transisi (<0,5 dtk).

var door_id := ""
var door_dir := "N"
var target_room := ""
var locked := true
var _room = null
var _trigger: Area2D
var _flap: Polygon2D
var _open := 0.0  # 0 tertutup → 1 terbuka (animasi katup organik)

func setup(ddef: Dictionary, room_ref) -> void:
	door_id = ddef.get("id", "door")
	door_dir = ddef.get("dir", "N")
	target_room = ddef.get("target", "")
	_room = room_ref
	position = Vector2(ddef["pos"][0], ddef["pos"][1])
	collision_layer = 1
	collision_mask = 0
	var horiz := door_dir in ["N", "S"]
	var wall_shape := RectangleShape2D.new()
	wall_shape.size = Vector2(150, 70) if horiz else Vector2(70, 150)
	var cs := CollisionShape2D.new()
	cs.shape = wall_shape
	add_child(cs)
	# katup organik (digambar kode — denyut saat terkunci, menyusut saat buka)
	_flap = Polygon2D.new()
	_flap.polygon = _flap_poly(horiz, 1.0)
	_flap.color = Color(0.75, 0.3, 0.35, 1.0)
	_flap.z_index = 5
	add_child(_flap)
	var glow := PointLight2D.new()
	glow.texture = ZoneLighting.radial_texture()
	glow.color = Color(1, 0.45, 0.4, 0.9)
	glow.energy = 0.7
	glow.texture_scale = 1.6
	glow.shadow_enabled = false
	add_child(glow)
	# trigger jalan
	_trigger = Area2D.new()
	_trigger.collision_layer = 0
	_trigger.collision_mask = 2  # hanya hero
	var ts := RectangleShape2D.new()
	ts.size = Vector2(150, 110) if horiz else Vector2(110, 150)
	var tcs := CollisionShape2D.new()
	tcs.shape = ts
	_trigger.add_child(tcs)
	add_child(_trigger)
	_trigger.body_entered.connect(_on_hero)
	lock()

const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")

func _flap_poly(horiz: bool, k: float) -> PackedVector2Array:
	var w := 75.0 * k
	var h := 34.0 * k
	if horiz:
		return PackedVector2Array([Vector2(-w, -h), Vector2(0, -h * 0.4), Vector2(w, -h),
			Vector2(w * 0.7, h), Vector2(-w * 0.7, h)])
	return PackedVector2Array([Vector2(-h, -w), Vector2(-h * 0.4, 0), Vector2(-h, w),
		Vector2(h, w * 0.7), Vector2(h, -w * 0.7)])

func lock() -> void:
	locked = true
	call_deferred("_apply_collision", true)
	_trigger.set_deferred("monitoring", false)

func unlock() -> void:
	locked = false
	call_deferred("_apply_collision", false)
	_trigger.set_deferred("monitoring", true)

func _apply_collision(on: bool) -> void:
	# collision_shape pertama = dinding; disable saat terbuka
	var cs: CollisionShape2D = get_child(0)
	cs.set_deferred("disabled", not on)

func _on_hero(b: Node2D) -> void:
	if locked:
		return
	if b.is_in_group("hero") and _room != null:
		_room.request_exit(door_id, target_room)

func hero_exit_pos() -> Vector2:
	var inside := Vector2.ZERO
	match door_dir:
		"N": inside = Vector2(0, 150)
		"S": inside = Vector2(0, -150)
		"E": inside = Vector2(-150, 0)
		"W": inside = Vector2(150, 0)
	return position + inside

func _process(delta: float) -> void:
	var want := 0.0 if locked else 1.0
	_open = lerpf(_open, want, minf(1.0, delta * 4.0))
	var horiz := door_dir in ["N", "S"]
	_flap.polygon = _flap_poly(horiz, 1.0 - _open * 0.8)
	# denyut katup terkunci (terasa hidup)
	if locked:
		var p := 1.0 + 0.05 * sin(Time.get_ticks_msec() / 1000.0 * 4.0)
		_flap.scale = Vector2(p, p)
	else:
		_flap.scale = Vector2.ONE
		_flap.color = Color(0.4, 0.9, 0.6, 1.0)
