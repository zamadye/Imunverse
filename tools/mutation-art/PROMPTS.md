# RESEP FOTO MUTASI HERO — PHAGOS

Dokumen ini adalah **source of truth untuk membangkitkan foto mutasi**:
satu resep per hero per pose. Dipakai bersama `tools/build-mutation-sprites.py`.

## Alur kerja (per batch)

1. Bangkitkan foto dengan **latar MAGENTA MURNI `#FF00FF`** (WAJIB — itu kunci
   chroma-key), mengikuti resep di bawah. Simpan ke `tools/.mutsrc/<nama>.png`.
2. Jalankan `python3 tools/build-mutation-sprites.py` → menghasilkan
   `assets/sprites/<nama>.png` (RGBA 256 px, latar dibuang, isi di-crop & dipad).
3. `npm run check` → baris "foto mutasi: N/44 tersedia" harus naik.

> Batas alat: **maksimal 10 gambar per giliran**, jadi pengerjaan 44 foto
> dilakukan bertahap (≈4–5 giliran). Urutan prioritas ada di bagian bawah.

## Aturan gaya (wajib sama di semua foto)

- 2D game sprite, satu karakter, **full body terlihat & di tengah**, margin kosong
  mengelilingi supaya tidak kepotong saat di-crop.
- Tiga-perempat view menghadap **kanan**, pose **idle** = melayang santai;
  pose **attack** = menerjang ke depan, membran terkembang.
- Outline tebal `:#123c3b`, shading 3 lapis dari kiri-atas, gaya biologi kartun
  ramah anak (bukan horor, bukan sci-fi logam).
- **Tanpa** bayangan lantai, tanpa teks, tanpa efek di luar tubuh.
- Warna hero **tidak boleh berubah** — yang berubah: bentuk membran, duri,
  cabang, granula, cahaya, ukuran.
- Latar: `flat solid pure magenta background #FF00FF`.

Templat prompt:

```
2D game character sprite, single cute immune cell character: {BASE}.
{MUTASI}. {POSE}. Thick dark outline #123c3b, soft 3-layer shading from
upper-left, friendly cartoon biology style for kids, three-quarter view facing
right, full body centered with empty margin, flat solid pure magenta
background #FF00FF, no ground shadow, no text
```

---

## 1. Mako — `macrophage` (hijau `#4a7c59`, phagocyte)

- BASE: `a big green amoeba phagocyte (#4a7c59) with a wide engulfing mouth and belly`
- MUT1: `MUTATED BASIC FORM: membrane covered in short sharp molecular spikes and tough plated ridges, faint toxic-green glow inside`
- MUT2: `MUTATED FINAL FORM: much larger, six long pseudopod arms radiating, heavy spiked armor plating, glowing bright green phagosome core, pulsing energy veins`
- POSE attack: `lunging forward with membrane stretched wide open, pseudopods reaching out, dynamic motion`

## 2. Dendri — `dendritic` (oranye `#ff8c00`, dendritic)

- BASE: `an orange dendritic cell (#ff8c00) with short branch-like arms`
- MUT1: `MUTATED BASIC FORM: dendrite branches much longer and tipped with glowing teal nodes, membrane slightly plated`
- MUT2: `MUTATED FINAL FORM: a huge crown of many long dendrite antennae radiating in all directions, glowing teal nodes at every tip, thin crackling energy arcs between branches, larger plated body`
- POSE attack: `branches swept forward like a fan, energy discharge at the tips, dynamic motion`

## 3. Neutron — `neutrophil` (biru tua `#1a5276`, NET)

- BASE: `a fast dark-blue neutrophil (#1a5276) with a segmented nucleus`
- MUT1: `MUTATED BASIC FORM: segmented nucleus glowing cyan through the membrane, thin NET filaments trailing behind it`
- MUT2: `MUTATED FINAL FORM: NET trap explosion — many glowing cyan filaments whipping in all directions, bright oxidative burst aura, sleeker armored body`
- POSE attack: `dashing forward, filaments whipping in a net, dynamic motion streaks`

## 4. Eos — `eosinophil` (merah muda `#ff6b81`, granule lance)

- BASE: `a pink-orange eosinophil (#ff6b81) with small internal granules`
- MUT1: `MUTATED BASIC FORM: large orange eosin granules bulging outside the body, short parasite-hook spines on the membrane`
- MUT2: `MUTATED FINAL FORM: armored lance form — long crystal spines radiating outward, hot pink glow, floating granule shards orbiting`
- POSE attack: `thrusting forward with spines extended like a lance, dynamic motion`

## 5. Baso — `basophil` (ungu `#8e44ad`, vesicle cloud)

- BASE: `a purple basophil (#8e44ad) with small internal vesicles`
- MUT1: `MUTATED BASIC FORM: swollen histamine sacs all over the surface, sticky vesicle cloud clinging to the membrane`
- MUT2: `MUTATED FINAL FORM: full vesicle storm — many floating histamine sacs orbiting the body, deep violet glow, ruptured sacs leaking sparkling mist`
- POSE attack: `bursting forward releasing a spray of histamine vesicles, dynamic motion`

## 6. Mastia — `mastcell` (merah bata `#a03328`, granule tank)

- BASE: `a large orange-red mast cell (#a03328)`
- MUT1: `MUTATED BASIC FORM: external granule sacks much bigger, thick membrane valves and tough plated skin`
- MUT2: `MUTATED FINAL FORM: armored tank form — thick plated membrane, bursting granule pods, fiery red-orange glow lines between plates`
- POSE attack: `slamming forward like a battering ram, granules discharging, dynamic motion`

## 7. T-Bolt — `tcd8` (cyan `#00d2ff`, cytotoxic)

- BASE: `a blue-cyan cytotoxic T cell (#00d2ff) with a TCR scanner ring`
- MUT1: `MUTATED BASIC FORM: perforin spikes around the scanner ring, charged electric-blue rim light`
- MUT2: `MUTATED FINAL FORM: dual-lance form — two energy blades extended, bright electric arcs, glowing cyan core`
- POSE attack: `lunging forward to strike with a perforin lance, electric arcs, dynamic motion`

## 8. Helia — `tcd4` (emas `#f1c40f`, helper)

- BASE: `a golden helper T cell (#f1c40f) with a cytokine halo`
- MUT1: `MUTATED BASIC FORM: cytokine halo brighter and wider, membrane plated with golden segments, a short signaling staff`
- MUT2: `MUTATED FINAL FORM: radiant command form — multiple golden cytokine rings orbiting, bright warm halo, larger ornate body`
- POSE attack: `raising both arms to command a wave of cytokine light, dynamic motion`

## 9. Treg — `treg` (mint `#2ecc71`, regulator)

- BASE: `a mint-green regulatory T cell (#2ecc71) with a tolerance shield`
- MUT1: `MUTATED BASIC FORM: tougher tolerance shield plates on the membrane, glowing CTLA-4 seal markings`
- MUT2: `MUTATED FINAL FORM: full mantle form — a large translucent green shield dome around the body, calming pulse rings, ornate seal glyphs`
- POSE attack: `shoving forward with the shield dome expanded, dynamic motion`

## 10. Bella — `bcell` (ungu muda `#bb8fce`, antibody)

- BASE: `a light purple B cell (#bb8fce) with small BCR antennae`
- MUT1: `MUTATED BASIC FORM: antibody-Y wings grown larger, longer BCR antennae, soft lilac glow`
- MUT2: `MUTATED FINAL FORM: antibody storm — several Y-shaped wings spread like a fan around the body, luminous lilac light`
- POSE attack: `firing a spread of glowing antibody-Y bolts forward, dynamic motion`

## 11. Nyx — `nkcell` (ungu gelap `#4a235a`, NK spike)

- BASE: `a dark purple NK cell (#4a235a) with a stress-sensor crown`
- MUT1: `MUTATED BASIC FORM: sharper stress-sensor crown spines, perforin ring glowing violet around the body`
- MUT2: `MUTATED FINAL FORM: shadow form — long dark spikes radiating, violet-black aura, glowing eyes, larger imposing body`
- POSE attack: `lunging through shadow with spikes forward, violet energy trail, dynamic motion`

---

## Antrean kerja (nama berkas)

Untuk setiap hero `{id}`, 4 berkas:

```
hero_{id}_mut1_idle.png     hero_{id}_mut1_attack.png
hero_{id}_mut2_idle.png     hero_{id}_mut2_attack.png
```

| # | Hero | mut1_idle | mut1_attack | mut2_idle | mut2_attack |
|---|---|---|---|---|---|
| 1 | macrophage | ✅ selesai | ⬜ | ⬜ | ⬜ |
| 2 | dendritic | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 | neutrophil | ⬜ | ⬜ | ⬜ | ⬜ |
| 4 | eosinophil | ⬜ | ⬜ | ⬜ | ⬜ |
| 5 | basophil | ⬜ | ⬜ | ⬜ | ⬜ |
| 6 | mastcell | ⬜ | ⬜ | ⬜ | ⬜ |
| 7 | tcd8 | ⬜ | ⬜ | ⬜ | ⬜ |
| 8 | tcd4 | ⬜ | ⬜ | ⬜ | ⬜ |
| 9 | treg | ⬜ | ⬜ | ⬜ | ⬜ |
| 10 | bcell | ⬜ | ⬜ | ⬜ | ⬜ |
| 11 | nkcell | ⬜ | ⬜ | ⬜ | ⬜ |

## Catatan renderer

`js/core/game.js` memilih sprite saat menggambar pemain:

- 0 mutasi → `spriteIdle` / `spriteAttack`
- ada mutasi **tier 1** → `spriteMut1Idle` / `spriteMut1Attack`
- ada mutasi **tier 2 atau 3** → `spriteMut2Idle` / `spriteMut2Attack`

Bila foto tingkat itu belum ada, renderer turun ke tingkat di bawahnya, lalu ke
sprite dasar — jadi game tetap rapi walau separuh foto belum selesai.
Overlay `assets/sprites/mut_*.png` **tidak lagi dipakai di atas karakter**
(masih dipakai sebagai ikon cadangan di kartu level-up).
