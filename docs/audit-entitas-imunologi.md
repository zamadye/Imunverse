# Audit Nama Entitas Imunologi — Imunverse vs `konten-entitas-imunverse.md`

> Audit kesesuaian nama & peran entitas game terhadap dokumen desain entitas dari pemilik proyek.
> Tanggal audit: 5 Sep 2026 · Basis kode: commit `250477d`.
> **Catatan dokumen sumber:** nama dipakai sebagai *basis inspirasi*, bukan klaim akurasi medis ketat — jadi rekomendasi di bawah menimbang keakuratan istilah **dan** keterbacaan anak-anak.
>
> **Legenda status:** ✅ selaras · 🟡 selaras dengan catatan (nama/perilaku beda ringan) · ❌ ada di dokumen, belum ada di game · ➕ ada di game, tidak didefinisikan dokumen (bukan masalah — dicatat agar lengkap).

---

## Ringkasan

| Kategori | Dokumen | Game | Selaras | Catatan | Belum ada | Ekstra |
|---|---|---|---|---|---|---|
| Sistem/organ | 6 | 5 sistem + 6 bab peta | 6/6 | Pernapasan (opsional di dokumen) sudah jadi bab+arena | 0 | 0 |
| Hero/pasukan | 12 | 5 | 5 (2 dengan catatan nama/perilaku) | — | **6 hero** | 0 |
| Musuh/patogen | 10 | 7 | 4 (4 dengan catatan) | — | **5 entitas** | 1 (virion) |
| Nutrisi | 9 | 5 pickup | 1 nama (efek beda) | Fungsi sistem beda: dokumen = buff; game = drop in-run | **8 item** | 4 pickup |

---

## 1. Sistem/Organ (Map & World Node) — ✅ SELARAS PENUH

| Dokumen | Di game | Ref. file | Status |
|---|---|---|---|
| Sirkulasi — distribusi energi, kecepatan respons imun | `sirkulasi` — role "Distribusi energi & kecepatan respons imun" | `data/body-systems.json` | ✅ |
| Pencernaan — lambung, usus; sumber energi/nutrisi | `pencernaan` + bab `bab_mulut`, `bab_lambung`, `bab_usus` + arena "Lambung Asam" | `data/body-systems.json`, `data/campaign.json`, `data/arenas.json` | ✅ |
| Saraf — radar early-warning wave | `saraf` + bab `bab_...` + arena "Sumbu Saraf" | idem | 🟡 nama organ & sistem cocok; **peran radar early-warning belum diimplementasikan** (roadmap fitur) |
| Imun — markas pasukan hero | `imun` — markas pasukan = Dashboard/Roster/Lab | idem | ✅ |
| Limfatik — pembersih racun sisa combat | `limfatik` — `racunCleansePerLimfatik` membersihkan meteran racun per hari | `data/body-systems.json` | ✅ mekanik pembersih racun sudah jalan |
| Pernapasan — opsional, ekspansi | bab `bab_paru` + arena "Paru Kristal" (belum sistem kesehatan terpisah) | `data/campaign.json`, `data/arenas.json` | ✅ lebih maju dari rencana (dokumen menyebut opsional) |

Warna sistem (merah-teal sirkulasi, dll.) konsisten dengan palet `icon_*.png` & arena.

---

## 2. Hero/Pasukan Imun (Playable Units)

| Dokumen | Di game | Status | Catatan |
|---|---|---|---|
| **Makrofag** — tank/melee, `melee_swipe`, HP besar | `makrofag` — melee_swipe, "Sel fagosit raksasa… sapuan pseudopodia" | ✅ | Nama, pola serang, dan peran persis |
| **Neutrofil** — swarm, `rapid_melee` | — | ❌ | Belum ada; kandidat hero murah jumlah-banyak |
| **Sel-T Pembantu (CD4)** — `aura_buff` support | — | ❌ | Belum ada |
| **Sel-T Pembunuh (CD8)** — sniper `ranged_pierce` | `sel_t` — nama tampil **"Sel T Killer"**, deskripsi "Sel T sitotoksik… menembus deretan patogen", ranged_pierce | 🟡 | Pola serang & peran persis; **nama tampil beda** ("Killer" vs "Pembunuh"). Rekomendasi: ganti nama tampil → **"Sel T Pembunuh"** (deskripsi tetap menyebut sitotoksik) |
| **Sel-T DP** — prekursor, evolusi pilih jalur Helper/Sitotoksik | — (konsep evolusi ada tapi lain bentuk: tier **Sel Bulir → Bersilia → Fagosit Muda → Elite → Legenda**, `data/evolutions.json`) | 🟡 | Sistem evolusi bertingkat sudah ada; **jalur bercabang ala Sel-T DP belum**. Kandidat fitur meta-progression menarik |
| **Sel-B** — `summon_projectile` antibodi | `sel_b` — ranged_homing, "Memproduksi antibodi penanda yang mengejar patogen" | ✅ | Peran & proyektil antibodi cocok |
| **Antibodi (Imunoglobulin)** — proyektil homing bentuk Y | Proyektil Sel-B + **mata uang `antibodi`** (pickup + currency) | ✅ | Dipakai ganda: proyektil in-run & mata uang permanen — sesuai semangat dokumen |
| **Sel NK** — `area_burst`, bonus vs musuh menyamar | `sel_nk` — **melee_swipe** "Tebasan toksik… jangkauan sempit" | 🟡 | Nama ✅; pola serang beda (dokumen: burst area). Musuh "menyamar" belum ada sehingga bonusnya pun belum. Rekomendasi: pertahankan tebasan untuk anak-anak, tambah efek ledakan area kecil saat jurus — opsional |
| **Eosinofil** — `melee_bonus_vs_parasite` | `eosinofil` — ranged_homing, "Spesialis anti-parasit" | 🟡 | Nama & peran ✅; **bonus damage vs parasit baru teks rasa, belum ada di kode** (`js/entities/ally.js`, `js/core/game.js` tidak punya pengali anti-parasit) — mudah ditambahkan |
| **Sel Dendritik** — `passive_reveal` scout | — | ❌ | Belum ada |
| **Sel Memori** — scaling vs musuh yang pernah dikalahkan | — | ❌ | Belum ada |
| **Trombosit** — `passive_shield_regen` penyembuh | — | ❌ | Belum ada |

**Unlocks terikat statistik** (totalKills, bestWave, bossKills di `data/heroes.json`) sudah selaras dengan prinsip "konten baru tidak terbuka di awal".

---

## 3. Musuh/Patogen (Enemy Units)

| Dokumen | Di game | Status | Catatan |
|---|---|---|---|
| **Virus Dasar** — bola berduri, `chase_direct` | `virus` — **`splitOnDeath`**, "Virus berduri yang memecah diri jadi 2 virion" | 🟡 | Perilaku game virus = **persis dokumen "Virus Replikasi"** (pecah saat mati). Rekomendasi: nama tampil `virus` → **"Virus Replikasi"** |
| **Virus Replikasi** — pecah jadi 2+ virus dasar | hasil pecahan = `virion` "Partikel virus kecil… cepat dan rapuh" (tier kecil) | 🟡 | "Virion" adalah istilah asli (partikel virus bebas) dan sudah ✅ biologis. Pilihan: pertahankan **"Virion"** atau ikuti dokumen → **"Virus Dasar"** |
| **Bakteri Gram Negatif** — lapisan luar, `armored_layer` | `bakteri` — generik, "Patogen dasar pengejar" (HP 20, fodder wave awal) | 🟡/❌ | Belum ada varian berlapis. Bakteri generik berguna sebagai fodder ramah anak wave 1; varian Gram± jadi konten baru |
| **Bakteri Gram Positif** — HP besar, tanky | — | ❌ | Belum ada |
| **Jamur/Spora** — `area_spread`, `spawn_hazard` | `spora` — "Spora Jamur… lambat tapi sangat tahan tepuk", chase tank | 🟡 | Nama ✅; perilaku beda (dokumen: menyebarkan spora). Adaptasi ramah anak masuk akal; mekanik sebar bisa jadi upgrade musuh di fase lanjut |
| **Parasit** — cacing/protozoa, `drain_on_hit` | `parasit` — chase_weave "bergerak zig-zag" + `protozoa` — chase_weave "bersilia" | 🟡 | Dokumen menggabungkan keduanya ("cacing/protozoa") — game punya dua entitas terpisah yang keduanya valid. **Kuras-resource (drain) belum diimplementasikan** |
| **Sel Abnormal (Kanker)** — stealth menyamar | `sel_kanker` — **BOS** `boss_pattern_a` "Sel mutan raksasa… meledakkan sitotoksin", unlock hero terikat bossKills | 🟡 | Nama beda ("Sel Abnormal" vs "Sel Kanker" — untuk anak, "Sel Kanker" lebih jujur & sudah terpaku di 4 unlock hero). Mekanik stealth belum ada; BOS sudah ada |
| **Toksin** — zona area damage statis | — (racun = meteran sistem tubuh, bukan objek medan) | ❌ | Belum ada; kandidat hazard medan baru |
| **Prion** — `conversion_aura`, late-game | — | ❌ | Belum ada; kandidat musuh late-game unik |
| **Toksin Raksasa (Boss)** — boss milestone tiap 5–10 wave | BOS saat ini = Sel Kanker, `bossWaveEvery: 5` (`data/waves.json`) | 🟡 | Ritme boss tiap 5 wave ✅; identitas boss beda dari dokumen. Rekomendasi: Sel Kanker tetap boss awal (sudah terikat unlock), **Toksin Raksasa jadi boss kedua** di fase konten |

XP per kill sudah ada (`xpPerKill`: bakteri 2, virus 4, virion 1, parasit 3, spora 6, protozoa 6, boss 60).

---

## 4. Nutrisi (Buff Items)

Fungsi sistem berbeda dari dokumen: di dokumen nutrisi = **buff item**; di game `data/nutrients.json` = **orb drop in-run** (XP/heal/currency/magnet). Keduanya bisa berdampingan.

| Dokumen | Di game | Status |
|---|---|---|
| Vitamin C — +Attack speed | `vitamin_c` — **heal 20 HP membrane** seketika | 🟡 nama ✅; efek beda (heal lebih intuitif untuk anak — pilihan desain) |
| Zinc — +Attack damage | — | ❌ |
| Protein — +Max HP | — | ❌ |
| Vitamin D — regen HP perlahan sepanjang run | — | ❌ |
| Omega-3 — kurangi racun sisa (Limfatik) | — (bersih racun saat ini lewat level sistem `limfatik`) | ❌ |
| Probiotik — regen Pencernaan | — | ❌ |
| Serat — percepat energi Pencernaan | — | ❌ |
| Zat Besi — efisiensi Sirkulasi | — | ❌ |
| Air/Hidrasi — regen merata semua sistem | — | ❌ |
| — | `glukosa` (XP dasar), `amino` (XP besar), `antibodi` (mata uang), `sitokin` (magnet nutrisi) | ➕ 4 pickup pendukung loop XP/ekonomi — tidak ada di dokumen, tidak perlu diubah |

**Peluang integrasi:** sistem pemulihan **Suplemen** di `data/body-systems.json` (`suplemenCost: 250`) adalah tempat alami untuk 9 nutrisi dokumen sebagai *buff permanen antar-run* — tanpa mengubah loop drop in-run yang sudah seimbang.

---

## 5. Daftar Keputusan yang Dibutuhkan

1. **Nama hero utama** — "Sel T Killer" → **"Sel T Pembunuh"**? (satu string di `data/heroes.json` + tes).
2. **Hasil pecahan virus** — tetap **"Virion"** (istilah asli) atau **"Virus Dasar"** (ikuti dokumen)? Dan apakah induknya berganti tampil menjadi **"Virus Replikasi"**?
3. **9 nutrisi dokumen** — masuk sebagai (a) pickup in-run baru, (b) buff permanen lewat sistem Suplemen, (c) bertahap keduanya, atau (d) ditunda?
4. **Entitas belum ada** — 6 hero (Neutrofil, Sel-T Pembantu, Sel-T DP, Sel Dendritik, Sel Memori, Trombosit) + 5 musuh (Gram+, Gram−, Toksin, Prion, Sel Abnormal stealth, Toksin Raksasa) → jadwalkan sebagai fase konten, atau poles yang ada dulu?
5. **Perilaku berbeda** (Sel NK burst vs tebasan; Spora sebar vs tank; Parasit kuras) — pertahankan versi ramah anak, atau disesuaikan ke dokumen?

## 6. Yang Tidak Perlu Diubah

- Seluruh sistem/organ (6/6 selaras).
- Makrofag, Sel B, Antibodi — nama, peran, dan pola serang persis dokumen.
- Parasit & Protozoa terpisah — valid terhadap "Parasit (cacing/protozoa)".
- 4 pickup glukosa/amino/antibodi/sitokin — fondasi loop XP & ekonomi.
- Ritme boss tiap 5 wave; unlock hero bertingkat via statistik.
