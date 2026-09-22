extends StaticBody2D
## SharpCrystal — kristal tajam ginjal: formasi statis, sentuh = damage.
## Pulse menghancurkan → drop Biokredit. Dipakai juga sebagai destructible
## umum (kind crystal) di semua zona.

var hp := 3
var dps := 12.0
var drop := 5
var _t := 0.0
var _mesh: Polygon2D

func setup(hdef: Dictionary) -> void:
	var p: Dictionary = hdef.get("params", {})
	hp = int(p.get("hp", 3))
	dps = float(p.get("dps", 12.0))
	drop = int(p.get("drop", 5))
	var r: Array = hdef.get("rect", [0, 0, 80, 80])
	setup_custom(Vector2(r[0] + r[2] * 0.5, r[1] + r[3] * 0.5), r[2] * 0.5,
		hp, dps, drop, Color(p.get("color", "#E8E8F0")))

func setup_custom(pos: Vector2, radius: float, p_hp: int, p_dps: float,
		p_drop: int, color: Color) -> void:
	hp = p_hp
	dps = p_dps
	drop = p_drop
	position = pos
	collision_layer = 1
	collision_mask = 0
	var cs := CollisionShape2D.new()
	var circ := CircleShape2D.new()
	circ.radius = radius * 0.7
	cs.shape = circ
	add_child(cs)
	# aura tajam: melukai hero + musuh yang menyentuh
	var aura := Area2D.new()
	aura.collision_layer = 0
	aura.collision_mask = 2 | 4
	var acs := CollisionShape2D.new()
	var acirc := CircleShape2D.new()
	acirc.radius = radius
	acs.shape = acirc
	aura.add_child(acs)
	add_child(aura)
	_mesh = Polygon2D.new()
	_mesh.color = color
	_mesh.z_index = 2
	add_child(_mesh)
	_redraw(radius)
	add_to_group("pulse_listener")
	add_to_group("crystal")

func on_pulse(pos: Vector2, radius: float, _on_beat: bool) -> void:
	if pos.distance_to(global_position) < radius + 40.0:
		take_damage(1.0)

func take_damage(amount: float, _from: Node = null) -> void:
	hp -= maxi(1, int(amount))
	if hp <= 0:
		_break()
	elif _mesh != null:
		_mesh.color.a = clampf(float(hp) / 3.0, 0.3, 1.0)

func _physics_process(delta: float) -> void:
	_t += delta
	var aura: Area2D = get_child(1)
	for b in aura.get_overlapping_bodies():
		if b.has_method("take_damage"):
			b.take_damage(dps * delta)
	if _mesh != null:
		_mesh.rotation = 0.05 * sin(_t * 1.5)

func _redraw(radius: float) -> void:
	var pts := PackedVector2Array()
	for i in range(6):  # kristal heksagonal
		var a := i * TAU / 6.0
		pts.append(Vector2(cos(a), sin(a)) * radius)
		var a2 := (i + 0.5) * TAU / 6.0
		pts.append(Vector2(cos(a2), sin(a2)) * radius * 0.55)
	_mesh.polygon = pts

func _break() -> void:
	var room := _find_room()
	if drop > 0 and room != null and room.has_node("Collectibles"):
		for i in range(2):
			var p = PickupScript.new()
			room.get_node("Collectibles").add_child(p)
			p.position = position + Vector2(i * 36 - 18, 16)
			p.setup({"kind": "biokredit", "amount": maxi(1, drop / 2)})
	queue_free()

const PickupScript = preload("res://scripts/actors/pickup.gd")

func _find_room() -> Node:
	var n: Node = self
	while n != null:
		if n.has_method("notify_enemy_died"):
			return n
		n = n.get_parent()
	return null
