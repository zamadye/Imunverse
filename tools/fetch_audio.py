#!/usr/bin/env python3
"""
fetch_audio.py — Download CC0/non-copyright SFX MP3 dari URL di
tools/audio_urls.json ke assets/audio/*.mp3.

Cara pakai (LOCAL, bukan di sandbox Claude):
  1. Edit tools/audio_urls.json — isi field "url" tiap slot dengan link MP3.
  2. Jalankan:  python3 tools/fetch_audio.py
  3. Cek assets/audio/ — 9 file MP3 harus ada.
  4. git add assets/audio/ tools/audio_urls.json
     git commit -m "audio: add CC0 SFX pack"
     git push origin claude/audit-layout-ui-ux-3sph96

Script akan otomatis:
  • Skip slot yang url-nya kosong (no-op)
  • Handle redirect (freesound, pixabay CDN)
  • Detect content-type — reject kalau bukan audio
  • Normalize volume (kalau ffmpeg tersedia)
  • Convert ke MP3 44.1kHz stereo (kalau ffmpeg tersedia)
"""
import json
import os
import sys
import shutil
import subprocess
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "tools", "audio_urls.json")
OUT_DIR = os.path.join(ROOT, "assets", "audio")
UA = "Mozilla/5.0 (PHAGOS-fetch-audio/1.0)"
AUDIO_TYPES = ("audio/", "application/octet-stream", "binary/octet-stream")


def has_ffmpeg():
    return shutil.which("ffmpeg") is not None


def download(url: str, dest_raw: str) -> None:
    """Download URL ke dest_raw (path apapun). Follow redirect otomatis."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "audio/*, */*"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        ctype = resp.headers.get("Content-Type", "").lower()
        if not any(ctype.startswith(t) for t in AUDIO_TYPES):
            raise ValueError(f"content-type bukan audio: {ctype}")
        with open(dest_raw, "wb") as f:
            shutil.copyfileobj(resp, f)


def normalize(src: str, dst: str) -> None:
    """Convert ke MP3 44.1kHz stereo + normalize loudness (-14 LUFS ~game standard)."""
    cmd = [
        "ffmpeg", "-y", "-i", src,
        "-af", "loudnorm=I=-14:TP=-1.0:LRA=11",
        "-ar", "44100", "-ac", "2",
        "-codec:a", "libmp3lame", "-b:a", "128k",
        dst,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def main():
    if not os.path.exists(CONFIG):
        print(f"ERROR: {CONFIG} tidak ada.", file=sys.stderr)
        sys.exit(1)
    with open(CONFIG) as f:
        cfg = json.load(f)
    os.makedirs(OUT_DIR, exist_ok=True)

    ffmpeg = has_ffmpeg()
    if not ffmpeg:
        print("⚠️  ffmpeg tidak ditemukan — file akan disimpan APA ADANYA (tanpa normalize).")
        print("   Install ffmpeg untuk auto-normalize:")
        print("     macOS   : brew install ffmpeg")
        print("     Ubuntu  : sudo apt install ffmpeg")
        print("     Windows : winget install ffmpeg")
        print()

    slots = cfg.get("sfx", {})
    ok, skip, fail = 0, 0, 0
    for name, spec in slots.items():
        url = (spec.get("url") or "").strip()
        dst = os.path.join(OUT_DIR, f"{name}.mp3")
        if not url:
            print(f"  ⏭  {name}: url kosong, skip")
            skip += 1
            continue
        print(f"  ⬇  {name} ← {url[:70]}{'…' if len(url) > 70 else ''}")
        try:
            raw = dst + ".raw"
            download(url, raw)
            if ffmpeg:
                normalize(raw, dst)
                os.remove(raw)
            else:
                # tanpa ffmpeg: coba tebak extension dari URL, save apa adanya
                ext = os.path.splitext(url.split("?")[0])[1].lower()
                if ext in (".mp3", ".ogg", ".wav", ".m4a"):
                    shutil.move(raw, dst.replace(".mp3", ext))
                else:
                    shutil.move(raw, dst)
            print(f"     ✓ tersimpan → assets/audio/{name}.mp3")
            ok += 1
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, subprocess.CalledProcessError) as e:
            print(f"     ✗ GAGAL: {e}", file=sys.stderr)
            if os.path.exists(dst + ".raw"):
                os.remove(dst + ".raw")
            fail += 1

    print()
    print(f"Selesai: ✓ {ok} berhasil · ⏭ {skip} skip · ✗ {fail} gagal")
    if ok > 0:
        print()
        print("Selanjutnya:")
        print("  git add assets/audio/ tools/audio_urls.json")
        print("  git commit -m 'audio: add CC0 SFX pack'")
        print("  git push origin claude/audit-layout-ui-ux-3sph96")


if __name__ == "__main__":
    main()
