extends Node2D
## Zone — SATU organ: memuat rooms dari JSON, transisi antar ruangan (<0,5 dtk,
## TANPA loading screen), preload ruangan adjacent, kamera follow + look-ahead,
## minimap + HUD, CanvasModulate biome.
## Kontrak signal: zone_entered / zone_cleared / boss_defeated.

signal zone_entered(zone_id: String)
signal zone_cleared(zone_id: String)
signal boss_defeated(zone_id: String, boss_id: String)

const Json = preload("res://scripts/util/json_loader.gd")
const Minimap = preload("res://scripts/ui/minimap.gd")
const ZoneHUD = preload("res://scripts/ui/zone_hud.gd")
const ZoneLighting = preload("res://scripts/fx/zone_lighting.gd")

var zone_id := ""
var zone_def := {}
var active_room_id := ""
var active_room = null  # Room
var _rooms := {}        # room_id -> Room instance
var _states := {}       # room_id -> locked|active|cleared
var _game = null
var _busy := false      # transisi berjalan
var _cam: Camera2D
var _shake := 0.0
var _minimap: Control
var _hud: Control
var _modulate: CanvasModulate

func setup(p_zone_id: String, game_ref) -> void:
	zone_id = p_zone_id
	_game = game_ref
	zone_def = Json.load_zone(zone_id)
	for r in zone_def.get("rooms", []):
		_states[r["id"]] = "locked"
	_ensure_nodes()
	ZoneLighting.apply_zone_modulate(_modulate, zone_def.get("palette", {}))
	zone_entered.emit(zone_id)

func _ensure_nodes() -> void:
	if get_node_or_null("Rooms") == null:
		var c := Node2D.new()
		c.name = "Rooms"
		add_child(c)
	_cam = get_node_or_null("ZoneCamera")
	if _cam == null:
		_cam = Camera2D.new()
		_cam.name = "ZoneCamera"
		add_child(_cam)
	_cam.position_smoothing_enabled = true
	_cam.position_smoothing_speed = 6.0
	_cam.make_current()
	_modulate = get_node_or_null("ZoneModulate")
	if _modulate == null:
		_modulate = CanvasModulate.new()
		_modulate.name = "ZoneModulate"
		add_child(_modulate)
	var ml := get_node_or_null("MinimapLayer")
	if ml == null:
		ml = CanvasLayer.new()
		ml.name = "MinimapLayer"
		ml.layer = 10
		add_child(ml)
	_minimap = ml.get_node_or_null("Minimap")
	if _minimap == null:
		_minimap = Minimap.new()
		_minimap.name = "Minimap"
		_minimap.set_anchors_preset(Control.PRESET_TOP_RIGHT)
		_minimap.position = Vector2(-190, 12)
		_minimap.size = Vector2(178, 170)
		ml.add_child(_minimap)
	_minimap.setup(self)
	var hl := get_node_or_null("ZoneHUDLayer")
	if hl == null:
		hl = CanvasLayer.new()
		hl.name = "ZoneHUDLayer"
		hl.layer = 9
		add_child(hl)
	_hud = hl.get_node_or_null("ZoneHUD")
	if _hud == null:
		_hud = ZoneHUD.new()
		_hud.name = "ZoneHUD"
		hl.add_child(_hud)
	_hud.setup(self)

## Masuk zona: bangun entry room + preload tetangga + tempatkan hero.
func enter(hero: Node2D) -> void:
	var entry: String = zone_def.get("entry_room", "")
	_instantiate(entry, "")
	_activate(entry, "", hero)
	zone_entered.emit(zone_id)

func _instantiate(room_id: String, from_room: String):
	if _rooms.has(room_id):
		return _rooms[room_id]
	var rdef: Dictionary = Json.room_def(zone_def, room_id)
	var ps: PackedScene = load(rdef.get("scene", "res://scenes/Room.tscn"))
	var room = ps.instantiate()
	get_node("Rooms").add_child(room)
	room.setup_with_defs(zone_def, rdef, from_room)
	room.door_triggered.connect(_on_door_triggered)
	room.room_cleared.connect(_on_room_cleared)
	_rooms[room_id] = room
	room.visible = false
	return room

func _activate(room_id: String, from_room: String, hero: Node2D) -> void:
	if active_room != null:
		active_room.on_hero_exit()
		active_room.visible = false
		active_room.remove_child(hero) if hero.get_parent() == active_room else null
	active_room = _rooms[room_id]
	active_room_id = room_id
	active_room.visible = true
	active_room.set_hazards_active(true)
	if hero.get_parent() != null:
		hero.get_parent().remove_child(hero)
	active_room.add_child(hero)
	hero.position = active_room.hero_spawn_for(from_room)
	_states[room_id] = "active"
	active_room.on_hero_enter()
	if active_room.state == "locked":
		_states[room_id] = "locked"
	_cam.position = active_room.room_center_px()
	_preload_adjacent(room_id)
	_refresh_hud()

func _preload_adjacent(room_id: String) -> void:
	var rdef: Dictionary = Json.room_def(zone_def, room_id)
	var keep := {room_id: true}
	for c in rdef.get("connections", []):
		_instantiate(c, room_id)
		keep[c] = true
	# cari ruangan yang menunjuk ke sini (pintu "@prev")
	for r in zone_def.get("rooms", []):
		if room_id in r.get("connections", []) and not _rooms.has(r["id"]):
			_instantiate(r["id"], "")
			keep[r["id"]] = true
	# bebaskan yang jauh (bound memori Android)
	for id in _rooms.keys():
		if not keep.has(id):
			(_rooms[id] as Node).queue_free()
			_rooms.erase(id)

## Transisi pintu: fade 0,2 + swap + fade 0,2 = <0,5 dtk total.
func _on_door_triggered(_door_id: String, target_room: String) -> void:
	if _busy or target_room == "":
		return
	_busy = true
	var hero := get_tree().get_first_node_in_group("hero")
	_instantiate(target_room, active_room_id)
	if _game != null and _game.has_method("fade_swap"):
		await _game.fade_swap(func(): _activate(target_room, active_room_id, hero))
	else:
		_activate(target_room, active_room_id, hero)
	_busy = false
	_refresh_hud()

func _on_room_cleared(room_id: String) -> void:
	_states[room_id] = "cleared"
	if _game != null and _game.has_method("on_room_cleared"):
		_game.on_room_cleared(zone_id, room_id)
	var rdef: Dictionary = Json.room_def(zone_def, room_id)
	if rdef.get("type") == "boss":
		boss_defeated.emit(zone_id, str(zone_def.get("boss_id", "boss")))
		zone_cleared.emit(zone_id)
		if _game != null and _game.has_method("on_zone_cleared"):
			_game.on_zone_cleared(zone_id)
	_refresh_hud()

func _process(delta: float) -> void:
	# kamera follow hero + look-ahead + shake denyut
	var hero := get_tree().get_first_node_in_group("hero")
	if hero != null and _cam != null and active_room != null:
		var look := Vector2.ZERO
		if hero is CharacterBody2D:
			look = (hero as CharacterBody2D).velocity * 0.25
		var want: Vector2 = (hero as Node2D).global_position + look
		var size: Vector2 = active_room.room_size_px()
		var half := get_viewport_rect().size * 0.5 / _cam.zoom.x
		want.x = clampf(want.x, minf(half.x, size.x - half.x), maxf(half.x, size.x - half.x))
		want.y = clampf(want.y, minf(half.y, size.y - half.y), maxf(half.y, size.y - half.y))
		_cam.global_position = want
		if _shake > 0.0:
			_shake = maxf(0.0, _shake - delta * 30.0)
			_cam.offset = Vector2(randf_range(-_shake, _shake), randf_range(-_shake, _shake))
		else:
			_cam.offset = Vector2.ZERO

func add_shake(amount: float) -> void:
	_shake = minf(12.0, _shake + amount)

func get_minimap_data() -> Dictionary:
	var rooms := []
	var edges := []
	for r in zone_def.get("rooms", []):
		rooms.append({"id": r["id"], "type": r.get("type", "combat"),
			"state": _states.get(r["id"], "locked")})
		for c in r.get("connections", []):
			edges.append([r["id"], c])
	return {"rooms": rooms, "edges": edges}

func _refresh_hud() -> void:
	if _hud == null:
		return
	var rdef: Dictionary = Json.room_def(zone_def, active_room_id)
	var boss_name := ""
	var boss_frac := 1.0
	if rdef.get("type") == "boss":
		boss_name = str(zone_def.get("boss_id", "boss")).replace("_", " ").to_upper()
		var boss := get_tree().get_first_node_in_group("boss")
		if boss != null and "hp" in boss and "max_hp" in boss:
			boss_frac = clampf(float(boss.hp) / float(boss.max_hp), 0.0, 1.0)
	_hud.refresh(str(zone_def.get("name", zone_id)), active_room_id,
		"Kalahkan semua patogen!" if active_room != null and active_room.state == "locked" else "Jelajahi organ…",
		boss_name, boss_frac)

## Guard/debug: teleport tanpa fade.
func debug_teleport(room_id: String) -> bool:
	if not Json.room_def(zone_def, room_id).is_empty():
		var hero := get_tree().get_first_node_in_group("hero")
		_instantiate(room_id, active_room_id)
		_activate(room_id, active_room_id, hero)
		return true
	return false
