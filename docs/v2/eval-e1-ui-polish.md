# EVAL E1 — UI/UX & Narrative Polish (10 poin evaluasi user)

> Status: 🔄 dieksekusi · Basis: BUILD 38a (R1–R7 ✅) · Sumber: evaluasi langsung user pasca-rebuild

## 1. Objective
Sepuluh perbaikan lintas UI/UX/narasi hasil evaluasi user atas seluruh phase
terbangun — fokus: layout profesional, ikon berkarakter, cinematic hook,
navigasi kontekstual, karakter naratif hidup, tutorial presisi.

## 2. Sepuluh Poin (dari user, dipetakan ke kode)

| # | Poin user | Akar di kode | Solusi |
|---|---|---|---|
| 1 | Layout UI dashboard berantakan | `screen-dashboard` terlalu padat (side-nav + quick-row + 6 kartu + 2 dock) | Home minimal: stage + PLAY + dock ramping; kartu sekunder disembunyikan (`minimal-home`) |
| 2 | Ikon tombol standar (skill/serang) | `.ability-btn`/`.fire-btn` kotak polos + teks | Hex MOBA clip-path + glyph SVG per skill + ring warna skill; fire = claw slash |
| 3 | Cinematic dashboard kurang hook | `cine-banner.js` loop datar | Organ backdrop berdenyut + koreo serangan + impact flash + kamera |
| 4 | Back menu → dashboard, harusnya ke gameplay | `data-back`/close hardcode `show('dashboard')` | `backToContext()`: run aktif → HUD+resume, else dashboard |
| 5 | Bubble/kotak neon di karakter gameplay | ring biru `ally.js` + `drawPulseGlow` aura hero | Hapus ring ally + aura neon hero (bayangan & ring role tipis tetap) |
| 6 | Hapus opsi Virus di auth | sisa fraksi di auth/topbar/copy | Copot total elemen & copy fraksi; paksa `imun` |
| 7 | Sembunyikan menu, sisakan 1–2 modul | features.json + elemen dashboard | Gate dinaikkan + `minimal-home` (visible: Heroes + Misi); UI tetap ada, disembunyikan |
| 8 | Amara/RIA belum hidup; RIA abstrak | sprite statis, teks di bawah | Presenter overlay: karakter besar berdiri + mulut/tangan 2-frame + teks DI SAMPING; RIA di-redesign berkarakter |
| 9 | RIA tiap selesai wave; Amara saat hero/item baru | belum ada hook | `on('waveBreak')` → RIA popup; unlock hero/item → Amara menjelaskan spesifikasi |
| 10 | Tutorial modal salah tunjuk | clamp geometri kasar `coach.js` | Ukur ulang rect pasca-scroll, spotlight presisi, tip anti-nutup target |

## 3. Scope
- In: 10 poin di atas; suite `e2e-e1.mjs`; update suite lama yang assert
  elemen yang kini disembunyikan (produk berubah sesuai instruksi user).
- Out: redesign penuh layar dalam menu (bertahap nanti, kata user); PvP Virus.

## 4. Definition of Done
- [x] 10/10 poin terverifikasi di browser (suite + screenshot).
- [x] Regresi hijau (suite lama disesuaikan bila assert elemen tersembunyi).
- [x] Buster naik (39a); commit+push; laporan Bahasa Indonesia.

## 5. Hasil Verifikasi (2026-09-08)
- `scripts/e2e-e1.mjs` — **32 PASS, 0 FAIL** (menguji ke-10 poin).
- Regresi penuh 20 suite: r1(14) r2(18) r3(18) r4(15) r5(13) r6(15) r7(14),
  onboarding(21), mlbb(20), retention(20), eco(14), balance(13),
  progression(18), purpose(13), v2phase1(15) 2(16) 35(24) 4(21) 6(15) —
  **semua 0 FAIL**.
- Penyesuaian suite lama karena desain E1 (produk berubah sesuai instruksi):
  - `e2e-onboarding`: rank-chip kini tersembunyi di minimal-home; gate
    dibalik (roster terbuka awal, shop ter-gate 5 run).
  - `e2e-r1`: asersi disclosure diganti (roster open awal, shop hidden,
    bp masih hidden di 5 run).
  - `e2e-balance`: simulasi 15 run (rank butuh 15).
  - `e2e-purpose`: set totalRuns≥3 sebelum menguji rank-chip.
- Akar "kotak neon" poin 5 TERNYATA DUA: ring `ally.js` **dan**
  `getTintedSprite` soft-light yang mengecat piksel transparan — fix
  `destination-in` clip ke alpha sprite (diverifikasi: corner alpha 0).
- Aset baru: `assets/sprites/{ria,amara}_pose_{idle,talk}.png` (transparan,
  ≤480px); dipakai presenter + cinematics.json + narrative.json +
  sprite-loader manifest (sprite lama dr_amara/ria_signal tidak direferensi).
- Komponen baru: `js/ui/presenter.js` (overlay karakter hidup 2-frame,
  teks di samping, tap-to-dismiss + auto-hide).
- `data/coach.json` ditulis ulang: 3 langkah menargetkan elemen yang
  benar-benar terlihat di home minimal (PLAY, layar pantau, akun).
- Screenshot: `shots/review/e1-home-minimal.png`, `e1-gameplay-final.png`,
  `e1-ria-wave.png`, `e1-amara-unlock.png`.
