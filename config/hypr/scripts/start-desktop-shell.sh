#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf '%s\n' \
    'Usage: start-desktop-shell.sh [--wait | --help]' \
    'Start Polar after importing the current Wayland session environment.' \
    '--wait  Only check that the Polar IPC is ready (used by systemd).'
}

case "${1:-}" in
  --help|-h) usage; exit 0 ;;
  --wait)
    for ((attempt = 0; attempt < 30; attempt++)); do
      if timeout 1 quickshell ipc --path "$HOME/.config/quickshell" \
          call polar controlCenterMonitor >/dev/null 2>&1; then
        exit 0
      fi
      sleep 0.2
    done
    printf '%s\n' '[desktop-shell] Polar IPC did not become ready.' >&2
    exit 1
    ;;
  '') ;;
  *) usage >&2; exit 2 ;;
esac

if [[ -z "${WAYLAND_DISPLAY:-}" || -z "${HYPRLAND_INSTANCE_SIGNATURE:-}" ]]; then
  printf '%s\n' '[desktop-shell] Run this from the active Hyprland session.' >&2
  exit 1
fi

# Import and start sequentially: separate exec-once entries can race at login.
session_vars=(WAYLAND_DISPLAY HYPRLAND_INSTANCE_SIGNATURE)
for variable in DISPLAY XDG_CURRENT_DESKTOP XDG_SESSION_TYPE; do
  [[ ! -v "$variable" ]] || session_vars+=("$variable")
done
if command -v dbus-update-activation-environment >/dev/null 2>&1; then
  dbus-update-activation-environment --systemd "${session_vars[@]}"
fi
systemctl --user import-environment "${session_vars[@]}"

if systemctl --user start quickshell.service; then
  printf '%s\n' '[desktop-shell] Polar is ready.'
else
  printf '%s\n' '[desktop-shell] Polar failed; restoring AGS. See journalctl --user -u quickshell.service.' >&2
  systemctl --user stop quickshell.service quickshell-prototype.service
  systemctl --user start ags.service
  exit 1
fi
