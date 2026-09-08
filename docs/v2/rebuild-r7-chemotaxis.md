# REBUILD R7 — Modul E: Chemotaxis Trail (Active Movement/Positioning)

> Status: ✅ SELESAI (BUILD 38a · e2e-r7 14/14 · regresi 19 suite hijau) · Basis: BUILD 37a (R1–R6 ✅) · Sumber: `docs/design/imunverse-combat-differentiation-design-doc.md` §6 · Induk: `REBUILD-PLAN.md`

## 1. Objective

Meniru kemotaksis: sel imun bergerak mengikuti jejak sinyal kimia. Skill
bertipe gerak/buff-diri meninggalkan "jejak sinyal" di lantai saat hero
bergerak; hero yang MELEWATI jejaknya sendiri mendapat buff kecepatan
sementara — mendorong pola pergerakan DISENGAJA (memutar, menganyam, kembali
ke jalur), bukan sekadar kabur pasif dari musuh. Ini modul positioning murni:
satu-satunya dari kelima modul yang me-reward CARA bergerak, bukan cara
menyerang.

## 2. Scope

- **In**: `TrailSegment {x, y, t, buffType, buffValue}`; emisi per interval
  0.15 s pergerakan aktif + jarak minimum; lifetime 4 s (doc 3–5 s); cleanup
  per frame (doc §6.3 GC manual); overlap check hero↔segmen per frame; buff
  speed saat menyentuh segmen matang; render jejak memudar di lapisan tanah;
  cap segmen (memory); aktivasi via skill `dash`/`buff_self`; telemetry;
  flag `chemotaxisTrail`.
- **Out**: buff sekutu (doc: "nanti kalau ada squad-swap"); buff selain
  speed (varian buffType disiapkan di struktur data, dievaluasi Phase 11);
  spatial grid (cap 60 segmen → linear scan murah).

## 3. Design (angka & formula)

Config `data/modules.json → chemotaxisTrail`:

| Param | Nilai | Arti |
|---|---|---|
| `segmentIntervalSec` | 0.15 | interval emisi saat bergerak (doc §6.2) |
| `minSegDist` | 18 | jarak min dari segmen terakhir (doc §6.3) |
| `lifetimeSec` | 4 | TRAIL_LIFETIME (doc 3–5 s) |
| `segmentRadius` | 26 | radius overlap buff per segmen |
| `speedMult` | 1.18 | buff kecepatan saat di jejak |
| `activeSec` | 6 | lama jendela emisi setelah cast skill |
| `minAgeForBuff` | 0.5 | segmen "matang" — jejak yang BARU jatuh di kaki tidak langsung membuff (harus kembali/memotong jalur) |
| `maxSegments` | 60 | cap array (doc §6.4 anti bengkak) |

- Aktivasi: skill dengan efek `dash` ATAU `buff_self` (shadowstep, adrenaline,
  evade, empower, overcharge, battle_cry, rally) → `chemoActivate` 6 s.
- Buff = pengali `run.chemoSpeedMult` yang dibaca player.update per frame —
  BUKAN lewat `tempBuffs`/recomputePlayerStats (hindari recompute per frame,
  mitigasi beban §6.4). Overlap → 1.18, lepas → 1 (buff hidup HANYA selama
  menyentuh — "buff overlap").
- Render: cakram hijau-cyan memudar seiring umur (alpha ∝ sisa hidup), matang
  ditandai rim; di lapisan tanah bersama zona R5.
- Telemetry per aktivasi + jumlah segmen/detik buff saat jendela berakhir.

## 4. Integration Points

- `js/systems/chemotaxis.js` (baru): `chemoActivate`, `chemoUpdate`,
  `chemoView`.
- `js/systems/skill-system.js` `trigger()`: efek mengandung dash/buff_self →
  `chemoActivate(ctx.game)`.
- `js/entities/player.js`: kecepatan efektif × `game.run.chemoSpeedMult`.
- `js/core/game.js`: init `chemoTrail/chemoActiveT/chemoSpeedMult`;
  `chemoUpdate(this, dt)` di update; render jejak setelah zona inflamasi.
- Telemetry: `recordModuleTrigger('chemotaxisTrail', {wave, segments, buffSec})`
  saat jendela emisi berakhir.

## 5. Feature Flag & Fallback

`modules.json → modules.chemotaxisTrail.enabled=true`; override
`localStorage['imunverse.module.chemotaxisTrail']`. OFF → tanpa jejak, tanpa
buff, `chemoSpeedMult` tetap 1 (movement persis pra-R7).

## 6. Risks

- Doc §6.4: modul terberat (render + overlap/frame + GC array). Mitigasi:
  cap 60 segmen, segmen = cakram statis tanpa partikel, cleanup in-place
  satu pass, buff via pengali langsung tanpa recompute stats.
- Buff permanen tak sengaja (berdiri di jejak yang baru jatuh) →
  `minAgeForBuff` 0.5 s memaksa pemain benar-benar MEMOTONG jalur lama.
- Emisi saat diam → syarat ganda interval + `minSegDist`.

## 7. Verification Plan

`scripts/e2e-r7.mjs`: flag on; skill dash/buff_self mengaktifkan jendela;
bergerak → segmen per interval+jarak (diam → tidak ada); lifetime 4 s +
cleanup; segmen muda TIDAK membuff, matang MEMBUFF (speedMult 1.18) dan lepas
→ 1; cap 60; telemetry; flag OFF mati total; screenshot; zero pageerror.
Regresi: 19 suite penuh.

## 8. Metrics

`module_trigger` per jendela emisi dgn `segments` + `buffSec` → Phase 11:
apakah pemain benar-benar memakai jejak (buffSec > 0) atau fitur diabaikan.

## 9. Definition of Done

- [x] Skill gerak/buff-diri memicu jejak; segmen per 0.15 s + jarak min.
- [x] Lifetime 4 s, cleanup per frame, cap 60 segmen.
- [x] Buff overlap: matang 0.5 s → speed ×1.18 selama menyentuh saja.
- [x] Flag OFF = movement pra-R7 total; telemetry per jendela.
- [x] e2e-r7 hijau + regresi 19 suite hijau + screenshot bukti.
