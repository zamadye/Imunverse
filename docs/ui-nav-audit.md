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
