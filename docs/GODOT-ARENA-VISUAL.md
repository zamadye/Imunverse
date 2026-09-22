# GODOT ARENA — migrasi visual kelas Pathogenic (langkah 1: vertical slice)

Menjawab mandat owner: referensi (Aberrant Labs, *Pathogenic*) dibangun di **Godot
Engine**, bukan canvas 2D murni — karena itu fitur grafis engine dipakai
langsung. Dokumen ini mencatat vertical slice yang SEKARANG berjalan di sandbox
ini, bukti visualnya, dan peta jalan migrasi penuh.

## 1. Toolchain Godot di sandbox (sudah terbukti)

Mesin: **Godot 4.7.2.stable (web/wasm32, nothreads)** via paket npm
(`docs/GODOT-SETUP.md`):

```bash
npm i                                   # jsdom untuk shim headless
node tools/godot/install.mjs            # pack+unpack mesin -> tools/godot/engine/
node tools/godot/run.mjs godot/arena --headless --path godot/arena --script res://guard.gd
LD_LIBRARY_PATH=/tmp/alx/lib:/tmp/alx node tools/godot/serve-arena.mjs   # render di Chromium
```

`serve-arena.mjs` mem-boot mesin wasm di halaman Chromium sungguhan (canvas
WebGL2 via SwiftShader), menyalin project ke MEMFS persis seperti `run.mjs`,
lalu memotret scene → `docs/vision-snapshot/godot-arena-1.jpg` (LOCKDOWN) dan
`godot-arena-2.jpg` (SWARM).

## 2. Isi vertical slice (`godot/arena/`)

| Pilar Pathogenic | Implementasi Godot-native |
|---|---|
| Soft-body 2D (spring joints) | `chamber_sim.gd` (ring 48 simpul, k=0.1 damp=0.85, heartbeat) + `spring_ring.gd` (48 Sprite2D segmen disusun ulang tiap frame; impact = impulse ke simpul tetangga) |
| Normal map + cahaya basah | `CanvasTexture` (diffuse AI + **normal map** hasil `tools/godot/make-normal.mjs`) pada lantai & segmen dinding; **PointLight2D**: lentera pemain hangat, 2 bioluminesensi teal pengembara, light per proyektil neon |
| Bloom / HDR glow | billboard **aditif** (`CanvasItemMaterial.BLEND_MODE_ADD`) di tiap sumber cahaya/proyektil — padanan glow WorldEnvironment yang compat-web-safe (screen/viewport texture TIDAK tersedia di renderer compatibility web; dicoba & didokumentasikan kegagalannya) |
| ParallaxBackground multi-layer | 3 ParallaxLayer (deep 0.35 / mid 0.65 / front 1.25: eritrosit hanyut) |
| Partikel engine | `GPUParticles2D` 90 eritrosit, `damping 22–34` = fluid drag lembam |
| Aset asli (bukan gambar kode) | `godot/arena/tex/*.png` hasil generate_image + normal map + key-alpha (`tools/godot/key-alpha.mjs`) |

State machine arena (ENTRY→LOCKDOWN→SWARM→PURIFIED→OPEN) hidup di slice ini
(label kiri-atas menampilkan state + jumlah patogen + buka-tutup pintu).

## 3. Guard headless (Godot)

`guard.gd` (SceneTree) memverifikasi fisika & state machine yang sama dengan
guard JS: state machine lengkap, containment sprint 6 dtk, impact penyok→membal,
mulut pintu OPEN meloloskan entitas. Hasil terakhir: **GUARD_TOTAL_FAIL=0**.

## 4. Pelajaran renderer web (penting untuk langkah berikutnya)

1. `hint_screen_texture` & SubViewport-ke-ColorRect menghasilkan layar HITAM di
   build wasm compatibility — bloom pasca-proses harus lewat jalur lain
   (billboard aditif, atau viewport texture pada renderer forward saat tersedia).
2. `Module.initConfig({canvas, canvasResizePolicy:0})` WAJIB dipanggil sebelum
   `callMain`, иначе viewport jatuh ke ukuran aneh (64 px).
3. `--audio-driver Dummy` diperlukan di headless/Chromium tanpa gesture audio.
4. PNG mentah tidak bisa `load()` runtime — pakai `Image.load_from_file()`.
5. Tekstur AI ber-type RGB (tanpa alpha) → key-alpha dulu untuk sprite partikel.

## 5. Peta jalan migrasi penuh (increment berikutnya)

1. Port gameplay inti ke GDScript data-driven: baca `data/*.json` (arenas,
   zones, upgrades, skills) — engine core JS tetap referensi perilaku.
2. HUD 5 elemen spec owner sebagai Control Godot (canvas HUD JS jadi rujukan layout).
3. Sprite patogen berduri per keluarga musuh (generate_image + key-alpha).
4. Export Web rilis (`phagos.space`): template web = build wasm yang sama;
   bundling pck + serve COOP/COEP-free (nothreads).
5. Jembatan save/meta: ekspor-impor JSON save lama agar progres pemain bertahan.

Bukti: `docs/vision-snapshot/godot-arena-1.jpg` (LOCKDOWN: katup terkunci,
cahaya pemain, dinding utuh) & `godot-arena-2.jpg` (SWARM: patogen menyala,
eritrosit hanyut, bioluminesensi di membran).
