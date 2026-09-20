# PHAGOS — Laporan PILOT: Arena "Organ Ascent" (Bilik Jantung) + Character "Abstract Bio-Form" (Mako)

**Status:** pilot selesai, menunggu validasi owner sebelum di-scale.
**Rujukan mandat:** `docs/ARENA-CHARACTER-REDESIGN-STRATEGY.md` (§5, §6, §8) dan
`docs/AGENT-KICKOFF-ARENA-CHARACTER.md`.
**Scope:** 1 organ (`jantung`) + 1 hero (`macrophage`). 6 organ & 10 hero lain
TIDAK disentuh — jalur kode lama tetap dipakai apa adanya untuk mereka.

---

## 1. Dua koreksi fakta terhadap dokumen strategi (ditemukan saat audit kode)

| Asumsi di dokumen | Kenyataan di kode | Dampak ke pilot |
|---|---|---|
| "Mode bawaan sekarang `makhluk`" (CHARACTER-PROTOTYPE-EVAL) | `hero-mode.js` bawaan = **`foto`**, dan `verify-prototype.mjs` **mengunci** itu dengan asersi. Yang tampil untuk Mako = PNG chibi bermata (persis yang dibatalkan owner). | Pilot character bukan cuma "pertajam rig" tapi juga **mengaktifkan** rig sebagai bawaan khusus hero pilot + memutar asersi test. |
| "Arena ditentukan `meta.selectedArena`" | Palet & organ ditentukan **`world-journey.js`** (zona perjalanan: paru → … → jantung → …). `selectedArena` hanya fallback. | Bentuk koridor harus mengikuti **zona**, dipasang/dilepas saat zona berganti — bukan sekali di `startRun`. |

## 2. Keputusan atas poin terbuka (§5c / §6b / §8) + alasan

| Poin | Keputusan | Alasan |
|---|---|---|
| Jalur tunggal vs bercabang | **Tunggal** | Spawn/pacing/clamp cukup O(1) per entitas (`halfAt(y)`), bisa dibuktikan cepat. Cabang = poligon + kamera lebih rumit; ditunda sampai pola terbukti. |
| Kamera | **Tetap top-down** (pipeline `makeProjector` tidak diubah) | Kamera sudah "melihat ke atas": `ANCHOR_Y` menaruh player di bawah layar dan perspektif mengecilkan yang jauh di atas — cocok untuk membaca koridor vertikal tanpa menyentuh proyeksi hero/telegraph/membran. |
| Organ pilot | **Bilik Jantung** | Sesuai rekomendasi doc; sudah punya bpm/pulse & mekanik `heartbeatPulse` di journey. |
| Urat/otot: dekorasi atau gameplay? | **Visual struktural saja** (dinding = collision, tapi urat/otot tidak mendorong/menghalangi) | Mandat batasan: mekanik harus identik. Fungsional = kode gameplay baru = di luar pilot. Struktur data (`shape.wall`) sudah siap ditambah efek nanti. |
| Format run | **Tetap gelombang-bertahan** (bukan "sampai puncak") | Mengubah kondisi menang = mengubah mekanik & objective bab — di luar scope. Koridor tinggi 3200 unit memberi arah "naik" tanpa memaksa. |
| Luas arena | **Setara cawan lama** (1,79 jt vs 1,77 jt unit², 1,01×) | Kepadatan spawn & jangkauan pickup tidak berubah → gameplay terasa sama padatnya, hanya bentuknya terarah. |
| Tingkat abstraksi | **Hybrid** (siluet biologis disederhanakan jadi ikon) | Rig makrofag = blob + kaki pseudopodia (biologis) + penanda ikonik: ruffle membran, **mangkuk fagosit** di depan (pengganti lamelipodium polos), **vakuola** isi. Terbaca dari jauh, tanpa wajah. |
| Prosedural vs aset | **Prosedural-vektor** (extend `creature-rig.js`, data-driven) | Field baru (`body.ruffle`, `front.cup`, `vacuoles`) opsional → hero lain otomatis tidak berubah. Tidak butuh brief seni eksternal. |
| Pembanding lama | Tetap tersedia | `?heroMode=foto` / tombol M / Lab (P) — pilihan eksplisit mengalahkan bawaan pilot. |

## 3. Yang berubah (ringkas)

**Arena (baru)**
- `js/systems/arena-shape.js` — profil lebar-per-tinggi (Catmull-Rom) → `halfAt(y)`, `centerAt(y)`, `clampToShape`, `insideShape`, `outsideDistance`, `wallPolyline`. Satu sumber kebenaran untuk collision **dan** visual.
- `js/render/organ-corridor.js` — jaringan luar gelap, pita serat otot berdenyut (bpm palet), 3 pembuluh per sisi (vena/arteri) dengan aliran **naik**, korda tendinea, rim.
- `data/arenas.json` (`jantung`) — blok `shape` (profil apeks → bilik → katup → serambi → aorta, luas setara cawan), `flowcell` diputar mengalir ke atas, `fold` jadi serat vertikal tipis.
- `js/core/game.js` — `run.arenaShape` (null = cawan lama); `syncArenaShape()`; `arenaClamp`/clamp spawn/kill proyektil memakai shape bila ada; `renderArenaWall` (lingkaran) di-skip saat koridor aktif.
- `js/systems/world-journey.js` — pergantian zona memanggil `syncArenaShape`; `_jumpToZone()` untuk penguji/lab.

**Character (pilot Mako)**
- `js/render/hero-mode.js` — `PILOT_CREATURE_HEROES = ['macrophage']`, `heroModeFor(heroId)`; mode eksplisit tetap menang; `resetHeroMode()`.
- `js/render/creature-rig.js` — ruffle membran, mangkuk fagosit, vakuola fagositosis (semua opsional dari data).
- `data/creature-rigs.json` — hanya entri `macrophage` ditambah field di atas + warna sedikit lebih kontras terhadap tanah merah muda jantung.
- Lab & tombol "Mode hero" menampilkan mode **efektif** hero yang dimainkan.

**Test**
- `tools/verify-prototype.mjs` — asersi "bawaan = foto" diganti: global tetap foto, hero pilot = makhluk, eksplisit foto menang; render arena diferensial per hero (pilot vs non-pilot); rig pilot tanpa fitur wajah & punya penanda identitas; hero lain tidak berubah.
- `tools/verify-world.mjs` — 11 cek PILOT baru: hanya jantung berkoridor, aktif/lepas saat zona berganti, luas ±15%, vertikal (tinggi ≥ 3× lebar), melebar-menyempit, 400 clamp acak + 40 spawn di dalam siluet, pemain tertahan dinding, HP/speed identik, kembali ke cawan berpusat pemain, render tanpa error/NaN.
- `scripts/e2e-pilot-jantung.mjs` — Playwright: run nyata di zona jantung, screenshot wide/naik/dinding + crop hero 4×, metrik posisi/HP.

## 4. Hasil verifikasi

```
npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife   ✔
node tools/verify-animasi.mjs    === ERROR (0) ===
node tools/verify-crawl.mjs      === ERROR (0) ===
node tools/verify-prototype.mjs  === ERROR (0) ===   (asersi diperbarui, +6 cek)
node tools/verify-world.mjs      === ERROR (0) ===   (+12 cek PILOT)
node tools/verify-rive/combat/economy/p5/gamefeel/attacks.mjs  === ERROR (0) ===
node scripts/check-imports.mjs   Semua pemeriksaan lolos ✔
```
`verify-visual` (23) / `verify-screens` (7) / `validate-catalog` (3) gagal **sama persis di base branch sebelum perubahan ini** (aset foto latar & katalog toko — di luar scope, tidak disentuh).

**Bukti mekanik identik (e2e, 4 dtk jalan naik + 4 dtk kiri, hero speed sama):**
before (cawan): (0,0) → (0,−735) → (−710,−188) — tertahan lingkaran r=735.
after (koridor): (0,0) → (0,−1662) → (−258,−1662) — tertahan dinding kiri bilik (halfAt = 258+radius).
HP 99999 → 99999 di keduanya; jarak tempuh vertikal per detik identik (perbedaan hanya di mana dinding menahan).

## 5. Screenshot (Playwright, Chromium headless, 900×600) — `docs/pilot-jantung/`

| | Before | After |
|---|---|---|
| Arena (spawn) | `before-arena-wide.png` — pipa besar melintang acak, tak ada batas terlihat | `after-arena-wide.png` — koridor bersiluet, dinding otot bergaris, urat mengalir naik |
| Arena (naik 4 dtk) | `before-arena-up.png` | `after-arena-up.png` — katup menyempit terbaca di atas |
| Mentok dinding | `before-arena-wall.png` — garis putus lingkaran kaca | `after-arena-wall.png` — jaringan gelap di luar siluet |
| Hero crop 4× | `before-hero-crop-4x.png` — chibi bermata/bermulut | `after-hero-crop-4x.png` — blob bermembran berkerut, nukleus, vakuola, mangkuk depan; tanpa wajah |
| Lab | — | `after-lab.png` — ③ ditandai "Dipakai di arena" |

## 6. Rekomendasi scale: **LANJUT dengan 2 revisi kecil dulu**

Siap di-scale karena: (1) pola data-driven — organ baru = blok `shape.profile` (belasan angka) + warna `wall`, hero baru = 3 field opsional di rig; (2) 0 perubahan di mekanik terbukti oleh test; (3) jalur lama tetap utuh sebagai fallback.

Sudah dikerjakan di PR ini (revisi #1): **zoom-out ringan saat di koridor** — layer `corridorScale` di `Camera` (independen dari zona/punch, tanpa getar), target dari `shape.cameraZoom` (jantung 0,88), kembali 1 saat keluar koridor; dicek `verify-world`. Screenshot `after-*` sudah memakai zoom ini.

Yang masih butuh keputusan owner sebelum 6 organ lain:
1. **Musuh dari bawah** — spawn masih radial di sekeliling player (mekanik lama, sengaja tidak diubah). Untuk rasa "didaki", bias spawn ke bawah (y > player) bisa jadi tweak `getSpawnPosition` opsional per-shape — ini perubahan gameplay ringan, butuh keputusan owner.
2. Untuk **paru** (bercabang) profil tunggal tidak cukup — perlu ekstensi `kind:'branch'` (2–3 koridor bergabung). Pola `halfAt/centerAt` masih bisa dipakai per cabang.

Hero berikutnya: neutrophil & dendritic sudah punya rig penuh; cukup tambah `PILOT_CREATURE_HEROES` + field identitas (granula multi-lobus / dendrit) — tanpa kode baru di renderer kecuali bentuk khas yang diinginkan.
