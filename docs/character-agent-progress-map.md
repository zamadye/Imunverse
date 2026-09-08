# Character Agent Progress Map

> Dibuat: 2026-09-09  
> Branch kerja: `arena/01a08106-imunverse`  
> Tujuan dokumen: menjadi peta progres supaya jelas **sudah sampai mana development Character Agent**, bukti/verifikasi apa yang ada, dan **apa saja yang belum** sebelum lanjut ke task berikutnya.

Legenda status: ✅ selesai · 🟡 sebagian/perlu QA lanjutan · 🔄 siap dikerjakan berikutnya · ⬜ belum mulai · 🚫 sengaja di luar scope

---

## 1. Ringkasan status saat ini

| Area | Status | Catatan singkat |
|---|---:|---|
| Mapping repo & arsitektur Character | ✅ | Path awal user (`/src/characters/`, `/src/enemies/`, `/assets/heroes/`, `/assets/enemies/`) tidak ada di repo ini; implementasi aktual dipetakan ke `data/`, `assets/sprites/`, `js/render/`, `js/entities/`, `js/core/game.js`, dan `js/ui/screens/`. |
| CODEOWNERS | ✅ | Tidak ditemukan `CODEOWNERS`; tidak ada file owner formal di repo. |
| Hero equity design data | ✅ | `data/character-designs.json` berisi 11 hero × 4 stage Equity = 44 desain, plus stage 0 Polos via `data/evolutions.json`. |
| Hero equity render di arena gameplay | ✅ | `js/render/character-visuals.js` dipanggil dari render gameplay; stage 0 polos, stage 1–4 overlay equity per hero. |
| Pathogen mutation render di arena gameplay | ✅ | `js/render/character-visuals.js` + enemy `visualFamily`; tier 0–4 berdasarkan wave/elite/boss, visual-only. |
| Roster/collection hero UI | ✅ | `js/ui/screens/roster-screen.js` menampilkan chip + dots Equity stage/cue per hero. |
| Hero detail UI | ✅ | `js/ui/screens/hero-detail-screen.js` menampilkan ladder Stage 0 → Full Equity untuk hero aktif. |
| Bag/inventory UI | ✅ | `js/ui/screens/bag-screen.js` menghubungkan part evolusi dengan konteks visual jalur Equity hero terpilih. |
| Codex/Bio-Pedia UI | ✅ | `js/ui/screens/codex-screen.js` menampilkan tag Equity/Mutation dan detail panel design hero/enemy. |
| HUD gameplay | ✅ | `index.html` + `js/ui/screens/hud-screen.js` menampilkan badge Equity stage aktif di portrait hero. |
| Screenshot review terbaru | ✅ | Ada 4 screenshot review di `shots/review/`, termasuk gameplay equity 11 hero dan UI showcase. |
| Browser walkthrough semua screen Character UI | 🟡 | Runtime data/import sudah hijau. Screenshot UI terbaru berupa static review sheet dari data/assets; perlu capture DOM interaktif jika ingin QA visual per screen secara ketat. |
| Active skill visual per hero/state | 🟡 | HUD glyph skill sudah ada dan tetap data-driven; belum ada animasi skill unik per hero berdasarkan setiap state/skill selain equity overlay dan existing ability FX. |
| Combat damage/balance changes | 🚫 | Tidak disentuh sesuai instruksi; desain visual tidak mengubah math damage. |
| Arena/background systems | 🚫 | Tidak disentuh untuk scope Character Agent. |

---

## 2. Mapping scope ke path aktual repo

| Konsep Character | Path aktual | Fungsi |
|---|---|---|
| Hero definitions | `data/heroes.json` | 11 hero, role, tier, stat, sprite path, unlock, passive/skills. |
| Enemy definitions | `data/enemies.json` | 13 pathogen/enemy, `visualFamily`, behavior, sprite path, stats. |
| Evolution stages/parts | `data/evolutions.json` | Stage 0 Polos sampai Full Equity, cost part, label, tier color, multiplier existing. |
| Character design source of truth | `data/character-designs.json` | Hero equity cue, pathogen family design, mutation tiers, enemy map. |
| Hero/enemy art assets | `assets/sprites/hero_*`, `assets/sprites/enemy_*`, `assets/sprites/part_equity_*` | Sprite runtime yang dipakai langsung. |
| Character visual renderer | `js/render/character-visuals.js` | Overlay equity hero dan mutasi pathogen di gameplay canvas. |
| Gameplay render integration | `js/core/game.js` | Memanggil `drawHeroEquity()` dan `drawPathogenMutation()` pada layer billboard arena. |
| Player/enemy entity | `js/entities/player.js`, `js/entities/enemy.js` | Entity runtime; tidak diubah untuk damage math di Character pass ini. |
| Roster | `js/ui/screens/roster-screen.js` | Kartu hero + chip equity per hero. |
| Hero detail | `js/ui/screens/hero-detail-screen.js` | Ladder desain Equity per hero. |
| Bag/inventory | `js/ui/screens/bag-screen.js` | Part evolusi + konteks design collection. |
| Codex/Bio-Pedia | `js/ui/screens/codex-screen.js` | Panel detail equity hero dan mutation pathogen. |
| HUD | `index.html`, `js/ui/screens/hud-screen.js`, `styles/main.css` | Badge stage equity pada portrait saat gameplay. |
| CSS presentation | `styles/main.css` | Styling khusus chip, ladder, panel, badge Character UI. |
| Review screenshots | `shots/review/*.png` | Bukti visual hasil pass Character Agent. |

---

## 3. Timeline commit Character Agent di branch ini

| Commit | Status | Isi utama |
|---|---:|---|
| `c9b7cdb Redesign immune equity and pathogen visuals` | ✅ | Data desain 11 hero × 4 equity, renderer equity/pathogen, part icon equity, gameplay screenshot awal. |
| `8cfcc9c Add arena equity showcase screenshot` | ✅ | Screenshot arena gameplay sheet 11 hero × 4 Equity stage. |
| `54d9c91 Extend character collection design surfaces` | ✅ | Roster, hero detail, bag, codex, HUD badge, pathogen family metadata, screenshot UI + atlas pathogen. |

---

## 4. Checklist fitur selesai

### 4.1 Hero Equity

| Item | Status | Bukti/path |
|---|---:|---|
| 11 hero punya 4 stage Equity | ✅ | `data/character-designs.json` → heroes, 44 equity entries. |
| Stage 0 polos/base tidak memakai overlay equity | ✅ | `data/evolutions.json` stage 0 + guard `stage <= 0` di `drawHeroEquity()`. |
| Stage 1–4 punya cue anatomi unik | ✅ | `baseCue`, `archetype`, `equity[].visualCue/anatomy/color`. |
| Gameplay canvas memanggil overlay equity | ✅ | `js/core/game.js` memanggil `drawHeroEquity()` untuk player. |
| Roster menampilkan progress equity | ✅ | `rosterEquityMini()` di `js/ui/screens/roster-screen.js`. |
| Detail hero menampilkan ladder lengkap | ✅ | `renderEquityPathCard()` di `js/ui/screens/hero-detail-screen.js`. |
| Bag menampilkan konteks part → stage | ✅ | `appendDesignCollection()` di `js/ui/screens/bag-screen.js`. |
| Codex hero menampilkan design equity | ✅ | `appendHeroEquityDesign()` di `js/ui/screens/codex-screen.js`. |
| HUD menampilkan badge stage aktif | ✅ | `hud-equity-stage` di `index.html` + `resetHUD()`. |

### 4.2 Pathogen Mutation

| Item | Status | Bukti/path |
|---|---:|---|
| 13 enemy punya `visualFamily`/mapping | ✅ | `data/enemies.json` + `data/character-designs.json:pathogens.enemyMap`. |
| Family design untuk semua enemy | ✅ | 12 family di `pathogens.families`, semua enemy resolve ke family. |
| Tier visual 0–4 | ✅ | `pathogens.mutationTiers` + `pathogenVisualTier()`. |
| Tier mulai wave jelas | ✅ | `fromWave`: 1, 5, 9, 13, 17. |
| Elite/boss visual lebih ganas | ✅ | `pathogenVisualTier()` bump elite dan boss minimal tier 3. |
| Render mutasi di gameplay | ✅ | `drawPathogenMutation()` dipanggil dari `js/core/game.js`. |
| Codex enemy punya panel mutasi | ✅ | `appendEnemyMutationDesign()` di `js/ui/screens/codex-screen.js`. |
| Tidak mengubah damage/HP/speed | ✅ | Renderer hanya menggambar overlay; tidak mengubah entity stats. |

### 4.3 Screenshots review

| File | Status | Isi |
|---|---:|---|
| `shots/review/character-redesign-gameplay.png` | ✅ | Arena gameplay B-cell/Bella Full Equity + contoh pathogen. |
| `shots/review/character-equity-11heroes-arena.png` | ✅ | 11 hero × Equity I–Full Equity dari arena gameplay canvas. |
| `shots/review/character-pathogen-mutation-atlas.png` | ✅ | Atlas 13 pathogen × tier 0–4 memakai sprite aktual + metadata mutation. |
| `shots/review/character-collection-ui-showcase.png` | ✅ | Showcase Roster, Hero Detail, Bag, HUD, Bio-Pedia setelah design lanjutan. |

---

## 5. Verifikasi terakhir

Perintah yang sudah dipakai:

```bash
npm run check
```

Hasil terakhir: ✅ semua import, JSON, sprite path, dan referensi `index.html` lolos.

Verifikasi data Character:

```bash
node - <<'NODE'
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('data/character-designs.json','utf8'));
const enemies=JSON.parse(fs.readFileSync('data/enemies.json','utf8')).enemies;
const heroOk=Object.keys(d.heroes).length===11 && Object.values(d.heroes).every(h=>h.equity.map(e=>e.stage).join(',')==='1,2,3,4');
const missing=enemies.filter(e=>!d.pathogens.families[e.visualFamily || d.pathogens.enemyMap[e.id]]).map(e=>e.id);
console.log(`VERIFY hero11x4=${heroOk} pathogenFamilies=${Object.keys(d.pathogens.families).length} enemyFamilyMissing=${missing.length?missing.join(','):'none'}`);
NODE
```

Hasil terakhir:

```text
VERIFY hero11x4=true pathogenFamilies=12 enemyFamilyMissing=none
```

---

## 6. Yang belum / backlog berikutnya

Urutan di bawah disusun supaya tidak lompat scope dan tetap mudah diverifikasi.

### Prioritas A — QA visual interaktif Character UI

| Task | Status | Acceptance criteria |
|---|---:|---|
| Capture DOM screenshot Roster setelah chip equity | 🔄 | Screenshot langsung dari browser, bukan hanya static sheet; tidak ada console error/404. |
| Capture DOM screenshot Hero Detail ladder | 🔄 | Semua row Stage 0–4 terbaca; scroll tidak memotong CTA penting. |
| Capture DOM screenshot Bag design collection | 🔄 | Part card + design panel terbaca di mobile viewport. |
| Capture DOM screenshot Codex hero/enemy detail | 🔄 | Panel equity/mutation terbaca dan tidak overflow buruk. |
| Capture HUD gameplay badge equity | 🔄 | Badge stage terlihat di portrait tapi tidak menutup HP/controls. |

### Prioritas B — Skill/ability visual identity per hero

| Task | Status | Acceptance criteria |
|---|---:|---|
| Audit skill actual per hero | 🔄 | Tabel hero → skill ids → effect kind → glyph/FX current. |
| Tentukan apakah perlu skill FX unik per archetype | ⬜ | Keputusan design: cukup glyph generik atau perlu overlay mikro per hero. |
| Implement visual-only skill accent per hero/archetype | ⬜ | Tidak mengubah damage/cooldown; hanya trail, color, motif, atau impact cue. |
| Screenshot skill state | ⬜ | Minimal 3 hero archetype berbeda dengan skill ready/cooldown/trigger. |

### Prioritas C — Runtime preview renderer untuk collection

| Task | Status | Acceptance criteria |
|---|---:|---|
| Reuse `drawHeroEquity()` untuk canvas mini di Hero Detail/Roster | ⬜ | UI preview bukan hanya text/dots; render stage mini memakai renderer sama. |
| Reuse `drawPathogenMutation()` untuk Codex enemy mini | ⬜ | Panel Codex bisa menampilkan tier 0–4 mini langsung dari canvas renderer. |
| Refactor pure draw helpers bila perlu | ⬜ | Helper tetap di `js/render/character-visuals.js`; tidak mencampur UI logic ke gameplay. |

### Prioritas D — Data design QA dan copy polish

| Task | Status | Acceptance criteria |
|---|---:|---|
| Copy review semua `visualCue`, `baseCue`, `mutationFocus` | 🔄 | Bahasa konsisten, ramah anak, istilah imunologi tetap benar. |
| i18n English untuk field baru | 🟡 | `data-store.js` sudah menandai `mutationFocus`; kamus EN perlu dicek/ditambah bila target bilingual strict. |
| Dense screenshot label cleanup | 🟡 | Screenshot atlas/large sheet cukup untuk review; jika dipakai publik perlu padding/label lebih besar. |

### Prioritas E — Konten/logic di luar Character visual pass

| Task | Status | Catatan |
|---|---:|---|
| Damage/balance combat differentiation | 🚫 | Jangan dikerjakan tanpa instruksi eksplisit. |
| Arena/background redesign | 🚫 | Jangan disentuh di scope ini. |
| Enemy behavior baru | ⬜ | Bisa jadi fase lain; bukan bagian visual mapping saat ini. |
| Hero baru di luar 11 existing | ⬜ | Belum diminta di task ini. |

---

## 7. Known issues / risiko

1. **Screenshot UI showcase terbaru bukan capture DOM interaktif.**  
   File `character-collection-ui-showcase.png` dibuat dari data/assets aktual untuk merangkum design state, tetapi QA final tetap sebaiknya melakukan browser walkthrough per screen.

2. **Global evolution stage berlaku untuk semua hero.**  
   UI menampilkan stage equity berdasarkan `STATE.meta.evoStage`, bukan stage per hero. Ini mengikuti sistem existing; jangan klaim tiap hero punya progress stage individual kecuali sistem save diubah.

3. **Beberapa detail kecil hilang di gameplay scale.**  
   Equity overlay sudah dibuat besar/siluet-readable, tetapi detail mikro bisa tetap berkurang saat kamera jauh. Screenshot gameplay harus tetap jadi patokan.

4. **Browser/visual QA harus cek overflow mobile.**  
   Ladder dan tier chips panjang; CSS memakai clamp/line-clamp, tapi perlu capture di viewport kecil sebelum disebut final-polish.

---

## 8. Definition of Done untuk fase Character berikutnya

Sebuah subtask Character dianggap selesai jika memenuhi semua poin ini:

- [ ] Data/source path aktual sudah disebut di dokumen ini atau PR note.
- [ ] Tidak mengubah combat damage/balance kecuali instruksi eksplisit.
- [ ] Tidak mengubah arena/background system untuk scope Character.
- [ ] `npm run check` lulus.
- [ ] Ada bukti visual baru di `shots/review/` bila outputnya visual.
- [ ] Jika menyentuh UI, minimal satu screenshot/preview dari screen terkait.
- [ ] Progress map ini diperbarui: status task, path berubah, bukti, dan backlog sisa.

---

## 9. Rekomendasi langkah berikutnya

Jika lanjut dari sini, urutan paling aman:

1. **QA visual interaktif**: capture Roster, Hero Detail, Bag, Codex, HUD setelah perubahan terakhir.
2. **Mini renderer collection**: tampilkan preview canvas stage 0–4 di UI menggunakan renderer yang sama dengan gameplay.
3. **Skill visual identity audit**: petakan skill tiap hero dan tentukan visual-only accent yang masih aman.
4. **Copy/i18n polish**: rapikan istilah Indonesia/English untuk semua cue Character.
5. **Update progress map lagi** setelah tiap milestone selesai.
