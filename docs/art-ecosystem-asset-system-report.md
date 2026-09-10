# Art Ecosystem Asset System Report

> Tanggal: 2026-09-10
> Branch kerja Arena: `arena/01a08106-imunverse`
> Role: Art Director untuk hero-as-tower, pathogen/musuh, bangunan koloni, dan bahasa visual aset pasca-pivot.

## Ringkasan

Scope visual diperluas dari hero/pathogen menjadi sistem aset lintas kategori. Pass ini membuat **Art Bible** terlebih dahulu, lalu menambahkan aset konseptual/final-preview yang additive dan pivot-safe untuk:

- 11 hero sebagai tower statis.
- 13 pathogen sebagai musuh path-based/lane swarm.
- 7 bangunan koloni dengan 3 tingkat visual.

Tidak ada perubahan combat math, pathing, enemy behavior, environment/map implementation, atau UI/HUD wrapper.

## Branch note

User menyebut branch permanen `agent/character`, tetapi sesi Arena ini dikunci ke `arena/01a08106-imunverse`. Semua pekerjaan dilakukan dan dipush di branch Arena tersebut agar tetap terasosiasi dengan session.

## MIGRATION brief

Path wajib-baca yang diminta (`src/core/MIGRATION_BRIEF.md`) belum ada di branch aktif saat audit awal. Rujukan pivot dibaca dari remote branch yang tersedia:

- `origin/arena/01a08866-imunverse:docs/MIGRATION_BRIEF.md`
- `origin/arena/01a087b6-imunverse:README-CORE-PIVOT.md`
- `origin/arena/01a087b6-imunverse:src/towers/data/towers.json`
- `origin/arena/01a087b6-imunverse:src/colony/data/buildings.json`
- `origin/arena/01a087b6-imunverse:src/colony/data/unlock-rules.json`

Lalu dibuat local bridge `src/core/MIGRATION_BRIEF.md` di branch ini supaya path wajib-baca tersedia untuk agent berikutnya.

## Deliverables

| File/dir | Isi |
|---|---|
| `assets/ART_BIBLE.md` | Asset Design System lintas hero tower, pathogen, dan bangunan koloni. |
| `tools/gen_ecosystem_assets.py` | Generator deterministic untuk aset ekosistem baru; tidak overwrite legacy `assets/sprites/hero_*`/`enemy_*`. |
| `assets/heroes/towers/` | 33 PNG: 11 hero × `tower_idle`, `tower_attack`, `tower_upgrade`. |
| `assets/enemies/path/` | 13 PNG pathogen path-based dengan lane/stack readability marker. |
| `assets/buildings/` | 21 PNG: 7 bangunan × 3 growth stages. |
| `src/characters/data/hero-tower-poses.json` | Spec pose/animasi tower per hero dengan path asset eksplisit. |
| `src/enemies/data/pathogen-path-style.json` | Spec gaya path-based per enemy family. |
| `src/buildings/data/colony-buildings-art.json` | Spec bangunan organik + linkage tower coverage. |
| `assets/heroes/reference/hero_tower_reference_sheet.png` | Reference sheet hero legacy → tower idle/attack/upgrade. |
| `assets/buildings/reference/colony_buildings_reference_sheet.png` | Reference sheet 7 bangunan × 3 growth stages. |
| `assets/enemies/reference/pathogen_path_reference_sheet.png` | Reference sheet pathogen path-based. |
| `shots/review/art-ecosystem-asset-system.png` | Fresh review montage utama. |

## Task mapping

### Task 1 — Art Bible / Asset Design System

Status: ✅ selesai.

`assets/ART_BIBLE.md` mendefinisikan:

- aturan outline, shading, saturation/value lintas kategori;
- aturan identitas biologis minimal untuk hero, pathogen, dan bangunan;
- palette hero/tower yang mempertahankan warna reference lama;
- palette pathogen + lane readability marker;
- palette bangunan koloni;
- pose dan state hero-as-tower;
- grammar bangunan koloni organik;
- aturan pathogen path-based;
- naming/file conventions;
- review gates dan cross-scope handoff.

### Task 2 — Desain aset bangunan koloni

Status: ✅ selesai untuk asset/design pass.

7 bangunan dari Agent 8 linkage diberi bahasa visual organik dan 3 stage sprite:

| Building | Stage assets | Covered tower unlocks |
|---|---:|---|
| `markas_sel` | 3 | `tower_macrophage` |
| `barak_sel` | 3 | `tower_neutrophil`, `tower_eosinophil`, `tower_tcd8` |
| `pos_sinyal` | 3 | `tower_tcd4`, `tower_basophil`, `tower_dendritic` |
| `lab_membran` | 3 | `tower_mastcell` |
| `pusat_riset` | 3 | `tower_bcell`, `tower_dendritic`, `tower_treg`, `tower_nkcell` |
| `menara_limfa` | 3 | `tower_nkcell` |
| `monumen_imun` | 3 | cosmetic/prestige only |

Coverage: 11/11 tower unlock ids have at least one biological building source.

### Task 3 — Adaptasi hero sebagai tower

Status: ✅ asset/spec selesai; runtime hookup menunggu pivot runtime merge/agent terkait.

Setiap hero punya 3 tower frames:

- `idle`: rooted/menetap, breathing-ready, no locomotion.
- `attack`: static firing lean/cue; root/base tetap fixed.
- `upgrade`: cytokine/equity bloom.

Hero proportions and source colors are retained from `data/heroes.json` and `data/character-designs.json`.

### Task 4 — Pathogen path-based redesign

Status: ✅ asset/spec selesai; behavior/pathing tetap milik pivot/Arena/Combat.

Setiap enemy id mendapat `assets/enemies/path/{enemyId}_path.png` dengan:

- dorsal/top marker for lane stacks;
- unified biological rim style;
- shortened/contained appendages for narrow lanes;
- boss/minion read rules.

## Validation

Commands run:

```bash
python3 -m py_compile tools/gen_sprites.py tools/gen_ecosystem_assets.py
npm run check
npm run check:ecosystem-assets
git diff --check
```

Result:

```text
Semua pemeriksaan lolos ✔
ASSET_ECOSYSTEM_VERIFY {"heroTowerFrames":33,"pathogenPathSprites":13,"buildingStageSprites":21,"coveredTowerUnlocks":11}
```

## Cross-scope handoff

- **Arena/Map Agent:** consume `assets/buildings/*` in colony plots and keep environment saturation below the asset focal palette from `assets/ART_BIBLE.md`.
- **UI/UX Agent:** consume state/spec JSON rather than parsing filenames; wrapper/HUD labels remain UI scope.
- **Combat/Balance Agent:** asset silhouette does not define hitbox/range; continue using pivot tower/pathing data.
- **Core/Pivot Agent:** when pivot runtime is merged into this branch, hook tower/building/pathogen sprite paths from the JSON specs.
