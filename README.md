# 🧬 Imunverse

**HTML5 roguelike survival bertema sel imun** — kamu adalah sel imun terakhir yang bertahan melawan gelombang patogen di dalam aliran darah. Vanilla JavaScript + Canvas 2D API murni, **tanpa framework/library eksternal**.

![genre](https://img.shields.io/badge/genre-roguelike%20survival-35d0ba) ![tech](https://img.shields.io/badge/tech-vanilla%20JS%20%2B%20Canvas%202D-4cc9f0)

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

## 🏗️ Struktur Proyek

```
Imunverse/
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
- **Save**: objek JSON murni di `localStorage` (`imunverse.save.v1`); auto-save setelah akhir run, pembelian, unlock, klaim harian.
- **Monetisasi**: hook di `js/systems/monetization.js` (simulasi). Alur setelah iklan sukses — revive 50% HP + bersih-bersih musuh, 2× antibodi, daily reward — semuanya logic asli.

## 🛠️ Tooling (opsional, untuk pengembangan)

```bash
npm run sprites   # regenerasi assets/sprites/*.png (butuh Pillow)
npm run check     # validasi import path, JSON, dan kelengkapan sprite
npm start         # jalankan server statis di :8000
```

## 🧪 Self-test headless

Buka `index.html?autotest=1` — game menjalankan alur nyata (start run → auto-attack → kill → level-up → mati → game over → save) dan mencetak `SELFTEST_PASS`/`SELFTEST_FAIL` ke console. Berguna untuk smoke-test otomatis.
