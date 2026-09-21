# CLOSED BIOLOGICAL COMBAT ARENA — implementasi & bukti

Status: **TERIMPLEMENTASI** (increment 1 + 2) di branch `arena/01a0c285-imunverse`.
Spec owner: arena = RUANG TARUNG TERTUTUP per zona; MAP = denah navigasi statis
(bukan ruang main). Roguelike basics dihormati: satu layar = satu arena, dunia
TIDAK bisa dijelajahi dalam 1 detik (denah hanya overlay informasi).

## 1. Arsitektur

| Lapis | File | Isi |
|---|---|---|
| Arena engine | `js/systems/bio-chamber.js` | `BioChamber`: ring spring-mass N=48 (k=0.1, damp=0.85), heartbeat `sin(t·2.5)`, `applyImpact` (dinding penyok lalu membal), `collide` (containment), `ventPosition` (pori spora), state machine ENTRY→LOCKDOWN(1,2 s)→SWARM→PURIFIED(shockwave)→OPEN dengan hook `onSwarmStart/onPurified/onOpen` |
| Renderer produksi | `js/render/body-gl.js` | WebGL2 SDF radial `d = r − radAt(a)` dari `u_radii[48]` terdeformasi; tint infeksi lockdown, glow vent, shockwave purified, mulut pintu teal, tissue voronoi + glossy band + AO + vignette |
| Renderer fallback | `js/render/body-micro.js` (`drawChamberCanvas`) | Canvas 2D bahasa visual sama, untuk perangkat tanpa WebGL2 / harness |
| Integrasi | `js/core/game.js` | `ensureChamber()` per zona (pemain dipusatkan, palet GL ikut); `arenaClamp`/proyektil diserap dinding/spawn dari pori; `run.bodyWorld = null` (MAP pensiun sebagai ruang main); zoom arena dari `zone.zoom`; SNAP MACRO = denah `body-map.json` |
| Data | `data/arenas.json` | blok `chamber` per organ: radius/lobes/bpm/amp/vents (paru 680/5/74/10/5, jantung 640/4/82/12/4, dst.) |
| HUD kanvas | `js/ui/hud-arena.js` | 5 elemen spec (lihat §2) |
| Denah + status | `js/render/world-map.js` | penanda per organ: `cleared` ✓ hijau, `active` cincin teal berdenyut + label, `locked` gembok merah + chamber diredupkan |

## 2. HUD 5 elemen (spec owner)

- **(A) Specimen Bio-Core** — kiri atas: kapsul inti berdenyut (HP), angka
  `hp/maxHP`, 3 slot organel = pasif yang sudah diambil (`run.upgrades`).
- **(B) Arena Threat Radar** — kanan atas: lingkaran membran mini + sapuan
  radar + titik patogen (boss magenta) + titik pemain; teks
  `Patogen Tersisa: X/Y` (Y = `chamber.spawned`); ikon katup: gembok merah
  `TERKUNCI` saat lockdown/swarm, panah hijau berdenyut `KATUP TERBUKA` saat open.
- **(C) Adaptive Crosshair** — di depan pemain searah aim/facing; spread =
  recoil (`attackTimer/cooldown`) + kecepatan + micro-jitter; disembunyikan
  saat SNAP MACRO.
- **(D) Vital Stability Monitor** — kiri bawah: Membrane HP 5 segmen organik
  (hijau→kuning→merah), bar ATP (isi ulang dari `membrane.pulseCdLeft`),
  Bio-Essence (`run.currencyEarned`).
- **(E) 2 slot kemampuan** — kanan bawah (di atas cluster tombol sentuh DOM):
  cincin membran + pie cooldown radial + angka sisa detik + label S1/S2
  (sumber `run.skills.getView`).

Bar DOM lama yang duplikat disembunyikan saat in-run (`styles/main.css`:
`#hp-pill`, `#hud-currency`, `.rv-bar-wrap`); tombol sentuh PULS/S1/S2 tetap
hidup sebagai kontrol.

## 3. Guard runtime (`tools/verify-world.mjs`, blok SPEC ARENA / HUD ARENA / MAP DENAH)

1. `run.bodyWorld == null` — MAP bukan ruang main.
2. Chamber aktif sejak zona pertama (state lockdown/entry).
3. LOCKDOWN → SWARM setelah ~1,2 s.
4. Sprint 6 dtk ke luar tetap tertahan dinding (arena tertutup).
5. `applyImpact` membuat simpul penyok lalu membal.
6. Patogen habis → PURIFIED lalu OPEN (shockwave + katup).
7. Proyektil melewati membran diserap (mati + dinding penyok).
8. 40 spawn semuanya di dalam chamber.
9. Mekanik inti tak berubah (HP & speed identik).
10. HUD: 5 label spec tergambar tanpa NaN; ikon katup mengikuti state.
11. Denah: penanda cleared/active/locked render tanpa NaN.

Hasil terakhir: `verify-world/combat/gamefeel/visual/screens` = **ERROR 0**.

## 4. Bukti visual (`docs/vision-snapshot/`, diambil `tools/shoot-arena.mjs`,
Chromium headless + SwiftShader, renderer GL aktif = true)

- `after-chamber-lockdown.jpg` — ENTRY/LOCKDOWN: katup terkunci, tint infeksi.
- `after-chamber-swarm-hud.jpg` — SWARM: patogen dari pori dinding, HUD 5 elemen
  lengkap, radar `Patogen Tersisa: X/Y` + TERKUNCI.
- `after-chamber-purified.jpg` — shockwave purified setelah patogen habis.
- `after-chamber-open-door.jpg` — pintu teal terbuka, radar KATUP TERBUKA.
- `after-map-denah-states.jpg` — SNAP MACRO: denah tubuh + gembok merah organ
  terkunci, chamber aktif/cleared bertanda, rute teal START→GOAL.

Reproduksi: `LD_LIBRARY_PATH=/tmp/al2023/lib node tools/shoot-arena.mjs`.

## 5. Increment 3 — empat pilar visual spec LENGKAP

- **Pilar 2 (bioluminescent lighting)**: tiga titik cahaya teal pengembara
  mengarungi cincin membran dalam (`body-gl.js`, loop `for i<3` di interior).
- **Pilar 3 (pulsating perlin UV distortion)**: koordinat tekstur interior
  `wi = w + (fbm−0.5)·(22+40·u_beat)` — jaringan "bernapas" mengikuti heartbeat.
- **Pilar 4 (fluid-drag erythrocytes)**: `js/render/erythrocytes.js`
  (`ErythroFlow`): 84 cakram bikonkaf hanyut oleh medan arus curl-noise +
  swirl + drift zona, vel di-drag eksponensial (lembam), containment dinding
  via `radiusAt`; digambar di atas interior, di bawah entitas.
- **Dolly nudge pintu**: saat `onOpen`, kamera condong 120 px ke mulut pintu
  dengan ease bump 1,15 s lalu pulih (`run._doorNudge`).
- Guard baru (`verify-world.mjs`): eritrosit aktif per chamber; 10 dtk arus +
  drift semua partikel tertahan dinding; kecepatan lembam; nudge bergerak lalu
  pulih. Suite world/combat/gamefeel/visual/screens: ERROR 0.
- Bukti: `docs/vision-snapshot/after-chamber-swarm-hud.jpg` (eritrosit merah
  bikonkaf terlihat hanyut di interior), set snapshot di-regenerate dengan
  pilar 2–4 aktif (renderer GL = true).

## 6. Sisa pekerjaan (increment berikutnya)

- Chordae strands & penempatan massa per organ di dalam chamber (doc §D lama).
- Sprite patogen berduri (attire per keluarga musuh) di dalam arena.
- Bind tap slot E kanvas ke trigger skill untuk layar sentuh (DOM tetap fallback).
