#!/usr/bin/env bash
# PHAGOS brand tooling bootstrap (run at start of any turn that builds assets)
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$ROOT/brand/libs" "$ROOT/brand/bin"
if ! [ -f "$ROOT/brand/libs/PIL/__init__.py" ]; then
  pip3 install --quiet --break-system-packages --target "$ROOT/brand/libs" pillow
fi
if ! [ -x "$ROOT/brand/bin/ffmpeg" ]; then
  T="$(mktemp -d)"
  pip3 download --quiet --no-deps -d "$T" imageio-ffmpeg
  ( cd "$T" && unzip -q -o $(ls *.whl) "imageio_ffmpeg/binaries/*" )
  cp "$(find "$T" -name 'ffmpeg-linux-*' | head -1)" "$ROOT/brand/bin/ffmpeg"
  chmod +x "$ROOT/brand/bin/ffmpeg"
  rm -rf "$T"
fi
echo "tooling ready: $ROOT"
