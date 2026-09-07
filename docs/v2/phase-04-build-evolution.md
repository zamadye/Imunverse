# PHASE 4 — BUILD & EVOLUTION

> Status: ✅ SELESAI & terverifikasi e2e (BUILD 30a, suite `scripts/e2e-v2phase4.mjs` 20/20 PASS) · Induk: `BLUEPRINT-MASTER.md`
> Angka phase ini hidup di **`data/upgrades.json`** (rarity, luRules, evolutions, entri pool baru).

## 1. Objective

Level-up berubah dari "ambil angka" menjadi **keputusan build**: rarity memberi denyut kejutan, sinergi role punya efek NYATA (bukan badge), evolusi senjata memberi tujuan jangka-menengah dalam run, dan RNG dikontrol supaya tidak ada streak hampa maupun pilihan mati.

## 2. Problem (bukti dari kode V1)

| Gap | Bukti |
|---|---|
| **Pool 7 entri, semua stat linier** | `upgrades.json levelUpPool`: 7 entri, 5 di antaranya maxStacks 99 — pilihan ke-20 terasa sama dengan pilihan ke-2 |
| **Tanpa rarity / bobot** | `rollLevelUpChoices` = Fisher-Yates murni; semua entri setara → tidak ada denyut "wah dapat yang bagus" |
| **Sinergi = badge kosong** | `levelup-screen.js` menampilkan `✦ Sinergi` (synergyFor role), tapi TIDAK ADA jalur kode yang membedakan efeknya — murni kosmetik |
| **Pilihan mati utk melee** | `pierce` (pool baru) & mekanik proyektil bisa tampil untuk `melee_swipe`; V1 belum punya filter pattern |
| **Tidak ada evolusi in-run** | evolution-system.js = meta-progression parts antar-run; DALAM run tidak ada momen "build menyatu jadi senjata baru" |
| **Tanpa pity** | streak 3–4 roll biasa-biasa saja mungkin terjadi tanpa kompensasi |

## 3. Design Decision

1. **Rarity 3 tingkat** (common 70 / rare 24 / epic 6 — bobot di `luRules.rarityWeights`), sampling tanpa penggantian. Rare/epic = entri dengan efek berbeda kualitas (pierce, crit, multi-proyektil), bukan versi angka-lebih-besar dari common — supaya rarity terasa beda JENIS.
2. **Pity**: `luRules.pityRolls = 2` — dua roll berturut tanpa rare+ → roll berikut dijamin memuat ≥1 rare+. Counter di `run.luPity`.
3. **Sinergi role jadi NYATA**: upgrade yang cocok role (peta `retention.json synergy` yang sudah ada) dihitung dengan stack efektif ×1.25 (`luRules.synergyBonus`) di `computePlayerStats`. Badge UI yang sudah ada akhirnya jujur.
4. **Evolusi senjata in-run**: 3 resep `evolutions[]` — bila syarat stack terpenuhi, kartu EVO (epic, sekali ambil) DIJAMIN muncul di slot pertama pilihan berikutnya:
   - **Badai Sitokin** (damage≥4 + attackSpeed≥3): damage ×1.3, cooldown ×0.85 → archetype *DPS storm*
   - **Benteng Membran** (maxHP≥4): HP ×1.35, damage ×1.1 → archetype *tank fortress*
   - **Kawanan Reseptor** (projectileCount≥3): +2 proyektil (menembus cap) → archetype *swarm*
5. **Dead-choice prevention**: field `patterns` per entri — `pierce` hanya utk hero ranged; filter maxStacks V1 dipertahankan; kartu evo yang sudah diambil tidak muncul lagi.
6. **Pool +3 entri baru** yang menyambung sistem V2: `pierce` (rare, Phase 2 targeting), `critChance` +4%/stack (rare, Phase 1 crit), `magnet` +25% radius (common, QoL). Alternatif ditolak: menambah 15 entri sekaligus — melanggar prinsip readable; kualitas keputusan > jumlah entri.

## 4. Exact Specification

### 4.1 Alur roll (menggantikan Fisher-Yates murni)

```
available = pool yang (stack < maxStacks) DAN (patterns cocok attackPattern hero)
pilih 3 via weighted sampling tanpa penggantian (bobot rarityWeights[rarity])
PITY : run.luPity ≥ 2 dan hasil tanpa rare+ → slot terakhir diganti rare+ tersedia
       hasil memuat rare+ → luPity = 0, selain itu luPity += 1
EVO  : resep terpenuhi & belum diambil → slot 0 DIGANTI kartu evolusi (dijamin terlihat)
```

### 4.2 `luRules` & entri baru (`data/upgrades.json`)

```json
"luRules": { "rarityWeights": {"common": 70, "rare": 24, "epic": 6},
             "pityRolls": 2, "synergyBonus": 0.25 },
pool +: pierce   {rare,  max 3, +1 tembus, patterns: [ranged_pierce, ranged_homing]}
        critChance {rare, max 5, +4% crit}
        magnet   {common, max 4, +25% radius magnet}
rarity existing: projectileCount → epic · lifeSteal → rare · sisanya common
```

### 4.3 Efek runtime

```
computePlayerStats:
  effStack(id) = stacks × (role sinergi? 1.25 : 1)   ← damage/attackSpeed/moveSpeed/maxHP/attackRange
  pierce       = base.pierce + stacks(pierce)
  magnetRadius = base × (1 + stacks(magnet) × 0.25)
  evo boost    : damageMult × cooldownMult × maxHPMult × projectileFlat (dari data)
rollCrit: chance = gamefeel.crit.chance + passiveBonus(bcell) + stacks(critChance) × 0.04
UI kartu: kelas .rar-rare/.rar-epic/.evo-card + label rarity
```

## 5. Priority

P0: rarity + pity + sinergi nyata (mengubah rasa SETIAP level-up) · P0: evolusi in-run (tujuan jangka menengah run — inti "one more run") · P1: entri pool baru + filter pattern · P1: visual kartu.

## 6. Acceptance Criteria

- [x] Pool memuat rarity di semua entri + 3 entri baru; `luRules` & `evolutions` termuat.
- [x] Hero melee TIDAK pernah ditawari `pierce` (30 roll berturut).
- [x] `run.luPity ≥ pityRolls` → roll berikut memuat ≥1 rare/epic.
- [x] Syarat evo terpenuhi → kartu evo muncul di slot 0; setelah diambil tidak muncul lagi.
- [x] Stats dengan evo_storm > tanpa (≈×1.3 damage) — terverifikasi lewat computePlayerStats.
- [x] Sinergi nyata: damage Tank dengan 4 stack `damage` > hero non-sinergi dengan stack sama.
- [x] `critChance` menaikkan chance efektif (runCritBonus = stacks × 0.04).
- [x] Kartu level-up menampilkan kelas rarity di DOM; 0 pageerror; regresi hijau.

## 7. Before / After

| | V1 | V2 |
|---|---|---|
| Roll level-up | acak seragam 7 entri | 10 entri berbobot rarity + pity |
| Sinergi | badge kosmetik | stack efektif ×1.25 (badge jadi jujur) |
| Build | stat soup | 3 archetype evo: storm / fortress / swarm |
| Melee ditawari pierce | mungkin | tidak pernah (filter patterns) |
| Streak roll hampa | tak terkontrol | maksimal 2 roll (pity) |

## 8. Task Breakdown

1. `upgrades.json`: rarity semua entri + 3 entri baru + `luRules` + `evolutions`. 2. `upgrade-system.js`: roll berbobot + pity + filter patterns + injeksi evo; `applyLevelUp` kenal evo; helper `runCritBonus`. 3. `game.js`: `computePlayerStats` (effStack sinergi, pierce, magnet, evo boost), `rollCrit` + bonus, `run.luPity` init. 4. `levelup-screen.js` + CSS kartu rarity/evo. 5. Buster `30a`; suite `scripts/e2e-v2phase4.mjs`; regresi.

## 9. Definition of Done

AC §6 lolos · suite PASS · regresi hijau · buster `30a` · bukti screenshot kartu rarity/evo · status ✅.
