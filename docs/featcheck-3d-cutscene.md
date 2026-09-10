# 📋 FEASIBILITY CHECK — CUTSCENE 3D vs HYBRID (Task 1, Agent Narrative-Cinematic)

> Status: **SIAP UNTUK KEPUTUSAN USER** — laporan sebelum pipeline produksi penuh (sesuai instruksi: trade-off ini dikonfirmasi, bukan diputuskan sendiri).
> Tanggal: 2026-09-09 · Basis kode: BUILD `40a` (commit `19515b9`, branch `arena/01a0843d-imunverse`)
> Sumber wajib: `docs/design/imunverse-story-narrative-design-doc.md` — Bagian 3 (karakter), 6 (naskah final), 7 (shot list & titik jeda).
> Bar wajib Audit Agent: **loading < 3 detik · tidak ada freeze ≥ 5 detik** (bar ini TIDAK terdokumentasi di repo — diadopsi sebagai target; korelasi dengan KPI BLUEPRINT `≤ 8 ms/frame @130 musuh` dicantumkan).

---

## 0. Catatan scope & branch (WAJIB DIBACA)

1. **Path scope yang ditetapkan (`/src/cinematics/`, `/assets/cinematics/`, `/assets/audio/narration/`, `/assets/audio/music/`, `/src/dialogue/`) TIDAK ADA di repo.** Repo memakai layout `js/ · data/ · assets/sprites/`. Mapping yang saya pakai (mohon konfirmasi D5):

   | Scope diminta | Aktual di repo |
   |---|---|
   | `/src/cinematics/` | `js/ui/cinematic.js` (player 2D canvas), `js/ui/wave-cinematic.js`, `js/ui/presenter.js`, `js/render/cine-banner.js` + (baru) `js/ui/cutscene/` saat Task 2 |
   | `/src/dialogue/` | `data/cinematics.json` (scene & baris dialog), `data/narrative.json` (RIA/Dr. Amara, glossary, barks) |
   | `/assets/cinematics/` | baru dibuat saat Task 3 (background art) |
   | `/assets/audio/narration/` | **dibuat — sudah berisi 2 MP3 VO riil** (lihat §5) |
   | `/assets/audio/music/` | baru dibuat bila keputusan D3 memilih file musik |

2. **Branch `agent/narrative-cinematic` tidak ada di repo** (hanya `main`). Sesi Arena ini terkunci di `arena/01a0843d-imunverse` — seluruh kerja berjalan di situ.
3. **Repo ini vanilla JS + Canvas 2D, TANPA library eksternal** (README + konvensi #1 BLUEPRINT-MASTER). "Cutscene 3D" berarti engine 3D eksternal (three.js) — ini pelanggaran konvensi yang harus disetujui eksplisit, bukan sekadar keputusan teknis.
4. **Story doc Bagian 7.1 sendiri merekomendasikan 2D layered** ("Alih-alih full 3D cinematic (mahal & tidak perlu)"). Task user (3D) vs desain final (2D layered) = konflik desain; laporan ini adalah datanya.
5. **Tidak ada karakter 3D / environment 3D di repo** — "reference sheet" Character Agent = sprite PNG 2D prosedural (`tools/gen_assets.py`), dan environment "Arena Agent" = canvas prosedural (`js/render/background.js` + palet `data/arenas.json`). Reuse 3D (instruksi koordinasi) belum bisa dieksekusi karena aset 3D sumbernya belum ada di repo.

---

## 1. Metode & batasan pengukuran (transparan)

**Termed ukur NYATA di sandbox ini:**
- Ukuran payload: setiap file di repo (raw + gzip), ukuran distribusi three.js resmi, ukuran & durasi VO (parser MPEG + tag Xing/LAME — terverifikasi: field `bytes` Xing = persis ukuran data).
- Biaya JS per frame: scene three.js **nyata** (BufferGeometry, Points, mesh, `updateMatrixWorld` persis seperti renderer) di Node, viewport 844×390 (standar e2e repo), 5 sampel × 3600 frame (60 dtk/sampel) setelah warmup.
- Logika scene = kode yang sama yang dipakai demo di browser (`tools/featcheck/scene.mjs`: 5 shot sesuai shot list 7.2, 570 partikel, sinkronisasi dialog).

**TIDAK bisa diukur di sandbox** (host hanya membolehkan akses ke npm registry — tidak ada browser/Chromium/ffmpeg, tidak ada device):
- Rasterisasi GPU & init WebGL di device → **dikalibrasi lewat `tools/featcheck/benchmark.html`**: halaman self-test yang dibuka di browser device uji (low-end Android), render 20 dtk per mode, melaporkan rAF p50/p95/p99, long task, freeze ≥ 5 s, init WebGL, lalu ekspor JSON untuk laporan Audit Agent.
- Crash-free rate (perlu telemetry lintas device) → proxy: long task ≥ 5 s + rAF gap ≥ 5 s + error WebGL context.

**Asumsi yang dinyatakan** (bukan fakta): faktor CPU device menengah-bawah (ARM low-power core) ≈ 2–4× vs core host untuk workload JS — di-kalibrasi ulang oleh benchmark.html di device uji.

---

## 2. Hasil ukur — payload (fakta)

### 2.1 Baseline game BUILD 40a (285 request)

| Kategori | File | Raw | Gzip |
|---|---:|---:|---:|
| `js/` | 85 | 0.59 MB | 0.20 MB |
| `styles/` | 2 | 0.18 MB | 0.04 MB |
| `data/*.json` | 31 | 0.17 MB | 0.05 MB |
| `assets/sprites/*.png` | 164 | 2.45 MB | 2.45 MB |
| `assets/audio/*.mp3` (baru, VO) | 2 | 0.09 MB | 0.09 MB |
| **TOTAL** | **285** | **3.52 MB** | **2.84 MB** |

### 2.2 Tambahan per pendekatan (incremental per cutscene)

| Item | Mode A (3D penuh) | Mode B (2.5D layered) | Mode C (ringan: portrait + audio) |
|---|---|---|---|
| Engine | **+252 KB gzip** (three.js r160 `three.module.js` self-contained, di-cache setelah pertama) | +0 | +0 |
| Aset scene | geometri prosedural = +0; karakter = billboard sprite game existing = +0 | background prosedural = +0 | portrait existing = +0 |
| VO TTS (2 baris cutscene) | +95 KB (dimuat on-demand saat scene) | +95 KB | +40–55 KB/baris |
| **Incremental total (pertama)** | **±350 KB gzip** | **±95 KB** | **±40–55 KB** |

> **Koreksi (2026-09-09):** angka engine awal (135 KB gz) mengacu `three.module.js` versi tiga.js terbaru yang ternyata hanya *shim re-export* `three.core.js`. Build yang di-vendorkan = **r160 self-contained** (1.21 MB raw / 252 KB gz) — konsisten dengan `benchmark.html`. Mitigasi: modul di-fetch **semasa loading screen** (prewarm saat boot) → untuk pemain baru, biaya 3D praktis tertutup proses load awal; incremental yang terasa ≈ 0 di run berikutnya.

### 2.3 VO nyata (TTS, sudah diproduksi — naskah final 6.1–6.4 verbatim + bark R2)

| File | Ukuran | Durasi (tag Xing) |
|---|---:|---:|
| `amara_cutscene_pembuka.mp3` (6.1) | 54.3 KB | 20.8 dtk |
| `ria_cutscene_pembuka.mp3` (6.1) | 40.2 KB | 15.3 dtk |
| `amara_transisi_ch2.mp3` (6.2) | 30.4 KB | 11.6 dtk |
| `ria_transisi_ch2.mp3` (6.2) | 49.6 KB | 19.0 dtk |
| `amara_boss_reveal_ch5.mp3` (6.3) | 31.4 KB | 12.0 dtk |
| `ria_boss_reveal_ch5.mp3` (6.3) | 57.8 KB | 22.1 dtk |
| `amara_epilog.mp3` (6.4) | 34.8 KB | 13.3 dtk |
| `ria_epilog.mp3` (6.4) | 40.9 KB | 15.6 dtk |
| `ria_bark_bab_demam/racun/alergi/kanker/final/default.mp3` (R2) | 24–39 KB | 8.8–15.0 dtk |
| `ria_nft_move/levelup/skill/revive.mp3` (Task 4) | 27–36 KB | 10.1–13.5 dtk |

**18 file VO lengkap** di `assets/audio/narration/` (total 0.64 MB raw / 0.62 MB gz), dimuat on-demand + ducking otomatis (musik turun saat VO bicara).

---

## 3. Hasil ukur — biaya JS per frame (fakta, host 2 core / Node 22)

Scene identik untuk kedua mode: 5 shot (7.2), 300 partikel RIA + 150 virion + 120 sel darah, 3 billboard/sprite, sinkronisasi dialog, interpolasi kamera + match-cut.

| Metrik | **A — three.js 3D** | **B — 2.5D canvas** |
|---|---:|---:|
| Build scene (saat titik jeda) | 3.9 ms | 0.4 ms |
| Tick p50 | 0.023 ms | 0.015 ms |
| Tick p95 | 0.100 ms | 0.024 ms |
| Tick p99 | 0.153 ms | 0.081 ms |
| Tick max | 3.39 ms | 0.27 ms |
| Upload buffer/frame | 6.84 KB | 0 |
| Skip (fast-forward) | 0.042 ms | 0.048 ms |

**Kesimpulan:** JS bukan masalah pada 3D. Yang membedakan A vs B adalah **(a) +135 KB payload**, **(b) rasterisasi GPU + init WebGL + shader compile** (belum terukur — ada di benchmark.html), **(c) kompatibilitas driver GPU low-end** (risiko field: crash/blank — crash-free rate), **(d) pelanggaran konvensi "tanpa library eksternal"**.

Bukti existing jalur 2D: game sudah render **151 musuh + efek @16.6 ms/frame vsync** di device uji pengembang (ROADMAP Fase 5.3 dst.) — scene cutscene 2D (≤ ~600 draw ops) jauh di bawah kapasitas itu.

---

## 4. Model waktu-load (payload ukur ÷ bandwidth; 285 request, tanpa service worker — PWA Fase 9 masih ⬜)

| Tier jaringan Indonesia | Baseline game (2.84 MB gz, sebelum R3) | + Mode B (95 KB) | + Mode A (350 KB pertama) |
|---|---:|---:|---:|
| 3G lemah 0.5 Mbps | ≈ 58 s | ≈ +0.8 s | ≈ +5.5 s ⚠️ |
| 3G baik 1.5 Mbps | ≈ 23 s | ≈ +0.3 s | ≈ +1.9 s |
| 4G rendah 2 Mbps | ≈ 17 s | ≈ +0.2 s | ≈ +1.4 s |
| 4G baik 6 Mbps | ≈ 8 s | ≈ +0.07 s | ≈ +0.5 s |
| Wi-Fi | ≈ 0.5 s | ≈ +0.03 s | ≈ +0.1 s |

> Mitigasi 3G lemah (Mode A): three.js di-fetch **saat loading screen** (prewarm boot) — pemain baru tidak memikul biaya ini di titik jeda; run berikutnya = cache lokal (≈0 s). Sisa risiko = pemain lama yang langsung membuka bab baru di 3G lemah tanpa sesi load awal (jarang; VO tetap tersampaikan + scene 2D fallback tersedia bila module timeout).

> ⚠️ **Temuan kunci untuk Audit Agent:** baseline game itu sendiri **sudah > 3 s** di semua tier seluler (dominan: 164 sprite PNG = 2.45 MB + 285 request HTTP/1.1). Bar "loading < 3 s" hanya terpenuhi bila diartikan **(a) beban INKREMENTAL cutscene** (pembacaan yang saya pakai — konsisten: "waktu loading tambahan yang ditimbulkan") atau **(b) setelah PWA/service worker (Fase 9) meng-cache** sehingga run kedua ±0 s. Rekomendasi: konfirmasi interpretasi bar + dorong sprite-sheet/SW cache (di luar scope saya — flag ke Audit Agent & UI/UX Agent).
>
> Mitigasi A yang akan saya terapkan bila 3D disetujui: **pre-warm konteks WebGL** di latar belakang saat home (bukan saat cutscene dibuka) + pre-`fetch` VO + hanya `MeshBasicMaterial` (tanpa shader kustom → shader compile minimal). Init WebGL (±50–500 ms di low-end) keluar dari jalur kritis.

---

## 5. Evaluasi terhadap bar wajib

| Bar | Mode A (3D) | Mode B (2.5D) | Mode C |
|---|---|---|---|
| Loading tambahan < 3 s | ✅ ±0.1–1.9 s (3G lemah pertama ≈5.5 s **tanpa** prewarm — dengan prewarm saat loading screen ≈0 s; lihat §4) | ✅ ±0.03–0.8 s | ✅ ±0.02–0.4 s |
| Tidak ada freeze ≥ 5 s | 🟡 **BELUM TERBUKTI** — risiko: init WebGL + shader compile di low-end (mitigasi §4 ada; validasi = `benchmark.html` di device uji) | ✅ jalur 2D sudah terproof di game (151 musuh @16.6 ms); build scene 0.4 ms | ✅ tanpa render baru |
| Crash-free | 🟡 **RISIKO FIELD** — driver GPU low-end (Mali/Adreno tua) bisa gagal WebGL; tidak terukur di sandbox | ✅ tidak menambah permukaan crash (Canvas 2D universal) | ✅ |
| Konvensi repo (vanilla, tanpa library) | ❌ melanggar (three.js) — perlu persetujuan eksplisit | ✅ sesuai konvensi + sesuai story doc 7.1 | ✅ |
| Konsistensi karakter (instruksi koordinasi) | ❌ tidak ada pipeline 3D di repo; 3D-kan sprite 2D = versi terpisah (proporsi/warna berisiko menyimpang dari reference sheet) | ✅ memakai sprite PNG game yang SAMA (reference sheet identik) | ✅ |

---

## 6. Rekomendasi — HYBRID (sesuai fallback yang Anda tawarkan & story doc 7.3)

**Mode B (2.5D layered) sebagai pendekatan canonical SEMUA titik jeda**, dengan kedalaman produksi berbeda per titik:

| Titik jeda (story doc 7.3) | Format | Durasi | Beban incremental |
|---|---|---|---|
| Pembuka / awal Chapter 1 (shot list 7.2, 5 shot) | Cutscene 2.5D penuh: 3 layer parallax, match-cut zoom ke luka, RIA partikel menyala, establishing mikro → seamless ke run (tanpa loading screen, sesuai 7.2#5) | 45–60 s (timelne scene sudah dibangun: 48 s) | ±95 KB (VO) + 0 (prosedural) |
| Transisi antar-chapter (2 panel) | 2-panel visual novel: potret Dr. Amara (idle/talk 2-frame) + RIA partikel, text box + VO | 15–20 s | ±90–110 KB |
| Pre-boss | Bark RIA: HUD popup + VO (tanpa cutscene penuh — sesuai 7.3) | 3–5 s | ±20–30 KB/baris |
| Pasca-run (menang/kalah) | Bark RIA 1 baris kontekstual (presenter existing E1 + VO) | instan, non-blocking | ±20–30 KB/baris |
| Epilog (6.4) | Cutscene 2.5D penuh dua-lapis (kamar RS + reveal Inang) | 60–90 s | ±95 KB + background art |

**Mengapa B, bukan A, sebagai canonical:**
1. **Konsistensi karakter terjamin** — sprite 2D game dipakai apa adanya; tidak ada risiko proporsi/warna menyimpang dari reference sheet (instruksi Anda).
2. **Zero risiko crash/freeze tambahan** — jalur Canvas 2D sudah diprop di game; tidak ada permukaan WebGL baru di device low-end.
3. **Payload +95 KB vs +230 KB** dan tetap < 3 s di semua tier.
4. **Story doc 7.1 final justru memilih pendekatan ini** — dan 7.3 memang memusatkan beban produksi di 2 momen besar (pembuka/epilog) yang formatnya "cutscene animasi" — 2.5D layered memenuhi itu (parallax + limited animation + partikel, persis spesifikasi 7.1).
5. Konvensi repo (tanpa library) terjaga.

**Mode A (3D penuh) tetap tersedia** sebagai opsi untuk pembuka & epilog **HANYA JIKA** user memilih upgrade setelah melihat bukti device: jalankan `tools/featcheck/benchmark.html` di device uji Audit Agent (mode A) — lolos bila long task < 5 s, rAF p95 ≤ 33 ms, tanpa error WebGL — **DAN** user menyetujui 3 konsekuensi: dependensi three.js (+135 KB), pipeline model 3D baru (koordinasi Character Agent — belum ada di repo), dan konvensi "tanpa library" dikesampingkan untuk file itu saja.

**Mode C** = fallback otomatis: jika di device tertentu even Canvas 2D berat (sangat jarang), cutscene degraded ke portrait statis + audio-only — logic skip & degraded-mode akan dibangun di cutscene player (Task 2).

---

## 7. Poin keputusan untuk USER (konfirmasi sebelum Task 2/3/4 produksi penuh)

- **D1 — Arah cutscene:** (a) **Hybrid B canonical — REKOMENDASI SAYA** (termasuk pembuka & epilog di 2.5D penuh); (b) 3D dulu untuk pembuka & epilog, B untuk sisanya — dengan gate `benchmark.html` di device low-end sebelum produksi aset 3D; (c) 3D semua titik jeda — **saya tidak merekomendasikan** (risiko freeze/crash di titik jeda kecil yang seharusnya 3–5 s).
- **D2 — VO:** VO TTS sudah diproduksi (RIA & Dr. Amara, suara tetap per karakter). Opsi: (a) **tetap TTS** (gratis, konsisten, di-scope; drop-in replaceable nanti) — rekomendasi sementara; (b) pemilik menyediakan VO rekaman manusia (file dipindah ke `assets/audio/narration/`, API player tidak berubah); (c) tanpa VO (teks + SFX prosedural saja).
- **D3 — Musik per chapter:** (a) **ekstensi musik prosedural existing** (`music-system.js` — 0 KB, bebas lisensi, API sudah menyisipkan slot file) — rekomendasi; (b) file musik per chapter dari pemilik (masuk `assets/audio/music/`).
- **D4 — Bar loading:** konfirmasi interpretasi "loading < 3 s" = **beban incremental cutscene** (baseline game 2.84 MB/285 request sudah >3 s di seluler sebelum fitur saya apa pun). Jika bar dimaksud total-load, PWA/SW cache (Fase 9 ⬜) harus diselesaikan dulu — flag ke Audit Agent.
- **D5 — Mapping scope & branch:** konfirmasi tabel §0 (path scope → path aktual) dan bahwa seluruh kerja tetap di `arena/01a0843d-imunverse`.

---

## 8. Deliverable feasibility check (sudah di repo)

| File | Isi |
|---|---|
| `docs/featcheck-3d-cutscene.md` | Laporan ini |
| `tools/featcheck/scene.mjs` | Logika scene 5-shot (shot list 7.2 + naskah 6.1) — dipakai Node bench & demo browser |
| `tools/featcheck/payload-audit.mjs` | Audit payload + model load (re-run: `node tools/featcheck/payload-audit.mjs`) |
| `tools/featcheck/mp3-probe.mjs` | Probe MP3 (CBR/VBR + tag Xing) |
| `tools/featcheck/bench-node.mjs` | Bench biaya JS per frame A vs B (re-run: `node tools/featcheck/bench-node.mjs`, butuh `three` terpasang dev-only) |
| `tools/featcheck/benchmark.html` | **Self-benchmark device nyata** — buka di browser low-end Android, jalankan Mode A/B (render 20 s + VO + demo visual cutscene), salin JSON ke laporan Audit Agent. Tersedia di `tools/featcheck/benchmark.html` saat server statis jalan |
| `assets/audio/narration/ria_cutscene_pembuka.mp3` | VO RIA — naskah 6.1 verbatim (15.3 s, 40.2 KB) |
| `assets/audio/narration/amara_cutscene_pembuka.mp3` | VO Dr. Amara — naskah 6.1 verbatim (20.8 s, 54.3 KB) |

**Catatan produksi VO:** suara TTS konsisten per karakter selama sesi ini; seluruh baris narasi (pembuka, 5 transisi, barks boss, epilog, 4 titik tutorial Task 4) sebaiknya di-generate **satu batch** setelah D1/D2 dikonfirmasi agar karakter suara seragam.

## 9. STATUS PRODUKSI (pasca keputusan D1–D5, 2026-09-09)

**Sudah dibangun & terverifikasi sintaks/grafik modul:**

| Komponen | File | Status |
|---|---|---|
| Orkestrator cutscene (skip, seamless handoff, VO sync, musik) | `js/ui/cutscene-player.js` | ✅ baru |
| Renderer 3D (three.js r160, lazy import, prewarm, fallback 2D) | `js/ui/cutscene-3d.js` | ✅ baru |
| Renderer 2.5D layered (parallax, partikel, letterbox, dialog) | `js/ui/cutscene-2d.js` | ✅ baru |
| Engine 3D vendored (MIT) | `js/vendor/three.module.js` + `THREE_LICENSE` | ✅ baru (252 KB gz) |
| Lapisan VO (decode on-demand, ducking musik, stop-handle) | `js/systems/vo-system.js` | ✅ baru |
| Data cutscene (naskah final 6.1–6.4 verbatim + teks R2, shot list, VO map) | `data/cutscenes.json` | ✅ baru (terdaftar di data-store) |
| Musik prosedural per chapter (6 tema: luka/demam/racun/alergi/kanker/final) | `js/systems/music-system.js` (setTheme) | ✅ ekstensif |
| Presenter + VO (auto-dismiss ikut durasi VO) | `js/ui/presenter.js` | ✅ ekstensif |
| Trigger titik jeda 7.3: pembuka (title→run), transisi bab (prep), reveal boss ch5 (bossSpawn, sekali), epilog (victory bab_final, 2 tombol) | `main.js`, `title-screen.js`, `prep-screen.js`, `gameover-screen.js` | ✅ wiring |
| Task 4: 4 hook first-time (move/levelup/skill/revive) + meta flags | `game.js` (observasi-only), `main.js`, `state-manager.js` | ✅ wiring |
| Bark boss + VO (6 bark R2) | `narrative-system` (tanpa perubahan) + `main.js` | ✅ 6/6 VO |
| 4 VO first-time RIA (Task 4) — teks dipendekkan 1× agar 10–13 s (non-blocking) | `assets/audio/narration/ria_nft_*.mp3` + `data/cutscenes.json` | ✅ 4/4 VO |

**Sync dgn `origin/main` (2026-09-10):** main di-rebuild dgn root commit baru (orphan — `--allow-unrelated-histories`, konten ≈ basis lama + update MAP: sprite regen, hero id `makrofag`→`macrophage`, evoParts→fragmen equity, struktur `src/` baru). Semua perubahan R3 dipertahankan; 1 referensi sprite di-`cutscene-3d.js` di-update ke nama baru (`hero_macrophage_idle.png`). Payload pasca-merge: **317 file, raw 5,18 MB / gzip 3,30 MB** (sprite regen main −0,4 MB). Verifikasi ulang pasca-merge: syntax semua js ✓, JSON ✓, import smoke ✓, timeline 2D 7 scene & 3D 2 scene (renderer 3D terpakai, tanpa fallback diam-diam) ✓.

**Koordinasi lintas-agent (issue sudah dibuat):**
- **#26 → Character Agent**: referensi & swap-in point model 3D (non-blocking; billboard sprite sekarang)
- **#27 → Arena Agent**: antarmuka ambient per arena vs lapisan musik/VO cutscene (pola ducking `vo-system.js`)

**Pending (perlu device/owner):**
1. **Gate 3D di device low-end** (syarat D1): jalankan `tools/featcheck/benchmark.html` (Mode A) di device uji Audit Agent — lolos bila long task < 5 s, rAF p95 ≤ 33 ms, tanpa error WebGL. Jika TIDAK lolos → player sudah otomatis fallback 2D (pembuka/epilog tetap jalan).
2. **Review 4 draft naskah Task 4** (first-time RIA) — teks baru (bukan naskah final 6.x), nada RIA bersemangat/jenaka, bisa di-tap skip: `data/cutscenes.json` → `nft.*.text`.
3. **Durasi transisi vs spec 15–20 s**: naskah final 6.2 (11.6 s + 19.0 s) & 6.3 (12.0 s + 22.1 s) menghasilkan scene ±29–34 s dengan overlap — **naskah final menang atas estimasi durasi di 7.3** (dialog tak boleh dipotong/ditulis ulang). Flag untuk Audit Agent.

## 10. Yang TIDAK saya sentuh (di luar scope / butuh owner keputusan)

- Logic combat/wave (`js/core/game.js`, `js/entities/`, `js/systems/spawn-system.js`) — scope Character Agent.
- Navigasi/layout menu (`js/ui/screens/*` selain hook cutscene, `styles/`) — scope UI/UX Agent; saya hanya menambah **trigger event** di titik jeda yang sudah ada (`runstart`, `waveBreak`, `gameover`, buka bab kampanye) — titik persisnya akan saya daftarkan di dokumen Task 2 sebelum edit.
- `data/campaign.json`, `data/narrative.json` — sudah final dari R2 (BUILD 33a); saya hanya menambah field baru bila diperlukan (mis. path VO per bark), tanpa menulis ulang naskah.
