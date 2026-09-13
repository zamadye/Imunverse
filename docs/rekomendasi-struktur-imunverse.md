# STRUKTUR TERPADU IMUNVERSE — MONETISASI & RETENSI

**Versi:** 2.0 · menggantikan `rekomendasi-struktur-monetisasi.md` v1.0
**Tanggal:** 13 September 2026
**Menanggapi:** `iap-audit-finance-2026-09-13.md` (commit `1c43f41`) dan `gameplay-struktur-workflow-2026-09-13.md` (commit `dfa2270`), BUILD 54a
**Verifikasi tambahan:** pemeriksaan langsung build live di `imunverse.fun` (13 Sep 2026)

Semua angka dihasilkan oleh dua validator yang disertakan, bukan diketik manual. `npm run validate` mereproduksi seluruh tabel di dokumen ini.

---

## 0. Tesis: ini satu struktur, dan bagian yang lemah adalah retensinya

Dokumen v1 merekomendasikan tiga produk yang bergantung pada waktu:

| Produk | Syarat waktu | Bisakah dipenuhi hari ini? |
|---|---|---|
| Kartu Imun 30 Hari (Rp 29.000) | 30 hari login berturut | Tidak |
| Battle Pass 800 Imun | 30 level dalam satu musim | Tidak — 30 level selesai dalam **6,1 run** |
| Sink Imun berulang | pemain masih ada di bulan kedua | Tidak |

Setelah membedah struktur gameplay, satu angka menjelaskan semuanya:

> **Seluruh konten utama Imunverse habis dalam 6 run — sekitar 40 menit.**
> Enam bab kampanye, masing-masing berkuota 25–50 kill, sementara satu run
> referensi menghasilkan 250 kill. Battle Pass 30 level: 6,1 run. Pangkat 13
> tier: 10,6 run. Pohon evolusi: **0,6 run** — selesai sebelum run pertama
> berakhir.

Di sisi lain, level hero 20 untuk satu hero butuh 165 run, dan seluruh roster 1.975 run — di luar umur hidup game mana pun.

Jadi masalahnya bukan "kurang konten". Masalahnya adalah **kurva progresi tidak pernah dikalibrasi terhadap laju bermain yang sebenarnya**: separuh sistem selesai dalam dua hari, separuh lagi butuh dua tahun, dan tidak ada satu pun yang berumur satu musim.

Itu sebabnya kedua dokumen ini digabung. Tangga harga yang rapi tidak menyelamatkan game yang habis dalam 40 menit, dan kurva progresi yang benar tidak menghasilkan uang tanpa katalog yang konsisten. Urutan pengerjaannya pun terikat: **perbaiki penyimpanan dan pacing dulu, katalog IAP kedua.**

---

## 1. Enam keputusan monetisasi + enam keputusan retensi

| # | Keputusan | Nilai |
|---|---|---|
| M1 | Kurs resmi Imun | **Rp 30 / Imun** pada tier referensi 500 |
| M2 | Kurs resmi Antibodi | **1 Imun = 40 Antibodi** (Rp 0,75 / Antibodi) |
| M3 | Tangga harga | 500 / 1.000 / 2.500 / 5.000 pada Rp 15rb / 25rb / 55rb / 99rb |
| M4 | Produk retensi utama | Kartu Imun 30 Hari Rp 29.000 — menggantikan Bebas Iklan |
| M5 | Faucet iklan | 10 Imun × 6/hari (dari 30 × 5) |
| M6 | Battle Pass | 800 Imun, mengembalikan 500, net −300/musim |
| **R1** | **Simpanan** | **Server-side save wajib — localStorage saja tidak layak rilis** |
| **R2** | **Pacing** | **Retune 5 kurva; kampanye ×3 tingkat kesulitan** |
| **R3** | **Comeback** | **Batasi peluruhan offline 2 hari + hadiah kembali + streak berampun** |
| **R4** | **Hook akhir sesi** | **Tampilkan "kurang N run lagi" dari sistem terdekat** |
| **R5** | **Onboarding** | **Auto-fire saat diam + tutorial 60 detik + lepas kunci landscape di menu** |
| **R6** | **Instrumentasi** | **Kirim D1/D7/D30 keluar perangkat — sekarang mustahil diukur** |

---

## 2. Yang sudah benar (dan jangan diubah)

Struktur teknisnya di atas rata-rata untuk game buatan satu orang: 34 file data sebagai satu-satunya sumber kebenaran, event bus satu arah antara gameplay dan UI, gerbang fitur *fail-closed*, migrasi save yang tidak pernah mereset pemain lama, `gamefeel.json` terpisah, dan `metrics.js` yang sudah menghitung *one-more-run rate*.

Tiga keputusan desain yang secara khusus tepat dan tidak boleh dikorbankan saat retune:

- **Gerbang boss membekukan wave.** Ini memberi run struktur babak, bukan grafik naik datar.
- **Contact attack bertelegraph 0,35 detik.** Musuh yang bisa dihindari mengubah kerumunan dari pajak HP menjadi keterampilan.
- **Elite dipromosikan dari sarang jauh, bukan RNG murni.** Momen yang bisa diantisipasi. Ini juga yang membuat drop langka di §6.4 bisa digantung ke sana dengan jujur.

Bagian berikut adalah tentang apa yang terjadi **di antara** run, bukan di dalamnya.

---

## 3. Temuan P0 retensi

### R-P0-1 — Progres pemain terhapus sendiri setelah 7 hari

`save-manager.js` menulis ke `localStorage` key `imunverse.save.v1`. `account-system.js` (172 baris) membuat akun **lokal**; tidak ada backend.

WebKit menghapus seluruh penyimpanan yang bisa ditulis skrip setelah tujuh hari tanpa interaksi: <cite index="52-1">setelah tujuh hari penggunaan Safari tanpa interaksi pengguna pada sebuah situs, seluruh script-writable storage dihapus, termasuk cookie first-party dan LocalStorage</cite>. <cite index="59-1">Ini berlaku juga untuk browser lain di iOS karena aturan platform Apple mewajibkan semua browser memakai WebKit</cite>. Aplikasi yang dipasang ke home screen dikecualikan, tetapi itu hanya menyelamatkan pemain yang sudah memasang.

Tiga konsekuensi:

1. **D7 dan D30 secara struktural nol di iOS.** Pemain yang absen delapan hari kembali ke akun kosong. Semua benchmark di bawah menjadi tidak relevan.
2. **Copy di layar auth adalah janji yang tidak bisa ditepati.** Live build menuliskan: progres, level hero & pembelian tersimpan aman dengan nama pemain sendiri. Sistemnya tidak menyimpan apa pun di luar perangkat.
3. **Begitu PSP nyata menyala, ini menjadi masalah hukum.** Pemain membayar Rp 99.000, browser membersihkan penyimpanan, entitlement lenyap, tidak ada catatan server untuk memulihkan. Audit finance sudah menuliskan jalan keluarnya di `payment-system.js:7` — grant entitlement dari server — tetapi itu mensyaratkan server yang belum ada.

**Rekomendasi.** Save server-side sebelum apa pun yang lain. Konektor Supabase sudah tersambung di lingkungan kerja Anda; skema minimalnya tiga tabel (`accounts`, `saves`, `receipts`) dengan `saves.meta` sebagai JSONB dan `updated_at` untuk resolusi konflik last-write-wins. localStorage tetap dipakai sebagai cache offline, bukan sebagai sumber kebenaran.

### R-P0-2 — Peluruhan tubuh menghukum pemain yang kembali

`body-systems.json`: lima sistem meluruh 1 poin/hari secara rolling; di bawah 20 sistem menjadi kritis dan menerapkan penalti run (sirkulasi kritis → cooldown ×1,25).

Pemain yang absen 20 hari kembali ke lima sistem kritis dan run pertamanya lebih sulit daripada saat ia pergi. Itu kebalikan dari win-back, dijalankan tepat di momen paling rapuh dalam hidup seorang pemain.

**Rekomendasi.** `comeback-system.js` yang disertakan: peluruhan offline dibatasi 2 hari, absen ≥3 hari memicu hadiah kembali berjenjang termasuk pemulihan tubuh gratis, dan streak harian punya satu hari pengampunan.

### R-P0-3 — Tidak ada onboarding sama sekali

`tutorial-system.js` dibangun utuh (283 baris) lalu dimatikan pada RONDE-7 (`shouldRun ≡ false`). `coach.json` berisi 0 langkah, sehingga `coach.js` berjalan tanpa konten. Yang tersisa: cutscene 3D lalu pemain dilempar ke run pertama.

Ini bertemu dengan dua friksi lain di detik yang sama (R-P0-4 dan R-P0-5). Benchmarknya tidak ramah: <cite index="44-1">median D1 sekitar 22%, D7 di bawah 4%, dan D30 sekitar 0,7–0,8%</cite>, sementara <cite index="46-1">profil "baik" yang realistis adalah D1/D7/D30 = 35/15/5</cite>. Dan <cite index="46-1">D1 yang rendah adalah masalah sesi pertama: periksa penyelesaian FTUE, panjang sesi pertama, dan titik pemain berhenti di tutorial</cite>.

### R-P0-4 — Serangan 100% manual di genre yang auto-attack

Keputusan RONDE-5 membuat serangan hanya terjadi saat tombol SERANG ditahan — termasuk untuk pasukan. Vampire Survivors, Brotato, dan 20 Minutes Till Dawn semuanya auto-fire; itu bukan kemalasan desain, itu alasan genre ini bekerja di ponsel, karena tangan pemain dibebaskan untuk gerak dan menghindar.

Menahan tombol tembak sambil menggerakkan joystick mengubahnya menjadi twin-stick shooter — genre yang jauh lebih sulit dan jauh lebih sempit pasarnya.

**Rekomendasi (jalan tengah, bukan pembatalan).** Model Archero: **auto-fire saat pemain diam**, tahan-untuk-tembak tetap berfungsi saat bergerak, aim manual tetap ada. Perubahannya kecil di `game.js` tahap 7 pipeline, tetapi ia menghapus pengalaman "kenapa tidak terjadi apa-apa" di 10 detik pertama. Sediakan toggle "Serang otomatis" di profil supaya pemain mahir bisa mematikannya.

### R-P0-5 — Kunci landscape pada sesi 3–8 menit

Build live menampilkan gerbang rotasi: game hanya dimainkan dalam mode lanskap. Untuk sesi pendek di ponsel, landscape memaksa dua tangan dan membuat game tidak bisa dimainkan di angkot, di antrean, atau diam-diam. <cite index="44-1">Median game mobile mendapat ~12 menit playtime harian dengan sesi ~3,1–3,5 menit dan ~3,8 sesi/hari</cite> — pola itu adalah pola satu tangan.

**Rekomendasi.** Minimal: seluruh layar menu (dashboard, roster, shop, prep, gameover — semuanya sudah bertata letak vertikal di DOM) tidak boleh diblokir gerbang rotasi; kunci landscape hanya saat `screen === 'gameplay'`. Idealnya: mode portrait untuk gameplay dengan kamera yang lebih zoom-in.

### R-P0-6 — Retensi tidak bisa diukur

`metrics.js` menyimpan ring buffer 200 run di `localStorage` key `imunverse.metrics.v1` dan sudah menghitung KPI yang tepat termasuk *one-more-run rate*. Data itu tidak pernah meninggalkan perangkat.

Artinya D1, D7, dan D30 tidak diketahui, dan tidak ada satu pun rekomendasi di dokumen ini — termasuk milik saya — yang bisa dibuktikan atau dibantah. **Ini prasyarat untuk semua yang lain.** Endpoint `POST /telemetry` di VPS yang sudah Anda punya, mengirim event `session_start`, `run_end`, `purchase`, dan `ad_watched` dengan `account_uid` + timestamp, sudah cukup untuk menghitung ketiganya.

### R-P0-7 — Iklan reward sekarang mengkanibal katalog IAP

(Dibawa dari v1, karena ini temuan lintas dokumen.) Pada 30 Imun per tayangan dan kurs Rp 30/Imun, satu iklan memberi **Rp 900** nilai sementara menghasilkan sekitar **Rp 65** pendapatan pada eCPM rewarded APAC USD 4 — <cite index="13-1">eCPM regional sekitar $6,50 Amerika Utara, $5,00 Eropa, dan $4,50 Asia-Pasifik</cite>.

Rasio 13,8× itu membuat tier terkecil Rp 15.000 setara 3,4 hari menonton iklan. Katalog IAP seberapa pun rapinya tidak akan laku selama faucet ini terbuka.

---

## 4. Temuan pacing — tabel yang paling penting di dokumen ini

Run referensi: wave 15 · 250 kill · 3 boss · hero level 12 in-run · 3 run/hari.
Turunan: 27 elite/run · 1.050 antibodi/run · 254 GP/run · 5,08 fragmen/run.

| Sistem | Sebelum | Sesudah | Target | Hari @3 run |
|---|---|---|---|---|
| Kampanye (6 bab) | **6,0 run** | 45,0 run | 45 | 15,0 |
| Battle Pass 30 level | **6,1 run** | 81,7 run | 85 | 27,2 |
| Pangkat 13 tier | **10,6 run** | 47,3 run | 48 | 15,8 |
| Pohon evolusi | **0,6 run** | 32,9 run | 33 | 11,0 |
| Mastery 1 hero | 9,4 run | 9,4 run | 9 | 3,1 |
| Level 20 satu hero | **164,6 run** | 34,0 run | 34 | 11,3 |
| Seluruh upgrade squad | 133,0 run | 133,0 run | 133 | 44,3 |
| Level 20 seluruh 12 hero | **1.975 run** | 408 run | — | — |

Perhatikan bentuknya. Sebelum: empat sistem tamat dalam kurang dari 11 run, satu sistem butuh dua tahun, tidak ada yang di tengah. Sesudah: tangga yang naik rapi dari 9 run sampai 133 run, sehingga di titik umur mana pun selalu ada satu sistem yang hampir selesai — dan itulah bahan bakar hook di §6.3.

### Perubahan yang menghasilkannya

**Kampanye.** Kuota ×2,2 plus tiga tingkat kesulitan per bab (Normal / Sulit / Kritis). `hpMult` per bab sudah ada di `campaign.json`, jadi ini murni penambahan data: 6 bab → 18 penyelesaian tanpa satu pun aset baru. Ini pengganda konten termurah yang tersedia.

**Battle Pass.** `xpNeed` naik dari `40 + 10L` ke `100 + 25L` (total 5.850 → 14.625 XP), dan XP per run dibatasi 120 dengan batas harian 360, sisanya datang dari misi (harian +40, mingguan +200, bab bersih +150). Pergeserannya disengaja: pass berhenti menghargai **satu run panjang** dan mulai menghargai **kehadiran harian**. Itulah yang membuat Kartu Imun 30 Hari punya arti.

**Pangkat.** Seluruh nilai GP dibagi 4,5.

**Evolusi.** `dropChanceNormal` 6% → 0,4%, elite 30% → 4%, boss guarantee 2 → 1 fragmen; biaya tahap naik ke 50/50/50/17 (total 167 fragmen).

**Level hero.** `growth` 1,35 → 1,22. Satu hero 165 → 34 run; seluruh roster 1.975 → 408 run.

---

## 5. Struktur monetisasi

### 5.1 Akar masalah harga: jangkarnya, bukan bundle-nya

Jangkar `"1 antibodi dasar ± Rp 10"` di `premium.json` salah sekitar 13×. Tiga bukti independen:

1. **Uji dinding.** Dinding Antibodi 2.228.946. Pada Rp 10, konten soft-currency game ini bernilai Rp 22,3 juta.
2. **Uji laju giling.** Pemain memanen ~3.200 Antibodi/hari. Pada Rp 10, bermain 45 menit "menghasilkan" Rp 32.000 — dua kali harga bundle termurah.
3. **Uji rasio internal.** Laju F2P memberi rasio 21:1; rasio dinding sink memberi 51,6:1. Tengah geometriknya 33. Angka Rp 10 menyiratkan 3:1.

Semua "nilai negatif" di §3 audit finance adalah artefak jangkar itu. Dinilai ulang pada kurs benar, tidak ada bundle lama yang negatif — tetapi sebarannya tetap **17,7×**, jadi harga jualnya memang juga tidak pernah diturunkan dari satu model.

**Prinsip arsitektur.** `premium.json` tidak boleh lagi menyimpan angka nilai apa pun; ia hanya menyimpan harga jual dan isi. Semua nilai dan badge dihitung runtime dari `economy-anchors.json`. Itu membuat temuan P0-3 ("HEMAT 72%" tidak dapat direproduksi) mustahil terulang secara struktural, bukan karena disiplin tim.

### 5.2 Jangkar pasar

| Referensi | Angka |
|---|---|
| Diamond MLBB Indonesia | <cite index="22-1">sekitar Rp 270 per diamond per Juni 2026, berkisar Rp 236–285 tergantung ukuran paket, dengan patokan resmi 50 diamond = US$0,99</cite> |
| Kenaikan harga MLBB | <cite index="23-1">penyesuaian sekitar 12% untuk transaksi uang asli di Indonesia berlaku 12 Agustus 2026</cite> |
| Bonus isi ulang pertama | <cite index="22-1">Double Diamonds First Recharge masih aktif pada 2026 di tier 50/150/250/500, sekali per tier</cite> |
| Struktur tier | <cite index="30-1">tawarkan 3–5 tier harga untuk menangkap tingkat belanja berbeda: kasual, moderat, premium, whale</cite> |
| Konversi pembayar | <cite index="6-1">sebagian besar game menargetkan tingkat pembayar 2–5% dari DAU</cite>; skenario konservatif <cite index="8-1">hanya 0,8% pengguna melakukan pembelian dalam aplikasi</cite> |
| Biaya gateway | <cite index="36-1">QRIS 0,7% di semua platform per Juli 2026; kartu kredit sekitar 2,8–2,9% + Rp 2.000</cite>; <cite index="38-1">tarif QRIS, GoPay, dan ShopeePay di Midtrans sudah termasuk PPN, sisanya belum</cite> |

Imun pada Rp 30 membuat skin termahal (400 Imun) = Rp 12.000, sekitar 9× lebih murah per unit premium daripada MLBB. Itu posisi yang benar untuk judul baru tanpa ekuitas merek, distribusi web, target tier-2/3 — dan menaikkan harga selalu lebih mudah daripada menurunkannya.

### 5.3 Katalog final (hasil validator)

```
produk            kelas                   harga     Imun   Rp/Imun    nilai isi badge
bundle_perdana    starter             Rp 15.000      400     37,50    Rp 21.570 HEMAT 30%
imun_500          currency_ladder     Rp 15.000      500     30,00    Rp 15.000 referensi
imun_1000         currency_ladder     Rp 25.000    1.000     25,00    Rp 30.000 +19% BONUS
imun_2500         currency_ladder     Rp 55.000    2.500     22,00    Rp 75.000 +36% BONUS
imun_5000         currency_ladder     Rp 99.000    5.000     19,80   Rp 150.000 +51% BONUS
· imun_12000      currency_ladder    Rp 199.000   12.000     16,58   Rp 360.000 +80% BONUS
bundle_riset      value_bundle        Rp 65.000    2.500     26,00    Rp 91.718 HEMAT 29%
pass_bulanan      subscription        Rp 29.000    1.800     16,11    Rp 54.000 HEMAT 46%
· bundle_noads    entitlement         Rp 89.000      500    178,00    Rp 15.000 dipensiunkan
```

**Bonus pembelian pertama** 2× sekali per tier, hanya pada dua tier terbawah: `imun_500` pertama = 1.000 Imun (Rp 15/Imun), `imun_1000` pertama = 2.000 Imun (Rp 12,50/Imun). Alat konversi, bukan diskon whale; investasi maksimum 1.500 Imun untuk belanja Rp 40.000.

**Mengapa Paket Perdana hanya 400 Imun.** Rancangan pertama saya memberinya 600. Validator menolaknya: pada harga yang sama ia mendominasi `imun_500` — persis pola P0-2 yang sedang kita perbaiki, hanya dengan pelaku berbeda.

**Margin bersih** pada tier Rp 55.000: QRIS Rp 54.615 (biaya 0,70%) · e-wallet Rp 53.900 (2,00%) · kartu Rp 51.010 (7,26%). Jangan jadikan kartu default di UI; pada tier Rp 15.000 biaya tetap Rp 2.000 saja sudah 13% dari harga.

### 5.4 `bundle_noads` menghukum pembelinya

Kelima placement iklan bersifat **opt-in rewarded**: tile toko, peti boss, revive, currency akhir run, pemulihan dashboard. Tidak ada iklan paksa di build ini. `meta.noAds` mematikan seluruh interupsi iklan, sehingga pembeli Bebas Iklan kehilangan faucet Imun hariannya, opsi revive, dan peti boss ganda — dan tidak mendapat apa pun sebagai gantinya.

Dipensiunkan sampai (a) iklan paksa benar-benar ada dan (b) flag `noAds` hanya menyentuh placement paksa. Fungsinya diambil alih perk `noForcedAds` di Kartu Imun.

### 5.5 Proyeksi dan urutan prioritas

Pada 1.000 DAU: iklan rewarded ≈ **Rp 5,85 juta/bulan** (1.000 × 3,0 tayangan × Rp 65) versus IAP Rp 900.000 pada skenario 2% pembayar, atau Rp 360.000 pada 0,8%.

Iklan menghasilkan 6–16× lipat dari IAP pada skala awal. Tiga implikasi: jangan jual Bebas Iklan; menaikkan kuota 5 → 6 menambah ~Rp 1,17 juta/bulan (lebih besar dari seluruh IAP skenario konservatif); dan katalog IAP tetap harus dibetulkan sekarang karena ia yang menentukan langit-langit saat DAU naik.

---

## 6. Struktur retensi baru

### 6.1 Comeback, streak, dan hadiah kembali

`comeback-system.js` menjalankan satu pass saat boot. Simulasi 45 hari yang dijalankan validator:

```
jeda(hari)    streak   putus       decay   hadiah
1..1 (10x)      1..10       -        1->1        -
2                  11       -        1->1        -    <- hari pengampunan bekerja
1..1 (4x)     12..15        -        1->1        -
20                 16       -        1->1        -
kembali             1      YA       20->2       YA    <- peluruhan dibatasi, absen dibayar
```

Tangga streak: hari 2/3/5/7/14/30 dengan 40–200 Imun di puncaknya, lalu berputar dari hari 7 sehingga pemain jangka panjang tidak pernah kehabisan alasan login. Satu hari pengampunan dipasang karena kehilangan streak panjang adalah alasan berhenti yang paling umum di seluruh genre.

Jendela 24 jam rolling tetap dipertahankan (lebih adil bagi pemain yang jam mainnya bergeser), tetapi **sisa waktu wajib tampil sebagai hitung mundur** di dashboard, layar akhir run, dan panel misi HUD. Kebiasaan butuh isyarat yang bisa diprediksi; rolling window tanpa hitung mundur adalah rolling window yang tak terlihat.

### 6.2 Trigger kembali

Streak dan hadiah hanya bekerja bila pemain membuka game. Saat ini tidak ada satu pun mekanisme yang mengingatkannya. Tiga langkah berurutan menurut biayanya:

1. **PWA + prompt pasang** setelah run ke-3. Ini juga satu-satunya cara menyelamatkan penyimpanan di iOS, karena aplikasi home screen dikecualikan dari penghapusan 7 hari. Dua manfaat dari satu pekerjaan.
2. **Web Push** untuk Android dan desktop (iOS mendukungnya hanya untuk PWA terpasang) — satu notifikasi per hari maksimum, isinya spesifik: "streak 6 hari berakhir 3 jam lagi", bukan "ayo main".
3. **Email opsional** saat sign-up, untuk win-back mingguan.

### 6.3 Hook akhir sesi

Layar akhir run live menampilkan bintang, count-up antibodi, tombol iklan 2×, lalu Main Lagi / Dashboard. Tidak ada satu pun tujuan yang belum selesai.

`session-hook.js` memindai seluruh sistem (misi, unlock hero, unlock arena, Battle Pass, kuota bab, pangkat, mastery, evolusi), memilih maksimum tiga yang paling dekat, dan menyatakan jaraknya dalam **run**, bukan angka mentah. "Kurang 2 run lagi" bekerja; "148 / 150 kill" tidak, karena pemain tidak tahu berapa kill yang biasanya ia dapat.

Estimasinya memakai laju pemain itu sendiri dari ring buffer `metrics.js`, bukan rata-rata teoretis. Contoh keluaran pada profil pemain uji (14 run, 2.900 kill):

```
Headline : Satu run lagi: Bunuh 300 patogen
  misi_harian        Bunuh 300 patogen        205/300    68%   1 run
  unlock_hero        Buka Eos               2.900/3.000   97%   1 run
  battlepass_level   Battle Pass Lv 5          160/200    80%   1 run
```

Satu baris per jenis sistem — tiga baris "buka hero" bukan tiga alasan, itu satu alasan yang diulang.

### 6.4 Drop kosmetik langka — konsep poin 3 owner

Audit finance mencatat konsep ini belum ada di kode sama sekali. `rare-drop-system.js` mengimplementasikannya sesuai syarat yang Anda tetapkan: level menengah-tinggi, bukan rendah; pemain gratis yang beruntung tetap bisa dapat.

- Hanya kill **elite dan boss pada wave ≥ 12** yang dihitung layak. Farming wave rendah tidak berguna.
- Peluang 0,2% per elite, 1,0% per boss; pity dijamin pada kill layak ke-400.
- Kolam = kosmetik bertanda `f2pDroppable` di `cosmetics.json` yang belum dimiliki.

Diverifikasi dengan Monte Carlo 20.000 percobaan menggunakan implementasi yang sama persis dengan yang akan dijalankan game:

```
Kill layak per run referensi : 12 elite + 1 boss
Analitik                     : RNG 29,9 run · pity 30,8 run
Monte Carlo                  : 19,5 run per drop pertama · 35,3% lewat pity
Artinya                      : ~6,5 hari bermain untuk satu kosmetik gratis
```

Pasangan berbayarnya, **Peti Riset**, memakai kolam yang sama tetapi konter pity terpisah, sehingga pembelian tidak pernah memakan progres pity gratis pemain dan sebaliknya.

### 6.5 Sink Imun berulang

Seluruh sink Imun yang ada saat ini adalah dinding sekali pakai: upgrade global, unlock hero, kosmetik. Pemain yang menyelesaikan dinding tidak akan pernah membeli lagi. Katalog IAP kelas mana pun tidak bisa menyelamatkan ekonomi tanpa sink berulang.

| Sink | Harga | Layar | Butuh UI baru? |
|---|---|---|---|
| Lanjut Run (bangkit kedua) | 50 Imun | `revive` | **Tidak** — modal sudah ada |
| Peti Riset (kosmetik RNG, pity 10) | 150 Imun | `bosschest` | **Tidak** — modal sudah ada |
| Slot Loadout tambahan (maks 3) | 300 Imun | `prep` | Ya |
| Reset upgrade global | 200 Imun | `upgrade` | Ya |
| Refresh misi harian | 30 Imun | `hud` | Ya |

Dua yang pertama bisa rilis tanpa menyentuh UI sama sekali. Target: pembayar terlibat punya 300–600 Imun/bulan belanja opsional, yang pada Rp 22/Imun adalah Rp 6.600–13.200/bulan — persis membuat Kartu Imun Rp 29.000 menjadi keputusan rasional. Kedua rekomendasi itu saling mengunci.

### 6.6 Komposisi sink premium

90,4% dinding premium adalah kekuatan tempur (upgrade global 39.034 dari 43.169 Imun). Untuk single-player itu hanya kurang menarik. **Begitu PvP asimetris Team Blue vs Team Red dirilis, ini menjadi pay-to-win eksplisit** — dan Anda sudah menandai kepercayaan merek sebagai hal yang tidak bisa dikompromikan.

Pecah upgrade global: level 1–10 dibeli dengan **Antibodi**, level 11+ dengan Imun. Biaya dasar tiap jalur adalah 50 (dikonfirmasi dari total 10.641 pada 25 level), sehingga level 1–10 = 1.015 Imun per jalur × 6 jalur = **6.091 Imun** yang berpindah ke Antibodi (243.640 Antibodi, +11% dinding soft). Dinding Imun global menjadi 32.943. Biaya kecil, dampak besar: pemain gratis mendapat akses ke 40% pertama setiap kurva kekuatan lewat bermain.

---

## 7. Jahitan monetisasi ⇄ gameplay

Setiap produk IAP menggantung pada satu mekanisme gameplay. Ini daftar ketergantungannya, dan inilah alasan kedua dokumen tidak bisa dikerjakan terpisah.

| Produk / harga | Bergantung pada | Status hari ini | Blokir |
|---|---|---|---|
| Kartu Imun 30 Hari, Rp 29.000 | pemain masih ada di hari ke-30 | mustahil | R-P0-1, R-P0-2, 6.2 |
| Battle Pass 800 Imun | 30 level berumur satu musim | tamat dalam 6,1 run | §4 retune BP |
| Tangga Imun 4 tier | ada yang layak dibeli | 90% sink adalah dinding sekali pakai | §6.5 |
| Lanjut Run 50 Imun | modal revive | **siap** | — |
| Peti Riset 150 Imun | modal peti boss + kolam kosmetik | **siap** setelah `f2pDroppable` ditambahkan | — |
| Bonus pembelian pertama | pemain sampai ke toko (gate 5 run) | siap | — |
| Tier whale Rp 199.000 | data ARPPU nyata | tidak terukur | R-P0-6 |
| Iklan rewarded (aliran terbesar) | pemain kembali besok | tidak terukur, tidak dipicu | R-P0-1, 6.2 |

Baris terakhir yang paling penting: pendapatan terbesar Anda hari ini adalah iklan, dan iklan adalah fungsi langsung dari jumlah hari pemain kembali. Setiap perbaikan retensi di §6 adalah perbaikan pendapatan iklan, bukan investasi jangka panjang yang abstrak.

---

## 8. UI/UX pada build live

Diperiksa langsung di `imunverse.fun`, dikorelasikan dengan struktur di dokumen gameplay.

**Empat sistem navigasi untuk dua belas destinasi.** Dock bawah (Play/Heroes/Bag/Squad/Shop), sidebar (Home/Kampanye/Bio/Pass/Rekor/Tubuh), quick row di dashboard, dan dua menu HUD in-run (menu1 perjalanan, menu2 regu). Beberapa destinasi muncul di tiga tempat sekaligus. Ini penyebab konkret dari "dashboard terlalu kompleks": bukan terlalu banyak fitur, tetapi terlalu banyak jalan menuju fitur yang sama.

Rekomendasi: pertahankan **dock bawah** (permanen, 5 slot) dan **satu sheet "Perjalanan"**. Hapus sidebar; gabungkan menu1 dan menu2 HUD menjadi satu sheet yang sama dengan yang di dashboard.

**Tidak ada rail progres utama.** Dua belas sistem meta berarti tidak ada satu bar yang terasa bergerak. Angkat tiga ke topbar permanen: **Pangkat** (sudah ada chip-nya), **Battle Pass**, dan **item teratas dari session hook**. Sembilan sisanya tetap ada, hanya tidak berebut perhatian.

**Layar auth menjanjikan yang tidak bisa ditepati.** Copy-nya menyatakan progres dan pembelian tersimpan aman dengan nama pemain sendiri. Sampai R-P0-1 selesai, kalimat itu tidak akurat dan harus diubah atau sistemnya harus menyusul kalimatnya. Saya sarankan yang kedua.

**Bio-Pedia menampilkan "Ditemukan 0 / 0"** pada state awal — penyebut nol sebelum data termuat. Kecil, tapi ini layar pertama yang dilihat pemain saat gate wave 10 terbuka.

**Yang sudah bagus dan layak dipertahankan:** title screen gameplay-first (MULAI langsung ke run, akun menyusul setelah run pertama) adalah keputusan onboarding yang benar dan sudah sesuai praktik terbaik; modal panduan currency yang jujur menyebutkan mekanik; `minimal-home` untuk pemain di bawah 3 run; dan tombol PLAY yang memilihkan bab otomatis sebelum run ke-3.

---

## 9. Instrumentasi dan KPI

Empat event sudah cukup untuk menghitung semuanya: `session_start`, `run_end`, `purchase`, `ad_watched`.

| KPI | Target 90 hari | Sumber |
|---|---|---|
| D1 | 30% | <cite index="46-1">median industri sekitar 26%, profil "baik" 35%</cite> |
| D7 | 10% | <cite index="44-1">median D7 di bawah 4%</cite> |
| D30 | 4% | <cite index="51-1">75% proyek berada di bawah 3% pada hari ke-28</cite> |
| Tayangan iklan / DAU | 3,0 | kuota 6/hari |
| Tingkat pembayar | 1,5% | <cite index="6-1">target umum 2–5%</cite> |
| One-more-run rate | 45% | sudah dihitung `metrics.js` |
| Penyelesaian Battle Pass | 35% pembeli | target §4 |

Satu peringatan tentang membaca angka-angka ini: <cite index="46-1">D1 rendah adalah masalah sesi pertama, D7 rendah adalah masalah kebiasaan</cite>. Bila setelah semua perbaikan ini D1 tetap di bawah 25%, tersangkanya adalah §R-P0-3/4/5 (onboarding, serangan manual, landscape), bukan pacing.

---

## 10. Roadmap terpadu

**Sprint 1 — pondasi (tanpa ini semua yang lain sia-sia)**
1. Save server-side + migrasi dari localStorage; localStorage jadi cache
2. Endpoint telemetri + empat event
3. `comeback-system.js` di boot; batasi peluruhan tubuh
4. `retention-config.json` + retune BP, pangkat, evolusi, level hero, kuota kampanye
5. Faucet iklan 30×5 → 10×6; hapus field mati `offers.adAntibodi`; hapus `doc` "525 Imun untung"
6. Pasang `npm run validate` sebagai gerbang merge

**Sprint 2 — sesi pertama dan hook**
7. Auto-fire saat diam + toggle di profil
8. Tutorial 60 detik (hidupkan `tutorial-system`, isi `coach.json`)
9. Lepas gerbang landscape dari semua layar menu
10. `session-hook.js` di layar akhir run
11. Hitung mundur reset harian di 3 permukaan
12. PWA + prompt pasang setelah run ke-3

**Sprint 3 — monetisasi**
13. Pasang `economy-anchors.json` + `premium.json` baru + `pricing-model.js`; hapus semua badge statis dari UI
14. Bonus pembelian pertama di `grantContents` (`payment-system.js:59`)
15. Kartu Imun 30 Hari (`contents.drip` + perk `noForcedAds`)
16. Lanjut Run 50 Imun di modal revive; Peti Riset 150 Imun di modal peti boss
17. Audit perilaku `meta.noAds` terhadap kelima placement rewarded

**Sprint 4 — kedalaman dan PSP**
18. Tiga tingkat kesulitan kampanye (data-only, `campaign.json`)
19. `rare-drop-system.js` + field `f2pDroppable` di `cosmetics.json`
20. Pecah upgrade global level 1–10 ke Antibodi
21. Web Push
22. PSP nyata: ganti isi `payOrder()` dengan fetch Midtrans + webhook, grant dari server (`payment-system.js:7`)
23. Aktifkan `imun_12000` setelah ada ARPPU nyata

**Utang teknis yang ikut dibereskan:** hapus `AbilitySystem` + `abilities.json` + field `ability` di tahap evolusi (vestigial); hapus `APP_STATE_BY_SCREEN['focus']`; sinkronkan toast `koin_ganda` "+50%" dengan pengali aktual ×1,3 (`game.js:149` vs `:1895`) — ini menyentuh item yang dijual di toko, jadi bukan sekadar teks; perbarui header usang `imun-economy.js` baris 1–9 dan komentar `ensureFounderReward`.

---

## 11. Yang saya tidak putuskan

- **Battle Pass net −300 vs net 0.** Saya merekomendasikan −300 karena game ini butuh pendapatan berulang. Alternatifnya model Fortnite: kembalikan penuh 800 sehingga pass membiayai dirinya selamanya, memaksimalkan retensi dengan mengorbankan pendapatan musim kedua ke atas.
- **Serangan manual.** Rekomendasi auto-fire-saat-diam adalah jalan tengah, tetapi ini keputusan identitas game, bukan keputusan angka. Bila serangan manual adalah inti dari apa yang ingin Anda buat, pertahankan — hanya sadari bahwa itu memilih audiens yang lebih sempit, dan tutorial menjadi lebih wajib, bukan kurang.
- **Fagositosis menghapus drop.** Kill yang ditelan tidak menjatuhkan apa pun. Modul yang menghukum penggunaannya sendiri; belum jelas apakah itu disengaja sebagai trade-off (heal + fuel ultimate versus loot) atau efek samping. Perlu keputusan desain, bukan tuning.
- **`skin_pendiri` di Paket Perdana.** Skin yang sama tersedia lewat founder reward dan lewat pembelian, melemahkan eksklusivitas keduanya.
- **Tier whale Rp 199.000.** Sudah berharga final dengan `active: false`.

---

## 12. File yang disertakan

| File | Isi |
|---|---|
| `data/economy-anchors.json` | Sumber kebenaran valuasi. Kurs Imun, kurs Antibodi, nilai item, kebijakan badge, ekonomi iklan. |
| `data/premium.json` | Katalog produksi. Hanya harga jual dan isi. |
| `data/retention-config.json` | Target pacing, retune BP/pangkat/evolusi/hero/kampanye, comeback, drop langka, sink berulang, hook akhir sesi. |
| `js/systems/pricing-model.js` | Valuasi, badge, bonus pembelian pertama, pendapatan bersih, deteksi dominasi, metrik F2P. |
| `js/systems/comeback-system.js` | Batas peluruhan offline, streak berampun, hadiah kembali, pemulihan tubuh. |
| `js/systems/session-hook.js` | Memilih tiga progres terdekat lintas sistem, ETA dalam run dari laju pemain sendiri. |
| `js/systems/rare-drop-system.js` | Drop kosmetik langka + pity, Peti Riset berbayar dengan pity terpisah, kalkulator ekspektasi. |
| `tools/validate-catalog.mjs` | Audit katalog IAP. Keluar kode 1 bila ada error. |
| `tools/validate-retention.mjs` | Audit pacing + Monte Carlo drop + simulasi comeback 45 hari + uji session hook. |
| `package.json` | `npm run validate` menjalankan keduanya. |

Semua modul murni: tidak menyentuh DOM, tidak menulis save, tidak memanggil `emit`. Titik integrasinya ditulis di komentar kepala tiap file.

Kedua validator saat ini melaporkan **0 error**. Tiga kesalahan yang mereka tangkap selama penyusunan — Paket Perdana mendominasi tier 500, pita diskon yang salah diuji, dan biaya evolusi yang meleset 40% dari target — diperbaiki di sumbernya, bukan dikecualikan.
