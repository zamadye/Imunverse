#!/usr/bin/env bash
# tools/ci/install-workflow.sh — pasang gerbang CI Fase 1.5
#
# Definisi workflow disimpan di tools/ci/validate.yml (BUKAN langsung di
# .github/workflows/) karena agent yang bekerja di repo ini memakai GitHub App
# tanpa izin `workflows`; push yang menyentuh .github/workflows/** DITOLAK:
#
#   ! [remote rejected] (refusing to allow a GitHub App to create or update
#      workflow `.github/workflows/validate.yml` without `workflows` permission)
#
# Skrip ini menyalin berkasnya ke tempat yang dibaca GitHub Actions. Jalankan
# sekali, lalu commit + push dengan akun manusia (atau beri App izin
# `workflows`: Settings → Actions → General → Workflow permissions).
#
#   bash tools/ci/install-workflow.sh     # atau: npm run ci:install
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/tools/ci/validate.yml"
DST_DIR="$ROOT/.github/workflows"
DST="$DST_DIR/validate.yml"

if [ ! -f "$SRC" ]; then
  echo "ERROR: $SRC tidak ada." >&2
  exit 1
fi

mkdir -p "$DST_DIR"
cp "$SRC" "$DST"
echo "Terpasang: ${DST#$ROOT/}"

if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  echo
  echo "Langkah berikutnya:"
  echo "  git add .github/workflows/validate.yml"
  echo "  git commit -m 'pasang gerbang CI (validate + BUILD bump + ?v=)'"
  echo "  git push        # harus dengan akun yang punya izin 'workflows'"
  echo
  echo "Catatan: bila push masih ditolak, izinkan dulu di"
  echo "  Settings → Actions → General → Workflow permissions, atau"
  echo "  tambahkan berkasnya lewat UI GitHub (Add file → .github/workflows/validate.yml)."
fi
