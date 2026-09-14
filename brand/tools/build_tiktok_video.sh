#!/usr/bin/env bash
# PHAGOS TikTok cinematic teaser 9:16 (1080x1920, ~26s)
# Build: bash brand/tools/build_tiktok_video.sh   (run brand/tools/setup.sh first)
set -e
cd "$(dirname "$0")/../.."
FF=brand/bin/ffmpeg
FR=brand/video/tiktok/frames
OUT=brand/video/tiktok/phagos-teaser-9x16.mp4
TMP=brand/video/tiktok/seg
mkdir -p "$TMP"

# seg <name> <img> <dur> <zoom> [flash] [shake] [txt_overlay] <fade_start>
seg() {
  local name=$1 img=$2 dur=$3 z=$4 flash=$5 shake=$6 txt=$7 fs=$8
  local vf="scale=2160:3840,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30"
  if [ -n "$shake" ]; then
    vf="$vf,crop=980:1746:'50+28*abs(sin(t*17))':'87+28*abs(cos(t*23))',scale=1080:1920"
  fi
  local idx=1 lbl=v0 inputs=()
  filter="[0:v]${vf}[v0]"
  if [ -n "$flash" ]; then
    inputs+=(-f lavfi -t 0.2 -i color=c=white:s=1080x1920)
    filter="$filter;[1:v]fade=t=out:st=0:d=0.18,colorchannelmixer=aa=0.85[fl];[v0][fl]overlay=enable='lt(t,0.18)'[v1]"
    lbl=v1; idx=2
  fi
  if [ -n "$txt" ]; then
    inputs+=(-loop 1 -framerate 30 -t $dur -i "$txt")
    filter="$filter;[$idx:v]format=rgba,fade=t=in:st=$fs:d=0.7:alpha=1[tx];[${lbl}][tx]overlay=enable='gte(t,$fs)'[vout]"
  else
    filter="$filter;[${lbl}]null[vout]"
  fi
  $FF -y -loglevel error -loop 1 -framerate 30 -t $dur -i "$img" "${inputs[@]}" \
    -filter_complex "$filter" -map "[vout]" -r 30 -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p \
    "$TMP/$name.mp4"
  echo "  seg $name ok"
}

echo '[1] segments'
ZIN4="min(1.12,1.0+0.12*on/120)"; ZOUT4="max(1.0,1.12-0.12*on/120)"
ZIN5="min(1.15,1.0+0.15*on/150)"; ZIN2="min(1.09,1.0+0.09*on/51)"
ZIN1="min(1.07,1.0+0.07*on/30)"; ZOUT6="max(1.0,1.05-0.05*on/180)"
seg s1  "$FR/kf-cancer-hook.png"   4.0 "$ZIN4"  ""  ""  "$FR/txt-hook.png"     0.6
seg s2  "$FR/kf-horde-reveal.png"  4.0 "$ZOUT4" ""  ""  "$FR/txt-reveal.png"   0.4
seg s3  "$FR/kf-mako-entrance.png" 5.0 "$ZIN5"  "x" ""  "$FR/txt-entrance.png" 0.9
seg s4  "$FR/kf-action-shoot.png"  1.7 "$ZIN2"  ""  "x" "" 0
seg s5  "$FR/kf-boss-clash.png"    1.7 "$ZIN2"  "x" ""  "" 0
seg s6  "$FR/kf-levelup.png"       1.7 "$ZIN1"  ""  ""  "" 0
seg s7  "$FR/kf-action-shoot.png"  1.7 "$ZIN2"  "x" "x" "" 0
seg s8  "$FR/kf-boss-clash.png"    1.7 "$ZIN2"  ""  ""  "" 0
seg s9  "$FR/kf-levelup.png"       1.7 "$ZIN1"  "x" ""  "" 0
seg s10 "$FR/kf-logo-cta.png"      6.0 "$ZOUT6" ""  ""  "" 0

echo '[2] concat xfade'
$FF -y -loglevel error \
  -i "$TMP/s1.mp4" -i "$TMP/s2.mp4" -i "$TMP/s3.mp4" -i "$TMP/s4.mp4" -i "$TMP/s5.mp4" \
  -i "$TMP/s6.mp4" -i "$TMP/s7.mp4" -i "$TMP/s8.mp4" -i "$TMP/s9.mp4" -i "$TMP/s10.mp4" \
  -filter_complex "\
[0][1]xfade=transition=fadeblack:duration=0.4:offset=3.6[v1];\
[v1][2]xfade=transition=fade:duration=0.4:offset=7.2[v2];\
[v2][3]xfade=transition=fadeblack:duration=0.15:offset=11.8[v3];\
[v3][4]xfade=transition=fade:duration=0.15:offset=13.35[v4];\
[v4][5]xfade=transition=fadeblack:duration=0.15:offset=14.9[v5];\
[v5][6]xfade=transition=fade:duration=0.15:offset=16.3[v6];\
[v6][7]xfade=transition=fadeblack:duration=0.15:offset=17.6[v7];\
[v7][8]xfade=transition=fade:duration=0.15:offset=19.15[v8];\
[v8][9]xfade=transition=fade:duration=0.4:offset=20.35[vout]" \
  -map "[vout]" -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p "$TMP/video-only.mp4"
echo "  concat ok"

echo '[3] audio mix'
$FF -y -loglevel error -i "$TMP/video-only.mp4" \
  -i brand/video/tiktok/audio/sfx.wav \
  -i brand/video/tiktok/audio/vo1-tubuhmu.mp3 \
  -i brand/video/tiktok/audio/vo2-daridalam.mp3 \
  -i brand/video/tiktok/audio/vo3-penjaga.mp3 \
  -i brand/video/tiktok/audio/vo5-aksi.mp3 \
  -i brand/video/tiktok/audio/vo6-kenali.mp3 \
  -i brand/video/tiktok/audio/vo7-cta.mp3 \
  -filter_complex "\
[1]volume=1.0[s];\
[2]adelay=600|600,volume=1.7[a1];\
[3]adelay=4300|4300,volume=1.7[a2];\
[4]adelay=7800|7800,volume=1.7[a3];\
[5]adelay=12600|12600,volume=1.6[a4];\
[6]adelay=20700|20700,volume=1.8[a5];\
[7]adelay=23000|23000,volume=1.8[a6];\
[s][a1][a2][a3][a4][a5][a6]amix=inputs=7:duration=first:normalize=0,\
afade=t=out:st=25.4:d=0.9,alimiter=limit=0.95[aout]" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
echo "  FINAL: $OUT"
rm -rf "$TMP"
