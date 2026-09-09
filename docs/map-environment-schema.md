# Skema Lingkungan Map — data-driven per-map (MAP AGENT)

**Pemilik:** MAP agent (scope "MAP" = arena + lingkungan; nama scope dibedakan dari nama branch) ·
**Kode:** `js/render/background.js` · **Data:** `data/arenas.json` (`schemaVersion: 6`)
**Status:** berlaku — menambah map baru = tambah 1 entri JSON, tanpa sentuh kode render.

**Prinsip visual:** seluruh layar = permukaan organ TANPA BATAS. Tak ada tambalan
lantai, ring, atau dinding terpisah — pemain menjelajahi interior organ yang hidup.

## 1. Struktur entri map

```jsonc
{
  "id": "lambung", "name": "Lambung Asam", "thumb": "assets/sprites/arena_lambung.png",
  "organ": { "name": "Lambung", "system": "Saluran Cerna", "condition": "…" },
  "unlock": { "type": "totalKills", "value": 150 },
  "bonus":  { "desc": "…", "nutrientMult": 1.15, "partMult": 1.0, "speedMult": 1.0, "magnetMult": 1.0 },
  "palette": {
    "hex": "#…",                                  // warna dasar jaringan (fullscreen)
    "vignette": "rgba(…)",                        // vignette layar
    "props": ["prop_asam.png", "prop_weed.png"],  // siluet melayang dalam fluida
    "cornerWeed": "assets/sprites/…",             // dekorasi sudut kiri-bawah
    "cornerReef": "assets/sprites/…",             // dekorasi sudut kanan-bawah
    "ground": { "shade": "120,60,45",             // bayangan jaringan
      "features": [                               // isi anatomi (lihat §2)
        { "type": "fold", "color": "…", "spacing": 420, "density": 0.8,
          "width": 30, "len": 750, "wave": 90, "angle": 0.4 },
        { "type": "chunk", "colors": ["…"], "spacing": 260, "density": 0.55,
          "size": 30, "var": 18, "bob": 3 }
      ] },
    "ambient": { "density": 0.6, "spacing": 230, "size": 24, "drift": 16,
                 "opacity": 0.15, "parallax": 0.08,
                 "tint": "255,225,190", "shade": "150,70,45" },
    "pulse":   { "bpm": 76, "strength": 1.1, "glowAlpha": 0.055 },
    "bubbles": { "c1": "rgba(…)", "c2": "rgba(…)" },   // tint 2 lapis gelembung
    "tint": { "prop": "#…", "corner": "#…" },      // tint sprite properti & dekorasi sudut
    "element": { "type": "acid", "color": "215,230,120", "color2": "150,180,70",
                 "density": 0.55, "spacing": 260, "size": 16, "speed": 26,
                 "alpha": 0.2, "parallax": 0.3 }
  }
}
```

**Backward compatible:** `ground`/`ambient`/`pulse`/`element`/`bubbles`/`tint`/
`cornerWeed`/`cornerReef`/`organ` semuanya opsional — kode memakai default bila absen.

## 2. Lima map: anatomi + isi tanah

| Map | Dasar jaringan | Isi anatomi (`ground.features`) | Denyut |
|---|---|---|---|
| Saluran Limfe | hijau pucat jernih | nodul (chunk) · limfosit (flowcell) · kolam jernih (pool) · gundukan (fold) · vili · kabut (mist) · kerlip (motes) | 60 bpm |
| Lambung Asam | persik mukosa | **rugae merambat** (fold+crawl) · **makanan** (chunk) · **kolam asam didih + telegraf bahaya** (pool) · kimus (flowcell) · lendir (thread) · vili · kabut asam (mist) · kerlip (motes) | 76 bpm |
| Paru Kristal | rose-milk | **bronkiolus** (thread) · **alveoli** (sacs) · kapiler merah & biru · debu udara (flowcell) · kabut napas (mist) · kerlip (motes) | 68 bpm |
| Sumbu Saraf | pasir keemasan | **berkas akson + sinyal berjalan** (fold+pulse) · mielin & badan sel (chunk) · **sinapsis** (thread flicker) · serabut · kabut (mist) · ion kerlip (motes) | 88 bpm |
| Bilik Jantung | flesh-rose | **serat otot merambat + denyut berjalan** (fold+crawl+pulse) · **darah deras** (flowcell) · kolam darah + telegraf bahaya (pool) · korda (thread) · kabut (mist) · kerlip plasma (motes) | 72 bpm, paling kuat |

### 2.1 Referensi tipe fitur tanah

Semua fitur world-anchored (hash-grid dalam kotak pandang kamera, terproyeksi
pseudo-3D, ter-cull di luar layar). Penempatan deterministik — stabil tiap frame.
Kotak kandidat dihitung KONSERVATIF dari frustum aktual (#12): skala minimum
global `MIN·zoom·punch` + margin culling + jangkauan dunia per tipe — tak ada
fitur visible yang terlewat saat menjelajah (bukti: `scripts/test-map-culling.mjs`).

| Tipe | Wujud | Kunci utama |
|---|---|---|
| `blotch` | noda lembut jaringan | `color`/`color2`, `size`, `alpha`, `spacing`, `density` |
| `fold` | lipatan panjang berombak + sorot punggung | `color`/`color2`, `width`, `len`, `wave`, `angle` |
| `chunk` | gumpalan 3-lobus + garis tepi + sorot (+ naik-turun) | `colors[]`, `line`, `size`, `var`, `bob` |
| `pool` | kolam berkilau + gelembung mikro mengorbit | `color`/`color2`, `size`, `bubbles` |
| `sacs` | gugus 6 kantung tembus pandang bernapas | `color`/`color2`, `size`, `n` |
| `thread` | serat melengkung + inti (+ kedip listrik) | `color`/`color2`, `len`, `width`, `angle`, `flicker` |
| `villi` | 5 jari vili berayun | `color`/`color2`, `size`, `alpha` |
| `mist` | 2 kabut tembus pandang beriras | `color`/`color2`, `size`, `alpha` |
| `motes` | 6 titik kerlip (pengisi murah) | `color`/`color2`, `size`, `dot`, `alpha` |
| `flowcell` | medan sel hanyut searah + pudar di tepi | `color`, `count`, `size`, `dx`, `dy`, `speed`, `span`, `alpha` |

Anggaran: tiap map ±150–250 shape tanah/frame, tanpa `shadowBlur`.

Parameter gerak (semua opsional): `fold.crawl` (rambat gelombang/dtk) ·
`fold.pulse` + `fold.pulseSpeed` (sinyal berjalan, putaran/dtk) ·
`thread.sway` (ayunan px) · `thread.flicker` (kedip) · `chunk.spin` (putaran) ·
`chunk.bob` (naik-turun) · `pool.boil` (didih cepat) · `pool.danger`
(telegraf bahaya: tepi merah berdenyut — VISUAL SAJA; mekanik damage =
follow-up Combat agent, bukan scope MAP).

## 3. Blok `element` — materi fluida khas tiap organ

Melayang DI ATAS jaringan (parallax ±0.3), hash-grid deterministik, ≤ ~12 sel.

| Kunci | Arti | Rentang aman |
|---|---|---|
| `type` | `flow` (limfe) · `acid` (lambung) · `breath` (paru) · `spark` (saraf) · `pulsering` (jantung) · `null` = mati | — |
| `color` / `color2` | warna utama & sekunder, format `"r,g,b"` | senada map |
| `density` / `spacing` / `size` / `speed` / `alpha` / `parallax` / `breathSec` | lihat §2.1 + data | alpha ≤ 0.25 |

### Tint sprite properti & dekorasi

`tint = { "prop": "#…", "corner": "#…" }` mewarnai sprite PNG (properti jauh
+ dekorasi sudut) mengikuti warna organ via cache tint `sprite-loader`
(prarender sekali per map — tanpa biaya per-frame). Absen = sprite original.
Catatan: `prop_asam`/`prop_kristal`/`prop_dots` wajib di `EXTRA_PRELOAD`
(`sprite-loader.js`) agar tak jatuh ke placeholder dev.

## 4. Blok `ambient` — partikel latar prosedural

Terpisah dari partikel combat (`effects-system.js`): ≤ ~25 lingkaran/frame,
tanpa `shadowBlur`. Dua populasi: **sel darah** (berbingkai) dan **debu**.

| Kunci | Arti | Rentang aman |
|---|---|---|
| `density` / `spacing` / `size` / `drift` / `opacity` / `parallax` / `tint` / `shade` | lihat data | opacity ≤ 0.2 |

## 5. Blok `pulse` — denyut jantung ("Pulse Cell")

`heartbeat(t, bpm)` (`js/render/background.js`, diekspor) pola **lub-dub**.

| Kunci | Arti | Rentang aman |
|---|---|---|
| `bpm` / `strength` / `glowAlpha` | detak/mnt · pengali · alpha napas | 60–90 · 0.8–1.3 · ≤ 0.07 |

Konsumen: kilau napas fullscreen · bercak tanah · sel latar · motes · elemen fluida.

## 6. Tumpukan lapisan (belakang → depan)

| # | Lapisan | Fungsi | Ruang |
|---|---|---|---|
| 0 | dasar jaringan organ (fullscreen) | `drawBackground` | menempel layar |
| 1 | isi anatomi tanah (§2) | `drawArena3D` | dunia (via proyeksi, ikut kamera) |
| 2 | ambient + sel + properti + elemen + gelembung | `drawBackground` | parallax layar |
| 3 | dekorasi sudut + napas + vignette | `drawBackground` | menempel layar |
| 4 | entitas (di luar scope MAP) | `game.js` | dunia |

## 7. Batas scope antar-agen (jangan langgar)

- **Character Agent:** sprite hero/musuh — jangan sentuh.
- **UI/UX Agent:** `styles/`, struktur `index.html`, `cine-banner.js`, layar pilih map
  (`arena-screen.js` — MAP agent hanya menyuplai data + thumb).
- **Combat/FX:** `effects-system.js` milik sistem lain — lapisan map terpisah.
- **Core:** `game.js`/`camera.js` hanya DIBACA (proyektor dipakai apa adanya).
- Aturan MAP agent: **setiap pekerjaan wajib screenshot** (`scripts/e2e-map-showcase.mjs`
  → `shots/review/map-*.png`) sebagai bukti visual.
