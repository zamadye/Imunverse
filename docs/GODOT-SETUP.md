# GODOT DI SANDBOX — Panduan Instalasi & Pemakaian (lengkap)

Dokumen ini mencatat **satu-satunya cara yang terbukti berjalan** untuk
menjalankan Godot di sandbox proyek ini (terakhir diverifikasi:
Godot **4.7.2.stable.custom_build.8388370f0**, build Emscripten 4.0.14,
single-threaded).

> **Kenapa tidak unduh langsung?**
> Di sandbox ini unduhan langsung **diblokir**:
> `objects.githubusercontent.com` (assets GitHub Releases) → gagal,
> `downloads.tuxfamily.org` → gagal. Yang **tembus**: `registry.npmjs.org`
> (dan `codeload.github.com` untuk source tarball).
> Karena itu Godot diambil sebagai **paket npm**, lalu di-*pack* /
> di-*unpack* secara manual — persis seperti yang diminta.

---

## 1. Ringkas (untuk sesi berikutnya)

```bash
npm i                          # wajib: jsdom (devDependency) untuk shim DOM
node tools/godot/install.mjs   # pack+unpack mesin → tools/godot/engine/
node tools/godot/run.mjs --version-only
# keluar: 4.7.2.stable.custom_build.8388370f0
```

Menjalankan project + skrip GDScript:

```bash
node tools/godot/run.mjs <folder-project> --headless --path <folder-yang-sama> --script res://nama.gd
```

---

## 2. Yang sebenarnya terjadi (langkah demi langkah)

1. **Ambil mesin lewat registry npm**
   `npm pack @ringozz/godot-web-wasm32@4.7.2-626`
   → `ringozz-godot-web-wasm32-4.7.2-626.tgz` (~6,4 MB; 24 MB setelah dibongkar).
   Isi pentingnya di `package/gen/`:
   - `godot.web.template_release.wasm32.nothreads.js` — glue Emscripten (ESM,
     `export default Godot`)
   - `godot.web.template_release.wasm32.nothreads.wasm` — **mesin Godot 4.7.2**
     hasil kompilasi WebAssembly (23 MB)
2. **Bongkar** (`tar -xzf`) lalu salin dua berkas di atas ke
   `tools/godot/engine/`. Glue-nya ber-ekstensi `.js` tetapi berisi sintaks ESM,
   jadi digandakan menjadi `godot.mjs` agar bisa `import` dari Node.
3. **Shim DOM** (`tools/godot/shim.mjs`): mesin ini build *web*, jadi saat boot
   ia menyentuh `window` / `document` / `HTMLCanvasElement`. Node tidak punya
   itu → pakai **jsdom** (sudah devDependency repo). `getContext()` dipaksa
   mengembalikan `null` supaya Godot memilih jalur **headless** (tidak pernah
   membuat konteks WebGL).
4. **Jalankan** (`tools/godot/run.mjs`):
   - `wasmBinary` dikirim langsung (`fs.readFileSync`) — perlu karena Node
     tidak bisa `fetch('file://…')` untuk mengambil `.wasm`.
   - Berkas project disalin ke **MEMFS** (sistem berkas virtual Emscripten)
     lewat `Module.copyToFS(path, buffer)`. **Jalur di MEMFS harus sama dengan
     jalur host-nya**, karena `--path` Godot membaca jalur itu.
   - Argumen Godot diberikan lewat `Module.callMain([...])`.
   - Keluaran GDScript ditangkap dari `print()` → stdout Node.

---

## 3. Struktur

```
tools/godot/
├── install.mjs   # pack+unpack mesin dari npm, lalu buktikan dengan --version
├── shim.mjs      # jembatan DOM (jsdom) agar mesin web build bisa jalan di Node
├── run.mjs       # runner: salin project ke MEMFS + panggil callMain()
└── engine/       # HASIL INSTALASI — jangan di-commit (lihat .gitignore)
    ├── godot.mjs
    ├── godot.web.template_release.wasm32.nothreads.js
    ├── godot.web.template_release.wasm32.nothreads.wasm
    └── package.json
```

NPM script:

```bash
npm run godot:install   # = node tools/godot/install.mjs
npm run godot:version   # = node tools/godot/run.mjs --version-only
```

---

## 4. Yang BISA dan TIDAK BISA di sandbox ini

| Kemampuan | Status | Catatan |
|---|---|---|
| `--version`, argumen CLI | ✅ | `Godot.callMain(['--headless','--version'])` |
| Menjalankan project (`--path`) | ✅ | berkas harus disalin ke MEMFS dulu |
| Menjalankan GDScript (`--script res://x.gd`) | ✅ | skrip `extends SceneTree`, akhiri dengan `quit(0)` |
| Membuat/mengubah `Animation`, `AnimationPlayer`, `Skeleton2D`, `Bone2D` | ✅ | dipakai untuk **menulis** animasi |
| Mengambil sampel animasi (`AnimationPlayer.seek(t, true)`) | ✅ | inilah cara **memanggang** kurva ke JSON |
| Mengubah resource, impor aset, `--export*` editor | ❌ | ini build **template_release** (bukan editor) |
| Render ke PNG / WebGL / viewport | ❌ | tidak ada WebGL di Node; `getContext()` = null |
| Ekspor `.pck` / platform export | ❌ | butuh build editor + export template |

**Konsekuensi desain:** Godot dipakai sebagai **alat authoring & pemanggang
kurva** (headless). Yang menggambar ke layar tetap kanvas 2D game ini.
Alurnya: `rig Godot (Skeleton2D + AnimationPlayer)` → `print(JSON)` →
`data/*.json` → renderer kanvas. Karena project-nya berkas `.gd`/`project.godot`
biasa, ia bisa dibuka dan disunting manual di Godot editor di mesin mana pun.

---

## 5. Contoh minimal (sudah teruji)

`project.godot`

```ini
config_version=5

[application]
config/name="bake"
run/main_scene=""
config/features=PackedStringArray("4.7", "GL Compatibility")

[rendering]
renderer/rendering_method="gl_compatibility"
```

`bake.gd`

```gdscript
extends SceneTree

func _initialize() -> void:
    var anim := Animation.new()
    anim.length = 0.5
    var i := anim.add_track(Animation.TYPE_VALUE)
    anim.track_set_path(i, "Leg:rotation")
    anim.track_insert_key(i, 0.0, -0.4)
    anim.track_insert_key(i, 0.25, 0.4)
    anim.track_insert_key(i, 0.5, -0.4)
    print("BAKE_JSON:" + JSON.stringify({"keys": anim.track_get_key_count(i)}))
    quit(0)
```

```bash
node tools/godot/run.mjs projek --headless --path projek --script res://bake.gd
# → Godot Engine v4.7.2.stable.custom_build…
# → BAKE_JSON:{"keys":3}
```

---

## 6. Troubleshooting

| Gejala | Sebab | Obat |
|---|---|---|
| `Cannot find module 'jsdom'` | `node_modules` tidak ikut tersimpan antar-sesi | `npm i` |
| `Invalid project path specified` | berkas belum masuk MEMFS | pastikan runner menyalin folder project (`copyToFS`) dan `--path` = jalur yang sama |
| `window is not defined` | shim belum dimuat | `import './shim.mjs'` **sebelum** `import Godot` |
| `both async and sync fetching of the wasm failed` | `wasmBinary` tidak dikirim | kirim `wasmBinary: fs.readFileSync(...wasm)` |
| Godot diam saja / langsung keluar | skrip bukan `extends SceneGraph`/`SceneTree` | pakai `extends SceneTree` + `func _initialize()` + `quit(0)` |
| Ingin versi lain | versi paket npm = versi Godot | ganti `VER` di `install.mjs` (mis. `4.7.2-626`) |

---

## 7. Catatan lisensi

Mesin Godot berlisensi **MIT** (dan seluruh kode pihak ketiga di dalamnya
berlisensi permisif) — lihat
<https://godotengine.org/license>. Paket npm `@ringozz/godot-web-wasm32`
hanya membungkus mesin tersebut; berkas `package.json` aslinya disalin ke
`tools/godot/engine/` sebagai penanda asal-usul. Folder `engine/` **tidak
di-commit** (di-`.gitignore`) supaya repositori tetap ramping — siapa pun
tinggal menjalankan `node tools/godot/install.mjs`.
