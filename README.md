# 🧬 PHAGOS

**HTML5 biological survival adventure** — kamu masuk ke tubuh manusia sebagai sel imun,
bertahan melawan ekosistem patogen yang berevolusi, bermutasi jadi bentuk yang makin
kuat, dan terus menembus lebih dalam sampai sumber infeksi lenyap.
Vanilla JavaScript + Canvas 2D API murni, **tanpa framework UI eksternal**.
Satu pengecualian: **Rive** (`@rive-app/canvas`, runtime MIT) dipakai khusus
menjalankan animasi jalan hero; rig-nya dibuat dari kode lewat
`npm run rive` (lihat `ROADMAP.md` → P1) dan runtime-nya di-vendor di
`js/vendor/rive/` supaya tetap offline.

![genre](https://img.shields.io/badge/genre-biological%20survival%20%2B%20roguelike%20evolution-35d0ba) ![tech](https://img.shields.io/badge/tech-vanilla%20JS%20%2B%20Canvas%202D-4cc9f0)

> **Status: menuju V2.** Build yang berjalan sekarang masih memakai model lama
> (wave → level-up → upgrade acak + squad/shop/battle pass). Model itu **sedang
> dibongkar**. Peta jalan baru ada di **[`ROADMAP.md`](ROADMAP.md)**, diturunkan dari
> `PHAGOS_V2_REBUILD.txt` (gameplay) dan `PHAGOS_IAP_V2.txt` (economy & IAP).
>
> Ringkasnya V2: **Kill → Antibody → Mutation → Evolution → Go Deeper**, semua terjadi
> di satu perjalanan yang tidak terputus (Lung → Bloodstream → Heart → Tissue → Tumor).

---

## ▶️ Menjalankan

Karena game memakai **ES6 modules** (import/export) + `fetch()` file JSON, browser memblokirnya saat dibuka via protokol `file://` (kebijakan CORS semua browser modern). Jalankan lewat server statis lokal:

```bash
# Opsi 1 (Python, tanpa dependensi)
python3 -m http.server 8000

# Opsi 2 (Node)
npx serve .
```

Lalu buka **http://localhost:8000** — selesai. Tidak ada build step, tidak ada npm install.

> Catatan: ini batasan keamanan bawaan browser untuk ES modules, bukan ketergantungan framework. Seluruh kode tetap vanilla JS.

## 🎮 Cara Main

| Aksi | Mobile | Desktop |
|---|---|---|
| Bergerak | **Virtual joystick** (sentuh di mana saja, tarik dari titik awal sentuh) | **WASD / Arrow keys** |
| Menyerang | **Otomatis** ke musuh terdekat dalam range | Otomatis |
| Jeda | Tombol ⏸ | `Esc` / `P` |

- Bertahanlah dari gelombang patogen. Setiap 25 detik = 1 **gelombang** baru (musuh makin banyak & kuat).
- **Boss Sel Kanker** muncul tiap 5 gelombang — awas ledakan sitotoksinnya (area merah = telegraph, kabur!).
- Kumpulkan **nutrisi**: Glukosa/Amino (XP), Vitamin C (heal), Antibodi (mata uang), Sinyal Sitokin (magnet).
- **Level up** → pilih 1 dari 3 upgrade acak.
- Antibodi dipakai untuk **Upgrade Squad permanen**, **unlock hero**, dan item di **Toko** — semua tersimpan otomatis di `localStorage`.

> ⚠️ Paragraf di atas menjelaskan **model lama** yang akan diganti V2: tidak ada lagi
> halaman upgrade, squad, shop gameplay, dan battle pass. Antibody menjadi satu-satunya
> resource **evolusi (mutasi)**, XP hanya jadi pemicu kesempatan mutasi, dan “wave”
> berubah jadi penanda intensitas di dalam perjalanan biologis yang kontinu.
> Lihat [`ROADMAP.md`](ROADMAP.md) §1 dan §4.

## 🏗️ Struktur Proyek

```
Imunverse/  <!-- nama repo & branch eksperimen tetap; brand game = PHAGOS -->
├── index.html                  # Entry point + kerangka screen UI (overlay DOM)
├── styles/main.css             # Design system cream/teal/coral ala reference UI
├── data/                       # SEMUA data game (JSON, bukan hardcoded)
│   ├── heroes.json             #   4 hero (stat, attack pattern, sprite path, unlock)
│   ├── enemies.json            #   6 tipe musuh (behavior, HP, XP, splitter config, boss AOE)
│   ├── nutrients.json          #   5 item nutrisi (XP/heal/currency/magnet + drop rate)
│   ├── waves.json              #   Config gelombang (formula spawn & scaling HP)
│   ├── upgrades.json           #   Pool level-up, upgrade squad, item toko, config ekonomi
│   └── missions.json           #   Misi/achievement + kondisi unlock hero
├── assets/sprites/             # Sprite PNG transparan (generator: tools/gen_sprites.py)
└── js/
    ├── main.js                 # Bootstrap: data → sprite preload → save → loop
    ├── core/
    │   ├── game-loop.js        # rAF + delta-time nyata (bukan asumsi 60fps)
    │   ├── state-manager.js    # State global + struktur meta default
    │   ├── data-store.js       # Loader & akses data JSON + formula (XP, spawn, scaling)
    │   ├── ui-bridge.js        # Event bus (gameplay ⇄ UI, tanpa dependensi silang)
    │   └── game.js             # Orkestrator run: update/render/serang/drop/level-up/death
    ├── input/input-handler.js  # Virtual joystick (touch) + WASD/arrow (keyboard)
    ├── entities/
    │   ├── player.js           # Auto-attack: melee_swipe / ranged_pierce / ranged_homing
    │   ├── enemy.js            # chase_direct / chase_weave / splitter / boss_pattern_a
    │   ├── projectile.js       # Pierce & homing (belok kejar musuh terdekat)
    │   └── pickup.js           # Nutrisi: sebar, magnet, kedaluwarsa
    ├── systems/
    │   ├── spawn-system.js     # Wave spawning + spawn di luar viewport + weighted pool
    │   ├── collision-system.js # Spatial hash grid + circle-to-circle (100+ entity lancar)
    │   ├── upgrade-system.js   # Level-up pool acak + upgrade squad permanen
    │   ├── economy-system.js   # Antibodi, daily reward, bonus akhir run, pembelian
    │   ├── unlock-system.js    # Unlock hero dari statistik misi (atau beli di toko)
    │   ├── mission-system.js   # Misi/achievement + reward otomatis
    │   ├── effects-system.js   # Partikel & VFX (cap pool aman GC)
    │   └── monetization.js     # ★ HOOK iklan: triggerRewardedAdRevive,
    │                           #   triggerRewardedAdDoubleCurrency, checkDailyLives
    ├── render/
    │   ├── sprite-loader.js    # loadAllSprites() → Promise + cache Image + fallback dev
    │   ├── shape-renderer.js   # drawProjectile, drawParticle, drawPulseGlow, drawHealthBar…
    │   ├── camera.js           # Follow player (smoothed) + screen shake
    │   └── background.js       # Latar tubuh prosedural parallax
    ├── save/save-manager.js    # localStorage: JSON.stringify/parse + auto-save points
    └── ui/
        ├── screen-manager.js   # Registrasi & switching screen
        └── screens/            # Satu modul per layar:
            ├── loading-screen.js    ├── dashboard-screen.js
            ├── roster-screen.js     ├── upgrade-screen.js
            ├── shop-screen.js       ├── hud-screen.js
            ├── levelup-screen.js    ├── pause-screen.js
            ├── revive-screen.js     └── gameover-screen.js
└── tools/gen_sprites.py        # Generator sprite PNG prosedural (Pillow, dev-only)
```

## 🔑 Detail Teknis Sesuai Spek

- **Delta-time**: `dt = (timestamp_rAF - sebelumnya) / 1000`, di-clamp 50 ms — gameplay identik di layar 30/60/120 Hz.
- **Formula wave** (`data/waves.json`): `spawnInterval = max(0.4, 1.8 − wave×0.08)`; `enemyHP = baseHP × (1 + (wave−1)×0.12)`.
- **XP curve**: `xpToNextLevel = ceil(10 × level^1.5)`; level-up mem-pause game dan menampilkan 3 pilihan acak.
- **Collision**: circle-to-circle (perbandingan kuadrat jarak vs jumlah radius) via spatial hash grid sel 96 px — cek hanya antar sel bertetangga.
- **Sprite**: semua karakter dirender `drawImage()` dari PNG transparan; path tersimpan di JSON (`sprite`/`spriteIdle`/`spriteAttack`). `loadAllSprites()` mengembalikan Promise dan game baru mulai setelah semua termuat. Generator placeholder (canvas offscreen) hanya fallback bila file PNG tidak ada.
- **Save**: objek JSON murni di `localStorage` (`phagos.save.v1`, migrasi otomatis dari `imunverse.save.v1` lama); auto-save setelah akhir run, pembelian, unlock, klaim harian.
- **Monetisasi**: hook di `js/systems/monetization.js` (simulasi). Alur setelah iklan sukses — revive 50% HP + bersih-bersih musuh, 2× antibodi, daily reward — semuanya logic asli.

## 🛠️ Tooling (opsional, untuk pengembangan)

```bash
npm run sprites   # regenerasi assets/sprites/*.png (butuh Pillow)
npm run check     # validasi import path, JSON, sprite, dan aturan CSS layar
npm run validate  # pacing & katalog
npm start         # jalankan server statis di :8000

# Di terminal lain, dengan Playwright + Chromium (atau PW_PATH/CHROMIUM_PATH):
npm run verify:tbolt-runtime # loader + artwork Rive asli + animasi T-Bolt

# pemeriksa runtime (butuh bundle + jsdom opsional)
npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
PHAGOS_BUNDLE=.tmp-bundle.js npm run verify   # foto mutasi + layar + animasi
```

## 🧪 Self-test headless

Buka `index.html?autotest=1` — game menjalankan alur nyata (start run → auto-attack → kill → level-up → mati → game over → save) dan mencetak `SELFTEST_PASS`/`SELFTEST_FAIL` ke console. Berguna untuk smoke-test otomatis.
