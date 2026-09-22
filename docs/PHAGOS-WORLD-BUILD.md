# PHAGOS — WORLD BUILD (Godot 4)

**Agent arena: dunia selesai dibangun.** 8 zona organ · 46 ruangan ·
world map + gate + fast travel · 21 tipe hazard · koridor antar organ ·
minimap · lighting "Planet Biru" · partikel ambient · momen "wow" per ruangan.

Proyek Godot: `godot/phagos/` (Godot 4.3+, GDScript, renderer GL Compatibility —
target Android utama, web sekunder).

---

## 1. Yang dibangun (peta sprint)

| Sprint spek | Status | Bukti |
|---|---|---|
| S1 fondasi + zona 1 (tileset, 4 ruangan, pintu, hero/musuh placeholder, hazard UB, cahaya, partikel) | ✅ | `scripts/`, `data/zones/usus_besar.json`, `scripts/actors/*placeholder*` |
| S2 world map + zona 2–4, minimap | ✅ | `scripts/world/world_map.gd`, `data/world_map.json`, `scripts/ui/minimap.gd`, 3 JSON zona |
| S3 zona 5–8, gate, fast travel | ✅ | 4 JSON zona, `scripts/world/world_rules.gd` |
| S4 boss arena, koridor, audio placeholder, perf | ✅ sebagian | 8 boss room + `scripts/world/corridor.gd`; audio ambient = `music_key` per zona (implementasi milik agent audio); perf = budget cahaya/partikel (lihat §7) |

Total: **46 ruangan** (4+5+5+6+5+6+7+8) sebagai PackedScene + 8 boss room
ber-layout unik (ukuran 35×28 + BossSpawn + hazard ganda).

## 2. Arsitektur

```
Game (Node, game.gd)
├── WorldMap (world_map.gd) — 8 OrganNode + 9 vessel + MapCamera + marker
├── Zone (zone.gd) — dimuat per zona: Rooms + ZoneCamera + Minimap + HUD
│   └── Room_* (room.gd + room_builder.gd dari JSON)
│       ├── Floor/Walls/Deco/Foreground (TileMapLayer, 64px, 8 tileset)
│       ├── WallBodies (StaticBody2D + gap pintu) + cover organik
│       ├── HazardAreas (HazardArea generik / node spesialis)
│       ├── SpawnPoints (Marker2D 4–8 + BossSpawn)
│       ├── Doors (door.gd: lock/unlock + trigger)
│       ├── Destructibles + Collectibles (+ Vendor di shop)
│       ├── Lights (≤6 PointLight2D) + FX (partikel, wow, feature)
└── Corridor (corridor.gd) — jalan kaki antar organ, blend A→B
```

**Data-driven (ATURAN 6).** Generator tunggal `godot/phagos/tools/gen_world.py`
(deterministik, seed tetap) menghasilkan seluruh JSON + 46 stub `.tscn` +
8 atlas PNG. Menata dunia = edit generator → generate ulang → verifikasi.
Tidak ada layout hardcode di scene maupun skrip.

Skema JSON zona mengikuti kontrak spek (`id/name/difficulty/rooms/
entry_room/boss_id/hazards/ambient_color/music_key`) + `palette`,
dan tiap ruangan membawa `size_tiles/connections/seed/wall_style/hero_entry/
spawns/boss_spawn/hazards/feature/covers/destructibles/collectibles/vendor/
drop_zone/wow/doors`.

## 3. World map & progres

- `data/world_map.json`: 8 node + 9 edge koridor, `start_ids=[usus_besar,
  usus_halus]`, `goal_id=jantung`, `goal_requires_cleared=6`.
- Graf: 2 START → ginjal/lambung → konvergensi pankreas → fork hati/paru →
  GOAL jantung (6 dari 7 zona lain clear).
- Logika gate MURNI di `world_rules.gd` (`is_unlocked/is_adjacent/
  travel_mode/validate_zone_graph`) — dipakai runtime & diuji headless.
- Fast travel: zona cleared = warp langsung. Kunjungan pertama yang adjacent
  = jalan kaki lewat `Corridor.tscn` (tanpa combat, collectible, blend visual
  gradual A→B). Non-adjacent = hint "belum ada jalur".
- Progres tersimpan `user://phagos_world.json` (`save_world.gd`).

## 4. Hazard (21 tipe, ATURAN 2: melukai SEMUA)

Base `hazard_area.gd` (Area2D, mask = hero+musuh): 12 mode
(`damage/slow/current/drain_pct/ph_cycle/tide/vapor/slippery/buildup/fog/
air/beat_push`) + `on_pulse()` (kabut tertiup 3 dtk, dsb).
Node spesialis: `valve_gate / kupffer_cell (netral, tak bisa mati) /
islet_cell (gelombang insulin) / fragile_wall (shortcut + invasi) /
sharp_crystal (pecah → Biokredit)` + pengendali level-ruangan
`room_feature.gd` (peristaltik 8 dtk, kontraksi 12 dtk, denyut 1 dtk +
`is_beat_window()` untuk bonus Pulse, airshift 5 dtk).

Semua hazard di JSON membawa `"affects": ["hero","enemy"]` — diverifikasi
per-hazard oleh guard (tidak ada hazard khusus-pemain).

## 5. Visual direction ("Planet Biru")

- CanvasModulate 50–70% + tint biome; hero = sumber cahaya utama;
  hazard/collectible glow; dinding menyerap cahaya (`zone_lighting.gd`).
- Partikel ambient per biome di SETIAP ruangan (CPUParticles2D 24–48,
  `ambient_particles.gd`).
- Momen "wow" prosedural per zona (`wow_feature.gd`, 8 jenis).
- 8 palet biome persis tabel spek; tileset prosedural per biome
  (`tileset_factory.gd` + atlas PNG preview) — dinding lipatan organik,
  bukan geometris (ATURAN 5).
- ATURAN 3: 8 warna utama berbeda — guard menegaskan semuanya unik.

## 6. Kontrak integrasi (untuk agent lain)

**Agent gameplay** — dunia menyediakan, gameplay memakai:

| Dunia sediakan | Cara pakai |
|---|---|
| `SpawnPoint`/`BossSpawn` (Marker2D) | `room.get_spawn_points()` / `get_boss_spawn()` |
| `HazardArea` (Area2D mask 2\|4) | daftarkan body di layer 2/4 + `take_damage/add_slow/heal/...`; signal `hazard_entered/exited` |
| `Door.lock()/unlock()` | kunci saat combat |
| Signal `room_entered/room_cleared/door_triggered`, `zone_entered/zone_cleared/boss_defeated` | hubungkan spawner & progresi |
| `room.set_enemies_alive(n)` / `notify_enemy_died(e)` | matikan `spawn_placeholders`, drive spawner asli |
| Pulse → `get_tree().call_group("pulse_listener","on_pulse",pos,radius,on_beat)`; jendela denyut `feature.is_beat_window()` | hubungkan ke Pulse asli |
| Hero placeholder (layer 2, group `hero`) | GANTI dengan Hero+Membran asli |

**Agent UI**: `ZoneHUD` & vendor hanya placeholder posisi — UI final milikmu.
**Agent audio**: `music_key` per zona + daftar event (denyut, katup, asam…)
siap di-mapping; belum ada implementasi suara.

## 7. Performa (target 60fps Android mid-range)

- ≤6 PointLight2D per ruangan, tanpa shadow; 1 tekstur radial dipakai bersama.
- CPUParticles2D kecil (24–48/ruangan, lifetime 5 dtk).
- Preload hanya ruangan adjacent; ruangan jauh di-free (`zone.gd`).
- Transisi <0,5 dtk: fade 0,2 + swap + 0,2, tanpa loading screen (`fade.gd`).
- Fisika 60 ticks, gravitasi 0 (top-down).

## 8. Verifikasi

```bash
npm run verify:phagos-world   # 949 cek: PASS
```

- `tools/verify-phagos-world.mjs`: data mendalam (graf/BFS, ukuran, spawn,
  hazard, pintu, gate, skema), 46 stub, 5 scene, 8 PNG, kontrak skrip (grep),
  semua `preload()` & referensi `.tscn` valid, lalu menjalankan guard engine.
- `scripts/tests/guard_world.gd` (295 cek via Godot headless): JSON, rules,
  8 tileset, partikel, wow, minimap/HUD, stub, save.

**Batasan sandbox (jujur):** build wasm `custom_build` di sandbox ini TIDAK
memiliki kelas fisika 2D sama sekali (Area2D/StaticBody2D/CharacterBody2D
absen dari ClassDB — slice arena yang ada pun menghindarinya). Skrip dunia
yang memakai fisika (room/door/hazard/actors/zone/corridor/world_map/game)
benar untuk target rilis (Godot 4.3+ penuh) dan kontraknya terverifikasi
statis di sini; uji nyala penuh butuh editor Godot standar (atau device).
Langkah pertama di mesin dev: buka `godot/phagos`, Play `Game.tscn`,
jalani 8 zona.

## 9. Kontrol debug (testing layout tanpa mekanik tempur — ATURAN 1)

Gerak WASD/panah/drag · `K` clear ruangan · `P` Pulse debug · `M` minimap ·
`ESC` peta. Hero movement-only bisa menjelajahi seluruh 46 ruangan; kontak
grind placeholder mensimulasikan clear untuk menguji lock pintu.
