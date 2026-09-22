extends Area2D
## Pickup — Biokredit / fragment / peti. Magnet ke hero, emas bercahaya.
## Budget cahaya: hanya chest & fragment bawa lampu; biokredit poligon glow saja.

var kind := "biokredit"
var amount := 1
var _t := 0.0
var _mesh: Polygon2D
var _taken := false

func setup(pdef: Dictionary) -> void:
	kind = pdef.get("kind", "biokredit")
	amount = int(pdef.get("amount", 1))
	position = Vector2(pdef["pos"][0], pdef["pos"][1])
	collision_layer = 0
	collision_mask = 2  # hero saja yang memungut
	var cs := CollisionShape2D.new()
	var circ := CircleShape2D.new()
	circ.radius = 30.0 if kind == "chest" else 20.0
	cs.shape = circ
	add_child(cs)
	_mesh = Polygon2D.new()
	_mesh.z_index = 2
	add_child(_mesh)
	if kind != "biokredit":
		var l := ZoneLighting.make_light(Color(1, 0.85, 0.4, 0.9), 0.5, 1.1)
		add_child(l)

const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")

func _physics_process(delta: float) -> void:
	_t += delta
	var hero := get_tree().get_first_node_in_group("hero")
	if hero != null and not _taken:
		var d: float = (hero as Node2D).global_position.distance_to(global_position)
		if d < 150.0:  # magnet
			global_position = global_position.lerp((hero as Node2D).global_position, minf(1.0, delta * 6.0))
		if d < 30.0:
			_collect(hero)
	_draw_mesh()

func _collect(_hero: Node) -> void:
	_taken = true
	var game := get_tree().get_first_node_in_group("game")
	if game != null and game.has_method("debug_collect"):
		game.debug_collect(kind, amount)
	queue_free()

func _draw_mesh() -> void:
	if _mesh == null:
		return
	var bob := sin(_t * 3.0) * 3.0
	_mesh.position.y = bob
	match kind:
		"chest":
			_mesh.polygon = PackedVector2Array([Vector2(-24, -10), Vector2(24, -10),
				Vector2(24, 16), Vector2(-24, 16)])
			_mesh.color = Color(0.95, 0.75, 0.3, 1.0)
		"fragment":
			_mesh.polygon = PackedVector2Array([Vector2(0, -16), Vector2(12, 0),
				Vector2(0, 16), Vector2(-12, 0)])
			_mesh.color = Color(0.55, 0.85, 1, 1.0)
		_:
			var r := 9.0 + 2.0 * sin(_t * 5.0)
			_mesh.polygon = PackedVector2Array([Vector2(0, -r), Vector2(r, 0),
				Vector2(0, r), Vector2(-r, 0)])
			_mesh.color = Color(1, 0.85, 0.35, 1.0)
