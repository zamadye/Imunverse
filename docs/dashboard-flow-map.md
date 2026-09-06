# Dashboard & Game Flow Map

Dokumen ini memetakan alur existing sebelum perubahan UI. Tidak mengubah runtime.

## 1. Bootstrap

`main.js:boot()` melakukan load data JSON → load bahasa → preload sprite → load/merge save → init game → register screen → wire event → start `GameLoop`.

Tidak ada bundler/build step. Entry point adalah `index.html` dengan ES modules.

## 2. Screen registry dan state

| Screen | Modul | Peran | State aplikasi |
|---|---|---|---|
| loading | loading-screen | preload | loading |
| title | title-screen | entry/title | title |
| auth | auth-screen | akun | tidak dipetakan eksplisit |
| dashboard | dashboard-screen | home/meta progression | dashboard |
| campaign | campaign-screen | peta tubuh & chapter | tidak dipetakan eksplisit |
| prep | prep-screen | keputusan sebelum run | dashboard |
| roster | roster-screen | pilih hero | roster |
| herodetail | hero-detail-screen | detail hero | roster |
| upgrade | upgrade-screen | upgrade squad | upgrade |
| shop | shop-screen | ekonomi/item | shop |
| bag | bag-screen | inventaris | dashboard |
| codex | codex-screen | Bio-Pedia | dashboard |
| bp | battlepass-screen | Battle Pass | tidak dipetakan eksplisit |
| rank | rank-screen | modal pangkat/GP | tidak dipetakan eksplisit |
| arena | arena-screen | modal pilih arena | dashboard |
| focus | focus-screen | modal fokus tubuh | dashboard |
| hud | hud-screen | gameplay overlay | gameplay |
| levelup | levelup-screen | modal level-up | gameplay melalui event |
| pause | pause-screen | modal pause | gameplay melalui event |
| revive | revive-screen | modal revive | gameplay melalui event |
| bosschest | bosschest-screen | modal hadiah boss | gameplay melalui event |
| gameover | gameover-screen | hasil run | gameover |

Catatan: `screen-manager.js` hanya memetakan sebagian screen ke `STATE.screen`; screen tetap bisa ditampilkan lewat registry walau tidak punya mapping eksplisit.

## 3. Alur pemain

### Entry dan dashboard

`loading → title → auth (bila diperlukan) → dashboard`

`auth-screen.js` mengarahkan kembali ke dashboard. `window.__IMUNVERSE_goDashboard` memaksa auth bila belum ada akun setelah run berakhir.

### Fast Play

`#btn-play` di `main.js`:

1. Ambil `STATE.meta.selectedHero`.
2. Validasi hero melalui `getHero()` dan `unlockedHeroes`/default.
3. Valid → `game.startRun(heroId)` langsung.
4. Tidak valid → `screenManager.show('roster')`.

Ini adalah alur 1-tap existing dan harus dipertahankan.

### Campaign

`campaign-card/#btn-play-big` → `campaign`.

`campaign-screen`:

1. Menentukan chapter pertama yang belum cleared.
2. Chapter terkunci bila chapter sebelumnya belum cleared.
3. Pemain memilih node yang cleared/current.
4. `selectedChapter` disimpan.
5. CTA → `prep`.
6. Prep memilih hero, mode, fokus tubuh, arena.
7. Untuk campaign baru, cinematic briefing dimainkan.
8. `game.startRun(heroId)`.

### Prep

`prep-screen.js` mengelola empat keputusan:

- hero (`getHeroStatus`)
- mode (`getModeUnlockStatus`)
- focus run (`bodySystems.focusRuns`)
- arena (`arenaUnlockStatus`)

CTA hanya aktif jika hero selected unlocked. Semua pilihan disimpan ke `STATE.meta`.

### Gameplay

`game.startRun()` → event `runstart` → `hud`.

Gameplay memakai canvas dan `GameLoop`; input keyboard/touch berada di `InputHandler`. Event penting:

- wave → HUD announce
- levelup → levelup modal
- pause → pause modal
- revive → revive modal
- bosschest → boss reward modal
- gameover → gameover screen

### Setelah run

`gameover-screen.js` menghitung reward, save, statistik, misi, rank GP, campaign clear, dan opsi:

- dashboard
- retry/prep
- lanjut campaign
- revive/double reward sesuai kondisi

## 4. Isi dashboard existing

`dashboard-screen.show()` menjalankan seluruh render berikut secara berurutan:

| Elemen | ID/class | Sumber data/sistem | Aksi utama |
|---|---|---|---|
| akun | `#account-chip` | account-system | auth/ganti akun |
| rank | `#rank-chip` | rank-system | rank modal |
| antibodi | `.currency-chip` + `#dash-currency` | `STATE.meta.currency` | dipakai upgrade/shop/reward |
| Imun Coin | `#dash-imun` | `STATE.meta.imun` | premium economy/shop |
| sound/settings/lang/codex | topbar buttons | audio/i18n/codex | global utility |
| sidebar | `.side-nav` | feature-gate | home, campaign, codex, BP, records, body |
| hero stage | `#dash-stage` | selected hero, evo, cinematic | level badge → upgrade |
| banner | `#dash-banner` | campaign + endless + mutator | campaign/prep |
| quick menu | `#quick-row` | daily, quests, shop, bag, codex, BP | scroll atau screen navigation |
| campaign card | `#campaign-card` | current chapter | `#btn-play-big` → campaign |
| mode stack | `#mode-endless`, `#arena-card`, `#mode-lab` | mode/arena/upgrade | prep, arena, upgrade |
| stats | `#dash-stats` | `meta.stats` | display only |
| daily | `#daily-card` | economy + monetization hook | klaim daily reward |
| evolution | `#evo-card` | evolution-system | evolve langsung di dashboard |
| missions | `.missions-card` | mission-system | display progress |
| leaderboard | `#leaderboard-card` | liveops-system | display top 3 lokal |
| body | `#body-card` | body-system | focus/prep/recovery ad |
| bottom dock | `.dock` | feature-gate + main.js | Play, roster, bag, upgrade, shop |

## 5. Feature gates existing

`data/features.json`:

- dock roster: wave 2
- dock bag: wave 4
- dock upgrade: wave 6
- dock shop: wave 8
- quick daily: wave 0
- quick quests: wave 2
- quick bag: wave 4
- quick shop: wave 8
- quick codex: wave 1
- quick BP: wave 6
- side campaign/home: wave 0
- side codex: wave 1
- side BP: wave 6
- side records: wave 3
- side body: wave 2

Perubahan label/menu tidak boleh memakai ID baru tanpa memperbarui `features.json`, `feature-gate.js`, dan route yang terkait.

## 6. Kesimpulan untuk redesign aman

1. `Play` existing sudah fast path; jangan menggantinya dengan campaign flow.
2. Hero stage bukan sekadar dekorasi: level badge membuka upgrade dan stage memuat evolusi.
3. Campaign card adalah entry point eksplorasi cerita, bukan pengganti Play.
4. Prep adalah tempat keputusan run yang lengkap; dashboard hanya perlu menampilkan ringkasan/CTA.
5. Daily, misi, evolusi, kondisi tubuh, dan reward punya logic aktif; tidak boleh sekadar `display:none` tanpa replacement.
6. Dock memiliki gate progression; struktur ID dan target harus dipertahankan atau gate/data ikut diubah.
7. Rank adalah modal target progression, bukan halaman Stats umum.
8. Collection paling dekat dengan Codex/Bio-Pedia; Bag adalah inventaris berbeda dan tidak boleh dihapus tanpa keputusan produk.
9. UI redesign sebaiknya dilakukan dengan mengubah urutan, kepadatan, ukuran visual, dan presentation layer, bukan memutus screen/event existing.
