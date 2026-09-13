# AUDIT IAP & EKONOMI IMUN — DOKUMEN TIM FINANCE

- **Tanggal:** 13 September 2026
- **Baseline:** branch `arena/01a09795-imunverse`, commit `1c43f41` (BUILD 54a)
- **Metode:** verifikasi statis terhadap **kode & data asli** (`js/`, `data/`). Setiap angka di dokumen ini
  dapat ditelusuri ke `file:baris`/`file:field` — daftar lengkap di **§11 Audit Trail**. Tidak ada angka
  hasil perkiraan; asumsi valuasi (jika dipakai) dinyatakan eksplisit.
- **Cakupan:** alur uang (IAP), kedua mata uang (Antibodi = soft, Imun = premium), sink & source
  lengkap, Battle Pass, placement iklan, kosmetik, upgrade global, dan cross-check terhadap 4 poin
  konsep product yang ditetapkan owner.

---

## 0. TL;DR

| Item | Nilai | Sumber |
|---|---|---|
| Bundle IAP di katalog | **5** (pembayaran simulasi, belum ada PSP nyata) | `data/premium.json` |
| **Dinding premium total** (seluruh sink Imun) | **43.169 Imun** | §4 |
| Dinding Antibodi total (semua di-level-maks) | **2.228.946 Antibodi** | §5 |
| Pendapatan Imun player gratis (iklan) | 30 Imun × 5×/24 jam = **150 Imun / 24 jam** (rolling per akun) | `battlepass.json` `offers.adImun` + `upgrades.json` `economy.adDailyLimit` |
| Persentase dinding per 24 jam (F2P) | 0,35% — ± **288 hari** iklan untuk menembus seluruh dinding | hitungan |
| Harga Implisit Imun per bundle | **−19,3 / +250,0 / +47,6 / −128,0 / +350,0** Rp per Imun | §3 |

**Temuan P0 (harus diputuskan sebelum monetisasi nyata):**

1. **Harga tidak konsisten antar bundle.** Harga implisit Imun bervariasi 47,6 s.d. 250 Rp/Imun
   (selisih 5,3×); dua bundle bernilai **negatif** (harga di bawah "nilai" kontennya pada anchor
   file itu sendiri). Harga efektif Antibodi juga bervariasi 6,5× (6,13 s.d. 39,75 Rp/Antibodi).
2. **`bundle_imun` (100 Imun, Rp 25.000) terdominasi `pass_m1` (500 Imun + 800 Antibodi + 2 item,
   Rp 35.000)** — lebih mahal, Imun 5× lebih sedikit, tanpa konten. Pembeli rasional tidak akan
   pernah memilih `bundle_imun`. Ini placeholder tier menunggu penetapan tim Finance (instruksi
   owner: tier 500/1000/2500/5000 **belum boleh diberi harga**).
3. **Badge "HEMAT 72%" pada Welcome Bundle tidak bisa direproduksi** dari angka apa pun di kode —
   butuh definisi resmi nilai Imun (lihat §3.3).
4. **Tier 500/1000/2500/5000 Imun BELUM DIBUAT** (sesuai instruksi). Kode bersifat generik:
   menambah tier = menambah 1 entri JSON di `data/premium.json` — tidak perlu ubah kode (§10).

---

## 1. Arsitektur Alur Uang

**Dua mata uang** (state di `meta`, persisten via save):

| Mata uang | Sifat | Sumber | Ditulis di |
|---|---|---|---|
| **Antibodi** (`meta.antibodi`) | Soft — hasil bermain | koin run, misi, daily, survey, referral, mastery, BP | `js/systems/economy-system.js` (`addCurrency`) |
| **Imun** (`meta.imun`) | Premium | IAP, Battle Pass, iklan reward (30×5/24j) | `js/systems/imun-economy.js` (`addImun`/`spendImun`) |

> Catatan: header file `imun-economy.js` (baris 1–9) masih bertuliskan "Imun HANYA dari pembelian &
> Battle Pass" — itu komentar RONDE-4 yang **sudah kedaluwarsa** sejak keputusan F7 (iklan kini
> memberi Imun). Kode yang berlaku: `shop-screen.js:406` `addImun(meta, offers.adImun)`.

**Alur IAP** (semua di `js/systems/payment-system.js`):

```
UI Toko (js/ui/screens/shop-screen.js)
  └─> createOrder(productId)        :31  — cari bundle di katalog data/premium.json
        └─> setMethod(orderId,m)    :51  — qris | ewallet | kartu (divalidasi dari data)
              └─> payOrder(orderId) :100 — WAJIB akun (F9, :111) → simulasi PSP ±700 ms
                    ├─> grantContents(meta, contents)  :59  — currency/imun/skin/consumables/noAds
                    ├─> receipt → meta.receipts (maks 30)   :126-130
                    └─> writeSave
```

- **Wajib akun (keputusan F9, 2026-09-13):** ditegakkan dua lapis — UI (`requireAccount('shop')` di
  `shop-screen.js:202, 246, 281`) dan server-side simulasi (`payment-system.js:111` menolak tanpa
  `meta.account`).
- **Belum ada PSP nyata:** komentar resmi `payment-system.js:7` — *"backend nyata CUKUP ganti isi
  payOrder() dengan fetch ke PSP, lalu konfirmasi via webhook → grant entitlement dari server."*
- **Katalog = satu-satunya sumber harga.** Tidak ada harga yang di-hardcode di `js/`; semua angka
  dari `data/*.json`.

**Placement iklan** (kuota bersama **5×/24 jam rolling per akun** — `monetization.js:76-99`,
limit dari `upgrades.json` `economy.adDailyLimit: 5`):

| # | Placement | Efek | Kode |
|---|---|---|---|
| 1 | Tile "Tonton Iklan" di Toko | **+30 Imun** | `shop-screen.js:393-409` |
| 2 | Boss tumbang | isi peti boss ×2 | `game.js:1483-1485` |
| 3 | Kehilangan nyawa | revive | `game.js:1830, 1849` |
| 4 | Akhir run | currency run ×2 | `game.js:2059-2066` |
| 5 | Dashboard tubuh | pulihkan sistem kritis +18 | `dashboard-screen.js:412-419` |

Kuota dihitung rolling 24 jam (anchor aktivitas user, bukan tanggal kalender — keputusan F8):
`meta.adDaily = { anchorTs, count }`, digulir lazily di `monetization.js:76-82`.
`meta.noAds` (dari bundle Bebas Iklan) menonaktifkan seluruh interupsi iklan.

---

## 2. Katalog IAP Saat Ini (persis seperti di `data/premium.json`)

Anchor desain yang tertulis di file itu sendiri (`"note"`):
> *"Harga simulasi. Balancing: 1 antibodi dasar ± Rp 10; bundle memberi nilai 1.5-1.8x lipat vs beli satuan."*

| id | Nama | Harga | Isi (`contents`) | Badge |
|---|---|---|---|---|
| `bundle_welcome` | Welcome Bundle | Rp 15.000 | 1.500 Antibodi + 300 Imun + `skin_pendiri` + serum_awal×2 + vaksin_awal×1 | HEMAT 72% |
| `bundle_imun` | Paket Imun | Rp 25.000 | **100 Imun** (satu-satunya isi) | LANGSUNG |
| `bundle_pass_m1` | Pass Premium + 15 Lv | Rp 35.000 | 500 Imun + 800 Antibodi + kopi_limfa×2 | PALING LARIS |
| `bundle_imun_pro` | Paket Imun Pro | Rp 45.000 | 1.500 Imun* + 5.000 Antibodi + koin_ganda×2 + pelindung_lendir×2 + kopi_limfa×2 | TERBAIK |
| `bundle_noads` | Bebas Iklan | Rp 35.000 | `noAds` (selamanya) + 100 Imun | SEKALI BELI |

\* koreksi pembacaan: isi Imun `bundle_imun_pro` adalah **150** (bukan 1.500 — yang 1.500 adalah
Antibodi). `valueNote` di JSON-nya memang menuliskan "5.000 antibodi + 150 Imun".

Harga item acuan (biaya toko, Antibodi — `upgrades.json` `shopItems`):
serum_awal 200 · vaksin_awal 180 · kopi_limfa 160 · pelindung_lendir 250 · koin_ganda 300.

---

## 3. Analisis Harga per Bundle (inti audit)

Metode valuasi (dinyatakan eksplisit — **ini asumsi untuk analisis, bukan angka dari kode**):
nilai 1 Antibodi = Rp 10 (anchor dari `premium.json` note); nilai 1 item = harga tokonya × Rp 10;
nilai `skin_pendiri` = 0 (limited, tidak dijual — `cosmetics.json`); sisa harga yang tidak tertutup
konten non-Imun diatribusikan ke Imun → **Harga Implisit Rp/Imun**.

### 3.1 Tabel harga

| Bundle | Harga | Imun | Antibodi | Item (nilai Rp) | Nilai non-Imun (Rp) | **Rp/Imun implisit** | Rp/Antibodi efektif |
|---|---|---|---|---|---|---|---|
| welcome | 15.000 | 300 | 1.500 | 5.800 | 20.800 | **−19,3** | 6,13 |
| **bundle_imun** | 25.000 | 100 | 0 | 0 | 0 | **+250,0** | — |
| pass_m1 | 35.000 | 500 | 800 | 3.200 | 11.200 | **+47,6** | 39,75 |
| imun_pro | 45.000 | 150 | 5.000 | 14.200 | 64.200 | **−128,0** | 6,16 |
| noads | 35.000 | 100 | 0 | 0 | 0 (entitlement tidak dinilai) | **+350,0** | — |

Perhitungan baris contoh — `pass_m1`: (35.000 − 800×10 − 3.200) / 500 = 23.800/500 = **47,6**.

### 3.2 Apa yang ini berarti

- **Katalog menjual Imun di 3 "harga" yang saling bertentangan** (47,6 / 250,0 / 350,0 Rp/Imun)
  dan Antibodi di **2 harga** (6,13–6,16 vs 39,75 Rp/Antibodi, selisih 6,5×).
  Pembeli yang membandingkan akan selalu memilih: `immun_pro` untuk Antibodi (6,16 Rp) dan
  `pass_m1` untuk Imun (47,6 Rp). `bundle_imun` tidak pernah menang di mana pun.
- **Bukti dominasi `bundle_imun`:** Rp 25.000 → 100 Imun saja. Dengan +Rp 10.000 lagi
  (`pass_m1`, Rp 35.000) pembeli mendapat 500 Imun **dan** 8.000 Rp Antibodi **dan** 2 item.
  Tidak ada skenario di mana `bundle_imun` rasional.
- **Bundle bernilai negatif** (`welcome` −19,3; `immun_pro` −128,0) berarti harga di bawah nilai
  wajah kontennya — wajar untuk bundle *loss-leader* (welcome) dan bundle Antibodi (immun_pro),
  tetapi hanya sehat kalau **disengaja dan konsisten** — saat ini tidak, karena bundle Imun murni
  di harganya 5,3× lebih mahal dari Imun implisit `pass_m1`.
- **Intent "bundle memberi nilai 1.5–1.8×" (note di `premium.json`) tidak terpenuhi merata:**
  nilai non-Imun/welcome = 1,39× harga; `immun_pro` = 1,43×; `pass_m1` = 0,32× (sisa 68% harga
  adalah Imun). Jadi klaim "hemat" di katalog hanya benar untuk 2 dari 5 bundle.

### 3.3 Badge "HEMAT 72%" tidak bisa direproduksi

Agar "HEMAT 72%" benar (pembeli mendapat nilai = harga/0,4 = Rp 37.500), Imun harus bernilai:
(37.500 − 20.800) / 300 = **Rp 55,7/Imun** — angka yang tidak ada di mana pun di kode. Dengan
anchor terbaik di katalog (47,6) nilai = 35.080 → hemat 57%; dengan harga `bundle_imun` (250) →
hemat 538%. **Keputusan Finance:** definisikan nilai resmi Imun, lalu badge ditulis ulang.

---

## 4. Sink Imun — Dinding Premium 43.169 Imun

Seluruh tempat Imun habis, lengkap. **Tidak ada sink Imun lain di kode** (diverifikasi:
`spendImun` hanya dipanggil dari `buyCosmetic`, `buyPremiumPass`, `purchaseHeroUnlock`).

### 4.1 Upgrade Global — 39.034 Imun (sink terbesar)

```
BIAYA = round(baseCost × 1.15^level)   (retention-system.js:69-71)
EFEK  = applyGlobalUpgrades(stats)     (retention-system.js:48-66 → game.js:477)
```
Berlaku **ke semua hero**, diterapkan ke statistik run (damage, HP maks, kecepatan gerak,
kecepatan serang, jarak serang+radius tebas, life steal).

| id | Nama | Efek/level | Maks | Total biaya (Imun) | Efek maksimum |
|---|---|---|---|---|---|
| `g_damage` | Sitokin Global | +10% damage | 25 | 10.641 | **+250% damage** |
| `g_vitality` | Membran Kolektif | +15 HP (flat) | 25 | 10.641 | +375 HP |
| `g_swift` | Aliran Limfa Cepat | +8% gerak | 20 | 5.124 | +160% gerak |
| `g_rapid` | Respons Serentak | +10% serang | 20 | 5.124 | +200% speed serang |
| `g_range` | Reseptor Jauh | +12% jarak | 20 | 5.124 | +240% jarak & radius tebas |
| `g_steal` | Fagositosis Vampir | +3% life steal | 15 | 2.380 | +45% life steal |
| **Total** | | | | **39.034** | |

> Ini adalah **power-feel utama yang dibeli**: upgrade global menaikkan statistik nyata dan
> hero-agnostic — sesuai konsep owner "yang dibeli harus terasa lebih kuat" (bagian yang terpenuhi,
> lihat §8).

### 4.2 Unlock Hero — 2.460 Imun

Diproses `purchaseHeroUnlock` (`economy-system.js:138-141`; biaya = `unlock.imuCost`;
field `shopCost` di `heroes.json` adalah sisa vestigial — hanya fallback bila `imuCost` tak ada).

| Hero | Biaya | Syarat |
|---|---|---|
| Neutron | 100 | — |
| Dendri | 150 | — |
| Nyx | 200 | — |
| Baso | 260 | **stat-gate:** Kalahkan 2 Bos |
| Bella | 350 | **stat-gate:** Capai Gel. 8 |
| Mastia | 700 | **stat-gate:** 500 kill |
| Treg | 700 | **stat-gate:** 300 kill |
| **Total** | **2.460** | 4 hero gratis (Mako, Eos, T-Bolt, Helia) |

### 4.3 Kosmetik — 1.175 Imun (**visual-only, tanpa efek statistik**)

`buyCosmetic` (`imun-economy.js:44-51`); render di run hanya mengganti sprite/aura
(verifikasi: tidak ada jalur statistik dari kosmetik ke `stats` di `game.js`).

| Item | Harga | Catatan |
|---|---|---|
| `skin_pendiri` | 0 | limited — hanya via founder reward / Welcome Bundle |
| `skin_mako_daun` | 45 | juga di BP premium lv 13 |
| `skin_eos_sakura` | 60 | juga di BP premium lv 25 |
| `skin_helia_murni` | 250 | juga di BP premium lv 30 |
| `skin_tbolt_krom` | 400 | juga di BP premium lv 1 |
| `acc_aura_bintang` | 120 | juga di BP premium |
| `acc_mahkota_beta` | 300 | juga di BP premium |
| **Total** | **1.175** | |

### 4.4 Battle Pass — 500 Imun (sekali per musim)

`buyPremiumPass` (`battlepass-system.js:53-58`), `premiumCostImun: 500`. Detail §7.

### 4.5 Total dinding premium

```
39.034 (global) + 2.460 (hero) + 1.175 (kosmetik) + 500 (BP) = 43.169 Imun
```

**Bukan sink Imun:** GP Pangkat (rank) dan Hero Mastery — keduanya murni dari bermain dan tidak
bisa dibeli (`rank-system.js`, `mastery-system.js`).

---

## 5. Sink Antibodi — Dinding 2.228.946

| Sink | Formula | Maks per unit | Total |
|---|---|---|---|
| Level Hero (12 hero) | round(150 × 1.35^lv), 20 lv (`economy-system.js:93`, `upgrades.json` `heroUpgrade`) | 172.832/hero | **2.073.984** |
| Upgrade Squad (9 tipe) | round(base × growth^lv), 8–10 lv (`upgrades.json` `squadUpgrades`) | 6.780–20.280/tipe | **139.604** |
| Level Pasukan (ally) | round(220 × 1.4^lv), 10 lv (`upgrades.json` `allyUpgrade`) | — | **15.358** |
| **Total dinding (hard cap)** | | | **2.228.946** |

Sink Antibodi **tanpa cap** (dapat dibeli berulang): consumable tempur 160–300 Antibodi
(`shopItems`) dan suplemen sistem tubuh 250 Antibodi (+20 kesehatan; `body-systems.json`
`suplemenCost`/`suplemenGain`, dibeli di `shop-screen.js:332-346`).

Efek level hero: +6% damage & +8% HP per level (khusus hero itu) — **power-feel nyata kedua**.

---

## 6. Sumber Pendapatan Player Gratis (F2P)

| Sumber | Jumlah | Frekuensi | Kode/data |
|---|---|---|---|
| Koin kill | 2 Antibodi/koin — kecil 15% · medium 45% · hard 2 koin pasti (+60% nutrisi) | per run | `game.js:1644-1658`, `nutrients.json` `value: 2` |
| Boss | 2 koin Antibodi + vitamin_c **pasti** | per boss | `nutrients.json` `bossGuaranteedDrops` |
| Bonus akhir run | wave×12 + kills×1 | per run | `economy-system.js:63-67`, `upgrades.json` `economy` |
| Daily reward | 120 Antibodi | 1×/24 jam rolling | `economy-system.js:50-59` |
| Misi sekali | 905 Antibodi (15 misi) | sekali | `missions.json` `missions` |
| Misi harian | 47 Antibodi (15+12+20) | 1×/24 jam rolling | `missions.json` `daily` |
| Misi mingguan | 180 Antibodi (80+100) | 1×/7 hari rolling | `missions.json` `weekly` |
| **Iklan: +30 Imun** | 150 Imun | 5×/24 jam rolling (kuota bersama 5 placement) | `shop-screen.js:406`, `monetization.js:76-99` |
| Iklan non-currency | peti boss ×2 · revive · currency run ×2 · pemulihan tubuh +18 | kuota bersama | §1 tabel |
| Survei | 150 Antibodi | 1×/24 jam | `battlepass.json` `offers.surveyAntibodi`, `shop-screen.js` |
| Referral | 250 Antibodi/kode | sekali per kode | `immun-economy.js:113-127` |
| Hero Mastery | 15 Antibodi × 10 level/hero (XP: kills×2 + wave×10 + victory 80) | per hero | `mastery.json`, `mastery-system.js` |
| BP track gratis | 100 Imun + 1.700 Antibodi + 6 item + 4 part | per musim | `battlepass.json` `free` |
| Founder (early beta) | 250 Antibodi + `skin_pendiri` + gelar | sekali, wajib akun | `immun-economy.js:88-102` |

> **Kenyataan utama F2P:** satu-satunya jalur Imun gratis = **iklan (150/24 jam)** + **BP gratis
> (100/musim)**. Run biasa TIDAK menghasilkan Imun sama sekali — sejak RONDE-4, akruan Imun per
> kill dihapus karena "fantom" (dijanjikan di HUD tapi tidak pernah cair; `game.js:1631-1633`).
> Artinya: 100% Imun F2P terikat pada ketersediaan iklan + 5×/24 jam.

---

## 7. Battle Pass — Detail

Konfigurasi (`data/battlepass.json`, musim 1 "Beta Musim 1"): `premiumCostImun: 500`,
`maxLevel: 30`, `xpNeed: 40 + 10×level`.

**XP per run** = `level_hero×40 + wave×15 + kills` (`game.js:1931`, `addBpXP`).

| Track | 30 level | Ringkasan |
|---|---|---|
| Gratis | 100 Imun + 1.700 Antibodi + 6 consumable + 4 part evolusi | |
| Premium (500 Imun) | 400 Imun + 840 Antibodi + **4 skin (755 Imun)** + **2 acc (420 Imun)** + 4 consumable + 1 part | |

**Analisa net (hitung arus Imun saja):** 400 − 500 = **−100 Imun** per musim.

**Catatan penting untuk Finance:**
1. **Dokumen di file salah:** `doc` di `battlepass.json` mengklaim track premium memberi
   "525 Imun (525 > 500, untung)" — angka aktual di data = **400** (net −100). Field ini stale
   sejak track diubah.
2. **Semua 4 skin berbayar (755 Imun) berada di track premium** → skin berbayar saat ini hanya
   bisa didapat lewat (a) beli Pass Premium, (b) beli langsung Imun, (c) bundle welcome (skin
   gratis). Player F2P hanya mendapat `skin_pendiari` (0 Imun, via founder).
3. Jika track premium dinilai seluruh kontennya (400 Imun + skin 755 + acc 420 + Antibodi 840 +
   item), nilainya jauh di atas harga 500 Imun — tetapi angka "net −100" tetap valid untuk arus
   Imun saja (perspektif kas Imun pembeli).

---

## 8. Cross-check Konsep Product (4 poin owner) vs Kode

| # | Konsep (owner) | Status di kode | Bukti |
|---|---|---|---|
| 1 | Imun dari iklan = **kecil** | ✅ **Sesuai.** 150 Imun/24 jam = 0,35% dinding premium per hari; ≈ 288 hari iklan untuk seluruh dinding; 3× iklan belum cukup untuk hero termurah (100) + 1× untuk hero termahal (700) butuh ± 34 hari iklan murni. | §0, §6 |
| 2 | Tier Imun pembeli **500/1000/2500/5000**, harga ditetapkan finance | ⚠️ **Tier BELUM DIBUAT** (sesuai instruksi — sengaja). Yang ada sekarang: `bundle_imun` 100 Imun Rp 25.000 (placeholder, outlier 250 Rp/Imun) dan Imun terikat di dalam bundle lain (300/500/150/100). Kode siap: tier baru = entri JSON baru (§10). | `premium.json`, §3, §10 |
| 3 | Skin & item langka hanya via **main konsisten + upgrade berkesinambungan + RNG** di level **menengah-tinggi** (bukan rendah); user gratis yang beruntung tetap bisa dapat | ❌ **Belum ada di kode.** Tidak ada drop skin/item langka acak dari gameplay sama sekali. RNG di run hanya untuk: part evolusi (6% normal / 30% elite — `evolutions.json`) dan nutrisi (16% — `nutrients.json`). Sumber skin: BP premium (bayar), beli Imun (bayar), founder & welcome (non-RNG). Konsekuensi: "user gratis beruntung dapat skin" saat ini **mustahil**. | §4.3, §6, §7 |
| 4 | Penggunaan belanja Imun = item poin 3 (harga diatur kemudian) | ⚠️ **Sebagian.** Sink Imun memang ada (43.169) tetapi untuk upgrade global / hero / kosmetik / BP — **bukan** untuk "item poin 3" (yang belum ada, poin 3 ❌). Kosmetik yang bisa dibeli Imun **visual-only** (tanpa statistik), jadi "belanja Imun → lebih kuat" saat ini hanya lewat upgrade global & unlock hero. | §4, §8-bawah |

**Power-feel (persyaratan owner: "perbedaan harus terasa, pembelian harus menaikkan skill")**
- ✅ **Terpenuhi** oleh: Upgrade Global (statistik nyata: hingga +250% damage, +200% speed serang,
  +240% jarak — §4.1), Level Hero (+6% dmg/+8% HP per level — §5), passif Squad & pasif roster,
  consumable in-run (serum/vaksin/kopi limfa/sinyal ganda/pelindung lendir — auto-dipakai di awal
  run, `game.js:121-131`).
- ❌ **Tidak terpenuhi** oleh: skin & aksesori — murni visual (verifikasi: tidak ada jalur
  kosmetik → statistik di `game.js`). Pembeli skin tidak menjadi lebih kuat.

---

## 9. Risiko & Inkonsistensi

### P0 — harus diputuskan sebelum monetisasi nyata

| # | Temuan | Dampak |
|---|---|---|
| P0-1 | Harga Imun tidak konsisten: 47,6 / 250,0 / 350,0 Rp/Imun; Antibodi 6,13–6,16 vs 39,75 Rp (6,5×) | Pembeli membandingkan → bundle "tengah" mati; persepsi harga tidak adil; **fatal untuk kepercayaan branding** (catatan owner) |
| P0-2 | `bundle_imun` terdominasi `pass_m1` (termahal per Imun, tanpa konten) | Produk yang tidak mungkin laku; merusak kredibilitas katalog saat PSP nyata menyala |
| P0-3 | Badge "HEMAT 72%" tidak bisa direproduksi (§3.3) | Klaim di UI tanpa dasar angka — risiko konsumen |

### P1 — perlu perhatian

| # | Temuan | Lokasi |
|---|---|---|
| P1-1 | `bundle_noads` menjual Imun di 350 Rp/Imun (7,3× dari 47,6) — Imun di situ hanyalah pelengkap entitlement noAds; perlu keputusan apakah wajar | `premium.json` |
| P1-2 | BP net **−100 Imun** (doc file masih menulis "525 > 500 untung") — jika intent-nya "premium tetap untung dalam Imun", track perlu +200 Imun atau harga 400 | `battlepass.json` `doc` vs `premium` |
| P1-3 | Field mati: `offers.adAntibodi: 80` — tidak dikonsumsi kode mana pun (tile video sudah beralih ke `adImun: 30`) | `battlepass.json` `offers` |
| P1-4 | `offers.doc` RONDE-4 salah: "Imun HANYA dari pembelian & BP" — iklan kini memberi Imun (F7) | `battlepass.json` `offers.doc` |
| P1-5 | Header `imun-economy.js` (baris 1–9) usang — sama isinya dengan P1-4 | `js/systems/imun-economy.js` |
| P1-6 | Komentar `ensureFounderReward`: "gelar + skin + **300 Imun**" — kode aktual memberi **250 Antibodi** (tanpa Imun) | `js/systems/imun-economy.js:83-102` |
| P1-7 | Intent "bundle 1.5–1.8× hemat" (note `premium.json`) hanya terpenuhi pada 2 dari 5 bundle | §3.2 |

---

## 10. Rekomendasi & Cara Menambah Tier (levers di kode)

### 10.1 Keputusan yang dibutuhkan tim Finance

1. **Satu tangga harga Imun** (Rp/Imun) yang berlaku untuk semua bundle — lalu hitung ulang
   5 bundle + badge "HEMAT x%".
2. **Satu kurs Antibodi** (Rp/Antibodi) — saat ini 6,13–39,75.
3. **Nasib `bundle_imun`** (placeholder 100 Imun Rp 25.000): disesuaikan dengan tangga baru,
   atau dinonaktifkan sampai tier resmi disetujui.
4. **Konfirmasi net −100 Imun** Battle Pass (P1-2) dan perbaiki `doc` file-nya.
5. **Tier 500/1000/2500/5000** — harga ditetapkan Finance, lalu masuk via §10.2.
6. (Product, bukan Finance) **Fitur poin 3 konsep belum dibangun** — drop RNG skin/item langka
   di level menengah-tinggi. Ini tugas pengembangan baru (touch `game.js` drop table + data baru);
   tidak ada yang bisa di-"aktifkan" dari `data/` saat ini.

### 10.2 Cara menambah tier (tanpa ubah kode)

Tambahkan entri ke array `bundles` di `data/premium.json` — format identik `bundle_imun`.
Sistem pembayaran, validasi metode, wajib-akun, receipt, dan rendering toko sudah generik
(`payment-system.js:31` mencari bundle by id; `shop-screen.js` merender seluruh katalog).
**Contoh template (harga sengaja 0 — diisi Finance; JANGAN dipublikasikan sebelum diisi):**

```json
{
  "id": "bundle_imun_500",
  "name": "Paket Imun 500",
  "priceRp": 0,
  "priceLabel": "Rp — (menunggu Finance)",
  "badge": "LANGSUNG",
  "color": "#f5c64f",
  "contents": { "imun": 500 },
  "valueNote": "500 Imun Coin langsung"
}
```

Tier 1000/2500/5000 mengikuti pola yang sama. Catatan implementasi:
- `priceRp: 0` akan lolos `payOrder` (tidak ada validasi harga > 0) — **jangan commit template
  kosong ke branch produksi**; set harga + label final bersamaan.
- Entitlement baru (mis. "early bird") cukup ditambahkan ke `grantContents`
  (`payment-system.js:59`) bila tipe isinya baru.
- Untuk PSP nyata: ikuti komentar resmi `payment-system.js:7` (ganti isi `payOrder` dengan
  fetch + webhook; grant dari server).

---

## 11. Audit Trail — sumber tiap angka

| Angka di dokumen | Sumber (file : lokasi) |
|---|---|
| 5 bundle, harga, isi, badge, anchor Rp10, intent 1.5–1.8× | `data/premium.json` (seluruh file) |
| Metode qris/ewallet/kartu | `data/premium.json` `methods` |
| Alur order→metode→bayar, wajib akun, simulasi 700 ms, receipt ≤30 | `js/systems/payment-system.js:31, 51, 59, 100-135, 7` |
| Wajib akun di UI (F9) | `js/ui/screens/shop-screen.js:202, 246, 281` |
| Imun dari iklan 30×5/24j rolling, kuota bersama 5 placement | `js/ui/screens/shop-screen.js:393-409`; `js/systems/monetization.js:76-99`; `js/core/game.js:1483-1485, 1830, 1849, 2059-2066`; `js/ui/screens/dashboard-screen.js:412-419`; `data/battlepass.json` `offers.adImun`; `data/upgrades.json` `economy.adDailyLimit: 5` |
| Koin kill 2 Antibodi, 15%/45%/hard×2, tanpa Imun per kill | `js/core/game.js:1631-1658`; `data/nutrients.json` (id `antibodi` `value: 2`) |
| Boss pasti 2 koin + vitamin_c | `data/nutrients.json` `bossGuaranteedDrops` |
| Bonus run-end wave×12+kills×1, daily 120 | `js/systems/economy-system.js:63-67, 50-59`; `data/upgrades.json` `economy` |
| Misi 905 / 47 / 180 | `data/missions.json` `missions`, `daily`, `weekly` (total dihitung) |
| Survey 150, referral 250 | `data/battlepass.json` `offers`; `js/systems/imun-economy.js:113-127` |
| Mastery 15×10 lv/hero, XP formula | `data/mastery.json` `rewardPerLevel`, `xpFormula`, `levels`; `js/systems/mastery-system.js:1-12` |
| Upgrade global: formula, perLevel, maxLevel, total 39.034 | `data/upgrades.json` `globalUpgrades`; `js/systems/retention-system.js:48-71`; aplikasi `js/core/game.js:477` |
| Unlock hero 2.460 + stat-gate | `data/heroes.json` `unlock`; `js/systems/economy-system.js:138-141` |
| Kosmetik 1.175, visual-only | `data/cosmetics.json` `skins.priceImun`, `accs.priceImun`; `js/systems/imun-economy.js:44-51` |
| BP 500 / 30 lv / xpNeed / 100 vs 400 / net −100 / doc "525" | `data/battlepass.json`; `js/systems/battlepass-system.js:53-58, 104-130` |
| XP run = lv×40+wave×15+kills | `js/core/game.js:1931` |
| Level hero 150×1.35^lv (172.832/hero), squad 139.604, ally 15.358 | `data/upgrades.json` `heroUpgrade`, `squadUpgrades`, `allyUpgrade`; `js/systems/economy-system.js:93` |
| Consumable 160–300, suplemen 250/+20 | `data/upgrades.json` `shopItems`; `data/body-systems.json` `suplemenCost`, `suplemenGain`; `js/ui/screens/shop-screen.js:332-346` |
| Founder 250 Antibodi + skin + gelar (bukan Imun) | `js/systems/imun-economy.js:88-102` |
| Part evolusi RNG 6%/30%, nutrisi 16% | `data/upgrades.json` `evolutions` `dropChanceNormal/Elite`; `data/nutrients.json` `bonusDropChance` |
| GP & Mastery bukan sink Imun | `js/systems/rank-system.js`, `js/systems/mastery-system.js` (header + tidak ada pemanggilan `spendImun`) |
| Baseline | branch `arena/01a09795-imunverse`, commit `1c43f41`, BUILD 54a (`js/core/version.js`) |

**Metode:** pembacaan penuh modul terkait (payment, shop, monetization, economy, imun-economy,
battlepass, upgrade/retention, rank, mastery, body) + seluruh file data yang disebut; total untuk
dinding dihitung ulang dengan script aritmetika dari angka data (bukan dibaca dari komentar).
Semua total yang dikutip dalam dokumen dihitung ulang pada 13 Sep 2026 di atas commit `1c43f41`.
