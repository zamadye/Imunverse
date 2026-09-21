# WORLD-MAP — Lapisan SNAP MACRO (peta tubuh seluruh organ)

**Status:** aktif sejak commit open-world pass (2026-09-21).
**Rujukan:** `ARENA_ZOOM_OUT_REFERENCE_.png` (commit owner `8acc8c5`) + spek world-map
dari sesi paralel (`f1de6fc`, gagal push karena token) — direkonstruksi di atas HEAD
yang sudah ter-push, bukan menimpa kerja siapa pun.

## Apa ini
Lapisan visual+data yang menampilkan SELURUH struktur tubuh saat SNAP MACRO aktif:
9 chamber organ berlobus berlabel (usus besar/halus, ginjal, pankreas, hati, lambung,
paru, jantung, kelenjar limfe=GOAL), 10 pembuluh berkelok (arteri/vena/limfe) +
rute teal START→GOAL, latar daging ber-vignette, denyut ~68 BPM.

## Berkas
- `data/body-map.json` — dunia 2600×3600, koordinat ternormalisasi (y atas=GOAL),
  palet per organ, anchor START (0.50,0.04) & GOAL (0.82,0.95).
- `js/render/world-map.js` — `drawWorldMap(ctx,P,def,time)` prosedural (tanpa aset)
  + `worldMapBounds(def)`.
- `js/core/game.js` — hook macro: saat macro aktif, kamera snap ke pusat peta,
  proyeksi ORTOGRAFIS datar (`camera.macroFlat`), follow pemain dimatikan sementara.
- `js/render/camera.js` — `macroFitZoom(shape)` auto-fit bounding box ke viewport;
  `makeProjector` mode flat; clamp `setCorridorZoom` dilonggarkan ke 0,02.

## Kontrol
- **Awal run:** SNAP MACRO auto-fit ±1,15 dtk (seluruh tubuh), lalu ease ke zoom
  starter zona (`shape.cameraZoom`).
- **Tahan B:** SNAP MACRO kapan pun. (M tetap untuk ganti mode hero; P lab prototipe.)

## Batasan saat ini (disengaja, tahap berikutnya)
- Gameplay micro masih memakai koridor organ per zona (`arena-shape.js`); peta tubuh
  adalah lapisan makro + fondasi geometri untuk migrasi chamber berikutnya.
- Hazard dinamik spek §4 (asam lambung, mukus, arus empedu) belum dipasang di lapisan ini.

## Verifikasi
`tools/verify-world.mjs` blok WORLD MAP: data 9 chamber/≥9 pembuluh/anchor, rute
START→GOAL kontinu, render macro tanpa error/NaN, target macro < 0,12.
Bukti visual: `docs/vision-snapshot/after-*-macro.jpg`, `after-macro-hold.jpg`,
dan `compare-macro-vs-reference.jpg` (macro game vs referensi owner).

## MIGRASI DUNIA KONTINU (2026-09-21) — SELESAI

Gameplay mikro tidak lagi koridor per-zona: seluruh run hidup DI DALAM peta
tubuh sebagai SATU dunia kontinu.

- `js/systems/body-world.js`: geometri union (chamber elips + pembuluh kapsul)
  + spatial hash; `insideLumen/sdf/reflect/chamberAt/spawnRing/zoneAnchorPx/
  reachabilityGrid`. Konvensi koordinat sama dengan renderer peta.
- `js/render/body-micro.js`: renderer gameplay dunia (daging bersel, pembuluh
  berlapis, chamber backlit berlobus, mulut persimpangan terbuka, vignette).
- `js/core/game.js`: startRun menempatkan pemain di anchor START; arenaClamp =
  pantul elastis lumen; proyektil mati di daging; spawn = ring dalam lumen;
  kamera mikro = `zone.zoom` zona aktif; macro B/intro tetap peta penuh.
- `js/systems/world-journey.js`: gerbang maju zona = POSISI pemain tiba di
  anchor zona berikutnya (pace wave & `forceNext` jadi jalur lab/dev).
- `data/zones.json`: rute disusun ulang menjadi jalur fisik START→GOAL
  (capillary→…→lymphNode) + `anchor/homeR/zoom/order` per zona.
- `data/body-map.json`: + chamber KAPILER & SARAF + pembuluh penghubungnya
  (11 chamber, 12 pembuluh) + `zoom` per organ.
- Guard `tools/verify-world.mjs`: invariant dunia (BFS satu komponen, pantul
  elastis 300 titik, zona-posisi, spawn lumen, proyektil daging, mekanik inti
  tak berubah) — ERROR (0); suite lain hijau.
- Bukti visual: `docs/vision-snapshot/compare-world-*.jpg` (kiri = koridor
  per-zona era f483f55, kanan = dunia kontinu) + `after-*-wide.jpg` baru.
