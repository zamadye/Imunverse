# 🧬 Imunverse

**HTML5 roguelike survival bertema sel imun** — kamu adalah sel imun terakhir yang bertahan melawan gelombang patogen di dalam aliran darah. Vanilla JavaScript + Canvas 2D API murni, **tanpa framework dan tanpa build step**.

![genre](https://img.shields.io/badge/genre-roguelike%20survival-35d0ba) ![tech](https://img.shields.io/badge/tech-vanilla%20JS%20%2B%20Canvas%202D-4cc9f0) ![build](https://img.shields.io/badge/BUILD-55a-f5c64f)

---

## 📌 Dokumen acuan

| Dokumen | Isi |
|---|---|
| [`ROADMAP.md`](ROADMAP.md) | Rencana kerja aktif: status terverifikasi, temuan integrasi, Fase 1 → 4, keputusan terbuka |
| [`docs/rekomendasi-struktur-imunverse.md`](docs/rekomendasi-struktur-imunverse.md) | Sumber kebenaran desain monetisasi & retensi (v2.0) |
| [`docs/brief-agent-building.md`](docs/brief-agent-building.md) | Instruksi kerja per fase + kriteria terima yang bisa diverifikasi mesin |

Dokumen lama (33 file di `docs/`, `ROADMAP.md` era Fase 1–19, dan 145 screenshot) **sudah dihapus** pada 13 Sep 2026 agar tidak ada pengetahuan yang saling bertentangan. Nomor "Fase"/"RONDE" lama yang masih muncul di komentar kode adalah jejak sejarah, bukan rencana kerja.

## ▶️ Menjalankan

Game memakai **ES6 modules** + `fetch()` file JSON, sehingga browser memblokirnya lewat protokol `file://`. Jalankan lewat server statis lokal:

```bash
npm start          # python3 -m http.server 8000 --bind 0.0.0.0
# atau: python3 -m http.server 8000  |  npx serve .
```

Buka **http://localhost:8000**. Tidak ada `npm install`, tidak ada langkah build.

## 🎮 Cara main

| Aksi | Mobile | Desktop |
|---|---|---|
| Bergerak | **Virtual joystick** (sentuh di mana saja, tarik dari titik awal sentuh) | **WASD / Arrow keys** |
| Menyerang | Tombol SERANG (tahan = tembak; tahan + tarik = aim) | Tombol SERANG / tahan |
| Jeda | Tombol ⏸ | `Esc` / `P` |

- Tiap **25 detik** = 1 gelombang baru (`data/waves.json:waveDuration`); musuh makin banyak dan makin kuat.
- **Boss** muncul tiap 5 gelombang (`bossWaveEvery`) — area merah adalah telegraph ledakan sitotoksin, kabur.
- Kumpulkan nutrisi: Glukosa/Amino (XP), Vitamin C (heal), Antibodi (mata uang), Sinyal Sitokin (magnet).
- **Level up** → pilih 1 dari 3 upgrade acak (rarity + pity + anti dead-choice).
- Antibodi dipakai untuk upgrade squad permanen, unlock hero, dan item toko — tersimpan otomatis di `localStorage` (`imunverse.save.v1`).

> ✅ **Diperbaiki (BUILD 53a):** layar Toko sudah diadaptasi ke katalog IAP v2.0.0 (Fase 1B) — harga/nilai/badge dihitung runtime, metode pembayaran objek, entitlement `cosmetics[]`/`drip`/`perks[]` benar-benar diberikan. Lihat `ROADMAP.md` §4. Temuan yang masih terbuka: **G15** (kuota iklan `revive`/`double currency` dan semantik `noAds`).

## 🏗️ Struktur proyek

```
Imunverse/
├── index.html                  # Entry point + kerangka screen UI (overlay DOM)
├── manifest.json               # ★ PWA: standalone, landscape, ikon pwa/
├── sw.js                       # ★ service worker: cache per-BUILD + navigasi offline
├── styles/                     # Design system cream/teal/coral
├── data/                       # 35 file JSON — SEMUA angka gameplay, bukan hardcoded
│   ├── heroes.json             #   11 hero (stat, pola serangan, sprite, unlock)
│   ├── enemies.json            #   13 tipe musuh (behavior, HP, XP, splitter, boss AOE)
│   ├── arenas.json             #   5 arena (organ, unlock, bonus, palet lingkungan)
│   ├── campaign.json           #   6 bab kampanye (killQuota, boss, reward, story)
│   ├── waves.json  nutrients.json  upgrades.json  evolutions.json  skills.json
│   ├── battlepass.json  ranks.json (13 tier)  mastery.json  missions.json
│   ├── cosmetics.json  premium.json (katalog IAP v2.0.0)
│   ├── economy-anchors.json    # ★ SATU sumber kebenaran valuasi (kurs Imun/Antibodi, badge)
│   ├── retention-config.json   # ★ target pacing, comeback, drop langka, sink, session hook
│   │                           #   (dimuat sebagai DATA.retentionConfig — lihat ROADMAP §2 G7)
│   └── lang.json               #   kamus i18n (string UI wajib terdaftar di sini)
├── assets/                     # sprite PNG, ikon SVG, audio, bangunan, reference sheet
├── js/                         # 100 file JS
│   ├── main.js                 # Bootstrap: data → sprite preload → save → loop
│   ├── core/                   # game-loop (delta-time), state-manager, data-store,
│   │                           # ui-bridge (event bus), game.js (orkestrator run), version.js
│   ├── input/                  # virtual joystick + keyboard
│   ├── entities/               # player, enemy, projectile, pickup, ally
│   ├── systems/                # 43 modul: spawn, collision (spatial hash), upgrade, economy,
│   │                           # imun-economy, unlock, mission, effects, monetization, payment,
│   │                           # battlepass, rank, mastery, evolution, body, retention, metrics,
│   │                           # tutorial, audio/music/vo, narrative, i18n, haptics, feature-gate
│   │   ├── pricing-model.js    # ★ valuasi, badge, bonus pembelian pertama, deteksi dominasi
│   │   ├── comeback-system.js  # ★ batas peluruhan offline, streak berampun, hadiah kembali
│   │                           #   → DIPAKAI: dipanggil sekali dari main.js:boot() (BUILD 52a)
│   │   ├── session-hook.js     # ★ 3 progres terdekat, ETA dalam RUN
│   │   └── rare-drop-system.js # ★ drop kosmetik langka + pity, Peti Riset (pity terpisah)
│   ├── render/                 # sprite-loader, shape-renderer, camera, background, visuals
│   ├── save/save-manager.js    # localStorage + titik auto-save
│   ├── ui/                     # screen-manager, cinematic, cutscene 2D/3D, coach, presenter,
│   │                           # comeback-modal (Fase 1.3: satu modal hadiah kembali/streak)
│   │   └── screens/            # 23 layar (title, dashboard, roster, hero-detail, prep, shop,
│   │                           #   bag, codex, campaign, arena, battlepass, rank, profile,
│   │                           #   auth, hud, levelup, pause, revive, bosschest, gameover, …)
│   └── vendor/three.module.js  # three.js (hanya untuk cutscene 3D, dynamic import)
├── tools/
│   ├── validate-catalog.mjs    # ★ audit katalog IAP — exit 1 bila ada error
│   ├── validate-retention.mjs  # ★ audit pacing + Monte Carlo drop + sim comeback 45 hari
│   ├── validate-retune-sync.mjs # ★ bandingkan data/*.json repo dengan target config (29 cek)
│   ├── ci/                     # ★ validate.yml (gerbang CI) + install-workflow.sh + README
│   ├── gen_sprites.py  gen_assets.py  gen_ecosystem_assets.py  server.py  featcheck/
│   └── gen_pwa_icons.py        # ★ ikon PWA (PNG murni-python dari palet design system)
├── scripts/                    # check-imports.mjs + 34 e2e/unit (menulis bukti ke shots/)
│   ├── unit-fase1-retune.mjs   # ★ uji headless Fase 1 (31 cek, tanpa browser) — npm run test:fase1
│   ├── unit-fase1b-shop.mjs    # ★ uji headless Fase 1B (62 cek: katalog v2 + pembayaran)
│   ├── unit-fase2-pwa.mjs      # ★ uji headless Fase 2.6 (35 cek: manifest, ikon, SW, prompt)
│   └── unit-fase2-onboarding.mjs # ★ uji headless Fase 2.1/2.3 (18 cek: auto-fire, gerbang)
├── image-search/               # referensi visual UI dari game lain (bahan riset)
└── files.zip                   # arsip asli paket update monetisasi/retensi (sudah di-unpack)
```

★ = bagian dari paket monetisasi & retensi v2.0 (13 Sep 2026). Empat modul bertanda ★ di `js/systems/` adalah **modul murni**: tidak menyentuh DOM, tidak menulis save, tidak memanggil `emit`.

## 🔑 Detail teknis

- **Delta-time nyata:** `dt = (t_rAF − sebelumnya) / 1000`, di-clamp **50 ms** (`game-loop.js:52`) — gameplay identik di layar 30/60/120 Hz.
- **Formula gelombang** (`data/waves.json`): `spawnInterval = max(0.4, 1.8 − wave × 0.08)`; `enemyHP = baseHP × (1 + (wave−1) × 0.105)`; kecepatan musuh naik 1,5%/gelombang hingga ×1,6; maksimum 250 musuh hidup.
- **Kurva XP:** `xpToNextLevel = ceil(10 × level^1.5)` (`data-store.js:272`). Level-up mem-pause game 0,3 s dan menampilkan 3 pilihan acak.
- **Pass comeback saat boot (BUILD 52a):** `runComebackPass()` dipanggil sekali di `main.js:boot()`. Peluruhan tubuh offline dibatasi **2 hari** (`retention-config.comeback.maxOfflineDecayDays`, dibaca `body-system.applyDailyDecay`), absen ≥3 hari dibayar hadiah kembali + tubuh dipulihkan, dan streak harian maju dengan **satu hari pengampunan**. Hasilnya ditampilkan sebagai **satu** modal (`js/ui/comeback-modal.js`), sekali, saat dashboard dibuka.
- **Katalog IAP v2 (BUILD 53a):** `data/premium.json` hanya menyimpan **harga jual dan isi**. Nilai, badge `HEMAT n%`/`+n% BONUS`, dan persentase hemat dihitung runtime oleh `js/systems/pricing-model.js` dari `data/economy-anchors.json` — tidak ada angka nilai tulis tangan di `js/` maupun di katalog. Produk `active:false` (`imun_12000`, `bundle_noads`) tidak tampil; `limit.perAccount` dan jendela 72 jam dihormati; bonus pembelian pertama 2× hanya untuk `imun_500`/`imun_1000`, sekali per tier.
- **Auto-fire (BUILD 55a):** hero menembak sendiri ke musuh terdekat dalam jangkauan (default **NYALA**, toggle "Serang Otomatis" di Profil) sehingga pemain baru yang hanya menyentuh joystick tetap bertarung; aim manual / tahan SERANG tetap mengambil alih, dan pasukan mengikuti ritme tembakan hero. Gerbang "Putar HP-mu" kini hanya muncul saat gameplay (`body.in-run`) — menu dan dashboard tetap nyaman portrait.
- **PWA (BUILD 54a):** `manifest.json` + `sw.js` membuat game bisa dibuka dan dimainkan **tanpa jaringan**; cache diberi nama per-BUILD sehingga build lama tidak pernah tercampur. Prompt pasang muncul **sekali setelah run ke-3** dari dashboard dan bisa ditolak permanen (`meta.pwa`); di iOS ditawarkan petunjuk "Bagikan → Tambahkan ke Layar Utama" karena hanya itu jalur pemasangan — dan aplikasi terpasanglah yang dikecualikan dari penghapusan penyimpanan 7 hari WebKit (pertahanan save setelah keputusan tanpa-backend, ROADMAP §10 #10).
- **Kartu Imun 30 Hari:** 300 Imun instan + tetesan 50 Imun/hari × 30 hari yang **hangus bila tidak diklaim** (tidak menumpuk) + perk `noForcedAds` dan `adDailyLimitPlus2` (kuota iklan 6 → 8/hari selama kartu aktif).
- **Pacing hasil retune (BUILD 52a):** Battle Pass `100 + 25×level` XP/level, cap **120 XP/run** & **360/hari**, harga premium **800 Imun** dengan imbalan **500** (net −300/musim); pangkat **4 GP/gelombang**, 0,45/kill, 27/boss, 55 menang, 22 per bab (12.000 GP ≈ 36 run); evolusi 0,4%/kill normal, 4%/elite, 1 bagian/boss, pohon **167 fragmen** ≈ 33 run; iklan rewarded **10 Imun × 6/hari**.
- **Collision:** circle-to-circle (kuadrat jarak vs kuadrat jumlah radius) lewat **spatial hash grid sel 96 px** — hanya antar sel bertetangga.
- **Sprite:** semua karakter dirender `drawImage()` dari PNG transparan; path disimpan di JSON. `loadAllSprites()` mengembalikan Promise dan game baru mulai setelah semua termuat; `?v=BUILD` untuk cache-busting.
- **Save:** JSON murni di `localStorage` (`imunverse.save.v1`); field baru wajib aman lewat `mergeMetaDefaults` (deep-merge) agar save lama tidak pecah. Metrik run di `imunverse.metrics.v1` (ring buffer 200 run).
- **Isolasi:** gameplay → UI **hanya** lewat event bus `ui-bridge` (`emit`/`on`). Destinasi menu wajib terdaftar di `data/features.json` (gerbang *fail-closed*).
- **Monetisasi:** `js/systems/monetization.js` masih berisi hook iklan simulasi; `payment-system.js` adalah gateway simulasi. Katalog v2 menilai semua produk runtime dari `economy-anchors.json` (kurs **Rp 30/Imun**, **1 Imun = 40 Antibodi**).

## 🛠️ Tooling

```bash
npm start                     # server statis :8000
npm run validate              # ★ gerbang merge: catalog + retention + sync (0 error)
npm run validate:sync         # ★ data/*.json repo harus sama dengan angka target config
npm run test:fase1            # ★ uji headless Fase 1: boot, comeback, Battle Pass, GP, evolusi
npm run test:fase1b           # ★ uji headless Fase 1B: katalog v2, metode bayar, entitlement, tetesan
npm run test:fase2pwa         # ★ uji headless Fase 2.6: manifest, ikon, service worker, keputusan prompt
npm run test:fase2onb         # ★ uji headless Fase 2.1/2.3: auto-fire default, gerbang landscape
npm run ci:install            # pasang tools/ci/validate.yml ke .github/workflows/ (lihat tools/ci/README.md)
npm run validate:catalog      # audit katalog IAP saja
npm run validate:retention    # audit pacing/Monte Carlo/comeback/session-hook saja
npm run check                 # validasi import path, JSON, sprite, referensi index.html
npm run sprites               # regenerasi assets/sprites/*.png (butuh Pillow)
npm run ecosystem-assets      # regenerasi aset ekosistem (reference sheet, bangunan, path)
npm run check:ecosystem-assets
```

`npm run validate` **wajib lulus sebelum merge** apa pun (sejak BUILD 52a: tiga validator, dan gerbang CI `tools/ci/validate.yml` menolak PR yang tidak mem-bump `BUILD` atau yang `?v=`-nya beda dari `BUILD` — pasang sekali dengan `npm run ci:install`, lihat `tools/ci/README.md`). Jangan pernah melonggarkan toleransi validator agar build lewat — perbaiki angkanya, atau laporkan.

## 🧪 Self-test headless

Buka `index.html?autotest=1` — game menjalankan alur nyata (start run → attack → kill → level-up → mati → game over → save) dan mencetak `SELFTEST_PASS` / `SELFTEST_FAIL` ke console. Skrip `scripts/e2e-*.mjs` (Playwright) menulis bukti screenshot ke `shots/` — folder itu adalah **output**, dibuat ulang otomatis.
