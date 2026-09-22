extends RefCounted
## TilesetFactory — SATU TileSet prosedural per biome (8 total), dibangun saat
## runtime dari palet zona. ATURAN 5: dinding terasa JARINGAN HIDUP (lipatan
## sinus + blotch organik + highlight membran), bukan bata/geometris.
## Tanpa import pipeline: murni Image → ImageTexture → TileSetAtlasSource,
## jadi aman di editor, headless, export Android & Web.

const TILE := 64
static var _cache := {}

static func make_tileset(zone_id: String, pal: Dictionary) -> TileSet:
	if _cache.has(zone_id):
		return _cache[zone_id]
	var rng := RandomNumberGenerator.new()
	rng.seed = 1000 + hash(zone_id) % 100000
	var img := Image.create(TILE * 4, TILE * 4, false, Image.FORMAT_RGBA8)
	var floor_c := Color(pal.get("floor", "#666666"))
	var wall_c := Color(pal.get("wall", "#333333"))
	var deep_c := Color(pal.get("deep", "#111111"))
	var acc_c := Color(pal.get("accent", "#FFFFFF"))
	var glow_c := Color(pal.get("glow", "#FFFFAA"))
	for ty in range(4):
		for tx in range(4):
			_paint_tile(img, tx, ty, ty, rng, floor_c, wall_c, deep_c, acc_c, glow_c)
	var tex := ImageTexture.create_from_image(img)
	var src := TileSetAtlasSource.new()
	src.texture = tex
	src.texture_region_size = Vector2i(TILE, TILE)
	for ty in range(4):
		for tx in range(4):
			src.create_tile(Vector2i(tx, ty))
	var ts := TileSet.new()
	ts.tile_size = Vector2i(TILE, TILE)
	ts.add_source(src, 0)
	_cache[zone_id] = ts
	return ts

static func _paint_tile(img: Image, tx: int, ty: int, rowkind: int, rng: RandomNumberGenerator,
		floor_c: Color, wall_c: Color, deep_c: Color, acc_c: Color, glow_c: Color) -> void:
	var variant := float(tx) * 0.06
	for y in range(TILE):
		for x in range(TILE):
			var gx := tx * TILE + x
			var gy := ty * TILE + y
			var n := 0.5 + 0.5 * sin(x * 0.22 + variant * 9.0 + float(ty)) * cos(y * 0.19 + variant * 7.0)
			var j: float = rng.randf_range(-0.035, 0.035)
			var c: Color
			if rowkind == 0:  # FLOOR: hangat + blotch sel
				var cell := 0.5 + 0.5 * sin(x * 0.55 + variant * 20.0) * sin(y * 0.5)
				c = floor_c.lightened(n * 0.22 + cell * 0.10 + j)
				if rng.randf() < 0.006:  # inti sel sesekali
					c = acc_c.darkened(0.25)
			elif rowkind == 1:  # WALL: lipatan + highlight membran di tepi
				var fold := sin(y * 0.35 + n * 4.0 + variant * 12.0) * 0.09
				c = wall_c.lightened(fold + (n - 0.5) * 0.12 + j)
				if y < 6:
					c = c.lerp(acc_c, 0.35 * (1.0 - float(y) / 6.0))
				if rng.randf() < 0.010:  # pori basah
					c = glow_c.darkened(0.1)
			elif rowkind == 2:  # DECO: gelap + speckle aksen
				c = deep_c.lerp(acc_c, n * 0.18 + j)
				if rng.randf() < 0.03:
					c = acc_c
			else:  # GLOW: marker bahaya berdenyut-statis
				var t := (sin(x * 0.12) + cos(y * 0.12)) * 0.25 + 0.5
				c = deep_c.lerp(glow_c, 0.25 + t * 0.45)
			img.set_pixel(gx, gy, c)

## Pilih varian dinding organik dari mask tetangga (0..15) — terasa melengkung.
static func wall_variant(mask: int) -> Vector2i:
	return Vector2i(mask % 4, 1)

static func floor_variant(rng: RandomNumberGenerator) -> Vector2i:
	return Vector2i(rng.randi_range(0, 3), 0)
