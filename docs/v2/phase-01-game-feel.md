# PHASE 1 — GAME FEEL

> Status: ✅ SELESAI & terverifikasi e2e (BUILD 27a, suite `scripts/e2e-v2phase1.mjs`) · Induk: `BLUEPRINT-MASTER.md`
> Semua angka phase ini hidup di **`data/gamefeel.json`** (file baru) — tanpa angka keras di logic.

## 1. Objective

Membuat setiap kontak (hit, kill, pickup, skill, boss) terasa **secara fisik** dalam 30 detik pertama run — tanpa menurunkan readability dan tanpa melewati budget performa (≤8 ms/frame @130 musuh).

## 2. Problem (bukti dari kode V1)

| Gap | Bukti |
|---|---|
| Hit biasa tidak "berbobot" — musuh tidak bereaksi fisik | `enemy.takeDamage()` hanya set `hitFlash`; knockback hanya dari skill siklon (`e.vx/vy` ada tapi tak dipakai hit normal) |
| Kill tidak punya "berat" | `hitStopRun` hanya untuk boss (70ms)/elite (35ms)/skill/level-up — kill biasa 0ms |
| Tidak ada varian **critical** | `spawnDamageNumber` 1 warna putih (emas hanya saat mati); tidak ada mekanik crit sama sekali |
| Hit musuh → player kurang dramatis saat nyaris mati | shake flat 0.22/0.6; tidak ada low-HP heartbeat |
| Tidak ada haptic mobile | `navigator.vibrate` tidak pernah dipanggil (target = anak main di HP) |
| Damage number monoton | ukuran tetap 13px; damage 5 dan damage 150 terlihat sama besar |
| Musuh mati "hilang" | burst partikel + killFx, tapi **sprite langsung lenyap** (difilter frame itu juga) — tidak ada corpse pop/scale-out |

## 3. Design Decision

1. **Rantai feedback distandardisasi** (spek §4) dan dibaca dari `data/gamefeel.json` — tuning tanpa edit kode.
2. **Knockback mikro pada setiap hit** memakai infrastruktur `e.vx/vy` yang SUDAH ada (decay friksi 6/s sudah jalan di `enemy.update`) → biaya implementasi kecil, dampak rasa besar. Boss imun terhadap knockback.
3. **Hit-stop berlapis**: kill biasa 30ms, elite 50ms, boss 90ms (naik dari 70), ultimate cast 60ms. Alasan: hit-stop adalah sinyal "berat" paling murah (0 partikel).
4. **Critical hit diperkenalkan di Phase 1 sebagai persen global kecil (8%, ×1.5)** — HANYA untuk memberi variasi feedback (angka oranye besar + spark besar + hit-stop 25ms). Integrasi strategis (crit per hero/build) menyusul Phase 3/4. Alternatif ditolak: menunda crit ke Phase 4 — rantai feedback butuh varian *sekarang* agar tidak monoton.
5. **Death pop**: saat mati, musuh spawn "corpse pop" — sprite yang membesar 1→1.3 lalu memudar 150ms (efek baru `killpop` di effects-system, digambar via drawSprite). Murah (1 draw call) dan menghilangkan rasa "lenyap".
6. **Damage number scaling**: ukuran = `13 + clamp(damage/8, 0, 9)` px; crit ×1.35 warna `#ff9f43`.
7. **Haptic**: `navigator.vibrate` dengan guard + throttle 90ms; pola dari data (`kill:12ms`, `playerHit:[30,40,30]`, `boss:[60,50,60]`, `levelup:[20,30,20]`). No-op senyap di desktop/iOS.
8. **Low-HP state**: HP <30% → heartbeat SFX interval 1.2s + vignette pulse (CSS class `low` HUD sudah ada; ditambah audio).
9. **TIDAK diubah** (sudah baik di V1): trail proyektil, pulse glow, XP ghost trail, squash-stretch player, telegraph boss, SFX prosedural, camera smoothing `1−exp(−8dt)`.

## 4. Exact Specification

> Sumber tunggal angka: `data/gamefeel.json`. Cap performa dipertahankan: 400 particles / 80 effects / 40 numbers.

### 4.1 Rantai — SERANGAN PLAYER → MUSUH (normal)

```
CONTACT (proyektil pierce/homing ATAU melee swipe)
 ├─ t=0     enemy.hitFlash = 0.12s                        [V1 keep]
 ├─ t=0     KNOCKBACK: e.vx/vy += arah_hit × kb.force     [BARU]
 │            force = 120 px/s (melee 150) · boss = 0 · decay friksi 6/s (existing)
 ├─ t=0     damage number: size 13+clamp(dmg/8,0,9)px,    [UPGRADE]
 │            putih; life 0.65s (existing pop)
 ├─ t=0     hit spark 34px 160ms (existing)               [V1 keep]
 ├─ t=0     SFX hit (throttle 50ms)                       [V1 keep]
 └─ crit (8%): dmg×1.5 → number #ff9f43 ×1.35, spark big, [BARU]
              hit-stop 25ms, haptic 8ms
```

### 4.2 Rantai — KILL

```
KILL
 ├─ t=0     hit-stop: 30ms biasa · 50ms elite · 90ms boss [BARU/UPGRADE]
 ├─ t=0     DEATH POP: sprite musuh scale 1→1.3 fade-out  [BARU]
 │            150ms (efek 'killpop', 1 draw call)
 ├─ t=0     burst 22 partikel (boss 34) warna musuh       [V1 keep]
 ├─ t=0     killFx tier evolusi (ring/slash/…)            [V1 keep]
 ├─ t=0     micro shake 0.06 · elite 0.18 · boss 0.65     [BARU: kill biasa]
 ├─ t=0     SFX kill + combo (existing)                   [V1 keep]
 ├─ t=0     haptic 12ms (elite 25ms, boss [60,50,60])     [BARU]
 └─ t≈0     XP orb + coin drop tersebar (existing)        [V1 keep]
```

### 4.3 Rantai — MUSUH → PLAYER

```
PLAYER HIT
 ├─ shield/evade/pelindung → label "TERSERAP!"/"Evade!"   [V1 keep]
 ├─ t=0     iframes 0.7s + blink render (existing)
 ├─ t=0     burst merah 6 (existing) + squash 0.28
 ├─ t=0     shake 0.22 (dmg<15) / 0.6 (≥15)               [V1 keep]
 ├─ t=0     haptic [30,40,30]                              [BARU]
 └─ HP<30%: heartbeat SFX tiap 1.2s + pill .low (existing CSS) [BARU audio]
```

### 4.4 Skill / Ultimate / Level-up / Pickup

```
SKILL CAST   : squash 0.16 + shake 0.2 + hit-stop 50ms + banner (V1 keep)
ULTIMATE CAST: hit-stop 60ms + shake 0.35 + haptic [20,30,20]        [UPGRADE]
LEVEL-UP     : hit-stop 300ms + burst emas 56 + announce (V1 keep)
               + haptic [20,30,20]                                    [BARU]
XP PICKUP    : collect burst 4 + SFX + ghost trail bar (V1 keep — sudah baik)
BOSS SPAWN   : shake 0.7 + announce (V1 keep) + haptic [60,50,60]     [BARU]
```

### 4.5 `data/gamefeel.json` (kontrak)

```json
{
  "knockback": { "projectile": 120, "melee": 150, "bossImmune": true },
  "hitStop":   { "kill": 0.03, "elite": 0.05, "boss": 0.09, "crit": 0.025, "ult": 0.06 },
  "crit":      { "chance": 0.08, "mult": 1.5, "color": "#ff9f43", "sizeMult": 1.35 },
  "damageNumber": { "base": 13, "perDamage": 0.125, "maxBonus": 9 },
  "killPop":   { "dur": 0.15, "scaleTo": 1.3 },
  "shake":     { "kill": 0.06, "elite": 0.18, "boss": 0.65, "ultCast": 0.35 },
  "haptic":    { "enabled": true, "throttleMs": 90,
                 "kill": 12, "elite": 25, "crit": 8,
                 "playerHit": [30,40,30], "boss": [60,50,60], "levelup": [20,30,20] },
  "lowHp":     { "threshold": 0.3, "heartbeatSec": 1.2 }
}
```

## 5. Priority

| Item | P | Hukum V2 |
|---|---|---|
| Knockback mikro | P0 | Hit terasa fisik = kesan 10 detik pertama |
| Hit-stop kill berlapis | P0 | "Berat" tiap kill → kill berikutnya diinginkan |
| Death pop | P0 | Kill = momen paling sering; tak boleh "lenyap" |
| Crit feedback | P1 | Variasi mencegah monoton di run panjang |
| Damage number scaling | P1 | Readability progres damage antar build |
| Haptic | P1 | Target utama = anak di HP; rasa di tangan |
| Low-HP heartbeat | P2 | Tensi = cerita untuk diceritakan ulang |

## 6. Acceptance Criteria

- [x] Musuh terdorong saat kena proyektil (posisi berubah melawan arah datang; boss tidak).
- [x] Kill biasa menghasilkan `run.hitStop > 0` frame itu.
- [x] Efek `killpop` muncul di `run.effects.effects` saat kill.
- [x] Crit terjadi (dengan chance dinaikkan via override uji) → number oranye & lebih besar.
- [x] Damage besar → font number lebih besar dari damage kecil.
- [x] `gamefeel.json` termuat di data-store; nilai terbaca dari data (bukan konstanta).
- [x] Haptic dipanggil dengan guard (tanpa error di headless tanpa `vibrate`).
- [x] 0 pageerror; FPS tidak turun (cap efek dipertahankan); suite regresi kunci hijau.

## 7. Before / After

| Momen | V1 | V2 |
|---|---|---|
| Hit biasa | flash + angka + spark | + knockback 120px/s, angka berskala |
| Kill biasa | burst + killFx, sprite lenyap | + hit-stop 30ms + death pop 150ms + shake 0.06 + haptic |
| Kill elite | hit-stop 35ms | 50ms + shake 0.18 + haptic 25ms |
| Kill boss | hit-stop 70ms, shake 0.65 | 90ms + haptic pattern |
| Crit | tidak ada | 8% ×1.5, angka oranye ×1.35, stop 25ms |
| Player hit | burst+shake+squash | + haptic; HP<30% heartbeat |

## 8. Task Breakdown

1. ✅ `data/gamefeel.json` + registrasi di `data-store.js` (+getter `getGameFeel()`).
2. ✅ `js/systems/haptics.js` (baru, ~40 baris): `buzz(pattern)` guarded + throttle.
3. ✅ `game.js`: knockback di 2 titik hit (projectile handler & melee swipe); crit roll di kedua jalur damage player→musuh; hit-stop kill; killpop + shake + haptic di `onEnemyKilled`; haptic di `damagePlayer`/level-up/boss; heartbeat low-HP.
4. ✅ `effects-system.js`: `spawnKillPop(x,y,sprite,radius,flip)` + update.
5. ✅ `game.js` render: gambar efek `killpop` (drawSprite scale+fade).
6. ✅ `shape-renderer`/number: ukuran & warna dari spawnDamageNumber params (sudah param-based — hanya kirim size/color).
7. ✅ Buster `27a` (version.js + index.html).
8. ✅ Suite baru `scripts/e2e-v2phase1.mjs` (gabung asersi Phase 0 metrics + Phase 1 feel) + regresi.

## 9. Definition of Done

AC §6 semua lolos · suite `e2e-v2phase1.mjs` PASS penuh · regresi ONBOARD & MLBB hijau · buster naik ke `27a` · bukti screenshot `shots/review/v2p1-*.png` · dokumen ini diupdate status ✅.
