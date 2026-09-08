# Skema Lingkungan Arena — data-driven per-organ (ARENA AGENT)

**Pemilik:** Arena/Environment agent · **Kode:** `js/render/background.js` · **Data:** `data/arenas.json` (`schemaVersion: 2`)
**Status:** berlaku — menambah organ/lokasi baru = tambah 1 entri JSON, tanpa sentuh kode render.

## 1. Struktur entri arena

```jsonc
{
  "id": "limfe", "name": "Saluran Limfe", "thumb": "assets/sprites/arena_limfe.png",
  "organ": { "name": "Kelenjar Limfe", "system": "Sistem Limfatik", "condition": "…" },
  "unlock": { "type": "default", "value": 0 },
  "bonus":  { "desc": "…", "nutrientMult": 1.0, "partMult": 1.0, "speedMult": 1.0, "magnetMult": 1.0 },
  "palette": {
    "top": "#…", "mid": "#…", "bot": "#…",       // gradien latar (atas→bawah)
    "hex": "#…",                                  // lantai hexagon arena
    "hexEdge": "#…",                              // garis tepi lantai (denyut mengikuti detak)
    "vignette": "rgba(…)",                        // vignette layar
    "props": ["prop_reef.png", "prop_weed.png"],  // sprite properti arena
    "cornerWeed": "assets/sprites/…",             // dekorasi sudut kiri-bawah
    "cornerReef": "assets/sprites/…",             // dekorasi sudut kanan-bawah
    "ambient": { "density": 0.55, "spacing": 250, "size": 26, "drift": 9,
                 "opacity": 0.16, "parallax": 0.08,
                 "tint": "255,255,255", "shade": "16,64,58" },
    "pulse":   { "bpm": 64, "strength": 1.0, "glowAlpha": 0.05 }
  }
}
```

**Backward compatible:** `ambient`/`pulse`/`hexEdge`/`cornerWeed`/`cornerReef`/`organ` semuanya opsional — kode
memakai default bila kunci absen, sehingga entri lama (atau mod pemain) tetap jalan.

## 2. Blok `ambient` — partikel latar prosedural

Terpisah dari partikel combat (`effects-system.js`, milik sistem lain): digambar sebagai lapisan
paling belakang (`drawAmbientLayer`), grid hash tak berujung, ≤ ~25 lingkaran/frame, tanpa `shadowBlur`.

| Kunci | Arti | Rentang aman |
|---|---|---|
| `density` | peluang sel grid berisi motes (0–1) | 0.3–0.7 |
| `spacing` | jarak grid px (makin kecil = makin ramai) | 220–300 |
| `size` | diameter maksimum motes px | 18–30 |
| `drift` | kecepatan hanyut ke atas px/detik | 5–18 |
| `opacity` | alpha maksimum motes | ≤ 0.2 (jaga keterbacaan gameplay!) |
| `parallax` | faktor kamera (0 = menempel layar, 1 = menempel dunia) | 0.05–0.12 |
| `tint` | warna sorot motes, format `"r,g,b"` | terang, senada gradien |
| `shade` | warna bayangan motes, format `"r,g,b"` | gelap, senada gradien |

Dua populasi: **sel darah** (lingkaran berbingkai, ~25%) dan **debu** (titik kecil). Keduanya hanyut ke
atas dengan goyangan sinus dan membesar/mencerah mengikuti denyut jantung (lihat §3).

## 3. Blok `pulse` — denyut jantung ("Pulse Cell")

Fungsi `heartbeat(t, bpm)` (`js/render/background.js`, diekspor untuk dipakai sistem lain) mengembalikan
0–1 memakai pola **lub-dub**: dua pulsa gaussian per detak (S1 kuat di fase 0, S2 lemah di fase 0.28) —
bukan sinus generik, sehingga terbaca sebagai jantung, bukan ayunan.

| Kunci | Arti | Rentang aman |
|---|---|---|
| `bpm` | detak per menit | 60–90 |
| `strength` | pengali amplitudo denyut global arena | 0.8–1.2 |
| `glowAlpha` | alpha puncak lapisan napas fullscreen | ≤ 0.07 |

Konsumen denyut (semua diatur `strength`, semua subtle agar tidak mengganggu gameplay):
1. lapisan napas fullscreen — kilau radial pusat layar;
2. tepi lantai hexagon — garis `hexEdge` berdenyut;
3. bercak organik lantai — skala ±15%;
4. motes ambient — skala & alpha;
5. sel latar `prop_cell` — skala ±12%.
6. (siap pakai, belum dipakai) ekspor `heartbeat()` untuk sistem lain — mis. sinkronisasi detak audio
   milik UI/UX agent atau efek serangan milik Combat agent — tanpa duplikasi logika.

## 4. Tumpukan lapisan parallax (sudah ada — TIDAK dibangun ulang)

Audit menemukan dukungan multi-layer parallax sudah jadi & diwariskan; agen ini hanya menjadikannya
data-driven, bukan membangun baru:

| # | Lapisan | Fungsi | Parallax |
|---|---|---|---|
| 0 | gradien + vignette | `drawBackground` | menempel layar |
| 1 | **ambient prosedural** (baru, §2) | `drawAmbientLayer` | `ambient.parallax` (≈0.08) |
| 2 | sel `prop_cell` | `drawCellLayer` | 0.14 |
| 3 | properti reef/weed/asam/kristal | `drawReefLayer` | 0.22 / 0.4 |
| 4 | gelembung | `drawBubbleLayer` | 0.5 (naik) / 0.72 (turun) |
| 5 | lantai hexagon 3D + bercak + tepi | `drawArena3D` | dunia (1.0, via proyeksi) |
| 6 | dekorasi sudut | `drawCornerDeco` | menempel layar |
| 7 | lapisan napas fullscreen (baru, §3) | `drawBackground` | menempel layar |

## 5. Batas scope antar-agen (jangan langgar)

- **Character Agent:** sprite hero/musuh — jangan sentuh. Koordinasi warna: buka issue, bukan edit aset.
- **UI/UX Agent:** `styles/`, struktur `index.html`, `cine-banner.js` (latar dashboard). Bump `?v=` cache-buster
  akibat perubahan arena dikoordinasikan seperti biasa (bukan perubahan kode mereka).
- **Combat/FX:** `effects-system.js` (partikel combat) milik sistem lain — lapisan ambient arena (§2)
  sengaja terpisah dan tidak memakai sistem itu.
