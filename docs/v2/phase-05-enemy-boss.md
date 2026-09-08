# PHASE 5 — ENEMY & BOSS

> Status: ✅ SELESAI & terverifikasi e2e (BUILD 29a, suite `scripts/e2e-v2phase35.mjs`) · Induk: `BLUEPRINT-MASTER.md`
> Angka phase ini hidup di **`data/enemies.json`** (elite affix) + **`data/waves.json`** (elite pacing, boss enrage).

## 1. Objective

Musuh menuntut JAWABAN BERBEDA per jenis (taxonomy fungsional), elite jadi momen mini-boss yang dikenali dari jauh, dan boss punya kurva dramatis (fase enrage) — bukan spons HP dengan satu pola.

## 2. Problem (bukti dari kode V1)

| Gap | Bukti |
|---|---|
| **`elite:true` hampir tak berarti** | hanya dibaca utk hit-stop/shake (Phase 1) & part-drop; TIDAK ada perbedaan statistik, visual, atau perilaku — virion/parasit "elite" identik dengan dirinya sendiri versi biasa |
| **Boss satu pola dari 100%→0% HP** | `boss_pattern_a._updateAreaAttack`: interval AOE konstan; tidak ada fase, tidak ada eskalasi — 60 dtk terakhir terasa seperti 60 dtk pertama |
| **Tidak ada spawn elite terencana** | elite hanya muncul via weighted random pool; tidak ada momen "elite wave" yang bisa diantisipasi |
| Telegraph AOE boss satu-satunya bahasa | drawShape ring (shape-renderer:155) — cukup, tapi tanpa perubahan ritme saat HP rendah |

## 3. Design Decision

1. **Elite affix system, data-driven**: musuh reguler bisa spawn sebagai ELITE dengan affix acak dari `def.eliteAffixes` (atau pool global). Elite = ×2.6 HP, ×1.25 radius, +50% XP/drop (sudah ada jalur part elite), aura ring warna affix + label nama. Affix V2-1: `brute` (dmg ×1.5, knockback player saat strike), `swift` (speed ×1.35, windup 0.28), `regen` (2%/dtk max HP), `volatile` (mati → ledakan telegraph 0.5 dtk radius 90, damage 12).
2. **Elite terencana**: mulai wave 3, tiap wave spawn `1 + floor((wave−3)/4)` elite (cap 3) dari sarang jauh — momen "itu elite, siapkan skill" yang bisa diantisipasi. Pacing di `waves.json.elite`.
3. **Boss enrage 2 fase**: HP ≤40% → ENRAGE: announce + tint merah + interval AOE ×0.62 + speed ×1.3 + telegraph ×0.85 (lebih cepat tapi masih terbaca). Satu mekanik, dramatis, murah — alternatif "3 fase + minion summon" ditunda ke konten boss baru (Phase 7 biome).
4. Taxonomy V1 (chase/weave/splitter/hazard/stealth/armor) SUDAH fungsional — dipertahankan, didokumentasikan sebagai matrix jawaban pemain; yang kurang adalah lapisan elite & drama boss, itulah fokus phase ini.

## 4. Exact Specification

### 4.1 Elite spawn & affix

```
spawnEnemy(..., {elite:true, affix}) →
  hp ×2.6 · radius ×1.25 · def.elite=true (feedback Phase 1 tier elite otomatis)
  affix brute   : damage ×1.5
  affix swift   : speed ×1.35, contact windup 0.28s (lebih cepat dr 0.35 normal)
  affix regen   : heal 0.02×maxHP/dtk (tick di enemy.update)
  affix volatile: onKilled → telegraph ring 0.5s lalu blast r=90 dmg=12
render: ring aura warna affix (ground ellipse) + label nama affix di atas HP bar
```

### 4.2 Pacing elite (`waves.json.elite`)

```json
{ "startWave": 3, "base": 1, "addEveryWaves": 4, "max": 3,
  "hpMult": 2.6, "radiusMult": 1.25,
  "affixes": ["brute", "swift", "regen", "volatile"] }
```

### 4.3 Boss enrage

```
hp/maxHP ≤ 0.40 (sekali per boss):
 ├─ announce "MENGAMUK!" + shake 0.5 + SFX bossSpawn + haptic boss
 ├─ speed ×1.3 · areaAttack.interval ×0.62 · telegraphTime ×0.85
 └─ render: tint merah (flash 0.25 konstan) + aura partikel marah
angka di waves.json.bossEnrage {threshold, speedMult, intervalMult, telegraphMult}
```

## 5. Priority

P0: elite affix + spawn terencana (mengisi "momen antisipasi" yang kosong antar boss) · P0: boss enrage (drama akhir fight) · P1: aura/label render.

## 6. Acceptance Criteria

- [x] Elite spawn terencana: wave ≥3 memunculkan musuh dengan `eliteAffix` terisi & HP ≈×2.6 musuh sejenis.
- [x] Affix swift teramati: speed > def.speed×1.2 dan windup < normal.
- [x] Affix regen teramati: HP naik antar frame tanpa di-hit.
- [x] Affix volatile: kill → efek telegraph muncul → blast melukai player dalam radius (atau whiff bila menjauh — konsisten filosofi Phase 2).
- [x] Boss enrage: set HP 35% → announce + interval AOE mengecil + speed naik; terjadi SEKALI.
- [x] Elite mendapat feedback tier elite Phase 1 (hit-stop 50ms) otomatis via def.elite.
- [x] 0 pageerror; regresi hijau.

## 7. Before / After

| | V1 | V2 |
|---|---|---|
| Elite | flag kosmetik drop | mini-boss: ×2.6 HP + affix + aura + spawn terencana |
| Antisipasi antar boss | tidak ada | 1–3 elite/wave mulai wave 3 |
| Boss HP rendah | ritme sama | enrage: cepat+agresif, telegraph tetap terbaca |
| Jawaban pemain | kejar-tembak seragam | brute=jaga jarak, swift=dodge disiplin, regen=fokus burst, volatile=jangan looting di bangkai |

## 8. Task Breakdown

1. `waves.json`: blok `elite` + `bossEnrage`. 2. `enemy.js`: `makeElite(affix)`, regen tick, windup swift, enrage state boss. 3. `game.js`: spawn elite terencana (spawn-system), volatile on-kill blast, enrage trigger + announce, render aura/label/tint. 4. e2e di suite gabungan `scripts/e2e-v2phase35.mjs`.

## 9. Definition of Done

AC §6 lolos · suite gabungan PASS · regresi 8 suite hijau · buster `29a` · bukti screenshot · status ✅.
