extends StaticBody2D
## NpcVendor — sel komensal ramah penjaga TOKO (placeholder visual + posisi).
## Ekonomi/toko BUKAN tugasku (game bible) — node ini hanya menandai "toko ada
## di sini" + titik interaksi untuk agent lain.

var _t := 0.0
var _blob: Polygon2D

func setup(vdef: Dictionary) -> void:
	position = Vector2(vdef["pos"][0], vdef["pos"][1])
	collision_layer = 1
	collision_mask = 0
	var cs := CollisionShape2D.new()
	var circ := CircleShape2D.new()
	circ.radius = 30.0
	cs.shape = circ
	add_child(cs)
	_blob = Polygon2D.new()
	_blob.z_index = 3
	add_child(_blob)
	var label := Label.new()
	label.text = "TOKO"
	label.position = Vector2(-24, -64)
	label.add_theme_font_size_override("font_size", 22)
	label.add_theme_color_override("font_color", Color(0.5, 1, 0.8))
	add_child(label)
	var l := ZoneLighting.make_light(Color(0.4, 1, 0.8, 0.9), 0.7, 1.8)
	add_child(l)
	add_to_group("vendor")

const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")

func interact(_by: Node) -> String:
	return "Toko dibuka oleh agent lain (placeholder)."

func _process(delta: float) -> void:
	_t += delta
	var pts := PackedVector2Array()
	for i in range(12):
		var a := i * TAU / 12.0
		pts.append(Vector2(cos(a), sin(a)) * (28.0 + 3.0 * sin(_t * 2.0 + i)))
	_blob.polygon = pts
	_blob.color = Color(0.45, 0.95, 0.7, 1.0)
