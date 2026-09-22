extends SceneTree

const ChamberSim = preload("res://chamber_sim.gd")
## GUARD headless ARENA TERTUTUP (Godot): fisika & state machine chamber_sim.gd
##   node tools/godot/run.mjs godot/arena --headless --path godot/arena --script res://guard.gd

func _initialize() -> void:
	var Sim = load("res://chamber_sim.gd")
	var fails := 0
	# 1) state machine lengkap
	var sim: ChamberSim = Sim.new(640.0, 5, 74.0, 10.0)
	var alive := 6
	var seen := {}
	for i in range(60 * 14):
		if i > 60 * 6:
			alive = 0
		sim.step_state(1.0 / 60.0, alive)
		seen[sim.state] = true
	var ok_states = seen.has("lockdown") and seen.has("swarm") and seen.has("purified") and seen.has("open")
	print("GUARD state machine ENTRY->LOCKDOWN->SWARM->PURIFIED->OPEN: %s (%s)" % ["OK" if ok_states else "FAIL", str(seen.keys())])
	if not ok_states:
		fails += 1
	# 2) containment: titik didorong keluar 6 dtk tetap di dalam membran
	var sim2: ChamberSim = Sim.new(640.0, 5, 74.0, 10.0)
	var center := Vector2.ZERO
	var pos := Vector2.ZERO
	var luar := 0
	for i in range(360):
		sim2.step_state(1.0 / 60.0, 1)
		sim2.step_wall(1.0 / 60.0)
		pos += Vector2(1.0, 0.3).normalized() * 6.0
		pos = sim2.collide(pos, center, 15.0)
		var r: float = (pos - center).length()
		if r > sim2.radius_at(atan2(pos.y, pos.x)):
			luar += 1
	print("GUARD arena TERTUTUP (sprint 6 dtk ke luar tertahan dinding): %s (frame lolos=%d)" % ["OK" if luar == 0 else "FAIL", luar])
	if luar != 0:
		fails += 1
	# 3) soft-body: impact membuat simpul penyok lalu membal
	var sim3: ChamberSim = Sim.new(640.0, 5, 74.0, 10.0)
	var dev0: float = 0.0
	for p in sim3.pts:
		dev0 = maxf(dev0, absf(p.r - p.base))
	sim3.apply_impact(0.7, 20.0)
	var dev1: float = 0.0
	for i in range(10):
		sim3.step_wall(1.0 / 60.0)
		for p in sim3.pts:
			dev1 = maxf(dev1, absf(p.r - p.base))
	print("GUARD dinding soft-body impact penyok->membal: %s (dev %.1f -> %.1f)" % ["OK" if dev1 > dev0 + 1.0 else "FAIL", dev0, dev1])
	if dev1 <= dev0 + 1.0:
		fails += 1
	# 4) pintu terbuka meloloskan entitas di sektor mulut
	var sim4: ChamberSim = Sim.new(640.0, 5, 74.0, 10.0)
	sim4.state = "open"
	sim4.open_amt = 1.0
	var a: float = sim4.door_angle
	var far: Vector2 = Vector2(cos(a), sin(a)) * (float(sim4.radius_at(a)) + 120.0)
	var out: Vector2 = sim4.collide(far, Vector2.ZERO, 10.0)
	print("GUARD mulut pintu OPEN meloloskan entitas keluar rute: %s" % ["OK" if (out - far).length() < 1.0 else "FAIL"])
	if (out - far).length() >= 1.0:
		fails += 1
	# 5) bentuk asimetris + pilar non-konveks (analisis Pathogenic)
	var shape := {
		"harmonics": [[2, 0.38, 0.2], [3, 0.18, 3.6]],
		"stretch": [1.5, 0.6, 1.0],
		"pillars": [{"a": 1.57, "d": 0.20, "len": 380, "wid": 100, "bend": 0.3}],
	}
	var sim5: ChamberSim = Sim.new(640.0, 5, 74.0, 10.0, shape)
	var rmax := 0.0
	var rmin := 1e9
	for p5 in sim5.pts:
		rmax = maxf(rmax, p5.base)
		rmin = minf(rmin, p5.base)
	var asym_ok := rmax / rmin > 1.5
	print("GUARD bentuk ASIMETRIS (ratio=%.2f): %s" % [rmax / rmin, "OK" if asym_ok else "FAIL"])
	if not asym_ok:
		fails += 1
	var pill_ok := sim5.pillars.size() > 0
	if pill_ok:
		var p0: Dictionary = sim5.pillars[0]
		var pos5: Vector2 = Vector2(p0.x, p0.y)
		pos5 = sim5.collide(pos5, Vector2.ZERO, 15.0)
		pill_ok = (pos5 - Vector2(p0.x, p0.y)).length() >= float(p0.r)
	print("GUARD pilar MENOLAK entitas: %s" % ["OK" if pill_ok else "FAIL"])
	if not pill_ok:
		fails += 1
	print("GUARD_TOTAL_FAIL=%d" % fails)
	quit(1 if fails > 0 else 0)
