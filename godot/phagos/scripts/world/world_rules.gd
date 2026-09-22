extends RefCounted
## WorldRules — logika MURNI dunia (tanpa node, tanpa fisika): gate zona,
## adjacency koridor, validasi graf ruangan. Dipakai world_map.gd saat runtime
## dan diuji LANGSUNG oleh guard headless (build wasm sandbox tak punya
## kelas fisika 2D, jadi logika yang bisa murni HARUS murni).

static func cleared_others(cleared: Array, except_id: String) -> int:
	var n := 0
	for c in cleared:
		if c != except_id:
			n += 1
	return n

## Gate: start terbuka; biasa butuh requires; GOAL butuh 6/7 clear.
static func is_unlocked(map_def: Dictionary, cleared: Array, zone_id: String) -> bool:
	if zone_id in cleared:
		return true
	for n in map_def.get("nodes", []):
		if n.get("id") == zone_id:
			if bool(n.get("goal", false)):
				return cleared_others(cleared, zone_id) >= int(map_def.get("goal_requires_cleared", 6))
			for req in n.get("requires", []):
				if not req in cleared:
					return false
			return true
	return false

static func is_adjacent(map_def: Dictionary, a: String, b: String) -> bool:
	for e in map_def.get("edges", []):
		if (e["a"] == a and e["b"] == b) or (e["a"] == b and e["b"] == a):
			return true
	return false

## Aturan travel: cleared = warp; awal = langsung; adjacent = koridor.
static func travel_mode(map_def: Dictionary, cleared: Array, current_zone: String,
		zone_id: String) -> String:
	if not is_unlocked(map_def, cleared, zone_id):
		return "locked"
	if zone_id in cleared or current_zone == "":
		return "direct"
	if is_adjacent(map_def, current_zone, zone_id):
		return "corridor"
	return "no_path"

## Validasi graf zona: entry, boss, koneksi resolve, semua reachable.
static func validate_zone_graph(zone_def: Dictionary) -> Dictionary:
	var errors: Array = []
	var rooms: Array = zone_def.get("rooms", [])
	var ids := {}
	for r in rooms:
		ids[r["id"]] = r
	if not ids.has(str(zone_def.get("entry_room", ""))):
		errors.append("entry hilang")
	if not rooms.any(func(r): return r.get("type") == "boss"):
		errors.append("boss hilang")
	for r in rooms:
		for c in r.get("connections", []):
			if not ids.has(c):
				errors.append("koneksi gantung %s->%s" % [r["id"], c])
	var seen := {}
	var stack := [str(zone_def.get("entry_room", ""))]
	while not stack.is_empty():
		var cur: String = stack.pop_back()
		if seen.has(cur) or not ids.has(cur):
			continue
		seen[cur] = true
		for c in (ids[cur] as Dictionary).get("connections", []):
			stack.append(c)
	if seen.size() != rooms.size():
		errors.append("reachable %d/%d" % [seen.size(), rooms.size()])
	return {"ok": errors.is_empty(), "errors": errors,
		"reachable": seen.size(), "total": rooms.size()}

const SIZE_TABLE := {"combat_s": [20, 15], "combat_b": [30, 22], "boss": [35, 28],
	"corridor": [8, 30], "shop": [15, 12], "reward": [16, 12],
	"hazard": [24, 18], "shortcut": [12, 20], "preboss": [18, 14]}

static func room_size_ok(rtype: String, sz: Array) -> bool:
	if rtype == "combat":
		return _eq(sz, SIZE_TABLE["combat_s"]) or _eq(sz, SIZE_TABLE["combat_b"])
	return SIZE_TABLE.has(rtype) and _eq(sz, SIZE_TABLE[rtype])

static func _eq(a: Array, b: Array) -> bool:
	return int(a[0]) == b[0] and int(a[1]) == b[1]
