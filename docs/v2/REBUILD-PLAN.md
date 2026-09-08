# 🔧 IMUNVERSE V2 — REBUILD PLAN
> Status: 🔄 EKSEKUSI · Basis: BUILD 31a (V2 Phase 0–6 ✅)
> KEPUTUSAN USER: Q1 = REMAP PENUH campaign ke 6 kondisi kesehatan · Q2 = urutan R1→R2→R3..R7 · Q3 = SEMUA 5 modul dibangun.
> Progres: R1 ✅ (BUILD 32a) · R2 ✅ (BUILD 33a, e2e-r2 18/18, campaign remap penuh + RIA/Dr. Amara + cutscene dua-lapis) · R3 ✅ (BUILD 34a: Antigen Memory + framework modules.json + telemetry module_trigger) · R4 ✅ (BUILD 35a: Phagocytosis — execute-window HP≤20% 1.8s, telan instan, meter ultimate, e2e-r4 15/15) · R5 ✅ (BUILD 36a: Inflammation Zone — intensity t^1.2, DoT lantai, cytokine storm + splash hero, telegraph kuning→merah, e2e-r5 13/13) · R6 🔜 (Tag-Cascade)
> Sumber: `docs/design/imunverse-combat-differentiation-design-doc.md`,
> `docs/design/imunverse-ux-prioritization-addendum.md`,
> `docs/design/imunverse-story-narrative-design-doc.md`
> Posisi: disisipkan SEBELUM melanjutkan Phase 7–11. Phase 7 (World/Body) & Phase 8 (UI/UX)
> akan menyerap sebagian isi rebuild ini, bukan dikerjakan dua kali.

---

## 1. HASIL BEDAH — dokumen vs kondisi kode BUILD 31a

### 1.1 Combat Differentiation (5 modul)

| Modul | Status di kode sekarang | Gap yang harus dibangun | Risiko |
|---|---|---|---|
| **A. Antigen Memory** | ❌ Tidak ada. Yang mirip hanya passive bcell "Memori Antibodi" (stack dmg per kill, TIDAK per tipe musuh). Damage pipeline satu titik (`enemy.takeDamage` dipanggil dari ±5 lokasi di game.js — multiplier bisa disisipkan di 1 fungsi hitung dmg). 13 tipe musuh di enemies.json siap jadi kunci Map. | Sistem penuh: killCount per tipe → tier (15·tier^1.3) → multiplier di pipeline; kategori upgrade "Memori Antigen" bersyarat 70% threshold di pool level-up (pool Phase 4 sudah pattern-aware, mudah dititipi kondisi); HUD progress-ring; simpan tier tertinggi ke codex (Bio-Pedia sudah ada: codex-system.js). | Rendah |
| **B. Phagocytosis** | 🟡 Setengah ada. Passive macrophage "Fagositosis" + skill `devour` di skills.json sudah eksis, tapi eksekusinya damage biasa — TIDAK ada execute-window HP<20%, tidak ada indikator eligible, tidak ada resource meter ultimate. | Window eligible per-enemy (flag + timer 1.5–2s + outline berkedip), retarget `devour` jadi telan-instan ke eligible terdekat, `heroResourceMeter` mengisi ultimate (paralel dengan cooldown — keputusan desain: hybrid, meter mempercepat cooldown). | Rendah–menengah |
| **C. Inflammation Zone** | ❌ Tidak ada mekanik zona lantai sama sekali. effects-system.js (VFX layer) & pola AoE dari skill sudah ada sebagai fondasi. | Entity `InflammationZone` + intensity naik `t^1.2` + cytokine storm (dmg besar musuh + splash ke hero bila masih di dalam) + gradasi warna kuning→merah sebagai telegraph. Overlap check pakai loop musuh yang sudah ada (jumlah zona di-cap, tidak butuh spatial grid dulu). | Menengah |
| **D. Tag-Cascade / Opsonisasi** | 🟡 Sebagian ada. Sistem mark/tag musuh sudah hidup sejak Phase 3 (passive dendritic "Presentasi Antigen"). Kamera: shake + hit-stop sudah dibangun Phase 1 — yang BELUM ada: punch-zoom & cascade radius-search saat tagged mati. | Hook di event kematian musuh: tagged → radius search → hop (maks 4–5, decay 0.6) → tier feedback (T1 lokal, T2 ring 2D, T3 hit-stop 60–80ms + punch-zoom 8–10% ease-out 250–300ms). Punch-zoom = layer baru di camera (follow tetap). Cap cascade aktif bersamaan. | Menengah–tinggi |
| **E. Chemotaxis Trail** | ❌ Tidak ada. | TrailSegment array + spawn per 0.15s gerak + lifetime 3–5s + overlap buff + cleanup per frame + render layer trail. Sesuai doc: dibangun TERAKHIR, hanya jika profiling modul lain sehat. | Tinggi |

**Fondasi yang sudah menguntungkan:** feature-flag pattern sudah ada (features.json + feature-gate.js), instrumentasi lokal sudah ada (metrics.js ring-buffer 200 run dari Phase 0 — tinggal ditambah event `module_trigger` / `module_perf_sample` / korelasi sesi), dan Hukum V2 + KPI Phase 11 selaras dengan Bagian 7 doc.

### 1.2 UX Prioritization Addendum

| Instruksi doc | Kondisi kode sekarang | Aksi |
|---|---|---|
| PLAY → langsung run | ❌ `#btn-play-big` → layar Kampanye dulu (pilih bab) → prep → run | Rebuild: PLAY langsung mulai run dengan default otomatis (bab aktif + hero terakhir); pilihan bab/mode di-expose setelah run ke-3 (trigger-based) |
| Guest-first, akun setelah run | 🟡 SUDAH guest-first (`MULAI` → onboarding run tanpa akun). Yang belum: ajakan buat akun di layar HASIL setelah reward masuk — sekarang ajakan akun tidak ada di gameover | Tambah prompt "simpan progresmu" di gameover run ke-1/ke-2 (non-blocking, sekali saja) |
| Faction "Pilih Pasukanmu" di signup → **copot total** | ❌ Masih ada di auth-screen.js (kartu faction Imun vs Virus, Virus locked) | Copot dari alur signup; factions.json tetap di kode untuk PvP nanti |
| Nav collapse 3–4 tab + progressive disclosure | 🟡 Gate bertahap SUDAH ada (features.json) tapi trigger-nya hanya bestWave, dan jumlah destinasi tetap 10+ | Redesain gate: trigger campuran (runs / wave / currency) sesuai tabel doc; collapse dock jadi 4 tab (Play, Squad, Shop, Profil); tab muncul saat unlock |
| Battle Pass ditunda 3–5 sesi | 🟡 Gate wave 6 | Ubah trigger: totalRuns ≥ 4 (proxy sesi, karena tanpa server) |
| Leaderboard/Rank disembunyikan | 🟡 Gate wave 3 | Naikkan gate jauh (mis. totalRuns ≥ 10) — leaderboard lokal, tidak dihapus |
| Landscape → evaluasi, bukan buang | Landscape wajib | TIDAK disentuh di rebuild (kategori evaluasi besar, ditunda) |
| Validasi A/B cohort | Tidak ada server | Substitusi realistis: metrics.js lokal merekam varian + KPI one-more-run rate — bukan A/B beneran, tapi data tetap terkumpul |

### 1.3 Story & Narrative

| Instruksi doc | Kondisi kode sekarang | Aksi |
|---|---|---|
| Naratif dua lapis Makro (Dr.) + Mikro (RIA) | ❌ Cinematics ada (cinematics.json + player) tapi isinya generik "sesuatu menyusup", tanpa dokter, tanpa pemandu, tanpa stakes Inang | Tulis ulang scene data: cutscene pembuka pola shot-list 7.2 (ruang periksa → match-cut ke luka → dunia mikro), naskah Bagian 6 dipakai verbatim |
| RIA = tutorial voice + story voice (1 sistem) | 🟡 Coach/tutorial sudah ada (coach.json + tutorial-system.js) tapi tanpa identitas karakter | Rebrand coach jadi RIA: nama + visual sinyal partikel + gaya bicara doc 3.2; barks pra-boss & pasca-run dari data |
| Campaign = 6 kondisi kesehatan (Luka Kecil → Pertahanan Terakhir) | ❌ 6 bab BERBASIS ORGAN (Mulut/Lambung/Usus/Paru/Limfe/Jantung) | **BUTUH KEPUTUSAN** (lihat §3 Q1): remap penuh vs hybrid (kondisi sebagai judul cerita, organ tetap sebagai lokasi) |
| Glossary istilah awam di dialog | 🟡 Bio-Pedia/codex edukatif ada; dialog tidak pakai terjemahan awam | Terapkan tabel Bagian 4 di semua dialog RIA/Dr; aturan maks 1 istilah teknis per kalimat |
| Mystery hook identitas Inang | ❌ Tidak ada | Reveal bertahap per bab; epilog reveal penuh setelah bab final |
| Cutscene 2-panel antar-bab (visual novel style) | 🟡 Cinematic player ada, format panel dialog + potret belum | Extend cinematic player: mode dialog (potret + text box), bukan sistem baru |

---

## 2. RENCANA REBUILD — urutan & paket

Prinsip urutan: **core loop dulu (nyawa produk, kata addendum) → narasi (konteks emosional) → 5 modul combat dari risiko terendah**. Setiap paket = doc + kode + e2e + regresi + push (konvensi yang sudah berjalan).

| Paket | Isi | Sumber | Risiko |
|---|---|---|---|
| **R1 ✅ (BUILD 32a)** — Core Loop UX | PLAY→langsung run (default otomatis, pilihan muncul run ke-3+); prompt akun pasca-run; copot faction dari signup; dock collapse 4 tab + trigger unlock campuran (runs/wave/currency); gate BP & Rank digeser | Addendum | Rendah |
| **R2 ✅ (BUILD 33a)** — Narrative Layer | RIA (rebrand coach + barks) + Dr. [Nama]; cutscene pembuka dua-lapis (shot list 7.2, naskah 6.1); transisi bab 2-panel; glossary awam; mystery hook Inang + keputusan Q1 campaign | Story doc | Rendah–menengah |
| **R3 ✅ (BUILD 34a)** — Modul A: Antigen Memory | + framework flag `data/modules.json` + instrumentasi metrics `module_trigger`/`module_perf_sample` (dipakai semua modul berikutnya) | Combat doc §2, §7 | Rendah |
| **R4 — Modul B: Phagocytosis** | Execute-window + telan instan + resource meter ultimate (Mako dulu) | Combat doc §3 | Rendah–menengah |
| **R5 — Modul C: Inflammation Zone** | Zona + intensity + cytokine storm + telegraph warna | Combat doc §4 | Menengah |
| **R6 — Modul D: Tag-Cascade** | Cascade hop + camera punch-zoom layer + throttling | Combat doc §5 | Menengah–tinggi |
| **R7 — Modul E: Chemotaxis Trail** | Hanya jika profiling R3–R6 sehat (sesuai doc §8) | Combat doc §6 | Tinggi |
| Lanjut Phase 7–11 | Phase 7 World/Body menyerap hasil Q1; Phase 8 UI/UX menyerap R1; Phase 11 QA memakai instrumentasi modul untuk evaluasi Bagian 7 doc | — | — |

Semua modul combat di belakang flag (`data/modules.json`, default ON di dev, bisa dimatikan per modul) — tidak ada yang di-hardcode sebagai pemenang, sesuai doc §8.

---

## 3. KEPUTUSAN YANG DIBUTUHKAN SEBELUM EKSEKUSI

- **Q1 — Campaign:** remap penuh 6 bab organ → 6 bab kondisi (Luka Kecil, Demam, Keracunan, Alergi, Kanker, Final)? Atau hybrid: judul & cerita = kondisi, organ tetap jadi lokasi/arena (mis. Keracunan berlangsung di Lambung)? Hybrid mempertahankan seluruh konten arena/enemy per-organ yang sudah jadi.
- **Q2 — Urutan:** setuju R1 → R2 → R3..R7? Atau modul combat duluan sebelum narasi?
- **Q3 — Scope modul:** kelima modul dibangun semua (sesuai doc), atau berhenti dulu di A–D dan E ditunda pasca-profiling?
