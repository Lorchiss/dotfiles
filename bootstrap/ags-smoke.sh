#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPDATE_SCRIPT="$REPO_DIR/config/ags/scripts/system_update.sh"
ROLLBACK_SCRIPT="$REPO_DIR/config/ags/scripts/snapper_rollback.sh"
CC_STATE_PATH="/tmp/ags-cc-state.json"

since="$(date '+%F %T')"

echo "[ags-smoke] restarting ags.service"
systemctl --user restart ags.service
sleep 2

if ! systemctl --user is-active --quiet ags.service; then
  echo "[ags-smoke] FAIL: ags.service is not active"
  systemctl --user status ags.service --no-pager -n 60 || true
  exit 1
fi

echo "[ags-smoke] forcing control-center tab: system"
printf '%s' '{"activeTab":"system"}' > "$CC_STATE_PATH"

echo "[ags-smoke] toggling control-center"
ags toggle control-center
sleep 1
ags toggle control-center

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
ags toggle spotify
sleep 1
ags toggle spotify

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
