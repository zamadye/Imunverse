#!/usr/bin/env bash
# build-audio.sh — Bangun ulang SEMUA aset audio (musik + SFX) dari sumber CC0.
#
# Kenapa ada skrip ini: aset audio di assets/audio/ adalah TURUNAN (potongan +
# normalisasi EBU R128 + encode MP3). Sumber aslinya tetap di upstream (CC0-1.0),
# jadi setiap kali trek diganti, jalankan skrip ini — bukan edit file MP3 manual.
#
# Butuh: ffmpeg (atau FFMPEG=/path/ke/ffmpeg), curl, python3.
#
#   ./tools/build-audio.sh            # pakai cache di tools/.audiosrc bila ada
#   ./tools/build-audio.sh --refresh  # unduh ulang sumber dari GitHub
#
# Sumber (semua CC0-1.0 / public domain — lihat assets/audio/CREDITS.md):
#   - Musik  : github.com/effacestudios/Royalty-Free-Music-Pack  (CC0-1.0)
#   - SFX    : github.com/iwenzhou/kenney  → Audio/Digital sounds + UI sounds (Kenney, CC0-1.0)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/tools/.audiosrc"
OUT_MUSIC="$ROOT/assets/audio/music"
OUT_SFX="$ROOT/assets/audio/sfx"
FF="${FFMPEG:-$(command -v ffmpeg || true)}"
REFRESH="${1:-}"

if [ -z "$FF" ]; then
  echo "ffmpeg tidak ditemukan. Set: FFMPEG=/path/ke/ffmpeg ./tools/build-audio.sh" >&2
  exit 1
fi

mkdir -p "$SRC/music" "$SRC/sfx" "$OUT_MUSIC" "$OUT_SFX"

# ---------------------------------------------------------------- unduh
gh_get() { # repo path dest  (pakai GitHub blob API → base64)
  local repo="$1" path="$2" dest="$3"
  [ -s "$dest" ] && [ "$REFRESH" != "--refresh" ] && return 0
  local sha
  sha=$(python3 - "$repo" "$path" <<'PY'
import json,sys,urllib.request
repo,path=sys.argv[1],sys.argv[2]
req=urllib.request.Request(f"https://api.github.com/repos/{repo}/contents/{path}",
    headers={'Accept':'application/vnd.github+json','User-Agent':'phagos-build-audio'})
data=json.load(urllib.request.urlopen(req,timeout=60))
print(data['sha'] if isinstance(data,dict) else '')
PY
)
  [ -z "$sha" ] && { echo "  ! gagal mengambil sha: $path" >&2; return 1; }
  python3 - "$repo" "$sha" "$dest" <<'PY'
import json,sys,base64,urllib.request
repo,sha,dest=sys.argv[1],sys.argv[2],sys.argv[3]
req=urllib.request.Request(f"https://api.github.com/repos/{repo}/git/blobs/{sha}",
    headers={'Accept':'application/vnd.github+json','User-Agent':'phagos-build-audio'})
open(dest,'wb').write(base64.b64decode(json.load(urllib.request.urlopen(req,timeout=180))['content']))
PY
}

MUSIC_REPO="effacestudios/Royalty-Free-Music-Pack"
SFX_REPO="iwenzhou/kenney"

echo "== Mengambil sumber musik (CC0) =="
for f in "Cinemato.mp3" "Science Fiction.mp3" "Fury.mp3" "Mysterious.mp3"; do
  echo "  $f"
  gh_get "$MUSIC_REPO" "$f" "$SRC/music/$f" || true
done

echo "== Mengambil sumber SFX (Kenney, CC0) =="
for f in click1 switch7 rollover2 zap1 zap2 zapTwoTone zapThreeToneDown zapThreeToneUp \
         spaceTrash1 spaceTrash3 spaceTrash5 pepSound1 pepSound3 powerUp1 powerUp5 powerUp9 \
         phaserUp2 phaserUp5 phaserUp7 lowDown lowThreeTone lowRandom threeTone2 phaseJump1 \
         laser3 laser7 highDown twoTone1 tone1; do
  case "$f" in
    click1|switch7|rollover2) dir="Audio (295 files)/UI sounds (50 sounds)" ;;
    *) dir="Audio (295 files)/Digital sounds (60 sounds)" ;;
  esac
  gh_get "$SFX_REPO" "$dir/$f.ogg" "$SRC/sfx/$f.ogg" || true
done

# ---------------------------------------------------------------- musik
# Loop 50 dtk + fade + normalisasi EBU R128 (-14 LUFS) → MP3 96 kbps stereo.
mus() { # file start out
  echo "  musik: $3"
  "$FF" -y -hide_banner -loglevel error -ss "$2" -i "$SRC/music/$1" -t 50 \
    -af "afade=in:st=0:d=1.2,afade=out:st=47.5:d=2.5,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100" \
    -ac 2 -ar 44100 -c:a libmp3lame -b:a 96k "$OUT_MUSIC/$3"
}
echo "== Bangun musik =="
mus "Cinemato.mp3"        8 bgm_menu.mp3
mus "Science Fiction.mp3" 10 bgm_run.mp3
mus "Fury.mp3"            12 bgm_boss.mp3
mus "Mysterious.mp3"      6 bgm_dark.mp3

# ---------------------------------------------------------------- SFX
# Normalisasi EBU R128 (-13 LUFS, true peak -1 dB) → MP3 64 kbps mono.
sfx() {
  echo "  sfx: $2"
  "$FF" -y -hide_banner -loglevel error -i "$SRC/sfx/$1" \
    -af "loudnorm=I=-13:TP=-1.0:LRA=7,aresample=44100" \
    -ac 1 -ar 44100 -c:a libmp3lame -b:a 64k "$OUT_SFX/$2"
}
echo "== Bangun SFX =="
sfx click1.ogg ui.mp3
sfx switch7.ogg ui_confirm.mp3
sfx rollover2.ogg ui_hover.mp3
sfx zap1.ogg hit.mp3
sfx zap2.ogg hit_crit.mp3
sfx zapTwoTone.ogg kill.mp3
sfx spaceTrash1.ogg engulf.mp3
sfx pepSound1.ogg collect.mp3
sfx pepSound3.ogg collect_big.mp3
sfx powerUp1.ogg levelup.mp3
sfx phaseJump1.ogg mutation.mp3
sfx phaserUp2.ogg pulse.mp3
sfx phaserUp5.ogg ability.mp3
sfx phaserUp7.ogg evolve.mp3
sfx lowDown.ogg player_hit.mp3
sfx lowThreeTone.ogg heartbeat.mp3
sfx zapThreeToneDown.ogg boss_spawn.mp3
sfx spaceTrash3.ogg boss_die.mp3
sfx threeTone2.ogg wave.mp3
sfx powerUp5.ogg chest.mp3
sfx powerUp9.ogg revive.mp3
sfx highDown.ogg gameover.mp3
sfx zapThreeToneUp.ogg victory.mp3
sfx laser3.ogg shoot.mp3
sfx laser7.ogg boss_blast.mp3
sfx lowRandom.ogg strain.mp3
sfx spaceTrash5.ogg capsule.mp3
sfx twoTone1.ogg warn.mp3
sfx tone1.ogg coin.mp3

echo "== Selesai =="
du -sh "$OUT_MUSIC" "$OUT_SFX"
echo "Peta file & volume: data/audio.json · Kredit & lisensi: assets/audio/CREDITS.md"
