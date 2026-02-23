#!/usr/bin/env bash
set -euo pipefail

external_script="${HOME}/.config/scripts/wallpaper.sh"

if [[ -x "$external_script" ]]; then
  exec "$external_script"
fi

echo "[hypr] wallpaper skipped: $external_script not found or not executable"
exit 0
