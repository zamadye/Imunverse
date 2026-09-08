# REBUILD R5 — Modul C: Inflammation Zone (Area Risk/Reward)

> Status: ✅ SELESAI (BUILD 36a · e2e-r5 13/13 · regresi 17 suite hijau) · Basis: BUILD 35a (R1–R4 ✅) · Sumber: `docs/design/imunverse-combat-differentiation-design-doc.md` §4 · Induk: `REBUILD-PLAN.md`

## 1. Objective

Menambah lapisan **positioning & risk management** yang tidak dimiliki modul lain:
serangan area hero menumpuk status "inflamasi" **di lantai** (bukan di musuh).
Zona menyala makin panas seiring dibiarkan (DoT musuh naik), lalu meledak jadi
**cytokine storm** — damage besar ke semua musuh di dalamnya, TAPI juga melukai
hero bila hero masih berdiri di dalam zona saat storm meledak. Pemain diberi
insentif menahan musuh di zona selama mungkin — tapi harus keluar tepat waktu.

Filter V2 "satu run lagi": zona menciptakan momen mikro-keputusan tiap beberapa
detik (kite ke dalam? keluar sekarang?) yang tidak ada di build damage murni.

## 2. Scope

- **In**: struktur `InflammationZone`; spawner dari semua skill ber-efek `area`
  (grenade, histamine, allergy, chemical_storm, anaphylaxis, truce); intensity
  `t^1.2`; DoT musuh per tick; cytokine storm otomatis di threshold + splash
  hero; telegraph warna kuning→merah + pulsa makin cepat (murni canvas, tanpa
  HUD baru — sesuai doc §4.3); cap zona aktif; telemetry `module_trigger`;
  feature flag `inflammationZone`.
- **Out**: perubahan kamera (doc: tidak perlu); zona dari auto-attack; interaksi
  lintas-modul (dievaluasi Phase 11); spatial grid (cap 3 zona → brute-force
  radius check masih O(zona×musuh) kecil).

## 3. Design (angka & formula)

Config `data/modules.json → inflammationZone` (top-level, pola R3/R4):

| Param | Nilai | Arti |
|---|---|---|
| `baseRate` | 2.0 | laju dasar intensity |
| `intensityExp` | 1.2 | eksponen waktu (doc §4.2: `baseRate·t^1.2`) |
| `maxIntensity` | 10 | plafon intensity |
| `stormThreshold` | 8 | intensity pemicu storm → t ≈ (8/2)^(1/1.2) ≈ **3.2 s** |
| `dotTickSec` | 0.5 | interval DoT musuh |
| `dotDmgPct` | 0.08 | dmg tick = damage hero × 0.08 × intensity |
| `stormMult` | 2.5 | dmg storm = damage hero × 2.5 |
| `heroSplashDamage` | 12 | splash ke hero bila di dalam saat storm |
| `radius` | 90 | radius default (pakai radius skill bila ada) |
| `maxZones` | 3 | cap zona aktif; tertua dibuang (mitigasi §4.4) |

- `heat = intensity/stormThreshold` (0→1) mengendalikan warna `#ffd93d→#ff5d73`,
  opacity, tebal rim, dan frekuensi pulsa — sinyal "keluar sekarang!" tanpa UI.
- Storm: blast merah + label "CYTOKINE STORM!" + shake 0.5; zona lenyap setelah
  storm (siklus selesai). Hero splash lewat `damagePlayer` (hormati shield/
  evade/i-frames — konsisten semua sumber damage lain).
- DoT tetap ke musuh saja; hero HANYA terluka saat storm (sesuai doc §4.1/4.3).

## 4. Integration Points

- `js/systems/inflammation.js` (baru): `spawnInflamZone`, `inflamUpdate`,
  `inflamIntensity`, `inflamHeat`, `inflamColor`.
- `js/core/game.js`: init `inflamZones: []`; `inflamUpdate(this, dt)` setelah
  blok hazards; render zona di LAPISAN TANAH (pola `ground()` genangan toksin).
- `js/systems/skill-system.js` `case 'area'`: setelah damage normal, spawn zona
  bila flag hidup + label "INFLAMASI!".
- Telemetry: `recordModuleTrigger('inflammationZone', {wave, enemiesHit})` per
  storm (bukan per spawn — sinyal evaluasi = storm yang benar-benar terjadi).

## 5. Feature Flag & Fallback

`modules.json → modules.inflammationZone.enabled=true`; override dev
`localStorage['imunverse.module.inflammationZone']='0'/'1'`. Flag OFF → skill
area berperilaku persis seperti sebelum R5 (tidak ada zona, update, render).

## 6. Risks

- Performa overlap check (doc §4.4) → cap 3 zona + tick 0.5 s, bukan per frame.
- Hero splash terasa "tidak adil" → telegraph 2 tahap (warna+pulsa) ~3.2 s,
  damage 12 (~sekali gigitan musuh), lewat i-frames.
- Spam zona dari skill CD pendek → cap maxZones membuang tertua.

## 7. Verification Plan

`scripts/e2e-r5.mjs`: flag on; spawn zona dari skill area; formula `t^1.2`;
telegraph kuning→merah; DoT musuh dalam radius (bukan luar); storm di threshold
(dmg musuh + zona lenyap); splash hero saat di dalam vs aman di luar; cap
maxZones; telemetry; flag OFF mati total; zero pageerror; screenshot bukti.
Regresi: 17 suite penuh.

## 8. Metrics

`module_trigger` per storm dgn `wave` + `enemiesHit` → evaluasi Phase 11:
frekuensi storm/run, rata-rata musuh terkena, korelasi ke hasil run.

## 9. Definition of Done

- [x] Zona muncul dari skill area, intensity `t^1.2`, DoT musuh berjalan.
- [x] Storm otomatis di threshold: dmg musuh + splash hero bila di dalam.
- [x] Telegraph kuning→merah di canvas, tanpa HUD baru.
- [x] Flag OFF = perilaku lama total; telemetry tercatat per storm.
- [x] e2e-r5 hijau + regresi 17 suite hijau + screenshot bukti.
