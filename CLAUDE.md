# CLAUDE.md — Imunverse / PHAGOS
## Base Knowledge untuk AI Development Sessions

---

## 1. Project Overview

**PHAGOS** (nama internal: Imunverse) adalah roguelike survival game bertema biologi imun, berjalan sebagai PWA mobile-first. Player mengendalikan sel imun (Makrofag, T-Cell, NK Cell, dll.) melawan patogen di organ tubuh manusia.

- **Stack**: Vanilla JS ES Modules, HTML5 Canvas, pure CSS
- **Entry point**: `index.html` → `js/main.js`
- **Screens**: Dikelola oleh `js/ui/screen-manager.js` — satu screen aktif, modal menimpa di atasnya
- **State**: `js/core/state-manager.js` → `STATE` singleton
- **Data**: `js/core/data-store.js` → `getData()` / `getHero()`
- **Audio**: `js/systems/audio-system.js`
- **Save**: `js/save/save-manager.js`

---

## 2. Design System (Warna, Tipografi, Bentuk)

### Palet CSS Variables (`:root` di `styles/main.css`)
```css
--cream: #fdf6e3      /* Latar utama layar */
--cream-2: #f7edd9    /* Latar sekunder */
--card: #fffdf4       /* Latar kartu */
--ink: #123f3a        /* Teks utama */
--ink-soft: #41706a   /* Teks sekunder */
--teal: #2f9c8f       /* Aksen primer (CTA, highlight) */
--teal-deep: #1f7a70  /* Teal lebih gelap */
--teal-dark: #14584f  /* Teal paling gelap */
--teal-light: #bfe3d8 /* Teal muda (border, bg ringan) */
--mint: #ddeec9       /* Hijau muda */
--mint-2: #eaf4dd     /* Hijau muda lebih terang */
--sage: #a9d795       /* Hijau sage */
--green: #7cb86a      /* Hijau medium */
--coral: #f2825c      /* CTA utama MAIN, aksen bahaya */
--coral-deep: #e96a4c /* Coral lebih gelap */
--coral-light: #f8b29a/* Coral muda */
--gold: #f5c64f       /* Premium, reward */
--gold-deep: #e0a72e  /* Gold lebih gelap */
--heart: #f0685a      /* HP/health merah */
```
**PERHATIAN**: `--cream-deep` direferensikan di CSS tapi TIDAK didefinisikan di `:root` — bug latent.

### Token Bentuk
```css
--r-xl: 34px   /* Border radius ekstra besar (hero stage, modal utama) */
--r-lg: 26px   /* Kartu standar */
--r-md: 18px   /* Komponen medium */
--r-sm: 13px   /* Komponen kecil */
--pill: 999px  /* Pill/tombol bulat */
```

### Bayangan
```css
--shadow-card: 0 10px 24px rgba(31, 74, 66, 0.10), 0 2px 6px rgba(31, 74, 66, 0.08)
--shadow-pop:  0 18px 44px rgba(20, 60, 54, 0.28)  /* Modal, overlay */
--shadow-dock: 0 12px 30px rgba(20, 60, 54, 0.22)  /* Navigation dock */
```

### Tipografi
- **Font stack**: `"Nunito", "Quicksand", "Varela Round", ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui`
- **CATATAN**: Tidak ada @font-face atau Google Fonts import — menggunakan system fonts
- **Ukuran kunci**: h1=ekstra besar, h2=23px, body=14px default, label kecil=9-11px
- **Weight**: 700 (label), 800 (medium emphasis), 900 (bold/judul)

---

## 3. Arsitektur Screen

### Screen Manager (`js/ui/screen-manager.js`)
```
registry: Map<id, {id, mod}>
currentId: string | null

APP_STATE_BY_SCREEN = {
  codex, profile → 'dashboard'
  loading         → 'loading'
  dashboard       → 'dashboard'
  roster          → 'roster'
  upgrade         → 'upgrade'
  shop            → 'shop'
  arena           → 'dashboard' (modal)
  focus           → 'dashboard'
  prep            → 'dashboard'
  bag             → 'dashboard'
  herodetail      → 'roster'
  hud             → 'gameplay'
  gameover        → 'gameover'
  title           → 'title'
}
```

### Daftar Screens
| Screen ID | Type | Deskripsi |
|-----------|------|-----------|
| `loading` | Full | Loading screen dengan progress bar |
| `title` | Full | Title screen (gameplay-first) |
| `dashboard` | Full | Home utama — hero stage + kartu-kartu |
| `roster` | Full | Pilih hero |
| `upgrade` | Full | Lab Pasukan — upgrade hero/pasukan/global |
| `shop` | Full | Lab Genom — toko premium |
| `codex` | Full | Bio-Pedia — koleksi entitas |
| `campaign` | Full | Peta Tubuh — progress bab |
| `prep` | Full | Battle Prep — persiapan sebelum run |
| `bag` | Full | Inventory/Tas |
| `herodetail` | Full | Detail & upgrade hero |
| `bp` | Full | Battle Pass — Siklus Mitosis |
| `rank` | Modal | Pangkat Penjaga |
| `profile` | Full | Profil pemain |
| `hud` | Passive | Gameplay HUD (transparent) |
| `levelup` | Modal | Pilih mutasi saat level up |
| `pause` | Modal | Pause |
| `revive` | Modal | Tawaran bangkit |
| `gameover` | Modal | Rangkuman akhir run |
| `bosschest` | Modal | Peti boss |
| `arena` | Modal | Pilih arena |
| `curguide` | Modal | Panduan currency |
| `capsule` | Modal | Kapsul selamat datang |
| `comeback` | Modal | Reward kembali |

---

## 4. File CSS & Struktur Style

### File CSS Utama
```
styles/
  main.css            (3013 baris) — Design system + semua screen style
  dashboard-focus.css (2136 baris) — Override khusus dashboard (pola spesifik dashboard)
  portrait.css        (226 baris)  — Style orientasi portrait
```

**MASALAH**: CSS terlalu monolitik — main.css berisi style untuk SEMUA screen dalam satu file. Seharusnya dipecah per komponen/screen.

### Komponen CSS Utama di main.css
1. **Tokens** (`:root`) — Baris 11-45
2. **Base reset** — Baris 47-70
3. **Toast** — Baris 83-106
4. **Screen base** — Baris 108-138
5. **Buttons** (`.btn`, `.btn-primary`, `.btn-danger`, `.btn-gold`, `.btn-xl`, `.btn-back`) — Baris 140-199
6. **Topbar** — Baris 200-218
7. **Loading screen** — Baris 219-239
8. **Dashboard** — Baris 241-312
9. **Dock navigation** — Baris 313-338
10. **Screen headers** — Baris 340-352
11. **Roster grid & hero cards** — Baris 353-404
12. **Upgrade slider** — Baris 406-443
13. **Shop cards** — Baris 445-469
14. **HUD elements** — Baris 471-586
15. **Modal box** — Baris 587-610
16. **Level-up screen** — Baris 620-650
17. **Game over** — Baris 660-688
18. **Composition/decoration layer** — Baris 720-797

---

## 5. Assets Tersedia

### Icons (`assets/icons/`)
```
cur-antibodi.svg    — Ikon Biokredit (currency gameplay)
cur-imun.svg        — Ikon Genom (currency premium)
hud-pulse.svg       — Tombol Pulse HUD
menu-battle.svg     — Navigasi: Battle/Arena
menu-campaign.svg   — Navigasi: Campaign
menu-codex.svg      — Navigasi: Bio-Pedia
menu-heroes.svg     — Navigasi: Heroes
menu-journey.svg    — Navigasi: Journey/Profile
menu-pass.svg       — Navigasi: Battle Pass
menu-quest.svg      — Navigasi: Quest/Mission
menu-rank.svg       — Navigasi: Rank
menu-shop.svg       — Navigasi: Shop
menu-squad.svg      — Navigasi: Squad/Lab
role-damage.svg     — Role: Damage
role-support.svg    — Role: Support
role-tank.svg       — Role: Tank
sec-gratis.svg      — Badge: Gratis
sec-item.svg        — Section: Item/Bag
sec-premium.svg     — Badge: Premium
sec-skin.svg        — Section: Skin
sec-suplemen.svg    — Section: Suplemen
ui-back.svg         — UI: Tombol kembali
ui-chest.svg        — UI: Peti/Chest
ui-flag.svg         — UI: Akhiri run
ui-heart.svg        — UI: HP/Health
ui-home.svg         — UI: Home
ui-kill.svg         — UI: Kill counter
ui-lock.svg         — UI: Locked item
ui-pause.svg        — UI: Pause
ui-play.svg         — UI: Play/Start
ui-star-empty.svg   — UI: Bintang kosong (gameover rating)
ui-star.svg         — UI: Bintang penuh
ui-timer.svg        — UI: Timer
ui-virus.svg        — UI: Virus/enemy
```

### Sprites (`assets/sprites/`)
```
portrait_tcd8.png             — Portrait T-Cell CD8 (hero)
portrait_macrophage.png       — Portrait Makrofag (hero)
deco_germ_teal/coral/sage.png — Dekorasi kuman melayang
deco_aura.png                 — Aura di hero stage
deco_dots.png                 — Dekorasi titik-titik
deco_coin.png                 — Dekorasi koin
deco_star_pop.png             — Dekorasi bintang (gameover)
deco_bubble_coral/mint/sage.png — Gelembung dekorasi
arena_limfe/lambung/paru/saraf/jantung.png — Thumbnail arena
enemy_bakteri.png             — Musuh: Bakteri
enemy_sel_kanker.png          — Boss: Sel Kanker
icon_limfatik/pencernaan/paru/saraf.png — Ikon organ
```

---

## 6. Temuan Audit UI/UX

### 6.1 Dashboard — Hierarki Visual Lemah
**Masalah**: Dashboard menampilkan terlalu banyak kartu tanpa hierarki jelas:
- Hero Stage (40% layar)
- Strain slot
- Battle Pass bar
- Kapsul card
- Play row (campaign card + mode stack)
- Stat strip (3 cell)
- Daily card
- Duo row: evo card + missions card
- Body card

**Standard roguelike**: Slay the Spire, Hades — satu CTA utama, informasi progres minimal yang relevan.

**Rekomendasi**: Terapkan F-pattern reading: Hero → CTA Main → 1-2 kartu progres paling relevan → Nav dock.

### 6.2 Duplikat CTA Play Button
**Masalah**: Ada TIGA implementasi tombol Play:
1. `.btn-play-big` dalam `campaign-screen.js`
2. `#btn-play.dashboard-play.main-coral` di `index.html` (baris 139)
3. `.dock-btn.dock-main[data-nav="prep"]` di dock navigasi

Dua tombol berbeda dalam satu layar dashboard membingungkan untuk pemain baru.

### 6.3 HUD Gameplay Terlalu Padat
**Masalah**: Gameplay HUD menampilkan 15+ elemen aktif simultan:
- Hud-top: equity-stage chip, kills, wave pill, timer, antibodi chip, imun chip, boss bar
- Kanan atas: XP bar + level badge
- Tengah kanan: minimap
- Kiri bawah: HP pill (portrait + level + HP bar)
- Kanan bawah: ability bar + pulse button (huge)
- Kiri tengah: quest panel toggle + body
- Dua menu toggle (journey + hero squad)

**Standard roguelike**: Vampire Survivors, Dead Cells — prioritas info. HUD minimal dengan progressive disclosure.

### 6.4 CSS Architecture Issues

#### Missing CSS Variable
`--cream-deep` digunakan di baris 1297 (`var(--cream-2, #f6efe2)`) dan lainnya tapi tidak didefinisikan di `:root`. Fallback inline dipakai, tapi inkonsisten dengan design system.

#### Monolithic CSS Files
- `main.css` (3013 baris) mengandung style untuk semua screen
- `dashboard-focus.css` (2136 baris) berisi override yang seharusnya di dalam komponen
- Menyebabkan specificity war (harus gunakan selectors panjang `#screen-dashboard .xyz`)

#### Hard-coded Color Values
Banyak warna ditulis inline bukan pakai CSS variables:
```css
/* Contoh masalah di main.css */
background: #bfe3d8     /* Seharusnya var(--teal-light) */
color: #5c430e          /* Tidak ada token untuk ini */
background: #efe3c8     /* Tidak ada token untuk track color */
```

#### No Dark Mode
Tidak ada `@media (prefers-color-scheme: dark)` — tidak ada dukungan dark mode sama sekali.

### 6.5 Typography — Font Tidak Dimuat
**Masalah**: Font stack menyebutkan Nunito/Quicksand tapi tidak ada:
- `@font-face` declaration
- Google Fonts `<link>` di `index.html`
- Hanya ada `<link rel="stylesheet" href="styles/main.css?v=51a" />`

Akibatnya: Jika sistem tidak punya Nunito/Quicksand, jatuh ke `ui-rounded` → `system-ui`. Pengalaman visual tidak konsisten antar device.

### 6.6 Level-Up Screen — Momen Kurang Impactful
**Masalah**: Level-up adalah momen KRITIS roguelike tapi implementasi saat ini:
- Hanya modal box (tidak full-screen immersive)
- Emoji fallback untuk ikon mutasi (`MUTATION_ICONS = { spikes: '🦔', ... }`)
- Hanya 3 choice cards tanpa visual differentiation tier yang kuat
- Tidak ada camera shake / screen flash saat level-up
- Synergy badge animasi terlalu subtle

**Referensi terbaik**: Hades II — level-up dengan chamber loot, visual yang dramatis. Slay the Spire — full-screen card selection dengan preview tooltip lengkap.

### 6.7 Game Over Screen — Action Items Bertumpuk
**Masalah**: Gameover screen punya terlalu banyak action:
1. Stars rating
2. Title + sub
3. Rank up display
4. Summary grid (stats 3 kolom)
5. Reward + chest
6. Go hook (3 progress terdekat)
7. Reset countdown
8. "Pilih hero untuk run berikutnya" section
9. Tonton Iklan 2x currency
10. Btn row: Main Lagi | Dashboard | Tantang | Build

**Rekomendasi**: Prioritas: Reward → Hero Selection → Single Primary CTA. Secondary actions di overflow/scroll atau disembunyikan.

### 6.8 Navigation — Terlalu Banyak Levels
**Masalah**: Dashboard punya 3 navigation layers:
1. `dock` (5 items): Hero, Bag, MAIN, Squad, Lab Genom  
2. `secondary-dock` (4 items): Campaign, Pass, Bio, Rank
3. Topbar: Account chip, Rank chip, currencies, language toggle

Standar mobile game: maksimal 5 item di bottom nav + hamburger untuk sekunder.

### 6.9 Card Design Inconsistency
Pola kartu berbeda-beda tanpa unified card system:
- Shop cards: 3-column grid, icon-centered, gradient background
- Roster cards: 2-column, circle avatar, card background
- Upgrade rows: full-width list, slider mechanism
- Campaign nodes: left-to-right icon + text
- Choice cards (level-up): icon-left + text-right
- Daily card: flex horizontal

Tidak ada card system yang unified dengan `variant` prop.

### 6.10 Missing UI States
Tidak ada systematic approach untuk:
- **Loading states**: Konten diisi JS tapi tidak ada skeleton/placeholder terlihat
- **Empty states**: Section kosong tanpa visual guidance
- **Error states**: Auth error ada tapi gameplay/API errors tidak sistematis
- **Offline state**: PWA tapi tidak ada offline state UI

### 6.11 Accessibility Gaps
- `aria-live` tidak ada untuk konten yang diisi JS secara dinamis
- Beberapa `<img>` dekoratif tidak punya `alt=""` yang tepat (ada yang kosong, ada yang ada teks)
- Kontras warna untuk teks `--ink-soft` (#41706a) di atas `--cream` (#fdf6e3) mungkin kurang di mode kecil

### 6.12 Z-Index Management
Z-index tersebar tanpa sistem:
```
game canvas: implicit
#ui: z-index 10
damage-vignette: z-index 5
tutorial-layer: z-index 8
hud elements: z-index 3, 5, 6, 7
coach-layer: z-index 80
cinematic-layer: z-index 90
hero-notice: z-index 120
```
Tidak ada design token untuk z-index layers.

---

## 7. Referensi UI/UX Roguelike Terbaik

### Pattern Kunci dari Game Terbaik

#### Hades / Hades 2 (Supergiant)
- **Boon selection**: Full-screen immersive, setiap kartu punya border warna per-dewa, preview dengan detail lengkap
- **HUD**: Minimal — hanya HP bar di sudut, dash meter, dan cast meter. Info lain muncul hanya saat relevan
- **Dashboard**: Chamber dengan visual kontekstual — bukan grid kartu generik
- **Visual language**: Greek mythology dengan palette warm — deep reds, golds, dark blues — konsisten

#### Slay the Spire
- **Card selection**: Full-screen, 3 kartu besar dengan tooltip on-hover detail penuh
- **HUD**: Clean — HP, energy, draw pile, discard pile, potion slots. No clutter
- **Map screen**: Roguelike path yang jelas dengan node types dibedakan secara visual
- **Typography**: Bold, legible, layer-based (card name → effect text → keywords)

#### Vampire Survivors (Mobile Port)
- **HUD**: Sangat minimal — hanya HP bar, timer, kill count. Treasure selection saja yang interruptif
- **Upgrade selection**: Full-screen pause dengan 3 pilihan bergaris besar, clear tier system (common/uncommon/rare/epic)
- **Warna tier**: Gray/Green/Blue/Purple/Gold — standar industri yang langsung dipahami pemain

#### Archero (Mobile Reference)
- **Dashboard**: Hero besar di tengah + tombol Play prominent + stat minimal
- **Upgrade sistem**: Skill cards clear dengan ikon besar, nama bold, effect text singkat
- **Color coding**: Rarity selalu ditandai dengan border warna konsisten

#### Balatro (Card Roguelike)
- **Card design**: Setiap kartu punya face + effect + rarity yang terlihat tanpa hover
- **Visual hierarchy**: Gold untuk rare/valuable, white untuk common
- **Context menus**: Tap untuk detail full di mobile

### Pola UI/UX yang Wajib Diterapkan
1. **Tier/Rarity Color System** yang konsisten: Common (gray) → Uncommon (green) → Rare (blue) → Epic (purple) → Legendary (gold)
2. **Progressive HUD Disclosure**: Info muncul saat relevan, bukan semuanya sekaligus
3. **Full-Screen Level-Up**: Momen level-up harus dramatis — layar penuh, visual impactful
4. **Clear Primary CTA**: Satu tombol Play yang sangat jelas per layar
5. **Card Shimmer/Shine** untuk item bernilai tinggi
6. **Haptic Feedback** di key moments (sudah ada sistem `js/systems/haptics.js`)
7. **Run Summary yang Engaging**: Data visualisasi yang membuat pemain bangga dan ingin coba lagi

---

## 8. Sistem Game Penting

### Currency System
- **Biokredit** (antibodi): Gameplay currency, didapat dari run
- **Genom** (imun): Premium currency, lebih langka

### Hero System (`js/entities/player.js`, `js/ui/screens/roster-screen.js`)
Heroes punya: id, name, title, spritePortrait, spriteIdle, color, role, skills

### Upgrade System (`js/systems/upgrade-system.js`, `js/ui/screens/upgrade-screen.js`)
Tabs: hero | pasukan | tim | global
- hero: upgrade spesifik per hero
- pasukan: upgrade ally troops
- tim: squad synergies
- global: upgrade global (bayar Genom)

### Evolution System (`js/systems/evolution-system.js`)
Hero bisa evolve stages 0-4, setiap stage punya visual & stat yang berubah.

### Battle Pass (`js/systems/battlepass-system.js`, `js/ui/screens/bp-screen.js`)
"Siklus Mitosis" — free + premium track, rewards per level

### Run Loop
1. Player pilih hero (prep screen)
2. Gameplay (HUD screen) — wave-based survival
3. Level up choices saat XP penuh
4. Boss di akhir setiap wave block
5. Gameover / victory summary

---

## 9. Panduan Pengembangan

### Menambah Screen Baru
1. Tambah `<section id="screen-X" class="screen" data-screen="X">` di `index.html`
2. Buat `js/ui/screens/X-screen.js` dengan export `show(params)` dan `hide()`
3. Daftarkan di `js/main.js` dengan `screenManager.registerScreen('X', XScreen)`
4. Tambah `X: 'state-value'` ke `APP_STATE_BY_SCREEN` di `screen-manager.js`

### Menambah Style Baru
- SELALU gunakan CSS variables yang sudah ada di `:root`
- Untuk screen-specific style, tambah di section screen yang relevan di `main.css` ATAU buat file terpisah
- Jangan duplicate property yang sudah ada di `dashboard-focus.css`

### Pola el() Helper
`el(tag, attrs, children)` dari `screen-manager.js`:
```js
el('div', { class: 'card', text: 'Hello' }, [
  el('button', { onclick: () => doSomething() }, [])
])
```

### Struktur Data
Data game ada di `getData()` — return object dari data-store.js.
Key properties:
- `getData().heroes.heroes[]` — array definisi hero
- `getData().skills.skills[]` — array skill
- `getData().campaign.chapters[]` — bab kampanye
- `getData().evolutions.stages[]` — tahap evolusi

---

## 10. Issue Tracker

Issues untuk proyek ini di-track di GitHub: `zamadye/imunverse`

### Priority Issues (Created from this audit)
Lihat GitHub Issues dengan label `ui-ux` untuk daftar lengkap temuan dari audit ini.

---

## 11. Branch & Version Info

- **Branch aktif**: `claude/audit-layout-ui-ux-3sph96`
- **Versi CSS**: `?v=51a` (lihat `index.html`)
- **Tahap development**: Beta aktif, fitur core sudah ada, polish & refinement sedang berjalan

---

## 12. ⚠️ Aturan Workflow Penting

### JANGAN Buat Pull Request

**DILARANG membuat PR dari sesi Claude Code.** Setiap kali PR dibuat, sesi kehilangan akses ke GitHub repo dan branch ter-close — owner harus membuka sesi baru dan mengulang seluruh siklus setup.

**Workflow yang benar:**
1. Push commit ke branch langsung dengan `git push`
2. Biarkan owner yang buat PR secara manual di GitHub
3. JANGAN gunakan `mcp__github__create_pull_request` atau `gh pr create`

---

*Document ini dibuat berdasarkan audit kodebase lengkap pada branch `claude/audit-layout-ui-ux-3sph96`. Update dokumen ini setiap ada perubahan signifikan pada arsitektur atau design system.*
