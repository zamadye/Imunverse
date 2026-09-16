# KREDIT AUDIO — PHAGOS

Semua audio di folder ini **bebas lisensi (CC0-1.0 Universal / public domain)**:
boleh dipakai, dimodifikasi, dan didistribusikan untuk komersial **tanpa atribusi**.
Kredit di bawah ini dicatat sebagai apresiasi, bukan kewajiban hukum.

Folder ini berisi **turunan**: setiap file dipotong, di-fade, dinormalisasi
(EBU R128), lalu di-encode ulang ke MP3 oleh `tools/build-audio.sh`.
Sumber aslinya **tidak** dikomit ke repo (62 MB) — skrip mengunduhnya lagi bila perlu.

---

## Musik (`assets/audio/music/`)

| File | Dipakai untuk | Asal trek | Lisensi |
|---|---|---|---|
| `bgm_menu.mp3` | Dashboard / menu | **Cinemato** | CC0-1.0 |
| `bgm_run.mp3` | Dalam run (bab 1–4) | **Science Fiction** | CC0-1.0 |
| `bgm_boss.mp3` | Gelombang boss / duel | **Fury** | CC0-1.0 |
| `bgm_dark.mp3` | Bab gelap (kanker, final) | **Mysterious** | CC0-1.0 |

Sumber: [effacestudios/Royalty-Free-Music-Pack](https://github.com/effacestudios/Royalty-Free-Music-Pack) —
lisensi **CC0-1.0** (dicek langsung di berkas `LICENSE` repositori sumber).
Potongan: 50 detik, fade in 1,2 dtk / fade out 2,5 dtk, loudness −14 LUFS,
MP3 96 kbps stereo 44,1 kHz.

## SFX (`assets/audio/sfx/`)

Semua berasal dari **Kenney** — [kenney.nl](https://kenney.nl) — lisensi **CC0-1.0**
(dicatat juga di `LICENSE.md` repositori cermin
[iwenzhou/kenney](https://github.com/iwenzhou/kenney)).

| File | Bunyi untuk | Sumber Kenney |
|---|---|---|
| `ui.mp3` | Klik tombol | UI sounds — `click1` |
| `ui_confirm.mp3` | Konfirmasi / beli | UI sounds — `switch7` |
| `ui_hover.mp3` | Sorot menu | UI sounds — `rollover2` |
| `hit.mp3` | Membran kena patogen | Digital sounds — `zap1` |
| `hit_crit.mp3` | Hit kritis | Digital sounds — `zap2` |
| `kill.mp3` | Patogen mati | Digital sounds — `zapTwoTone` |
| `engulf.mp3` | Menelan (engulf) | Digital sounds — `spaceTrash1` |
| `collect.mp3` | Ambil nutrisi | Digital sounds — `pepSound1` |
| `collect_big.mp3` | Drop langka | Digital sounds — `pepSound3` |
| `coin.mp3` | Biokredit | Digital sounds — `tone1` |
| `levelup.mp3` | Naik level | Digital sounds — `powerUp1` |
| `mutation.mp3` | Mutasi dipilih | Digital sounds — `phaseJump1` |
| `pulse.mp3` | Pulse pemain | Digital sounds — `phaserUp2` |
| `ability.mp3` | Skill pasif menyala | Digital sounds — `phaserUp5` |
| `evolve.mp3` | Evolusi | Digital sounds — `phaserUp7` |
| `player_hit.mp3` | Pemain kena | Digital sounds — `lowDown` |
| `heartbeat.mp3` | HP kritis | Digital sounds — `lowThreeTone` |
| `boss_spawn.mp3` | Boss muncul | Digital sounds — `zapThreeToneDown` |
| `boss_die.mp3` | Boss tumbang | Digital sounds — `spaceTrash3` |
| `boss_blast.mp3` | Ledakan boss | Digital sounds — `laser7` |
| `wave.mp3` | Gelombang baru | Digital sounds — `threeTone2` |
| `chest.mp3` | Peti | Digital sounds — `powerUp5` |
| `revive.mp3` | Bangkit lagi | Digital sounds — `powerUp9` |
| `gameover.mp3` | Run berakhir | Digital sounds — `highDown` |
| `victory.mp3` | Menang | Digital sounds — `zapThreeToneUp` |
| `shoot.mp3` | Proyektil musuh | Digital sounds — `laser3` |
| `strain.mp3` | Patogen bermutasi | Digital sounds — `lowRandom` |
| `capsule.mp3` | Kapsul dibuka | Digital sounds — `spaceTrash5` |
| `warn.mp3` | Peringatan | Digital sounds — `twoTone1` |

Olahan: loudness −13 LUFS, true peak −1 dB, MP3 64 kbps mono 44,1 kHz.

## Narasi (`assets/audio/narration/`)

VO RIA & Dr. Amara — aset internal proyek (bukan pihak ketiga).

---

### Kenapa “lebih keras”

1. Tiap file dinormalisasi EBU R128 saat dibangun (bukan volume asal-asalan).
2. `data/audio.json → volumes.master` = **0,9** (sebelumnya tertanam `0.5` di kode),
   plus `gain` per-SFX 0,3–0,95.
3. Musik punya bus sendiri (`volumes.music` 0,5) dan otomatis turun
   (`duckGain` 0,25) saat narator VO bicara.

Bila sebuah file gagal dimuat (PWA offline/cache miss), `audio-system.js` dan
`music-system.js` **jatuh ke synth prosedural WebAudio** — game tetap bersuara
walau tanpa berkas MP3.
