# PHAGOS — ART AGENT ROADMAP

**Branch kerja:** `arena/01a0a431-imunverse`  
**Scope owner:** Game Artist / Art Asset Agent  
**Status dokumen:** inventory dan urutan kerja sebelum konsep visual berikutnya diterima  
**Tanggal audit:** 15 September 2026

Dokumen ini adalah peta kerja aset visual PHAGOS. Ini bukan roadmap gameplay,
balance, QA, bug fixing, UI/UX, atau infrastructure.

---

## 1. KONTRAK SCOPE ART AGENT

### 1.1 Yang dikerjakan

- Membuat, mengganti, dan memoles aset visual yang sudah disetujui.
- Menjaga bahasa bentuk, palet, siluet, rim, shading, dan keterbacaan 48 px.
- Menyediakan state visual yang eksplisit: idle, attack, upgrade, stage, atau path.
- Menyediakan reference/review sheet untuk setiap batch aset.
- Menjaga nama file dan ID agar cocok dengan metadata art yang sudah ada.
- Mengubah referensi asset/import **hanya bila diperlukan langsung agar aset baru
  dapat dikonsumsi oleh runtime**.

### 1.2 Yang tidak dikerjakan

- Memperbaiki bug gameplay, camera/culling, economy, progression, physics,
  input, save, audio logic, atau browser setup.
- Mengubah angka combat, hitbox, cooldown, HP, damage, spawn, wave, atau cost.
- Mengubah alur screen, layout UI, copy, i18n, menu, HUD wrapper, atau CSS UI.
- Mengubah test agar menjadi hijau.
- Menambah dependency aplikasi atau build system.
- Mengambil alih map/environment logic milik Arena Agent.
- Mengganti konsep visual sebelum konsep baru disetujui owner.

### 1.3 Pengecualian import yang diperbolehkan

Perubahan kode/data hanya boleh dilakukan jika merupakan jalur langsung dari aset
ke runtime, dan tidak mengubah perilaku game:

- path `sprite` / `spriteIdle` / `spriteAttack` atau path art sejenis di data;
- manifest/cache/preload asset di `js/render/sprite-loader.js`;
- mapping visual di `js/render/character-visuals.js` bila memang diperlukan
  untuk membaca state art baru;
- referensi `src` / `href` asset visual di `index.html` bila diperlukan;
- metadata art di:
  - `src/characters/data/hero-tower-poses.json`
  - `src/enemies/data/pathogen-path-style.json`
  - `src/buildings/data/colony-buildings-art.json`

Tidak boleh menyentuh logika gameplay di file-file tersebut. Jika import baru
membutuhkan perubahan gameplay, tugas berhenti dan dikembalikan untuk owner/agent
pemilik sistem.

---

## 2. SOURCE OF TRUTH VISUAL

Urutan referensi yang wajib dipakai:

1. `docs/PHAGOS-IDENTITY.md` — jiwa, tone, bentuk, bahasa visual.
2. `docs/PHAGOS-BIBLE.md` — peran visual terhadap gameplay PHAGOS.
3. `src/core/MIGRATION_BRIEF.md` — linkage hero/tower, pathogen path, dan colony.
4. `assets/ART_BIBLE.md` — aturan detail art, palette, outline, shading, naming,
   state, dan review gate.
5. Metadata art:
   - `src/characters/data/hero-tower-poses.json`
   - `src/enemies/data/pathogen-path-style.json`
   - `src/buildings/data/colony-buildings-art.json`
6. Asset lama di `assets/sprites/` hanya sebagai referensi kompatibilitas,
   bukan sebagai arah visual baru secara otomatis.

---

## 3. STATUS ASSET SAAT INI

Legenda:

- ✅ **Asset pass tersedia** — file visual dan metadata sudah ada di branch.
- 🟡 **Sebagian / handoff pending** — ada asset atau fondasi, tetapi perlu
  keputusan konsep, penggantian batch, atau import handoff.
- ⬜ **Belum dikerjakan** — belum ada batch baru yang disetujui.
- 🚫 **Di luar scope Art Agent** — tidak disentuh tanpa instruksi owner.

| Area | Target | Status sekarang | Catatan |
|---|---:|---|---|
| Visual language & Art Bible | 1 sistem | ✅ | `assets/ART_BIBLE.md` sudah menjadi kontrak visual. |
| Hero sebagai tower | 11 hero × 3 state | ✅ | 33 PNG di `assets/heroes/towers/`; metadata lengkap. |
| Reference hero tower | 1 sheet | ✅ | `assets/heroes/reference/hero_tower_reference_sheet.png`. |
| Pathogen berbasis path | 13 pathogen | ✅ | 13 PNG di `assets/enemies/path/`; metadata lengkap. |
| Reference pathogen | 1 sheet | ✅ | `assets/enemies/reference/pathogen_path_reference_sheet.png`. |
| Colony building | 7 building × 3 stage | ✅ | 21 PNG di `assets/buildings/`; metadata lengkap. |
| Reference colony | 1 sheet | ✅ | `assets/buildings/reference/colony_buildings_reference_sheet.png`. |
| Legacy hero/enemy sprites | 11 hero + 13 enemy | 🟡 | Masih ada di `assets/sprites/`; belum diputuskan batch pengganti setelah konsep owner. |
| Portrait hero | 11 portrait | 🟡 | Asset tersedia; perlu arahan apakah akan dipoles atau diganti total. |
| Mutation overlay art | 18 mutation | 🟡 | 18 file tersedia; perlu audit kesatuan visual dan konsep kumulatif. |
| Equity/evolution art | 4 part + overlay | 🟡 | Fondasi tersedia; perlu konsep final dan review sheet. |
| Gameplay VFX art | hit/spark/ring/joystick | 🟡 | Asset lama tersedia; hanya dipoles bila masuk brief art. |
| Item/nutrient art | 13 item | 🟡 | Asset tersedia; menunggu arahan visual baru. |
| Arena/environment | 5 arena | 🚫 | Scope Arena/Environment Agent menurut Art Bible. |
| UI icon/dock/HUD | puluhan icon | 🚫 | Scope UI/UX Agent kecuali owner memberi handoff art khusus. |
| Narrative/VO art | RIA/Amara | 🚫 | Bukan prioritas art asset gameplay saat ini. |

**Kesimpulan audit:** batch hero-tower, pathogen-path, dan colony-building sudah
memiliki asset pass lengkap. Batch tersebut belum otomatis berarti seluruh asset
legacy sudah diganti di runtime; import handoff dilakukan terpisah dan hanya
pada jalur art-import yang disetujui.

---

## 4. ROADMAP PHASE BERTAHAP

### PHASE 0 — Scope lock & asset inventory

**Status: ✅ selesai**

- Baca Art Bible, Identity, Game Bible, dan Migration Brief.
- Petakan folder asset, metadata art, naming convention, dan linkage ID.
- Pisahkan scope Art Agent dari gameplay/UI/map/infrastructure.
- Kunci aturan: tidak ada bug fixing atau perubahan logic non-art.

**Output:** dokumen ini + scope contract.

---

### PHASE 1 — Visual foundation

**Status: ✅ selesai**

- Organic-first visual language.
- Palette hero/pathogen/building.
- Outline, inner rim, shading, light direction, 48 px readability.
- State naming dan folder naming.
- Reference sheet convention.

**Output:** `assets/ART_BIBLE.md` dan metadata art yang sudah tersedia.

---

### PHASE 2 — Hero tower ecosystem

**Status: ✅ asset pass selesai; import handoff pending**

Batch:

- 11 hero.
- `tower_idle`.
- `tower_attack`.
- `tower_upgrade`.
- Reference sheet.

Urutan batch berikutnya setelah konsep owner:

1. Review siluet per hero.
2. Review warna dan cue biologis per hero.
3. Pilih batch hero prioritas bila ada redesign lanjutan.
4. Replace/add asset secara batch kecil.
5. Update metadata/import art saja bila diperlukan.
6. Buat review sheet batch.

**Tidak termasuk:** mengubah tower stat, targeting, damage, cooldown, atau map.

---

### PHASE 3 — Pathogen/path ecosystem

**Status: ✅ asset pass selesai; import handoff pending**

Batch:

- 13 pathogen path sprite.
- Family cue dan top marker.
- Boss readability.
- Reference sheet.

Urutan batch lanjutan:

1. Review readability saat stack di lane.
2. Review perbedaan hero versus pathogen pada ukuran kecil.
3. Redesign hanya pathogen yang dipilih owner.
4. Replace asset secara batch.
5. Update path art metadata/import bila diperlukan.
6. Buat review sheet batch.

**Tidak termasuk:** pathfinding, culling, enemy AI, HP, speed, atau wave logic.

---

### PHASE 4 — Colony building ecosystem

**Status: ✅ asset pass selesai; handoff ke environment/map pending**

Batch:

- 7 building colony.
- 3 visual stage per building.
- Membrane pad, capillary roots, function cue.
- Reference sheet.

Urutan batch lanjutan:

1. Review hubungan visual building ↔ tower unlock.
2. Review stage 1/2/3 sebagai satu growth language.
3. Redesign building terpilih setelah konsep owner.
4. Replace asset tanpa mengubah unlock/cost/effect.
5. Handoff ke Arena/Environment Agent.

**Tidak termasuk:** plot placement, hub layout, unlock rule, cost, atau colony
logic.

---

### PHASE 5A — Mako / The Devourer concept pass

**Status: 🟡 concept exploration generated; production replacement menunggu approval**

Brief owner yang sedang dipakai:

- Ancient hunter, bukan manusia dan bukan blob cute.
- Asymmetrical deep-teal protoplasm dengan tepi hidup.
- Dark horseshoe/kidney-shaped nucleus sebagai pusat visual.
- Pseudopod 1 → 2 → 3 → 4 → multi-pseudopod sepanjang evolusi.
- Vakuola mangsa sebagai detail internal.
- Tidak ada mata, wajah manusia, tangan, bentuk simetris, atau pastel.
- Idle, lunge/attack, engulf/devour, damage, low-HP, dan level-up menjadi
  target state art bertahap.

Exploration yang sudah dibuat sebagai **reference-only**, belum menggantikan
asset runtime:

- `assets/heroes/reference/mako_devourer_concept_sheet.png`
- `assets/heroes/reference/mako_devourer_idle_concept.png`
- `assets/heroes/reference/mako_devourer_attack_concept.png`
- `assets/heroes/reference/mako_devourer_devour_concept.png`

Catatan handoff:

- Concept sheet sudah merangkum lima tahap: Amoeba Muda, Pemburu Aktif,
  Phagosit, Mutan, dan Apex Devourer.
- Tiga pose eksplorasi sudah dibuat untuk idle, lunge, dan devour.
- Gambar eksplorasi masih berukuran concept sheet/1024 px dan belum semuanya
  transparan secara produksi.
- Tidak ada file produksi `assets/heroes/towers/macrophage_tower_*.png` yang
  ditimpa pada tahap ini.
- Setelah owner menyetujui arah visual, baru dibuat batch produksi 128 px
  transparan dan import art langsung bila diperlukan.

---

### PHASE 5 — Legacy sprite replacement

**Status: 🟡 belum dimulai; menunggu konsep owner**

Target audit dan kemungkinan replacement:

- Hero roaming legacy di `assets/sprites/hero_*`.
- Enemy legacy di `assets/sprites/enemy_*`.
- Portrait hero.
- Legacy arena/decorative sprite hanya jika owner menyatakan masih dalam scope
  Art Agent.

Aturan fase:

- Tidak menghapus asset lama sebelum replacement disetujui.
- Tidak mengubah data gameplay untuk memaksa visual baru.
- Setiap replacement memakai batch kecil dan reference sheet.
- Import hanya mengubah path art atau preload manifest yang terkait langsung.

Batch prioritas default setelah konsep diterima:

1. Mako/macrophage.
2. Neutron/neutrophil.
3. Eos/eosinophil.
4. Dendri/dendritic.
5. T-Bolt/TCD8.
6. Helia/TCD4.
7. Baso/basophil.
8. Mastia/mastcell.
9. Treg.
10. Bella/B-cell.
11. Nyx/NK-cell.

Urutan ini dapat berubah jika owner memberi konsep atau prioritas lain.

---

### PHASE 6 — Mutation, equity, dan gameplay-facing VFX

**Status: 🟡 fondasi tersedia; redesign menunggu konsep owner**

Target:

- 18 mutation visual.
- 4 equity part.
- Visual stage/equity overlay.
- Hit, spark, ring, engulf, pulse, dan upgrade burst yang bersifat asset-facing.

Aturan fase:

- Art boleh memperjelas state, tetapi tidak mengubah efek atau angka mekanik.
- Overlay harus kumulatif dan tidak menutup cue utama hero.
- VFX harus mengikuti visual biology, bukan sci-fi weapon language.
- Import code hanya jika asset baru membutuhkan mapping state visual.

---

### PHASE 7 — Review, packaging, dan import handoff

**Status: ⬜ belum dimulai sebagai fase formal**

Untuk setiap batch final:

- PNG transparan dan nama file sesuai ID.
- Metadata art menunjuk file yang benar.
- Reference sheet atau review screenshot tersedia.
- Tidak ada perubahan gameplay/UI/map.
- Handoff note mencatat asset lama, asset baru, dan jalur import.
- Owner melakukan approval konsep sebelum batch berikutnya.

Validator asset yang relevan:

- `node scripts/check-imports.mjs`
- `node scripts/verify-ecosystem-assets.mjs`

Validator tersebut dipakai hanya untuk memastikan asset/path tidak rusak; Art
Agent tidak memperbaiki validator atau issue non-art yang ditemukan di dalamnya.

---

## 5. ATURAN KERJA PER BATCH

Satu batch selalu mengikuti urutan berikut:

1. Owner membagikan konsep, referensi, atau arahan visual.
2. Art Agent mengunci target batch dan tidak memperluas scope sendiri.
3. Art Agent membuat/mengganti asset.
4. Art Agent memperbarui metadata/path import hanya bila perlu.
5. Art Agent membuat review sheet/screenshot.
6. Art Agent menjalankan validasi asset yang relevan.
7. Art Agent melaporkan file, status, dan item yang menunggu approval.
8. Setelah approval, lanjut ke batch berikutnya.

Tidak ada batch baru yang boleh sekaligus memperbaiki gameplay, QA test,
font, culling, economy, atau browser dependency.

---

## 6. LOG PERUBAHAN ART

| Tanggal | Phase | Batch | Status | File utama | Approval |
|---|---|---|---|---|---|
| 2026-09-15 | 0 | Scope lock & inventory | ✅ | `ART_ROADMAP.md` | Menunggu konsep berikutnya |
| 2026-09-15 | 2–4 | Existing ecosystem asset audit | ✅ tersedia | `assets/heroes/`, `assets/enemies/`, `assets/buildings/` | Menunggu arahan redesign |
| 2026-09-15 | 5A | Mako / The Devourer concept exploration | 🟡 reference-only | `assets/heroes/reference/mako_devourer_*.png` | Menunggu approval sebelum production replacement |

---

## 7. NEXT INPUT YANG DIBUTUHKAN DARI OWNER

Sebelum Phase 5 atau Phase 6 dimulai, owner cukup mengirim:

- konsep visual;
- target phase dan batch;
- daftar asset/ID yang harus diganti;
- referensi gaya atau contoh visual;
- ukuran/state yang diperlukan;
- apakah asset lama dipertahankan sebagai fallback atau diganti langsung.

Sampai input itu diterima, Art Agent berhenti pada scope lock dan tidak
mengubah asset produksi secara arbitrer.
