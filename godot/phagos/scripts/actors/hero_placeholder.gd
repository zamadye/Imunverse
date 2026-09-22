extends CharacterBody2D
## HeroPlaceholder — kotak-yang-bisa-bergerak + cahaya (Sprint 1 #5).
## BUKAN mekanik tempur: tanpa membran, tanpa Pulse. Hanya gerak (WASD/arrows +
## drag sentuh), HP untuk menguji hazard, dan DEBUG keys:
##   K = paksa clear ruangan (testing layout) | P = Pulse DEBUG (uji hazard)
## Agent gameplay MENGGANTI node ini dengan Hero asli (layer 2, group hero).

var speed := 330.0
var max_hp := 100.0
var hp := 100.0
var _slows: Array = []  # [amount, expiry_msec]
var _slippery := 0.0
var _touch_from := Vector2.ZERO
var _touching := false
var _invuln := 0.0
var _contact_tick := 0.0
var _grind := {}  # body_id -> detik kontak (uji destructible/islet)
var _body: Polygon2D
var _t := 0.0

func _ready() -> void:
	collision_layer = 2
	collision_mask = 1  # hanya dinding (test gerak murni)
	add_to_group("hero")
	add_to_group("world_body")
	z_index = 5
	var cs := CollisionShape2D.new()
	var circ := CircleShape2D.new()
	circ.radius = 22.0
	cs.shape = circ
	add_child(cs)
	_body = Polygon2D.new()
	add_child(_body)
	# HERO = SUMBER CAHAYA UTAMA
	var light := ZoneLighting.make_light(Color(1, 0.9, 0.8, 1), 1.1, 4.2)
	add_child(light)
	var halo := Sprite2D.new()
	halo.texture = ZoneLighting.radial_texture()
	halo.modulate = Color(0.4, 0.9, 0.85, 0.35)
	halo.scale = Vector2(2.2, 2.2)
	halo.z_index = -1
	add_child(halo)
	# sensor kontak DEBUG (simulasi "serangan kontak" paling kasar)
	var contact := Area2D.new()
	contact.name = "ContactTest"
	contact.collision_layer = 0
	contact.collision_mask = 1 | 4
	var ccs := CollisionShape2D.new()
	var ccirc := CircleShape2D.new()
	ccirc.radius = 34.0
	ccs.shape = ccirc
	contact.add_child(ccs)
	add_child(contact)

const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")

func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and (ev as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		_touching = (ev as InputEventMouseButton).pressed
		_touch_from = get_global_mouse_position() if _touching else Vector2.ZERO
	elif ev is InputEventScreenTouch:
		_touching = (ev as InputEventScreenTouch).pressed
		_touch_from = (ev as InputEventScreenTouch).position if _touching else Vector2.ZERO
	elif ev is InputEventKey and (ev as InputEventKey).pressed and not (ev as InputEventKey).echo:
		match (ev as InputEventKey).keycode:
			KEY_K:
				var r := get_parent()
				if r != null and r.has_method("debug_clear"):
					r.debug_clear()
			KEY_P:
				debug_pulse()

func debug_pulse() -> void:
	# DEBUG: uji interaksi Pulse↔dunia (kabut, kristal, fragile, islet).
	get_tree().call_group("pulse_listener", "on_pulse", global_position, 260.0, false)

func _physics_process(delta: float) -> void:
	_t += delta
	_invuln = maxf(0.0, _invuln - delta)
	_slippery = maxf(0.0, _slippery - delta)
	var dir := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	if _touching:  # virtual joystick kasar: tarik dari titik awal
		var d: Vector2 = get_global_mouse_position() - _touch_from
		if d.length() > 24.0:
			dir = d.normalized() * clampf(d.length() / 160.0, 0.0, 1.0)
	var now := Time.get_ticks_msec()
	_slows = _slows.filter(func(s): return s[1] > now)
	var slow := 0.0
	for s in _slows:
		slow = maxf(slow, s[0])
	var want: Vector2 = dir * speed * (1.0 - slow)
	if _slippery > 0.0:  # empedu: meluncur
		velocity = velocity.lerp(want, 0.08)
	else:
		velocity = want
	move_and_slide()
	_contact_tick += delta
	if _contact_tick >= 0.2:
		_contact_tick = 0.0
		_grind_tick()
	_draw_body()

# ---- API kerusakan (dipakai hazard; gameplay agent bebas mengganti) ----
func take_damage(amount: float) -> void:
	if _invuln > 0.0:
		return
	hp -= amount
	if hp <= 0.0:
		_respawn()

func take_damage_pct(pct: float) -> void:
	take_damage(max_hp * pct)

func heal(amount: float) -> void:
	hp = minf(max_hp, hp + amount)

func add_slow(amount: float, duration: float) -> void:
	_slows.append([clampf(amount, 0.0, 0.9), Time.get_ticks_msec() + duration * 1000.0])

func set_slippery(duration: float) -> void:
	_slippery = maxf(_slippery, duration)

func _respawn() -> void:
	hp = max_hp
	_invuln = 2.0
	var r := get_parent()
	if r != null and r.has_method("hero_spawn_for"):
		global_position = (r as Node2D).global_position + r.hero_spawn_for("")

func _grind_tick() -> void:
	# DEBUG: kontak menggerus musuh (12 dps) tapi hero ikut luka (6 dps);
	# kontak 1 dtk merusak islet/fragile/crystal. Placeholder uji-dunia.
	var contact: Area2D = get_node_or_null("ContactTest")
	if contact == null:
		return
	for b in contact.get_overlapping_bodies():
		if b.is_in_group("enemy"):
			if b.has_method("take_damage"):
				b.take_damage(12.0 * 0.2)
			take_damage(6.0 * 0.2)
		elif b.is_in_group("islet") or b.is_in_group("fragile") or b.is_in_group("crystal"):
			var id := b.get_instance_id()
			_grind[id] = float(_grind.get(id, 0.0)) + 0.2
			if _grind[id] >= 1.0:
				_grind[id] = 0.0
				if b.has_method("take_damage"):
					b.take_damage(1.0, self)

func _draw_body() -> void:
	var pts := PackedVector2Array()
	var squash := 1.0 + 0.08 * sin(_t * 6.0)
	for i in range(12):
		var a := i * TAU / 12.0
		var r := 21.0 * (1.0 + 0.1 * sin(_t * 4.0 + i * 2.2))
		pts.append(Vector2(cos(a) * r * squash, sin(a) * r / squash))
	_body.polygon = pts
	var flash := 0.5 + 0.5 * sin(_t * 20.0) if _invuln > 0.0 else 1.0
	_body.color = Color(0.35, 0.95, 0.85, flash)
