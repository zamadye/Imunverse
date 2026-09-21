# PHAGOS — Analisis Video Referensi (`Character_and_arena_reference.mp4`)

**Tanggal analisis:** 2026-09-21
**Branch:** `arena/01a0c285-imunverse`
**Sumber:** blob `17b7f553` (13.429.334 byte) dari commit `33ab2600` "character and arena concept reference"
**Frame kunci:** `docs/video-reference/` (6 frame + 2 zoom)
**Keputusan owner:** *"video yang memutuskan"* — dokumen ini membandingkan isi video
dengan hasil pilot PR #44 dan merekomendasikan apa yang dipertahankan / dibuang.

> ### ⚠️ Catatan forensik (penting untuk owner)
> Video aslinya **sempat hilang**. Commit `33ab2600` menambahkan file 13,4 MB yang benar,
> tetapi commit berikutnya `6db9a72` ("Rename Screen_Recording… → Character_and_arena_reference.mp4")
> mengerjakannya sebagai operasi **teks**, bukan `git mv` — hasilnya blob 2 byte (`d3f5a12f`, isi `\r\n`).
> File 13,4 MB sudah **dipulihkan** di commit ini dengan memakai ulang blob `17b7f553` dari history
> (tidak menambah objek besar baru). Ke depan: rename file biner wajib lewat `git mv`, jangan via web/teks.

---

## 0. Fakta teknis video

| Properti | Nilai |
|---|---|
| Durasi | 26,84 detik |
| Resolusi | 1624×720 (landscape lebar, rasio ~2,26:1) |
| Frame rate | 23,96 fps |
| Codec | H.264 High + AAC mono 48 kHz |
| Perangkat | Android 14 (`com.android.version`), dibuat 2026-09-21 05:40:30 UTC |
| Cut keras | hanya 3 — t=15,94 s · 18,54 s · 25,28 s; sisanya satu take kontinu |
| Isi | Footage gameplay sebuah game 2D aksi ruang-organ yang sudah sangat polished. Ada legend kontrol desktop (`W A S D` Move · mouse Shoot · `Move+mouse` Strafe · `SPACE` Dodge · `TAB` Editor) → game PC, direkam ulang di layar lebar |

Ini **bukan** footage PHAGOS. Ini referensi arah (reference moodboard bergerak).

---

## 1. ARENA — ruang bermain

**Bentuk: bukan lapangan datar, bukan satu ruangan tertutup.** Dunia adalah
**sistem gua/pembuluh organik yang tersambung**: beberapa chamber membulat yang
dihubungkan koridor sempit, dengan **vertikalitas kuat** (chamber di ketinggian
berbeda; kamera mengikuti naik-turun). Lihat `t12s.jpg` (koridor berkelok) dan
`t16s.jpg` (dua chamber bertingkat).

**Konstruksi dinding — tiga lapis, dari dalam ke luar:**

1. **Pita membran** cokelat-tan halus = garis collision sebenarnya. Tipis, licin,
   melengkung lembut (bukan tile kotak).
2. **Deret scute merah** — pelat/pill membulat warna crimson yang menancap di tepi
   dalam pita, seperti gigi/vertebra; sesekali集群 frill merah berduri dan
   **kelenjar emas** menyala tertanam di antaranya.
3. **Jaringan sel sisik** tebal di luar: tekstur heksagonal/sisik berlapis,
   **berkode warna per wilayah** — teal-biru, crimson-marun, ungu-violet.
   Ini yang memberi rasa "kamu berada DI DALAM organ yang berbeda-beda".

**Pencahayaan: BACKLIT.** Ruang bermain justru **terang** — gradasi amber/oranye
menyala dari belakang/atas (kabur, volumetrik), sementara **dinding/jaringan adalah
elemen gelap & dingin**. Kontras terang-dalam / gelap-luar ini kunci seluruh mood.

**Elemen ruang lain:**
- **Massa organ** cokelat berbelang, membulat besar, duduk di tengah chamber sebagai
  anchor/obstacle lunak (lihat `t00s.jpg`, `t05s.jpg`).
- **Filamen pucat** bercabang (chordae/tendril) melintang di ruang terbuka sebagai
  parallax lunak — tidak solid.
- **Roset landak/Anemone** cokelat berduri bertengger di ledge = hazard stasioner.
- **Struktur pembuluh berusuk merah** ("tangga"/kapiler ber-ruas) berfungsi sebagai
  jembatan/koridor antar-ruang.

**Palet:** interior amber/oranye/kuning menyala + eksterior biru-teal / crimson /
violet jenuh. Semua **gradasi lembut & painterly**, tidak ada fill datar, tidak ada
outline hitam keras pada lingkungan.

---

## 2. KARAKTER — protagonis

Lihat `zoom_creature.png`.

- **Artropoda ramping** tipe crane-fly/nyamuk: abdomen memanjang teal-hijau,
  **4–6 kaki sangat panjang & tipis** (teal gelap), toraks **bercahaya putih**
  (sekaligus titik muzzle-flash), sepasang lengan/antena hijau yang **terangkat saat
  menembak**, kap kepala gelap, dan **blur sayap cyan** di belakang.
- **Identitas lewat siluet + core menyala**, bukan wajah: tidak ada mata/mulut sama
  sekali. Terhadap latar amber yang terang, kaki tipis + inti putih terbaca seketika.
- **Skala kecil**: ±7% lebar layar → arena terasa luas & berbahaya.
- **Gerak**: kaki menyeret/mencambuk (secondary motion), badan miring ke arah aim,
  sayap blur; proyektil = **oval hijau kecil** dalam aliran melengkung.

## 3. MUSUH & OBJEK

| Entitas | Penampakan | Peran terbaca |
|---|---|---|
| **Cincin magenta** | donat bercahaya pink/magenta, rim terang, inti gelap; muncul **berkelompok membentuk garis/pola** | hazard bullet-pattern / mine |
| **Origami abu-abu** | gumpalan poligonal abu-abu seperti kertas remuk, titik warna kecil di inti | musuh melayang tipe-2 |
| **Roset landak** | anemone cokelat berduri di ledge | hazard stasioner |
| **Starburst emas** | ledakan oranye-emas ber-rim cyan | impact/kill FX |
| **Percikan biru-violet** | partikel kecil menyala | hit FX |
| **Angka damage** | angka abu-abu/putih melayang di titik kena | feedback numerik in-world |
| **Serpihan cyan** | pecahan menyala menempel di dinding | pickup |

## 4. HUD — sangat minimalis, 4 anchor

Lihat `zoom_hud_vial.png` dan `t21s.jpg`.

1. **Kiri-atas — vial/lentera vertikal** (widget paling khas): kapsul membulat;
   kubah **emas menyala** dengan dua glif **petir** kuning + inti pucat; di bawahnya
   kerah **violet** bercahaya dengan inti magenta kecil (esensi/makhluk di dalamnya);
   badan tabung gelap translusen; **3 pip** kecil di dasar. Terbaca sebagai
   **meter charge energi/ability** yang digayakan sebagai vial bioluminesen.
2. **Kiri-bawah — bar segmen**: 6 segmen pill membulat ber-outline gelap tipis,
   ber-jarak kecil: 1 oranye **berpola crosshatch** + 1 oranye solid + 4 hijau terang
   (= health/resource dengan state berbeda). Di kirinya **glif sayap biru**; di
   kanannya **counter orb biru + angka** (currency). Saat combat muncul hitungan
   `2/18` · `3/8` di samping glif.
3. **Kanan-bawah — satu tombol avatar bulat** (portrait makhluk, teal).
4. **Kanan-atas — pill putih kontekstual** ("Fast travel") yang **hanya muncul saat relevan**.

Ditambah: **legend keycap di tengah** saat run dimulai lalu memudar, dan **angka damage
in-world**. **TIDAK ADA**: top bar, minimap, panel quest, buff row, tombol besar,
dock menu. Sangat menahan diri.

---

## 5. VIDEO vs PILOT PR #44 — putusan ("video yang memutuskan")

### ✅ SEJALAN — pertahankan

| Poin PR #44 | Konfirmasi video |
|---|---|
| Arena organ-shaped + vertikal (koridor didaki) | ✔ video persis ini: chamber organik bertingkat + koridor |
| Karakter **abstrak tanpa mata/mulut** | ✔ makhluk video juga tanpa wajah; identitas dari siluet + core |
| Pendekatan **data-driven rig prosedural** (`creature-rig.js`) | ✔ gaya render video = vektor/gradasi prosedural, BUKAN sprite foto — mesin yang sudah ada cocok |
| Dinding sebagai collision, dekor sebagai struktur | ✔ pita membran video memang garis collision |

### ❌ BERTENTANGAN — buang / balik

| Poin PR #44 | Kata video | Putusan |
|---|---|---|
| **Pivot pixel-art** (Brotato/DMDo/HoT/Hades): lantai gelap bertekstur, sprite terang ber-outline | Video **painterly gradasi lembut + glow volumetrik**, tanpa outline keras, tanpa piksel | **BUANG pixel-art.** `assets/sprites/px/` sudah ikut tercabut di reset ini ✔ — jangan dibangun ulang |
| Model cahaya "lantai gelap + sprite terang" | Video **kebalikannya**: ruang bermain **terang backlit amber**, dinding/jaringan yang **gelap & dingin** | **BALIK model cahaya**: play-space luminous, struktur gelap-jenuh |
| Dinding = **tile** lantai/dinding pixel (`shape.wall.floor/wallTex`) | Video = **pita membran licin + deret scute merah + pita jaringan sel sisik** | Ganti vocabulary tile → **ribbon + scute + scale-cell band** |
| Satu koridor organ tertutup per zona | Video = **multi-chamber tersambung** (metroidvania-lite) dengan koridor antar-chamber | Perluas `arena-shape.js` dari satu koridor → **graf chamber** |
| Karakter "Mako": amoeboid berzirah, lengan-rahang, perisai membran | Video = **artropoda ramping**: kaki panjang tipis + inti menyala + blur sayap | Geser siluet hero ke **spindly limbs + glowing core**; mandat no-face tetap |
| Brief "Last Asylum" pitch 58° telefoto | Video **top-down murni / miring tipis**, tanpa foreshortening kuat | Turunkan pitch; kamera lebih datar supaya pola chamber terbaca |

### 🆕 TARGET BARU yang belum ada di PHAGOS sama sekali

1. **Vial charge meter kiri-atas** (lentera bioluminesen) — jadikan widget tanda tangan HUD baru.
2. **Bar segmen kiri-bawah** dengan state crosshatch / solid / hijau + glif sayap + counter orb.
3. **HUD 4-anchor** — pangkas HUD PHAGOS sekarang (hp-pill, ability-bar, quests, buffs,
   minimap, announce, gate, meter) menuju 4 anchor + angka in-world.
4. **Cincin magenta bullet-pattern** sebagai bahasa hazard baru (pengganti telegraph AOE merah polos).
5. **Roset landak** sebagai hazard stasioner di ledge.
6. **Filamen chordae parallax** melintang di ruang terbuka.

---

## 6. Rekomendasi eksekusi (urutan, semua data-driven)

1. **Palet & cahaya dulu** (`data/arenas.json`): ganti model warna jadi
   *interior amber backlit* + *jaringan luar biru/crimson/violet per organ*;
   hapus asumsi "ground gelap".
2. **Vocabulary dinding**: `shape.wall` → { `ribbon` (garis collision licin),
   `scutes` (deret pelat merah), `tissue` (pita sel sisik berkode warna),
   `glands` (kelenjar emas), `frills` (duri merah) }. Render prosedural di
   `organ-corridor.js` / `background.js`.
3. **Topologi**: perluas `arena-shape.js` ke **graf chamber** (2–4 chamber + koridor),
   pertahankan clamp/spawn O(1) yang sudah ada.
4. **Hero silhouette**: rig baru di `data/creature-rigs.json` — kaki panjang tipis,
   core menyala, antena/lengan naik saat attack, blur sayap. Mandat no-face tetap.
5. **HUD reset** (`styles/` + `js/ui/screens/hud-screen.js`): 4 anchor saja;
   bangun widget vial + bar segmen sebagai komponen baru.
6. **Hazard**: cincin magenta berpola + roset landak (data-driven di `data/enemies.json`
   / `data/mutators.json`).
7. Verifikasi: `verify-world` (bentuk chamber + luas), `verify-visual`, `verify-animasi`,
   `verify-gamefeel`; e2e screenshot before/after seperti pola `docs/pilot-jantung/`.

**Yang TIDAK berubah:** engine inti (loop, kamera, collision, spawn, save), ekonomi,
mutasi/evolusi, dan seluruh `data/*.json` sebagai sumber kebenaran.

---

## Lampiran — frame kunci

| File | Detik | Isi |
|---|---|---|
| `t00s.jpg` | 0 | Establishing: chamber + massa organ + legend keycap + bar segmen |
| `t05s.jpg` | 5 | Chamber lebar, filamen chordae, kelenjar emas di dinding |
| `t12s.jpg` | 12 | Koridor pembuluh berkelok (vertikalitas) |
| `t16s.jpg` | 16 | Dua chamber bertingkat + cincin magenta pertama |
| `t21s.jpg` | 21 | Combat: proyektil hijau, cincin magenta, origami abu, angka damage |
| `t25s.jpg` | 25 | Chamber lain, pill "Fast travel" kanan-atas |
| `zoom_creature.png` | 21 | Zoom 3× protagonis + konstruksi dinding (ribbon+scute+tissue) |
| `zoom_hud_vial.png` | 21 | Zoom 2× vial kiri-atas + glif sayap + bar segmen |
