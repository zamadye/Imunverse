extends StaticBody2D
## ValveGate — katup jantung antar bilik: terbuka/tertutup RITMIS.
## Lewat saat terbuka, terjebak saat tertutup. Dinding netral (mempengaruhi
## semua pihak sama — ATURAN 2 dalam bentuk denial-of-space).

var period := 4.0
var open_sec := 2.2
var _clock := 0.0
var _shape: CollisionShape2D
var _flap: Polygon2D
var _w := 200.0

func setup(hdef: Dictionary) -> void:
	var p: Dictionary = hdef.get("params", {})
	period = float(p.get("period", 4.0))
	open_sec = float(p.get("open_sec", 2.2))
	var r: Array = hdef.get("rect", [0, 0, 200, 52])
	_w = r[2]
	position = Vector2(r[0] + r[2] * 0.5, r[1] + r[3] * 0.5)
	collision_layer = 1
	collision_mask = 0
	var rs := RectangleShape2D.new()
	rs.size = Vector2(r[2], r[3])
	_shape = CollisionShape2D.new()
	_shape.shape = rs
	add_child(_shape)
	_flap = Polygon2D.new()
	_flap.color = Color(0.92, 0.88, 0.82, 0.95)
	_flap.z_index = 4
	add_child(_flap)

func is_open() -> bool:
	return fmod(_clock, period) < open_sec

func _physics_process(delta: float) -> void:
	_clock += delta
	_shape.set_deferred("disabled", is_open())

func _process(_delta: float) -> void:
	var k := 1.0 if not is_open() else 0.15
	_flap.polygon = PackedVector2Array([
		Vector2(-_w / 2, -26 * k), Vector2(0, -10 * k), Vector2(_w / 2, -26 * k),
		Vector2(_w / 2 * 0.9, 26 * k), Vector2(-_w / 2 * 0.9, 26 * k)])
