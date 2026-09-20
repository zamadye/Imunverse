# PHAGOS — Kickoff Prompt: Arena "Organ Ascent" + Character "Abstract Bio-Forms"

**Cara pakai:** copy-paste seluruh isi blok di bawah "## PROMPT" sebagai pesan
pertama ke sesi Claude Code baru (branch baru, bukan branch dev ini). Prompt
ini self-contained — agent yang menerimanya tidak perlu baca history chat
manapun, semua konteks yang dibutuhkan sudah ada di dalamnya atau dirujuk ke
file repo yang bisa dia baca sendiri.

**Alur branch:** agent kerja di branch baru bercabang dari branch dev ini
(`claude/game-layout-ui-ux-audit-5wqr4q`), lalu buka PR **kembali ke branch
dev ini** — BUKAN ke `main`. Branch dev ini yang nanti mem-forward ke main
setelah direview.

---

## PROMPT

Kamu adalah Claude Code agent yang mengerjakan redesign arena dan karakter
untuk **PHAGOS** — game roguelike survival bertema sel imun (vanilla JS ES6
modules, Canvas 2D, tanpa build step, repo `zamadye/Imunverse`).

### 0. Wajib dibaca dulu sebelum mulai apapun

Baca file ini di repo, urutan ini:
1. `docs/ARENA-CHARACTER-REDESIGN-STRATEGY.md` — doc strategi lengkap
   (analisis kompetitor, audit kode saat ini, arah baru yang diusulkan,
   daftar pertanyaan terbuka). **Ini rujukan utama tugasmu.**
2. `docs/CHARACTER-PROTOTYPE-EVAL.md` — evaluasi teknis mesin rig karakter
   yang sudah ada (masih valid, jangan dibongkar arsitekturnya).
3. `js/render/creature-rig.js`, `data/creature-rigs.json` — mesin render
   vektor prosedural yang sudah jalan untuk 7/11 hero.
4. `js/core/game.js` sekitar baris 300-350 — cara arena/membran/world bounds
   diinisialisasi sekarang.
5. `data/arenas.json` — 7 tema organ yang sudah didefinisikan (limfe,
   lambung, paru, saraf, jantung, kapiler, aliran_darah).

### 1. Mandat kamu

Owner (pemilik produk) sudah memutuskan dua arah besar lewat diskusi
sebelumnya — **ini bukan pertanyaan terbuka lagi, ini keputusan final**:

- **Arena**: dari lingkaran datar bebas-arah (radius 750, terasa seperti
  field MMORPG) → jadi **koridor vertikal berbentuk siluet organ asli**,
  didaki dari bawah ke atas, dengan urat/pembuluh darah dan serat otot
  sebagai elemen structural di sepanjang jalur (bukan cuma dekorasi ground
  texture seperti sekarang).
- **Character**: dari rencana lama "human anime chibi gacha hero" (SUDAH
  DIBATALKAN, brief lamanya sudah dihapus) → jadi **bentuk abstrak sel/
  organisme TANPA mata, TANPA mulut, TANPA fitur wajah apapun**. Identitas
  antar-hero dibaca dari siluet/warna/tekstur/gaya gerak, bukan ekspresi.

**Untuk pertanyaan-pertanyaan teknis yang masih terbuka di Section 5c & 6b
dokumen strategi** (jalur tunggal vs bercabang, kamera top-down vs
miring, tingkat abstraksi biologis-akurat/geometris/hybrid, prosedural vs
aset gambar, dst) — **kamu punya wewenang memutuskan sendiri**. Jangan
berhenti untuk bertanya balik ke owner. Pilih opsi yang paling rendah
risiko dan paling cepat divalidasi (lihat rekomendasi default di bawah),
JALANKAN, lalu **laporkan keputusanmu dan alasannya secara eksplisit** di
akhir kerja (PR description) supaya owner bisa koreksi kalau perlu — jangan
diam-diam memutuskan tanpa jejak alasan.

**Rekomendasi default kalau kamu butuh titik awal** (boleh kamu override
kalau riset kodemu sendiri kasih alasan lebih baik):
- Arena: jalur **tunggal** dulu (bukan bercabang) — lebih gampang dikontrol
  spawn/pacing/collision, dan bisa dibuktikan konsepnya lebih cepat.
- Kamera: **tetap top-down**, tapi viewport/dunia memanjang secara vertikal
  (bukan mengubah sudut pandang 3D) — perubahan minimal ke pipeline
  proyeksi yang sudah ada.
- Character: tingkat abstraksi **hybrid** (siluet dasar biologis yang
  disederhanakan jadi bentuk ikonik, bukan biologis-akurat detail maupun
  geometris murni tanpa makna) — dan **tetap prosedural-vektor** (extend
  `creature-rig.js`, bukan aset gambar baru) karena mesinnya sudah ada,
  sudah diverifikasi jalan (27+24+19 cek lolos), dan tidak butuh brief seni
  eksternal lagi yang riskan seperti kasus brief lama yang dibatalkan.

### 2. Scope kerja — PILOT dulu, bukan rebuild total

**JANGAN rebuild ke-7 arena atau ke-11 hero sekaligus.** Ikuti pola yang
sudah terbukti di project ini (lihat cara `CHARACTER-PROTOTYPE-EVAL.md`
memakai Mako/macrophage sebagai spesimen tunggal sebelum scale).

**Arena — pilot 1 organ:**
- Pilih **Bilik Jantung** (`data/arenas.json` id `"jantung"`) sebagai pilot
  — bentuknya paling ikonik/mudah dikenali secara visual, cocok jadi bukti
  konsep sebelum diterapkan ke 6 organ lain.
- Build ulang bentuk arena ini jadi koridor vertikal sesuai Section 5a
  dokumen strategi (siluet organ = dinding, jalur naik, urat/otot di
  sisi jalur).
- 6 organ lainnya **tetap pakai sistem lama** (jangan disentuh) sampai
  pilot ini divalidasi.

**Character — pilot 1 hero:**
- Pilih **macrophage (Mako)** — sudah jadi spesimen standar di project ini,
  sudah punya creature-rig lengkap 8 state di `data/creature-rigs.json`.
- Ubah/extend anatominya di `creature-rigs.json` + `creature-rig.js` supaya
  bentuknya jadi abstrak sesuai arah baru (masih tanpa wajah — cek dulu,
  kemungkinan besar rig yang sekarang SUDAH cukup abstrak, jadi tugasmu
  mungkin lebih ke arah "pertajam identitas visual" daripada "bongkar
  total" — riset dulu sebelum asumsi perlu rombak besar).
- 10 hero lainnya **tetap seperti sekarang** sampai pilot ini divalidasi.

### 3. Batasan teknis wajib

- **Mekanik gameplay tidak boleh berubah** — posisi, HP, damage, kecepatan,
  collision harus identik secara fungsional sebelum/sesudah. Yang berubah
  HANYA bentuk visual arena dan karakter. Ini prinsip yang sudah dipegang
  konsisten di seluruh codebase (lihat cara `hero-mode.js` menjamin "posisi
  & HP identik untuk tiap mode" — pertahankan prinsip yang sama).
- **Jangan hapus/rombak sistem yang dipakai 6 organ lain / 10 hero lain**
  — mereka harus tetap berjalan normal dengan kode lama selama pilot ini
  berjalan paralel.
- **Jalankan seluruh suite verifikasi yang relevan sebelum push**, minimal:
  ```
  npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
  node tools/verify-animasi.mjs
  node tools/verify-crawl.mjs
  node tools/verify-prototype.mjs
  node tools/verify-world.mjs
  ```
  Semua harus `ERROR (0)`. Kalau ada test yang mengasumsikan bentuk arena/
  karakter LAMA secara hard-coded, update testnya supaya menguji perilaku
  BARU yang benar (jangan hapus coverage, ganti asersinya — ikuti pola yang
  sudah dipakai session sebelumnya waktu mengubah default `heroMode`).
- **Uji visual sungguhan** — pakai Playwright (`/opt/pw-browsers/chromium-*`)
  untuk screenshot gameplay pilot organ + pilot character, zoom-crop ke area
  karakter/arena untuk verifikasi pixel-level (jangan cuma percaya bundle
  build sukses = tampilan benar — ini pelajaran mahal dari session
  sebelumnya: default mode sempat salah dan tidak ketahuan sampai
  screenshot di-crop manual).

### 4. Alur git

- Branch baru dari branch dev ini: 
  ```
  git fetch origin claude/game-layout-ui-ux-audit-5wqr4q
  git checkout -b <nama-branch-baru> origin/claude/game-layout-ui-ux-audit-5wqr4q
  ```
- Commit dengan pesan jelas per unit kerja (arena pilot terpisah dari
  character pilot kalau memungkinkan, supaya gampang direview terpisah).
- **Buka PR ke branch `claude/game-layout-ui-ux-audit-5wqr4q`, BUKAN ke
  `main`.** Branch itu adalah dev/gate branch untuk project ini — semua
  perubahan mampir situ dulu sebelum owner forward ke main.
- Di deskripsi PR, wajib cantumkan:
  1. Ringkasan keputusan yang kamu ambil untuk tiap pertanyaan terbuka
     (Section 1 di atas) + alasannya.
  2. Screenshot before/after (arena pilot, character pilot) dari Playwright.
  3. Hasil semua verify script yang dijalankan.
  4. Rekomendasi eksplisit: apakah pola ini siap di-scale ke 6 organ/10
     hero lainnya, atau ada yang perlu direvisi dulu.

### 5. Yang TIDAK perlu kamu kerjakan sekarang

- Jangan scale ke semua organ/hero — itu keputusan owner setelah lihat
  hasil pilot.
- Jangan ubah sistem ekonomi, mutasi, evolusi, atau progres meta — di luar
  scope redesign visual ini.
- Jangan sentuh dashboard/map navigasi (`js/ui/dashboard-screen.js`) — itu
  UI navigasi antar-stage, bukan arena gameplay, sudah benar seperti
  sekarang.

Mulai dengan membaca kelima file di Section 0, lalu tulis rencana singkat
kerjamu (organ pilot + character pilot, keputusan atas tiap poin terbuka)
sebelum mulai coding — supaya kalau ada asumsi yang meleset, ketahuan di
awal, bukan setelah banyak kode ditulis.
