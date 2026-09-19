# T-Bolt animation source pack (tcd8 — Avenger Adaptif)

Sumber authoring Rive untuk T-Bolt: **anatomi terpisah + skill set**,
dipotong dari **1 sheet utuh** agar seluruh art sinkron
(gaya, garis, palet, identitas — tidak mungkin belang antar-part).

- `parts/` — 21 PNG RGBA 512×512 transparan (16 sel sheet + 5 cermin L)
- `parts/parts-manifest.json` — sumber kebenaran: konvensi sisi L/R,
  hierarki bones, z-order, placement awal, mesh, skill, input state machine
- `CONTACT-SHEET.png` — review visual + **tanda sisi**:
  biru `R-KANAN` = lapis depan (digambar), kuning `L-KIRI` = lapis
  belakang (cermin), abu `C` = tengah
- Sheet mentah: `tools/.tboltsrc/tbolt_sheet_v1.png` (gitignored)
- Skrip build: `python3 tools/build-tbolt-pack.py`
- Cek: `npm run verify:tbolt-parts`

Referensi identitas: `assets/character-art-src/hero_tcd8_idle.png`,
`hero_tcd8_attack.png`, dan `docs/CHARACTER-ART-BRIEF.md` §7.

Isi pack:

| Kelompok | Part |
|---|---|
| Anatomi base (side-view kanan) | head, torso, arm_upper_r/l, arm_fore_r/l, leg_thigh_r/l, leg_shin_r/l, tail, backfin |
| Equity mutasi | visor + scanner (mut1/Sniper), blade_r/l + core (mut2/Piercer), seal (stage4/Apoptosis) |
| Skill FX | fx_bolt (Precision Shot), fx_lockon (Lock On), fx_execute (Execute) |

Status: **pack siap — artboard Rive (`rive.yaml` + `scene.rml`) belum dirakit**
(menunggu perintah eksekusi Rive).
