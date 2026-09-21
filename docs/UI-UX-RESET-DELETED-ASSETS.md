# UI-RESET — Manifest Aset Visual yang Dicabut

**Tanggal:** 2026-09-21  
**Branch:** `arena/01a0c285-imunverse`  
**Keputusan owner:** opsi B — *semua aset visual*, audio & ikon PWA diselamatkan  
**Rujukan:** `docs/UI-UX-RESET-AUDIT.md` §2 (inventaris) dan §4 (tabel opsi)

**Total dicabut: 269 file (~64 MB).** `assets/` turun dari 67 MB → 2,8 MB.

---

## Cara memulihkan (reversibel penuh)

Semua file di bawah masih utuh di objek git pada commit induk `6db9a72`:
```bash
# pulihkan SEMUA aset seperti semula
git checkout 6db9a72 -- assets/

# atau pulihkan satu direktori saja, mis. sprite gameplay
git checkout 6db9a72 -- assets/sprites/

# atau satu file
git checkout 6db9a72 -- assets/ui/phagos-logo.png
```

---

## Yang DIPERTAHANKAN (39 file)

| Direktori | File | Alasan |
|---|---|---|
| `assets/audio/music/` | 4 | Audio bukan UI/UX — owner minta diselamatkan |
| `assets/audio/sfx/` | 29 | idem |
| `assets/audio/` | 1 (`CREDITS.md`) | Lisensi CC0 wajib ikut berkasnya |
| `assets/icons/` | 3 (`pwa-192/512/maskable-512.png`) | Dirujuk `manifest.webmanifest` + `apple-touch-icon`; kalau hilang PWA rusak |
| `assets/icons/` | 1 (`README.md`) | Dokumentasi pipeline ikon |
| `assets/character-art-src/` | 1 (`README.md`) | Dokumentasi pipeline `tools/build-mutation-sprites.py` |

---

## Yang DICABUT (per direktori)

| Direktori | File | Catatan |
|---|---|---|
| `assets/ui/` | 4 | Latar dashboard/fullmap/loading + **logo PHAGOS** — inti identitas UI lama |
| `assets/icons/` | 24 | 24 ikon SVG (menu/ui/role/hud/currency) — ikon UI lama |
| `assets/sprites/` | 175 | 175 sprite gameplay: hero (foto/idle/attack/walk/portrait/mut), musuh, nutrisi, ikon, dekor, fx, arena |
| `assets/sprites/px/` | 10 | 10 sprite **pixel-art hasil pilot PR #44** (Mako, enemy px, floor/wall jantung, prop) — ikut dicabut, keputusan arah menunggu video |
| `assets/chapters/` | 6 | 6 foto bab kampanye (luka/demam/racun/alergi/kanker/final) |
| `assets/character-art-src/` | 49 | 49 PNG sumber mentah — **orphan**, 49 MB, dev-only untuk tools/build-mutation-sprites.py |
| `assets/rive/` | 1 | hero-locomotion.riv — rig animasi jalan hero |

---

## Daftar lengkap

### `assets/chapters/` (6 file)

```
assets/chapters/ch1_luka.jpg
assets/chapters/ch2_demam.jpg
assets/chapters/ch3_racun.jpg
assets/chapters/ch4_alergi.jpg
assets/chapters/ch5_kanker.jpg
assets/chapters/ch6_final.jpg
```

### `assets/character-art-src/` (49 file)

```
assets/character-art-src/hero_basophil_attack.png
assets/character-art-src/hero_basophil_idle.png
assets/character-art-src/hero_basophil_mut1_attack.png
assets/character-art-src/hero_basophil_mut1_idle.png
assets/character-art-src/hero_basophil_mut2_attack.png
assets/character-art-src/hero_basophil_mut2_idle.png
assets/character-art-src/hero_dendritic_attack.png
assets/character-art-src/hero_dendritic_idle.png
assets/character-art-src/hero_dendritic_mut1_attack.png
assets/character-art-src/hero_dendritic_mut1_idle.png
assets/character-art-src/hero_dendritic_mut2_attack.png
assets/character-art-src/hero_dendritic_mut2_idle.png
assets/character-art-src/hero_eosinophil_attack.png
assets/character-art-src/hero_eosinophil_idle.png
assets/character-art-src/hero_eosinophil_mut1_attack.png
assets/character-art-src/hero_eosinophil_mut1_idle.png
assets/character-art-src/hero_eosinophil_mut2_attack.png
assets/character-art-src/hero_eosinophil_mut2_idle.png
assets/character-art-src/hero_macrophage_attack.png
assets/character-art-src/hero_macrophage_idle.png
assets/character-art-src/hero_macrophage_mut1_attack.png
assets/character-art-src/hero_macrophage_mut1_idle.png
assets/character-art-src/hero_macrophage_mut2_attack.png
assets/character-art-src/hero_macrophage_mut2_idle.png
assets/character-art-src/hero_mastcell_attack.png
assets/character-art-src/hero_mastcell_idle.png
assets/character-art-src/hero_mastcell_mut1_attack.png
assets/character-art-src/hero_mastcell_mut1_idle.png
assets/character-art-src/hero_mastcell_mut2_attack.png
assets/character-art-src/hero_mastcell_mut2_idle.png
assets/character-art-src/hero_neutrophil_attack.png
assets/character-art-src/hero_neutrophil_idle.png
assets/character-art-src/hero_neutrophil_mut1_attack.png
assets/character-art-src/hero_neutrophil_mut1_idle.png
assets/character-art-src/hero_neutrophil_mut2_attack.png
assets/character-art-src/hero_neutrophil_mut2_idle.png
assets/character-art-src/hero_tcd8_attack.png
assets/character-art-src/hero_tcd8_idle.png
assets/character-art-src/hero_tcd8_mut1_attack.png
assets/character-art-src/hero_tcd8_mut1_idle.png
assets/character-art-src/hero_tcd8_mut2_attack.png
assets/character-art-src/hero_tcd8_mut2_idle.png
assets/character-art-src/portrait_basophil.png
assets/character-art-src/portrait_dendritic.png
assets/character-art-src/portrait_eosinophil.png
assets/character-art-src/portrait_macrophage.png
assets/character-art-src/portrait_mastcell.png
assets/character-art-src/portrait_neutrophil.png
assets/character-art-src/portrait_tcd8.png
```

### `assets/icons/` (24 file)

```
assets/icons/cur-antibodi.svg
assets/icons/hud-pulse.svg
assets/icons/menu-battle.svg
assets/icons/menu-campaign.svg
assets/icons/menu-codex.svg
assets/icons/menu-heroes.svg
assets/icons/menu-journey.svg
assets/icons/menu-quest.svg
assets/icons/role-damage.svg
assets/icons/role-support.svg
assets/icons/role-tank.svg
assets/icons/ui-back.svg
assets/icons/ui-chest.svg
assets/icons/ui-flag.svg
assets/icons/ui-heart.svg
assets/icons/ui-home.svg
assets/icons/ui-kill.svg
assets/icons/ui-lock.svg
assets/icons/ui-pause.svg
assets/icons/ui-play.svg
assets/icons/ui-star-empty.svg
assets/icons/ui-star.svg
assets/icons/ui-start.svg
assets/icons/ui-timer.svg
```

### `assets/rive/` (1 file)

```
assets/rive/hero-locomotion.riv
```

### `assets/sprites/` (175 file)

```
assets/sprites/arena_jantung.png
assets/sprites/arena_lambung.png
assets/sprites/arena_limfe.png
assets/sprites/arena_paru.png
assets/sprites/arena_saraf.png
assets/sprites/deco_aura.png
assets/sprites/deco_bubble_coral.png
assets/sprites/deco_bubble_mint.png
assets/sprites/deco_bubble_sage.png
assets/sprites/deco_coin.png
assets/sprites/deco_dots.png
assets/sprites/deco_germ_coral.png
assets/sprites/deco_germ_sage.png
assets/sprites/deco_germ_teal.png
assets/sprites/deco_reef_big.png
assets/sprites/deco_star_pop.png
assets/sprites/deco_weed_big.png
assets/sprites/enemy_bakteri.png
assets/sprites/enemy_bakteri_gn.png
assets/sprites/enemy_bakteri_gp.png
assets/sprites/enemy_parasit.png
assets/sprites/enemy_prion.png
assets/sprites/enemy_protozoa.png
assets/sprites/enemy_sel_abnormal.png
assets/sprites/enemy_sel_kanker.png
assets/sprites/enemy_sel_kanker_attack.png
assets/sprites/enemy_spora.png
assets/sprites/enemy_toksin.png
assets/sprites/enemy_toksin_raksasa.png
assets/sprites/enemy_toksin_raksasa_attack.png
assets/sprites/enemy_virion.png
assets/sprites/enemy_virus.png
assets/sprites/fx_hit.png
assets/sprites/fx_joystick_base.png
assets/sprites/fx_joystick_knob.png
assets/sprites/fx_spark.png
assets/sprites/hero_basophil_attack.png
assets/sprites/hero_basophil_idle.png
assets/sprites/hero_basophil_mut1_attack.png
assets/sprites/hero_basophil_mut1_idle.png
assets/sprites/hero_basophil_mut2_attack.png
assets/sprites/hero_basophil_mut2_idle.png
assets/sprites/hero_bcell_attack.png
assets/sprites/hero_bcell_idle.png
assets/sprites/hero_bcell_mut1_attack.png
assets/sprites/hero_bcell_mut1_idle.png
assets/sprites/hero_bcell_mut2_attack.png
assets/sprites/hero_bcell_mut2_idle.png
assets/sprites/hero_dendritic_attack.png
assets/sprites/hero_dendritic_idle.png
assets/sprites/hero_dendritic_mut1_attack.png
assets/sprites/hero_dendritic_mut1_idle.png
assets/sprites/hero_dendritic_mut2_attack.png
assets/sprites/hero_dendritic_mut2_idle.png
assets/sprites/hero_eosinophil_attack.png
assets/sprites/hero_eosinophil_idle.png
assets/sprites/hero_eosinophil_mut1_attack.png
assets/sprites/hero_eosinophil_mut1_idle.png
assets/sprites/hero_eosinophil_mut2_attack.png
assets/sprites/hero_eosinophil_mut2_idle.png
assets/sprites/hero_macrophage_attack.png
assets/sprites/hero_macrophage_idle.png
assets/sprites/hero_macrophage_mut1_attack.png
assets/sprites/hero_macrophage_mut1_idle.png
assets/sprites/hero_macrophage_mut2_attack.png
assets/sprites/hero_macrophage_mut2_idle.png
assets/sprites/hero_mastcell_attack.png
assets/sprites/hero_mastcell_idle.png
assets/sprites/hero_mastcell_mut1_attack.png
assets/sprites/hero_mastcell_mut1_idle.png
assets/sprites/hero_mastcell_mut2_attack.png
assets/sprites/hero_mastcell_mut2_idle.png
assets/sprites/hero_neutrophil_attack.png
assets/sprites/hero_neutrophil_idle.png
assets/sprites/hero_neutrophil_mut1_attack.png
assets/sprites/hero_neutrophil_mut1_idle.png
assets/sprites/hero_neutrophil_mut2_attack.png
assets/sprites/hero_neutrophil_mut2_idle.png
assets/sprites/hero_nkcell_attack.png
assets/sprites/hero_nkcell_idle.png
assets/sprites/hero_nkcell_mut1_attack.png
assets/sprites/hero_nkcell_mut1_idle.png
assets/sprites/hero_nkcell_mut2_attack.png
assets/sprites/hero_nkcell_mut2_idle.png
assets/sprites/hero_tcd4_attack.png
assets/sprites/hero_tcd4_idle.png
assets/sprites/hero_tcd4_mut1_attack.png
assets/sprites/hero_tcd4_mut1_idle.png
assets/sprites/hero_tcd4_mut2_attack.png
assets/sprites/hero_tcd4_mut2_idle.png
assets/sprites/hero_tcd8_attack.png
assets/sprites/hero_tcd8_idle.png
assets/sprites/hero_tcd8_mut1_attack.png
assets/sprites/hero_tcd8_mut1_idle.png
assets/sprites/hero_tcd8_mut2_attack.png
assets/sprites/hero_tcd8_mut2_idle.png
assets/sprites/hero_treg_attack.png
assets/sprites/hero_treg_idle.png
assets/sprites/hero_treg_mut1_attack.png
assets/sprites/hero_treg_mut1_idle.png
assets/sprites/hero_treg_mut2_attack.png
assets/sprites/hero_treg_mut2_idle.png
assets/sprites/icon_bolt.png
assets/sprites/icon_boot.png
assets/sprites/icon_coin.png
assets/sprites/icon_frost.png
assets/sprites/icon_heart.png
assets/sprites/icon_imun.png
assets/sprites/icon_limfatik.png
assets/sprites/icon_magnet.png
assets/sprites/icon_multi.png
assets/sprites/icon_pencernaan.png
assets/sprites/icon_play.png
assets/sprites/icon_saraf.png
assets/sprites/icon_scope.png
assets/sprites/icon_shield.png
assets/sprites/icon_sirkulasi.png
assets/sprites/icon_sound_off.png
assets/sprites/icon_sound_on.png
assets/sprites/icon_sword.png
assets/sprites/icon_syringe.png
assets/sprites/icon_wind.png
assets/sprites/item_air.png
assets/sprites/item_amino.png
assets/sprites/item_antibodi.png
assets/sprites/item_glukosa.png
assets/sprites/item_omega3.png
assets/sprites/item_probiotik.png
assets/sprites/item_protein.png
assets/sprites/item_serat.png
assets/sprites/item_sitokin.png
assets/sprites/item_vitamin_c.png
assets/sprites/item_vitamin_d.png
assets/sprites/item_zat_besi.png
assets/sprites/item_zinc.png
assets/sprites/mut_adaptif.png
assets/sprites/mut_beracun.png
assets/sprites/mut_berduri.png
assets/sprites/mut_cermin.png
assets/sprites/mut_elastis.png
assets/sprites/mut_evolusi_total.png
assets/sprites/mut_ledakan_dalam.png
assets/sprites/mut_lengket.png
assets/sprites/mut_medan_hidup.png
assets/sprites/mut_medan_pulsa.png
assets/sprites/mut_membran_ganda.png
assets/sprites/mut_nova.png
assets/sprites/mut_parasit.png
assets/sprites/mut_penyerap.png
assets/sprites/mut_rantai.png
assets/sprites/mut_regenerasi.png
assets/sprites/mut_simbiosis.png
assets/sprites/mut_tipis.png
assets/sprites/ov_inti.png
assets/sprites/ov_pedang.png
assets/sprites/ov_pseudopodia.png
assets/sprites/ov_silia.png
assets/sprites/portrait_basophil.png
assets/sprites/portrait_bcell.png
assets/sprites/portrait_dendritic.png
assets/sprites/portrait_eosinophil.png
assets/sprites/portrait_macrophage.png
assets/sprites/portrait_mastcell.png
assets/sprites/portrait_neutrophil.png
assets/sprites/portrait_nkcell.png
assets/sprites/portrait_tcd4.png
assets/sprites/portrait_tcd8.png
assets/sprites/portrait_treg.png
assets/sprites/prop_asam.png
assets/sprites/prop_cell.png
assets/sprites/prop_dots.png
assets/sprites/prop_kristal.png
assets/sprites/prop_reef.png
assets/sprites/prop_weed.png
assets/sprites/ui_shield_emblem.png
```

### `assets/sprites/px/` (10 file)

```
assets/sprites/px/enemy_bakteri.png
assets/sprites/px/enemy_parasit.png
assets/sprites/px/enemy_virus.png
assets/sprites/px/floor_jantung.png
assets/sprites/px/hero_macrophage_attack.png
assets/sprites/px/hero_macrophage_idle.png
assets/sprites/px/hero_macrophage_walk.png
assets/sprites/px/prop_clot.png
assets/sprites/px/prop_trabecula.png
assets/sprites/px/wall_jantung.png
```

### `assets/ui/` (4 file)

```
assets/ui/bg-dashboard.jpg
assets/ui/bg-fullmap.jpg
assets/ui/bg-loading.jpg
assets/ui/phagos-logo.png
```

---

## Dampak yang sudah ditangani di commit yang sama

| Titik | Penanganan |
|---|---|
| `sw.js` precache | 3 entri aset yang hilang dicabut dari `PRECACHE` (`hero-locomotion.riv`, `bg-dashboard.jpg`, `bg-loading.jpg`); `CACHE_VER` → `phagos-v24-uireset`. `cache.addAll()` gagal atomik kalau satu URL 404, jadi ini wajib |
| `<img>` 404 di markup | Skrip inline di `<head>` `index.html` + kelas CSS `.asset-missing` → gambar hilang disembunyikan, bukan jadi ikon broken-image |
| `<img>` 404 dinamis | `js/ui/reset-scaffold.js` (MutationObserver) dipanggil di awal `boot()` |
| Latar foto hilang | Gradasi netral sementara untuk `#screen-loading`, `.dash-bg`, `.fullmap-photo` supaya teks tetap terbaca |
| `scripts/check-imports.mjs` | Mode `UI_RESET_ASSETS_ABSENT` → "sprite hilang" turun jadi INFO. Pemeriksaan lain tetap strict. Paksa keras lagi: `PHAGOS_STRICT_ASSETS=1` |
| Cache-buster CSS | `?v=54i` → `?v=uireset1` di keempat stylesheet |

## Yang SENGAJA tidak ditangani (tunggu arahan video)

- 7 referensi rusak yang **sudah ada sebelum reset** — `assets/ART_BIBLE.md`,
  `assets/fonts/imunverse-head.woff2`, `assets/fonts/imunverse-num.woff2`,
  `assets/sprites/icon_crosshair.png`, dan 3 `reference_sheet.png` di
  `assets/{buildings,enemies,heroes}/reference/`. Ini utang lama; dibereskan
  sekalian saat UI baru disusun, bukan sekarang.
- `styles/` (5.687 baris) + markup 19 screen + token palet cream/teal/coral
  **masih utuh**. Menghapus aset saja tidak me-reset UI/UX — itu langkah
  berikutnya setelah arah visual terkunci dari video.
- `data/creature-rigs.json` (1,7 MB) + `data/crawl-cycles.json` — mesin render
  prosedural tetap ada; nasibnya diputuskan setelah video dianalisis
  (owner pilih: "video yang memutuskan").
