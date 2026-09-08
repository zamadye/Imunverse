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

Aturan: viewBox `0 0 64 64`, aman dibaca pada 26–40 px (satu bentuk dominan, detail ≤ 3),
tanpa teks, tanpa filter/gradient kompleks. Tambah ikon baru → ikuti palet & gaya di atas,
dan daftarkan di tabel ini.
