# PHASE 6 — PROGRESSION

> Status: ✅ SELESAI (BUILD 31a) · Basis: BUILD 30a (Phase 0–5 selesai) · Induk: `BLUEPRINT-MASTER.md`
> Angka phase ini hidup di **`data/mastery.json`** (file baru).

## 1. Objective

Menutup lubang terbesar peta progresi V1: **Hero Mastery** — progres yang tumbuh dari MEMAINKAN hero tertentu (bukan dari membeli), dengan reward & gelar yang membuat pemain ingin "naikkan mastery Enka satu level lagi" → loop one-more-run per hero.

## 2. Problem (bukti dari kode V1)

| Gap | Bukti |
|---|---|
| **Tidak ada progresi per-hero dari bermain** | `meta.heroLevels` = level BELI (antibodi); `meta.stats` global semua (totalKills dsb) — tidak ada satu pun angka yang tumbuh karena kamu *memainkan* Mako |
| **Kills/run per hero tidak dilacak** | `finishRun` menulis `meta.stats.totalKills` global; data per-hero = 0 (juga menghambat KPI Phase 11: win-rate per hero) |
| **11 hero identitas kuat (Phase 3) tanpa alasan ditekuni** | passive membuat hero beda dimainkan, tapi tak ada pengakuan untuk menguasainya |
| Peta progresi lain sudah sehat | run (level-up P4), hero (beli level), meta (squad/rank GP/BP/misi/unlock) — TIDAK disentuh, hanya dilengkapi |

## 3. Design Decision

1. **Mastery XP hanya dari bermain**: `xp = kills×2 + wave×10 + victory×80` (formula di data) — tidak bisa dibeli, selaras premium-cap 30% & filosofi rank tanpa demosi.
2. **10 level per hero** (kurva threshold di data), tiap level = reward Imun Coin; level 3/6/9/10 = **gelar** ("Terlatih" → "Ahli" → "Veteran" → "Legenda") tampil di hero detail.
3. **Modul baru `mastery-system.js`** meniru pola mission-system (klaim otomatis + toast), state `meta.heroMastery[heroId] = {xp, level, kills, runs, wins}` — sekaligus menjadi tracker per-hero untuk KPI Phase 11.
4. **Terlihat di 2 titik emosional**: gameover (+XP mastery & bar progres — hadiah kecil tiap run) dan hero detail (level, gelar, bar, statistik per-hero). Alternatif ditolak: layar mastery terpisah — Phase 8 yang menata arsitektur layar; jangan menambah layar sebelum itu.
5. Migrasi save aman: `heroMastery` dibuat lazily; save lama tanpa field → mulai kosong tanpa error.

## 4. Exact Specification

### 4.1 `data/mastery.json`

```json
{ "xpFormula": { "perKill": 2, "perWave": 10, "victoryBonus": 80 },
  "levels": [100, 250, 480, 800, 1250, 1850, 2600, 3550, 4700, 6100],
  "rewardPerLevel": 15,
  "titles": { "3": "Terlatih", "6": "Ahli", "9": "Veteran", "10": "Legenda" } }
```
`levels[i]` = total XP utk mencapai level i+1 (Lv1 = 100 XP … Lv10 = 6100 XP).

### 4.2 Alur akhir run (finishRun)

```
res = addMasteryXP(meta, heroId, {kills, wave, victory})
 ├─ heroMastery[heroId].xp += formula; kills/runs/wins += run
 ├─ level naik (bisa >1): reward = rewardPerLevel × jumlahLevel (Imun Coin)
 ├─ run.masteryGain = {xp, levelsGained, level, title?}
 └─ toast "MASTERY Lv N — <gelar>!" bila naik
gameover screen: baris "Mastery <hero> +XP (Lv N)" di bawah baris rank
hero detail    : "★ Mastery Lv N — <gelar>" + bar progres + kills/runs per hero
```

## 5. Priority

P0: sistem mastery + hook finishRun + tracking per-hero (juga prasyarat KPI Phase 11) · P1: tampilan gameover & hero detail · P2: gelar.

## 6. Acceptance Criteria

- [x] `mastery.json` termuat via data-store (`getMastery()`).
- [x] Selesai run → `meta.heroMastery[hero].xp` bertambah sesuai formula (kills×2 + wave×10 [+80 menang]).
- [x] Kills/runs per-hero terlacak (naik setelah run).
- [x] XP lintas threshold → level naik + Imun Coin bertambah (rewardPerLevel × level naik) + toast.
- [x] Multi-level sekali run (XP besar) ditangani benar.
- [x] Gelar benar di level 3/6/9/10 (`masteryInfo().title`).
- [x] Baris mastery tampil di gameover & hero detail (DOM).
- [x] Save lama tanpa `heroMastery` → tidak error (lazy init).
- [x] 0 pageerror; 11 suite regresi hijau.

## 7. Before / After

| | V1 | V2 |
|---|---|---|
| Progres per-hero dari bermain | tidak ada | mastery 10 level + gelar + reward |
| Data per-hero (KPI) | nol | kills/runs/wins per hero |
| Akhir run | currency/BP/GP global | + baris mastery hero yang DIPAKAI |
| Alasan menekuni 1 hero | tidak ada | "satu level mastery lagi" |

## 8. Task Breakdown

1. `data/mastery.json` + registrasi data-store + `getMastery()`. 2. `js/systems/mastery-system.js`: `addMasteryXP`, `masteryInfo`. 3. `finishRun` hook + toast. 4. Baris UI gameover + hero detail. 5. Buster `31a`; suite `scripts/e2e-v2phase6.mjs`; regresi.

## 9. Definition of Done

AC §6 lolos · suite PASS · regresi hijau · buster `31a` · bukti screenshot mastery di gameover/hero detail · status ✅.
