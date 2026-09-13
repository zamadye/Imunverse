# BRIEF EKSEKUSI UNTUK AGENT BUILDING — IMUNVERSE

**Repo:** `arena/01a09795-imunverse` · baseline BUILD 54a (`1c43f41` / `dfa2270`)
**Dokumen sumber kebenaran:** `docs/rekomendasi-struktur-imunverse.md` (v2.0)
**Sifat brief ini:** instruksi kerja. Setiap fase punya kriteria terima yang bisa diverifikasi mesin. Jangan lanjut ke fase berikutnya sebelum fase sebelumnya lulus.

---

## 0. Peran dan batasan

Kamu mengeksekusi rencana yang sudah diputuskan, bukan merancang ulang. Angka, kurs, dan kurva sudah difinalkan dan diverifikasi validator. Bila kamu yakin sebuah angka salah, **hentikan dan laporkan**, jangan diam-diam menggantinya — angka di file konfigurasi terikat pada target pacing yang diuji di CI, jadi mengubahnya sepihak akan membuat build gagal tanpa menjelaskan sebabnya.

Tiga hal yang tidak boleh kamu putuskan sendiri; tanyakan ke manusia (daftar lengkap di §7):
- apa pun yang mengubah harga jual atau isi produk IAP
- apa pun yang mengubah identitas gameplay (kendali, genre, kesulitan inti)
- apa pun yang menyentuh data pemain yang sudah ada tanpa jalur migrasi

---

## 1. Kontrak repo yang wajib dipatuhi

Repo ini punya aturan yang sudah konsisten dijalankan. Melanggarnya menghasilkan bug senyap.

| Aturan | Konsekuensi bila dilanggar |
|---|---|
| Semua angka gameplay hidup di `data/*.json`, bukan di `js/` | Angka jadi tidak bisa di-tune tanpa rilis kode |
| Gameplay berkomunikasi ke UI **hanya** lewat event bus `ui-bridge` (`emit`/`on`) | Cross-import mesin run ke modul UI merusak isolasi yang sudah ada |
| Setiap perubahan kode atau data → bump `BUILD` di `js/core/version.js` **dan** `?v=` di `index.html` | Pemain lama dapat campuran aset lama dan baru |
| String UI baru → tambahkan ke `data/lang.json` **dan** `TRANSLATE_FIELDS` di `data-store.js` | Teks tidak ikut berganti saat bahasa diubah, tanpa error |
| Destinasi menu baru → wajib terdaftar di `data/features.json` | Gerbang bersifat fail-closed: id tak terdaftar dianggap terkunci selamanya |
| File data baru → daftarkan di loader `data-store.js` | File tidak pernah dimuat, konsumen dapat `undefined` |
| Field save baru → harus aman lewat `mergeMetaDefaults` (deep-merge) | Save lama pecah |
| Sprite baru → daftarkan di manifest `sprite-loader` + preload | Aset dimuat saat runtime, muncul jank |

Tambahan baru dari brief ini:

- **Gerbang merge:** `npm run validate` harus lulus sebelum merge apa pun. Ia menjalankan dua validator (katalog IAP dan pacing retensi). Jangan pernah melonggarkan toleransi validator untuk membuat build lewat — perbaiki angkanya, atau laporkan.
- **Modul murni tetap murni:** empat modul baru (`pricing-model`, `comeback-system`, `session-hook`, `rare-drop-system`) tidak boleh menyentuh DOM, tidak menulis save, tidak memanggil `emit`. Pemanggilnya yang melakukan itu. Ini yang membuat mereka bisa diuji di CI tanpa browser.

---

## 2. Inventaris file

### 2.1 Drop-in — salin apa adanya, jangan diedit

| File | Tujuan di repo | Status |
|---|---|---|
| `economy-anchors.json` | `data/economy-anchors.json` | **baru** |
| `retention-config.json` | `data/retention-config.json` | **baru** |
| `premium.json` | `data/premium.json` | **mengganti** file lama |
| `pricing-model.js` | `js/systems/pricing-model.js` | **baru** |
| `comeback-system.js` | `js/systems/comeback-system.js` | **baru** |
| `session-hook.js` | `js/systems/session-hook.js` | **baru** |
| `rare-drop-system.js` | `js/systems/rare-drop-system.js` | **baru** |
| `validate-catalog.mjs` | `tools/validate-catalog.mjs` | **baru** |
| `validate-retention.mjs` | `tools/validate-retention.mjs` | **baru** |
| `package.json` | **akar repo** | baru, atau gabungkan bila sudah ada |

Catatan penempatan `package.json`: ia **harus** berada di akar repo, bukan di `tools/`. Node menentukan tipe modul sebuah file dari `package.json` terdekat ke file itu; validator meng-import modul di `js/systems/`, jadi deklarasi `"type": "module"` harus berlaku untuk seluruh pohon. File ini inert bagi browser — game tetap disajikan sebagai situs statis dan tidak butuh langkah build. Bila repo sudah punya `package.json`, gabungkan hanya bagian `scripts` dan pastikan `"type": "module"` ada.

Simpan juga dokumen v2.0 ke `docs/rekomendasi-struktur-imunverse.md` sebagai rujukan permanen.

### 2.2 Diedit oleh kamu — file yang sudah ada

Ini bukan drop-in. Setiap perubahan disebutkan di fase yang relevan.

`data/battlepass.json` · `data/upgrades.json` · `data/campaign.json` · `data/evolutions.json` · `data/ranks.json` · `data/cosmetics.json` · `data/features.json` · `data/lang.json` · `data/coach.json` · `data/modules.json`
`js/core/data-store.js` · `js/core/game.js` · `js/core/state-manager.js` · `js/core/version.js` · `js/main.js`
`js/save/save-manager.js` · `js/systems/body-system.js` · `js/systems/rank-system.js` · `js/systems/monetization.js` · `js/systems/payment-system.js` · `js/systems/metrics.js` · `js/systems/tutorial-system.js` · `js/systems/imun-economy.js` · `js/systems/evolution-system.js`
`js/ui/screens/shop-screen.js` · `gameover-screen.js` · `revive-screen.js` · `bosschest` · `prep-screen.js` · `upgrade-screen.js` · `dashboard-screen.js` · `hud-screen.js` · `codex-screen.js`
`js/input/input-handler.js` · `index.html`

### 2.3 Kamu buat dari nol

Backend save + telemetri (Fase 1), modal comeback (Fase 1), overlay tutorial (Fase 2), service worker + manifest PWA (Fase 2).

---

## 3. FASE 1 — Pondasi

**Tujuan:** menghentikan kebocoran yang membuat semua pekerjaan lain sia-sia. Tanpa fase ini, tidak ada gunanya menyentuh monetisasi.

### 1.1 Save server-side

Masalah: save hanya di `localStorage` key `imunverse.save.v1`, dan WebKit menghapus seluruh script-writable storage setelah tujuh hari tanpa interaksi. Akun di `account-system.js` juga murni lokal.

Kerjakan:
- Backend dengan tiga tabel: akun, save, dan receipt. Kolom save menyimpan seluruh objek `meta` sebagai JSON beserta stempel waktu pembaruan dan nomor versi save.
- Resolusi konflik last-write-wins berbasis stempel waktu. Bila stempel server lebih baru dari lokal saat login, server menang dan lokal ditimpa; sebaliknya lokal diunggah.
- `save-manager.js` tetap menulis ke `localStorage` sebagai cache offline, tetapi sumber kebenaran adalah server. Tulis ke server pada titik yang sama dengan `writeSave` sekarang (akhir run, startRun, pembelian, klaim misi, evolusi, body impact, sign-up), dengan debounce agar satu run tidak menghasilkan puluhan request.
- Sinkronisasi harus tahan gagal: bila jaringan mati, permainan berjalan penuh dari cache dan mengantre unggahan. Jangan pernah memblokir gameplay menunggu jaringan.
- Migrasi: pemain yang sudah punya save lokal dan kemudian sign-up harus mengunggah save lokalnya, bukan menimpanya dengan akun kosong. Ini kasus yang paling mudah salah — uji secara eksplisit.

Kriteria terima:
- Hapus seluruh site data di browser, login dengan akun yang sama, seluruh progres kembali utuh termasuk mata uang, unlock hero, level, dan `receipts`.
- Mode pesawat: game tetap bisa dimainkan penuh satu run dan menyimpan; setelah online, progres tersinkron tanpa kehilangan.
- Copy di layar auth yang menjanjikan progres tersimpan aman sekarang akurat. Jangan ubah copy-nya; buat sistemnya menyusul kalimat itu.

### 1.2 Telemetri

Masalah: `metrics.js` sudah menghitung KPI yang tepat termasuk one-more-run rate, tapi datanya tidak pernah meninggalkan perangkat, sehingga D1/D7/D30 tidak diketahui.

Kerjakan:
- Endpoint penerima event. Empat event cukup: mulai sesi, run selesai, pembelian, iklan ditonton. Setiap event membawa id akun, stempel waktu, versi BUILD, dan payload spesifik (untuk run selesai: wave, kill, boss, durasi, mode, bab, hero, menang atau tidak).
- Kirim batch, bukan per event. Antre di memori, kirim saat akhir run dan saat tab disembunyikan.
- Jangan kirim data pribadi apa pun selain id akun internal.
- Sediakan query untuk menghitung D1, D7, dan D30 dari tabel event.

Kriteria terima: setelah satu hari trafik nyata, angka D1 bisa dihitung dan ditampilkan tanpa langkah manual.

### 1.3 Comeback dan peluruhan tubuh

Masalah: kondisi tubuh meluruh 1 poin per hari secara rolling tanpa batas, sehingga pemain yang kembali setelah dua minggu menemukan lima sistemnya kritis dan run pertamanya dihukum.

Kerjakan:
- Panggil pass comeback satu kali saat boot, setelah save dimuat dan digabung ke default, sebelum dashboard dirender. Bila pass mengembalikan hadiah, tampilkan modal; bila ia menandai perubahan, tulis save.
- Ubah `body-system.js` supaya jumlah hari peluruhan datang dari pass ini, bukan dari selisih tanggal mentah. Batasnya ada di konfigurasi retensi.
- Tambahkan field save baru untuk waktu main terakhir, streak, dan konter pity — semuanya harus aman lewat `mergeMetaDefaults`.
- Modal comeback menampilkan: hari streak, hadiah streak, hadiah kembali bila ada, dan pernyataan bahwa tubuh sudah dipulihkan. Satu modal, bukan tiga.

Kriteria terima: simulasi di validator retensi lulus — bolos satu hari tidak mematahkan streak, absen 20 hari hanya meluruh 2 hari dan memicu hadiah kembali.

### 1.4 Retune kurva

Semua target dan angka baru ada di `data/retention-config.json`. Tugasmu memindahkannya ke file data yang sesungguhnya dipakai sistem, lalu memastikan validator setuju.

| File | Yang berubah |
|---|---|
| `battlepass.json` | Rumus XP per level naik; XP per run dibatasi per run dan per hari; sumber XP baru dari misi harian, mingguan, dan bab bersih; biaya premium naik ke 800 Imun; imbalan Imun di track premium jadi 500; hapus field mati imbalan Antibodi dari iklan; hapus catatan lama yang mengklaim track premium memberi 525 Imun |
| `upgrades.json` | Kuota iklan harian 5 → 6; pertumbuhan biaya level hero 1,35 → 1,22 |
| `ranks.json` atau `rank-system.js` | Seluruh perolehan GP dibagi 4,5 |
| `evolutions.json` | Peluang drop fragmen turun untuk musuh biasa dan elite; jaminan boss turun; biaya tiap tahap naik |
| `campaign.json` | Kuota kill dikali pengganda global; tambahkan definisi tiga tingkat kesulitan |
| `monetization.js` atau sumber datanya | Imbalan iklan 30 → 10 Imun |

Perhatian khusus pada Battle Pass: pergeserannya disengaja dari menghargai satu run panjang menjadi menghargai kehadiran harian. Kalau kamu menemukan cara membuat pemain menyelesaikan 30 level lebih cepat, itu bukan optimisasi — itu membatalkan tujuannya.

Kriteria terima: `npm run validate` lulus dengan 0 error. Bila sebuah target meleset, laporkan angkanya; jangan longgarkan toleransi.

### 1.5 Gerbang CI

Pasang `npm run validate` sebagai langkah wajib sebelum merge. Tambahkan juga pemeriksaan bahwa `BUILD` di `version.js` berbeda dari `main` pada setiap PR yang menyentuh `js/` atau `data/`.

---

## 4. FASE 2 — Sesi pertama dan hook

**Tujuan:** memperbaiki menit nol dan memberi alasan menekan MAIN LAGI. Fase ini yang menggerakkan D1 dan D7.

### 2.1 Auto-fire saat diam

Masalah: serangan 100% manual di genre yang seluruh pesaingnya auto-attack, digabung dengan nol tutorial, menghasilkan sepuluh detik pertama di mana pemain tidak tahu apa-apa terjadi.

Kerjakan: pada tahap tembak di pipeline update, jika pemain tidak memberi input gerak dan ada target dalam jangkauan, tembak otomatis pada irama serang normal. Menahan tombol serang tetap bekerja seperti sekarang, termasuk saat bergerak. Aim manual tidak berubah. Pasukan mengikuti aturan yang sama dengan hero.

Sediakan toggle "Serang otomatis" di layar profil, default menyala. Ini keputusan identitas game, jadi togglenya wajib ada — bukan opsional.

Kriteria terima: pemain baru yang tidak menyentuh tombol apa pun selain joystick tetap membunuh musuh dalam 10 detik pertama.

### 2.2 Tutorial 60 detik

Masalah: `tutorial-system.js` dibangun utuh lalu dimatikan; `coach.json` berisi nol langkah.

Kerjakan: hidupkan kembali sistem tutorial hanya untuk run pertama. Isi langkah-langkahnya di data, bukan di kode. Cakupannya maksimal empat instruksi, semuanya non-blocking dan bisa dilewati: gerak, serang, skill pertama saat terbuka di level 3, dan tujuan run. Jangan menambahkan modal yang menghentikan permainan. Isi juga `coach.json` untuk tur dashboard sekali jalan.

Kriteria terima: run pertama bisa diselesaikan tanpa pemain pernah bertanya apa yang harus dilakukan; sesi pertama tidak lebih pendek dari sebelumnya karena instruksi.

### 2.3 Lepas gerbang landscape dari layar menu

Masalah: gerbang rotasi tampak berlaku global, padahal seluruh layar menu sudah bertata letak vertikal.

Kerjakan: batasi gerbang rotasi sehingga hanya aktif saat state layar adalah gameplay. Dashboard, roster, shop, prep, gameover, dan semua modal harus bisa dibuka dalam mode potret. Verifikasi dulu apakah gerbangnya memang global sebelum mengubah; bila ternyata sudah dibatasi, laporkan dan lewati.

### 2.4 Hook akhir sesi

Kerjakan: pada layar akhir run, panggil pembangun hook dengan meta, ringkasan run terakhir, seluruh data store, progres misi dari sistem misi, dan ring buffer dari `metrics.js`. Render headline dan maksimal tiga baris **di atas** tombol Main Lagi, bukan di bawahnya.

Setiap baris menampilkan label, progres, dan jarak dalam run. Jarak dalam run adalah intinya — jangan menggantinya dengan persentase atau angka mentah karena terlihat lebih rapi.

Kriteria terima: pada profil pemain uji di validator, hook menghasilkan tiga baris dari tiga jenis sistem berbeda, semuanya dengan estimasi 1–6 run.

### 2.5 Hitung mundur reset harian

Jendela 24 jam rolling dipertahankan. Yang ditambahkan adalah keterbacaannya: tampilkan sisa waktu di dashboard, di layar akhir run, dan di panel misi HUD, dengan penekanan visual saat tersisa di bawah ambang yang ada di konfigurasi.

### 2.6 PWA

Kerjakan: manifest aplikasi, service worker untuk cache aset, dan prompt pasang yang muncul setelah run ketiga — sekali, bisa ditolak permanen.

Ini bukan sekadar kenyamanan. Aplikasi yang dipasang ke home screen dikecualikan dari penghapusan penyimpanan tujuh hari, jadi ini lapisan pertahanan kedua untuk save di iOS. Dua manfaat dari satu pekerjaan.

---

## 5. FASE 3 — Monetisasi

**Tujuan:** memasang katalog yang konsisten. Baru masuk akal setelah Fase 1 dan 2 hidup.

### 3.1 Valuasi dari satu sumber

Kerjakan: daftarkan dua file data baru di loader. Sambungkan `pricing-model.js` ke layar toko. Hapus **seluruh** string badge statis dari UI dan dari `premium.json`; badge dihitung runtime.

Kriteria terima: mencari string "HEMAT" di seluruh `js/` dan `data/` tidak menemukan satu pun angka yang ditulis tangan.

### 3.2 Bonus pembelian pertama

Kerjakan: di titik pemberian isi produk pada sistem pembayaran, gunakan penyelesai bonus dari `pricing-model.js` alih-alih membaca jumlah Imun mentah dari katalog. Setelah pemberian berhasil, tandai tier tersebut sudah memakai bonus. Tampilkan di kartu produk bahwa bonus 2x hanya berlaku sekali, dan hilangkan penandanya setelah terpakai.

Berlaku hanya pada dua tier terbawah. Jangan perluas ke tier lain.

### 3.3 Kartu Imun 30 Hari

Kerjakan: dukung isi bertipe tetesan harian di pemberian isi produk — jumlah per hari dan durasi hari, dengan pengambilan yang dianggarkan per hari kalender rolling seperti kuota iklan. Tambahkan perk yang mematikan iklan paksa saja dan menambah kuota iklan harian.

Pemain harus bisa melihat sisa hari dan jumlah yang sudah diambil. Bila pemain melewatkan hari, jatah hari itu hangus — jangan menumpuk, karena penumpukan menghapus alasan login harian yang justru menjadi tujuan produk ini.

### 3.4 Dua sink Imun berulang

Keduanya menempel pada modal yang sudah ada, jadi tidak butuh layar baru.

- **Lanjut Run, 50 Imun** di modal revive. Muncul sebagai opsi kedua di samping tawaran iklan. Batas satu per run, terpisah dari batas revive iklan.
- **Peti Riset, 150 Imun** di modal peti boss. Memakai fungsi peti dari `rare-drop-system.js`, dengan konter pity yang terpisah dari pity drop gratis. Jangan gabungkan keduanya.

### 3.5 Audit perilaku bebas iklan

Kerjakan: telusuri semua tempat flag bebas iklan dibaca dan pastikan tidak ada satu pun placement rewarded yang dinonaktifkan olehnya. Lima placement yang harus tetap hidup: tile toko, peti boss, revive, currency akhir run, pemulihan tubuh dashboard.

Produk bebas iklan permanen tetap nonaktif di katalog. Jangan mengaktifkannya.

---

## 6. FASE 4 — Kedalaman dan pembayaran nyata

### 4.1 Tiga tingkat kesulitan kampanye

Pengganda konten termurah yang tersedia, dan seluruhnya data. Pengganda HP boss per bab sudah ada di kode, jadi yang ditambahkan adalah lapisan tingkat kesulitan di atasnya: enam bab menjadi delapan belas penyelesaian tanpa satu pun aset baru.

Kerjakan: penyelesaian dilacak per bab **per tingkat**, bukan per bab saja. Tingkat berikutnya terbuka setelah tingkat sebelumnya bersih. Peta Tubuh menampilkan tingkat mana yang sudah bersih pada tiap node. Imbalan dikali sesuai pengganda di konfigurasi. Migrasi: pemain yang sudah membersihkan sebuah bab dianggap sudah bersih di tingkat Normal.

### 4.2 Drop kosmetik langka

Kerjakan: tambahkan penanda "bisa jatuh untuk pemain gratis" ke item di katalog kosmetik. Panggil roll drop dari titik musuh terbunuh, tepat setelah fragmen evolusi dihitung. Bila ada drop, berikan kosmetik dan kirim event lewat `ui-bridge` untuk perayaan visual.

Tampilkan progres pity di suatu tempat yang bisa dilihat pemain — profil atau koleksi. Pity yang tidak terlihat tidak memberi harapan, dan harapan itulah gunanya.

Jangan mengubah peluang atau ambang pity. Angkanya sudah diverifikasi Monte Carlo 20.000 percobaan menggunakan modul yang sama persis; mengubahnya akan menggagalkan validator.

### 4.3 Pecah upgrade global

Kerjakan: level 1 sampai 10 tiap jalur upgrade global dibayar dengan Antibodi, level 11 ke atas dengan Imun. Biaya Antibodi memakai kurs resmi terhadap biaya Imun yang digantikan. Layar Lab Pasukan harus jelas menunjukkan mata uang mana yang berlaku pada level mana. Pemain yang sudah membeli level 1–10 dengan Imun tidak boleh dirugikan — tentukan bersama manusia apakah dikembalikan atau dibiarkan.

### 4.4 Web Push

Maksimal satu notifikasi per hari, isinya spesifik dan personal — sisa waktu streak, misi yang tinggal sedikit, musim yang akan berakhir. Bukan ajakan umum. Opt-in eksplisit, mudah dimatikan.

### 4.5 Payment gateway nyata

Ganti isi fungsi pembayaran simulasi dengan permintaan ke gateway, konfirmasi lewat webhook, dan pemberian entitlement **dari server**, bukan dari klien. Ini sudah ditulis sebagai rencana di komentar sistem pembayaran; ikuti.

Urutan metode di UI: QRIS lebih dulu, kartu terakhir. Biaya kartu efektif jauh lebih tinggi pada tier kecil.

Jangan aktifkan tier whale sampai ada data ARPPU nyata dari telemetri.

---

## 7. Utang teknis yang ikut dibereskan

Kerjakan kapan pun menyentuh file terkait, jangan dijadikan fase sendiri:

- Hapus kelas ability lama, katalog ability-nya, dan field ability di tiap tahap evolusi. Semuanya vestigial — di-import tanpa pernah diinstansiasi.
- Hapus pemetaan state layar untuk layar fokus yang sudah tidak terdaftar.
- Sinkronkan toast pengali koin ganda yang menulis "+50%" dengan pengali sesungguhnya. Ini menyentuh item yang dijual di toko, jadi bukan sekadar teks.
- Perbarui header usang di sistem ekonomi Imun yang masih menyatakan Imun hanya berasal dari pembelian dan Battle Pass.
- Perbaiki komentar imbalan founder yang menyebut 300 Imun padahal kode memberi 250 Antibodi.
- Perbaiki penyebut nol pada penghitung Bio-Pedia di state awal.

---

## 8. Navigasi — kerjakan setelah Fase 2, sebelum Fase 3

Saat ini ada empat sistem navigasi untuk dua belas destinasi: dock bawah, sidebar, quick row, dan dua menu HUD. Beberapa destinasi muncul di tiga tempat.

Kerjakan: pertahankan dock bawah permanen lima slot dan satu sheet "Perjalanan". Hapus sidebar. Gabungkan kedua menu HUD menjadi satu sheet yang identik dengan yang di dashboard. Seluruh perubahan tetap melewati `features.json`; jangan ada destinasi yang lolos gerbang karena dipindah.

Angkat tiga indikator ke topbar permanen: Pangkat, Battle Pass, dan item teratas dari hook sesi. Sembilan sistem lain tetap ada, hanya berhenti berebut perhatian.

---

## 9. Yang harus kamu tanyakan, jangan putuskan sendiri

1. **Battle Pass net −300 versus net 0.** Konfigurasi memakai −300. Alternatifnya pass membiayai dirinya sendiri selamanya. Ini pilihan antara pendapatan dan retensi.
2. **Apakah auto-fire diterima.** Bila jawabannya tidak, tutorial menjadi lebih wajib, bukan kurang.
3. **Fagositosis menghapus drop.** Kill yang ditelan tidak menjatuhkan apa pun, jadi modul itu menghukum penggunaannya sendiri. Belum jelas apakah disengaja sebagai trade-off.
4. **Kompensasi pembeli upgrade global level 1–10** saat jalur itu pindah ke Antibodi.
5. **Skin pendiri** tersedia lewat imbalan founder dan lewat Paket Perdana sekaligus, melemahkan eksklusivitas keduanya.
6. Apa pun yang mengubah harga jual, isi produk, atau angka yang diuji validator.

---

## 10. Definisi selesai

Sebuah fase selesai bila semuanya benar:

- `npm run validate` lulus dengan 0 error
- Self-test headless (`?autotest=1`) lulus, dan kamu sudah memperluasnya untuk menutupi jalur baru di fase itu
- `BUILD` dan `?v=` sudah dibump
- Save dari BUILD sebelumnya dimuat tanpa kehilangan data — uji dengan save nyata, bukan save kosong
- Seluruh string baru ada di kamus bahasa dan berganti saat bahasa diubah, tanpa reload
- Tidak ada angka gameplay baru yang di-hardcode di `js/`
- Tidak ada modul murni yang mulai menyentuh DOM, save, atau event bus

Laporkan tiap fase dengan: apa yang berubah per file, hasil kedua validator, hasil self-test, dan daftar hal yang kamu temukan tapi tidak kamu ubah.

---

## 11. Anti-pattern

- Jangan melonggarkan toleransi validator agar build lewat.
- Jangan memindahkan angka dari data ke kode "sementara".
- Jangan menambah modal yang menghentikan permainan di run pertama.
- Jangan membuat sink Imun baru di luar yang tercantum; setiap sink baru menggeser seluruh kalkulasi dinding premium.
- Jangan menyentuh kurs Imun atau kurs Antibodi. Semua yang lain diturunkan darinya.
- Jangan mengaktifkan produk yang ditandai nonaktif di katalog.
- Jangan mengganti "jarak dalam run" di hook sesi dengan persentase.
- Jangan mengerjakan Fase 3 sebelum Fase 1 hidup di produksi. Katalog yang rapi di atas save yang menghilang adalah cara tercepat mengubah bug teknis menjadi masalah hukum.
