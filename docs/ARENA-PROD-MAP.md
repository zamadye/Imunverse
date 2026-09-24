# PETA ARENA LAYAK PRODUCTION — dari `ARENA_ZOOM_OUT_REFERENCE_.png`

Status: NALAR + PEMETAAN (2026-09-24). **Nol kode diubah untuk dokumen ini.**
Premis user: gambar = WORLD (zoom-out, seluruh tubuh); gameplay = ZOOM-IN
(satu organ memenuhi layar). Semua di bawah diturunkan dari premis itu.

## 1. Bedah referensi (apa yang sebenarnya dituntut gambar)

- SATU rongga tubuh kontinu, 8 organ sebagai ruang khas: PARU (pink,
  pohon bronki + alveoli), JANTUNG (merah glossy bilobed), HATI (coklat-
  merah lobus halus), LAMBUNG (oranye, kantung-J + lipatan rugae),
  PANKREAS (kuning-tan daun berbenjol), GINJAL (ungu, kacang + piramid),
  USUS HALUS (pink, massa koil), USUS BESAR (magenta, BINGKAI manik-manik
  haustra — bukan koil sinus!).
- Koridor = pembuluh: dinding arteri merah + vena biru; SATU sungai rute
  cyan bercahaya dari START (portal panah BIRU, bawah) ke GOAL (portal
  panah EMAS, kanan-atas). Portal = panah berarah, besar, glow berat.
- Label = chip (pil gelap + ikon + NAMA KAPITAL). Patogen = titik-titik
  kecil berwarna TERSERAK di dinding/koridor (spawn dari pori).
- Palet: tiap organ punya KELUARGA HUE sendiri, disatukan jaringan vaskular
  merah. BUKAN satu keluarga merah.

## 2. Fakta baik: geografi data SUDAH benar (verifikasi, bukan opini)

| Referensi | Data (`lumen-labyrinth.json`) | Status |
|---|---|---|
| START bawah-tengah | kapiler (640,1560) bawah-tengah | ✓ |
| Usus kiri+kanan bawah | usus_halus (400,1240), usus_besar (1060,1360) | ✓ |
| Ginjal kanan-bawah | ginjal (900,1000) | ✓ |
| Pankreas tengah | pankreas (620,890) | ✓ |
| Hati kiri-tengah | hati (330,760) | ✓ |
| Lambung kanan-tengah | lambung (1020,620) | ✓ |
| Paru kiri-atas | paru (430,240) | ✓ |
| Jantung tengah-atas | jantung (800,180) | ✓ |
| GOAL kanan-atas | goal (1090,140) | ✓ |

Node ekstra (limfe, saraf, aliran_darah, 6 junction) tak ada di referensi
tapi tak bertentangan — dianggap region kecil di antara organ.
Route kini: kapiler>j1>j2>ginjal>j4>lambung>j6>jantung>goal — HANYA sisi
kanan+atas. Organ kiri (usus_halus, hati, pankreas, paru) = cabang.
→ Keputusan D1 (user): route = jalur cepat ATAU pemain wajib kunjungi
semua 8 organ? Sungai cyan referensi melewati semuanya.

## 3. Kesenjangan jujur (referensi vs V2 kini)

| Aspek | Referensi | V2 kini | Gap |
|---|---|---|---|
| Hue per organ | 8 keluarga hue | 1 keluarga merah (audit: heart↔lung 2.4) | BESAR — data `pal` |
| Lambung | kantung-J | coil sinus ✗ salah anatomi | SEDANG — butuh shape `sac` |
| Usus besar | bingkai manik haustra | coil sinus ✗ salah anatomi | SEDANG — butuh shape `beads` |
| Koridor | arteri merah + vena biru + sungai rute cyan | seragam | SEDANG — tint per-edge + overlay route |
| Portal | panah berarah besar + glow | cincin + label | KECIL — tambah panah + skala |
| Label | chip pil + ikon | teks polos | KECIL — chip renderer (ikon = art) |
| Tekstur zoom-in | bronki, rugae, haustra, piramid | 6 motif generik (rugae/nodul/cobble cocok, sisanya kurang) | SEDANG — motif per organ + LOD |
| Makro (peta) | tubuh terbaca + sungai + chip | blob gelap bertumpuk, label terpotong | BESAR — rebuild render makro |
| Hazard | tak ditunjukkan (desain bebas) | se-room (menyesatkan), hero saja | SEDANG — radius kolam + ALL |
| Beat state | n/a (gambar statis) | swarm≈purified≈open | SEDANG — kontras stills |
| Musik/patogen | titik patogen di peta | tak ada musik; patogen = placeholder | LUAR arena (agen lain) |

## 4. Wawasan arsitektur (agar tak tambal-sulam)

1. `sac` + `beads` = MESIN SAMA dengan coil (rantai kapsul `{x0,y0,x1,y1,w}`
   + profil radius). sac = jalur busur + taper; beads = jalur serpentine +
   radius sinusoidal. SDF+render tetap satu sumber, nol cabang hot-path.
2. Motif per organ = tabel `organ→motif`, bukan if/else (data-driven).
3. LOD zoom: tekstur mikro (benjol/lipatan) hanya digambar saat zoom-in
   gameplay; makro cukup siluet+fill+chip (hemat fill-rate HP).
4. Makro = renderer KEDUA yang memakai painter shape yang sama pada detail
   rendah + sungai route + chip + titik patogen + marker pemain. Lokasi
   renderer makro kini (di luar `drawArena2D`) = item investigasi ±30 mnt.
5. Batas jujur: referensi = lukisan painterly; Canvas 2D prosedural menutup
   ±70% (siluet+hue+tekstur-strokes+glow) pada 60fps. 30% terakhir butuh
   art pra-render + budget memori (keputusan art pipeline, bukan kode).

## 5. Definisi "layak production" (checklist vonis)

- [ ] MAKRO: peta terbaca sebagai tubuh referensi (8 organ, hue, sungai,
      chip, START/GOAL, titik patogen) dalam 3 detik.
- [ ] MIKRO: tiap interior organ zoom-in khas (hue+tekstur+shape), pintu
      terbaca, hazardfair (radius kolam, telegraf jelas).
- [ ] SISTEM: traversal audit hijau, segel benar, beat state beda di stills,
      kamera zoom-per-room, LOD.
- [ ] VERIFIKASI: audit hijau termasuk metrik warna, nol error, 60fps di HP
      mid-range beneran, branch ter-deploy (user masih buka `main`!).

## 6. Urutan slice (peta kerja, belum dieksekusi)

- S6: keluarga hue per organ (DATA `pal`) → audit warna hijau. Risiko:
      V1 ikut berubah (baca JSON sama) — terima atau V2-override (putuskan).
- S7: shape `sac` (lambung) + `beads` (usus_besar) via rantai kapsul.
- S8: identitas koridor (tint arteri/vena per-edge + sungai route) + chip label.
- S9: motif per organ (bronki, haustra, piramid ginjal) + LOD zoom.
- S10: hazard radius-kolam + telegraf + hook ALL-entity (butuh agen combat).
- S11: rebuild render makro menuju referensi.
- S12: kamera zoom-per-room + banner masuk organ.
- S13: uji HP 60fps + audit prod final + deploy main.

## 7. Keputusan user (D1–D4, jawab sebelum S6 jalan)

- D1: route = jalur cepat (cabang opsional) atau wajib semua 8 organ?
- D2: hazard per organ (usulan: lambung acid, usus mucus, hati bile,
      ginjal toxin, paru spora, lain none) — setuju/ubah?
- D3: ikon chip organ — huruf sementara (gratis) atau tunggu art?
- D4: makro prosedural (±70% mirip) cukup, atau mau backdrop lukisan +
      overlay live (butuh art + memori)?
