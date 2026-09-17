# PHAGOS — HERO LIVING CHARACTER PROTOTYPE
## Evaluasi pendekatan & master prototype (MAKO)

Status: **TAHAP EVALUASI — arsitektur BELUM dikunci.**
Karakter contoh: **Macrophage (Mako)**. Bentuk dasar: **sel beranggota gerak**
(badan ameba + pseudopodia yang benar-benar menapak & melangkah).

---

## 0. Keadaan sekarang (audit dari kode, bukan dugaan)

| Hal | Keadaan | Dampak |
|---|---|---|
| Aset hero | **1 foto datar 128 px per keadaan** (`hero_<id>_idle/attack` + 4 foto mutasi 256 px) | Tidak punya anggota gerak, tidak punya sisi depan/belakang |
| Cara gambar di arena | `drawSprite()` — satu `drawImage` per frame | Yang bisa diubah hanya transformasi (geser, putar, skala, miring) |
| Gerak (P7 tahap 2) | Rig merayap Godot: squash berporos bawah + skew jangkauan + gelombang lobus | **Mengambang hilang**, tapi arah hanya terbaca dari kemiringan — bukan dari bentuk |
| Rig Rive | `js/render/rive-rig.js`, dipakai bila `.riv` tersedia (kalau tidak, rumus analitik) | Kanalnya tetap bob/tilt/squash → sumber yang sama dengan rig merayap |
| Vektor hero | `drawHeroEquity()` di `character-visuals.js` — **sudah ada**, tapi hanya untuk kartu/UI | Belum dipakai di arena; belum punya kerangka/animasi |
| Penghasil aset | `tools/gen_assets.py`, `build-mutation-sprites.py` (penjepit frame) | Foto mutasi dijepit pada **garis bawah** — fondasi anti-lompat yang sudah benar |

Kesimpulan: yang hilang bukan "frame", melainkan **anatomi yang bisa digerakkan**.
Foto datar tidak punya sendi, jadi berapa pun frame yang dibuat, arahnya tetap
harus ditebak dari transformasi.

---

## 1–5. Lima pendekatan yang dievaluasi

### ① Sprite / frame-based animation
Foto baru per arah per frame: depan, belakang, samping kiri/kanan × N frame jalan.

| Kriteria | Nilai | Catatan |
|---|---|---|
| Kualitas visual | ★★★★★ | Paling "hidup" kalau seninya bagus |
| Kualitas animasi | ★★★★☆ | Mulus bila frame cukup (8–12/siklus) |
| Responsif gameplay | ★★★☆☆ | Ganti state = ganti set foto; transisi perlu *blend* atau terasa kaku |
| Gerak 360°/multi-arah | ★☆☆☆☆ | Diskrit: 4 atau 8 arah. Arah di antaranya harus *popping* atau dibuat 16 arah |
| Kebutuhan aset | ✖ sangat berat | 4 tampang × ~8 frame × 5 state × 11 hero ≈ **1.700+ foto** (belum 13 patogen & boss) |
| Biaya data | ✖ puluhan–ratusan MB | Atau wajib atlas + *streaming* |
| Kompleksitas | ★★★★☆ | Atlas, manifest, state machine, *blend tree* |
| Skalabilitas 11 hero | ✖ | Pekerjaan seni berulang 11× |
| Skalabilitas mutasi/evolusi | ✖ | Tiap tahap evolusi butuh seluruh set lagi (×4) |
| Skalabilitas skin pack | ★☆☆☆☆ | Skin = satu set penuh lagi |
| Kompatibilitas gameplay | ★★★★★ | Paling mudah: tetap `drawImage` |
| Biaya/waktu produksi | ✖ paling mahal | Minggu per karakter; **dan saya tidak bisa menilai hasil foto secara visual** |

**Putusan:** kualitas terbaik, biaya tidak masuk akal untuk 11 hero + 13 patogen +
boss, dan tidak bisa saya jamin mutunya karena saya tidak bisa melihat gambar.

---

### ② Rigged 2D character — badan digambar prosedural, dianimasikan GODOT *(REKOMENDASI)*
Satu spesimen anatomi per karakter di `data/` (inti sel, nukleus, membran,
6 pseudopodia). Godot membangun rig `Node2D` bertingkat, menganimasikannya,
lalu **dipanggang** menjadi trek per frame → JSON. Canvas menggambar bentuknya
mengikuti trek itu.

| Kriteria | Nilai | Catatan |
|---|---|---|
| Kualitas visual | ★★★☆☆ | Bergaya vektor; harus dibuat menarik, tapi konsisten & art-directed lewat data |
| Kualitas animasi | ★★★★★ | Tiap anggota punya fase sendiri; bisa *foot planting*, *overshoot*, *follow-through* |
| Responsif gameplay | ★★★★★ | State = campuran trek; transisi otomatis mulus (blend per kanal) |
| Gerak 360°/multi-arah | ★★★★★ | Badan digambar dari sudut pandang: depan/samping/belakang **diblend terus-menerus**, bukan dipilih |
| Kebutuhan aset | ✔ nol foto baru | Foto lama tetap dipakai di kartu/UI/level-up |
| Biaya data | ✔ kecil | ~40–120 KB JSON per karakter |
| Kompleksitas | ★★★☆☆ | Sedang: satu perancang rig + satu perender |
| Skalabilitas 11 hero | ★★★★★ | Ganti anatomi di `data/` + panggang ulang; kode tidak berubah |
| Skalabilitas mutasi/evolusi | ★★★★★ | Mutasi = menambah/mengubah anggota (jumlah, panjang, warna) — **bukan** set aset baru |
| Skalabilitas skin pack | ★★★★★ | Skin = sekumpulan warna/aksen di data |
| Kompatibilitas gameplay | ★★★★☆ | Perlu satu titik panggil di `game.js`; mekanik tidak berubah |
| Biaya/waktu produksi | ✔ paling murah | Satu fondasi → 11 hero tinggal mengisi anatomi |

---

### ③ Procedural deformation (yang dipakai sekarang)
Squash-stretch, skew, gelombang lobus pada **satu foto**.

| Kriteria | Nilai | Catatan |
|---|---|---|
| Kualitas visual | ★★☆☆☆ | Foto tidak ikut berubah bentuk — hanya diputar/ditekuk |
| Kualitas animasi | ★★☆☆☆ | Tidak ada anggota; "langkah" hanya gelombang |
| Responsif gameplay | ★★★★★ | Sangat ringan |
| Gerak 360°/multi-arah | ★★☆☆☆ | Arah terbaca dari kemiringan saja — **inilah keluhan bos sekarang** |
| Kebutuhan aset | ✔ nol | — |
| Biaya data | ✔ sangat kecil | — |
| Kompleksitas | ★★★★★ | Paling sederhana |
| Skalabilitas | ★★☆☆☆ | Mentok di "foto yang ditekuk" |
| Kompatibilitas gameplay | ★★★★★ | Sudah terpasang (P7 tahap 2) |
| Biaya produksi | ✔ sudah selesai | — |

**Putusan:** tetap dipertahankan sebagai **baseline** (dan sebagai cadangan bila
perangkat lemah), bukan tujuan akhir.

---

### ④ Hybrid — foto jadi inti badan + anggota gerak prosedural
Foto 128 px yang sudah ada tetap jadi "kulit" badan; pseudopodia/kaki digambar
prosedural dari rig yang sama.

| Kriteria | Nilai | Catatan |
|---|---|---|
| Kualitas visual | ★★★★☆ | Wajah karakter tetap foto asli (identitas terjaga) |
| Kualitas animasi | ★★★☆☆ | Anggota hidup, badan tidak ikut berubah bentuk |
| Responsif gameplay | ★★★★☆ | — |
| Gerak 360°/multi-arah | ★★★☆☆ | Anggota menunjukkan arah, badan tetap datar |
| Kebutuhan aset | ✔ nol foto baru | — |
| Biaya data | ✔ kecil | — |
| Kompleksitas | ★★★★☆ | — |
| Skalabilitas 11 hero | ★★★★☆ | Foto lama langsung terpakai |
| Skalabilitas mutasi/evolusi | ★★★★☆ | Foto mutasi tinggal diswap, anggota ikut data |
| Skalabilitas skin | ★★★☆☆ | Skin = ganti foto |
| Kompatibilitas gameplay | ★★★★★ | — |
| Biaya produksi | ✔ murah | — |

---

### ⑤ Cut-out rigging — foto DIPOTONG jadi bagian, lalu dirig (ekstra)
Foto yang ada dibelah menjadi badan/anggota (masking), lalu tiap potongan
diberi sendi dan dianimasikan Godot — art tetap asli, tapi jadi bisa diajak
bergerak.

| Kriteria | Nilai | Catatan |
|---|---|---|
| Kualitas visual | ★★★★☆ | Art asli terjaga |
| Kualitas animasi | ★★★☆☆ | Terbatas pada bagian yang bisa dipotong |
| Gerak 360° | ★★☆☆☆ | Potongan foto punya satu sisi pandang; depan/belakang tidak ada |
| Kebutuhan aset | ✔ nol, tapi butuh proses potong per foto | 44 foto mutasi harus dipotong satu-satu |
| Kompleksitas | ★★☆☆☆ | Masking + rig per potongan |
| Skalabilitas | ★★☆☆☆ | — |
| Biaya | ★★★☆☆ | Proses potong berulang tiap foto baru |

**Putusan:** bagus sebagai jalan tengah, tetapi tetap tidak menyelesaikan arah
depan/belakang karena fotonya cuma punya satu sisi pandang.

---

## Matriks keputusan

| | ① Frame | ② Rigged vektor | ③ Deformasi | ④ Hybrid | ⑤ Cut-out |
|---|---|---|---|---|---|
| Visual | 5 | 3 | 2 | 4 | 4 |
| Animasi | 4 | 5 | 2 | 3 | 3 |
| Responsif | 3 | 5 | 5 | 4 | 4 |
| 360° / multi-arah | 1 | 5 | 2 | 3 | 2 |
| Kebutuhan aset | 1 | 5 | 5 | 5 | 3 |
| Biaya data | 1 | 4 | 5 | 5 | 4 |
| Kompleksitas (5=mudah) | 2 | 3 | 5 | 4 | 2 |
| Skala 11 hero | 1 | 5 | 2 | 4 | 2 |
| Skala mutasi | 1 | 5 | 2 | 4 | 2 |
| Skala skin | 1 | 5 | 2 | 3 | 2 |
| Kompatibel gameplay | 5 | 4 | 5 | 5 | 4 |
| Biaya produksi (5=murah) | 1 | 5 | 5 | 4 | 3 |
| **JUMLAH** | **26** | **54** | **39** | **48** | **35** |

**Rekomendasi: ② Rigged 2D vektor (dipanggang Godot)**, dengan ④ Hybrid
seperti jembatan (foto lama tetap terlihat) dan ③ sebagai cadangan perangkat
lemah. ① hanya masuk akal bila bos menerima biaya seni yang besar **dan**
menjadi penilai mutu visualnya sendiri.

---

## Yang GAGAL pada percobaan pertama — dan pelajarannya

Laporan awal saya mengatakan “selesai”, padahal yang terlihat di layar **tidak
berubah sama sekali**. Tiga kesalahan nyata (sudah diperbaiki):

| Kesalahan | Kenyataan | Perbaikan |
|---|---|---|
| Mode bawaan masih `foto` | Prototipe benar-benar jalan, tetapi yang tampil tetap cara lama → pemain melihat nol perubahan | **Mode bawaan sekarang `makhluk`**; `foto` hanya lewat `?heroMode=foto` atau tombol ganti |
| Satu-satunya pintu masuk = tombol **P**/**M** | Di layar sentuh (preview HP) tombol keyboard tidak ada | Dua tombol di **layar Jeda**: *Lab Prototipe Hero* & *Mode hero: …* |
| Penguji hanya membuktikan “fungsi dipanggil” | `drawCreature()` diuji langsung → hijau, padahal `game.render()` bisa saja tidak memakainya | Penguji baru memakai **`game.render()` sungguhan** dan **membandingkan jumlah geometri** antar mode: path 284 (foto) vs 367 (makhluk), dan `drawImage` foto hero hilang |

Pelajaran yang dikunci sebagai aturan pengujian: **buktikan apa yang tampil di
layar, bukan apa yang dipanggil di kode.** Karena itu `tools/verify-prototype.mjs`
sekarang berisi uji diferensial render dan uji posisi/ukuran makhluk
(menapak di garis alas yang sama dengan foto lama, 0,42 × S ± 0,06 × S).

## Prototype yang bisa dibandingkan

Tiga mode berjalan BERDAMPINGAN di **Lab Prototype** (buka dengan tombol **P**
di dalam game, atau `?lab=mako`):

| Mode | Isi |
|---|---|
| `makhluk` | ② makhluk vektor penuh — rig Godot, depan/samping/belakang diblend. **INI MODE BAWAAN** |
| `hibrida` | ④ foto sebagai inti badan + anggota gerak prosedural |
| `foto` | ③ deformasi prosedural pada foto (cara lama — pembanding) |

Cara mengganti (tanpa keyboard juga bisa):
- **Layar Jeda** → tombol *Mode hero: …* (berganti tiap ketuk) dan
  *Lab Prototipe Hero* (membuka 3 kanvas berdampingan).
- **Tombol M** mengganti mode saat bermain, **tombol P** membuka lab.
- `?heroMode=foto|hibrida|makhluk` membuka game langsung dengan mode itu.

Mekanik permainan tidak berubah sedikit pun — yang berganti hanya fungsi
gambar (terbukti: posisi & HP identik untuk ketiga mode).

State yang wajib terlihat — semuanya tersedia di lab:
idle/napas · jalan (akselerasi + deselerasi) · belok · serang · skill (Pulse) ·
reaksi kena hit · mati · gerak berarah (8 arah + putar otomatis) · gerak
sekunder membran · **mutasi A → B**.
