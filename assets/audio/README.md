# PHAGOS Audio (CC0)

Folder ini menampung file MP3 non-copyright yang di-fetch via `tools/fetch_audio.py`.

## Cara isi

1. Edit `tools/audio_urls.json` — isi field `url` per slot dengan link MP3 dari sumber CC0/public-domain (freesound.org filter CC0, opengameart.org, pixabay.com/sound-effects, kenney.nl/assets).
2. Di terminal **lokal** (bukan sandbox Claude):
   ```bash
   python3 tools/fetch_audio.py
   ```
3. Verifikasi 9-10 file MP3 masuk di sini, lalu commit:
   ```bash
   git add assets/audio/ tools/audio_urls.json
   git commit -m "audio: add CC0 SFX pack"
   git push origin claude/audit-layout-ui-ux-3sph96
   ```

## Slot yang dibutuhkan

| File            | Deskripsi                                        | Durasi ideal |
| --------------- | ------------------------------------------------ | ------------ |
| `shoot.mp3`     | Tembak proyektil hero (laser/blip pendek)        | 0.1–0.2 s    |
| `hit.mp3`       | Kena musuh (impact/thud pendek)                  | 0.1–0.2 s    |
| `ui.mp3`        | Klik tombol menu                                 | 0.15 s       |
| `coin.mp3`      | Pickup coin/orb                                  | 0.15–0.3 s   |
| `wave.mp3`      | Wave baru dimulai (whoosh/gong)                  | 0.4–0.8 s    |
| `chest.mp3`     | Buka peti (magical open)                         | 0.6–1.0 s    |
| `levelup.mp3`   | Level up (ascending arpeggio)                    | 0.8–1.5 s    |
| `evolve.mp3`    | Evolusi/diferensiasi (power-up transform)        | 1.0–2.0 s    |
| `bossSpawn.mp3` | Boss muncul (low brass sting)                    | 1.5–3.0 s    |
| `bossDie.mp3`   | Boss mati (kemenangan blast)                     | 1.0–2.5 s    |

Fallback: kalau file MP3 belum ada di folder ini, game otomatis pakai synth Web Audio (kode existing di `js/systems/audio-system.js`).
