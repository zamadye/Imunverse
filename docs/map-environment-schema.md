# Skema Lingkungan Map — data-driven per-map (MAP AGENT)

**Pemilik:** MAP agent (scope "MAP" = arena + lingkungan; nama scope dibedakan dari nama branch) ·
**Kode:** `js/render/background.js` · **Data:** `data/arenas.json` (`schemaVersion: 3`)
**Status:** berlaku — menambah map baru = tambah 1 entri JSON, tanpa sentuh kode render.

## 1. Struktur entri map

```jsonc
{
  "id": "jantung", "name": "Bilik Jantung", "thumb": "assets/sprites/arena_jantung.png",
  "organ": { "name": "Jantung", "system": "Sistem Sirkulasi", "condition": "…" },
  "unlock": { "type": "bestWave", "value": 12 },
  "bonus":  { "desc": "…", "nutrientMult": 1.1, "partMult": 1.0, "speedMult": 1.05, "magnetMult": 1.0 },
  "palette": {
    "top": "#…", "mid": "#…", "bot": "#…",       // gradien dinding organ (atas→bawah)
    "hex": "#…",                                  // lantai hexagon
    "hexEdge": "#…",                              // garis napas tepi clearing (denyut mengikuti detak)
    "ground": { "detail": "…", "spotA": "…",        // tint tanah: sel tanah,
                "spotB": "…", "shade": "…" },       //  bercak ×2, bayangan+gradasi
    "vignette": "rgba(…)",                        // vignette layar
    "props": ["prop_cell.png", "prop_dots.png"],  // sprite properti map
    "cornerWeed": "assets/sprites/…",             // dekorasi sudut kiri-bawah
    "cornerReef": "assets/sprites/…",             // dekorasi sudut kanan-bawah
    "ambient": { "density": 0.6, "spacing": 230, "size": 26, "drift": 10,
                 "opacity": 0.17, "parallax": 0.08,
                 "tint": "255,200,190", "shade": "140,40,45" },
    "pulse":   { "bpm": 72, "strength": 1.3, "glowAlpha": 0.06 },
    "bubbles": { "c1": "rgba(…)", "c2": "rgba(…)" },   // tint 2 lapis gelembung
    "element": { "type": "pulsering", "color": "255,150,140", "color2": "255,90,100",
                 "density": 0.4, "spacing": 340, "size": 120, "speed": 90,
                 "alpha": 0.25, "parallax": 0.3 }
  }
}
```

**Backward compatible:** `ambient`/`pulse`/`element`/`bubbles`/`ground`/`hexEdge`/`cornerWeed`/`cornerReef`/`organ`
semuanya opsional — kode memakai default bila kunci absen.

## 2. Lima map: warna anatomi + elemen khas

| Map | Organ | Warna anatomi | Elemen khas (`element.type`) | Denyut |
|---|---|---|---|---|
| Saluran Limfe | Kelenjar Limfe | hijau pucat jernih (getah bening) | `flow` — gumpalan limfe melayang tenang | 60 bpm, lembut |
| Lambung Asam | Lambung | mukosa merah muda + asam kuning-hijau | `acid` — aliran gelembung asam naik | 76 bpm (adukan) |
| Paru Kristal | Paru-paru | spons merah muda | `breath` — siklus napas 4 dtk + sakus alveoli | 68 bpm |
| Sumbu Saraf | Jaringan Saraf | keemasan (serabut saraf) | `spark` — sambaran sinyal listrik | 88 bpm, tegang |
| Bilik Jantung | Jantung | otot merah tua | `pulsering` — gelombang detak mengembang | 72 bpm, **paling kuat** |

## 3. Blok `element` — signature visual tiap organ

Lapisan midground (parallax ±0.3), hash-grid deterministik, ≤ ~12 sel × ≤3 shape,
tanpa `shadowBlur` — tanpa aset baru, murni timer/canvas.

| Kunci | Arti | Rentang aman |
|---|---|---|
| `type` | `flow` (limfe) · `acid` (lambung) · `breath` (paru) · `spark` (saraf) · `pulsering` (jantung) · `null` = mati | — |
| `color` / `color2` | warna utama & sekunder, format `"r,g,b"` | senada gradien map |
| `density` | peluang sel grid aktif (0–1) | 0.3–0.6 |
| `spacing` | jarak grid px | 260–340 |
| `size` | ukuran dasar px (arti per tipe: diameter/cincin/panjang) | lihat data |
| `speed` | kecepatan gerak (arti per tipe: hanyut/naik/kedip/kembang) | lihat data |
| `alpha` | alpha maksimum | ≤ 0.25 (spark ≤ 0.5, sesaat) |
| `parallax` | faktor kamera | 0.25–0.35 |
| `breathSec` | (khusus `breath`) durasi satu siklus napas | 3–5 |

Semua tipe diperkuat denyut global ±20% (`boost`) agar satu ritme dengan §5.

## 4. Blok `ambient` — partikel latar prosedural

Terpisah dari partikel combat (`effects-system.js`): lapisan paling belakang,
grid hash tak berujung, ≤ ~25 lingkaran/frame, tanpa `shadowBlur`.

| Kunci | Arti | Rentang aman |
|---|---|---|
| `density` | peluang sel grid berisi motes (0–1) | 0.3–0.7 |
| `spacing` | jarak grid px | 220–300 |
| `size` | diameter maksimum motes px | 18–30 |
| `drift` | kecepatan hanyut ke atas px/detik | 5–18 |
| `opacity` | alpha maksimum motes | ≤ 0.2 (jaga keterbacaan gameplay!) |
| `parallax` | faktor kamera | 0.05–0.12 |
| `tint` / `shade` | warna sorot & bayangan, format `"r,g,b"` | senada gradien map |

Dua populasi: **sel darah** (berbingkai, ~25%) dan **debu** (titik kecil).

## 5. Blok `pulse` — denyut jantung ("Pulse Cell")

`heartbeat(t, bpm)` (`js/render/background.js`, diekspor) mengembalikan 0–1 pola
**lub-dub**: dua pulsa gaussian per detak (S1 kuat fase 0.12, S2 lemah fase 0.34).

| Kunci | Arti | Rentang aman |
|---|---|---|
| `bpm` | detak per menit | 60–90 |
| `strength` | pengali amplitudo denyut global map | 0.8–1.3 |
| `glowAlpha` | alpha puncak lapisan napas fullscreen | ≤ 0.07 |

Konsumen denyut: kilau napas fullscreen · tepi lantai `hexEdge` · bercak lantai ·
sel latar `prop_cell` · motes ambient · **elemen khas §3** (boost ±20%).

## 6. Tumpukan lapisan (belakang → depan)

| # | Lapisan | Fungsi | Parallax |
|---|---|---|---|
| 0 | gradien dinding organ + vignette | `drawBackground` | menempel layar |
| 1 | ambient prosedural | `drawAmbientLayer` | `ambient.parallax` (≈0.08) |
| 2 | sel `prop_cell` | `drawCellLayer` | 0.14 |
| 3 | properti jauh | `drawReefLayer` | 0.22 |
| 4 | **elemen khas map** (§3) | `drawElementLayer` | `element.parallax` (≈0.3) |
| 5 | properti dekat + 2 lapis gelembung (tint per-map) | `drawReefLayer`/`drawBubbleLayer` | 0.4 / 0.5 / 0.72 |
| 6 | clearing organik + bercak + detail tanah + tepi | `drawArena3D` | dunia (via proyeksi) |
| 7 | dekorasi sudut | `drawCornerDeco` | menempel layar |
| 8 | lapisan napas fullscreen | `drawBackground` | menempel layar |

## 7. Batas scope antar-agen (jangan langgar)

- **Character Agent:** sprite hero/musuh — jangan sentuh.
- **UI/UX Agent:** `styles/`, struktur `index.html`, `cine-banner.js`, layar pilih map
  (`arena-screen.js` — MAP agent hanya menyuplai data + thumb; logika layar milik UI).
- **Combat/FX:** `effects-system.js` milik sistem lain — lapisan map sengaja terpisah.
- Aturan MAP agent: **setiap pekerjaan wajib screenshot** (`scripts/e2e-map-showcase.mjs`
  → `shots/review/map-*.png`) sebagai bukti visual.
