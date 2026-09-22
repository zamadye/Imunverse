# ANALISIS BENTUK ARENA PATHOGENIC (referensi owner) — kenapa build lama miss

Sumber: vision-analysis langsung pada screenshot gameplay asli *Pathogenic*
(Aberrant Labs, Godot) yang disimpan di `docs/reference-pathogenic/`:
`s-1.png` (biome paru), `s-3.png` (koridor dinding organ), `s-4.webp`
(chamber jantung), `s-5.jpg` (key art), plus konteks teks dari review
(Ars Technica, lifemeetspixel, nerdschalk) & halaman itch.io/Steam.

## 1. Temuan visual (per gambar)

### s-1.png — paru ("secret room in the lungs")
- Ruang main = **kanal melebar yang berkelok di antara massa jaringan besar**,
  bukan ruangan tertutup simetris. Dinding = lobus jaringan gelap dengan
  **rim fringe pink berbulu** (silia), lengkungan CEKUNG & CEMBUNG bercampur.
- Ada **lubang/pit izolasi** (blob gelap ber-rim glow) sebagai hazard.
- Skala ruang berubah drastis dalam satu layar: sela sempit → kantung lebar.

### s-3.png — koridor dinding organ (liver/usus)
- Arena = **koridor melengkung panjang** yang memeluk dinding organ raksasa:
  kanan = dinding cobblestone sel ber-rim light biru (cembung, berskalop),
  kiri = tepi gelap lembut. Lebar koridor berubah-ubah sepanjang lengkung.
- Minimap kanan-atas: **graf ruangan blob asimetris** dihubungkan connector
  tipis — tidak ada satu pun ruangan yang bulat/simetris.

### s-4.webp — chamber jantung
- Kamar tertutup **bergelombang tak simetris** (rounded-rect organik), dinding
  serat otot merah-biru ber-rim; di DALAMnya ada **3-4 pilar massa gelap
  memanjang melengkung** → ruang main NON-KONVEKS (cover bullet-hell).
- Denyut & flow terlihat dari gradasi aliran oranye di lantai.

### s-5.jpg — key art
- Bahasa visual dinding: **tubulus bersilia meliuk** (biru menyala) melintasi
  permukaan organ berbulu — corroborates fringe/tubule motif dinding.

## 2. Gramatika bentuk arena Pathogenic (inti untuk implementasi)

1. **Bukan lingkaran.** Boundary = kurva tertutup bergelombang dengan
   asimetri frekuensi-rendah kuat (lobus 2–5 harmonik, amplitudo besar) +
   elongasi (ruang panjang/pendek, ориентasi miring).
2. **Pilar internal** (massa gelap memanjang/melengkung) → ruang non-konveks;
   jumlah 0–4 per room; berfungsi sebagai cover & pemecah line-of-sight.
3. **Pinch / kantung**: lebar ruang berubah drastis sepanjang keliling
   (sempit seperti koridor ↔ luas seperti kantung) — didapat dari harmonik
   fase berbeda + pilar di tengah pinch.
4. **Dinding bermotif organ + rim light** (sudah kita punya via normal map &
   Light2D di slice Godot / shader GL).
5. **Variasi antar-biome**: paru = kanal ber-fringe; jantung = chamber
   berpilar; pembuluh = koridor melengkung memeluk dinding.

## 3. Kenapa build kita miss

`BioChamber` lama: `base = R * (1 + amp/R * sin(a*lobes))` dengan amp ≤ 12 px
(≈2%) → **hampir lingkaran sempurna**. Tanpa pilar, tanpa elongasi, tanpa
pinch. Semua arena terlihat sama: cincin bulat — persis keluhan owner.

## 4. Spesifikasi bentuk baru (data-driven, `data/arenas.json.chamber.shape`)

```jsonc
"shape": {
  "harmonics": [[2, 0.30, 0.7], [3, 0.20, 2.1], [5, 0.10, 4.2]], // [k, amp, fase]
  "stretch":  [1.35, 0.78, 0.6],   // sx, sy, rotasi rad → ruang panjang miring
  "pillars":  [                    // massa gelap internal (non-konveks)
    { "a": 0.9, "d": 0.45, "len": 260, "wid": 90, "bend": 0.5 }
  ]
}
```
- `r_base(a) = R · (1 + Σ amp·sin(k·a+φ)) · ell(a)` dengan `ell(a)` = radius
  elips stretch di arah a → blob asimetris memanjang (masih star-shaped →
  pipeline radial SDF/GL/uniform tetap dipakai).
- Pilar = rantai 3 lingkaran sepanjang arc (len/wid/bend) → collision
  eksklusi + render massa gelap ber-rim.
- Per-biome: paru = harmonik fringe besar + 1 pilar; jantung = chamber
  berpilar 3; pembuluh/kapiler = stretch ekstrem + pinch harmonik (koridor
  berkantung); dst. (nilai konkret di arenas.json).

## 5. Bukti & tindak lanjut

- Snapshot JS lama (`after-chamber-*.jpg`) = cincin bulat → bukti "miss".
- Sesudah implementasi: snapshot baru wajib menunjukkan siluet asimetris +
  pilar (guard `verify-world` cek: rasio keliling/area ≠ lingkaran, spawn &
  pemain tak pernah di dalam pilar, containment dinding tetap).
- Slice Godot (`godot/arena`) mewarisi rumus sama via `chamber_sim.gd`.
