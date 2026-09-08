# R4 — MODUL B: PHAGOCYTOSIS (Rebuild)
> Status: ✅ SELESAI (BUILD 35a · e2e-r4 15/15 · regresi 16 suite hijau) · Basis: BUILD 34a (R1–R3 ✅) · Sumber: `docs/design/imunverse-combat-differentiation-design-doc.md` §3 · Induk: `REBUILD-PLAN.md`

## 1. Objective
Skill "Telan" jadi execute-mechanic bermakna: musuh sekarat (<20% HP) masuk WINDOW TELAN — dilahap instan → jadi resource (fuel ultimate + heal kecil), bukan drop normal. Timing & target-priority jadi keputusan aktif pemain (prioritas Mako, doc §3.1).

## 2. Problem
`devour` V1 = strike biasa ×4 damage + heal — tidak ada window, tidak ada keputusan waktu, tidak beda dari skill lain. HP musuh rendah tidak berarti apa-apa.

## 3. Design decision
1. **Eligible window per-enemy** (doc §3.2): `enemy.hp <= 20% maxHP` → `phagoEligible=true` + `phagoWindowT=1.8s`; habis → tidak eligible lagi (window HANGUS sekali — kill biasa masih bisa). Boss tidak pernah eligible.
2. **Visual indicator**: ring kuning berdenyut di lantai + outline; dicek dari render loop game.js (pola aura elite Phase 5).
3. **Skill `devour` di-retarget**: bila ada musuh ELIGIBLE dalam radius 160 → TELAN INSTAN (kill tanpa damage; korban tidak drop XP/koin normal — dikonversi resource: heal 8 + fuel meter +25); bila tidak ada → fallback strike lama (skill tetap berguna).
4. **Resource meter → ultimate** (keputusan desain hybrid, doc §3.3): `run.phagoMeter 0..100`; penuh → cooldown ULT (slot 2) langsung 0 (reset meter). Berjalan paralel dengan cooldown timer normal — meter mempercepat, tidak menggantikan.
5. **Semua hero punya mekanik ini** bila modul ON (skill telan = slot mana pun yang berisi `devour`; hanya Mako yang punya devour → de facto Mako-first, hero lain menyusul via data).
6. **Flag**: `modules.phagocytosis.enabled=true` (R4 menyalakannya); OFF → devour perilaku lama, tidak ada window/meter/indikator.
7. **Telemetry**: tiap telan sukses → `recordModuleTrigger('phagocytosis', {wave, meter})`.

## 4. Exact specification
### 4.1 data/modules.json (bagian phagocytosis)
```json
"phagocytosis": { "enabled": true, "hpThreshold": 0.2, "windowSec": 1.8,
  "range": 160, "healOnDevour": 8, "meterPerDevour": 25, "meterMax": 100 }
```
### 4.2 Enemy: `phagoEligible`, `phagoWindowT`, `phagoSpent` (window hangus) — di-update di enemy.update (butuh cfg dari game).
### 4.3 `js/systems/phagocytosis.js`
- `phagoUpdateEnemy(e, dt, cfg)` — window state machine (dipanggil enemy.update via game).
- `tryDevour(game, ctx)` → boolean (dipanggil skill-system saat effect kind `strike` milik devour; refactor: skills.json devour ganti kind jadi `devour` dgn fallback strike).
- `addPhagoMeter(run, amount)` — penuh → reset ULT cd + toast + efek.
- `phagoHudView(run)` — {meter, max} utk HUD.
### 4.4 skills.json: devour effects → `[{kind:'devour', mult:4, heal:30}]` (fallback strike memakai mult+heal lama).
### 4.5 HUD: bar meter kecil di atas tombol ULT (`#phago-meter`), fill per telan.
### 4.6 Render: ring kuning `#ffd93d` + alpha pulse utk musuh eligible (game.js render, sebelum aura elite).

## 5. Priority
P0: window + telan instan + meter→ULT. P1: indikator visual + HUD meter. P2: telemetry.

## 6. Acceptance criteria
1. Musuh non-boss turun <20% HP → `phagoEligible` true + window 1.8s; setelah window habis → hangus (`phagoSpent`, tidak eligible lagi).
2. Boss tidak pernah eligible.
3. `devour` dengan target eligible dalam 160px → musuh MATI INSTAN tanpa `takeDamage`; XP/koin normal TIDAK drop (kill lewat jalur devour); heal +8; meter +25.
4. `devour` tanpa target eligible → fallback strike ×4 + heal 30 (perilaku lama).
5. Meter 100 → cooldown slot ULT jadi 0 + meter reset + toast.
6. Flag OFF → tidak ada window/meter; devour = strike lama.
7. Telemetry `module_trigger` phagocytosis tercatat per telan.
8. HUD meter tampil & bertambah setelah telan.
9. 0 pageerror; regresi 16 suite hijau.

## 7. Before/After
- Before: devour = tombol damage besar; HP musuh rendah tak bermakna.
- After: musuh sekarat berdenyut kuning 1.8 dtk → pemain memutuskan: telan SEKARANG (fuel ult + heal, tanpa loot) atau bunuh biasa (loot normal) — trade-off nyata tiap beberapa detik, khas identitas makrofag.

## 8. Task breakdown
- [x] Doc R4 (file ini)
- [ ] modules.json: phagocytosis ON + cfg
- [ ] enemy.js: field phago + update window
- [ ] js/systems/phagocytosis.js + skill-system kind 'devour'
- [ ] game.js: render ring eligible; onEnemyKilled jalur devour tanpa loot
- [ ] HUD meter + toast ULT SIAP
- [ ] Buster 35a; e2e-r4.mjs; regresi; screenshot; commit+push

## 9. Definition of Done
AC §6 lolos; e2e-r4 hijau; regresi 0 FAIL; bukti visual ring + meter; pushed.
