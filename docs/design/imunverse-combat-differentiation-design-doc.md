# Imunverse — Combat Differentiation Design Doc
**Versi:** 1.0
**Status:** Draft untuk implementasi paralel
**Tujuan dokumen:** Spesifikasi teknis 5 mekanik combat baru untuk mengatasi masalah "feel generik" dibanding genre bullet heaven/survivors-like. Kelima mekanik diimplementasikan bersamaan di belakang feature flag terpisah, agar tim bisa mengukur mekanik mana yang paling dominan secara feel & retensi sebelum memutuskan mana yang jadi core identity game.

---

## 1. Latar Belakang & Kriteria Sukses

### 1.1 Masalah yang diselesaikan
Genre bullet heaven (Vampire Survivors-like) tahun 2026 sudah sangat jenuh — ratusan rilis baru tiap tahun, dan yang bertahan secara komersial selalu punya diferensiasi mekanik nyata (Soulstone Survivors: skill tree + crafting + rune; Vampire Survivors: weapon-fusion; 20 Minutes Till Dawn: input aiming manual). Imunverse saat ini secara mekanik masih setara "auto-attack + pilih upgrade acak", yang secara struktural identik dengan mayoritas clone generik di pasar — diferensiasinya baru di lapisan tema/visual, belum di lapisan sistem.

### 1.2 Strategi implementasi
Daripada memilih satu mekanik di atas kertas, kelima kandidat diimplementasikan sekaligus sebagai modul independen (feature-flagged), lalu diukur lewat instrumentasi (lihat Bagian 7) untuk menentukan mana yang:
- Paling meningkatkan session length & D1 retention
- Paling sedikit menimbulkan bug/crash/performance drop
- Paling disukai secara kualitatif dari playtest internal

### 1.3 Kriteria "robust" untuk prioritas urutan build
Urutan implementasi di bawah disusun dari risiko teknis paling rendah ke paling tinggi, supaya modul yang gagal di awal tidak memblokir modul lain:
1. Antigen Memory (paling ringan, tidak menyentuh render/camera pipeline)
2. Phagocytosis (ringan, 1 skill + resource counter)
3. Inflammation Zone (menengah, area-effect + damage-to-player check)
4. Tag-Cascade / Opsonisasi (menengah-berat, butuh camera controller baru)
5. Chemotaxis Trail (paling berat, butuh trail-rendering + collision berkelanjutan)

---

## 2. Modul A — Antigen Memory (Adaptive Build per-Run)

### 2.1 Konsep gameplay
Setiap kali pemain membunuh pathogen dari tipe tertentu dalam jumlah tertentu di dalam 1 run, hero mendapat stacking bonus khusus melawan tipe pathogen itu — meniru cara kerja sel B menyimpan memori antigen. Build jadi adaptif terhadap komposisi musuh yang muncul di run tersebut, bukan sekadar pilihan acak dari 3 opsi seperti sistem level-up yang sudah ada.

### 2.2 Struktur data
- `enemyTypeKillCount: Map<EnemyTypeId, number>` — reset tiap awal run, di-increment tiap kali musuh tipe tersebut mati.
- `antigenMemoryTier: Map<EnemyTypeId, number>` — level memori aktif per tipe (0 = belum unlock, naik tiap threshold kill terlewati).
- Threshold per tier: disarankan kurva `killsRequired = 15 * tier^1.3` (tier 1 = 15 kill, tier 2 ≈ 37 kill, tier 3 ≈ 65 kill) — perlu di-tuning ulang lewat playtest, ini baseline awal.
- Efek per tier (contoh default, bisa dikonfigurasi per tipe musuh):
  - Tier 1: +15% damage ke tipe tersebut
  - Tier 2: +15% damage tambahan + 10% chance ignore armor/resistance tipe tersebut
  - Tier 3: +20% damage tambahan + splash kecil (AoE radius kecil) tiap kill ke tipe tersebut

### 2.3 Titik integrasi
- **Damage pipeline**: sebelum damage final dihitung, cek `antigenMemoryTier[targetEnemyType]` dan apply multiplier. Ini 1 baris tambahan di fungsi damage calculation yang sudah ada — tidak mengubah urutan/struktur pipeline.
- **Level-up upgrade pool**: tambahkan kategori upgrade baru "Memori Antigen: [Nama Pathogen]" yang hanya muncul di pilihan 3-random kalau `enemyTypeKillCount` sudah mendekati threshold (misal 70% dari kill yang dibutuhkan) — supaya upgrade ini terasa earned, bukan random murni.
- **UI real-time**: indikator kecil di HUD (misal icon musuh dengan progress ring) menunjukkan tipe pathogen mana yang sedang mendekati tier berikutnya — memberi pemain informasi untuk strategi target-priority.
- **Bio-Pedia (dashboard)**: setelah run selesai, tier memori tertinggi yang dicapai per tipe pathogen disimpan sebagai metadata "encounter record" — bisa jadi collection/achievement layer jangka panjang.

### 2.4 Risiko teknis
- Rendah. Tidak menyentuh render loop, camera, atau collision. Risiko utama hanya di balancing angka (terlalu kuat = trivialisasi late-game, terlalu lemah = tidak terasa).

---

## 3. Modul B — Phagocytosis (Consume/Vacuum Mechanic)

### 3.1 Konsep gameplay
Hero (prioritas: Mako/macrophage sebagai role tank) mendapat skill aktif "Telan" — saat musuh HP-nya di bawah ambang tertentu (misal 20% max HP), muncul window aktif di mana pemain bisa menekan tombol skill untuk menelan musuh tersebut secara instan (bukan lewat damage biasa). Musuh yang ditelan dikonversi jadi resource instan (fuel ultimate atau heal kecil), bukan drop XP/currency normal.

### 3.2 Struktur data
- `phagocytosisEligible: boolean` (flag per-enemy-instance) — di-set true saat `enemy.hp <= enemy.maxHp * 0.2`.
- `phagocytosisWindowTimer: number` — durasi window aktif (disarankan 1.5-2 detik) sebelum flag reset ke false kalau tidak dimakan.
- `heroResourceMeter: number` — meter fuel ultimate, bertambah tiap kali "Telan" berhasil (nilai bisa dikonfigurasi per hero).

### 3.3 Titik integrasi
- **Enemy state machine**: tambahkan state check di update loop musuh — kalau HP di bawah threshold, set `phagocytosisEligible = true` dan trigger visual indicator (musuh berkedip/outline berbeda).
- **Input handling**: skill "Telan" jadi tombol/skill slot terpisah (bisa dipetakan ke skill slot 1/2/Ultimate tergantung hero), dengan target-lock ke musuh eligible terdekat dalam radius jangkau.
- **Resource → Ultimate**: `heroResourceMeter` menggantikan/melengkapi sistem cooldown ultimate yang sudah ada — perlu keputusan desain apakah ini paralel dengan cooldown timer atau menggantikannya sepenuhnya untuk hero tertentu.

### 3.4 Risiko teknis
- Rendah-menengah. Tidak butuh sistem baru besar, tapi butuh UI baru (indicator window aktif) dan tuning input-timing supaya terasa responsive di mobile touch, bukan cuma di keyboard testing.

---

## 4. Modul C — Inflammation Zone (Area Risk/Reward)

### 4.1 Konsep gameplay
Serangan hero (skill tertentu, bukan auto-attack biasa) menumpuk status "inflamasi" di area lantai, bukan di musuh. Zona ini damage-nya naik seiring waktu dibiarkan menyala. Kalau dibiarkan terlalu lama, zona memicu "cytokine storm" — damage besar ke semua musuh di dalamnya, tapi juga memberi splash damage ke hero kalau hero masih berdiri di dalam zona saat trigger terjadi. Ini menambah lapisan **positioning & risk management**, beda dari mekanik lain yang fokus ke damage output.

### 4.2 Struktur data
- `InflammationZone { id, x, y, radius, intensity, spawnTime, maxIntensity, stormTriggered: boolean }` — 1 instance per zona aktif di world.
- `intensity` naik linear/eksponensial terhadap waktu sejak `spawnTime` (formula disarankan: `intensity = min(maxIntensity, baseRate * elapsedSeconds^1.2)`).
- `stormThreshold` — nilai intensity yang memicu cytokine storm otomatis.

### 4.3 Titik integrasi
- **Zone spawner**: skill tertentu (bukan semua skill) menghasilkan `InflammationZone` baru di titik target/cast.
- **Per-frame tick**: setiap zona aktif melakukan overlap check terhadap semua entity (musuh + hero) dalam radius — damage musuh terus-menerus (DoT) sesuai `intensity` saat ini; kalau hero overlap dan zona trigger storm, apply damage ke hero juga.
- **VFX layer**: warna/opacity zona berubah seiring `intensity` naik (dari kuning pucat ke merah menyala) — ini sekaligus jadi sinyal gameplay bagi pemain untuk keluar dari zona sebelum storm trigger, tidak perlu UI tambahan di luar canvas.
- **Tidak butuh perubahan kamera** — seluruh efek cukup di render layer VFX + damage system, camera tetap follow player normal.

### 4.4 Risiko teknis
- Menengah. Overlap check per-frame terhadap banyak entity bisa jadi beban performa kalau tidak dioptimasi (gunakan spatial partitioning/grid sederhana kalau jumlah zona aktif bisa banyak bersamaan, jangan brute-force O(n²) distance check ke semua entity tiap frame).

---

## 5. Modul D — Tag-Cascade / Opsonisasi (Chain Reaction + Camera)

### 5.1 Konsep gameplay
Setiap hit menandai (tag) musuh. Musuh yang ter-tag dan mati memicu efek menyebar (cascade) ke musuh lain di sekitarnya, meniru cara kerja antibodi menandai patogen sebelum dihancurkan sel imun lain secara berantai.

### 5.2 Struktur data
- `EnemyStatus.tagged: boolean` — di-set true saat hero attack landing.
- `CASCADE_RADIUS` — radius pencarian target saat pathogen ter-tag mati.
- `chainHopIndex` — pelacak kedalaman rantai cascade (dibatasi maksimal 4-5 hop untuk mencegah loop tak terkendali di wave besar).

### 5.3 Alur bertingkat (ringkasan)
1. **Tier 1** — tag individual: feedback lokal saja (outline + partikel kecil), **tanpa efek kamera**.
2. **Tier 2** — pathogen ter-tag mati, target dalam radius < threshold: shockwave ring 2D tanpa kamera.
3. **Tier 3** — target dalam radius ≥ threshold: aktifkan hit-stop singkat (60-80ms) + punch-zoom kamera (~8-10%, ease-out ~250-300ms) + radial telegraph ring.
4. **Tier 4** — chain berlanjut ke hop berikutnya dengan intensitas kamera meluruh (decay factor ±0.6 tiap hop) sampai tidak ada target valid lagi.

### 5.4 Titik integrasi
- **Camera controller baru** — modul terpisah yang menangani hit-stop, punch-zoom, dan shake, dipanggil dari sistem damage saat kondisi cascade terpenuhi. Tidak menggantikan camera-follow yang sudah ada, hanya menambah layer efek di atasnya.
- **Damage/death event hook** — titik trigger cascade ada di event "enemy death", cukup cek status `tagged` sebelum memutuskan apakah memicu pencarian radius.

### 5.5 Risiko teknis
- Menengah-tinggi. Modul paling kompleks dari kelimanya karena melibatkan real-time spatial query (radius search) + state kamera dengan banyak kemungkinan overlap (beberapa cascade terjadi bersamaan saat wave padat). Wajib ada throttling/cap jumlah cascade aktif bersamaan untuk menjaga performa di device kelas menengah-bawah.

---

## 6. Modul E — Chemotaxis Trail (Active Movement/Positioning)

### 6.1 Konsep gameplay
Skill tertentu meninggalkan "jejak sinyal" di lantai saat hero bergerak. Hero yang lewat jejak sendiri (atau nanti sekutu, kalau ada fitur squad-swap) mendapat buff sementara — mendorong pemain membentuk pola pergerakan yang disengaja, bukan sekadar kabur dari musuh secara pasif.

### 6.2 Struktur data
- `TrailSegment { x, y, timestamp, buffType, buffValue }` — array segmen jejak yang di-spawn tiap interval pergerakan tertentu (misal tiap 0.15 detik pergerakan aktif).
- `TRAIL_LIFETIME` — durasi sebelum segmen jejak hilang (disarankan 3-5 detik).

### 6.3 Titik integrasi
- **Movement system hook** — tiap kali hero bergerak melebihi jarak minimum sejak segmen terakhir, spawn `TrailSegment` baru di posisi sebelumnya.
- **Collision check berkelanjutan** — perlu overlap check antara posisi hero saat ini dengan seluruh `TrailSegment` aktif tiap frame untuk menentukan apakah buff aktif.
- **Cleanup** — segmen dengan `timestamp` lebih tua dari `TRAIL_LIFETIME` harus dibuang dari array tiap frame (garbage collection manual) agar array tidak membengkak tanpa batas.

### 6.4 Risiko teknis
- Tinggi. Modul paling berat karena kombinasi rendering trail (butuh render layer tambahan) + collision check berkelanjutan + memory management array yang terus tumbuh/menyusut. Disarankan jadi modul terakhir yang dibangun, dan tim perlu profiling performa khusus di device low-end sebelum rilis.

---

## 7. Instrumentasi & Kriteria Evaluasi

Karena kelima modul dibangun paralel untuk dibandingkan, wajib ada tracking event berikut per modul (feature-flagged, bisa dinyalakan/dimatikan independen per modul untuk keperluan A/B test):

| Event | Data yang direkam | Tujuan |
|---|---|---|
| `module_trigger` | `moduleId`, `timestamp`, `waveNumber`, `intensityOrTier` | Frekuensi & konteks tiap mekanik terpicu |
| `module_session_correlation` | `moduleId`, `sessionDuration`, `runCompleted (bool)` | Korelasi antara exposure ke modul dan durasi sesi |
| `module_perf_sample` | `moduleId`, `frameTimeMs`, `activeInstanceCount` | Deteksi dini masalah performa per modul di device nyata |
| `module_d1_return` | `moduleId` (modul dominan yang paling sering ditrigger user tsb), `returnedNextDay (bool)` | Proxy retensi per gaya mekanik dominan |

**Kriteria keputusan setelah data terkumpul** (disarankan minimal 2 minggu playtest/soft-launch):
1. Modul dengan korelasi tertinggi ke `sessionDuration` & `d1_return` → kandidat jadi core identity mechanic.
2. Modul dengan `frameTimeMs` rata-rata di atas ambang batas (tentukan target FPS device rendah dulu, misal 30fps floor) → perlu dioptimasi ulang atau didrop meski feel-nya bagus.
3. Modul yang jarang ter-trigger secara organik (`module_trigger` rendah) → indikasi kondisi trigger terlalu ketat atau tidak terasa relevan bagi pemain, perlu revisi kondisi sebelum dinilai gagal secara feel.

---

## 8. Urutan Rilis yang Disarankan

1. **Sprint 1-2**: Modul A (Antigen Memory) + Modul B (Phagocytosis) — risiko rendah, cepat validasi ke playtest internal dulu.
2. **Sprint 3-4**: Modul C (Inflammation Zone) — sambil optimasi spatial check.
3. **Sprint 5-6**: Modul D (Tag-Cascade) — termasuk build & tuning camera controller baru.
4. **Sprint 7+**: Modul E (Chemotaxis Trail) — hanya lanjut kalau kapasitas tim & hasil profiling performa modul-modul sebelumnya masih sehat.

Semua modul tetap di belakang feature flag sampai fase evaluasi (Bagian 7) selesai — jangan hardcode salah satu sebagai "yang menang" sebelum data instrumentasi masuk.
