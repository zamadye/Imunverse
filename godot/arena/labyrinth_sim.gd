# labyrinth_sim.gd — PARITY Godot dari js/systems/lumen-labyrinth.js:
# SDF union(chamber, kapsul koridor) minus segel katup; state machine per-room
# LOCKDOWN->SWARM->PURIFIED->OPEN; junction aman. Headless-friendly (guard).
extends RefCounted

const LabData = preload("res://lab_data.gd")

var nodes := {}
var segs := []
var route := []
var active_id := ""
var beat := 0.0
var time := 0.0
var state := "lockdown"

func _init() -> void:
	for n in LabData.NODES:
		nodes[n.id] = {
			"id": n.id, "x": n.x, "y": n.y, "r": n.r,
			"junction": n.junction, "enemies": n.enemies, "hazard": n.hazard,
			"state": "idle", "cleared": false, "t": 0.0,
		}
	for e in LabData.EDGES:
		var pts: Array = e.pts
		for i in range(pts.size() - 1):
			segs.append({ "x0": pts[i].x, "y0": pts[i].y, "x1": pts[i + 1].x, "y1": pts[i + 1].y, "w": e.w })
	route = LabData.ROUTE.duplicate()
	active_id = route[0]
	var n0: Dictionary = nodes[active_id]
	n0.state = "lockdown"
	state = "lockdown"

func active() -> Dictionary:
	return nodes[active_id]

func room_at(x: float, y: float) -> String:
	for n in nodes.values():
		if Vector2(x - n.x, y - n.y).length() < float(n.r) * 0.92:
			return n.id
	return ""

func _seg_d(x: float, y: float, s: Dictionary) -> float:
	var ax: float = s.x0; var ay: float = s.y0
	var bx: float = s.x1; var by: float = s.y1
	var dx: float = bx - ax; var dy: float = by - ay
	var l2: float = dx * dx + dy * dy
	if l2 < 1e-6:
		return Vector2(x - ax, y - ay).length()
	var t: float = clampf(((x - ax) * dx + (y - ay) * dy) / l2, 0.0, 1.0)
	return Vector2(x - (ax + dx * t), y - (ay + dy * t)).length()

func seals() -> Array:
	var out := []
	var n: Dictionary = active()
	if n.state != "lockdown" and n.state != "swarm":
		return out
	for e in LabData.EDGES:
		var other := ""
		if e.a == n.id:
			other = e.b
		elif e.b == n.id:
			other = e.a
		else:
			continue
		var o: Dictionary = nodes[other]
		var d := Vector2(o.x - n.x, o.y - n.y)
		if d.length() < 1e-6:
			continue
		d = d.normalized()
		out.append({ "x": n.x + d.x * float(n.r) * 0.86, "y": n.y + d.y * float(n.r) * 0.86, "r": 34.0 })
	return out

func sdf(x: float, y: float, sealed: bool = true) -> float:
	var d := 1e9
	for n in nodes.values():
		d = minf(d, Vector2(x - n.x, y - n.y).length() - float(n.r))
	for s in segs:
		d = minf(d, _seg_d(x, y, s) - float(s.w))
	if sealed:
		for sl in seals():
			d = maxf(d, -(Vector2(x - sl.x, y - sl.y).length() - float(sl.r)))
	return d

func step(dt: float, alive: int) -> void:
	time += dt
	beat = 0.5 + 0.5 * sin(time * (74.0 / 60.0) * TAU)
	var n: Dictionary = active()
	n.t = float(n.t) + dt
	if n.state == "lockdown" and float(n.t) > 1.1:
		n.state = "swarm"; n.t = 0.0
	elif n.state == "swarm":
		if alive == 0 and float(n.t) > 0.6:
			n.state = "purified"; n.t = 0.0; n.cleared = true
	elif n.state == "purified":
		if float(n.t) > 1.2:
			n.state = "open"; n.t = 0.0
	state = n.state

func enter_room(id: String) -> void:
	if id == "" or id == active_id:
		return
	active_id = id
	var n: Dictionary = nodes[id]
	if n.state == "idle":
		if n.junction:
			n.state = "open"; n.cleared = true
		else:
			n.state = "lockdown"; n.t = 0.0
	state = n.state
