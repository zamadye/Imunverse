# KONTRAK ARENA (revisi final — satu-satunya doc arena yang berlaku)

Menggantikan 5 doc lama yang DIHAPUS (riwayat tersimpan di git):
`ARENA-PROGRESS-ROADMAP`, `ARENA-PROD-MAP`, `ARENA-PROD-AUDIT`,
`ARENA-ANATOMY-MAP`, `ASSET-MAP`.
Berlaku untuk: `js/arena/`, `data/lumen-labyrinth.json`,
`tools/snap-arena.mjs`, `tools/audit-arena-prod.mjs`.
Acuan: `ARENA_ZOOM_OUT_REFERENCE_.png` (makro) + anatomi sisi-dalam organ
(mikro/gameplay). Bentuk = anatomi nyata, BUKAN karangan + glow.

## 1. Dunia & rute (geografi TERVERIFIKASI cocok referensi)

START kapiler bawah-tengah → usus kiri/kanan → ginjal kanan → pankreas
tengah → hati kiri → lambung kanan → paru kiri-atas → jantung tengah-atas
→ GOAL kanan-atas. Route kini hanya sisi kanan+atas (lihat D1).

## 2. Bentuk organ — MENGIKAT (anatomi sisi-dalam → top-down)

| Organ | Struktur nyata | Geometri top-down | Gameplay |
|---|---|---|---|
| paru | pohon bronkiolus → duktus → tandan alveoli + atrium; sarang cangkir | duktus bercabang + ruang-tandan (aula + 5–8 ceruk) | eksplorasi cabang; ceruk = cover/loot/spawn |
| jantung | trabekula + jembatan otot bebas + papilaris + katup bertali | bilobed + dinding rabung + 1–2 jembatan + 2 kerucut + PINTU KATUP | arena boss (tengah terbuka) |
| hati | lobulus HEKSAGON + jeruji radial + vena sentral + triad sudut | ruang HEKSAGON + 6 radial + TIRISAN TENGAH + 3 pintu | risiko-tengah vs tarikan; bile |
| lambung | kantung-J + rugae tebal melintang + antrum datar | `sac` + 3–4 rabung + arena keluar datar | labirin rabung; acid antar-rabung |
| pankreas | daun + duktus + tandan asini | daun + duktus tengah + kantung kecil | lari duktus + bersih-ceruk |
| ginjal | tubulus switchback + piramid kerucut + tirisan papila | kacang + koridor-S + 2–3 kerucut + tirisan | gauntlet switchback |
| usus_halus | tabung koil + HUTAN VILI + lipatan Kerckring | koil + gigi vili + 2–3 baffle cincin | lari hutan; mucus |
| usus_besar | terowongan SEGITIGA + lipatan sabit seri + divertikula | RANTAI 3–4 ruang segitiga + baffle sabit + 2–3 ceruk rahasia | lockdown seri; ceruk = secret |
| kapiler/darah | pembuluh + alir + katup vena | koridor vessel + gerbang katup; START/GOAL | transit + portal |
| limfe/saraf | nodus folikel / akson + mielin | `nodes` / `axon` (tetap) | variasi region |
| goal | ruang emas | `alveoli` + sorot (tetap) | finis |

Primitif SDF (semua union, data-driven, nol cabang hot-path baru): blob,
rantai kapsul, ceruk, rabung (kapsul tebal = rintangan), baffle parsial,
poligon (3–6 dinding kapsul), tirisan (titik arus), jembatan/kerucut (pilar).
Kaidah terjemah: lipatan menonjol → dinding interior; katup/sfingter →
pintu lockdown; arah alir → vektor arus.

## 3. Identitas visual (8 keluarga hue, bukan satu merah)

paru magenta-pink · jantung merah arteri · hati coklat-merah · lambung
oranye · pankreas kuning-tan · ginjal ungu · usus_halus pink muda ·
usus_besar magenta-ungu · kapiler merah-cyan · darah biru vena ·
limfe ungu · saraf kuning · goal emas.
Aturan: jarak RGB antar organ ≥24 (audit); tekstur = motif per organ
(bronki, rugae, haustra, piramid, vili, striasi, nodul); portal = PANAH
berarah (START biru, GOAL emas); label = chip pil gelap + NAMA (ikon =
art, sementara huruf); koridor = dinding arteri/vena + sungai route cyan.

## 4. Sistem (kontrak perilaku)

- Traversal: audit BFS hijau — semua room terjangkau, clearance hero r15.
- Hazard: efek = RADIUS KOLAM (visual = radius efek, jujur); SEMUA entitas.
- Arus jujur searah visual; tirisan menarik masuk.
- Segel = katup anatomi di tiap mulut koridor room aktif saat lockdown.
- Beat state (lockdown/swarm/purified/open) HARUS beda di stills.
- Kamera follow + zoom-per-room; LOD (mikro hanya saat zoom-in).
- Makro: tubuh terbaca ≤3 detik (organ + sungai + chip + portal + patogen).

## 5. Verifikasi production (checklist vonis)

- [ ] `node tools/audit-arena-prod.mjs` hijau penuh (termasuk warna)
- [ ] suite snap nol error (`P0_GUARD=PASS`)
- [ ] 60fps di HP Android mid-range BENARAN
- [ ] V2 default di browser fresh; rollback `?arena=v1`
- [ ] branch ter-deploy (user masih membuka `main` yang kosong!)

## 6. Aset (fakta, bukan scope)

336 referensi: 147 ada (JS+audio+data lengkap), 189 hilang (186 gambar +
2 font + 1 riv). Keputusan butuh: pipeline art ATAU full-prosedural resmi.
Regenerasi: `node tools/map-assets.mjs`. Arena prosedural = imun.

## 7. Batas scope

Arena = world + §4 + hook (`hazardAt`, `currentAt`, `ventPosition`,
`quota`, `zoneId`, `seals`). BUKAN arena: combat, musuh/AI, musik, UI/HUD,
shop/ekonomi, produksi art.

## 8. Keputusan user (jawab sebelum bangun)

- D1: route = jalur cepat (cabang opsional) atau wajib 8 organ?
- D2: hazard (lambung acid, usus mucus, hati bile, ginjal toxin, paru
      spora, lain none) — setuju/ubah?
- D3: ikon chip = huruf sementara atau tunggu art?
- D4: makro prosedural (±70%) cukup atau backdrop lukisan + overlay live?

## 9. Urutan bangun

S6 hue §3 → S7a sac lambung → S7b haustra usus-besar → S7c hexdrain hati →
S7d cluster paru + vili + switchback + jembatan jantung → S8 koridor+chip →
S9 motif+LOD → S10 hazard+beat → S11 makro → S12 kamera → S13 final+deploy.
