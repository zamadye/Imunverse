extends Node2D

const ChamberSim = preload("res://chamber_sim.gd")
## DINDING MEMBRAN SOFT-BODY: 48 Sprite2D segmen (tekstur dinding AI +
## NORMAL MAP) disusun ulang tiap frame oleh ChamberSim — rantai pegas
## sungguhan, bukan garis kanvas. PointLight2D memantulkan specular basah
## di tiap segmen lewat CanvasTexture.normal_map.

var sim: ChamberSim = null
var center := Vector2.ZERO
var segs: Array = []
var wall_tex: CanvasTexture = null

func setup(sim_in, center_in: Vector2) -> void:
	sim = sim_in
	center = center_in
	wall_tex = CanvasTexture.new()
	wall_tex.diffuse_texture = _tex("res://tex/wall_tile.png")
	wall_tex.normal_map = _tex("res://tex/wall_tile_n.png")
	for i in sim.N:
		var s := Sprite2D.new()
		s.texture = wall_tex
		s.centered = true
		add_child(s)
		segs.append(s)

var _cache := {}

func _tex(path: String) -> ImageTexture:
	if _cache.has(path):
		return _cache[path]
	var img: Image = Image.load_from_file(path)
	var t := ImageTexture.create_from_image(img)
	_cache[path] = t
	return t

func _process(_dt: float) -> void:
	if sim == null:
		return
	for i in sim.N:
		var p: Dictionary = sim.pts[i]
		var a: float = p.a
		var r: float = p.r
		var pos := center + Vector2(cos(a), sin(a)) * r
		# panjang segmen LOKAL (jarak ke tetangga) — rapat di pinch, renggang di kantung
		var q: Dictionary = sim.pts[(i + 1) % sim.N]
		var pos2: Vector2 = center + Vector2(cos(float(q.a)), sin(float(q.a))) * float(q.r)
		var seg_len: float = pos.distance_to(pos2) * 1.45
		var s: Sprite2D = segs[i]
		s.position = pos
		s.rotation = a + PI / 2.0   # rim terang tile menghadap OUT (dinding)
		var tw := float(s.texture.get_width())
		var th := float(s.texture.get_height())
		s.scale = Vector2(seg_len / tw, 110.0 / th)
