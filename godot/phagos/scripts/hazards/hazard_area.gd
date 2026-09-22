extends Area2D
## HazardArea — SATU base untuk semua hazard biome.
## ATURAN 2: hazard melukai SEMUA (hero DAN musuh). Tidak ada pengecualian:
## mask = layer hero (2) + layer musuh (4). Agent gameplay tinggal mendaftarkan
## body-nya di layer itu dan mengimplementasikan take_damage()/add_slow().
##
## Mode generik (dipetakan dari JSON "mode"):
##   damage   dps flat            | slow     faktor lambat  | current  gaya alir
##   drain_pct  %HP/detik         | ph_cycle asam↔basa 6 dtk | tide     level naik-turun
##   vapor    kolom gas           | slippery licin           | buildup  slow menumpuk
##   fog      dot+slow+gelap (Pulse membersihkan 3 dtk)     | air      arus + flip global
##   beat_push  didorong tiap denyut (jantung)
## Kontrak signal: hazard_entered / hazard_exited (type, body).
## Kontrak Pulse: on_pulse(pos, radius, on_beat) — dipanggil via group broadcast.

signal hazard_entered(hazard_type: String, body: Node2D)
signal hazard_exited(hazard_type: String, body: Node2D)

var hazard_type := "generic"
var mode := "damage"
var params := {}
var tick := 0.0
var _cycle := 0.0
var _fog_cleared := 0.0
var _buildup := {}          # body_id -> 0..1 (mode buildup)
var _beat_clock := 0.0
var _viz: Polygon2D
var _base_color := Color(1, 0.3, 0.3, 0.28)

const HERO_BIT := 2
const ENEMY_BIT := 4

func setup(hdef: Dictionary) -> void:
	hazard_type = hdef.get("type", "generic")
	mode = hdef.get("mode", "damage")
	params = hdef.get("params", {})
	collision_layer = 0
	collision_mask = HERO_BIT | ENEMY_BIT  # ATURAN 2: semua jadi korban
	monitoring = true
	var r: Array = hdef.get("rect", [0, 0, 128, 128])
	var shape := RectangleShape2D.new()
	shape.size = Vector2(r[2], r[3])
	var cs := CollisionShape2D.new()
	cs.shape = shape
	add_child(cs)
	position = Vector2(r[0] + r[2] * 0.5, r[1] + r[3] * 0.5)
	_base_color = Color(params.get("color", "#FF4444"))
	_base_color.a = 0.28
	_viz = Polygon2D.new()
	_viz.polygon = PackedVector2Array([Vector2(-r[2] / 2, -r[3] / 2), Vector2(r[2] / 2, -r[3] / 2),
		Vector2(r[2] / 2, r[3] / 2), Vector2(-r[2] / 2, r[3] / 2)])
	_viz.color = _base_color
	_viz.z_index = -2
	add_child(_viz)
	# cahaya bahaya kecil (dibagi, murah)
	var glow := PointLight2D.new()
	glow.texture = ZoneLighting.radial_texture()
	glow.color = Color(_base_color.r, _base_color.g, _base_color.b, 0.8)
	glow.energy = 0.5
	glow.texture_scale = min(r[2], r[3]) / 160.0 + 0.6
	glow.shadow_enabled = false
	add_child(glow)
	body_entered.connect(_on_enter)
	body_exited.connect(_on_exit)
	add_to_group("pulse_listener")

const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")

func _on_enter(b: Node2D) -> void:
	hazard_entered.emit(hazard_type, b)

func _on_exit(b: Node2D) -> void:
	hazard_exited.emit(hazard_type, b)
	_buildup.erase(b.get_instance_id())

func on_pulse(_pos: Vector2, _radius: float, _on_beat: bool) -> void:
	if mode == "fog":
		_fog_cleared = float(params.get("clear_sec", 3.0))

func set_air_dir(dir: Vector2) -> void:  # dipakai fitur airshift (paru)
	if mode == "air":
		params["dir_now"] = [dir.x, dir.y]

func _physics_process(delta: float) -> void:
	_cycle += delta
	if _fog_cleared > 0.0:
		_fog_cleared -= delta
		_viz.color.a = 0.05
		if _fog_cleared <= 0.0:
			_viz.color = _base_color
		return  # kabut tertiup Pulse: tidak melukai
	_pulse_viz()
	var bodies := get_overlapping_bodies()
	if bodies.is_empty():
		return
	match mode:
		"damage", "vapor":
			_apply_dps(bodies, float(params.get("dps", 10.0)), delta)
		"slow":
			_apply_slow(bodies, float(params.get("slow", 0.4)))
		"current", "air":
			var d: Array = params.get("dir_now", params.get("dir", [1, 0]))
			_apply_flow(bodies, Vector2(d[0], d[1]), float(params.get("strength", 260.0)))
		"drain_pct":
			for b in bodies:
				if b.has_method("take_damage_pct"):
					b.take_damage_pct(float(params.get("pct", 0.03)) * delta)
		"ph_cycle":
			var period := float(params.get("period", 6.0))
			if fmod(_cycle, period) < period * 0.5:  # fase asam
				_apply_dps(bodies, float(params.get("acid_dps", 10.0)), delta)
			else:  # fase basa: heal SEMUA (termasuk musuh — ATURAN 2 konsisten)
				for b in bodies:
					if b.has_method("heal"):
						b.heal(float(params.get("base_heal", 6.0)) * delta)
		"tide":
			var period := float(params.get("period", 9.0))
			var k := 0.45 + 0.55 * (0.5 + 0.5 * sin(_cycle * TAU / period))
			scale.y = k  # level cairan naik-turun (visual + area)
			_apply_dps(bodies, float(params.get("dps", 14.0)), delta)
		"slippery":
			for b in bodies:
				if b.has_method("set_slippery"):
					b.set_slippery(float(params.get("friction", 0.08)))
		"buildup":
			var rate := float(params.get("rate", 0.25))
			var mx := float(params.get("max_slow", 0.6))
			for b in bodies:
				var id := b.get_instance_id()
				var v: float = clampf(float(_buildup.get(id, 0.0)) + rate * delta, 0.0, 1.0)
				_buildup[id] = v
				if b.has_method("add_slow"):
					b.add_slow(mx * v, 0.2)
		"fog":
			_apply_dps(bodies, float(params.get("dps", 4.0)), delta)
			_apply_slow(bodies, float(params.get("slow", 0.15)))
		"beat_push":
			_beat_clock += delta
			var period := float(params.get("period", 1.0))
			if _beat_clock >= period:
				_beat_clock = 0.0
				var center: Vector2 = get_parent().get_parent().room_center_px() \
					if get_parent().get_parent().has_method("room_center_px") else global_position
				for b in bodies:
					if b is CharacterBody2D:
						var push: Vector2 = (b.global_position - center).normalized()
						if push.length() < 0.1:
							push = Vector2.RIGHT
						# gelombang dari dinding → dorong ke tengah
						b.velocity -= push * float(params.get("push", 180.0))

func _apply_dps(bodies: Array, dps: float, delta: float) -> void:
	for b in bodies:
		if b.has_method("take_damage"):
			b.take_damage(dps * delta)

func _apply_slow(bodies: Array, slow: float) -> void:
	for b in bodies:
		if b.has_method("add_slow"):
			b.add_slow(slow, 0.2)

func _apply_flow(bodies: Array, dir: Vector2, strength: float) -> void:
	for b in bodies:
		if b is CharacterBody2D:
			b.velocity += dir * strength * get_physics_process_delta_time() * 4.0

func _pulse_viz() -> void:
	if _viz == null:
		return
	if mode == "ph_cycle":
		var period := float(params.get("period", 6.0))
		var acid := fmod(_cycle, period) < period * 0.5
		_viz.color = Color(1, 0.25, 0.2, 0.32) if acid else Color(0.25, 0.5, 1, 0.32)
	else:
		_viz.color.a = 0.22 + 0.10 * sin(_cycle * 3.0)
