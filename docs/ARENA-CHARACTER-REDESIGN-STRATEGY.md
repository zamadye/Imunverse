# PHAGOS — Strategi Redesign Arena & Character (v2)

**Status:** dokumen diskusi — arah BELUM dikunci, menunggu keputusan owner per
section "Pertanyaan Terbuka" di akhir dokumen.
**Owner request:** arena terasa seperti peta MMORPG (terlalu luas/terbuka),
bukan roguelike — perlu di-rebuild total. Arah character "human anime chibi"
DIBATALKAN karena keluar dari identitas game. Dokumen ini adalah **doc
eksekusi untuk didiskusikan**, bukan kode — tidak ada perubahan kode dalam
pass ini.
**Menggantikan:** `docs/CHARACTER-ART-BRIEF.md` (dihapus — brief lama
mendefinisikan gaya "mobile RPG gacha hero, chibi-heroic, wajah ekspresif,
baju/gear" yang sudah dibatalkan owner).
**Tetap berlaku:** `docs/CHARACTER-PROTOTYPE-EVAL.md` — evaluasi TEKNIS rig
(rigged 2D vector vs sprite vs deformasi) masih valid; yang berubah hanya
**identitas visual** (bentuk/wajah), bukan mesin animasinya. Lihat Section 6.

---

## 1. Ringkasan eksekutif

Dua masalah besar diangkat owner, dan keduanya **saling terkait**:

1. **Arena** — dunia sekarang adalah cawan petri bundar datar (radius 750,
   `js/core/game.js:321-325`) dengan tekstur tanah prosedural (blotch/fold/
   chunk/pool/villi/mist dari `data/arenas.json`). Tidak ada struktur
   vertikal, tidak ada bentuk organ yang sesungguhnya, tidak ada elemen
   anatomi (urat/otot/pembuluh darah) sebagai bagian dari jalur — hasilnya
   terasa seperti lapangan terbuka gaya MMORPG, bukan arena roguelike yang
   terarah.
2. **Character** — brief lama (`CHARACTER-ART-BRIEF.md`, sudah dihapus)
   mengarahkan ke "mobile RPG hero gacha, chibi-heroic, wajah ekspresif,
   baju/gear/senjata" — arah manusia-anime yang keluar dari identitas
   "sel imun" PHAGOS. Owner ingin bentuk **abstrak**, tanpa mata/mulut.

Dokumen ini merangkum riset kompetitor (sesi sebelumnya), audit kondisi kode
saat ini, lalu mengusulkan arah baru untuk **didiskusikan** — bukan
keputusan final.

---

## 2. Riset kompetitor — ringkasan (rujukan untuk keputusan di bawah)

### Pathogenic (Steam, tim 2 orang, 98% rating)
Tema paling dekat dengan PHAGOS (sel/imun), arah terbalik — pemain jadi
patogen menyerang, bukan sel imun bertahan.

- **Dunia**: "procedurally generated levels **resembling various internal
  organs** and biological structures" — pemain **naik ke atas** lewat tubuh
  (dari titik infeksi kulit → usus → jantung), setiap biome organ berbeda
  (paru-paru, jantung, otak). **Ini validasi langsung untuk arah arena
  organ-shaped + vertikal yang owner usulkan** — bukan konsep baru yang
  belum terbukti, sudah ada game serupa yang sukses secara kritis.
- **Character**: TIDAK ada wajah/ekspresi manusia — bentuk organel yang
  di-graft (flagela, mitokondria, sekretor, duri), soft-body physics,
  "detailed, colorful" tapi tetap bentuk biologis abstrak, bukan humanoid.
- **Filosofi scope** (tim 2 orang): "tidak ada yang murni dekoratif" — musik,
  visual, mekanik semua fungsi ganda. Bukan melebarkan fitur, tapi
  memperdalam yang sedikit.

### Cell Survivor (mobile, $300K/hari, 5 juta+ download)
Genre paling dekat (survivor-roguelite seluler), tapi kedalaman taktisnya
diakui dangkal oleh reviewer (semua strategi konvergen ke "DPS optimization").
Kekuatan utamanya di **kejelasan progres** (satu metrik: Combat Power) dan
**retensi harian** (sweep, idle chest, daily task) — bukan di desain arena
atau bentuk karakter.

**Kesimpulan gabungan**: PHAGOS sudah unggul di premis (bertahan, bukan
menyerang — sudut pandang yang belum dipakai kompetitor manapun), tapi kalah
di **eksekusi ruang** (arena datar tak berbentuk) dan **kejelasan identitas
visual** (brief lama malah menuju arah generik gacha-anime, bukan
memperkuat identitas biologis yang justru jadi pembeda PHAGOS).

---

## 3. Audit kondisi arena saat ini (dari kode, bukan dugaan)

| Hal | Kenyataan di kode | File |
|---|---|---|
| Bentuk dunia | Lingkaran datar, radius 750 unit, berpusat di titik spawn | `js/core/game.js:321-325` |
| Batas | "Cawan petri" — ada batas (bukan tanpa batas seperti versi lama), tapi bentuknya cuma lingkaran polos | `js/core/game.js:321` komentar |
| Tema per-arena | 7 organ SUDAH ada by name: Saluran Limfe, Lambung Asam, Paru Kristal, Sumbu Saraf, Bilik Jantung, Kapiler, Aliran Darah | `data/arenas.json` |
| Yang membedakan tiap organ SEKARANG | Cuma warna tanah + jenis tekstur prosedural (blotch/fold/chunk/pool/villi/mist/motes) — **bukan bentuk/siluet organ** | `data/arenas.json` per-arena `palette.ground.features` |
| Struktur vertikal | Tidak ada — kamera + gerak player bebas 360° di bidang datar | — |
| Elemen anatomi (urat/otot) di jalur | Tidak ada — yang ada cuma dekorasi ground (weed/reef/dots) yang tidak fungsional sebagai jalur/dinding | `data/arenas.json` `palette.props` |

**Kesimpulan**: temanya (7 organ) sudah benar dan sudah sesuai arah owner —
yang perlu di-rebuild adalah **bentuknya**, bukan mulai dari nol.

### Referensi visual yang SUDAH ada dan bisa dipakai ulang

Dashboard sudah punya peta kampanye **vertikal bawah-ke-atas** dengan node
tersambung gaya MLBB (`data/campaign.json` field `mapPos`, y mengecil =
makin ke atas = makin jauh progresnya; task #25-29 di riwayat kerja). Ini
persis bahasa visual "naik ke atas" yang owner maksud saat bilang "sama kaya
map nya tapi ini bentuk nya arena" — bedanya peta itu UI navigasi antar-stage
(2D flat icon), sedangkan arena adalah RUANG BERMAIN yang harus punya
kedalaman, batas, dan elemen anatomi fungsional.

---

## 4. Audit kondisi character saat ini (dari kode, bukan dugaan)

| Hal | Kenyataan di kode |
|---|---|
| Mode render | 3 mode: `foto` (sprite + deformasi, SEKARANG DEFAULT), `hibrida` (sprite inti + anggota prosedural), `makhluk` (vektor penuh prosedural) — `js/render/hero-mode.js` |
| Rig makhluk vektor | Sudah ADA untuk 7/11 hero (macrophage + 6 lainnya baru ditambahkan) — badan blob bermembran + limbah prosedural + nukleus, **TANPA wajah/mata/mulut sama sekali** — `data/creature-rigs.json`, `js/render/creature-rig.js` |
| Sprite foto (yang dipakai sekarang) | 49 PNG hasil brief lama — mengikuti gaya "chibi-heroic gacha" dengan mata/mulut/ekspresi/gear — **inilah yang dibatalkan owner** |

**Temuan penting**: sistem `makhluk` (rig vektor prosedural) yang **sudah
dibangun dan sudah berjalan** justru SUDAH abstrak — blob membran + nukleus +
anggota gerak, tanpa wajah. Investasi rig ini **tidak sia-sia** meski brief
sprite lama dibatalkan. Yang perlu didiskusikan bukan "mulai dari nol", tapi
"apakah rig vektor yang sudah ada ini arahnya sudah benar, atau perlu bentuk
abstrak yang berbeda lagi".

---

## 5. Arah baru — ARENA: "Organ Ascent" (usulan untuk didiskusikan)

**Konsep inti**: arena bukan lagi lingkaran datar bebas-arah, tapi **koridor
vertikal berbentuk siluet organ sungguhan** yang dipanjat/didaki dari bawah
ke atas — satu arena = satu perjalanan lewat satu organ, bentuknya mengikuti
anatomi organ itu sendiri (bilik jantung punya bentuk ruang jantung, paru-
paru punya percabangan bronkiolus, dst).

### 5a. Elemen struktural yang diusulkan

| Elemen | Fungsi | Analogi anatomi |
|---|---|---|
| **Siluet organ** | Batas keras kiri-kanan arena (dinding), bentuknya = kontur organ asli (melebar-menyempit, bukan lorong lurus) | Dinding organ |
| **Jalur utama (vertikal)** | Rute utama naik ke atas — lebar jalur bisa berubah (menyempit = tekanan/kepadatan musuh naik, melebar = ruang napas/loot) | Rongga/kanal organ |
| **Urat/pembuluh darah di sisi jalur** | Elemen visual BERGERAK (aliran searah, sudah ada preseden gerak di `data/arenas.json` arena "Aliran Darah") + berpotensi jadi elemen gameplay (arus mendorong, jalur alternatif cepat) | Pembuluh darah, urat |
| **Serat otot** | Elemen dinding dengan tekstur berdenyut (visual "hidup") — bisa jadi obstacle statis atau dekorasi kuat | Otot organ |
| **Cabang/ruang samping** | Kantung opsional di sisi jalur utama — loot/mini-event, tidak wajib dilewati | Struktur organ nyata (alveolus, chamber, dsb) |

### 5b. Kenapa ini menjawab keluhan "berasa MMORPG"

Masalah lingkaran bebas 750 radius adalah **tidak ada arah, tidak ada
tekanan ruang** — pemain bisa lari ke mana saja tanpa konsekuensi, yang
memang terasa seperti field MMORPG open-world. Koridor vertikal dengan
lebar berubah-ubah memaksa **keputusan taktis berbasis ruang** (roguelike
klasik: Vampire Survivors/Brotato pun pakai arena TERBATAS, bukan open
field) — dan format vertikal-naik sudah punya preseden sukses di Pathogenic
persis dengan tema yang sama (organ internal).

### 5c. Yang perlu didiskusikan sebelum eksekusi

1. **Satu jalur lurus vs bercabang?** Jalur tunggal lebih mudah dikontrol
   secara gameplay (spawn musuh, pacing boss), bercabang lebih eksploratif
   tapi lebih rumit di collision & kamera.
2. **Kamera**: sekarang kamera bebas mengikuti player 360° di bidang datar.
   Arena vertikal butuh kamera yang condong "melihat ke atas" atau tetap
   top-down tapi viewport memanjang vertikal — ini keputusan besar yang
   pengaruh ke SELURUH rendering pipeline (perspective.js, proyeksi hero).
3. **7 organ yang sudah ada** (limfe/lambung/paru/saraf/jantung/kapiler/
   aliran_darah) — apakah semua di-rebuild jadi bentuk organ vertikal, atau
   mulai dari 1 organ dulu sebagai pilot sebelum yang lain?
4. **Berapa "tinggi" satu arena** — apakah satu run = satu tanjakan penuh
   sampai puncak organ (arena = level, selesai saat sampai atas), atau tetap
   arena bertahan-gelombang seperti sekarang tapi bentuknya vertikal
   (gelombang datang dari bawah terus)?
5. **Urat/otot: dekorasi atau gameplay?** Perlu diputuskan apakah elemen
   anatomi ini murni visual (paling cepat dieksekusi) atau juga fungsional
   (aliran darah mendorong player, otot jadi rintangan) — ini akan
   menentukan berapa banyak kode gameplay baru yang dibutuhkan nanti.

---

## 6. Arah baru — CHARACTER: "Abstract Bio-Forms" (usulan untuk didiskusikan)

**Konsep inti**: bentuk sel/organisme abstrak — TANPA mata, TANPA mulut,
TANPA fitur wajah apapun. Identitas dibaca dari **siluet, warna, tekstur
permukaan, dan cara bergerak** — bukan dari ekspresi wajah.

### 6a. Kenapa arah ini justru MEMPERKUAT, bukan mengurangi

- Rig vektor (`creature-rig.js`) yang **sudah dibangun dan diverifikasi
  jalan** (27 cek animasi, 24 cek prototype, 19 cek crawl-rig — semua lolos)
  sudah memang tanpa wajah: badan membran bergelombang + nukleus + anggota
  gerak. Arah abstrak ini **selaras dengan mesin yang sudah ada**, bukan
  mulai ulang.
- Pathogenic (kompetitor tema terdekat, 98% rating) juga TIDAK memakai
  wajah manusia sama sekali — identitas dibangun dari bentuk organel +
  fisika soft-body. Preseden industri yang terbukti untuk genre yang sama.
- Brief lama yang dibatalkan justru butuh SANGAT banyak detail manual per
  hero (wajah ekspresif, gear, senjata, 7 gambar × 11 hero = 77 file) — arah
  abstrak lebih murah diproduksi DAN lebih konsisten dengan filosofi "tim
  kecil, scope dalam bukan lebar" yang terbukti berhasil di Pathogenic.

### 6b. Yang perlu didiskusikan sebelum eksekusi

Owner menyebut masih bingung bentuknya — ini pertanyaan desain yang genuinely
perlu keputusan owner, bukan sesuatu yang bisa saya asumsikan sendiri.
Beberapa sumbu keputusan untuk memandu diskusi:

1. **Tingkat abstraksi**: 
   - (a) **Biologis-akurat** — bentuk menyerupai sel imun sungguhan di buku
     biologi (macrophage = ameboid dengan pseudopodia, neutrophil = lobus
     multi-inti, dst — sudah sebagian jadi dasar `creature-rig.js` sekarang)
   - (b) **Geometris murni** — bentuk dasar (blob, poligon, kristal) dengan
     warna/pola sebagai pembeda hero, tidak mencoba meniru biologi secara
     harfiah
   - (c) **Hybrid** — siluet dasar biologis tapi disederhanakan jadi bentuk
     ikonik/mudah dibaca dari kejauhan (mirip cara Team Fortress 2 mendesain
     siluet class: langsung dikenali dari bentuk saja)
2. **Sumber pembeda antar-hero**: karena tanpa wajah, apa yang bikin 11 hero
   terlihat beda sekilas? Kandidat: jumlah/bentuk anggota gerak (sudah ada
   datanya per hero di `crawl-cycles.json` — basophil 6 lobus, dendritic 4,
   tcd8 3, dst), warna dasar (sudah ada `heroDef.color`), tekstur permukaan
   (duri/halus/berlendir), pola gerak (agresif-cepat vs berat-lambat, sudah
   diimplementasi minggu ini di animasi baru).
3. **Skala produksi**: apakah karakter tetap digambar PROSEDURAL (vektor,
   seperti `makhluk` mode sekarang — murah, konsisten, tapi terikat gaya
   "digambar kode") atau kembali ke ASET GAMBAR tapi dengan brief baru yang
   ketat "abstrak, tanpa wajah" (lebih mahal produksi, tapi bisa lebih kaya
   detail visual)?
4. **Evolusi/mutasi visual**: sistem mutasi sekarang (18 mutasi di
   `data/mutations.json`) menambah duri/warna/bentuk secara prosedural di
   atas rig dasar (`creature-rig.js` bagian "MUTASI A → B"). Kalau arah
   abstrak dipilih, ini justru lebih mudah dieksekusi karena tidak perlu
   khawatir mutasi merusak wajah/ekspresi yang sudah digambar manual.

---

## 7. Strategi dev yang diusulkan

Karena branch ini akan jadi **branch dev** (semua branch lain merge ke sini
dulu sebelum ke main), urutan kerja yang disarankan:

1. **Kunci arah dulu, baru eksekusi** — dua keputusan besar (arena
   vertikal-organ, character abstrak) harus jelas polanya dulu (jawab
   pertanyaan di Section 5c & 6b) sebelum branch turunan mulai membangun,
   supaya tidak ada kerja yang harus diulang karena arah berubah di tengah.
2. **Pilot satu organ dulu** — daripada rebuild 7 arena sekaligus, buktikan
   pola "organ vertikal" di SATU organ (usul: Bilik Jantung — bentuknya
   paling ikonik & mudah dikenali orang awam) sebelum diterapkan ke 6
   lainnya.
3. **Pilot satu character dulu** — sama seperti sebelumnya (Mako/macrophage
   dipakai sebagai spesimen di `CHARACTER-PROTOTYPE-EVAL.md`), pertahankan
   pola ini: satu hero jadi pembuktian arah abstrak sebelum diterapkan ke
   10 lainnya.
4. **Arena dan character adalah 2 keputusan independen** — tidak saling
   blocking. Bisa didiskusikan & dieksekusi paralel oleh branch berbeda,
   asal masing-masing sudah lolos "pilot" di atas dulu.

---

## 8. Pertanyaan terbuka — perlu jawaban owner sebelum lanjut

**Arena:**
- Jalur tunggal atau bercabang?
- Kamera: tetap top-down atau berubah mengikuti orientasi vertikal?
- Mulai dari organ mana sebagai pilot?
- Urat/otot: murni dekorasi visual, atau juga elemen gameplay fungsional?
- Satu run = satu tanjakan sampai puncak, atau tetap format gelombang
  bertahan seperti sekarang?

**Character:**
- Tingkat abstraksi: biologis-akurat / geometris murni / hybrid?
- Tetap prosedural-vektor (seperti rig sekarang) atau kembali ke aset
  gambar dengan brief baru?
- Kalau kembali ke aset gambar: siapa yang generate (owner via AI eksternal
  seperti brief lama, atau arah lain)?

Jawaban di atas akan jadi dasar brief eksekusi berikutnya (arena) dan brief
seni baru pengganti `CHARACTER-ART-BRIEF.md` (character) — keduanya baru
ditulis setelah arah di atas dikonfirmasi, supaya tidak terjadi lagi kasus
brief yang harus dibatalkan di tengah jalan.

---

## 9. Catatan file

- **Dihapus**: `docs/CHARACTER-ART-BRIEF.md` (brief "human anime chibi
  gacha" — dibatalkan owner).
- **Tetap ada, masih relevan**: `docs/CHARACTER-PROTOTYPE-EVAL.md` (evaluasi
  teknis mesin rig — arsitekturnya tidak dibatalkan, hanya arah visualnya).
- **Tidak ada perubahan kode** dalam pass ini — sesuai instruksi, dokumen
  ini murni untuk diskusi arah sebelum eksekusi dimulai lagi.
