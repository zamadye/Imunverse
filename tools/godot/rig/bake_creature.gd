extends SceneTree
##
## MEMANGGANG RIG MAKHLUK (pendekatan ② — rigged 2D, badan digambar prosedural).
##
## Dijalankan: node tools/godot/bake-creature.mjs
##
## Rig yang dibangun (semuanya Node2D sungguhan, dianimasikan AnimationPlayer,
## lalu DICUILIK per frame — jadi yang keluar ke JSON itu hasil interpolasi
## Godot, bukan angka yang dihitung sendiri di JS):
##
##   Creature
##    ├ Core   :position :scale :rotation   massa badan (napas, squash, condong)
##    ├ Nuk    :position :scale             nukleus (berat dalam — ikut terlambat)
##    ├ Front  :scale                       lamellipodium — tepi depan (penanda arah)
##    ├ Uro    :scale                       ekor belakang (penanda membelakangi)
##    ├ Wob    :scale                       amplitudo gerak SEKUNDER membran
##    └ L0..L5 :position :scale             ujung (TIP) pseudopodia — kaki yang
##                                          benar-benar MENAPAK (foot planting)
##
## KUNCI FOOT-PLANTING: selama fase menapak (`duty`), ujung kaki bergerak
## MUNDUR di ruang makhluk tepat sejauh badan maju — sehingga di layar ujung
## itu DIAM. Fase ayun mengangkat ujung dan memajukannya lagi.
##
## Dua jebakan build web/headless (sama seperti bake_crawl.gd):
##   1. node TIDAK bisa ditambahkan ke `root` di `_initialize()` → bangun di `_process()`.
##   2. `AnimationPlayer.add_animation()` tidak menyimpan apa pun → pakai AnimationLibrary.
##

const FRAME := 24

var _sudah := false

func _initialize() -> void:
	pass

func _process(_dt: float) -> bool:
	if _sudah:
		return true
	_sudah = true
	_panggang_semua()
	return true

func _panggang_semua() -> void:
	var src: Variant = _baca_json("res://creature-src.json")
	if src == null or typeof(src) != TYPE_DICTIONARY:
		print("BAKE_ERR: creature-src.json tidak terbaca")
		quit(1)
		return
	var makhluk: Dictionary = src.get("creatures", {})
	if makhluk.is_empty():
		print("BAKE_ERR: tidak ada creature di creature-src.json")
		quit(1)
		return
	var out: Dictionary = {
		"schemaVersion": 1,
		"frames": FRAME,
		"sumber": "Godot 4.7.2 headless — tools/godot/rig/bake_creature.gd",
		"catatan": "Ujung kaki (limbs[].x/y) dalam ruang makhluk; plant=1 berarti sedang menapak (ujung diam di dunia).",
		"creatures": {},
	}
	for cid in makhluk.keys():
		out["creatures"][cid] = _panggang_satu(makhluk[cid])
	print("BAKE_JSON:" + JSON.stringify(out))
	quit(0)


func _baca_json(jalur: String) -> Variant:
	if not FileAccess.file_exists(jalur):
		print("BAKE_ERR: berkas hilang " + jalur)
		return null
	var f := FileAccess.open(jalur, FileAccess.READ)
	if f == null:
		return null
	var t := f.get_as_text()
	f.close()
	return JSON.parse_string(t)


func _panggang_satu(def: Dictionary) -> Dictionary:
	var outStates: Dictionary = {}
	for nama in def.get("states", {}).keys():
		outStates[nama] = _panggang_keadaan(def, nama, def["states"][nama])
	return {
		"body": def.get("body", {}),
		"nucleus": def.get("nucleus", {}),
		"organelles": def.get("organelles", {}),
		"front": def.get("front", {}),
		"uropod": def.get("uropod", {}),
		"limbs": def.get("limbs", {}),
		"states": outStates,
	}


func _panggang_keadaan(def: Dictionary, nama: String, st: Dictionary) -> Dictionary:
	var limb: Dictionary = def.get("limbs", {})
	var n: int = int(limb.get("count", 6))
	var duty: float = float(st.get("duty", limb.get("duty", 0.62)))
	var langkah: float = float(limb.get("len", 0.6)) * float(st.get("limbStride", 0.0))
	var angkat: float = float(st.get("limbLift", 0.0))
	var tanah: float = 0.42  # ketinggian alas dalam ruang makhluk (y ke bawah +)
	var loop: bool = bool(st.get("loop", false))

	# ---------- bangun rig ----------
	var rig := Node2D.new(); rig.name = "Creature"
	var core := Node2D.new(); core.name = "Core"; rig.add_child(core)
	var nuk := Node2D.new(); nuk.name = "Nuk"; rig.add_child(nuk)
	var front := Node2D.new(); front.name = "Front"; rig.add_child(front)
	var uro := Node2D.new(); uro.name = "Uro"; rig.add_child(uro)
	var wob := Node2D.new(); wob.name = "Wob"; rig.add_child(wob)
	var kaki: Array[Node2D] = []
	for i in range(n):
		var l := Node2D.new(); l.name = "L%d" % i; rig.add_child(l); kaki.append(l)
	var ap := AnimationPlayer.new(); ap.name = "AP"; rig.add_child(ap)
	root.add_child(rig)
	ap.root_node = ap.get_path_to(rig)

	# ---------- animasi ----------
	var dur: float = float(st.get("dur", 1.0))
	var a := Animation.new()
	a.length = dur
	a.loop_mode = Animation.LOOP_LINEAR
	var tCoreP := a.add_track(Animation.TYPE_VALUE); a.track_set_path(tCoreP, "Core:position")
	var tCoreS := a.add_track(Animation.TYPE_VALUE); a.track_set_path(tCoreS, "Core:scale")
	var tCoreR := a.add_track(Animation.TYPE_VALUE); a.track_set_path(tCoreR, "Core:rotation")
	var tNukP := a.add_track(Animation.TYPE_VALUE); a.track_set_path(tNukP, "Nuk:position")
	var tNukS := a.add_track(Animation.TYPE_VALUE); a.track_set_path(tNukS, "Nuk:scale")
	var tFront := a.add_track(Animation.TYPE_VALUE); a.track_set_path(tFront, "Front:scale")
	var tUro := a.add_track(Animation.TYPE_VALUE); a.track_set_path(tUro, "Uro:scale")
	var tWob := a.add_track(Animation.TYPE_VALUE); a.track_set_path(tWob, "Wob:scale")
	var tKaki: Array[int] = []
	for i in range(n):
		var ti := a.add_track(Animation.TYPE_VALUE)
		a.track_set_path(ti, "L%d:position" % i)
		tKaki.append(ti)

	# fase kaki: dari data (bila ada) else dibagi rata
	var faseKaki: Array[float] = []
	var faseData: Array = limb.get("phase", [])
	for i in range(n):
		faseKaki.append(float(faseData[i]) if i < faseData.size() else float(i) / float(n))

	var KUNCI := 16
	var napas: float = float(st.get("breath", 0.02))
	var squash: float = float(st.get("squash", 0.05))
	var condong: float = float(st.get("lean", 0.0))
	var depan: float = float(st.get("front", 0.4))
	var wobAmp: float = float(st.get("wobble", 1.0))
	var splay: float = float(st.get("splay", 1.0))
	var putar: float = float(st.get("rot", 0.0))
	var coreX: float = float(st.get("coreX", 0.0))
	var coreY: float = float(st.get("coreY", 0.0))

	for k in range(KUNCI + 1):
		var u := float(k) / float(KUNCI)
		var ph := u * TAU
		# ---- amplop tiap keadaan (0..1) ----
		var env := 1.0
		var impuls := 0.0
		match nama:
			"attack":
				env = pow(sin(PI * u), 0.7)
			"skill":
				var charge := smoothstep(0.0, 0.45, u)
				var release := smoothstep(0.5, 0.85, u)
				env = charge - release * 1.15
			"hit":
				impuls = exp(-5.0 * u)
				env = impuls
			"death":
				env = 1.0 - pow(1.0 - u, 2.0)      # makin lama makin terkulai
			"mutate":
				env = sin(PI * u) * (1.0 - 0.35 * u)
			_:
				env = sin(ph)

		var gel: float
		if loop:
			gel = sin(ph * 2.0) * squash
		else:
			gel = env * squash
		var sx := 1.0 + gel * (1.0 if loop else 1.0)
		var sy := 1.0 / sx
		if nama == "skill":
			sx = 1.0 + env * squash * 1.6
			sy = 1.0 / sx
		elif nama == "death":
			sx = 1.0 + env * 0.22
			sy = 1.0 - env * 0.45      # kempis ke alas (poros bawah → tidak melayang)
		elif nama == "hit":
			sx = 1.0 + impuls * squash * 1.3
			sy = 1.0 - impuls * squash * 0.9

		var cx := coreX * env
		var cy := coreY * env
		a.track_insert_key(tCoreP, u * dur, Vector2(cx, cy))
		a.track_insert_key(tCoreS, u * dur, Vector2(sx * (1.0 + napas * sin(ph)), sy * (1.0 - napas * sin(ph))))
		a.track_insert_key(tCoreR, u * dur, condong * env + putar * env)
		# nukleus = massa di dalam: ikut TERLAMBAT (secondary motion)
		var lag := 0.35
		var nukPh := ph - lag
		a.track_insert_key(tNukP, u * dur, Vector2(cx * 0.55, cy * 0.55 + sin(nukPh) * 0.012))
		a.track_insert_key(tNukS, u * dur, Vector2(1.0 + gel * 0.4, 1.0 - gel * 0.25))
		a.track_insert_key(tFront, u * dur, Vector2(depan * (0.6 + 0.4 * env), 1.0 + env * 0.3))
		a.track_insert_key(tUro, u * dur, Vector2(1.0 - 0.35 * env, 1.0))
		a.track_insert_key(tWob, u * dur, Vector2(wobAmp * (0.65 + 0.35 * sin(ph * 3.0)), 1.0))

		for i in range(n):
			# Fase per kaki diambil dari data (pola tripod). Kalau tidak ada,
			# kaki dibagi rata — PENTING: jangan sampai semua kaki sefase, karena
			# itu membuat badan "meluncur" (tidak ada kaki yang menapak).
			var fase: float = fmod(u + faseKaki[i], 1.0)
			var tipX: float
			var tipY: float
			var plant := 0.0
			if loop and langkah > 0.001:
				if fase < duty:
					var t := fase / maxf(duty, 0.001)
					tipX = lerp(langkah * 0.5, -langkah * 0.5, t)   # ujung MUNDUR = menapak
					tipY = tanah
					plant = 1.0
				else:
					var t := (fase - duty) / maxf(1.0 - duty, 0.001)
					var halus: float = t * t * (3.0 - 2.0 * t)
					tipX = lerp(-langkah * 0.5, langkah * 0.5, halus)
					tipY = tanah - angkat * sin(PI * t)
					plant = 0.0
			else:
				# keadaan sekali jalan: kaki mengembang/menciut, tidak melangkah
				tipX = sin(ph + float(i)) * langkah * 0.5
				tipY = tanah - angkat * env
				plant = 0.0
			a.track_insert_key(tKaki[i], u * dur, Vector2(tipX * splay, lerp(tanah, tipY, 1.0)))

	var pustaka := AnimationLibrary.new()
	if pustaka.add_animation("s", a) != OK:
		print("BAKE_ERR: gagal menambah animasi " + nama)
		quit(1)
		return {}
	if ap.add_animation_library("", pustaka) != OK:
		print("BAKE_ERR: gagal memasang pustaka " + nama)
		quit(1)
		return {}
	ap.assigned_animation = "s"

	# ---------- cuplik ----------
	var kerangka: Array = []
	var bulat := func(v: float) -> float: return round(v * 10000.0) / 10000.0
	for k in range(FRAME):
		var u := float(k) / float(FRAME)
		ap.seek(u * dur, true)
		var kakiRekam: Array = []
		for i in range(n):
			kakiRekam.append({
				"x": bulat.call(kaki[i].position.x),
				"y": bulat.call(kaki[i].position.y),
				"plant": 1 if kaki[i].position.y >= tanah - 0.001 else 0,
			})
		kerangka.append({
			"u": bulat.call(u),
			"core": {"x": bulat.call(core.position.x), "y": bulat.call(core.position.y),
				"sx": bulat.call(core.scale.x), "sy": bulat.call(core.scale.y), "rot": bulat.call(core.rotation)},
			"nuk": {"x": bulat.call(nuk.position.x), "y": bulat.call(nuk.position.y),
				"sx": bulat.call(nuk.scale.x), "sy": bulat.call(nuk.scale.y)},
			"front": bulat.call(front.scale.x),
			"uro": bulat.call(uro.scale.x),
			"wob": bulat.call(wob.scale.x),
			"limbs": kakiRekam,
		})

	rig.queue_free()
	return {"loop": loop, "dur": dur, "frames": kerangka}
