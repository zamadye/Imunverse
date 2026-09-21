# Vision Snapshot — arah UI/UX baru (video referensi)

**Diambil ulang:** 2026-09-21 · Chromium headless 960×540 (swiftshader) · `?dev=1`
**Pass ini menyertakan ZOOM-OUT kamera** (`shape.cameraZoom` 0,84–0,95 → 0,62–0,70)
sesuai referensi owner `ARENA_ZOOM_OUT_REFERENCE_.png` (commit `8acc8c5`): arena harus
terbaca sebagai STRUKTUR ORGAN yang utuh (siluet chamber + cincin scute + jaringan sisik),
bukan lorong rapat. Guard kamera diperbarui di `tools/verify-world.mjs` (rentang 0,55–0,75).
**Cara regenerasi:** lihat header `scripts/e2e-vision-snapshot.mjs`.
Ringkasnya:

```bash
npm i -D --no-save playwright-core @sparticuz/chromium
# lib NSS/NSPR bawaan @sparticuz/chromium (sekali saja):
node -e "require('zlib');const z=require('zlib'),f=require('fs');f.writeFileSync('/tmp/al2023.tar',z.brotliDecompressSync(f.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')))"
mkdir -p /tmp/al2023 && tar -xf /tmp/al2023.tar -C /tmp/al2023

BASE_URL=http://127.0.0.1:8000/ OUT_DIR=docs/vision-snapshot TAG=after node scripts/e2e-vision-snapshot.mjs
```

## Isi

| Berkas | Isi |
|---|---|
| `compare-*.jpg` | **BEFORE (kiri) vs AFTER (kanan)** per keadaan. BEFORE = commit `d3242b6` (pasca-reset aset, pra-pass arah video); AFTER = HEAD |
| `after-*.jpg` | Potret AFTER saja, untuk rujukan cepat arah baru |

| Keadaan | Yang harus terlihat di sisi AFTER |
|---|---|
| `dashboard` | layar meta pasca-reset |
| `heart-wide` | interior **amber backlit**, massa organ berlobus, deret **scute merah** + jaringan sisik biru di dinding, **kelenjar emas**, chordae pucat; HUD tinggal **4 anchor** |
| `lung-wide` / `capillary-wide` / `lymphatic-wide` | vocabulary dinding yang sama dengan kode warna jaringan per organ (teal / crimson / violet) |
| `hero-crop-4x` | protagonis bio-form: **core menyala** + kaki teal ramping menjulur, tanpa wajah |
| `hud-anchors` | strip kiri: **vial/lentera charge** (atas) + **glif sayap + bar 6 segmen + counter orb** (bawah) |

## Catatan

- Snapshot lama pilot pixel-art / "Last Asylum" (`docs/pilot-jantung/`, 23 PNG) dan
  `tools/mutation-art/CONTACT-SHEET.png` **sudah dihapus** pada pass UI-RESET ini karena
  mengarahkan ke arah visual yang dibatalkan owner lewat video referensi.
- Musuh masih tampil sebagai placeholder ber-inisial (mode dev) karena seluruh sprite
  sengaja dicabut pada reset aset; itu bukan regresi.
- Pair before/after disimpan sebagai JPG (~1,1 MB total) supaya repo tetap ramping.
