extends CharacterBody2D
## KupfferCell — macrophage hati, NPC NETRAL: menyerang SIAPA SAJA (hero +
## musuh) yang terlalu dekat. Tidak bisa dibunuh, hanya dihindari. Patroli rute
## tetap. Layer sendiri (16) — kebal hazard, menabrak dinding saja.

var patrol: Array = []
var speed := 90.0
var dps := 15.0
var radius := 70.0
var _idx := 0
var _t := 0.0
var _blob: Polygon2D

func setup(hdef: Dictionary) -> void:
	var p: Dictionary = hdef.get("params", {})
	patrol = p.get("patrol", [[0, 0]])
	speed = float(p.get("speed", 90.0))
	dps = float(p.get("dps", 15.0))
	radius = float(p.get("radius", 70.0))
	var r: Array = hdef.get("rect", [0, 0, 60, 60])
	position = Vector2(r[0] + r[2] * 0.5, r[1] + r[3] * 0.5)
	collision_layer = 16
	collision_mask = 1
	var cs := CollisionShape2D.new()
	var circ := CircleShape2D.new()
	circ.radius = 34.0
	cs.shape = circ
	add_child(cs)
	_blob = Polygon2D.new()
	_blob.z_index = 3
	add_child(_blob)
	add_to_group("kupffer")

func is_invulnerable() -> bool:
	return true

func take_damage(_amount: float) -> void:
	pass  # TIDAK BISA DIBUNUH — hanya dihindari

func take_damage_pct(_pct: float) -> void:
	pass

func _physics_process(delta: float) -> void:
	_t += delta
	if not patrol.is_empty():
		var target := Vector2(patrol[_idx][0], patrol[_idx][1])
		var d: Vector2 = target - position
		if d.length() < 20.0:
			_idx = (_idx + 1) % patrol.size()
		else:
			velocity = d.normalized() * speed
			move_and_slide()
	# serang SEMUA di radius (hero + musuh)
	for g in ["hero", "enemy"]:
		for b in get_tree().get_nodes_in_group(g):
			if (b as Node2D).global_position.distance_to(global_position) < radius + 20.0:
				if b.has_method("take_damage"):
					b.take_damage(dps * delta)
	_draw_blob()

func _draw_blob() -> void:
	var pts := PackedVector2Array()
	for i in range(14):
		var a := i * TAU / 14.0
		var r := 34.0 + 8.0 * sin(_t * 3.0 + i * 1.7)
		pts.append(Vector2(cos(a), sin(a)) * r)
	_blob.polygon = pts
	_blob.color = Color(0.55, 0.3, 0.35, 1.0)
