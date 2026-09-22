extends RefCounted
## ZoneLighting — "Planet Biru": dunia GELAP tapi tidak hitam (50-70%).
## Hero = sumber cahaya utama. Hazard = glow warna bahaya. Collectible = emas.
## Dinding menyerap cahaya (tidak bercahaya). Budget Android: ≤6 PointLight2D
## per ruangan, tanpa shadow. Tekstur radial dipakai bersama (1× di memori).

static var _radial: ImageTexture = null

static func radial_texture() -> ImageTexture:
	if _radial != null:
		return _radial
	var sz := 64
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	for y in range(sz):
		for x in range(sz):
			var d := Vector2(x - sz / 2.0, y - sz / 2.0).length() / (sz / 2.0)
			img.set_pixel(x, y, Color(1, 1, 1, clampf(1.0 - d, 0.0, 1.0) ** 2.0))
	_radial = ImageTexture.create_from_image(img)
	return _radial

static func make_light(color: Color, energy: float, tex_scale: float) -> PointLight2D:
	var l := PointLight2D.new()
	l.texture = radial_texture()
	l.color = color
	l.energy = energy
	l.texture_scale = tex_scale
	l.shadow_enabled = false
	return l

## CanvasModulate per zona (gelap 50-70% + tint biome).
static func apply_zone_modulate(cm: CanvasModulate, pal: Dictionary) -> void:
	var c := Color(pal.get("deep", "#1A0A10"))
	c = c.lerp(Color(0.55, 0.55, 0.6), 0.45)  # jangan sampai hitam pekat
	cm.color = c
