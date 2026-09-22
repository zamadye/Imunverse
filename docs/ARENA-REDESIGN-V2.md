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
