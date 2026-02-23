#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bootstrap/check-deps.sh [--strict]

Options:
  --strict   Exit with code 1 when any required dependency is missing.
EOF
}

strict=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      strict=1
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "[error] Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

required_ok=0
required_warn=0
optional_ok=0
optional_warn=0

check_cmd() {
  local tier="$1"
  local cmd="$2"
  local label="${3:-$2}"

  local ok_field="required_ok"
  local warn_field="required_warn"
  if [[ "$tier" == "optional" ]]; then
    ok_field="optional_ok"
    warn_field="optional_warn"
  fi

  if command -v "$cmd" >/dev/null 2>&1; then
    echo "✅ OK   $label ($cmd)"
    printf -v "$ok_field" '%d' "$(( ${!ok_field} + 1 ))"
  else
    echo "⚠️ WARN $label ($cmd)"
    printf -v "$warn_field" '%d' "$(( ${!warn_field} + 1 ))"
  fi
}

echo "[dotfiles] preflight dependency check"
if [[ "$strict" -eq 1 ]]; then
  echo "[mode] strict: fail if required dependencies are missing"
fi

echo "- Required: core session"
check_cmd required hyprctl "Hyprland control"
check_cmd required ags "Aylur's GTK Shell"
check_cmd required systemctl "systemd user manager"

echo "- Required: bar / control center runtime"
check_cmd required playerctl "Media metadata / controls"
check_cmd required pactl "Audio volume control"
check_cmd required ip "Network interface status"
check_cmd required awk "Text processing"
check_cmd required curl "HTTP fetch for cover art / API"
check_cmd required python3 "Spotify API helper runtime"
check_cmd required xdg-open "Open browser for Spotify OAuth"
check_cmd required notify-send "Desktop notifications for popup actions"
check_cmd required nmcli "NetworkManager CLI"
check_cmd required bluetoothctl "Bluetooth CLI"

echo "- Optional: metrics / desktop extras"
check_cmd optional iw "Wi-Fi signal metric"
check_cmd optional nm-applet "Network tray applet"
check_cmd optional blueman-applet "Bluetooth tray applet"
check_cmd optional wpctl "PipeWire control tool"
check_cmd optional pavucontrol "Advanced audio control UI"
check_cmd optional nmtui "Wi-Fi TUI fallback"
check_cmd optional blueman-manager "Bluetooth GUI fallback"
check_cmd optional grim "Screenshot tool"
check_cmd optional slurp "Screenshot region selector"
check_cmd optional powerprofilesctl "Power profile controller"
check_cmd optional checkupdates "Arch updates helper"
check_cmd optional snapper "Btrfs snapshot manager"
check_cmd optional btrfs "Btrfs userspace tools"
check_cmd optional paru "AUR helper"

echo
printf '[summary] required OK: %d | required WARN: %d\n' \
  "$required_ok" "$required_warn"
printf '[summary] optional OK: %d | optional WARN: %d\n' \
  "$optional_ok" "$optional_warn"
printf '[summary] total OK: %d | total WARN: %d\n' \
  "$((required_ok + optional_ok))" "$((required_warn + optional_warn))"

if [[ "$required_warn" -gt 0 ]]; then
  echo "[hint] Missing required dependencies block stable operation."
fi
if [[ "$optional_warn" -gt 0 ]]; then
  echo "[hint] Missing optional dependencies degrade non-critical features."
fi

if [[ "$strict" -eq 1 && "$required_warn" -gt 0 ]]; then
  exit 1
fi
