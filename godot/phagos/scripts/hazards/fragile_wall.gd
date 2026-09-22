extends StaticBody2D
## FragileWall — dinding rapuh (paru: jalan pintas antar ruangan) + prop
## destructible generik (jaringan). Pulse menghancurkan → buka jalan pintas
## TAPI mengundang musuh dari ruangan sebelah (trade-off).

var hp := 2
var kind := "wall"  # wall | prop
var drop := 0
var _t := 0.0
var _mesh: Polygon2D
var _w := 120.0
var _h := 90.0

func setup(hdef: Dictionary) -> void:
	setup_custom(
		Vector2(hdef["rect"][0] + hdef["rect"][2] * 0.5, hdef["rect"][1] + hdef["rect"][3] * 0.5),
		Vector2(hdef["rect"][2], hdef["rect"][3]),
		int(hdef.get("params", {}).get("hp", 2)), "wall",
		Color(hdef.get("params", {}).get("color", "#F5D7D7")),
		int(hdef.get("params", {}).get("drop", 0)))

func setup_custom(pos: Vector2, size: Vector2, p_hp: int, p_kind: String,
		color: Color, p_drop: int) -> void:
	hp = p_hp
	kind = p_kind
	drop = p_drop
	_w = size.x
	_h = size.y
	position = pos
	collision_layer = 1
	collision_mask = 0
	var cs := CollisionShape2D.new()
	var rs := RectangleShape2D.new()
	rs.size = size
	cs.shape = rs
	add_child(cs)
	_mesh = Polygon2D.new()
	_mesh.color = color
	_mesh.z_index = 2
	add_child(_mesh)
	_redraw()
	add_to_group("pulse_listener")
	add_to_group("fragile")

func on_pulse(pos: Vector2, radius: float, _on_beat: bool) -> void:
	if kind == "wall" and pos.distance_to(global_position) > radius + _w * 0.5:
		return
	take_damage(1.0)

func take_damage(amount: float, _from: Node = null) -> void:
	hp -= maxi(1, int(amount))
	_redraw()
	if hp <= 0:
		_break()

func _redraw() -> void:
	if _mesh == null:
		return
	# retakan bertambah seiring damage
	var pts := PackedVector2Array([Vector2(-_w / 2, -_h / 2), Vector2(_w / 2, -_h / 2),
		Vector2(_w / 2 * (0.9 - hp * 0.02), _h / 2), Vector2(-_w / 2, _h / 2)])
	_mesh.polygon = pts
	var k := clampf(float(hp) / 3.0, 0.25, 1.0)
	_mesh.color.a = k

func _break() -> void:
	var room = _find_room()
	if room != null and kind == "wall" and room.has_method("on_shortcut_opened"):
		room.on_shortcut_opened()
	if drop > 0 and room != null and room.has_node("Collectibles"):
		var p = PickupScript.new()
		room.get_node("Collectibles").add_child(p)
		p.position = position
		p.setup({"kind": "biokredit", "amount": drop})
	queue_free()

const PickupScript = preload("res://scripts/actors/pickup.gd")

func _find_room() -> Node:
	var n: Node = self
	while n != null:
		if n.has_method("notify_enemy_died"):
			return n
		n = n.get_parent()
	return null

func _process(delta: float) -> void:
	_t += delta
	if _mesh != null and kind == "wall":
		_mesh.rotation = 0.01 * sin(_t * 3.0)  # rapuh: bergetar halus
