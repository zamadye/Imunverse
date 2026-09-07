# PHASE 2 — CORE COMBAT

> Status: ✅ SELESAI & terverifikasi e2e (BUILD 28a, suite `scripts/e2e-v2phase2.mjs` 17/17 PASS) · Induk: `BLUEPRINT-MASTER.md`
> Semua angka phase ini hidup di **`data/combat.json`** (file baru) + `data/waves.json`.

## 1. Objective

Loop tempur inti (gerak → bidik → serang → dihindari/diserang balik) terasa **responsif, adil, dan terbaca** — pemain mati karena SALAH BACA, bukan karena tidak diberi tahu. Fondasi ini prasyarat Phase 3 (hero identity) & Phase 5 (enemy/boss).

## 2. Problem (bukti dari kode V1)

| Gap | Bukti |
|---|---|
| **Contact damage instan & tak terbaca** | `collision.checkPlayerCollision` → sentuh = `damagePlayer` langsung; tidak ada windup/telegraph. Pemain merasa "dicurangi" oleh swarm |
| **Sprite attack musuh tidak pernah tampil** | render pakai `e.attackSpriteHint ? spriteAttack : spriteIdle` (game.js), tapi TIDAK ADA kode yang men-set `attackSpriteHint` — aset mati |
| **Targeting membuang damage** | `findNearestEnemy` murni jarak; musuh HP 5% dibiarkan lolos karena ada tank full-HP lebih dekat → kill tertunda → feedback (Phase 1) tertunda |
| **Movement 0→100 instan** | `player.update`: `x += move.x * speed * dt` tanpa accel/decel — terasa robotik, arah patah-patah |
| **Angka pacing hardcode** | `breakTimer = 2.5`, trickle `* 2.2` tertanam di spawn-system.js — melanggar konvensi "angka ke data" |
| Survivability tak terukur | Satu-satunya rem damage masuk = iframes 0.7s; tanpa windup musuh, tak ada jendela reaksi |

## 3. Design Decision

1. **Contact attack bertelegraph** untuk musuh pengejar (`chase_direct`, `chase_weave`, `splitter`):
   sampai jangkauan → **WINDUP 0.35s** (berhenti, sprite attack tampil, shiver) → **STRIKE** bila player masih dalam toleransi → **COOLDOWN 0.9s**. Kontak pasif TIDAK lagi melukai untuk tipe ini.
   - **Pengecualian yang disengaja**: `hazard_drift` (toksin/prion — hazard sentuh, identitasnya memang "jangan disentuh") dan **boss** (punya areaAttack bertelegraph sendiri) tetap contact damage instan.
   - Alternatif ditolak: telegraph via ring merah di tanah — lebih mahal render & menyaingi telegraph boss; sprite-swap + shiver cukup dan menghidupkan aset `spriteAttack` yang sudah ada.
2. **Smart targeting "finisher"**: skor target = jarak × (bias + (1−bias) × rasioHP) — musuh sekarat "terasa lebih dekat" sehingga auto-attack menuntaskan kill. Homing projectile TETAP pakai nearest murni (biar arah proyektil stabil).
3. **Movement accel/decel smoothing**: kecepatan menuju target via lerp eksponensial (accel 9/s, decel 13/s — decel lebih cepat supaya berhenti tetap tajam/responsif). Bukan momentum licin ala es — hanya menghaluskan 100–150ms pertama.
4. **Angka pacing pindah ke data**: `waves.json` + `breakDuration`, `trickleIntervalMult`.
5. **TIDAK diubah** (sudah sehat di V1): kurva band early/mid/late (progression.json), maxAliveEnemies 130, gatekeeper wave 5/10/15, sistem sarang F26 (guard→chase→return), separation, spatial grid.

## 4. Exact Specification

### 4.1 Rantai — MUSUH MENYERANG PLAYER (contact, BARU)

```
musuh (chase_*/splitter) masuk strikeRange = rE + rP + 6px, cooldown siap
 ├─ t=0        WINDUP: berhenti bergerak, attackSpriteHint=true
 │             shiver posisi sin(t×26Hz)×1.6px            [telegraph 0.35s]
 ├─ t=350ms    STRIKE bila dist ≤ strikeRange×1.35:
 │             ├─ lunge vx/vy 220 px/s ke arah player (visual terkam)
 │             └─ damagePlayer(e.damage) → rantai Phase 1 (iframes 0.7s,
 │                shake, haptic [30,40,30], squash)
 ├─ t=350ms    attackSpriteHint=false, cooldown 0.9s
 └─ selama windup player MENJAUH melewati toleransi → strike GAGAL (whiff)
    = dodge dihargai; inilah "readable & fair"
```

### 4.2 Auto-attack targeting (UPGRADE)

```
kandidat  = musuh alive dalam effectiveAttackRange
skor(e)   = dist(e) × (0.55 + 0.45 × hp(e)/maxHP(e))     ← woundedWeight 0.45
target    = skor terkecil  → musuh sekarat diprioritaskan tanpa
            mengabaikan jarak (bias jarak tetap dominan)
homing    : tetap nearest murni (stabilitas arah)
```

### 4.3 Movement feel (UPGRADE)

```
vTarget = arah_input × speed × magnitude   (0 bila tak ada input)
k       = 1 − exp(−a·dt),  a = accel 9 (ada input) / decel 13 (lepas)
v      += (vTarget − v) × k ;  pos += v × dt
→ ~63% kecepatan dalam 0.11s; berhenti dalam 0.08s. Squash/walkPhase tetap.
```

### 4.4 `data/combat.json` (kontrak)

```json
{
  "movement":      { "accel": 9, "decel": 13 },
  "targeting":     { "woundedWeight": 0.45 },
  "contactAttack": { "windup": 0.35, "cooldown": 0.9, "rangeBonus": 6,
                     "strikeTolerance": 1.35, "lunge": 220,
                     "shiverHz": 26, "shiverAmp": 1.6 }
}
```

`data/waves.json` + `"breakDuration": 2.5`, `"trickleIntervalMult": 2.2` (dipakai spawn-system, menggantikan konstanta).

## 5. Priority

| Item | P | Hukum V2 |
|---|---|---|
| Contact attack bertelegraph | P0 | Mati yang ADIL membuat pemain retry, mati "dicurangi" membuat uninstall |
| Smart targeting finisher | P0 | Kill lebih cepat tuntas = feedback Phase 1 lebih sering menyala |
| Movement smoothing | P1 | 100ms pertama tiap input = rasa kendali sepanjang run |
| Pacing ke data | P2 | Tuning Phase 11 tanpa edit kode |

## 6. Acceptance Criteria

- [x] Musuh pengejar yang menempel player TIDAK melukai instan; damage baru masuk setelah windup ≥0.3s.
- [x] Selama windup: `attackSpriteHint === true` teramati (sprite attack akhirnya hidup) dan musuh berhenti.
- [x] Menjauh saat windup → strike whiff (HP tidak berkurang).
- [x] Toksin (`hazard_drift`) & boss TETAP contact damage instan.
- [x] `findAttackTarget` memilih musuh sekarat dibanding musuh full-HP yang sedikit lebih dekat.
- [x] Kecepatan player frame ke-2 < frame ke-30 (ramp-up teramati), berhenti ≤0.15s.
- [x] `combat.json` termuat via data-store; spawn-system tanpa konstanta 2.5/2.2.
- [x] 0 pageerror; suite regresi (7 lama + v2phase1) tetap hijau.

## 7. Before / After

| Momen | V1 | V2 |
|---|---|---|
| Musuh sampai ke player | sentuh = damage instan | berhenti → sprite attack + shiver 0.35s → terkam; bisa dihindari |
| Sprite attack musuh | tidak pernah tampil | tampil setiap windup |
| Musuh HP 5% di pinggir range | diabaikan (ada yang lebih dekat) | dituntaskan (finisher bias) |
| Input gerak | 0→100 instan, patah | ramp 0.11s, berhenti tajam 0.08s |
| Toksin/boss | sentuh = damage | tetap (identitas hazard/boss) |
| Angka pacing | hardcode di JS | `waves.json` / `combat.json` |

## 8. Task Breakdown

1. `data/combat.json` + registrasi data-store (+`getCombat()`); `waves.json` +2 field.
2. `enemy.js`: state mesin windup/strike/cooldown + set `attackSpriteHint`; panggil `game.enemyContactStrike(e)`.
3. `game.js`: `enemyContactStrike()` (guard alive + lunge + damagePlayer); filter step-8 contact damage hanya hazard/boss; shiver render saat windup; `findAttackTarget()`.
4. `collision-system.js`: `findAttackTarget(x,y,range,woundedWeight)`.
5. `player.js`: velocity smoothing + pakai `findAttackTarget` untuk auto-attack & tryFire.
6. `spawn-system.js`: baca `breakDuration`/`trickleIntervalMult` dari data.
7. Buster `28a`; suite `scripts/e2e-v2phase2.mjs`; regresi penuh; screenshot bukti.

## 9. Definition of Done

AC §6 semua lolos · `e2e-v2phase2.mjs` PASS penuh · regresi 8 suite hijau · buster `28a` · bukti `shots/review/v2p2-*.png` · status dokumen ✅.
