# PHASE 3 — HERO IDENTITY

> Status: ✅ SELESAI & terverifikasi e2e (BUILD 29a, suite `scripts/e2e-v2phase35.mjs`) · Induk: `BLUEPRINT-MASTER.md`
> Angka phase ini hidup di **`data/heroes.json`** (field baru `passive` per hero).

## 1. Objective

Setiap dari 11 hero terasa BERBEDA sejak menit pertama — bukan hanya angka stat & warna proyektil, tapi **satu passive khas yang mengubah cara bermain**. Pemain memilih hero karena gaya, bukan karena "yang belum kucoba".

## 2. Problem (bukti dari kode V1)

| Gap | Bukti |
|---|---|
| **Tidak ada passive sama sekali** | `heroes.json` hanya `baseStats/attackPattern/skills`; `computePlayerStats` tidak membaca identitas apa pun selain angka |
| **Identitas NK Cell = kode mati** | game.js:476 `if (run.heroDef.id === 'sel_nk')` — id asli hero adalah `nkcell` (state-manager hanya memetakan save lama). Pulse pengungkap **tidak pernah jalan** |
| **Skill mark = no-op** | `mark_target` men-set `e.markMult/markT` (skill-system:199) tapi TIDAK ADA konsumen: grep `markMult` di seluruh jalur damage = 0 hasil; `markT` tidak pernah di-decrement |
| Role hanya label | Tank/Damage/Support tampil di UI tapi tidak punya ekspresi mekanis |
| 3 pattern untuk 11 hero | pierce/homing/melee dipakai bergiliran; dua hero se-pattern beda rasa hanya lewat stat |

## 3. Design Decision

1. **1 passive per hero, data-driven** (`heroes.json → passive {type, params, name, desc}`), dieksekusi modul baru `js/systems/passive-system.js` lewat 5 hook: stat (compute), on-kill, on-hit, on-player-hit, tick. Alternatif ditolak: rework 3 attack pattern jadi 11 — mahal, sedangkan passive memberi diferensiasi per menit-1 dengan biaya kecil.
2. **Perbaiki 2 bug identitas** sebagai bagian phase: NK reveal jadi passive `reveal_pulse` data-driven (kode `sel_nk` dihapus); `markMult` akhirnya DIKONSUMSI oleh semua damage player→musuh + `markT` di-decrement — sekaligus menghidupkan kembali skill `mark_target`.
3. **Passive menyambung sistem V2 yang sudah ada**: B Cell menaikkan crit Phase 1; T CD8 executioner menyambung finisher-targeting Phase 2; elite hunter NK menyambung elite Phase 5. Identitas = interaksi, bukan fitur terisolasi.
4. Passive tampil di layar hero detail (nama + deskripsi) — identitas harus TERBACA sebelum dipilih.

## 4. Exact Specification — 11 passive

| Hero | Role | Passive | Efek presisi |
|---|---|---|---|
| Mako (macrophage) | Tank | **Fagositosis** | tiap kill heal 2 HP |
| Denra (dendritic) | Support | **Presentasi Antigen** | tiap hit menandai musuh: damage diterima +10%, 3 dtk (pakai markMult) |
| Neo (neutrophil) | Damage | **Amukan Granula** | setelah kill: attack speed +25% selama 3 dtk (tempBuffs.cooldown) |
| Eos (eosinophil) | Damage | **Granula Toksik** | tiap hit meracuni: 30% damage/dtk selama 2 dtk (DOT existing) |
| Baso (basophil) | Support | **Awan Histamin** | musuh radius ≤150 px melambat ke 85% speed |
| Masta (mastcell) | Tank | **Degranulasi** | saat terpukul: ledakan 12 damage radius 120 px |
| Cyto (tcd8) | Damage | **Sitotoksik** | +30% damage ke musuh HP <25% |
| Helpa (tcd4) | Support | **Komando Sitokin** | cooldown 3 skill ×0.85 |
| Rega (treg) | Support | **Toleransi** | regen 0.8 HP/dtk |
| Bela (bcell) | Damage | **Memori Antibodi** | crit chance +6% (8%→14%, sistem Phase 1) |
| Enka (nkcell) | Damage | **Sensor Sitolitik** | pulse 1.3 dtk mengungkap musuh stealth 1.6 dtk (fix bug V1) |

Hook & urutan damage keluar: `dmg = base × crit × markMult(bila markT>0) × executeBonus` — diterapkan identik di jalur proyektil DAN melee.

## 5. Priority

P0: infrastruktur passive-system + konsumsi markMult (bug fix) + 4 passive run-verifiable (macrophage/treg/bcell/tcd4) · P1: 7 sisanya (semuanya dikerjakan sekarang — per hook, biaya marginal kecil).

## 6. Acceptance Criteria

- [x] 11/11 hero punya `passive` dengan `name/desc` di heroes.json.
- [x] Mako: kill → HP naik (heal teramati in-run).
- [x] Rega: HP naik pasif tanpa kill (regen teramati via hook tick).
- [x] Bela: crit chance efektif = base + 0.06 (via passive-system).
- [x] Helpa: cooldown skill slot < cooldown def (×0.85).
- [x] markMult DIKONSUMSI: musuh ber-mark menerima damage lebih besar; markT meluruh.
- [x] Masta: damagePlayer → musuh sekitar kena retaliate.
- [x] Kode mati `sel_nk` terhapus; reveal jalan via passive nkcell.
- [x] Passive tampil di hero detail; 0 pageerror; regresi hijau.

## 7. Before / After

| | V1 | V2 |
|---|---|---|
| Passive | 0 dari 11 | 11 dari 11, data-driven |
| NK reveal | kode mati (id salah) | jalan via passive |
| Skill mark | no-op | +10% damage nyata |
| Role | label UI | terekspresi (tank sustain, support aura/haste, damage burst) |

## 8. Task Breakdown

1. `heroes.json`: field `passive` 11 hero. 2. `js/systems/passive-system.js` (baru): `applyStatPassives`, `modifyOutgoingDamage` (mark+execute), `passiveOnKill`, `passiveOnHit`, `passiveOnPlayerHit`, `passiveTick`. 3. Hook di game.js (5 titik) + SkillSystem (skill_haste) + rollCrit (crit_up). 4. markT decay di loop DOT. 5. Hero-detail UI + baris passive. 6. e2e gabungan `scripts/e2e-v2phase35.mjs`.

## 9. Definition of Done

AC §6 lolos · suite gabungan PASS · regresi 8 suite hijau · buster `29a` · bukti screenshot · status ✅.
