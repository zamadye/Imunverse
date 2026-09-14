# PHAGOS — BRAND GUIDE v2.0 (REBRAND)

> "Sel Imun vs Patogen — Selamatkan Tubuh!"
> Roguelike survival • **phagos.space** • Mobile web (Android, landscape)

Dokumen ini adalah **hukum** untuk semua aset visual Phagos. Setiap aset baru
harus bisa dijawab: *"kalau orang lihat ini tanpa konteks, apakah mereka langsung
tahu ini GAME, dan game tentang APA?"* — jawabannya harus **ya**.

> **Catatan rebrand (v2.0):** brand ini semula bernama Imunverse (imunverse.fun).
> Semua aset bermuatan nama lama sudah dihapus/diganti. Aset tanpa nama
> (emblem compact, monokrom, Mako, pattern, frame, sticker) tetap valid.

---

## 0. Brand Story — Kenapa "PHAGOS"

**Phagos** lahir dari **fagositosis** — mekanik paling unik game ini: hero
menelan patogen hidup-hidup. Nama brand-nya adalah mekaniknya.

- "Phagos" = sel yang memangsa penyerang. Predator yang melindungi tubuh.
- Narasi marketing: *"Di dalam tubuhmu, ada penjaga yang memangsa ancaman.
  Kenali dia. PHAGOS."*
- Nama 6 huruf: mudah dieja, diingat, di-mention di TikTok.
- Cerita rebrand itu sendiri bisa jadi konten (pilar CERITA): "Kenapa kami
  ganti nama?" — underdog story yang orang mau bagikan.

**CTA di semua aset (pra-rilis):** **"SEGERA HADIR DI PLAY STORE"**.
`phagos.space` tetap tampil sebagai info domain resmi (teks kecil).
JANGAN pakai "ketik phagos.space / langsung main" sebelum game live di
Play Store.

---

## 1. Identitas

| | |
|---|---|
| **Nama** | PHAGOS |
| **Domain** | phagos.space |
| **Tagline resmi** | Sel Imun vs Patogen — Selamatkan Tubuh! |
| **Genre** | Roguelike survival (Vampire Survivors / Brotato), top-down 2D, wave-based |
| **Sesi** | 3–8 menit per run. Pendek, intens, bisa diulang |
| **Audiens** | Remaja–dewasa muda Indonesia (15–28), gamer mobile casual–midcore, Android |
| **Bahasa** | Indonesia (primer), Inggris (sekunder) |
| **Tone** | **Epik tapi hangat.** "Cells at Work!" bertemu Vampire Survivors. Serius di gameplay, ramah di penyampaian. Perjuangan penuh harapan — BUKAN horror, BUKAN keputusasaan, BUKAN lab steril. |

**Dunia:** seluruh game berlangsung di dalam tubuh manusia. Arena = organ (luka,
saluran limfa, lambung, paru-paru, saraf, jantung). Organik, basah, bercahaya —
ekosistem mikro, seperti dilihat di bawah mikroskop fluoresen.

---

## 2. Palet Warna Resmi (HUKUM)

| Nama | Hex | Penggunaan |
|---|---|---|
| **Teal utama** | `#0d7377` | Latar arena, identitas dunia |
| **Coral** | `#ff6b6b` | Musuh, bahaya, urgensi, CTA |
| **Sage** | `#7cb68e` | Sekutu, penyembuhan, progres |
| **Kuning emas** | `#f5c64f` | Mata uang Imun, premium, reward **saja** |
| **Ungu** | `#9f7aea` | Bundle nilai, langka, epik |
| **Solarized cream** | `#fdf6e3` | Background UI, teks terang, logo |
| **Hijau muda** | `#48bb78` | Langganan, sukses |
| **Abu baja** | `#718096` | Teks sekunder, elemen nonaktif |

**Aturan:**
- Teal + coral = pasangan utama. Sage = aksen. Emas HANYA elemen premium/reward.
- Render/foto boleh punya warna environment tambahan, tapi **UI, teks, dan
  elemen grafis harus tetap di palet**.
- Jangan pernah dominan merah darah (bukan horror).

Variasi gelap untuk background konten: `#0a3234` (base), `#0b2f31`, `#0d4a4e` (glow).

---

## 3. Tipografi

| Peran | Font | Catatan |
|---|---|---|
| **Display / headline** | **Lilita One** | Bulat, tebal, "game". Headline, sticker, CTA, judul template. |
| Display alternatif (lebih berat) | Titan One | Angka besar, "VS", badge. |
| Angka/mono-gameplay | Bungee | Statistik run, angka skor. |
| Body / tagline | Lilita One (ukuran kecil) atau sans sistem | Tagline, subhead, body copy. |

Font di `brand/fonts/`. Semua teks primer **bahasa Indonesia dulu**.

**Lettering logo "PHAGOS"** custom organik (clay-like; cabang dendrit di huruf
P & G; huruf O = sel dengan titik inti) — terkunci di `logo/phagos-concept.png`.
Jangan set ulang dengan font standar.

---

## 4. Sistem Logo (MINIMAL — 2 aset inti + turunan ukuran)

Sistem logo disederhanakan sesuai kebutuhan implementasi. **Tidak ada varian
lain.** Kalau butuh bentuk baru, turunkan dari 2 aset inti ini.

### 4.1 Icon (aset inti 1) — untuk foto profil & Play Store
Mako vs Sel Kanker, clash energi teal×coral, **tanpa ring/bingkaran**,
full-bleed, komposisi aman di-crop lingkaran.

| File | Ukuran | Pakai untuk |
|---|---|---|
| `logo/icon.png` | 1024² | Master |
| `logo/icon-800.png` | 800² | Profil YouTube |
| `logo/icon-512.png` | 512² | **Play Store icon** (juga `playstore-icon-512.png`) |
| `logo/icon-400.png` | 400² | Profil X/Twitter |
| `logo/icon-320.png` | 320² | Profil Instagram |
| `logo/icon-200.png` | 200² | Profil TikTok |
| `logo/icon-110.png` | 110² | Highlight IG |
| `logo/playstore-icon-48-preview.png` | 48² | QA keterbacaan (jangan di-upload) |
| `logo/icon-circle-400-preview.png` | 400² | Preview crop lingkaran (jangan di-upload) |

### 4.2 Wordmark (aset inti 2) — TRANSPARAN, tanpa background
Lettering PHAGOS + glow + partikel, PNG alpha murni. **Di-layer langsung di
atas konten — TIDAK dibungkus panel/kotak background.**

| File | Ukuran | Pakai untuk |
|---|---|---|
| `logo/wordmark.png` | 1263×433 | Master (header website, banner, video) |
| `logo/wordmark-800/512/320.png` | turun | Web responsive |
| `logo/wordmark-mono.png` | 1263×433 | Merch/watermark single-color |
| `logo/logo-animasi.mp4` | 16:9, 4 dtk | Intro/opener (wordmark + partikel) |

### 4.3 Aturan pemakaian
- **Icon**: platform yang meng-crop lingkaran/rounded — sudah aman, jangan
  tambah ring/border sendiri.
- **Wordmark**: di foto terang/ramai → scrim teal gelap di belakang. Di latar
  putih → pakai `wordmark-mono` versi dark (reverse). Minimum lebar 320 px.
- **Jangan**: rotate, ubah warna, ganti lettering, tambah background/kotak,
  drop shadow berlebihan.
- **Banner X header**: `banners/twitter/x-header-1500x500.png` (1500×500).

### 4.4 Banner (key art CINEMATIC + copy Play Store)
Banner BUKAN sekadar teks — full-bleed key art karakter (Mako + T-Bolt + Nyx
vs horde patogen), teks di area kiri yang di-scrim gelap. Dibangun oleh
`tools/build_banners.py` (source art: `banners/twitter/x-header-art-src.png`,
`banners/shared/hero-keyart-16x9-src.png`):

| File | Ukuran | Pakai untuk |
|---|---|---|
| `banners/twitter/x-header-1500x500.png` | 1500×500 | Header X/Twitter |
| `banners/twitter/tw-post-16x9.png` | 1200×675 | Post X/Twitter |
| `banners/fb/fb-post-16x9.png` | 1200×675 | Feed Facebook |
| `banners/fb/fb-link-1200x630.png` | 1200×630 | Link card FB / OG |

Aturan: CTA emas "SEGERA HADIR DI PLAY STORE" (emas = momen launch/premium),
headline "TUBUHMU ADALAH ARENANYA.", tagline di bawah wordmark.

## 5. Karakter

**Referensi kunci (DIKUNCI — semua aset memakai desain ini):**
- `ref/mako-master.png` — Mako, render painterly semi-realistis (maskot)
- `ref/mako-sheet.png` — 9 ekspresi mentah (3×3)
- `ref/mako-expression-sheet.png` — 6 ekspresi final berlabel (deliverable)
- `ref/mako-exp/*.png` — 9 ekspresi individual (siap tempel)

**Mako (Macrophage)** = maskot resmi, wajah Phagos. Desain: sel bulat
biru-hijau, mulut lebar, mata besar, glow teal bioluminesen, gaya painterly.
Ekspresi wajib: Netral/siap, Senang/menang, Terkejut/terancam, Marah/mode tempur,
Sedih/kalah, Mengedip.

**Hero poster (paling sering muncul):** Mako (maskot), T-Bolt (kompetitif),
Nyx (langka/aspirasional). Render berikutnya: elevasi sprite in-game
(`assets/sprites/hero_tcd8_idle.png`, `hero_nkcell_idle.png`).

**Antagonis poster:** Sel Kanker (konflik inti — `enemy_sel_kanker.png`),
Virus (paling dikenali publik), Bakteri (gerombolan ikonik).

**Karakter naratif:** RIA (pemandu, teal-putih) & Amara (penjelas hero baru, emas).

**Aturan:** karakter konsisten di SEMUA aset. Tidak ada "Mako versi lain".

---

## 6. Art Direction

- **Gaya:** semi-realistis painterly — detail, sinematik, hangat. Bukan flat,
  bukan chibi, bukan horror.
- **Cahaya:** bioluminesen. Hero = glow teal/sage/emas. Patogen = glow coral/merah.
  Latar = teal gelap bercahaya redup (bukan hitam pekat).
- **Partikel:** spore, antibodi (Y-shape), gelembung — atmosphere di semua aset.
- **Komposisi:** hero di depan terang & fokus; musuh di belakang/sisi, lebih gelap.
  Selalu ada rasa "perjuangan penuh harapan".
- **Jangan:** lab steril, bedah, darah, anatomi manusia eksplisit, UI kedokteran,
  kesan farmasi/obat.

---

## 7. Aset Pendukung

| Aset | File | Pakai untuk |
|---|---|---|
| Pattern tileable | `patterns/pattern-biologikal.png` (1024²) | Background konten |
| Pattern varian gelap | `patterns/pattern-dark-ui.png`, `bg-1920x1080.png` | Background template/banner |
| Divider organik | `patterns/divider-organik.png` (1200×160) | Postingan panjang, carousel |
| Frame membran 1:1 | `patterns/frame-membran-1080.png` | Screenshot di post 1:1 |
| Frame membran 16:9 | `patterns/frame-membran-1920.png` | Screenshot di post 16:9 |
| Sticker pack (12) | `stickers/*` + `stickers/sticker-pack-sheet.png` | Sosmed, story, chat |

---

## 8. Aturan Visual yang Tidak Boleh Dilanggar

1. **Palet adalah hukum** (§2).
2. **Karakter konsisten** (§5) — desain final sudah dikunci.
3. Setiap aset wajib punya ≥1 dari: **logo / phagos.space / karakter game**.
4. **Epik tapi bukan gelap** — hero bercahaya, suasana harapan.
5. **Teks Indonesia dulu.**
6. **Screenshot game HARUS dari gameplay nyata** (repo: `screenshots/`,
   `shots/review/`, atau capture langsung phagos.space). Jangan pernah mengisi
   dengan gambar palsu.

---

## 9. Reproduksi & File Map

Semua aset turunan (crop, logo full, pattern, frame, sticker, animasi) dibangun
oleh `tools/build_assets.py` dari source AI di `ref/`, `logo/`, `patterns/`:

```bash
pip install --target brand/libs pillow
PYTHONPATH=brand/libs python3 brand/tools/build_assets.py   # + brand/bin/ffmpeg
```

```
brand/
├── fonts/            # Lilita One, Titan One, Bungee (OFL)
├── bin/              # ffmpeg static (tooling — TIDAK di-commit)
├── libs/             # Pillow (tooling — TIDAK di-commit)
├── ref/              # Mako master, sheet, 9 ekspresi
├── logo/             # icon (7 ukuran + preview), wordmark transparan, animasi
├── patterns/         # pattern, divider, frame
├── stickers/         # 12 stiker + contact sheet
├── banners/          # twitter/ fb/ shared/ (key art cinematic + banner)
├── templates/        # vertical/ horizontal/ square/ (13 template)
├── video/            # trailer/ hero/ shorts/ (MP4 + frames + audio)
├── docs/             # BRAND_GUIDE.md, MARKETING_STRATEGY.md, scripts
├── tools/            # build_assets.py, build_logo.py, build_banners.py
└── (screenshots asli game: ../screenshots/, ../shots/review/)
```

> **Info untuk tim developer (bukan bagian brand):** nama "Imunverse" masih
> tersisa di file game — `README.md`, `ROADMAP.md`, `assets/ART_BIBLE.md`,
> `data/lang.json`, `assets/icons/README.md`, dan beberapa `docs/`.
> Ganti ke Phagos saat rebrand in-game.
