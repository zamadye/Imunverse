# ROADMAP PHAGOS — DARI BIBLE KE PRODUCTION

**Build:** `50a` → naik per sprint (`js/core/version.js`) · **Tanggal:** 15 September 2026 · **Branch:** `arena/01a09f31-imunverse`
**Sumber kebenaran:** [`docs/PHAGOS-BIBLE.md`](docs/PHAGOS-BIBLE.md) (mekanik + angka) dan [`docs/PHAGOS-IDENTITY.md`](docs/PHAGOS-IDENTITY.md) (jiwa + bahasa).
Roadmap ini adalah **turunan operasional** dari bible yang sudah **direkonsiliasi dengan kondisi nyata branch ini** (audit 15 Sep 2026). Bila roadmap dan bible bertentangan, **bible menang** — kecuali §5 (keputusan terbuka) yang memang menunggu owner.

> **Deviasi cabang (dicatat, bukan dilanggar):** bible §13.1 menyuruh "buat branch baru dari `main`".
> Sesi kerja ini terikat ke `arena/01a09f31-imunverse` yang sudah berisi eksperimen gameplay — cabang ini
> DIPAKAI sebagai cabang PHAGOS. Freeze branch Imunverse dipatuhi: tidak ada merge dari sana.
> **Deviasi checkpoint:** tidak ada device/browser di lingkungan kerja — semua checkpoint "test di device"
> DILAKUKAN OWNER. Agent berhenti (STOP) di tiap checkpoint dan menunggu feedback, sesuai aturan bible.

---

## 0. STATUS BENCHMARK PRODUKSI (bible §0) — hasil audit

Legenda: ✅ selesai · 🟡 sebagian/butuh verifikasi · ❌ belum · ⚠️ selesai tapi menyimpang (lihat §5).

### Gameplay

- [x] ✅ Medan membran pasif (kontak, tanpa tombol) — `membrane-system.js` + `data/membrane.json`
- [x] ✅ Pulse satu tombol, cooldown per hero — `hud-screen.js` (indikator radial ada, baris ~315)
- [x] ✅ Engulf otomatis <15%, heal 7%, +1 Bio-Point — `membrane.json` cocok §2.1
- [~] 🟡 18 mutasi 3 tier + visual kumulatif — data ✅ (`bioCost` 0/5/15 ✅); stat boost safety-net ✅ 5 entri §4.1 (aturan pool level-up 🟡 Sprint 2); visual kumulatif 🟡 (18 overlay ada — butuh verifikasi device)
- [~] 🟡 6 trait wave 6/10/14 — data ✅ (waves + warn 5s ✅, seleksi counter ada); ambang trigger vs §4.2 🟡 (verifikasi)
- [~] 🟡 11 hero bentuk medan unik — struktur ✅, nama ✅ cocok bible; **angka DEVIASI dari tabel §3** (lihat §2.1 — retune wajib)
- [~] 🟡 8–9 level up per run referensi — curve ✅ (80+35L); run endless terukur 49–60 lv karena pacing spawn ×~4 terlalu lambat → Sprint 3
- [~] 🟡 Run 3–8 menit — TERUKUR: ±20 mnt/16 wave (AI headless); pacing spawn ×~4 → Sprint 3

### Progresi & ekonomi

- [ ] ❌ Biokredit ~916/run — earn rate masih lama + ada faucet Genom dari run (lihat §2.3)
- [x] ✅ XP curve 80+35L — `xpNeed = 80+35L`, sumber per tipe kill, band/kombo/orb-tier dicabut
- [ ] ❌ Siklus Mitosis 30 lv / ~26 hari — masih BP lama (40+10L, 500, tanpa cap)
- [ ] ❌ Pangkat 13 tier / ~14 hari — masih GP lama (18/2/120/250)
- [ ] ❌ Hero lv20 / ~8 hari — masih 150/1.35 + scaling shooter
- [ ] ❌ Homeostasis BK→Genom — masih 6 jalur shooter, 1 mata uang
- [x] ✅ Kapsul Membran setelah run pertama — pool cocok PERSIS §10.3; share 1080×1080 ✅

### Monetisasi

- [ ] ❌ Tangga Genom 4 tier + validator — masih bundle lama
- [ ] ❌ Kapsul Perdana — belum ada
- [ ] ❌ Genom Harian — belum ada
- [ ] ❌ Mitosis premium 800/500 — masih 500/self-paying
- [ ] ❌ Iklan 10 Genom ×6/hari — masih 80 Biokredit ×6/hari
- [ ] ❌ 2 sink berulang — revive/chest tanpa opsi Genom

### UI/UX

- [ ] ❌ Dashboard §11.1 — layout lama (banner strain ✅ satu-satunya bagian baru)
- [~] 🟡 HUD §11.2 — tombol Pulse + radial ✅; dua bar ❌ (chip warisan banyak)
- [~] 🟡 Gameover §11.3 — tombol share/challenge/build ✅; hook ❌; kartu hero ❌
- [x] ✅ Kapsul animasi + share — ✅ (kualitas "layak direkam" 🟡 verifikasi device)
- [ ] ❌ Font kustom — belum ada
- [~] 🟡 Rebrand teks — PHAGOS ✅, Biokredit/Genom display ✅; kosakata bible ❌ (lihat §3)

### Infrastruktur

- [ ] ❌ PWA — belum ada (`manifest.json`/`sw.js` tidak ada)
- [x] ✅ Save `phagos.save.v1` + fallback — ✅ (`save-manager.js`)
- [ ] ❌ `npm run validate` hijau — validator belum ditulis (greenfield, sesuai §12.3)
- [~] 🟡 Domain phagos.space — URL fallback di kode ✅; DNS/deploy di luar repo

**Skor: 8 ✅ · 7 🟡 · 22 ❌ · 1 ⚠️ (referral, D8).** Sprint 1–2 tinggal
menyelesaikan; Sprint 3–7 hampir utuh.

---

## 1. RENCANA SPRINT (sisa pekerjaan saja, berurutan)

**Aturan main (dari bible §13):** Sprint 1 HARUS selesai + checkpoint device
sebelum Sprint 2. Setiap CHECKPOINT = STOP, tunggu feedback owner. Jangan
stack sprint tanpa verifikasi. Setiap sprint: bump BUILD + `?v=` seragam,
string baru ke `lang.json`, angka baru di `data/` (bukan `js/`).

### Sprint 1 — Core combat ⬅️ MULAI DI SINI

- [x] 1. Branch — dipakai `arena/01a09f31-imunverse` (deviasi tercatat)
- [x] 2. `data/membrane.json` — ✅ (tambah `contactDpsBase: 8` sebagai fallback; putuskan D10)
- [x] 3. Kontak pasif — ✅
- [ ] **4. CHECKPOINT DEVICE (owner): jalan → musuh meleleh. STOP.**
- [x] 5. Pulse — ✅
- [ ] **6. CHECKPOINT DEVICE (owner): Pulse memuaskan. STOP.**
- [x] 7. Engulf — ✅ (hit-stop 0,15 dtk §2.2 ✅ di `gamefeel.json`)
- [x] 8. Pembersihan proyektil — hero `_weapon` beku ✅; pipeline `game.js` terverifikasi bersih (recon: jalur shooter mati, tidak ada spawn proyektil hero)
- [x] 9. **XP curve §5** — `xpNeed = 80+35L` ✅; sumber per TIPE kill (kontak/engulf/Pulse/dot/melee/skill/insidental + bos) ✅; band/kombo/orb-tier dicabut ✅; devoured-branch +20 XP engulf ✅ (D6 moment — D6 TERTUTUP)
- [x] 10. Rebrand — teks inti + kosakata §3 ✅; `?v=` diseragamkan ✅
- [x] Ukur **run referensi PHAGOS** ✅ — `scripts/measure-run.mjs` (endless headless, AI seek+Pulse+auto-pick, tally kill per cause) — fondasi Sprint 3:

  | Hero | Wave | Durasi | Kill | Engulf | Pulse | Kontak | Insidental* | Lv | Pick | XP | BK | Bio | Bos | Akhir |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Macrophage | 16 | 1236 dtk | 3943 | 1404 | 209 | 128 | 2202 | 55 | 54 | 57100 | 5184 | 2738 | 3 | hidup (HP 879) |
  | Neutrofil | 5 | 221 dtk | 641 | 180 | 156 | 34 | 271 | 17 | 16 | 6656 | 520 | 290 | 0 | MATI wave-5 (bos) |
  | Natural Killer | 16 | 1182 dtk | 3811 | 1218 | 178 | 148 | 2267 | 49 | 48 | 45015 | 5094 | 2366 | 3 | hidup (HP 790) |

  \* Insidental = parasit + rantai + antigen + cascade + cermin (3 XP; semua penyebab ter-tag, `other`/`none` = 0).
  Temuan → Sprint 2/3: (a) pacing ±74 dtk/wave vs bible 15 wave/5–7 mnt — spawn pacing ×~4; (b) kontak hanya ±3% kill late-game — mutasi carry; (c) Neutrofil mati di bos wave-5 — cek balance hero/bos; (d) pool mutasi habis di ±11 kartu → fallback legacy ✅ by-design.
  Bug produksi ditemukan & diperbaiki saat pengukuran: filter tawaran mutasi satu-arah vs `applyMutation` dua-arah (kartu tak-terpilih bisa ditawarkan) — `mutation-system.js` sekarang dua-arah; crash endless `addCurrency(meta)` → `STATE.meta`.
- [x] Pengerasan produksi pasca-Sprint 1 ✅ — pool shooter → 5 safety-net §4.1 (Sitoskeleton/Kemotaksis/Enzim Lisosom/Sinyal Kalsium/Pseudopodia); evolusi senjata + kombo (state/UI/toast/audio) + `triggerAttack`/`audio.swing`/`comboXpMult`/`shotsFired` dicabut; hit-stop satu sumber (`gamefeel.json`, engulf 0,15 §2.2); tombol `btn-fire`→`btn-pulse` (+aset `hud-pulse.svg`, hapus blok CSS ganda); modal "Level Up!"→"BERMUTASI!"; log `[MAP]`/fallback dicabut atau dev-gated; `e2e-v2phase4`→`test-safetynet.mjs` (17/17 ✅); e2e basi diselaraskan (serang-manual→Pulse, XP murni, tanpa combo).
  Backlog antar-sprint (bukan Sprint 1): kosakata `lang.json` + layar toko/upgrade/battlepass (Sprint 3–5); perilaku squad tembak vs membran-mini = opsi A/B §15 (owner, setelah Sprint 2); label SERANGAN/SENJATA di upgrade-screen (Sprint 3).

### Sprint 2 — Mutasi & hero

- [x] 11. `data/mutations.json` — ✅ (18, tier, bioCost cocok)
- [x] 12. **Pool level-up §4.1** (L2–4 / L5–8 / L9+) + **stat boost membran** ✅ (ganti pool shooter `levelUpPool`)
- [x] 13. `data/enemy-mutations.json` — ✅
- [x] 14. Inject strain ✅ (mekanisme + ambang trigger = tabel §4.2)
- [x] 15. **Retune 11 hero ke tabel §3** ✅ (radius + cooldown; D3 + D5 selesai — lihat bawah)
- [x] 15b. **D3 instan** ✅ — Bella auto-antibodi + Pulse 8-arah, Eos Pulse granul ×5: SEMUA damage instan-dalam-medan (visual swipe/burst, cause `antibody`/`pulse`); nol proyektil pemain. `summon_homing` → `instant_multi`.
- [x] 15c. **D5 pasif** ✅ — 33 skill punya `trigger` (pulse 16 / damaged 10 / engulf 4 / kill 3); `SkillSystem.notify()` dipicu Pulse/engulf/kill/damaged (guard rekursi 2); cast+upgrade manual DICABUT (game/main/HUD/keyboard 1-3/Shift); HUD = baris pasif (label pemicu + pip rank); rank 2 otomatis Lv 15; toast aktivasi Lv 3/5/10 + rank 2. E2E r4/r5/r7/mlbb/character-visual ditunda ke item 16.
- [x] 16a. **Patch pacing darurat D14+D15** ✅ — temuan device: (1) buff nutrisi compounding (serat ×1,25/pickup → xpMult ×12!) → SEMANTIK TERKUAT-MENANG; (2) supply 227 kill/wave (eco target 220, interval min 0,3 dtk) → ±40/wave; (3) XP engulf 20→4 + Bio tiap-8-telan + heal 7%→2%; (4) boss chapter ×4–×14 HP + dmgMult, roster 5/10/15, kuota 120–300, boss bab 1; (5) gate timeout 180 dtk anti-stall; (6) harness anti-stall (flee-dekat). Hasil ukur: ch1 menang 103 dtk/wave 3, ch2 135 dtk/wave 4, endless wave 10: 344–413 kill / level 10 / ±2.400 XP (target bible: 400/8/1.926 — dalam ±30%).
- [x] 16. **CHECKPOINT** ✅ executable: E2E basi diselaraskan ke API pasif D5 (r4/r5/r7/mlbb/character-visual; browser-run pending sandbox) + 8 uji D5 di verify-phagos HIJAU. Retest device + pulse unik hero → fase evaluasi akhir (owner).

### Sprint 3 — Ekonomi & progresi

- [x] 17. **Earn rate §6.2** (kontak 1,0 / Pulse 1,5 / engulf 8 / boss 60 / wave 10); **cabut faucet Genom run** (D7)
- [x] 18. **Item §7**: rename ID ke `serum_regenerasi` dkk + biaya §7.1; `atp_surge` = 200 Genom; sumber §7.2 (drop boss, BP track, misi mingguan); migrasi save consumable lama
- [x] 19. **Retune progresi §8**: Mitosis (120+30L, cap 150/450, misi, 800/500) · Pangkat (4/0,20/4/25/50) · Diferensiasi (ganti sistem equity!) · Hero (120/1,20 + scaling membran) · Kampanye (×2,2 + 3 tingkat + migrasi) · Mastery (6.100 XP, D12)
- [x] 20. **Validator greenfield** `tools/validate-catalog.mjs` + `tools/validate-retention.mjs` + `npm run validate`
- [x] **21. CHECKPOINT: `npm run validate` HIJAU. STOP bila merah — perbaiki angka, jangan longgarkan tes.**

### Sprint 4 — Monetisasi & toko

- [ ] 22. **Katalog §9.1** (Kapsul Perdana, 4 tangga, Kit Riset, Genom Harian; whale nonaktif) + `grantContents` tipe baru (drip/subscription)
- [ ] 23. Bonus pembelian pertama 2× (genom_500/1000, sekali per tier, penanda hilang setelah pakai)
- [ ] 24. **2 sink**: Lanjut Run 50 (revive modal) + Peti Mutasi 150 (bosschest modal, pity terpisah)
- [x] 25. Welcome box — ✅ (kecuali verifikasi "layak direkam" di device)
- Sink 3–5 (§9.2: loadout/reset/refresh) = **Fase 2** (butuh UI baru) — eksplisit ditunda

### Sprint 5 — UI overhaul

- [ ] 26. **Dashboard §11.1** (hero 40% + medan berdenyut, topbar 4 slot, BP bar, kapsul kondisional, MAIN coral, dock solid `[Hero][Tas][MAIN][Squad][Lab Genom]`)
- [ ] 27. **HUD §11.2** (dua bar semi-opaque; atas: HP/wave/kill/timer/BK/G; bawah: misi/item/Pulse+cd) — cabut chip warisan
- [ ] 28. **Gameover §11.3** (hook §10.2 + kartu hero swipe + MAIN LAGI + iklan/share/home)
- [ ] 29. Font kustom heading/angka (self-host, bukan Google Fonts CDN — offline PWA)
- [ ] 30. Hitung mundur reset (dashboard, gameover, panel misi; urgensi <4 jam)
- [ ] Sapuan kosakata §3 + radius ≥12px + nada RIA (identity)

### Sprint 6 — Retensi & akuisisi

- [ ] 31. Comeback §10.1 (luruh ≤2 hari, hadiah "Antibodi Selamat Datang", streak + pengampunan + putaran hari-7)
- [ ] 32. Session hook §10.2 (3 progres, ETA run dari laju pemain — butuh `metrics.js` + field engulf/pulse §14)
- [x] 33. Strain of the Week — ✅
- [x] 34. Challenge link — ✅ (MVP localStorage; server = Fase 2)
- [ ] 35. PWA (manifest + SW + prompt run ke-3 + ikon logo compact)
- [~] 36. Referral — ⚠️ selesai tapi menyimpang (D8: hadiah sekarang vs "nanti")
- Build share (di luar bible — DIPERTAHANKAN: lolos checklist identity "ingin bagikan")

### Sprint 7 — Polish & benchmark

- [ ] 37. Gamefeel per aksi (kontak/Pulse/engulf/level/mutasi-musuh — §2.2 + fantasi predator)
- [ ] 38. Audio — hanya bila resource ada (identitas suara sudah dikunci di identity doc)
- [ ] 39. Jalankan benchmark §0 satu per satu
- [ ] 40. Fix semua yang belum ✓ — **definisi production-ready**

---

## 2. TABEL MIGRASI ANGKA (lama → bible)

### 2.1 Hero (cabang ini → bible §3)

| Hero (id) | Radius | Cooldown | Catatan perilaku (audit Sprint 2) |
|---|---|---|---|
| Mako (`macrophage`) | 72 → **52** | 2,0 ✅ | Dorong + heal ×1,5 + BP ×1,3 — verifikasi |
| T-Bolt (`tcd8`) | 48 → **44** | 1,8 → **1,5** | Dash + insta <25% — verifikasi dash ada |
| Dendri (`dendritic`) | 48 → **40** | 2,2 → **2,5** | Sapu 180° + mark — verifikasi |
| Neutron (`neutrophil`) | 38 → **32** | 1,0 ✅ | DPS tinggi + speed — verifikasi |
| Eos (`eosinophil`) | 48 → **40** | 2,0 ✅ | Granul homing — ⚠️ konflik proyektil (D3) |
| Baso (`basophil`) | 52 → **44** | 2,2 → **2,5** | Denyut 0,7–1,3× + histamin — verifikasi |
| Mastia (`mastcell`) | 0 → **56** | 3,0 → **4,0** | Tanpa medan pasif + Pulse 4× — verifikasi |
| Helia (`tcd4`) | 60 → **48** | 2,4 → **2,0** | Support + buff squad — tergantung D4 |
| Treg (`treg`) | 60 → **48** | 2,0 → **3,0** | Slow + cleanse — verifikasi |
| Bella (`bcell`) | 52 → **36** | 2,2 → **2,5** | Auto-antibodi — ⚠️ konflik proyektil (D3) |
| Nyx (`nkcell`) | 52 → **40** | 2,0 ✅ | Teleport + insta <30% — verifikasi |

### 2.2 XP & level (§5)

| Aspek | Lama | Bible |
|---|---|---|
| `xpNeed` | `⌈280·L^0.45⌉` (`upgrades.xpCurve`) | **80 + 35L** |
| Sumber XP | tier musuh (5–8/12–15/50) + orb + band ×1,6/×0,85 + kombo ×1,2 | **tipe kill: 3/5/20/60** (D6: cabut sisanya) |
| Hasil/run referensi | tidak diukur | **1.926 XP → level 8** |

### 2.3 Earn Biokredit (§6.2) + faucet Genom

| Sumber | Lama | Bible |
|---|---|---|
| Kill | `killBonusCurrency` 1 + drop koin per tier | **kontak 1,0 · Pulse 1,5 · engulf 8** |
| Boss | drop + **20 Genom** (`imuReward`) | **60 BK, 0 Genom** (D7) |
| Victory | **50 Genom** | **0 Genom** (D7) |
| Wave bonus | 12/wave | **10/wave** |
| Total/run | tidak diukur | **916 BK** |

### 2.4 Progresi meta (§8)

| Sistem | Lama | Bible |
|---|---|---|
| Mitosis (BP) | 40+10L · hadiah `lv*40+wave*15+kill` · 500 self-paying · tanpa cap | **120+30L · cap 150/run+450/hari · misi 50×3/250×2 · 800/500 net −300** |
| Pangkat | 18/2/120/250 (+chapter 100) | **4 / 0,20 / 4 (engulf!) / 25 / 50** |
| Hero lv20 | 150/1.35 +6% dmg +8% HP | **120/1,20 + scaling MEMBRAN (contactDps/HP/speed? — desain Sprint 3)** |
| Diferensiasi | sistem equity (reseptor/modul…) | **0,004/0,04/1 · tahap 50/50/50/17** (ganti total) |
| Kampanye | kuota 25–50, tanpa tingkat | **kuota ×2,2 + Normal/Sulit/Kritis + migrasi** |
| Mastery | 2/10/80, level entah | **total 6.100 XP (D12: turunkan split)** |
| Unlock hero | 4 gratis + 7 bayar = 2.460 | **cocok nominalnya; hitungan "sisa 9" (D2)** |

### 2.5 Item (§7)

| Bible ID | Lama | Efek cocok? | Biaya |
|---|---|---|---|
| `serum_regenerasi` | `serum_awal` | 🟡 (+35% HP? denyut 5s?) | → 200 BK |
| `enzim_litik` | `kopi_limfa`?/`vaksin_awal`? | 🟡 (DPS×2 + threshold 30% 8s?) | → 250 BK |
| `sitokin_burst` | `sitokin_burst` ✅ | ✅ (+40% 10s + reset Pulse) | → 200 BK |
| `lapisan_mukus` | `pelindung_lendir` | 🟡 (shield 25% + slow 30%?) | → 300 BK |
| `katalis_mitosis` | `koin_ganda` | 🟡 (BK×1,5 + engulf 2BP?) | → 350 BK |
| `opsonin` | ✅ | ✅ | 350 BK + drop boss |
| `atp_surge` | ✅ | ✅ | → **200 GENOM** + BP track |
| `membran_cadangan` | ✅ | ✅ | → BP track premium |
| `toksin_balik` | ✅ | ✅ | 200 BK |
| `sinapsis` | ✅ | tergantung D4 | misi mingguan |

### 2.6 Monetisasi (§6.4–6.5, §9)

| Aspek | Lama | Bible |
|---|---|---|
| Katalog | bundle_welcome/pass_m1/imun_pro/noads | **Kapsul Perdana · 4 tangga · Kit Riset · Genom Harian** (whale nonaktif) |
| Iklan | 80 BK ×6/hari | **10 Genom ×6/hari** |
| Sink | tidak ada | **Lanjut 50 · Peti Mutasi 150** (pity terpisah) |
| Kurs | 1:40 (display) | **Rp30/G · 1:40** (kanonik) |

---

## 3. MIGRASI KOSAKATA (identity doc)

| Tulis ini | Bukan ini | Status sapuan |
|---|---|---|
| Membran | shield/barrier/aura | 🟡 sebagian |
| Pulse | skill/ultimate/attack | 🟡 (tombol ✅, teks lain ❌) |
| Menelan/Engulf | kill/bunuh ("Kalahkan 10 patogen") | ❌ misi/stats masih "kill" |
| Bermutasi | upgrade/level up (in-run) | ❌ |
| Strain | tipe/varian | 🟡 (strain ✅ di trait; tempat lain ❌) |
| Biokredit / Genom | koin/antibodi/imun | ✅ display |
| Siklus Mitosis | Battle Pass (4 html · 9 js · 1 lang) | ❌ |
| Diferensiasi | Evolusi | ❌ |
| Homeostasis | upgrade global | ❌ |
| Imunitas | kondisi/body system | ❌ |
| Lab Genom | Toko/Shop | ❌ |
| Arena | map/dunia | 🟡 |
| Fagosit (komunitas) | players/gamers | ❌ (bantu teks sosial) |
| Antibodi Selamat Datang | hadiah kembali | ❌ (Sprint 6) |

Sapuan dilakukan di Sprint 5 + setiap sprint untuk string yang disentuhnya.
`meta.currency`/`meta.imun` TIDAK direname (bible §12.1).

---

## 4. KEPUTUSAN BUTUH OWNER (bible §15 + temuan audit)

| # | Pertanyaan | Rekomendasi agent | Momen |
|---|---|---|---|
| D1 | Angka hero §3 vs hasil eksperimen — mana menang? | **Bible menang**; tuning ulang hanya dari feedback device | Sprint 2.15 |
| D2 | Bible tulis ×12 hero & "sisa 9", repo punya 11 (7 bayar = 2.460 ✅) | Tetap 11; koreksi redaksi bible → "sisa 7" | Sprint 3 |
| D3 | Bella (antibodi) & Eos (granul homing) = proyektil? | **Ya, redesain**: efek instan-dalam-medan bervisual antibodi (tanpa entitas proyektil) | Sprint 2.15 |
| D4 | Squad: medan mini (A) vs tembak (B) | **A** (dock §11.1 tetap ada slot Squad; `membrane.json` sudah siapkan) | Checkpoint Sprint 2 |
| D5 | Skill aktif hero (taunt/devour…) + tombol 1/2/3 vs "satu tombol" | **Cabut tombol; jadikan pasif/trigger** (atau cabut total) | Sprint 2 |
| D6 | Kombo + orb XP + band XP vs §5 murni | **Cabut** (sederhanakan ke bible) | Sprint 1.9 |
| D7 | Faucet Genom run (boss 20 + victory 50 = 110/run!) | **Nolkan** (merusak §6.5: 8,3 hari → ~2 hari) | Sprint 3.17 |
| D8 | Referral: hadiah SEKARANG (kode) vs "nanti" (bible §13.36) | **Tetap sekarang** (akuisisi lebih kuat; catat deviasi) | Sprint 6 |
| D9 | Engulf menghapus drop? (bible §15) | **Ya, trade-off** (heal+BP vs loot — keputusan menarik) | Sprint 3 |
| D10 | `contactDpsBase` 8 vs per-hero 12–26 | Per-hero menang (diferensiasi); 8 = fallback | Sprint 1.2 |
| D11 | 6 jalur Homeostasis apa? + "31.998" satuannya? | Radius·DPS·Pulse·Engulf·Vitalitas·Speed; 31.998 = ekuivalen BK total | Sprint 3.19 |
| D12 | Split mastery 6.100 XP (perKill/perWave/victory/engulf?) | Turunkan di Sprint 3 dari run referensi terukur | Sprint 3.19 |
| D13 | Sinapsis ikut D4 | Otomatis ikut hasil D4 | Sprint 3.18 |
| D14 | Banjir XP pasca-Sprint 1 (buff compounding ×12, supply 227/wave, engulf 53%) vs bible §5 | **Jangkar ulang ke total/run bible**: buff terkuat-menang, supply → ±40/wave, XP engulf 20→4, Bio tiap-8-telan, heal 7%→2% | Sprint 2.16a |
| D15 | Boss chapter/sekarang mati 1 hit vs duel ±25 dtk | **Buff HP (×4–×14) + dmgMult**; roster wave 5/10/15 = toksin→kanker→kanker; kuota 120–300 + boss bab 1 | Sprint 2.16a |
| D14 | Audio/tutorial/server-save/whale (bible §15) | Ikuti bible (tunda semua) | — |

**SUDAH TERJAWAB:** `AGENT-GAMEPLAY-EXPERIMENT.md` (dirujuk §4.1) tidak ada
di branch — **resolved**: detail mutasi sudah hidup di `data/mutations.json`,
tidak perlu file itu.

---

## 5. KONTRAK REPO PHAGOS (wajib, diadaptasi dari brief building)

| Aturan | Konsekuensi bila dilanggar |
|---|---|
| Semua angka gameplay di `data/*.json`, bukan `js/` | Tidak bisa tune tanpa rilis kode |
| Gameplay → UI hanya via `ui-bridge` (`emit`/`on`) | Cross-import merusak isolasi |
| Tiap sprint: bump `BUILD` + `?v=` SERAGAM di `index.html` | Campuran aset lama-baru |
| String baru → `data/lang.json` + `TRANSLATE_FIELDS` | Teks tak ikut ganti bahasa |
| Destinasi baru → `data/features.json` (fail-closed) | Menu terkunci selamanya |
| Data baru → daftarkan di loader `data-store.js` | Konsumen dapat `undefined` |
| Field save baru → aman via `mergeMetaDefaults` | Save lama pecah |
| Sprite baru → manifest `sprite-loader` + preload | Jank runtime |
| `npm run validate` hijau sebelum sprint ditutup | Angka pacing/katalog meleset |
| `npm run check` hijau + harness `verify-phagos` hijau | Regresi tak ketahuan |
| Checkpoint device = STOP, tunggu owner | Stack asumsi tanpa verifikasi |
| Fitur baru lolos ≥1 checklist identity | Fitur asing masuk PHAGOS |

---

## 6. DEFINISI SELESAI (per sprint + produksi)

Sprint selesai bila: item §1 ✅ · `validate`+`check`+harness hijau ·
BUILD+`?v=` bump · save lama→baru tanpa kehilangan data · lang.json ikut ·
tidak ada angka baru di `js/` · laporan (perubahan per berkas, temuan tak
diubah, deviasi baru).

**Production-ready = seluruh benchmark §0 ✅.** Tidak ada "sebagian besar".
