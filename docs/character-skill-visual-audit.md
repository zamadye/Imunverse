# Character Skill Visual Audit

> Dibuat: 2026-09-09  
> Scope: visual identity skill hero Character Agent. Tidak mengubah damage, cooldown, atau balance.

## Ringkasan

- Semua 11 hero memiliki 3 skill aktif di `data/heroes.json`.
- HUD sudah memakai glyph mekanisme imun dari `js/ui/screens/hud-screen.js`.
- Pass terbaru menambah accent visual skill berdasarkan `archetype` dan warna Equity aktif dari `data/character-designs.json`.
- FX gameplay unik per hero/archetype masih backlog terpisah karena perlu QA animasi dan tidak boleh menyentuh damage math.

## Mapping hero → archetype → skill visual saat ini

| Hero | Archetype design | Skill | Effect kind | Warna skill | Status visual |
|---|---|---|---|---|---|
| Mako (`macrophage`) | `phagocyte` | Taunt (`taunt`) | `pull, shield_self` | `#4a7c59` | HUD glyph + archetype/equity accent ✅ |
| Mako (`macrophage`) | `phagocyte` | Sikap Bertahan (`defensive_stance`) | `protect_self` | `#5d8a6b` | HUD glyph + archetype/equity accent ✅ |
| Mako (`macrophage`) | `phagocyte` | Devour (`devour`) | `devour` | `#d4a017` | HUD glyph + archetype/equity accent ✅ |
| Dendri (`dendritic`) | `dendritic` | Mark Target (`mark_target`) | `mark` | `#ff8c00` | HUD glyph + archetype/equity accent ✅ |
| Dendri (`dendritic`) | `dendritic` | Heal Pulse (`heal_pulse`) | `heal` | `#ffd700` | HUD glyph + archetype/equity accent ✅ |
| Dendri (`dendritic`) | `dendritic` | Overcharge (`overcharge`) | `buff_self, buff_allies` | `#ffaa00` | HUD glyph + archetype/equity accent ✅ |
| Neutron (`neutrophil`) | `net` | Grenade (`grenade`) | `area` | `#1a5276` | HUD glyph + archetype/equity accent ✅ |
| Neutron (`neutrophil`) | `net` | Adrenaline (`adrenaline`) | `buff_self` | `#bdc3c7` | HUD glyph + archetype/equity accent ✅ |
| Neutron (`neutrophil`) | `net` | Blitz (`blitz`) | `instant_hits` | `#2980b9` | HUD glyph + archetype/equity accent ✅ |
| Eos (`eosinophil`) | `granule_lance` | Poison Dart (`poison_dart`) | `strike` | `#ff6b81` | HUD glyph + archetype/equity accent ✅ |
| Eos (`eosinophil`) | `granule_lance` | Evade (`evade`) | `buff_self` | `#ff8a80` | HUD glyph + archetype/equity accent ✅ |
| Eos (`eosinophil`) | `granule_lance` | Parasite Strike (`parasite_strike`) | `strike` | `#e05570` | HUD glyph + archetype/equity accent ✅ |
| Baso (`basophil`) | `vesicle_cloud` | Histamine (`histamine`) | `area` | `#8e44ad` | HUD glyph + archetype/equity accent ✅ |
| Baso (`basophil`) | `vesicle_cloud` | Allergy (`allergy`) | `area` | `#6c3483` | HUD glyph + archetype/equity accent ✅ |
| Baso (`basophil`) | `vesicle_cloud` | Chemical Storm (`chemical_storm`) | `area` | `#9b59b6` | HUD glyph + archetype/equity accent ✅ |
| Mastia (`mastcell`) | `granule_tank` | Barrier (`barrier`) | `shield_self` | `#a03328` | HUD glyph + archetype/equity accent ✅ |
| Mastia (`mastcell`) | `granule_tank` | Sting (`sting`) | `strike` | `#8b4513` | HUD glyph + archetype/equity accent ✅ |
| Mastia (`mastcell`) | `granule_tank` | Anaphylaxis (`anaphylaxis`) | `area` | `#c0392b` | HUD glyph + archetype/equity accent ✅ |
| T-Bolt (`tcd8`) | `cytotoxic` | Precision Shot (`precision_shot`) | `strike` | `#00d2ff` | HUD glyph + archetype/equity accent ✅ |
| T-Bolt (`tcd8`) | `cytotoxic` | Lock On (`lock_on`) | `mark` | `#00a8cc` | HUD glyph + archetype/equity accent ✅ |
| T-Bolt (`tcd8`) | `cytotoxic` | Execute (`execute`) | `execute` | `#7fdbff` | HUD glyph + archetype/equity accent ✅ |
| Helia (`tcd4`) | `helper` | Rally (`rally`) | `buff_allies, buff_self` | `#f1c40f` | HUD glyph + archetype/equity accent ✅ |
| Helia (`tcd4`) | `helper` | Command (`command`) | `buff_allies` | `#f39c12` | HUD glyph + archetype/equity accent ✅ |
| Helia (`tcd4`) | `helper` | Battle Cry (`battle_cry`) | `buff_allies, buff_self` | `#ffd93d` | HUD glyph + archetype/equity accent ✅ |
| Treg (`treg`) | `regulator` | Pacify (`pacify`) | `strike` | `#2ecc71` | HUD glyph + archetype/equity accent ✅ |
| Treg (`treg`) | `regulator` | Shield (`shield_ally`) | `shield_self` | `#27ae60` | HUD glyph + archetype/equity accent ✅ |
| Treg (`treg`) | `regulator` | Truce (`truce`) | `protect_self, area` | `#16a085` | HUD glyph + archetype/equity accent ✅ |
| Bella (`bcell`) | `antibody` | Antibody (`antibody_burst`) | `summon_homing` | `#bb8fce` | HUD glyph + archetype/equity accent ✅ |
| Bella (`bcell`) | `antibody` | Empower (`empower`) | `buff_self` | `#d7bde2` | HUD glyph + archetype/equity accent ✅ |
| Bella (`bcell`) | `antibody` | Plasma Rain (`plasma_rain`) | `instant_hits` | `#af7ac5` | HUD glyph + archetype/equity accent ✅ |
| Nyx (`nkcell`) | `nk_spike` | Backstab (`backstab`) | `strike` | `#4a235a` | HUD glyph + archetype/equity accent ✅ |
| Nyx (`nkcell`) | `nk_spike` | Shadowstep (`shadowstep`) | `dash` | `#1c1c1c` | HUD glyph + archetype/equity accent ✅ |
| Nyx (`nkcell`) | `nk_spike` | Annihilate (`annihilate`) | `annihilate` | `#6c3483` | HUD glyph + archetype/equity accent ✅ |

## File implementasi

| File | Peran |
|---|---|
| `data/heroes.json` | Daftar skill tiap hero. |
| `data/skills.json` | Definisi effect kind, color, cooldown/damage existing. |
| `data/character-designs.json` | Archetype hero + warna/cue Equity aktif. |
| `js/ui/screens/hud-screen.js` | Build ability button: glyph, `data-archetype`, `--hero`, `--eq`, tooltip stage. |
| `styles/main.css` | Accent CSS per archetype: antibody Y, dendritic/net grid, phagocyte crescent, cytotoxic/spike ring. |

## Belum dikerjakan dalam skill visual

| Task | Status | Catatan |
|---|---:|---|
| Impact/trail gameplay unik per archetype | ⬜ | Bisa dibuat visual-only di `effects-system`/renderer, tapi perlu QA agar tidak mengubah damage/cooldown. |
| Screenshot skill trigger multi-hero | ⬜ | Butuh browser capture per hero atau QA agent dengan screenshot runner. |
| Copy tooltip bilingual untuk semua skill accent | 🟡 | Tooltip stage sudah ada; EN copy bisa dilengkapi di pass i18n. |
