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

**CTA di semua aset:** "Ketik phagos.space — langsung main." (gratis, tanpa
download, web game).

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

## 4. Sistem Logo

| Varian | File | Pakai untuk |
|---|---|---|
| **Wordmark (TRANSPARAN)** | `logo/wordmark.png` (1246×403, PNG alpha) | **Logo teks utama.** Header website, banner, thumbnail, video — di-layer di atas apa pun. Tanpa background. |
| **Wordmark monokrom** | `logo/wordmark-mono.png` (cream, alpha) | Merchandise, stamp, watermark, latar yang butuh single-color. |
| **Logo compact (emblem 1:1)** | `logo/logo-compact.png` + 800/512/400/320/200/110 | Ikon app, profile picture semua platform, favicon. (Mako vs Sel Kanker) |
| **Emblem monokrom** | `logo/logo-mono.png` (cream, transparan) | Watermark, merchandise. |
| **Watermark** | `logo/logo-watermark-150.png` (40% opacity) | Overlay video/screenshot. |
| **Logo animasi** | `logo/logo-animasi.mp4` (16:9, 4 dtk, loop) | Intro video, loading, opener TikTok. (wordmark + partikel) |

**Aturan pemakaian wordmark (PENTING):**
- **Sangatkan, jangan di-frame.** Wordmark harus di-layer langsung di atas
  konten (foto/video/gradient) — TIDAK DIBOLEH tempel di atas panel/kotak
  background buatan. Glow-nya sudah jadi bagian logo.
- Di atas foto terang/ramai: tambahkan **scrim teal gelap** (gradient alpha)
  di balik wordmark agar cream terbaca.
- Di atas latar putih/terang: pakai `wordmark-mono.png` versi dark teal
  (reverse) — jangan cream langsung.
- Safe area: padding minimal 10%. Minimum lebar 320 px.
- Jangan: rotate, ubah warna, ganti lettering, tambah kotak/background,
  efek drop shadow berlebihan.
- Emblem compact (Mako vs Sel Kanker) boleh berdiri sendiri — sudah mengandung
  konflik inti game.

---

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
├── logo/             # phagos-concept, full, compact, mono, watermark, animasi
├── patterns/         # pattern, divider, frame
├── stickers/         # 12 stiker + contact sheet
├── banners/          # x/ youtube/ tiktok/ instagram/ discord/ googleplay/
├── templates/        # vertical/ horizontal/ square/ (13 template)
├── video/            # trailer/ hero/ shorts/ (MP4 + frames + audio)
├── docs/             # BRAND_GUIDE.md, MARKETING_STRATEGY.md, scripts
├── tools/            # build_assets.py
└── (screenshots asli game: ../screenshots/, ../shots/review/)
```

> **Info untuk tim developer (bukan bagian brand):** nama "Imunverse" masih
> tersisa di file game — `README.md`, `ROADMAP.md`, `assets/ART_BIBLE.md`,
> `data/lang.json`, `assets/icons/README.md`, dan beberapa `docs/`.
> Ganti ke Phagos saat rebrand in-game.
