# PHAGOS — World Build (Godot 4.3+)

Dunia game PHAGOS: **world map + 8 zona organ + 46 ruangan + hazard +
koridor**, dibangun **data-driven** (semua layout di JSON).

## Buka di editor

1. Godot 4.3+ → Import → pilih `godot/phagos/project.godot`.
2. Main scene: `scenes/Game.tscn` → ▶ Play.
   - Klik organ di world map (Usus Besar / Usus Halus terbuka duluan).
   - Gerak: WASD/arrows atau drag. `K` = clear ruangan (debug), `P` = Pulse debug,
     `M` = fullscreen minimap, `ESC` = kembali ke peta.

## Generate ulang dunia (idempoten, deterministik)

```bash
python3 godot/phagos/tools/gen_world.py   # atau: npm run gen:phagos-world
```

Menghasilkan `data/zones/*.json`, `data/world_map.json`,
`scenes/zones/*/rooms/*.tscn` (46), `assets/tilesets/*.png` (8).
Ubah `ZONES` / `SIZE` / `hazards_for()` di `tools/gen_world.py` untuk menata
ulang dunia, lalu generate ulang — tanpa menyentuh scene.

## Verifikasi

```bash
npm run verify:phagos-world   # 949 cek: data + kontrak + guard engine
```

## Struktur

```
godot/phagos/
├── project.godot
├── data/zones/*.json        8 zona (layout 46 ruangan ada di sini)
├── data/world_map.json      node, edge koridor, gate, GOAL 6/7
├── scenes/{Game,WorldMap,Zone,Room,Corridor}.tscn
├── scenes/zones/*/rooms/    46 stub ruangan (instance Room.tscn)
├── scripts/{util,core,world,ui,hazards,fx,actors,tests}/
├── assets/tilesets/         8 atlas preview per biome (+ runtime prosedural)
└── tools/gen_world.py       generator dunia
```

Dokumentasi lengkap + kontrak integrasi antar-agent:
[`docs/PHAGOS-WORLD-BUILD.md`](../../docs/PHAGOS-WORLD-BUILD.md).
