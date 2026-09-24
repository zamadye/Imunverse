# AUDIT PRODUCTION ARENA V2 — 2026-09-24

**Pertanyaan user:** sebelum bilang "selesai", cek dulu — layak production?
**Metode:** `node tools/audit-arena-prod.mjs` (BFS konektivitas via SDF,
clearance hero, segel, hazard, jarak warna frame) + full snap suite dengan
scan SEMUA error + bedah 8 frame dengan mata kritis (bukan 1-2).
**Vonis: BELUM LAYAK.** Geometri/traversal solid; identitas, hazard-vs-musuh,
beat state, art, dan perf device belum.

## LULUS (terbukti di sandbox)

| # | Klaim | Bukti |
|---|---|---|
| 1 | 19/19 room terjangkau hero jalan-kaki | BFS grid 80×113 via SDF, PASS |
| 2 | Jalur START→GOAL ada + clearance | 516 waypoint, min 16px (hero r15), PASS |
| 3 | Segel lockdown menutup koridor | seals=1 utk 1 pintu kapiler, PASS |
| 4 | Nol error JS seluruh suite | scan log penuh: 0 error/NaN, P0_GUARD=PASS |
| 5 | Bentuk organ khas (kaki shape 3-detik) | 13 room berbentuk, terverifikasi visual |
| 6 | Portal START+GOAL tampil | snap-01 + snap-09 |
| 7 | V2 default browser fresh (jalur kode) | harness tanpa flag = V2 |
| 8 | Render tanpa shadowBlur | grep = 0 (dosa perf mobile utama nihil) |

Perbaikan dari temuan audit ini (sudah masuk, bukan janji):
coil selaras-fasa (pusat selalu clearance penuh) + tabung 46→50 +
pilar usus digeser 5.6px → audit model hijau penuh kecuali warna.

## GAGAL / GAP (jujur, dengan pemilik)

| # | Temuan | Bukti | Pemilik |
|---|---|---|---|
| F1 | **Warna antar zona nyaris identik.** heart↔lung jarak RGB 2.4 (ambang 24); SEMUA pasangan <24. Akar: `pal.deep` di DATA nyaris sama (jantung 64,6,12 vs paru 58,10,20). Kaki "color" 3-detik LEMAH — pembeda kini hanya shape+label | matriks 6 pasangan, audit FAIL | ARENA (retune palet data — Gomez V1 baca JSON sama) |
| F2 | **Musik zona TIDAK ADA.** `audio.json` punya `tracks` tapi nol kode mengonsumsinya; AudioSystem hanya SFX. Kaki "audio" 3-detik NOL | grep pemanggil = kosong | AUDIO agent + wiring journey |
| F3 | **Hazard hanya melukai hero; musuh imun.** `game.js:737` hanya terapkan ke player. Constraint "hazard damage ALL" GAGAL | baca kode | COMBAT/gameplay (arena sudah sediakan `hazardAt`) |
| F4 | **Efek hazard SE-ROOM, visual hanya kolam.** Masuk room = kena full meski jauh dari kolam. Menyesatkan | `hazardAt` = per-room | ARENA (kecilkan efek ke radius kolam) |
| F5 | **Beat state lemah.** swarm≈purified≈open nyaris identik di stills (beda hanya teks radar + cincin samar). Shockwave 1-shot tak tertangkap snap | 3 frame berdampingan | ARENA (perkuat segel/vignette/sorot pintu) |
| F6 | **60fps device TAK TERBUKTI.** Estimasi statis ±700 op canvas/frame + ±10 gradien — plausibel tapi bukan bukti. Sandbox tanpa GPU | hitung statis | BUTUH tes HP beneran |
| F7 | **186 aset gambar hilang** (hero/musuh = blob placeholder di frame arena) | ASSET-MAP.md | ART pipeline |
| F8 | Overlay landmark wireframe legacy ("Alveolar cluster") masih melayang di atas room V2 + teks combat bertumpuk di frame | snap-08-lung | SHARED (game.js overlay / combat) |

## Catatan jujur

- Ambang warna "24" bikinan sendiri — kasar, tapi heart↔lung 2.4 gagal di
  ambang berapa pun yang waras. Mata manusia tetap lulus via SHAPE+label.
- `run.zone` kosong (`z=?`) di semua log zona — propagasi state zona
  mencurigakan; relevan untuk wiring musik nanti (bukan scope arena).
- Frame swarm menunjukkan "Patogen 0/8" tanpa musuh terlihat — ranah
  spawner/combat, dicatat bukan didiagnosis.

## Syarat production (checklist)

- [ ] F1: retune palet per organ (data) → audit warna hijau
- [ ] F4+F5: hazard se-radius-kolam + beat state kontras (stills beda jelas)
- [ ] F3+F2+F8: diselesaikan agen pemilik (bukan arena)
- [ ] F6: uji 60fps di HP Android mid-range beneran
- [ ] F7: pipeline art atau keputusan full-vektor resmi
- [ ] Deploy: branch arena → `main` (user masih buka main yang kosong)
