# PETA BENTUK ASLI ORGAN → GEOMETRI ARENA (riset, bukan asumsi)

Status: RISET SELESAI (2026-09-24). Nol kode diubah.
Tuntutan user: bentuk arena harus turun dari anatomi NYATA sisi-dalam organ
(sudut pandang sel imun = endoskopi + histologi), bukan karangan + warna glow.
Dokumen ini menggantikan tebakan bentuk di `ARENA-PROD-MAP.md` §3/§6-S7
dengan spesifikasi berbasis sumber.

## 0. Aturan terjemah (endoskopi → top-down 2D)

Endoskopi = pandangan lorong orang-pertama; game kita top-down. Kaidah tetap:
terowongan → koridor/rantai di peta; penampang (segitiga usus-besar, bulat
usus-halus) → footprint ruang; lipatan/vili yang menonjol ke lumen → dinding
interior/pilar/baffle top-down; kompartemen seri → rantai room + gerbang;
arah alir (darah, kim, udara) → vektor `currentAt`; sfingter/katup anatomi
(pilorus, ileosekal, katup jantung, katup vena) → pintu/segel lockdown.
Anatomi penuh gerbang alami — state lockdown kita dibenarkan anatomi.

## 1. Paru — pohon + tandan anggur + aula tengah (REFINEMENT)

Sumber: bronkiolus terminal → 2–11 duktus alveolar; tiap duktus membuka ke
5–6 kantung, tiap kantung 20–30 alveoli "seperti tandan anggur" dengan atrium
tengah yang kontinu [1](https://bio.libretexts.org/Courses/Lumen_Learning/Biology_for_Majors_II_(Lumen)/22:_Module_19-_The_Respiratory_System/22.04:_Mammalian_Systems);
penampang = sarang-lebah kantung cangkir [foto alveoli].
Top-down: koridor duktus BERCABANG yang berakhir di ruang-tandan; tiap ruang
= aula tengah + 5–8 ceruk cangkir. Primitif: `cluster` (kapsul duktus +
cincin lingkaran kecil). Gameplay: eksplorasi cabang; ceruk = cover/loot/
spawn. `alveoli` kini (1+6) = versi miskin dari ini — naikkan ke pohon.

## 2. Jantung — bilik + jembatan otot + katup bertali (REFINEMENT)

Sumber: trabeculae carneae = rabung/kolom otot tak-beraturan dari permukaan
dalam ventrikel; sebagian rusuk, sebagian JEMBATAN bebas (moderator band),
plus otot papilaris kerucut + chordae tendineae ke katup [2](https://www.kenhub.com/en/library/anatomy/trabeculae-carneae)
[3](https://en.wikipedia.org/wiki/Trabeculae_carneae).
Top-down: ruang bilobed besar, dinding berrabung, 1–2 pilar JEMBATAN
(cover putar), 2 pilar kerucut, dekor tali ke PINTU KATUP.
Gameplay: arena boss terbuka di tengah (ruang pola peluru).

## 3. Hati — HEKSAGON + jeruji radial + tirisan tengah (REWORK, bukan `tri`)

Sumber: lobulus = PRISMA HEKSAGONAL; tali hepatosit memancar dari tengah;
sinusoid di antaranya; darah mengalir sudut → VENA SENTRAL di tengah;
triad portal di sudut [4](https://www.nottingham.ac.uk/helmopen/rlos/biological-sciences/gastrointestinal-system/liver-anatomy/page_three.html)
[5](https://histology.siu.edu/erg/liver.htm).
Top-down: ruang HEKSAGON, 6 dinding radial rendah, TIRISAN TENGAH (arus
menarik ke dalam!), 3 pintu sudut. Primitif baru: `hexdrain`.
`tri` kini untuk hati = SALAH (lobus = bentuk LUAR). `tri` PINDAH ke usus
besar (butir 8) — di sana segitiga = anatomi (3 taeniae).

## 4. Lambung — kantung-J + rabung tebal + dataran antrum (REWORK)

Sumber: rugae = lipatan TEBAL BERLIUK-LIKU, prominen di badan/fundus,
melintang; menipis saat terisi; antrum lebih DATAR [6](https://grokipedia.com/page/Gastric_folds)
[7](https://askfilo.com/user-question-answers-smart-solutions/what-do-the-different-types-of-rugae-ribs-folds-seen-in-egd-3335303639333538);
[foto rugae]: rabung lunak tebal konvergen.
Top-down: ruang-J (`sac`: busur + taper — mesin rantai kapsul), 3–4 dinding
rabung melintang (labirin cover), arena keluar DATAR di antrum.
Gameplay: tempur labirin-rabung; kolam acid di antara rabung. Coil sinus
kini = salah total untuk lambung.

## 5. Pankreas — daun + duktus + tandan acini (REFINEMENT)

Sumber: kelenjar asini = tandan sekresi mengelilingi duktus (berbeda dari
hati yang tali) [5](https://histology.siu.edu/erg/liver.htm).
Top-down: ruang daun memanjang, koridor duktus tengah, ceruk kantung kecil
di kedua sisi (pakai ulang mesin `cluster` paru skala kecil).
Gameplay: lari duktus + bersih-ceruk.

## 6. Ginjal — kacang + switchback tubulus + kerucut piramid (REFINEMENT)

Sumber: nefron = glomerulus (bola) + tubulus berliuk + lengkung-Henle (putar-U);
medula = piramid kerucut berstriasi, ujung papila menetes ke kaliks
(anatomi standar; kueri ginjal tertelan hasil hati — validasi gambar susulan).
Top-down: tiap kacang berisi koridor SWITCHBACK-S (dinding-S), 2–3 ceruk
kerucut, tirisan ujung. `pair` kini benar sebagai bungkus; isi perlu tubulus.
Gameplay: gauntlet switchback.

## 7. Usus halus — koil + HUTAN VILI + lipatan cincin (REFINEMENT)

Sumber: vili = proyeksi JARI rapat ke dalam lumen [foto vili: hutan jari
dengan mikroba di antaranya]; lipatan sirkular Kerckring = baffle cincin.
Top-down: jalur koil DIPERTAHANKAN (makro benar) + dinding dilapisi GIGI VILI
(pilar rapat = cover/maze) + 2–3 baffle cincin (gerbang parsial).
Gameplay: lari hutan berliuk; zona mucus. Dinding halus kini = salah.

## 8. Usus besar — RANTAI SEGITIGA + gerbang sabit + ceruk rahasia (REWORK)

Sumber: dari dalam = terowongan licin; haustra = lipatan SABIT yang membagi
parsial tabung jadi kompartemen (tampilan scalloped); penampang segitiga
(3 taeniae); divertikula = kantung gelap samping [8](https://scienceinsights.org/what-does-a-colon-look-like-structure-and-sections/)
[9](https://yourhealthmagazine.net/article/gastroenterology/what-a-healthy-colon-looks-like-during-colonoscopy/);
[foto kolon]: lipatan puncak segitiga tegas.
Top-down: RANTAI 3–4 ruang SEGITIGA (`tri` warisan hati!) + baffle sabit
parsial + 2–3 ceruk divertikula samping = RUANG RAHASIA alami.
Primitif: `haustra`. Gameplay: lockdown kompartemen seri (alami!),
ceruk rahasia. Coil sinus kini = salah; `beads` di PROD-MAP §4 DIBATALKAN,
diganti ini (manik = bentuk LUAR, bukan ruang-dalam).

## 9. Kapiler/darah — pembuluh + katup + alir (PERTAHANKAN + katup)

Vena berkatup flap; arteri berdenyut. Top-down: koridor vessel + gerbang
katup (dorong semi-searah) + START/GOAL. `vessel` dipertahankan.

## 10. Limfe/saraf — SUDAH BENAR arahnya

Nodus limfe = kacang berisi bola folikel + sinus → `nodes` ✓.
Akson = kabel + manik mielin + terminal → `axon` ✓. Pertahankan.

## 11. Pelajaran Pathogenic yang DULU TERLEWAT (bentuk gameplay, bukan warna)

Sumber: [10](https://en.wikipedia.org/wiki/Pathogenic_(video_game))
[11](https://pathogenic.online/biomes/) [12](https://kyusaimedia.com/gaming/pathogenic-review)
- P1: TIAP ORGAN = TOPOLOGI MAKRO BERBEDA (usus = garis lurus + cabang;
  ukuran ruang bervariasi = perbedaan gameplay). → Graf dunia kita harus
  mempertajam peran topologi per organ, bukan graf blob seragam.
- P2: TIPE RUANG BERSAMA lintas biome (combat, reward, shop, paywall,
  boss gate, secret) + hazard khas per organ (acid lambung, vent paru,
  pulse jantung). → Room kita butuh PERAN tipe; junction = pembawa tipe
  (ceruk cache, gerbang). Validasi silang: peta hazard D2 kita cocok
  (acid lambung ✓).
- P3: LOCKDOWN saat masuk (jalan pulang diblokir sampai bersih) — SAMA
  dengan state machine kita → arsitektur tervalidasi, tinggal kontras beat.
- P4: Pindah seksi via struktur kapiler → koridor + mulut gerbang kita ✓.
- P5: Secret breakable + cabang elite → ceruk divertikula + organ off-route
  kita sudah mendukung; butuh wiring desain (D1 PROD-MAP).
- P6: Boss gate per organ + plasmid = pacing per organ → tiap organ butuh
  ruang gerbang boss (ruang terbesar organ itu).

## 12. Inventaris primitif SDF (semua union, semua data-driven)

Lingkaran blob; rantai kapsul (coil/sac); ceruk cangkir (lingkaran kecil);
dinding rabung (kapsul TEBAL sebagai rintangan = `max`); baffle parsial
(cakram gerbang); ruang poligon (heksagon/segitiga = 3–6 dinding kapsul);
tirisan (titik `currentAt` + visual); jembatan/kerucut (pilar).
Tak satu pun butuh cabang hot-path baru: dinding = pilar memanjang,
ruang poligon = komposisi yang sudah ada.

## 13. Urutan bangun revisi (menggantikan S7 PROD-MAP)

- S7a: `sac` lambung + rabung + antrum datar.
- S7b: `haustra` usus-besar (rantai segitiga + baffle sabit + ceruk).
- S7c: `hexdrain` hati (heksagon + radial + tirisan).
- S7d: `cluster` paru (duktus cabang + tandan) + vili usus-halus +
      switchback ginjal + jembatan/katup jantung + duktus pankreas.
- Baru S8–S13 PROD-MAP jalan (hue S6 boleh paralel kapan pun).
