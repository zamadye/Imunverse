extends RefCounted
## AmbientParticles — SETIAP ruangan punya partikel ambient (dunia BASAH & HIDUP).
## CPUParticles2D (aman Android + Web) dengan budget kecil: 24-48 partikel,
## lifetime pendek, tekstur radial bersama. Konfig per biome:

const CFG := {
	"usus_besar": {"n": 40, "c": "#B8E6C4", "dir": [0, -1], "spd": 26, "drift": 30},
	"usus_halus": {"n": 44, "c": "#FFD98A", "dir": [0, -1], "spd": 34, "drift": 40},
	"ginjal": {"n": 36, "c": "#CFEAFF", "dir": [0, -1], "spd": 30, "drift": 22},
	"lambung": {"n": 40, "c": "#E2F47A", "dir": [0, -1], "spd": 44, "drift": 26},
	"pankreas": {"n": 28, "c": "#C9ECFF", "dir": [1, 0], "spd": 22, "drift": 18},
	"hati": {"n": 48, "c": "#E8D27A", "dir": [1, 0], "spd": 18, "drift": 34},
	"paru": {"n": 44, "c": "#E4F2FF", "dir": [1, 0], "spd": 40, "drift": 44},
	"jantung": {"n": 48, "c": "#FFC4B8", "dir": [0, -1], "spd": 90, "drift": 60},
}

static func build(parent: Node, zone_id: String, size_px: Vector2) -> CPUParticles2D:
	var c: Dictionary = CFG.get(zone_id, CFG["usus_besar"])
	var p := CPUParticles2D.new()
	p.name = "Ambient"
	p.amount = c["n"]
	p.lifetime = 5.0
	p.preprocess = 5.0  # langsung penuh saat ruangan dibuka
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.emission_rect_extents = Vector2(size_px.x * 0.5, size_px.y * 0.5)
	p.direction = Vector2(c["dir"][0], c["dir"][1])
	p.spread = 35.0
	p.initial_velocity_min = c["spd"] * 0.6
	p.initial_velocity_max = c["spd"] * 1.4
	p.damping_min = 4.0
	p.damping_max = 10.0
	p.scale_amount_min = 1.5
	p.scale_amount_max = 4.0
	p.color = Color(c["c"])
	p.texture = ZoneLighting.radial_texture()
	p.z_index = -3
	p.position = size_px * 0.5
	parent.add_child(p)
	return p

const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")
