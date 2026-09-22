extends Node
## Game — root orkestrasi dunia: WORLD MAP ⇄ CORRIDOR ⇄ ZONE.
## Pass-through signal: zone_entered / zone_cleared / boss_defeated.
## Hero placeholder dibuat SEKALI dan di-reparent antar ruangan/zona
## (agent gameplay mengganti pabrik hero ini dengan Hero asli).
## ESC = kembali ke world map (debug travel).

signal zone_entered(zone_id: String)
signal zone_cleared(zone_id: String)
signal boss_defeated(zone_id: String, boss_id: String)

const SaveWorld = preload("res://scripts/core/save_world.gd")
const Fade = preload("res://scripts/world/fade.gd")
const HeroPh = preload("res://scripts/actors/hero_placeholder.gd")

var state := {}
var current_zone_id := ""
var current: Node = null
var hero: CharacterBody2D = null
var fade: CanvasLayer = null
var bank := 0  # Biokredit DEBUG (ekonomi asli milik game bible)

func _ready() -> void:
	add_to_group("game")
	state = SaveWorld.load_state()
	current_zone_id = str(state.get("current_zone", ""))
	fade = Fade.new()
	fade.name = "TransitionFade"
	add_child(fade)
	hero = HeroPh.new()
	hero.name = "HeroPlaceholder"
	show_map()

func _clear_current() -> void:
	if hero != null and hero.get_parent() != null:
		hero.get_parent().remove_child(hero)
	if current != null:
		remove_child(current)
		current.queue_free()
		current = null

func show_map() -> void:
	_clear_current()
	var wm = load("res://scenes/WorldMap.tscn").instantiate()
	add_child(wm)
	wm.setup(self, state.get("cleared_zones", []), current_zone_id)
	current = wm

## Jalan kaki antar organ (kunjungan pertama yang adjacent).
func travel_corridor(from_zone: String, to_zone: String) -> void:
	_clear_current()
	var co = load("res://scenes/Corridor.tscn").instantiate()
	add_child(co)
	co.setup(from_zone, to_zone, self)
	co.add_child(hero)
	hero.position = co.hero_entry_pos()
	current = co

## Masuk zona (fast travel / dari koridor / dari peta).
func enter_zone(zone_id: String) -> void:
	_clear_current()
	current_zone_id = zone_id
	state["current_zone"] = zone_id
	SaveWorld.save_state(state)
	var z = load("res://scenes/Zone.tscn").instantiate()
	add_child(z)
	z.setup(zone_id, self)
	z.zone_entered.connect(func(id): zone_entered.emit(id))
	z.boss_defeated.connect(func zid, bid: boss_defeated.emit(zid, bid))
	z.zone_cleared.connect(func(id): zone_cleared.emit(id))
	z.enter(hero)
	current = z

func fade_swap(swap: Callable) -> void:
	await fade.fade_swap(swap)

func on_room_cleared(zone_id: String, room_id: String) -> void:
	SaveWorld.mark_room_cleared(state, zone_id, room_id)
	SaveWorld.save_state(state)

func on_zone_cleared(zone_id: String) -> void:
	SaveWorld.mark_zone_cleared(state, zone_id)
	SaveWorld.save_state(state)
	# kembali ke peta: zona bercahaya, gate di atas terbuka
	await get_tree().create_timer(1.2).timeout
	show_map()

func debug_collect(kind: String, amount: int) -> void:
	if kind == "fragment":
		return
	bank += amount

func debug_bank() -> int:
	return bank

func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventKey and (ev as InputEventKey).pressed and not (ev as InputEventKey).echo:
		if (ev as InputEventKey).keycode == KEY_ESCAPE and not current is WorldMapScript:
			show_map()

const WorldMapScript = preload("res://scripts/world/world_map.gd")
