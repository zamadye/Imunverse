extends SceneTree

var _sudah := false
var ap: AnimationPlayer

func _process(_dt: float) -> bool:
	if _sudah: return true
	_sudah = true
	var rig := Node2D.new(); rig.name = "Rig"
	var body := Node2D.new(); body.name = "Body"; rig.add_child(body)
	ap = AnimationPlayer.new(); ap.name = "AP"; rig.add_child(ap)
	root.add_child(rig)
	ap.root_node = ap.get_path_to(rig)
	var a := Animation.new(); a.length = 1.0; a.loop_mode = Animation.LOOP_LINEAR
	a.resource_name = "c"
	var tp := a.add_track(Animation.TYPE_VALUE); a.track_set_path(tp, "Body:position")
	a.track_insert_key(tp, 0.0, Vector2(0, 0))
	a.track_insert_key(tp, 0.5, Vector2(10, 0))
	a.track_insert_key(tp, 1.0, Vector2(0, 0))
	print("err add_animation=", ap.add_animation("c", a))
	print("has=", ap.has_animation("c"), " list=", ap.get_animation_list())
	var lib := AnimationLibrary.new()
	print("err lib.add=", lib.add_animation("c", a), " lib has=", lib.has_animation("c"))
	print("err ap.addlib=", ap.add_animation_library("", lib))
	print("has2=", ap.has_animation("c"), " list2=", ap.get_animation_list())
	ap.assigned_animation = "c"
	ap.seek(0.5, true)
	print("pos=", body.position)
	quit(0)
	return true
