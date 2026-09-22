extends Node2D
## ARENA TERTUTUP — vertical slice Godot (benchmark visual kelas Pathogenic).
## Teknologi engine-native yang dipakai (mandat owner):
##   • soft-body spring ring (chamber_sim.gd + spring_ring.gd)
##   • CanvasTexture + NORMAL MAP → PointLight2D = pencahayaan basah/berkedalaman
##   • GPUParticles2D eritrosit dengan damping = fluid drag
##   • ParallaxBackground 3 lapis = kedalaman biologis
##   • bloom pasca-proses (bloom.gdshader) = glow HDR proyektil/bioluminesensi

const SimScript = preload("res://chamber_sim.gd")
const RingScript = preload("res://spring_ring.gd")

var sim: SimScript = null
var ring: Node2D = null
var center := Vector2(0.0, 0.0)
var player_light: PointLight2D = null
var lumi_lights: Array = []
var bullets: Array = []
var bullet_lights: Array = []
var enemies: Array = []
var glow_tex: ImageTexture = null
var player_glow: Sprite2D = null
var bullet_glows: Array = []
var lumi_glows: Array = []
var elapsed := 0.0
var state_label: Label = null

func _ready() -> void:
	# bentuk organ-like asimetris + pilar (port data shape arenas.json kapiler)
	var shape := {
		"harmonics": [[2, 0.38, 0.2], [3, 0.18, 3.6], [6, 0.08, 1.4]],
		"stretch": [1.5, 0.6, 1.0],
		"pillars": [{"a": 1.57, "d": 0.20, "len": 380, "wid": 100, "bend": 0.3}],
	}
	sim = SimScript.new(640.0, 5, 74.0, 10.0, shape)
	glow_tex = _radial_texture()
	_build_parallax()
	_build_floor()
	ring = RingScript.new()
	ring.set_script(RingScript)
	add_child(ring)
	ring.setup(sim, center)
	_build_particles()
	_build_pillars()
	_build_lights()
	_build_bullets()
	_build_post()
	_build_camera()
	_build_label()

var _texcache := {}

func _tex(path: String) -> ImageTexture:
	if _texcache.has(path):
		return _texcache[path]
	var img: Image = Image.load_from_file(path)
	var t := ImageTexture.create_from_image(img)
	_texcache[path] = t
	return t

func _radial_texture() -> ImageTexture:
	var sz := 64
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	for y in sz:
		for x in sz:
			var d := Vector2(x - sz / 2.0, y - sz / 2.0).length() / (sz / 2.0)
			var a := clampf(1.0 - d, 0.0, 1.0)
			img.set_pixel(x, y, Color(1, 1, 1, pow(a, 2.2)))
	return ImageTexture.create_from_image(img)

func _floor_tex() -> CanvasTexture:
	var ct := CanvasTexture.new()
	ct.diffuse_texture = _tex("res://tex/flesh_floor.png")
	ct.normal_map = _tex("res://tex/flesh_floor_n.png")
	return ct

func _build_parallax() -> void:
	var pb := ParallaxBackground.new()
	add_child(pb)
	var deep := ParallaxLayer.new()
	deep.motion_scale = Vector2(0.35, 0.35)
	var sd := Sprite2D.new()
	sd.texture = _floor_tex()
	sd.modulate = Color(0.35, 0.12, 0.16, 1.0)
	sd.scale = Vector2(6.0, 6.0)
	deep.add_child(sd)
	pb.add_child(deep)
	var mid := ParallaxLayer.new()
	mid.motion_scale = Vector2(0.65, 0.65)
	var sm := Sprite2D.new()
	sm.texture = _floor_tex()
	sm.modulate = Color(0.75, 0.30, 0.28, 0.25)
	sm.scale = Vector2(8.0, 8.0)
	sm.rotation = 0.7
	mid.add_child(sm)
	pb.add_child(mid)
	var front := ParallaxLayer.new()
	front.motion_scale = Vector2(1.25, 1.25)
	for i in 14:
		var sp := Sprite2D.new()
		sp.texture = _tex("res://tex/erythrocyte_a.png")
		sp.modulate = Color(1, 1, 1, 0.16)
		var sc := randf_range(0.05, 0.14)
		sp.scale = Vector2(sc, sc)
		sp.position = Vector2(randf_range(-900, 900), randf_range(-600, 600))
		front.add_child(sp)
	pb.add_child(front)

func _build_floor() -> void:
	var f := Sprite2D.new()
	f.texture = _floor_tex()
	var sc: float = (2.0 * float(sim.R) + 260.0) / float(f.texture.get_width())
	f.scale = Vector2(sc, sc)
	f.position = center
	add_child(f)

func _build_particles() -> void:
	var gp := GPUParticles2D.new()
	gp.amount = 90
	gp.lifetime = 7.0
	gp.texture = _tex("res://tex/erythrocyte_a.png")
	var m := ParticleProcessMaterial.new()
	m.direction = Vector3(1, 0.3, 0)
	m.spread = 180.0
	m.initial_velocity_min = 18.0
	m.initial_velocity_max = 46.0
	m.damping_min = 22.0      # fluid drag: partikel lembam, tidak balistik
	m.damping_max = 34.0
	m.gravity = Vector3.ZERO
	m.scale_min = 0.06
	m.scale_max = 0.13
	m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	m.emission_sphere_radius = sim.R * 0.8
	gp.process_material = m
	gp.position = center
	add_child(gp)

func _build_pillars() -> void:
	# massa gelap internal (cover non-konveks) + rim menyala tipis
	for pi in sim.pillars:
		var b := Sprite2D.new()
		b.texture = glow_tex
		b.modulate = Color(0.10, 0.03, 0.06, 0.96)
		var sc: float = float(pi.r) * 3.4 / 64.0
		b.scale = Vector2(sc, sc)
		b.position = center + Vector2(pi.x, pi.y)
		add_child(b)
		var rim := Sprite2D.new()
		rim.texture = glow_tex
		rim.modulate = Color(1.0, 0.45, 0.38, 0.30)
		rim.scale = Vector2(sc * 1.18, sc * 1.18)
		rim.position = b.position
		var m := CanvasItemMaterial.new()
		m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		rim.material = m
		add_child(rim)

func _build_lights() -> void:
	player_light = PointLight2D.new()
	player_light.texture = glow_tex
	player_light.color = Color(1.0, 0.82, 0.55)
	player_light.energy = 1.25
	player_light.texture_scale = 7.0
	player_light.position = center
	add_child(player_light)
	for i in 2:  # bioluminesensi pengembara (teal)
		var l := PointLight2D.new()
		l.texture = glow_tex
		l.color = Color(0.35, 1.0, 0.85)
		l.energy = 0.8
		l.texture_scale = 4.5
		add_child(l)
		lumi_lights.append(l)

func _build_bullets() -> void:
	var cols := [Color(1.0, 0.25, 0.75), Color(0.45, 1.0, 0.35), Color(0.35, 0.85, 1.0)]
	for i in 3:
		var b := Sprite2D.new()
		b.texture = glow_tex
		b.modulate = cols[i]
		b.scale = Vector2(0.35, 0.35)
		add_child(b)
		bullets.append(b)
		var l := PointLight2D.new()
		l.texture = glow_tex
		l.color = cols[i]
		l.energy = 1.6
		l.texture_scale = 3.2
		add_child(l)
		bullet_lights.append(l)

func _add_glow(parent: Node2D, col: Color, sc: float) -> Sprite2D:
	var g := Sprite2D.new()
	g.texture = glow_tex
	g.modulate = col
	g.scale = Vector2(sc, sc)
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	g.material = m
	parent.add_child(g)
	return g

func _build_post() -> void:
	# GLOW aditif kelas HDR (compat-web safe): billboard additif di tiap sumber
	# cahaya/proyektil — padanan WorldEnvironment->Glow untuk renderer web.
	_add_glow(self, Color(1.0, 0.8, 0.5, 0.55), 9.0)   # halo pemain
	player_glow = _add_glow(self, Color(1.0, 0.8, 0.5, 0.5), 9.0)
	for i in bullets.size():
		var cols := [Color(1.0, 0.25, 0.75), Color(0.45, 1.0, 0.35), Color(0.35, 0.85, 1.0)]
		bullet_glows.append(_add_glow(self, cols[i], 2.6))
	for i in 2:
		lumi_glows.append(_add_glow(self, Color(0.35, 1.0, 0.85, 0.8), 4.0))

func _build_camera() -> void:
	var cam := Camera2D.new()
	cam.position = center
	cam.zoom = Vector2(0.52, 0.52)
	add_child(cam)
	cam.make_current()

func _build_label() -> void:
	state_label = Label.new()
	state_label.position = Vector2(24, 16)
	state_label.add_theme_font_size_override("font_size", 22)
	state_label.add_theme_color_override("font_color", Color(1.0, 0.85, 0.75))
	var cl := CanvasLayer.new()
	cl.layer = 110
	cl.add_child(state_label)
	add_child(cl)

func _process(dt: float) -> void:
	elapsed += dt
	var alive := 0
	for e in enemies:
		if is_instance_valid(e) and e.visible:
			alive += 1
	sim.step_state(dt, alive)
	for ev in sim.events:
		if ev == "swarm_start":
			_spawn_enemies()
		elif ev == "purified":
			for e in enemies:
				if is_instance_valid(e):
					e.visible = false
	# musuh lenyap perlahan (dimakan) → purified terpicu natural
	if sim.state == "swarm":
		for i in enemies.size():
			var e = enemies[i]
			if is_instance_valid(e) and e.visible and fmod(elapsed, 1.7) < dt and i == int(elapsed / 1.7) % enemies.size():
				e.visible = false
	# dinding & pintu
	ring.queue_redraw()
	# proyektil mengorbit; sesekali menghantam dinding → jiggle + kilat cahaya
	for i in bullets.size():
		var b: Sprite2D = bullets[i]
		var aa: float = elapsed * (0.9 + 0.23 * float(i)) + float(i) * 2.1
		var rr: float = float(sim.R) * (0.55 + 0.42 * abs(sin(elapsed * 0.7 + float(i))))
		var pos: Vector2 = center + Vector2(cos(aa), sin(aa)) * rr
		var prev := b.position
		b.position = pos
		bullet_lights[i].position = pos
		if rr > sim.radius_at(aa) - 30.0 and (prev - center).length() < rr:
			sim.apply_impact(aa, 9.0)
			bullet_lights[i].energy = 3.0
		else:
			bullet_lights[i].energy = lerpf(bullet_lights[i].energy, 1.6, 0.1)
	# bioluminesensi mengarungi cincin membran dalam
	for i in lumi_lights.size():
		var la: float = elapsed * (0.11 + 0.047 * float(i)) + float(i) * 2.094
		lumi_lights[i].position = center + Vector2(cos(la), sin(la)) * maxf(40.0, sim.radius_at(la) - 60.0)
		lumi_lights[i].energy = 0.7 + 0.35 * sin(elapsed * 2.1 + float(i) * 2.4)
	# denyut cahaya pemain + posisi glow
	player_light.energy = 1.15 + 0.35 * sim.beat()
	if player_glow:
		player_glow.position = center
		player_glow.modulate.a = 0.35 + 0.25 * sim.beat()
	for i in bullet_glows.size():
		bullet_glows[i].position = bullets[i].position
	for i in lumi_glows.size():
		lumi_glows[i].position = lumi_lights[i].position
	if state_label:
		state_label.text = "ARENA: %s   patogen %d   pintu %.2f" % [sim.state.to_upper(), alive, sim.open_amt]

func _spawn_enemies() -> void:
	for i in 6:
		var e := Sprite2D.new()
		e.texture = glow_tex
		e.modulate = Color(0.95, 0.35, 0.3, 1.0)
		e.scale = Vector2(0.5, 0.5)
		var aa := randf_range(0, TAU)
		var rr := float(sim.radius_at(aa)) * randf_range(0.35, 0.72)
		e.position = center + Vector2(cos(aa), sin(aa)) * rr
		add_child(e)
		enemies.append(e)
