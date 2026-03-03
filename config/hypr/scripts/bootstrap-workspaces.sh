#!/usr/bin/env bash
set -u

if ! command -v hyprctl >/dev/null 2>&1; then
  exit 0
fi

layout_only=0
skip_restore=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --layout-only)
      layout_only=1
      skip_restore=1
      ;;
    --skip-restore)
      skip_restore=1
      ;;
    -h|--help)
      cat <<'HELP'
Usage: bootstrap-workspaces.sh [options]
  --layout-only   Solo reubica workspaces por monitor (no restaura ni abre apps)
  --skip-restore  No restaurar snapshot; usa bootstrap por defecto
HELP
      exit 0
      ;;
    *)
      echo "[bootstrap-workspaces] unknown arg: $1" >&2
      exit 2
      ;;
  esac
  shift
done

# Workspace strategy:
# - Primary monitor:   1(code) 2(build) 3(term) 4(test/git) 5(misc)
# - Secondary monitor: 6(docs) 7(chat) 8(music) 9(misc)
# Optional overrides:
# - HYPR_PRIMARY_MONITOR=<name>
# - HYPR_SECONDARY_MONITOR=<name>

read_monitors() {
  if command -v jq >/dev/null 2>&1; then
    hyprctl -j monitors 2>/dev/null | jq -r 'sort_by(.x)[] | .name'
    return
  fi

  hyprctl monitors 2>/dev/null |
    awk '
      /^Monitor / {
        name=$2
        gsub(/:$/, "", name)
      }
      /^[[:space:]]*[0-9]+x[0-9]+@[0-9.]+ at / {
        if (name != "") {
          split($0, p, " at ")
          split(p[2], c, "x")
          print c[1] "|" name
          name=""
        }
      }
    ' |
    sort -n -t'|' -k1,1 |
    cut -d'|' -f2
}

read_focused_monitor() {
  if ! command -v jq >/dev/null 2>&1; then
    return 1
  fi

  local focused
  focused="$(hyprctl -j monitors 2>/dev/null | jq -r '.[] | select(.focused == true) | .name' | head -n1)"
  if [ -z "${focused}" ] || [ "${focused}" = "null" ]; then
    return 1
  fi

  printf '%s\n' "${focused}"
}

contains_monitor() {
  local needle="$1"
  shift

  local monitor
  for monitor in "$@"; do
    if [ "${monitor}" = "${needle}" ]; then
      return 0
    fi
  done

  return 1
}

mapfile -t monitors < <(read_monitors)
if [ "${#monitors[@]}" -eq 0 ]; then
  sleep 1
  mapfile -t monitors < <(read_monitors)
fi

if [ "${#monitors[@]}" -eq 0 ]; then
  exit 0
fi

primary_monitor=""
secondary_monitor=""

if [ -n "${HYPR_PRIMARY_MONITOR:-}" ] && contains_monitor "${HYPR_PRIMARY_MONITOR}" "${monitors[@]}"; then
  primary_monitor="${HYPR_PRIMARY_MONITOR}"
else
  if focused_monitor="$(read_focused_monitor)"; then
    if contains_monitor "${focused_monitor}" "${monitors[@]}"; then
      primary_monitor="${focused_monitor}"
    fi
  fi
fi

if [ -z "${primary_monitor}" ]; then
  primary_monitor="${monitors[0]}"
fi

if [ -n "${HYPR_SECONDARY_MONITOR:-}" ] &&
  contains_monitor "${HYPR_SECONDARY_MONITOR}" "${monitors[@]}" &&
  [ "${HYPR_SECONDARY_MONITOR}" != "${primary_monitor}" ]; then
  secondary_monitor="${HYPR_SECONDARY_MONITOR}"
else
  monitor=""
  for monitor in "${monitors[@]}"; do
    if [ "${monitor}" != "${primary_monitor}" ]; then
      secondary_monitor="${monitor}"
      break
    fi
  done
fi

if [ -z "${secondary_monitor}" ]; then
  secondary_monitor="${primary_monitor}"
fi

for workspace_id in 1 2 3 4 5; do
  hyprctl dispatch moveworkspacetomonitor "${workspace_id}" "${primary_monitor}" >/dev/null 2>&1 || true
done

for workspace_id in 6 7 8 9; do
  hyprctl dispatch moveworkspacetomonitor "${workspace_id}" "${secondary_monitor}" >/dev/null 2>&1 || true
done

if [ "${layout_only}" -eq 1 ]; then
  exit 0
fi

restore_last_session() {
  if [ "${skip_restore}" -eq 1 ]; then
    return 1
  fi

  if [ "${HYPR_DISABLE_WINDOW_SESSION_RESTORE:-0}" = "1" ]; then
    return 1
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    return 1
  fi

  local restore_script="${HOME}/.config/hypr/scripts/window-session.py"
  if [ ! -x "${restore_script}" ]; then
    return 1
  fi

  local state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/hypr"
  local log_file="${state_dir}/window-session.log"
  mkdir -p "${state_dir}"

  local now
  now="$(date -Iseconds)"
  local output
  if output="$(python3 "${restore_script}" restore 2>&1)"; then
    printf '[%s] restore ok: %s\n' "${now}" "${output:-no-output}" >>"${log_file}"
    return 0
  fi

  printf '[%s] restore fail: %s\n' "${now}" "${output:-unknown-error}" >>"${log_file}"
  return 1
}

if restore_last_session; then
  exit 0
fi

{
  state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/hypr"
  mkdir -p "${state_dir}"
  printf '[%s] restore unavailable, applying default bootstrap\n' "$(date -Iseconds)" >>"${state_dir}/window-session.log"
} >/dev/null 2>&1 || true

launch_if_missing() {
  local command_name="$1"
  local process_name="$2"
  local workspace_id="$3"
  local launch_command="$4"

  if [ -n "$command_name" ] && ! command -v "$command_name" >/dev/null 2>&1; then
    return 0
  fi

  if [ -n "$process_name" ] && pgrep -x "$process_name" >/dev/null 2>&1; then
    return 0
  fi

  hyprctl dispatch exec "[workspace ${workspace_id} silent] ${launch_command}" >/dev/null 2>&1 || true
}

launch_if_missing "code" "code" "1" "code"
launch_if_missing "kitty" "kitty" "2" "kitty"
launch_if_missing "firefox" "firefox" "6" "firefox"

if pgrep -x spotify >/dev/null 2>&1; then
  exit 0
fi

if command -v spotify >/dev/null 2>&1; then
  hyprctl dispatch exec "[workspace 8 silent] spotify" >/dev/null 2>&1 || true
elif command -v gtk-launch >/dev/null 2>&1; then
  hyprctl dispatch exec "[workspace 8 silent] gtk-launch spotify" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  hyprctl dispatch exec "[workspace 8 silent] xdg-open spotify:" >/dev/null 2>&1 || true
fi
