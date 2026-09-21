# PHAGOS — Audit Codebase & Aset untuk Reset UI/UX

**Tanggal:** 2026-09-21
**Branch:** `arena/01a0c285-imunverse` (bercabang dari `arena/01a0bc77-imunverse` @ `6db9a72`)
**Sifat dokumen:** hasil baca kode + inventaris aset, jadi pegangan reset UI/UX.

> ### STATUS — keputusan owner sudah turun (2026-09-21)
>
> | Poin | Keputusan | Status |
> |---|---|---|
> | Scope penghapusan (§4) | **Opsi B — semua aset visual**; audio & ikon PWA diselamatkan | ✅ **SELESAI** — 269 file / ~64 MB dicabut, `assets/` 67 MB → 2,8 MB. Manifest + cara restore: `docs/UI-UX-RESET-DELETED-ASSETS.md` |
> | Nasib arah PR #44 (pixel-art + Organ Ascent + Last Asylum) | **"Video yang memutuskan"** — dibandingkan dengan isi video dulu | ⏳ Menunggu video |
> | Video referensi (§3) | Owner **re-commit** file aslinya ke branch | ⏳ **BLOCKER** — file di repo masih 2 byte |
>
> Yang belum disentuh dan menunggu video: `styles/` (5.687 baris), markup 19 screen,
> token palet cream/teal/coral, `data/creature-rigs.json` (1,7 MB), `data/crawl-cycles.json`.
> Menghapus aset saja **tidak** me-reset UI/UX — lihat §5.

---

## 1. Peta codebase (apa adanya, dari kode)

Game = **PHAGOS**, HTML5 roguelike survival bertema sel imun.
**Vanilla JS ES6 modules + Canvas 2D, tanpa build step.** Dijalankan lewat server statis
(`npm start` → `python3 -m http.server 8000`). Satu dependensi runtime: **Rive**
(`@rive-app/canvas`, di-vendor di `js/vendor/rive/` supaya tetap offline). Three.js
di-vendor juga (`js/vendor/three.module.js`).

| Lapisan | Lokasi | Ukuran |
|---|---|---|
| Entry point + kerangka screen (overlay DOM) | `index.html` | 603 baris |
| Design system + CSS per-layar | `styles/` (4 file) | **5.687 baris** |
| Logika game | `js/` (98 modul, di luar `vendor/`) | **26.193 baris** |
| Sumber kebenaran data | `data/` (39 JSON) | ~2,1 MB |
| Aset biner | `assets/` (308 file) | **67 MB** |
| Verifikasi / e2e / generator | `scripts/` (19), `tools/` (34) | — |

### 1.1 CSS — di sinilah UI/UX tinggal

| File | Baris | Isi |
|---|---|---|
| `styles/main.css` | 2.423 | Design system inti: token warna/radius/shadow/font, screen dasar, toast, HUD, semua komponen |
| `styles/dashboard-focus.css` | 1.902 | Dashboard "focus" (hero + tombol MAIN + nav sekunder) |
| `styles/dashboard-map.css` | 1.128 | Peta Tubuh / koridor kampanye |
| `styles/portrait.css` | 234 | Penyesuaian orientasi portrait |

**Token desain saat ini** (`main.css` `:root`) — palet *cream / teal / coral / sage*:

```
--cream #fdf6e3   --card #fffdf4    --ink #123f3a     --teal #2f9c8f
--teal-deep #1f7a70  --teal-dark #14584f  --mint #ddeec9  --sage #a9d795
--coral #f2825c   --coral-deep #e96a4c    --gold #f5c64f  --heart #f0685a
--r-xl 34px  --r-lg 26px  --r-md 18px  --r-sm 13px  --pill 999px
--font "Nunito","Quicksand","Varela Round",ui-rounded,…
```

Bentuk khas yang sekarang dipakai: `clip-path` "sel meleleh" (`#sel-netes`,
`#sel-netes-play`) di `index.html`, kartu super-rounded, nav dock berlabel,
HUD pill cream di atas arena teal.

### 1.2 Screen (19, semua overlay HTML/CSS di atas `<canvas id="game">`)

```
loading · title · dashboard · fullmap · shop · roster · codex · herodetail
auth · profile · hud · curguide · missions · levelup · openbox · signup
pause · revive · gameover
```

Satu modul per layar di `js/ui/screens/` (18 file), diregistrasi lewat
`js/ui/screen-manager.js`, komunikasi gameplay⇄UI lewat event bus
`js/core/ui-bridge.js` (tidak ada dependensi silang).

### 1.3 Render — visual in-game BUKAN dari CSS

Penting untuk reset: tampilan arena & karakter digambar di canvas, bukan DOM.

| File | Peran |
|---|---|
| `js/render/background.js` | Latar tubuh prosedural parallax |
| `js/render/shape-renderer.js` | Projectile, partikel, pulse glow, health bar |
| `js/render/sprite-loader.js` | Preload semua PNG → cache `Image`, **punya fallback placeholder** |
| `js/render/creature-rig.js` + `data/creature-rigs.json` (1,7 MB) | Mesin **vektor prosedural** untuk bio-form abstrak |
| `js/render/crawl-rig.js`, `js/systems/crawl-rig.js` + `data/crawl-cycles.json` | Siklus gerak/crawl hasil bake Godot |
| `js/render/organ-corridor.js`, `js/systems/arena-shape.js` | Koridor organ vertikal (pilot "Organ Ascent") |
| `js/render/rive-rig.js` + `assets/rive/hero-locomotion.riv` | Animasi jalan hero (Rive) |
| `js/render/character-visuals.js`, `character-preview.js`, `hero-mode.js` | Mode tampilan hero: `foto` (sprite PNG) vs `makhluk` (rig vektor) |
| `js/render/cine-banner.js`, `js/ui/wave-cinematic.js`, `js/systems/mutation-cinematic.js` | Banner/sinematik |

Artinya: **menghapus `assets/` tidak otomatis me-reset tampilan in-game**, karena
7 dari 11 hero sekarang bisa dirender prosedural dari JSON rig. Reset UI/UX yang
nyata = CSS + `index.html` + sprite/foto + (opsional) data rig.

### 1.4 Status arah desain terakhir (dari PR #44 di branch induk)

PR #44 "PILOT: Arena Organ Ascent (Bilik Jantung) + Character Abstract Bio-Form
(Mako)" — urutan revisi yang sudah masuk:

1. Arena datar (cawan petri r=750) → **koridor vertikal bersiluet organ**, 7 organ.
2. Karakter "human anime chibi" → **DIBATALKAN**; jadi bio-form abstrak **tanpa mata/mulut**.
3. Kritik owner "bentuk bulat + arena flat bukan standar" → pivot **pixel-art**
   (referensi Brotato / Death Must Die / Halls of Torment / Hades): lantai gelap
   bertekstur, sprite terang ber-outline, prop bervolume + bayangan.
4. Brief **"Last Asylum"**: pitch kamera 58° (`PERSP.YS` 0,85), telefoto (`K` 1,0),
   arc-turn badan 13 rad/s, secondary lag ekor sitoplasma 3 segmen, bob pelvis 2×/siklus.

Aset hasil pilot ini: `assets/sprites/px/` (10 file — hero macrophage px, enemy px,
floor/wall jantung, prop trabekula/gumpalan).

Rujukan strategi: `docs/ARENA-CHARACTER-REDESIGN-STRATEGY.md`,
`docs/PILOT-ORGAN-ASCENT-JANTUNG.md`, `docs/CHARACTER-PROTOTYPE-EVAL.md`.

---

## 2. Inventaris aset (308 file / 67 MB)

| Direktori | File | Ukuran | Dipakai? | Kalau dihapus |
|---|---|---|---|---|
| `assets/sprites/` | 185 | 13 MB | **ya** (292 ref) | Hero/musuh/nutrisi/ikon/arena jadi placeholder; `px/` = hasil pilot hilang |
| `assets/character-art-src/` | 50 | **49 MB** | **tidak** (orphan) | Aman — sumber mentah dev-only untuk `tools/build-mutation-sprites.py` |
| `assets/audio/` | 34 | 2,6 MB | ya (36 ref) | BGM + 29 SFX hilang → game bisu |
| `assets/icons/` | 28 | 240 KB | ya (85 ref) | Ikon UI + **PWA icon** (`pwa-192/512/maskable`) hilang → manifest & `index.html` rusak |
| `assets/ui/` | 4 | 1,9 MB | ya (10 ref) | Latar dashboard/fullmap/loading + **logo PHAGOS** hilang |
| `assets/chapters/` | 6 | 568 KB | ya (6 ref) | Foto bab 1–6 (luka/demam/racun/alergi/kanker/final) hilang |
| `assets/rive/` | 1 | 8 KB | ya (3 ref) | Rig animasi jalan hero hilang |

**Ringkasan pemakaian:** 257 file direferensikan kode/data · **51 orphan**
(50 di `character-art-src/` + `assets/sprites/enemy_parasit.png`).

### 2.1 Referensi rusak yang SUDAH ada sebelum reset (7)

Ini utang lama, bukan akibat reset — layak dibereskan sekalian:

```
assets/ART_BIBLE.md                                     (dirujuk 3 file, tidak ada)
assets/fonts/imunverse-head.woff2                       (dirujuk 2 file, tidak ada)
assets/fonts/imunverse-num.woff2                        (dirujuk 1 file, tidak ada)
assets/sprites/icon_crosshair.png                       (dirujuk 2 file, tidak ada)
assets/buildings/reference/colony_buildings_reference_sheet.png   (1, tidak ada)
assets/enemies/reference/pathogen_path_reference_sheet.png        (1, tidak ada)
assets/heroes/reference/hero_tower_reference_sheet.png            (1, tidak ada)
```

Catatan: `assets/fonts/` dirujuk CSS tapi **direktori-nya memang tidak pernah ada** —
font jatuh ke fallback sistem (`Nunito`/`Quicksand` tidak ter-embed).

### 2.2 Titik referensi terpadat (urutan dampak kalau aset dicabut)

```
 89  data/heroes.json          (sprite/idle/attack/walk/portrait/mut1/mut2 per hero)
 68  index.html                (logo, ikon tombol, dekor loading, avatar)
 39  data/enemies.json
 34  data/audio.json
 26  data/arenas.json          (shape.wall.floor / wallTex / cordProps)
 24  js/render/sprite-loader.js (daftar path hardcoded)
 18  data/mutations.json
 17  js/ui/menu-icons.js
 13  data/nutrients.json
 11  data/upgrades.json · 11 data/body-systems.json · 8 styles/dashboard-focus.css
```

### 2.3 Perilaku saat aset hilang (sudah diverifikasi dari kode)

`js/render/sprite-loader.js` **tidak crash** kalau PNG tidak ada:
- `img.onerror` → hitung `fallback++`, game tetap jalan.
- Dev mode → placeholder **LOUD** (berwarna + inisial + tanda `?`).
- Production → placeholder **netral** (kotak abu tembus pandang, tanpa `?`).

Jadi: menghapus aset = game tetap boot, tapi tampil sebagai kotak-kotak abu.
Audio yang hilang juga tidak crash (audio-system punya guard).

---

## 3. ⚠️ BLOCKER: video referensi KOSONG

`Character_and_arena_reference.mp4` **bukan video** — isinya 2 byte.

| Bukti | Nilai |
|---|---|
| Ukuran blob git | **2 byte** |
| SHA blob | `d3f5a12faa99758192ecc4ed3fc22c9249232e86` |
| Isi (GitHub API, base64) | `DQo=` → `\r\n` (CRLF saja) |
| Commit | `6db9a72` "Rename `Screen_Recording_20260921_134002.mp4` → `Character_and_arena_reference.mp4`", diff `1 +` (satu baris teks) |
| Ada di branch | hanya `arena/01a0bc77-imunverse`; `main` tidak punya |
| Video lain di seluruh ref | **tidak ada** — satu-satunya `.mp4` di repo ya file 2 byte ini |

Rekaman layar aslinya (`Screen_Recording_20260921_134002.mp4`, dari HP Android
berdasarkan pola nama) **tidak pernah masuk git** — yang ter-commit cuma stub.
Tidak ada frame yang bisa dianalisis, jadi arahan visual baru belum bisa diturunkan
dari video. Perlu file aslinya di-attach ulang.

---

## 4. Opsi scope penghapusan (menunggu keputusan owner)

| Opsi | Yang dihapus | Sisa | Efek |
|---|---|---|---|
| **A. UI/UX saja** (rekomendasi) | `assets/ui/` (4) + `assets/icons/*.svg` (24) + dekor `assets/sprites/deco_*`, `icon_*`, `fx_joystick_*`, `ui_*` | sprite hero/musuh/arena, audio, PWA icon, rive, chapters | Kanvas visual UI bersih total; gameplay masih bisa dites & audio tetap ada |
| **B. Semua aset visual** | A + seluruh `assets/sprites/` (185) + `assets/chapters/` (6) + `assets/character-art-src/` (50) + `assets/rive/` (1) | audio (34) + PWA icon (3) | Reset visual 100% — semua jadi placeholder; PWA & suara tetap sehat |
| **C. Seluruh `assets/`** (literal "hapus semua") | 308 file / 67 MB | tidak ada | Reset total, tapi **PWA rusak** (manifest + apple-touch-icon 404), game bisu, dan `sw.js` cache-precache error |
| **D. Tunda** | tidak ada | semua | Tunggu video asli terbaca, baru hapus sesuai arahan baru — paling aman, tidak ada kerja yang terbuang |

Semua opsi **reversibel penuh** lewat git (`git checkout 6db9a72 -- assets/`).
Kalau opsi C dipilih, minimal `assets/icons/pwa-*.png` perlu diselamatkan atau
`manifest.webmanifest` + `sw.js` ikut dibersihkan supaya PWA tidak rusak.

---

## 5. Yang perlu ikut disentuh kalau reset UI/UX benar-benar jalan

Menghapus aset saja **tidak** me-reset UI/UX. Yang membentuk tampilan sekarang:

1. `styles/` — 5.687 baris, termasuk token palet cream/teal/coral di `main.css`.
2. `index.html` — markup 19 screen + 2 `clipPath` "sel meleleh".
3. `js/ui/screens/` (18 modul) + `js/ui/menu-icons.js`, `skill-icons.js`, `coach.js`,
   `prototype-lab.js` — banyak yang menyuntik HTML/inline style.
4. `data/*.json` — path sprite & ikon (`heroes.json` 89 ref, dst).
5. `js/render/*` — background prosedural, creature-rig, organ-corridor (visual in-game).
6. Verifikasi yang mengunci tampilan: `tools/verify-screens.mjs`, `verify-visual.mjs`,
   `verify-animasi.mjs`, `verify-rive.mjs`, `scripts/e2e-*.mjs`.
   Catatan PR #44: `verify-visual` (23 error), `verify-screens` (7), `validate-catalog` (3)
   **sudah gagal di base branch sebelum perubahan apa pun** — baseline merah, jangan
   dipakai sebagai tolak ukur reset.
