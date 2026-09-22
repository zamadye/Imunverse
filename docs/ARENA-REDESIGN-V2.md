# ARENA REDESIGN V2 — "DARK WET CHAMBER" (2026-09-22)

Keputusan owner: design arena lama (lapangan beige + garis membran merah +
voronoi terang di luar) DIROBOHKAN, bukan ditambal. Dokumen ini mencatat
perombakan total beserta buktinya.

## 1. Yang dirobohkan vs yang baru

| Aspek | LAMA (dibuang) | BARU |
|---|---|---|
| Interior | beige/krem terang merata | jaringan GELAP jenuh basah, sel voronoi redup, pembuluh gelap, kilau specular |
| Cahaya | merata | kolam cahaya mengikuti pemain (uniform `u_player`) + AO menempel dinding |
| Membran | garis merah tipis | pita daging tebal (W=26) + rim putih-panas berdenyut |
| Luar chamber | mosaik voronoi biru/teal terang | daging near-black + glow organ samar |
| Pilar | cincin merah terang | massa near-black ber-rim tipis (cover bullet-hell) |
| Skala ruang | R 620–700 (field terbuka) | R 300–340 (ruang TIGHT ala bullet-hell Pathogenic) |
| Framing | zoom koridor 0.66, dinding sering di luar layar | diorama: SELURUH membran masuk bingkai (guard wajib) |
| Kamera | follow penuh + epic zone-zoom map | follow authority 0.35 (chamber terkunci di bingkai), zoneScale=1 |

## 2. Lokasi perubahan

- `js/render/body-gl.js` — FRAG ditulis ulang (art direction baru), uniform
  `u_player`, default palet gelap.
- `data/arenas.json` — `chamber.radius` 300–340; `chamber.shape.stretch`
  aspek landscape (bbox ~1.3–1.4 agar fit layar 16:9); `chamber.wall`
  palet gelap per organ (data-driven, engine core tak berubah).
- `js/core/game.js` — `chamberFitZoom(run)` (bbox dari `radiusAt`, margin
  1.06), follow diorama k=0.35, `setSpeedZoom(0)` & `setZoneZoom(1)` saat
  chamber, targetZoom chamber = fit.
- `tools/verify-world.mjs` — guard baru "DESAIN ULANG: framing combat —
  SELURUH membran chamber masuk bingkai" (48 titik membran diproyeksikan).

## 3. Bukti (vision snapshot)

- BEFORE (design lama): `docs/vision-snapshot/before-redesign2-*.jpg`
- AFTER (design baru): `docs/vision-snapshot/after-chamber-*.jpg`,
  `after-pathogen-closeup.jpg`
- Guard: 4 suite JS ERROR(0) termasuk guard framing; Godot guard TOTAL_FAIL=0.

## 4. Tak berubah (mandat owner)

Engine core (loop, collision, spawn, save), ekonomi, mutasi, HUD 5 elemen,
state machine LOCKDOWN→SWARM→PURIFIED→OPEN, spore vents, shockwave, mulut
pintu teal — semua mekanik tetap; hanya presentasi & skala ruang yang ulang.

## 5. INCREMENT LABIRIN SATU KESATUAN (2026-09-22, mandat owner lanjutan)

Owner: arena jangan luas & jangan putus per zona — satu kesatuan labirin
koridor saling terhubung; hanya organ besar (jantung) yang lapang. Referensi
denah: `docs/reference-pathogenic/ARENA_ZOOM_OUT_REFERENCE_.png` (commit
owner `8acc8c5`): lumen pembuluh teal berkelok START→GOAL menyambungkan semua
chamber organ; spec owner: navigasi HANYA di dalam lumen + chamber, collision
mask, arus hemodinamik.

Implementasi:
- `data/lumen-labyrinth.json` — graf 13 node (7 chamber organ + junction) &
  15 edge koridor berkelok (bend), lebar 68; route START→GOAL + 3 cabang
  silang (loop labirin). Chamber `big` hanya jantung (r 230).
- `js/systems/lumen-labyrinth.js` — SDF union(chamber, kapsul koridor) minus
  obstacle (pilar + SEGEL katup saat lockdown/swarm); state machine PER-ROOM
  (masuk room belum bersih → LOCKDOWN → SWARM → PURIFIED → OPEN = segel
  lepas); `currentAt()` arus hemodinamik; interface kompatibel BioChamber
  sehingga engine core tak berubah.
- `js/render/body-gl.js` FRAG v3 — SDF segmen (u_ch/u_seg/u_segw/u_obs),
  motif per-chamber terdekat, segel katup = cakram teal menyala, art
  direction DARK WET CHAMBER dipertahankan.
- `js/core/game.js` — labirin dibuat SATU kali per run (ganti zona tidak
  memutus ruang); kamera follow penuh zoom 0.85 (koridor sempit terbaca).
- Guard baru `verify-world`: (a) koridor TERTUTUP — dinding ≤ 460 world di
  8 arah sekeliling pemain kecuali chamber big; (b) SATU KESATUAN — seluruh
  route + koridor kontinu (sampel SDF < 0). 4 suite JS ERROR(0).

Bukti: `docs/vision-snapshot/after-chamber-swarm-hud.jpg` (labirin terhubung +
segel katup di room aktif), `after-chamber-open-door.jpg` (katup terbuka,
eritrosit mengalir antar-room), `after-pathogen-closeup.jpg`.

## 6. KOHERENSI MAKRO-MIKRO (increment "next", 2026-09-22)

Spec owner (commit `8acc8c5`): zoom macro→micro SEAMLESS — peta macro adalah
dunia yang sama, bukan papan terpisah. Implementasi:

- `tools/sync-bodymap.mjs` — `data/body-map.json` DIREGENERASI dari
  `data/lumen-labyrinth.json` (satu sumber kebenaran): world bbox, organ xy
  (flip-Y agar orientasi = foto referensi: START bawah, GOAL atas), vessels =
  edge koridor berkelok, anchors START/GOAL. Denah tak boleh edit manual.
- Layout labirin v2 mengikuti tata letak foto referensi: usus bawah,
  ginjal-lambung kanan-tengah, hati kiri, pankreas pusat, paru-jantung atas,
  GOAL kanan-atas; 19 node / 24 koridor; palet & motif per-organ di data.
- Status denah (cleared/active/locked) + overlay room-graph kini mengikuti
  ROOM FISIK labirin (`extra.lab`), bukan journey zona lama.
- `macroView` memakai flag `camera.macroFlat` (fit labirin ≈ 0.39 > ambang
  lama 0.25); guard SNAP MACRO disesuaikan (< 0.6).
- Dinding labirin berdenyut fisik (sistole/diastole) — guard beat baru.

Bukti: `after-map-denah-states.jpg` (denah = proyeksi labirin, route teal
menanjak START→GOAL, node status fisik), `after-chamber-swarm-hud.jpg`
(micro), keduanya satu koordinat dunia.

## 7. INCREMENT a/b/c (2026-09-22, arahan owner "a»b»c")

(b) GAMEPLAY PER-ROOM — `a6a2ff3`
- Kuota musuh simultan per node (data `enemies`); junction = pass-through aman.
- Wave spawnSys PAUSE kecuali room aktif SWARM dan alive < kuota (musuh tak
  bocor antar-room).
- Hazard Layer C spec owner: lambung = acid DoT (2 HP/0.5 dtk), usus halus &
  usus besar = mucus (speed x0.6 via `mucusSlow` player), hati = bile (dorong
 沿 arus x2.2). Guard: junction, hazard, pause-lockdown, mucus.

(c) BLOOM ADDITIVE — `a0424be`
- Dua pass blur 'lighter' (8px a0.26 + 20px a0.10) pada frame GL: rim membran,
  segel katup, glow patogen menyala kelas engine; black level dijaga.

(a) PARITY GODOT LABIRIN — `926fef5`
- `tools/godot/gen-lab-gd.mjs` -> `godot/arena/lab_data.gd` (SATU SUMBER json).
- `godot/arena/labyrinth_sim.gd`: SDF union(chamber,kapsul)-segel, state
  per-room, junction aman — mirror JS.
- guard.gd check-7: kontinuitas route (0/153 putus), koridor tertutup 8 arah,
  segel menahan saat lockdown, junction open. TOTAL_FAIL=0.
- arena.gd MODE LAB: slice visual labirin (koridor Line2D ber-rim additive,
  chamber, segel teal, patogen bintang berduri, traversal route + kamera
  follow). Bukti `godot-arena-1.jpg` (SWARM room kapiler + segel) &
  `godot-arena-2.jpg` (traversal OPEN).
