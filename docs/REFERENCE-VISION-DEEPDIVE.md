# Deep-dive Vision: referensi vs gameplay (2026-09-21)

Metode: frame asli `Character_and_arena_reference.mp4` (26,8 dtk) diekstrak
ffmpeg (`fps=1/4`) dan `ARENA_ZOOM_OUT_REFERENCE_.png` dilihat langsung dengan
vision; gameplay kita di-screenshot Chromium headless pada build `f1529d5`
(dunia kontinu). Pasangan banding disimpan di `docs/vision-snapshot/`:
`compare-video-vs-game-heart.jpg`, `compare-video-vs-game-cap.jpg`,
`compare-refmap-vs-macro.jpg` (kiri = referensi, kanan = game).

## A. Apa yang membuat referensi terlihat "production"
1. **Tissue = mosaik voronoi multi-hue**: sel sisik kobalt/teal dengan grout
   gelap tebal, cluster sel coral/merah menyelip, kilau spekular kecil per sel,
   ukuran sel kecil-padat (bukan gelembung besar satu hue).
2. **Dinding = pita crimson glossy tipis**: tiga nada (tepi gelap, badan cerah,
   garis specular putih-muda) — tajam, bukan pita lebar matte.
3. **Fringe = rumbai organik irregular**: gumpalan coral-cokelat di sudut/
   convexity (seperti stalaktit), bukan deret bead seragam.
4. **Interior amber berhaze**: pool cahaya lunak + berkas ray, debu melayang,
   massa organ bertekstur honeycomb/bintik, chordae tan tipis meradiasi.
5. **Kontras global**: lipatan bayangan hampir hitam di tepi layar & celah
   antar struktur (AO), inti hangat terang — kedalaman baca seketika.
6. **Peta macro (referensi owner)**: organ anatomis bertekstur internal
   (bronkus, rugae, medula ren, coil usus haustra), pembuluh tube 3D berspecular,
   rute teal ber-chevron menyala, patogen sprite berduri detail, label pill.

## B. Gap gameplay kita (build f1529d5, renderer Canvas 2D)
- tissue: gelembung besar satu hue lavender-kobalt, grout tipis → datar.
- dinding: pita lebar matte + bead fringe seragam → "generated", bukan organik.
- interior: gradien mulus; massa tanpa tekstur honeycomb; tanpa ray/debu.
- kontras: midtone merata; lipatan tepi lemah.
- Semua efek di atas butuh operasi PER-PIKSEL (voronoi, fbm, AO, grain) —
  Canvas 2D hanya punya gradient/shape primitif → inilah akar "HTML5 biasa".

## C. Putusan teknis
Renderer dunia dipindah ke **WebGL2 fragment shader** (`js/render/body-gl.js`):
SDF union chamber+pembuluh (sumber data sama dengan body-world.js), shading
per-pixel: voronoi tissue multi-hue + grout, pita crimson glossy + specular,
fringe fbm irregular, interior haze + ray + honeycomb mass + debu, AO celah,
vignette lipat gelap, grain halus, pulsasi BPM. Canvas 2D (`body-micro.js`)
tetap sebagai FALLBACK bila WebGL2 unavailable (jsdom/preview lama).
Entitas, HUD, efek tetap di lapisan Canvas 2D utama (drawImage lapisan GL).

## D. HASIL PASS WEBGL2 (commit lanjutan)
`js/render/body-gl.js` live: union SDF chamber+pembuluh per-pixel dengan
voronoi tissue multi-hue ber-grout gelap + punggung sel membulat, pita crimson
glossy 3-nada + garis specular + rumbai tuft fbm di bibir dalam, interior amber
jenuh ber-haze (pool, ray, debu bulat, massa honeycomb irregular), AO celah
dalam, vignette lipat, grain, pulsasi BPM. Boundary di-wobble fbm supaya
organik. Fallback Canvas 2D otomatis bila WebGL2 tiada (jsdom tetap hijau).
Bukti: `compare-video-vs-game-*.jpg` (video kiri, GL kanan) &
`compare-world-*.jpg` (canvas dunia kiri, GL kanan) + `after-*.jpg` baru.
Gap tersisa (pass berikutnya): chordae strand meradiasi, penempatan massa per
organ sesuai anatomi, sprite patogen berduri detail, peta macro gaya ilustrasi
referensi owner (tekstur internal organ + tube 3D berspecular).
