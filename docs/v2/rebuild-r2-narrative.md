# R2 — NARRATIVE LAYER (Rebuild)
> Status: ✅ SELESAI (BUILD 33a, e2e-r2 18/18, regresi 14 suite 0 FAIL) · Basis: BUILD 32a (R1 ✅) · Sumber: `docs/design/imunverse-story-narrative-design-doc.md` · Induk: `REBUILD-PLAN.md`
> Keputusan user Q1: **REMAP PENUH** campaign organ → 6 kondisi kesehatan.

## 1. Objective
Pemain awam paham *kenapa* mereka bermain: stakes personal (Inang bisa mati), bahasa awam, pemandu emosional (RIA + Dr. Amara), disampaikan lewat cutscene dua-lapis — bukan teks lore mati.

## 2. Problem (V1/BUILD 32a)
- Campaign = 6 bab ORGAN tanpa stakes ("Perut Kram", "Sabit Angin") — tidak ada alasan emosional.
- Cinematics generik ("sesuatu menyusup lewat makanan") tanpa karakter, tanpa dua lapis makro/mikro.
- Coach/tutorial tanpa identitas — suara sistem, bukan karakter.
- Tidak ada mystery hook; tidak ada glossary awam di dialog.

## 3. Design decision
1. **Remap penuh campaign** ke 6 kondisi (doc §5): Luka Kecil → Demam Pertama → Keracunan → Alergi Parah → Ancaman Tersembunyi → Pertahanan Terakhir. Organ lama jadi LOKASI arena (arenaId dipertahankan).
2. **RIA** = rebrand coach + sumber semua barks in-game (1 sistem untuk tutorial+story, doc §3.2). Visual: sinyal partikel biru-hijau (asset `ria_signal.png`).
3. **Dr. Amara** = suara lapisan makro, hanya di cutscene (asset `dr_amara.png`).
4. **Pola dua-lapis di semua cutscene**: teks berprefix `Dr. Amara:` / `RIA:` — dokter bicara bahasa manusia → RIA menerjemahkan jadi konsekuensi gameplay (doc §2.3).
5. **Mystery hook Inang**: story per bab menyisipkan petunjuk; reveal parsial bab 5; reveal penuh epilog (`clear_bab_final`): Inang = anak kecil (doc §5 epilog).
6. **Glossary awam** (doc §4) di `data/narrative.json` — barks memakai terjemahan awam, maks 1 istilah teknis per kalimat.
7. **Barks**: pra-boss (3–5 dtk, non-blocking), pasca-run (1 baris kontekstual menang/kalah), dari data.

## 4. Exact specification
### 4.1 data/campaign.json (remap)
| id baru | Judul | Kondisi | arenaId | Boss |
|---|---|---|---|---|
| bab_luka | Luka Kecil | tergores | limfe | — (perkenalan, killQuota 25) |
| bab_demam | Demam Pertama | flu | paru | virus "Raja Flu Mutan" 1.0 |
| bab_racun | Keracunan | makanan | lambung | toksin_raksasa "Ratu Racun" 1.3 |
| bab_alergi | Alergi Parah | overreaksi imun | paru | spora "Alergen Purba" 1.65 + areaAttack |
| bab_kanker | Ancaman Tersembunyi | sel kanker | limfe | sel_kanker "Bayang Dalam" 2.1 + areaAttack |
| bab_final | Pertahanan Terakhir | kritis | saraf | prion "Mahakrisis" 2.8 + areaAttack |

### 4.2 Migrasi save (state-manager)
Map by index: bab_mulut→bab_luka, bab_lambung→bab_demam, bab_usus→bab_racun, bab_paru→bab_alergi, bab_limfe→bab_kanker, bab_jantung→bab_final — untuk `selectedChapter`, `campaignCleared`, `codexSeen`.

### 4.3 data/narrative.json (baru)
`{ guide: {name:'RIA', full}, doctor: {name:'Dr. Amara'}, glossary[9], bossBarks{per bab + default}, winBarks[3], loseBarks[3], hostHints{per bab} }`

### 4.4 Cutscenes (cinematics.json ditulis ulang)
- `intro` + `onboarding`: shot list doc §7.2 — makro ruang periksa (Dr. Amara, naskah §6.1) → match-cut luka → mikro (RIA bangunkan pemain).
- `brief_<bab>` (2 shot): Dr. Amara (makro) → RIA (mikro) sesuai pola §2.3; naskah §6.2 dipakai di bab_demam, §6.3 di bab_kanker.
- `clear_<bab>` (2 shot): kemenangan + petunjuk Inang (hostHints).
- `clear_bab_final` = epilog §6.4 (3 shot; reveal Inang: siluet anak kecil).

### 4.5 RIA barks runtime (narrative-system.js baru)
- `bossBark(chapterId)` → toast kind `ria`, dipanggil game.js saat `objective.bossSpawned` & `events.bossSpawn`.
- `runEndBark(summary)` → 1 baris di gameover (win/lose kontekstual), non-blocking.
- Cooldown: bark boss maks 1× per run.

### 4.6 RIA identitas di coach
coach.js header menampilkan `⚡ RIA — Respons Imun Adaptif`; seluruh copy coach.json ditulis ulang suara RIA (semangat, jenaka, earpiece — doc §3.2).

## 5. Priority
P0: campaign remap + migrasi + cutscene intro/brief/clear. P1: barks + coach RIA + glossary. P2: aset gambar (boleh placeholder sprite lama bila generate gagal).

## 6. Acceptance criteria
1. campaign.json = 6 bab kondisi (id, judul sesuai §4.1), boss sesuai tabel.
2. Save lama (bab_usus cleared) termigrasi → bab_racun cleared; selectedChapter valid.
3. Cutscene intro memuat teks `Dr. Amara:` DAN `RIA:` (dua lapis).
4. brief tiap bab = 2 shot pola dokter→RIA; clear_bab_final = epilog reveal Inang.
5. Bark RIA muncul saat boss bab spawn (toast `RIA:`), maks 1×/run.
6. Gameover menampilkan 1 baris bark RIA kontekstual (beda menang/kalah).
7. Coach tampil sebagai RIA (header nama) dengan copy baru.
8. narrative.json glossary ≥9 istilah (tabel doc §4).
9. codex bab ter-update ke id baru; markSeen tetap jalan.
10. 0 pageerror; regresi 13 suite hijau.

## 7. Before/After
- Before: "Perut Kram — bersihkan 25 patogen" (kenapa? tidak dijelaskan).
- After: Dr. Amara: "Ada yang tidak beres dengan makanannya semalam…" → RIA: "Denger itu? Racun ikut masuk bareng makanan — kita hajar di Lambung sebelum nyebar!" → pemain tahu KENAPA run ini penting + petunjuk siapa Inang.

## 8. Task breakdown
- [x] Tulis doc R2 (file ini)
- [x] Aset: `dr_amara.png`, `ria_signal.png` (generate; fallback sprite lama)
- [x] data/campaign.json remap + data/narrative.json baru + registrasi data-store
- [x] state-manager migrasi id bab
- [x] cinematics.json tulis ulang (intro/onboarding/brief×6/clear×6+epilog)
- [x] js/systems/narrative-system.js + hook game.js + gameover bark
- [x] coach.json copy RIA + coach.js header RIA
- [x] codex.json id bab baru
- [x] Buster 33a; e2e-r2.mjs; regresi 13 suite; screenshot; commit+push

## 9. Definition of Done
Semua AC §6 lolos; e2e-r2 hijau; regresi 0 FAIL; bukti visual cutscene dua-lapis + bark RIA; dipush ke branch sesi.
