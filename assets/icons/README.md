# assets/icons — set ikon UI Imunverse

Ikon menu gameplay (HUD) — **SVG digambar khusus** untuk konteks game (bukan ikon tools/stok).
Bahasa visual: bentuk bulat-organik ala sprite Imunverse, wajah kawaii pada sel/virus,
outline gelap tipis, bayangan lantai lembut. Palet **hanya** dari token `styles/main.css :root`:

| token | hex | pemakaian |
|---|---|---|
| `--teal` / `--teal-deep` / `--teal-dark` | `#2f9c8f` / `#1f7a70` / `#14584f` | badan perisai, Inang, lensa |
| `--sage` / `--green` | `#a9d795` / `#7cb86a` | sel imun, node bab "bersih" |
| `--coral` / `--coral-deep` | `#f2825c` / `#e96a4c` | patogen, bendera, gelembung misi, tenda |
| `--gold` / `--gold-deep` | `#f5c64f` / `#e0a72e` | chevron pangkat, bintang, koin, gagang lensa |
| `--card` / `--mint-2` | `#fffdf4` / `#eaf4dd` | highlight, latar emblem |
| `--ink` | `#123f3a` | mata, mulut, bayangan |

| file | menu | makna |
|---|---|---|
| `menu-journey.svg` | toggle menu 1 | Perjalanan Penjaga — emblem perisai + sel imun |
| `menu-campaign.svg` | Peta Tubuh | siluet Inang + jalur bab (node kondisi) + bendera |
| `menu-rank.svg` | Pangkat | lencana perisai + 3 chevron emas (insignia III/II/I) |
| `menu-codex.svg` | Bio-Pedia / Koleksi | lensa mikroskop mengamati virus |
| `menu-pass.svg` | Battle Pass | tiket musim (kartu imunisasi) berstempel bintang |
| `menu-heroes.svg` | toggle menu 2 + Heroes | regu sel imun (makrofag, neutrofil, sel T) |
| `menu-shop.svg` | Shop | kios bertenda + koin Antibodi |
| `menu-battle.svg` | Arena | ubin arena heksagonal + dua antibodi-Y bersilang |
| `menu-squad.svg` | Lab Pasukan | labu serum + antibodi-Y + kilau naik level |
| `menu-quest.svg` | panel Misi | penanda quest — gelembung sinyal koral + seru emas |
| `hud-serang.svg` | tombol SERANG (HUD) | antibodi-Y krem ber-outline ink menghantam virus koral mungil (mata silang) + bintang benturan emas — untuk latar teal |

## Ikon UI menu (BUILD 44 — work order #3)

Ikon **file SVG** untuk header, mata uang, kunci, peran hero, dan bagian Toko (dipakai lewat `<img>`):

| file | pemakaian | makna |
|---|---|---|
| `ui-back.svg` | tombol kembali semua layar menu (`.btn-back`) | panah pseudopodia teal gemuk |
| `cur-antibodi.svg` | chip Antibodi (header, harga, HUD, ringkasan run) | koin emas berelief antibodi-Y |
| `cur-imun.svg` | chip Imun Coin (header, harga, misi, BP) | permata heksagonal teal (bahasa pelat hex skill) |
| `ui-lock.svg` | hero/arena/bab/BP terkunci | gembok krem ber-outline teal-dark (terbaca di latar terang & teal) |
| `ui-star.svg` / `ui-star-empty.svg` | XP HUD, bintang level-up, rating run, klaim BP | bintang emas gemuk / siluet krem |
| `ui-virus.svg` | cadangan penanda "musuh/patogen" | virus koral berduri tumpul, alis nakal |
| `role-tank.svg` / `role-damage.svg` / `role-support.svg` | badge peran hero (roster, toko, detail hero) | perisai + sel tenang / ledakan koral + antibodi-Y bersilang / hati biru neutrofil + tanda tambah |
| `sec-item.svg` | Toko › Bekal Run, header Tas | tas selempang koral berkancing antibodi-Y |
| `sec-skin.svg` | Toko › Skin & Gaya | sel sage + tiga cipratan cat + kuas |
| `sec-premium.svg` | Toko › Paket Premium, aksesori Mahkota | peti teal berpita emas + mahkota bertatah permata Imun |
| `sec-suplemen.svg` | Toko › Suplemen Sistem Tubuh | kapsul teal/sage + hati koral |
| `sec-gratis.svg` | Toko › Dapatkan Imun Gratis | kotak hadiah teal berpita koral |

Ikon **SVG inline** (`js/ui/menu-icons.js`, pola sama dengan `skill-icons.js`) untuk baris upgrade Lab Pasukan,
kartu item Toko, chip stat detail hero, pilihan level-up, dan Tas — pemetaan `id → ikon` hidup di sisi UI
(`iconFor(def)`), data JSON **tidak diubah**; id tanpa ikon khusus jatuh ke `def.icon` lama:

| kunci | makna | dipakai oleh id |
|---|---|---|
| `damage` | bintang benturan koral + inti emas | `sq_damage`, `g_damage`, `damage` (level-up) |
| `vitality` | hati koral + tanda tambah | `sq_vitality`, `g_vitality`, `maxHP` |
| `weapon` | antibodi-Y di pelat teal | `sq_weapon` |
| `jurus` | petir emas | `sq_jurus` |
| `armor` | perisai teal | `sq_armor` |
| `swift` | sel sage melesat | `sq_swift`, `g_swift`, `moveSpeed` |
| `attack` | rentetan tiga antibodi-Y | `sq_attack`, `g_rapid`, `attackSpeed` |
| `range` | cincin reseptor + bidik | `sq_range`, `g_range` (menutup issue #7), `attackRange` |
| `nutrition` | heksagon glukosa emas berwajah | `sq_nutrition` |
| `steal` | hati + tetes terserap | `g_steal`, `lifeSteal` |
| `multi` | tiga antibodi menyebar | `projectileCount` |
| `pierce` / `crit` / `magnet` / `antigen` / `evo` | tembus, titik lemah, medan kemotaksis, kartu memori, sel bermetamorfosis | `pierce`, `critChance`, `magnet`, `antigen_boost`, `evo_*` |
| `serum_awal` / `vaksin_awal` / `kopi_limfa` / `pelindung_lendir` / `koin_ganda` | item bekal run | `shopItems` |
| `TAB_ICONS.hero/global/pasukan/tim` | tab Lab Pasukan | `#upg-tabs` |

## Ikon skill (33) — `js/ui/skill-icons.js`

Ikon **per-skill** (bukan per-jenis efek) untuk tombol skill HUD, chip skill di Prep, dan detail hero
digambar dengan bahasa visual yang sama, tetapi hidup sebagai **SVG inline** (modul JS) supaya dapat
dirakit di atas *pelat hex* (`skillPlateSvg()`: outline ink → rim warna skill → muka krem) dan diwarnai
lewat `--sk` tanpa `<img>` per tombol. Palet & aturan identik dengan tabel di atas (+ biru neutrofil
`#8fb7d6/#5b86a6` dari `menu-heroes.svg`). Ringkasan konsep per hero:

| hero | S1 | S2 | ULT |
|---|---|---|---|
| Mako | `taunt` makrofag galak + 3 panah menukik | `defensive_stance` perisai teal + sel bertekad | `devour` makrofag menelan virus (fagositosis) |
| Dendri | `mark_target` antibodi-Y emas menempel patogen (opsonisasi) | `heal_pulse` hati + tanda tambah | `overcharge` petir emas menyambar sel teal |
| Neutron | `grenade` granula biru bersumbu | `adrenaline` neutrofil melesat (garis kecepatan) | `blitz` cakram jaring NET menjerat virus |
| Eos | `poison_dart` dart + tetes racun | `evade` sel mengedip, bayangan putus-putus | `parasite_strike` tombak menghunjam cacing parasit |
| Baso | `histamine` awan + tetes histamin | `allergy` patogen pusing + bintang | `chemical_storm` awan badai teal + petir + hujan |
| Mastia | `barrier` tembok bata teal | `sting` sengat lebah emas | `anaphylaxis` ledakan 8 sudut koral + granula |
| T-Bolt | `precision_shot` panah tepat sasaran (perforin) | `lock_on` siku bidik mengunci patogen | `execute` patogen K.O. + bintang tumbukan |
| Helia | `rally` bendera koral + dua sel berkumpul | `command` megafon + gelombang | `battle_cry` Helia berteriak, gelombang dua sisi |
| Treg | `pacify` patogen terlelap + Zz | `shield_ally` perisai terang melindungi dua sel | `truce` bendera gencatan senjata berdaun |
| Bella | `antibody_burst` 3 antibodi-Y berformasi | `empower` sel mengepalkan lengan | `plasma_rain` awan menghujankan antibodi-Y |
| Nyx | `backstab` belati dari bulan sabit bayangan | `shadowstep` sel bayangan + jejak memudar | `annihilate` 8 subunit MAC mengepung patogen |

Skill baru tanpa ikon khusus otomatis memakai `KIND_FALLBACK` (per jenis efek pertama) — tetap berikon,
tetapi **tambahkan ikon khususnya** sebelum rilis.

Aturan: viewBox `0 0 64 64`, aman dibaca pada 26–40 px (satu bentuk dominan, detail ≤ 3),
tanpa teks, tanpa filter/gradient kompleks. Tambah ikon baru → ikuti palet & gaya di atas,
dan daftarkan di tabel ini.
