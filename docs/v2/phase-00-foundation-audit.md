# PHASE 0 — FOUNDATION AUDIT

> Status: ✅ SELESAI & terverifikasi e2e (BUILD 27a, suite `scripts/e2e-v2phase1.mjs`)
> Induk: `BLUEPRINT-MASTER.md`

## 1. Objective

1. Menetapkan **core pillars** V2 dan matriks **keep / merge / park** untuk semua fitur V1.
2. Memasang **instrumen KPI** (metrics lokal) agar semua keputusan balancing V2 berbasis data, bukan tebakan — mulai merekam SEKARANG supaya baseline terkumpul selama pengembangan.
3. Menetapkan **Definition of Done V2**.

## 2. Problem

- V1 punya 23 screen / 27 sistem / 4 lapis upgrade — banyak fitur yang tidak lolos Hukum V2 ("satu run lagi") tapi menambah beban kognitif & maintenance.
- **Tidak ada satu pun metrik gameplay yang terukur** (one-more-run rate, death point, durasi run) — file save hanya menyimpan agregat (`totalRuns`, `bestWave`), bukan distribusi per-run.
- Redundansi sistem yang terbukti dari audit kode:
  - `ability-system.js` (4 slot evolusi) vs `skill-system.js` (3 skill MLBB) — dua sistem kemampuan paralel; HUD hanya memakai skill-system.
  - `focus-screen` + `arena-screen` + `prep-screen` — tiga layar keputusan pre-run yang tumpang tindih.
  - Upgrade permanen 4 lapis: squad (6 jalur) + hero level + ally level + global upgrade (6 jalur) — pemain tidak bisa menjelaskan bedanya.

## 3. Design Decision

### 3.1 Core Pillars V2 (final)

| # | Pillar | Uraian 1 kalimat |
|---|---|---|
| 1 | **Setiap hit terasa** | Rantai feedback penuh pada semua kontak (Phase 1) |
| 2 | **Jelajah → temukan → bersihkan** | Loop MMORPG F26 dipertajam, bukan diganti |
| 3 | **Build yang bisa dinamai** | Pemain menyebut build-nya sendiri (Phase 4) |
| 4 | **Hero = cara main, bukan angka** | 11 hero dengan loop unik (Phase 3) |
| 5 | **Tubuh adalah dunia** | Organ = bioma dengan ekosistem, edukasi = reward (Phase 7) |

### 3.2 Matriks Keep / Merge / Park (fitur V1)

> **PARK** = dibekukan dari prioritas, TIDAK dihapus dari kode sekarang (penghapusan butuh persetujuan pemilik & dilakukan saat phase terkait).

| Fitur V1 | Keputusan | Alasan (Hukum V2) | Dieksekusi di |
|---|---|---|---|
| Core run loop (wave/sarang/boss/level-up) | ✅ KEEP | Inti "satu run lagi" | — |
| AI sarang F26 (guard/patrol/chase/return) | ✅ KEEP + tuning | Pilar 2 | Phase 2 |
| `skill-system` (3 skill/hero) | ✅ KEEP → diperdalam | Pilar 4 | Phase 3 |
| `ability-system` (4 slot evolusi) | 🔀 MERGE → skill-system | Dua sistem = bingung; satu sistem lebih readable | Phase 3 |
| Evolusi parts 5 tahap | ✅ KEEP → dirombak jadi weapon evolution | Pilar 3 | Phase 4 |
| Upgrade 4 lapis | 🔀 MERGE → 2 lapis (hero + global) | Pemain tak bisa jelaskan 4 lapis = bukan strategic | Phase 6 |
| prep/focus/arena screens | 🔀 MERGE → 1 Battle Prep | ≤2 tap ke run | Phase 8 |
| Body-system (racun/energi/decay harian) | ⏸️ PARK → integrasi Phase 7 | Hampir tak terlihat pemain; nilai edukasi dipindah ke bioma | Phase 7 |
| Battle Pass, rank, quest harian, mutator | ✅ KEEP | Alasan spesifik untuk kembali (D1–D30) | Phase 9 |
| Akun/fraksi/referral/survey simulasi | ⏸️ PARK | Tidak mendorong run berikutnya pada fase ini | Phase 10 |
| Kosmetik/skin/aura | ✅ KEEP | Memorable + monetisasi non-P2W | Phase 10 |
| Bio-Pedia | ✅ KEEP → diperkaya | Pilar 5 | Phase 7 |
| Sinematik + coach + i18n + audio prosedural | ✅ KEEP | Fondasi sehat | — |

### 3.3 Instrumen KPI (DIIMPLEMENTASIKAN SEKARANG)

Modul baru `js/systems/metrics.js` — **lokal, ringan, tanpa server**:
- Merekam ke `localStorage['imunverse.metrics.v1']`, ring buffer **200 run terakhir**.
- Per run: `{t, hero, mode, wave, time, kills, level, victory, quit, retryOf}`.
- **One-more-run**: run yang dimulai ≤120 detik setelah gameover sebelumnya ditandai `retryOf` → rate = tagged ÷ total gameover.
- Sumber data: subscribe event bus (`runstart`, `gameover`) — **nol perubahan pada game.js** (arsitektur ui-bridge V1 dipertahankan).
- API baca: `getMetricsSummary()` → `{runs, oneMoreRunRate, medianWave, medianTime, heroDist}` — dipakai Phase 11 untuk benchmark.

Alternatif ditolak: analytics pihak ketiga (butuh jaringan, privasi anak, over-engineering untuk kebutuhan balancing lokal).

## 4. Exact Specification

Lihat implementasi `js/systems/metrics.js`. Ketentuan:
- Ring buffer cap 200; melebihi → buang tertua.
- `retryOf` = timestamp gameover terakhir bila `now − lastGameoverAt ≤ 120_000 ms`, else `null`.
- Gagal `localStorage` → silent no-op (pola `save-manager.js`).
- Tidak menyentuh save utama (`imunverse.save.v1`).

## 5. Priority

| Item | Prioritas | Hukum V2 |
|---|---|---|
| Instrumen metrics | P0 | Tanpa ini, "satu run lagi" tidak pernah terukur |
| Matriks keep/merge/park | P0 | Mencegah pengembangan fitur yang tidak lolos hukum |
| Core pillars | P0 | Kompas semua phase |

## 6. Acceptance Criteria

- [x] `imunverse.metrics.v1` berisi entri setelah 1 run selesai (diverifikasi e2e).
- [x] Run kedua yang dimulai <120 dtk setelah gameover tercatat `retryOf ≠ null`.
- [x] `getMetricsSummary()` mengembalikan angka valid.
- [x] Tidak ada perubahan perilaku gameplay (metrics pasif).
- [x] 0 pageerror; suite regresi hijau.

## 7. Before / After

| Aspek | V1 | V2 Phase 0 |
|---|---|---|
| Data per-run | Tidak ada (hanya agregat save) | 200 run terakhir, lengkap |
| One-more-run rate | Tidak terukur | Terukur otomatis |
| Keputusan fitur | Intuisi | Matriks + Hukum V2 |

## 8. Task Breakdown

1. ✅ Tulis dokumen ini.
2. ✅ `js/systems/metrics.js` (baru) + init dari `main.js` (1 baris import + 1 panggilan).
3. ✅ e2e: assert entri metrics + retryOf (di `scripts/e2e-v2phase1.mjs`, digabung dengan Phase 1 agar satu boot browser).

## 9. Definition of Done — Phase 0 ✦ dan V2 keseluruhan

**Phase 0 DoD:** AC §6 lolos + suite regresi hijau + buster naik.

**Definition of Done V2 (global):**
1. Semua phase P0–P1 berstatus ✅ dengan DoD masing-masing.
2. KPI global (BLUEPRINT-MASTER §KPI) tercapai pada data metrics ≥ 50 run uji.
3. 7 suite e2e V1 + suite per-phase V2 hijau; `?autotest=1` PASS; 0 pageerror 30 menit bermain.
4. Frame budget ≤ 8 ms @130 musuh dengan seluruh VFX V2 aktif.
5. Setiap fitur yang tersisa di kode punya justifikasi Hukum V2 tertulis di dokumen phase-nya.
