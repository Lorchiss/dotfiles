#!/usr/bin/env bash
set -u

if ! command -v hyprctl >/dev/null 2>&1; then
  exit 0
fi

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

mapfile -t monitors < <(read_monitors)
if [ "${#monitors[@]}" -eq 0 ]; then
  sleep 1
  mapfile -t monitors < <(read_monitors)
fi

if [ "${#monitors[@]}" -eq 0 ]; then
  exit 0
fi

monitor_left="${monitors[0]}"
monitor_right="${monitors[1]:-${monitor_left}}"

hyprctl dispatch moveworkspacetomonitor 1 "$monitor_left" >/dev/null 2>&1 || true
hyprctl dispatch moveworkspacetomonitor 3 "$monitor_left" >/dev/null 2>&1 || true
hyprctl dispatch moveworkspacetomonitor 2 "$monitor_right" >/dev/null 2>&1 || true
hyprctl dispatch moveworkspacetomonitor 4 "$monitor_right" >/dev/null 2>&1 || true

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

launch_if_missing "kitty" "kitty" "1" "kitty"
launch_if_missing "firefox" "firefox" "2" "firefox"
launch_if_missing "code" "code" "3" "code"

if pgrep -x spotify >/dev/null 2>&1; then
  exit 0
fi

if command -v spotify >/dev/null 2>&1; then
  hyprctl dispatch exec "[workspace 4 silent] spotify" >/dev/null 2>&1 || true
elif command -v gtk-launch >/dev/null 2>&1; then
  hyprctl dispatch exec "[workspace 4 silent] gtk-launch spotify" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  hyprctl dispatch exec "[workspace 4 silent] xdg-open spotify:" >/dev/null 2>&1 || true
fi
