# IMUNVERSE ART BIBLE — Asset Design System Pasca-Pivot

> Tanggal: 2026-09-10
> Owner scope: Art Director / Character Asset Ecosystem
> Berlaku untuk: hero sebagai tower, pathogen/musuh path-based, bangunan koloni, dan VFX asset-facing.
> Non-scope: environment/map yang menampung asset adalah Arena Agent; pembungkus panel/HUD adalah UI/UX Agent; combat math/balance bukan bagian dokumen ini.

## 0. Source of truth & urutan kerja

1. **Wajib-baca migrasi:** path yang diminta user `/src/core/MIGRATION_BRIEF.md` belum ada di branch kerja saat audit awal, jadi dibuat sebagai local bridge setelah rujukan pivot dibaca dari remote:
   - `origin/arena/01a08866-imunverse:docs/MIGRATION_BRIEF.md`
   - `origin/arena/01a087b6-imunverse:README-CORE-PIVOT.md`
   - `origin/arena/01a087b6-imunverse:src/towers/data/towers.json`
   - `origin/arena/01a087b6-imunverse:src/colony/data/buildings.json`
   - `origin/arena/01a087b6-imunverse:src/colony/data/unlock-rules.json`
2. **Art Bible ini dibuat sebelum asset baru**. Semua asset baru di `assets/heroes/`, `assets/enemies/`, dan `assets/buildings/` harus mematuhi aturan di bawah.
3. **ID tidak boleh lepas dari Agent 8 linkage.** Bangunan memakai id `markas_sel`, `barak_sel`, `pos_sinyal`, `lab_membran`, `pusat_riset`, `menara_limfa`, `monumen_imun`; tower memakai id `tower_*` dari pivot.
4. **Desain bukan balancing.** Warna, bentuk, state animasi, dan VFX tidak mengubah damage, cooldown, cost, HP, atau pathing.

---

## 1. Pilar gaya visual satu dunia

Imunverse harus terasa seperti **dunia mikrobiologis yang bisa dimainkan anak**, bukan gabungan icon sci-fi, monster generik, dan bangunan RTS. Semua kategori asset memakai satu bahasa:

- **Organik terlebih dahulu:** bentuk dasar berupa sel, membran, vesikel, jaringan, kapiler, flagela, cilia, pseudopodia, nukleus, antibodi-Y, granula, spora, atau matriks ekstraseluler.
- **Ramah dibaca dari jauh:** siluet besar, kontras rim, dan satu cue biologis utama harus terbaca pada tinggi layar gameplay sekitar 32–48 px.
- **Tidak realistis-horor:** pathogen boleh mengancam, tetapi tetap candy-biological, bukan gore.
- **Tidak generik sci-fi/RTS:** hindari logam keras, antena radio, turret meriam, beton, paku industri, panel UI futuristik sebagai tubuh bangunan.
- **Asimetri lembut:** semua makhluk/bangunan boleh wobble 6–18% agar hidup; jangan terlalu geometris kecuali prion/crystal, dan prion tetap diberi glow/rim biologis.

---

## 2. Rendering style global

### 2.1 Outline & rim

| Asset | Outer outline | Inner rim | Catatan |
|---|---:|---:|---|
| Hero/tower | 3–4 px pada source 128 px | 1.5–2.5 px highlight | Outline gelap teal/ungu, bukan hitam murni. |
| Pathogen kecil | 2.5–3 px source 96–128 px | 1.5 px highlight | Rim harus tetap terlihat saat bergerombol di lane. |
| Boss pathogen | 5–7 px source 256 px | 3 px highlight | Boss perlu outline lebih tebal agar tidak tenggelam di VFX. |
| Bangunan koloni | 4–6 px source 192 px | 2–3 px highlight | Outline mengikuti membran organik, bukan kotak bangunan. |
| VFX/readability marks | 1.5–3 px | opsional | Tidak boleh menutup biological cue utama. |

Warna outline default: `#123c3b` untuk immune/building; `#4d1835` atau `#3b2548` untuk pathogen; alpha 0.75–0.95.

### 2.2 Shading

- Sumber cahaya konsisten: **kiri-atas** (`-20% x`, `-25% y`).
- Gunakan 3 lapis shading:
  1. soft shadow elliptical di bawah asset (alpha 0.12–0.22),
  2. radial body fill dari highlight kiri-atas ke warna utama,
  3. inner membrane rim / wet highlight tipis.
- Tidak memakai cel-shade keras 2 warna; tidak memakai gradient metalik.
- Tekstur biologis: titik vesikel, nucleus blob, capillary roots, cilia, antibody-Y, extracellular threads. Maksimum 3 jenis tekstur per asset agar tidak noisy.

### 2.3 Saturasi & value

| Kategori | Saturation | Value | Aturan |
|---|---:|---:|---|
| Hero/tower | 62–82% | terang sedang | Hero adalah focal positif. Warna lama harus dipertahankan. |
| Pathogen | 58–78% | lebih gelap/kontras | Ancaman terbaca tetapi tidak lebih glossy dari hero. |
| Bangunan koloni | 44–70% | sedang hangat | Bangunan support; jangan menyaingi hero kecuali saat upgrade pulse. |
| Environment/map | 25–45% | lebih redup | Arena Agent harus menurunkan saturasi background agar asset menonjol. |
| Upgrade/VFX | 80–95% | terang sesaat | Durasi pendek; alpha decay cepat. |

---

## 3. Aturan identitas biologis minimal

Setiap asset final WAJIB punya:

1. **Siluet organik/asimetris:** bentuk utama tidak boleh kotak/simetris sempurna; wobble 6–18%.
2. **Minimal 1 cue biologis besar terbaca dari jarak gameplay:** contoh antibody-Y, nucleus, pseudopodia, flagella, cilia, capsule crack, vesicle, membrane valves, capillary roots.
3. **Anchor kategori yang jelas:**
   - Hero/tower = immune-cell body + hero color + tower root/base.
   - Pathogen = hostile body + mutation/rim cue + lane readability marker.
   - Building = living tissue/colony structure + capillary roots + function cue.
4. **Tidak boleh bergantung pada tooltip/UI untuk dikenali.** Bila sprite diperkecil ke 48 px masih harus ada satu cue yang bisa disebut.

Checklist review 48 px:

- [ ] Outline masih terlihat.
- [ ] Hero/tower masih punya warna dan proporsi yang sama dengan reference lama.
- [ ] Pathogen bisa dibedakan dari hero meski warnanya mirip.
- [ ] Bangunan terlihat seperti jaringan/koloni sel, bukan rumah/menara biasa.
- [ ] VFX tidak menutupi cue utama lebih dari 0.25 detik.

---

## 4. Palette system

### 4.1 Hero/tower source colors — tidak diganti

| Hero | ID | Color | Tower cue wajib |
|---|---|---:|---|
| Mako | `macrophage` | `#4a7c59` | tubuh besar, pseudopodia/root grip, phagosome belly. |
| Dendri | `dendritic` | `#ff8c00` | cabang dendrite radial sebagai antenna tower. |
| Neutron | `neutrophil` | `#1a5276` | inti tersegmentasi + NET filament. |
| Eos | `eosinophil` | `#ff6b81` | granule lance/parasit hook. |
| Baso | `basophil` | `#8e44ad` | vesicle cloud/histamine sacs. |
| Mastia | `mastcell` | `#a03328` | granule tank + membrane shield. |
| T-Bolt | `tcd8` | `#00d2ff` | cytotoxic scanner + perforin lance. |
| Helia | `tcd4` | `#f1c40f` | cytokine command halo. |
| Treg | `treg` | `#2ecc71` | regulatory shield/mantle. |
| Bella | `bcell` | `#bb8fce` | BCR antenna + antibody-Y wings. |
| Nyx | `nkcell` | `#4a235a` | dark NK body + stress-sensor crown/spikes. |

### 4.2 Pathogen palette

Pathogen tetap memakai warna data lama, tetapi diberi **rim unifier** agar render style sama dengan hero:

- hostile rim: dark plum `#4d1835` atau dark teal `#143f3d` tergantung hue,
- infection glow: coral/red `#ff6b6b` untuk bacteria/cancer, lime `#9be15d` untuk virus/toxin, violet `#b39ddb` untuk toxic/crystal,
- stacking marker: highlight dorsal dot/stripe `#fff3b0` alpha 0.55 supaya gerombolan di path tetap terbaca.

### 4.3 Building palette

| Building | Category | Base | Accent | Biological metaphor |
|---|---|---:|---:|---|
| `markas_sel` | inti | `#38bfa7` | `#fff3b0` | nucleus dome + colony membrane. |
| `barak_sel` | militer | `#ff9f43` | `#72d66b` | budding immune-cell pods. |
| `pos_sinyal` | dukungan | `#4dd6ff` | `#f1c40f` | cytokine beacon / dendrite antenna. |
| `lab_membran` | pertahanan | `#7b6ee6` | `#80c7ff` | layered membrane shell. |
| `pusat_riset` | riset | `#bb8fce` | `#ffd76a` | organelle lab + DNA/antibody motifs. |
| `menara_limfa` | infrastruktur | `#2ecc71` | `#9be7ff` | lymph-vessel spire with valves. |
| `monumen_imun` | kosmetik | `#ffe082` | `#ffffff` | antibody-Y pearl monument. |

---

## 5. Hero sebagai tower — pose & animation bible

Hero lama adalah roaming survival character. Pada pivot, hero menjadi tower. Art direction: **same organism, new posture**.

### 5.1 Proporsi tidak boleh berubah

- Body mass, color, nucleus style, and hero silhouette must stay recognizably identical to the existing sprite/reference.
- Tower pose may add a **root/base membrane** underneath but cannot replace the character with a machine turret.
- Stage/equity cues stay additive: tower form is a pose layer, not a redesign.

### 5.2 Required states

| State | Frame/asset | Motion rule | VFX rule |
|---|---|---|---|
| Tower idle | `*_tower_idle.png` | rooted, breathing 2–4% scale, no locomotion | soft membrane pulse under base. |
| Tower attack | `*_tower_attack.png` | upper body/cue leans 6–10° toward lane, root stays fixed | projectile/buildup uses existing archetype VFX color. |
| Tower upgrade | `*_tower_upgrade.png` | vertical bloom, new organelles light up | golden cytokine ring + equity color burst, <0.6 sec. |
| Hit feedback | runtime VFX | no knockback displacement of tower root | existing hit-impact signatures remain visual-only. |

### 5.3 Per-hero tower reference extension

| Tower | Hero | Idle tower silhouette | Attack from static pose | Upgrade visual |
|---|---|---|---|---|
| `tower_macrophage` | Mako | heavy ameba anchored by pseudopodia roots | membrane arm engulfs lane side | phagosome belly flash + MHC crown. |
| `tower_dendritic` | Dendri | radial dendrite tripod | branch tip points like sensor dish | lymph beacon lights each branch tip. |
| `tower_neutrophil` | Neutron | compact blue body on NET pad | segmented nucleus aims and NET thread snaps | DNA net lattice expands under tower. |
| `tower_eosinophil` | Eos | pink body with granule quiver rooted | lance extends from body, no chase | granule ring loads into main lance. |
| `tower_basophil` | Baso | purple vesicle sacs on soft base | histamine vesicles puff outward | calming/allergy seal glows above sacs. |
| `tower_mastcell` | Mastia | red-orange tank cell with thick membrane roots | degranulation valve opens in place | shield membrane grows one ring. |
| `tower_tcd8` | T-Bolt | cyan killer cell on scanner pad | perforin beam/lance from static core | programmed-death seal flashes over body. |
| `tower_tcd4` | Helia | gold helper cell with command halo | cytokine pulse/command staff fires | halo doubles then settles. |
| `tower_treg` | Treg | mint regulator mantle forms shield base | shield pulse projects from tower | CTLA-4/regulator mantle wraps base. |
| `tower_bcell` | Bella | purple B cell with rooted antibody wings | antibody-Y markers launch from wings | memory node lights in center. |
| `tower_nkcell` | Nyx | dark NK spike crown on anchored pad | short-range spike burst | stress-sensor crown opens. |

Reference assets produced by this pass:

- `assets/heroes/towers/*_tower_idle.png`
- `assets/heroes/towers/*_tower_attack.png`
- `assets/heroes/towers/*_tower_upgrade.png`
- `assets/heroes/reference/hero_tower_reference_sheet.png`

---

## 6. Bangunan koloni — living structures, not RTS bases

### 6.1 Global building grammar

Every building is a **colony-cell organ**. Mandatory components:

1. **Basal membrane pad** — translucent organic base/root; makes building sit inside colony.
2. **Capillary or extracellular roots** — 3–7 root strands connecting to hub tissue.
3. **Function cue** — one large biological symbol showing what it does.
4. **Growth stages** — at least two visible steps; default asset set uses 3 stages.

### 6.2 Building stages

| Visual stage | Meaning | Shape rule |
|---|---|---|
| Stage 1 — Bud | just built / early unlock | small membrane bud + one function cue. |
| Stage 2 — Growing | active upgrade | larger organelle cluster + roots extended. |
| Stage 3 — Mature | high level / prestige | full silhouette, extra ring/valve/beacon, still readable at 48 px. |

If Agent 8 data only has 1–2 numeric levels, UI may map these visual stages as `preview → built → mature flourish` or interpolate by progress; asset filenames remain `stage1..stage3` so no code needs per-building exceptions.

### 6.3 Building roster & tower coverage

| Building | Visual metaphor | Covered tower unlocks |
|---|---|---|
| `markas_sel` | nucleus dome, colony heart membrane | `tower_macrophage` default/anchor. |
| `barak_sel` | budding immune training pods | `tower_neutrophil`, `tower_eosinophil`, `tower_tcd8`. |
| `pos_sinyal` | cytokine beacon with dendrite antenna | `tower_tcd4`, `tower_basophil`, plus half of `tower_dendritic`. |
| `lab_membran` | layered membrane lab/shield organ | `tower_mastcell`. |
| `pusat_riset` | organelle research core + antibody/DNA | `tower_bcell`, `tower_treg`, plus half of `tower_dendritic` and `tower_nkcell`. |
| `menara_limfa` | lymph vessel spire/valves | half of `tower_nkcell` legendary unlock. |
| `monumen_imun` | antibody-Y pearl monument | prestige/cosmetic only; no power unlock. |

Reference assets produced by this pass:

- `assets/buildings/{id}_stage1.png`
- `assets/buildings/{id}_stage2.png`
- `assets/buildings/{id}_stage3.png`
- `assets/buildings/reference/colony_buildings_reference_sheet.png`

---

## 7. Pathogen path-based redesign

Path-defense changes how enemies are read. They no longer roam randomly; they travel in lanes, stack, queue, split, and overlap.

### 7.1 Lane readability rules

- Add a **dorsal/top marker** (dot, stripe, crown, capsule crack) visible from top-down lane view.
- Keep the widest biological cue on the **side silhouette**, not only the front, because enemies can face along curved paths.
- Avoid long thin appendages extending more than 0.35× body radius into adjacent lane; use curved/short flagella instead.
- Bosses may occupy more lane width but must keep an inner core visible even when VFX overlaps.
- When stacked, each enemy must have either rim contrast or top marker separated by at least 6 px at source scale.

### 7.2 Formasi gerombolan

| Family | Queue silhouette | Stack marker | Rule |
|---|---|---|---|
| bacterium | capsule beads | division stripe | alternating slight rotation ±8°. |
| armored_bacterium | thick capsule | double rim | leave cracks on side, not center only. |
| toxic_bacterium | double membrane | violet rim notch | avoid green toxin cue used by healing/immune. |
| virus/virion | spike orb | top spike glint | no full halo; halo would merge in swarm. |
| parasite | worm/ruffle | head eye-dot | keep body elongated along lane direction. |
| fungus | chitin spore | cap spot | slow/tank read via large cap. |
| cancer/abnormal | mutating blob | red nucleus/core | boss keeps mutation crown; minion keeps core only. |
| protozoa | ciliated oval | cilia comb | cilia must stay lateral. |
| toxin/toxin_boss | droplet/crystal cloud | toxic bubble | boss gets large membrane aura, not smoke blob. |
| crystal/prion | shard protein fold | bright fold edge | hard geometry allowed, with organic glow. |

Reference assets produced by this pass:

- `assets/enemies/path/*_path.png`
- `assets/enemies/reference/pathogen_path_reference_sheet.png`

---

## 8. VFX continuity after pivot

Existing Character Agent juice/VFX remains valid but context changes from roaming to static towers:

- **Buildup skill:** attach to tower base/organ cue, not player feet movement.
- **Hit feedback:** existing per-target impact signatures remain on pathogen target; do not move tower.
- **Upgrade tower:** new burst is cytokine/equity bloom at tower anchor; use short ring + upward organelle glow.
- **Projectile identity:** antibody-Y, perforin lance, NET filament, cytokine pulse, histamine vesicle, phagocyte arc remain the vocabulary.

No VFX should make a building look like a machine or a sci-fi cannon.

---

## 9. File & naming conventions

```
assets/ART_BIBLE.md
assets/heroes/towers/{heroId}_tower_idle.png
assets/heroes/towers/{heroId}_tower_attack.png
assets/heroes/towers/{heroId}_tower_upgrade.png
assets/heroes/reference/hero_tower_reference_sheet.png
assets/enemies/path/{enemyId}_path.png
assets/enemies/reference/pathogen_path_reference_sheet.png
assets/buildings/{buildingId}_stage{1|2|3}.png
assets/buildings/reference/colony_buildings_reference_sheet.png
src/characters/data/hero-tower-poses.json
src/enemies/data/pathogen-path-style.json
src/buildings/data/colony-buildings-art.json
```

Rules:

- Use lowercase snake_case ids from data.
- PNGs are transparent and source-authored at 128/192/256 px; runtime can scale down.
- Do not overwrite `assets/sprites/hero_*` or `assets/sprites/enemy_*` until the pivot runtime consumes new paths.
- Additive assets live in new directories so survival runtime remains stable.

---

## 10. Review gates

Before a new asset can be considered done:

1. Matches this Art Bible at 48 px readability.
2. Has transparent PNG and deterministic generator/source note.
3. Has id that maps to Agent 8 tower/building/enemy source.
4. Does not require Arena Agent to change map logic; only optional palette matching.
5. Does not require UI/UX Agent to infer state names; state is explicit in JSON.
6. `npm run check` still passes.
7. Fresh review sheet exists in `shots/review/` if a visual pass was changed.

---

## 11. Cross-scope handoff notes

- **Arena Agent:** please keep map/backdrop saturation below asset focal saturation, and consume `assets/buildings/*` when hub plots replace procedural silhouettes.
- **UI/UX Agent:** use state names from `src/characters/data/hero-tower-poses.json` and `src/buildings/data/colony-buildings-art.json`; do not derive labels from filenames.
- **Combat/Balance Agent:** visual size/root/tentacle length is not hitbox size. Hitbox/range stays in tower/pathing data.
- **Map Agent:** `menara_limfa` and `pos_sinyal` have bright cyan/gold accents; avoid using the same accents as lane danger markers.
