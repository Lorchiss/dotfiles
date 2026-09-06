#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPDATE_SCRIPT="$REPO_DIR/config/ags/scripts/system_update.sh"
ROLLBACK_SCRIPT="$REPO_DIR/config/ags/scripts/snapper_rollback.sh"
CC_STATE_PATH="/tmp/ags-cc-state.json"

wait_for_ags_ready() {
  local timeout_s="${1:-12}"
  local elapsed=0

  while (( elapsed < timeout_s * 2 )); do
    if systemctl --user is-active --quiet ags.service \
      && ags list 2>/dev/null | grep -qx 'ags'; then
      return 0
    fi
    sleep 0.5
    elapsed=$((elapsed + 1))
  done

  return 1
}

run_ags_toggle() {
  local target="$1"
  local attempts="${2:-8}"
  local delay_s="${3:-0.4}"
  local output=""

  for _ in $(seq 1 "$attempts"); do
    if output="$(ags toggle "$target" 2>&1)"; then
      return 0
    fi

    if printf '%s' "$output" | grep -Eq "UnknownMethod|Object does not exist at path|instance \"ags\" is not runn?ning"; then
      sleep "$delay_s"
      continue
    fi

    echo "$output"
    return 1
  done

  echo "$output"
  return 1
}

since="$(date '+%F %T')"

echo "[ags-smoke] restarting ags.service"
systemctl --user daemon-reload >/dev/null 2>&1 || true
systemctl --user reset-failed ags.service >/dev/null 2>&1 || true
systemctl --user restart ags.service

if ! wait_for_ags_ready 16; then
  echo "[ags-smoke] FAIL: AGS runtime did not become ready"
  systemctl --user status ags.service --no-pager -n 60 || true
  echo "[ags-smoke] ags list:"
  ags list 2>/dev/null || true
  exit 1
fi

echo "[ags-smoke] forcing control-center tab: system"
printf '%s' '{"activeTab":"system"}' > "$CC_STATE_PATH"

echo "[ags-smoke] toggling control-center"
run_ags_toggle control-center
sleep 1
run_ags_toggle control-center

echo "[ags-smoke] toggling command-palette"
run_ags_toggle command-palette
sleep 1
run_ags_toggle command-palette

if [[ -x "$UPDATE_SCRIPT" ]]; then
  echo "[ags-smoke] system update dry-run script"
  if command -v timeout >/dev/null 2>&1; then
    if ! printf '\n' | timeout 25s bash "$UPDATE_SCRIPT" --dry-run >/tmp/ags-smoke-system-update.log 2>&1; then
      echo "[ags-smoke] FAIL: system_update.sh --dry-run"
      cat /tmp/ags-smoke-system-update.log || true
      exit 1
    fi
  else
    if ! printf '\n' | bash "$UPDATE_SCRIPT" --dry-run >/tmp/ags-smoke-system-update.log 2>&1; then
      echo "[ags-smoke] FAIL: system_update.sh --dry-run"
      cat /tmp/ags-smoke-system-update.log || true
      exit 1
    fi
  fi
else
  echo "[ags-smoke] FAIL: missing executable $UPDATE_SCRIPT"
  exit 1
fi

if [[ -x "$ROLLBACK_SCRIPT" ]]; then
  echo "[ags-smoke] rollback helper --help"
  if ! bash "$ROLLBACK_SCRIPT" --help >/tmp/ags-smoke-rollback-help.log 2>&1; then
    echo "[ags-smoke] FAIL: snapper_rollback.sh --help"
    cat /tmp/ags-smoke-rollback-help.log || true
    exit 1
  fi
else
  echo "[ags-smoke] FAIL: missing executable $ROLLBACK_SCRIPT"
  exit 1
fi

echo "[ags-smoke] toggling spotify popup"
run_ags_toggle spotify
sleep 1
run_ags_toggle spotify

if command -v hyprctl >/dev/null 2>&1; then
  monitors_json="$(hyprctl -j monitors 2>/dev/null || printf '[]')"
  if command -v jq >/dev/null 2>&1; then
    monitor_count="$(printf '%s' "$monitors_json" | jq 'map(select(.disabled == false)) | length' 2>/dev/null || printf '0')"
  else
    monitor_count="$(printf '%s' "$monitors_json" | grep -o '"disabled":[[:space:]]*false' | wc -l | tr -d ' ')"
  fi
  if [[ "${monitor_count:-0}" -ge 2 ]]; then
    echo "[ags-smoke] multi-monitor check: detected $monitor_count monitors"
  else
    echo "[ags-smoke] multi-monitor check: detected $monitor_count monitor (no fail)"
  fi

  if command -v jq >/dev/null 2>&1; then
    layers_json="$(hyprctl layers -j 2>/dev/null || printf '{}')"
    bar_layer_count="$(
      printf '%s' "$layers_json" |
        jq '[.[] | .levels["2"][]? | select(.y == 0 and .h >= 40 and .h <= 120)] | length' 2>/dev/null ||
        printf '0'
    )"
  else
    layers_json="$(hyprctl layers -j 2>/dev/null || printf '{}')"
    bar_layer_count="$(printf '%s' "$layers_json" | grep -Ec '"h":[[:space:]]*76' || true)"
  fi

  if [[ "${monitor_count:-0}" -ge 1 && "${bar_layer_count:-0}" -ne "${monitor_count:-0}" ]]; then
    echo "[ags-smoke] FAIL: expected exactly $monitor_count bar layers, found $bar_layer_count"
    exit 1
  fi
  echo "[ags-smoke] bar layer check: found $bar_layer_count top bars"
fi

sleep 1

log_file="$(mktemp)"
journalctl --user -u ags.service --since "$since" --no-pager > "$log_file"

if grep -En "JS ERROR|TypeError|Traceback|CRITICAL|ERROR" "$log_file" >/dev/null; then
  echo "[ags-smoke] FAIL: runtime errors detected"
  grep -En "JS ERROR|TypeError|Traceback|CRITICAL|ERROR" "$log_file" || true
  rm -f "$log_file"
  exit 1
fi

echo "[ags-smoke] PASS"
rm -f "$log_file"
