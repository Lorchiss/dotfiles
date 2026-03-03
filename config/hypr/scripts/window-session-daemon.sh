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

state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/hypr"
log_file="${state_dir}/window-session.log"
mkdir -p "${state_dir}"

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

startup_grace="${HYPR_WINDOW_SESSION_STARTUP_GRACE:-25}"
if ! [ "${startup_grace}" -ge 0 ] 2>/dev/null; then
  startup_grace=25
fi

save_now() {
  local now
  now="$(date -Iseconds)"
  local output
  if output="$(python3 "${session_script}" save --skip-empty 2>&1)"; then
    printf '[%s] save ok: %s\n' "${now}" "${output:-no-output}" >>"${log_file}"
  else
    printf '[%s] save fail: %s\n' "${now}" "${output:-unknown-error}" >>"${log_file}"
  fi
}

cleanup() {
  save_now
}

trap cleanup EXIT INT TERM HUP

printf '[%s] daemon start (interval=%ss grace=%ss)\n' \
  "$(date -Iseconds)" "${interval}" "${startup_grace}" >>"${log_file}"

if [ "${startup_grace}" -gt 0 ]; then
  sleep "${startup_grace}" || true
fi

while true; do
  save_now
  sleep "${interval}" || break
done
