extends CharacterBody2D
## EnemyPlaceholder — dummy StaticBody-yang-bisa-mati (Sprint 1 #6).
## Mengembara di ruangan untuk menguji: lock pintu, hazard-mengenai-musuh,
## room_cleared. BUKAN AI musuh (agent gameplay mengganti total).
## Kontrak yang dipakai: take_damage/take_damage_pct/heal/add_slow/set_slippery,
## group "enemy"+"world_body", layer 4.

var max_hp := 30.0
var hp := 30.0
var speed := 90.0
var is_boss := false
var _room = null
var _target := Vector2.ZERO
var _retarget := 0.0
var _slows: Array = []
var _slippery := 0.0
var _t := 0.0
var _rng := RandomNumberGenerator.new()
var _mesh: Polygon2D

func setup(room_ref, boss: bool = false) -> void:
	_room = room_ref
	is_boss = boss
	collision_layer = 4
	collision_mask = 1
	add_to_group("enemy")
	add_to_group("world_body")
	z_index = 4
	_rng.randomize()
	var cs := CollisionShape2D.new()
	var circ := CircleShape2D.new()
	circ.radius = 40.0 if boss else 18.0
	cs.shape = circ
	add_child(cs)
	_mesh = Polygon2D.new()
	add_child(_mesh)
	if boss:
		max_hp = 400.0
		hp = 400.0
		speed = 60.0
		add_to_group("boss")
		var l := ZoneLighting.make_light(Color(1, 0.3, 0.3, 0.9), 0.8, 3.0)
		add_child(l)

const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")

func _physics_process(delta: float) -> void:
	_t += delta
	_slippery = maxf(0.0, _slippery - delta)
	var now := Time.get_ticks_msec()
	_slows = _slows.filter(func(s): return s[1] > now)
	var slow := 0.0
	for s in _slows:
		slow = maxf(slow, s[0])
	_retarget -= delta
	if _retarget <= 0.0 or (_target - position).length() < 30.0:
		_retarget = _rng.randf_range(2.0, 4.0)
		_target = _random_point()
	var want := Vector2.ZERO
	if _target != Vector2.ZERO:
		want = (_target - position).normalized() * speed * (1.0 - slow)
	if _slippery > 0.0:
		velocity = velocity.lerp(want, 0.08)
	else:
		velocity = want
	move_and_slide()
	_draw_mesh()

func _random_point() -> Vector2:
	if _room == null:
		return position + Vector2(100, 0)
	var size: Vector2 = _room.room_size_px()
	return Vector2(_rng.randf_range(120, size.x - 120), _rng.randf_range(120, size.y - 120))

func take_damage(amount: float) -> void:
	hp -= amount
	if hp <= 0.0:
		die()

func take_damage_pct(pct: float) -> void:
	take_damage(max_hp * pct)

func heal(amount: float) -> void:
	hp = minf(max_hp, hp + amount)

func add_slow(amount: float, duration: float) -> void:
	_slows.append([clampf(amount, 0.0, 0.9), Time.get_ticks_msec() + duration * 1000.0])

func set_slippery(duration: float) -> void:
	_slippery = maxf(_slippery, duration)

func die() -> void:
	if _room != null and _room.has_method("notify_enemy_died"):
		_room.notify_enemy_died(self)
	queue_free()

func _draw_mesh() -> void:
	var pts := PackedVector2Array()
	var base := 38.0 if is_boss else 17.0
	var spikes := 10 if is_boss else 7
	for i in range(spikes * 2):
		var a := i * TAU / float(spikes * 2)
		var r := base * (1.35 if i % 2 == 0 else 0.85)
		r *= 1.0 + 0.07 * sin(_t * 5.0 + i)
		pts.append(Vector2(cos(a), sin(a)) * r)
	_mesh.polygon = pts
	_mesh.color = Color(0.8, 0.2, 0.25, 1.0) if is_boss else Color(0.6, 0.35, 0.7, 1.0)
