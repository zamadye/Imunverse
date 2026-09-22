extends RefCounted
## JsonLoader — baca data-driven JSON dunia (ATURAN 6).
## Dipakai Zone / WorldMap / Room / Guard. Pure static, tanpa state.

static func load_json(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("[JsonLoader] tidak bisa buka " + path)
		return {}
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	if not (parsed is Dictionary):
		push_error("[JsonLoader] JSON tidak valid: " + path)
		return {}
	return parsed

static func load_zone(zone_id: String) -> Dictionary:
	return load_json("res://data/zones/" + zone_id + ".json")

static func load_world_map() -> Dictionary:
	return load_json("res://data/world_map.json")

static func room_def(zone_def: Dictionary, room_id: String) -> Dictionary:
	for r in zone_def.get("rooms", []):
		if r.get("id") == room_id:
			return r
	return {}
