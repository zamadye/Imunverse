# IMUNVERSE — DOKUMEN STRUKTUR GAMEPLAY & WORKFLOW USER

- **Tanggal:** 13 September 2026
- **Baseline:** branch `arena/01a09795-imunverse`, commit `dfa2270` (BUILD 54a)
- **Metode:** pembacaan penuh kode (`js/`, `index.html`) + seluruh `data/*.json`. Setiap
  mekanisme di bawah dikutip ke `file:baris`/`file:field`. **Tidak ada asumsi** — bila sesuatu
  tertulis di komentar tetapi tidak dijalankan kode, itu dicatat eksplisit sebagai *vestigial*.
- **Genre (dari meta description `index.html:8`):** *"roguelike survival bertema sel imun.
  Bertahanlah di dalam tubuh melawan gelombang patogen!"* — top-down 2D canvas, mobile touch +
  desktop keyboard, sesi per run ±3–8 menit.

---

## 0. TL;DR

- **Satu run** = satu sesi: arena terbuka penuh musuh (ekosistem), wave berganti tiap 25 dtk,
  boss penjaga tiap wave 5 (wave BEKU sampai boss tumbang), menang = bab kampanye bersih
  (kuota kill → boss organ → tumbang) atau lewat `finalWave` mode Klasik; Endless tanpa akhir.
- **11 hero** (4 role), masing-masing 3 skill aktif ala MLBB (unlock in-run Lv 3/5/10, upgrade Lv 15)
  + 1 passive identitas (bukan angka — mengubah cara bermain).
- **Serangan HANYA manual** (tahan tombol SERANG); tidak ada auto-attack (keputusan RONDE-5,
  termasuk untuk pasukan/ally).
- **Progression dua lapis:** in-run (XP, level, pilihan upgrade 3 kartu, pasukan join) dan
  antar-run (12 sistem meta-layer — kampanye, evolusi 5 tahap, level hero, squad, tubuh 5 sistem,
  rank GP 13 tier, mastery, misi, battle pass, codex, arena, kosmik, leaderboard lokal).
- **Semua angka di `data/*.json`** (34 file) — tidak ada satu pun angka gameplay yang
  di-hardcode di `js/` (kecuali konstanta render/juice kecil). Konten baru = data baru.
- **Menampilkan ≠ lock:** fitur baru (menu, mode, arena) memakai *progressive disclosure*
  trigger-based (`data/features.json`) — item terkunci DISEMBUNYIKAN, bukan digembok.

---

## 1. Arsitektur Aplikasi (7 lapisan)

| Lapisan | Isi | Skala |
|---|---|---|
| **Entry** | `index.html` (698 baris) — 1 kanvas + 23 `<section data-screen>` | 1 file |
| **Bootstrap** | `js/main.js` (985 baris) — urutan init, wiring event, routing awal, kontrol global | 1 file |
| **Core** | `game.js` (2.593 — mesin run), `data-store.js` (285 — muat 34 JSON + i18n data), `state-manager.js` (181 — STATE + bentuk meta + migrasi), `game-loop.js` (63 — rAF + delta-time clamp 50 ms), `ui-bridge.js` (43 — event bus satu arah), `dev-mode.js`, `version.js` | 8 file / 3.181 baris |
| **Systems** | 38 sistem (detail §8) | 5.662 baris |
| **Entities** | `player.js` (262), `enemy.js` (463), `ally.js` (97), `projectile.js` (63), `pickup.js` (82) | 967 baris |
| **Render** | `shape-renderer.js` (990), `background.js` (888 — arena teal), `camera.js` (267 — third-person feel 2D), `character-visuals.js` (403), `cine-banner.js` (401), `sprite-loader.js` (341), `walk-anim.js` (94 — sheet 8 arah), `character-preview.js` | 10 file / 3.497 baris |
| **UI** | `screen-manager.js` (94) + 23 modul layar (§9) + `cinematic.js`, `cutscene-2d/3d.js` (three.js + fallback 2D), `cutscene-player.js`, `wave-cinematic.js`, `presenter.js` (karakter bicara), `coach.js`, `skill-icons.js`, `menu-icons.js` | 6.857 baris |
| **Persistensi** | `save-manager.js` (65) — localStorage key `imunverse.save.v1`; `metrics.js` — key `imunverse.metrics.v1` (ring buffer 200 run, KPI pasif) | 2 file |
| **Input** | `js/input/input-handler.js` (385) — joystick virtual + WASD + aim | 1 file |
| **Data** | `data/*.json` — 34 file (katalog lengkap §12) | single source of truth |

**Kontrak integrasi (dipatuhi di seluruh kode):**
- Gameplay ⇄ UI hanya lewat **event bus `ui-bridge`** (`emit`/`on` — `js/core/ui-bridge.js`);
  tidak ada cross-import modul UI ke mesin run. Event yang tercatat di wiring `main.js:wireUiBridge()`:
  `toast`, `phago`, `antigen`, `playerHit`, `runstart`, `wave`, `waveBreak`, `bossBark`,
  `nftMove`, `levelup`, `revive`, `abilityBanner`, `heroUnlocked`, `bosschest`, `pause`, `resume`, `gameover`.
- Setiap ubah code/data → bump `BUILD` di `js/core/version.js` (kini `54a`) + `?v=` di `index.html`.
- String UI baru → `data/lang.json` + `TRANSLATE_FIELDS` di `data-store.js` (dwibahasa ID/EN
  tanpa reload — `i18n.js` sweep DOM).
- Destinasi menu baru → wajib terdaftar di `data/features.json` (fail-closed — §3.3).
- Sprite baru → manifest `sprite-loader` + preload.
- Field save baru → harus aman di `mergeMetaDefaults` (deep-merge ke default, §2.2).

### 1.1 Urutan boot (`main.js:boot()`)

1. `resize()` — canvas DPR-aware (cap 2).
2. `InputHandler` — joystick touch + WASD; keyboard gerak **hanya** saat `screen === 'gameplay'`.
3. `loadAllData()` — muat 34 JSON (data-store) → `loadLang()` + `initSweep()` (i18n).
4. `loadAllSprites()` — preload semua PNG dengan progress bar (fallback dev tersedia).
5. `prewarmCutscenes()` — modul three.js + VO pembuka di-background (anti-jank).
6. Save: `loadSave()` → `mergeMetaDefaults()` atau `createDefaultMeta()`; dev-mode
   (`?dev` — `dev-mode.js`) menyuntik nilai uji **in-memory saja**, tidak menimpa save asli.
7. `game.init({canvas, input})` → `wireUiBridge()` → `initMetrics()` → register 23 layar →
   wiring tombol (pause, fire, menu HUD, currency guide, back kontekstual) → `GameLoop.start()`
   → **routing awal** (§3.1).

Game loop (`game-loop.js`): `requestAnimationFrame` + delta-time dari timestamp rAF (bukan
asumsi 60 fps → konsisten di 30/60/120/144 Hz); `dt` di-clamp ≤ 50 ms (stall tidak menembus
collision); `update` hanya dipanggil saat `screen === 'gameplay' && !paused && !levelUpOpen`.

---

## 2. State & Bentuk Data Progres (meta)

### 2.1 `STATE` (transien, `state-manager.js:8-15`)

`{ screen, paused, levelUpOpen, meta }` — `screen` ∈
`loading | dashboard | roster | upgrade | shop | gameplay | gameover | title`
(pemetaan layar → state di `screen-manager.js` `APP_STATE_BY_SCREEN`; modal levelup/pause/revive
tidak mengubah state di bawahnya).

### 2.2 `meta` — bentuk lengkap persisten (`createDefaultMeta`, `state-manager.js:33-92`)

| Kelompok | Field | Isi/aturan |
|---|---|---|
| Identitas | `lang` | 'id' \| 'en' — dwibahasa penuh |
| Akun | `account` | `{uid, username, faction, createdAt}` — diisi sign-up; **wajib untuk purchase & dashboard setelah run pertama** (F21/F9) |
| Mata uang | `currency`, `imun` | Antibodi (soft) & Imun (premium) — detail di dokumen audit finance |
| Hero | `unlockedHeroes` (default `['tcd8']`), `selectedHero`, `heroLevels {id: lv}` | |
| Mode/run | `selectedMode` ('kampanye'), `selectedChapter` ('bab_luka'), `selectedArena` ('limfe'), `campaignCleared {id: true}`, `focusRun` ('seimbang') | |
| Pasukan | `allies` (1, maks 6 — +1 per bab bersih), `allyLevel` (0) | |
| Evolusi | `evoStage` (0–4), `evoParts {4 fragmen}` | drop dari run → inventory |
| Upgrade permanen | `squadUpgrades {9}`, `globalUpgrades {6}` | |
| Konsumabel | `consumables {serum_awal, ...}` | auto-dipakai saat startRun |
| Misi | `missionsClaimed []`, `questState {periodKey, accepted, claimed, baseline}` | rolling 24j/7d (F8) |
| Iklan | `adDaily {anchorTs, count}` | kuota 5×/24 jam ROLLING per akun (F8) |
| Body | `bodyState` (dibuat body-system saat pertama — 5 sistem + racun + energi + streak) | |
| Naratif | `nft {move, levelup, skill, revive}`, `bossRevealSeen`, `cinematicsSeen {}`, `codexSeen {}` | penanda "sekali sejak pernah" |
| Statistik | `stats {wins, totalKills, bossKills, bestWave, bestSurvivalTime, totalSurviveSeconds, totalRuns, totalNutrients, totalCurrencyEarned, totalXP}` | sumber gate & unlock arena |
| Leaderboard | `leaderboard []` | top-10 per mode (lokal) |
| Lain | `rank {season, gp, best}` (rank-system), `heroMastery {id: {xp, level, ...}}` (mastery-system) | lazy-init | 

> Field tambahan (lazy-init, tidak ada di `createDefaultMeta` — aman karena deep-merge):
> `meta.receipts` (≤30, `payment-system.js:127-129`), `meta.noAds`, `meta.premiumTitle`,
> `meta.founderGranted`, `meta.cosmetics {owned, skin, crown, aura}`, `meta.referral`,
> `meta.offerwall.surveyDate`, `meta.heroNotices`.

**Migrasi save lama** (`mergeMetaDefaults`): remap id hero lama→baru (`sel_t→tcd8` dsb.),
remap chapter R2 organ→kondisi (`bab_mulut→bab_luka`, `bab_limfe→bab_kanker`, …),
remap part evolusi lama→fragmen equity (`silia→equity_receptor`, …), merge `nft`, lalu
deep-merge ke default — save lama selalu valid tanpa reset.

**Kapan `writeSave` dipanggil:** akhir run (auto-save `game.finishRun`), startRun (pilih hero),
pembelian (economy/imun-economy/payment), klaim misi/daily, evolusi, body impact, sign-up —
setiap `writeSave` menyetel `updatedAt`.

---

## 3. WORKFLOW USER — MASTER FLOW

### 3.1 Routing awal (setelah boot, `main.js:933-947`)

| Kondisi | Alur |
|---|---|
| `?autotest=1` | auto sign-up 'Tester' → dashboard → self-test headless (`runAutotest`) |
| **Belum ada akun** | **LAYAR JUDUL** (F21 gameplay-first) — bukan dashboard/daftar |
| Sudah ada akun | sinematik `intro` (sekali) → **DASHBOARD** → coach tur (sekali, `meta.coachDone`) |

**Layar judul** (`title-screen.js`): tombol **MULAI** → `startOnboardingRun()`:
pilih hero default **Mako (macrophage)** + bab `bab_luka` + mode kampanye → **cutscene
pembuka 3D** (`cutscenes.json scenes.pembuka`, three.js, fallback 2D otomatis, bisa di-skip)
→ **langsung `game.startRun('macrophage')`** — tanpa dashboard di antara.
Tombol "Sudah punya akun? Masuk" → layar `auth`.

### 3.2 Dashboard (hub antar-run, `dashboard-screen.js`)

Struktur (semua elemen di `index.html`, dirender `dashboard-screen.show()`):
- **Topbar:** chip akun (tap → profil/ganti akun) + chip pangkat (→ modal rank).
- **Banner** 3 slide (campaign / endless / —).
- **Quick row** (gated: Misi, Daily dst. — `features.json` target `quick`).
- **Kartu:** Kampanye (progres bab), Mode (Endless — terkunci sampai `wins ≥ 1`),
  Evolusi (tahap + tombol EVOLUSI bila part cukup), Rekor (leaderboard lokal top-3),
  **Tubuh** (5 sistem tubuh + recovery iklan + suplemen + tombol FOKUS → prep).
- **PLAY besar** (`btn-play-big`, handler delegasi di `main.js:640-657`):
  - `totalRuns < 3` → **otomatis** bab pertama yang belum tamat + mode kampanye → `startRun`.
  - `totalRuns ≥ 3` → layar **Peta Tubuh** (`campaign`) — pemain memilih.
- **Dock bawah** (Play/Heroes/Squad/Shop) — tombol dock selalu tampil; yang terkunci abu-abu
  + label syarat (diblokir klik, `feature-gate.isDockGated`).
- **Sidebar** (Home/Kampanye/Bio-Pedia/Battle Pass/Rekor/Tubuh — target `side`, gated).
- **Minimal-home:** `totalRuns < 3` → class `minimal-home` (layar ramping, fokus PLAY — F21).
- **Overlay notifikasi hero baru** (antrean `heroNotices`) + badge unlock (`unlock-badge-system`).

### 3.3 Progressive disclosure — `data/features.json` (satu-satunya sumber gerbang)

Item terkunci **disembunyikan** (bukan gembok) sampai trigger terpenuhi
(`feature-gate.js:gateFor` — semua syarat AND; dev-mode membuka semua):

| Destinasi | Trigger | Target UI |
|---|---|---|
| Roster (Heroes) | sejak awal | dock + quick (run 3) |
| Bag | 3 run | dock + quick |
| Lab Pasukan (upgrade) | 3 run + 150 Antibodi | dock + menu2 HUD |
| Arena | 3 run | dock + menu2 HUD |
| Shop | 5 run | dock + quick + menu2 HUD |
| Bio-Pedia (codex) | wave 10 | dock + quick + secondary + menu1 |
| Daily | 2 run | quick |
| Rank (Pangkat) | 15 run | quick + secondary + menu1 |
| Rekor | 15 run | side |
| Tubuh (body) | 4 run | side |
| Peta Tubuh (campaign) | 3 run | secondary + side + menu1 |
| Battle Pass (bp) | 6 run | quick + secondary + side + menu1 |

**Menu HUD in-run** (satu-satunya pemetaan tombol→gerbang, `feature-gate.js:HUD_MENU_GATES`):
- **menu1** (perjalanan): Peta Tubuh · Pangkat · Bio-Pedia · Battle Pass
- **menu2** (regu): Heroes · Koleksi (codex) · Shop · Arena · Lab Pasukan
- **Fail-closed:** id yang tidak terdaftar di `features.json` dianggap TERKUNCI
  (`hudMenuGate`) — tidak ada jalur menu yang bisa lolos gerbang.

### 3.4 Pre-run

- **Peta Tubuh** (`campaign-screen.js`): path vertikal 6 organ — node ✓ bersih (bisa diulang),
  ● AKTIF (pulsing), 🔒 terkunci (bab sebelumnya harus bersih). Tap node → **briefing**
  (cerita organ sakit + tujuan + reward + jumlah pasukan) → CTA **SIAP TEMPUR** → **prep**.
- **Battle Prep** (`prep-screen.js`): SATU layar SATU keputusan — **pilih hero** (satu-satunya).
  Baris Mode hanya dirender bila Endless sudah terbuka (sebelumnya mode dipaksa kampanye).
  Fokus run selalu `seimbang`; arena: kampanye = arena bab, endless = arena terbaik
  otomatis (transparan di ringkasan loadout).
- Dari roster: tombol mulai run (`rosterScreen.startSelectedRun`).

### 3.5 Dalam run (HUD, `hud-screen.js`)

Pill HP (potret + bar — **tap = pause**), pill wave, timer, chip kill/currency/XP
(tap chip + `+` → modal panduan currency: daftar sumber Antibodi/Imun yang JUJUR dengan
mekanik), minimap bulat, panel Misi (auto-accept E2, tampil 3, tombol **KLAIM** saat selesai,
bisa dilipat), 2 menu HUD (§3.3), kluster kanan-bawah (pause II, suara), bar skill 3 slot
(+ badge rank), meter fagositosis (R4), chip memori antigen (R3), banner nama skill pertama
cast (NFT), presenter RIA/Amara di tepi layar (non-blocking, auto-hilang).

### 3.6 Akhir run

- **Matinya player** → `handlePlayerDeath` (`game.js:1284-1292`): sekali run → modal
  **REVOKE/REVIVE** (tawaran iklan, countdown 5 dtk; sukses = 50% HP + bersih musuh sekitar —
  `game.confirmRevive`); tolak/habis → **GAME OVER**.
- **Game over / victory** (`gameover-screen.js`): bintang 1–3 (berbasis wave), count-up
  currency, tombol **rewarded ad 2×** (logic asli `applyDoubleCurrency`), tombol dashboard /
  main lagi.
- **Back kontekstual** (`main.js` `backToContext`): jika run masih hidup, tombol kembali/tutup
  pulang ke HUD + resume (bukan melempar ke dashboard).

### 3.7 Alur akun (F21 + F9)

1. User baru: title → MULAI → cutscene → run 1 **tanpa akun**.
2. Run 1 berakhir → `__IMUNVERSE_goDashboard` menolak tanpa akun → layar **auth**:
   **DAFTAR** (nama + sandi + fraksi — Imun playable, Virus = SEGERA, `factions.json`)
   → progres tersimpan terikat akun.
3. **Semua purchase wajib akun** (dua lapis: UI `requireAccount('shop')` + `payOrder`
   menolak — audit finance §1).

---

## 4. RUN LIFECYCLE — MESIN GAMEPLAY (`game.js`)

### 4.1 `startRun(heroId)` (`game.js:109-338`)

Urutan persiapan (semua angka dari data):
1. Validasi hero → simpan `selectedHero` + save.
2. **Konsumable auto-use** (dipakai bila dimiliki, 1× masing-masing):
   `serum_awal` +25% damage · `vaksin_awal` +30 HP · `kopi_limfa` +12% speed ·
   `pelindung_lendir` serap 1 serangan · `koin_ganda` pengali antibodi run
   **×1,3 (30% — cap premium Fase 18, `game.js:1895`)**; NB toast-nya menulis "+50%"
   (`game.js:149`) — teks UI ≠ angka aktual (temuan §13-6).
3. Hitung statistik: `computePlayerStats` (baseStats hero × tier multiplier ×
   squad permanen `squadMultipliers` × upgrade in-run) → `applyMetaMultipliers`
   (evolusi + bonus arena) → `applyBodyModifiers` (kondisi tubuh) → **`applyGlobalUpgrades`**
   (upgrade Imun global — `retention-system.js:48-66`, `game.js:477`).
4. Ambil `mode` (kampanye/endless), `chapter` (khusus kampanye), **mutator harian**
   (hanya endless, seeded per tanggal), `arena` (per bab / auto terbaik), focus run.
5. Buat run object: player, `spawnSys`, `skills` (SkillSystem + cdMult squad/passive),
   shield/evade/protect (lapisan pertahanan Fase 12), `parts`, `combo`, `boss`,
   **objective kampanye** `{quota, bossSpawned, bossDefeated}`.
6. **Pasukan imun**: `squadPlan.total = min(6, max(meta.allies, 1 + floor(allyLevel/3)))` —
  join bertahap saat hero mencapai **Lv 3/5/10/15** in-run (bukan di awal — `game.js:305-322`).
7. 2 patogen "dampak-dini" ditanam dekat player (±3 dtk pertama tidak sunyi).
8. `emit('runstart')` → HUD reset, musik tema per bab, disclosure menu, badge, panel misi.

### 4.2 Loop per-frame `update(dt)` (`game.js:498-819`) — pipeline 13 tahap

| # | Tahap | Sumber logika |
|---|---|---|
| 0 | Hit-stop freeze (kill besar; berlapis per tier + cooldown 0,24 dtk agar tidak membebukan) | `game.js:510-521`, `gamefeel.json hitStop` |
| 1 | Heartbeat low-HP (<30% → detak tiap 1,2 dtk) | `gamefeel.json lowHp` |
| 2 | Hazard genangan toksin (DoT 0,8 dtk/tick) + zona inflamasi (DoT + cytokine storm) + jejak kemotaksis + ledakan elite VOLATILE + **boss Toksin Raksasa menumbuhkan genangan periodik** | Fase 9 / R5 / R7 / V2P5 |
| 3 | **Passive hero** per-frame (regen Treg, aura slow Baso, reveal pulse Nyx) + meluruh mark | `passive-system.js` |
| 4 | Buff tempur (damage/cooldown/xp/speed — countdown + recompute) + regen permanen | Fase 8.4 |
| 5 | **Kampanye:** `kills ≥ quota` → boss organ muncul (sekali) / bab tanpa boss → menang | `game.js:591-604` |
| 6 | Combo decay (5 dtk tanpa kill → reset) | `retention.json combo` |
| 7 | **Tembak manual** — hanya saat tombol SERANG ditahan (`input.isFiring`) | RONDE-5 |
| 8 | **Pasukan**: follow player; menembak **hanya** saat SERANG ditahan (proyektil pierce) | `game.js:614-640` |
| 9 | Input & player (velocity smoothing accel 13 / decel 17 / stopSnap 40 — `combat.json movement`) | `player.js` |
| 10 | **Wave & spawn** (event `newWave`/`waveBreak`/`bossSpawn` — §4.3); milestone XP tiap 10 wave (+20+3w); menang Klasik bila `wave > finalWave`; Endless bonus tiap 5 wave (wave×5×band) | `spawn-system.js` |
| 11 | Update musuh (behavior + AOE boss) + phagocytosis window | `enemy.js` |
| 12 | Spatial grid → proyektil → **peluru musuh** → collision proyektil-musuh (damage pipeline §5.4) → separation → collision player-musuh (contact telegraph) → pickup → DOT → efek + cooldown skill | `collision-system.js` |
| 13 | Kamera third-person (look-ahead, anchor 62% tinggi, zoom kecepatan, epic-zoom zona bahaya) → bersihkan entity mati → **antrean level-up modal** | `camera.js` |

### 4.3 Sistem wave & spawn (`spawn-system.js` + `data/waves.json`)

Formulasi (semua konstanta di `waves.json`):
- **Durasi wave 25 dtk**; istirahat antar wave `breakDuration 2,5 dtk`; wave boleh
  **early-clear** bila tidak ada musuh reguler tersisa (min. 8 dtk).
- **Interval spawn** = `max(0,4, 1,8 − wave×0,08)` dtk; trickle (pemburu) ×1,55 interval.
- **Scaling musuh:** HP `baseHP × (1 + (wave−1)×0,105) × mutator`; speed +0,015/wave (cap ×1,6);
  **musuh ikut level player** (Fase 18: HP +6%/lv, speed +0,4%/lv cap 12% — `progression.json`).
- **Wave 1 ramp-up:** 15 dtk pertama interval ×0,45→1 (aksi terasa sejak awal).
- **Boss tiap 5 wave** (roster bergantian `sel_kanker → toksin_raksasa`, HP bonus +35% per
  index boss). **GATEKEEPER (Fase 18):** wave **BEKU** sampai boss penjaga tumbang; selama itu
  musuh reguler hanya menetes (×2,2 interval); XP yang ditahan (`xpBank`) cair penuh saat gerbang
  terbuka. Boss <40% HP → **enrage** (speed ×1,3, interval AOE ×0,62, telegraph ×0,85).
- **ECOSYSTEM:** arena = populasi hidup — target `10 + 11×(wave−1)` (cap 180), top-up tiap
  1 dtk batch 3 pada ring 340–950 px dari player, **60% pemburu** (langsung menghampiri),
  sisanya patroli bersarang. Cap global `maxAliveEnemies 250`.
- **Sarang (F26):** per wave `2 + floor((wave−1)/4)` (cap 10) — 1 dekat (330 px) + sisanya
  jauh (620 px); ukuran pack `3 + 0,45×(wave−1)`. AI nest: `guard/patrol → chase` bila player
  masuk aggro 380 px, `return` bila lewat leash 920 px; **pack aggro** (kawan di sekitar
  ikut bangun, radius 260 px).
- **Elite terencana (V2P5):** mulai wave 3, `1 + floor((wave−3)/4)` (cap 3) — dipromosikan dari
  anggota PERTAMA sarang **jauh** (momen yang bisa diantisipasi, bukan RNG murni):
  HP ×2,6, radius ×1,25, + 1 affix acak: **BRUTAL** (dmg ×1,5) · **GESIT** (speed ×1,35,
  windup 0,28) · **REGEN** (2%/dtk) · **LEDAK** (bangkai meledak setelah fuse 0,5 dtk —
  radius 90, dmg 12, bisa dihindari).
- **Pilihan tipe musuh:** weighted random dari `enemies.json` (field `weight` + `minWave`) —
  §5.2. Musuh mulai **berludah proyektil di wave 2+** (30% pengejar biasa, semua elite).

### 4.4 Menang & hasil run

**Syarat menang:**
- **Kampanye:** kuota kill bab tercapai → boss organ muncul → boss tumbang →
  `winRun()` (toast "Organ bersih!", bonus bab `chapter.reward`). Bab 1 (`bab_luka`) tanpa
  boss → menang langsung saat kuota.
- **Klasik/Endless:** tidak ada `finalWave` di `modes.json` → endless murni; mode Klasik
  berakhir lewat quit/kematian.
- **Endless:** bonus antibodi tiap 5 wave: `round(wave×5×band.rewardMult)`
  (band Awal 1,5× / Tengah 1,0× / Akhir 1,3× — `progression.json bands`).

**`finishRun` (`game.js:1888-2053`) — semua yang cair per run:**
1. **Antibodi pulang** = `round((currencyEarned + bonusCurrency + computeRunEndBonus +
   waveBonus) × doubleMult)` dengan `waveBonus = floor((wave×8 + kills×0,5 + boss×50) ×
   band.rewardMult)` (Fase 18) dan `computeRunEndBonus = wave×12 + kills×1`
   (`economy-system.js:63-67`); `doubleMult = 1,3` bila `koin_ganda` dipakai (cap premium 30%).
2. **Statistik** ditulis: wins (victory), campaignCleared + **ally +1 (cap 6)** per bab,
   totalKills, bossKills, bestWave, survival time, totalRuns, totalNutrients, totalXP.
3. **Fragmen evolusi** run → inventory `meta.evoParts`.
4. **BP XP** = `heroLevel×40 + wave×15 + kills` (`game.js:1931`, `addBpXP`).
5. **GP pangkat** = `wave×18 + kill×2 + boss×120 + victory 250 + chapter 100` (`applyRunGP`).
6. **Mastery** hero yang dimainkan: `kills×2 + wave×10 + victory 80` XP (reward 15 ant/lv).
7. **Kondisi tubuh**: racun (0,3/kill), energi (−8/run), pemulihan sistem fokus, toxic seep,
   streak milestone (`registerRunResult`).
8. **Leaderboard lokal** per mode (top-10: wave → waktu → kill).
9. **Misi selesai → reward otomatis** + **auto-unlock hero dari statistik** (toast + overlay
   "HERO BARU" + penjelasan Amara).
10. `writeSave` (auto-save) → layar gameover dengan ringkasan lengkap (termasuk gain BP,
    mastery, rank — object payload `emit('gameover')`).

### 4.5 Level & XP in-run

- Kurva: **XP ke level berikutnya = `ceil(280 × level^0,45)`** (`data-store.js:281-285`,
  `upgrades.json xpCurve`); roll XP per kill dari `retention.json xpPerKill`:
  kecil 5–8, medium/hard 12–15, boss 50; combo ×3 dalam 5 dtk memberi `xpMult 1,2`).
- **Level up** → pause 0,3 dtk + ledakan emas + modal **3 pilihan acak** dari pool 11
  (`levelUpPool`), rarity weights 70/24/6, **pity** (2 roll gagal rare+ → roll berikutnya
  dipaksa), **synergy bonus 25%** (upgrade sesuai role — `luRules`).
- **Pasukan join** di Lv 3/5/10/15 in-run (§4.1.6). Skill unlock Lv 3/5/10, upgrade skill
  Lv 15 (max rank 3) — `skill-unlock.js` (source of truth = `run.level`, tidak ada level kedua).

**Pool upgrade in-run (11, `upgrades.json levelUpPool`):**

| id | Efek | Stack maks | Rarity |
|---|---|---|---|
| damage | +15% damage | 99 | common |
| attackSpeed | +12% speed serang | 99 | common |
| moveSpeed | +8% gerak | 99 | common |
| maxHP | +20 HP (flat) | 99 | common |
| attackRange | +12% jarak | 99 | common |
| magnet | +25% magnet | 4 | common |
| lifeSteal | +1% life steal | 4 | rare |
| pierce | +1 pierce | 3 | rare |
| critChance | +4% crit | 5 | rare |
| antigen_boost | memori antigen lebih cepat | 3 | rare |
| projectileCount | +1 proyektil | 4 | **epic** |

---

## 5. COMBAT & ENTITAS

### 5.1 Player (`player.js`)

- Gerakan: velocity smoothing (accel 13 / decel 17 — berhenti tajam via stopSnap 40 px/dtk
  residual; `combat.json movement`). Buff jejak kemotaksis langsung mengali speed per-frame.
- **Serangan 100% manual**: `tryFire` dipanggil hanya saat tombol SERANG ditahan/tap;
  assist-aim membidik musuh terdekat dalam range (`findAttackTarget`); **aim** = tahan+tarik
  tombol SERANG (aim stick ala MLBB, threshold 12 px) atau kursor mouse; tanpa keduanya =
  auto-aim. Tidak ada auto-attack di kode mana pun (RONDE-5).
- Lapisan pertahanan saat kena hit (`game.damagePlayer`, `game.js:1240-1283`):
  `pelindung_lendir` (serap 1) → `shield` (skill) → `evadeCharges` (skill Eos) →
  `protectMult` (skill defensif) → `armor` squad permanen → `takeDamage` → i-frames.
- Statistik run = baseStats × tier × squad × in-run × serum × evolusi × arena × body
  (§4.1) — di-recompute setiap upgrade/buff berubah (`recomputePlayerStats`).

### 5.2 Musuh — 13 tipe (`data/enemies.json`)

Behavior didukung `enemy.js`: `chase_direct` (lurus), `chase_weave` (zig-zag sinusoidal),
`splitter` (mati → pecah jadi virion kecil), `hazard_drift` (drift lambat, identitas
"jangan disentuh", contact instan), `boss_pattern_a` (lambat, HP besar, AOE ter-telegraf
berkala).

| id | tier | behavior | HP dasar | dmg | spd | XP | bobot | min wave | keluarga visual |
|---|---|---|---|---|---|---|---|---|---|
| bakteri | medium | chase_direct | 20 | 8 | 64 | 2 | 60 | 1 | bacterium |
| virus | medium | **splitter** | 34 | 10 | 54 | 4 | 28 | 2 | virus |
| virion | kecil | chase_direct (elite) | 10 | 6 | 95 | 1 | — | 2 | virus (hasil split) |
| bakteri_gn | medium | chase_direct | 26 | 9 | 58 | 4 | 20 | 3 | toxic_bacterium |
| parasit | hard | chase_weave (elite) | 16 | 7 | 100 | 3 | 22 | 4 | parasite |
| protozoa | medium | chase_weave | 42 | 12 | 72 | 6 | 16 | 4 | protozoa |
| bakteri_gp | hard | chase_direct | 44 | 11 | 46 | 5 | 22 | 4 | armored_bacterium |
| toksin | medium | hazard_drift | 10 | 6 | 7 | 1 | 12 | 5 | toxin |
| spora | hard | chase_direct | 62 | 12 | 46 | 6 | 16 | 7 | fungus |
| prion | hard | hazard_drift | 40 | 12 | 30 | 8 | 8 | 9 | crystal |
| sel_abnormal | hard | hazard_drift | 55 | 14 | 84 | 10 | 9 | 11 | abnormal_cell |
| sel_kanker | boss | boss_pattern_a | 650 | 20 | 36 | 60 | — | 5 | cancer |
| toksin_raksasa | boss | boss_pattern_a | 150 | 16 | 40 | 60 | — | 1 | toxin_boss |

- **Contact attack bertelegraph (V2P2):** pengejar tidak melukai lewat sentuhan pasif — ia
  berhenti, `windup` 0,35 dtk (berdiri + shiver 26 Hz), `strike` (lunge 220 px), cooldown 0,9 dtk,
  tolerance 1,35× → **dodge saat windup = whiff** (`combat.json contactAttack`).
  Contact instan hanya untuk `hazard_drift`, boss, dan proyektil.
- **Enemy bullets:** peluru patogen terbang & menabrak player (`updateEnemyBullets`).
- **Provoke:** musuh yang KEHIT (peluru) langsung membalas (`provokeEnemy`).

### 5.3 Boss & peti

- Boss bab (kampanye): `spawnChapterBoss` — HP = baseHP × scalers × `hpMult` bab
  (1,0/1,3/1,65/2,1/2,8) × boss-index multiplier; bisa bawa `areaAttack` custom.
- Boss endless: roster `sel_kanker → toksin_raksasa` (cycle), enrage 40% HP.
- **Toksin Raksasa** (Fase 9) menumbuhkan **genangan racun** periodik (interval dari
  `enemies.json hazardDrop`, dps 5, life 10 dtk).
- **Peti boss** (`game.openBossChest`, `game.js:1459-1508`): saat boss tumbang gameplay
  dipause (titik istirahat alami) — isi `waveBonusPerWave + wave×2` antibodi + **1 fragmen
  evolusi (di-guarantee)**; opsi iklan reward → isi ×2 (selalu opsional, masuk kuota).

### 5.4 Damage pipeline (proyektil → musuh, `game.js:735-770`)

```
dmg = proj.damage
    × antiParasitMult (Eos: 1,5× ke parasit)
    × crit (8% → ×1,5 — gamefeel.json; + bonus passive bcell)
    = modifyOutgoingDamage (mark +10% · execute T-Bolt · passive on-hit)
    × antigenDamageMult (memori antigen: +15/30/50% per tier; T2 tembus armor 10%)
→ takeDamage (armor) | takeDamageRaw (ignore armor)
→ knockback mikro (boss imun) → hit feedback → kill? onEnemyKilled
```

### 5.5 `onEnemyKilled` — apa yang terjadi saat kill (`game.js:1608-1794`)

- Kill dimakan fagositosis (R4) → **tanpa drop** (konversi resource: heal + fuel ultimate).
- Combo +1 (window 5 dtk); tiap kill ke-10 → bonus XP `10 + count`.
- Juice: hit-stop berlapis (kill 30 ms / elite 50 / boss 90 / crit 25 / ult 60 ms), micro-shake,
  death pop, burst partikel, **kill VFX per tahap evolusi** (ring→slash→angin→petir→legenda).
- Elite VOLATILE mati → ledakan tertunda (fuse 0,5 dtk, bisa dihindari).
- **Boss tumbang** → XP 60, camera shake 0,65, peti (§5.3); boss bab → menang; boss penjaga
  → gerbang wave terbuka + flush XP bank.
- **Drop fragmen evolusi:** normal 6% / elite 30% / boss 2× guarantee
  (`evolutions.json dropChanceNormal/Elite, bossGuaranteedParts`), dikali `arena.bonus.partMult`.
- Koin antibodi: kecil 15% ×1 · medium 45% ×1 · hard 2× pasti (+60% nutrisi bonus)
  (`game.js:1644-1658`); boss guarantee 2 koin + vitamin_c (`nutrients.json`).
- **TANPA Imun per kill** (RONDE-4 — akruan fantom dihapus; Imun hanya dari IAP/BP/iklan).
- Memori antigen +1 kill/tipe; cascade opsonisasi (R6: musuh tagged mati → rantai damage).

### 5.6 Lima modul combat (R3–R7, `data/modules.json` — semua aktif)

| Modul | Fungsi | Parameter kunci |
|---|---|---|
| **Memori Antigen** | build adaptif: bunuh tipe X terus → damage vs X +15/30/50% (tier 1/2/3); T2 tembus armor 10%; splash 35% (radius 70) | 15 kill dasar, exp 1,3, max tier 3 |
| **Fagositosis** | hero "menelan" musuh <20% HP (window 1,8 dtk, range 160) → +8 heal +25 fuel meter (ult) | meter max 100 |
| **Zona Inflamasi** | DoT lantai (8%/0,5 dtk) + **cytokine storm** (intensity 8 → DoT ×2,5) + splash hero 12 | max 3 zona, radius 90 |
| **Tag Cascade** | musuh tagged mati → rantai opsonisasi (50% dmg, decay 0,6, max 4 hop; tier 3 = 3 target) | window 0,6 dtk, hit-stop 70 ms |
| **Jejak Kemotaksis** | skill gerak meninggalkan jejak 4 dtk → +18% speed saat menapak jejak matang (6 dtk) | max 60 segmen |

### 5.7 Combat feel (`data/gamefeel.json`)

Knockback (proyektil 120 / melee 150 / boss imun) · hit-stop (kill 0,03 s … boss 0,09 s) ·
crit (8%, ×1,5, warna oranye, angka 1,35×) · damage number (ukuran 13 + 0,125/dmg, cap +9) ·
kill pop (0,15 s → 1,3×) · shake (hit 0,035 … boss 0,65, throttle 55 ms) · **haptik**
(pattern getaran per event: kill 12 ms, elite 25, playerHit [30,40,30], boss [60,50,60]) ·
low-HP heartbeat (<30% HP, tiap 1,2 dtk).

---

## 6. HERO, SKILL & EVOLUSI

### 6.1 Roster — 11 hero (`data/heroes.json`)

Tier + stat multiplier (heroes.json `tiers`): common ×1,0 · uncommon ×1,07 · rare ×1,15 ·
epic ×1,24 · **legend ×1,35**.

| Hero | Role | Tier | Pola serang | Passive (mengubah cara main, bukan angka) | 3 skill (S1/S2/ULT) | Unlock |
|---|---|---|---|---|---|---|
| Mako (macrophage) | Tank | common | ranged_pierce | Fagositosis — heal saat kill | Taunt / Sikap Bertahan / Devour | default |
| Dendri (dendritic) | Support | rare | ranged_homing | Presentasi Antigen — mark saat hit | Mark Target / Heal Pulse / Overcharge | 150 Imun |
| Neutron (neutrophil) | Damage | uncommon | ranged_pierce | Amukan Granula — frenzy saat kill | Grenade / Adrenaline / Blitz | 100 Imun |
| Eos (eosinophil) | Damage | uncommon | ranged_homing | Granula Toksik — poison on-hit (+1,5× ke parasit) | Poison Dart / Evade / Parasite Strike | stat-gate |
| Baso (basophil) | Support | rare | ranged_homing | Awan Histamin — aura slow | Histamine / Allergy / Chemical Storm | 260 Imun + 2 bos |
| Mastia (mastcell) | Tank | epic | melee_swipe | Degranulasi — balas saat kena hit | Barrier / Sting / Anaphylaxis | 700 Imun + 500 kill |
| T-Bolt (tcd8) | Damage | uncommon | ranged_pierce | Sitotoksik — execute bonus | Precision Shot / Lock On / Execute | stat-gate |
| Helia (tcd4) | Support | uncommon | ranged_homing | Komando Sitokin — pengurangan CD skill | Rally / Command / Battle Cry | stat-gate |
| Treg (treg) | Support | epic | ranged_homing | Toleransi — regen | Pacify / Shield / Truce | 700 Imun + 300 kill |
| Bella (bcell) | Damage | rare | ranged_homing | Memori Antibodi — bonus crit | Antibody / Empower / Plasma Rain | 350 Imun + Gel. 8 |
| Nyx (nkcell) | Damage | **legend** | melee_swipe | Sensor Sitolitik — reveal pulse (pengungkap Sel Abnormal) | Backstab / Shadowstep / Annihilate | 200 Imun |

Jumlah unlock Imun = **2.460** (detail & audit: dokumen finance §4.2).

### 6.2 Skill aktif (33 total, `data/skills.json`)

- Sistem ala MLBB: tiap hero 3 skill (S1/S2/ULT); **data-driven penuh** — skill = daftar efek
  primitif (area, strike, heal, buff, shield, mark, dash, …) yang dieksekusi `SkillSystem`
  (`skill-system.js`) — tidak ada logika hero di-hardcode.
- Cooldown 6–26 dtk; multiplikasi CD dari upgrade JURUS permanen (squad) + passive Helia.
- **Progression in-run** (`skill-unlock.js`): Lv 3 = S1, Lv 5 = S2, Lv 10 = ULT, **Lv 15 =
  sistem upgrade skill** (rank 1–3: damage naik, CD turun — Shift+1/2/3 desktop).
- Guard gameplay di `game.useAbilityBySlot` — klik UI tak bisa membocori aksi saat locked.

### 6.3 Evolusi hero — 5 tahap (`data/evolutions.json`)

Fragmen (part) dari drop musuh/boss → upgrade di Bag (`bag-screen`):

| Tahap | Nama | Damage | Kill FX | (field `ability`) |
|---|---|---|---|---|
| 0 | Polos Base | ×1,00 | ring | tebasan |
| 1 | Equity I — Reseptor | ×1,08 | slash | tebasan |
| 2 | Equity II — Membran | ×1,16 | wind | siklon |
| 3 | Equity III — Efektor | ×1,25 | bolt | petir |
| 4 | Full Equity | ×1,35 | legend | beku |

- Biaya tiap tahap: 5 fragmen receptor / 5 membran / 5 effector / 2 inti memori
  (`evolutions.json stages.parts`); visual equity per hero dari `character-designs.json`
  (5 stage visual × 11 hero).
- **Temuan kode (jangan salah paham):** field `ability` per tahap (tebasan/siklon/petir/beku —
  `abilities.json`) dan kelas `AbilitySystem` masih ada di kode, **tetapi tidak
  di-instantiate di mana pun** (import `game.js:58` tanpa pemanggilan `new`) — sisa sistem
  4-tombol pra-Fase 12 yang digantikan 3-skill MLBB. Yang **nyata** dari tahap evolusi:
  multiplier damage permanen + kill FX + stage visual.

### 6.4 Pasukan imun (ally)

- **Permanen:** `meta.allies` (1–6; +1 per bab kampanye bersih) + `meta.allyLevel`
  (+12% dmg & +4% speed per level, 3 anggota/level, biaya 220×1,4^lv — `upgrades.json allyUpgrade`).
- **In-run:** join bertahap di hero Lv 3/5/10/15; follow player; menembak pierce **hanya**
  saat SERANG ditahan; total `min(6, max(allies, 1 + floor(allyLevel/3)))`.

---

## 7. METALAYER — PROGRESSION ANTAR-RUN

| Sistem | Mekanika (kode) | Data |
|---|---|---|
| **Kampanye** | 6 bab "Perang Sang Tubuh" — kuota kill → boss organ → organ bersih; bab berikutnya terbuka berurutan; bisa diulang; +1 pasukan/bab (cap 6); reward antibodi | `campaign.json` — §7.1 |
| **Mode** | Kampanye (default) · Endless (unlock: `winNormal` — menangkan 1 bab; mutator harian; bonus ×5 wave) | `modes.json` |
| **Mutator harian** | 8 mutator, dipilih **SEEDED RNG per tanggal** (mulberry32 + hash djb2) — semua player se-dunia dapat yang sama di tanggal yang sama, tanpa server; khusus Endless | `mutators.json` — §7.2 |
| **Arena** | 5 arena, bonus run berbeda; unlock dari statistik nyata | `arenas.json` — §7.3 |
| **Level hero** | per-hero, 20 lv, 150×1,35^lv antibodi, +6% dmg +8% HP/lv | `upgrades.json heroUpgrade`, `economy-system.js:93` |
| **Upgrade squad** | 9 tipe (damage/vitality/weapon/jurus/armor/swift/attack/range/nutrition), 8–10 lv, growth 1,5–1,65 | `upgrades.json squadUpgrades` |
| **Upgrade global (Imun)** | 6 item semua-hero, 50×1,15^lv — power-feel premium (audit finance §4.1) | `upgrades.json globalUpgrades` |
| **Kondisi tubuh** | 5 sistem (sirkulasi/pencernaan/saraf/imun/limfatik), health 0–100; decay 1/hari ROLLING; sistem kritis (<20) = penalti run (mis. sirkulasi → cooldown ×1,25); racun +0,3/kill (cap 100) → DoT; energi −8/run (cap 100); fokus run 6 pilihan; pemulihan: kill (fokus +10 menang/+3 pendek), suplemen 250 ant (+20), iklan +18; streak perfect (≥80) 3 hari → milestone | `body-systems.json`, `body-system.js` |
| **Pangkat (GP)** | 13 tier 0–12.000 GP (Sel Baru → Penjaga Sejati); GP per run: wave 18 + kill 2 + boss 120 + victory 250 + chapter 100; **tidak bisa dibeli**; season + soft-reset ke floor (tanpa demosi — untuk anak) | `ranks.json`, `rank-system.js` |
| **Mastery hero** | XP = kill×2 + wave×10 + victory 80; ambang 100→6.100 (10 lv); reward 15 ant/lv + gelar di lv 3/6/9/10; tidak bisa dibeli | `mastery.json`, `mastery-system.js` |
| **Misi** | 15 one-time (905 ant) · 3 harian (47/24 j rolling) · 2 mingguan (180/7 d rolling); HUD panel auto-accept + KLAIM; reward otomatis saat selesai | `missions.json`, `mission-system.js` |
| **Battle Pass** | 500 Imun (sekali/musim), 30 lv, XP per run = lv×40 + wave×15 + kills; 2 track (gratis 100 Imun/1.700 ant; premium 400 Imun/840 ant + 4 skin + 2 acc); klaim manual | `battlepass.json`, `battlepass-system.js` |
| **Kodex (Bio-Pedia)** | 43 kartu sains; terbuka saat pemain **bertemu** entitas di dunia (bukan menu); dua kedalaman (anak / dewasa muda); dwibahasa | `codex.json`, `codex-system.js` |
| **Leaderboard lokal** | top-10 per mode (wave → waktu → kill), nama + fraksi + hero | `meta.leaderboard` |
| **Kosmetik** | 5 skin + 2 aksesori (visual-only — audit finance §4.3) | `cosmetics.json` |
| **Iklan reward** | 5 placement, kuota 5×/24 j rolling (30 Imun · peti boss ×2 · revive · currency run ×2 · pemulihan tubuh) | `monetization.js` |

### 7.1 Bab kampanye (`data/campaign.json`)

| Bab | Organ | Kuota | Reward | Boss | HP boss |
|---|---|---|---|---|---|
| bab_luka | Luka Kecil | 25 | 60 ant | — (menang saat kuota) | — |
| bab_demam | Demam Pertama | 30 | 90 ant | Raja Flu Mutan (virus) | ×1,0 |
| bab_racun | Keracunan | 35 | 120 ant | Ratu Racun (toksin_raksasa) | ×1,3 |
| bab_alergi | Alergi Parah | 40 | 150 ant | Alergen Purba (spora) | ×1,65 |
| bab_kanker | Ancaman Tersembunyi | 45 | 200 ant | Bayang Dalam (sel_kanker) — **cutscene reveal** 1× | ×2,1 |
| bab_final | Pertahanan Terakhir | 50 | 300 ant | Mahakrisis (prion) | ×2,8 |

### 7.2 Mutator harian (`data/mutators.json` — 8)

Patogen Ganas (HP+20%, XP+30%) · Demam Tinggi (speed+18%, currency+40%) · Badan Lemas
(player speed−15%, magnet+25%) · Serangan Membara (player dmg+25%, HP−12%) · Hujan Nutrisi
(nutrisi+35%, HP+5%) · Arus Panas (CD−20%, speed+8%) · Kawanan Padat (spawn+25%, XP+15%) ·
Saluran Waspada (dmg musuh+20%, magnet+20%).

### 7.3 Arena (`data/arenas.json`)

Limfe (default, seimbang) · Lambung Asam (**150 kill** — nutrisi +15%) · Paru Kristal
(**wave 8** — speed +8%, magnet +20%) · Sumbu Saraf (**2 boss kill** — fragmen +50%) ·
Bilik Jantung (**wave 12** — nutrisi +10%, speed +5%).

---

## 8. KATALOG 38 SISTEM (`js/systems/`)

| Sistem | Peran (verifikasi kode) |
|---|---|
| `spawn-system` (330) | wave, ekosistem, sarang, elite, gatekeeper boss — §4.3 |
| `skill-system` (325) | 3 skill MLBB + executor efek primitif — §6.2 |
| `body-system` (320) | 5 sistem tubuh, decay rolling, fokus, racun, suplemen, iklan |
| `tutorial-system` (283) | onboarding run pertama — **RONDE-7: dimatikan** (`shouldRun ≡ false`), kode arsip |
| `effects-system` (242) | partikel, blast, label, kill pop, VFX |
| `audio-system` (228) | SFX + unlock autoplay; `music-system` (175) = musik latar prosedural per bab |
| `collision-system` (220) | spatial grid, proyektil, separation, contact player |
| `upgrade-system` (192) | level-up in-run (roll pilihan, apply, heal, evolusi senjata) |
| `account-system` (172) | sign-up/login/logout fraksi; session; `requireAccount` |
| `ability-system` (160) | **vestigial** — kelas 4-ability lama; di-import tanpa di-instantiate (§6.3) |
| `monetization` (158) | 5 placement iklan + kuota 5×/24 j rolling — §1 audit finance |
| `economy-system` (157) | Antibodi: addCurrency, daily, run-end bonus, beli consumable, level hero/ally |
| `battlepass-system` (154) | track, XP, klaim, beli premium 500 Imun |
| `payment-system` (146) | order → metode → bayar (simulasi 700 ms) → receipt — audit finance §1 |
| `imun-economy` (135) | Imun: add/spend, kosmetik, founder, referral, survey |
| `feature-gate` (135) | progressive disclosure trigger-based + menu HUD fail-closed — §3.3 |
| `antigen-memory` (132) | modul R3: build adaptif per tipe — §5.6 |
| `rank-system` (131) | GP, 13 tier, season soft-reset |
| `metrics` (128) | KPI lokal 200 run (one-more-run rate, median, play-rate) — pasif |
| `inflammation` (125) | modul R5: zona DoT + cytokine storm |
| `retention-system` (124) | XP per kill, combo, **applyGlobalUpgrades** (Imun global), notifikasi hero |
| `mission-system` (124) | 3 kategori misi + anchor rolling 24 j/7 d (F8) |
| `vo-system` (117) | lapisan voice-over (bark, cutscene) |
| `chemotaxis` (117) | modul R7: jejak sinyal + buff speed |
| `passive-system` (116) | 11 passive hero via 5 hook — §6.1 |
| `liveops-system` (107) | mutator seeded, unlock mode, leaderboard lokal |
| `i18n` (107) | dwibahasa ID/EN: kamus + sweep DOM + `tr()` |
| `mastery-system` (98) | mastery per hero (XP, gelar, reward 15 ant) |
| `tag-cascade` (94) | modul R6: opsonisasi rantai |
| `phagocytosis` (94) | modul R4: telan musuh <20% HP |
| `unlock-system` (93) | status unlock hero (statistik + purchase) |
| `skill-unlock` (91) | progress Lv 3/5/10/15 + rank — source of truth in-run |
| `unlock-badge-system` (83) | badge "baru" di ikon menu + markSeen |
| `evolution-system` (76) | tahap evolusi, fragmen, evolusi (dipanggil Bag) |
| `narrative-system` (54) | bark RIA boss/run-end (copy dari `narrative.json`) |
| `haptics` (48) | getaran pola per event (throttle 90 ms) |
| `codex-system` (44) | Bio-Pedia: markSeen/isSeen |
| `module-flags` (27) | toggle 5 modul R3–R7 (baca `modules.json`) |

---

## 9. KATALOG 23 LAYAR (`js/ui/screens/`)

| Layar | Peran |
|---|---|
| `title` (59) | layar judul gameplay-first (MULAI → cutscene → run; MASUK → auth) |
| `loading` | progress data + sprite |
| `dashboard` (690) | hub antar-run — §3.2 |
| `roster` (205) | grid hero (avatar lingkaran, gembok, glow terpilih) + mulai run |
| `herodetail` (425) | hero page v2 ala RoK: rail kiri, sprite tengah, panel kanan (mastery, Lv, slider, 4 ikon skill incl. pasif) |
| `prep` (224) | battle prep 1 keputusan (hero) — §3.4 |
| `campaign` (120) | Peta Tubuh — §3.4 |
| `upgrade` (299) | Lab Pasukan: slider level + harga (squad 9 + ally + global Imun) |
| `shop` (510) | toko: consumable, kosmetik, suplemen tubuh, IAP 5 bundle, iklan, referral/survey |
| `bag` (141) | inventory: fragmen evolusi + tombol EVOLUSI + consumable |
| `hud` (377) | HUD run — §3.5 |
| `levelup` (70) | modal 3 kartu upgrade |
| `pause` | jeda: lanjutkan / akhiri run / suara |
| `revive` (65) | tawaran iklan + countdown 5 dtk |
| `bosschest` (peti boss) | ambil isi / iklan ×2 |
| `gameover` (293) | ringkasan (bintang, count-up, ad ×2, main lagi/dashboard) |
| `battlepass` (105) | 2 track 30 lv + klaim + beli premium |
| `rank` (83) | modal pangkat (13 tier + progres GP) |
| `codex` (236) | grid kartu Bio-Pedia (siluet → detail 2 kedalaman) |
| `arena` (72) | modal pilih arena (unlock statistik) |
| `auth` (137) | daftar/masuk + fraksi |
| `profile` (62) | akun, pengaturan suara, reset save |
| `curguide` (modal) | panduan currency Antibodi/Imun (konten diisi main.js) |

Lapisan sinematik: `cinematic.js` (scene 2D data-driven: intro, onboarding, brief×6,
clear×6 — `cinematics.json`) · `cutscene-3d.js` (three.js) + `cutscene-2d.js` (fallback
otomatis) + `cutscene-player.js` — scene: **pembuka** · transisi bab demam/racun/alergi/
final · **boss_reveal_bab_kanker** · epilog (`cutscenes.json`) · `wave-cinematic.js`
(3 babak di tiap boss wave) · `presenter.js` (RIA/Amara bergestur, non-blocking) ·
`coach.js` (tur tap di dashboard, sekali, skip-able — `coach.json` saat ini kosong
(step 0) → coach = no-op sampai konten diisi).

---

## 10. INPUT & KENDALI (`js/input/input-handler.js`)

| Aksi | Mobile | Desktop |
|---|---|---|
| Gerak | virtual joystick (radius 56 px) — kiri/kanan layar | WASD / panah |
| Serang | **tahan tombol SERANG** (tap = 1 tembakan respons instan) | tahan `4` / `T` / `Spasi` |
| Arah serang | tahan+tarik tombol SERANG (aim stick, threshold 12 px) | kursor mouse |
| Skill 1/2/3 | tap 3 tombol HUD | `1` / `2` / `3` |
| Upgrade skill | HUD (Lv 15+) | `Shift+1/2/3` |
| Pause | tombol II kluster kanan-bawah / tap pill HP | `Esc` / `P` |
| | audio unlock di gesture pertama (kebijakan autoplay browser) | |

- Keyboard gerak hanya aktif saat `screen === 'gameplay'` (bentuk input di dashboard aman).
- Auto-pause saat tab disembunyikan (`visibilitychange`).
- Play → upaya fullscreen + lock landscape (garda — gagal tidak mengganggu alur).
- `releaseAll` saat pause ganti layar (input tidak "menyangkut").

---

## 11. LAPISAN NARATIF

- **Karakter:** RIA (Respons Imun Adaptif — pemandu, bark tiap wave/boss, presenter) &
  Amara (penjelasan hero baru). Speaker di `cutscenes.json`; copy di `narrative.json`
  (guide/doctor/glossary/bossBark/winBark/loseBark).
- **First-time experience (sekali sejak pernah, `meta.nft`):** gerakan pertama · level up
  pertama · skill pertama · revive pertama — presenter + VO, non-blocking, antri bila modal
  terbuka (RONDE-3 visual fix).
- **Cutscene:** pembuka (3D, skippable) → run 1; transisi antar bab; **reveal boss bab
  kanker** (1× — pause → cutscene → resume); epilog.
- **Musik:** prosedural, tema per bab (`music.setTheme(chapterId)`), mulai saat run, berhenti
  keluar arena; toggle di profil/pause.
- **Kode baru = data baru:** seluruh copy & naskah di JSON, bukan di kode.

---

## 12. KATALOG DATA (34 `data/*.json`)

| File | Mengendalikan |
|---|---|
| `waves.json` | seluruh pacing wave (§4.3) + elite + ecosystem + explore |
| `enemies.json` | 13 tipe musuh: behavior, HP, dmg, speed, bobot, minWave |
| `heroes.json` | 11 hero: baseStats, pola serang, skill, passive, tier, unlock |
| `skills.json` | 33 skill (efek primitif, CD) |
| `abilities.json` | 4 ability evolusi — **vestigial** (§6.3) |
| `evolutions.json` | 5 tahap, 4 fragmen, drop 6%/30%, boss guarantee |
| `campaign.json` | 6 bab: kuota, reward, boss, hpMult |
| `modes.json` | kampanye & endless (unlock) |
| `mutators.json` | 8 mutator harian (seeded) |
| `arenas.json` | 5 arena: bonus + unlock statistik |
| `ranks.json` | 13 tier GP + poin per aksi |
| `mastery.json` | kurva mastery, reward, gelar |
| `missions.json` | 15 one-time + 3 daily + 2 weekly |
| `battlepass.json` | 2 track 30 lv + offers (adImun 30, survey, referral) |
| `premium.json` | 5 bundle IAP + metode qris/ewallet/kartu |
| `upgrades.json` | xpCurve, levelUpPool (11), squad (9), global (6), hero/ally, shopItems, economy (daily 120, waveBonus 12, adDailyLimit 5) |
| `body-systems.json` | 5 sistem tubuh + decay/racun/energi/suplemen/fokus |
| `nutrients.json` | 13 nutrisi (koin=2 ant, HP, buff, part) + drop bonus 16% + boss guarantee |
| `cosmetics.json` | 5 skin + 2 aksesori (priceImun) |
| `factions.json` | imun (playable) / virus (segera) |
| `features.json` | gerbang progressive disclosure (§3.3) |
| `progression.json` | band reward, scaling level player, gatekeeper, cap premium 30% |
| `gamefeel.json` | knockback, hit-stop, crit, damage number, shake, haptik, low-HP |
| `combat.json` | movement feel, targeting wounded, contact attack |
| `retention.json` | XP per kill, combo, partikel, synergy role |
| `codex.json` | 43 kartu Bio-Pedia (2 kedalaman, dwibahasa) |
| `narrative.json` | copy RIA/doctor/glossary/bark |
| `cinematics.json` | scene 2D (intro, onboarding, brief/clear ×6) |
| `cutscenes.json` | naskah 3D (pembuka, transisi, reveal, epilog) + nft + bossVo |
| `character-designs.json` | desain visual equity 5 stage × 11 hero + 3 patogen |
| `walk-anim.json` | sheet animasi jalan 8 arah (11 hero + 13 musuh) |
| `lang.json` | kamus dwibahasa ID/EN + rules |
| `coach.json` | tur coach (saat ini step 0) |
| `modules.json` | toggle 5 modul R3–R7 + parameter |

---

## 13. AUDIT TRAIL — sumber klaim utama dokumen ini

| Klaim | Sumber |
|---|---|
| Boot 7 langkah, routing awal, wiring event, menu HUD, quest panel, CUR_GUIDE, PLAY otomatis | `js/main.js:boot()` 519-960; `wireUiBridge()` 92-320 |
| 23 layar terdaftar + pemetaan state | `js/main.js:600-625`; `js/ui/screen-manager.js` `APP_STATE_BY_SCREEN` |
| Game loop rAF + clamp 50 ms | `js/core/game-loop.js` |
| Bentuk meta + migrasi | `js/core/state-manager.js:33-181` |
| Save localStorage + key | `js/save/save-manager.js` |
| Gate fail-closed + HUD menu map | `js/systems/feature-gate.js:56-94, 100-135`; `data/features.json` |
| startRun (konsumable, stats, squadPlan, nest 2, runstart) | `js/core/game.js:109-338` |
| Pipeline 13 tahap update | `js/core/game.js:498-819` |
| Wave: formula, boss gate, ecosystem, sarang, elite, ramp | `js/systems/spawn-system.js` (seluruh); `data/waves.json` |
| Menang kampanye/kuis; hasil run (10 langkah) | `js/core/game.js:1879-2053` |
| XP, pilihan 3, pity/synergy, pool 11 | `js/core/game.js:927-1040`; `data/upgrades.json levelUpPool/luRules/xpCurve`; `data/retention.json` |
| Serangan manual + ally tidak auto-fire | `js/core/game.js:607-640` (komentar RONDE-5); `js/entities/player.js:1-14` |
| Behavior musuh + contact telegraph + shooter | `js/entities/enemy.js:1-24, 79-145, 207-232`; `data/combat.json` |
| Damage pipeline + kill (drop, peti, tanpa Imun) | `js/core/game.js:735-770, 1459-1508, 1608-1794` |
| 11 hero + passive + 33 skill | `data/heroes.json`, `data/skills.json`, `js/systems/passive-system.js`, `skill-unlock.js` |
| Evolusi 5 tahap + AbilitySystem vestigial | `data/evolutions.json`; `js/core/game.js:58, 195-198` (tak di-instantiate); `js/systems/ability-system.js` |
| 12 sistem meta-layer | §7 (data + sistem masing-masing) |
| Mutator seeded | `js/systems/liveops-system.js` (mulberry32 + djb2) |
| Kontrol input | `js/input/input-handler.js:1-18`; `js/main.js` (keydown skills, play, pause) |
| Naratif (nft, cutscene, presenter, musik) | `js/main.js` (nftFirst, bossBark, waveBreak); `data/cutscenes.json`, `cinematics.json` |
| KPI pasif | `js/systems/metrics.js` |
| Baseline | branch `arena/01a09795-imunverse`, commit `dfa2270`, BUILD 54a (`js/core/version.js`) |

**Catatan vestigial yang ditemukan saat bedah (biar tim tidak bingung):**
1. `AbilitySystem` + `abilities.json` + field `ability` di tahap evolusi — tidak aktif di run (§6.3).
2. `tutorial-system` — dibangun utuh tapi dimatikan RONDE-7 (`shouldRun ≡ false`).
3. `coach.json` — step 0; `coach.js` jalan tapi tak punya konten untuk ditampilkan.
4. `APP_STATE_BY_SCREEN['focus']` — state mapping tanpa layar terdaftar (sisa fokus-run lama).
5. `run.imuAccrued` — field dipertahankan untuk kompatibilitas bentuk run, tidak di-akruasi
   (RONDE-4 fix T2 — akruan Imun fantom dihapus).
6. **Inkonsistensi teks vs angka:** toast `koin_ganda` "+50% antibodi" (`game.js:149`) vs
   pengali aktual ×1,3/30% (`game.js:1895`) — perlu sinkronisasi (UI atau angka).
