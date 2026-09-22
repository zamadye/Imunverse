extends Node2D
## WowFeature — "momen wow" tiap ruangan (Prinsip Planet Biru): SATU elemen
## visual background yang membuat pemain berhenti sedetik. Digambar prosedural
## (murah, tanpa aset), z_index -5 (di belakang segalanya) + 1 cahaya lembut.

var kind := "peristaltic_tunnel"
var fscale := 1.0
var glow_color := Color(1, 0.7, 0.7, 0.35)
var _t := 0.0

func setup(wdef: Dictionary, pal: Dictionary) -> void:
	kind = wdef.get("kind", kind)
	position = Vector2(wdef["pos"][0], wdef["pos"][1])
	fscale = float(wdef.get("scale", 1.0))
	glow_color = Color(pal.get("glow", "#FFAAAA"))
	glow_color.a = 0.35
	z_index = -5
	var l := ZoneLighting.make_light(glow_color, 0.5, 5.0 * fscale)
	add_child(l)

const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")

func _process(delta: float) -> void:
	_t += delta
	queue_redraw()

func _draw() -> void:
	match kind:
		"peristaltic_tunnel":  # cincin otot raksasa berdenyut
			for i in range(4):
				var r := (70.0 + i * 55.0) * fscale * (1.0 + 0.06 * sin(_t * 2.0 - i * 0.7))
				draw_arc(Vector2.ZERO, r, 0, TAU, 48, glow_color.darkened(i * 0.12), 14.0 * fscale)
		"nutrient_rain":  # hujan emas nutrisi
			for i in range(26):
				var px := sin(i * 2.39) * 300.0 * fscale
				var py := fmod(i * 97.0 + _t * (40.0 + i * 3.0), 420.0) - 210.0
				draw_circle(Vector2(px, py * fscale), 2.5 + fmod(i, 3), glow_color)
		"crystal_cavern":  # kristal membiaskan cahaya
			for i in range(7):
				var a := i * TAU / 7.0 + 0.3
				var h := (90.0 + 60.0 * sin(i * 3.7)) * fscale
				var tip := Vector2(cos(a), sin(a)) * h + Vector2(0, -_t * 4.0 + 60.0 * fscale)
				var base := Vector2(cos(a), sin(a)) * 30.0 * fscale + Vector2(0, 60.0 * fscale)
				var perp := Vector2(-sin(a), cos(a)) * 16.0 * fscale
				draw_colored_polygon([base - perp, tip, base + perp],
					glow_color.lightened(0.2 - 0.05 * i))
		"acid_tide":  # permukaan asam bergelombang
			var pts := PackedVector2Array()
			for i in range(25):
				var x := (i - 12) * 30.0 * fscale
				pts.append(Vector2(x, sin(_t * 1.6 + i * 0.5) * 18.0 * fscale))
			pts.append(Vector2(390 * fscale, 300 * fscale))
			pts.append(Vector2(-390 * fscale, 300 * fscale))
			draw_colored_polygon(pts, Color(glow_color.r, glow_color.g, glow_color.b, 0.22))
		"islet_constellation":  # gugus islet biru berdenyut
			for i in range(9):
				var pp := Vector2(sin(i * 2.7) * 260, cos(i * 1.9) * 130) * fscale
				draw_circle(pp, (10.0 + 4.0 * sin(_t * 2.0 + i)) * fscale, glow_color)
				draw_arc(pp, (22.0 + 6.0 * sin(_t * 2.0 + i)) * fscale, 0, TAU, 24,
					Color(glow_color.r, glow_color.g, glow_color.b, 0.25), 3.0)
		"kupffer_patrol":  # siluet macrophage raksasa melayang
			var drift := Vector2(sin(_t * 0.4) * 60, cos(_t * 0.3) * 30) * fscale
			for ring in range(3):
				draw_arc(drift, (60.0 + ring * 40.0) * fscale, 0, TAU, 40,
					Color(0.5, 0.25, 0.2, 0.5 - ring * 0.12), 20.0 * fscale)
		"alveolar_window":  # jendela kapiler: sel darah lewat
			draw_circle(Vector2.ZERO, 190 * fscale, Color(0.4, 0.1, 0.12, 0.55))
			draw_arc(Vector2.ZERO, 190 * fscale, 0, TAU, 64, glow_color, 10.0 * fscale)
			for i in range(8):
				var rx := fmod(i * 160.0 + _t * 60.0, 340.0) - 170.0
				draw_circle(Vector2(rx * fscale, sin(i * 3.1) * 90 * fscale), 13 * fscale,
					Color(0.85, 0.2, 0.2, 0.8))
		"great_valve":  # katup raksasa buka-tutup ritmis
			var open := 0.5 + 0.5 * sin(_t * TAU)  # 1 Hz = denyut jantung
			for s in [-1, 1]:
				var pts := PackedVector2Array([Vector2(0, -150 * fscale),
					Vector2(s * (60 + 130 * open) * fscale, 0),
					Vector2(0, 150 * fscale), Vector2(s * 30 * fscale, 0)])
				draw_colored_polygon(pts, Color(0.9, 0.85, 0.8, 0.5))
