extends Control
## ZoneHUD — placeholder HUD dalam-zona (nama zona/ruangan, objektif, bar boss).
## UI final milik agent UI — ini hanya penanda posisi + info debug dunia.

var _zone = null
var _title: Label
var _sub: Label
var _bank: Label
var _boss_bar: ProgressBar
var _boss_name: Label

func setup(zone_ref) -> void:
	_zone = zone_ref
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = MOUSE_FILTER_IGNORE
	_title = _label(Vector2(16, 12), 30, Color(1, 1, 1))
	_sub = _label(Vector2(16, 48), 18, Color(0.8, 0.95, 0.9))
	_bank = _label(Vector2(-260, 12), 20, Color(1, 0.85, 0.4))
	_bank.anchor_left = 1.0
	_bank.anchor_right = 1.0
	_bank.offset_left = -276.0
	_bank.offset_right = -16.0
	_boss_name = _label(Vector2(-300, -96), 20, Color(1, 0.5, 0.5))
	_boss_name.anchor_left = 0.5
	_boss_name.anchor_right = 0.5
	_boss_name.anchor_top = 1.0
	_boss_name.anchor_bottom = 1.0
	_boss_name.offset_left = -300.0
	_boss_name.offset_right = 300.0
	_boss_name.offset_top = -96.0
	_boss_name.offset_bottom = -70.0
	_boss_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_boss_bar = ProgressBar.new()
	_boss_bar.anchor_left = 0.5
	_boss_bar.anchor_right = 0.5
	_boss_bar.anchor_top = 1.0
	_boss_bar.anchor_bottom = 1.0
	_boss_bar.offset_left = -260.0
	_boss_bar.offset_right = 260.0
	_boss_bar.offset_top = -64.0
	_boss_bar.offset_bottom = -44.0
	_boss_bar.max_value = 100.0
	_boss_bar.value = 100.0
	_boss_bar.show_percentage = false
	add_child(_boss_bar)

func _label(pos: Vector2, fsize: int, color: Color) -> Label:
	var l := Label.new()
	l.position = pos
	l.add_theme_font_size_override("font_size", fsize)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	add_child(l)
	return l

func refresh(zone_name: String, room_name: String, objective: String,
		boss_name: String, boss_frac: float) -> void:
	_title.text = zone_name
	_sub.text = room_name + "  —  " + objective
	var game := get_tree().get_first_node_in_group("game")
	var bank := 0
	if game != null and game.has_method("debug_bank"):
		bank = game.debug_bank()
	_bank.text = "◉ %d" % bank
	var show_boss := boss_name != ""
	_boss_bar.visible = show_boss
	_boss_name.visible = show_boss
	if show_boss:
		_boss_name.text = boss_name
		_boss_bar.value = boss_frac * 100.0
