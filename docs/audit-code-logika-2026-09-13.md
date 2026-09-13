# Audit Code & Logika — Imunverse (branch `arena/01a09795-imunverse`, dari commit `97dfddf`)

**Tanggal:** 2026-09-13 · **Audiitor:** Arena Agent
**Cakupan:** seluruh runtime `js/` (±21.500 baris non-vendor), `data/*.json` (34 file), `index.html`. Fokus: bug logika, kebocoran ekonomi, crash path, kontrak integrasi. Semua temuan di bawah **diverifikasi langsung di source** (bukan asumsi dari nama file/dokumen).

> **STATUS PERBAIKAN (2026-09-13):** K1, T1, T2, S1, S2, L1, L2, L3, L4, L5, L8, L9, L10 — **DIPERBAIKI** (BUILD 51a → 52a). Ronde-2 (audit lanjutan sistem kill-path + layar uang): F1, F2, F5 **DIPERBAIKI** (BUILD 53a); F7/F8/F9 **catatan** (butuh keputusan produk, tidak diubah). L6/L7/L11/L12/L13 tetap catatan (disengaja/laten). Bukti: `npm run check` hijau, `node --check` semua file tersentuh, unit test walk-anim 23/23, e2e-retention `imu-not-from-plain-kills` konsisten dengan fix T2. Catatan: `mastery-system.js` — reward Mastery = **Antibodi** (RONDE-4), toast & header yang salah menulis "Imun" ikut diperbaiki.

## Ronde-2 (2026-09-13, lanjut audit: sistem kill-path + layar uang + account)

Cakupan tambahan: `skill-unlock, evolution, passive, phagocytosis, tag-cascade, inflammation, chemotaxis, antigen-memory, ability, mission, codex, unlock, unlock-badge, module-flags, haptics, metrics, tutorial, audio` + layar `gameover, dashboard, shop (pembayaran), bosschest, levelup, campaign, auth, hud`.

| # | Sev | Lokasi | Temuan | Status |
|---|---|---|---|---|
| F2 | 🟡 SEDANG | `game.js` `requestRevive`/`canDoubleCurrency`/`applyDoubleCurrency` | Slot iklan **revive** & **double-currency** bypass kuota harian — kontrak `monetization.js` = "semua placement dihitung bersama", tapi hanya boss-chest/penyembuhan-dashboard/tile toko yang cek `canWatchAd`+`trackAdWatch`. Player bisa farm revive/2× tanpa batas harian; juga `noAds` (IAP Bebas Iklan) tetap ditawari iklan. **FIX:** `canWatchAd` di cek di `requestRevive` (toast + fallback Lewati) & `canDoubleCurrency`; `trackAdWatch` di `confirmRevive` & `applyDoubleCurrency`. | ✅ DIPERBAIKI |
| F5 | 🟡 SEDANG | `dashboard-screen.js` kartu tubuh | Tombol **PEMULIHAN IKLAN** tanpa busy guard — simulasi 900 ms; double-tap = `recoverViaAd()` 2× (fungsi tak punya cap harian sendiri). **FIX:** `btn.disabled = true` saat klik. | ✅ DIPERBAIKI |
| F1 | ⚪ RENDAH | `monetization.js` `triggerRewardedAdOfferwall` | Dokumen hook usang ("memberi Imun Coin" — RONDE-4: offerwall = Antibodi) + hook tak punya caller (tile toko pakai `openAdModal`). **FIX:** dokumen dikoreksi; seam dipertahankan (konvensi file: titik integrasi SDK). | ✅ DIPERBAIKI |
| F7 | ⚪ RENDAH | `shop-screen.js` tile Suplemen Premium | **IAP diblokir kuota iklan** & tercatat sebagai tontonan iklan (`canWatchAd`/`trackAdWatch`): pemilik "Bebas Iklan" justru **tidak bisa membeli** suplemen ("KUOTA HARIAN PENUH"). Beli ≠ tonton — perlu keputusan produk. | ⏸ CATATAN |
| F8 | ⚪ RENDAH | `mission-system.js` `periodKey` vs `economy-system.js`/`body-system.js` | Kunci periode quest harian/mingguan pakai **tanggal UTC**, daily-reward & decay tubuh pakai **tanggal lokal** → di WITA (UTC+8) batas reset berbeda 8 jam antar sistem. Tidak ada risiko double-claim (masing-masing ter-guard), hanya ketidakseragaman UX. | ⏸ CATATAN |
| F9 | ⚪ RENDAH | `shop-screen.js` vs `account-system.js` | Gating akun tidak konsisten: item toko, unlock hero & IAP pembayaran wajib akun (`requireAccount`/`payOrder`), tapi **kosmetik (Imun Coin!) & suplemen tubuh tidak**. Header `account-system` menyatakan "tanpa akun, transaksi ditolak". Perlu keputusan produk. | ⏸ CATATAN |

**Yang diverifikasi BERSIH di ronde-2:** bosschest (kuota ✓, `onFail` ✓, anti double-claim `run.bossChest=null` ✓), modal pembayaran (confirm disabled selama proses, `payOrder` wajib akun, `grantContents` idempoten), semua handler purchase cek `res.ok`, levelup (guard `levelUpOpen` + pilihan tersinkron), campaign (bab locked tak bisa diklik; `markSeen(chId)` valid — codex memuat id `bab_*`), tutorial (timeout di-clear saat finish/render ulang), audio (oscillator berumur pendek + `stop()`), kill-path 5 modul R3–R7 (flag-off = perilaku pra-modul utuh; guard & throttle sesuai doc combat), mission/quest (anti double-claim, baseline per periode), unlock-system (jalur stat auto, jalur Imun beli-only), haptics/module-flags (fail-safe senyap).

Metode: (1) scan statik otomatis (`scripts/audit-scan.mjs`) — event bus, i18n, fitur gate, cross-ref data, path aset; (2) pembacaan penuh modul inti (core, entities, systems ekonomi/combat, input, main.js); (3) verifikasi bentuk data (semua field `gamefeel/combat/progression/waves` yang dipakai code ada di JSON).

---

## Ringkasan

| Sev | Jumlah | Status |
|---|---|---|
| 🔴 KRITIS | 1 | belum diperbaiki |
| 🟠 TINGGI | 2 | belum diperbaiki |
| 🟡 SEDANG | 2 | belum diperbaiki |
| ⚪ RENDAH / higiene | 13 | dicatat, sebagian disengaja |
| ✅ Bersih (diverifikasi tak bermasalah) | 20+ modul | — |

---

## 🔴 KRITIS

### K1. `ReferenceError: meta is not defined` → game loop MATI di mode Endless (wave 5, 10, 15, …)
**Lokasi:** `js/core/game.js:689` (blok `newWave` di `update()`)
```js
if (run.mode && run.mode.id === 'endless' && w % 5 === 0) {
  const bonus = Math.round(w * 5 * getProgressionBand(w).rewardMult);
  run.bonusCurrency += bonus;
  addCurrency(meta, bonus);   // ← `meta` TIDAK pernah dideklarasikan di scope update()
```
- `update()` tidak punya `const meta = STATE.meta;` (deklarasi `meta` hanya ada di fungsi lain: baris 110, 339, 392, 1474, 1484, 1874, 2035). Tidak ada global `window.meta`.
- `game.update(dt)` dipanggil di callback rAF **tanpa try/catch** (`js/main.js:800-806`); `GameLoop._tick` menschedule rAF berikutnya *setelah* `updateFn` → exception menghentikan seluruh loop. **Layar freeze permanen** di Endless wave kelipatan 5.
- Tidak pernah tertangkap e2e karena suite bermain mode `kampanye`; Endless perlu `stats.wins > 0` untuk terbuka.
- **Fix (1 baris):** `const meta = STATE.meta;` di awal `update()` (atau `addCurrency(STATE.meta, bonus)`).

---

## 🟠 TINGGI (kebocoran / kekeliruan ekonomi)

### T1. Modal iklan/survei: tombol BATAL tetap memberi hadiah 5 detik kemudian
**Lokasi:** `js/ui/screens/shop-screen.js:97-118` (`openAdModal`)
```js
cancel.addEventListener('click', () => modal.remove());  // ← interval TIDAK di-clear
const iv = setInterval(() => {
  left -= 1;
  if (left <= 0) { clearInterval(iv); done(); return; }  // done() = modal.remove() + onReward()
  ...
}, 1000);
```
- Kedua pemanggil (`:390` video sponsor, `:411` survei) memberi **Antibodi** lewat `onReward()`.
- Alur: user klik "TONTON"/"ISI" → klik **"Tutup (hadiah batal)"** → modal hilang → 5 detik kemudian `onReward()` jalan tetap → `+Antibodi` masuk + `writeSave`.
- Buruk lagi untuk survei: `markSurveyDone(meta)` ikut terpanggil → **jatah 1×/hari hangus** padahal user sudah batal.
- **Fix:** `cancel` → `clearInterval(iv)` sebelum `modal.remove()`.

### T2. "Imun Coin" fantom: tampil +20 per boss di HUD, tapi tidak pernah diberikan
**Lokasi:** `js/core/game.js:1624-1627` (akruan), `:2535` (HUD), `:1914` (`finishRun`), `data/retention.json` (`imuReward`)
- Data: `imuReward = { perWave: 0, perKill: 0, perBoss: 20, victoryBonus: 50 }`.
- Saat boss tumbang: `run.imuAccrued += 20` + label melayang **"+20 Imun"**; HUD menampilkan `meta.imun + run.imuAccrued` → saldo Imun pemain **naik +20 live** tiap boss.
- Di `finishRun`: `run.imuEarned = 0` dan **tidak ada** `addImun(meta, run.imuAccrued)` → akruan hilang begitu run berakhir. Pemain melihat mata uang yang tidak pernah ia miliki.
- Kontradiksi desain: RONDE-4 (comment di `game.js:1908-1910` & `retention-system.js:imuForRun`) memutuskan Imun Coin **hanya** dari pembelian & reward Battle Pass — tapi tampilkan live + label + panduan tetap memaklumkan sumber lama.
- `js/main.js` `CUR_GUIDE.imu.tasks` masih menulis "tiap kill memberi Imuncoin kecil / bonus per wave / boss = besar" — **salah** terhadap mekanisme sekarang.
- Data `victoryBonus: 50` tidak dikonsumsi di mana pun (dead data).
- **Pilihan fix (butuh keputusan desain):** (a) hapus akruan live + label + perbaiki teks panduan (konsisten dengan "premium ketat"), atau (b) beri `addImun(meta, imuAccrued)` di `finishRun` (menghidupkan lagi earning dari run — melanggar prinsip RONDE-4).

---

## 🟡 SEDANG

### S1. Buff XP (nutrisi `buff_xp`) tidak recompute → efeknya tertunda / tidak pernah aktif
**Lokasi:** `js/core/game.js:~830` (`applyCombatBuff`, cabang `buff_xp`)
- Cabang `buff_damage`, `buff_cooldown`, `buff_maxhp`, `buff_regen`, `buff_omega` semuanya memanggil `this.recomputePlayerStats()`. **Hanya `buff_xp` yang tidak.**
- `addXP()` memakai snapshot `run.player.stats.xpMult` — jadi multiplier XP dari pickup baru berlaku saat recompute lain kebetulan terjadi (level-up, buff lain); bila tidak ada, buff mati se-run sementara label "+X% XP!" sudah tampil.
- **Fix (1 baris):** tambah `this.recomputePlayerStats();` di cabang `buff_xp`.

### S2. Event `bodyimpact` di-emit tanpa listener (fitur setengah jadi)
**Lokasi:** emit `js/core/game.js:1950`; tidak ada `on('bodyimpact')` di seluruh `js/`.
- `ui-bridge.emit` aman (no-op) — bukan bug crash, tapi fitur "dampak run ke kondisi tubuh → UI" tidak pernah terpasang. `this.lastBodyImpact` sendiri sudah dihitung penuh di `finishRun`.
- **Fix:** pasangkan listener (mis. toast/detail di gameover) atau hapus emit.

---

## ⚪ RENDAH / higiene (dicatat)

| # | Lokasi | Catatan |
|---|---|---|
| L1 | `game.js` startRun | `console.info('[MAP] run arena=… render=50a')` — sisa debug + label BUILD lama (sekarang 51a) |
| L2 | `game.js` startRun | `meta.selectedHero = heroId` ditulis walau `heroId` tidak valid (fallback def pakai `meta.selectedHero` lama, tapi id tidak valid tersimpan) |
| L3 | `game.js` run object | key `bodyMods` muncul 2× di satu object literal (nilai sama — tidak berbahaya) |
| L4 | `skill-system.js` `instant_hits` | variabel `total` tak dipakai; helper `s_defColor()` selalu return konstanta (dead code) |
| L5 | `spawn-system.js` `spawnWaveNests` | `if (!enemyId) return;` di dalam loop nest — sebaiknya `continue` (hanya relevan bila pool musuh kosong) |
| L6 | `monetization.js` `simulateAdPlayback` | parameter `onFail` tak pernah dipanggil (simulasi selalu sukses). Laten: bila SDK nyata gagal, `requestRevive()` (dipanggil tanpa onFail di game.js) mengunci game di pause. Perlu guard saat integrasi |
| L7 | `body-system.js` `applyDailyDecay` | save baru (`lastVisitedDay: null` → elapsed=1) mendapat decay 1 hari di run pertama |
| L8 | `body-system.js` | `st.lastPerfectDay` dipakai tapi tidak dideklarasikan di `createDefaultBodyState` (bekerja berkat merge, celah kontrak) |
| L9 | `hud-screen.js:359-361`, `rank-screen.js` | `t('DMG')`, `t('XP')` tak ada di `lang.strings` — tidak berbahaya: fallback menampilkan teks apa adanya, dan DMG/XP netral bahasa (ID=EN) |
| L10 | `upgrades.json:343` | `icon_crosshair.png` tidak ada di disk — **isu #7 yang sudah diketahui & dimitigasi** di `menu-icons.js:231` (pemetaan fallback ke `icon_scope`); referensi data tetap tertinggal |
| L11 | `index.html` | `data-nav="herodetail"` tanpa gate features.json — disengaja (layar detail dari roster, bukan menu utama) |
| L12 | `payment-system.js` | `currentOrder` module-level tunggal — order baru meng-orphan order pending lama (diterima untuk simulasi; backend nyata memakai order server) |
| L13 | `account-system.js` | hash password djb2 32-bit (lemah) — sudah didokumentasikan "bukan pengganti server hash"; aman selama lokal-only |

---

## ✅ Yang diverifikasi BERSIH

- **`game-loop.js`** — dt clamp 50 ms, `setPaused` reset `_last`, stop/start rapi.
- **`state-manager.js` + `save-manager.js`** — `mergeMetaDefaults` punya migrasi lengkap (id hero lama, remap chapter organ, part evolusi); guard private-mode; auto-save di semua titik uang.
- **`data-store.js`** — load paralel + retry, cache-bust `?v=BUILD`, terjemahan field data mem-propagasi `force` ke semua level nesting (tidak ada field yang lolos).
- **`collision-system.js`** — spatial grid + dedup stamp, `hitSet` anti double-hit proyektil, cap pierce, separation anti-tumpang-tindih, smart targeting "finisher".
- **`spawn-system.js`** — gatekeeper Fase 18 (wave beku saat penjaga hidup), ekosistem top-up punya cap `maxAliveEnemies`, spawn selalu di luar pandang, boss roster bergantian.
- **`skill-system.js`** — guard progresi (Lv 3/5/10/15) ditegakkan di `trigger()` sendiri, bukan hanya CSS disabled.
- **`upgrade-system.js`** — roll rarity + pity + kartu evolusi konsisten; biaya squad `round(base×growth^lv)` dengan guard max/currency + save.
- **`economy-system.js` / `rank-system.js` / `battlepass-system.js` / `payment-system.js`** — guard anti double-claim, soft-reset musim tanpa demosi, receipt tersimpan, entitlement jelas.
- **`input-handler.js`** — prioritas UI > combat > movement, pointer capture, `releaseAll()` saat blur/visibility/hide, keyup selalu melepas (anti tersangkut).
- **Entitas (`player`, `enemy`, `projectile`, `pickup`, `ally`)** — pickup punya guard NaN radius; projectile homing turn-rate terbatas; ally hanya menembak saat tombol SERANG (sesuai aturan ronde-5).
- **`feature-gate.js`** — fail-closed (id tak terdaftar = terkunci), peta tombol HUD → gate tunggal.
- **i18n** — fallback total (kunci tak terdaftar = teks apa adanya); 2 string dinamis level-up dicocokkan dengan regex `rules` di `lang.json` (✓).
- **Aset** — 141 path di `data/*.json`: 135 ada; 6 "hilang" = 5 `prop_*.png` (nama polos, di-prefix `assets/sprites/` oleh code — file ada ✓) + 1 `icon_crosshair.png` (L10).
- **Bentuk data** — semua field `gamefeel/combat/progression/waves` yang dirujuk code ada di JSON (45/45 check lolos).
- **Event bus** — 18 emit / 17 listen; satu-satunya yatim = `bodyimpact` (S2).
- **Arsitektur** — tidak ada eval/debugger; gameplay⇄UI hanya lewat ui-bridge (check-imports hijau); BUILD `51a` sinkron dengan `?v=` di index.html.

---

## Catatan untuk commit "midrand & adsterra" yang hilang (01dcfd0)

Commit tersebut **tidak ada** di repo (bukan tip maupun history branch manapun — diverifikasi via `ls-remote` + fetch penuh + pencarian objek). Yang relevan: titik integrasi ads memang sudah disiapkan di **`js/systems/monetization.js`** (marker `TODO(integrasi-ads)` di baris 22 & 134) — hook `triggerRewardedAd*`, kuota harian `canWatchAd`/`trackAdWatch`, dan simulasi playback. Bila commit hilang itu berisi persiapan SDK MidRandy/Adsterra, kerangka pengganti yang dibutuhkan ada di modul itu + modal `openAdModal` (perhatikan bug T1) + `openPayment` di shop-screen.

**Rekomendasi urutan perbaikan:** K1 (crash) → T1 (kebocoran) → S1 (buff) → T2 (keputusan desain dulu) → S2 → lote rendah.
