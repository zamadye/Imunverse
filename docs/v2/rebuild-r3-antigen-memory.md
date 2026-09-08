# R3 — MODUL A: ANTIGEN MEMORY (Rebuild)
> Status: ✅ SELESAI (BUILD 34a, e2e-r3 18/18, regresi 15 suite 0 FAIL) · Basis: BUILD 33a (R1–R2 ✅) · Sumber: `docs/design/imunverse-combat-differentiation-design-doc.md` §2, §7 · Induk: `REBUILD-PLAN.md`
> Paket ini juga membangun **framework modul** (feature flag + instrumentasi) yang dipakai R4–R7.

## 1. Objective
Build adaptif per-run: membunuh tipe patogen tertentu berulang → bonus stacking melawan tipe itu (meniru sel B menyimpan memori antigen). Diferensiasi sistemik pertama dari 5 modul — build merespons komposisi musuh run ini, bukan sekadar 3 pilihan acak.

## 2. Problem
Imunverse = "auto-attack + pilih upgrade acak" — struktur identik clone generik (combat doc §1.1). Tidak ada sistem yang membuat pemain peduli SIAPA yang mereka bunuh.

## 3. Design decision
1. **Framework dulu**: `data/modules.json` — flag per modul (A–E), dibaca `module-flags.js`. Default ON (dev & prod) sampai fase evaluasi; bisa dimatikan per modul tanpa deploy kode (doc §8: jangan hardcode pemenang).
2. **Instrumentasi** (doc §7): metrics.js ditambah ring-buffer event modul — `module_trigger {moduleId, wave, tier}` + agregat per run (`modulesTriggered`) ikut tersimpan di ringkasan run. `module_perf_sample` disederhanakan: frameTime sudah dipantau; per-modul dicatat activeInstanceCount saat trigger.
3. **Kill-count per tipe** pakai `enemy.def.id` (13 tipe di enemies.json). Boss & elite ikut dihitung ke tipe dasarnya.
4. **Threshold**: `killsRequired(tier) = round(15 × tier^1.3)` → T1=15, T2=37, T3=63 (doc §2.2). Maks tier 3.
5. **Efek per tier** (kumulatif, doc §2.2):
   - T1: +15% damage ke tipe itu
   - T2: +30% damage + 10% chance ignore-armor (di sini: bypass pengurangan apapun → pakai `takeDamageRaw`)
   - T3: +50% damage + splash kecil saat membunuh tipe itu (radius 70, dmg 35% dari pukulan pembunuh)
6. **Integrasi damage 1 titik**: multiplier di `modifyOutgoingDamage`-style hook baru `antigenDamageMult(run, enemy)` dipanggil di kedua jalur damage (proyektil :645 & melee :931) — konsisten dengan pola mark Phase 3.
7. **Upgrade "Memori Antigen"** (doc §2.3): kartu rare `antigen_boost` muncul di pool HANYA bila ada tipe dengan progress ≥70% ke tier berikutnya (earned, bukan random murni); efek: langsung +1 tier tipe terdekat-threshold.
8. **HUD**: chip kecil kiri-bawah menampilkan tipe paling dekat tier berikutnya (ikon + progress); update saat kill. Tier-up → toast + label dunia.
9. **Encounter record** (doc §2.3): `meta.antigenRecords[typeId] = maxTier` disimpan saat gameover → tampil di codex entry musuh (baris "Memori Antigen: Tier N") — collection layer jangka panjang.

## 4. Exact specification
### 4.1 data/modules.json
```json
{ "modules": { "antigenMemory": {"enabled": true}, "phagocytosis": {"enabled": false},
  "inflammationZone": {"enabled": false}, "tagCascade": {"enabled": false},
  "chemotaxisTrail": {"enabled": false} },
  "antigenMemory": { "baseKills": 15, "tierExp": 1.3, "maxTier": 3,
    "tierDamage": [0.15, 0.30, 0.50], "ignoreArmorChance": 0.10,
    "splash": {"radius": 70, "dmgPct": 0.35},
    "upgradeHintPct": 0.7 } }
```
### 4.2 State per-run
`run.antigen = { kills: {typeId: n}, tiers: {typeId: 0..3} }` — reset tiap startRun.
### 4.3 API `js/systems/antigen-memory.js`
- `initAntigenRun(run)`, `onAntigenKill(run, enemy, game)` (increment + cek tier-up + splash T3 + telemetry + HUD refresh), `antigenDamageMult(run, enemy)`, `antigenIgnoreArmor(run, enemy)`, `nearestThresholdType(run)` (untuk HUD + syarat upgrade), `recordAntigenMeta(meta, run)`.
### 4.4 Telemetry (metrics.js)
`recordModuleTrigger(moduleId, payload)` → buffer `moduleEvents` (cap 500); ringkasan run mendapat `modules: {antigenMemory: nTrigger}`.

## 5. Priority
P0: framework flag + sistem inti + damage mult + tier-up. P1: HUD chip + upgrade antigen_boost + records meta/codex. P2: telemetry lengkap.

## 6. Acceptance criteria
1. modules.json termuat; `antigenMemory.enabled=false` → sistem mati total (0 efek, 0 UI).
2. Kill ke-15 tipe X → tier 1; damage ke X naik ×1.15 (terukur); tipe Y tetap ×1.0.
3. T2 (37 kill): mult ×1.30 + ignore-armor ~10% (statistik 200 sampel: 5–15%).
4. T3 (63 kill): mult ×1.50 + splash membunuh musuh sekitar (radius 70).
5. Kartu `antigen_boost` TIDAK muncul di roll saat progress <70%; MUNCUL (dan bisa dipilih → tier naik) saat ≥70%.
6. HUD chip menampilkan tipe terdekat threshold; berubah setelah kill.
7. Tier-up → toast + `module_trigger` tercatat di metrics (localStorage).
8. Gameover → `meta.antigenRecords` menyimpan maxTier; codex musuh menampilkan baris memori.
9. Save lama tanpa `antigenRecords` aman (lazy).
10. 0 pageerror; regresi 15 suite hijau.

## 7. Before/After
- Before: bunuh 100 bakteri = bunuh 100 apa pun — tidak ada bedanya.
- After: bunuh bakteri terus → "MEMORI ANTIGEN: Bakteri Tier 2!" → damage ke bakteri +30%, kadang menembus pertahanan; pemain mulai MEMILIH target (fokus tipe dominan wave ini) — build adaptif nyata.

## 8. Task breakdown
- [x] Doc R3 (file ini)
- [x] data/modules.json + getModules() + js/systems/module-flags.js
- [x] js/systems/antigen-memory.js (inti)
- [x] game.js: init per-run, hook kill, mult di 2 jalur damage, ignore-armor
- [x] upgrades.json + upgrade-system.js: kartu antigen_boost bersyarat
- [x] HUD chip + toast tier-up; metrics recordModuleTrigger
- [x] meta.antigenRecords + codex baris memori
- [x] Buster 34a; e2e-r3.mjs; regresi; screenshot; commit+push

## 9. Definition of Done
AC §6 lolos; e2e-r3 hijau; regresi 0 FAIL; bukti visual HUD + tier-up; pushed.
