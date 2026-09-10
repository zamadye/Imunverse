# MIGRATION BRIEF — Local Art-Agent Bridge

> Tanggal dibuat: 2026-09-10
> Branch kerja Arena: `arena/01a08106-imunverse`
> Catatan branch: user menyebut branch permanen `agent/character`, tetapi sesi Arena ini dikunci ke `arena/01a08106-imunverse`. Dokumen ini tidak mengubah logic core; hanya menjembatani rujukan migrasi yang belum ada di branch ini.

## Status file wajib-baca

Instruksi Art Director meminta membaca `/src/core/MIGRATION_BRIEF.md` sebelum membuat aset. Pada branch kerja ini, path tersebut **belum ada** saat audit awal. Untuk tetap menghormati urutan kerja tanpa switch branch, rujukan migrasi dibaca dari remote branch pivot yang sudah tersedia:

- `origin/arena/01a08866-imunverse:docs/MIGRATION_BRIEF.md`
- `origin/arena/01a087b6-imunverse:README-CORE-PIVOT.md`
- `origin/arena/01a087b6-imunverse:src/towers/data/towers.json`
- `origin/arena/01a087b6-imunverse:src/colony/data/buildings.json`
- `origin/arena/01a087b6-imunverse:src/colony/data/unlock-rules.json`

Dokumen lokal ini dibuat agar path wajib-baca yang disebutkan user tersedia untuk agent berikutnya di branch ini.

## Keputusan migrasi yang relevan untuk aset

1. **Pivot gameplay:** Imunverse bergerak dari survival roaming ke tower-defense + colony-builder.
2. **Tower:** ada 11 tower, 1:1 dengan 11 hero lama (`src/towers/data/towers.json` di Agent 8). Visual hero tidak boleh didesain ulang dari nol; perlu pose tower statis.
3. **Koloni:** ada 7 bangunan data pivot (`markas_sel`, `barak_sel`, `pos_sinyal`, `lab_membran`, `pusat_riset`, `menara_limfa`, `monumen_imun`) dengan level/cost/effect. Bentuk final bangunan adalah scope Art/Character ecosystem; environment hanya menampungnya.
4. **Linkage bangunan → tower:** unlock tower berasal dari `unlock-rules.json`, bukan dari dekorasi. Asset art harus memakai id yang sama supaya UI/Arena Agent bisa memasang sprite tanpa mapping manual baru.
5. **Environment/map bukan scope aset ini:** Map Agent merender jalur, slot, zona, dan hub plots. Art Director hanya menetapkan bentuk/sprite/bahasa visual asset hero-tower, pathogen, dan bangunan koloni.
6. **UI/HUD wrapper bukan scope aset ini:** UI/UX Agent mengemas panel/tooltip; asset system hanya menyediakan sprite, state, dan rule copy.
7. **Konsistensi visual pasca-pivot:** semua kategori harus terasa satu dunia biologis: hero sebagai tower, pathogen di jalur sempit, dan bangunan sebagai struktur koloni sel.

## Unlock linkage yang dipakai Art Bible

| Tower | Hero | Unlock visual source |
|---|---|---|
| `tower_macrophage` | `macrophage` | `markas_sel` sebagai seed/inti awal |
| `tower_neutrophil` | `neutrophil` | `barak_sel` Lv/Stage 1 |
| `tower_tcd4` | `tcd4` | `pos_sinyal` Lv/Stage 1 |
| `tower_eosinophil` | `eosinophil` | `barak_sel` Lv/Stage 2 |
| `tower_tcd8` | `tcd8` | `barak_sel` Lv/Stage 2 |
| `tower_basophil` | `basophil` | `pos_sinyal` Lv/Stage 2 |
| `tower_mastcell` | `mastcell` | `lab_membran` Lv/Stage 2 |
| `tower_bcell` | `bcell` | `pusat_riset` Lv/Stage 1 |
| `tower_dendritic` | `dendritic` | `pos_sinyal` + `pusat_riset` bridge |
| `tower_treg` | `treg` | `pusat_riset` Lv/Stage 2 |
| `tower_nkcell` | `nkcell` | `pusat_riset` Lv/Stage 3 + `menara_limfa` Lv/Stage 2 |

`monumen_imun` adalah bangunan kosmetik/prestige tanpa unlock kekuatan; tetap harus mengikuti Art Bible agar tidak terlihat seperti bangunan RTS/sci-fi generik.
