extends Node2D
## Room — SATU ruangan tempur (PackedScene). Dibangun PENUH dari JSON
## (room_builder.gd) — tidak ada layout hardcode di scene.
##
## State: locked (combat: pintu terkunci) → active/cleared (pintu terbuka).
## Kontrak ke agent gameplay:
##   - SpawnPoints: Marker2D × N (+ BossSpawn di boss room) — baca get_spawn_points()
##   - HazardArea nodes dengan signal body_entered/exited (+ hazard_entered/exited)
##   - Door nodes dengan lock()/unlock()
##   - signal room_entered / room_cleared / door_triggered
##   - notify_enemy_died() / set_enemies_alive() — dipanggil spawner gameplay
##   - spawn_placeholders=true → ruangan menelurkan placeholder musuh sendiri
##     (untuk testing layout TANPA mekanik tempur; gameplay agent mematikan ini).

signal room_entered(room_id: String)
signal room_cleared(room_id: String)
signal door_triggered(door_id: String, target_room: String)

const Builder = preload("res://scripts/world/room_builder.gd")
const EnemyPh = preload("res://scripts/actors/enemy_placeholder.gd")

@export var zone_id := ""
@export var room_id := ""

var zone_def := {}
var room_def := {}
var entry_from := ""       # room id sebelumnya ("@prev" di-resolve ke ini)
var state := "active"      # locked | active | cleared
var enemies_alive := 0
var spawn_placeholders := true
var is_boss_room := false
var _spawn_nodes: Array = []
var _doors: Array = []
var _entered_once := false

func setup_with_defs(zdef: Dictionary, rdef: Dictionary, from_room: String = "") -> void:
	zone_def = zdef
	room_def = rdef
	zone_id = zdef.get("id", "")
	room_id = rdef.get("id", "")
	entry_from = from_room
	is_boss_room = rdef.get("type") == "boss"
	Builder.build(self, zdef, rdef)
	_collect()
	state = "active"

func _collect() -> void:
	_spawn_nodes = get_node("SpawnPoints").get_children() if has_node("SpawnPoints") else []
	_doors = get_node("Doors").get_children() if has_node("Doors") else []

func room_center_px() -> Vector2:
	var s: Array = room_def.get("size_tiles", [20, 15])
	return Vector2(s[0] * 64.0 * 0.5, s[1] * 64.0 * 0.5)

func room_size_px() -> Vector2:
	var s: Array = room_def.get("size_tiles", [20, 15])
	return Vector2(s[0] * 64.0, s[1] * 64.0)

func get_spawn_points() -> Array:
	return _spawn_nodes.filter(func(n): return n.name != "BossSpawn")

func get_boss_spawn() -> Node2D:
	for n in _spawn_nodes:
		if n.name == "BossSpawn":
			return n
	return null

func get_doors() -> Array:
	return _doors

func get_hazards() -> Array:
	return get_node("HazardAreas").get_children() if has_node("HazardAreas") else []

## Dipanggil Zone saat hero masuk ruangan.
func on_hero_enter() -> void:
	if not _entered_once:
		_entered_once = true
		room_entered.emit(room_id)
		if spawn_placeholders:
			_spawn_placeholders()
		if enemies_alive > 0:
			_set_locked(true)
			state = "locked"
		else:
			state = "active"
			_set_locked(false)

## Keluar ruangan (nonaktif tapi tetap di memori bila adjacent).
func on_hero_exit() -> void:
	set_hazards_active(false)

func set_hazards_active(on: bool) -> void:
	for h in get_hazards():
		h.set_deferred("monitoring", on)

func _spawn_placeholders() -> void:
	var cont := Node2D.new()
	cont.name = "Enemies_Ph"
	add_child(cont)
	for sp in get_spawn_points():
		var e: CharacterBody2D = EnemyPh.new()
		e.position = (sp as Node2D).position
		cont.add_child(e)
		e.setup(self, false)
		enemies_alive += 1
	var bs := get_boss_spawn()
	if bs != null:
		var boss: CharacterBody2D = EnemyPh.new()
		boss.position = bs.position
		cont.add_child(boss)
		boss.setup(self, true)
		enemies_alive += 1

# ---- kontrak gameplay: spawner asli memanggil ini ----
func set_enemies_alive(n: int) -> void:
	enemies_alive = n
	_set_locked(n > 0)
	state = "locked" if n > 0 else state

func notify_enemy_died(_enemy: Node) -> void:
	enemies_alive = maxi(0, enemies_alive - 1)
	if enemies_alive == 0 and state == "locked":
		_clear_room()

func _clear_room() -> void:
	state = "cleared"
	_set_locked(false)
	room_cleared.emit(room_id)
	_spawn_drop_zone_loot()

func _set_locked(locked: bool) -> void:
	for d in _doors:
		if d.has_method("lock"):
			if locked:
				d.lock()
			else:
				d.unlock()

func _spawn_drop_zone_loot() -> void:
	var dz: Array = room_def.get("drop_zone", [640, 480])
	var col: Node = get_node_or_null("Collectibles")
	if col == null:
		return
	for i in range(3):
		var p = PickupScript.new()
		p.position = Vector2(dz[0], dz[1]) + Vector2(i * 40 - 40, 0)
		col.add_child(p)
		p.setup({"kind": "biokredit", "amount": 3})

const PickupScript = preload("res://scripts/actors/pickup.gd")

## Dipanggil Door saat hero menyentuh trigger.
func request_exit(door_id: String, target: String) -> void:
	var resolved := entry_from if target == "@prev" else target
	if resolved == "" or resolved == "@prev":
		return
	door_triggered.emit(door_id, resolved)

## Posisi spawn hero saat datang dari ruangan tertentu.
func hero_spawn_for(from_room: String) -> Vector2:
	if from_room == "":
		var he: Array = room_def.get("hero_entry", [640, 500])
		return Vector2(he[0], he[1])
	for d in _doors:
		if d.target_room == from_room or (d.target_room == "@prev" and entry_from == from_room):
			return d.hero_exit_pos()
	var he2: Array = room_def.get("hero_entry", [640, 500])
	return Vector2(he2[0], he2[1])

## Dipanggil FragileWall: jalan pintas terbuka TAPI musuh ruangan sebelah masuk.
func on_shortcut_opened() -> void:
	var cont := get_node_or_null("Enemies_Ph")
	if cont == null or not spawn_placeholders:
		return
	for d in _doors:
		var e: CharacterBody2D = EnemyPh.new()
		e.position = (d as Node2D).position + Vector2(0, 120)
		cont.add_child(e)
		e.setup(self, false)
		enemies_alive += 1
		if enemies_alive >= 2:
			break
	if enemies_alive > 0:
		_set_locked(true)
		state = "locked"

## DEBUG testing layout: paksa clear (tombol K di hero placeholder).
func debug_clear() -> void:
	var cont := get_node_or_null("Enemies_Ph")
	if cont != null:
		for e in cont.get_children():
			e.queue_free()
	enemies_alive = 0
	_clear_room()
