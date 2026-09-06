# Imunverse Gameplay UI Audit

Audit dilakukan setelah membaca `index.html`, `styles/main.css`, `styles/dashboard-focus.css`, `hud-screen.js`, `game.js`, `player.js`, `skill-system.js`, `spawn-system.js`, dan `cinematics.js`. Tidak ada perubahan visual baru dibuat dari audit ini.

## Referensi eksternal yang dipakai

- Vampire Survivors: aksi dimulai cepat, kontrol utama adalah movement, auto-attacking mengurangi input, dan keputusan utama berada di level-up. The Verge menjelaskan bahwa pemain langsung masuk aksi dan tidak perlu menekan tombol untuk senjata; review lain menekankan loop memilih stage/character/upgrade sebagai titik keputusan.
- Brotato: wave pendek, shop/build decision berada di antara wave, dan screenshot gameplay menunjukkan informasi utama tidak mengambil alih arena. Referensi screenshot MobyGames mengelompokkan main menu, early run, shop setelah wave, level-up choices, run summary, roster, dan item progress sebagai surface terpisah.
- Hades: HUD tetap informatif tetapi periferal; health/build/mission memberi keputusan tanpa menutup combat. Analisis UX Hades menekankan signs/feedback: enemy intent, health warning, spawn cue, audio/visual hit confirmation, dan mission yang dipin secara hemat.

## Prinsip desain yang diturunkan

1. Arena dan threat readability adalah layer pertama.
2. HUD hanya menampilkan keadaan yang mengubah keputusan dalam 3 detik ke depan.
3. Meta currency, codex, rank, campaign dan quest bukan elemen permanen di arena; aksesnya lewat pause/menu context.
4. Satu fungsi satu lokasi: tidak ada footer + sidebar + hamburger yang menduplikasi tujuan yang sama.
5. Auto-attack berarti tombol serang manual harus benar-benar meaningful (aim/active attack), bukan tombol pajangan.
6. Level-up/skill harus memiliki feedback target yang terlihat: hit, damage, status, sound, shake, dan cooldown.
7. Wave perlu memiliki readable phases: spawn → pressure → clear/break → next threat.

## Audit struktur existing

### HUD DOM saat ini

`index.html#screen-hud` berisi:

- `hud-top`: kills, hero/ally level, wave, timer, boss bar, currency, Imun Coin, pause;
- `hud-buffs`;
- minimap;
- wave announce;
- progression gate;
- mission tracker;
- ability banner;
- combo;
- tutorial layer;
- hint;
- hero status + portrait + HP + XP;
- ability bar + tombol fire;
- rotation overlay.

Secara fungsi banyak komponen valid, tetapi terlalu banyak sistem diberi surface permanen. Target HUD produksi seharusnya:

- wave/timer kecil;
- HP/XP kecil;
- skill + active attack;
- pause/menu;
- mission satu baris hanya saat aktif;
- announce temporer.

### Feedback yang sudah benar

- `game.js` memproses projectile collision dan floating damage.
- `skill-system.js` memiliki effect executor untuk area, strike, execute, annihilate, heal, shield, mark, pull, dash, dan projectile.
- `EffectsSystem`, hit-stop, camera shake, boss telegraph, hazard dan particle sudah ada.
- `spawn-system.js` sekarang memiliki wave clearing/break.
- `cinematics.js` sudah menjadi canvas cutscene data-driven.

### Masalah yang perlu diperbaiki pada pass berikutnya

1. **HUD hierarchy masih berasal dari beberapa fase design berbeda.** CSS memiliki override bertumpuk sampai layer fase lama; hasil visual tidak memiliki satu baseline yang jelas.
2. **Character status masih memiliki struktur glass/pill warisan MLBB.** Walau diperkecil, status harus menjadi minimal bars/portrait tanpa card container.
3. **Skills belum selalu terbaca dampaknya.** Skill heal/buff/pull defensif tidak selalu memberi target marker atau status label yang konsisten.
4. **Arena feedback perlu landmark dan threat contrast, bukan lebih banyak HUD.** Props sudah ada di `background.js`, tetapi opacity/kontras harus dituning setelah screenshot runtime baru dibuat.
5. **Wave text harus menjadi micro-status, bukan panel.** Boss announce tetap boleh menjadi scene temporer.
6. **Pause/menu context perlu menjadi satu-satunya tempat untuk Campaign/Codex/Rank.** Jangan mengulang navigasi tersebut di dashboard dan gameplay sekaligus.
7. **Quest tracker harus hanya menampilkan quest yang accepted/active.** Quest yang belum diambil tetap berada di dashboard/quest screen.
8. **Gameover dan level-up adalah scenes, bukan modal card yang memaksa semua ringkasan tampil sekaligus.** Ringkasan detail bisa scroll; CTA selalu fixed/visible.

## Keputusan desain berikutnya

Sebelum perubahan code berikutnya, gameplay HUD akan direduksi menjadi tiga zona:

- **Top-left:** wave/timer kecil + objective satu baris.
- **Bottom-left:** portrait + HP/XP minimal tanpa card.
- **Bottom-right:** ability slots + active ranged attack.
- **Top-right:** pause/menu icon saja.

Semua item lain bersifat event-driven dan muncul sementara:

- combo saat combo aktif;
- boss bar saat boss hidup;
- damage/skill banner saat impact;
- quest tracker saat quest active;
- cinematic scene saat level-up, boss clear, victory, rank-up.

## Catatan verifikasi

Screenshot historis sudah dihapus sesuai permintaan sebelumnya. Karena itu audit ini memakai source aktif dan screenshot yang sebelumnya sudah diperiksa, bukan membuat klaim baru berdasarkan screenshot yang sudah tidak ada di workspace. Untuk pass implementasi berikutnya, capture runtime baru harus dibuat di luar repository/temp untuk memverifikasi portrait, landscape, mobile viewport, skill impact, dan gameover.
