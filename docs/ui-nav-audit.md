# Audit Navigasi Aktual — Imunverse (UI/UX scope)

> Basis: HEAD `19515b9` (BUILD 40a). Semua klaim diverifikasi di kode DAN runtime
> (Chromium headless, save kosong tanpa `?dev=1`; skrip audit di `scripts/e2e-ui-nav.mjs`).
> Scope pemilik dokumen: `js/ui/**`, `index.html`, `styles/*`, wiring navigasi `js/main.js`,
> `js/systems/feature-gate.js` + `data/features.json` (mesin disclosure — bukan data combat/economy).

## 1. Inventaris screen (24 terdaftar = 24 `<section data-screen>` di index.html)

| id | Modul | Peran | `APP_STATE_BY_SCREEN` |
|---|---|---|---|
| loading | loading-screen | boot | loading |
| title | title-screen | user baru (tanpa akun) | title |
| auth | auth-screen | daftar/masuk (setelah run pertama) | — |
| dashboard | dashboard-screen | home | dashboard |
| profile | profile-screen | akun + pengaturan + reset save | dashboard |
| roster / herodetail | roster-screen / hero-detail-screen | pilih hero, upgrade hero | roster |
| upgrade | upgrade-screen | squad (9) + global (6) + hero level | upgrade |
| shop | shop-screen | consumable, skin, IMU | shop |
| bag | bag-screen | inventaris | dashboard |
| campaign | campaign-screen | Peta Tubuh (pilih bab) | — |
| prep | prep-screen | Battle Prep 4 langkah (hero/mode/fokus/arena) | dashboard |
| focus | focus-screen | modal fokus run — **tidak ada `show('focus')` di mana pun = layar mati** | dashboard |
| arena | arena-screen | modal pilih arena | dashboard |
| codex | codex-screen | Bio-Pedia | dashboard |
| bp | battlepass-screen | Battle Pass | — |
| rank | rank-screen | Pangkat Penjaga | — |
| hud | hud-screen | gameplay | gameplay |
| levelup / pause / revive / bosschest | modal in-run | — (disengaja) |
| gameover | gameover-screen | hasil run | gameover |

## 2. Peta jalur masuk (edge) — dari kode

### 2.1 Boot (`main.js`)
- Tanpa akun → `title` → MULAI → sinematik `intro` → **`game.startRun` langsung** (gameplay-first).
- Ada akun → `playOnce('intro')` → `dashboard` → coach.
- `?autotest=1` → signUp otomatis → dashboard.

### 2.2 Dashboard (`index.html` + `dashboard-screen.js` + `main.js`)
Semua tombol yang ADA di DOM dan handler-nya (terlepas dari tampil/tidak):

| Kelompok | Destinasi | Gate yang dipakai handler |
|---|---|---|
| `#btn-play` (CTA) | `game.startRun(selectedHero)` / `roster` bila hero terkunci | — |
| `#btn-play-big` (kartu kampanye) | runs<3 → startRun default bab; runs≥3 → `campaign` | totalRuns (hardcode di main.js) |
| dock `[data-nav]` | roster, bag, upgrade, shop | `isDockGated` → `features.json` target `dock` |
| secondary-dock `[data-nav]` | campaign, bp, codex, rank | target `secondary` |
| side-nav | home(scroll), campaign, codex, bp, records(scroll), body(scroll) | target `side` |
| quick-row (JS) | roster, shop, codex("Collection"), rank("Stats") | target `quick` (tile terkunci tidak dirender) |
| banner slide 2/3 | campaign / prep(endless) | — |
| kartu mode-endless / mode-lab / arena-card / dash-level-badge | prep / upgrade / arena / upgrade | — |
| `#account-chip` / `#rank-chip` | profile / rank | — |
| `#btn-codex` (tidak ada di DOM; handler `?.`) | codex | — |

**Kenyataan runtime (bukan yang tersirat dari kode):** `styles/dashboard-focus.css` F24 (baris 339, 352–353)
menyembunyikan **permanen** `.side-nav`, `.dock`, `.secondary-dock`, dan SEMUA anak `.dash-scroll` selain banner
(quick-row, play-row, stats, daily, evo/misi, leaderboard/body). Akibatnya dashboard untuk pemain 0 run, 3 run,
maupun 15 run/wave 12 **identik**: hanya `PLAY`, chip akun, chip rank (≥3 run), toggle bahasa.
`applyGateVisual`, `isDockGated`, `renderQuickRow`, `minimal-home` → semuanya bekerja pada elemen yang tidak
pernah terlihat (dead UI). "10+ destinasi" TIDAK ada di dashboard.

### 2.3 Di mana 10+ destinasi itu sebenarnya hidup: HUD gameplay (F25)
Dua menu di dalam run (`index.html` section hud):

| Menu | Tombol | Handler (`main.js`) | Gate | Hasil klik nyata, pemain 0 run |
|---|---|---|---|---|
| menu1 (kanan-atas, ikon bakteri) | Campaign, Rank, Bio-Pedia, Battle Pass | `.hud-menu-link` → `gateFor('secondary', id)` | secondary: campaign 3 run, rank 15 run, codex wave 10, bp 6 run | **diblokir** (toast syarat) ✓ |
| menu2 (kanan-bawah, potret hero) | Squad, Battle, Shop, Collection, Heroes | `.hud-menu2-link` → `gateFor('dock', id)` | dock: roster —, bag 3, upgrade 3+150, shop 5; **codex & arena TIDAK terdaftar di target `dock`** | Heroes ✓ buka; Shop ✓ blok; **Collection → codex TERBUKA**, **Battle → arena TERBUKA** (gate `null` = lolos) |

Ditambah panel Quest kiri-tengah (selalu tampil, 3 baris, tumpang tindih combo/antigen chip) dan
toggle 2 menu. Jadi pada **run pertama** pemain melihat: 9 item menu + quest panel + hint kontrol + misi bab +
3 skill + tombol serang + pause. Item terkunci **tetap dirender** (tidak `.gated`), hanya menolak saat diklik →
melanggar prinsip R1 "hidden, bukan lock".

### 2.4 Pra-run (Task 3)
Jalur ke run: (a) title MULAI → startRun; (b) dashboard PLAY → startRun; (c) gameover Main Lagi → startRun;
(d) `campaign` → `prep` (4 langkah) → startRun; (e) mode-endless/banner → `prep`; (f) HUD menu2 "Battle" → `arena`.
Fakta core (`game.js:354-370`): pada mode **kampanye, arena ditentukan oleh bab** — langkah 4 (Arena) di prep
tidak berpengaruh. `focusRun` hanya memengaruhi body-system (PARK per phase-00). Mode endless terkunci sampai bab 1
menang. Maka dari 4 keputusan, yang esensial di awal hanya **hero** (dan **bab** setelah ≥1 bab tamat).

### 2.5 Akun & fraksi (Task 4)
- Kartu fraksi sudah dicopot dari `auth-screen` (R1/E1); `signUp` selalu `faction:'imun'`.
- Sisa: `profile-screen` menampilkan `faction-tag` "Pasukan Imun"; dashboard men-set `--faction-color`;
  `data/factions.json` masih memuat `virus` status `segera`; CSS `.faction-card*`, `.auth-faction*` (mati);
  `lang.json` masih punya "Pilih Pasukanmu". Tidak ada jalur UI ke pemilihan fraksi → risiko trust tersisa hanya
  label "Pasukan Imun" di profil (mengimplikasikan ada pasukan lain).

## 3. Sistem trigger yang bisa dipakai ulang (Task 2) — jangan bangun baru
`js/systems/feature-gate.js` + `data/features.json` (schema 2): gate `{target,id,requireRuns|requireWave|requireCurrency}`
dievaluasi terhadap `STATE.meta.stats` (`totalRuns`, `bestWave`, `totalCurrencyEarned`/`currency`) — sudah
run/wave/currency-based, bukan waktu. Kekurangan yang ditemukan:
1. Target `dock` tidak punya entri `codex` & `arena` padahal menu2 HUD memakainya → lolos gate.
2. Item terkunci di HUD tidak disembunyikan (hanya ditolak saat klik).
3. Dashboard gate mengarah ke elemen yang disembunyikan CSS permanen → tidak ada progressive *disclosure*, hanya *hiding*.
4. Ada sumber kebenaran ganda: `minimal-home` (`totalRuns<3` hardcode), `#btn-play-big` (`runs>=3` hardcode), `features.json`.

## 4. Dead / duplikat UI yang ditemukan
- `focus-screen` + `#btn-focus-close`: tidak pernah ditampilkan.
- `secondary-dock`, `side-nav`, `quick-row`, dock, kartu play-row/stats/daily/evo/misi/leaderboard/body: dirender tiap `show()` tapi `display:none` permanen (biaya render + ~20 handler tanpa fungsi).
- `#btn-codex` handler tanpa elemen.
- Gameover: baris `.go-parts` (GP/Mastery/BP/Tubuh) **menumpuk antar run** (`insertAdjacentElement` tanpa cleanup) — bug UI di scope ini.
- HUD: `.hud-quests` (top 56%) menimpa `.hud-combo` (top 150px) dan `.hud-antigen` (bottom 86px).

## 5. Perubahan yang diterapkan (commit UI/UX Task 2–4, BUILD 41)

Keputusan pemilik produk: dashboard memang 1 tombol PLAY (opsional); semua fitur hidup di
gameplay. Maka disclosure diterapkan di **menu HUD**, bukan dashboard.

| # | Perubahan | File |
|---|---|---|
| 1 | **Item menu terkunci TIDAK dirender** (`.gated{display:none}`), toggle menu ikut hilang bila belum ada item terbuka (`.gate-hidden`); panel Misi ikut gerbang `quick/quests`. Dievaluasi saat `runstart` dan tiap kembali ke HUD dari layar menu. | `js/main.js` (`applyHudDisclosure`), `styles/dashboard-focus.css` |
| 2 | **Satu sumber kebenaran** pemetaan tombol → gerbang: `HUD_MENU_GATES` + `hudMenuGate()` **fail-closed** (id yang tidak terdaftar di `features.json` = terkunci). Handler klik kedua menu memakai jalur yang sama (`openHudMenuScreen`). | `js/systems/feature-gate.js`, `js/main.js` |
| 3 | Menutup lubang gate: entri `dock/codex` (Gel.10 — sama dengan `secondary/codex`) & `dock/arena` (3 run — sama dengan kampanye). **Ambang lain tidak diubah.** | `data/features.json` |
| 4 | Badge unlock per menu: dihitung dari item yang **baru muncul** (bukan dari `bestWave` global), tersimpan di `meta.seenUnlocks` (save lama dimigrasi tanpa badge palsu); hilang saat menu bersangkutan dibuka. | `js/systems/unlock-badge-system.js` |
| 5 | **Set ikon menu baru** — SVG digambar khusus konteks game (emblem perisai + sel imun, siluet Inang + jalur bab, lensa + virus kawaii, tiket imunisasi, regu sel, kios Antibodi, ubin arena + antibodi-Y, labu serum, gelembung sinyal misi). Palet = token `:root` (`--teal/--teal-deep/--sage/--coral/--gold/--cream`). Menggantikan ikon generik (crosshair, siluet orang, gembok, play, petir). | `assets/icons/menu-*.svg`, `index.html` |
| 6 | Bahasa visual kedua menu disamakan: emblem bulat krem ber-bordir putih, label 8–11px; badge angka lebih kontras. Panel Misi tak lagi menimpa chip combo/antigen (badan misi dibatasi tinggi + scroll; combo/antigen digeser). | `styles/dashboard-focus.css` |
| 7 | **Prep = 1 langkah** (Hero). Langkah Mode hanya muncul bila Endless sudah terbuka (≥1 bab tamat) → maks 2. Fokus Run dipaksa `seimbang`, arena kampanye = bab (sudah begitu di `game.getRunArena`), arena endless = arena terbuka terbaik (auto-default). Ringkasan loadout tetap menampilkan mode·bab·arena hasil default. | `index.html`, `js/ui/screens/prep-screen.js` |
| 8 | **Fraksi**: tag "Pasukan Imun" di profil diganti gelar netral "Penjaga Tubuh"; `--faction-color` dan `getFactionDef` tidak lagi dipakai UI; CSS kartu fraksi auth (mati) dihapus. `signUp({faction})` internal tetap (data akun tidak disentuh). | `index.html`, `js/ui/screens/profile-screen.js`, `js/ui/screens/dashboard-screen.js`, `styles/main.css` |
| 9 | Bug: baris `.go-parts` gameover menumpuk antar render → dibersihkan sebelum render. | `js/ui/screens/gameover-screen.js` |
| 10 | Label menu di-ID-kan (Peta Tubuh, Pangkat, Koleksi, Arena, Lab Pasukan) + entri `lang.json` EN. | `index.html`, `data/lang.json` |

Hasil disclosure per progres (runtime, `scripts/e2e-ui-nav.mjs`):

| Progres | Menu 1 (kanan-atas) | Menu 2 (bawah) |
|---|---|---|
| 0 run | *(toggle tidak ada)* | Heroes |
| 3 run | Peta Tubuh | Heroes, Arena |
| 5 run + 150 Antibodi | Peta Tubuh | Heroes, Shop, Arena, Lab Pasukan |
| 6 run | + Battle Pass | — |
| Gel. 10 | + Bio-Pedia | + Koleksi |
| 15 run | + Pangkat | — |

Tidak diubah (di luar scope / perlu keputusan lain): ambang angka di `features.json`; `data/factions.json`
(masih memuat `virus: segera` — tidak lagi dirender di UI mana pun); string lama `Pilih Pasukanmu` di
`lang.json` (tidak dipakai).

## 6. Catatan untuk pemilik lain (issue)
- #16 (Bio-Pedia lolos lewat Collection): ditutup oleh perubahan #2–#3 di atas; suite `e2e-ui-nav.mjs`
  kini exit 1 saat ada FAIL (poin acceptance #6 terpenuhi untuk suite ini).
- Dead UI dashboard (side-nav/dock/quick-row/kartu) masih dirender lalu disembunyikan CSS — dibiarkan
  karena pemilik menyatakan dashboard opsional; kandidat pembersihan terpisah bila F24 dipermanenkan.

## 7. BUILD 42 — bug krusial "arah tidak berfungsi" (kontrol gerak & arah)

Reproduksi runtime (bukan asumsi) di 844×390, touch + mouse + keyboard, sebelum diubah apa pun:

| # | Temuan (sebelum) | Bukti terukur |
|---|---|---|
| 1 | **42 % layar kanan (x > 58 % lebar) adalah "aim stick" tak kasatmata** — tarik di sana hero **diam**, hanya chevron kecil berputar. Hint HUD justru berbunyi "Sentuh & tarik **di mana saja**". | touch 600→660 px: `dx=0, aim=true`; touch 420→480: `dx=71` |
| 2 | **Badan panel Misi** (168×134 px, kiri-tengah, `pointer-events:auto`, terbuka sejak detik pertama) menelan tarikan; jari tutorial "gerak" (70,214) berada **di dalam** panel itu. | touch 80→140 di y=200: `dx=4`, `hit=hq-top` |
| 3 | Sprite dasar joystick (alpha maks 0,69, teal muda) nyaris lenyap di lantai krem → tidak ada umpan balik arah. | piksel berubah saat joystick aktif = 2 167 px (hanya knob) |
| 4 | `InputHandler` mem-`preventDefault` W/A/S/D/K/Spasi/panah **global** → di form akun huruf itu tidak bisa diketik. | ketik `was d` + ← + `X` → nilai input `"X"` |
| 5 | Tutorial langkah 2: "Tekan tombol **TEMBAK!**" padahal label tombol **SERANG**; jari menunjuk tengah layar. | copy `tutorial-system.js` vs `#btn-fire` |
| 6 | Tombol yang ditahan saat pindah tab/pause tersangkut (hero jalan sendiri). | `blur` → `keys=["up"]` |

Perbaikan (semua di lapisan input/UI — logika combat/spawner tidak disentuh):

| # | Perubahan | Berkas |
|---|---|---|
| 1 | Joystick mengambang **di mana saja** di canvas (zona aim dihapus). Aim = **TAHAN + TARIK tombol SERANG** (ala MLBB): tap < 12 px = menembak biasa; tarik > 12 px = aim aktif, sudut dari titik tekan; pointer di-*capture* (jari meleset keluar tombol tidak memutus tembakan); lepas = auto-aim lagi. Indikator arah (garis + mata panah emas) berputar di tombol. | `js/input/input-handler.js` (`bindFireButton`), `js/main.js`, `index.html` (`.fire-aim`), `styles/dashboard-focus.css` |
| 2 | Panel Misi **mulai terlipat** (kepala + badge KLAIM tetap tampil); pembungkus `pointer-events:none`, hanya kepala/badan yang menerima sentuhan. | `js/main.js` (`setQuestPanelOpen`), `styles/dashboard-focus.css` |
| 3 | Joystick: cincin dasar kontras + panah arah di tepi cincin (sprite lama tetap dipakai). | `js/render/shape-renderer.js` |
| 4 | Keyboard gerak hanya ditangkap saat `STATE.screen === 'gameplay'` dan bukan di `<input>/<textarea>`; `keyup` selalu melepas. | `js/input/input-handler.js`, `js/main.js` |
| 5 | Copy tutorial & hint = perilaku nyata dan nama tombol nyata ("SERANG"); jari tutorial gerak → lantai kosong (36 %, 60 %), jari serang → di atas tombol SERANG. | `js/systems/tutorial-system.js`, `js/ui/screens/hud-screen.js`, `data/lang.json`, `styles/dashboard-focus.css` |
| 6 | `releaseAll()` pada `blur`, `visibilitychange`, dan event `pause` (menu HUD/level-up/jeda). | `js/input/input-handler.js`, `js/main.js` |

Verifikasi: `scripts/e2e-controls.mjs` — 23 asersi PASS (tarik kanan/tengah/kiri touch & mouse menggerakkan hero;
ketik di form tidak diblokir; WASD/panah jalan; blur/pause melepas tombol; tap SERANG = tembak tanpa aim;
tahan+tarik = aim −135° + `.aiming` + `--aim`; touch keluar tombol tetap menembak; lepas = berhenti; umpan balik
joystick 10 568 px berubah; jari & copy tutorial benar). Regresi: 23 suite e2e = **410 PASS / 0 FAIL**.
Bukti visual: `shots/ui-nav/controls-aim.png`, `shots/ui-nav/controls-joystick.png`.

## 8. BUILD 43 — ikon SERANG & skill dalam bahasa visual game (work order #2)

Temuan runtime (844×390, `shots/ui-nav/skills-*.png` sebelum diubah):

| # | Temuan (sebelum) | Bukti |
|---|---|---|
| 1 | Ikon skill = 15 glyph **mono generik per jenis efek** (target, panah, tengkorak, bintang) 26 px, diwarnai `--sk` (Shadowstep `#1c1c1c`, Backstab `#4a235a` nyaris hitam di ubin krem) — tidak satu bahasa dengan set `assets/icons/menu-*.svg` (blob kawaii, outline ink, palet token). 3 hero memakai jenis efek sama 3× (Baso `area×3`, Helia `buff_allies×3`, Eos `strike×2`) → **tiga tombol berikon identik**. | `KIND_GLYPH` lama di `hud-screen.js`; `data/skills.json` |
| 2 | Label nama skill di **dalam** hex (`clip-path`) terpotong: "SIKAP BERTAHA", "OCK ON", "NIHILAT". | `.sk-name` 7,5 px di hex 42 px |
| 3 | SERANG: piktogram Y putih 27 px di atas cincin gerigi koral berputar + sunburst teal → ikon tenggelam; tombol SERANG berposisi absolut (`bottom:14px`) dan **menimpa pelat ULT**. | `shots/ui-nav/skills-4.png` |
| 4 | Prep & detail hero menampilkan skill hanya sebagai **titik warna** — tidak ada kaitan visual dengan tombol di HUD. | `.ps-skill-dot`, `.hl-skill-dot` |

Perubahan (UI murni — `skill-system.js`, combat, spawner tidak disentuh):

| # | Perubahan | Berkas |
|---|---|---|
| 1 | **33 ikon per-skill** digambar khusus (SVG inline, viewBox 64, palet token, wajah kawaii, outline ink, bayangan lantai) + `KIND_FALLBACK` untuk skill baru. Konsep per hero didokumentasikan di `assets/icons/README.md`. | `js/ui/skill-icons.js` (baru) |
| 2 | **Pelat hex SVG** (`skillPlateSvg()`: outline ink → rim warna skill → muka krem + kilau; ULT rim emas) menggantikan `clip-path`; glow "siap" mengikuti bentuk hex; cooldown konik dipotong hex; chip nomor tombol 1/2/3 tetap. | `js/ui/screens/hud-screen.js`, `styles/dashboard-focus.css` (blok BUILD 43), `styles/main.css` (blok E1 dihapus) |
| 3 | **Label di bawah pelat** (tidak lagi dipotong hex), tampil hanya bila tinggi layar ≥ 500 px (landscape HP: ikon + banner nama saat cast sudah cukup; landscape tablet/desktop: label 1 baris penuh). Hint kontrol dinaikkan mengikuti tinggi grid. | `styles/dashboard-focus.css` |
| 4 | **SERANG** = `assets/icons/hud-serang.svg` (antibodi-Y krem ber-outline ink menghantam virus koral mungil + bintang benturan emas) 44 px; cincin gerigi & offset absolut dibuang → tombol tidak menimpa ULT lagi. | `index.html`, `assets/icons/hud-serang.svg` (baru), `styles/dashboard-focus.css` |
| 5 | Prep & detail hero memakai **chip hex + ikon yang sama** (`skillChip()`), tooltip = deskripsi skill. | `js/ui/screens/prep-screen.js`, `js/ui/screens/hero-detail-screen.js` |

Verifikasi: `scripts/e2e-e1.mjs` (poin 2 → pelat hex SVG + ikon SERANG), `scripts/e2e-e2.mjs` (poin 3 → sumber ikon
`skill-icons.js`), `e2e-mlbb.mjs` (3 tombol, 1 ULT, klik memicu cooldown), `e2e-controls.mjs`, `e2e-ui-nav.mjs`.
Bukti visual: `shots/ui-nav/skills-4.png` (4 hero), `shots/ui-nav/skill-icons-64.png` (33 ikon), `shots/ui-nav/hud-land.png`.

## 9. BUILD 44 — ikon & halaman menu (Toko, Heroes, Lab Pasukan, dll.) satu bahasa visual (work order #3)

Temuan runtime (844×390, seed 15 run, sebelum diubah):

| # | Temuan (sebelum) | Bukti |
|---|---|---|
| 1 | Menu memakai **±30 PNG generik** (`icon_back/coin/imu/lock/sword/heart/bolt/star/boot/shield…`) dari era sebelum set `menu-*.svg` — gaya flat lain, ukuran & outline tidak konsisten dengan ikon HUD/skill BUILD 43. Toko memakai **sprite item** (`item_glukosa/antibodi/vitamin_c.png`) sebagai *hiasan sudut* header, bukan sebagai item. | `git grep icon_ js/ui/screens` (sebelum) |
| 2 | Ikon upgrade dipetakan **per PNG generik**: 6 baris Lab Pasukan / 11 pilihan level-up berbagi 5 gambar (`icon_heart` untuk `maxHP` *dan* `lifeSteal`; `icon_scope` untuk `attackRange` *dan* `pierce`; `fx_spark` untuk `damage` *dan* `critChance`). `g_range` menunjuk `icon_crosshair.png` yang tidak ada (issue #7). | `data/upgrades.json` |
| 3 | Header 9 layar menu **berbeda-beda** (`.topbar` vs `.screen-header` vs `.hd-top`, tombol back 2 ukuran, chip mata uang 3 varian). Toko = satu halaman panjang 6 bagian tanpa navigasi; judul bagian `<h3>` ganda (statis di HTML + dari JS). Heroes: footer MULAI **menutupi baris kartu terakhir** (tombol BUKA hero baris bawah tak bisa ditekan). | `shots/ui-nav/roster-44.png` (sesudah) |
| 4 | Badge peran hero hanya teks; kartu terkunci memakai `aria-disabled` pada kartu → tombol BUKA di dalamnya ikut dianggap nonaktif (a11y & Playwright). | `roster-screen.js` |

Perubahan (UI murni — data JSON, combat, spawner, ekonomi tidak disentuh):

| # | Perubahan | Berkas |
|---|---|---|
| 1 | **15 ikon SVG baru** satu bahasa dengan `menu-*.svg`/`hud-serang.svg`: `ui-back`, `ui-lock`, `ui-star(-empty)`, `ui-virus`, `cur-antibodi`, `cur-imun`, `role-tank/damage/support`, `sec-item/skin/premium/suplemen/gratis`. Konsep tiap ikon di `assets/icons/README.md`. | `assets/icons/*.svg` |
| 2 | **`js/ui/menu-icons.js`** (pola `skill-icons.js`): 21 ikon stat/item inline + 4 ikon tab, pemetaan `id → ikon` per **id upgrade** (bukan per PNG) → `maxHP`≠`lifeSteal`, `attackRange`≠`pierce`, `damage`≠`critChance`; `g_range` tertutup (issue #7) tanpa mengubah `upgrades.json`. Dipakai Lab Pasukan, Toko, level-up, chip stat detail hero, Tas. | `menu-icons.js`, `upgrade-screen.js`, `shop-screen.js`, `levelup-screen.js`, `hero-detail-screen.js`, `bag-screen.js` |
| 3 | **Header seragam `.ui-head`** (back 44 px + emblem layar + judul + chip mata uang kanan) untuk Heroes, Lab Pasukan, Toko, Bio-Pedia, Battle Pass, Detail Hero, Profil, Kampanye, Siap Tempur, Tas. Semua PNG generik di layar menu, pause, gameover, arena, rank, bosschest, auth, dashboard diganti SVG baru. | `index.html`, `styles/main.css` (blok BUILD 44), `js/ui/screens/*.js` |
| 4 | **Toko** disusun ulang: nav chip *sticky* (`#shop-nav`, scroll-spy) → BEKAL RUN → BUKA HERO → SKIN & GAYA → SUPLEMEN → IMUN GRATIS → PAKET PREMIUM; tiap bagian ber-emblem `sec-*.svg` + subjudul 1 baris; kartu item pakai ikon inline; tombol premium berwarna; judul ganda dihapus. | `shop-screen.js`, `index.html`, `main.css`, `dashboard-focus.css` |
| 5 | **Heroes**: emblem peran `role-*.svg` di kartu, gembok krem terbaca (padding piksel tetap — padding % relatif lebar avatar membuat SVG hilang), grid diberi ruang bawah 78 px + footer `pointer-events:none` (tombol saja yang menerima sentuhan) → baris terakhir tak lagi tertutup. `aria-disabled` dipindah dari kartu (tombol BUKA aktif untuk AT). | `roster-screen.js`, `main.css`, `dashboard-focus.css` |
| 6 | **Lab Pasukan**: tab HERO/GLOBAL/PASUKAN/TIM ber-ikon, tombol LEVEL UP dengan harga ber-ikon mata uang; **Level-up in-run**: ikon pilihan dari `menu-icons.js` (11 id berbeda). | `upgrade-screen.js`, `levelup-screen.js` |
| 7 | i18n: 21 string EN baru + 2 rule untuk label/subjudul baru. | `data/lang.json` |

Verifikasi: 23 suite e2e = **410 PASS / 0 FAIL** (`e2e-controls` 23/23 ×2, `e2e-retention` 20/20 setelah perbaikan #5,
`e2e-ui-nav` 21/21, `e2e-mlbb` 20/20). Flaky lama yang tidak terkait UI (lulus saat diulang): `e2e-r5 hero-splash-inside-zone`
(issue #1), `e2e-r7 segments-emit-on-move-only`, `e2e-v2phase35 p3/p5-*` (simulasi combat acak). `node scripts/check-imports.mjs` lolos.
Bukti visual: `shots/ui-nav/menu-icons-44.png` (semua ikon baru), `shop-44.png`, `roster-44.png`, `lab-44.png`, `others-44.png`
(detail hero, Bio-Pedia, Battle Pass, Tas).

## 10. BUILD 45 — sisa PNG generik di HUD / jeda / game over / judul / dashboard

Temuan (runtime, `/tmp/vis.mjs` mendaftar semua `<img src="assets/sprites/…">` yang tampak per layar):
`icon_play` (judul, PLAY dashboard, Lanjutkan, Main Lagi), `icon_home`, `icon_skull` (HUD kill **dan** Akhiri Run),
`icon_timer`, `icon_pause`, `icon_heart` (HP), `deco_chest` (Peti Boss, ringkasan) — semua flat satu warna, ukuran
9–32 px, tanpa outline; tombol PLAY/Jeda memakai `filter: brightness(0) invert(1)` agar putih.

Perubahan: 8 ikon SVG baru (`ui-play/home/flag/kill/timer/pause/heart/chest`) satu bahasa dengan set BUILD 43–44;
`filter` putih dihapus (SVG sudah krem/ink); `icon_skull` dipisah menjadi **`ui-kill`** (hitung patogen: virus bermata
silang + centang) dan **`ui-flag`** (Akhiri Run — bendera, bukan tengkorak); dock/quick-tile/side-nav dashboard yang
disembunyikan `dashboard-focus.css` tetap diseragamkan ke `menu-*.svg` agar tidak ada jalur PNG lama tersisa.
Hasil: `index.html` **0** referensi `assets/sprites/icon_*.png` (sebelumnya 24); layar menu/HUD/jeda/game over hanya
memuat sprite in-game (`portrait_*`, `hero_*`, `part_*`, `deco_aura`) — bukan ikon UI.

Verifikasi: `e2e-ui-nav` 21/21, `onboarding` 16/16, `controls` 23/23, `e1` 32/32, `mlbb` 20/20 (×2), `r1` 14/14,
`v2phase1` 15/15, `purpose` 13/13; `check-imports` lolos. Bukti: `shots/ui-nav/hud-pause-go-45.png`.

## 11. BUILD 45 (lanjutan) — pembersihan dead UI dari §4 + modal Arena

| # | Perubahan | Berkas |
|---|---|---|
| 1 | `focus-screen` **dihapus** (modal "Fokus Run" tidak pernah ditampilkan sejak alur pra-run disederhanakan — `show('focus')` tidak ada di mana pun; `meta.focusRun` tetap dipakai body-system dan di-reset `seimbang` oleh prep). Section HTML, import/register, handler `#btn-focus-close`, dan CSS `.focus-*`/`.fi-*` ikut dihapus. | `js/ui/screens/focus-screen.js` (hapus), `js/main.js`, `index.html`, `styles/main.css` |
| 2 | Handler `#btn-codex` (elemen tidak ada) dihapus; handler ganda `#rank-chip` di `main.js` dihapus — `dashboard-screen.js` sudah memasang `onclick` (diverifikasi: klik chip → `screen-rank`, chip akun → `screen-profile`). | `js/main.js` |
| 3 | Modal Pilih Arena: gembok baris terkunci membesar 56 px karena `.arena-item img` mengalahkan `.lock-ico` (13 px) → selektor `.arena-item img.lock-ico` 15 px; baris syarat kembali satu garis. | `styles/main.css` |

Belum disentuh (butuh keputusan/lintas scope): `.hud-quests` vs `.hud-combo`/`.hud-antigen` (tumpang tindih hanya bila
combo & antigen aktif bersamaan — perlu uji mid-run nyata), label liveops.
Verifikasi: `e2e-ui-nav` 21/21, `progression` 18/18, `retention` 20/20, `purpose` 13/13, `v2phase6` 15/15, `r1` 14/14; `check-imports` lolos.
