extends SceneTree
##
## MEMANGGANG SIKLUS MERAYAP (crawl cycle) per hero.
##
## Dijalankan headless:
##   node tools/godot/bake-crawl.mjs
##   (atau langsung: node tools/godot/run.mjs tools/godot/rig --headless \
##      --path tools/godot/rig --script res://bake_crawl.gd)
##
## Yang dibangun di sini BUKAN gambar, melainkan RIG GERAK:
##
##     Rig (Node2D)
##      ├ Body    — massa sel: position.x (geser massa), scale (squash-stretch),
##      │           rotation (ayun), skew (jangkauan / reach)
##      │  └ Lobe0..n — pseudopodia, memanjang bergelombang (traveling wave)
##      └ Anchor  — titik kontak dengan alas; scale.x = daya lekat (contact)
##
## KUNCI ANTI-MENGAMBANG: permukaan bawah sel SELALU menempel (contact ≈ 1).
## Karena itu kanal vertikal (Body:position.y) sengaja DIKUNCI 0 — "hidup"
## justru datang dari squash-stretch yang berporos di GARIS BAWAH sprite,
## bukan dari badan diangkat turun-naik.
##
## Keluaran: satu baris `BAKE_JSON:{...}` berisi 24 frame per hero.
##

const FRAME := 24          # frame per siklus (cukup halus, file tetap kecil)
const KUNCI := 8           # key animasi per siklus (loop linear)


## CATATAN PENTING (dua jebakan build web/headless yang sudah teruji):
##  1. Node TIDAK bisa ditambahkan ke `root` di dalam `_initialize()` —
##     `is_inside_tree()` masih false, jadi AnimationPlayer tidak pernah
##     memproses track. Semua rig dibangun di `_process()` (frame pertama).
##  2. `AnimationPlayer.add_animation()` di build ini MENGEMBALIKAN null dan
##     tidak menyimpan apa pun. Yang bekerja: `AnimationLibrary.add_animation()`
##     lalu `AnimationPlayer.add_animation_library("" , library)`.

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
	var src: Variant = _baca_json("res://crawl-src.json")
	if src == null or typeof(src) != TYPE_DICTIONARY:
		print("BAKE_ERR: crawl-src.json tidak terbaca")
		quit(1)
		return
	var heroes: Dictionary = src.get("heroes", {})
	if heroes.is_empty():
		print("BAKE_ERR: tidak ada hero di crawl-src.json")
		quit(1)
		return
	var out: Dictionary = {}
	out["schemaVersion"] = 1
	out["frames"] = FRAME
	out["sumber"] = "Godot 4.7.2 headless — tools/godot/rig/bake_crawl.gd"
	out["catatan"] = ("Kontak bawah sel selalu menempel: position.y dikunci 0, "
		+ "gerak hidup = squash-stretch berporos bawah + skew jangkauan + gelombang lobus.")
	out["heroes"] = {}
	for hid in heroes.keys():
		out["heroes"][hid] = _panggang(hid, heroes[hid])
	var teks := JSON.stringify(out)
	print("BAKE_JSON:" + teks)
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


func _panggang(hid: String, cfg: Dictionary) -> Dictionary:
	var n: int = int(cfg.get("lobes", 4))
	var squash: float = float(cfg.get("squash", 0.10))
	var reach: float = float(cfg.get("reach", 0.14))
	var sway: float = float(cfg.get("sway", 0.05))
	var massa: float = float(cfg.get("massShift", 2.4))
	var rate: float = float(cfg.get("rate", 1.0))

	# ---------- bangun rig ----------
	var rig := Node2D.new()
	rig.name = "Rig"
	var body := Node2D.new()
	body.name = "Body"
	rig.add_child(body)
	var lobus: Array[Node2D] = []
	for i in range(n):
		var l := Node2D.new()
		l.name = "Lobe%d" % i
		body.add_child(l)
		lobus.append(l)
	var anchor := Node2D.new()
	anchor.name = "Anchor"
	rig.add_child(anchor)
	var ap := AnimationPlayer.new()
	ap.name = "AP"
	rig.add_child(ap)
	root.add_child(rig)
	ap.root_node = ap.get_path_to(rig)

	# ---------- animasi ----------
	var a := Animation.new()
	a.length = 1.0
	a.loop_mode = Animation.LOOP_LINEAR
	var tPos := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(tPos, "Body:position")
	var tScl := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(tScl, "Body:scale")
	var tRot := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(tRot, "Body:rotation")
	var tSkew := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(tSkew, "Body:skew")
	var tLobe: Array[int] = []
	for i in range(n):
		var ti := a.add_track(Animation.TYPE_VALUE)
		a.track_set_path(ti, "Body/Lobe%d:scale" % i)
		tLobe.append(ti)
	var tCon := a.add_track(Animation.TYPE_VALUE)
	a.track_set_path(tCon, "Anchor:scale")

	for k in range(KUNCI + 1):
		var u := float(k) / float(KUNCI)           # 0..1 siklus
		var ph := u * TAU                          # 1 siklus = 2 langkah
		# squash-stretch: 2 siklus per putaran langkah (tiap langkah memipih & memanjang)
		var gel := sin(ph * 2.0) * squash
		var sx := 1.0 + gel
		var sy := 1.0 / sx                          # volume terjaga -> tidak "karet"
		# jangkauan (skew) & geser massa: condong ke depan saat menjangkau
		var jangkau := sin(ph) * reach
		var geser := sin(ph) * massa
		var ayun := sin(ph + 0.6) * sway
		a.track_insert_key(tPos, u, Vector2(geser, 0.0))   # y SENGAJA 0 = tidak mengambang
		a.track_insert_key(tScl, u, Vector2(sx, sy))
		a.track_insert_key(tRot, u, ayun)
		a.track_insert_key(tSkew, u, jangkau)
		for i in range(n):
			# gelombang berjalan mengelilingi badan: lobus menjangkau bergiliran
			var phl := ph - (float(i) / float(n)) * TAU * 0.75
			var ext := 0.5 + 0.5 * sin(phl)
			a.track_insert_key(tLobe[i], u, Vector2(1.0, 1.0 + ext * 0.35))
		# daya lekat: sedikit mengendur saat badan ditarik maju
		var lekat: float = 1.0 - 0.12 * clampf((sin(ph) + 1.0) * 0.5, 0.0, 1.0)
		a.track_insert_key(tCon, u, Vector2(lekat, 1.0))

	var pustaka := AnimationLibrary.new()
	if pustaka.add_animation("crawl", a) != OK:
		print("BAKE_ERR: gagal menambah animasi ke pustaka")
		quit(1)
		return {}
	if ap.add_animation_library("", pustaka) != OK:
		print("BAKE_ERR: gagal memasang pustaka animasi")
		quit(1)
		return {}
	ap.assigned_animation = "crawl"

	# ---------- cuplik (sample) lewat AnimationPlayer ----------
	var kerangka: Array = []
	for k in range(FRAME):
		var u := float(k) / float(FRAME)
		ap.seek(u, true)
		var lob: Array = []
		for l in lobus:
			lob.append(round(l.scale.y * 10000.0) / 10000.0)
		kerangka.append({
			"u": round(u * 10000.0) / 10000.0,
			"x": round(body.position.x * 10000.0) / 10000.0,
			"y": round(body.position.y * 10000.0) / 10000.0,
			"sx": round(body.scale.x * 10000.0) / 10000.0,
			"sy": round(body.scale.y * 10000.0) / 10000.0,
			"rot": round(body.rotation * 10000.0) / 10000.0,
			"skew": round(body.skew * 10000.0) / 10000.0,
			"contact": round(anchor.scale.x * 10000.0) / 10000.0,
			"lobes": lob,
		})

	rig.queue_free()
	return {
		"style": cfg.get("style", ""),
		"lobes": n,
		"rate": rate,
		"frames": kerangka,
	}
