#!/usr/bin/env bash
set -u

if ! command -v hyprctl >/dev/null 2>&1; then
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  exit 0
fi

session_script="${HOME}/.config/hypr/scripts/window-session.py"
if [ ! -x "${session_script}" ]; then
  exit 0
fi

lock_path="${XDG_RUNTIME_DIR:-/tmp}/hypr-window-session-daemon.lock"
mkdir -p "$(dirname "${lock_path}")"
exec 9>"${lock_path}"
if command -v flock >/dev/null 2>&1; then
  flock -n 9 || exit 0
fi

interval="${HYPR_WINDOW_SESSION_AUTOSAVE_INTERVAL:-20}"
if ! [ "${interval}" -ge 5 ] 2>/dev/null; then
  interval=20
fi

save_now() {
  python3 "${session_script}" save >/dev/null 2>&1 || true
}

cleanup() {
  save_now
}

trap cleanup EXIT INT TERM HUP

while true; do
  save_now
  sleep "${interval}" || break
done
