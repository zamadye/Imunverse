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
