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
| 6 | Audio & Juice | ✅ | M |
| 7 | Konten & Liveops | ✅ | M |
| 7.5 | Deep Hooks & Story — "Perang Sang Tubuh" | ✅ | L |
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

## Fase 7 — Konten & Liveops ✅
**Tujuan:** konten baru = data baru, bukan kode baru; liveops tanpa server.
- [x] **Konten via JSON murni** (logic sudah dispatch dari data):
  - Hero baru **Eosinofil** (attackPattern `ranged_homing` yang sudah ada; 2 granula homing) — cukup entri `data/heroes.json` + aset generator.
  - Musuh baru **Protozoa** (behavior `chase_weave` zig-zag, minWave 4) — cukup entri `data/enemies.json` + aset.
  - Roster/Prep/Shop otomatis menampilkan konten baru tanpa kode.
- [x] **Mode via `data/modes.json`**: Klasik = perjalanan 10 wave → **MENANG** (judul + stat `wins`); **Endless** = tanpa akhir, unlock `winNormal` (terkunci "Menangkan mode Klasik"); step Mode di Battle Prep.
- [x] **Mutator harian seeded** (`data/mutators.json` × `liveops-system.js`): PRNG mulberry32 + hash tanggal → semua pemain di tanggal sama dapat mutator sama tanpa server; khusus Endless; mods digabung ke jalur modifier run (enemyHP/enemySpeed/spawn/damage/XP/magnet/nutrien/cooldown); toast pengumuman; ditampilkan di gameover.
- [x] **Leaderboard lokal per mode** (top-10, urut wave→waktu→kill): kartu "Papan Rekor" di dashboard, badge REKOR BARU di gameover.
- [x] Bonus liveops: milestone XP tiap kelipatan 10 wave; Endless bonus antibodi tiap 5 wave; 8 aset baru (hero ×2, protozoa, portrait, ikon infinity, granula) — total **104 PNG**.
- **Kriteria lulus:** e2e 7 langkah RESULT OK (mutator deterministik same-date/beda-tanggal; Endless terkunci→menang→terbuka; run endless pakai mutator `mut_arus_panas`; leaderboard 2 bucket; persist); SELFTEST_PASS 17; 22/22 shot CLEAN; perf 16,5 ms vsync @151 musuh.

## Fase 7.5 — Deep Hooks & Story: "Perang Sang Tubuh" ✅
**Tujuan (arah user):** tunda SDK; benahi UI sampai benar-benar menarik dengan hook yang dalam & kuat; cari yang di game lain belum ada; alur harus terasa tujuannya; imun bertarung BERSAMA PASUKAN; ada cerita & video sinematik; level terus maju (eksplorasi), difficulty medium.
- [x] **Hook 1 — paham semua tombol di kunjungan pertama**: sinematik intro (sekali) → **coach onboarding spotlight** (`data/coach.json`): tur 5 titik (MULAI, Kondisi Tubuh, Heroes, Tas, Shop) tap-untuk-lanjut, sekali saja (`meta.coachDone`).
- [x] **Hook 2 — dampak terasa di detik pertama**: 2 patogen **pasti mendekat dalam ±3 dtk**; wave 1 ramp-up (interval ×0,45 → 1 dalam 15 dtk — ramai sejak awal); copy tutorial set ekspektasi ("Senjata menembak OTOMATIS").
- [x] **Hook 3 — difficulty MEDIUM**: retuning `waves.json` (decay 0,08→0,068; HP scale 0,12→0,105; wave-1 ×0,85; maxAlive 130) — menantang tapi tidak menumpuk.
- [x] **AIM — hero bisa diarahkan** (kritik user): aim stick zona kanan layar (touch/mouse drag) + **mouse hover aim** desktop; chevron penunjuk arah; auto-aim tetap jalan bila tidak mengarahkan.
- [x] **Kemampuan terasa** (kritik user): banner nama kemampuan (animasi pop) + hit-stop 30 ms saat cast + squash + SFX (audio ability yang sempat tidak ter-patch kini terpasang).
- [x] **KAMPANYE "Perang Sang Tubuh"** (`data/campaign.json` — konten = data): **Peta Tubuh** 6 organ (Rongga Mulut → Lambung → Usus Halus → Paru-paru → Kelenjar Limfe → Sumbu Kehidupan), node ✓/MISI/🔒, maju terus (eksplorasi, tidak mengulang); tiap bab = cerita organ sakit + kuota bersih + **boss bernama** (Raja Radang, Ibu Parasit, Ratu Sabit, Jenderal Kanker, Raja Kanker) + reward.
- [x] **Misi terlihat jelas**: mission tracker HUD (kuota patogen live-progress → BOSS!) + objective di peta/briefing + sub CTA MULAI menunjuk bab aktif.
- [x] **PASUKAN IMUN (permanen)** — `js/entities/ally.js`: sel imun kecil ikut bertarung (orbit + auto-tembak); dimulai 1, **+1 per bab bersih (maks 6)**, tersimpan di save — di bab mudah pasukan kecil, makin jalan makin besar.
- [x] **MESIN SINEMATIK** (`js/ui/cinematic.js` + `data/cinematics.json`, tanpa file video): cutscene canvas 2D — aktor sprite tween, narasi, judul, skip; **intro** (virus menyusup → pasukan bangkit), **briefing** sebelum bab baru (cerita organ sakit), **clear** setelah menang (organ pulih) — diletakkan di natural breakpoint.
- [x] **Siklus cerita lengkap**: tubuh sakit → imun datang → bersihkan patogen → boss tumbang → ORGAN BERSIH → organ berikutnya menunggu bantuan.
- **Kriteria lulus:** e2e kampanye 7 langkah RESULT OK (intro→coach→peta 6 node/5 kunci→brief cine→run kuota→MENANG+pasukan+1→clear cine→bab berikutnya→boss bernama "Raja Radang"→peta progres); SELFTEST_PASS 17; 26/26 shot CLEAN; perf 16,6 ms vsync @151 musuh; check-imports ✔.

## Fase 7.6 — Fondasi Akun & Fraksi (Imun vs Virus) ✅
**Tujuan (arah user):** sebelum SDK — akun user wajib ada dulu (fondasi online): tanpa ID user, leaderboard/level hero/**pembelian** tidak bisa dikenali. Plus fondasi ide **dua fraksi**: Imun (biru/teal) vs Virus (merah/coral) — layout dashboard sama, hero/pasukan/tujuan beda; pilihan saat daftar yang men-trigger dashboard masing-masing.
- [x] **account-system.js (SERVER-READY, 1 modul)**: `signUp` (validasi nama 3–16 [a-z0-9_], sandi ≥4, hash djb2 lokal — server nanti bcrypt/argon2), `login` (verifikasi hash), `logout`, sesi di `meta.account` {uid, username, faction, createdAt}; **registry akun perangkat** terpisah (`imunverse.accounts.v1`) → multi-akun, data & pembelian tidak hilang saat logout.
- [x] **Screen auth** (MASUK/DAFTAR tab): form nama+sandi, error inline, tombol "Lanjutkan sebagai X" (akun terdaftar), **kartu pilih fraksi** — Imun **AKTIF**, Virus **SEGERA** (tap → toast "segera hadir"); boot baru: intro cine → **auth** (user baru) → dashboard → coach; chip akun di topbar dashboard (nama + tag fraksi warna fraksi, klik → ganti akun).
- [x] **Pembelian wajib akun** (paling krusial): `requireAccount()` menjaga SEMUA tombol BELI (hero, item, suplemen) — tanpa sesi → toast + dialihkan ke auth; dengan akun → purchase jalan & terikat uid.
- [x] **Leaderboard terikat nama pemain**: entry kini menyimpan `playerName` + `faction` dari akun.
- [x] **data/factions.json**: definisi fraksi (nama, warna, status live/segera, goal, heroIds) — konten fraksi = data.
- [x] **Routing fraksi**: dashboard membaca `meta.account.faction` → set `--faction-color` + tag; fondasi siap untuk dashboard virus (layout sama, konten beda) saat fraksi dibuka.
- [x] **BUG KRITIS ditemukan & diperbaiki**: helper `el()` selalu set `disabled` (juga saat `false`) → **semua tombol BELI tidak pernah bisa diklik sejak awal**; kini atribut false/null dilewati.
- **Kriteria lulus:** e2e auth 7 langkah RESULT OK (validasi form, daftar imun+chip, **beli tanpa akun → dialihkan auth**, login balik + beli sukses terikat akun, routing fraksi virus, leaderboard nama pemain, logout + daftar dobel terhalang); e2e kampanye tetap RESULT OK; SELFTEST_PASS 17; 28/28 shot CLEAN (incl. 00-auth, 00b-auth-filled); perf 16,6 ms vsync @150 musuh.

## Fase 7.7 — Arsenal & Rasa Tempur (feedback imun fraksi) ✅
**Tujuan (kritik user):** gameplay belum matang — tembak harus MANUAL pakai tombol & bisa diarahkan, control lemot, jurus tidak terasa/tak punya, pasukan tidak menembak, tidak ada yang di-farm saat bertempur, butuh layer upgrade (senjata/jurus/damage/pertahanan/serangan). Target user pertama: **anak-anak** — semudah & sejelas mungkin.
- [x] **TEMBAK MANUAL**: tombol TEMBAK! besar (sensitif anak, ramah jempol) + tahan Space/K di desktop; **tanpa fire = tidak ada tembakan** (e2e: shots tetap 0 saat idle). Aim: mouse/stick → assist-aim otomatis ke musuh terdekat kalau anak belum bisa mengarahkan.
- [x] **JURUS dari stage 0**: evolusi stage 0 kini bawa **tebasan** (anak langsung pegang jurus sejak run pertama); cast kini TERASA: ring blast + shake + squash + hit-stop 60 ms + banner nama + SFX.
- [x] **Control gesit**: semua hero +30–40 kecepatan (Sel T 150→186 dll.); joystick full-speed lebih cepat tercapai (radius ×0,55).
- [x] **Pasukan menembak beneran**: fireInterval 1,15→0,95, damage 35%→45%, proyektil lebih besar & cerah (e2e: cooldown ter-reset + proyektil muncul).
- [x] **EQUITY yang di-farm**: koin ANTIBODI berjatuhan dari patogen (30%) dengan label "+1" emas — menambah currency run secara terasa.
- [x] **Damage feedback**: angka damage 30% lebih besar (ramah anak).
- [x] **Layer upgrade permanen (Squad Upgrade)**: 3 kategori baru — **SENJATA** (sq_weapon +10%/lvl dmg senjata), **JURUS** (sq_jurus cooldown −6% & area +8%/lvl — berlaku nyata ke cooldown & radius kemampuan), **PERTAHANAN** (sq_armor damage diterima −5%/lvl); total 9 upgrade dengan badge layer di tiap baris.
- [x] Aset baru: ikon perisai (105 PNG); tutorial & hint HUD disinkron dengan serangan manual.
- **Kriteria lulus:** e2e gameplay 6 langkah RESULT OK (idle=0 tembakan; manual fire → 2 tembakan + kill; jurus stage-0 fire + cd jalan; pasukan menembak; koin farm → currencyEarned naik; speed 186 + 3 layer baru ada); SELFTEST_PASS 17; 28/28 shot CLEAN (TEMBAK! terlihat di shot gameplay); perf 16,6 ms vsync @153 musuh.

## Fase 7.8 — XP Terasa (feedback user: "naik level tiba-tiba, tidak ada indikator") ✅
**Tujuan:** progres XP harus terlihat & dipahami anak-anak — bukan tiba-tiba naik level.
- [x] **XP bar diperjelas**: ikon bintang di pangkal bar, gradasi teal→emas, efek shine mengalir (terbaca sebagai XP, bukan dekorasi).
- [x] **Ghost trail**: saat banyak orb terambil sekaligus, trail kuning "mengejar" fill — lonjakan XP terasa; saat naik level trail menyusut dari 100%.
- [x] **Label "+N XP" melayang** di setiap orb nutrisi yang terambil.
- [x] **Chip level menyala** (emas, berdenyut) saat XP ≥80% — sinyal "hampir naik level!".
- [x] **Ringkasan akhir run** menambah sel **"XP Didapat"**.
- **Kriteria lulus:** e2e XP 5 langkah RESULT OK (bar 0% + elemen lengkap; orb → fill & ghost bergerak; ≥80% → chip `ready`; naik level → modal muncul; summary berisi XP Didapat); SELFTEST_PASS 17; 28/28 shot CLEAN; perf 16,6 ms vsync.

## Fase 8 — Ekonomi Dalam: Lab Upgrade, Equity Tier, Item Variasi, Premium & Gateway ✅
**Urutan permintaan user:** (1) layer upgrade hero satu-per-satu + pasukan berlevel, (2) equity per tier musuh, (3) item variasi, (4) premium bundle + payment gateway + balancing.
- [x] **LAB PASUKAN (tab HERO/PASUKAN/TIM)**: tab HERO menampilkan hero yang DIMILIKI **satu per satu** (carousel ‹ ›) — portrait, chip level, stats DMG/HP terkumpul, slider progress, tombol LEVEL UP (biaya naik ×1,35; maks Lv 20; efek nyata: +6% dmg & +8% HP/lvl khusus hero itu); tab PASUKAN: **level pasukan** (maks 10) — +12% damage & +4% tempo tembak/lvl, berlaku nyata di run; tab TIM: 9 squad upgrade lama.
- [x] **EQUITY PER TIER MUSUH** (`tier` di enemies.json): kecil jarang (15%), **medium sering** (45% koin), **hard pasti koin ×2 + 60% nutrisi bonus** (vitamin_c/amino) — makin berat musuh makin berhadiah.
- [x] **ITEM VARIASI**: 4 consumable pre-run baru — Vaksin Awal (+30 HP), Kopi Limfa (+12% speed), **Pelindung Lendir (serap 1 serangan, VFX "TERSERAP!")**, Sinyal Ganda (+50% antibodi run) — dipakai otomatis saat run dimulai.
- [x] **PREMIUM BENERAN PREMIUM** (`data/premium.json`): 4 bundle — Pemula Rp15rb (HEMAT 40%), Imun Pro Rp45rb (PALING LARIS), Legenda Rp99rb (15 item + gelar eksklusif "Legenda Tubuh"), **Bebas Iklan Rp35rb** (sekali beli, `canWatchAd` jadi false — pengguna membayar = nol interupsi).
- [x] **PAYMENT GATEWAY (persiapan SDK nyata)**: `payment-system.js` — katalog → order ID → pilih metode (QRIS/E-Wallet/Kartu) → bayar (simulasi ±700ms) → **receipt tersimpan di save (terikat uid akun)** → entitlement diberikan; riwayat pembelian di Shop. Backend nyata = ganti isi `payOrder()` dengan fetch ke PSP (Midtrans/Xendit/Play Billing) — satu modul.
- [x] **Balancing premium** (catatan di JSON): 1 antibodi ±Rp10; nilai bundle 1,5–1,8× lipat vs satuan — hemat terasa, tidak mematahkan progres gratisan.
- **Kriteria lulus:** e2e ekonomi 6 langkah RESULT OK (hero Lv 0→1 −150 antibodi; pasukan Lv 1; tier drops → currencyEarned naik & tier 'hard' terbaca; pelindung menyerap hit + vaksin maxHP 138; beli Paket Pemula via modal penuh → receipt terikat uid; Bebas Iklan → canWatchAd false); e2e kampanye & gameplay tetap OK; SELFTEST_PASS 17; 28/28 shot CLEAN; perf 16,5 ms vsync.

## Fase 8.1 — Level Terhubung ke Seluruh UI ✅
**Tujuan:** hubungkan level hero & pasukan (dari Lab) ke semua titik UI, biar progres terasa di mana-mana.
- [x] **Dashboard**: badge level di panggung — "Lv N · Pasukan Lv M · X sel" (klik → langsung buka Lab Pasukan); CTA MULAI membawa level hero ("Bab: Lambung — Perut Kram · Lv 3").
- [x] **Roster**: chip level teal di kartu tiap hero.
- [x] **Battle Prep**: chip hero picker gabungan evolusi+level ("T2 · Lv 3").
- [x] **HUD in-run**: chip "Hero Lv N" + "Pasukan Lv M · X sel" di bawah HP pill — pemain tahu kekuatan yang dibawakan masuk run.
- [x] Damage hero Lv-3 terverifikasi lebih besar dari base (13,72 vs 11 base = +6%/lvl benar).
- **Kriteria lulus:** e2e 6 langkah RESULT OK (badge dashboard & klik→Lab; CTA bawa level; roster chip; prep chip; HUD chips; damage sesuai formula); SELFTEST_PASS 17; 28/28 shot CLEAN; perf 16,5 ms vsync.

## Fase 8.2 — Koreksi: Tombol Hud Klik-Riil + Detail Upgrade di Menu Heroes ✅
**Koreksi user:** (1) tombol TEMBAK tidak berfungsi & menutupi tombol jurus; (2) tombol jurus juga tidak berfungsi; (3) menu Heroes harus punya halaman detail per hero berisi upgrade persenjataan/damage/pasukan — "kalau sudah dibuat di mana letaknya? kalau ada berarti salah tempat".
- [x] **AKAR MASALAH (1)&(2)**: `#screen-hud` ber-class `.screen.passive` = `pointer-events: none` (biar canvas tetap menerima joystick) → SEMUA tombol HUD tidak pernah bisa diklik. E2e lama memanggil API langsung (bukan klik) — lubang verifikasi; kini semua tes tombol memakai **klik mouse riil**.
- [x] **Fix**: opt-in `pointer-events: auto` untuk `.fire-btn`, `.ability-bar`/`.ability-btn`, `#btn-pause`; **posisi TEMBAK dipindah ke kanan-bawah (bottom 64px)** — tidak lagi menutupi ability-bar (terverifikasi bounding-box tak overlap).
- [x] **Detail Hero (dari menu Heroes)**: klik kartu hero → layar **Detail & Upgrade Hero** — kartu hero (tier evolusi, chip Lv, portrait, **statistik senjata live** "Senjata 11 (+0.7/lvl) · HP 100 (+8/lvl)" dengan formula nyata, slider, UPGRADE antibodi) + **panel PASUKAN** (level pasukan, tempo/damage, upgrade) + pintasan Lab Tim. Ini jawaban "letak yang benar": upgrade per-hero tinggal di menu Heroes, bukan menumpuk di Squad Upgrade.
- **Kriteria lulus:** e2e klik-riil 5 langkah RESULT OK (TEMBAK → shotsFired naik; jurus → cooldown jalan + banner muncul; fire & ability-bar TIDAK overlap; klik kartu roster → Detail Hero → UPGRADE −150 antibodi → level 1; klik pause → modal); SELFTEST_PASS 17; 29 shot CLEAN; perf 16,6 ms vsync.

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
