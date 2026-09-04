# 🗺️ ROADMAP PENGEMBANGAN IMUNVERSE

> Dokumen progres resmi proyek. Diperbarui setiap akhir fase.
> Status: ✅ selesai · 🔄 sedang dikerjakan · ⬜ belum mulai · 🟡 sebagian
> Legenda effort: S = ≤1 sesi · M = beberapa sesi · L = 1+ minggu

| Fase | Nama | Status | Effort |
|---|---|---|---|
| 0 | Riset & Desain Dasar | ✅ | S |
| 1 | Arsitektur & Fondasi Teknis | ✅ | M |
| 2 | Core Gameplay Loop | ✅ | M |
| 3 | Progresi Meta, Ekonomi & Save | ✅ | M |
| 4 | UI/UX Pass 1 — Design System, Polish & Game Feel | ✅ | M |
| 5 | UI/UX Pass 2 — Penyesuaian ke Reference User | ✅ | S–M |
| 6 | Audio & Juice | ⬜ **← POSISI SEKARANG** | M |
| 7 | Konten & Liveops | ⬜ | M |
| 8 | Integrasi Monetisasi (SDK nyata) | 🟡 hook siap | M |
| 9 | Optimasi, QA & Release | ⬜ | L |

---

## Fase 0 — Riset & Desain Dasar ✅
**Tujuan:** memutuskan arah game sebelum menulis kode.
- [x] Game design ringkas: roguelike survival arena, tema sel imun, sesi 3–8 menit.
- [x] Skema data (hero/enemy/nutrient/wave/upgrade/mission) → kontrak file JSON.
- [x] Arah visual: bioluminescent interior tubuh (bg gelap biru-cyan, accent teal/pink).
- [x] Daftar screen: loading, dashboard, roster, upgrade squad, toko, HUD, level-up, pause, revive, game over.
- **Kriteria lulus:** semua keputusan terdokumentasi & data punya skema konkret.

## Fase 1 — Arsitektur & Fondasi Teknis ✅
**Tujuan:** kerangka teknis benar sebelum konten.
- [x] ES6 modules terpisah per tanggung jawab (core/input/entities/systems/render/save/ui).
- [x] Game loop `requestAnimationFrame` + delta-time nyata (clamp 50 ms).
- [x] `data-store` loader JSON + formula terpusat (spawn, scaling HP, kurva XP).
- [x] `save-manager` localStorage (JSON.stringify/parse) + struktur meta berversi.
- [x] `input-handler`: virtual joystick (touchstart/move/end dari titik awal sentuh) + WASD/arrow.
- [x] `sprite-loader`: `loadAllSprites()` Promise + cache + fallback placeholder dev.
- [x] `ui-bridge` event bus (gameplay tidak mengimpor UI).
- **Kriteria lulus:** boot tanpa error; delta-time terverifikasi identik di 30 & 120 fps.

## Fase 2 — Core Gameplay Loop ✅
**Tujuan:** "fun core" 30 detik pertama terasa benar.
- [x] Player auto-attack 3 pattern: `melee_swipe`, `ranged_pierce`, `ranged_homing`.
- [x] 6 tipe musuh, 4 behavior: `chase_direct`, `splitter` (pecah 2), `chase_weave`, `boss_pattern_a` (AOE ter-telegraf).
- [x] Wave system: `spawnInterval = max(0.4, 1.8 − wave×0.08)`, HP scaling `1+(wave−1)×0.12`, boss tiap 5 wave, spawn di luar viewport.
- [x] Collision circle-to-circle + spatial hash grid; separation anti-menumpuk.
- [x] Pickup nutrisi (XP/heal/currency/magnet) + radius magnet + kedaluwarsa.
- [x] Level-up: kurva `10×level^1.5`, pause → modal 3 pilihan acak.
- [x] Camera follow smoothing + screen shake; vignette damage.
- **Kriteria lulus:** 150 musuh + 60 proyektil = **0,27 ms/frame** (target < 8 ms); 98 assertion runtime lulus.

## Fase 3 — Progresi Meta, Ekonomi & Save ✅
**Tujuan:** progres terasa permanen & adil.
- [x] Currency Antibodi: drop in-run + bonus akhir run (per wave + per kill).
- [x] Upgrade Squad permanen 6 jalur (harga `base×growth^level`).
- [x] Toko: unlock hero (jalur alternatif) + consumable Serum Awal.
- [x] Unlock 2 jalur: statistik misi (auto) & pembelian; roster menampilkan gembok + kondisi.
- [x] 12 misi/achievement + reward otomatis; daily reward 1×/hari.
- [x] Auto-save di setiap titik penting (akhir run, beli, unlock, klaim harian).
- **Kriteria lulus:** siklus unlock–beli–persist terverifikasi antar sesi.

## Fase 4 — UI/UX Pass 1: Design System, Polish & Game Feel ✅
**Tujuan:** dari "UI berfungsi" → "UI terasa dirancang".
- [x] **4.1 Design tokens**: skala warna, spacing, radius, shadow, tipografi terpusat di CSS variables.
- [x] **4.2 Layout dashboard**: hierarki jelas (topbar → panggung hero → statistik → daily → misi → dock).
- [x] **4.3 Transisi & micro-interaction**: animasi masuk screen, modal pop, tombol press-state, stagger kartu level-up.
- [x] **4.4 Onboarding run pertama**: hint kontrol adaptif (touch vs keyboard), auto-hide 8 detik.
- [x] **4.5 Feedback game-feel**: badge level di bar XP, denyut peringatan HP rendah, bintang rating + count-up currency di akhir run.
- [x] **4.6 Aksesibilitas dasar**: target sentuh ≥ 44 px, `focus-visible`, `prefers-reduced-motion`, kontras teks.
- **Kriteria lulus:** harness 84 assertion + perf + self-test tetap hijau setelah restyling.

## Fase 5 — UI/UX Pass 2: Penyesuaian Reference User ✅
**Tujuan:** menyamakan gaya visual dengan 12 mockup reference yang diunggah user.
- [x] Palet diambil dari mockup: cream `#FDF6E3`, teal `#2F9C8F`/`#1F7A70`, coral `#F2825C`, sage `#A9D795`, gold `#F5C64F`, ink `#123F3A`.
- [x] Loading screen: emblem perisai+virus lucu (sprite prosedural baru) + bar teal di track cream — sesuai mockup loading.
- [x] Dashboard: panggung hero pastel ber-blob + dock 4 tombol berlabel **Play · Heroes · Squad · Shop** (ikon SVG) — sesuai mockup home.
- [x] Roster: lingkaran avatar berwarna per hero, badge gembok pojok, ring glow teal untuk terpilih — sesuai mockup hero select.
- [x] Squad Upgrade: baris kartu dengan **slider level (track + knob)** + tombol pill harga 💠 — sesuai mockup upgrade.
- [x] Toko: grid kartu pastel 3 kolom, badge harga kuning pojok kanan-atas, gembok pojok — sesuai mockup shop.
- [x] HUD: pill HP cream (portrait + ❤️ + bar), **wave pill** teal gelap, timer chip — sesuai mockup gameplay.
- [x] Game over: kartu kemenangan dengan **3 bintang rating** + judul coral bergaris hias + count-up — sesuai mockup victory.
- [x] Arena canvas: air teal + **arena heksagon cream** di pusat dunia + siluet terumbu & gelembung parallax — sesuai mockup battle.
- **Kriteria lulus:** setiap screen dapat dipetakan langsung ke mockup reference-nya.

## Fase 5.1 — Composition Fidelity Pass ✅
**Tujuan:** menambal kritik "UI monoton" — menambah **lapisan dekorasi komposisi**
(aset stage 8: 10 deco_*) yang ter-wire nyata, bukan pajangan:
- [x] Preload: `EXTRA_PRELOAD` di sprite-loader (prop/fx/joystick/deco ikut loadAllSprites Promise) — tidak ada lagi placeholder senyap untuk path hardcode.
- [x] Gameplay canvas: **aura putih gradasi** di belakang player, **shadow pipih** semua musuh, **rumput laut & terumbu siluet besar** menempel sudut bawah layar (screen-anchored, sway sin(time)).
- [x] Dashboard: **chip patogen dalam gelembung** (virus/sel_kanker/bakteri) melayang di panggung + aura di belakang hero.
- [x] Loading: **kuman lucu teal/coral/sage + dots** melayang mengelilingi emblem.
- [x] Game over: **dekor victory** — koin melayang, bintang pop, peti di baris reward, siluet monster pojok kartu.
- [x] Squad Upgrade: **banner tile hero besar + 2 tile musuh mini** (ala header mockup).
- [x] Shop: **badge kategori bulat** di pojok kiri-atas tiap kartu.
- [x] Pause: emoji ⏱/🛡 diganti ikon PNG (Chromium headless tanpa font emoji).
- **Kriteria lulus:** 12 screenshot Chromium asli tanpa console error/404; elemen dekor terverifikasi di DOM (chipCount=3, aura 326px); perf tetap vsync 60 fps @150 musuh.

## Fase 5.2 — Kekuatan yang Terlihat: Evolusi, Kemampuan Aktif & Kill FX ✅
**Tujuan:** hero terlihat makin kuat (bentuk berubah) + efek kalahkan musuh sesuai tier.
- [x] **Drop bagian evolusi**: musuh normal 6%, elite (virion/parasit) 30%, boss dijamin 2 — dari `data/evolutions.json`.
- [x] **5 tahap evolusi** Common→Legendary: Silia → +Pseudopodia (kaki) → +Mikropedang → +Inti Elemen; tiap tahap = mult damage/HP nyata di `computePlayerStats`.
- [x] **Overlay bentuk di canvas & panggung**: silia berkibar, kaki, pedang, aura elemen berputar (`ov_*.png`) — hero Common benar-benar lingkaran, Legendary penuh kelengkapan.
- [x] **Kill FX per tier**: ring (common), slash (uncommon), spiral angin (rare), petir menyambar (epic), petir+ring emas (legendary) — `spawnKillFx` + `drawKillFx`.
- [x] **4 tombol kemampuan di kanan** (1 senjata: Tebasan Mitosis; 3 kekuatan: Siklon Silia, Petir Sitotoksik, Beku Fagosit) — cooldown ring, keyboard J/K/L/O & 1-4, terkunci merah-duplikat sampai evolusi cukup; damage/push/freeze nyata.
- [x] Status musuh baru: `applyFreeze` (berhenti total) & `applySlow` (siklon) di enemy.js.
- **Kriteria lulus:** SELFTEST `abilityFired`, `evolutionPartsDropped`, `evolutionPersisted` true; petir menyambar terlihat di screenshot `12-skill-petir.png`.

## Fase 5.3 — Retensi & Monetisasi Etis: Arena, Peti Boss, Meta-Progress ✅
**Tujuan:** sesuatu yang selalu dikejar + ads di titik istirahat alami (riset: revive > booster > bonus, selalu opsional, cap harian).
- [x] **4 arena** (`data/arenas.json`) dengan palet/prop/bonus berbeda; **terkunci sesuai cara main**: Lambung (150 kill total), Paru (best wave 8), Saraf (2 boss kill) — progres unlock tampil di modal; `getRunArena` menolak arena terkunci dari save lama.
- [x] **Peti Boss** = natural break: muncul saat boss tumbang (gameplay pause), isi antibodi + bagian; **iklan opsional 2x loot** (`triggerRewardedAdBossChest`) + **kuota iklan harian** `adDailyLimit` dari JSON (`canWatchAd`/`trackAdWatch`).
- [x] **Kartu Evolusi di dashboard**: tahap, tier, bagian terkumpul vs kebutuhan, tombol BEREVOLUSI (bentuk panggung ikut berubah) — selalu ada target berikutnya.
- [x] **Kartu arena + modal pilih arena** dengan syarat unlock berbasis statistik nyata.
- [x] Emoji tersisa (🛡/🔒/⏱/🧬) diganti ikon PNG — Chromium headless tanpa font emoji.
- [x] **Bugfix nyata**: `Pickup.isCollectedBy` NaN (`player.pickupRadius` tidak ada di Player) → nutrisi TIDAK PERNAH terambil; kini fallback `stats.pickupRadius` — nutrisi/bagian kembali terkumpul.
- **Kriteria lulus:** 15/15 screenshot Chromium CLEAN (0 error/404); perf vsync 16,6 ms/frame @151 musuh dengan semua overlay evolusi aktif; SELFTEST_PASS 15 langkah.

## Fase 6 — Body as a System: Tubuh = Organisme yang Dikelola ✅
**Tujuan:** ubah tujuan game dari "bertahan selama mungkin" menjadi **"jaga universe-tubuh tetap sehat"** — roguelite manajemen organisme (in-run TIDAK berubah; murni meta-layer antar-run).
- [x] **5 sistem saling terhubung** (`data/body-systems.json`): Sirkulasi, Pencernaan, Saraf, Imun, Limfatik — masing-masing 0-100, decay -1/hari bila tak dirawat (offline cap 7 hari).
- [x] **Rumus interdependency sesuai desain**: `Sirkulasi_efektif = Sirkulasi_base × (Pencernaan/100)`; `racun += kills × 0.3 − limfatik × 0.02`; racun ≥70 meracuni Pencernaan (−2/run) → loop tertutup.
- [x] **Energi**: dihasilkan Pencernaan tiap run (0,5–1,5× + wave), dipakai boost pemulihan sistem fokus (−25/boost).
- [x] **Kondisi kritis < 20**: bukan game over — modifier run (Imun kritis → musuh +20% cepat; Saraf kritis → XP −25%; dst) + badge kritis berdenyut di dashboard.
- [x] **Modifier run bertahap** dari kondisi tubuh: cooldownScale (Sirkulasi efektif), nutrientMult (Pencernaan — nilai nutrisi run), xpMult (Saraf), damageMult (Imun) — di-set via `applyBodyModifiers` di startRun.
- [x] **Fokus Run** (modal 6 pilihan): "Run Detoksifikasi Limfatik" (saring racun ekstra), "Run Respons Cepat" (pulihkan Sirkulasi), dst — menang (wave ≥3) = +10 sistem fokus, gagal = +3.
- [x] **Milestone makro**: "Tubuh Sehat Sempurna" = SEMUA sistem ≥80 selama 3 hari berturut-turut (streak tersimpan) + **arc naratif**: Terinfeksi Kronis → Tubuh Mulai Melawan → Zaman Pemulihan → Hampir Sehat → Sehat Sempurna.
- [x] **Monetisasi natural**: rewarded ad "percepat pemulihan sistem kritis" (masuk kuota harian) + IAP simulasi "Suplemen Premium" (+20 semua sistem) + suplemen per-sistem 250 antibodi di shop.
- [x] **Dampak run tampil di game over**: "+X racun · +Y energi · Sirkulasi +10 · racun meracuni Pencernaan −2".
- [x] **8 aset stage 10**: ikon 5 sistem, meter energi/racun, badge kritis (total 96 PNG).
- **Kriteria lulus:** SELFTEST 17 langkah PASS (bodyRacunRegistered, bodyStatePersisted); screenshot: kartu kondisi tubuh, kondisi kritis, modal fokus, suplemen shop, dampak gameover; perf tetap vsync 16,6 ms/frame.

## Fase 6.1 — Workflow UI: Battle Prep, Tas & CTA Primer ✅
**Tujuan:** perbaiki workflow dashboard yang membingungkan (riset: 1 primary CTA, pre-run choices dalam 1 layar, bottom nav 3–5 item, bag terpisah).
- [x] **CTA primer "MULAI" besar** tepat di bawah panggung (gradient teal, sub label hero·arena) — mengarah ke **Battle Prep**, bukan langsung run.
- [x] **Battle Prep (Siap Tempur)**: satu layar alur linier — ① pilih hero (kartu horizontal, badge tier evolusi) → ② fokus run (chip) → ③ arena (chip, terkunci sesuai progres) → ringkasan loadout (hero+tier+ikon kemampuan terbuka+fokus+arena) → **tombol MULAI selalu terlihat** (pola Archero/Survivor.io).
- [x] **Tas (Bag)** via dock: grid bagian evolusi (butuh berapa lagi, badge dashed bila kurang) + consumable + info evolusi berikutnya.
- [x] **Dock 5 tombol**: Play · Heroes · Bag · Squad · Shop (ikon tas PNG baru — 97 aset).
- [x] Kartu kondisi tubuh: tombol FOKUS kini mengarah ke Battle Prep (satu gerbang keputusan).
- [x] **Dev server baru `tools/server.py`**: menelan `ConnectionResetError [Errno 104]` (noise keep-alive mobile yang membanjiri log http.server) tanpa mengubah perilaku serving.
- **Kriteria lulus:** screenshot alur baru — dashboard dengan MULAI besar (02), Battle Prep 3 langkah + ringkasan (20), Tas (19); 20/20 shot CLEAN; run tetap jalan dari alur prep (07).

## Fase 6.2 — Bentuk Hero Variatif + Tutorial Onboarding ✅
**Tujuan:** "bentuk hero harus ada bentuk lain selain lingkaran" + onboarding run pertama.
- [x] **Siluet unik per hero**: Sel T = bulat klasik; Makrofag = **ameba berlobus pseudopodia** (siluet tidak simetris); Sel B = **antena reseptor-Y** keluar dari kepala; Sel NK = berduri. Generasi via parameter baru `lobes`/`receptors` di `tools/gen_assets.py`.
- [x] **Tutorial 3 langkah run pertama** (`tutorial-system.js`, hanya `totalRuns === 0`): ① bergerak (akumulasi jarak ±2,5 dtk) → ② auto-attack (kill pertama) → ③ ambil nutrisi (pickup pertama) — bubble + jari animasi + tombol LEWATI; ditandai `meta.tutorialDone` di save; gameplay tidak dipause.
- [x] **FIX input desktop**: joystick virtual kini juga mendengarkan **Pointer Events (mouse/pena)** — sebelumnya drag mouse TIDAK menggerakkan player di desktop (hanya touch/keyboard); hint HUD ditambah "tarik mouse".
- **Kriteria lulus:** 4 hero punya siluet berbeda (sheet); tutorial terverifikasi maju 1→2→3 di browser asli (script terpisah); screenshot `21-tutorial` (bubble langkah + LEWATI); 20/20 shot CLEAN; perf tetap vsync 16,6 ms.

## Fase 7 — Audio & Juice ✅
**Tujuan:** semua event penting bersuara (SFX prosedural WebAudio — tanpa file audio) + game feel (juice).
- [x] **audio-system.js**: 17 SFX disintesis oscillator+noise (tembak, hit, kill, pickup, playerHit, level-up, boss spawn/mati, 4 kemampuan, peti, evolusi, wave, combo, klik UI); throttle per-event anti-spam; **AudioContext di-unlock pada gesture pertama** (kebijakan autoplay); mute **tersimpan di save** (`meta.soundMuted`).
- [x] **Mute toggle 2 tempat**: ikon speaker di topbar dashboard + tombol di modal pause (ikon berubah on/off, sinkron via event pause/resume).
- [x] **Hit-stop**: 70 ms saat boss tumbang, 35 ms untuk musuh elite — update dibekukan sesaat, render tetap jalan (juice standar survivors-like).
- [x] **Squash-stretch player**: badan memantul (sin 48 Hz) saat menerima hit & saat mengeluarkan kemampuan.
- [x] **Combo counter**: kill beruntun (window 2 dtk) → pill "xN COMBO" dengan animasi pop; milestone tiap kelipatan 10 → bonus XP + toast.
- [x] **2 aset baru**: ikon speaker on/off (total 99 PNG).
- **Kriteria lulus:** ctxState=running & 17 SFX dipanggil tanpa error di Chromium asli; toggle mute persist (icon_sound_off.png saat mati); hitStop 0.035 terverifikasi; SELFTEST_PASS 17 langkah; perf tetap vsync 16,6 ms/frame @151 musuh; 21/21 shot CLEAN.

## Fase 6 — Audio & Juice ⬜
- [ ] SFX prosedural WebAudio (tembak, hit, pickup, level-up, boss) — tanpa file aset.
- [ ] Musik latar ambient loop prosedural + mute toggle tersimpan.
- [ ] Juice: hit-stop 40 ms pada kill besar, combo counter, squash-stretch player.
- **Kriteria:** semua event penting bersuara; opsi mute dijaga di save.

## Fase 7 — Konten & Liveops ⬜
- [ ] Hero baru & musuh baru **hanya dengan menambah JSON** (tanpa ubah logic).
- [ ] Mode Endless + mutator harian (seeded RNG dari tanggal).
- [ ] Leaderboard lokal (best run per hero).
- **Kriteria:** konten baru = data baru, bukan kode baru.

## Fase 8 — Integrasi Monetisasi (SDK nyata) 🟡
- [x] Hook & alur sekitarnya siap: `triggerRewardedAdRevive`, `triggerRewardedAdDoubleCurrency`, `checkDailyLives` (alur pasca-iklan = logic asli).
- [ ] Ganti simulasi di `monetization.js` dengan SDK pihak ketiga (1 file saja).
- [ ] Remote config harga/cost, IAP non-consumable (hapus ads), banner aman untuk gameplay.
- **Kriteria:** sswit SDK = edit 1 modul, tanpa sentuh game.js.

## Fase 9 — Optimasi, QA & Release ⬜
- [ ] Profilkan device kelas bawah (budget frame 33 ms), cap DPI adaptif.
- [ ] PWA: manifest + service worker (playable offline).
- [ ] Matriks QA: Chrome/Safari/Firefox, Android/iOS, layar kecil–besar.
- [ ] Freeze konten v1.0 → tag rilis.
- **Kriteria:** 60 fps di device low-end referensi; 0 error console selama 30 menit main.

---

### jejak verifikasi
Setiap fase yang menyentuh kode wajib lolos:
1. `node scripts/check-imports.mjs` (struktur & aset)
2. `node --check` seluruh modul (sintaks)
3. Harness runtime jsdom (98 assertion alur nyata) + perf test + self-test `?autotest=1`
