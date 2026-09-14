# PHAGOS — GAME BIBLE

**Versi:** 1.0 · **Tanggal:** 15 September 2026 · **Domain:** phagos.space
**Tagline:** "Telan. Bermutasi. Bertahan."
**Status:** Game baru. Branch terpisah dari `main`. Imunverse (branch 53a) di-freeze sebagai fallback.

Dokumen ini adalah SATU-SATUNYA sumber kebenaran untuk PHAGOS. Semua angka
diturunkan dari gameplay membran — bukan dari gameplay tembak Imunverse. Tidak
ada angka yang di-copy dari dokumen sebelumnya; semuanya dihitung ulang.

Dokumen pendamping: [PHAGOS-IDENTITY.md](PHAGOS-IDENTITY.md) (jiwa, bahasa,
bentuk, audio, diferensiasi pasar).

---

## 0. BENCHMARK PRODUKSI — "KAPAN PHAGOS SIAP"

PHAGOS production-ready ketika SEMUA item di bawah terpenuhi. Bukan "sebagian
besar" — semua.

### Gameplay

- [ ] Medan membran pasif melukai musuh lewat kontak (tanpa tombol)
- [ ] Pulse (satu tombol) meledakkan medan, cooldown per hero
- [ ] Engulf otomatis: musuh <15% HP di dalam medan terserap, hero heal
- [ ] 18 mutasi hero (3 tier) berfungsi dan visual berubah kumulatif
- [ ] 6 trait mutasi musuh muncul di wave 6/10/14 sebagai respons build
- [ ] 11 hero masing-masing punya bentuk medan unik (lingkaran/kerucut/tentakel/dll)
- [ ] 8–9 level up per run referensi (400 kill, 15 wave, 3 boss)
- [ ] Run 3–8 menit

### Progresi & ekonomi

- [ ] Biokredit (~916/run) dan Genom (Rp 30/Genom) berfungsi
- [ ] XP curve sesuai (80 + 35L, ~8 level/run)
- [ ] Battle Pass (Siklus Mitosis) 30 level selesai dalam ~26 hari
- [ ] Pangkat 13 tier selesai dalam ~14 hari
- [ ] Hero lv20 selesai dalam ~8 hari per hero
- [ ] Homeostasis lv 1–10 Biokredit, lv 11–25 Genom
- [ ] Welcome box (Kapsul Membran) setelah run pertama

### Monetisasi

- [ ] Tangga Genom 4 tier (Rp 15rb–99rb), monoton, validator hijau
- [ ] Kapsul Perdana (Rp 15.000, sekali per akun)
- [ ] Genom Harian (Rp 29.000, 30 hari drip)
- [ ] Siklus Mitosis premium (800 Genom, return 500)
- [ ] Iklan rewarded 10 Genom × 6/hari
- [ ] 2 sink berulang fungsional (Lanjut Run 50 Genom + Peti Mutasi 150 Genom)

### UI/UX

- [ ] Dashboard: hero besar dengan medan, topbar 3 indikator, dock 5 slot solid
- [ ] HUD: bar atas + bar bawah, Pulse cooldown indicator, hitung mundur reset
- [ ] Gameover: hook "kurang N run lagi" + pilihan hero untuk run ulang (kartu, bukan list)
- [ ] Kapsul buka animasi + share image
- [ ] Font kustom untuk heading/angka
- [ ] Semua teks "PHAGOS" (bukan Imunverse), semua mata uang Biokredit/Genom

### Infrastruktur

- [ ] PWA manifest + service worker + prompt pasang
- [ ] Save key `phagos.save.v1` dengan fallback migrasi dari key lama
- [ ] `npm run validate` (kedua validator) hijau
- [ ] Rebrand domain: phagos.space

---

## 1. CORE LOOP — MEMBRANE + PULSE + ENGULF

### 1.1 Tiga kata kerja

| Kata kerja | Input | Apa yang terjadi | Feel |
|---|---|---|---|
| **Kontak** | Gerak joystick ke arah musuh | Musuh di dalam medan membran terluka terus-menerus | Pasif, memuaskan, "aku menghancurkan dengan kehadiranku" |
| **Pulse** | Tekan tombol PULSE | Medan meledak ke 3× radius, semua di dalam terluka besar | Aktif, ledakan, "BOOM setiap 2 detik" |
| **Engulf** | Otomatis | Musuh <15% HP di dalam medan terserap, hero heal, dapat Bio-Point | Reward, "aku menelan mereka" |

**TIDAK ADA proyektil. TIDAK ADA tombol tembak. TIDAK ADA ammo.**

Satu joystick + satu tombol. Lebih sederhana dari shooter, tapi keputusannya
lebih kaya: arah mana yang dituju (posisi = damage), kapan Pulse (timing =
spike), dan build mutasi apa yang diambil (strategi = identitas run).

### 1.2 Run referensi

| Metrik | Nilai | Catatan |
|---|---|---|
| Wave | 15 | Boss di wave 5, 10, 15 |
| Total kill | 400 | Naik dari 250 (Imunverse) karena kontak multi-target |
| Kill kontak | 262 (65%) | Pasif, terjadi terus-menerus |
| Kill Pulse | 120 (30%) | ~8 per Pulse, ~15 Pulse per run |
| Engulf | 18 (5%) | ~1,2 per wave |
| Boss | 3 | Gate wave: wave membeku sampai boss mati |
| Level up | 8–9 | Satu per ~1,7 wave |
| Bio-Point | 18 | 1 per engulf, untuk beli mutasi tier 2/3 |
| Durasi | 5–7 menit | Target 6 menit rata-rata |
| Biokredit earned | 916 | Soft currency |

### 1.3 Mengapa kill rate 400 bukan 250

Medan kontak melukai semua musuh di dalamnya secara bersamaan. Dengan ~4 musuh
rata-rata di dalam medan, damage output per detik jauh lebih tinggi dari
proyektil satu-satu. Ini bukan bug — ini fitur. Gerombolan yang MELELEH saat
hero berjalan ke dalamnya adalah visual paling kuat dari sistem ini. Kill rate
tinggi = feel paling kuat.

Yang menjaga keseimbangan bukan menurunkan kill rate, tapi membuat XP curve
dan earn rate sesuai dengan rate baru.

---

## 2. MEDAN MEMBRAN — SPESIFIKASI

### 2.1 Properti dasar (simpan di `data/membrane.json`)

| Properti | Nilai | Keterangan |
|---|---|---|
| `contactDpsBase` | 8 | DPS dasar per musuh di dalam medan, sebelum scaling |
| `contactTickRate` | 0,1 detik | Damage di-apply setiap tick |
| `maxContactTargets` | 12 | Performance cap |
| `pulseRadiusMult` | 3,0 | Pulse expand ke 3× baseRadius |
| `pulseDuration` | 0,4 detik | Expand 0,15s + hold 0,1s + shrink 0,15s |
| `pulseDamageMult` | 4,0 | Pulse hit = 4× contactDps, sekali per musuh |
| `pulseCooldownBase` | 2,0 detik | Per hero (1,0–4,0) |
| `engulfThreshold` | 0,15 | HP < 15% → terserap |
| `engulfHealPct` | 0,07 | 7% max HP hero per engulf |
| `engulfBioPoint` | 1 | 1 Bio-Point per engulf |
| `engulfDuration` | 0,3 detik | Animasi penyerapan |

### 2.2 Rendering

- **Idle:** lingkaran semi-transparan berdenyut (skala 0,97–1,03, siklus 1,5
  detik), warna hero dengan opacity 18%. Tepi bergelombang organik (distorsi
  sinusoidal).
- **Kontak aktif:** opacity naik ke 35%, partikel percikan di posisi musuh.
- **Pulse:** expand ease-out → hold → shrink ease-in. Opacity 60% di puncak.
  Ripple shockwave. Screen shake tier 2.
- **Engulf:** garis tarikan musuh→pusat hero, musuh mengecil, partikel hijau
  spiral, flash putih. Hit-stop 0,15 detik.

### 2.3 Kontrol

| Input | Aksi |
|---|---|
| Joystick kiri | Gerak hero (sama seperti sekarang) |
| Tombol PULSE (kanan) | Ledakkan medan. Radial cooldown indicator di tombol. |

Tombol SERANG lama **dihapus**. Diganti PULSE. Tidak ada auto-fire karena
tidak ada fire.

---

## 3. 11 HERO — TRANSLASI KE MEMBRAN

Setiap hero punya **bentuk medan, perilaku Pulse, dan spesial engulf** yang
unik. Ini bukan variasi angka — ini variasi gameplay.

| Hero | Medan | Pulse | Engulf | Cooldown | baseRadius |
|---|---|---|---|---|---|
| **Mako** | Lingkaran besar | Dorong ke segala arah | Heal ×1,5, Bio-Point ×1,3 | 2,0s | 52 |
| **T-Bolt** | Kerucut 90° ke depan | Dash pendek + damage | Insta-kill <25% HP | 1,5s | 44 |
| **Dendri** | 3 tentakel 120° | Sapu berputar 180° | Mark musuh sekitar +30% dmg 3s | 2,5s | 40 |
| **Neutron** | Lingkaran kecil, DPS tinggi | Pulse cepat, radius kecil | Speed +20% selama 3s | 1,0s | 32 |
| **Eos** | Cone + trail belakang | Granul homing ke 5 target | ×3 dmg ke parasit | 2,0s | 40 |
| **Baso** | Lingkaran berdenyut (0,7–1,3×) | Awan histamin 3 detik | Slow semua musuh 20% 2s | 2,5s | 44 |
| **Mastia** | Tidak ada medan pasif | Pulse BESAR 4×, dmg tinggi | Armor stack +5% (maks 10) | 4,0s | 56 |
| **Helia** | Support: musuh dmg rendah, sekutu heal | Buff squad +20% dmg 3s | Shield 10% max HP | 2,0s | 48 |
| **Treg** | Slow semua (musuh 50%, hero 10%) | Cleanse debuff + 3s immunity | Hapus 1 efek negatif body | 3,0s | 48 |
| **Bella** | Auto-antibodi 1/detik ke terjauh | 8 antibodi ke segala arah | +1 antibodi/detik (maks +5) | 2,5s | 36 |
| **Nyx** | Tak terlihat: dmg muncul saat keluar medan | Teleport di belakang musuh terdekat | Insta-kill <30%, diam 0,5s setelahnya | 2,0s | 40 |

Simpan di `data/heroes.json` field `membrane: { shape, baseRadius,
contactDps, pulseCooldown, pulseRadiusMult, engulfSpecial, shapeParams }`.

---

## 4. MUTASI — 18 MUTASI HERO + 6 TRAIT MUSUH

### 4.1 Mutasi hero (simpan di `data/mutations.json`)

**Tier 1 — gratis (level 2+):** Berduri, Lengket, Jejak Toksik, Elastis,
Penyerap, Tipis
**Tier 2 — 5 Bio-Point (level 5+):** Implosi, Dua Lapis, Infeksi Balik,
Auto-Pulse, Regenerasi, Reflektor
**Tier 3 — 15 Bio-Point (level 9+):** Supernova, Fusi Simbiosis,
Metamorfosis, Reaksi Berantai, Adaptif, Membran Hidup

Detail lengkap tiap mutasi ada di `AGENT-GAMEPLAY-EXPERIMENT.md` §3.3 — copy
dari sana. Angka tidak berubah.

**Level up pool:**

- Level 2–4: 2 mutasi tier 1 + 1 stat boost (jaring pengaman)
- Level 5–8: 3 mutasi (tier 1 atau 2)
- Level 9+: 3 mutasi (tier 2 atau 3)

Stat boost tetap ada di level awal: +15% HP, +10% speed, +20% contactDps,
+15% engulf heal, -15% Pulse cooldown. Ini untuk pemain yang belum nyaman
dengan mutasi.

### 4.2 Mutasi musuh (simpan di `data/enemy-mutations.json`)

Di wave 6, 10, 14: sistem membaca `run.activeMutations` dan inject **strain
bermutasi** yang counter build.

| Trigger | Strain | Counter |
|---|---|---|
| radius total > 2× | Penembak Asam (ranged) | Memaksa mengejar |
| contactDmg > 2× | Kebal Membran (80% DR kontak) | Harus Pulse |
| engulf count > 10 | Beracun Saat Diserap (-15% HP hero) | Engulf jadi keputusan |
| pulse count > 8 | Kebal Knockback (perlu kontak 2s dulu) | Harus tahan di medan |
| pakai jejak/racun | Pemurni (ubah jejak jadi heal musuh) | Jejak jadi pedang bermata dua |
| balanced | Bermutasi Acak (ganti trait tiap 10s) | Unpredictable |

**Sinyal:** peringatan 5 detik sebelum wave mutasi, label "STRAIN BERMUTASI"
di atas musuh, warna berubah, RIA berkomentar.

---

## 5. XP & LEVEL UP — DIKALIBRASI KE KILL RATE 400

### 5.1 Sumber XP per kill

| Sumber | XP | Alasan |
|---|---|---|
| Kill kontak | 3 | Pasif, terjadi banyak, XP rendah per kill |
| Kill Pulse | 5 | Aktif, disengaja, XP lebih tinggi |
| Engulf | 20 | Langka, bermakna, XP tinggi |
| Boss kill | 60 | Momen besar |

**XP per run referensi:** 262×3 + 120×5 + 18×20 + 3×60 = 786 + 600 + 360 +
180 = **1.926 XP**

### 5.2 Formula level up

```
xpNeed(level) = 80 + 35 × level
```

| Level | XP needed | Kumulatif |
|---|---|---|
| 1 | 115 | 115 |
| 2 | 150 | 265 |
| 3 | 185 | 450 |
| 4 | 220 | 670 |
| 5 | 255 | 925 |
| 6 | 290 | 1.215 |
| 7 | 325 | 1.540 |
| 8 | 360 | 1.900 |
| 9 | 395 | 2.295 |

**Run referensi mencapai level 8** (1.926 vs 1.900 kumulatif). Level 9 hanya
tercapai di run yang sangat bagus (>430 kill). Tepat di target.

**Perbandingan dengan Imunverse:** run referensi lama memberi ~2–3 level per
run karena XP thresholdnya rendah. Itu terlalu cepat — mutasi yang dipilih
tidak sempat bermakna sebelum pilihan berikutnya muncul. 8 level per 15 wave
berarti satu mutasi baru setiap ~1,7 wave — cukup waktu untuk merasakan
efeknya sebelum memilih lagi.

---

## 6. EKONOMI — BIOKREDIT & GENOM

### 6.1 Kurs

| Mata uang | Rate | Referensi |
|---|---|---|
| **Genom** (premium) | Rp 30 / Genom | Tier referensi 500 Genom / Rp 15.000 |
| **Biokredit** (soft) | 1 Genom = 40 Biokredit | Rp 0,75 / Biokredit |
| **Bio-Point** (in-run) | tidak dijual | 1 per engulf, hanya dalam run, tidak disimpan |

### 6.2 Earn rate Biokredit per run

| Sumber | Jumlah | Total |
|---|---|---|
| Kill kontak | 262 × 1,0 | 262 |
| Kill Pulse | 120 × 1,5 | 180 |
| Engulf | 18 × 8 | 144 |
| Boss | 3 × 60 | 180 |
| Wave bonus | 15 × 10 | 150 |
| **Total** | | **916** |

### 6.3 Dinding sink

| Sink | Biaya | Run | Hari @3/hr | Mata uang |
|---|---|---|---|---|
| Hero lv20 (satu) | 22.404 | 24,5 | 8,2 | Biokredit |
| Hero lv20 (×12) | 268.848 | 293 | 97,8 | Biokredit |
| Homeostasis 1 jalur lv 1–10 | 701 | 0,8 | — | Biokredit |
| Homeostasis 1 jalur lv 11–25 | 116 Genom | — | — | Genom |
| Homeostasis 6 jalur total | 31.998 | — | — | Campuran |
| Diferensiasi (evolusi meta) | 167 fragmen | 33 | 11 | Drop |
| Mastery 1 hero | 6.100 XP | 8,5 | 2,8 | XP |

### 6.4 Tangga harga Genom

```
genom_500      Rp  15.000    30,0 Rp/Genom    referensi
genom_1000     Rp  25.000    25,0 Rp/Genom    +20% bonus
genom_2500     Rp  55.000    22,0 Rp/Genom    +36% bonus
genom_5000     Rp  99.000    19,8 Rp/Genom    +52% bonus
genom_12000    Rp 199.000    16,6 Rp/Genom    +81% bonus  (Fase 2, nonaktif)
```

### 6.5 Iklan rewarded

10 Genom × 6/hari = 60 Genom/hari. Tier terkecil 500 Genom = 8,3 hari iklan.

---

## 7. ITEM & CONSUMABLE — DIRANCANG UNTUK MEMBRAN

### 7.1 Item inti (reformulasi dari Imunverse)

| ID | Nama | Efek | Biaya toko |
|---|---|---|---|
| `serum_regenerasi` | Serum Regenerasi | +35% HP, medan berdenyut visual 5s | 200 BK |
| `enzim_litik` | Enzim Litik | Contact DPS ×2, engulf threshold 30%, 8 detik | 250 BK |
| `sitokin_burst` | Sitokin Burst | Speed +40% 10s, reset Pulse cooldown 1× | 200 BK |
| `lapisan_mukus` | Lapisan Mukus | Shield 25% max HP, musuh di shield slow 30% | 300 BK |
| `katalis_mitosis` | Katalis Mitosis | Biokredit ×1,5 sisa run, engulf ×2 Bio-Point | 350 BK |

### 7.2 Item baru (eksklusif membran)

| ID | Nama | Efek | Sumber |
|---|---|---|---|
| `opsonin` | Marker Opsonin | Mark semua musuh 8s: engulf threshold 35%, Pulse +30% | Toko 350 BK, drop boss |
| `atp_surge` | Ledakan ATP | Pulse instan + 3 Pulse berikutnya cooldown -60% | Toko 200 Genom, BP track |
| `membran_cadangan` | Membran Cadangan | HP <20%: medan kedua 6s (radius 0,5×, DPS 50%), 1× per run | BP track premium |
| `toksin_balik` | Racun Balik | 10s: refleksi 40% dmg yang diterima ke musuh di medan | Toko 200 BK |
| `sinapsis` | Sinyal Sinapsis | Pasukan medan mini 12s (jika opsi A squad) atau tembakan ×2 12s (opsi B) | Misi mingguan |

---

## 8. PROGRESI META — PACING DARI GAMEPLAY MEMBRAN

### 8.1 Siklus Mitosis (Battle Pass)

```
xpNeed(level) = 120 + 30 × level
totalXP(30 level) = 17.100
runXpCap = 150/run, dailyRunCap = 450
missionXp: daily 50 (×3), weekly 250 (×2)
dailyTotal = 450 + 150 + 71 = 671
expectedDays = 17.100 / 671 ≈ 25,5 hari → satu musim 30 hari ✓
```

Premium cost: 800 Genom, return 500, net −300/musim.

### 8.2 Pangkat

```
gpPerWave = 4, gpPerKill = 0.20, gpPerEngulf = 4
gpPerBoss = 25, gpVictory = 50
gpPerRun ≈ 60 + 80 + 72 + 75 + 50 = 337 (menang)
12.000 GP / 337 = 35,6 run ≈ 11,9 hari ✓
```

### 8.3 Hero upgrade

```
baseCost = 120, growth = 1.20, maxLevel = 20
totalCost(lv20) = 22.404 Biokredit
22.404 / 916 = 24,5 run ≈ 8,2 hari per hero ✓
```

### 8.4 Diferensiasi (evolusi meta)

```
dropChanceNormal = 0.004, dropChanceElite = 0.04
bossGuaranteed = 1 fragmen
stageCost: 50/50/50/17 = 167 total
~5 fragmen/run → 33 run ≈ 11 hari ✓
```

### 8.5 Kampanye

6 bab × 3 tingkat kesulitan = 18 clear. Kuota ×2,2 dari base.
expectedRunsPerClear = 2,5 → total 45 run ≈ 15 hari ✓

### 8.6 Komposisi sink

| Sink | Genom | Porsi | Tipe |
|---|---|---|---|
| Homeostasis lv 11–25 | 696 Genom (6 jalur) | 16% | Kekuatan |
| Hero unlock (sisa 9) | 2.460 Genom | 57% | Konten |
| Kosmetik | ~1.175 Genom | 27% | Kosmetik |

**90% dinding Imunverse = kekuatan tempur → diperbaiki:** homeostasis lv
1–10 dipindah ke Biokredit, sehingga 57% dinding Genom adalah unlock konten
(hero baru), bukan kekuatan.

---

## 9. MONETISASI

### 9.1 Katalog

| Produk | Harga | Isi | Kelas |
|---|---|---|---|
| Kapsul Perdana | Rp 15.000 | 400 Genom + 2.000 BK + skin_pendiri + 2 enzim + 2 serum | Starter, 1× per akun |
| genom_500 | Rp 15.000 | 500 Genom | Tangga |
| genom_1000 | Rp 25.000 | 1.000 Genom | Tangga |
| genom_2500 | Rp 55.000 | 2.500 Genom | Tangga |
| genom_5000 | Rp 99.000 | 5.000 Genom | Tangga |
| Kit Riset | Rp 65.000 | 2.500 Genom + 20.000 BK + 3 katalis + 3 mukus + 4 sitokin | Value bundle |
| Genom Harian | Rp 29.000 | 300 Genom langsung + 50 Genom/hari × 30 = 1.800 total | Subscription |

### 9.2 Sink berulang

| Sink | Harga | Layar | UI baru? |
|---|---|---|---|
| Lanjut Run | 50 Genom | revive modal | Tidak |
| Peti Mutasi | 150 Genom | bosschest modal | Tidak |
| Slot Loadout +1 | 300 Genom | prep screen | Ya |
| Reset Homeostasis | 200 Genom | upgrade screen | Ya |
| Refresh misi | 30 Genom | HUD | Ya |

### 9.3 Bonus pembelian pertama

2× sekali per tier, hanya genom_500 dan genom_1000.

### 9.4 Metode pembayaran

QRIS default (0,7%). E-wallet (2,0%). Kartu jangan default (7,26% efektif
di Rp 55.000).

---

## 10. RETENSI

### 10.1 Comeback

- Peluruhan imunitas (body system) dibatasi 2 hari offline
- Absen ≥3 hari: hadiah kembali berjenjang + pemulihan tubuh gratis
- Streak harian: 1 hari pengampunan, reward di hari 2/3/5/7/14/30, berputar
  dari hari 7

### 10.2 Hook akhir sesi

Layar gameover menampilkan **3 progres terdekat** dari semua sistem,
dinyatakan dalam "kurang N run lagi." Dipilih dari laju pemain itu sendiri,
bukan rata-rata.

### 10.3 Welcome box (Kapsul Membran)

Setelah run pertama: buka kapsul → hero acak dari pool 6 hero (Neutron 30%,
Eos 22%, Helia 22%, Dendri 15%, Bella 8%, Baso 3%). Animasi layak direkam.
Tombol BAGIKAN generate gambar 1080×1080.

### 10.4 Hitung mundur reset harian

Tampil di 3 permukaan: dashboard, gameover, panel misi. Penekanan visual
saat <4 jam.

### 10.5 Strain of the Week

1 trait musuh global per minggu (seed dari minggu Unix). 15% musuh mulai
wave 4 punya trait. Banner di dashboard.

---

## 11. UI/UX OVERHAUL

### 11.1 Dashboard

```
┌─────────────────────────────────────────────┐
│ [Avatar+Nama] [Pangkat chip] [BK] [Genom]   │  ← Topbar: selalu tampil
├─────────────────────────────────────────────┤
│                                             │
│          [HERO BESAR + MEDAN BERDENYUT]     │  ← Hero "memiliki" dashboard
│          [Strain of the Week banner]        │
│                                             │
│     ┌──────────────────────────────────┐    │
│     │ Siklus Mitosis: Lv 4 ████░░ 12% │    │  ← Progress bar BP
│     └──────────────────────────────────┘    │
│                                             │
│     ┌──────────────────────────────────┐    │
│     │ [Kapsul Membran belum dibuka!]   │    │  ← Conditional: hanya jika belum
│     └──────────────────────────────────┘    │
│                                             │
│         ╔══════════════════════════╗        │
│         ║      ▶ MAIN            ║        │  ← Tombol besar coral
│         ╚══════════════════════════╝        │
│                                             │
├─────────────────────────────────────────────┤
│ [Hero] [Tas] [■MAIN■] [Squad] [Lab Genom]  │  ← Dock: solid, ikon+label, badge
└─────────────────────────────────────────────┘
```

### 11.2 HUD in-run

```
┌─────────────────────────────────────────────┐
│ [HP bar]  WAVE 7  ☠ 142  ⏱ 02:31  [BK] [G]│  ← Bar atas: solid semi-opaque
├─────────────────────────────────────────────┤
│                                             │
│                 [GAMEPLAY]                   │
│                                             │
├─────────────────────────────────────────────┤
│ [Misi progress] [Item1][Item2]  [PULSE ◐]  │  ← Bar bawah: misi kiri, Pulse kanan
│                                [cd 1.2s]   │     Cooldown radial pada tombol
└─────────────────────────────────────────────┘
```

### 11.3 Gameover / pilihan hero

```
┌─────────────────────────────────────────────┐
│              RUN SELESAI                     │
│     Wave 15 · 412 kill · 22 engulf          │
│     Biokredit +916 · Bio-Point 22           │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ KURANG 1 RUN LAGI ──────────────────┐  │
│  │ ⬡ Buka Eos: 2.900/3.000 kill  [97%] │  │  ← Hook akhir sesi
│  │ ⬡ Pangkat Fagosit: 940/1.100   [85%] │  │
│  │ ⬡ Mitosis Lv 5: 160/200 XP    [80%] │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  PILIH HERO UNTUK RUN BERIKUTNYA:           │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│  │Mako│ │Neut│ │Eos │ │Dend│ │T-Bo│       │  ← Kartu hero: gambar+medan
│  │ ●  │ │ ○  │ │ 🔒 │ │ ○  │ │ 🔒 │       │     ● = terakhir, ○ = unlocked
│  └────┘ └────┘ └────┘ └────┘ └────┘       │     🔒 = locked (greyed)
│          ◄ swipe ►                          │
│                                             │
│         ╔══════════════════════╗            │
│         ║    ▶ MAIN LAGI     ║            │  ← (label: MAIN LAGI)
│         ╚══════════════════════╝            │
│                                             │
│  [🎬 Iklan 2× BK]  [📤 Bagikan]  [🏠 Home] │
└─────────────────────────────────────────────┘
```

Kartu hero menampilkan: gambar hero kecil + bentuk medan (outline) + nama.
Hero yang baru saja dimainkan ditandai. Hero yang terkunci tampil greyed
tapi tetap terlihat (aspirasional). Swipe horizontal. Tap untuk memilih,
lalu Main Lagi.

### 11.4 Prinsip visual

| Aturan | Implementasi |
|---|---|
| Dock harus terbaca | Background solid gelap #1a2332, ikon dengan outline putih, label putih bold |
| Karakter "memiliki" dashboard | Hero minimal 40% tinggi layar, medan membrannya berdenyut |
| HUD tidak mengambang | Dua bar (atas + bawah) dengan background semi-opaque #0d1117 opacity 75% |
| Container card untuk konten | Border organik (bentuk membran), radius 16px, shadow subtle |
| Font kustom | Satu font bold untuk heading/angka (Baloo, Bungee, atau setara). Font sistem untuk body |
| Palet | Teal #0d7377 (arena), Coral #ff6b6b (CTA/bahaya), Sage #7cb68e (heal/progres), Gold #f5c64f (Genom), Ungu #9f7aea (langka) |

---

## 12. INFRASTRUKTUR

### 12.1 Save

Key baru: `phagos.save.v1`. Fallback: jika kosong dan `imunverse.save.v1`
ada, salin sekali. Field internal `meta.currency` dan `meta.imun` TIDAK
direname (risiko rusak save) — rename hanya di lapisan tampilan.

### 12.2 PWA

Manifest + service worker + prompt pasang setelah run ke-3. Ikon: logo
PHAGOS compact.

### 12.3 Validator

`npm run validate` menjalankan:

- `validate-catalog.mjs` — audit tangga harga Genom (semua angka baru)
- `validate-retention.mjs` — audit pacing dari kill rate 400

Kedua validator harus ditulis ulang dengan angka baru, bukan di-patch dari
versi Imunverse.

---

## 13. ROADMAP — URUTAN BUILD

### Sprint 1 — Core combat (PALING KRITIS)

1. Buat branch baru dari `main`
2. Buat `data/membrane.json`
3. Implementasi medan kontak pasif saja (tanpa Pulse, tanpa engulf)
4. **CHECKPOINT: test di device.** Hero berjalan, musuh terluka. Ini harus
   TERASA BENAR.
5. Tambah Pulse (satu tombol, expand-shrink, cooldown)
6. **CHECKPOINT: test di device.** Pulse harus MEMUASKAN (shake, stop,
   partikel).
7. Tambah engulf (threshold, animasi, heal, Bio-Point)
8. Hapus semua kode proyektil dari pipeline (komentari, jangan delete)
9. XP curve baru (80 + 35L)
10. Rebrand tampilan: PHAGOS, Biokredit, Genom, semua string

### Sprint 2 — Mutasi & hero

11. Buat `data/mutations.json` (18 mutasi)
12. Level up menampilkan kartu mutasi, efek diterapkan, visual berubah
13. Buat `data/enemy-mutations.json` (6 trait)
14. Inject strain bermutasi di wave 6/10/14
15. Translasi 11 hero satu per satu (Mako dulu, Nyx terakhir)
16. **CHECKPOINT: test semua hero.** Setiap hero harus terasa BERBEDA.

### Sprint 3 — Ekonomi & progresi

17. Earn rate Biokredit dari kill rate baru
18. Item reformulasi + 5 item baru
19. Retune: BP (Siklus Mitosis), pangkat, diferensiasi, hero upgrade, kampanye
20. Validator baru — tulis ulang, bukan patch
21. **CHECKPOINT:** `npm run validate` **hijau.**

### Sprint 4 — Monetisasi & toko

22. Katalog Genom (tangga + bundle + Genom Harian)
23. Bonus pembelian pertama
24. 2 sink berulang (Lanjut Run + Peti Mutasi)
25. Welcome box (Kapsul Membran + animasi + share)

### Sprint 5 — UI overhaul

26. Dashboard: hero besar, topbar, dock solid
27. HUD: dua bar, Pulse cooldown indicator
28. Gameover: hook + kartu hero + share
29. Font kustom
30. Hitung mundur reset harian

### Sprint 6 — Retensi & akuisisi

31. Comeback system (peluruhan, streak, hadiah kembali)
32. Session hook
33. Strain of the Week
34. Challenge link
35. PWA + prompt pasang
36. Referral tracking (simpan data, hadiah nanti)

### Sprint 7 — Polish & benchmark

37. Gamefeel tuning (shake, stop, partikel untuk setiap aksi)
38. Audio (jika ada resource)
39. Jalankan seluruh benchmark produksi §0
40. Fix semua yang belum ✓

**Aturan antar sprint:** sprint 1 HARUS selesai dan di-test sebelum sprint 2.
Setiap checkpoint yang bertanda "test di device" berarti STOP dan tunggu
feedback sebelum lanjut. Jangan stack semua sprint tanpa verifikasi.

---

## 14. APA YANG BISA DIAMBIL DARI IMUNVERSE

| Komponen | Bisa dipakai? | Catatan |
|---|---|---|
| Wave system & spawner | Ya | Angka wave/enemy count mungkin perlu tuning, tapi arsitekturnya sama |
| Screen system & event bus | Ya | Infrastruktur UI tidak berubah |
| Save manager | Ya | Ganti key, tambah fallback |
| Body system | Ya | Mekanik decay sama, rename ke "Imunitas" |
| Ranks/pangkat | Ya | Angka GP baru, arsitektur sama |
| Mastery | Ya | Sama |
| Campaign map | Ya | Tambah kesulitan |
| Hero unlock gates | Ya | Statistik berbeda (engulf count sebagai gate baru) |
| Payment system shell | Ya | grantContents perlu handle tipe baru |
| Cosmetics system | Ya | Sama |
| metrics.js ring buffer | Ya | Tambah field engulf/pulse |
| **Projectile system** | **TIDAK** | Hapus / komentari seluruhnya |
| **Upgrade pool lama** | **TIDAK** | Diganti mutasi |
| **Ammo/fire rate/aim** | **TIDAK** | Tidak ada konsepnya |
| **Auto-fire** | **TIDAK** | Tidak relevan |
| **economy-anchors.json lama** | **TIDAK** | Semua angka berubah |
| **premium.json lama** | **TIDAK** | Produk dan nama berubah |
| **retention-config.json lama** | **TIDAK** | Semua target pacing berubah |

---

## 15. YANG TIDAK DIPUTUSKAN DI DOKUMEN INI

| Keputusan | Opsi | Siapa yang memutuskan |
|---|---|---|
| Pasukan: medan mini (A) vs tetap tembak (B) | A lebih konsisten, B lebih variatif | Owner, setelah test sprint 2 |
| Fagositosis menghapus drop? | Trade-off heal vs loot, atau efek samping? | Owner |
| Audio/musik | Butuh resource | Owner |
| Tutorial | Ditunda ke akhir (keputusan sebelumnya) | Owner |
| Server-side save | Belum — localStorage + PWA dulu | Owner, setelah ada revenue |
| Tier whale Rp 199.000 | Nonaktif sampai ada ARPPU | Owner, setelah ada data |
