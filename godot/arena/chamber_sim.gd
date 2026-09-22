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

func _init(radius: float = 640.0, lobes_n: int = 5, bpm_n: float = 74.0, amp_n: float = 10.0) -> void:
	R = radius
	lobes = lobes_n
	bpm = bpm_n
	amp = amp_n
	for i in N:
		var a := float(i) / float(N) * TAU
		var base := R * (1.0 + (amp / R) * sin(a * float(lobes)))
		pts.append({"a": a, "base": base, "r": base, "v": 0.0})

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
