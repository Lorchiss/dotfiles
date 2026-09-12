#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SOURCE="$SCRIPT_DIR/../wallpapers/polar-contour.svg"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/polar"
IMAGE="$CACHE_DIR/polar-contour.png"
ACTION=apply

usage() {
  printf '%s\n' 'Usage: start-wallpaper.sh [--dry-run|--render-only|--daemon]' \
    'Render the local Polar wallpaper once and apply it with awww (or swww).' \
    '--dry-run      No files, daemons or session changes.' \
    '--render-only  Update the PNG cache without touching the desktop.' \
    '--daemon       Internal entry for polar-wallpaper.service.'
}

case "${1:-}" in
  --dry-run) ACTION=dry-run ;;
  --render-only) ACTION=render-only ;;
  --daemon) ACTION=daemon ;;
  -h|--help) usage; exit 0 ;;
  '') ;;
  *) usage >&2; exit 2 ;;
esac
if (($# > 1)); then usage >&2; exit 2; fi
[[ -r "$SOURCE" ]] || { echo '[wallpaper] Missing Polar SVG' >&2; exit 1; }

BACKEND=""
for candidate in awww swww; do
  if command -v "$candidate" >/dev/null 2>&1 \
      && command -v "$candidate-daemon" >/dev/null 2>&1; then
    BACKEND="$candidate"
    break
  fi
done
if [[ "$ACTION" == dry-run ]]; then
  printf '[dry-run] %s -> %s; backend=%s\n' "$SOURCE" "$IMAGE" "${BACKEND:-unavailable}"
  exit 0
fi
if [[ "$ACTION" != render-only && ( -z "$BACKEND" || -z "${WAYLAND_DISPLAY:-}" ) ]]; then
  echo '[wallpaper] A Wayland session and awww/swww are required; desktop unchanged' >&2
  exit 1
fi
if [[ "$ACTION" == daemon ]]; then
  # The backend restores its last cached image after a supervised restart.
  exec "$BACKEND-daemon"
fi

mkdir -p "$CACHE_DIR"
exec 9>"$CACHE_DIR/wallpaper.lock"
flock -w 6 9
TEMPORARY=""
STARTED_SERVICE=0
RENDERED=0
cleanup() {
  [[ -z "$TEMPORARY" ]] || rm -f -- "$TEMPORARY"
  if ((STARTED_SERVICE)); then
    systemctl --user stop polar-wallpaper.service || true
  fi
}
trap cleanup EXIT

if [[ ! -s "$IMAGE" || "$SOURCE" -nt "$IMAGE" ]]; then
  command -v rsvg-convert >/dev/null 2>&1 \
    || { echo '[wallpaper] rsvg-convert is needed to build the PNG cache' >&2; exit 1; }
  TEMPORARY="$(mktemp "$CACHE_DIR/contour.XXXXXX.png")"
  rsvg-convert --output "$TEMPORARY" "$SOURCE"
  mv -f -- "$TEMPORARY" "$IMAGE"
  TEMPORARY=""
  RENDERED=1
fi
if [[ "$ACTION" == render-only ]]; then printf '%s\n' "$IMAGE"; exit 0; fi

ready() { timeout 1 "$BACKEND" query >/dev/null 2>&1; }
if ! ready; then
  systemctl --user import-environment WAYLAND_DISPLAY
  STARTED_SERVICE=1
  systemctl --user start polar-wallpaper.service
  for ((attempt=0; attempt<30; attempt++)); do
    ready && break
    sleep 0.1
  done
  if ! ready; then
    echo '[wallpaper] Daemon unavailable; inspect journalctl --user -u polar-wallpaper.service' >&2
    exit 1
  fi
fi

state="$(timeout 1 "$BACKEND" query)"
outputs=0
matching=1
while IFS= read -r output; do
  [[ -n "$output" ]] || continue
  outputs=$((outputs + 1))
  case "$output" in
    *"currently displaying: image: $IMAGE") ;;
    *) matching=0 ;;
  esac
done <<< "$state"
if (( ! RENDERED && outputs > 0 && matching )); then
  STARTED_SERVICE=0
  echo '[wallpaper] Polar Contour already applied'
  exit 0
fi

transition=fade
[[ "${QS_REDUCED_MOTION:-0}" != 1 ]] || transition=none
"$BACKEND" img "$IMAGE" --resize crop --transition-type "$transition" \
  --transition-duration 0.32 --transition-fps 60
STARTED_SERVICE=0
echo '[wallpaper] Polar Contour applied'
