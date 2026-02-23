#!/usr/bin/env bash
set -euo pipefail

ok=0
warn=0

check_cmd() {
  local cmd="$1"
  local label="${2:-$1}"

  if command -v "$cmd" >/dev/null 2>&1; then
    echo "✅ OK   $label ($cmd)"
    ok=$((ok + 1))
  else
    echo "⚠️ WARN $label ($cmd)"
    warn=$((warn + 1))
  fi
}

echo "[dotfiles] preflight dependency check"

echo "- Core session"
check_cmd hyprctl "Hyprland control"
check_cmd ags "Aylur's GTK Shell"
check_cmd systemctl "systemd user manager"

echo "- Bar metrics / widgets"
check_cmd playerctl "Media metadata / controls"
check_cmd pactl "Audio volume control"
check_cmd iw "Wi-Fi signal"
check_cmd ip "Network interface status"
check_cmd awk "Text processing"
check_cmd curl "HTTP fetch for cover art / API"
check_cmd python3 "Spotify API helper runtime"
check_cmd xdg-open "Open browser for Spotify OAuth"
check_cmd notify-send "Desktop notifications for popup actions"

echo "- Optional desktop extras"
check_cmd nm-applet "Network tray applet"
check_cmd blueman-applet "Bluetooth tray applet"
check_cmd grim "Screenshot tool"
check_cmd slurp "Screenshot region selector"

echo
printf '[summary] OK: %d | WARN: %d\n' "$ok" "$warn"

if [[ "$warn" -gt 0 ]]; then
  echo "[hint] Install missing WARN dependencies for full bar/popup functionality."
fi
