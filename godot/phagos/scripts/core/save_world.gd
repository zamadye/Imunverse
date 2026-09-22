extends RefCounted
## SaveWorld — progres dunia: zona clear, ruangan clear, posisi, fast travel.
## Format user://phagos_world.json (JSON murni, gampang di-inspeksi/di-bridge).

const PATH := "user://phagos_world.json"

static func default_state() -> Dictionary:
	return {"cleared_zones": [], "cleared_rooms": {}, "current_zone": "",
			"biokredit_bank": 0, "version": 1}

static func load_state() -> Dictionary:
	var st := default_state()
	if not FileAccess.file_exists(PATH):
		return st
	var f := FileAccess.open(PATH, FileAccess.READ)
	if f == null:
		return st
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	if parsed is Dictionary:
		for k in st.keys():
			if parsed.has(k):
				st[k] = parsed[k]
	return st

static func save_state(st: Dictionary) -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f == null:
		push_error("[SaveWorld] gagal tulis " + PATH)
		return
	f.store_string(JSON.stringify(st))

static func mark_room_cleared(st: Dictionary, zone_id: String, room_id: String) -> void:
	if not st["cleared_rooms"].has(zone_id):
		st["cleared_rooms"][zone_id] = []
	if not room_id in st["cleared_rooms"][zone_id]:
		st["cleared_rooms"][zone_id].append(room_id)

static func mark_zone_cleared(st: Dictionary, zone_id: String) -> void:
	if not zone_id in st["cleared_zones"]:
		st["cleared_zones"].append(zone_id)
