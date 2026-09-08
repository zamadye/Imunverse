# 🧬 IMUNVERSE V2 — MASTER BLUEPRINT

> **Dokumen induk pengembangan V2.** Semua dokumen phase merujuk ke sini.
> Basis kode: commit `00c78f0` (F26 — pivot MMORPG "imun mencari virus", BUILD `26a`).
> Status: 🔵 blueprint · 🔄 sedang dikerjakan · ✅ selesai · ⬜ belum mulai
>
> **V2 bukan "V1 + lebih banyak fitur".** V2 = V1 yang dibuat
> **lebih satisfying → lebih readable → lebih strategic → lebih replayable → lebih memorable** — dalam urutan itu.

---

## ⚖️ HUKUM V2 (The One-More-Run Law)

Setiap perubahan — fitur, angka balancing, layar UI, efek visual — wajib melewati satu pertanyaan:

> ### "Apakah ini membuat pemain lebih ingin memainkan SATU RUN LAGI?"

- **YA, langsung** → prioritas P0/P1 (contoh: hit feedback, death explosion, pacing wave, reward akhir run).
- **YA, tidak langsung** → P2 (contoh: mastery hero, koleksi, event — memberi *alasan* run berikutnya).
- **TIDAK** → bukan prioritas V2. Masuk backlog, tidak dikerjakan sebelum P0–P2 phase aktif selesai.

Konsekuensi praktis:
1. Setiap entri spesifikasi di dokumen phase punya kolom **`Hukum V2`** berisi justifikasi 1 kalimat. Tidak bisa mengisi kolom itu = fitur dicoret.
2. **Game Feel adalah PHASE 1, bukan polish akhir.** Alasan: "satu run lagi" diputuskan pemain dalam 30 detik pertama run — dan 30 detik pertama adalah 90% game feel.
3. Fitur V1 yang tidak lolos hukum ini akan **dibuang atau di-merge** di Phase 0 (bukan dipertahankan karena "sudah terlanjur ada").

---

## 🎯 VALUE LADDER V2

Urutan nilai — phase yang lebih rendah TIDAK boleh dikorbankan untuk yang lebih tinggi:

| # | Nilai | Artinya | Phase penanggung jawab |
|---|---|---|---|
| 1 | **Satisfying** | Setiap tap/hit/kill terasa enak secara fisik | Phase 1 |
| 2 | **Readable** | Pemain selalu tahu apa yang terjadi & kenapa dia kena hit | Phase 1, 2, 5 |
| 3 | **Strategic** | Pilihan build/hero/rute punya konsekuensi nyata | Phase 3, 4 |
| 4 | **Replayable** | Run berikutnya menjanjikan sesuatu yang berbeda/lebih | Phase 4, 5, 6 |
| 5 | **Memorable** | Momen boss, evolusi, dunia-tubuh yang diingat & diceritakan | Phase 5, 7 |

Retention (9) dan Monetization (10) adalah **hasil** dari 1–5, bukan sumber nilai sendiri.

---

## 🗺️ INDEKS PHASE

| Phase | Nama | File dokumen | Prioritas | Status |
|---|---|---|---|---|
| 0 | Foundation Audit | `phase-00-foundation-audit.md` | P0 — gerbang semua phase | ✅ (BUILD 27a) |
| 1 | Game Feel | `phase-01-game-feel.md` | P0 | ✅ (BUILD 27a) |
| 2 | Core Combat | `phase-02-core-combat.md` | P0 | ✅ (BUILD 28a) |
| 3 | Hero Identity | `phase-03-hero-identity.md` | P1 | ✅ (BUILD 29a) |
| 4 | Build & Evolution | `phase-04-build-evolution.md` | P1 | ✅ (BUILD 30a) |
| 5 | Enemy & Boss | `phase-05-enemy-boss.md` | P1 | ✅ (BUILD 29a) |
| 6 | Progression | `phase-06-progression.md` | P1 | ✅ (BUILD 31a) |
| 7 | World / Body | `phase-07-world-body.md` | P2 | ⬜ |
| 8 | UI/UX | `phase-08-ui-ux.md` | P1 | ⬜ |
| 9 | Retention | `phase-09-retention.md` | P2 | ⬜ |
| 10 | Monetization | `phase-10-monetization.md` | P2 | ⬜ |
| 11 | QA / Balancing | `phase-11-qa-balancing.md` | P0 — berjalan paralel sejak Phase 1 | ⬜ |

**Urutan pengerjaan:** 0 → 1 → 2 → (3 ∥ 5) → 4 → 6 → 8 → 7 → 9 → 10, dengan 11 sebagai gerbang rilis tiap phase.
Alasan urutan: pondasi rasa (1–2) dulu, lalu identitas & musuh yang memberi rasa itu konteks (3–5), lalu alasan kembali (4, 6), baru pembungkus (7–10).

---

## 📋 TEMPLATE DOKUMEN PER-PHASE (WAJIB)

Setiap `phase-XX-*.md` memakai kerangka yang sama — supaya bisa langsung diterjemahkan tim menjadi task:

```
# PHASE X — <NAMA>

## 1. Objective          → 1–3 kalimat, terukur
## 2. Problem            → apa yang salah di V1, dengan bukti (file:baris / angka / screenshot)
## 3. Design Decision    → keputusan + alasan + alternatif yang DITOLAK dan kenapa
## 4. Exact Specification→ angka presisi: kapan muncul, durasi, intensitas,
                           varian (normal / critical / elite / boss / ultimate),
                           file & data JSON yang disentuh
## 5. Priority           → P0 (wajib) / P1 (kuat) / P2 (bila sempat) per item + kolom Hukum V2
## 6. Acceptance Criteria→ daftar cek yang bisa diuji (manusia ATAU e2e)
## 7. Before / After     → tabel perbandingan perilaku V1 vs V2 (+ screenshot bila UI)
## 8. Task Breakdown     → task atomik ≤ 1 sesi kerja, dengan file target & dependensi
## 9. Definition of Done → semua AC lolos + 7 suite e2e hijau + buster naik + bukti shots/
```

Aturan penulisan spesifikasi (khusus bagian 4):
- **Dilarang** menulis "tambahkan particle". **Wajib** menulis: *trigger → delay → durasi → jumlah/intensitas → warna/aset → decay → varian per konteks → cap performa*.
- Setiap angka baru masuk **data JSON** (`data/*.json`), bukan hardcode — mengikuti arsitektur V1 yang sudah benar (konten baru = data baru).
- Setiap efek punya **anggaran performa** (budget partikel/frame, lihat cap V1: 400 particles / 80 effects / 40 numbers di `effects-system.js`).

### Contoh format spesifikasi rantai feedback (standar Phase 1)

```
PLAYER ATTACK (ranged_pierce, normal hit)
  ↓ t=0ms      Input/auto-attack → attackFlash sprite swap (180ms), squash 0.12
  ↓ t=0ms      Muzzle: 2 partikel warna hero, speed 90, life 0.25s
  ↓ flight     Proyektil: kapsul + trail 10px + pulse glow (existing, dipertahankan)
  ↓ CONTACT
  ↓ t=0ms      Enemy hitFlash putih 120ms (existing 0.12s — dipertahankan)
  ↓ t=0ms      Damage number: putih 13px, pop 0.65s, offset acak ±14px (existing)
  ↓ t=0ms      Hit spark fx_hit.png 34px, 160ms (existing)
  ↓ t=0ms      Knockback mikro: 40px/s ke arah proyektil, decay friksi 6/s   [BARU]
  ↓ t=0ms      SFX hit (throttle 50ms, existing)
  ↓ t=0ms      Hit-stop 0ms normal · 30ms bila kill · 50ms bila kill elite    [BARU]
  ↓ KILL
  ↓ t=0ms      Death explosion: burst 22 partikel (boss 34, existing) + killFx tier
  ↓ t=0ms      Micro shake 0.08 (kill biasa) · 0.22 (elite) · 0.5 (boss)
  ↓ t=+50ms    XP orb drop dengan sebar 60–150 px/s (existing pickup.js)
  ↓ pickup     Collect burst 4 partikel + SFX collect + XP bar ghost trail (existing)

VARIAN — critical: number emas 1.3×, spark big=true, shake +0.05
VARIAN — boss hit: number selalu tampil, shake 0.12/hit, telegraph tidak terpotong
```

---

## 📊 KPI GAMEPLAY V2 (target global — detail per phase di dokumennya)

| KPI | Cara ukur | Baseline V1 | Target V2 |
|---|---|---|---|
| **One-more-run rate** | klik "Main Lagi" ÷ total gameover | belum diukur → diukur di Phase 0 | ≥ 40% |
| Time-to-first-kill | detik dari runstart ke kill pertama | ±4–8 dtk (sarang dekat 230px) | ≤ 5 dtk |
| Durasi run median | `run.time` di gameover | belum diukur | 4–7 menit |
| Death point median | wave saat mati (pemain baru) | belum diukur | wave 6–9 |
| First-session length | waktu sampai tutup tab sesi pertama | belum diukur | ≥ 8 menit |
| Pick-rate upgrade | distribusi pilihan level-up | belum diukur | tidak ada opsi < 15% |
| Hero play-rate | distribusi hero dipakai | Mako dominan (default) | tidak ada hero < 5% |
| Frame budget | ms/frame @130 musuh | 0,27 ms (F2 bench) | ≤ 8 ms dgn semua VFX V2 |
| Boss kill rate wave 5 | boss pertama dikalahkan ÷ dicoba | belum diukur | 60–75% |

> Instrumen pengukuran (event log lokal sederhana) dibangun di **Phase 0** — tanpa data, semua keputusan balancing V2 hanya tebakan.

---

## 🔍 RINGKASAN SCOPE PER PHASE + BASELINE V1

Ringkasan di bawah adalah *seed* untuk masing-masing dokumen phase. Baseline diambil langsung dari kode V1 (sudah diaudit penuh).

### PHASE 0 — Foundation Audit `P0`
**Scope:** audit V1 · buang/merge fitur · core pillars · KPI gameplay · Definition of Done V2.
**Baseline V1 (fakta):** 23 screen, 27 sistem, 11 hero, 13 musuh, 33 skill, 6 bab, 4 arena; ~15.300 baris JS.
**Kandidat audit buang/merge (akan diuji dengan Hukum V2):**
- Dua sistem kemampuan paralel: `ability-system.js` (4 slot evolusi) **vs** `skill-system.js` (3 skill MLBB) — redundan, membingungkan; kandidat merge → satu sistem.
- `body-system.js` (5 sistem tubuh + racun/energi) — meta-layer dalam, tapi hampir tak terlihat pemain; kandidat sederhanakan atau integrasikan ke World/Body (Phase 7).
- `focus-screen` + `arena-screen` + `prep-screen` tumpang tindih fungsi pre-run — kandidat merge ke satu Battle Prep.
- Upgrade 4 lapis (squad + hero level + ally level + global upgrade) — terlalu banyak mata rantai untuk nilai yang sama; kandidat konsolidasi.
- Akun/fraksi/referral/survey simulasi — bukan pendorong "satu run lagi"; kandidat parkir.
**Output wajib:** matriks keep/merge/kill semua fitur V1 + instrumen KPI + core pillars final.

### PHASE 1 — GAME FEEL `P0`
**Scope:** hit feedback · damage numbers · enemy hit reaction · death effects · screen shake · particles · camera behavior · skill impact · boss impact · XP pickup feedback · level-up celebration · audio feedback · haptic mobile.
**Baseline V1 (fakta kode):** hitFlash 0.12s; damage number 0.65s; spark 0.16s; shake trauma decay 1.6/s; hit-stop hanya di skill (0.05s) & level-up (0.3s); knockback hanya dari siklon; partikel kill 22/34; SFX prosedural WebAudio lengkap; **belum ada**: hit-stop pada kill, knockback pada hit biasa, haptic (`navigator.vibrate`), varian critical, anticipation/recovery animasi musuh.
**Prinsip:** seluruh rantai `ATTACK → CONTACT → REACTION → DEATH → REWARD` dispesifikasikan per event dengan timing ms, per varian (normal/crit/elite/boss/ultimate).

### PHASE 2 — CORE COMBAT `P0`
**Scope:** movement feel · auto attack · targeting · enemy AI · spawn pacing · enemy density · damage readability · player survivability · difficulty curve.
**Baseline V1:** gerak linier tanpa akselerasi (`speed×dt` langsung); auto-attack ke musuh terdekat + tombol SERANG manual + aim assist; AI sarang F26 (aggro 190 / leash 430 / patrol 80); spawn `max(0.4, 1.8−wave×0.08)`, wave 25 dtk, boss tiap 5, cap 130 musuh; band kurva early/mid/late; iframes 0.7s.
**Pertanyaan kunci phase:** apakah dual-mode (auto+manual) dipertahankan atau dipertegas salah satu; apakah leash-return terasa "musuh kabur" (anti-klimaks) dan perlu tuning.

### PHASE 3 — HERO IDENTITY `P1`
**Scope:** 11 hero × (role · weapon · passive · 3 active skills · stat identity · strength/weakness · unique gameplay loop).
**Baseline V1:** 11 hero data-driven, 3 attack pattern saja (melee_swipe/ranged_pierce/ranged_homing), 33 skill dari efek primitif; **belum ada passive per hero**; perbedaan antar hero sebagian besar angka, bukan *cara main*.
**Target:** setiap hero punya 1 kalimat identitas yang terasa dalam 10 detik memainkan ("Mako = telan musuh kecil jadi HP", dst.) — loop unik per hero, bukan reskin stat.

### PHASE 4 — BUILD & EVOLUTION `P1`
**Scope:** upgrade pool · rarity · synergy · weapon evolution · build archetypes · RNG control · dead-choice prevention.
**Baseline V1:** pool level-up 7 stat datar (tanpa rarity), badge sinergi ✦ per role; evolusi = 1 jalur global 5 tahap via drop parts (bukan per-senjata); **belum ada**: weapon evolution ala Survivor.io (senjata+item→bentuk baru), rarity roll, pity/reroll/banish, arketipe build.
**Target:** pemain bisa menyebut build-nya dengan nama ("build racun DoT", "build swarm homing") — itulah replayability inti genre.

### PHASE 5 — ENEMY & BOSS `P1`
**Scope:** enemy taxonomy · elite enemies · wave composition · boss mechanics · boss telegraph · boss rewards.
**Baseline V1:** 13 musuh / 5 behavior; armor layers, stealth, splitter, prion-convert sudah ada; elite = "Virion & Parasit drop 5×" (implisit, tanpa visual elite); boss 2 jenis dengan 1 pola (AOE telegraph); peti boss + gerbang wave.
**Target:** komposisi wave dirancang (bukan weighted random murni), elite dengan aura/affix terlihat, boss multi-fase dengan 2–3 mekanik yang bisa dipelajari.

### PHASE 6 — PROGRESSION `P1`
**Scope:** run progression · hero progression · meta progression · unlocks · mastery · missions · achievements.
**Baseline V1:** XP `10×lvl^1.5`; 4 lapis upgrade permanen; unlock hero via misi/IMU; feature gates by bestWave; misi + quest harian/mingguan manual-claim; **belum ada**: hero mastery (progres per-hero dari memainkan hero itu).
**Target:** satu benang merah progresi yang bisa dijelaskan dalam 2 kalimat; sisa lapisan dibuang (hasil Phase 0).

### PHASE 7 — WORLD / BODY `P2`
**Scope:** body map · organ stages · biomes · environmental identity · enemy ecosystem · boss ecosystem · Bio-Pedia.
**Baseline V1:** 6 bab kampanye, 4 arena dengan palet+bonus, Bio-Pedia unlock-by-encounter (2 kedalaman konten), body-system meta.
**Target:** tiap organ = bioma dengan musuh/hazard/boss khas (ekosistem), bukan ganti warna; edukasi tetap "efek samping yang terasa reward" (prinsip `docs/edu-workflow.md`).

### PHASE 8 — UI/UX `P1`
**Scope:** new dashboard · PLAY-first architecture · hero screen · loadout · shop · pass · missions · results · mobile landscape UX.
**Baseline V1:** home sudah PLAY-first (F24), dua menu in-gameplay (F25), HUD polish 25b; 23 screen dengan beberapa tumpang tindih fungsi (prep/focus/arena; roster/herodetail/upgrade).
**Target:** arsitektur layar mengikuti hasil merge Phase 0; alur ke run ≤ 2 tap dari mana pun.

### PHASE 9 — RETENTION `P2`
**Scope:** first-run experience · D0 · D1 · D3 · D7 · D30 · daily missions · hero mastery · collection · events.
**Baseline V1:** onboarding sinematik→gameplay, coach, daily reward, quest harian/mingguan, mutator harian, BP, rank musiman tanpa demosi.
**Target:** kurva janji per hari (D0 rasa → D1 unlock → D3 build → D7 mastery/rank → D30 musim/koleksi) — setiap hari punya *satu alasan spesifik* untuk kembali.

### PHASE 10 — MONETIZATION `P2`
**Scope:** rewarded ads · Imun Coin · Battle Pass · skins · offers · pricing · anti-pay-to-win rules.
**Baseline V1:** hook rewarded ads (revive/2×/peti) simulasi, dual currency, BP self-sustaining, kosmetik, premium power cap 30%, kuota iklan harian dari data.
**Aturan keras (dibawa dari V1, dipertegas):** premium cap ≤30% power; GP tidak dijual; anak-anak = tidak ada dark pattern; semua ads opsional di natural breakpoint.

### PHASE 11 — QA / BALANCING `P0` (paralel)
**Scope:** wave 1–20 benchmark · hero win-rate · average run duration · death point · upgrade pick-rate · boss kill rate · economy inflation · performance · mobile device testing.
**Baseline V1:** 7 suite e2e (ONBOARD 21, CORE 20, RET 20, ECO 14, BAL 13, PROG 18, PURPOSE 13) + `?autotest=1` + `check-imports`.
**Aturan:** setiap phase V2 menambah section e2e-nya sendiri; tidak ada phase "Done" tanpa 7 suite hijau + suite barunya.

---

## 🔧 KONVENSI TEKNIS V2 (tidak berubah dari V1)

1. **Vanilla JS + Canvas 2D, ES modules, tanpa build step.** Konten = data JSON; kode = mesin.
2. `game.js` tidak mengimpor UI screens — komunikasi via `ui-bridge` events.
3. Setiap perubahan menaikkan **cache buster** (`version.js` BUILD + `index.html` query).
4. Verifikasi per perubahan: `node scripts/check-imports.mjs` → `node --check` → suite e2e terkait → bukti screenshot ke `shots/`.
5. Angka balancing/VFX baru → file data (`data/*.json`), bukan konstanta di modul.
6. Dokumen phase disimpan di `docs/v2/`, di-update statusnya di tabel indeks dokumen ini.

---

## 📌 LANGKAH BERIKUTNYA

1. ✅ Phase 0 — dokumen + `js/systems/metrics.js` + verifikasi e2e (BUILD 27a).
2. ✅ Phase 1 — dokumen + implementasi game feel + `scripts/e2e-v2phase1.mjs` semua PASS (BUILD 27a).
3. ✅ Phase 2 — Core Combat: contact attack bertelegraph + smart targeting + movement smoothing, `scripts/e2e-v2phase2.mjs` 17/17 PASS (BUILD 28a).
4. ✅ Phase 3+5 — Hero Identity & Enemy/Boss (satu paket): 11 passive data-driven + fix mark/NK, elite affix + spawn terencana + boss enrage; `scripts/e2e-v2phase35.mjs` PASS penuh (BUILD 29a).
5. ✅ Phase 4 — Build & Evolution: rarity+pity+sinergi nyata+evolusi senjata in-run; `scripts/e2e-v2phase4.mjs` 20/20 PASS (BUILD 30a).
6. ✅ Phase 6 — Progression (BUILD 31a: Hero Mastery per-hero dari bermain — XP kills×2+wave×10+victory×80, 10 level, reward 15 IMU/level, gelar Terlatih/Ahli/Veteran/Legenda; tampil di gameover + hero detail; tracker per-hero utk KPI Phase 11; e2e-v2phase6 15/15, regresi 11 suite 0 FAIL).
7. ⬜ Phase 7/8 — paket berikutnya sesuai urutan.
