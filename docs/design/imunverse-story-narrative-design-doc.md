# Imunverse — Story & Narrative Design Doc
**Versi:** 1.0
**Status:** Draft untuk tim narrative, art, dan animasi
**Tujuan dokumen:** Menetapkan hook cerita, struktur naratif, karakter pemandu, panduan bahasa awam, dan arahan visual/cinematic — supaya pemain awam medis paham *kenapa* mereka bermain, bukan cuma paham *cara* bermain.

---

## 1. Masalah yang Diselesaikan Dokumen Ini

Saat ini pemain masuk langsung ke gameplay (pilih hero → wave → upgrade) tanpa konteks emosional. Tanpa cerita, sel imun cuma terasa seperti "karakter fantasi dengan skin biologi" — padahal tema imun ini justru aset diferensiasi terbesar Imunverse (lihat design doc combat sebelumnya). Cerita yang tepat harus:
1. Memberi **stakes personal**, bukan cuma "selamatkan dunia dari virus" yang generik.
2. **Menerjemahkan** istilah biologi ke bahasa awam secara alami, tanpa terasa seperti buku pelajaran.
3. Punya **karakter pemandu** yang jadi jembatan emosional antara pemain dan dunia mikroskopis yang asing.
4. Disampaikan lewat **visual**, bukan cuma teks dialog — sesuai instruksi bahwa cerita harus dibawa lewat cinematic, animasi, dan desain karakter.

---

## 2. Hook Utama: Struktur Naratif Dua Lapis

### 2.1 Premis inti
Pemain terbangun sebagai sel imun **tanpa tahu di tubuh siapa mereka berada** — hanya tahu satu hal: kalau mereka kalah, Inang (Sang Pemilik Tubuh) akan mati. Identitas Inang **sengaja dirahasiakan** di awal dan baru terungkap bertahap sepanjang campaign — ini hook rasa penasaran (mystery hook) yang jauh lebih kuat daripada "selamatkan dunia dari virus jahat" yang sudah terlalu sering dipakai di genre ini.

### 2.2 Kenapa dua lapis (Makro + Mikro)
Untuk menyelesaikan masalah "bahasa medis terlalu berat untuk awam", cerita disampaikan lewat **dua sudut pandang paralel** yang saling menerjemahkan satu sama lain:

| Lapisan | Setting | Siapa yang bicara | Fungsi naratif |
|---|---|---|---|
| **Makro** | Ruang periksa/rumah sakit, dunia nyata | **Dr. [nama]** — dokter yang merawat Inang, bicara ke keluarga/pasien | Menjelaskan situasi dengan **bahasa sehari-hari** yang orang awam sudah biasa dengar dari dokter asli ("tubuhnya sedang melawan infeksi", "sel darah putihnya bekerja keras") |
| **Mikro** | Dunia mikroskopis di dalam tubuh, tempat gameplay terjadi | **RIA** (pemandu in-game, lihat Bagian 3.2) | Menerjemahkan ucapan dokter di lapisan makro jadi **konteks gameplay** yang pemain sedang alami saat itu juga |

Efeknya: setiap kali dokter bicara di layar (cutscene singkat), pemain langsung mengerti kenapa wave berikutnya lebih susah, atau kenapa boss baru muncul — karena mereka sudah dengar penjelasannya dalam bahasa manusia biasa, bukan istilah biologi teknis.

### 2.3 Contoh alur penerjemahan (dipakai konsisten di seluruh game)
> **Dokter (makro):** "Suhu badannya naik terus, ini tandanya tubuh lagi kerja keras ngelawan infeksi."
> **RIA (mikro, muncul tepat sebelum wave/boss baru):** "Suhu naik berarti sinyal darurat dikirim ke seluruh pasukan — bersiap, gelombang musuh berikutnya bakal lebih ganas dari biasanya."

Pola ini yang dipakai di setiap transisi chapter: **dokter memberi info dunia nyata → RIA menerjemahkan jadi konsekuensi gameplay.**

---

## 3. Karakter Pemandu

### 3.1 Dr. [Nama] — Suara Lapisan Makro
- **Peran naratif:** Dokter yang merawat Inang, muncul di cutscene pembuka, transisi chapter, dan epilog. Tidak pernah muncul saat gameplay aktif berlangsung — ia murni pengantar konteks.
- **Kepribadian:** Tenang, hangat, tidak menakut-nakuti — bicara ke pasien/keluarga seperti dokter yang benar-benar peduli, bukan dokter kaku ala drama medis. Ini penting supaya nuansa cerita tetap ringan meski temanya soal sakit, cocok untuk audiens kasual 15-35 tahun.
- **Desain visual disarankan:** Jas putih casual (bukan formal kaku), warna aksen hijau muda/teal (selaras palet UI Imunverse yang sudah ada), ekspresi wajah ramah dengan sedikit "kelelahan hangat" (menyiratkan dedikasi tanpa terasa berat).
- **Gaya bicara:** Kalimat pendek, istilah medis nol atau minimal, selalu diikuti analogi sehari-hari. Contoh dialog pembuka:
  > "Tenang, ya. Tubuhnya kuat — dari dalam sana, ada 'pasukan' yang sedang bertugas jaga siang malam. Kita cuma perlu kasih waktu."

### 3.2 RIA (Respons Imun Adaptif) — Suara Lapisan Mikro / Pemandu In-Game
- **Peran naratif:** "Kesadaran" internal tubuh — representasi dari sistem imun adaptif itu sendiri, bukan karakter eksternal yang dipaksakan masuk ke dunia mikroskopis (ini penting: dokter asli tidak masuk akal berada "di dalam" tubuh, jadi guide di dalam gameplay harus organik dari lore, bukan reskin dokter).
  - Ini juga alasan naratif kenapa hero-hero (Mako, Dendri, dll) bisa saling terkoordinasi — RIA-lah yang jadi "jaringan komunikasi" antar sel imun, sekaligus justifikasi lore untuk sistem Antigen Memory di combat design doc (RIA secara harfiah adalah sistem yang "menyimpan ingatan" terhadap musuh).
- **Kepribadian:** Bersemangat, sedikit jenaka, seperti rekan satu tim yang selalu siaga di earpiece — bukan figur otoritas yang menggurui. Ini kontras sengaja dengan Dr. [Nama] yang lebih tenang, supaya dua lapisan terasa beda nuansa.
- **Desain visual disarankan:** Bukan karakter humanoid seperti 11 hero — melainkan bentuk energi/sinyal abstrak (misal partikel cahaya biru-hijau yang membentuk pola saraf/neural), muncul sebagai HUD element kecil di pojok layar saat memberi barks, bukan karakter besar yang menghalangi gameplay.
- **Fungsi ganda (naratif + UX):** RIA adalah karakter yang sama dengan yang memberi tutorial gameplay (level-up, unlock fitur), sehingga tidak perlu 2 sistem terpisah untuk "tutorial voice" dan "story voice" — hemat produksi.

### 3.3 Kenapa bukan "dokter generik di dalam tubuh"
Opsi awal yang sering dipakai game sejenis: karakter dokter/ilmuwan yang "menyusut" masuk ke tubuh (seperti Innerspace/Osmosis Jones). Ini dihindari karena:
1. Butuh justifikasi lore tambahan yang rumit (kenapa manusia bisa masuk ke tubuh manusia lain).
2. Tidak organik dengan tema "kamu ADALAH sel imun", bukan "kamu mengendalikan sel imun dari luar".
3. RIA sebagai representasi sistem imun itu sendiri justru memperkuat fantasi utama game: pemain literally menjadi bagian dari tubuh yang mereka lindungi.

---

## 4. Panduan Bahasa & Terjemahan Istilah

Prinsip: **setiap istilah biologi yang muncul di gameplay/UI harus punya versi "terjemahan awam" yang dipakai di dialog**, sementara istilah teknis tetap dipertahankan di nama hero/UI (karena itu bagian dari identitas brand & Bio-Pedia sudah dirancang edukatif).

| Istilah teknis (tetap dipakai di nama/UI) | Terjemahan awam (dipakai di dialog RIA/Dokter) |
|---|---|
| Makrofag (macrophage) | "Si penjaga yang nelan musuh bulat-bulat" |
| Sel dendritik (dendritic) | "Mata-mata yang ngasih tau lokasi musuh ke pasukan lain" |
| Neutrofil (neutrophil) | "Pasukan garis depan, yang paling cepat sampai lokasi" |
| Antibodi/opsonisasi | "Nempelin 'label incar' ke musuh biar gampang dihabisin bareng-bareng" |
| Sitokin (cytokine) | "Sinyal darurat yang manggil bala bantuan" |
| Sel T sitotoksik (T-CD8) | "Eksekutor yang langsung tumpas musuh yang udah ketahuan" |
| Sel memori (memory cell) | "Yang inget musuh lama, jadi kalau ketemu lagi langsung lebih jago ngelawannya" |
| Peradangan (inflammation) | "Zona 'panas' — ampuh buat musuh, tapi bahaya juga kalau lo masih di situ" |
| Autoimun (khusus late-game) | "Kondisi langka pasukan salah kenali kawan jadi lawan — situasi paling berat" |

Aturan penulisan dialog: **maksimal 1 istilah teknis per kalimat**, selalu diikuti analogi di kalimat yang sama atau kalimat berikutnya. Jangan pernah 2 istilah teknis beruntun tanpa jeda penjelasan.

---

## 5. Struktur Campaign & Pemetaan Cerita

Setiap "Kampanye" (yang sudah ada di menu dashboard) dipetakan ke kondisi kesehatan nyata yang relatable, disusun dari yang paling ringan/related ke yang paling berat secara emosional — sekaligus jadi kurva kesulitan gameplay yang natural:

| Chapter | Kondisi nyata (dari sisi Inang) | Tema emosional | Boss/gatekeeper tematik |
|---|---|---|---|
| 1. Luka Kecil | Inang kena luka gores/tergores pisau | Perkenalan dunia & mekanik dasar | Bakteri infeksi luka ringan |
| 2. Demam Pertama | Inang kena flu biasa | Naik tensi sedikit, RIA mulai jelasin sistem sinyal (cytokine) | Virus flu bermutasi jadi lebih kuat tiap wave |
| 3. Keracunan | Inang makan sesuatu yang tidak higienis | Twist ringan: musuh muncul lebih cepat dan acak, RIA & dokter mulai lebih waspada di dialog | Bakteri pencernaan, boss AoE |
| 4. Alergi Parah | Sistem imun Inang bereaksi berlebihan | Mulai diperkenalkan konsep "musuh dalam selimut" — pasukan sendiri yang overreact, menyiapkan tema chapter final | Sel alergen, mekanik unik: damage ke diri sendiri kalau salah target |
| 5. Ancaman Tersembunyi | Sel kanker mulai tumbuh (twist: musuh bukan dari luar, tapi dari dalam) | Titik balik emosional — reveal parsial soal siapa Inang, nada cerita jadi lebih serius | Sel kanker, mekanik stealth/menyamar sebagai sel sehat |
| 6 (Final). Pertahanan Terakhir | Kondisi kritis, klimaks | Reveal penuh identitas Inang, dokter & RIA bicara bersamaan (cutscene paralel makro-mikro) | Boss gabungan — semua tipe ancaman sebelumnya muncul bersamaan |

Epilog: setelah chapter final selesai, cutscene makro menunjukkan Inang sembuh dan bangun — dan di sinilah identitas Inang akhirnya diperlihatkan penuh (disarankan: sosok yang universal-relatable, misal seorang anak kecil atau kakek/nenek, supaya resonansi emosionalnya luas lintas usia pemain).

---

## 6. Contoh Naskah Dialog (Siap Pakai, Bukan Placeholder)

### 6.1 Cutscene Pembuka (Chapter 1)
> **Dr. [Nama]** *(bicara ke orang tua/keluarga di ruang periksa):*
> "Cuma luka gores kok, tapi tetap harus diperhatikan — kalau kotor sedikit saja, bisa infeksi. Untungnya tubuh kita udah ada 'pasukan' sendiri yang langsung siaga begitu ada luka."
>
> *(Transisi ke dunia mikroskopis — RIA muncul sebagai HUD signal di pojok layar)*
>
> **RIA:** "Woy, bangun! Ada celah masuk di lengan sebelah sini, dan bakteri udah mulai nyusup duluan. Lo satu-satunya yang deket lokasi — gerak sekarang, gih!"

### 6.2 Transisi Chapter 2 (naik tensi)
> **Dr. [Nama]:** "Suhunya naik jadi 38.5, tapi ini normal kok — badan lagi kerja ekstra ngelawan virus flu-nya."
>
> **RIA:** "Denger itu? Suhu naik artinya sinyal bahaya baru aja dikirim ke seluruh badan. Bentar lagi bala bantuan bakal lebih banyak yang dateng — tapi musuhnya juga makin ganas. Siap-siap."

### 6.3 Reveal Boss Chapter 5 (twist "musuh dari dalam")
> **RIA** *(nada berubah, lebih serius dari biasanya):* "Ini... ini beda. Sel ini bukan penyusup dari luar. Dia... dia bagian dari kita yang somehow salah tumbuh. Gue nggak yakin gimana cara ngenalinnya sebagai musuh, tapi kita nggak punya pilihan lain."
>
> **Dr. [Nama]** *(di layar terpisah, nada lebih pelan ke keluarga pasien):* "Ada hasil yang perlu kita perhatikan lebih lanjut. Bukan berarti hal terburuk — tapi kita perlu waktu untuk memastikan."

### 6.4 Epilog (setelah chapter final)
> *(Layar makro: kamar rumah sakit, cahaya pagi masuk lewat jendela)*
>
> **Dr. [Nama]:** "Selamat, bertahan dengan baik. Sekarang tinggal istirahat, biar 'pasukan' di dalam sana yang lanjutin kerjanya."
>
> *(Cut ke wajah Inang — direveal penuh untuk pertama kali)*
>
> **RIA** *(nada lega, sedikit haru):* "Kerja bagus. Lo nggak akan pernah ketemu dia secara langsung, tapi... dia baru aja dapet satu hari lagi buat hidup, gara-gara lo."

---

## 7. Arahan Visual & Cinematic

### 7.1 Prinsip produksi (realistis untuk tim HTML5/web, bukan studio AAA)
Alih-alih full 3D cinematic (mahal & tidak perlu), gunakan pendekatan **2D animated cutscene berlapis** (parallax + limited animation, mirip gaya visual novel modern atau opening anime hemat-budget):
- Background statis berkualitas tinggi per scene (ruang periksa, dalam pembuluh darah, dll).
- 2-3 layer parallax untuk kedalaman (foreground/midground/background bergerak beda kecepatan saat kamera pan pelan).
- Karakter (Dr. [Nama], siluet Inang) dianimasikan terbatas — cukup gerakan kepala/mulut sinkron dialog + idle breathing motion, tidak perlu full-body animation kompleks.
- RIA murni particle/shader effect (lebih murah dari karakter bergambar, dan sesuai konsepnya yang abstrak).

### 7.2 Shot list cutscene pembuka (referensi untuk storyboard)
1. **Wide shot** ruang periksa, dokter & keluarga — nada tenang, warna hangat.
2. **Close-up** tangan Inang dengan luka kecil — detail yang jadi jembatan ke dunia mikroskopis.
3. **Transisi match-cut**: zoom masuk ke luka → warna & skala berubah drastis → reveal dunia mikroskopis (di sinilah identitas visual "masuk ke dalam tubuh" paling powerful ditampilkan, cocok jadi signature shot trailer/marketing).
4. **RIA sinyal menyala** pertama kali di HUD, bicara ke pemain.
5. **Establishing shot** area combat pertama (pembuluh darah/jaringan kulit) — di sinilah gameplay dimulai, seamless dari cutscene ke kontrol pemain (tanpa loading screen terpisah kalau memungkinkan, untuk menjaga immersion).

### 7.3 Titik penyampaian cerita di dalam struktur UI yang sudah ada
| Titik dalam game | Jenis konten | Estimasi durasi |
|---|---|---|
| First launch / awal Chapter 1 | Cutscene animasi penuh (shot list 7.2) | 45-60 detik |
| Transisi antar-chapter (menu Kampanye) | Cutscene ringan 2 panel (dokter + RIA), gaya visual novel | 15-20 detik |
| Sebelum boss tiap chapter | Bark singkat RIA saja (tanpa cutscene penuh, cukup HUD popup + VO/teks) | 3-5 detik |
| Setelah run selesai (menang) | 1 baris bark kontekstual dari RIA, bervariasi sesuai performa run | Instan, non-blocking |
| Epilog akhir game | Cutscene penuh dua-lapis (shot list khusus, lihat Bagian 6.4) | 60-90 detik |

Pendekatan ini memastikan beban produksi animasi terpusat di 2 momen besar (pembuka & epilog), sementara transisi antar-chapter tetap murah tapi tetap menyampaikan cerita secara konsisten.

---

## 8. Ringkasan untuk Tim Produksi

- **Yang butuh dibuat tim writer:** naskah dialog lengkap untuk 6 chapter (pola sudah dicontohkan Bagian 6), glossary istilah final (perluas dari Bagian 4).
- **Yang butuh dibuat tim art:** desain visual Dr. [Nama] (concept art wajah/kostum), desain signal/particle RIA, background tiap chapter (6 environment berbeda sesuai tema kondisi kesehatan).
- **Yang butuh dibuat tim animasi:** 2 cutscene penuh (pembuka & epilog) dengan pendekatan 2D layered, 5 transisi chapter versi ringan (2-panel visual novel style).
- **Yang butuh dibuat tim engineering:** sistem dialog/cutscene player (text box + portrait + VO trigger), hook ke menu Kampanye untuk memicu cutscene transisi otomatis saat chapter baru dibuka.
