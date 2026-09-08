# Imunverse — UX Prioritization Addendum (dari user, menyertai Combat Differentiation Doc)

Breakdown teknis: mana yang **dipertajam sekarang**, mana yang **disembunyikan dulu (bukan dihapus)**, dan mana yang perlu **dipertimbangkan ulang total** — plus urutan unlock bertahap berbasis trigger, bukan berbasis waktu.

## Pertajam sekarang (core loop, harus sempurna dulu)

- **Tombol PLAY → langsung masuk run**, tanpa lewat Mode/Fokus Run/Arena. Kalau perlu variasi, kasih default otomatis (misal random atau "Standard") dan expose pilihan itu belakangan setelah run ke-3+.
- **Onboarding tanpa gate akun di depan.** Biarkan 1 run pertama dimainkan sebagai guest — baru minta buat akun setelah run selesai (di layar hasil, saat mereka sudah dapat reward dan merasa "sayang kalau hilang"). Ini pola standar hybrid-casual: friksi akun taruh setelah investasi emosional, bukan sebelum.
- **Combat feel**: auto-attack, level-up pick, wave/boss loop, revive-ad di titik kematian. Ini nyawa produk — semua effort teknis harus lari ke sini dulu sebelum nambah sistem baru apapun.

## Sembunyikan dulu dari UI utama (module tetap ada di kode, tinggal di-unlock bertahap)

| Module | Kapan di-unlock |
|---|---|
| Squad Upgrade / Lab Pasukan | Setelah run ke-2/ke-3, saat Antibodi pertama sudah terkumpul cukup untuk 1 upgrade |
| Shop | Setelah run pertama selesai, bareng dengan currency pertama masuk |
| Bio-Pedia / Collection | Setelah mencapai wave tertentu (misal wave 10) atau hero ke-2 ditemukan — fitur "long game", percuma dipajang saat user belum tahu ada apa di dalamnya |
| Battle Pass | Setelah D2/D3 return atau 3-5 sesi selesai. BP dirancang untuk user yang sudah niat balik lagi; menampilkannya di sesi pertama cuma nambah decision fatigue |
| Rank/Rekor (leaderboard) | Tunda sampai ada basis pemain nyata — leaderboard kosong/sepi justru bikin game terasa mati |

Logika unlock-nya sebaiknya **trigger-based** (jumlah run, wave tercapai, currency terkumpul), bukan time-based — karena sesi cuma 3-8 menit, gate berbasis "hari ke-X" nggak relevan di awal.

## Harus dipertimbangkan ulang total, bukan cuma ditunda

- **Faction selection "Pilih Pasukanmu" di layar buat akun** — fitur PvP yang belum dibangun. Menampilkan pilihan yang belum berfungsi di momen onboarding paling kritis berisiko bikin ekspektasi salah dan trust turun begitu mereka sadar sisi Virus nggak ada isinya. **Copot total dari alur sampai PvP benar-benar siap**, jangan sekadar disembunyikan.
- **Mode landscape wajib** — reconsider atau minimal A/B test versus portrait/hybrid, mengingat kebiasaan main HP satu tangan di pasar SEA. Keputusan teknis lebih besar (butuh rework layout canvas) jadi masuk kategori "evaluasi", bukan "buang sekarang".
- **10+ destinasi nav** — jangan dihapus fungsinya, tapi **collapse jadi 3-4 tab utama** (Home/Play, Squad, Shop, Profile) dengan progressive disclosure: tab baru muncul begitu module terkait ter-unlock, bukan semua tab kelihatan sejak awal walau isinya kosong/nol.

## Cara validasi sebelum commit

Karena ini keputusan UX yang effort-nya nggak kecil untuk direvert, paling murah divalidasi lewat **A/B cohort**: satu grup dapat dashboard penuh seperti sekarang, satu grup dapat versi minimal (Play-only + unlock bertahap). Bandingkan D1 retention dan rata-rata durasi sesi pertama — metrik paling murah untuk membuktikan hipotesis "dashboard kompleks = churn" sebelum reorganisasi besar-besaran di codebase.
