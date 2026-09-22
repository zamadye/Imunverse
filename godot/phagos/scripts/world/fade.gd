extends CanvasLayer
## Fade — transisi fade-to-black antar ruangan (0,2 + 0,2 = <0,5 dtk total,
## TANPA loading screen). Dipakai Zone (antar ruangan) & Game (antar zona).

var _rect: ColorRect

func _ready() -> void:
	layer = 100
	_rect = ColorRect.new()
	_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_rect.color = Color(0, 0, 0, 0)
	_rect.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(_rect)

## swap dipanggil di tengah (saat layar hitam).
func fade_swap(swap: Callable) -> void:
	var tw := create_tween()
	tw.tween_property(_rect, "color:a", 1.0, 0.2)
	await tw.finished
	swap.call()
	var tw2 := create_tween()
	tw2.tween_property(_rect, "color:a", 0.0, 0.2)
	await tw2.finished
