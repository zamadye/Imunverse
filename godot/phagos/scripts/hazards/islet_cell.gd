extends StaticBody2D
## IsletCell — sel penghasil insulin (pankreas): BUKAN musuh, tapi bisa rusak.
## Jika terluka (oleh musuh ATAU hero ATAU Pulse) → gelombang insulin:
## memperlambat SEMUA di radius 60% selama 3 dtk. Bisa dieksploitasi, berisiko.
## Environmental storytelling: lindungi mereka.

var hp := 4
var slow_factor := 0.6
var slow_duration := 3.0
var wave_radius := 260.0
var _cooldown := 0.0
var _contact := {}  # body_id -> detik kontak (simulasi serangan kontak)
var _core: Polygon2D
var _t := 0.0

func setup(hdef: Dictionary) -> void:
	var p: Dictionary = hdef.get("params", {})
	hp = int(p.get("hp", 4))
	slow_factor = float(p.get("slow", 0.6))
	slow_duration = float(p.get("duration", 3.0))
	wave_radius = float(p.get("radius", 260.0))
	var r: Array = hdef.get("rect", [0, 0, 68, 68])
	position = Vector2(r[0] + r[2] * 0.5, r[1] + r[3] * 0.5)
	collision_layer = 1
	collision_mask = 0
	var cs := CollisionShape2D.new()
	var circ := CircleShape2D.new()
	circ.radius = 30.0
	cs.shape = circ
	add_child(cs)
	_core = Polygon2D.new()
	_core.z_index = 3
	add_child(_core)
	var sensor := Area2D.new()
	sensor.collision_layer = 0
	sensor.collision_mask = 2 | 4  # hero + musuh
	var scs := CollisionShape2D.new()
	var scirc := CircleShape2D.new()
	scirc.radius = 44.0
	scs.shape = scirc
	sensor.add_child(scs)
	add_child(sensor)
	var l := ZoneLighting.make_light(Color(0.36, 0.68, 0.89, 0.9), 0.6, 1.4)
	add_child(l)
	add_to_group("pulse_listener")
	add_to_group("islet")

const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")

func take_damage(amount: float, _from: Node = null) -> void:
	if hp <= 0:
		return
	hp -= maxi(1, int(amount))
	_fire_insulin_wave()
	if hp <= 0:
		_die()

func on_pulse(pos: Vector2, radius: float, _on_beat: bool) -> void:
	if pos.distance_to(global_position) < radius + 30.0:
		take_damage(1.0)

func _physics_process(delta: float) -> void:
	_t += delta
	_cooldown = maxf(0.0, _cooldown - delta)
	# kontak berkepanjangan (1 dtk) = 1 damage — placeholder "diserang"
	var sensor: Area2D = get_child(2)
	for b in sensor.get_overlapping_bodies():
		var id := b.get_instance_id()
		_contact[id] = float(_contact.get(id, 0.0)) + delta
		if _contact[id] >= 1.0:
			_contact[id] = 0.0
			take_damage(1.0, b)
	_draw_core()

func _fire_insulin_wave() -> void:
	if _cooldown > 0.0:
		return
	_cooldown = 5.0
	for g in ["hero", "enemy"]:
		for b in get_tree().get_nodes_in_group(g):
			if (b as Node2D).global_position.distance_to(global_position) < wave_radius:
				if b.has_method("add_slow"):
					b.add_slow(slow_factor, slow_duration)

func _die() -> void:
	# mati → loot kecil + padam
	var col := get_parent()
	if col != null:
		for i in range(2):
			var p = PickupScript.new()
			p.position = position + Vector2(i * 36 - 18, 20)
			get_parent().get_parent().get_node("Collectibles").add_child(p)
			p.setup({"kind": "biokredit", "amount": 4})
	queue_free()

const PickupScript = preload("res://scripts/actors/pickup.gd")

func _draw_core() -> void:
	var pts := PackedVector2Array()
	var r := 26.0 + 3.0 * sin(_t * 2.5)
	for i in range(12):
		var a := i * TAU / 12.0
		pts.append(Vector2(cos(a), sin(a)) * r)
	_core.polygon = pts
	_core.color = Color(0.36, 0.68, 0.89, 1.0) if hp > 0 else Color(0.2, 0.2, 0.25, 1.0)
