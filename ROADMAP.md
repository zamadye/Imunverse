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

### P0 — Audit & pondasi V2 **[SELESAI — BUILD 52h]**
- inventarisasi dependensi sistem lama (upgrade/squad/shop/battlepass/unlock/economy lama)
- **hapus benar-benar** (bukan dibekukan): layar, sistem, data, aset, CSS, dan skrip uji lama
- rapikan `data/` sesuai arsitektur §2
- **Exit:** `npm run check` hijau, game masih bisa dimainkan end-to-end, tidak ada
  referensi ke layar yang sudah dihapus.

> Keputusan: pembekuan (UI disembunyikan) ditinggalkan — ia meninggalkan jalan kode
> mati yang bisa bocor. Yang dihapus sekarang **benar-benar hilang** dari repo.

| Yang dihapus | Rincian |
|---|---|
| 11 layar | `upgrade`, `shop`, `arena`, `campaign`, `prep` (pilih stage/mode), `battlepass`, `bag`, `bosschest`, `rank`, `capsule`, `comeback` — berikut `<section>`-nya di `index.html`, modul `js/ui/screens/*`, registrasi & wiring di `main.js`, dan tombol/menu HUD yang menujunya |
| 9 sistem | `upgrade-system` (jalur premium), `battlepass-system`, `rank-system`, `comeback-system`, `welcome-box-system` (kapsul), `referral-system`, `challenge-system`, `build-share-system`, `payment-system`, `imun-economy` |
| Mata uang premium | Genom/Imun Coin dicabut dari HUD, dashboard, roster, profil, revive, toko item, unlock hero, kosmetik (aura/mahkota), panduan currency, dan dev-mode |
| Model data lama | `battlepass.json`, `ranks.json`, `welcome-box.json`, `premium.json`, `cosmetics.json`, `modes.json` + getter & daftar `data-store.js`; jalur `imu`/`imu_stat` di `unlock-system`; `hero.unlock` di `heroes.json` dikonversi jadi syarat main murni dan `shopCost` dinolkan |
| Sisa engine | `getRunArena` tak lagi bergantung pada pilihan arena pemain; `openMutasiChest` (gacha) & bangkit berbayar dihapus; payload akhir run tanpa BP/pangkat |
| Skrip uji lama | `tools/validate-retention.mjs` + 16 skrip `scripts/e2e-*` untuk model lama (eco/premium, retention, ui-nav, onboarding, progression, balance, r1–r6) |
| Aset & CSS | 13 aset tak terpakai (ikon Genom/toko/pasukan/skin/peti) + 636 aturan CSS mati dihapus (main.css 534, dashboard-focus.css 102); satu `}` nyasar di `dashboard-focus.css` diperbaiki |
| Dipertahankan sementara | `upgrade-system` + modal level-up (satu-satunya progresi run sampai P1–P2 menggantinya dengan mutasi), `retention-system` (notis hero), `mastery-system`, `skill-unlock`, `liveops` (mutator harian) |

| Kerangka data V2 (baru) | Isi |
|---|---|
| `data/attacks.json` | 8 archetype serangan + tahap telegraph + hierarki game feel |
| `data/zones.json` | 12 zona biologis berurutan + mekanik + landmark |
| `data/transitions.json` | transisi 20–60 dtk saat bertempur + event masuk jantung |
| `data/economy.json` | Antibody, kurva biaya mutasi, 3 fase ekonomi, Reserve, rewarded ad, IAP mock, telemetri, non-goals |

Penjaga regresi di `tools/verify-screens.mjs`: layar lama **tidak boleh** muncul lagi di
DOM, tidak boleh ada tombol yang menujunya, dashboard tetap 4 menu, dan MAIN harus
langsung masuk run (tanpa layar persiapan).

### P1 — Core combat **[SELESAI — BUILD 53a]**
- 11 hero punya **identity**: strength / weakness / combat identity / scaling identity
- 8 archetype serangan (projectile, homing, melee, area/burst, beam, chain, zone, summon)
- telegraph wajib: anticipation → telegraph → execution → impact → recovery
- damage model + threat model
- **Exit:** identitas hero terbaca dari cara membunuh, bukan dari angka.

Yang sudah dikerjakan:

| Langkah | Hasil |
|---|---|
| Identitas 11 hero | `heroes[].identity` berisi `attackArchetype`, `strength[]`, `weakness[]`, `combatIdentity`, `scalingIdentity` — diturunkan dari **angka nyata** `baseStats`/`patternParams` tiap hero (bukan karangan). Semua 8 archetype terpakai: area 3, zone 2, chain/projectile/beam/summon/homing/melee masing-masing 1 |
| Bahasa serangan + telegraph | `data/attacks.json` bertambah `telegraphPhases` (anticipation 0.12 · telegraph 0.25 · execution 0.08 · impact 0.06 · recovery 0.18) dan status `implemented/planned` per archetype |
| Archetype CHAIN jalan | Pattern baru `ranged_chain` (Dendritic): proyektil melompat ke musuh terdekat berikutnya dengan `chainHops`, `chainRadius`, dan peluruhan damage per lompatan (`attacks.json → chain.decay`). Implementasi di `Projectile` + `CollisionSystem.handleProjectileHits` (filter target pada `findNearestEnemy`) |
| Penguji baru | `tools/verify-combat.mjs` (`npm run verify:combat`, ikut di `npm run verify`) + harness jsdom bersama `tools/harness.mjs` |
| Dijaga | Tidak ada hero terbaik absolut (§14) — tak satu pun hero memuncaki HP **dan** damage **dan** speed; pola serangan hero lain tidak berubah |

Ancaman musuh (§15) — lanjutan:

| Langkah | Hasil |
|---|---|
| 9 identitas ancaman | `data/enemy-archetypes.json`: swarm, armored, fast, ranged, regenerative, splitter, stealth, elite, support — tiap satu punya **ancaman** dan **jawaban pemain** |
| 13 patogen ditandai | `enemies[].archetype` (+ sekunder & alasan) diturunkan dari data nyata: `armorLayers` → armored, `splitOnDeath` → splitter, `stealth` → stealth, speed 100 → fast, HP 62 → armored tebal, boss AOE → elite |
| REGENERATIVE diwujudkan | `protozoa.regen = { delaySec: 2.5, pctPerSec: 0.06 }`; `Enemy.update` memulihkan HP setelah jeda tanpa damage dan **damage memotong regenerasi** (jawaban pemain: tekan terus / akhiri burst) |
| RANGED terbukti bertelegraph | Mode peludah (`armShooter` + `tryEnemyShoot`) diuji: pose telegraph menyala **sebelum** ludahan, proyektil musuh (`run.ebullets`) meluncur ke pemain |
| Dijaga | `verify:combat` 25 pemeriksaan: identitas hero, telegraph, chain, archetype musuh, regen, telegraph peludah |

Lokomosi hero (prasyarat P2 — gerakan harus mulus sebelum mutasi menimpa bentuknya):

| Langkah | Hasil |
|---|---|
| Animasi jalan pakai **Rive** | `npm i @rive-app/canvas` (runtime resmi) + rig `.riv` yang **dibuat dari kode** oleh `tools/gen-hero-rig.mjs` (`npm run rive` → `assets/rive/hero-locomotion.riv`, 4,7 KB). Runtime di-vendor ke `js/vendor/rive/` (MIT) supaya offline/PWA, dimuat **malas** di luar jalur kritis. Rig = node transform kosong (root→body→head/armF/armB/legF/legB) — yang digambar tetap **FOTO karakter**, rig hanya **sumber gerakan** |
| Foot-planting (kaki tidak selip) | Fase langkah dikunci ke **jarak**, bukan waktu: `walkPhase += (jarak / stride) × π`. Laju putar animasi Rive `rate = kecepatan / nominalSpeed` (nominal = 2 × stride / 0,667 s ≈ 144 px/s). Lintasan kaki dibalik dari telapak yang diinginkan (stance = mundur lurus, swing = terangkat) **bukan** sinus — sinus membuat telapak menyapu tanah ~110% stride; sekarang selip terukur **0,2 px (0,4% stride)** |
| Putaran halus 360° | `facing` **dikejar** dengan batas `turn.rate` 13 rad/dtk lewat jalan terpendek (dulu diset seketika saat tombol ditekan) |
| Bobot & inersia | Head-bob 2× per siklus (turun saat menapak), twist badan ±2°, squash-stretch, **miring 5° ke arah belokan** (`turn.leanMax`), debu menyentuh tanah TE PAT pada frame telapak mendarat (dulu timer tetap 0,24 s) |
| Semua angka di data | `data/locomotion.json` baru (stride, turn, bob, tilt, step, rive) + `getLocomotion()` di data-store — nol angka gerak di `js/` |
| Gagal = aman | Runtime/wasm gagal dimuat → status `fallback`, hero memakai rumus cadangan yang sama mulusnya (terbukti di penguji jsdom) |
| Penguji baru | `tools/verify-rive.mjs` (`npm run verify:rive`, 18 pemeriksaan) ikut di `npm run verify`; `tools/verify-animasi.mjs` diperluas jadi 23 pemeriksaan (putaran halus, miring belok, langkah vs jarak, panjang langkah seragam, bob tidak melompat) |

Catatan format `.riv` (ditemukan dari percobaan, bukan asumsi — tertulis di
`tools/gen-hero-rig.mjs`): `parentId` = 0 untuk anak artboard, selainnya **jarak
mundur ke induk**; `KeyedObject.objectId` = indeks **lokal terhadap artboard**;
dan kurva satu animasi harus ditulis **menempel** setelah objek animasinya
(kalau tidak, runtime menempelkan kurva ke animasi yang salah).

Delapan archetype diwujudkan (§19) — satu modul, satu rantai waktu:

| Langkah | Hasil |
|---|---|
| Modul baru | `js/systems/attack-archetype.js`: 8 archetype **dijalankan** di PULSE lewat rantai wajib `anticipation → telegraph → execution → impact → recovery` (durasi tiap fase dari `attacks.json → telegraphPhases`). Diekspor: `archetypeCfg`, `archetypeForHero`, `beginAttack`, `updateAttack`, `updateSummons`, `attackActive`, `attackProgress`, `drawAttack` |
| Payload tiap archetype | `data/attacks.json` bertambah blok `payload` + `label` per archetype: projectile `{count 4, spread 16°, dmgMult 1,2}`, homing `{count 5, spread 40°, turnRate 5,5}`, melee `{radius 88, arc 110°, dmgMult 2,0}`, area `{radiusMult 1,15, dmgMult 1,6}`, beam `{length 360, width 26, dmgMult 2,0}`, chain `{hops 2, radius 120, decay 0,4}`, zone `{radius 130, life 3,2 s, slow 0,7}`, summon `{maks 3 entitas, life 12 s, interval 0,9 s}`. Semua status `planned` → `implemented` |
| Satu archetype, rasa beda | `heroes[].patternParams` kini boleh **menimpa payload** — Makrofag area `radiusMult 1,45 / dmgMult 1,25` (cincin lebar, sedang) vs Neutrofil `0,95 / 2,0` (cincin sempit, tajam). Kontraknya terdokumentasi di `heroes.json → docPayload` |
| Jalur hidup dipasang | `membrane-system.applyPulseSpecial` **kehilangan** tiga kasus damage instan (eosinofil, basofil, sel-B) — yang tersisa murni utilitas (dash, sweep, buff, imun, teleport). `beginAttack(game, {stats, dmgMult})` dipanggil setelahnya, jadi **setiap serangan berarti selalu bertelegraph**. `dealCloudDamage` kini menghormat `slow` + `color` dari data |
| Telegraf jujur | Target & sudut **dikunci saat `beginAttack`**: telegraph menggambar bentuk nyata di lantai (cincin / garis beam / zona / busur melee / anak panah) dan memutih saat execution→impact. Tidak ada lagi damage kejutan |
| Game loop | `game.run` bertambah `attack` + `summons`; loop memanggil `updateAttack` + `updateSummons` setelah `updateMembrane`, dan render memanggil `drawAttack` setelah lapisan membran. Summon digambar sebagai sprite billboard + `drawPulseGlow`, memudar menjelang akhir hidup |

Archetype ancaman ke-9 — **SUPPORT** (selesai):

| Langkah | Hasil |
|---|---|
| Aura buff | `Enemy` bertambah `auraCfg/auraT/auraWindup/auraBuffT/auraDmgMult/auraSpeedMult/auraDr/auraColor/auraPulseFx` + `emitSupportAura(game)`: menguatkan musuh lain dalam radius (damage ×1,25, speed ×1,15, DR 20%) |
| Selalu bertelegraph | Aura menyala **setelah** `telegraphSec` (0,6 s) dan hanya selama `durationSec`; **membekukan pendukung menggagalkan aura** (emisi aura ditempatkan setelah early-return beku) |
| Data | `sel_kanker.archetypeSecondary = 'support'` + blok `aura` (radius 190, dmgMult 1,3, DR 25%, warna `#d7263d`, label IMUNOSUPRESIF); affix elite baru `'aura'` di `waves.json → affixParams.aura`; `enemy-archetypes.json → support` jadi `implemented` dengan `counter`: *bekukan atau bunuh pendukungnya lebih dulu* |
| Lantai bercerita | Render menambah cincin putus-putus yang membesar saat telegraph, kilas saat aura menyala, dan cincin terang di musuh yang sedang di-buff |

**Exit P1 terpenuhi:** identitas hero terbaca dari **bentuk serangannya** (cincin lebar vs
sempit, garis lurus, lompatan berantai, medan lambat, anak buah), bukan dari angka; dan tiap
ancaman punya jawaban yang bisa dipelajari pemain.

Dijaga: `verify:combat` naik 25 → **57 pemeriksaan** (data payload, diferensiasi per hero,
eksekusi runtime tiap archetype memakai `game.startRun` sungguhan, dan aura support).

### P2 — Mutation sebagai jantung progresi **[SELESAI — BUILD 53c]**
- mutasi mengubah **perilaku tempur** (attack behavior/range/projectile/area/mobility/
  defense/control/survivability/target priority/interaksi lingkungan)
- pohon evolusi per hero: BASE → MUT1 → MUT2 → APEX
- **mutation cinematic** (§9): jeda → energi → bentuk lama pecah → bentuk baru → lanjut
- modal mutasi: bentuk SEBELUM→SESUDAH, biaya, **SKIP valid**
- **Exit:** mutasi terasa sebagai evolusi, bukan popup stat.

Yang sudah dikerjakan:

| Langkah | Hasil |
|---|---|
| Mutasi mengubah CARA BERTEMPUR | `data/mutations.json` — 15 dari 18 mutasi kini punya blok `attack`: `payload.{archetype}` menimpa angka serangan (radius/jumlah/peluruhan/durasi/entitas…), `archetypeFrom` **mengganti bentuk** serangan (Reaksi Berantai: proyektil→chain; Nova: tebasan→ledakan; Simbiosis: wilayah→panggilan; Metamorfosis: tembakan→berkas), dan `dmgMult` pengali global. Urutan: defaults `attacks.json` → `patternParams` hero → **mutasi** |
| Dibaca runtime | `attack-archetype.js` bertambah `mutationAttackMods(run)` (sumber tunggal: `run.activeMutations`) — dipakai `archetypeForHero(heroDef, run)`, `payloadUntuk()`, dan `beginAttack()`; jadi mutasi terasa **di arena**, bukan di layar stat |
| Kartu mutasi jujur | Modal level-up menampilkan **BENTUK SEKARANG → BENTUK BARU** (dua foto karakter, grayscaled untuk yang lama) + satu baris `⚔ ...` yang **diturunkan dari blok attack** lewat `describeAttackChange()` — bukan teks karangan UI |
| Dijaga | `verify:combat` 57 → **65 pemeriksaan**: mutasi menimpa angka (radius Makrofag 1,45→1,6 terbukti kena musuh di 200 px), mutasi mengubah bentuk (proyektil→chain; tebasan depan-saja → ledakan sekeliling), `dmgMult` global (auto-pulse lebih lemah per tembakan), mutasi tanpa blok attack **tidak mengubah apa pun**, semua blok valid, dan teks kartu turun dari data |

Lanjutan P2 — pohon evolusi & sinematik (SELESAI):

| Langkah | Hasil |
|---|---|
| Pohon BASE → MUT1 → MUT2 → APEX | `data/evolutions.json` ditulis ulang (schemaVersion 3): tahap dihitung dari **mutasi aktif se-run** (0/1/3/5) dan APEX butuh ≥5 mutasi **DAN ≥2 mutasi khas hero**. Mutasi khas = mutasi yang blok `attack`-nya menyentuh archetype hero (payload atau archetypeFrom) — jadi tiap hero punya jalur berbeda karena cara bertempurnya berbeda |
| Sistem lama dihapus | `evolution-system.js` ditulis ulang: fragmen/parts drop, `meta.evoParts`, dan `rollPartDrop` **dihapus**; peti boss kini memberi **Bio-Point** (bukan fragmen); `drawHeroEquity` (overlay anatomi) dicabut dari render — bentuk evolusi murni **FOTO karakter** |
| Runtime | `evoStageFor/evoSprite/evoProgress/evoStatMult/signatureMutations` — satu sumber: `run.evoStage`, disegarkan setiap mutasi dipilih. Pengali stat tahap ikut `recomputePlayerStats` |
| **Sinematik mutasi §9** | `js/systems/mutation-cinematic.js`: pause → charge → break → reveal → resume (durasi per fase dari `evolutions.json → cinematic`). Foto lama mengerut & dikelilingi energi → **pecah jadi 14 pecahan partikel** + kilas putih → foto baru muncul dengan cincin kejut + nama mutasi & tahap. Dunia **dibekukan** selama adegan (loop utama hanya memajukan adegan) |
| **SKIP valid** | Tombol LEWATI (DOM) + Spasi/Enter/Esc aktif setelah 0,2 s. Mutasi **sudah diterapkan sebelum** adegan mulai, jadi melewati tidak mengurangi apa pun — murni mempercepat |
| Terlihat di HUD & hasil run | Chip BIO menampilkan lencana tahap (warna ikut data); layar game over menampilkan "Evolusi run ini: MUT2 (3 mutasi)" dan target "APEX <hero>" di kotak *Kurang Sedikit Lagi* |
| Dijaga | `verify:combat` 65 → **74** pemeriksaan (pohon terurut, jalur khas per hero, tahap naik & APEX butuh mutasi khas, foto mengikuti tahap + berkas ada, sinematik urut fase & onDone sekali, LEWATI valid, dan **jalur nyata**: memilih mutasi lewat `game.chooseLevelUp` menjalankan adegan & menaikkan tahap) · `validate` mengganti pemeriksaan "diferensiasi" lama dengan `pohon-evolusi` + `jalur-khas-per-hero` + `sinematik-mutasi-terdata` |

**Exit P2 terpenuhi:** mutasi terasa sebagai **evolusi** — bentuk karakter berubah (foto
sendiri), cara bertempurnya berubah, ada adegan transformasi, dan kemajuannya terbaca
di HUD. Sisa yang menyentuh mutasi tinggal soal **mata uang** (P3: biaya mutasi
memakai Antibody, bukan Bio-Point).

### P3 — Economy Antibody (V2) **[SELESAI — BUILD 54a]**
- Antibody = satu-satunya resource evolusi (sumber: kill, elite, boss, event, ads)
- kurva biaya mutasi **tunable** (`economy.json`): base cost × growth function
- 3 fase ekonomi: **Abundance → Tension → Scarcity** (scarcity ≠ grinding)
- kekurangan Antibody **tidak boleh memblokir** permainan (lanjut bertempur)
- **Exit:** Test A (tanpa Reserve) masih menyenangkan; §32 kriteria 1–5 terpenuhi.

Yang sudah dikerjakan:

| Langkah | Hasil |
|---|---|
| Satu mata uang, satu fungsi | `data/economy.json` (schemaVersion 2): sumber = kill 2 · elite 25 · boss 120 · event 50 · telan 2 · bonus zona 40. **Bio-Point dihapus** — mutasi sekarang dibayar dengan ANTIBODI, dan antibodi dipakai **hanya** untuk mutasi (hero tetap dibuka lewat progres bermain, IAP §33) |
| Kurva biaya mutasi (§7) | `mutationCost(indeks)`: 100 → 150 → 218 → 309 → 432 → 598 → 822 → 1125, langkah geometris dibatasi `maxStep` 400 dan diapit `minCost/maxCost`. Harga mengikuti **indeks mutasi**, jadi semua kartu dalam satu tawaran sama mahalnya — pemain memilih BENTUK, bukan yang termurah |
| Profil penghasilan per hero (§11) | 11 hero punya `heroEarning` {normal, elite, boss, event} yang diturunkan dari identitas tempurnya: Mako unggul di gerombolan (boss rendah), Nyx unggul di elite (kill biasa terendah), Dendri unggul di event biologis (elite rendah), T-Bolt unggul di elite/boss (kill biasa rendah)… |
| Tidak ada hero farming meta (§12) | Penghasilan per run pada campuran kill referensi: **1.830 – 2.058** (rata-rata 1.947) → semua hero dalam **±6%**, jauh di dalam batas kompetitif ±10%. Setiap hero punya keunggulan **dan** trade-off |
| Tiga fase ekonomi (§8) | 1–2 mutasi = Abundance, 3–5 = Tension, 6–8 = Scarcity. **Test A** (nol Reserve/IAP/iklan): satu run ≈ **6 mutasi** dan berakhir di fase Scarcity; total 8 mutasi (3.754) ≈ **1,9 run** — jadi Scarcity terasa tanpa jadi grinding |
| Tidak pernah memblokir (§10) | `insufficientRule.blockGameplay = false`. Antibodi kurang → kartu mutasi terkunci dengan pesan "terus bertempur", selalu ada jaring pengaman, `mutation_failed_insufficient_antibody` tercatat, pemain tetap hidup & lanjut |
| Umpan balik berantai (§5) | Tiap kill: partikel antibodi → label melayang `+N ANTIBODI` → dompet HUD berdenyut saat cukup untuk mutasi berikutnya (bukan sekadar angka berubah) |
| HUD & tujuan (§24–§26) | Chip HUD: dompet + `/harga mutasi berikutnya` + lencana tahap evolusi. Modal mutasi: dompet, harga, dan fase ekonomi. Game over: "◉ X Antibodi dibawa pulang → mutasi berikutnya Y (kurang Z)" sebagai tujuan run berikutnya |
| Telemetri (§28) | `recordEconomyEvent` + 14 event wajib (antibody_earned, mutation_purchased, mutation_failed_insufficient_antibody, …) tersedia lewat `economyLog()` |
| Penguji baru | `tools/verify-economy.mjs` (`npm run verify:economy`, **16 pemeriksaan**, ikut di `npm run verify`): tunable, kurva, profil per hero, rentang kompetitif, tiga fase, anti-blokir, Test A, anti-grinding, dan **runtime nyata** — kill menambah antibodi + label + partikel, membeli mutasi memotong sesuai kurva |

Sisa ekonomi yang sengaja menyusul: **Reserve, rewarded ad 2×, dan IAP mock** (P5) —
semuanya sudah punya wadah tunablenya di `economy.json`, tinggal dihidupkan.

### P4 — Dunia kontinu (Lung → Bloodstream → Heart) **[SELESAI — BUILD 54b]**
- rute biologis berkesinambungan; **tanpa stage loading sebagai pengalaman**
- transition zone 20–60 dtk: lingkungan & musuh lama + baru bercampur
- mekanik lingkungan: Lung (oksigen/mukus), Capillary (sempit), Bloodstream (arus),
  Heart (denyut), Tissue (halangan), Lymphatic (sinyal imun), Tumor (regen/korupsi)
- HUD progres zona minimal + **landmark system**
- **Exit:** pemain berkata “saya sudah keluar dari paru”, bukan “wave 7”.

Yang sudah dikerjakan:

| Langkah | Hasil |
|---|---|
| Rute 12 zona berkesinambungan | `data/zones.json` (schemaVersion 2): lung → bronchiole → alveoli → capillary → bloodstream → heart → artery → tissue → lymphatic → lymphNode → infectedTissue → tumor. Tiap zona punya `arenaId`, `mechanic`, `params`, `landmark`, `wavesPerZone`, `transitionSec`. **Tidak ada lagi stage select** |
| Modul baru | `js/systems/world-journey.js`: state `run.journey` (zona, fase, blend, landmark, arus, timer mekanik) + `updateJourney()` dipanggil tiap frame **setelah** spawn-system |
| Transisi terjadi SAAT COMBAT (§23–§24) | Setelah wave zona habis → fase `transition` 20–60 dtk (per zona). Selama itu: musuh zona lama **dan** baru bercampur (`enemyPoolFor` memberi bobot mengikuti blend — dipakai `SpawnSystem.pickEnemyId`), warna & fitur tanah ikut bercampur (`blendedPalette`: fitur lama memudar 1−t, fitur baru menguat t). Tidak ada loading, pemain & musuh tetap hidup |
| Lingkungan MENGUBAH GAMEPLAY (§25) | Paru = kantung oksigen menyembuhkan + lendir memperlambat · Bronkiolus/Kapiler = **batas arena menyempit** · Alveoli = gas exchange memulihkan · Aliran darah = **arus mendorong** pemain & musuh (arah berganti berkala) · Jantung = **denyut** mendorong musuh + getar kamera + gelang tekanan |
| Event masuk JANTUNG (§28) | Dua denyut BESAR saat transisi (getar 1.1 + dorong musuh + gelang merah) — tanpa satu pun teks "level/stage bernomor" |
| Landmark (§47) | Saat zona baru di-commit: landmark world-anchored digambar prosedural (gugus alveoli / katup jantung / aliran sel darah) + label nama landmark, memudar setelah 6 dtk |
| Wave = pacing (§27) | Wave hanya menandai intensitas spawn; progresi dunia = urutan zona. HUD menampilkan "zona sekarang ──●── zona berikutnya" yang sangat kecil (§26) |
| Palet baru tanpa aset baru | Dua palet prosedural (kapiler & aliran darah) ditulis dari data — warna & fitur tanah saja, **foto tetap dibekukan** |
| Penguji baru | `tools/verify-world.mjs` (`npm run verify:world`, **13 pemeriksaan**, ikut di `npm run verify`): rute & landmark, rentang transisi, pergantian zona **tanpa loading** (pemain & musuh tetap hidup), campuran musuh lama+baru, landmark tercatat, keempat mekanik lingkungan diukur nyata (perpindahan arus, radius menyempit, geser musuh + shake, HP pulih), wave sebagai pacing, event jantung, campuran warna/fitur, HUD |
| Dijaga | `validate` bertambah `rute-kontinu`, `transisi-zona`, `mekanik-lingkungan` |

Sisa P4 ke depan: mekanik zona P5 (arteri, jaringan, limfe, tumor) masih berstatus
data saja — parameternya sudah ada, eksekusinya menyusul setelah P5/P6.

### P5 — Reserve, Rewarded Ad, IAP mock **[SELESAI — BUILD 54c]**
- Reserve terpisah dari Antibody; bantuan maksimal = X% biaya mutasi (tunable)
- hierarki: **CONTINUE / WATCH AD / USE RESERVE**
- IAP entry point **kontekstual** (saat friksi ekonomi), tidak di dashboard
- `MockPurchaseProvider` — **tidak ada payment nyata** sebelum P9
- **Exit:** Test B/C/D lolos; transformasi tetap *hero moment*, bukan *sales moment*.

Yang sudah dikerjakan:

| Langkah | Hasil |
|---|---|
| Reserve = sistem terpisah (§14) | `js/systems/reserve-system.js` (baru). Saldo di `meta.reserve` (permanen), antibodi di `run.antibody` (hasil bermain) — dua angka yang TIDAK pernah tercampur. Kapasitas dibatasi data |
| Bantuan MAKSIMAL X% harga (§15) | `maxAssistFor(cost)` = `floor(cost × assistancePctOfMutationCost)` (kini 50%) **dan** `maxUsesPerRun` 2×. Jadi cadangan 20.000 pun tidak bisa membeli mutasi sendirian: pemain tetap harus bertempur/menonton iklan, cadangan hanya menutup sisanya |
| Cadangan tidak pernah otomatis | Tidak ada satu pun pemanggilan `useReserve()` di jalur gameplay — selalu lewat tombol pilihan pemain |
| Iklan reward antibodi (§19) | `adStatus(meta)` + `triggerRewardedAdAntibody()` di `monetization.js`: +100 antibodi, jeda 60 dtk, kuota 10/hari — SEMUA dari `data/economy.json`. Kuota & jeda tersimpan di meta (`adDaily`, `adLastAt`) |
| Hierarki CONTINUE / IKLAN / CADANGAN (§18, §20) | Panel friksi di modal mutasi, hanya muncul saat kartu benar-benar terkunci: `LANJUT BERMAIN` (gratis, antibodi utuh, mutasi ditawarkan lagi) → `TONTON IKLAN +100 ◉` → `PAKAI CADANGAN (+N ◉, maks 50%)` → baris IAP paling kecil |
| IAP mock tanpa payment nyata (§21) | `js/systems/purchase-provider.js`: `MockPurchaseProvider` (latensi simulasi, nol jaringan, `realPayment:false`). Isi cadangan = DEV GRANT 500/1500/4000, tidak ada uang, tidak ada entitlement |
| Titik integrasi P9 (§34) | `setPurchaseProvider()` menukar provider billing sungguhan TANPA menyentuh ekonomi/mutasi/UI — diuji dengan provider palsu di penguji |
| Kontekstual, bukan dashboard (§17, §27) | Tawaran IAP hanya muncul saat friksi + cadangan tidak cukup, dibatasi `maxOffersPerRun` 2×/run. Dashboard terbukti bersih dari elemen jualan (dicek penguji) |
| Telemetri (§28) | `reserve_used` · `rewarded_ad_offered` · `rewarded_ad_completed` · `iap_mock_granted` tercatat di log ekonomi yang sama |
| HUD tetap bersih (§26) | Cadangan TIDAK dipajang di HUD — hanya satu baris kecil di ringkasan akhir run |
| Perbaikan nyata di jalan | `mutationCard(def, bio, …)` memanggil variabel `bio` yang sudah dihapus di P3 → modal mutasi melempar `ReferenceError` dan hanya merender 1 kartu. Diperbaiki; penguji kini mengunci bahwa semua kartu ter-render |
| Penguji baru | `tools/verify-p5.mjs` (`npm run verify:p5`, **28 pemeriksaan**, ikut di `npm run verify`): TEST A (nol cadangan) · TEST B (cadangan kecil berguna) · TEST C (cadangan besar TIDAK menggantikan gameplay) · TEST D (iklan +antibodi & segarkan kartu) · batas X% & N×/run · kapasitas · jeda & kuota harian · IAP mock tanpa payment · tukar provider P9 · telemetri · CONTINUE tidak memblokir (§10) · hierarki UI benar-benar tampil & terurut · dashboard bersih · kartu mutasi ter-render penuh |
| Dijaga | `validate` bertambah `reserve-terbatas`, `iklan-reward-tertunable`, `iap-mock-tanpa-payment` |

Mode dev (`?dev=1`) memberi cadangan 5.000 **di memori saja** supaya TEST C bisa
dicoba manual tanpa menyentuh save pemain.

### P6 — Game feel **[SELESAI — BUILD 54d]**
- animation + VFX + SFX + enemy reaction + camera response (hierarki normal→boss)
- keterbacaan serangan tanpa angka (§18)
- **Exit:** layar tidak kacau saat ramai; hit reaction terbaca.

Yang sudah dikerjakan:

| Langkah | Hasil |
|---|---|
| Satu sutradara dampak (§20) | `js/systems/game-feel.js` (baru). Semua dampak lewat SATU tangga: `normal → heavy → elite → ultimate → bossEvent`. Lima kanal §20 — ANIMATION (squash) + VFX + SFX + ENEMY REACTION + CAMERA — menyala bersamaan dari satu tempat, bukan tersebar di banyak titik |
| Tangga dampak tunable | `data/gamefeel.json` (schemaVersion 2) → `tiers`: getar 0.035 → 0.09 → 0.18 → 0.35 → 0.65; hit-stop kill 0.03 → 0.09; durasi flash 0.12 → 0.26 dtk; squash 0.12 → 0.32 |
| Reaksi musuh nyata (§20) | flash kini BERBEDA per tingkat (dulu 0.12 rata untuk semua hit); **squash** (pop seketika, lebar/tinggi sprite diskalakan tanpa menyentuh aset foto — `drawSprite` menerima `scaleX/scaleY`); **stagger** (musuh terhuyung) untuk crit ke atas; boss **imun** stagger & knockback — reaksinya lewat flash lebih lama + getar besar |
| Kamera di-cap (§20) | `camera.traumaCap` dari data (0.85) + `setTraumaCap()`: rentetan 50 dampak besar tidak pernah melewati batas; getar kecil ber-throttle (keroyokan tidak menggetarkan layar terus), getar besar selalu lewat |
| Keramaian terkendali | Satu budget untuk semua teks melayang: angka damage (maks 18, isi ulang 22/dtk) + label "+N ANTIBODI"/XP (maks 10, 14/dtk). Partikel mengecil 50 % dan getar 60 % saat musuh ≥ 26. **40 kill sekaligus kini menampilkan ≤ 28 teks, bukan 40+** |
| Suara tidak membanjiri | SFX ber-throttle per jenis: hit 55 ms · kill/engulf 70 ms · crit 90 ms · playerHit 120 ms — 60 hit tidak lagi menjadi 60 bunyi |
| Death pop bertingkat | normal 1.30× · elite 1.45× · boss 1.70× — kematian terasa bertingkat, bukan seragam |
| Keterbacaan & telegraph (§18–§19) | Dijaga dari data: 8 arketipe serangan punya BENTUK berbeda (projectile/homing/melee/area/beam/chain/zone/summon) dan `telegraphSec` 0,18–0,60 dtk; serangan kontak musuh ber-windup sebelum mendarat |
| Penguji baru | `tools/verify-gamefeel.mjs` (`npm run verify:gamefeel`, **24 pemeriksaan**, ikut di `npm run verify`): tangga naik di getar/hit-stop/flash/squash; hit biasa = normal (tanpa stagger & tanpa jeda); crit = heavy (stagger); elite; boss terlama & tanpa stagger; satu hit menyalakan 5 kanal (termasuk jalur nyata `spawnHitFeedback`); cap & throttle kamera; budget angka/label; skala keramaian; throttle SFX; 40 kill sekaligus tetap terkendali; bentuk & telegraph arketipe; squash sampai ke renderer; death pop bertingkat |
| Dijaga | `validate` bertambah `tangga-dampak-naik`, `keramaian-terkendali`, `kamera-di-cap` |

Catatan: sebelumnya seluruh rantai game feel (dari V2 Phase 1) **tidak punya penguji** —
P6 menutupnya, jadi perubahan dampak ke depan tidak bisa lagi menyalahi hierarki §20
tanpa ketahuan.

### P7 — UI/UX V2 **[BERJALAN — BUILD 54e]**
- dashboard minimal: PHAGOS · HERO · CURRENT FORM · **PLAY** · Continue Journey
  (sekunder: Heroes, Progress, Settings)
- hero selection: FORM / STRENGTH / WEAKNESS / START JOURNEY
- HUD: atas = progres zona, tengah = gameplay, bawah = HP · Antibody · progres mutasi
- **Exit:** checklist UI/UX §50 terpenuhi (tanpa upgrade/squad/battle/shop/BP).

Progres dari umpan balik pemain (main sendiri, 17 Sep 2026):

| Keluhan pemain | Penanganan | Status |
|---|---|---|
| Karakter tidak jalan ke semua arah & "mengambang" | **Rig MERAYAP dipanggang Godot** — lihat bagian "Rig merayap" di bawah. Bukan lagi foto dibalik-balik: badan berporos di garis bawah, memipih/memanjang, menjangkau, dan lobusnya bergelombang | ✔ |
| Nav footer salah posisi (di tengah) | `#screen-dashboard` kini `justify-content: flex-start` + dua `margin-top:auto` (peta & dock): kelompok PETA TUBUH + MAIN benar-benar di tengah, dock 4 menu **menempel di bawah** dengan latar bar & aman notch; `.dock-4` jadi 4 kolom penuh (dulu 5 → tombol mengecil & nggantung) | ✔ |
| Kartu nav terlalu banyak, tidak rapi, bertumpuk | Sistem kartu baru `.nav-cards` / `.nav-card`: grid `auto-fit minmax(140px,1fr)`, maks 4 per baris, tinggi seragam 62px, jarak 10px, judul + subjudul terpotong rapi — tidak ada lagi kartu saling menimpa | ✔ (dipakai bertahap per layar) |
| Modal mutasi kelebaran & teks berlebihan | Subjudul dipadatkan (Lv 3 · ◉ 12/150 · MENEGANG), **satu baris keterangan** (perubahan tempur; lore jadi tooltip), badge harga menampilkan **kekurangan** saat terkunci (◉ 150 · kurang 40), modal lebih sempit (430px), foto bentuk lebih kecil, lore tidak lagi memakan ruang | ✔ |
| Jenis serangan semua hero terasa sama | `data/attacks.json → heroSignatures`: 11 hero punya tanda tangan sendiri (warna, ukuran, jumlah, laju, label, SFX). Tiga hero se-archetype `area` kini benar-benar beda: Mako = satu gelombang besar lambat, Neutron = banyak jebakan kecil cepat, Mastia = ledakan beruntun. Diterapkan **runtime** lewat `applySignature()` di `attack-archetype.js` | ✔ |
| penjaga regresi baru | `tools/verify-attacks.mjs` (11 pemeriksaan): tanda tangan unik, warna unik, hero se-archetype tetap beda, runtime benar-benar memakainya, alur ANTICIPATION→TELEGRAPH→EXECUTION, mutasi mengubah angka serangan, telegraph ≥ 0,18 dtk | ✔ |

### Rig merayap (P7) — jawaban untuk "karakter masih mengambang"

**Akar masalah (ketemu dari kode, bukan dugaan):**
1. `billboard()` menskala sprite dari **titik tengah**, jadi setiap squash (sy<1)
   mengangkat tepi bawah badan dari alas → tampak melayang.
2. `anim.bob` menggeser **seluruh** badan naik-turun — sel darah tidak pernah
   melompat, jadi ini sumber utama kesan "mengambang".

**Kunci perbaikan:** sel yang merayap tidak pernah meninggalkan alas. Maka
kanal vertikal **dikunci 0** dan semua "hidup" dipindah ke deformasi yang
berporos di **garis bawah** sprite:
- squash-stretch dengan volume terjaga (`sx × sy ≈ 1` → tidak karet);
- **skew** = massa menjangkau ke arah jalan (pantulan cermin menanganan arah);
- gerak tegak: ke atas memanjang, ke bawah memipih (poros tetap di bawah);
- gelombang **lobus** berjalan mengelilingi badan (pseudopodia menjangkau
  bergiliran), plus `contact` (daya lekat) yang menggerakkan cincin telapak.

**Alur (semua angka di `data/`, kontrak §5):**
```
data/crawl.json  →  tools/godot/bake-crawl.mjs  →  data/crawl-cycles.json  →  js/systems/crawl-rig.js
 (11 hero)          (Godot 4.7.2 headless)          (11 × 24 frame)            (dipakai player.update)
```
- Rig Godot: `Rig/Body` (posisi, skala, rotasi, **skew**) + `Body/Lobe0..n`
  + `Rig/Anchor` (daya lekat), dianimasikan `AnimationPlayer`, lalu dicuplik 24
  frame dengan `seek(u, true)`. Dua jebakan build web yang sudah terpecahkan
  tercatat di kepala `tools/godot/rig/bake_crawl.gd`: node tidak bisa dibuat di
  `_initialize()` (harus di `_process`), dan `AnimationPlayer.add_animation()`
  tidak menyimpan apa pun — harus lewat `AnimationLibrary`.
- Tiap hero punya gaya sendiri: Mako merayap lebar & lambat, Neutron many small
  cepat, Nyx menerjang, Treg mengalir tenang, dan seterusnya.

**Bukti (`tools/verify-crawl.mjs`, 19 pemeriksaan):** tepi bawah sprite
bergerak **0,0000 px** (cara lama poros tengah: ±2 px → itulah "mengambang");
rentang squash ≥5 % per hero; putaran 360° tanpa loncatan; 8 arah semuanya
hidup; sambungan akhir↔awal siklus mulus; 11/11 hero memakai rig ini saat
runtime.

**Penjaga lama yang ikut dibenahi** (`tools/verify-mutation-photos.mjs`,
sebelumnya 176 error, sekarang 0): tes menunggu sprite dengan `sleep(1,5 dtk)`
tetap (sekarang menunggu sampai foto benar-benar terdekode), lupa menghitung
ulang `run.evoStage` setelah menyetel mutasi (jadi foto dasar yang tergambar),
dan kasus "menghadap kiri" tidak pernah benar-benar membalik sprite karena
`facing` kembali ke 0 tanpa input. Invariant vertikalnya pun dipindah dari
pusat-y (kini wajar bergerak karena deformasi berporos bawah) ke **garis
bawah** — sesuai dengan yang dijepit `build-mutation-sprites.py`.

Catatan penting untuk sesi berikutnya: **Godot sudah bisa dipakai** —
`node tools/godot/install.mjs` lalu
`node tools/godot/run.mjs <proyek> --headless --path <proyek> --script res://x.gd`.
Build ini `template_release` (tanpa editor, tanpa WebGL di sandbox), jadi Godot
dipakai untuk **menulis & memanggang** animasi (Skeleton2D + AnimationPlayer →
JSON), sedangkan yang menggambar tetap kanvas 2D game.

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
