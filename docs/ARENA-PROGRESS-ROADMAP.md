# ARENA PROGRESS ROADMAP — audit vision frame-by-frame

**Tanggal:** 2026-09-22 · **Auditor:** Arena agent · **Verdict: arena BELUM
sesuai spesifikasi** — 9 temuan di bawah, 2 di antaranya P0 (dunia tidak
tergambar sama sekali di jalur 2D; zona tidak bisa dibedakan).

## 0. Metode audit (reproducible)

Server statis repo (`http.server :8000`, masih jalan saat audit) + harness
baru **`tools/snap-arena.mjs`** (`npm run snap`): game ASLI (`js/main.js`)
boot di Node+jsdom, Canvas 2D dirender **Skia — mesin grafis yang sama dipakai
Chromium** — via `@napi-rs/canvas`. 14 snapshot PNG (1280×720) + dump HUD DOM:

```
shots/snap-00-dashboard  01-lockdown  02-swarm  03-motion-0..3
      04-pathogen-closeup  05-purified  06-open-door  07-map-denah
      08-zone-heart/lung/capillary  + hud-dom.json
```

(`shots/` di-`.gitignore` — tidak di-commit; jalankan `npm run snap` untuk
regenerasi ±65 dtk.) **Batas alat:** WebGL tidak ada di sandbox → audit ini
menguji **jalur fallback Canvas 2D**, yang menurut README ("Vanilla JS +
Canvas 2D API murni") HARUS jalan penuh. Snapshot GL-Chromium lama
(`docs/vision-snapshot/after-*.jpg`) dipakai sebagai pembanding "yang
dimaksud".

## 1. Hasil frame-by-frame (snapshot → observasi → ekspektasi spek)

| # | Frame | Observasi | Ekspektasi (sumber) | Status |
|---|---|---|---|---|
| 00 | dashboard | Kanvas HITAM (menu = DOM overlay) | Menu rapi di atas ambient biologis (`UI-UX-RESET`, dashboard-screen) | ⚠️ kanvas mati di menu |
| 01 | lockdown | Latar merah-flat, TANPA dinding/jaringan; hero+2 blob kecil di bawah; teks `+2 ANTIBODI/Fiko·Lv1/32` bertumpuk; landmark `Capillary mesh` wireframe melayang | Chamber berdinding + katup terkunci + infeksi (`CLOSED-ARENA-HUD`, bio-chamber ENTRY→LOCKDOWN) | ❌ dunia tidak tergambar |
| 02 | swarm | Sama: flat; 3 blob musuh polos; sel darah mengalir ✓; radar `5/10 TERKUNCI` ✓ | Patogen dari pori dinding + siluet berduri per keluarga (`PATHOGENIC-ARENA-SHAPE`, attire) | ❌ dinding+siluet hilang |
| 03 | motion ×4 | Gerak berfungsi (musuh melayang, eritrosit mengalir) | — | ✅ simulasi hidup |
| 04 | closeup | Zoom TIDAK berubah (setCorridorZoom no-op); musuh = blob navy polos TANPA duri | Close-up siluet berduri terbaca | ❌ attire tak terbaca |
| 05 | purified | Identik swarm-minus-musuh; TANPA shockwave; radar `0/10` ✓ | Gelombang purified + perubahan warna (`CLOSED-ARENA-HUD`) | ❌ tanpa beat visual |
| 06 | open-door | Radar `KATUP TERBUKA` ✓ tapi TAK ADA pintu terlihat; run-1 sempat tampil landmark HEART (flaky, §F5) | Mulut pintu terbuka di dinding | ❌ pintu tak terlihat |
| 07 | map-denah | Peta tampil (label organ ✓, rute teal, marker pemain ✓, banner "tahan B" ✓) TAPI organ atas TERPOTONG viewport, label terpotong (`KREAS`) | Seluruh tubuh pas bingkai (`WORLD-MAP.md`, `ARENA_ZOOM_OUT_REFERENCE_.png`) | ⚠️ framing rusak |
| 08 | heart/lung/cap | Latar IDENTIK; hanya landmark wireframe berganti (heart: tidak tampil; lung: `Alveolar cluster` ✓; capillary: `Capillary mesh` ✓) | Zona beda dalam 3 dtk: palet+motif+mekanik (§25 V2_REBUILD) | ❌ zona tak terbedakan |
| — | hud-dom | `WAVE 1`, timer `00:15`, misi "bersihkan 120 patogen", hint benar (gerak+PULSE) | V2: wave = pacing, bukan identitas (§27); progres = journey | ⚠️ semantik V1 tersisa |

Pembanding GL (`after-chamber-swarm-hud.jpg`): dinding labirin menyala +
voronoi + hero bermembran + bar HP musuh + tombol PULSE + slot S1/S2 —
**semua itu HANYA ada di jalur GL.** Teks bertumpuk (F6) terlihat di sana
juga → bukan artefak harness.

## 2. Temuan (diurutkan prioritas)

- **F1 [P0] Fallback 2D mati total.** `drawChamberCanvas` (body-micro.js:250)
  crash SETIAP FRAME: `chamber.points` undefined karena chamber aktif selalu
  `LumenLabyrinth` (tanpa `.points`; game.js:2010). Error ditelan
  (`[phagos] chamberCanvas`) → latar flat + spam console. Semua device tanpa
  WebGL buta total.
- **F2 [P0] Zona tak terbedakan.** Palet/motif per zona hanya hidup di shader
  GL (`u_motif`); chamber dipertahankan lintas zona ("tidak memutus ruang").
  Langgar "beda dalam 3 detik" + V2 §25/§47.
- **F3 [P1] 149/149 sprite = placeholder.** `assets/sprites/` KOSONG
  (`spriteStats {loaded:149, placeholder:149}`). Musuh = blob placeholder
  (+duri kontras-rendah nyaris tak terlihat) → siluet keluarga tak terbaca.
  Keputusan desain tertunda: bangkitkan `tools/gen_sprites.py` ATAU full-vektor.
- **F4 [P1] State chamber tanpa beat visual (2D).** lockdown≈swarm≈purified≈
  open; katup/shockwave/pintu tak terlihat. Fallback butuh versi murahnya.
- **F5 [P1] Landmark = wireframe debug + flaky.** Posisi tempel offset pemain
  (+260,−180), bukan struktur dunia tetap (§47). 1 dari 3 run: landmark HEART
  muncul di capillary (mekanisme belum teridentifikasi — log journey run
  instrumen normal; butuh repro seed).
- **F6 [P2] Teks mengambang bertumpuk** (`+2 ANTIBODI/+4 XP/Lv`): perlu manajer
  label (antre + offset vertikal + fade).
- **F7 [P2] Peta makro terpotong** (organ/label atas keluar bingkai):
  perbaiki auto-fit macro (`macroFitZoom`) + margin label.
- **F8 [P2] HUD/DOM warisan V1**: `WAVE 1`, timer, "bersihkan 120 patogen" —
  selaraskan ke V2 (progres journey, antibody, mutasi; `CLOSED-ARENA-HUD.md`).
- **F9 [P3] Minor**: (a) `setCorridorZoom(1.0)` no-op di state swarm;
  (b) kanvas dashboard hitam — beri ambient; (c) Rive rig belum terverifikasi
  nyala (butuh browser nyata; harness memaksa fallback analitik).

## 3. Roadmap

### Fase A — Nyalakan fallback 2D [P0] ← mulai di sini
1. `drawChamberCanvas`: dukung `LumenLabyrinth` (gambar segmen koridor/
   dinding + mulut pintu dari data labirin; adaptor `.points` bila BioChamber).
2. Beat visual murah per state: lockdown (segel katup merah), swarm (pori
   + vignette), purified (shockwave 1×), open (mulut pintu + cahaya).
3. Guard: `npm run snap` + assertion — tidak ada `[phagos] chamberCanvas`,
   variansi piksel antar state > ambang.
**Exit:** snap-01/02/05/06 menunjukkan dinding+pintu yang BERBEDA per state.

### Fase B — Identitas zona 2D [P0]
1. Palet + motif dinding murah per zona (cobble/silia/striasi/rugae/mielin/
   nodul — versi 2D dari `u_motif`).
2. Mekanik lingkungan §25 minimal per zona (arus/obstacle/field) + landmark
   §47 sebagai struktur dunia tetap (ganti wireframe-tempel).
3. Uji "3 detik": klasifikasi zona dari thumbnail (manual 5 thumbnails).
**Exit:** snap-08 ketiga zona langsung terbedakan.

### Fase C — Entitas terbaca [P1]
1. Putuskan: (a) isi 149 path via generator sprite, atau (b) full-vektor
   (matikan sprite musuh, besarkan/kontraskan duri attire + bar HP).
2. Manajer label mengambang (F6).
3. Verifikasi closeup: 3 keluarga musuh terbedakan di snap-04.
**Exit:** screenshot closeup lulus "tes siluet" (tutup warna → tetap beda).

### Fase D — Makro + HUD V2 [P2]
1. Auto-fit peta + margin label (F7); rute teal START→GOAL selalu terlihat.
2. HUD: ganti wave/timer/misi-V1 dengan journey/antibody/mutasi (F8).
3. Repro seed + investigasi flaky landmark (F5).
**Exit:** denah penuh dalam 1 bingkai; HUD sesuai `CLOSED-ARENA-HUD.md`.

### Fase E — Stabilisasi [P3]
Seed deterministik untuk snap (hilangkan flakiness), verifikasi Rive +
  GL di browser nyata (Windows/Mac), audit perf 60fps, kanvas ambient
  dashboard.

## 4. Menjalankan ulang audit

```bash
npm i --no-save @napi-rs/canvas   # sekali saja per sandbox
npm run snap                       # → shots/*.png + hud-dom.json (±65 dtk)
```

Perbandingan GL-browser tetap memakai `tools/shoot-arena.mjs` (butuh
Chromium + lib sistem — tidak tersedia di sandbox ini).

## 5. Status eksekusi (2026-09-23)

- [x] **Fase A+B [P0] SELESAI** (`18826a9`): `drawLabyrinthCanvas` 2D
      (koridor, rongga per-pal/motif, hazard, segel/vents/shock/pintu),
      palet arena data-driven (`data/arenas.json`), refresh palet GL per
      room. Guard: `P0_GUARD=PASS`, `chamberCanvasErrors = 0`.
- [x] **Harness F2** (`65d4772`): lompat zona teleport pemain ke room
      labirin — frame heart/lung/capillary kini benar-benar berpindah.
- [x] **Boot-hardening loading** (komit ini): sprite preload worker pool
      (12) + timeout 15 dtk anti-stack, fetch JSON timeout 20 dtk, 55×
      `modulepreload` pangkas waterfall impor (~105 modul/1,2 MB).
- [x] **CI snapshot Chromium** (komit ini):
      `.github/workflows/shoot-arena.yml` — Actions →
      "shoot-arena (Chromium nyata)" → Run workflow → unduh artefak
      `arena-browser-shots`. Sandbox dev tidak bisa menjalankan Chromium
      (`libnspr4.so` hilang, tanpa root, CDN Debian diblokir) — CI adalah
      jalur resmi bukti browser.
- [ ] Fase C/D/E — berikutnya sesuai mandat (P1 → P2 → P3).

## 6. Mandat rebuild dari nol (2026-09-23, owner — CATAT BAIK-BAIK)

**Arena dibangun ULANG DARI NOL — BUKAN tambal (patch) implementasi yang ada.**

- `js/systems/lumen-labyrinth.js`, jalur render arena di
  `js/render/body-micro.js` / `js/render/body-gl.js`, dan P0 Fase A+B
  (komit `18826a9`) adalah **referensi perilaku + jaring pengaman visual**,
  bukan fondasi. Dilarang menumpuk patch di atasnya untuk fitur arena baru.
- Kode arena baru ditulis bersih di lokasi baru, dengan kontrak integrasi
  yang disepakati (lihat jawaban konfirmasi di bawah) sebelum cutover.
- Detail scope (cakupan rebuild, nasib kode lama, target visual) diisi
  setelah konfirmasi owner — bagian ini mengikat sejak ditulis.
- **Keputusan build (2026-09-23, berjalan):** kode baru di `js/arena/`
  (`arena.js` = model + state machine, `render2d.js` = renderer 2D);
  file lama TAK disentuh kecuali 3 baris dispatch di `game.js`;
  API chamber dipertahankan penuh (agen combat/enemy/HUD aman);
  baca JSON lama; aktif via `?arena=v2` / `ARENA_V2=1`.
  Slice 1 terverifikasi: seluruh state + teleport zona jalan,
  `P0_GUARD=PASS`, 0 error (`shots/v2/`).

## 7. Temuan user 2026-09-24: buram + UI + gap referensi pathogenic

Perbandingan `docs/reference-pathogenic/ARENA_ZOOM_OUT_REFERENCE_.png`
vs arena kini: user benar — masih SANGAT jauh (referensi = anatomi
painterly per organ + koridor vaskular bercahaya + portal START/GOAL;
kini = rongga lingkaran prosedural). Peta jalan penutup gap = V2 slice
berikutnya (siluet organ per room, koridor luminous, portal START/GOAL).

- [x] **BUG buram #1 (utama, gameplay):** kanvas GL dirender di CSS-px
      lalu di-upscale ke backing DPR = seluruh lapisan arena GL buram
      di semua HP DPR>1. Fix: GL se-resolusi backing (dpr clamp 1.5,
      `u_scale` ikut — framing identik). Hanya `body-gl.js`.
- [x] **BUG buram #2 (tersembunyi):** lapisan latar legacy
      (`drawBackground`/`drawArena3D`: prop 128px di-upscale 2–3×)
      digambar di bawah labirin yang opaque. Fix: skip saat
      `isLabyrinth` (tak terlihat + hemat fill-rate). Dashboard tanpa
      chamber TIDAK diubah (scope UI-agent).
- [x] **Scope UI murni:** V1 tak pernah memanggil callback efek; V2
      sempat memicu label baru (SPASME/...) = tumpukan UI baru. Fix:
      V2 samakan V1 (abaikan opts). Sisa tumpukan (angka damage,
      +ANTIBODI, nameplate) = domain combat/effects — TIDAK disentuh.
- [ ] Verifikasi GL tajam butuh browser Nyata (jsdom tak ada WebGL):
      user/CI `shoot-arena`.

## 8. Benchmark vs game Pathogenic (2026-09-24)

Game pembanding: **Pathogenic** (Aberrant Labs / Slug Disco, rilis
1.0 Juli 2026) — 2D roguelike twin-stick di dalam tubuh manusia,
7 pathogen, 6 organ biome. Arena gameplay-nya (2 biome teramati:
gua amber/merah + gua ungu/cyan) vs Arena V2 kita:

| Aspek | Pathogenic | V2 kini | Gap |
|---|---|---|---|
| Bentuk ruang | Gua organik tak-beraturan (blobby) | Lingkaran sempurna | BESAR |
| Dinding | Sel bertekstur rapat + rim membran tebal | Gradien datar + cincin tipis | BESAR |
| Cahaya/kedalaman | Arah cahaya, god-ray, DOF depan/belakang | Datar, tanpa lapisan depth | BESAR |
| Identitas biome | Flip palet total per organ (<1 dtk) | Tint palet + atmosfer (ok, <3 dtk) | KECIL |
| Arsitektur | Pembuluh luminous sebagai sungai cahaya | Lumen koridor redup | SEDANG |
| Partikel depth | Mote melayang + foreground blur | Gelembung hazard saja | SEDANG |
| UI | Minimal (1 bar + angka kecil) | Panel DOM + floats ramai | (agen lain) |

Status tutup-gap (semua SELESAI + terverifikasi visual `shots/v2/`):
1. [x] Siluet lobed/blobby — `lobeMod` dipakai SAMA oleh SDF & renderer.
2. [x] Dinding berlapis: pita sel + serat busur + rim membran 3-garis.
3. [x] Depth: sulur foreground + mote + berkas cahaya diagonal.
4. [x] Koridor = sungai cahaya (inti terang + pulsa berjalan).
5. [x] Bentuk per organ data-driven (`shape` di `lumen-labyrinth.json`):
   paru = alveoli 1+6, jantung = bilik ganda, usus_halus = koil
   sinusoidal (SDF per-shape + guard seed eritrosit). V1 abaikan
   field baru (aman).
Batas jujur: detail painterly AAA butuh aset art/shader berat; Canvas 2D
hanya aproksimasi via noise strokes berlapis (GL `body-gl` sudah fbm).

## 9. V2 slice 4: bentuk 10 organ marjinal (2026-09-24)

Melengkapi slice 3 (paru/jantung/usus_halus): `tri` hati, `pair`
ginjal, `leaf` pankreas, `nodes` limfe, `axon` saraf, `vessel`
kapiler+aliran_darah, `coil` usus_besar+lambung, `alveoli` goal —
total 13 room berbentuk, 6 junction tetap `cavity`. Semua kombinasi
blob (SDF + render otomatis, tanpa cabang baru). V1 abaikan `shape`.
Verifikasi: `P0_GUARD=PASS`, 0 error.
