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
| `BUILD` `50a → 51a → 52a`, `index.html ?v=52a` | aturan cache-busting repo |
| **1.3 ✅ pass comeback saat boot** — `runComebackPass` dipanggil sekali, peluruhan tubuh dibatasi 2 hari, hasil ditampilkan sebagai **satu** modal (`js/ui/comeback-modal.js`, memakai `.pay-modal` yang sudah ada → nol CSS baru) | `main.js`, `body-system.js`, `dashboard-screen.js`, `state-manager.js` (5 field save baru), `data/lang.json` (+9 string) |
| **1.4 ✅ retune kurva dipindah ke data** — BP (100+25/level, harga **800**, imbalan premium **500**, cap **120/run** & **360/hari**, XP misi 40/200/150), upgrade (`costGrowth` **1,22**), pangkat (**4 / 0,45 / 27 / 55 / 22**), evolusi (**0,004 / 0,04 / 1** + tahap **50/50/50/17 = 167**), kampanye (kuota **×2,2** + 3 tingkat kesulitan), faucet iklan (80 Antibodi → **10 Imun × 6/hari**) | diverifikasi `tools/validate-retune-sync.mjs`: **29 pemeriksaan sinkron** |
| **1.5 ✅ gerbang CI** — `npm run validate` kini **3 validator**, `npm run test:fase1` (31 cek), definisi workflow di `tools/ci/validate.yml` | retune yang dibatalkan membuat CI merah — dibuktikan: `costGrowth` 1,22→1,35 = **ERROR, exit 1**. ⚠️ workflow belum terpasang di GitHub: push agent ditolak (izin `workflows`) → `npm run ci:install` (§10 #14) |
| `data/retention-config.json` & `data/economy-anchors.json` **sudah terdaftar di loader** sebagai `DATA.retentionConfig` / `DATA.anchors` (**G7** beres tanpa mengedit drop-in) | `js/core/data-store.js` + getter `getRetentionConfig` / `getAnchors` / `getAdEconomy` |
| `comeback-system.js` **sudah dipakai runtime**; `pricing-model.js` dipakai validator katalog. Sisa 2 modul murni masih kode mati | `main.js:boot()`, `tools/validate-catalog.mjs` |
| **1B ✅ Toko diadaptasi ke katalog v2** — harga dari `priceRp`, nilai/badge/hemat dihitung runtime oleh `pricing-model.js` dari `economy-anchors.json`, metode = objek (QRIS → e-wallet → kartu), produk `active:false` tidak tampil, entitlement `cosmetics[]`/`drip`/`perks[]` benar-benar diberikan, bonus pembelian pertama 2×, `limit.perAccount` + jendela 72 jam | `payment-system.js` (ditulis ulang), `shop-screen.js`, `imun-economy.js` (+`grantCosmetics`/perk/drip), `monetization.js` (kuota +2 dari perk), 3 field save baru |
| Uji headless **31/31 + 62/62 lolos** tanpa browser (loader, save lama, comeback, streak, BP, GP, evolusi, kampanye · katalog v2, metode bayar, Paket Perdana, Kartu Imun, bonus pertama, toleransi katalog) | `scripts/unit-fase1-retune.mjs`, `scripts/unit-fase1b-shop.mjs` |

| **Belum** masuk | Akibatnya |
|---|---|
| **1.1 save server-side & 1.2 telemetri belum dikerjakan** — keduanya butuh pilihan infrastruktur pemilik (Supabase vs VPS) | save tetap hanya di `localStorage` (rawan dihapus iOS); **D1/D7/D30 tidak bisa diukur** → §10 #10 |
| `session-hook.js` & `rare-drop-system.js` **masih kode mati** | hook akhir sesi (Fase 2.4) dan drop kosmetik langka (Fase 4.2) belum ada; menunggu keputusan **G1–G5**, **G6**, **G12**, **G13** |
| `campaign.difficulties` baru **definisi data** — belum ada logika memilih tingkat, pelacakan per bab per tingkat, atau migrasi save | Fase 4.1; 6 bab masih 6 penyelesaian, bukan 18 |
| **2 placement rewarded tanpa kuota**: `revive` (`game.js:1817`) dan `currency akhir run` (`gameover-screen.js:237`) memanggil trigger iklan **tanpa** `canWatchAd()`; dan `canWatchAd()` mematikan SEMUA placement ber-kuota bila `meta.noAds` true | perilaku lama, tidak diubah di Fase 1B — dicatat sebagai **G15** (§10 #15). `bundle_noads` masih nonaktif jadi jalur `noAds` belum bisa terpicu pemain |

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
| **G5** | id bagian `equity_membran`, `inti_memori` (`retention-config.json`) | `evolutions.json`: **`equity_membrane`**, **`equity_memory_core`** | **SELESAI 13 Sep (Fase 1.4) tanpa rename:** biaya tahap sudah 50/50/50/17 = **167**; id repo dipertahankan karena rename akan memutasi `meta.evoParts` di save pemain, jalur sprite, dan rujukan Bio-Pedia. `tools/validate-retune-sync.mjs` membandingkan **total fragmen per bagian** lewat peta alias `{equity_membran→equity_membrane, inti_memori→equity_memory_core}`. **Sisa:** `fromEvolution` di `session-hook.js` masih salah kunci sampai Fase 2.4 memakai adapter |
| **G6** | `cosmetics[*].f2pDroppable === true` (`rare-drop-system.js:57`) | `cosmetics.json`: **0 kemunculan** field itu | `buildDropPool()` → `[]` → `rollRareDrop()` **selalu null**; sistem drop mati total |
| **G7** | `cfg = DATA.retention.comeback` / `.sessionHook` / `.rareDrop` (komentar kepala 3 modul) | **`DATA.retention` sudah dipakai** `data/retention.json` (trigger Fase 17: `imuReward`, `combo`, `xpPerKill`, `particles`, `synergy`; dibaca `retention-system.js:15`) | **bentrok nama.** Solusi tanpa mengedit drop-in: daftarkan sebagai `DATA.retentionConfig`, lalu panggil `buildSessionHook({ data: { ...DATA, retention: DATA.retentionConfig }, cfg: DATA.retentionConfig.sessionHook })`. `session-hook.js:203` membaca `data.retention` dari parameternya, jadi komposisi ini cukup **STATUS 13 Sep: ✅ diselesaikan lewat jalur yang direkomendasikan baris ini** — terdaftar sebagai `DATA.retentionConfig`; `DATA.retention` (`retention.json`) utuh, diuji headless §1 |
| **G8** | katalog v2: `class`, `active`, `contents.cosmetics[]`, `contents.drip`, `methods[]` objek, tanpa `priceLabel`/`valueNote` | `shop-screen.js:465,468` membaca `valueNote`/`priceLabel`; `:138-146` mengiterasi `methods` sebagai **string**; `:166` `receipt.method.toUpperCase()`; `payment-system.js:59-90` hanya mengenal `contents.skin`/`acc`, bukan `cosmetics`/`drip`/`perks`; tidak ada filter `active` | 🔴 **harga kartu & tombol = undefined**, chip metode = `[object Object]`, **TypeError saat struk**, skin Paket Perdana & tetesan Kartu Imun **tidak diberikan**, `imun_12000` + `bundle_noads` (nonaktif) **ikut terjual**, receipt lama (`bundle_welcome`/`bundle_pass_m1`/`bundle_imun_pro`) → `find()` undefined → **throw** di `payment-system.js:125-126` · **STATUS 13 Sep: ✅ DITAMBAL (Fase 1B)** — `payment-system.js` ditulis ulang ke katalog v2 (`findProduct`/`getVisibleCatalog`/`getMethodsSorted`/`formatRp`/`valueSummary`/`badgeForProduct`, `grantContents` mengenal `cosmetics[]`+`drip`+`perks[]`, `resolveImunGrant`+`markFirstPurchase`, `payOrder` tidak lagi melempar), `shop-screen.js` tidak membaca `priceLabel`/`valueNote`/`METHOD_LABEL` lagi. Dibuktikan headless 62/62 |
| **G9** | field save baru: `meta.streak`, `meta.lastPlayedAt`, `meta.dropPity`, `meta.cratePity`, `meta.firstBuy` | **tidak ada** di `state-manager.js` (`createDefaultMeta`/`mergeMetaDefaults`) | aturan repo: field save baru wajib aman lewat deep-merge → **save lama pecah** bila dilewatkan **STATUS: ✅ dikerjakan** — `streak`, `lastPlayedAt`, `dropPity`, `cratePity`, `firstBuy` (+ `bp.runXpDay`/`bp.runXpToday` untuk cap BP) ada di `createDefaultMeta`/`mergeMetaDefaults`; save lama yang kehilangan field itu tetap dimuat tanpa kehilangan data pemain (diuji headless §2) |
| **G10** | baseline dokumen: BUILD **54a**, commit `1c43f41`/`dfa2270`, branch `arena/01a09795-imunverse`, **12 hero** (`validate-retention.mjs:131`), **7 hero** (`economy-anchors.json:65`, `validate-catalog.mjs:106` → 2.460 Imun), iklan **30 Imun × 5**, decay tubuh **tanpa batas** | repo ini: BUILD 50a→51a, **1 commit**, branch `arena/01a09a68-imunverse`, **11 hero**, iklan = **80 Antibodi** (`battlepass.json:331 offers.adAntibodi`, dipakai `shop-screen.js:385-395`) — tidak ada reward 30 Imun, `adDailyLimit` **sudah 6**, decay **sudah dibatasi 7 hari** (`body-system.js:86`) | angka "sebelum" di dokumen tidak semuanya menggambarkan repo ini; beberapa pekerjaan Fase 1.4 sudah sebagian terjadi, beberapa target harus dihitung ulang untuk roster 11 **STATUS sebagian: ✅ faucet iklan sudah diganti** — `offers.adAntibodi` **dihapus**, tile iklan kini `addImun(meta, getAdEconomy().imunPerAd)` = 10 Imun dengan kuota 6/hari dari anchors; `adDailyLimit` memang sudah 6. **Masih terbuka:** roster 11 vs 12/7 untuk target 2.460 Imun (§10 #9) |
| **G11** | `validate-retention.mjs` hanya membaca `data/retention-config.json` (baris 21); kolom "sebelum" hardcode (baris 95-104) | — | **validator tetap 0 error walaupun retune Fase 1.4 belum diterapkan.** Gerbang CI tidak mengunci pekerjaan itu — perlu cek tambahan (lihat Fase 1.5) **STATUS: ✅ ditambal** — `tools/validate-retune-sync.mjs` (29 pemeriksaan data repo vs config, exit 1) dirangkai ke `npm run validate` + CI. Terbukti merah ketika satu angka dikembalikan ke nilai lama |
| **G12** | `meta.battlepass` (`session-hook.js:132`) | kunci save repo adalah **`meta.bp`** (`battlepass-system.js:ensureBp`) | `bp` = undefined → **baris Battle Pass di hook akhir sesi kosong**. Solusi tanpa mengedit drop-in: kirim `{ ...meta, battlepass: meta.bp }` dari pemanggil (Fase 2.4) — §10 #11 |
| **G13** | `grantCosmetic` menginisialisasi `meta.cosmetics = { owned: [], skin: null, … }` (`rare-drop-system.js:127`) | 3 tempat repo menginisialisasi **`skin: {}`** (objek): `battlepass-system.js:192`, `imun-economy.js:42`, `payment-system.js:86` | siapa yang jalan lebih dulu menentukan bentuk `skin` → **bentuk save tidak konsisten**. **STATUS 13 Sep: jalur kanonik sudah disediakan** — `imun-economy.ensureCosmetics()` kini diekspor + `grantCosmetics(meta, ids)`; `payment-system.grantContents()` sudah memakainya (diuji: `skin` tetap `{}`). Sisa: pemanggil `rare-drop-system.grantCosmetic()` di Fase 4.2 **wajib** memanggil `ensureCosmetics()` lebih dulu — §10 #12 |
| **G15** | katalog v2 mensyaratkan (doc `bundle_noads`): flag `noAds` **tidak boleh** menyentuh placement rewarded; kuota iklan `adEconomy.dailyLimit` = 6/hari | `canWatchAd()` (`monetization.js:73`) **return false bila `meta.noAds`** → mematikan tile toko, peti boss, dan pemulihan tubuh; sebaliknya `revive` (`game.js:1817`) & `double currency` (`gameover-screen.js:237`) **tidak memanggil** `canWatchAd()` sama sekali → tak dibatasi kuota | pembeli `bundle_noads` (bila nanti diaktifkan) kehilangan faucet Imun harian + opsi revive-nya sendiri — persis alasan produk itu dipensiunkan. **Tidak diubah di Fase 1B** (produknya nonaktif, jadi belum bisa terpicu); keputusan di §10 #15 |
| **G14** | `restoreBody()` menulis ke `meta.bodyState.systems` | `meta.bodyState` = **`null`** pada save baru/lama sampai `body-system` mengisinya secara malas | hadiah "pulihkan tubuh" jadi **no-op diam-diam** dan modal bisa mengklaim sesuatu yang tidak terjadi. **SUDAH DIPERBAIKI di pemanggil:** `main.js:boot()` menugaskan `meta.bodyState = getBodyState(meta)` sebelum pass comeback — `getBodyState()` murni (mengembalikan salinan gabungan default). Diuji headless §3: sirkulasi 12 → **100** |

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

**Status Fase 1 per 13 Sep 2026 (BUILD 52a)**

| Item | Status | Catatan terverifikasi |
|---|---|---|
| 1.1 save server-side | ⛔ **DITUTUP oleh keputusan pemilik** (13 Sep) | Pilihannya: **tetap `localStorage` + PWA**, tanpa backend. Save tidak lintas perangkat — itu trade-off yang diterima. Pertahanan pengganti: **Fase 2.6 (PWA + service worker)** naik prioritas karena instalasi PWA menghindari penghapusan storage iOS 7 hari (§10 #10) |
| 1.2 telemetri | ⛔ **DITUTUP oleh keputusan pemilik** (13 Sep) | Tanpa backend tidak ada endpoint. Yang tetap hidup: `metrics.js` (one-more-run rate sudah dihitung lokal). **Pengganti yang masih terbuka**: ring buffer event lokal (`session_start`, `run_end`, `purchase`, `ad_watched` + `BUILD`) supaya D1/D7/D30 bisa dibaca per-perangkat tanpa langkah manual — belum dikerjakan, jangan diklaim setara telemetri server (§13) |
| 1.3 comeback + batas decay | ✅ **selesai** | `runComebackPass` sekali di `main.js:boot()` setelah `mergeMetaDefaults`/`applyDataLanguage` → `writeSave` bila berubah → `STATE.pendingComeback` → **satu** modal di `dashboard-screen.show()`. Batas decay dibaca dari `comeback.maxOfflineDecayDays` di `body-system.applyDailyDecay`, **bukan** lewat `cappedDecayDays()`: setelah boot `lastPlayedAt = now`, jadi pemanggilan dari `startRun` selalu menghasilkan 0 hari dan mematikan decay seluruhnya |
| 1.4 retune kurva | ✅ **selesai** | hasil ukur headless: run referensi (hero 12, wave 15, 250 kill) = **194,5 XP mentah → 120** (cap per run), 3 run = 360 lalu **0** (cap harian); level BP setelah 4 run + 1 misi harian = **3** (dulu pass tamat di 6,1 run). GP run menang = **331** (dulu 1.380) → 12.000 GP ≈ **36 run** (dulu 10,6). Fragmen evolusi **5,08/run** → pohon 167 fragmen ≈ **33 run** (dulu 0,6 run). Kuota bab = 55/66/77/88/99/110 |
| 1.5 gerbang CI | ✅ **selesai — butuh 1 langkah manusia** | Isi gerbang: `check` + `validate` (3 validator) + `test:fase1` + penolakan PR yang tidak mem-bump `BUILD` atau yang `?v=`-nya beda dari `BUILD`. Workflow disimpan di **`tools/ci/validate.yml`** karena push agent yang menyentuh `.github/workflows/**` **ditolak GitHub App** (tanpa izin `workflows`). Pasang: `npm run ci:install`, lalu commit + push dengan akun manusia |

**Yang ditemukan saat mengerjakan Fase 1 tetapi tidak diubah** (dilaporkan, bukan diputuskan sendiri):
`session-hook.js` & `rare-drop-system.js` masih kode mati (**G12**, **G13**, **G6**); `campaign.difficulties`
baru data tanpa logika (Fase 4.1); Toko masih rusak (**G8** → Fase 1B); `body-system.applyDailyDecay` di
dashboard tetap jalan seperti sebelumnya (hanya batas harinya yang kini 2, bukan 7).

`index.html?autotest=1` **tidak bisa dijalankan** di lingkungan kerja ini (tidak ada browser) — penggantinya
`scripts/unit-fase1-retune.mjs` (31 pemeriksaan headless atas jalur boot nyata). Self-test browser **tetap
wajib** dijalankan sebelum rilis; unit test ini pelengkap, bukan pengganti.

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

**Status Fase 1B per 13 Sep 2026 (BUILD 53a) — ✅ selesai, 62/62 pemeriksaan headless lolos**

| Butir | Hasil |
|---|---|
| 1 loader | ✅ sudah dikerjakan di Fase 1 (`DATA.retentionConfig` / `DATA.anchors`) |
| 2 harga/badge/aktif | ✅ `formatRp(priceRp)` + `valueSummary()` + `badgeForProduct()` (dari `pricing-model.js`); `priceLabel`/`valueNote` tidak dibaca lagi; hanya `getVisibleCatalog()` yang dirender → `imun_12000` & `bundle_noads` tidak tampil |
| 3 metode | ✅ objek `{id,name,mdrPct,…}`; `getMethodsSorted()` mengurut dari data (0,7% → 2,0% → 2,9%+Rp 2.000) = **QRIS dulu, kartu terakhir**; order menyimpan **id**; label pendek diturunkan dari `name` (bukan peta tulis tangan), nama lengkap di `title` |
| 4 grantContents | ✅ `cosmetics[]` (lewat `grantCosmetics`, bentuk kanonik), `drip` (50 Imun/hari × 30, **hangus** bila tidak diklaim), `perks[]` (`noForcedAds`, `adDailyLimitPlus2` → kuota 6→8, hidup sepanjang jendela kartu), Imun lewat `resolveImunGrant()` + `markFirstPurchase()` (2× sekali per tier) |
| 5 toleransi katalog | ✅ `payOrder()` mengembalikan `{ok:false}` bila produk hilang — tidak melempar; `createOrder()` menolak produk nonaktif, limit per akun habis, dan jendela 72 jam yang sudah lewat |
| 6 badge tulis tangan | ✅ tidak ada lagi di `js/` (diuji: satu-satunya `HEMAT n%` yang boleh ada adalah yang **dihitung** `pricing-model.js`); label `badge` di `premium.json` tetap dipakai sebagai fallback sesuai kontrak `badgeFor()` — file drop-in tidak diedit |
| 7 audit `noAds` & 5 placement | ⚠️ **selesai sebagai audit, bukan perubahan**: kelima placement masih hidup (tile toko, Suplemen Premium, peti boss, pemulihan tubuh dashboard, revive) dan kuota +2 perk berlaku; tetapi temuan **G15** (2 placement tanpa kuota + `noAds` mematikan rewarded) dilaporkan, tidak diputuskan sendiri |

Tambahan yang dibutuhkan agar entitlement nyata (bukan sekadar tidak error): field save `drip`, `perks`, `purchaseCount` di `state-manager.js` (aman lewat deep-merge; `receipts` dipangkas ke 30 entri sehingga tidak bisa dipakai menghitung batas per akun), fungsi perk/tetesan di `imun-economy.js`, dan UI status Kartu Imun (hari ke-n/30, sisa hari, tombol klaim) yang memakai kelas `.prem-receipts` yang sudah ada → **nol CSS baru** kecuali `flex-wrap` pada `.pay-methods`.

---

## 5. FASE 2 — Sesi pertama dan hook (menggerakkan D1/D7)

| # | Pekerjaan | Catatan |
|---|---|---|
| 2.1 | **Auto-fire saat diam** (model Archero) + toggle "Serang otomatis" di profil, default nyala | `game.js` tahap tembak; tahan-untuk-tembak & aim manual tetap; pasukan ikut aturan hero. Kriteria: pemain baru yang hanya menyentuh joystick tetap membunuh musuh dalam 10 detik pertama |
| 2.2 | **Tutorial — DITUNDA KE PALING AKHIR** (keputusan pemilik, 13 Sep 2026) | ✅ **BLOKIR TERTUTUP.** Pemilik memutuskan tutorial **tidak** dikerjakan di Fase 2 dan **dibangun ulang di paling akhir**, setelah seluruh fase inti selesai. Alasan pemilik: tutorial lama memang salah (banyak kekeliruan modal) dan **UI akan berubah lagi** selama fase inti, jadi membangunnya sekarang berarti membuang kerja. Konsekuensi urutan: Fase 1 → 1B → 2 (tanpa 2.2) → navigasi §6 → Fase 3 → Fase 4 → **baru** tutorial sebagai pekerjaan tersendiri (data-driven, ≤4 instruksi non-blocking, hanya run pertama, isi `coach.json`). Sampai saat itu `tutorial-system.js:79-85` (`shouldRun() → false`) dan catatan "DIMATIKAN TOTAL" di `coach.json` **dibiarkan apa adanya** — jangan "diperbaiki" |
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
3. **Kartu Imun 30 Hari** Rp 29.000: 300 Imun + tetesan 50/hari × 30 + perk `noForcedAds` & `adDailyLimitPlus2`; pemain bisa melihat sisa hari & jatah hari ini. **Sebagian besar sudah dikerjakan di Fase 1B** (entitlement, klaim harian yang hangus, perk +2 kuota, panel status di Toko) — sisanya: tampilkan sisa hari juga di dashboard/profil, dan putuskan G15 sebelum `noForcedAds` berarti sesuatu.
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
- ~~Perbarui header `imun-economy.js:1-9`~~ **LUNAS 13 Sep (Fase 1.4)** — header ditulis ulang, kini menyebut 5 sumber Imun (pembelian, Battle Pass, iklan rewarded 10 Imun × 6/hari dari anchors, comeback/streak dari retention-config, mastery).
- Perbaiki komentar `ensureFounderReward` yang menyebut 300 Imun padahal memberi 250 Antibodi.
- **G15**: putuskan apakah `revive` & `double currency` ikut kuota iklan harian, dan apakah `noAds` boleh mematikan placement rewarded (doc `bundle_noads` melarangnya). Perilaku lama dibiarkan sampai ada keputusan.
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
| 7 | ~~**G7**: `retention-config.json` didaftarkan sebagai `retentionConfig` (adapter) vs mengambil alih kunci `retention`~~ | **SELESAI 13 Sep** — jalur adapter dipilih (`DATA.retentionConfig`), `retention.json` lama tidak tersentuh |
| 8 | ~~**Tutorial (2.2)**: dua catatan di kode mengatakan owner menghapusnya permanen, brief menyuruh menghidupkan~~ | **SELESAI 13 Sep** — pemilik memutuskan **ditunda ke paling akhir** setelah seluruh fase inti; jangan dibangun sekarang (§5 2.2) |
| 9 | **G10**: dokumen memakai roster 12 hero & 7 hero; repo punya **11**. Angka mana yang dipakai untuk target 2.460 Imun dan "level 20 seluruh roster"? | terbuka |
| 10 | ~~**Infrastruktur 1.1/1.2**: Supabase vs VPS vs tetap `localStorage` + PWA~~ | **SELESAI 13 Sep — pemilik memilih `localStorage` + PWA (tanpa backend).** Konsekuensi yang diterima sadar: 1.1 & 1.2 ditutup sebagai *bukan-pekerjaan*, save tetap per-perangkat (risiko penghapusan storage iOS 7 hari ditangani lewat **install PWA**, Fase 2.6), dan KPI D1/D7/D30 **tidak bisa** diukur lintas perangkat — hanya dari riwayat sesi lokal (`metrics.js`). Bila nanti butuh angka retensi nyata, buka lagi keputusan ini |
| 11 | **G12**: adapter di pemanggil (`{ ...meta, battlepass: meta.bp }`) vs migrasi kunci save `meta.bp` → `meta.battlepass` | memblokir Fase 2.4 |
| 12 | **G13**: bentuk kanonik `meta.cosmetics.skin` — `{}` (repo, 3 tempat) vs `null` (drop-in) | memblokir Fase 4.2 |
| 14 | **Pasang gerbang CI di GitHub**: jalankan `npm run ci:install` (menyalin `tools/ci/validate.yml` → `.github/workflows/validate.yml`) lalu commit+push dengan akun manusia, **atau** beri App izin `workflows` (Settings → Actions → General → Workflow permissions) | **perlu manusia** — sampai terpasang, gerbang hanya jalan lokal (`npm run validate` + `npm run test:fase1`) |
| 15 | **G15**: (a) `revive` & `double currency` ikut kuota 6/hari atau memang sengaja bebas kuota? (b) `noAds` boleh mematikan placement rewarded, atau hanya banner/interstitial (sesuai doc katalog)? | terbuka — harus dijawab **sebelum** `bundle_noads` diaktifkan |
| 13 | **BP net −300** sudah diterapkan (harga 800 / kembali 500). Bila pemilik memilih model Fortnite (net 0) sesuai §10 #1, imbalan premium harus naik ke **800** Imun dan `premium.json` + `validate-retune-sync.mjs` ikut berubah | terbuka — terkait #1 |

---

## 11. Definisi selesai (per fase)

Semua harus benar, bukan sebagian:

- `npm run validate` lulus **0 error** — dan toleransi validator **tidak pernah** dilonggarkan
- `npm run check` lulus
- Self-test headless `index.html?autotest=1` → `SELFTEST_PASS`, dan **diperluas** untuk menutup jalur baru fase itu
- **Khusus Fase 1/1B:** karena tidak ada browser di lingkungan kerja, `?autotest=1` dilengkapi `npm run test:fase1` (31 pemeriksaan jalur boot) dan `npm run test:fase1b` (62 pemeriksaan katalog v2 + pembayaran). Self-test browser tetap wajib sebelum rilis
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
| D1 | 30% | `session_start` — ⚠️ **lokal saja** (keputusan §10 #10): per-perangkat, hilang bila storage dibersihkan; bukan angka kohort server |
| D7 | 10% | `session_start` |
| D30 | 4% | `session_start` |
| Tayangan iklan / DAU | 3,0 | `ad_watched` (kuota 6/hari) |
| Tingkat pembayar | 1,5% | `purchase` |
| One-more-run rate | 45% | **sudah dihitung** `js/systems/metrics.js` |
| Penyelesaian Battle Pass | 35% pembeli | telemetri + `battlepass` |

Bila setelah semua perbaikan D1 tetap < 25%, tersangkanya Fase 2 (onboarding, serangan manual, landscape) — **bukan** pacing.
