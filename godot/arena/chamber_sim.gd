extends RefCounted
## Logika murni ARENA TERTUTUP (port 1:1 dari js/systems/bio-chamber.js):
## ring spring-mass N=48 (k=0.1, damp=0.85), heartbeat, state machine
## ENTRY->LOCKDOWN->SWARM->PURIFIED->OPEN. Dipakai spring_ring.gd (visual)
## dan guard.gd (headless) — satu sumber kebenaran fisika.

const N := 48
const K := 0.1
const DAMP := 0.85

var R := 640.0
var bpm := 74.0
var amp := 10.0
var lobes := 5
var state := "entry"
var t := 0.0
var shock := 0.0
var open_amt := 0.0
var door_angle := -PI / 2.0
var spawned := 0
var time := 0.0
var pts: Array = []   # [{a, base, r, v}]
var events: Array = []  # event state-machine frame ini

var harmonics: Array = []
var stretch := Vector3(1.0, 1.0, 0.0)   # sx, sy, rot
var pillars: Array = []                 # [{x,y,r}]

func _init(radius: float = 640.0, lobes_n: int = 5, bpm_n: float = 74.0, amp_n: float = 10.0, shape: Dictionary = {}) -> void:
	R = radius
	lobes = lobes_n
	bpm = bpm_n
	amp = amp_n
	if shape.has("harmonics") and not shape.harmonics.is_empty():
		harmonics = shape.harmonics
	else:
		harmonics = [[lobes_n, 0.10, 0.7], [lobes_n * 2 + 1, 0.05, 2.1]]
	if shape.has("stretch"):
		stretch = Vector3(shape.stretch[0], shape.stretch[1], shape.stretch[2])
	for i in N:
		var a := float(i) / float(N) * TAU
		var harm := 1.0
		for h in harmonics:
			harm += float(h[1]) * sin(float(h[0]) * a + float(h[2]))
		harm = maxf(0.35, harm)
		var b := a - stretch.z
		var ell := 1.0 / sqrt(pow(cos(b) / stretch.x, 2.0) + pow(sin(b) / stretch.y, 2.0))
		var base := R * harm * ell
		pts.append({"a": a, "base": base, "r": base, "v": 0.0})
	# pilar internal (massa gelap non-konveks)
	for pl in shape.get("pillars", []):
		var dist: float = float(pl.get("d", 0.4)) * R
		var ax: float = float(pl.get("a", 0.0))
		var c0 := Vector2(cos(ax), sin(ax)) * dist
		var dir := ax + PI / 2.0
		var plen: float = float(pl.get("len", 240))
		var wid: float = float(pl.get("wid", 90))
		var bend: float = float(pl.get("bend", 0.0))
		for k2 in 3:
			var t2: float = (float(k2) / 2.0 - 0.5) * plen
			var bow: float = bend * plen * 0.22 * sin(PI * (float(k2) / 2.0))
			var pos := c0 + Vector2(cos(dir), sin(dir)) * t2 + Vector2(-sin(dir), cos(dir)) * bow
			var pa := atan2(pos.y, pos.x)
			var wr: float = radius_at(pa) - wid * 0.5 - 24.0
			if pos.length() > wr and pos.length() > 1e-6:
				pos *= wr / pos.length()
			pillars.append({"x": pos.x, "y": pos.y, "r": wid * 0.5})

func beat() -> float:
	# denyut jantung: sistol tajam + rileks (sin(t*2.5) dasar spec owner)
	var ph := fmod(time * bpm / 60.0, 1.0)
	return pow(maxf(0.0, sin(ph * TAU)), 3.0) * 0.6 + 0.4 * (0.5 + 0.5 * sin(time * 2.5))

func radius_at(a: float) -> float:
	var f: float = fmod(a / TAU, 1.0) * float(N)
	var i: int = int(floor(f)) % N
	var j: int = (i + 1) % N
	var tt: float = f - floor(f)
	return pts[i].r * (1.0 - tt) + pts[j].r * tt

func base_at(a: float) -> float:
	var f: float = fmod(a / TAU, 1.0) * float(N)
	var i: int = int(floor(f)) % N
	var j: int = (i + 1) % N
	var tt: float = f - floor(f)
	return pts[i].base * (1.0 - tt) + pts[j].base * tt

func apply_impact(a: float, force: float) -> void:
	var f := fmod(fmod(a, TAU) + TAU, TAU) / TAU * float(N)
	var i := int(round(f)) % N
	for pair in [[-2, 0.25], [-1, 0.55], [0, 1.0], [1, 0.55], [2, 0.25]]:
		var idx := ((i + int(pair[0])) % N + N) % N
		pts[idx].v += force * float(pair[1])

## satu langkah fisika dinding: pegas ke base(+heartbeat) + redaman
func step_wall(dt: float) -> void:
	var hb := beat()
	for i in N:
		var p: Dictionary = pts[i]
		var target: float = p.base * (1.0 + 0.012 * hb)
		p.v += (target - p.r) * K
		p.v *= DAMP
		p.r += p.v * (dt * 60.0)

## containment: koreksi posisi entitas agar tetap DI DALAM membran
func collide(pos: Vector2, center: Vector2, margin: float) -> Vector2:
	var q := pos - center
	var r := q.length()
	var a := atan2(q.y, q.x)
	# pilar internal menolak entitas
	for pi in pillars:
		var pd := pos - Vector2(pi.x, pi.y)
		var pr := pd.length()
		if pr < 1e-4:
			pd = Vector2(pi.x, pi.y).normalized()
			if pd.length() < 0.5:
				pd = Vector2(1, 0)
			pr = 1.0
		if pr < float(pi.r) + margin:
			return Vector2(pi.x, pi.y) + pd.normalized() * (float(pi.r) + margin)
	var wall := radius_at(a) - margin
	if open_amt > 0.4:
		var da := absf(fmod(a - door_angle + 3.0 * PI, TAU) - PI)
		if da < 0.30 * open_amt:
			return pos  # mulut pintu terbuka
	if r > wall:
		return center + q.normalized() * wall
	return pos

## state machine; alive = jumlah patogen hidup di arena
func step_state(dt: float, alive: int) -> void:
	time += dt
	t += dt
	events.clear()
	match state:
		"entry":
			state = "lockdown"; t = 0.0
		"lockdown":
			step_wall(dt)
			if t > 1.2:
				state = "swarm"; t = 0.0; events.append("swarm_start")
		"swarm":
			step_wall(dt)
			if alive == 0 and t > 2.0:
				state = "purified"; t = 0.0; shock = 0.0; events.append("purified")
		"purified":
			step_wall(dt)
			shock = minf(1.0, shock + dt / 0.9)
			if t > 1.0:
				state = "open"; t = 0.0; events.append("open")
		"open":
			step_wall(dt)
			open_amt = minf(1.0, open_amt + dt * 1.6)
