# Workflow Edukasi "Tubuh Sebagai Universe" — Imunverse

> Jawaban atas arahan pemilik: *"bagaimana caranya agar game ini menjadi workflow edukasi untuk anak-anak maupun yang cukup dewasa untuk tahu sel-sel dan semua organ, fungsi, dll — semua dibungkus dengan baik dan menyenangkan."*
> Prinsip tunggal: **edukasi dibungkus gameplay, bukan ditempel di atasnya.** Anak datang untuk bertarung; pengetahuan adalah efek samping yang terasa seperti reward.

---

## 1. Inventaris: Fondasi Edukasi yang SUDAH Ada di Game

Ini kekuatan terbesar proyek — hampir semua mekanik existing adalah **metafora sains yang jujur**:

| Mekanik di game | Sains asli yang direpresentasikan | Status |
|---|---|---|
| Kampanye organ-per-organ (mulut → jantung) | Anatomi & perjalanan patogen masuk lewat makanan/napas | ✅ sudah main |
| Bakteri Gram Positif/Negatif berlapis armor | Dinding sel tebal vs membran luar ganda | ✅ armor = biologi nyata |
| Virus Replikasi pecah jadi virion | Siklus litik replikasi virus | ✅ split = biologi nyata |
| Sel Abnormal menyamar, terungkap Sel NK | Sel kanker menghindari imun; NK sebagai surveilans | ✅ stealth = biologi nyata |
| Prion mengkristalkan musuh | Misfolding protein yang "menular" | ✅ aura = konsep nyata |
| Toksin = genangan zona bahaya | Toksin bakteri di jaringan | ✅ |
| Buff nutrisi (Zinc, Vitamin C, Protein, dst.) | Gizi nyata untuk imun | ✅ pesan gizi via gameplay |
| 5 sistem tubuh (Sirkulasi, Pencernaan, dst.) dengan kesehatan | Interdependensi sistem organ | ✅ meta-layer |
| Cerita tiap bab (campaign.json) | Narasi penyakit yang benar secara konsep | ✅ |
| Eosinofil 1,5× vs Parasit | Spesialisasi sel imun | ✅ bonus = peran asli |

**Kesimpulan:** game ini sudah *mengajarkan* sains lewat mekanik — yang belum ada adalah **moment "sadar-sains"**: momen ringan di mana pemain diberi tahu "apa yang barusan kamu lakukan itu namanya X, dan di tubuh asli itu bekerja seperti Y". Itu tugas Fase 11–13.

---

## 2. Tiga Lapis Workflow (per sesi bermain)

```
BERTARUNG (gameplay inti, tidak berubah)
   │  setiap entitas pertama kali ditemui
   ▼
TERBUKA (reward penemuan — Kodex Sel)
   │  di gerbang alami: sebelum boss / game over / pause
   ▼
TERUJI RINGAN (Kuis Gerbang opsional + narasi sains)
   │  akumulasi lintas sesi
   ▼
DIHARGAI (lencana Biolog Muda per sistem tubuh)
```

Tidak ada satu pun langkah yang memaksa keluar dari alur main: kodex terbuka *karena* bertarung, kuis muncul *di jeda alami*, lencana terkumpul *dari* bermain.

---

## 3. Fase 11 — Kodex Sel (Bio-Pedia)

**Bentuk:** koleksi kartu (grid, satu per entitas: 6 hero, 13 musuh, 13 nutrisi, 5 sistem tubuh, 6 organ). Kartu **terkunci** (siluet) sampai pemain menemuinya di medan; kartu **terbuka** berisi:

- **Sisi anak (default):** ilustrasi sprite + nama + 1–2 kalimat fun-fact bahasa anak ("Neutrofil adalah petugas pertama yang lari paling cepat ke lokasi bahaya!").
- **Sisi dewasa muda (toggle "Tahukah kamu?"):** istilah ilmiah ringan + fungsi asli ("Neutrophil — fagosit responder pertama (fasa inflamasi akut); hidup singkat, jumlah terbanyak di darah.").
- **Chip fakta gameplay** yang menghubungkan dua dunia: "Di game: tebasan cepat 0,22 detik. Di tubuh: pertama tiba di luka."

**Sumber data (tanpa hardcode):** field `edu` baru per entitas di JSON (`data/edu-*.json` terpisah atau inline): `{ funKid, funKidEn, fact, factEn, realName, system }` — dwibahasa otomatis via mesin i18n Fase 10 (kunci = teks ID, nilai EN).

**Unlock:** `meta.codexSeen[entityId]` — di-set oleh `spawnEnemy`/`collectPickup`/pemilihan hero. Progress misi: "temukan 10 kartu" → reward antibodi (mengikat ekonomi existing).

**Lokasi UI:** ikon baru di dashboard bottom-nav area (bagian dari 3–5 nav yang sudah ada — masuk sebagai ikon kecil di samping Bag atau tab dalam Dashboard). Screen baru `codex-screen`.

---

## 4. Fase 12 — Kuis Gerbang + Lencana Biolog Muda

**Kuis Gerbang (pra-boss, opsional, tanpa hukuman):**
- Saat kuota bab tercapai & boss akan muncul (momentum yang SUDAH ada di `game.js`), tawarkan 1 soal pilihan ganda 10 detik dari kartu kodex bab itu: *"Sel yang memakan patogen raksasa adalah…"*.
- Benar → buff masuk bos ("Pengetahuan = kekuatan! +10% damage vs bos").
- Salah / lewat waktu → tetap main normal, jawaban benar ditampilkan sekilas (tanpa rasa gagal — edukasi, bukan gerbang blokir).
- Soal dirender dari data (field `quiz` per entitas: `{ q, qEn, options[3], answerIndex }`) — zero hardcode.

**Lencana Biolog Muda (5, per sistem tubuh):**
- Terbuka saat: sistem X pernah dipulihkan ke 80+ **dan** kartu kodex bab terkait terkumpul semua.
- Lencana tampil di dashboard (reuse pipeline badge/`icon_*.png`).
- Set lengkap 5 → gelap "Muda Biolog" di profil akun (terikat user ID — konsisten constraint akun).

---

## 5. Fase 13 — Mode Belajar (Classroom Mode)

Toggle di prep/pause (juga bisa dipakai guru/orang tua):
- Wave lebih lambat (modifier `spawnIntervalBase` × 1.5), game over lembut (revive gratis 3×).
- **Panel "Apa yang terjadi?"** di Pause & Game Over: narasi otomatis dari log run — "Kamu dikunjungi 12 Bakteri Gram Positif: dinding tebal mereka menyerap tebasanmu dulu — di tubuh asli, itulah fungsi dinding sel tebal" — dirender dari templat + data entitas (bilingual otomatis).
- Kuis gerbang jadi tampil setiap bab (masih opsional).

**Kepatuhan prinsip lama:** tanpa iklan baru, tanpa pembayaran baru; Mode Belajar gratis penuh.

---

## 6. Kenapa Ini "Menyenangkan" dan Bukan "Pelajaran"

1. **Discovery loop ala koleksi** (Pokédex-effect): kartu siluet memicu rasa penasaran, bukan kewajiban.
2. **Belajar = buff**: jawab kuis → lebih kuat. Pengetahuan terasa seperti power-up, karena memang jadi power-up.
3. **Dua kecepatan audiens**: anak tinggal main & mengumpulkan; remaja/dewasa muda membuka lapisan "Tahukah kamu?" — konten sama, kedalaman beda.
4. **Orang tua/guru mendapat nilai**: Mode Belajar + lencana = bukti belajar tanpa ujian.
5. **Dwibahasa penuh dari Fase 10**: semua konten edukasi otomatis ID/EN — tak ada pekerjaan terjemahan tambahan di masa depan untuk konten baru (cukup isi kedua field).

## 7. Estimasi & Urutan

| Fase | Isi | Skala |
|---|---|---|
| 11 | Kodex Sel: data edu ±40 entitas × 2 bahasa + screen + unlock tracking + misi temuan | sedang (1 fase penuh) |
| 12 | Kuis gerbang (±20 soal) + 5 lencana + gelar | sedang |
| 13 | Mode Belajar + narasi otomatis pause/gameover | kecil–sedang |

Setiap fase tetap dengan kriteria lulus e2e klik-riil + audit i18n 0 residu (standar yang sudah berjalan).
