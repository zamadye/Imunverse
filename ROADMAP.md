# 🧭 ROADMAP PENGEMBANGAN — PHAGOS V2

**Continuous Biological Survival • Evolution • Adaptation**

Dokumen ini menggantikan seluruh roadmap lama. Ia adalah **satu-satunya peta jalan**
untuk membongkar struktur lama dan membangun PHAGOS V2.

**Sumber acuan (wajib dibaca sebelum mengubah apa pun):**

| Berkas | Isi |
|---|---|
| `PHAGOS_V2_REBUILD.txt` | Blueprint gameplay V2 (53 bagian): visi, sistem yang dibuang, core loop, mutasi, dunia kontinu, boss, UI, data, aset, 8 fase prioritas, Definition of Done |
| `PHAGOS_IAP_V2.txt` | Blueprint economy & IAP V2 (39 bagian): Antibody, biaya mutasi, 3 fase ekonomi, Reserve, rewarded ad, telemetri, P0–P9, non-goals |

> Angka ekonomi di kedua dokumen **bukan angka final** — semuanya *tunable parameter*
> yang harus divalidasi lewat playtest.

---

## 0. North Star

Tiga hal harus **terlihat terus-menerus dalam satu run yang tidak terputus**:

```
          SAYA MAKIN KUAT            (MUTATION)
                  ↑
                  │
MASUK MAKIN DALAM ─── PLAYER ─── ANCAMAN MAKIN BERAT
   (BIOLOGICAL JOURNEY)              (THREAT EVOLUTION)
                  │
                  ↓
               EVOLVE
```

Tiga poros berkembang **bersamaan** — tidak ada satu sistem yang boleh jalan sendiri:

```
PLAYER   Hero → Mutation → Evolution
WORLD    Lung → Bloodstream → Heart → Tissue → Tumor
THREAT   Basic → Specialized → Combined → Elite → Boss
```

**V2 bukan tentang menambah konten.** V2 tentang membuat tiga poros itu
terus terlihat oleh pemain di dalam satu perjalanan tanpa putus.

---

## 1. Keputusan besar: yang DIBUANG vs yang DIPERTAHANKAN

### ❌ DIBUANG dari core V2

| Dibuang | Alasan (dokumen) | Penampakan di repo sekarang |
|---|---|---|
| Upgrade page / upgrade tree | §3, §40 — power tidak boleh dari angka | `js/ui/screens/upgrade-screen.js`, `data/upgrades.json`, `js/systems/upgrade-system.js` |
| Squad / pasukan | §3 | `js/entities/ally.js`, `data/upgrades.json` (squad), UI dock “Lab Genom” |
| Battle system terpisah | §3 | `js/ui/screens/arena-screen.js`, `data/modes.json` |
| Shop gameplay (item/booster/equipment) | §3, IAP §4 | `js/ui/screens/shop-screen.js`, `data/premium.json` |
| Skin shop sebagai sistem utama | §3 | `data/cosmetics.json` (diturunkan jadi opsional) |
| Battle pass | §3, IAP §4, §38 | `js/ui/screens/battlepass-screen.js`, `data/battlepass.json`, `js/systems/battlepass-system.js` |
| Mission-driven hero unlock | §3 | `js/systems/unlock-system.js`, `data/missions.json` (sebagai syarat hero) |
| Multi-currency (Imun Coin, Energy, Lives) | IAP §4 | `js/systems/imun-economy.js`, `js/systems/economy-system.js`, `js/systems/monetization.js` |
| Level-up → 3 upgrade acak sebagai progresi utama | §40 | `js/ui/screens/levelup-screen.js`, `js/systems/upgrade-system.js` |
| Model “stage select → load arena → selesai” | §21 | `js/ui/screens/campaign-screen.js`, `data/arenas.json` |

Catatan IAP §4: **jangan hapus destruktif sebelum dependensi diperiksa.**
Urutannya: identifikasi dependensi → putuskan aman/tidak → nonaktifkan UI →
pastikan gameplay V2 tidak terganggu.

### ✅ DIPERTAHANKAN

11 hero sel imun · 13 famili patogen · **Antibody** (jadi satu-satunya resource
evolusi) · run bertahan · boss · rewarded ads · save/akun · pause · pendekatan
**data-driven JSON** · engine inti (loop, kamera, collision, effects, spawn,
renderer) yang sudah terpisah rapi.

---

## 2. Arsitektur target

V2 digerakkan oleh delapan domain (bukan oleh menu):

```
HERO · MUTATION · COMBAT · ENEMY · WORLD · TRANSITION · BOSS · ECONOMY
```

**Data** (`data/`) — sumber kebenaran; kode tidak boleh menyimpan angka gameplay:

```
heroes.json        identity: strength / weakness / combat identity / scaling identity
mutations.json     evolution behavior (bukan "+20 damage")
enemies.json       behavior identity per famili
enemy-variants.json
zones.json         biome + mechanic + landmark
transitions.json   aturan campur zona lama↔baru
bosses.json
attacks.json       8 archetype serangan + telegraph
economy.json       antibody, mutation cost curve, reserve, ads (semua tunable)
```

**Sistem** (`js/systems/`) — satu tanggung jawab per berkas; yang lama
(upgrade/unlock/battlepass/mission-driven unlock) **dibongkar atau dipensiunkan**.

**Layar** (`js/ui/screens/`) — yang tersisa untuk V2:

```
dashboard → hero select → HUD → mutation modal → transformation cinematic → result
```

---

## 3. Audit repo sekarang (baseline sebelum dibongkar)

Kondisi build saat ini (V1.5 / UI-REBUILD P8) yang **dipertahankan sebagai baseline**:

| Area | Sekarang | Nasib di V2 |
|---|---|---|
| `js/core/game.js` | orkestrator run berbasis wave | **refactor**: wave → journey, spawn per zona |
| `js/systems/spawn-system.js` | spawn gelombang + scaling HP | **ubah**: spawn = milestone intensitas, bukan timer |
| `js/systems/mutation-system.js` | mutasi + `bioCost`, tier | **naik jadi inti progresi** + kurva biaya Antibody |
| `js/systems/economy-system.js` | Antibodi + toko + squad | **sederhanakan**: hanya Antibody (evolusi) |
| `js/entities/enemy.js` | chase/splitter/boss | **tambah** behavior identity (8 archetype) |
| `js/render/background.js` | background prosedural tubuh | **ganti**: zona biologis + transition assets |
| `js/ui/screens/dashboard-screen.js` | dashboard peta tubuh (sudah rapi) | **sederhanakan lagi** sesuai §34–35 |
| `assets/sprites/hero_*_mut{1,2}_*.png` | 44 foto mutasi (2 tingkat × 2 pose × 11 hero) | **dipakai** sebagai tahap evolusi; V2 butuh idle/move/attack/hit/death per bentuk |
| `tools/verify-*.mjs` | pemeriksa foto/layar/animasi | **dipertahankan** & diperluas |

Yang sudah dibersihkan pada commit V2-cleanup: dokumen lama
(`docs/PHAGOS-BIBLE.md`, `docs/PHAGOS-IDENTITY.md`, `assets/ART_BIBLE.md`),
arsip arah lama (`src/` tower-colony, `files.zip`), dan **119 aset yang tidak lagi
dirujuk**: penamaan lama (`hero_makrofag_*`, `portrait_*`, `icon_*`, `part_*`,
`meter_*`) serta paket seni arah tower/koloni (`assets/heroes/towers/*`,
`assets/buildings/*`, `assets/enemies/path/*`, 3 lembar referensi).
Semuanya masih bisa dipulihkan dari riwayat git bila ternyata diperlukan.

---

## 4. Peta fase

Menggabungkan prioritas blueprint gameplay (Fase 1–8) dengan prioritas economy
(P0–P9). **Jangan kerjakan semuanya sekaligus.**

### P0 — Audit & pondasi V2
- inventarisasi dependensi sistem lama (upgrade/squad/shop/battlepass/unlock/economy lama)
- bekukan fitur lama (UI disembunyikan, jalan kode tetap aman) sebelum dihapus
- rapikan `data/` sesuai arsitektur §2 (file baru boleh kosong tapi terdaftar)
- **Exit:** `npm run check` hijau, game masih bisa dimainkan end-to-end, tidak ada
  referensi ke layar yang sudah disembunyikan.

### P1 — Core combat
- 11 hero punya **identity**: strength / weakness / combat identity / scaling identity
- 8 archetype serangan (projectile, homing, melee, area/burst, beam, chain, zone, summon)
- telegraph wajib: anticipation → telegraph → execution → impact → recovery
- damage model + threat model
- **Exit:** identitas hero terbaca dari cara membunuh, bukan dari angka.

### P2 — Mutation sebagai jantung progresi
- mutasi mengubah **perilaku tempur** (attack behavior/range/projectile/area/mobility/
  defense/control/survivability/target priority/interaksi lingkungan)
- pohon evolusi per hero: BASE → MUT1 → MUT2 → APEX
- **mutation cinematic** (§9): jeda → energi → bentuk lama pecah → bentuk baru → lanjut
- modal mutasi: bentuk SEBELUM→SESUDAH, biaya, **SKIP valid**
- **Exit:** mutasi terasa sebagai evolusi, bukan popup stat.

### P3 — Economy Antibody (V2)
- Antibody = satu-satunya resource evolusi (sumber: kill, elite, boss, event, ads)
- kurva biaya mutasi **tunable** (`economy.json`): base cost × growth function
- 3 fase ekonomi: **Abundance → Tension → Scarcity** (scarcity ≠ grinding)
- kekurangan Antibody **tidak boleh memblokir** permainan (lanjut bertempur)
- **Exit:** Test A (tanpa Reserve) masih menyenangkan; §32 kriteria 1–5 terpenuhi.

### P4 — Dunia kontinu (Lung → Bloodstream → Heart)
- rute biologis berkesinambungan; **tanpa stage loading sebagai pengalaman**
- transition zone 20–60 dtk: lingkungan & musuh lama + baru bercampur
- mekanik lingkungan: Lung (oksigen/mukus), Capillary (sempit), Bloodstream (arus),
  Heart (denyut), Tissue (halangan), Lymphatic (sinyal imun), Tumor (regen/korupsi)
- HUD progres zona minimal + **landmark system**
- **Exit:** pemain berkata “saya sudah keluar dari paru”, bukan “wave 7”.

### P5 — Reserve, Rewarded Ad, IAP mock
- Reserve terpisah dari Antibody; bantuan maksimal = X% biaya mutasi (tunable)
- hierarki: **CONTINUE / WATCH AD / USE RESERVE**
- IAP entry point **kontekstual** (saat friksi ekonomi), tidak di dashboard
- `MockPurchaseProvider` — **tidak ada payment nyata** sebelum P9
- **Exit:** Test B/C/D lolos; transformasi tetap *hero moment*, bukan *sales moment*.

### P6 — Game feel
- animation + VFX + SFX + enemy reaction + camera response (hierarki normal→boss)
- keterbacaan serangan tanpa angka (§18)
- **Exit:** layar tidak kacau saat ramai; hit reaction terbaca.

### P7 — UI/UX V2
- dashboard minimal: PHAGOS · HERO · CURRENT FORM · **PLAY** · Continue Journey
  (sekunder: Heroes, Progress, Settings)
- hero selection: FORM / STRENGTH / WEAKNESS / START JOURNEY
- HUD: atas = progres zona, tengah = gameplay, bawah = HP · Antibody · progres mutasi
- **Exit:** checklist UI/UX §50 terpenuhi (tanpa upgrade/squad/battle/shop/BP).

### P8 — Balance & telemetri
- 11 hero × 13 famili patogen; pastikan tidak ada *farming meta hero* (Test E)
- telemetri wajib (IAP §28): `run_started`, `enemy_killed`, `antibody_earned`,
  `mutation_offered/purchased/failed_insufficient`, `reserve_used`,
  `rewarded_ad_offered/completed`, `iap_mock_granted`, `run_completed/failed`,
  `hero_selected/unlocked`
- **Exit:** semua parameter ekonomi bisa diubah dari satu tempat tanpa sentuh kode gameplay.

### P9 — Payment nyata (terakhir)
- ganti `MockPurchaseProvider` → Google Play Billing
- **Exit:** core economy sudah dimainkan & diuji; payment tidak mengubah sistem mutasi.

---

## 5. Kontrak kerja repo (tetap berlaku)

1. **Angka tinggal di `data/*.json`**, bukan di `js/`. File data baru wajib
   didaftarkan di `js/core/data-store.js`.
2. Naikkan `BUILD` di `js/core/version.js` + samakan `?v=` di `index.html` setiap
   perubahan; naikkan `CACHE_VER` di `sw.js` bila aset berubah.
3. String baru → `data/lang.json` (ID + EN).
4. `npm run check` harus tetap hijau (JSON valid, path sprite, aturan layar CSS).
5. Setiap perubahan visual/aset punya **pemeriksa otomatis** bila memungkinkan.

## 6. Verifikasi

```bash
npm run check                                  # struktur, JSON, sprite, CSS layar
npm run validate                               # pacing & katalog
npx esbuild --bundle js/main.js --outfile=.tmp-bundle.js --format=iife
PHAGOS_BUNDLE=.tmp-bundle.js npm run verify    # foto mutasi + layar + animasi
```

Rincian pemeriksa:

| Perintah | Yang dijaga |
|---|---|
| `npm run verify:photos` | 44 foto mutasi: PNG valid 256×256, 0 sisa magenta, frame terkunci ke sprite dasar (Δ ≤ 0,012), game memilih foto tepat |
| `npm run verify:screens` | menu tidak menutupi gameplay; MAIN → HUD saja; peta tubuh 1:1; modal misi |
| `npm run verify:animasi` | gerakan hero semua arah halus: balik arah lewat transisi, bob ≤ 1 px/frame |

## 7. Definition of Done V2

Ringkas dari blueprint §50 dan economy §32 — V2 **baru selesai** bila:

- [ ] PLAY langsung dari dashboard; tidak ada upgrade/squad/battle/shop/BP page
- [ ] Tiap hero punya identity + weakness; tidak ada hero terbaik absolut
- [ ] Mutasi mengubah **gameplay dan visual**, lengkap dengan cinematic transformasi
- [ ] Antibody = resource evolusi; biaya & pertumbuhan jelas dan tunable
- [ ] IAP/ads terasa sebagai akselerasi, bukan syarat menang
- [ ] Musuh punya behavior identity; kesulitan bukan sekadar HP×10
- [ ] Perjalanan terasa kontinu: zona terhubung, transisi saat bertempur, landmark jelas
- [ ] Serangan & telegraph terbaca; VFX/SFX/animasi sinkron
- [ ] Ekonomi bisa dipahami tanpa tutorial panjang; kekurangan Antibody tidak memblokir

## 8. Non-goals (jangan dibangun)

Battle pass · shop besar · skin marketplace · subscription · gacha · equipment
system · multi premium currency · misi kompleks · guild · PvP · NFT.

## 9. Riwayat singkat

- **V1 → V1.5 (UI-REBUILD P8)**: dashboard peta tubuh, audio MP3 CC0, foto mutasi
  44/44, perbaikan animasi & bug fatal layar bertumpuk. Build ini **dipertahankan
  sebagai baseline** sampai P1–P2 selesai; sistem lamanya yang dibongkar bertahap.
- **V2 (dokumen ini)**: fokus pada HERO · MUTATION · COMBAT · ENEMY · WORLD ·
  TRANSITION · BOSS · ECONOMY.
