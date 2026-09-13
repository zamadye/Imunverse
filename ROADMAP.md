# ROADMAP PENGEMBANGAN — IMUNVERSE

**Build:** `51a` (`js/core/version.js`) · **Tanggal:** 13 September 2026 · **Branch:** `arena/01a09a68-imunverse`
**Sumber kebenaran:** [`docs/rekomendasi-struktur-imunverse.md`](docs/rekomendasi-struktur-imunverse.md) (v2.0) dan [`docs/brief-agent-building.md`](docs/brief-agent-building.md).
Roadmap ini adalah **turunan** dari kedua dokumen itu yang sudah **direkonsiliasi dengan kondisi nyata repo**. Bila roadmap ini dan kedua dokumen itu bertentangan, dokumen yang menang — kecuali pada bagian §2 (Temuan integrasi), yang berisi fakta repo yang tidak diketahui kedua dokumen itu.

> Roadmap lama (`ROADMAP.md` 85 KB, era "Fase 1–19 / RONDE-1..7 / V2 Phase 0–6") **dihapus** bersama 33 dokumen lama dan 145 screenshot pada 13 Sep 2026, karena sudah tidak relevan dan berpotensi menjadi pengetahuan yang saling bertentangan. Nomor fase/ronde lama masih muncul di komentar kode; itu jejak sejarah, bukan rencana kerja.

---

## 0. Status saat ini (terverifikasi, bukan perkiraan)

| Sudah masuk repo | Bukti |
|---|---|
| 10 file payload dari `files.zip` di jalur targetnya + 2 dokumen di `docs/` | commit `d51231d` |
| `npm run validate` → **0 error** (katalog IAP + pacing retensi) | dijalankan di `tools/`, exit 0 |
| `npm run check` → **lolos** (99 file JS, 35 JSON, 56 sprite, `index.html`) | `scripts/check-imports.mjs` dijadikan sadar-komentar |
| `BUILD` `50a → 51a`, `index.html ?v=50a → ?v=51a` | aturan cache-busting repo |

| **Belum** masuk | Akibatnya |
|---|---|
| `data/economy-anchors.json` & `data/retention-config.json` **belum terdaftar di loader** (`js/core/data-store.js:42-75`) | keduanya belum pernah dimuat runtime; `DATA` tidak punya isinya |
| 4 modul murni **belum di-import siapa pun** | `pricing-model`, `comeback-system`, `session-hook`, `rare-drop-system` = kode mati, nol dampak runtime |
| Retune Fase 1.4 **belum dipindah** ke `battlepass.json` / `upgrades.json` / `ranks.json` / `evolutions.json` / `campaign.json` | kurva live masih yang lama (BP tamat 6,1 run; evolusi 0,6 run) |
| Toko **belum** diadaptasi ke katalog v2 | 🔴 **build sekarang rusak di layar Toko** — lihat §2 G8 |

Angka repo yang terverifikasi hari ini: **11 hero**, 13 tipe musuh, 5 arena, 6 bab kampanye, 13 tier pangkat, 5 skin + 2 aksesori, 35 file `data/*.json`, 99 file `js/*.js` (43 sistem, 23 layar).

---

## 1. Peta 12 file dari `files.zip`

| File di zip | Jalur di repo | Status | Titik integrasi |
|---|---|---|---|
| `economy-anchors.json` | `data/economy-anchors.json` | ✅ ada, ❌ belum di loader | daftar di `data-store.js`; dibaca `pricing-model.js` |
| `retention-config.json` | `data/retention-config.json` | ✅ ada, ❌ belum di loader | daftar di `data-store.js`; dibaca 3 modul + validator |
| `premium.json` | `data/premium.json` | ✅ **menggantikan** v1 | `payment-system.js:23,27`, `shop-screen.js:459-470` — **butuh adaptasi (§2 G8)** |
| `pricing-model.js` | `js/systems/pricing-model.js` | ✅ ada, belum dipakai | `shop-screen.js` (badge runtime), `payment-system.js:59` (bonus pertama), `tools/validate-catalog.mjs` |
| `comeback-system.js` | `js/systems/comeback-system.js` | ✅ ada, belum dipakai | `main.js:boot()` setelah `mergeMetaDefaults`; `body-system.js:86` (ganti sumber hari decay) |
| `session-hook.js` | `js/systems/session-hook.js` | ✅ ada, belum dipakai | `gameover-screen.js` — render **di atas** tombol Main Lagi |
| `rare-drop-system.js` | `js/systems/rare-drop-system.js` | ✅ ada, belum dipakai | `game.js:1608` `onEnemyKilled`, setelah fragmen evolusi; `bosschest-screen.js` (Peti Riset) |
| `validate-catalog.mjs` | `tools/validate-catalog.mjs` | ✅ **hijau** | gerbang merge (`npm run validate`) |
| `validate-retention.mjs` | `tools/validate-retention.mjs` | ✅ **hijau** | gerbang merge (`npm run validate`) |
| `package.json` | akar repo (merge `scripts`) | ✅ digabung | `validate:catalog`, `validate:retention`, `validate` |
| `rekomendasi-struktur-imunverse.md` | `docs/` | ✅ | rujukan permanen |
| `brief-agent-building.md` | `docs/` | ✅ | instruksi kerja per fase |

---

## 2. ⚠️ Temuan integrasi — baca sebelum menyentuh wiring

Keempat modul murni ditulis terhadap **skema data BUILD 54a**, sementara repo ini **BUILD 50a→51a** dengan skema yang berbeda. Keduanya lulus validator karena validator memberi **data sintetis** (`validate-retention.mjs:186-215`), bukan data repo. Semua baris di bawah terverifikasi baris demi baris.

| # | Modul mengharapkan | Repo ini punya | Akibat bila di-wire apa adanya |
|---|---|---|---|
| **G1** | `hero.unlock.stats` = peta `{statKey: need}` (`session-hook.js:88-90`) | `heroes.json`: `unlock = {type:"stat", stat:"totalRuns", value:15, label}` | `gates` = undefined → **baris `unlock_hero` tidak pernah muncul** |
| **G2** | `arena.unlock` = peta `{statKey: need}` (`session-hook.js:107`) | `arenas.json`: `unlock = {type:"default", value:0}` | iterasi menghasilkan kunci `type`/`value` → **baris `unlock_arena` sampah/tak muncul** |
| **G3** | `tier.gp` (`session-hook.js:145-147`) | `ranks.json`: tier memakai **`min`** (`rank-system.js:33,44` sudah benar pakai `.min`) | `undefined > gp` selalu false → **baris `pangkat_tier` tidak pernah muncul** |
| **G4** | `ch.quota`, `ch.name` (`session-hook.js:184-190`) | `campaign.json`: **`killQuota`**, `organ`/`title` (tidak ada `name`) | **baris `kuota_bab` tidak pernah muncul** |
| **G5** | id bagian `equity_membran`, `inti_memori` (`retention-config.json`) | `evolutions.json`: **`equity_membrane`**, **`equity_memory_core`** (dan biaya 2/3/3/3/2 = 17, bukan 50/50/50/17 = 167) | `fromEvolution` salah kunci → **baris `evolusi_tahap` menyesatkan** |
| **G6** | `cosmetics[*].f2pDroppable === true` (`rare-drop-system.js:57`) | `cosmetics.json`: **0 kemunculan** field itu | `buildDropPool()` → `[]` → `rollRareDrop()` **selalu null**; sistem drop mati total |
| **G7** | `cfg = DATA.retention.comeback` / `.sessionHook` / `.rareDrop` (komentar kepala 3 modul) | **`DATA.retention` sudah dipakai** `data/retention.json` (trigger Fase 17: `imuReward`, `combo`, `xpPerKill`, `particles`, `synergy`; dibaca `retention-system.js:15`) | **bentrok nama.** Solusi tanpa mengedit drop-in: daftarkan sebagai `DATA.retentionConfig`, lalu panggil `buildSessionHook({ data: { ...DATA, retention: DATA.retentionConfig }, cfg: DATA.retentionConfig.sessionHook })`. `session-hook.js:203` membaca `data.retention` dari parameternya, jadi komposisi ini cukup |
| **G8** | katalog v2: `class`, `active`, `contents.cosmetics[]`, `contents.drip`, `methods[]` objek, tanpa `priceLabel`/`valueNote` | `shop-screen.js:465,468` membaca `valueNote`/`priceLabel`; `:138-146` mengiterasi `methods` sebagai **string**; `:166` `receipt.method.toUpperCase()`; `payment-system.js:59-90` hanya mengenal `contents.skin`/`acc`, bukan `cosmetics`/`drip`/`perks`; tidak ada filter `active` | 🔴 **harga kartu & tombol = undefined**, chip metode = `[object Object]`, **TypeError saat struk**, skin Paket Perdana & tetesan Kartu Imun **tidak diberikan**, `imun_12000` + `bundle_noads` (nonaktif) **ikut terjual**, receipt lama (`bundle_welcome`/`bundle_pass_m1`/`bundle_imun_pro`) → `find()` undefined → **throw** di `payment-system.js:125-126` |
| **G9** | field save baru: `meta.streak`, `meta.lastPlayedAt`, `meta.dropPity`, `meta.cratePity`, `meta.firstBuy` | **tidak ada** di `state-manager.js` (`createDefaultMeta`/`mergeMetaDefaults`) | aturan repo: field save baru wajib aman lewat deep-merge → **save lama pecah** bila dilewatkan |
| **G10** | baseline dokumen: BUILD **54a**, commit `1c43f41`/`dfa2270`, branch `arena/01a09795-imunverse`, **12 hero** (`validate-retention.mjs:131`), **7 hero** (`economy-anchors.json:65`, `validate-catalog.mjs:106` → 2.460 Imun), iklan **30 Imun × 5**, decay tubuh **tanpa batas** | repo ini: BUILD 50a→51a, **1 commit**, branch `arena/01a09a68-imunverse`, **11 hero**, iklan = **80 Antibodi** (`battlepass.json:331 offers.adAntibodi`, dipakai `shop-screen.js:385-395`) — tidak ada reward 30 Imun, `adDailyLimit` **sudah 6**, decay **sudah dibatasi 7 hari** (`body-system.js:86`) | angka "sebelum" di dokumen tidak semuanya menggambarkan repo ini; beberapa pekerjaan Fase 1.4 sudah sebagian terjadi, beberapa target harus dihitung ulang untuk roster 11 |
| **G11** | `validate-retention.mjs` hanya membaca `data/retention-config.json` (baris 21); kolom "sebelum" hardcode (baris 95-104) | — | **validator tetap 0 error walaupun retune Fase 1.4 belum diterapkan.** Gerbang CI tidak mengunci pekerjaan itu — perlu cek tambahan (lihat Fase 1.5) |

**Keputusan yang dibutuhkan sebelum wiring:** G1–G5 diselesaikan dengan **adapter di pemanggil** (data-store menormalkan bentuk untuk hook) atau dengan **migrasi skema data** ke bentuk yang diharapkan modul. Brief §2.1 melarang mengedit file drop-in, jadi adapter adalah jalur yang patuh; migrasi skema lebih bersih tetapi menyentuh banyak konsumen dan save lama. **Ini keputusan manusia** (brief §9 butir 6).

---

## 3. FASE 1 — Pondasi (memblokir semua fase lain)

> "Katalog yang rapi di atas save yang menghilang adalah cara tercepat mengubah bug teknis menjadi masalah hukum." — brief §11

| # | Pekerjaan | Berkas | Kriteria terima |
|---|---|---|---|
| 1.1 | **Save server-side.** 3 tabel (`accounts`, `saves`, `receipts`), `saves.meta` JSONB + `updated_at`, konflik last-write-wins. `localStorage` turun jadi cache offline; antre unggahan saat offline; **jangan pernah** memblokir gameplay menunggu jaringan. Migrasi: pemain lama yang sign-up **mengunggah** save lokalnya, bukan ditimpa akun kosong | `js/save/save-manager.js`, `js/systems/account-system.js`, backend baru | hapus seluruh site data → login → progres utuh termasuk `receipts`; mode pesawat → satu run penuh tetap tersimpan dan tersinkron |
| 1.2 | **Telemetri.** 4 event (`session_start`, `run_end`, `purchase`, `ad_watched`) + `account_uid`, timestamp, `BUILD`. Kirim **batch** (akhir run & `visibilitychange`) | `js/systems/metrics.js`, endpoint baru | D1 bisa dihitung tanpa langkah manual |
| 1.3 | **Comeback pass saat boot** + batasi peluruhan tubuh. Tambah field save (`streak`, `lastPlayedAt`, `dropPity`, `cratePity`) lewat `mergeMetaDefaults` (**G9**). Satu modal: streak + hadiah kembali + "tubuh dipulihkan" | `js/main.js`, `js/systems/body-system.js:86`, `js/core/state-manager.js`, modal baru | simulasi validator lulus: bolos 1 hari tidak memutus streak; absen 20 hari → decay 2 hari + hadiah kembali |
| 1.4 | **Retune kurva** — pindahkan angka `retention-config.json` ke file data yang dipakai sistem | `battlepass.json` (`xpNeed {base:40,step:10}` → `{base:100,perLevel:25}`, cap 120/run & 360/hari, XP misi 40/200/150, premium 500→**800** Imun, imbalan premium 500, **hapus** `doc` "525 Imun"), `upgrades.json` (`costGrowth 1,35`→**1,22**; `adDailyLimit` sudah 6), `ranks.json` (`points` 18/2/120/250/100 → **4/0,45/27/55/22**), `evolutions.json` (0,06→**0,004**; 0,30→**0,04**; boss 2→**1**; biaya tahap →**50/50/50/17** — sekalian rekonsiliasi id bagian **G5**), `campaign.json` (`killQuota` ×**2,2** + 3 tingkat kesulitan), faucet iklan (**G10**: yang ada 80 Antibodi di `offers.adAntibodi` → ganti 10 Imun × 6/hari, hapus field mati itu) | `npm run validate` 0 error **dan** cek baru Fase 1.5 setuju |
| 1.5 | **Gerbang CI.** `npm run validate` wajib sebelum merge + `BUILD` harus beda dari `main` pada PR yang menyentuh `js/`/`data/`. **Tambal G11:** tambah pemeriksaan bahwa angka di `data/*.json` repo sama dengan angka target `retention-config.json` (validator sekarang tidak melihat file data repo) | `.github/workflows/`, `tools/` | retune yang dibatalkan secara tidak sengaja membuat CI merah |

---

## 4. FASE 1B — Adaptasi toko ke katalog v2 (🔴 sekarang build rusak di Toko)

Tidak ada di brief sebagai fase tersendiri karena brief mengasumsikan katalog dipasang bersama Fase 3. Karena `premium.json` v2 **sudah** masuk repo, pekerjaan ini naik prioritas menjadi perbaikan regresi.

1. `data-store.js`: daftarkan `economy-anchors.json` + `retention-config.json` (pakai kunci `retentionConfig`, lihat **G7**).
2. `shop-screen.js`: render harga dari `priceRp` (format Rp), **hapus** ketergantungan `priceLabel`/`valueNote`, **filter `active === false`**, badge dari `badgeFor()` (**G8**).
3. `shop-screen.js:138-146`: iterasi `methods` sebagai objek (`m.id`, `m.name`), simpan **id** ke order; urutan UI **QRIS dulu, kartu terakhir**.
4. `payment-system.js:59-90` `grantContents()`: dukung `contents.cosmetics[]`, `contents.drip` (tetesan harian, hangus bila tidak diambil — jangan menumpuk), `contents.perks`; pakai `resolveImunGrant()` + `markFirstPurchase()` untuk bonus 2×.
5. `payment-system.js:125-126`: toleran terhadap receipt produk yang sudah tidak ada di katalog (jangan `throw`).
6. Hapus **seluruh** string badge tulis tangan di `js/` dan `data/`.
7. Audit `meta.noAds`: pastikan 5 placement rewarded tetap hidup (tile toko, peti boss, revive, currency akhir run, pemulihan tubuh dashboard). `bundle_noads` tetap **nonaktif**.

**Kriteria terima:** `grep -rn "HEMAT" js/ data/` tidak menemukan satu pun angka tulis tangan; membeli Paket Perdana memberikan skin; membeli Kartu Imun memberi 300 Imun + tetesan 50/hari; tidak ada produk nonaktif yang tampil.

---

## 5. FASE 2 — Sesi pertama dan hook (menggerakkan D1/D7)

| # | Pekerjaan | Catatan |
|---|---|---|
| 2.1 | **Auto-fire saat diam** (model Archero) + toggle "Serang otomatis" di profil, default nyala | `game.js` tahap tembak; tahan-untuk-tembak & aim manual tetap; pasukan ikut aturan hero. Kriteria: pemain baru yang hanya menyentuh joystick tetap membunuh musuh dalam 10 detik pertama |
| 2.2 | **Tutorial 60 detik**, data-driven, ≤4 instruksi non-blocking, hanya run pertama; isi `coach.json` | ⚠️ **BLOKIR — butuh konfirmasi owner.** `tutorial-system.js:79-85` (`shouldRun() → false`, komentar "RONDE-7: TUTORIAL DIHAPUS total atas permintaan pemilik game") dan `coach.json` (`"DIMATIKAN TOTAL … atas permintaan pemilik game"`) keduanya mencatat keputusan owner yang **berlawanan** dengan brief §2.2. Keputusan sementara di sesi ini: **ikuti brief**. Jangan ditulis sebelum owner mengonfirmasi |
| 2.3 | **Lepas gerbang landscape dari layar menu** | `index.html:691` `#rotate-hud`; batasi hanya saat state layar = gameplay. Verifikasi dulu apakah gerbangnya global; bila sudah dibatasi, laporkan dan lewati |
| 2.4 | **Hook akhir sesi** di `gameover-screen.js`, maksimal 3 baris **di atas** tombol Main Lagi, ETA dalam **run** | wajib menyelesaikan **G1–G5, G7** dulu, kalau tidak hook tampil kosong |
| 2.5 | **Hitung mundur reset harian** di dashboard, layar akhir run, panel misi HUD; penekanan visual bila sisa < 4 jam | `retention-config.json:dailyAnchor` |
| 2.6 | **PWA**: manifest + service worker + prompt pasang setelah run ke-3 (sekali, bisa ditolak permanen) | juga lapisan pertahanan kedua untuk save di iOS (pengecualian penghapusan 7 hari) |

---

## 6. Navigasi — setelah Fase 2, sebelum Fase 3

Empat sistem navigasi untuk dua belas destinasi (dock bawah, sidebar, quick row, 2 menu HUD); beberapa destinasi muncul di tiga tempat.

- Pertahankan **dock bawah permanen 5 slot** + **satu sheet "Perjalanan"**; **hapus sidebar**; gabungkan kedua menu HUD menjadi sheet yang sama dengan dashboard.
- Semua destinasi tetap lewat `data/features.json` (gerbang fail-closed: id tak terdaftar = terkunci selamanya).
- Angkat 3 indikator ke topbar permanen: **Pangkat**, **Battle Pass**, **item teratas session hook**.

---

## 7. FASE 3 — Monetisasi

1. Valuasi dari satu sumber: `pricing-model.js` tersambung ke toko; badge runtime (sebagian besar sudah dikerjakan di Fase 1B).
2. Bonus pembelian pertama 2× — hanya `imun_500` & `imun_1000`, sekali per tier, penanda hilang setelah terpakai.
3. **Kartu Imun 30 Hari** Rp 29.000: 300 Imun + tetesan 50/hari × 30 + perk `noForcedAds` & `adDailyLimitPlus2`; pemain bisa melihat sisa hari & jatah hari ini.
4. **Dua sink Imun berulang** yang menumpang modal yang sudah ada: **Lanjut Run 50 Imun** di `revive-screen.js` (batas 1/run, terpisah dari revive iklan) dan **Peti Riset 150 Imun** di `bosschest-screen.js` (pity **terpisah** dari pity gratis — jangan digabung).
5. Audit perilaku bebas iklan (butir 7 Fase 1B).

**Jangan:** mengaktifkan `imun_12000` atau `bundle_noads`; mengubah kurs Imun/Antibodi; menambah sink Imun di luar daftar.

---

## 8. FASE 4 — Kedalaman dan pembayaran nyata

1. **Tiga tingkat kesulitan kampanye** (Normal / Sulit / Kritis; `hpMult` 1,0/1,6/2,4 · `quotaMult` 1,0/1,8/2,6 · `rewardMult` 1,0/2,2/4,0). Penyelesaian dilacak **per bab per tingkat**; migrasi: bab yang sudah bersih dihitung bersih di Normal. 6 bab → 18 penyelesaian tanpa aset baru. Catatan repo: `hpMult` saat ini ada di `chapter.boss.hpMult`, **bukan** di tingkat bab — jadi lapisan kesulitan adalah penambahan data, bukan sekadar "sudah ada".
2. **Drop kosmetik langka**: tambah `f2pDroppable` ke `data/cosmetics.json` (**G6**), panggil `rollRareDrop` dari `game.js:1608`, berikan kosmetik + `emit('rareDrop')`, dan **tampilkan progres pity** di profil/koleksi. Jangan ubah peluang atau ambang pity (sudah diverifikasi Monte Carlo 20.000).
3. **Pecah upgrade global**: level 1–10 dibayar Antibodi, 11+ Imun, pada kurs resmi. Kompensasi pembeli lama = **keputusan manusia**.
4. **Web Push**: maks 1/hari, spesifik & personal, opt-in eksplisit.
5. **PSP nyata**: ganti isi `payOrder()` dengan fetch gateway + konfirmasi webhook + **grant entitlement dari server** (`payment-system.js:7`). QRIS dulu, kartu terakhir. `imun_12000` aktif hanya setelah ada ARPPU nyata.

---

## 9. Utang teknis (dikerjakan saat menyentuh berkas terkait, bukan fase sendiri)

- Hapus `AbilitySystem` + `data/abilities.json` + field `ability` di tiap tahap evolusi — vestigial, di-import tanpa pernah diinstansiasi.
- Hapus pemetaan state layar `focus` yang sudah tidak terdaftar.
- Sinkronkan toast `koin_ganda` "+50%" dengan pengali aktual ×1,3 (`game.js:149` vs `:1895`) — menyentuh item yang **dijual**, jadi bukan sekadar teks.
- Perbarui header `imun-economy.js:1-9` (masih menyatakan Imun hanya dari pembelian + Battle Pass; menjadi usang begitu faucet iklan 10 Imun × 6 masuk).
- Perbaiki komentar `ensureFounderReward` yang menyebut 300 Imun padahal memberi 250 Antibodi.
- Perbaiki penyebut nol Bio-Pedia ("Ditemukan 0 / 0") pada state awal.
- `data/mastery.json:doc` masih menunjuk `docs/v2/phase-06-progression.md` yang sudah dihapus — bersihkan saat menyentuh file itu.

---

## 10. Keputusan terbuka — butuh manusia (brief §9 + temuan repo)

| # | Pertanyaan | Status |
|---|---|---|
| 1 | Battle Pass **net −300** (rekomendasi) vs **net 0** (model Fortnite) | terbuka |
| 2 | **Auto-fire** diterima sebagai identitas game? | terbuka — bila tidak, tutorial jadi lebih wajib |
| 3 | **Fagositosis menghapus drop** — trade-off disengaja atau efek samping? | terbuka |
| 4 | Kompensasi pembeli upgrade global **level 1–10** saat pindah ke Antibodi | terbuka |
| 5 | **`skin_pendiri`** tersedia lewat founder reward **dan** Paket Perdana | terbuka |
| 6 | **G1–G5**: adapter di pemanggil vs migrasi skema data | terbuka — memblokir Fase 2.4 |
| 7 | **G7**: `retention-config.json` didaftarkan sebagai `retentionConfig` (adapter) vs mengambil alih kunci `retention` (rename `retention.json`) | terbuka |
| 8 | **Tutorial (2.2)**: dua catatan di kode mengatakan owner menghapusnya permanen, brief menyuruh menghidupkan | **BLOKIR** — owner sudah diminta konfirmasi di sesi ini, jawaban sementara "ikuti brief" |
| 9 | **G10**: dokumen memakai roster 12 hero & 7 hero; repo punya **11**. Angka mana yang dipakai untuk target 2.460 Imun dan "level 20 seluruh roster"? | terbuka |

---

## 11. Definisi selesai (per fase)

Semua harus benar, bukan sebagian:

- `npm run validate` lulus **0 error** — dan toleransi validator **tidak pernah** dilonggarkan
- `npm run check` lulus
- Self-test headless `index.html?autotest=1` → `SELFTEST_PASS`, dan **diperluas** untuk menutup jalur baru fase itu
- `BUILD` di `js/core/version.js` **dan** `?v=` di `index.html` sudah dibump
- Save dari BUILD sebelumnya dimuat **tanpa kehilangan data** — diuji dengan save nyata, bukan save kosong
- Seluruh string baru ada di `data/lang.json` **dan** `TRANSLATE_FIELDS` di `data-store.js`, berganti bahasa tanpa reload
- Tidak ada angka gameplay baru yang di-hardcode di `js/`
- Tidak ada modul murni yang mulai menyentuh DOM, save, atau event bus
- Destinasi menu baru terdaftar di `data/features.json`; sprite baru terdaftar di manifest `sprite-loader`

**Laporan tiap fase:** perubahan per berkas · hasil kedua validator · hasil self-test · daftar hal yang ditemukan tapi tidak diubah.

## 12. Anti-pattern

Jangan melonggarkan toleransi validator · jangan memindahkan angka dari data ke kode "sementara" · jangan menambah modal yang menghentikan permainan di run pertama · jangan membuat sink Imun di luar daftar · jangan menyentuh kurs Imun/Antibodi · jangan mengaktifkan produk nonaktif · jangan mengganti "jarak dalam run" dengan persentase · jangan mengerjakan Fase 3 sebelum Fase 1 hidup di produksi.

---

## 13. Target KPI 90 hari

| KPI | Target | Sumber |
|---|---|---|
| D1 | 30% | `session_start` |
| D7 | 10% | `session_start` |
| D30 | 4% | `session_start` |
| Tayangan iklan / DAU | 3,0 | `ad_watched` (kuota 6/hari) |
| Tingkat pembayar | 1,5% | `purchase` |
| One-more-run rate | 45% | **sudah dihitung** `js/systems/metrics.js` |
| Penyelesaian Battle Pass | 35% pembeli | telemetri + `battlepass` |

Bila setelah semua perbaikan D1 tetap < 25%, tersangkanya Fase 2 (onboarding, serangan manual, landscape) — **bukan** pacing.
