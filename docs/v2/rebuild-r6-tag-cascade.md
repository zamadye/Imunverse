# REBUILD R6 — Modul D: Tag-Cascade / Opsonisasi (Chain Reaction + Camera)

> Status: ✅ SELESAI (BUILD 37a · e2e-r6 15/15 · regresi 18 suite hijau) · Basis: BUILD 36a (R1–R5 ✅) · Sumber: `docs/design/imunverse-combat-differentiation-design-doc.md` §5 · Induk: `REBUILD-PLAN.md`

## 1. Objective

Meniru opsonisasi: antibodi MENANDAI patogen sebelum dihancurkan berantai oleh
sel imun lain. Setiap hit hero men-tag musuh; musuh ter-tag yang mati memicu
**cascade** — damage menyebar ke musuh sekitar, berantai sampai 4 hop dengan
intensitas meluruh. Momen "satu kill memicu ledakan berantai" adalah puncak
dopamin run — feedback kamera bertingkat (doc §5.3) membuatnya terasa BESAR
tanpa mengganggu keterbacaan di 99% waktu lainnya.

## 2. Scope

- **In**: `tagged` per musuh (set saat hit hero landing — titik sentral
  `spawnHitFeedback`); cascade on death (radius search → damage tetangga);
  hop maks 4, decay 0.6/hop; alur 4 tier (T1 outline lokal → T2 shockwave 2D →
  T3 hit-stop 70 ms + punch-zoom 9% ease-out 280 ms → T4 chain decay);
  punch-zoom sebagai LAYER di `Camera` (tidak mengganti follow — doc §5.4);
  cap cascade bersamaan (throttle §5.5); telemetry; flag `tagCascade`.
- **Out**: perubahan camera-follow/shake yang ada; interaksi lintas-modul;
  tag oleh damage non-hero (musuh/hazard tidak men-tag).

## 3. Design (angka & formula)

Config `data/modules.json → tagCascade`:

| Param | Nilai | Arti |
|---|---|---|
| `radius` | 120 | CASCADE_RADIUS pencarian target saat tagged mati |
| `dmgPct` | 0.5 | dmg cascade hop-0 = damage hero × 0.5 |
| `decay` | 0.6 | peluruhan dmg + intensitas kamera per hop (doc ±0.6) |
| `maxHops` | 4 | kedalaman rantai maks (doc 4–5, anti loop) |
| `tier3Targets` | 3 | ≥3 target dalam radius → efek kamera T3 |
| `hitStopSec` | 0.07 | hit-stop T3 (doc 60–80 ms) |
| `punchZoom` | 0.09 | punch-zoom T3 (doc 8–10%) |
| `punchDurSec` | 0.28 | durasi ease-out punch (doc 250–300 ms) |
| `maxConcurrent` | 3 | cap cascade per window (throttle doc §5.5) |
| `windowSec` | 0.6 | lebar window throttle |

- **Tier 1** — tag: outline oranye tipis di lantai + tanpa kamera.
- **Tier 2** — tagged mati, target < `tier3Targets`: shockwave ring 2D saja.
- **Tier 3** — target ≥ `tier3Targets`: `hitStopRun(0.07·0.6^hop)` +
  `camera.punchZoom(0.09·0.6^hop, 0.28)` + telegraph ring radial.
- **Tier 4** — korban cascade ikut ter-tag (via spawnHitFeedback) → bila mati,
  hop berikutnya `hopIn = hop+1` sampai `maxHops` / tak ada target.
- Damage hop-n = `damage hero × 0.5 × 0.6^n`; kill cascade = kill normal
  (XP/loot penuh — cascade adalah reward, bukan konversi resource ala R4).
- Throttle: > `maxConcurrent` cascade dalam `windowSec` → cascade di-skip
  total (tanpa radius search — inti biaya §5.5), tag musuh tetap.

## 4. Integration Points

- `js/systems/tag-cascade.js` (baru): `tagOnHit`, `cascadeOnDeath`.
- `js/render/camera.js`: layer `punchZoom(amp, dur)` + `punchScale` ease-out
  di `update(dt)`; dipakai `apply`/`makeProjector`/`worldToScreen` sebagai
  pengali zoom — follow & shake TIDAK berubah.
- `js/entities/enemy.js`: field `cascadeTag`, `cascadeHopIn`.
- `js/core/game.js`: `tagOnHit` di `spawnHitFeedback` (semua hit hero lewat
  sini: proyektil, skill, DoT R5); `cascadeOnDeath` di `onEnemyKilled` setelah
  `onAntigenKill` (sebelum blok devoured — telan pun memicu rantai); render
  outline tag di blok ring musuh; init `cascadeTimes: []`.
- Telemetry: `recordModuleTrigger('tagCascade', {wave, hop, targets})` per
  cascade yang benar-benar meledak.

## 5. Feature Flag & Fallback

`modules.json → modules.tagCascade.enabled=true`; override
`localStorage['imunverse.module.tagCascade']`. OFF → tidak ada tag, cascade,
outline, maupun punch-zoom (kamera & combat persis pra-R6).

## 6. Risks

- Loop tak terkendali wave padat (§5.2) → `maxHops` 4 + throttle window.
- Kamera mual bila punch bertumpuk → punch baru MENIMPA (bukan menjumlah)
  bila lebih kuat; decay 0.6 per hop; hanya T3 yang menyentuh kamera.
- Double-cascade dari satu mayat → guard `cascadeDone` per musuh.

## 7. Verification Plan

`scripts/e2e-r6.mjs`: flag on; hit men-tag; tagged mati → tetangga dalam
radius kena (luar radius aman); dmg hop-0 = 50% & decay 0.6 di hop-1; rantai
berhenti di `maxHops`; T2 tanpa kamera vs T3 punch+hit-stop; throttle cap;
punch-zoom meluruh kembali ke 1; telemetry; flag OFF mati total; screenshot;
zero pageerror. Regresi: 18 suite penuh.

## 8. Metrics

`module_trigger` per cascade dgn `hop`+`targets` → Phase 11: rata-rata panjang
rantai, distribusi target/ledakan, korelasi ke hasil run.

## 9. Definition of Done

- [x] Hit hero men-tag musuh (outline T1); tagged mati → cascade radius 120.
- [x] Chain hop maks 4, dmg & kamera meluruh 0.6/hop.
- [x] T3 (≥3 target): hit-stop 70 ms + punch-zoom 9% ease-out 280 ms.
- [x] Throttle maxConcurrent 3/0.6 s; flag OFF = pra-R6 total.
- [x] e2e-r6 hijau + regresi 18 suite hijau + screenshot bukti.
