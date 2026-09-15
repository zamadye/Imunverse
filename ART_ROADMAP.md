# PHAGOS — ART AGENT ROADMAP

**Branch kerja:** `arena/01a0a431-imunverse`  
**Scope owner:** Game Artist / Art Asset Agent  
**Status dokumen:** inventory dan urutan kerja sebelum konsep visual berikutnya diterima  
**Tanggal audit:** 15 September 2026

Dokumen ini adalah peta kerja aset visual PHAGOS. Ini bukan roadmap gameplay,
balance, QA, bug fixing, UI/UX, atau infrastructure.

---

## 0A. OWNER V2 ART DIRECTION — OVERRIDE TERBARU

Brief terbaru owner adalah arah visual aktif untuk Imunverse V2 dan menjadi
prioritas di atas eksplorasi Mako sebelumnya.

Perubahan arah yang harus dihormati:

- Hero V2 = **stylized humanoid biological game characters**, bukan sprite sel
  non-humanoid sebagai arah produksi utama.
- Target rasa = cute + epic + biological + collectible + gameplay-readable.
- Hero harus punya head/face, torso, arm, leg, pose, personality, dan combat
  fantasy yang terbaca.
- Mako = friendly giant macrophage: torso besar, lengan tebal, kaki pendek,
  tangan oversized, moss green + biological yellow, dan engulfing mechanism.
- Virus = chaotic, organic, dangerous, cute, weird, collectible; bukan horror.
- Setiap karakter wajib berbeda melalui proporsi, siluet, posture, equipment,
  movement language, dan signature effect — bukan hanya pergantian warna.
- Skins mempertahankan siluet Hero dan dikembangkan setelah default art lock.
- Style lock wajib mengikuti urutan owner: 3 Hero + 3 Virus + 1 Boss sebelum
  produksi roster penuh.

Eksplorasi Mako non-humanoid yang dibuat sebelum brief V2 tetap disimpan sebagai
arsip/reference dan **bukan** final production direction. Asset runtime belum
diganti.

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
| Visual language & Art Bible | 1 sistem | 🟡 | Fondasi lama tersedia; brief V2 owner menjadi override dan style lock baru belum final. |
| Hero sebagai tower | 11 hero × 3 state | 🟡 | 33 PNG tersedia, tetapi merupakan ecosystem pass sebelumnya dan bukan final V2 humanoid direction. |
| Reference hero tower | 1 sheet | 🟡 | Sheet lama tersedia; perlu reference sheet baru setelah V2 style lock. |
| Pathogen berbasis path | 13 pathogen | 🟡 | 13 PNG tersedia; V2 virus direction perlu style test baru sebelum produksi roster. |
| Reference pathogen | 1 sheet | 🟡 | Sheet lama tersedia; perlu direkonsiliasi dengan virus V2. |
| Colony building | 7 building × 3 stage | ✅ | 21 PNG di `assets/buildings/`; tetap menjadi track ecosystem terpisah. |
| Reference colony | 1 sheet | ✅ | `assets/buildings/reference/colony_buildings_reference_sheet.png`. |
| V2 style lock package | 3 hero + 3 virus + 1 boss | ⬜ | Wajib sebelum produksi penuh menurut brief V2 owner. |
| Mako V2 concept options | 3 opsi | ✅ | Option B — Belly Devourer dipilih owner; Mako production preview/runtime pass sudah diimpor. |
| Legacy hero/enemy sprites | 11 hero + 13 enemy | 🟡 | Masih ada di `assets/sprites/`; belum diputuskan batch pengganti setelah konsep owner. |
| Portrait hero | 11 portrait | 🟡 | Asset tersedia; perlu arahan apakah akan dipoles atau diganti total. |
| Mutation overlay art | 18 mutation | ✅ | 18 RGBA layer Mako V2 tersedia, tervalidasi, dan dipreload sebagai layer kumulatif. |
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

### PHASE V2-A — Style exploration gate

**Status: 🟡 berjalan untuk roster penuh; Mako Option B sudah dikunci sebagai exception runtime**

Sesuai brief V2 owner, jangan langsung memproduksi seluruh roster. Paket style
test minimal yang harus tersedia sebelum style lock:

- 3 Hero concepts — Mako, Dendri, Neutron.
- 3 Virus concepts — tiga family berbeda dengan siluet berbeda.
- 1 Boss concept — satu evolved/mutated family dengan complexity lebih tinggi.

Yang sudah tersedia:

- Mako V2 Option A — Friendly Giant Guardian.
- Mako V2 Option B — Belly Devourer.
- Mako V2 Option C — Pseudopod Guardian.

Yang belum tersedia:

- Dendri V2 concept.
- Neutron V2 concept.
- Virus concept 1–3.
- Boss concept.

Hasil fase ini tetap reference-only untuk roster penuh. Owner sudah menyetujui Mako V2 Option B sebagai exception, sehingga Mako memiliki production preview dan import runtime langsung tanpa mengubah gameplay.

---

### PHASE V2-MAKO — Mutation, evolution, dan skin plan

**Status: ✅ Mako Option B art pass dan import runtime selesai; roster penuh tetap menunggu style lock**

Baseline yang dipilih owner: **Mako V2 Option B — Belly Devourer**.

#### Jumlah visual mutation Mako

Untuk Mako ditetapkan:

- **5 visual evolution stages** — bentuk dasar yang berkembang sepanjang run.
- **18 visual mutations** — 6 mutation families × 3 tiers.
- **5 skin families** — terpisah dari mutation dan tidak mengubah stat.

Angka 18 sengaja selaras dengan pool mutation yang sudah ada di repository.
Mapping visual ke ID gameplay dilakukan setelah style lock; fase ini tidak
mengubah `data/mutations.json` dan tidak menambah mechanic baru.

#### Lima evolution stages

| Stage | Milestone art | Nama visual | Perubahan utama |
|---|---|---|---|
| 0 | Wave 1 | Belly Devourer | Torso besar, maw perut tertutup, tangan oversized, nucleus cue. |
| 1 | **Wave 2** | First Hunger | Maw mulai terbuka, rim kuning lebih kuat, satu vacuole terlihat. |
| 2 | Wave 4 | Phagosome Brute | Torso lebih lebar, maw berlapis, lengan mulai membentuk pseudopod. |
| 3 | Wave 7 | Pseudopod Breaker | Siluet asimetris, lengan memanjang/bercabang, vacuole bertambah. |
| 4 | Wave 10+ | Apex Devourer | Bentuk paling besar, multi-pseudopod, golden-biological glow, nucleus lebih padat. |

Milestone di atas adalah kontrak visual art. Trigger gameplay final tetap milik
agent gameplay; Art Agent hanya menyediakan bentuk dan layer yang diperlukan.

#### Enam mutation families × tiga tiers

Setiap family harus bersifat additive agar dapat dirender sebagai layer dan tetap
mempertahankan silhouette Mako:

1. **Rahang Fagosom** — maw rim, lipatan, dan depth engulf.
2. **Lengan Lapar** — arm stretch, split pseudopod, wrap silhouette.
3. **Vakuola Panen** — jumlah, ukuran, warna, dan glow vacuole mangsa.
4. **Membran Benteng** — shoulder pad biologis, layered membrane, body mass.
5. **Inti Purba** — nucleus visibility, density, internal glow, core state.
6. **Amukan Sitoplasma** — asymmetry, bulge, extra appendage, mutation growth.

Tier 1 = cue kecil yang terbaca di gameplay.  
Tier 2 = perubahan silhouette dan material yang jelas.  
Tier 3 = perubahan besar dengan tetap mempertahankan identitas Mako.

#### Skin families

Skin dibuat setelah default Mako dan mutation language dikunci:

1. **Default Biological** — moss green + biological yellow.
2. **Rare Lime Colony** — variasi palette/material ringan.
3. **Epic Deep Sea** — teal gelap, cyan glow, vacuole bioluminescent.
4. **Legendary Golden Apex** — golden membrane accents dan devour VFX khusus.
5. **Event Seasonal** — slot untuk tema musiman; silhouette Mako tetap dipertahankan.

Skin tidak boleh mengubah hitbox, stat, role, atau silhouette inti Mako.

#### Rencana generator art

Generator akan dipisah menjadi dua tanggung jawab:

- **Python + Pillow** untuk compositing raster: body, face, maw, arm,
  pseudopod, nucleus, vacuole, mutation layers, skin palette, alpha cleanup,
  resize gameplay, dan sprite sheet.
- **MJS** untuk membaca manifest/metadata, membuat daftar kombinasi yang sah,
  memeriksa file output, dan menyiapkan path import tanpa mengubah gameplay.

Target output generator:

- 5 stage base Mako.
- 18 mutation layer/variant set.
- 5 skin variants.
- Preview sheet dan gameplay-size sheet.
- PNG transparan production-ready.

Untuk Mako, owner sudah menyetujui silhouette Option B. Generator Python/MJS
sudah menghasilkan output transparan yang konsisten dan dapat diulang di
`tools/gen_mako_v2.py` dan `scripts/verify-mako-v2.mjs`. Concept AI tetap
menjadi reference; generator dipakai untuk output runtime Mako saja.

---

### PHASE V2-B — Owner approval & style lock

**Status: ⬜ menunggu paket V2-A lengkap**

Approval harus memeriksa:

- silhouette dalam grayscale;
- personality dan facial readability;
- biological inspiration;
- combat fantasy dan signature effect;
- gameplay-scale readability;
- kesatuan Hero versus Virus versus Boss;
- potensi skin tanpa merusak silhouette.

Tidak lanjut ke produksi roster sebelum owner menyetujui style lock.

---

### PHASE V2-C — Hero production

**Status: ⬜ belum dimulai**

Setelah style lock: produksi 11 Hero V2 dengan identity asset, gameplay asset,
portrait, icon, expressions, animation state, dan signature VFX secara bertahap.

---

### PHASE V2-D — Virus, variants, boss, VFX, skins

**Status: ⬜ belum dimulai**

Urutan owner:

1. 13 Virus families.
2. Enemy variants: normal, elite, armored, fast, split, explosive, stealth.
3. Boss families dan phase presentation.
4. Hero/Virus VFX language.
5. Skin architecture dan cosmetic packs.

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

Opsi siluet tambahan untuk dipilih owner:

- **Option A — Ancient Amoeba:** massa rendah dan berat, pseudopod tebal,
  terasa seperti predator tide-pool purba.
- **Option B — Tendril Hunter:** tubuh lebih vertikal, empat tendril panjang,
  paling kuat untuk bahasa "hunter" dan chase.
- **Option C — Membrane Mantle:** badan lebar seperti selubung hidup,
  pseudopod pendek melipat ke dalam, terasa seperti perangkap biologis.
- **Option D — Vacuole Colossus:** badan padat dan besar, vacuole mangsa lebih
  dominan, terasa paling tank dan imposing.

File opsi:

- `assets/heroes/reference/mako_option_a_ancient_amoeba.png`
- `assets/heroes/reference/mako_option_b_tendril_hunter.png`
- `assets/heroes/reference/mako_option_c_membrane_mantle.png`
- `assets/heroes/reference/mako_option_d_vacuole_colossus.png`

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
| 2026-09-15 | 5A | Mako silhouette options A–D | 🟡 reference-only | `assets/heroes/reference/mako_option_*.png` | Menunggu pilihan owner |
| 2026-09-15 | V2-A | Mako V2 humanoid options A–C | ✅ Option B dipilih | `assets/heroes/reference/mako_v2_option_*.png` | Mako Option B disetujui sebagai baseline |
| 2026-09-15 | V2-MAKO | Mako Option B runtime art import | ✅ | `assets/sprites/mako_v2/`, `tools/gen_mako_v2.py`, `scripts/verify-mako-v2.mjs` | 38 PNG RGBA tervalidasi; roster penuh tetap menunggu style lock |
| 2026-09-16 | V2-ANIM | Mako motion identity gameplay pass 1 | 🟡 owner review | `docs/animation/mako-v2-motion.md`, `js/render/mako-animation.js` | Idle/move/pulse/skill/reaction cues dibuat; jangan lanjut hero berikutnya sebelum review |

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
